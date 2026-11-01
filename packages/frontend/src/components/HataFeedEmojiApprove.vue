<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: HataFeed の絵文字申請確認ウィンドウ。
  1件だけの通常確認と、複数申請を順番に処理する連続確認の両方に対応する。
  一括で無条件承認はせず、各申請の画像・出典・ライセンス・公開範囲を確認してから
  「承認して次へ」「リジェクトして次へ」で進む。
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
	:inert="prompt"
	@closed="emit('closed')"
>
	<template #header><i class="ti ti-mood-check"></i> {{ initialTotal > 1 ? copy.headerMultiple : copy.headerSingle }}</template>

	<div :class="$style.reviewShell">
		<p v-if="error" role="alert">{{ error }}</p>
		<div v-if="hasDraft" class="hf-draft-offer"><span>端末に保存した下書きがあります</span><button type="button" @click="resumeDraft">続きから編集</button></div>
		<template v-if="currentReq">
			<div v-if="initialTotal > 1" :class="$style.queuePanel">
				<div :class="$style.queueHead">
					<div>
						<div :class="$style.queueTitle">{{ copy.pendingRequests }}</div>
						<div :class="$style.queueMeta">{{ copyx.queueMeta({ current: (currentIndex + 1).toString(), total: queue.length.toString(), resolved: processedCount.toString() }) }}</div>
					</div>
				</div>
				<div :class="$style.queueStrip" :aria-label="copy.pendingRequestList">
					<button
						v-for="(item, index) in queue"
						:key="item.id"
						type="button"
						:class="[$style.queueItem, index === currentIndex && $style.queueItemCurrent]"
						:title="copyx.reviewRequest({ name: `:${item.name}:` })"
						:disabled="busy" @click="selectRequest(index)"
					>
						<img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name">
						<i v-else class="ti ti-photo-off"></i>
					</button>
				</div>
			</div>

			<div v-if="queue.length > 1" :class="$style.mobileNav" :aria-label="copy.switchRequest">
				<button type="button" :aria-label="copy.previousRequest" @click="showPrevious"><i class="ti ti-chevron-left"></i></button>
				<span>{{ currentIndex + 1 }} / {{ queue.length }}</span>
				<button type="button" :aria-label="copy.nextRequest" @click="showNext"><i class="ti ti-chevron-right"></i></button>
			</div>

			<Transition :css="goesMotion || prefer.r.animation.value" :name="goesMotion ? 'hfGoesEmoji' : slideDirection === 'next' ? 'hfEmojiNext' : 'hfEmojiPrev'" :mode="goesMotion || prefer.r.animation.value ? 'out-in' : undefined">
				<div :key="currentReq.id" :class="$style.reviewGrid">
					<section :class="$style.previewColumn">
						<div :class="$style.sectionLabel">{{ copy.appearanceAndSource }}</div>
						<div :class="$style.previewWrap">
							<div :class="[$style.preview, $style.previewLight]"><img v-if="currentReq.imageUrl" :src="currentReq.imageUrl" :class="$style.previewImg" :alt="currentReq.name"></div>
							<div :class="[$style.preview, $style.previewDark]"><img v-if="currentReq.imageUrl" :src="currentReq.imageUrl" :class="$style.previewImg" :alt="currentReq.name"></div>
						</div>
						<div :class="$style.notePreview">
							<div :class="$style.notePreviewLabel">{{ copy.notePreview }}</div>
							<div>{{ copy.notePreviewPrefix }} <img v-if="currentReq.imageUrl" :src="currentReq.imageUrl" :class="$style.noteEmoji" :alt="currentReq.name"> {{ copy.notePreviewSuffix }}</div>
						</div>

						<div :class="$style.metaCard">
							<div :class="$style.metaRow">
								<MkAvatar v-if="currentReq.requestedBy" :class="$style.avatar" :user="currentReq.requestedBy"/>
								<div>
									<div :class="$style.metaName"><MkUserName v-if="currentReq.requestedBy" :user="currentReq.requestedBy"/> {{ copy.requestedBySuffix }}</div>
									<div :class="$style.metaSub"><MkTime :time="currentReq.createdAt"/></div>
								</div>
							</div>
							<div :class="$style.sourceRow">
								<span :class="$style.pill">{{ currentReq.sourceType === 'remote' ? copy.remoteImage : copy.ownImage }}</span>
								<a v-if="safeOriginalUrl" :class="$style.srcLink" :href="safeOriginalUrl" target="_blank" rel="noopener noreferrer">{{ currentReq.remoteHost ?? copy.openOriginal }} <i class="ti ti-external-link"></i></a>
							</div>
						</div>
					</section>

					<section :class="$style.formColumn">
						<div :class="$style.sectionLabel">{{ copy.registrationDetails }}</div>
						<MkInfo :class="$style.fullField">{{ copy.reviewHint }}</MkInfo>

						<MkInput v-model="name" :class="$style.fullField">
							<template #label>{{ copy.name }} <span :class="$style.req">{{ copy.required }}</span></template>
							<template #prefix>:</template>
							<template #suffix>:</template>
						</MkInput>
						<MkInput v-model="license" :class="$style.fullField">
							<template #label>{{ copy.license }}</template>
							<template #caption>{{ currentReq.sourceType === 'remote' ? copy.remoteLicenseHint : copy.ownLicenseHint }}</template>
						</MkInput>
						<HataFeedCategorySelect v-model="category" :categories="categories"/>
						<MkInput v-model="tagsRaw">
							<template #label>{{ copy.tags }}</template>
						</MkInput>
						<MkSwitch v-model="localOnly" compact>{{ copy.localOnly }}</MkSwitch>
						<MkSwitch v-model="isSensitive" compact>{{ copy.sensitive }}</MkSwitch>
					</section>
				</div>
			</Transition>

			<div :class="$style.actions">
				<MkButton rounded :disabled="busy" @click="holdAndNext"><i class="ti ti-player-pause"></i> {{ queue.length > 1 ? copy.holdAndNext : copy.hold }}</MkButton>
				<div :class="$style.resolveActions">
					<MkButton rounded danger :disabled="busy" @click="reject"><i class="ti ti-x"></i> {{ queue.length > 1 ? copy.rejectAndNext : copy.reject }}</MkButton>
					<MkButton rounded primary gradate :disabled="!name.trim() || busy" @click="approve"><i class="ti ti-check"></i> {{ queue.length > 1 ? copy.approveAndNext : copy.approve }}</MkButton>
				</div>
			</div>
		</template>

		<div v-else :class="$style.complete">
			<i class="ti ti-circle-check-filled"></i>
			<div :class="$style.completeTitle">{{ copy.completeTitle }}</div>
			<div :class="$style.completeText">{{ copyx.completeText({ held: heldCount.toString(), approved: approvedCount.toString(), rejected: rejectedCount.toString() }) }}</div>
			<MkButton rounded primary @click="closeWindow">{{ copy.close }}</MkButton>
		</div>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import MkWindow from '@/components/MkWindow.vue';
