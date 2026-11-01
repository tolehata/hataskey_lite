/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { normalizeHataskPlannerData } from '@/utility/hatask-planner-storage.js';
import type { Endpoints } from 'cherrypick-js';
import { expandHataskEventOccurrences, toLocalDateKey } from '@/utility/hatask-planner-recurrence.js';
import { selectJournalEntries } from '@/utility/hatask-journal.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { getHataskFlowerState } from '@/utility/hatask-flower-v2.js';
import { hatadyTzOffset } from '@/utility/hatady-prefs.js';
import type { HataskPlannerTodo } from '@/utility/hatask-planner-storage.js';
import type { HataskEventOccurrence } from '@/utility/hatask-planner-recurrence.js';
import type { HatadyActivity } from '@/utility/hatady-media.js';

export type HatagoesHomeCardId = 'schedule' | 'todo' | 'flower' | 'mood' | 'meal' | 'reading' | 'issues' | 'community' | 'roadmap';
export type HatagoesHomeRow = { id: string; title: string; detail?: string; path: string; priority?: HataskPlannerTodo['priority']; due?: string; author?: string | null; currentPage?: number; totalPages?: number | null; progress?: number | null; coverColorIndex?: number | null; status?: string; category?: string; agreementsCount?: number; commentsCount?: number };
export type HatagoesHomeEvent = { id: string; title: string; path: string; date: string; timeStart?: string; timeEnd?: string; allDay: boolean; startsAt?: number; endsAt?: number };
export type HatagoesHomeData = { rows: HatagoesHomeRow[]; summary?: string; total?: number; currentEvent?: HatagoesHomeEvent; nextEvent?: HatagoesHomeEvent; flower?: { emoji: string; name: string; progress: number; drops: number; canWater: boolean; pourMinutes?: number; harvestedCount: number }; journal?: { todayCount: number; latestToday?: HatagoesHomeRow; mealSlots?: number }; source?: 'mine' | 'recent'; unavailable?: boolean };
export type HatagoesHomeSource = 'planner' | 'flower' | 'mood' | 'meal' | 'reading' | 'issues' | 'stats';
export const HATAGOES_HOME_TITLES: Record<HatagoesHomeCardId, string> = {
	schedule: '予定', todo: '優先 ToDo', flower: 'おはな', mood: 'きもち', meal: 'ごはん', reading: '読みかけ', issues: 'イシュー', community: 'Hatady コミュニティ', roadmap: 'HataFeed ロードマップ',
};
export const HATAGOES_HOME_PATHS: Record<HatagoesHomeCardId, string> = {
	schedule: '/hatask?tab=cal', todo: '/hatask?tab=todo', flower: '/hatask?tab=garden', mood: '/hatask?tab=mood',
	meal: '/hatask?tab=meal', reading: '/hatady?tab=collection', issues: '/hatafeed?tab=issues', community: '/hatady?tab=records&hgScope=recent', roadmap: '/hatafeed?tab=roadmap',
};

const scope = ['client', 'hatask'];
const issueStatusLabel: Record<string, string> = { open: '受付中', planned: '対応予定', inProgress: '対応中', nextFixConfirmed: '次回修正確定', nextFixPlanned: '次回修正予定', monitoring: '修正監視中', resolved: '解決済み', wontfix: '対応見送り', unknown: '確認中', closed: '終了' };
const issueCategoryLabel: Record<string, string> = { bug: '不具合', improvement: '改善', unresolved: '質問', featureRequest: '要望', adoptionRequest: '採用依頼', security: 'セキュリティ', betaFeature: 'ベータ機能', other: 'その他' };
type PlannerCollection = { exists: boolean; value?: unknown };
type PlannerSnapshot = { collections: { events: PlannerCollection; todos: PlannerCollection } };
type HomeIssuesResponse = Endpoints['hata/hatagoes/home/issues']['res'];

