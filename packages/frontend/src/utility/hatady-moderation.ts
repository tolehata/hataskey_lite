/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, onScopeDispose, reactive, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

export type ModerationStatus = 'unreviewed' | 'flagged' | 'reviewed';
export type ModerationCategory = 'collection' | 'record' | 'comment' | 'reaction';
export type ModerationTarget = 'book' | 'log' | 'comment' | 'reaction' | 'mediaWork' | 'mediaSession' | 'mediaComment' | 'mediaReaction';
export type ModerationActivity = 'study' | 'movie' | 'game' | 'exercise' | 'work' | 'cooking';
export type ModerationVisibility = 'public' | 'followers' | 'private';
export interface ModerationEntry {
	fileIds?: string[];
	files?: Misskey.entities.DriveFile[];
	key: string;
	targetType: ModerationTarget;
	targetId: string;
	category: ModerationCategory;
	activity: ModerationActivity;
	actor: Misskey.entities.UserLite;
	title: string;
	body: string;
	createdAt: string;
	visibility: ModerationVisibility;
	emoji: string | null;
	parentKey: string | null;
	contentVersion: string;
	review: {
		state: ModerationStatus;
		note: string;
		revision: number;
		reviewer: Misskey.entities.UserLite | null;
		reviewedAt: string | null;
		stale: boolean;
	};
}
export interface ModerationDetail {
	item: ModerationEntry;
	fields: Array<{ label: string; value: string }>;
	ancestors: ModerationEntry[];
	related: ModerationEntry[];
	relatedHasMore: boolean;
}
export interface ModerationPage {
	items: ModerationEntry[];
	nextCursor: string | null;
	total: number;
	counts: Record<ModerationStatus, number>;
}
export interface ModerationQuery {
	limit: number;
	cursor?: string;
	category: ModerationCategory | 'all';
	status: ModerationStatus | 'all';
	activity: ModerationActivity | 'all';
	visibility: ModerationVisibility | 'all';
	query: string;
	since?: number;
	until?: number;
	sort: 'asc' | 'desc';
}
export interface ModerationReview {
	targetType: ModerationTarget;
	targetId: string;
	state: ModerationStatus;
	note: string;
	expectedRevision: number;
	expectedContentVersion: string;
}
export interface ModerationApi {
	list(query: ModerationQuery, signal: AbortSignal): Promise<ModerationPage>;
	show(target: Pick<ModerationEntry, 'targetType' | 'targetId'>, signal: AbortSignal): Promise<ModerationDetail>;
	review(review: ModerationReview): Promise<ModerationDetail>;
}

export const moderationCategories = [
	{ value: 'all', get label() { return i18n.ts._hata._hatady._media.all; }, icon: 'ti ti-layout-grid' },
	{ value: 'collection', get label() { return i18n.ts._hata._hatady._media.collection; }, icon: 'ti ti-books' },
	{ value: 'record', get label() { return i18n.ts._hata._hatady._home.logs; }, icon: 'ti ti-notebook' },
	{ value: 'comment', get label() { return i18n.ts._hata._hatady._notifications.filterComment; }, icon: 'ti ti-message-circle' },
	{ value: 'reaction', get label() { return i18n.ts._hata._hatady._notifications.filterReaction; }, icon: 'ti ti-mood-plus' },
] as const;
export const moderationStatuses = [
	{ value: 'unreviewed', get label() { return i18n.ts._hata._hatady._moderationView.unreviewed; }, icon: 'ti ti-eye' },
	{ value: 'flagged', get label() { return i18n.ts._hata._hatady._moderationView.flagged; }, icon: 'ti ti-flag' },
	{ value: 'reviewed', get label() { return i18n.ts._hata._hatady._moderationView.reviewed; }, icon: 'ti ti-circle-check' },
] as const;
export const moderationActivities = [
	{ value: 'study', get label() { return i18n.ts._hata._hatady._activityKinds.study; } },
	{ value: 'movie', get label() { return i18n.ts._hata._hatady._profile.movie; } },
	{ value: 'game', get label() { return i18n.ts._hata._hatady._profile.game; } },
	{ value: 'exercise', get label() { return i18n.ts._hata._hatady._activityKinds.exercise; } },
	{ value: 'work', get label() { return i18n.ts._hata._hatady._activityKinds.work; } },
	{ value: 'cooking', get label() { return i18n.ts._hata._hatady._activityKinds.cooking; } },
] as const;
export const moderationVisibilities = {
	public: { get label() { return i18n.ts._hata._hatady._home.activityPublic; }, icon: 'ti ti-world' },
	followers: { get label() { return i18n.ts._hata._hatady._moderationView.followersOnly; }, icon: 'ti ti-users' },
	private: { get label() { return i18n.ts._hata._hatady._home.activityPrivate; }, icon: 'ti ti-lock' },
} as const;

