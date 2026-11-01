/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiUser, RegistryItemsRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { RoleService } from '@/core/RoleService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

export type HatagoesSearchApp = 'all' | 'hatask' | 'hatady' | 'hatafeed' | 'users';
export type HatagoesSearchItem = {
	id: string;
	app: Exclude<HatagoesSearchApp, 'all'>;
	kind: string;
	title: string;
	text: string;
	url: string;
	targetId?: string;
	userId?: string | null;
};
export type HatagoesSearchResult = {
	items: HatagoesSearchItem[];
	total: number;
	counts: { hatask: number; hatady: number; hatafeed: number; users: number };
	hasMore: boolean;
};

export function hatagoesSearchPattern(query: string): string | null {
	const normalized = query.trim().normalize('NFKC').trim();
	return normalized.length === 0 ? null : `%${sqlLikeEscape(normalized)}%`;
}

// This query intentionally enumerates searchable columns. Never search or
// serialize an entire Registry document: it may contain private settings and
// planner migration snapshots. All sources emit the same columns, then one
// visibility-filtered relation supplies both the counts and the result page.
// $1 viewer, $2 escaped ILIKE pattern, $3 offset, $4 limit, $5 app,
// $6 HataFeed access, $7 HataFeed staff, $8 user search policy.
export const HATAGOES_SEARCH_SQL = `
WITH registry_rows AS (
	SELECT r.key, r.id AS registry_id, r.value, r."updatedAt"
	FROM registry_item r
	WHERE r."userId"=$1 AND r.domain IS NULL
		AND r.scope=ARRAY['client','hatask']::varchar[]
		AND r.key IN ('events','todos','moods','meals','flower','gallery')
), registry_latest AS (
	SELECT DISTINCT ON (r.key) r.* FROM registry_rows r
	WHERE r.key NOT IN ('events','todos')
	ORDER BY r.key, r."updatedAt" DESC, r.registry_id DESC
), registry_raw AS (
	SELECT * FROM registry_rows WHERE key IN ('events','todos')
	UNION ALL SELECT * FROM registry_latest
), registry_expanded AS (
	SELECT r.key, r.registry_id, r."updatedAt", item.value AS data, item.ordinality
	FROM registry_raw r
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(r.value)='array' THEN r.value
			WHEN jsonb_typeof(r.value)='object' THEN jsonb_build_array(r.value)
			ELSE '[]'::jsonb END
	) WITH ORDINALITY item(value, ordinality)
	WHERE jsonb_typeof(item.value)='object'
), registry_identified AS (
	SELECT e.key, max(e."updatedAt") AS "updatedAt", e.data->>'id' AS source_id,
		jsonb_object_agg(field.key,field.value ORDER BY e."updatedAt",e.registry_id,e.ordinality) AS data
	FROM registry_expanded e CROSS JOIN LATERAL jsonb_each(e.data) field
	WHERE e.key IN ('events','todos') AND jsonb_typeof(e.data->'id')='string' AND e.data->>'id'<>''
	GROUP BY e.key,e.data->>'id'
), registry_entries AS (
	SELECT key, "updatedAt", data, source_id FROM registry_identified
	UNION ALL
	SELECT e.key, e."updatedAt", e.data, e.registry_id || ':' || e.ordinality::text
	FROM registry_expanded e
	WHERE e.key NOT IN ('events','todos') OR jsonb_typeof(e.data->'id') IS DISTINCT FROM 'string' OR e.data->>'id'=''
), sources AS (
	SELECT 'registry:' || r.key || ':' || r.source_id AS id,
		'hatask'::text AS app,
		CASE r.key WHEN 'events' THEN 'event' WHEN 'todos' THEN 'todo' WHEN 'moods' THEN 'mood'
			WHEN 'meals' THEN 'meal' ELSE 'flower' END AS kind,
		COALESCE(NULLIF(r.data->>'title',''), NULLIF(r.data->>'text',''), NULLIF(r.data->>'name',''),
			CASE r.key WHEN 'moods' THEN 'きもちの記録' WHEN 'meals' THEN 'ごはんの記録' ELSE 'おはなの記録' END) AS title,
		COALESCE(r.data->>'note',r.data->>'comment',r.data->>'description',r.data->>'hanakotoba','') AS text,
		'/hatask?tab=' || CASE r.key WHEN 'events' THEN 'cal' WHEN 'todos' THEN 'todo'
			WHEN 'moods' THEN 'mood' WHEN 'meals' THEN 'meal' ELSE 'garden' END AS url,
		COALESCE(NULLIF(r.data->>'id',''), r.source_id) AS "targetId", $1::text AS "userId",
		r."updatedAt" AS sort_at,
		concat_ws(' ',r.data->>'title',r.data->>'text',r.data->>'name',r.data->>'note',
			r.data->>'comment',r.data->>'description',r.data->>'hanakotoba') AS search_text
	FROM registry_entries r
	UNION ALL
	SELECT 'event:' || e.id, 'hatask', 'event', e.title, '', '/hatask?tab=cal', e.id, e."userId", e."createdAt", e.title
	FROM hatask_event e
	WHERE (e."userId"=$1 AND NOT EXISTS (SELECT 1 FROM registry_entries re WHERE re.key='events'
		AND (re.data->>'serverEventId'=e.id OR re.data->>'id'=e.id)))
		OR (e."userId"<>$1 AND (e.visibility='public' OR (e.visibility='specified' AND $1=ANY(e."visibleUserIds")))
		AND NOT EXISTS (SELECT 1 FROM blocking b WHERE (b."blockerId"=$1 AND b."blockeeId"=e."userId") OR (b."blockeeId"=$1 AND b."blockerId"=e."userId")))
	UNION ALL
	SELECT 'recipe:' || r.id, 'hatask', 'recipe', r.title, r.summary, '/hatask?tab=recipe', r.id, r."userId", r."updatedAt",
		concat_ws(' ',r.title,r.summary,r.ingredients::text,r.steps::text,r."referenceLinks"::text,array_to_string(r.tags,' '))
	FROM hatask_recipe r
	WHERE r."userId"=$1 OR (r."userId"<>$1 AND r."isDraft"=FALSE
		AND (r.visibility='specified' AND $1=ANY(r."visibleUserIds") OR r.visibility='followers' AND EXISTS
			(SELECT 1 FROM following f WHERE f."followerId"=$1 AND f."followeeId"=r."userId"))
		AND EXISTS (SELECT 1 FROM "user" owner WHERE owner.id=r."userId" AND owner."isDeleted"=FALSE AND owner."isSuspended"=FALSE)
		AND NOT EXISTS (SELECT 1 FROM blocking b WHERE (b."blockerId"=$1 AND b."blockeeId"=r."userId") OR (b."blockeeId"=$1 AND b."blockerId"=r."userId")))
	UNION ALL
	SELECT 'flower:' || f.id, 'hatask', 'flower', f.name, f.hanakotoba, '/hatask?tab=garden', f.id, f."userId", f."harvestedAt", concat_ws(' ',f.name,f.hanakotoba)
	FROM hatask_flower f JOIN "user" owner ON owner.id=f."userId" LEFT JOIN user_profile p ON p."userId"=f."userId"
	WHERE (f."userId"=$1 AND NOT EXISTS (SELECT 1 FROM registry_entries re WHERE re.key='gallery' AND re.data->>'id'=f."clientFlowerId"))
		OR (f."userId"<>$1 AND owner.host IS NULL AND owner."isSuspended"=FALSE
		AND NOT EXISTS (SELECT 1 FROM muting m WHERE m."muterId"=$1 AND m."muteeId"=f."userId")
		AND (p."hataskFlowerVisibility"='public' OR p."hataskFlowerVisibility"='followers' AND EXISTS
		(SELECT 1 FROM following fl WHERE fl."followerId"=$1 AND fl."followeeId"=f."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking b WHERE (b."blockerId"=$1 AND b."blockeeId"=f."userId") OR (b."blockeeId"=$1 AND b."blockerId"=f."userId")))
	UNION ALL
	SELECT 'cooking:' || cr.id, 'hatask', 'cookingRecord', cr.title, cr.memo, '/hatask?tab=recipe', cr.id, cr."userId", cr."cookedAt", concat_ws(' ',cr.title,cr.memo)
	FROM hatask_cooking_record cr
	WHERE cr."userId"=$1
	UNION ALL
	SELECT 'log:' || l.id, 'hatady', 'log', l.title, COALESCE(l.body,''), '/hatady?tab=records', l.id, l."userId", l."studiedAt", concat_ws(' ',l.title,l.body,l.subject,l.tag,l.tags::text,l.details::text)
	FROM hatady_log l
	WHERE l."userId"=$1 OR (l.visibility IN ('public','followers') AND
		(l.visibility='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=l."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking b WHERE (b."blockerId"=$1 AND b."blockeeId"=l."userId") OR (b."blockeeId"=$1 AND b."blockerId"=l."userId")))
	UNION ALL
	SELECT 'book:' || b.id, 'hatady', 'book', b.title, COALESCE(b.author,''), '/hatady?tab=collection', b.id, b."userId", b."updatedAt", concat_ws(' ',b.title,b.author,
		CASE WHEN b."userId"=$1 THEN b.details::text ELSE concat_ws(' ',b.details->>'genre',b.details->>'description',b.details->>'nextStep') END)
	FROM hatady_book b
	WHERE b."userId"=$1 OR (b.visibility IN ('public','followers') AND
		(b.visibility='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=b."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking bl WHERE (bl."blockerId"=$1 AND bl."blockeeId"=b."userId") OR (bl."blockeeId"=$1 AND bl."blockerId"=b."userId")))
	UNION ALL
	SELECT 'work:' || w.id, 'hatady', 'work', w.title, concat_ws(' ',w.synopsis,w.review), '/hatady?tab=collection', w.id, w."userId", w."updatedAt", concat_ws(' ',w.title,w."originalTitle",w.creator,w.synopsis,w.review,w."officialUrl",w.highlights::text,
		CASE WHEN w."userId"=$1 THEN w.details::text ELSE concat_ws(' ',w.details->>'genre',w.details->>'description',w.details->>'nextStep') END)
	FROM hatady_media_work w
	WHERE w."userId"=$1 OR (w.visibility IN ('public','followers') AND
		(w.visibility='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=w."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking bl WHERE (bl."blockerId"=$1 AND bl."blockeeId"=w."userId") OR (bl."blockeeId"=$1 AND bl."blockerId"=w."userId")))
	UNION ALL
	SELECT 'session:' || s.id, 'hatady', 'session', COALESCE(NULLIF(s."workSnapshot"->>'title',''),'作品の記録'), COALESCE(s.note,''), '/hatady?tab=records', s.id, s."userId", s."occurredAt", concat_ws(' ',s."workSnapshot"::text,s.note,s.details::text)
	FROM hatady_media_session s
	WHERE s."userId"=$1 OR (s.visibility IN ('public','followers') AND
		(s.visibility='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=s."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking bl WHERE (bl."blockerId"=$1 AND bl."blockeeId"=s."userId") OR (bl."blockeeId"=$1 AND bl."blockerId"=s."userId")))
	UNION ALL
	SELECT 'hatady-comment:' || c.id, 'hatady', 'log', l.title, c.text, '/hatady?tab=records', l.id, c."userId", c."createdAt", concat_ws(' ',l.title,c.text)
	FROM hatady_comment c JOIN hatady_log l ON l.id=c."logId"
	WHERE (l."userId"=$1 OR (l.visibility IN ('public','followers') AND
		(l.visibility='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=l."userId"))
		AND NOT EXISTS (SELECT 1 FROM blocking bl WHERE (bl."blockerId"=$1 AND bl."blockeeId"=l."userId") OR (bl."blockeeId"=$1 AND bl."blockerId"=l."userId"))))
		AND (c."userId"=$1 OR NOT EXISTS (SELECT 1 FROM muting m WHERE m."muterId"=$1 AND m."muteeId"=c."userId")
			AND NOT EXISTS (SELECT 1 FROM blocking cb WHERE (cb."blockerId"=$1 AND cb."blockeeId"=c."userId") OR (cb."blockeeId"=$1 AND cb."blockerId"=c."userId")))
	UNION ALL
	SELECT 'media-comment:' || mc.id, 'hatady', CASE WHEN mc."workId" IS NOT NULL THEN 'work' ELSE 'session' END,
		COALESCE(w.title,s."workSnapshot"->>'title','作品のコメント'), mc.text,
		'/hatady?tab=collection', COALESCE(mc."workId",mc."sessionId"), mc."userId", mc."createdAt", concat_ws(' ',w.title,s."workSnapshot"->>'title',mc.text)
	FROM hatady_media_comment mc LEFT JOIN hatady_media_work w ON w.id=mc."workId" LEFT JOIN hatady_media_session s ON s.id=mc."sessionId"
	WHERE (COALESCE(w."userId",s."userId")=$1 OR (COALESCE(w.visibility,s.visibility) IN ('public','followers') AND
		(COALESCE(w.visibility,s.visibility)='public' OR EXISTS (SELECT 1 FROM hatady_following hf WHERE hf."followerId"=$1 AND hf."followeeId"=COALESCE(w."userId",s."userId")))
		AND NOT EXISTS (SELECT 1 FROM blocking bl WHERE (bl."blockerId"=$1 AND bl."blockeeId"=COALESCE(w."userId",s."userId")) OR (bl."blockeeId"=$1 AND bl."blockerId"=COALESCE(w."userId",s."userId")))))
		AND (mc."userId"=$1 OR NOT EXISTS (SELECT 1 FROM muting m WHERE m."muterId"=$1 AND m."muteeId"=mc."userId")
			AND NOT EXISTS (SELECT 1 FROM blocking cb WHERE (cb."blockerId"=$1 AND cb."blockeeId"=mc."userId") OR (cb."blockeeId"=$1 AND cb."blockerId"=mc."userId")))
	UNION ALL
	SELECT 'memo:' || m.id, 'hatady', 'book', COALESCE(b.title,'本のメモ'), m.text, '/hatady?tab=collection', m."bookId", m."userId", m."updatedAt", concat_ws(' ',b.title,m.text)
	FROM hatady_book_memo m LEFT JOIN hatady_book b ON b.id=m."bookId"
	WHERE m."userId"=$1
	UNION ALL
	SELECT 'bookmark:' || bm.id, 'hatady', 'book', COALESCE(bm.name,b.title,'しおり'), COALESCE(bm.memo,''), '/hatady?tab=collection', bm."bookId", bm."userId", bm."createdAt", concat_ws(' ',bm.name,b.title,bm.memo)
	FROM hatady_bookmark bm LEFT JOIN hatady_book b ON b.id=bm."bookId"
	WHERE bm."userId"=$1
	UNION ALL
	SELECT 'issue:' || i.id, 'hatafeed', 'issue', i.title, i.description, '/hatafeed/' || i.id, i.id, i."createdById", i."updatedAt", concat_ws(' ',i.title,i.description)
	FROM feedback_issue i LEFT JOIN feedback_project p ON p.id=i."projectId"
	WHERE $6 AND ($7 OR i.category<>'security') AND (p.id IS NULL OR p.suspended=FALSE OR p."ownerId"=$1 OR $7)
	UNION ALL
	SELECT 'comment:' || c.id, 'hatafeed', 'issue', i.title, c.text, '/hatafeed/' || i.id, i.id, c."userId", c."createdAt", concat_ws(' ',i.title,c.text)
	FROM feedback_comment c JOIN feedback_issue i ON i.id=c."feedbackId" LEFT JOIN feedback_project p ON p.id=i."projectId"
	WHERE $6 AND ($7 OR i.category<>'security') AND (p.id IS NULL OR p.suspended=FALSE OR p."ownerId"=$1 OR $7)
	UNION ALL
	SELECT 'project:' || p.id, 'hatafeed', 'project', p.name, p.description, '/hatafeed', p.id, p."ownerId", p."updatedAt", concat_ws(' ',p.name,p.description,p.url)
	FROM feedback_project p
	WHERE $6 AND (p.suspended=FALSE OR p."ownerId"=$1 OR $7)
	UNION ALL
	SELECT 'emoji:' || e.id, 'hatafeed', 'emojiRequest', e.name, COALESCE(e.category,''), '/hatafeed', e.id, e."requestedById", e."createdAt", concat_ws(' ',e.name,e.category,array_to_string(e.aliases,' '),e.license)
	FROM feedback_emoji_request e
	WHERE $6 AND ($7 OR e."requestedById"=$1)
	UNION ALL
	SELECT 'emoji-change:' || ec.id, 'hatafeed', 'emojiChangeRequest', ec.kind, ec.reason, '/hatafeed', ec.id, ec."requestedById", ec."createdAt", concat_ws(' ',ec.kind,ec.reason)
	FROM feedback_emoji_change_request ec
	WHERE $6 AND ($7 OR ec."requestedById"=$1)
	UNION ALL
	SELECT 'user:' || u.id, 'users', 'user', COALESCE(NULLIF(u.name,''),u.username), '', '/@' || u.username || CASE WHEN u.host IS NULL THEN '' ELSE '@' || u.host END,
		u.id, u.id, u."updatedAt", concat_ws(' ',u.name,u.username,u.host,up.description)
	FROM "user" u LEFT JOIN user_profile up ON up."userId"=u.id
	WHERE $8 AND u."isSuspended"=FALSE AND u."isDeleted"=FALSE
		AND NOT EXISTS (SELECT 1 FROM muting m WHERE m."muterId"=$1 AND m."muteeId"=u.id)
), matched AS (
	SELECT id, app, kind, title, text, url, "targetId", "userId", sort_at
	FROM sources WHERE normalize(search_text, NFKC) ILIKE $2
), page AS (
	SELECT id, app, kind, title, text, url, "targetId", "userId", sort_at
	FROM matched WHERE $5='all' OR app=$5
	ORDER BY sort_at DESC NULLS LAST, app ASC, kind ASC, id DESC
	OFFSET $3 LIMIT $4
)
SELECT
	COALESCE((SELECT jsonb_agg(to_jsonb(page) - 'sort_at' ORDER BY sort_at DESC NULLS LAST, app ASC, kind ASC, id DESC) FROM page), '[]'::jsonb) AS items,
	(SELECT count(*)::int FROM matched WHERE $5='all' OR app=$5) AS total,
	(SELECT count(*)::int FROM matched WHERE app='hatask') AS hatask,
	(SELECT count(*)::int FROM matched WHERE app='hatady') AS hatady,
	(SELECT count(*)::int FROM matched WHERE app='hatafeed') AS hatafeed,
	(SELECT count(*)::int FROM matched WHERE app='users') AS users
`;

