<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed 2f/3b/3c/3d): カスタム絵文字 追加申請ウィザード。
  3b ソース選択(自作 / リモート検索・要ロール) → 2f 自作詳細 / 3c リモート検索 → 3d リモート由来詳細。
  詳細は2ペイン(左=フォーム / 右=ライブプレビュー: 白黒プレビュー + ノート見え方 + 申請枠メーター)。
  3d(リモート由来)は右ペインに出典カードを出し、名前/カテゴリ/タグは元絵文字から自動入力、
  ライセンス欄は「元サーバーの利用条件を確認」の警告状態にする。
  リモート絵文字の申請はロールポリシー canRequestRemoteEmoji(quota.canRemote)が必要。
-->
<template>
<MkWindow
	ref="dialog" class="hatady-scope hatafeed-scope"
	data-hatafeed-window
	:data-hatady-theme="hataFeedTheme"
	centerTitle
	autoHeight
	:initialWidth="820"
	:initialHeight="null"
	:canResize="true"
	:beforeClose="beforeClose"
	:buttonsLeft="backButtons"
	:inert="prompt"
	@closed="emit('closed')"
>
	<template #header>絵文字を申請</template>

	<div :class="$style.content">
		<div v-if="hasDraft" class="hf-draft-offer"><span>端末に保存した下書きがあります</span><button type="button" @click="resumeDraft"><i class="ti ti-pencil-plus" aria-hidden="true"></i>続きから編集</button></div>
		<!-- ステップインジケータ -->
		<div :class="$style.steps">
			<div :class="[$style.step, step >= 1 && $style.stepCur]">
				<span :class="$style.stepNo"><i v-if="step > 1" class="ti ti-check"></i><template v-else>1</template></span> {{ copy.imageStep }}
			</div>
			<div :class="$style.stepBar"></div>
			<div :class="[$style.step, step >= 2 && $style.stepCur]">
				<span :class="$style.stepNo">2</span> {{ copy.detailsStep }}
			</div>
		</div>

		<!-- ================= Step1 ================= -->
		<div v-if="step === 1" :class="$style.gaps">
			<!-- 3b: ソース選択 -->
			<div v-if="mode === 'source'" :class="$style.sources">
				<div v-if="quota && !isStaff" :class="$style.quotaBand">
					<HfQuotaMeter :remaining="quota.remaining" :limit="quota.limit"/>
				</div>

				<button :class="$style.srcCard" :disabled="quotaEmpty" @click="pickImage">
					<span :class="$style.srcTile"><i class="ti ti-photo-up"></i></span>
					<div :class="$style.srcText">
						<div :class="$style.srcName">{{ copy.fromOwnImage }}</div>
						<div :class="$style.srcDesc">{{ copy.fromOwnImageDescription }}</div>
					</div>
					<i class="ti ti-chevron-right" :class="$style.srcArrow"></i>
				</button>

				<button :class="$style.srcCard" :disabled="quotaEmpty || !quota?.canRemote" @click="openRemote">
					<span :class="$style.srcTile"><i class="ti ti-world-search"></i></span>
					<div :class="$style.srcText">
						<div :class="$style.srcName">{{ copy.fromRemoteEmoji }} <span v-if="!quota?.canRemote" :class="$style.roleBadge">{{ copy.roleRequired }}</span></div>
						<div :class="$style.srcDesc">
							<template v-if="quota?.canRemote">{{ copy.fromRemoteDescription }}</template>
							<template v-else>{{ copy.remoteUnavailable }}</template>
						</div>
					</div>
					<i class="ti ti-chevron-right" :class="$style.srcArrow"></i>
				</button>
			</div>

			<!-- 3c: リモート絵文字ブラウザ -->
			<template v-else>
				<div :class="$style.remoteHead">
					<span :class="$style.lead">{{ copy.searchRemote }}</span>
				</div>
				<div :class="$style.searchRow">
					<MkInput v-model="remoteQuery" :class="$style.searchInput" type="search" :placeholder="copy.emojiSearchPlaceholder" @enter="searchRemote(true)">
						<template #prefix><i class="ti ti-search"></i></template>
					</MkInput>
					<MkInput v-model="remoteHostFilter" :class="$style.hostInput" :placeholder="copy.hostPlaceholder" @enter="searchRemote(true)"/>
					<MkButton rounded primary @click="searchRemote(true)">{{ copy.search }}</MkButton>
				</div>
				<div v-if="remoteLoading && remoteResults.length === 0" :class="$style.remoteHint">{{ copy.searching }}</div>
				<div v-else-if="remoteResults.length === 0" :class="$style.remoteHint">{{ copy.noResults }}</div>
				<div v-else :class="$style.remoteGrid">
					<button v-for="e in visibleRemoteResults" :key="e.id" :class="[$style.remoteItem, previewUrl === e.url && $style.remoteItemSel]" @click="pickRemote(e)">
						<img :src="e.url" :class="$style.remoteImg" :alt="e.name"/>
						<div :class="$style.remoteName">:{{ e.name }}:</div>
						<div :class="$style.remoteHost">{{ e.host }}</div>
					</button>
				</div>
				<div v-if="remotePage > 0 || remoteHasMore || remoteResults.length > remotePageSize" :class="$style.remotePager" aria-label="絵文字のページ">
					<MkButton rounded :disabled="remoteLoading || remotePage === 0" aria-label="前のページ" @click="remotePage--"><i class="ti ti-chevron-left" aria-hidden="true"></i></MkButton>
					<span>{{ remotePage + 1 }}</span>
					<MkButton rounded :disabled="remoteLoading || (!remoteHasMore && (remotePage + 1) * remotePageSize >= remoteResults.length)" aria-label="次のページ" @click="nextRemotePage"><i class="ti ti-chevron-right" aria-hidden="true"></i></MkButton>
				</div>
			</template>
		</div>

		<!-- ================= Step2: 詳細(2f 自作 / 3d リモート由来) ================= -->
		<div v-else :class="$style.detailGrid">
			<!-- 左: フォーム -->
			<div :class="$style.form">
				<MkInput v-model="name" :class="$style.fullField">
					<template #label>{{ copy.emojiName }} <span :class="$style.req">{{ copy.required }}</span></template>
					<template #prefix>:</template>
					<template #suffix>:</template>
					<template v-if="sourceType === 'remote'" #caption>{{ copy.remoteNameHint }}</template>
				</MkInput>

				<div :class="[$style.licenseField, sourceType === 'remote' && $style.licenseWarn]">
					<MkInput v-model="license">
						<template #label>{{ copy.license }}</template>
						<template #caption>
							<span v-if="sourceType === 'remote'" :class="$style.warnText"><i class="ti ti-alert-triangle"></i> {{ copy.remoteLicenseHint }}</span>
							<span v-else>{{ copy.ownLicenseHint }}</span>
						</template>
					</MkInput>
				</div>

				<HataFeedCategorySelect v-model="category" :categories="categories"/>
				<MkInput v-model="tagsRaw">
					<template #label>{{ copy.tags }}</template>
					<template #caption>{{ copy.tagsHint }}</template>
				</MkInput>
				<MkSwitch v-model="localOnly" compact>{{ copy.localOnly }}</MkSwitch>
				<MkSwitch v-model="isSensitive" compact>{{ copy.sensitive }}</MkSwitch>

				<!-- 旗鯖fork: 自分の画像から申請した場合、承認されるとドライブの原本は削除される
				     (絵文字はサーバー側に複製されるため表示自体には影響しない)。事前に周知するための注意書き。 -->
				<div v-if="sourceType === 'image'" :class="$style.driveNotice">
					<i class="ti ti-info-circle"></i>
					<span>{{ copy.driveNotice }}</span>
				</div>

				<div :class="$style.navRow">
					<div :class="$style.submitActions">
						<MkButton rounded :disabled="!name.trim() || submitting" @click="submit(false)"><i class="ti ti-library-plus"></i> {{ copy.submitAndContinue }}</MkButton>
						<MkButton rounded primary gradate :disabled="!name.trim() || submitting" @click="submit(true)"><i class="ti ti-send"></i> {{ copy.submit }}</MkButton>
					</div>
				</div>
			</div>

			<!-- 右: ライブプレビュー -->
			<aside :class="$style.preview">
				<div :class="$style.previewLabel">{{ copy.preview }}</div>
				<HfEmojiPreviewPair :url="previewUrl" :size="52"/>

				<!-- 3d: 出典カード -->
				<div v-if="sourceType === 'remote'" :class="$style.sourceCard">
					<div :class="$style.sourceBadge"><i class="ti ti-world"></i> {{ copy.remoteImage }}</div>
					<a v-if="safeOriginalUrl" :class="$style.sourceLink" :href="safeOriginalUrl" target="_blank" rel="noopener noreferrer">
						{{ remoteHost ?? copy.openOriginal }} <i class="ti ti-external-link"></i>
					</a>
				</div>

				<!-- ノートでの見え方 -->
				<div :class="$style.noteHint">
					<div :class="$style.noteHintLabel">{{ copy.notePreview }}</div>
					<div :class="$style.noteFaux">
						{{ copy.notePreviewPrefix }} <img v-if="previewUrl" :src="previewUrl" :class="$style.noteEmoji" :alt="name"/> {{ copy.notePreviewSuffix }}
					</div>
				</div>

				<div v-if="quota && !isStaff" :class="$style.previewQuota">
					<HfQuotaMeter :remaining="quota.remaining" :limit="quota.limit"/>
				</div>
				<div v-else-if="sourceType !== 'remote'" :class="$style.previewTip">
					<i class="ti ti-bulb"></i> {{ copy.themeTip }}
				</div>
			</aside>
		</div>
		<div v-if="step === 1 && mode === 'source'" class="hf-actions"><MkButton rounded @click="dialog?.close()">キャンセル</MkButton></div>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { computed, ref, onMounted, useTemplateRef } from 'vue';
