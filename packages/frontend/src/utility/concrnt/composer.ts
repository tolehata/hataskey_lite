/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: CTL の投稿ポップアップとタイムラインが共有する、下書きとリスト選択の状態。
// ポップアップを閉じても下書きは残し、接続先の本人が変わった時だけ破棄する。

import { computed, reactive, ref, watch } from 'vue';
import type { Component } from 'vue';
import { concrntState, loadConcrntListSelection, runConcrntAction, saveConcrntListSelection } from './runtime.js';
import type { ConcrntList, ConcrntMedia, ConcrntMessage } from './types.js';

export const concrntListState = reactive({
	items: [] as ConcrntList[],
	/** The saved selection for the current identity has been read. */
	selectionReady: false,
	/** `items` reflect a successful fetch for the current identity. */
	ready: false,
	loading: false,
	pending: false,
	error: '',
	uri: '',
});

export const concrntDraft = reactive({
	body: '',
	attachments: [] as ConcrntMedia[],
	emojis: {} as Record<string, { imageURL?: string }>,
	target: null as ConcrntMessage | null,
	mode: 'reply' as 'reply' | 'quote',
	/** A send whose result is not confirmed must never be repeated from the same draft. */
	blocked: false,
	// world-app style destinations. `null` follows the selected list's defaults.
	profile: null as string | null,
	postHome: null as boolean | null,
	destinations: null as string[] | null,
});

/** Incremented after a confirmed post so open timelines can refresh. */
export const concrntPostedRevision = ref(0);

let listRequest = 0;

export function resetConcrntDraft(): void {
	concrntDraft.body = '';
	concrntDraft.attachments = [];
	concrntDraft.emojis = {};
	concrntDraft.target = null;
	concrntDraft.blocked = false;
	resetConcrntDestinations();
}

/** Back to the selected list's defaults (world-app's reset button). */
export function resetConcrntDestinations(): void {
	concrntDraft.profile = null;
	concrntDraft.postHome = null;
	concrntDraft.destinations = null;
}

export const concrntSelectedList = computed(() => concrntListState.uri
	? concrntListState.items.find(list => list.uri === concrntListState.uri)
	: concrntListState.items.find(list => list.pinned));
/** A list's default profile is used only if it is one of this account's profiles. */
export const concrntPostProfile = computed(() => {
	const owned = (id: string | null | undefined) => id != null && (concrntState.profiles.length === 0 || concrntState.profiles.some(profile => profile.id === id));
	if (owned(concrntDraft.profile)) return concrntDraft.profile!;
	const preset = concrntSelectedList.value?.defaultProfile;
	return owned(preset) ? preset! : concrntState.settings.profile;
});
export const concrntDestinations = computed(() => concrntDraft.destinations ?? concrntSelectedList.value?.defaultPostTimelines ?? []);
export const concrntPostHome = computed(() => concrntDraft.postHome ?? concrntSelectedList.value?.defaultPostHome !== false);
export const concrntDestinationsCustomized = computed(() => concrntDraft.profile != null || concrntDraft.postHome != null || concrntDraft.destinations != null);
/** Communities the user has put in a list (world-app's "known communities"), plus each list's own post defaults. */
export const concrntKnownTimelines = computed(() => [...new Set(concrntListState.items.flatMap(list => [...(list.communities ?? []), ...list.defaultPostTimelines]))]);

export const concrntDestinationLabel = computed(() => {
	if (!concrntListState.selectionReady || !concrntListState.ready || concrntListState.pending) return '確認中';
	return `${concrntPostHome.value ? 'ホーム' : ''}${concrntDestinations.value.length ? `${concrntPostHome.value ? '＋' : ''}${concrntDestinations.value.length}件` : ''}` || '未選択';
});

export const concrntDestinationProblem = computed(() => {
	if (concrntListState.pending) return '選択した投稿先を保存しています。';
	if (!concrntListState.selectionReady || !concrntListState.ready) return '投稿先を確認できるまで、投稿と画像の追加はできません。一覧を更新してください。';
	if (concrntListState.uri && !concrntSelectedList.value && !concrntDestinationsCustomized.value) return '選択したリストが見つかりません。リストを選び直すか、投稿先を直接選んでください。';
	if (!concrntPostHome.value && !concrntDestinations.value.length) return '投稿先がありません。自分のホームか、投稿するタイムラインを選んでください。';
	return '';
});