@Injectable()
export class HatagoesSearchService {
	constructor(
		@Inject(DI.registryItemsRepository) private registryItemsRepository: RegistryItemsRepository,
		private feedbackService: FeedbackService,
		private roleService: RoleService,
	) {}

	public async search(me: MiUser, query: string, app: HatagoesSearchApp, offset: number, limit: number): Promise<HatagoesSearchResult> {
		const pattern = hatagoesSearchPattern(query);
		if (pattern == null) return { items: [], total: 0, counts: { hatask: 0, hatady: 0, hatafeed: 0, users: 0 }, hasMore: false };
		const [feedAccess, feedStaff, policies] = await Promise.all([
			this.feedbackService.canAccess(me.id),
			this.feedbackService.isStaff(me.id),
			this.roleService.getUserPolicies(me.id),
		]);
		const [row] = await this.registryItemsRepository.manager.query(HATAGOES_SEARCH_SQL,
			[me.id, pattern, offset, limit, app, feedAccess, feedStaff, policies.canSearchUsers === true]) as [{
				items: HatagoesSearchItem[]; total: number; hatask: number; hatady: number; hatafeed: number; users: number;
			}];
		const total = Number(row.total);
		return {
			items: row.items,
			total,
			counts: { hatask: Number(row.hatask), hatady: Number(row.hatady), hatafeed: Number(row.hatafeed), users: Number(row.users) },
			hasMore: offset + row.items.length < total,
		};
	}
}
