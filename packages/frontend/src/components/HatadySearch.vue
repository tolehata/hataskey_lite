<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady P4): 自分の学習データを横断検索(モーダル)。
  ログ / 本 / 本の内容メモ / しおりメモ を1つの検索窓でまとめて検索する。
  データは hata/hatady/search から取得(2文字以上・種別フィルタ可)。
  結果クリックで対応する本の詳細を開く(本/メモ/しおり)か、その日のマイログへジャンプ(ログ)。
-->
<template>
<HyDialog ref="dialog" :title="copy.title" @close="dialog?.close()" @closed="emit('closed')">
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<!-- 検索入力と対象カテゴリはそれぞれのカプセルに収める。 -->
		<div :class="$style.capsule">
			<input
				ref="inputEl"
				v-model="query"
				type="search"
				:class="$style.queryInput"
				:placeholder="copy.placeholder"
				@input="onInput"
				@keydown.enter.prevent="runSearch(true)"
			/>
			<button
				v-if="query"
				type="button"
				:class="$style.clearBtn"
				tabindex="-1"
				:aria-label="copy.clear"
				@click="clearSearch"
			>
				<i class="ti ti-x"></i>
			</button>
			<button type="button" :class="$style.searchBtn" :aria-label="copy.title" @click="runSearch(true)">
				<i class="ti ti-search"></i>
			</button>
		</div>
		<HyCapsule v-model="scope" :class="$style.scopes" :options="scopeOptions" :label="copy.scope" @update:modelValue="runSearch(true)"/>

		<!-- 結果 -->
		<div v-if="query.trim().length >= 2" :class="$style.results">
			<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
			<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
			<div v-else-if="!error && totalCount === 0 && (!inHataGoes || !searchesUsers || (!userLoading && !userError && users.length === 0))" :class="$style.empty">
				<i class="ti ti-mood-empty" :class="$style.hintIcon"></i>
				<div>{{ copy.noResults }}</div>
			</div>
			<template v-else>
				<section v-if="inHataGoes && searchesUsers" :class="$style.group" aria-label="ユーザー">
					<div :class="$style.groupHead"><i class="ti ti-users"></i>ユーザー<span :class="$style.groupCount">{{ users.length }}</span></div>
					<p v-if="userLoading && users.length === 0" :class="$style.userState">{{ copy.loading }}</p>
					<p v-if="userError" role="alert" :class="$style.userState">{{ userError }} <button type="button" @click="loadUsers(query.trim(), seq)">再試行</button></p>
					<button v-for="user in users" :key="user.id" type="button" :class="$style.row" @click="openProfile(user.id)">
						<img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" :class="$style.avatar"/>
						<span v-else :class="$style.avatar"><i class="ti ti-user"></i></span>
						<span :class="$style.rowMain"><strong :class="$style.rowTitle">{{ user.name || user.username }}</strong><small :class="$style.rowSub">@{{ user.username }}{{ user.host ? `@${user.host}` : '' }}</small></span>
						<i class="ti ti-chevron-right" :class="$style.rowGo"></i>
					</button>
					<button v-if="userHasMore" type="button" :class="$style.more" :disabled="userLoading" @click="loadUsers(query.trim(), seq)">{{ userLoading ? copy.loading : 'もっと見る' }}</button>
				</section>
				<!-- ログ -->
				<section v-if="results && results.logs.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-notebook"></i>
						{{ copy.logs }}
						<span :class="$style.groupCount">{{ results.logs.length }}</span>
					</div>
					<button v-for="log in results.logs" :key="log.id" :class="$style.row" @click="jumpToLog(log)">
						<span :class="$style.rowIcon" :style="{ background: '#eadfce' }"><i class="ti ti-pencil"></i></span>
						<span :class="$style.rowMain">
							<span :class="$style.rowTitle" v-html="hl(log.title || copy.untitled)"></span>
							<span :class="$style.rowSub">
								<span v-if="log.subject" :class="$style.rowTag" v-html="hl(log.subject)"></span>
								{{ fmtDate(log.studiedAt) }}
								<span v-if="log.body && !log.details?.spoiler">·</span>
								<span v-if="log.body && !log.details?.spoiler" v-html="hl(snippet(log.body))"></span>
							</span>
						</span>
						<i class="ti ti-chevron-right" :class="$style.rowGo"></i>
					</button>
				</section>

				<!-- 本 -->
				<section v-if="results && results.books.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-book"></i>
						{{ copy.books }}
						<span :class="$style.groupCount">{{ results.books.length }}</span>
					</div>
					<button v-for="b in results.books" :key="b.id" :class="$style.row" @click="openBook(b.id)">
						<HyBookCover :title="b.title" :author="b.author" :width="30"/>
						<span :class="$style.rowMain">
							<span :class="$style.rowTitle" v-html="hl(b.title)"></span>
							<span :class="$style.rowSub">
								<span v-if="b.author" v-html="hl(b.author)"></span>
								<span v-if="b.status" :class="$style.statusPill">{{ statusLabel(b.status) }}</span>
							</span>
						</span>
						<i class="ti ti-chevron-right" :class="$style.rowGo"></i>
					</button>
				</section>

				<!-- 本の内容メモ -->
				<section v-if="results && results.bookMemos.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-note"></i>
						{{ copy.bookMemos }}
						<span :class="$style.groupCount">{{ results.bookMemos.length }}</span>
					</div>
					<button v-for="m in results.bookMemos" :key="m.id" :class="$style.row" @click="openBook(m.bookId)">
						<span :class="$style.rowIcon" :style="{ background: '#e5ecd8' }"><i class="ti ti-note"></i></span>
						<span :class="$style.rowMain">
							<span :class="$style.rowTitle" v-html="hl(snippet(m.text, 60))"></span>
							<span :class="$style.rowSub">
								<i class="ti ti-book-2"></i>
								{{ m.book?.title || copy.inBook }}
								<span v-if="m.page != null">
									· {{ i18n.tsx._hata._hatady._search.pageNumber({ page: m.page.toString() }) }}
								</span>
							</span>
						</span>
						<i class="ti ti-chevron-right" :class="$style.rowGo"></i>
					</button>
				</section>

				<!-- しおりメモ -->
				<section v-if="results && results.bookmarks.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-bookmark"></i>
						{{ copy.bookmarks }}
						<span :class="$style.groupCount">{{ results.bookmarks.length }}</span>
					</div>
					<button v-for="bm in results.bookmarks" :key="bm.id" :class="$style.row" @click="openBook(bm.bookId)">
						<span :class="$style.rowIcon" :style="{ background: bmColor(bm.color) }">
							<i class="ti ti-bookmark-filled"></i>
						</span>
						<span :class="$style.rowMain">
							<span
								:class="$style.rowTitle"
								v-html="hl(bm.name || snippet(bm.memo || '', 60) || copy.untitled)"
							></span>
							<span :class="$style.rowSub">
								<i class="ti ti-book-2"></i>
								{{ bm.book?.title || copy.inBookmark }}
								<span v-if="bm.memo && bm.name">·</span>
								<span v-if="bm.memo && bm.name" v-html="hl(snippet(bm.memo, 40))"></span>
								<span v-if="bm.page != null">
									· {{ i18n.tsx._hata._hatady._search.pageNumber({ page: bm.page.toString() }) }}
								</span>
							</span>
						</span>
						<i class="ti ti-chevron-right" :class="$style.rowGo"></i>
					</button>
				</section>
				<section v-if="results?.mediaWorks?.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-books"></i>
						{{ copy.mediaWorks }}
						<span>{{ results.mediaWorks.length }}</span>
					</div>
					<button v-for="work in results.mediaWorks" :key="work.id" :class="$style.row" @click="openMedia(work.id)">
						<span :class="$style.rowIcon">
							<i
								:class="
									work.kind === 'movie'
										? 'ti ti-movie'
										: work.kind === 'work'
											? 'ti ti-briefcase'
											: 'ti ti-device-gamepad-2'
								"
							></i>
						</span>
						<span :class="$style.rowMain">
							<strong :class="$style.rowTitle" v-html="hl(work.title)"></strong>
							<small>{{ work.creator || work.details?.genre }}</small>
						</span>
						<i class="ti ti-chevron-right"></i>
					</button>
				</section>
				<section v-if="results?.mediaSessions?.length" :class="$style.group">
					<div :class="$style.groupHead">
						<i class="ti ti-notebook"></i>
						{{ copy.mediaSessions }}
						<span>{{ results.mediaSessions.length }}</span>
					</div>
					<button
						v-for="session in results.mediaSessions"
						:key="session.id"
						:class="$style.row"
						@click="openSession(session)"
					>
						<span :class="$style.rowMain">
							<strong
								:class="$style.rowTitle"
								v-html="hl(session.work?.title || session.workSnapshot?.title || copy.records)"
							></strong>
							<small v-if="!session.noteSpoiler" v-html="hl(snippet(session.note || ''))"></small>
							<small v-else>{{ copy.spoilerContent }}</small>
						</span>
						<i class="ti ti-chevron-right"></i>
					</button>
				</section>
			</template>
		</div>
	</div>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref, computed, inject, onMounted, nextTick, onUnmounted } from 'vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import HyBookCover from '@/components/HyBookCover.vue';