function record(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function missing(error: unknown): boolean { return (error as { code?: string } | null)?.code === 'NO_SUCH_KEY'; }

function rows(value: unknown): unknown[] {
	if (!Array.isArray(value)) throw new TypeError('保存データの形式を読み取れませんでした');
	return value;
}

function issueRows(value: unknown): Array<{ id: string; title: string; number?: number; status?: string; category?: string; agreementsCount?: number; commentsCount?: number }> {
	const list = rows(value);
	const valid = (item: unknown): item is { id: string; title: string; number?: number; status?: string; category?: string; agreementsCount?: number; commentsCount?: number } => typeof record(item)?.id === 'string' && typeof record(item)?.title === 'string';
	if (!list.every(valid)) throw new TypeError('イシューの一覧を読み取れませんでした');
	return list;
}

function validTime(value: string | undefined): number | null {
	if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

function eventView(event: HataskEventOccurrence): HatagoesHomeEvent {
	const path = `/hatask?tab=cal&hgKind=event&hgId=${encodeURIComponent(event.sourceEventId)}`;
	const start = validTime(event.timeStart);
	const end = validTime(event.timeEnd);
	const date = event.date;
	const startDate = start == null ? undefined : new Date(`${date}T00:00:00`).getTime() + start * 60000;
	const endDate = start == null || startDate == null || end == null || end <= start ? undefined : new Date(`${date}T00:00:00`).getTime() + end * 60000;
	return { id: event.id, title: event.title, path, date, timeStart: event.timeStart, timeEnd: event.timeEnd, allDay: event.allDay, startsAt: startDate, endsAt: endDate };
}

function scheduleDetail(event: HatagoesHomeEvent, today: string): string {
	return `${event.date === today ? '今日' : event.date}${event.allDay || !event.timeStart ? ' · 終日' : ` · ${event.timeStart}${event.timeEnd ? `–${event.timeEnd}` : ''}`}`;
}

export function buildHatagoesPlannerHome(eventRows: unknown[], todoRows: unknown[], now = new Date()): { schedule: HatagoesHomeData; todo: HatagoesHomeData } {
	const normalized = normalizeHataskPlannerData({ events: eventRows, todos: todoRows, folders: [] });
	if (normalized.issues.some(issue => issue.code === 'item-not-object' || issue.code === 'invalid-id' || issue.code === 'collection-not-array')) {
		throw new TypeError('予定と ToDo の保存データを読み取れませんでした');
	}
	const today = toLocalDateKey(now);
	const through = new Date(now);
	through.setDate(through.getDate() + 30);
	const events = expandHataskEventOccurrences(normalized.data.events, today, toLocalDateKey(through)).map(eventView);
	const currentEvent = events.find(event => event.startsAt != null && event.endsAt != null && event.startsAt <= now.getTime() && now.getTime() < event.endsAt);
	const upcoming = events.filter(event => event.id !== currentEvent?.id && (event.date > today || event.allDay || event.endsAt == null && event.startsAt == null || event.endsAt != null && event.endsAt > now.getTime() || event.startsAt != null && event.startsAt > now.getTime()));
	const schedule = upcoming.slice(0, 4).map(event => ({ id: event.id, title: event.title, detail: scheduleDetail(event, today), path: event.path }));
	const priority = { high: 0, medium: 1, low: 2, none: 3 } as const;
	const activeTodos = normalized.data.todos.filter(item => !item.done && item.archivedAt == null)
		.sort((a, b) => (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.position - b.position);
	const todo = activeTodos.slice(0, 4).map(item => ({
		id: item.id, title: item.text, priority: item.priority, due: item.due,
		detail: item.due ? item.due < today ? `期限切れ · ${item.due}` : item.due === today ? '今日まで' : `${item.due} まで` : undefined,
		path: `/hatask?tab=todo&hgKind=todo&hgId=${encodeURIComponent(item.id)}`,
	}));
	return { schedule: { rows: schedule, total: upcoming.length + (currentEvent ? 1 : 0), currentEvent, nextEvent: upcoming[0] }, todo: { rows: todo, total: activeTodos.length } };
}

async function registryRows(key: string): Promise<unknown[]> {
	try { return rows(await misskeyApi('i/registry/get', { key, scope })); } catch (error) { if (missing(error)) return []; throw error; }
}

export async function loadHatagoesPlanner(now = new Date()): Promise<{ schedule: HatagoesHomeData; todo: HatagoesHomeData }> {
	const snapshot = await misskeyApi('hatask/planner/get', {}) as unknown as PlannerSnapshot;
	if (snapshot?.collections == null) throw new TypeError('予定と ToDo の保存状態を読み取れませんでした');
	const getCollection = async (key: 'events' | 'todos'): Promise<unknown[]> => {
		const collection = snapshot.collections[key];
		if (collection == null) throw new TypeError('予定と ToDo の保存状態を読み取れませんでした');
		// A not-yet-migrated account may still keep its original Registry rows.
		return collection.exists ? rows(collection.value) : registryRows(key);
	};
	const [eventRows, todoRows] = await Promise.all([getCollection('events'), getCollection('todos')]);
	return buildHatagoesPlannerHome(eventRows, todoRows, now);
}

export async function loadHatagoesFlower(): Promise<HatagoesHomeData> {
	const state = await getHataskFlowerState();
	return { summary: `${state.flower.emoji} ${state.flower.name}`, rows: [], flower: { emoji: state.flower.emoji, name: state.flower.name, progress: state.flower.progress, drops: state.drops, canWater: state.drops > 0 && state.flower.progress < 100, pourMinutes: state.rules.pourMinutes, harvestedCount: state.zukan.entries.length } };
}

export async function loadHatagoesJournal(kind: 'mood' | 'meal', now = new Date()): Promise<HatagoesHomeData> {
	const entries = selectJournalEntries(await registryRows(kind === 'mood' ? 'moods' : 'meals'), kind);
	const todayEntries = entries.filter(entry => entry.date === toLocalDateKey(now));
	const displayRows = entries.slice(0, 3).map(entry => ({
		id: entry.id,
		title: kind === 'mood' ? `${entry.emoji ?? '●'} ${entry.note?.trim() || 'きもちの記録'}` : `${entry.emoji ?? '●'} ${entry.note?.trim() || '食事の記録'}`,
		detail: `${entry.date} ${entry.time}`,
		path: `${HATAGOES_HOME_PATHS[kind]}&hgKind=${kind}&hgId=${encodeURIComponent(entry.id)}`,
	}));
	const latestToday = displayRows.find(row => todayEntries.some(entry => entry.id === row.id));
	const mealSlots = kind === 'meal' ? new Set(todayEntries.filter(entry => entry.level !== 'none' && entry.slot !== 'snack').map(entry => entry.slot)).size : undefined;
	return { rows: displayRows, journal: { todayCount: todayEntries.length, latestToday, mealSlots } };
}

export async function loadHatagoesReading(): Promise<HatagoesHomeData> {
	const books = rows(await misskeyApi('hata/hatady/books', { scope: 'mine', status: 'reading', limit: 100 }));
	return { total: books.length, rows: books.filter((book): book is { id: string; title: string; author?: string | null; currentPage?: number; totalPages?: number | null; progress?: number | null; coverColorIndex?: number | null } => typeof record(book)?.id === 'string' && typeof record(book)?.title === 'string').slice(0, 4)
		.map(book => ({ id: book.id, title: book.title, author: book.author, currentPage: book.currentPage, totalPages: book.totalPages, progress: book.progress, coverColorIndex: book.coverColorIndex, path: `/hatady?tab=collection&hgKind=book&hgId=${encodeURIComponent(book.id)}` })) };
}

export async function loadHatagoesIssues(): Promise<HatagoesHomeData> {
	let result: HomeIssuesResponse;
	try { result = await misskeyApi('hata/hatagoes/home/issues', {}); } catch (error) {
		if ((error as { code?: string } | null)?.code === 'HATAFEED_ACCESS_DENIED') return { rows: [], unavailable: true, summary: 'HataFeed を利用できるアカウントで表示されます。' };
		throw error;
	}
	const selected = issueRows(result.issues);
	return {
		summary: result.source === 'mine' ? 'あなたのイシュー' : '新しいイシュー', source: result.source,
		rows: selected.map(issue => ({
			id: issue.id, title: issue.title, status: issue.status, category: issue.category, agreementsCount: issue.agreementsCount, commentsCount: issue.commentsCount,
			detail: [`#${issue.number ?? '—'}`, issue.status ? issueStatusLabel[issue.status] ?? issue.status : null, issue.category ? issueCategoryLabel[issue.category] ?? issue.category : null].filter(Boolean).join(' · '), path: `/hatafeed/${encodeURIComponent(issue.id)}`,
		})),
	};
}

export async function loadHatagoesCommunity(): Promise<HatagoesHomeData> {
	const response: unknown = await misskeyApi('hata/hatady/activities' as never, { scope: 'recent', limit: 4 } as never);
	const page = record(response);
	const items = page?.items;
	if (!Array.isArray(items) || typeof page?.hasMore !== 'boolean' || page.hasMore && typeof page.nextCursor !== 'string') throw new TypeError('コミュニティの記録を読み取れませんでした');
	const valid = (item: unknown): item is HatadyActivity => {
		const row = record(item);
		const study = record(row?.study);
		const media = record(row?.media);
		const session = record(media?.session);
		return typeof row?.id === 'string' && typeof row.occurredAt === 'string' && (typeof study?.id === 'string' || typeof session?.id === 'string');
	};
	if (!items.every(valid)) throw new TypeError('コミュニティの記録を読み取れませんでした');
	const activities = items as HatadyActivity[];
	return { rows: activities.map(activity => {
		const isLog = activity.study != null;
		const targetId = isLog ? String(activity.study?.id) : String(activity.media?.session.id);
		const kind = isLog ? 'log' : 'session';
		const owner = activity.user?.name || activity.user?.username;
		const title = activity.study?.title ?? activity.media?.work?.title ?? activity.media?.session.workSnapshot?.title;
		const date = new Date(activity.occurredAt);
		return { id: activity.id, title: typeof title === 'string' && title.trim() ? title : '記録', detail: [owner, Number.isFinite(date.getTime()) ? date.toLocaleDateString('ja-JP') : null].filter(Boolean).join(' · '), path: `/hatady?tab=records&hgKind=${kind}&hgId=${encodeURIComponent(targetId)}` };
	}) };
}

export async function loadHatagoesRoadmap(): Promise<HatagoesHomeData> {
	try {
		const issues = issueRows(await misskeyApi('hata/feedback/issues', { projectId: null, category: 'improvement', includeClosed: false, limit: 4 }));
		return { rows: issues
			.map(issue => ({ id: issue.id, title: issue.title, status: issue.status, detail: [`#${issue.number ?? '—'}`, issue.status ? issueStatusLabel[issue.status] ?? issue.status : null].filter(Boolean).join(' · '), path: `/hatafeed/${encodeURIComponent(issue.id)}` })) };
	} catch (error) {
		if ((error as { code?: string } | null)?.code === 'HATAFEED_ACCESS_DENIED') return { rows: [], unavailable: true, summary: 'HataFeed を利用できるアカウントで表示されます。' };
		throw error;
	}
}

export async function loadHatagoesStats(): Promise<number> {
	const result = await misskeyApi('hata/hatady/stats', { tzOffset: hatadyTzOffset() });
	const days = record(result)?.streakDays;
	if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) throw new TypeError('連続記録を読み取れませんでした');
	return days;
}