export function moderationCategory(category: ModerationCategory) {
	return moderationCategories.find(option => option.value === category) ?? moderationCategories[0];
}

export function moderationStatus(status: ModerationStatus) {
	return moderationStatuses.find(option => option.value === status) ?? moderationStatuses[0];
}

export function moderationDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString(versatileLang, {
		year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
	});
}

export function moderationDateBounds(from: string, to: string): { since?: number; until?: number } {
	const bounds: { since?: number; until?: number } = {};
	if (from) bounds.since = new Date(`${from}T00:00:00`).getTime();
	if (to) {
		const end = new Date(`${to}T00:00:00`);
		end.setDate(end.getDate() + 1);
		bounds.until = end.getTime() - 1;
	}
	return bounds;
}

const moderationApi: ModerationApi = {
	list: (query, signal) => misskeyApi<ModerationPage>('hata/hatady/admin/moderation/list', query, undefined, signal),
	show: (target, signal) => misskeyApi<ModerationDetail>('hata/hatady/admin/moderation/show', target, undefined, signal),
	review: review => misskeyApi<ModerationDetail>('hata/hatady/admin/moderation/review', review),
};

function errorCode(error: unknown): string {
	return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}

/** A component-local controller: drafts survive selection/filter changes, never enter cloud preferences. */
export function useHatadyModeration(access: Readonly<Ref<string | null>>, api: ModerationApi = moderationApi) {
	const filters = reactive({ category: 'all' as ModerationCategory | 'all', status: 'all' as ModerationStatus | 'all', activity: 'all' as ModerationActivity | 'all', visibility: 'all' as ModerationVisibility | 'all', query: '', from: '', to: '', sort: 'desc' as 'asc' | 'desc' });
	const items = ref<ModerationEntry[]>([]);
	const counts = ref<Record<ModerationStatus, number>>({ unreviewed: 0, flagged: 0, reviewed: 0 });
	const total = ref(0);
	const loading = ref(false), error = ref('');
	const selected = ref<ModerationEntry | null>(null);
	const detail = ref<ModerationDetail | null>(null);
	const detailLoading = ref(false), detailError = ref('');
	const drafts = reactive(new Map<string, string>());
	const saveErrors = reactive(new Map<string, string>());
	const savingKey = ref<string | null>(null);
	const page = ref(0), nextCursor = ref<string | null>(null);
	let cursors: Array<string | undefined> = [undefined];
	let timer: number | undefined;
	let listRequest: AbortController | undefined, detailRequest: AbortController | undefined;
	let listGeneration = 0, detailGeneration = 0, accessGeneration = 0, disposed = false;
	const dateError = computed(() => Boolean(filters.from && filters.to && filters.from > filters.to));
	const note = computed({
		get: () => detail.value ? drafts.get(detail.value.item.key) ?? detail.value.item.review.note : '',
		set: (value: string) => { if (detail.value) drafts.set(detail.value.item.key, value); },
	});
	const saveError = computed(() => selected.value ? saveErrors.get(selected.value.key) ?? '' : '');
	const saving = computed(() => savingKey.value !== null);

	function valid(owner: string | null): boolean {
		return !disposed && owner !== null && access.value === owner;
	}

	async function select(entry: ModerationEntry, keepError = false): Promise<void> {
		const owner = access.value;
		if (!valid(owner)) return;
		const generation = ++detailGeneration;
		detailRequest?.abort();
		detailRequest = new AbortController();
		selected.value = entry;
		detail.value = null;
		detailError.value = '';
		if (!keepError) saveErrors.delete(entry.key);
		detailLoading.value = true;
		try {
			const result = await api.show({ targetType: entry.targetType, targetId: entry.targetId }, detailRequest.signal);
			if (!valid(owner) || generation !== detailGeneration) return;
			detail.value = result;
			selected.value = result.item;
		} catch (cause) {
			if (!valid(owner) || generation !== detailGeneration) return;
			detailError.value = errorCode(cause) === 'NO_SUCH_TARGET' ? i18n.ts._hata._hatady._moderationView.deletedContent : i18n.ts._hata._hatady._moderationView.detailLoadFailed;
		} finally {
			if (valid(owner) && generation === detailGeneration) detailLoading.value = false;
		}
	}

	async function load(preserveSelection = false): Promise<void> {
		window.clearTimeout(timer);
		const owner = access.value;
		const generation = ++listGeneration;
		listRequest?.abort();
		if (!valid(owner) || dateError.value) { loading.value = false; return; }
		listRequest = new AbortController();
		loading.value = true;
		error.value = '';
		try {
			const result = await api.list({ limit: 30, cursor: cursors[page.value], category: filters.category, status: filters.status, activity: filters.activity, visibility: filters.visibility, query: filters.query.trim(), sort: filters.sort, ...moderationDateBounds(filters.from, filters.to) }, listRequest.signal);
			if (!valid(owner) || generation !== listGeneration) return;
			items.value = result.items;
			counts.value = result.counts;
			total.value = result.total;
			nextCursor.value = result.nextCursor;
			if (!preserveSelection) {
				++detailGeneration;
				detailRequest?.abort();
				detailLoading.value = false;
				detailError.value = '';
				if (result.items[0]) void select(result.items[0]);
				else { selected.value = null; detail.value = null; }
			}
		} catch {
			if (valid(owner) && generation === listGeneration) error.value = i18n.ts._hata._hatady._moderationView.listLoadFailed;
		} finally {
			if (valid(owner) && generation === listGeneration) loading.value = false;
		}
	}

	function schedule(delay: number): void {
		window.clearTimeout(timer);
		++listGeneration;
		++detailGeneration;
		listRequest?.abort();
		detailRequest?.abort();
		page.value = 0;
		cursors = [undefined];
		nextCursor.value = null;
		items.value = [];
		total.value = 0;
		selected.value = null;
		detail.value = null;
		detailLoading.value = false;
		detailError.value = '';
		error.value = '';
		loading.value = Boolean(access.value) && !dateError.value;
		if (loading.value) timer = window.setTimeout(() => { void load(); }, delay);
	}

	function movePage(direction: -1 | 1): void {
		if (loading.value || !valid(access.value)) return;
		if (direction === 1) {
			if (!nextCursor.value) return;
			cursors[page.value + 1] = nextCursor.value;
		} else if (page.value === 0) return;
		page.value += direction;
		++detailGeneration;
		detailRequest?.abort();
		selected.value = null;
		detail.value = null;
		detailLoading.value = false;
		void load();
	}

	async function save(state: ModerationStatus): Promise<void> {
		const owner = access.value, current = detail.value;
		const ownerGeneration = accessGeneration;
		if (!valid(owner) || !current || saving.value) return;
		const item = current.item, submittedNote = note.value;
		if (Array.from(submittedNote).length > 1000) { saveErrors.set(item.key, i18n.ts._hata._hatady._moderationView.memoTooLong); return; }
		savingKey.value = item.key;
		saveErrors.delete(item.key);
		try {
			const result = await api.review({ targetType: item.targetType, targetId: item.targetId, state, note: submittedNote, expectedRevision: item.review.revision, expectedContentVersion: item.contentVersion });
			if (!valid(owner) || ownerGeneration !== accessGeneration) return;
			if (drafts.get(item.key) === submittedNote) drafts.delete(item.key);
			if (selected.value?.key === item.key) {
				++detailGeneration;
				detailRequest?.abort();
				detailLoading.value = false;
				detailError.value = '';
				detail.value = result;
				selected.value = result.item;
			}
			items.value = items.value.map(row => row.key === item.key ? result.item : row);
			hatadyNotify(i18n.ts._hata._hatady._moderationView.saved);
			void load(true);
		} catch (cause) {
			if (!valid(owner) || ownerGeneration !== accessGeneration) return;
			if (!drafts.has(item.key)) drafts.set(item.key, submittedNote);
			if (errorCode(cause) === 'REVIEW_CONFLICT') {
				saveErrors.set(item.key, i18n.ts._hata._hatady._moderationView.reviewConflict);
				if (selected.value?.key === item.key) await select(item, true);
			} else {
				saveErrors.set(item.key, errorCode(cause) === 'NO_SUCH_TARGET' ? i18n.ts._hata._hatady._moderationView.deletedWithMemo : i18n.ts._hata._hatady._moderationView.saveFailed);
			}
		} finally {
			if (valid(owner) && ownerGeneration === accessGeneration) savingKey.value = null;
		}
	}

	function reset(): void {
		Object.assign(filters, { category: 'all', status: 'all', activity: 'all', visibility: 'all', query: '', from: '', to: '', sort: 'desc' });
		schedule(0);
	}

	watch(() => filters.query, () => schedule(300), { flush: 'sync' });
	watch(() => [filters.category, filters.status, filters.activity, filters.visibility, filters.from, filters.to, filters.sort], () => schedule(0), { flush: 'sync' });
	watch(access, () => {
		++accessGeneration;
		drafts.clear();
		saveErrors.clear();
		savingKey.value = null;
		counts.value = { unreviewed: 0, flagged: 0, reviewed: 0 };
		schedule(0);
	}, { immediate: true, flush: 'sync' });
	onScopeDispose(() => {
		disposed = true;
		window.clearTimeout(timer);
		listRequest?.abort();
		detailRequest?.abort();
	});
	return { filters, items, counts, total, loading, error, selected, detail, detailLoading, detailError, note, saveError, saving, page, nextCursor, dateError, select, load, save, reset, movePage };
}
