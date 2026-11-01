<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady 1c/1m): 本の詳細(モーダル)。
  表紙・書誌 + 読書の記録(進捗ページ・状態) + 編集/削除 + 紐づく学習ログ。
-->
<template>
<HyDialog
	ref="dialog"
	:variant="variant"
	scrollHint
	:title="t('title')"
	:inert="closePrompt"
	:busy="saving"
	@close="requestClose"
	@closed="onClosed"
>
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<div v-if="loading" :class="$style.loading">{{ t('loading') }}</div>
		<template v-else-if="book">
			<!-- ヘッダー: 表紙 + 書誌 -->
			<div :class="$style.head">
				<HyBookCover
					:title="book.title"
					:author="book.author"
					:colorIndex="book.coverColorIndex"
					:width="96"
					showTitle
				/>
				<div :class="$style.meta">
					<div :class="$style.titleRow">
						<h2 :class="$style.bookTitle">{{ book.title }}</h2>
						<div v-if="isMine" :class="$style.titleActions">
							<button type="button" class="hy-icon-button" :disabled="saving" :aria-label="t('edit')" :title="t('edit')" @click="openEdit">
								<i class="ti ti-pencil" aria-hidden="true"></i>
							</button>
							<button type="button" class="hy-icon-button" :disabled="saving" :aria-label="bookExtra.deleteBook" :title="bookExtra.deleteBook" @click="removeBook">
								<i class="ti ti-trash" aria-hidden="true"></i>
							</button>
						</div>
					</div>
					<div :class="$style.bookAuthor">
						<span
							:title="
								book.visibility === 'private'
									? homeCopy.activityPrivate
									: book.visibility === 'followers'
										? bookExtra.followersOnly
										: homeCopy.activityPublic
							"
							:aria-label="
								book.visibility === 'private'
									? homeCopy.activityPrivate
									: book.visibility === 'followers'
										? bookExtra.followersOnly
										: homeCopy.activityPublic
							"
							role="img"
						>
							<i
								:class="
									book.visibility === 'private'
										? 'ti ti-lock'
										: book.visibility === 'followers'
											? 'ti ti-user-check'
											: 'ti ti-world'
								"
							></i>
						</span>
						<span v-if="book.details?.genre">· {{ book.details.genre }}</span>
					</div>
					<div v-if="book.author" :class="$style.bookAuthor">{{ book.author }}</div>
					<div :class="$style.statusRow">
						<span :class="$style.statusChip" :style="statusStyle(book.status)">{{ t('status_' + book.status) }}</span>
						<span v-if="book.totalPages" :class="$style.pages">{{ book.currentPage }} / {{ book.totalPages }} p</span>
					</div>
					<div v-if="book.progress != null" :class="$style.progressWrap">
						<span :class="$style.progressBar">
							<span :class="$style.progressFill" :style="{ width: book.progress + '%' }"></span>
						</span>
						<span :class="$style.progressText">{{ book.progress }}%</span>
					</div>
				</div>
			</div>

			<p v-if="book.details?.description" :class="$style.description">{{ book.details.description }}</p>
			<section v-if="book.details?.memo" :class="$style.description">
				<h3>
					<i class="ti ti-lock"></i>
					{{ bookExtra.privateMemo }}
				</h3>
				<p>{{ book.details.memo }}</p>
			</section>
			<!-- 読書の記録(1m): 進捗ページ・状態(本人のみ) -->
			<div v-if="isMine" :class="$style.record">
				<div :class="$style.recordTitle">
					<i class="ti ti-bookmark"></i>
					{{ t('readingRecord') }}
				</div>
				<div v-if="book.totalPages" :class="$style.sliderRow">
					<input v-model.number="pageInput" type="range" min="0" :max="book.totalPages" :class="$style.slider"/>
					<span :class="$style.sliderPct">{{ pagePct }}%</span>
				</div>
				<div :class="$style.recordRow">
					<label :class="$style.recordLabel">{{ t('currentPage') }}</label>
					<input v-model.number="pageInput" type="number" min="0" :class="$style.pageInput"/>
					<span v-if="book.totalPages" :class="$style.recordTotal">/ {{ book.totalPages }}</span>
					<button :class="$style.recordSave" :disabled="saving" @click="saveProgress">{{ t('save') }}</button>
				</div>
				<div :class="$style.statusBtns">
					<button
						v-for="s in statuses"
						:key="s"
						:class="[$style.statusBtn, book.status === s && $style.statusBtnOn]"
						:disabled="saving"
						@click="setStatus(s)"
					>
						{{ t('status_' + s) }}
					</button>
				</div>
			</div>

			<!-- しおり -->
			<div :class="$style.bmSection">
				<div :class="$style.bmHead">
					<i class="ti ti-bookmark"></i>
					{{ t('bookmarks') }}
					<span v-if="bookmarks.length">{{ bookmarks.length }}</span>
				</div>
				<div v-if="bookmarks.length" :class="$style.bmList">
					<div
						v-for="bm in bookmarks"
						:key="bm.id"
						:class="$style.bmItem"
						:style="{ borderLeftColor: bmColor(bm.color) }"
					>
						<div :class="$style.bmMain">
							<span :class="$style.bmTag" :style="{ background: bmColor(bm.color) }">
								<i class="ti ti-bookmark-filled"></i>
							</span>
							<div :class="$style.bmInfo">
								<div :class="$style.bmName">{{ bm.name || t('noName') }}</div>
								<div :class="$style.bmPage">p.{{ bm.page }}</div>
								<div v-if="bm.memo && editingBmMemoId !== bm.id" :class="$style.bmMemoText">{{ bm.memo }}</div>
							</div>
							<button
								v-if="isMine"
								:class="[$style.bmIconBtn, bm.memo && $style.bmIconBtnOn]"
								:title="t('bmMemo')"
								@click="startEditBmMemo(bm)"
							>
								<i class="ti ti-note"></i>
							</button>
							<button v-if="isMine" :class="$style.bmDel" @click="deleteBookmark(bm)"><i class="ti ti-x"></i></button>
						</div>
						<div v-if="isMine && editingBmMemoId === bm.id" :class="$style.bmMemoEdit">
							<textarea
								v-model="bmMemoDraft"
								:placeholder="t('bmMemoPh')"
								:class="$style.bmMemoArea"
								rows="3"
							></textarea>
							<div :class="$style.bmMemoActions">
								<button :class="$style.memoTextBtn" @click="cancelBmMemo">{{ t('cancel') }}</button>
								<button :class="$style.memoSaveBtn" :disabled="saving" @click="saveBmMemo(bm)">
									{{ t('save') }}
								</button>
							</div>
						</div>
					</div>
				</div>
				<div v-else-if="!isMine" :class="$style.bmEmpty">{{ t('noBookmarks') }}</div>
				<!-- 追加フォーム(本人のみ) -->
				<div v-if="isMine" :class="$style.bmAdd">
					<input
						v-model.number="newBmPage"
						type="number"
						min="0"
						:max="book.totalPages ?? undefined"
						:placeholder="t('page')"
						:class="$style.bmPageInput"
					/>
					<input v-model="newBmName" :placeholder="t('bmNamePh')" :class="$style.bmNameInput"/>
					<div :class="$style.bmColors">
						<button
							v-for="c in HY_BOOKMARK_COLORS"
							:key="c.key"
							:class="[$style.bmColor, newBmColor === c.key && $style.bmColorOn]"
							:style="{ background: c.color }"
							@click="newBmColor = c.key"
						></button>
					</div>
					<button :class="$style.bmAddBtn" :disabled="saving" @click="addBookmark"><i class="ti ti-plus"></i></button>
				</div>
			</div>

			<!-- 内容メモ -->
			<div :class="$style.memoSection">
				<div :class="$style.memoHead">
					<span :class="$style.memoHeadLabel">
						<i class="ti ti-notes"></i>
						{{ t('memos') }}
						<span v-if="memos.length">{{ memos.length }}</span>
					</span>
					<button v-if="memos.length > 1" :class="$style.memoSortBtn" @click="memoSortDesc = !memoSortDesc">
						<i :class="memoSortDesc ? 'ti ti-sort-descending' : 'ti ti-sort-ascending'"></i>
						{{ memoSortDesc ? t('sortNewest') : t('sortOldest') }}
					</button>
				</div>
				<div v-if="sortedMemos.length" :class="$style.memoList">
					<div v-for="m in sortedMemos" :key="m.id" :class="$style.memoItem">
						<template v-if="editingMemoId === m.id">
							<textarea v-model="editMemoText" :class="$style.memoArea" rows="3"></textarea>
							<div :class="$style.memoEditRow">
								<input
									v-model.number="editMemoPage"
									type="number"
									min="0"
									:placeholder="t('pageOpt')"
									:class="$style.memoPageInput"
								/>
								<span :class="$style.memoSpacer"></span>
								<button :class="$style.memoTextBtn" @click="cancelEditMemo">{{ t('cancel') }}</button>
								<button :class="$style.memoSaveBtn" :disabled="saving || !editMemoText.trim()" @click="saveMemo(m)">
									{{ t('save') }}
								</button>
							</div>
						</template>
						<template v-else>
							<div :class="$style.memoText">{{ m.text }}</div>
							<div :class="$style.memoMeta">
								<span v-if="m.page != null" :class="$style.memoPageTag">p.{{ m.page }}</span>
								<span :class="$style.memoDate">
									{{ fmtWhen(m.createdAt) }}
									<template v-if="m.updatedAt !== m.createdAt">· {{ t('edited') }}</template>
								</span>
								<span :class="$style.memoSpacer"></span>
								<button v-if="isMine" :class="$style.memoIconBtn" :title="t('edit')" @click="startEditMemo(m)">
									<i class="ti ti-pencil"></i>
								</button>
								<button
									v-if="isMine"
									:class="[$style.memoIconBtn, $style.memoDanger]"
									:title="t('delete')"
									@click="removeMemo(m)"
								>
									<i class="ti ti-trash"></i>
								</button>
							</div>
						</template>
					</div>
				</div>
				<div v-else-if="!isMine" :class="$style.memoEmpty">{{ t('noMemos') }}</div>
				<!-- 追加フォーム(本人のみ) -->
				<div v-if="isMine" :class="$style.memoAdd">
					<textarea v-model="newMemoText" :placeholder="t('memoPh')" :class="$style.memoArea" rows="3"></textarea>
					<div :class="$style.memoAddRow">
						<input
							v-model.number="newMemoPage"
							type="number"
							min="0"
							:max="book.totalPages ?? undefined"
							:placeholder="t('pageOpt')"
							:class="$style.memoPageInput"
						/>
						<span :class="$style.memoSpacer"></span>
						<button :class="$style.memoAddBtn" :disabled="saving || !newMemoText.trim()" @click="addMemo">
							<i class="ti ti-plus"></i>
							{{ t('addMemo') }}
						</button>
					</div>
				</div>
			</div>

			<!-- モデレーター/管理者による削除(他人の本) -->
			<div v-if="!isMine && isModerator" :class="$style.actions">
				<button :class="[$style.actionBtn, $style.danger]" @click="modDeleteBook">
					<i class="ti ti-shield-x"></i>
					{{ t('modDelete') }}
				</button>
			</div>

			<!-- 操作(本人のみ) -->
			<div v-if="isMine" :class="$style.actions">
				<button :class="[$style.actionBtn, book.isFavorite && $style.favOn]" @click="toggleFlag('isFavorite')">
					<i :class="book.isFavorite ? 'ti ti-star-filled' : 'ti ti-star'"></i>
					{{ t('favorite') }}
				</button>
				<button :class="[$style.actionBtn, book.isRecommended && $style.recOn]" @click="toggleFlag('isRecommended')">
					<i :class="book.isRecommended ? 'ti ti-thumb-up-filled' : 'ti ti-thumb-up'"></i>
					{{ t('recommend') }}
				</button>
			</div>

			<!-- 紐づく学習ログ -->
			<div :class="$style.logsHead">
				<i class="ti ti-notebook"></i>
				{{ t('relatedLogs') }}
				<span v-if="logs.length">{{ logs.length }}</span>
			</div>
			<div v-if="logs.length === 0" :class="$style.logsEmpty">{{ t('noLogs') }}</div>
			<div v-else :class="$style.logs">
				<HatadyActivityCard
					v-for="log in logs"
					:key="log.id"
					:activity="logActivity(log)"
					:variant="variant"
					@openLog="openLog"
					@openBook="() => {}"
					@openProfile="openProfile"
					@edit="editRelated"
					@deleted="recordDeleted(log.id)"
					@menu="(activity, event) => variant === 'hatady' ? emit('openLog', activity.id) : timelineActions.openActivityMenu(activity, event)"
				/>
			</div>
		</template>
		<div v-else :class="$style.loading">{{ t('notFound') }}</div>

		<!-- 旗鯖fork: 下にさらに内容(しおり・内容メモ・操作メニュー等)があることを示すボトムフェード。
		     Hataskey UI のサイドメニューと同じ発想で、最下部までスクロールすると消える。
		     モバイルで「下にメニューがある」と気付きにくい問題への対処。 -->
	</div>
