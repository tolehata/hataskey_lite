<!--
SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]">
	<!-- 旗鯖fork: タブをピルケース型に (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div v-if="tab === 'owned'">
			<MkPagination v-slot="{items}" :paginator="ownedPaginator">
				<MkA v-for="group in items" :key="group.id" :class="$style.group" class="_panel" :to="`/my/groups/${ group.id }`">
					<div :class="$style.name">{{ group.name }}</div>
					<MkAvatars :class="$style.avatars" :userIds="group.userIds ?? []"/>
				</MkA>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'joined'">
			<MkPagination v-slot="{items}" :paginator="joinedPaginator">
				<div v-for="group in items" :class="$style.group" class="_panel">
					<MkA :key="group.id" :class="$style.groupTop" :to="`/my/groups/${ group.id }`">
						<div :class="$style.name">{{ group.name }}</div>
						<MkAvatars :class="$style.avatars" :userIds="group.userIds ?? []"/>
					</MkA>
					<div :class="$style.actions">
						<MkButton rounded danger @click="leave(group)">{{ i18n.ts.leaveGroup }}</MkButton>
					</div>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'invites'">
			<MkPagination v-slot="{items}" :paginator="invitationPaginator">
				<div v-for="invitation in items" :key="invitation.id" :class="$style.group" class="_panel">
					<div :class="$style.name">{{ invitation.group.name }}</div>
					<MkAvatars :class="$style.avatars" :userIds="invitation.group.userIds ?? []"/>
					<div :class="$style.actions">
						<MkButton primary rounded inline :class="$style.invitesButton" @click="acceptInvite(invitation)"><i class="ti ti-check"></i> {{ i18n.ts.accept }}</MkButton>
						<MkButton rounded inline :class="$style.invitesButton" @click="rejectInvite(invitation)"><i class="ti ti-x"></i> {{ i18n.ts.reject }}</MkButton>
					</div>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import MkAvatars from '@/components/MkAvatars.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { Paginator } from '@/utility/paginator.js';

const ownedPaginator = markRaw(new Paginator('users/groups/owned', {
	limit: 10,
	// sort: '+createdAt/updatedAt',
}));
const joinedPaginator = markRaw(new Paginator('users/groups/joined', {
	limit: 10,
}));
const invitationPaginator = markRaw(new Paginator('i/user-group-invites', {
	limit: 10,
}));

const tab = ref('owned');

async function create() {
	const { canceled, result: name } = await os.inputText({
		title: i18n.ts.groupName,
	});
	if (canceled) return;
	await os.apiWithDialog('users/groups/create', {
		name: name ?? '',
	}).then(() => {
		os.success();
		ownedPaginator.reload();
	});
}

async function acceptInvite(invitation) {
	os.apiWithDialog('users/groups/invitations/accept', {
		invitationId: invitation.id,
	}).then(() => {
		os.success();
		joinedPaginator.reload();
		invitationPaginator.reload();
	});
}

function rejectInvite(invitation) {
	os.apiWithDialog('users/groups/invitations/reject', {
		invitationId: invitation.id,
	}).then(() => {
		joinedPaginator.reload();
		invitationPaginator.reload();
		// this.$refs.invitations.reload();
	});
}

async function leave(group) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.leaveGroupConfirm({ name: group.name }),
	});
	if (canceled) return;
	os.apiWithDialog('users/groups/leave', {
		groupId: group.id,
	}).then(() => {
		ownedPaginator.reload();
		joinedPaginator.reload();
	});
}

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts.createGroup,
	handler: create,
}]);

const headerTabs = computed(() => [{
	key: 'owned',
	title: i18n.ts.ownedGroups,
	icon: 'ti ti-flag',
}, {
	key: 'joined',
	title: i18n.ts.joinedGroups,
	icon: 'ti ti-id-badge',
}, {
	key: 'invites',
	title: i18n.ts.invites,
	icon: 'ti ti-mail-opened',
}]);

definePage(() => ({
	title: i18n.ts.groups,
	icon: 'ti ti-users',
}));
</script>

<style lang="scss" module>
/* 旗鯖fork: ピル型タブ (Hataskey UI 統一デザイン) */
.htkPillTabs {
	position: sticky;
	top: 0;
	z-index: 50;
	display: flex;
	justify-content: center;
	padding: 12px 16px;
	background: var(--MI-page-controls-background, color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent));
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	margin-bottom: 8px;
}

.htkPillTabsInner {
	display: inline-flex;
	gap: 4px;
	padding: 4px;
	background: var(--MI-page-tabs-background, var(--MI_THEME-panel));
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	max-width: 100%;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
}

.htkPillTab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	font-weight: 500;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}

	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}

.actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 10px;
	padding: 0 24px 16px;
}

.add {
	margin: 0 auto var(--MI-margin) auto;
}

.group {
	display: block;
	border: solid 1px var(--MI_THEME-divider);
	border-radius: 6px;

	&:hover {
		border: solid 1px var(--MI_THEME-accent);
		text-decoration: none;
	}

	&:not(:last-child) {
		margin-bottom: 8px;
	}
}

.groupTop {
	&:hover {
		text-decoration: none;
	}
}

.name {
	margin-bottom: 12px;
	border-bottom: solid 1px var(--MI_THEME-divider);
	padding: 16px 24px;
	font-weight: bold;
}

.avatars {
	padding: 8px 24px 16px;
}

.invitesButton {
	&:not(:last-child) {
		margin-right: 5px;
	}
}
</style>