import { useHataFeedDraft } from '@/utility/hatafeed-draft.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import { $i } from '@/i.js';
import '@/components/hatafeed-ui.css';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInfo from '@/components/MkInfo.vue';
import HataFeedCategorySelect from '@/components/HataFeedCategorySelect.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
const dialogs = useHataGoesDialogs();
const goesMotion = !!inject(HATA_GOES_HOST, null);

const props = defineProps<{ req?: HataFeedEmojiRequest; requests?: HataFeedEmojiRequest[] }>();
const emit = defineEmits<{ (ev: 'done'): void; (ev: 'closed'): void }>();
const dialog = useTemplateRef('dialog');
const copy = i18n.ts._hata._hatafeed._emojiApprove;
const copyx = i18n.tsx._hata._hatafeed._emojiApprove;

const queue = ref<HataFeedEmojiRequest[]>([]);
const initialTotal = ref(0);
const currentIndex = ref(0);
const currentReq = computed<HataFeedEmojiRequest | null>(() => queue.value.at(currentIndex.value) ?? null);
const heldCount = ref(0);
const approvedCount = ref(0);
const rejectedCount = ref(0);
const processedCount = computed(() => Math.max(0, initialTotal.value - queue.value.length));
const slideDirection = ref<'next' | 'prev'>('next');

let initialized = false;
watch([() => props.requests, () => props.req], ([requests, req]) => {
	if (initialized) return;
	const seed = requests?.length ? requests : (req ? [req] : []);
	// ⚠️保留中も1件ずつ見ていく流れに含める（保留した申請が誰の目にも触れなくなるのを防ぐ）。
	queue.value = seed.filter(item => item.status === 'pending' || item.status === 'held');
	initialTotal.value = queue.value.length;
	initialized = true;
}, { immediate: true });

