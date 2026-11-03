<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div v-if="channelId == null || channel != null" class="_gaps_m">
			<MkInput v-model="name">
				<template #label>{{ i18n.ts.name }}</template>
			</MkInput>

			<MkTextarea v-model="description" mfmAutocomplete :mfmPreview="true">
				<template #label>{{ i18n.ts.description }}</template>
			</MkTextarea>

			<MkColorInput v-model="color">
				<template #label>{{ i18n.ts.color }}</template>
			</MkColorInput>

			<MkSwitch v-model="isSensitive">
				<template #label>{{ i18n.ts.sensitive }}</template>
			</MkSwitch>

			<MkSwitch v-model="allowRenoteToExternal">
				<template #label>{{ i18n.ts._channel.allowRenoteToExternal }}</template>
			</MkSwitch>

			<div>
				<div :class="$style.subAdminsLabel">{{ i18n.ts._hata._channels.managers }}</div>
				<div :class="$style.subAdmins">
					<span v-for="u in moderatorUsers" :key="u.id" :class="$style.subAdminChip">
						<!-- 旗鯖fork: u.name を生テキスト出力するとユーザー名のカスタム絵文字が
						     :shortcode: のまま表示されてしまうため、MFM レンダリングする MkUserName を使う。 -->
						<MkAvatar :class="$style.subAdminAvatar" :user="u"/><MkUserName :user="u"/>
						<button class="_button" :class="$style.subAdminRemove" @click="removeSubAdmin(u.id)"><i class="ti ti-x"></i></button>
					</span>
					<MkButton rounded @click="addSubAdmin"><i class="ti ti-plus"></i> {{ i18n.ts.add }}</MkButton>
				</div>
			</div>

			<div>
				<MkButton v-if="bannerId == null" @click="setBannerImage"><i class="ti ti-plus"></i> {{ i18n.ts._channel.setBanner }}</MkButton>
				<div v-else-if="bannerUrl">
					<img :src="bannerUrl" style="width: 100%;"/>
					<MkButton @click="removeBannerImage()"><i class="ti ti-trash"></i> {{ i18n.ts._channel.removeBanner }}</MkButton>
				</div>
			</div>

			<MkFolder :defaultOpen="true">
				<template #label>{{ i18n.ts.pinnedNotes }}</template>

				<div class="_gaps">
					<MkButton primary rounded @click="addPinnedNote()"><i class="ti ti-plus"></i></MkButton>

					<Sortable
						v-model="pinnedNotes"
						itemKey="id"
						:handle="'.' + $style.pinnedNoteHandle"
						:animation="150"
					>
						<template #item="{element,index}">
							<div :class="$style.pinnedNote">
								<button class="_button" :class="$style.pinnedNoteHandle"><i class="ti ti-menu"></i></button>
								{{ element.id }}
								<button class="_button" :class="$style.pinnedNoteRemove" @click="removePinnedNote(index)"><i class="ti ti-x"></i></button>
							</div>
						</template>
					</Sortable>
				</div>
			</MkFolder>

			<div class="_buttons">
				<MkButton primary @click="save()"><i class="ti ti-device-floppy"></i> {{ channelId ? i18n.ts.save : i18n.ts.create }}</MkButton>
				<MkButton v-if="channelId" danger @click="archive()"><i class="ti ti-trash"></i> {{ i18n.ts.archive }}</MkButton>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, watch, defineAsyncComponent } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkColorInput from '@/components/MkColorInput.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import { $i } from '@/i.js';
import { selectFile } from '@/utility/drive.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { useRouter } from '@/router.js';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const router = useRouter();

const props = defineProps<{
	channelId?: string;
}>();

const channel = ref<Misskey.entities.Channel | null>(null);
const name = ref<string>('');
const description = ref<string | null>(null);
const bannerUrl = ref<string | null>(null);
const bannerId = ref<string | null>(null);
const color = ref('#000');
const isSensitive = ref(false);
const allowRenoteToExternal = ref(true);
const pinnedNotes = ref<{ id: Misskey.entities.Note['id'] }[]>([]);
// 旗鯖fork: 副管理者
const moderatorUsers = ref<Misskey.entities.UserDetailed[]>([]);

watch(() => bannerId.value, async () => {
	if (bannerId.value == null) {
		bannerUrl.value = null;
	} else {
		bannerUrl.value = (await misskeyApi('drive/files/show', {
			fileId: bannerId.value,
		})).url;
	}
});