import { i18n } from '@/i18n.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { versatileLang } from '@/utility/intl-const.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { usersSearchAvailable } from '@/utility/check-permissions.js';
import type * as Misskey from 'cherrypick-js';

const popup = useHataGoesPopup();
const inHataGoes = inject(HATA_GOES_HOST, null) != null;

const props = defineProps<{ initialQuery?: string }>();
const emit = defineEmits<{ (ev: 'closed'): void; (ev: 'jumpLog', studiedAt: string): void }>();
const dialog = ref<any>(null);
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._search;
const dateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'short', day: 'numeric' });

type Results = {
	logs: any[];
	books: any[];
	bookMemos: any[];
	bookmarks: any[];
	mediaWorks: any[];
	mediaSessions: any[];
};
const TYPES = [
	{ key: 'logs', icon: 'ti-notebook' },
	{ key: 'books', icon: 'ti-book' },
	{ key: 'bookMemos', icon: 'ti-note' },
	{ key: 'bookmarks', icon: 'ti-bookmark' },
	{ key: 'mediaWorks', icon: 'ti-books' },
	{ key: 'mediaSessions', icon: 'ti-movie' },
] as const;
type TypeKey = (typeof TYPES)[number]['key'];

const inputEl = ref<HTMLInputElement | null>(null);
const query = ref(props.initialQuery ?? '');
// 検索対象は単一選択。'all' は全種別。
const scope = ref('all');
const results = ref<Results | null>(null);
const loading = ref(false);
const error = ref('');
type SearchUser = Pick<Misskey.entities.UserLite, 'id' | 'name' | 'username' | 'host' | 'avatarUrl'>;
const users = ref<SearchUser[]>([]);
const userLoading = ref(false);
const userError = ref('');
const userHasMore = ref(false);
let userOffset = 0;
const userPageSize = 20;
const searchesUsers = computed(() => scope.value === 'all' || scope.value === 'users');