const name = ref('');
const license = ref('');
const category = ref<string | null>('');
const tagsRaw = ref('');
const localOnly = ref(false);
const isSensitive = ref(false);
const categories = ref<string[]>([]);
const busy = ref(false);
const error = ref('');

const safeOriginalUrl = computed(() => {
	const u = currentReq.value?.originalUrl;
	if (typeof u !== 'string' || !u) return null;
	try {
		const parsed = new URL(u);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? u : null;
	} catch {
		return null;
	}
});

type ReviewFields = { name: string; license: string; category: string | null; tagsRaw: string; localOnly: boolean; isSensitive: boolean };
const edits = new Map<string, ReviewFields>();
let restoring = false;
const originalFields = (req: HataFeedEmojiRequest): ReviewFields => ({ name: req.name, license: req.license ?? '', category: req.category ?? '', tagsRaw: req.aliases.join(' '), localOnly: req.localOnly, isSensitive: req.isSensitive });
const currentFields = (): ReviewFields => ({ name: name.value, license: license.value, category: category.value, tagsRaw: tagsRaw.value, localOnly: localOnly.value, isSensitive: isSensitive.value });

function loadFields(req: HataFeedEmojiRequest | null) {
	if (!req) return;
	const fields = edits.get(req.id) ?? originalFields(req);
	name.value = fields.name; license.value = fields.license; category.value = fields.category;
	tagsRaw.value = fields.tagsRaw; localOnly.value = fields.localOnly; isSensitive.value = fields.isSensitive;
}

watch(currentReq, (req, previous) => {
	if (!restoring && previous && queue.value.some(item => item.id === previous.id)) edits.set(previous.id, currentFields());
	loadFields(req);
}, { immediate: true, flush: 'sync' });
type ReviewDraft = { changes: Record<string, ReviewFields>; selectedId?: string };
const { beforeClose, finishSubmission, prompt, hasDraft, resumeDraft } = useHataFeedDraft<ReviewDraft>({
	id: 'hatafeed:emoji-review',
	busy: () => busy.value,
	capture: () => {
		const changes: Record<string, ReviewFields> = {};
		for (const req of queue.value) {
			const fields = req.id === currentReq.value?.id ? currentFields() : edits.get(req.id);
			if (fields && JSON.stringify(fields) !== JSON.stringify(originalFields(req))) changes[req.id] = fields;
		}
		return { changes, selectedId: currentReq.value?.id };
	},
	restore: draft => {
		restoring = true;
		for (const req of queue.value) {
			const fields = draft.changes?.[req.id];
			if (!fields || typeof fields.name !== 'string' || typeof fields.license !== 'string' || typeof fields.tagsRaw !== 'string') continue;
			edits.set(req.id, { name: fields.name, license: fields.license, tagsRaw: fields.tagsRaw, category: typeof fields.category === 'string' ? fields.category : null, localOnly: fields.localOnly === true, isSensitive: fields.isSensitive === true });
		}
		const index = queue.value.findIndex(req => req.id === draft.selectedId);
		if (index >= 0) currentIndex.value = index;
		loadFields(currentReq.value);
		restoring = false;
	},
	isMeaningful: draft => Object.keys(draft.changes).length > 0,
});

function selectRequest(index: number) { if (!busy.value) currentIndex.value = index; }

onMounted(async () => {
	categories.value = await misskeyApi('hata/feedback/emoji-categories', {}).catch(() => []);
});

function removeCurrent(): void {
	if (currentReq.value == null) return;
	edits.delete(currentReq.value.id);
	queue.value.splice(currentIndex.value, 1);
	if (currentIndex.value >= queue.value.length) currentIndex.value = Math.max(0, queue.value.length - 1);
	if (!queue.value.length) finishSubmission();
}