import MkWindow from '@/components/MkWindow.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import '@/components/hatafeed-ui.css';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import HataFeedCategorySelect from '@/components/HataFeedCategorySelect.vue';
import HfQuotaMeter from '@/components/HfQuotaMeter.vue';
import HfEmojiPreviewPair from '@/components/HfEmojiPreviewPair.vue';
import { i18n } from '@/i18n.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataFeedDraft } from '@/utility/hatafeed-draft.js';

const pickers = useHataGoesPickers();
const dialogs = useHataGoesDialogs();
const props = defineProps<{ isStaff?: boolean }>();
const emit = defineEmits<{ (ev: 'done', v: any): void; (ev: 'closed'): void }>();
const dialog = useTemplateRef('dialog');
const copy = i18n.ts._hata._hatafeed._emojiWizard;

const step = ref(1);
const backButtons = computed(() => step.value === 2 || mode.value === 'remote' ? [{ title: copy.back, icon: 'ti ti-arrow-left', onClick: () => { if (step.value === 2) backToStep1(); else mode.value = 'source'; } }] : []);
const mode = ref<'source' | 'remote'>('source');

const sourceType = ref<'image' | 'remote'>('image');
const fileId = ref<string | null>(null);
const originalUrl = ref<string | null>(null);
const remoteHost = ref<string | null>(null);
const previewUrl = ref<string | null>(null);