</HyDialog>
<HatadyDraftPrompt
	v-if="closePrompt"
	:variant="variant"
	:title="bookExtra.draftQuestion"
	:description="bookExtra.draftDescription"
	:error="draftError"
	@save="leave(true)"
	@discard="leave(false)"
	@return="cancelClose"
/>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import HyBookCover from '@/components/HyBookCover.vue';
import { $i } from '@/i.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { confirmHatadyAction } from '@/utility/hatady-record-delete.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { openRecordModeration } from '@/utility/record-moderation.js';
import { isOwnHatadyProfile, openOwnHatadyProfileIfNeeded, useHatadyActivityActions } from '@/utility/hatady-activity-actions.js';
import { versatileLang } from '@/utility/intl-const.js';
import { HY_BOOKMARK_COLORS, hyBookmarkColor } from '@/utility/hatady.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';

const popup = useHataGoesPopup();

const props = withDefaults(defineProps<{ bookId: string; variant?: 'hatady' | 'ui' | 'uis' }>(), { variant: 'hatady' });
const timelineActions = useHatadyActivityActions({
	variant: props.variant,
	onChanged: () => { void reload(); emit('changed'); },
	onDeleted: activity => removeLocalRecord(activity.id),
});
const emit = defineEmits<{ (ev: 'changed'): void; (ev: 'deleted'): void; (ev: 'openLog', logId: string): void; (ev: 'closed'): void }>();
const dialog = ref<any>(null);
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._bookDetail;
const bookExtra = i18n.ts._hata._hatady._bookDetailExtra;
const homeCopy = i18n.ts._hata._hatady._home;
const dateFormat = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'short', day: 'numeric' });