// 旗鯖fork: 保留。⚠️従来はここで次の申請へ送るだけで、管理者が直した入力値は保存していなかった。
//   保留は「あとで続きから見る」ための状態なので、入力値をサーバーへ保存してから離れる。
async function holdAndNext(): Promise<void> {
	const req = currentReq.value;
	if (busy.value || req == null) return;
	const { canceled, result } = await dialogs.inputText({ title: copy.holdReason, default: '' });
	if (canceled) return;
	busy.value = true;
	error.value = '';
	try {
		if (!await ensureStillPending(req.id)) return;
		await misskeyApi('hata/feedback/emoji-requests/hold', {
			requestId: req.id,
			comment: result.trim() === '' ? null : result,
			name: name.value.trim() === '' ? undefined : name.value.trim(),
			category: category.value === '' ? null : category.value,
			aliases: tagsRaw.value.trim() ? tagsRaw.value.trim().split(/\s+/) : [],
			license: license.value.trim() === '' ? null : license.value.trim(),
			localOnly: localOnly.value,
			isSensitive: isSensitive.value,
		});
		heldCount.value++;
		notifyReviewResult(req, '保留');
		slideDirection.value = 'next';
		removeCurrent();
		emit('done');
	} catch {
		error.value = '処理できませんでした。入力内容を残しています';
	} finally {
		busy.value = false;
	}
}

function showNext(): void {
	if (busy.value || queue.value.length <= 1) return;
	slideDirection.value = 'next';
	currentIndex.value = (currentIndex.value + 1) % queue.value.length;
}

function showPrevious(): void {
	if (busy.value || queue.value.length <= 1) return;
	slideDirection.value = 'prev';
	currentIndex.value = (currentIndex.value - 1 + queue.value.length) % queue.value.length;
}

async function ensureStillPending(requestId: string): Promise<boolean> {
	const latest = await misskeyApi('hata/feedback/emoji-requests', { id: requestId, limit: 1 });
	// ⚠️保留中(held)も引き続き処理できる。ここを pending だけにすると保留した申請が
	//   「もう処理済みです」と誤判定され、二度と承認・却下できなくなる。
	if (latest[0]?.status === 'pending' || latest[0]?.status === 'held') return true;
	hataFeedNotify(copy.alreadyProcessed);
	removeCurrent();
	emit('done');
	return false;
}

async function approve(): Promise<void> {
	const req = currentReq.value;
	if (busy.value || req == null || !name.value.trim()) return;
	busy.value = true;
	error.value = '';
	try {
		if (!await ensureStillPending(req.id)) return;
		await misskeyApi('hata/feedback/emoji-requests/approve', {
			requestId: req.id,
			name: name.value.trim(),
			category: category.value === '' ? null : category.value,
			aliases: tagsRaw.value.trim() ? tagsRaw.value.trim().split(/\s+/) : [],
			license: license.value.trim() === '' ? null : license.value.trim(),
			localOnly: localOnly.value,
			isSensitive: isSensitive.value,
		});
		approvedCount.value++;
		removeCurrent();
		emit('done');
		notifyReviewResult(req, '承認');
	} catch {
		error.value = '処理できませんでした。入力内容を残しています';
	} finally {
		busy.value = false;
	}
}

async function reject(): Promise<void> {
	const req = currentReq.value;
	if (busy.value || req == null) return;
	const { canceled, result } = await dialogs.inputText({ title: copy.rejectReason, default: '' });
	if (canceled) return;
	busy.value = true;
	error.value = '';
	try {
		if (!await ensureStillPending(req.id)) return;
		await misskeyApi('hata/feedback/emoji-requests/reject', { requestId: req.id, comment: result.trim() === '' ? null : result });
		rejectedCount.value++;
		notifyReviewResult(req, '却下');
		removeCurrent();
		emit('done');
	} catch {
		error.value = '処理できませんでした。入力内容を残しています';
	} finally {
		busy.value = false;
	}
}

function closeWindow(): void {
	dialog.value?.close();
}

function notifyReviewResult(req: HataFeedEmojiRequest, result: string) {
	if (req.requestedBy?.id !== $i?.id) hataFeedNotify(`:${req.name}: の追加申請を${result}しました`);
}
</script>

