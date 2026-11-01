/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyActivity, HatadyLogKind, HatadyMediaWork } from '@/utility/hatady-media.js';
import { HATADY_LOG_KINDS } from '@/utility/hatady-media.js';
import { hatadySeconds } from '@/utility/hatady-ui.js';

export type HatadyHomeWork = {
	id: string;
	kind: 'book' | 'movie' | 'game' | 'work';
	title: string;
	creator: string;
	genre: string;
	description: string;
	mine: boolean;
	recommended: boolean;
	colorIndex?: number | null;
	status: string;
	raw: Record<string, any>;
};
/** Read-only sample data for introductions. Supplying it disables home requests. */
export type HatadyHomePreview = {
	now: Date;
	viewerId: string;
	rows: HatadyActivity[];
	communityRows: HatadyActivity[];
	works: HatadyHomeWork[];
};
export function activityKind(activity: HatadyActivity): HatadyLogKind {
	return activity.study
		? (activity.study.kind ?? (activity.type === 'exercise' || activity.type === 'work' || activity.type === 'cooking' ? activity.type : 'study'))
		: activity.type === 'movie_viewing'
			? 'movie'
			: 'game';
}
export function activityData(activity: HatadyActivity) {
	const log = activity.study,
		media = activity.media,
		snapshot = media?.session.workSnapshot;
	return {
		id: activity.id,
		kind: activityKind(activity),
		occurredAt: activity.occurredAt,
		title: String(log?.title || media?.work?.title || snapshot?.title || ''),
		genre: String(log?.subject || media?.work?.details?.genre || media?.work?.genres?.[0] || snapshot?.genre || ''),
		body: String(log?.body || media?.session.note || ''),
		tags: (log?.tags ?? (log?.tag ? [log.tag] : undefined) ?? media?.session.tags ?? []) as string[],
		seconds: hatadySeconds(log ?? media?.session ?? {}),
		workId: log?.bookId ?? log?.mediaWorkId ?? media?.session.workId ?? null,
		calories: log?.details?.calories == null ? null : Number(log.details.calories),
	};
}
export function homeWork(
	value: Record<string, any> | HatadyMediaWork,
	mine: boolean,
	kind: HatadyHomeWork['kind'],
): HatadyHomeWork {
	return {
		id: value.id,
		kind,
		title: value.title,
		creator: value.author || value.creator || value.developer || '',
		genre: value.details?.genre || value.genres?.[0] || '',
		description: value.details?.description || (value.synopsisSpoiler ? '' : value.synopsis) || '',
		mine,
		recommended: !!value.isRecommended,
		colorIndex: value.coverColorIndex,
		status: kind === 'work' && value.activity?.tags?.includes('doneAll') ? 'completed' : value.status,
		raw: value,
	};
}
export function localDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function homePeriod(now = new Date()) {
	const since = new Date(now);
	since.setDate(since.getDate() - 29);
	since.setHours(0, 0, 0, 0);
	const until = new Date(now);
	until.setHours(23, 59, 59, 999);
	const week = new Date(now);
	week.setDate(week.getDate() - 6);
	week.setHours(0, 0, 0, 0);
	return { since: since.getTime(), until: until.getTime(), week: week.getTime() };
}
/** Input must cover the entire requested interval, not just the first list page. */
export function summarizeHome(activities: HatadyActivity[], now = new Date(), hasOlder = false) {
	const period = homePeriod(now);
	const recent = activities
		.filter(
			(row) =>
				Number.isFinite(Date.parse(row.occurredAt)) &&
				Date.parse(row.occurredAt) >= period.since &&
				Date.parse(row.occurredAt) <= period.until,
		)
		.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
	const week = recent.filter((row) => Date.parse(row.occurredAt) >= period.week);
	// 料理は Hatask のレシピから記録され、ホームの注目パネルにはまだ専用の見せ方が無いため順位付けに入れない。
	const ranked = HATADY_LOG_KINDS.filter((kind) => kind !== 'cooking').map((kind) => {
		const rows = recent.filter((row) => activityKind(row) === kind),
			weekCount = week.filter((row) => activityKind(row) === kind).length;
		return {
			kind,
			rows,
			count: rows.length,
			weekCount,
			score: rows.length + weekCount,
			days: new Set(rows.map((row) => localDateKey(new Date(row.occurredAt)))).size,
		};
	}).sort(
		(a, b) =>
			b.score - a.score ||
			b.weekCount - a.weekCount ||
			(b.rows[0]?.occurredAt ?? '').localeCompare(a.rows[0]?.occurredAt ?? ''),
	);
	const total = ranked.reduce((n, row) => n + row.score, 0),
		top = ranked[0];
	const monthLeader = [...ranked].sort((a, b) => b.count - a.count)[0],
		weekLeader = [...ranked].sort((a, b) => b.weekCount - a.weekCount)[0];
	const primary = recent.length >= 3 && top.count >= 3 && top.score / total >= 0.55 ? top.kind : null;
	const emerging =
		week.length >= 3 &&
		weekLeader.weekCount >= 2 &&
		weekLeader.weekCount / week.length >= 0.5 &&
		weekLeader.kind !== monthLeader.kind
			? weekLeader.kind
			: null;
	return {
		recent,
		week,
		ranked,
		primary,
		emerging,
		mode: !recent.length
			? hasOlder
				? 'quiet'
				: 'new'
			: recent.length < 3
				? 'starting'
				: primary
					? 'focused'
					: 'mixed',
	};
}

/** Reject incomplete/repeating pages so callers cannot present partial counts as totals. */
export async function collectActivityPages(
	fetchPage: (cursor?: string) => Promise<{ items: HatadyActivity[]; nextCursor: string | null; hasMore: boolean }>,
): Promise<HatadyActivity[]> {
	const rows = new Map<string, HatadyActivity>(),
		cursors = new Set<string>();
	let cursor: string | undefined;
	for (;;) {
		const page = await fetchPage(cursor);
		for (const row of page.items) rows.set(row.id, row);
		if (!page.hasMore) return [...rows.values()];
		if (!page.nextCursor || cursors.has(page.nextCursor)) throw new Error('Incomplete Hatady activity page');
		cursors.add(page.nextCursor);
		cursor = page.nextCursor;
	}
}
export async function collectWorkPages<T extends { id: string }>(
	fetchPage: (untilId?: string) => Promise<T[]>,
): Promise<T[]> {
	const rows = new Map<string, T>(),
		cursors = new Set<string>();
	let untilId: string | undefined;
	for (;;) {
		const page = await fetchPage(untilId);
		if (!Array.isArray(page) || page.length > 100 || page.some((row) => !row || typeof row.id !== 'string')) throw new Error('Invalid Hatady collection page');
		for (const row of page) rows.set(row.id, row);
		if (page.length < 100) return [...rows.values()];
		untilId = page.at(-1)!.id;
		if (cursors.has(untilId)) throw new Error('Incomplete Hatady collection page');
		cursors.add(untilId);
	}
}