const name = ref('');
const license = ref('');
const category = ref<string | null>('');
const tagsRaw = ref('');
const localOnly = ref(false);
const isSensitive = ref(false);
const categories = ref<string[]>([]);
const submitting = ref(false);

const quota = ref<{ limit: number; used: number; remaining: number; canRemote: boolean; resetAt: string | null } | null>(null);
const quotaEmpty = computed(() => !props.isStaff && (quota.value?.remaining ?? 1) <= 0);

// 出典リンクは http(s) のみ許可(スキーム偽装対策)。
const safeOriginalUrl = computed(() => {
	const u = originalUrl.value;
	if (!u) return null;
	return /^https?:\/\//i.test(u) ? u : null;
});

// リモート絵文字検索
const remoteQuery = ref('');
const remoteHostFilter = ref('');
const remoteResults = ref<any[]>([]);
const remoteLoading = ref(false);
const remoteHasMore = ref(false);
const remotePageSize = 6;
const remotePage = ref(0);
const visibleRemoteResults = computed(() => remoteResults.value.slice(remotePage.value * remotePageSize, (remotePage.value + 1) * remotePageSize));
let remoteSearch = { query: null as string | null, host: null as string | null };
let remoteSearchId = 0;

type EmojiDraft = {
	step: number;
	mode: 'source' | 'remote';
	sourceType: 'image' | 'remote';
	fileId: string | null;
	originalUrl: string | null;
	remoteHost: string | null;
	previewUrl: string | null;
	name: string;
	license: string;
	category: string | null;
	tagsRaw: string;
	localOnly: boolean;
	isSensitive: boolean;
	remoteQuery: string;
	remoteHostFilter: string;
};
const { finishSubmission, beforeClose, prompt, hasDraft, resumeDraft } = useHataFeedDraft<EmojiDraft>({
	id: `hatafeed:emoji:${props.isStaff ? 'staff' : 'member'}`,
	busy: () => submitting.value,
	capture: () => ({ step: step.value, mode: mode.value, sourceType: sourceType.value, fileId: fileId.value, originalUrl: originalUrl.value, remoteHost: remoteHost.value, previewUrl: previewUrl.value, name: name.value, license: license.value, category: category.value, tagsRaw: tagsRaw.value, localOnly: localOnly.value, isSensitive: isSensitive.value, remoteQuery: remoteQuery.value, remoteHostFilter: remoteHostFilter.value }),
	restore: draft => {
		step.value = draft.step === 2 ? 2 : 1;
		mode.value = draft.mode === 'remote' ? 'remote' : 'source';
		sourceType.value = draft.sourceType === 'remote' ? 'remote' : 'image';
		fileId.value = typeof draft.fileId === 'string' ? draft.fileId : null;
		originalUrl.value = typeof draft.originalUrl === 'string' ? draft.originalUrl : null;
		remoteHost.value = typeof draft.remoteHost === 'string' ? draft.remoteHost : null;
		previewUrl.value = typeof draft.previewUrl === 'string' ? draft.previewUrl : null;
		name.value = typeof draft.name === 'string' ? draft.name : '';
		license.value = typeof draft.license === 'string' ? draft.license : '';
		category.value = typeof draft.category === 'string' ? draft.category : null;
		tagsRaw.value = typeof draft.tagsRaw === 'string' ? draft.tagsRaw : '';
		localOnly.value = draft.localOnly === true;
		isSensitive.value = draft.isSensitive === true;
		remoteQuery.value = typeof draft.remoteQuery === 'string' ? draft.remoteQuery : '';
		remoteHostFilter.value = typeof draft.remoteHostFilter === 'string' ? draft.remoteHostFilter : '';
	},
	isMeaningful: draft => draft.remoteQuery.trim().length > 0 || draft.remoteHostFilter.trim().length > 0 || draft.fileId != null || draft.originalUrl != null || draft.name.trim().length > 0 || draft.license.trim().length > 0 || draft.tagsRaw.trim().length > 0,
});