let inflight: { id: number; promise: Promise<boolean> } | null = null;

/**
 * Reads the saved selection once per identity, then fetches the lists. Returns false when stale or failed.
 * Concurrent callers (several CTL columns, the post form) share one request instead of invalidating each other.
 */
export function refreshConcrntLists(): Promise<boolean> {
	if (inflight?.id === listRequest) return inflight.promise;
	const entry = { id: listRequest + 1, promise: fetchLists() };
	inflight = entry;
	void entry.promise.finally(() => { if (inflight === entry) inflight = null; });
	return entry.promise;
}

async function fetchLists(): Promise<boolean> {
	const id = ++listRequest;
	const revision = concrntState.revision;
	concrntListState.loading = true;
	concrntListState.error = '';
	concrntListState.ready = false;
	const current = () => id === listRequest && revision === concrntState.revision;
	try {
		if (!concrntListState.selectionReady) {
			const saved = await loadConcrntListSelection();
			if (!current()) return false;
			concrntListState.uri = saved ?? '';
			concrntListState.selectionReady = true;
		}
		const items = await runConcrntAction(client => client.getLists(concrntState.settings.profile));
		if (!current()) return false;
		concrntListState.items = items;
		concrntListState.ready = true;
		return true;
	} catch {
		if (current()) concrntListState.error = 'リストを取得できませんでした。';
		return false;
	} finally {
		if (current()) concrntListState.loading = false;
	}
}

/** Persist first: the destination may change only after the selection is saved. */
export async function selectConcrntList(uri: string): Promise<boolean> {
	if (concrntListState.pending || (uri && !concrntListState.items.some(list => list.uri === uri))) return false;
	const revision = concrntState.revision;
	concrntListState.pending = true;
	try {
		await saveConcrntListSelection(uri || null);
		if (revision !== concrntState.revision) return false;
		concrntListState.uri = uri;
		concrntListState.selectionReady = true;
		return true;
	} finally {
		if (revision === concrntState.revision) concrntListState.pending = false;
	}
}

function clearLists(): void {
	listRequest++;
	inflight = null;
	Object.assign(concrntListState, { items: [], selectionReady: false, ready: false, loading: false, pending: false, error: '', uri: '' });
}

// Reconnecting or changing notification preferences must not discard the current draft.
// Credentials and profiles still form a strict boundary: never move a draft to another identity.
watch(() => JSON.stringify([concrntState.currentOwner, concrntState.connection?.ccid, concrntState.connection?.ckid, concrntState.connection?.domain, concrntState.settings.profile]), resetConcrntDraft);
watch(() => concrntState.revision, clearLists);

async function openDialog(load: () => Promise<{ default: Component }>, props: Record<string, unknown> = {}, onClosed?: () => void): Promise<void> {
	const [os, component] = await Promise.all([import('@/os.js'), load()]);
	const { dispose } = os.popup(component.default, props, { closed: () => { onClosed?.(); dispose(); } });
}

/** The send journal: results to confirm and unsent steps to continue. */
export function openConcrntHistory(): Promise<void> {
	return openDialog(() => import('@/components/concrnt/ConcrntHistoryDialog.vue'));
}

/** One post with its context, in a popup instead of a new tab. */
export function openConcrntMessage(uri: string): Promise<void> {
	return openDialog(() => import('@/components/concrnt/ConcrntNoteDialog.vue'), { uri });
}

let dialogOpen = false;

/** Open the CTL post form. A reply/quote target replaces the previous one unless a send is unresolved. */
export async function openConcrntPostForm(options: { target?: ConcrntMessage; mode?: 'reply' | 'quote' } = {}): Promise<void> {
	if (options.target && !concrntDraft.blocked) {
		concrntDraft.target = options.target;
		concrntDraft.mode = options.mode ?? 'reply';
	}
	if (dialogOpen) return;
	dialogOpen = true;
	try {
		await openDialog(() => import('@/components/concrnt/ConcrntPostFormDialog.vue'), {}, () => { dialogOpen = false; });
	} catch (error) {
		dialogOpen = false;
		throw error;
	}
}
