/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { HATASK_REVIEW_STATES } from '@/models/HataskRecordReview.js';
import type { HataskReviewState } from '@/models/HataskRecordReview.js';
import type { Packed } from '@/misc/json-schema.js';
import { ApiError } from '@/server/api/error.js';

export const HATASK_RECORD_KINDS = ['event', 'todo', 'mood', 'meal', 'flower'] as const;
export const HATASK_RECORD_VISIBILITIES = ['private', 'specified', 'public', 'followers'] as const;
export type HataskRecordKind = typeof HATASK_RECORD_KINDS[number];
export const HATASK_REVIEW_ERRORS = {
	denied: { message: 'Moderator access with a first-party session is required.', code: 'HATASK_REVIEW_ACCESS_DENIED', id: '345ad3a0-26f0-4d4c-89a3-d49b18b2a160', kind: 'permission' },
	missing: { message: 'This record no longer exists.', code: 'NO_SUCH_HATASK_RECORD', id: 'b14d831b-0b22-4b45-a4ed-c9540a89b921' },
	conflict: { message: 'The record or its review has changed. Reload before reviewing.', code: 'HATASK_REVIEW_CONFLICT', id: '4cd3b606-d21d-4712-9997-7880518172a0' },
	invalid: { message: 'Invalid record filter or review.', code: 'INVALID_HATASK_REVIEW', id: '50bbd82c-9f19-4451-94b4-0ce1ff275cd7' },
} as const;
export type HataskReviewOptions = {
	query?: string; kind?: 'all' | HataskRecordKind; state?: 'all' | HataskReviewState;
	visibility?: 'all' | typeof HATASK_RECORD_VISIBILITIES[number]; userId?: string | null;
	dateFrom?: string | null; dateTo?: string | null; sort?: 'newest' | 'oldest'; limit?: number; cursor?: string | null;
};
export function normalizeReviewOptions(input: HataskReviewOptions) {
	const value = { query: (input.query ?? '').trim().normalize('NFKC'), kind: input.kind ?? 'all', state: input.state ?? 'all', visibility: input.visibility ?? 'all', userId: input.userId ?? null, dateFrom: input.dateFrom || null, dateTo: input.dateTo || null, sort: input.sort ?? 'newest', limit: input.limit ?? 30 };
	const validDate = (date: string | null) => date == null || /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
	if (!['all', ...HATASK_RECORD_KINDS].includes(value.kind) || !['all', ...HATASK_REVIEW_STATES].includes(value.state)
		|| !['all', ...HATASK_RECORD_VISIBILITIES].includes(value.visibility) || !['newest', 'oldest'].includes(value.sort)
		|| value.query.length > 200 || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 50
		|| value.userId != null && !/^[a-zA-Z0-9]{1,32}$/.test(value.userId)
		|| !validDate(value.dateFrom) || !validDate(value.dateTo) || value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) throw new ApiError(HATASK_REVIEW_ERRORS.invalid);
	return value;
}
export const reviewHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type ReviewCursor = { filter: string; date: string; time: string; id: string };
export function decodeReviewCursor(value: string | null | undefined, filter: string): ReviewCursor | null {
	if (!value) return null;
	try {
		if (!/^[A-Za-z0-9_-]{1,1024}$/.test(value)) throw new Error();
		const cursor = JSON.parse(Buffer.from(value, 'base64url').toString()) as ReviewCursor;
		if (cursor.filter !== filter || !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) || !/^(?:\d{2}:\d{2})?$/.test(cursor.time) || !/^[a-f0-9]{64}$/.test(cursor.id)) throw new Error();
		return cursor;
	} catch { throw new ApiError(HATASK_REVIEW_ERRORS.invalid); }
}