const book = ref<any>(null);
const logs = ref<any[]>([]);
const bookmarks = ref<any[]>([]);
const memos = ref<any[]>([]);
const isMine = ref(false);
const isModerator = computed(() => !!(($i as any)?.isModerator || ($i as any)?.isAdmin));
const loading = ref(true);
const saving = ref(false);
const pageInput = ref<number | null>(null);
// しおり追加フォーム
const newBmPage = ref<number | null>(null);
const newBmName = ref('');
const newBmColor = ref('orange');

function bmColor(key: string | null): string {
	return hyBookmarkColor(key);
}

// しおりメモ編集(1つずつ展開)
const editingBmMemoId = ref<string | null>(null);
const bmMemoDraft = ref('');

function startEditBmMemo(bm: any) {
	editingBmMemoId.value = bm.id;
	bmMemoDraft.value = bm.memo ?? '';
}

function cancelBmMemo() {
	editingBmMemoId.value = null;
	bmMemoDraft.value = '';
}

async function saveBmMemo(bm: any) {
	saving.value = true;
	try {
		const memo = bmMemoDraft.value.trim();
		const updated = await misskeyApi('hata/hatady/bookmarks/update', { bookmarkId: bm.id, memo: memo || null });
		bookmarks.value = bookmarks.value.map((x) => (x.id === bm.id ? updated : x));
		editingBmMemoId.value = null;
		bmMemoDraft.value = '';
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

// ===== 内容メモ =====
const memoSortDesc = ref(true); // 既定は新しい順。
const sortedMemos = computed(() => {
	const arr = [...memos.value];
	arr.sort((a, b) => {
		const c = String(a.createdAt).localeCompare(String(b.createdAt));
		return memoSortDesc.value ? -c : c;
	});
	return arr;
});
// 追加フォーム
const newMemoText = ref('');
const newMemoPage = ref<number | null>(null);
// 編集(1件ずつ)
const editingMemoId = ref<string | null>(null);
const editMemoText = ref('');
const editMemoPage = ref<number | null>(null);

const closePrompt = ref(false),
	draftError = ref('');

function meaningful() {
	return (
		!!book.value &&
		(pageInput.value !== (book.value.currentPage ?? 0) ||
			!!newBmName.value.trim() ||
			newBmPage.value != null ||
			!!newMemoText.value.trim() ||
			(editingBmMemoId.value != null &&
				bmMemoDraft.value !== (bookmarks.value.find((b) => b.id === editingBmMemoId.value)?.memo || '')) ||
			(editingMemoId.value != null &&
				(editMemoText.value !== memos.value.find((m) => m.id === editingMemoId.value)?.text ||
					editMemoPage.value !== (memos.value.find((m) => m.id === editingMemoId.value)?.page ?? null))))
	);
}

const inlineDraft = useHataFormDraft({
	id: `hatady-book-detail:${props.bookId}`,
	autoSave: false,
	capture: () => ({
		page: pageInput.value,
		newBmPage: newBmPage.value,
		newBmName: newBmName.value,
		newBmColor: newBmColor.value,
		bmId: editingBmMemoId.value,
		bmMemo: bmMemoDraft.value,
		newMemoText: newMemoText.value,
		newMemoPage: newMemoPage.value,
		memoId: editingMemoId.value,
		memoText: editMemoText.value,
		memoPage: editMemoPage.value,
	}),
	restore: (d) => {
		pageInput.value = d.page;
		newBmPage.value = d.newBmPage;
		newBmName.value = d.newBmName;
		newBmColor.value = d.newBmColor;
		editingBmMemoId.value = d.bmId;
		bmMemoDraft.value = d.bmMemo;
		newMemoText.value = d.newMemoText;
		newMemoPage.value = d.newMemoPage;
		editingMemoId.value = d.memoId;
		editMemoText.value = d.memoText;
		editMemoPage.value = d.memoPage;
	},
	isMeaningful: meaningful,
});

function requestClose() {
	if (saving.value) return;
	if (inlineDraft.hasChanges()) closePrompt.value = true;
	else dialog.value?.close();
}

let navigateToOwnProfile = false;

function cancelClose() {
	navigateToOwnProfile = false;
	closePrompt.value = false;
}

function onClosed() {
	emit('closed');
	if (navigateToOwnProfile) openOwnHatadyProfileIfNeeded(undefined, props.variant);
}

function leave(save: boolean) {
	if (!(save ? inlineDraft.saveDraft() : inlineDraft.clearDraft())) {
		draftError.value = bookExtra.draftUpdateFailed;
		return;
	}
	closePrompt.value = false;
	if (save) hatadyNotify(bookExtra.draftSaved);
	dialog.value?.close();
}

async function addMemo() {
	if (!book.value || !newMemoText.value.trim()) return;
	saving.value = true;
	try {
		const payload = {
			bookId: book.value.id,
			text: newMemoText.value.trim(),
			page:
				newMemoPage.value != null && Number.isFinite(Number(newMemoPage.value)) ? Number(newMemoPage.value) : undefined,
		};
		const m = await misskeyApi('hata/hatady/memos/create', payload);
		memos.value = [...memos.value, m];
		newMemoText.value = '';
		newMemoPage.value = null;
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

function startEditMemo(m: any) {
	editingMemoId.value = m.id;
	editMemoText.value = m.text;
	editMemoPage.value = m.page ?? null;
}

function cancelEditMemo() {
	editingMemoId.value = null;
	editMemoText.value = '';
	editMemoPage.value = null;
}

async function saveMemo(m: any) {
	if (!editMemoText.value.trim()) return;
	saving.value = true;
	try {
		const page =
			editMemoPage.value != null && Number.isFinite(Number(editMemoPage.value)) ? Number(editMemoPage.value) : null;
		const updated = await misskeyApi('hata/hatady/memos/update', {
			memoId: m.id,
			text: editMemoText.value.trim(),
			page,
		});
		memos.value = memos.value.map((x) => (x.id === m.id ? updated : x));
		cancelEditMemo();
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

async function removeMemo(m: any) {
	if (!(await confirmHatadyAction(props.variant, t('memoDeleteConfirm'), 'warning', popup))) return;
	await misskeyApi('hata/hatady/memos/delete', { memoId: m.id });
	memos.value = memos.value.filter((x) => x.id !== m.id);
	emit('changed');
}

const statuses = ['reading', 'finished', 'tsundoku', 'want'] as const;
const pagePct = computed(() => {
	const total = book.value?.totalPages;
	if (!total) return 0;
	return Math.min(100, Math.round(((Number(pageInput.value) || 0) / total) * 100));
});

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
	reading: { background: 'rgba(217,130,74,.16)', color: '#b45f27' },
	finished: { background: 'rgba(107,142,90,.18)', color: '#4d6b3c' },
	tsundoku: { background: 'rgba(150,110,180,.18)', color: '#7a5a9a' },
	want: { background: 'rgba(120,120,120,.16)', color: '#6b6b6b' },
};

function statusStyle(s: string) {
	return STATUS_COLORS[s] ?? STATUS_COLORS.reading;
}

function t(key: string): string {
	return (copy as unknown as Record<string, string>)[key] ?? key;
}

function fmtWhen(iso: string): string {
	return dateFormat.format(new Date(iso));
}

async function reload() {
	loading.value = true;
	try {
		const res = (await misskeyApi('hata/hatady/books/show', { bookId: props.bookId }).catch(() => null)) as any;
		if (res) {
			book.value = res.book;
			logs.value = res.logs ?? [];
			bookmarks.value = res.bookmarks ?? [];
			memos.value = res.memos ?? [];
			isMine.value = res.isMine;
			if (!inlineDraft.restored.value) {
				pageInput.value = res.book.currentPage ?? 0;
				inlineDraft.resetBaseline();
			}
		}
	} finally {
		loading.value = false;
	}
}

async function saveProgress() {
	if (!book.value) return;
	saving.value = true;
	try {
		const b = await misskeyApi('hata/hatady/books/update', {
			bookId: book.value.id,
			currentPage: Number(pageInput.value) || 0,
		});
		book.value = b;
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

async function addBookmark() {
	if (!book.value) return;
	saving.value = true;
	try {
		const payload = {
			bookId: book.value.id,
			page: Number(newBmPage.value) || 0,
			color: newBmColor.value,
			name: newBmName.value.trim() || undefined,
		};
		const bm = await misskeyApi('hata/hatady/bookmarks/create', payload);
		// ページ順に挿入。
		bookmarks.value = [...bookmarks.value, bm].sort((a, b) => a.page - b.page);
		newBmPage.value = null;
		newBmName.value = '';
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

async function deleteBookmark(bm: any) {
	await misskeyApi('hata/hatady/bookmarks/delete', { bookmarkId: bm.id });
	bookmarks.value = bookmarks.value.filter((x) => x.id !== bm.id);
	emit('changed');
}

async function toggleFlag(key: 'isFavorite' | 'isRecommended') {
	if (!book.value) return;
	saving.value = true;
	try {
		const b = await misskeyApi('hata/hatady/books/update', { bookId: book.value.id, [key]: !book.value[key] });
		book.value = b;
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

async function setStatus(s: (typeof statuses)[number]) {
	if (!book.value) return;
	saving.value = true;
	try {
		const b = await misskeyApi('hata/hatady/books/update', { bookId: book.value.id, status: s });
		book.value = b;
		emit('changed');
	} catch {
		hatadyNotify(bookExtra.saveFailed);
	} finally {
		saving.value = false;
	}
}

// 編集は本の新規作成と同じ 1i デザインのフォーム(編集モード)を開く。
async function openEdit() {
	if (!book.value) return;
	const { dispose } = popup(
		(await import('@/components/HatadyBookForm.vue')).default,
		{
			editBook: { ...book.value, bookmarks: bookmarks.value, memos: memos.value }, variant: props.variant,
		},
		{
			done: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function removeBook() {
	if (!book.value || !isMine.value || saving.value) return;
	saving.value = true;
	try {
		if (!(await confirmHatadyAction(props.variant, bookExtra.deleteConfirm, 'warning', popup))) return;
		await misskeyApi('hata/hatady/books/delete', { bookId: book.value.id });
		hatadyNotify(bookExtra.deleted);
		emit('deleted');
		emit('changed');
		dialog.value?.close();
	} catch {
		hatadyNotify(bookExtra.deleteFailed);
	} finally {
		saving.value = false;
	}
}

function removeLocalRecord(logId: string) {
	logs.value = logs.value.filter(log => log.id !== logId);
}

async function recordDeleted(logId: string) {
	removeLocalRecord(logId);
	await reload();
	emit('changed');
}

// モデレーター/管理者による他ユーザーの本の削除。
async function modDeleteBook() {
	if (!book.value) return;
	await openRecordModeration({ product: 'hatady', targetType: 'book', targetId: book.value.id }, 'delete', () => {
		emit('changed');
		dialog.value?.close();
	});
}

function logActivity(log: any) {
	return {
		id: log.id,
		type: log.kind || 'study',
		occurredAt: log.studiedAt,
		user: log.user,
		visibility: log.visibility || (log.isPublic ? 'public' : 'private'),
		isMine: isMine.value,
		study: log,
	} as any;
}

async function editRelated(activity: any) {
	const { dispose } = popup(
		(await import('@/components/HatadyComposer.vue')).default,
		{ editLog: activity.study, variant: props.variant },
		{
			done: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openLog(logId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ logId, variant: props.variant },
		{
			deleted: () => removeLocalRecord(logId),
			changed: () => {
				void reload();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

async function openProfile(userId: string) {
	if (isOwnHatadyProfile(userId, props.variant)) {
		if (saving.value) return;
		navigateToOwnProfile = true;
		requestClose();
		return;
	}
	const { dispose } = popup(
		(await import('@/components/HatadyProfile.vue')).default,
		{ userId, variant: props.variant },
		{ closed: () => dispose() },
	);
}

onMounted(reload);
</script>

<style lang="scss" module>
.body {
	padding: 20px 22px;
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	min-height: 100%;
	box-sizing: border-box;
}
.loading {
	opacity: 0.6;
	padding: 40px 0;
	text-align: center;
}

.head {
	display: flex;
	gap: 18px;
	margin-bottom: 18px;
}
.head > :first-child {
	box-shadow: 2px 3px 10px rgba(96, 70, 35, 0.2);
	border-radius: 4px;
	flex-shrink: 0;
}
.meta {
	flex: 1;
	min-width: 0;
}
.bookTitle {
	font-family: var(--hy-serif);
	font-weight: 600;
	font-size: 18px;
	color: var(--hy-ink);
	line-height: 1.4;
}
.bookAuthor {
	font-size: 13px;
	color: var(--hy-muted);
	margin-top: 3px;
}
.statusRow {
	display: flex;
	align-items: center;
	gap: 10px;
	margin: 11px 0 8px;
}
.statusChip {
	font-size: 12px;
	font-weight: 700;
	padding: 3px 12px;
	border-radius: 999px;
}
.pages {
	font-size: 12px;
	color: var(--hy-muted);
}
.progressWrap {
	display: flex;
	align-items: center;
	gap: 8px;
	max-width: 260px;
}
.progressBar {
	flex: 1;
	height: 6px;
	border-radius: 999px;
	background: var(--hy-border);
	overflow: hidden;
	display: block;
}
.progressFill {
	display: block;
	height: 100%;
	border-radius: 999px;
	background: var(--hy-accent);
}
.progressText {
	font-size: 11px;
	font-weight: 700;
	color: var(--hy-accent-ink);
}

.record {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 12px;
	padding: 14px 16px;
	margin-bottom: 14px;
}
.recordTitle {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 13px;
	color: var(--hy-ink);
	margin-bottom: 11px;
}
.recordTitle i {
	color: var(--hy-accent);
}
.sliderRow {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
}
.slider {
	flex: 1;
	accent-color: var(--hy-accent);
	height: 6px;
	cursor: pointer;
}
.sliderPct {
	font-size: 12.5px;
	font-weight: 700;
	color: var(--hy-accent-ink);
	min-width: 40px;
	text-align: right;
}
.recordRow {
	display: flex;
	align-items: center;
	gap: 9px;
	margin-bottom: 11px;
}
.recordLabel {
	font-size: 12.5px;
	color: var(--hy-body);
}
.pageInput {
	width: 90px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 7px 10px;
	color: var(--hy-ink);
	font-size: 14px;
	outline: none;
}
.pageInput:focus {
	border-color: var(--hy-accent);
}
.recordTotal {
	font-size: 12.5px;
	color: var(--hy-muted);
}
.recordSave {
	margin-left: auto;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 999px;
	padding: 7px 16px;
	font-size: 12.5px;
	font-weight: 700;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.recordSave:disabled {
	opacity: 0.5;
}
.statusBtns {
	display: flex;
	gap: 7px;
}
.statusBtn {
	flex: 1;
	background: var(--hy-bg);
	border: 1.5px solid var(--hy-border);
	border-radius: 999px;
	padding: 7px 12px;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-body);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.statusBtnOn {
	background: var(--hy-accent);
	color: #fff;
	border-color: transparent;
}

.editForm {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 12px;
	padding: 16px;
	margin-bottom: 14px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.fLabel {
	font-family: var(--hy-heading);
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-ink);
}
.input {
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 9px 12px;
	color: var(--hy-ink);
	font-size: 14px;
	outline: none;
	font-family: inherit;
}
.input:focus {
	border-color: var(--hy-accent);
}
.swatches {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}
.swatch {
	width: 22px;
	height: 22px;
	border-radius: 5px;
	border: 2px solid var(--hy-surface);
	box-shadow: 0 0 0 1px var(--hy-border);
	cursor: pointer;
	padding: 0;
}
.swatchOn {
	box-shadow: 0 0 0 2px var(--hy-accent);
}
.editActions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

/* しおり */
.bmSection {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 12px;
	padding: 14px 16px;
	margin-bottom: 14px;
}
.bmHead {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 13px;
	color: var(--hy-ink);
	margin-bottom: 11px;
}
.bmHead i {
	color: var(--hy-accent);
}
.bmList {
	display: flex;
	flex-direction: column;
	gap: 7px;
	margin-bottom: 11px;
}
.bmItem {
	display: flex;
	flex-direction: column;
	gap: 8px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-left: 4px solid;
	border-radius: 8px;
	padding: 7px 10px;
}
.bmMain {
	display: flex;
	align-items: center;
	gap: 10px;
}
.bmTag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 6px;
	color: #fff;
	font-size: 12px;
	flex-shrink: 0;
}
.bmInfo {
	flex: 1;
	min-width: 0;
}
.bmName {
	font-size: 12.5px;
	font-weight: 700;
	color: var(--hy-ink);
}
.bmPage {
	font-size: 11px;
	color: var(--hy-muted);
}
.bmDel {
	background: none;
	border: none;
	color: var(--hy-muted);
	cursor: pointer;
	font-size: 15px;
}
.bmDel:hover {
	color: #c0563a;
}
.bmEmpty {
	font-size: 12px;
	color: var(--hy-muted);
	margin-bottom: 4px;
}
.bmAdd {
	display: flex;
	align-items: center;
	gap: 7px;
	flex-wrap: wrap;
}
.bmPageInput {
	width: 74px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 7px 9px;
	color: var(--hy-ink);
	font-size: 13px;
	outline: none;
}
.bmNameInput {
	flex: 1;
	min-width: 120px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 7px 10px;
	color: var(--hy-ink);
	font-size: 13px;
	outline: none;
	font-family: inherit;
}
.bmPageInput:focus,
.bmNameInput:focus {
	border-color: var(--hy-accent);
}
.bmColors {
	display: flex;
	gap: 4px;
}
.bmColor {
	width: 20px;
	height: 20px;
	border-radius: 999px;
	border: 2px solid var(--hy-surface);
	box-shadow: 0 0 0 1px var(--hy-border);
	cursor: pointer;
	padding: 0;
}
.bmColorOn {
	box-shadow: 0 0 0 2px var(--hy-ink);
}
.bmAddBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 999px;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	cursor: pointer;
	font-size: 16px;
}
.bmAddBtn:disabled {
	opacity: 0.5;
}
.bmIconBtn {
	flex-shrink: 0;
	background: none;
	border: none;
	color: var(--hy-muted);
	cursor: pointer;
	font-size: 15px;
	padding: 2px;
}
.bmIconBtn:hover {
	color: var(--hy-accent);
}
.bmIconBtnOn {
	color: var(--hy-accent);
}
.bmMemoText {
	font-size: 12px;
	color: var(--hy-body);
	margin-top: 4px;
	white-space: pre-wrap;
	word-break: break-word;
	line-height: 1.5;
}
.bmMemoEdit {
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.bmMemoArea {
	width: 100%;
	box-sizing: border-box;
	resize: vertical;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 7px 10px;
	color: var(--hy-ink);
	font-size: 13px;
	outline: none;
	font-family: inherit;
	line-height: 1.5;
}
.bmMemoArea:focus {
	border-color: var(--hy-accent);
}
.bmMemoActions {
	display: flex;
	justify-content: center;
	gap: 7px;
}

/* 内容メモ */
.memoSection {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 12px;
	padding: 14px 16px;
	margin-bottom: 14px;
}
.memoHead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 11px;
	flex-wrap: wrap;
}
.memoHeadLabel {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 13px;
	color: var(--hy-ink);
}
.memoHeadLabel i {
	color: var(--hy-accent);
}
.memoSortBtn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 5px 12px;
	font-size: 11.5px;
	font-weight: 700;
	color: var(--hy-body);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.memoSortBtn:hover {
	border-color: var(--hy-accent);
}
.memoList {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 11px;
}
.memoItem {
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 9px 11px;
}
.memoText {
	font-size: 13px;
	color: var(--hy-ink);
	white-space: pre-wrap;
	word-break: break-word;
	line-height: 1.6;
}
.memoMeta {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 7px;
}
.memoPageTag {
	font-size: 11px;
	font-weight: 700;
	color: var(--hy-accent-ink);
	background: rgba(217, 130, 74, 0.14);
	padding: 1px 8px;
	border-radius: 999px;
}
.memoDate {
	font-size: 11px;
	color: var(--hy-muted);
}
.memoSpacer {
	flex: 1;
}
.memoIconBtn {
	background: none;
	border: none;
	color: var(--hy-muted);
	cursor: pointer;
	font-size: 14px;
	padding: 2px;
}
.memoIconBtn:hover {
	color: var(--hy-accent);
}
.memoDanger:hover {
	color: #c0563a;
}
.memoEmpty {
	font-size: 12.5px;
	color: var(--hy-muted);
}
.memoAdd {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.memoArea {
	width: 100%;
	box-sizing: border-box;
	resize: vertical;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 8px 11px;
	color: var(--hy-ink);
	font-size: 13px;
	outline: none;
	font-family: inherit;
	line-height: 1.55;
}
.memoArea:focus {
	border-color: var(--hy-accent);
}
.memoAddRow,
.memoEditRow {
	display: flex;
	align-items: center;
	gap: 8px;
}
.memoPageInput {
	width: 110px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 8px;
	padding: 7px 10px;
	color: var(--hy-ink);
	font-size: 13px;
	outline: none;
}
.memoPageInput:focus {
	border-color: var(--hy-accent);
}
.memoAddBtn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 999px;
	padding: 8px 16px;
	font-size: 12.5px;
	font-weight: 700;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.memoAddBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.memoTextBtn {
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 6px 14px;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-body);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.memoSaveBtn {
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 999px;
	padding: 6px 16px;
	font-size: 12px;
	font-weight: 700;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.memoSaveBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.actions {
	display: flex;
	gap: 10px;
	margin-bottom: 18px;
	flex-wrap: wrap;
}
.actionBtn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	padding: 9px 16px;
	font-size: 13px;
	font-weight: 700;
	color: var(--hy-ink);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.actionBtn:hover {
	border-color: var(--hy-accent);
}
.danger {
	color: #c0563a;
}
.danger:hover {
	border-color: #c0563a;
}
.favOn {
	color: #d9a441;
	border-color: #d9a441;
}
.recOn {
	color: var(--hy-accent-ink);
	border-color: var(--hy-accent);
}

.btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border-radius: 999px;
	padding: 8px 18px;
	font-weight: 700;
	font-family: var(--hy-heading);
	font-size: 13px;
	cursor: pointer;
	border: 1.5px solid transparent;
}
.btn:disabled {
	opacity: 0.5;
}
.btnGhost {
	background: transparent;
	color: var(--hy-body);
}
.btnPrimary {
	background: linear-gradient(90deg, #e0955a, #d9824a);
	color: #fff;
	box-shadow: 0 2px 8px rgba(217, 130, 74, 0.35);
}

.logsHead {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 14px;
	color: var(--hy-ink);
	margin-bottom: 12px;
}
.logsHead i {
	color: var(--hy-accent);
}
.logsEmpty {
	font-size: 12.5px;
	color: var(--hy-muted);
}
.logs {
	display: flex;
	flex-direction: column;
	gap: 9px;
}
.logCard {
	width: 100%;
	text-align: left;
	cursor: pointer;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-left: 4px solid;
	border-radius: 10px;
	padding: 11px 13px;
	transition: border-color 0.12s;
}
.logCard:hover {
	border-color: var(--hy-accent);
}
.logTop {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 6px;
}
.logTime {
	margin-left: auto;
	font-size: 11px;
	color: var(--hy-muted);
}
.logTitle {
	font-size: 13.5px;
	font-weight: 700;
	color: var(--hy-ink);
	line-height: 1.4;
}

/* 旗鯖fork: 下にさらに内容があることを示すボトムフェード。
   .body の最下部に sticky で貼り付き、負マージンでレイアウト高さを増やさずに
   直前の内容へ重ねる。最下部到達/溢れ無しのときは JS で opacity 0 にして隠す。 */
.scrollFade {
	position: sticky;
	bottom: 0;
	left: 0;
	height: 52px;
	margin: -52px -22px 0;
	pointer-events: none;
	background: linear-gradient(
		to top,
		var(--hy-bg) 22%,
		color-mix(in srgb, var(--hy-bg) 40%, transparent) 60%,
		transparent
	);
	opacity: 1;
	transition: opacity 0.2s ease;
	z-index: 3;
}
.scrollFadeHidden {
	opacity: 0;
}

.body {
	padding: 0;
	background: var(--hy-surface);
	min-height: 0;
}
.titleRow {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}
.titleActions {
	display: flex;
	flex: none;
	gap: 8px;
}
.titleActions button {
	flex: none;
}
.bookTitle {
	font-family: var(--hy-heading);
	font-size: 25px;
	margin: 0;
}
.titleRow h2 {
	flex: 0 1 auto;
	min-width: 0;
	max-width: 100%;
	overflow-wrap: anywhere;
}
.description {
	font-size: 14px;
	line-height: 1.8;
	white-space: pre-wrap;
	margin: 24px 0;
}
.description h3 {
	font-size: 14px;
}
.record,
.bmSection,
.memoSection {
	border-radius: 20px;
}
.logs {
	display: grid;
	gap: 14px;
}
.head {
	gap: 24px;
}
.actions {
	justify-content: center;
	flex-wrap: wrap;
}
.actionBtn {
	min-height: 44px;
	border-radius: 999px;
}
.bmDel,
.bmIconBtn,
.memoIconBtn,
.bmColor {
	min-width: 36px;
	min-height: 36px;
}
</style>