const totalCount = computed(() => {
	const r = results.value;
	return r
		? r.logs.length +
				r.books.length +
				r.bookMemos.length +
				r.bookmarks.length +
				(r.mediaWorks?.length || 0) +
				(r.mediaSessions?.length || 0)
		: 0;
});
const typeLabel = (key: TypeKey): string =>
	({
		logs: copy.logs,
		books: copy.books,
		bookMemos: copy.bookMemos,
		bookmarks: copy.bookmarks,
		mediaWorks: copy.mediaWorks,
		mediaSessions: copy.mediaSessions,
	})[key];
const scopeOptions = computed(() => [
	{ value: 'all', label: copy.scopeAll, icon: 'ti ti-search' },
	...TYPES.map((t) => ({ value: t.key, label: typeLabel(t.key), icon: `ti ${t.icon}` })),
	...(inHataGoes ? [{ value: 'users', label: 'ユーザー', icon: 'ti ti-users' }] : []),
]);
let debounceId: number | undefined;
let seq = 0;
let disposed = false;

function resetUsers() {
	users.value = [];
	userOffset = 0;
	userLoading.value = false;
	userError.value = '';
	userHasMore.value = false;
}

async function loadUsers(q: string, request: number) {
	if (!inHataGoes || !searchesUsers.value || request !== seq || userLoading.value) return;
	if (!usersSearchAvailable) {
		userError.value = i18n.ts.usersSearchNotAvailable;
		return;
	}
	userLoading.value = true;
	userError.value = '';
	try {
		const page = await misskeyApi<SearchUser[]>('users/search', { query: q, offset: userOffset, limit: userPageSize, origin: 'combined', detail: false });
		if (request !== seq || disposed) return;
		userOffset += page.length;
		const ids = new Set(users.value.map((user) => user.id));
		const fresh = page.filter((user) => {
			if (ids.has(user.id)) return false;
			ids.add(user.id);
			return true;
		});
		users.value = [...users.value, ...fresh];
		userHasMore.value = page.length === userPageSize;
	} catch {
		if (request === seq && !disposed) userError.value = copy.searchFailed;
	} finally {
		if (request === seq && !disposed) userLoading.value = false;
	}
}