// Exact Hatask scope only: no preferences, planner backups or unrelated registries.
// Merge duplicate legacy planner IDs in the same order as planner/_shared.ts.
// Anonymous/malformed entries remain inspectable instead of disappearing.
export const HATASK_REVIEW_CTE = `WITH expanded AS (
	SELECT r."userId", r.key, r.id AS registry_id, r."updatedAt", e.ordinality,
		CASE WHEN jsonb_typeof(e.value->'id')='string' AND e.value->>'id'<>'' THEN 'id:' || (e.value->>'id')
			WHEN r.key='flower' THEN 'growing' ELSE r.id || ':' || e.ordinality::text END AS entry_id,
		CASE WHEN jsonb_typeof(e.value)='object' THEN e.value ELSE jsonb_build_object('_unparsed',e.value) END AS data
	FROM registry_item r CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(r.value)='array' THEN r.value ELSE jsonb_build_array(r.value) END
	) WITH ORDINALITY e(value,ordinality)
	WHERE r.domain IS NULL AND r.scope=ARRAY['client','hatask']::varchar[]
		AND r.key IN ('events','todos','moods','meals','flower','gallery') AND r.value IS NOT NULL AND r.value<>'null'::jsonb
), local_records AS (
	SELECT e."userId", e.key, e.entry_id, max(e."updatedAt") AS saved_at,
		jsonb_object_agg(f.key,f.value ORDER BY e."updatedAt",e.registry_id,e.ordinality) AS data
	FROM expanded e CROSS JOIN LATERAL jsonb_each(CASE WHEN e.data='{}'::jsonb THEN jsonb_build_object('_unparsed',e.data) ELSE e.data END) f GROUP BY e."userId",e.key,e.entry_id
), sources AS (
	SELECT l."userId", l.key, l.entry_id, l.saved_at,
		l.data || CASE WHEN ev.id IS NOT NULL THEN to_jsonb(ev) - 'userId' || jsonb_build_object('localRecord',l.data)
			WHEN fl.id IS NOT NULL THEN to_jsonb(fl) - 'userId' || jsonb_build_object('localRecord',l.data) ELSE '{}'::jsonb END AS data,
		CASE WHEN ev.id IS NOT NULL THEN ev.visibility WHEN fl.id IS NOT NULL THEN COALESCE(p."hataskFlowerVisibility",'private') ELSE 'private' END AS visibility
	FROM local_records l
	LEFT JOIN hatask_event ev ON l.key='events' AND ev."userId"=l."userId" AND ev.id=l.data->>'serverEventId'
	LEFT JOIN hatask_flower fl ON l.key='gallery' AND fl."userId"=l."userId" AND fl."clientFlowerId"=l.data->>'id'
	LEFT JOIN user_profile p ON fl."userId"=p."userId"
	UNION ALL
	SELECT ev."userId", 'events', 'server:' || ev.id, ev."createdAt", to_jsonb(ev)-'userId', ev.visibility FROM hatask_event ev
	WHERE NOT EXISTS (SELECT 1 FROM local_records l WHERE l.key='events' AND l."userId"=ev."userId" AND l.data->>'serverEventId'=ev.id)
	UNION ALL
	SELECT fl."userId", 'gallery', 'id:' || fl."clientFlowerId", fl."harvestedAt", to_jsonb(fl)-'userId', COALESCE(p."hataskFlowerVisibility",'private') FROM hatask_flower fl
	LEFT JOIN user_profile p ON p."userId"=fl."userId"
	WHERE NOT EXISTS (SELECT 1 FROM local_records l WHERE l.key='gallery' AND l."userId"=fl."userId" AND l.data->>'id'=fl."clientFlowerId")
), dated AS (
	SELECT s.*, COALESCE(substring(s.data->>'date' FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'),substring(s.data->>'due' FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'),
		substring(s.data->>'harvestedAt' FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'),substring(s.data->>'createdAt' FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'),
		CASE WHEN COALESCE(s.data->>'createdAt',s.data->>'startedAt') ~ '^[0-9]{1,13}$' THEN to_char(to_timestamp(COALESCE(s.data->>'createdAt',s.data->>'startedAt')::double precision/1000) AT TIME ZONE 'UTC','YYYY-MM-DD') END) AS record_date
	FROM sources s
), records AS (
	SELECT s.*, encode(sha256(convert_to(jsonb_build_array(s."userId",s.key,s.entry_id)::text,'UTF8')),'hex') AS id,
		encode(sha256(convert_to(jsonb_build_array(s.visibility, CASE WHEN s.key='flower' THEN s.data-'progress'-'lastGrowthAt'-'totalMinutes' ELSE s.data END)::text,'UTF8')),'hex') AS "contentVersion",
		CASE s.key WHEN 'events' THEN 'event' WHEN 'todos' THEN 'todo' WHEN 'moods' THEN 'mood' WHEN 'meals' THEN 'meal' ELSE 'flower' END AS kind,
		COALESCE(NULLIF(s.data->>'title',''),NULLIF(s.data->>'text',''),NULLIF(s.data->>'name',''),
			CASE s.key WHEN 'moods' THEN 'きもちの記録' WHEN 'meals' THEN 'ごはんの記録' WHEN 'flower' THEN '育てているおはな' WHEN 'gallery' THEN 'おはなの記録' ELSE '名称のない記録' END) AS title,
		COALESCE(s.data->>'note',s.data->>'comment',s.data->>'description',s.data->>'hanakotoba','') AS body,
		COALESCE(s.record_date,to_char(s.saved_at AT TIME ZONE 'UTC','YYYY-MM-DD')) AS date,
		COALESCE(substring(COALESCE(s.data->>'time',s.data->>'timeStart') FROM '^([0-9]{2}:[0-9]{2})'),'') AS time,
		s.record_date IS NULL AS "dateFallback",
		u.username, u.name AS user_name
	FROM dated s JOIN "user" u ON u.id=s."userId"
), reviewed AS (
	SELECT c.*, COALESCE(r.revision,0) AS revision,
		CASE WHEN r."contentVersion"=c."contentVersion" THEN r.state ELSE 'unread' END AS state,
		r."contentVersion" IS NOT NULL AND r."contentVersion"<>c."contentVersion" AS stale,
		r."reviewerId", r."reviewedAt"
	FROM records c LEFT JOIN hatask_record_review r ON r.id=c.id
)`;