<style lang="scss" module>
.reviewShell { container-type: inline-size; text-align: center; padding: 20px; min-width: 0; }
.queuePanel { margin-bottom: 18px; padding: 0; }
.queueHead { display: grid; grid-template-columns: minmax(0, 1fr); text-align: center; align-items: center; gap: 14px; margin-bottom: 10px; }
.queueTitle { font-weight: 800; }
.queueMeta { margin-top: 2px; font-size: .76em; opacity: .65; }
.queueStrip { display: flex; justify-content: safe center; gap: 8px; overflow-x: auto; padding: 2px; }
.queueItem { width: 46px; height: 46px; flex: 0 0 46px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; background: var(--MI_THEME-panel); color: inherit; cursor: pointer; }
.queueItem img { max-width: 34px; max-height: 34px; object-fit: contain; }
.queueItemCurrent { border-color: var(--MI_THEME-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--MI_THEME-accent) 24%, transparent); }
.mobileNav button { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--MI_THEME-divider); border-radius: 50%; background: var(--MI_THEME-panel); color: inherit; cursor: pointer; }
.mobileNav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px; }

.reviewGrid { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 20px; align-items: start; }
.previewColumn, .formColumn { min-width: 0; }
.formColumn { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.formColumn > * { min-width: 0; }
.fullField, .sectionLabel { grid-column: 1 / -1; }
.sectionLabel { margin-bottom: 6px; font-size: .78em; font-weight: 800; opacity: .65; letter-spacing: .04em; }
.req { color: var(--MI_THEME-error); font-size: .72em; margin-left: 4px; }

.previewWrap { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.preview { min-height: 132px; border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--MI_THEME-divider); }
.previewLight { background: #fff; }
.previewDark { background: #1b1b1f; }
.previewImg { width: 64px; height: 64px; object-fit: contain; }
.notePreview { margin-top: 10px; padding: 14px; border: 1px solid var(--MI_THEME-divider); border-radius: 12px; background: var(--MI_THEME-panel); }
.notePreviewLabel { margin-bottom: 8px; font-size: .72em; font-weight: 700; opacity: .55; }
.noteEmoji { width: 28px; height: 28px; object-fit: contain; vertical-align: middle; }

.metaCard { margin-top: 10px; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.metaRow { display: flex; align-items: center; gap: 10px; }
.avatar { width: 36px; height: 36px; }
.metaName { font-weight: 600; font-size: .92em; }
.metaSub { font-size: .76em; opacity: .6; }
.sourceRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pill { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); border-radius: 999px; padding: 3px 12px; font-size: .78em; }
.srcLink { font-size: .8em; color: var(--MI_THEME-accent); text-decoration: none; overflow-wrap: anywhere; }

.actions { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--MI_THEME-divider); }
.resolveActions { display: flex; justify-content: center; gap: 10px; }
.complete { padding: 24px 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.complete > i { color: var(--MI_THEME-accent); font-size: 3rem; }
.completeTitle { font-size: 1.15em; font-weight: 800; }
.completeText { opacity: .65; }

@container (max-width: 500px) {
	.reviewGrid { grid-template-columns: 1fr; }
	.queueHead { grid-template-columns: 1fr; }
	.queueStrip { display: none; }
	.mobileNav { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 10px; margin-bottom: 12px; }
	.mobileNav button { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); font-size: 1.25rem; cursor: pointer; }
	.mobileNav span { text-align: center; font-size: .86em; font-weight: 800; }
	.actions, .resolveActions { align-items: stretch; flex-direction: column; width: 100%; }
	.resolveActions { margin-left: 0; }
}
</style>

<style lang="scss" scoped>
.hfGoesEmoji-enter-active { transition: opacity 160ms ease, transform 160ms ease; }
.hfGoesEmoji-leave-active { transition: opacity 120ms ease; }
.hfGoesEmoji-enter-from { opacity: .35; transform: translateY(4px); }
.hfGoesEmoji-leave-to { opacity: 0; }
.hfEmojiNext-enter-active, .hfEmojiNext-leave-active,
.hfEmojiPrev-enter-active, .hfEmojiPrev-leave-active {
	transition: opacity .18s ease, transform .18s ease;
}
.hfEmojiNext-enter-from { opacity: 0; transform: translateX(28px); }
.hfEmojiNext-leave-to { opacity: 0; transform: translateX(-28px); }
.hfEmojiPrev-enter-from { opacity: 0; transform: translateX(-28px); }
.hfEmojiPrev-leave-to { opacity: 0; transform: translateX(28px); }
@media (prefers-reduced-motion: reduce) {
	.hfEmojiNext-enter-active, .hfEmojiNext-leave-active,
	.hfEmojiPrev-enter-active, .hfEmojiPrev-leave-active { transition: none; }
}
</style>