onMounted(async () => {
	categories.value = await misskeyApi('hata/feedback/emoji-categories', {}).catch(() => []);
	quota.value = await misskeyApi('hata/feedback/emoji-quota', {}).catch(() => null);
});

function deriveName(src: string) {
	const base = src.split('/').pop()?.split('?')[0] ?? '';
	return base.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
}

async function pickImage() {
	if (quotaEmpty.value) return;
	const chosen = await pickers.selectDriveFiles({ multiple: false }).catch(() => []);
	const f = chosen[0];
	if (!f) return;
	sourceType.value = 'image';
	fileId.value = f.id;
	originalUrl.value = null;
	remoteHost.value = null;
	previewUrl.value = f.url;
	if (!name.value) name.value = f.name ? deriveName(f.name) : '';
	step.value = 2;
}

function openRemote() {
	if (quotaEmpty.value || !quota.value?.canRemote) return;
	mode.value = 'remote';
	if (remoteResults.value.length === 0) searchRemote(true);
}

async function searchRemote(reset: boolean) {
	const requestId = ++remoteSearchId;
	remoteLoading.value = true;
	try {
		if (reset) {
			remoteResults.value = []; remotePage.value = 0; remoteHasMore.value = false;
			remoteSearch = { query: remoteQuery.value.trim() || null, host: remoteHostFilter.value.trim() || null };
		}
		const last = remoteResults.value[remoteResults.value.length - 1];
		const res = await misskeyApi('hata/feedback/remote-emojis', {
			...remoteSearch,
			limit: remotePageSize + 1,
			untilId: reset ? undefined : last?.id,
		});
		if (requestId !== remoteSearchId) return;
		remoteHasMore.value = res.length > remotePageSize;
		remoteResults.value = (reset ? [] : remoteResults.value).concat(res.slice(0, remotePageSize));
	} catch {
		// 権限なし等はそのまま空表示
	} finally {
		if (requestId === remoteSearchId) remoteLoading.value = false;
	}
}