async function fetchChannel() {
	if (props.channelId == null) return;

	const result = await misskeyApi('channels/show', {
		channelId: props.channelId,
	});

	name.value = result.name;
	description.value = result.description;
	bannerId.value = result.bannerId;
	bannerUrl.value = result.bannerUrl;
	isSensitive.value = result.isSensitive;
	pinnedNotes.value = result.pinnedNoteIds.map(id => ({
		id,
	}));
	color.value = result.color;
	allowRenoteToExternal.value = result.allowRenoteToExternal;
	// 旗鯖fork: 副管理者
	if (result.moderatorUserIds && result.moderatorUserIds.length > 0) {
		moderatorUsers.value = await misskeyApi('users/show', { userIds: result.moderatorUserIds });
	}

	channel.value = result;
}

fetchChannel();

// 旗鯖fork: 副管理者の追加・削除
async function addSubAdmin() {
	const u = await os.selectUser({ includeSelf: false, localOnly: true });
	if (u == null) return;
	if (moderatorUsers.value.some(x => x.id === u.id)) return;
	moderatorUsers.value = [...moderatorUsers.value, u];
}

function removeSubAdmin(userId: string) {
	moderatorUsers.value = moderatorUsers.value.filter(x => x.id !== userId);
}

async function addPinnedNote() {
	const { canceled, result: value } = await os.inputText({
		title: i18n.ts.noteIdOrUrl,
	});
	if (canceled || value == null) return;
	const fromUrl = value.includes('/') ? value.split('/').pop() : null;
	const note = await os.apiWithDialog('notes/show', {
		noteId: fromUrl ?? value,
	});
	pinnedNotes.value = [{
		id: note.id,
	}, ...pinnedNotes.value];
}

function removePinnedNote(index: number) {
	pinnedNotes.value.splice(index, 1);
}

function save() {
	const params = {
		name: name.value,
		description: description.value,
		bannerId: bannerId.value,
		color: color.value,
		isSensitive: isSensitive.value,
		allowRenoteToExternal: allowRenoteToExternal.value,
		// 旗鯖fork: 副管理者
		moderatorUserIds: moderatorUsers.value.map(u => u.id),
	} satisfies Misskey.entities.ChannelsCreateRequest;

	if (props.channelId != null) {
		os.apiWithDialog('channels/update', {
			...params,
			channelId: props.channelId,
			pinnedNoteIds: pinnedNotes.value.map(x => x.id),
		});
	} else {
		os.apiWithDialog('channels/create', params).then(created => {
			router.push('/channels/:channelId', {
				params: {
					channelId: created.id,
				},
			});
		});
	}
}

async function archive() {
	if (props.channelId == null) return;

	const { canceled } = await os.confirm({
		type: 'warning',
		title: i18n.tsx.channelArchiveConfirmTitle({ name: name.value }),
		text: i18n.ts.channelArchiveConfirmDescription,
	});
	if (canceled) return;

	misskeyApi('channels/update', {
		channelId: props.channelId,
		isArchived: true,
	}).then(() => {
		os.success();
	});
}

function setBannerImage(evt) {
	selectFile({
		anchorElement: evt.currentTarget ?? evt.target,
		multiple: false,
	}).then(file => {
		bannerId.value = file.id;
	});
}

function removeBannerImage() {
	bannerId.value = null;
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: props.channelId ? i18n.ts._channel.edit : i18n.ts._channel.create,
	icon: 'ti ti-device-tv',
}));
</script>

<style lang="scss" module>
.pinnedNote {
	position: relative;
	display: block;
	line-height: 2.85rem;
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
	color: var(--MI_THEME-navFg);
}

.pinnedNoteRemove {
	position: absolute;
	z-index: 10000;
	width: 32px;
	height: 32px;
	color: #ff2a2a;
	right: 8px;
	opacity: 0.8;
}

.pinnedNoteHandle {
	cursor: move;
	width: 32px;
	height: 32px;
	margin: 0 8px;
	opacity: 0.5;
}

/* 旗鯖fork: プライベートチャンネル */

/* 旗鯖fork: プライベートチャンネルの副管理者 */
.subAdminsLabel {
	font-size: 0.85em;
	opacity: 0.8;
	margin-bottom: 6px;
}

.subAdmins {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
}

.subAdminChip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px 4px 4px;
	border-radius: 999px;
	background: var(--MI_THEME-buttonBg);
	font-size: 0.9em;
}

.subAdminAvatar {
	width: 24px;
	height: 24px;
}

.subAdminRemove {
	color: #ff2a2a;
	opacity: 0.8;
}

/* 旗鯖fork: あいことば表示・コピー・再生成 UI */
</style>
