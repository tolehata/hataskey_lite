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

			<MkSwitch v-model="allowRenoteToExternal" :disabled="isPrivate">
				<template #label>{{ i18n.ts._channel.allowRenoteToExternal }}</template>
				<template v-if="isPrivate" #caption>{{ copy.externalRenoteDisabled }}</template>
			</MkSwitch>

			<!-- 旗鯖fork: プライベートチャンネル。権限が無くても項目は残し、機能を周知する。一度設定すると解除不可。 -->
			<MkSwitch :modelValue="isPrivate" :disabled="!canMakePrivateChannel || wasPrivate" @update:modelValue="onTogglePrivate">
				<template #label>
					{{ copy.privateChannel }}
					<span v-if="!canMakePrivateChannel && !wasPrivate" :class="$style.lockedBadge"><i class="ti ti-lock"></i> {{ copy.permissionRequired }}</span>
					<span v-if="wasPrivate" :class="$style.lockedBadge"><i class="ti ti-lock"></i> {{ copy.cannotDisable }}</span>
				</template>
				<template #caption>
					{{ copy.privateDescription }}
					<br>{{ copy.privateIrreversible }}
					<template v-if="wasPrivate"><br>{{ copy.alreadyPrivate }}</template>
				</template>
			</MkSwitch>
			<div v-if="!canMakePrivateChannel && !wasPrivate" :class="$style.privateChannelRestriction"><i class="ti ti-lock"></i><span>{{ copy.restrictedByAdmin }}<br>{{ copy.adminPermissionRequired }}</span></div>

			<template v-if="isPrivate">
				<!-- 旗鯖fork: あいことばはサーバー側で暗号学的乱数による自動生成 (32文字英数字)。
				     ユーザー入力の弱い合言葉 (例: '1234') をブルートフォースで突破される事故と、
				     UI 上で平文編集できることのフィッシング/ショルダーハック懸念を同時に解消するため、
				     表示・コピー・再生成のみ可能な UI に変更。 -->
				<div :class="$style.passwordBox">
					<div :class="$style.passwordLabel"><i class="ti ti-key"></i> {{ copy.generatedPassphrase }}</div>
					<div :class="$style.passwordRow">
						<code :class="$style.passwordValue">{{ channelId && hasPassword ? (passwordRevealed ? currentPassword : '••••••••••••••••••••••••••••••••') : copy.generatedOnCreation }}</code>
						<button v-if="channelId && hasPassword" :class="$style.passwordBtn" v-tooltip="passwordRevealed ? i18n.ts.hide : i18n.ts.show" @click="passwordRevealed = !passwordRevealed">
							<i :class="passwordRevealed ? 'ti ti-eye-off' : 'ti ti-eye'"></i>
						</button>
						<button v-if="channelId && hasPassword" :class="$style.passwordBtn" v-tooltip="i18n.ts.copy" :disabled="!passwordRevealed" @click="copyPassword">
							<i class="ti ti-copy"></i>
						</button>
						<button v-if="channelId && hasPassword" :class="[$style.passwordBtn, $style.passwordBtnWarn]" v-tooltip="copy.regeneratePassphraseTooltip" @click="confirmRegeneratePassword">
							<i class="ti ti-refresh"></i>
						</button>
					</div>
					<div :class="$style.passwordCaption">
						{{ copy.passphraseAccess }}<br>
						<b>{{ copy.regenerateInvalidates }}</b>{{ copy.regenerateExplanation }}
					</div>
				</div>

				<div>
					<div :class="$style.subAdminsLabel">{{ copy.managers }}</div>
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
			</template>

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
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { useRouter } from '@/router.js';

const Sortable = defineAsyncComponent(() => import('vuedraggable').then(x => x.default));

const router = useRouter();
const copy = i18n.ts._hata._privateChannels;

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
// 旗鯖fork: プライベートチャンネル
const isPrivate = ref(false);
// 読み込み時点で既にプライベートだったか(解除不可の判定用)。
const wasPrivate = ref(false);
// 旗鯖fork: あいことばはサーバー側自動生成。frontend は表示/コピー/再生成のみ。
const currentPassword = ref<string>('');  // GET 経由で取得した平文 (showWithPassword で初回取得)
const hasPassword = ref(false);
const passwordRevealed = ref(false);
const moderatorUsers = ref<Misskey.entities.UserDetailed[]>([]);
// このユーザーがプライベートチャンネルを作成できるか(ロールポリシー)。権限が無くても項目は表示する(機能の周知のため)。
const canMakePrivateChannel = computed(() => $i?.policies?.canMakePrivateChannel === true);

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
	// 旗鯖fork: プライベートチャンネル
	isPrivate.value = result.isPrivate;
	wasPrivate.value = result.isPrivate;
	hasPassword.value = result.hasPassword;
	// 旗鯖fork: あいことばの本体を取得 (チャンネル管理者のみ可)。表示・コピー・再生成 UI で使用。
	if (result.isPrivate && result.hasPassword) {
		try {
			const r = await misskeyApi('channels/show-password' as any, { channelId: props.channelId });
			currentPassword.value = (r as any).password ?? '';
		} catch {
			currentPassword.value = '';
		}
	}
	if (result.moderatorUserIds && result.moderatorUserIds.length > 0) {
		moderatorUsers.value = await misskeyApi('users/show', { userIds: result.moderatorUserIds });
	}

	channel.value = result;
}