async function nextRemotePage() {
	if (remoteLoading.value) return;
	if ((remotePage.value + 1) * remotePageSize >= remoteResults.value.length && remoteHasMore.value) await searchRemote(false);
	if ((remotePage.value + 1) * remotePageSize < remoteResults.value.length) remotePage.value++;
}

function pickRemote(e: any) {
	sourceType.value = 'remote';
	fileId.value = null;
	originalUrl.value = e.url;
	remoteHost.value = e.host ?? null;
	previewUrl.value = e.url;
	name.value = e.name ? deriveName(e.name) : '';
	if (e.category) category.value = e.category;
	if (Array.isArray(e.aliases) && e.aliases.length) tagsRaw.value = e.aliases.join(' ');
	step.value = 2;
}

function backToStep1() {
	step.value = 1;
	// リモート由来ならブラウザ(3c)に戻す。
	mode.value = sourceType.value === 'remote' ? 'remote' : 'source';
}

function resetForNextRequest() {
	step.value = 1;
	mode.value = sourceType.value === 'remote' ? 'remote' : 'source';
	fileId.value = null;
	originalUrl.value = null;
	remoteHost.value = null;
	previewUrl.value = null;
	name.value = '';
	license.value = '';
}

async function submit(closeAfter: boolean) {
	if (submitting.value || !name.value.trim()) return;
	if (quotaEmpty.value) {
		dialogs.alert({ type: 'warning', text: copy.quotaReached });
		return;
	}
	if (!license.value.trim()) {
		const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.emptyLicenseConfirm });
		if (canceled) return;
	}
	submitting.value = true;
	try {
		const req = await misskeyApi('hata/feedback/emoji-requests/create', {
			name: name.value.trim(),
			category: category.value || null,
			aliases: tagsRaw.value.trim() ? tagsRaw.value.trim().split(/\s+/) : [],
			license: license.value.trim() || null,
			localOnly: localOnly.value,
			isSensitive: isSensitive.value,
			sourceType: sourceType.value,
			originalUrl: sourceType.value === 'remote' ? originalUrl.value : null,
			remoteHost: remoteHost.value,
			fileId: fileId.value,
		});
		hataFeedNotify('絵文字を申請しました');
		emit('done', req);
		if (closeAfter) {
			finishSubmission();
			dialog.value?.close();
		} else {
			quota.value = await misskeyApi('hata/feedback/emoji-quota', {}).catch(() => quota.value);
			resetForNextRequest();
			finishSubmission({ resume: true });
			if (quotaEmpty.value) {
				await dialogs.alert({ type: 'info', text: copy.quotaReached });
				submitting.value = false;
				dialog.value?.close();
			}
		}
	} finally {
		submitting.value = false;
	}
}
</script>

<style lang="scss" module>
.content { padding: 18px; }
.sources { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.sources > :not(button) { grid-column: 1 / -1; }
.gaps { display: flex; flex-direction: column; gap: 18px; text-align: center; }
.lead { opacity: .8; font-size: .92em; }
.req { color: var(--MI_THEME-error); font-size: .72em; margin-left: 4px; }

/* ステップインジケータ */
.steps { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 18px; }
.step { display: inline-flex; align-items: center; gap: 6px; font-size: .82em; font-weight: 700; opacity: .5; }
.stepCur { opacity: 1; }
.stepNo { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); font-size: .85em; }
.stepCur .stepNo { background: var(--MI_THEME-accent); color: var(--hy-on-accent); border-color: var(--MI_THEME-accent); }
.stepBar { flex: 1; height: 2px; background: var(--MI_THEME-divider); border-radius: 999px; max-width: 60px; }