function clearSearch() {
	query.value = '';
	seq++;
	loading.value = false;
	results.value = null;
	error.value = '';
	resetUsers();
	if (debounceId) window.clearTimeout(debounceId);
}

onUnmounted(() => {
	disposed = true;
	seq++;
	resetUsers();
	if (debounceId) window.clearTimeout(debounceId);
});

function onInput() {
	if (debounceId) window.clearTimeout(debounceId);
	// Invalidate an earlier response as soon as the query changes, including the debounce wait.
	seq++;
	resetUsers();
	results.value = null;
	error.value = '';
	loading.value = query.value.trim().length >= 2;
	if (!loading.value) {
		results.value = null;
		return;
	}
	debounceId = window.setTimeout(() => runSearch(false), 300);
}

async function runSearch(_immediate: boolean, preserveResults = false) {
	if (disposed) return;
	const keepResults = preserveResults && !loading.value && results.value !== null;
	if (debounceId) {
		window.clearTimeout(debounceId);
		debounceId = undefined;
	}
	const q = query.value.trim();
	if (q.length < 2) {
		seq++;
		resetUsers();
		loading.value = false;
		results.value = null;
		return;
	}
	const mySeq = ++seq;
	resetUsers();
	if (!keepResults) results.value = null;
	loading.value = scope.value !== 'users' && !keepResults;
	error.value = '';
	if (inHataGoes && searchesUsers.value) void loadUsers(q, mySeq);
	if (inHataGoes && scope.value === 'users') {
		results.value = null;
		return;
	}
	try {
		const res = (await (misskeyApi as any)('hata/hatady/search', {
			query: q,
			types: scope.value === 'all' ? null : [scope.value],
			limit: 20,
		})) as Results;
		if (mySeq === seq) results.value = res;
	} catch {
		if (mySeq === seq) error.value = copy.searchFailed;
	} finally {
		if (mySeq === seq) loading.value = false;
	}
}

function removeResult(type: 'book' | 'work' | 'session', id: string) {
	// A response started before deletion must not put the removed row back.
	seq++;
	const pendingUsers = userLoading.value;
	userLoading.value = false;
	if (pendingUsers && inHataGoes && searchesUsers.value) void loadUsers(query.value.trim(), seq);
	const current = results.value;
	if (!current) return;
	if (type === 'book') {
		current.books = current.books.filter((book) => book.id !== id);
		current.bookMemos = current.bookMemos.filter((memo) => memo.bookId !== id);
		current.bookmarks = current.bookmarks.filter((bookmark) => bookmark.bookId !== id);
	} else if (type === 'work') {
		current.mediaWorks = current.mediaWorks.filter((work) => work.id !== id);
	} else {
		current.mediaSessions = current.mediaSessions.filter((session) => session.id !== id);
	}
}

function refreshResults() {
	void runSearch(true, true);
}

