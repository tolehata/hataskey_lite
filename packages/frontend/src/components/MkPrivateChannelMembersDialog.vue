<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: プライベートチャンネルのメンバー管理ダイアログ。
-->

<template>
<MkModalWindow
	ref="dialogEl"
	:width="500"
	:height="600"
	@close="dialogEl?.close()"
	@closed="emit('closed')"
>
	<template #header><i class="ti ti-users"></i> {{ copy.membersTitle }}</template>

	<MkSpacer :marginMin="14" :marginMax="22">
		<div class="_gaps">
			<div class="_buttonsCenter">
				<MkButton primary rounded @click="addMember"><i class="ti ti-user-plus"></i> {{ copy.sendInvitation }}</MkButton>
			</div>

			<MkLoading v-if="fetching"/>
			<div v-else-if="members.length === 0 && invitations.length === 0" :class="$style.empty">{{ copy.noMembersOrInvitations }}</div>
			<div v-else class="_gaps_s">
				<div v-for="u in members" :key="u.id" :class="$style.row">
					<MkAvatar :user="u" :class="$style.avatar" link/>
					<div :class="$style.body">
						<MkUserName :user="u"/>
						<MkAcct :user="u" :class="$style.acct"/>
					</div>
					<span v-if="u.id === ownerId" :class="$style.ownerBadge">{{ copy.owner }}</span>
					<template v-else>
						<span :class="[$style.statusBadge, $style.statusJoined]"><i class="ti ti-circle-check"></i> {{ copy.joined }}</span>
						<MkButton danger rounded small @click="removeMember(u)"><i class="ti ti-user-minus"></i></MkButton>
					</template>
				</div>
				<div v-for="invitation in invitations" :key="invitation.id" :class="$style.row">
					<MkAvatar :user="invitation.user" :class="$style.avatar" link/>
					<div :class="$style.body">
						<MkUserName :user="invitation.user"/>
						<MkAcct :user="invitation.user" :class="$style.acct"/>
					</div>
					<span v-if="invitation.status === 'pending'" :class="[$style.statusBadge, $style.statusPending]"><i class="ti ti-clock"></i> {{ copy.inviting }}</span>
					<span v-else :class="[$style.statusBadge, $style.statusRejected]"><i class="ti ti-circle-x"></i> {{ copy.invitationRejected }}</span>
					<MkButton v-if="invitation.status === 'rejected'" rounded small @click="inviteUser(invitation.user)"><i class="ti ti-refresh"></i> {{ copy.inviteAgain }}</MkButton>
				</div>
			</div>
		</div>
	</MkSpacer>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';

const copy = i18n.ts._hata._privateChannels;

const props = defineProps<{
	channelId: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const dialogEl = useTemplateRef('dialogEl');

const members = ref<Misskey.entities.UserLite[]>([]);
type ChannelInvitation = {
	id: string;
	createdAt: string;
	respondedAt: string | null;
	status: 'pending' | 'rejected';
	user: Misskey.entities.UserLite;
};
const invitations = ref<ChannelInvitation[]>([]);
const ownerId = ref<string | null>(null);
const fetching = ref(true);

async function fetchAll() {
	fetching.value = true;
	try {
		const [channel, list, invitationList] = await Promise.all([
			misskeyApi('channels/show', { channelId: props.channelId }),
			misskeyApi('channels/members', { channelId: props.channelId, limit: 100 }),
			misskeyApi('channels/invitations', { channelId: props.channelId, limit: 100 }),
		]);
		ownerId.value = channel.userId;
		members.value = list;
		invitations.value = invitationList as ChannelInvitation[];
	} finally {
		fetching.value = false;
	}
}

fetchAll();

async function addMember() {
	const u = await os.selectUser({ includeSelf: false, localOnly: true });
	if (u == null) return;
	await inviteUser(u);
}

async function inviteUser(u: Misskey.entities.UserLite) {
	await os.apiWithDialog('channels/add-member', {
		channelId: props.channelId,
		userId: u.id,
	});
	await fetchAll();
}

async function removeMember(u: Misskey.entities.UserLite) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx._hata._privateChannels.removeMemberConfirm({ name: u.name ?? u.username }),
	});
	if (canceled) return;
	await os.apiWithDialog('channels/remove-member', {
		channelId: props.channelId,
		userId: u.id,
	});
	await fetchAll();
}
</script>

<style lang="scss" module>
.empty {
	text-align: center;
	opacity: 0.7;
	padding: 24px 0;
}

.row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border-radius: 8px;
	background: var(--MI_THEME-panel);
}

.avatar {
	width: 38px;
	height: 38px;
	flex-shrink: 0;
}

.body {
	flex: 1;
	min-width: 0;
}

.acct {
	opacity: 0.7;
	font-size: 0.85em;
}

.ownerBadge {
	font-size: 0.8em;
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}

.statusBadge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
	font-size: 0.78em;
	font-weight: 700;
	padding: 3px 8px;
	border-radius: 999px;
}

.statusJoined {
	color: var(--MI_THEME-success);
	background: color-mix(in srgb, var(--MI_THEME-success) 12%, transparent);
}

.statusPending {
	color: var(--MI_THEME-warn);
	background: color-mix(in srgb, var(--MI_THEME-warn) 12%, transparent);
}

.statusRejected {
	color: var(--MI_THEME-error);
	background: color-mix(in srgb, var(--MI_THEME-error) 12%, transparent);
}
</style>