fetchChannel();

// 旗鯖fork: あいことばをコピー (表示状態でのみ可能)。
function copyPassword() {
	if (!passwordRevealed.value || !currentPassword.value) return;
	copyToClipboard(currentPassword.value);
	os.toast(copy.passphraseCopied);
}

// 旗鯖fork: あいことばを再生成する。実行前に confirm で「旧あいことばは無効化される」旨を周知。
// 成功後は新しい合言葉を再フェッチして UI を更新する。
async function confirmRegeneratePassword() {
	if (props.channelId == null) return;
	const c = await os.confirm({
		type: 'warning',
		title: copy.regenerateConfirmTitle,
		text: copy.regenerateConfirmText,
	});
	if (c.canceled) return;
	try {
		await misskeyApi('channels/update' as any, {
			channelId: props.channelId,
			regeneratePassword: true,
		});
		// 新しい合言葉を再取得
		const r = await misskeyApi('channels/show-password' as any, { channelId: props.channelId });
		currentPassword.value = (r as any).password ?? '';
		passwordRevealed.value = true;
		os.toast(copy.passphraseRegenerated);
	} catch (err) {
		os.alert({
			type: 'error',
			title: copy.regenerateFailed,
			text: err instanceof Error ? err.message : copy.unknownError,
		});
	}
}

// 旗鯖fork: プライベート化の切替。ONにする時は「解除できない」旨の注意ウィンドウを出す。
async function onTogglePrivate(v: boolean) {
	if (v) {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: copy.makePrivateConfirmTitle,
			text: copy.makePrivateConfirmText,
		});
		if (canceled) return; // OFFのまま
		isPrivate.value = true;
		// プライベートではチャンネル外リノートは常に不可なので、UIも揃える。
		allowRenoteToExternal.value = false;
	} else {
		isPrivate.value = false;
	}
}

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
		// 旗鯖fork: プライベートチャンネル。あいことばはサーバー側で自動生成されるため、
		// frontend からは送らない (再生成は別 API/別フラグで処理)。
		isPrivate: isPrivate.value,
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
.lockedBadge {
	margin-left: 8px;
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 0.75em;
	background: var(--MI_THEME-buttonBg);
	opacity: 0.85;
	vertical-align: middle;
}

.privateChannelRestriction {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	margin-top: -8px;
	padding: 10px 12px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-warn) 42%, var(--MI_THEME-divider));
	border-radius: 10px;
	color: color-mix(in srgb, var(--MI_THEME-warn) 72%, var(--MI_THEME-fg));
	background: color-mix(in srgb, var(--MI_THEME-warn) 9%, var(--MI_THEME-panel));
	font-size: 0.86em;
	line-height: 1.55;
}

.privateChannelRestriction > i {
	margin-top: 2px;
	font-size: 1.1em;
}

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
.passwordBox {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 14px 16px;
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
}
.passwordLabel {
	font-size: .9em;
	font-weight: 700;
	display: flex;
	align-items: center;
	gap: 6px;
	color: var(--MI_THEME-accent);
}
.passwordRow {
	display: flex;
	gap: 6px;
	align-items: center;
	flex-wrap: wrap;
}
.passwordValue {
	flex: 1;
	min-width: 0;
	padding: 8px 12px;
	border-radius: 8px;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
	font-family: monospace;
	font-size: .92em;
	letter-spacing: .04em;
	word-break: break-all;
	overflow-wrap: anywhere;
	color: var(--MI_THEME-fg);
}
.passwordBtn {
	width: 36px;
	height: 36px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	border: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-bg);
	color: var(--MI_THEME-fg);
	cursor: pointer;
	transition: border-color .12s, color .12s, background .12s;
	flex-shrink: 0;
}
.passwordBtn:hover { border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }
.passwordBtn:disabled { opacity: .4; cursor: not-allowed; }
.passwordBtnWarn:hover { border-color: #ff9b3d; color: #ff9b3d; }
.passwordCaption {
	font-size: .8em;
	opacity: .75;
	line-height: 1.55;
}
</style>