async function openBook(bookId: string | null) {
	if (!bookId) return;
	const { dispose } = popup(
		(await import('@/components/HatadyBookDetail.vue')).default,
		{ bookId },
		{ closed: () => dispose(), deleted: () => removeResult('book', bookId), changed: refreshResults },
	);
}

async function openProfile(userId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyProfile.vue')).default,
		{ userId },
		{ closed: () => dispose() },
	);
}

function jumpToLog(log: any) {
	emit('jumpLog', log.studiedAt);
	dialog.value?.close?.();
}

// 検索語ハイライト(HTMLエスケープ後に <mark> を挿入)。
function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hl(text: string): string {
	const q = query.value.trim();
	const safe = escapeHtml(text ?? '');
	if (q.length < 2) return safe;
	const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return safe.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}

function snippet(s: string, max = 80): string {
	const one = (s ?? '').replace(/\s+/g, ' ').trim();
	return one.length > max ? one.slice(0, max) + '…' : one;
}

function fmtDate(iso: string): string {
	return dateFormatter.format(new Date(iso));
}

function statusLabel(st: string): string {
	return (
		(
			{
				reading: copy.statusReading,
				finished: copy.statusFinished,
				want: copy.statusWant,
				tsundoku: copy.statusTsundoku,
			} as Record<string, string>
		)[st] ?? st
	);
}

function bmColor(key: string | null): string {
	const m: Record<string, string> = {
		red: '#f2c4bd',
		orange: '#f4d3b0',
		yellow: '#f2e6ad',
		green: '#cfe6c2',
		blue: '#c3d8ee',
		purple: '#d9cdec',
		pink: '#f3cbe0',
	};
	return (key && m[key]) || '#eadfce';
}

async function openMedia(workId: string) {
	const { dispose } = popup(
		(await import('@/components/HatadyMediaWorkDetail.vue')).default,
		{ workId },
		{ closed: () => dispose(), deleted: () => removeResult('work', workId), changed: refreshResults },
	);
}

async function openSession(session: any) {
	const { dispose } = popup(
		(await import('@/components/HatadyConversation.vue')).default,
		{ sessionId: session.id, workId: session.workId },
		{
			closed: () => dispose(),
			deleted: (activity: HatadyActivity) => {
				if (activity.media?.session) removeResult('session', activity.media.session.id);
			},
			changed: refreshResults,
		},
	);
}

onMounted(async () => {
	await nextTick();
	inputEl.value?.focus();
	if (query.value.trim().length >= 2) runSearch(true);
});
</script>

<style lang="scss" module>
.body {
	display: flex;
	flex-direction: column;
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	box-sizing: border-box;
}

/* 検索バー（入力・クリア・検索） */
.capsule {
	display: flex;
	align-items: center;
	gap: 4px;
	margin: 4px;
	padding: 5px 6px 5px 8px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	transition:
		border-color 0.15s,
		box-shadow 0.15s;
}
.target {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 6px 10px;
	background: transparent;
	border: none;
	border-radius: 999px;
	font-size: 12.5px;
	color: var(--hy-ink);
	cursor: pointer;
	white-space: nowrap;
	font-family: var(--hy-heading);
	font-weight: 700;
}
.target:hover {
	background: rgba(0, 0, 0, 0.05);
}
.target > i:first-child {
	color: var(--hy-accent);
}
.targetLabel {
	font-weight: 700;
}
.targetChevron {
	font-size: 0.72em;
	opacity: 0.6;
}
.queryInput {
	flex: 1;
	min-width: 0;
	padding: 8px 4px;
	background: transparent;
	border: none;
	outline: none;
	color: var(--hy-ink);
	font-size: 14.5px;
	font-family: inherit;
}
.queryInput::placeholder {
	color: var(--hy-muted);
}
.clearBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--hy-muted);
	cursor: pointer;
}
.clearBtn:hover {
	background: rgba(0, 0, 0, 0.06);
	color: var(--hy-ink);
}
.searchBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	background: var(--hy-accent);
	border: none;
	border-radius: 50%;
	color: #fff;
	cursor: pointer;
	flex-shrink: 0;
	transition:
		filter 0.1s,
		transform 0.05s;
}
.searchBtn:hover {
	filter: brightness(1.08);
}
.searchBtn:active {
	transform: scale(0.96);
}