/* 3b: ソースカード */
.quotaBand { background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 12px; padding: 10px 14px; }
.srcCard { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 155px; gap: 14px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 14px; padding: 14px 16px; cursor: pointer; text-align: center; color: inherit; width: 100%; transition: border-color .12s, transform .12s; }
.srcCard:hover:not(:disabled) { border-color: var(--MI_THEME-accent); transform: translateY(-1px); }
.srcCard:disabled { opacity: .5; cursor: not-allowed; }
.srcTile { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: 1.4rem; flex-shrink: 0; }
.srcText { min-width: 0; flex: 1; }
.srcName { font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 6px; }
.srcDesc { font-size: .8em; opacity: .65; margin-top: 2px; }
.srcArrow { display: none; }
.roleBadge { font-size: .72em; font-weight: 700; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); border-radius: 999px; padding: 1px 8px; }

/* 3c: リモートブラウザ */
.remoteHead { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.backBtn { background: none; border: none; color: var(--MI_THEME-accent); cursor: pointer; font-size: .88em; padding: 2px 0; }
.searchRow { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.searchInput { flex: 1; min-width: 160px; }
.hostInput { flex: 1; min-width: 150px; }
.remoteHint { opacity: .55; font-size: .88em; padding: 24px 0; text-align: center; }
.remoteGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.remoteItem { display: flex; flex-direction: column; align-items: center; gap: 4px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 12px; padding: 10px 6px; cursor: pointer; color: inherit; transition: all .12s; }
.remoteItem:hover { border-color: var(--MI_THEME-accent); transform: translateY(-1px); }
.remoteItemSel { border-color: var(--MI_THEME-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--MI_THEME-accent) 30%, transparent); }
.remoteImg { width: 28px; height: 28px; object-fit: contain; }
.remoteName { font-size: .68em; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remoteHost { font-size: .6em; opacity: .55; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moreBtn { align-self: center; }

/* 2f/3d: 詳細 2ペイン */
.detailGrid { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 20px; align-items: start; }
.form { grid-column: 2; grid-row: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: 0; }
.form > * { min-width: 0; }
.fullField, .licenseField, .driveNotice, .navRow { grid-column: 1 / -1; }
.navRow { display: flex; justify-content: center; gap: 10px; margin-top: 2px; }
.remotePager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.submitActions { display: flex; justify-content: center; gap: 8px; }

.licenseField { border-radius: 10px; }
.licenseWarn { outline: 1px solid color-mix(in srgb, #ecb637 60%, transparent); outline-offset: 4px; border-radius: 8px; }
.warnText { color: #b6791f; }

/* 旗鯖fork: 承認後にドライブ原本が削除される旨の注意書き */
.driveNotice { display: flex; align-items: flex-start; gap: 7px; background: var(--MI_THEME-infoBg, var(--MI_THEME-panel)); border: 1px solid var(--MI_THEME-divider); border-radius: 10px; padding: 10px 12px; font-size: .78em; line-height: 1.6; opacity: .85; }
.driveNotice i { flex-shrink: 0; margin-top: .15em; color: var(--MI_THEME-accent); }

/* 右ペイン(ライブプレビュー) */
.preview { grid-column: 1; grid-row: 1; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.previewLabel { font-size: .72em; font-weight: 800; opacity: .6; letter-spacing: .04em; }
.sourceCard { background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.sourceBadge { display: inline-flex; align-items: center; gap: 5px; font-size: .74em; font-weight: 700; color: var(--MI_THEME-accent); }
.sourceLink { display: inline-flex; align-items: center; gap: 4px; font-size: .78em; word-break: break-all; }
.noteHint { }
.noteHintLabel { font-size: .72em; opacity: .6; margin-bottom: 5px; }
.noteFaux { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 10px; padding: 8px 10px; font-size: .82em; }
.noteEmoji { width: 22px; height: 22px; object-fit: contain; vertical-align: middle; }
.previewQuota { margin-top: 2px; }
.previewTip { font-size: .74em; opacity: .7; line-height: 1.5; display: flex; gap: 5px; }
.previewTip i { color: var(--MI_THEME-accent); }

/* 狭い時は詳細を縦積み(プレビューを上に) */
@container (max-width: 560px) {
	.detailGrid { grid-template-columns: 1fr; }
	.form, .preview { grid-column: auto; grid-row: auto; }
	.preview { order: -1; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 8px; }
	.previewLabel { display: none; }
	.previewTip, .previewQuota, .sourceCard { grid-column: 1 / -1; }
	.remoteGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.submitActions { flex-wrap: wrap; }
}
</style>