export type HataskReviewRow = {
	id: string; userId: string; kind: HataskRecordKind; title: string; body: string; date: string; time: string;
	visibility: typeof HATASK_RECORD_VISIBILITIES[number]; data: Record<string, unknown>; contentVersion: string;
	revision: number; state: HataskReviewState; stale: boolean; reviewerId: string | null; reviewedAt: string | Date | null; dateFallback: boolean;
};
export type HataskReviewItem = Omit<HataskReviewRow, 'userId' | 'data' | 'reviewerId' | 'reviewedAt'> & { user: Packed<'UserLite'>; reviewer: Packed<'UserLite'> | null; reviewedAt: string | null };
const fieldLabels: Record<string, string> = {
	date: '日付', due: '期限', time: '時刻', timeStart: '開始時刻', timeEnd: '終了時刻', dateEnd: '終了日', allDay: '終日',
	done: '完了', priority: '優先度', subtasks: 'サブタスク', comment: 'コメント', comments: 'コメント', note: 'メモ', description: '説明',
	level: '記録した状態', slot: '食事', reasons: 'きっかけ', emoji: '絵文字', name: '名前', hanakotoba: '花言葉', rare: 'レア',
	createdAt: '作成日時', updatedAt: '更新日時', startedAt: '開始日時', harvestedAt: '開花日時', archivedAt: 'アーカイブ日時',
	visibleUserIds: '指定メンバーID', recurrence: '繰り返し', localRecord: '本人用の記録', _unparsed: '読み取れない形式の記録',
};
export function reviewFields(data: Record<string, unknown>) {
	const bodyKey = ['note', 'comment', 'description', 'hanakotoba'].find(key => data[key] != null);
	const titleKey = ['title', 'text', 'name'].find(key => data[key] != null && data[key] !== '');
	return Object.entries(data).filter(([key, value]) => (value != null || key === '_unparsed') && key !== bodyKey && key !== titleKey && key !== 'visibility').map(([key, value]) => ({
		label: fieldLabels[key] ?? key,
		value: typeof value === 'string' ? value : typeof value === 'boolean' ? value ? 'はい' : 'いいえ' : JSON.stringify(value, null, 2),
	}));
}