/* 結果 */
.results {
	flex: none;
	overflow: visible;
	padding: 12px 4px 0;
}
.hint,
.loading,
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	color: var(--hy-muted);
	padding: 40px 16px;
	font-size: 13px;
}
.hintIcon {
	font-size: 32px;
	margin-bottom: 10px;
	opacity: 0.5;
}

.group {
	margin-bottom: 16px;
}
.avatar {
	width: 36px;
	height: 36px;
	flex: 0 0 36px;
	border-radius: 50%;
	object-fit: cover;
	background: var(--hy-surface-2);
	display: grid;
	place-items: center;
}
.userState {
	color: var(--hy-muted);
	font-size: 12px;
}
.userState button, .more {
	border: 0;
	background: transparent;
	color: var(--hy-accent-ink);
	font: inherit;
	cursor: pointer;
}
.more {
	width: 100%;
	padding: 12px;
}
.more:disabled { cursor: wait; opacity: 0.6; }
.groupHead {
	display: flex;
	align-items: center;
	gap: 7px;
	font-family: var(--hy-heading);
	font-weight: 800;
	font-size: 12.5px;
	color: var(--hy-ink);
	margin-bottom: 8px;
}
.groupHead i {
	color: var(--hy-accent);
}
.groupCount {
	margin-left: auto;
	font-size: 11px;
	color: var(--hy-muted);
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 1px 8px;
}

.row {
	display: flex;
	align-items: center;
	gap: 11px;
	width: 100%;
	text-align: left;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 11px;
	padding: 10px 12px;
	margin-bottom: 6px;
	cursor: pointer;
	font-family: inherit;
}
.row:hover {
	border-color: var(--hy-accent);
}
.rowIcon {
	flex-shrink: 0;
	width: 30px;
	height: 30px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #8a6a4a;
	font-size: 15px;
}
.rowMain {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.rowTitle {
	font-size: 13px;
	font-weight: 700;
	color: var(--hy-ink);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.rowSub {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	color: var(--hy-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.rowTag {
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 5px;
	padding: 0 5px;
	font-weight: 700;
}
.statusPill {
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 0 7px;
	font-weight: 700;
}
.rowGo {
	color: var(--hy-muted);
	flex-shrink: 0;
}
.rowTitle :global(mark),
.rowSub :global(mark) {
	background: rgba(217, 130, 74, 0.28);
	color: inherit;
	border-radius: 3px;
	padding: 0 1px;
}

.body {
	padding: 0;
	background: var(--hy-surface);
	min-width: 0;
	min-height: 0;
}
.capsule {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	padding: 8px 10px;
	border-radius: 24px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	gap: 4px;
}
.capsule:has(> .queryInput:focus-visible) {
	outline: 2px solid var(--hy-accent);
	outline-offset: 2px;
}
.capsule > .queryInput:focus-visible {
	outline: none;
}
.body > .scopes {
	box-sizing: border-box;
	align-self: center;
	width: max-content;
	min-width: 0;
	max-width: 100%;
	margin-top: 8px;
	flex-wrap: wrap;
	justify-content: center;
	border-radius: 24px;
	overflow: clip;
}
.scopes > button[data-active] {
	box-sizing: border-box;
	max-width: 100%;
}
.scopes > button[data-active] > span {
	inline-size: auto;
	min-width: 0;
	white-space: normal;
	overflow-wrap: anywhere;
}
.queryInput {
	flex: 1;
	min-width: 80px;
	min-height: 44px;
	outline: none;
}
.searchBtn,
.clearBtn {
	min-width: 44px;
	min-height: 44px;
}
.groupHead {
	font-size: 14px;
}
.row {
	min-height: 64px;
	border-radius: 14px;
}
.rowTitle {
	font-size: 14px;
}
.rowSub {
	font-size: 12px;
}
</style>
