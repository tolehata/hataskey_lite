/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { MiUser } from '@/models/User.js';
import type { Packed } from '@/misc/json-schema.js';
import { HATADY_MODERATION_TARGETS, HATADY_MODERATION_STATES, type HatadyModerationTarget, type HatadyModerationState } from '@/models/HatadyModerationReview.js';
import { HatadyAttachmentService } from '@/core/HatadyAttachmentService.js';
import { RoleService } from '@/core/RoleService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { DataSource, EntityManager } from 'typeorm';

export const MODERATION_CATEGORIES = ['all', 'collection', 'record', 'comment', 'reaction'] as const;
export const MODERATION_ACTIVITIES = ['all', 'study', 'movie', 'game', 'exercise', 'work', 'cooking'] as const;
export const MODERATION_VISIBILITIES = ['all', 'public', 'followers', 'private'] as const;
export const MODERATION_ERRORS = { denied: 'MODERATION_ACCESS_DENIED', missing: 'NO_SUCH_TARGET', conflict: 'REVIEW_CONFLICT', invalid: 'INVALID_MODERATION_FILTER', cursor: 'INVALID_MODERATION_CURSOR' } as const;
const TABLES: Record<HatadyModerationTarget, string> = {
	book: 'hatady_book', log: 'hatady_log', comment: 'hatady_comment', reaction: 'hatady_reaction',
	mediaWork: 'hatady_media_work', mediaSession: 'hatady_media_session', mediaComment: 'hatady_media_comment', mediaReaction: 'hatady_media_reaction',
};
export type ModerationOptions = {
	limit?: number; cursor?: string;
	category?: typeof MODERATION_CATEGORIES[number]; status?: 'all' | HatadyModerationState;
	activity?: typeof MODERATION_ACTIVITIES[number]; visibility?: typeof MODERATION_VISIBILITIES[number];
	query?: string; since?: number; until?: number; sort?: 'asc' | 'desc';
};
export type ModerationEntry = {
	key: string; targetType: HatadyModerationTarget; targetId: string;
	category: Exclude<typeof MODERATION_CATEGORIES[number], 'all'>;
	activity: Exclude<typeof MODERATION_ACTIVITIES[number], 'all'>;
	fileIds: string[]; files: Packed<'DriveFile'>[];
	actor: Packed<'UserLite'>; title: string; body: string; createdAt: string;
	visibility: 'public' | 'followers' | 'private'; emoji: string | null; parentKey: string | null; contentVersion: string;
	review: { state: HatadyModerationState; note: string; revision: number; reviewer: Packed<'UserLite'> | null; reviewedAt: string | null; stale: boolean };
};
export type ModerationDetail = { item: ModerationEntry; fields: { label: string; value: string }[]; ancestors: ModerationEntry[]; related: ModerationEntry[]; relatedHasMore: boolean };
type Row = Omit<ModerationEntry, 'actor' | 'review' | 'createdAt' | 'fileIds' | 'files'> & {
	userId: string; createdAt: Date | string; data: Record<string, unknown>; state: HatadyModerationState;
	note: string; revision: number; reviewerId: string | null; reviewedAt: Date | string | null; stale: boolean;
};
type Query = Pick<EntityManager, 'query'>;
type Cursor = { v: 1; f: string; time: string; type: HatadyModerationTarget; id: string };

export function normalizeModerationOptions(options: ModerationOptions) {
	const value = { limit: options.limit ?? 30, category: options.category ?? 'all', status: options.status ?? 'all', activity: options.activity ?? 'all', visibility: options.visibility ?? 'all', query: (options.query ?? '').trim(), since: options.since ?? null, until: options.until ?? null, sort: options.sort ?? 'desc' };
	if (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 50
		|| !MODERATION_CATEGORIES.includes(value.category) || !['all', ...HATADY_MODERATION_STATES].includes(value.status)
		|| !MODERATION_ACTIVITIES.includes(value.activity) || !MODERATION_VISIBILITIES.includes(value.visibility)
		|| !['asc', 'desc'].includes(value.sort) || value.query.length > 200
		|| [value.since, value.until].some(time => time != null && (!Number.isSafeInteger(time) || time < 0 || time > 8_640_000_000_000_000))
		|| value.since != null && value.until != null && value.since > value.until) throw new Error(MODERATION_ERRORS.invalid);
	return value;
}
export function moderationFingerprint(options: ReturnType<typeof normalizeModerationOptions>): string {
	const { limit, ...filters } = options;
	return createHash('sha256').update(JSON.stringify(filters)).digest('hex').slice(0, 24);
}
export function decodeModerationCursor(value: string, fingerprint: string): Cursor {
	try {
		if (!/^[A-Za-z0-9_-]{1,1024}$/.test(value)) throw new Error();
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
		if (parsed.v !== 1 || parsed.f !== fingerprint || !HATADY_MODERATION_TARGETS.includes(parsed.type)
			|| !/^[A-Za-z0-9]{1,32}$/.test(parsed.id) || typeof parsed.time !== 'string'
			|| !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.time) || !Number.isFinite(Date.parse(parsed.time))) throw new Error();
		return parsed;
	} catch { throw new Error(MODERATION_ERRORS.cursor); }
}

// UNION ALL performs filtering/keyset pagination in PostgreSQL. Only the bounded
// page is packed into users; no existing timeline visibility/block filter hides staff evidence.
function source(type: HatadyModerationTarget, category: string, activity: string, title: string, body: string, visibility: string, parent: string, joins = '', emoji = 'NULL::text', data = 'to_jsonb(x)'): string {
	return `SELECT '${type}'::text AS "targetType", x.id AS "targetId", '${category}'::text AS category,
		${activity}::text AS activity, x."userId", x."createdAt", COALESCE(${title}, '')::text AS title,
		COALESCE(${body}, '')::text AS body, COALESCE(${visibility}, 'private')::text AS visibility,
		${parent}::text AS "parentKey", ${emoji}::text AS emoji, ${data} AS data
		FROM "${TABLES[type]}" x ${joins}`;
}

const bookData = 'to_jsonb(x) || jsonb_build_object(\'bookmarks\', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM hatady_bookmark b WHERE b."bookId"=x.id), \'[]\'::jsonb), \'memos\', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM hatady_book_memo m WHERE m."bookId"=x.id), \'[]\'::jsonb))';
const mediaActivity = 'CASE WHEN s.id IS NOT NULL THEN CASE WHEN s.kind=\'movie_viewing\' THEN \'movie\' ELSE \'game\' END ELSE COALESCE(w.kind,\'game\') END';
const mediaTitle = 'COALESCE(w.title, s."workSnapshot"->>\'title\', \'削除された作品\')';
export const HATADY_MODERATION_UNION = [
	source('book', 'collection', '\'study\'', 'x.title', 'x.details->>\'description\'', 'x.visibility', 'NULL', '', 'NULL::text', bookData),
	source('mediaWork', 'collection', 'x.kind', 'x.title', 'COALESCE(x.details->>\'description\', x.synopsis, x.review)', 'x.visibility', 'NULL'),
	source('log', 'record', 'x.kind', 'x.title', 'x.body', 'x.visibility', 'CASE WHEN x."bookId" IS NOT NULL THEN \'book:\' || x."bookId" WHEN x."mediaWorkId" IS NOT NULL THEN \'mediaWork:\' || x."mediaWorkId" END'),
	source('mediaSession', 'record', 'CASE WHEN x.kind=\'movie_viewing\' THEN \'movie\' ELSE \'game\' END', 'COALESCE(w.title, x."workSnapshot"->>\'title\', \'削除された作品\')', 'x.note', 'x.visibility', '\'mediaWork:\' || x."workId"', 'LEFT JOIN hatady_media_work w ON w.id=x."workId"'),
	source('comment', 'comment', 'l.kind', 'l.title || \' へのコメント\'', 'x.text', 'l.visibility', 'CASE WHEN p.id IS NOT NULL THEN \'comment:\' || p.id ELSE \'log:\' || x."logId" END', 'JOIN hatady_log l ON l.id=x."logId" LEFT JOIN hatady_comment p ON p.id=x."replyId"'),
	source('reaction', 'reaction', 'l.kind', 'l.title || \' へのリアクション\'', '\'\'', 'l.visibility', 'CASE WHEN c.id IS NOT NULL THEN \'comment:\' || c.id ELSE \'log:\' || x."logId" END', 'LEFT JOIN hatady_comment c ON c.id=x."commentId" JOIN hatady_log l ON l.id=COALESCE(x."logId",c."logId")', 'x.reaction'),
	source('mediaComment', 'comment', mediaActivity, `${mediaTitle} || ' へのコメント'`, 'x.text', 'COALESCE(s.visibility,w.visibility)', 'CASE WHEN p.id IS NOT NULL THEN \'mediaComment:\' || p.id WHEN s.id IS NOT NULL THEN \'mediaSession:\' || s.id ELSE \'mediaWork:\' || x."workId" END', 'LEFT JOIN hatady_media_comment p ON p.id=x."replyId" LEFT JOIN hatady_media_session s ON s.id=x."sessionId" LEFT JOIN hatady_media_work w ON w.id=COALESCE(x."workId",s."workId")'),
	source('mediaReaction', 'reaction', mediaActivity, `${mediaTitle} || ' へのリアクション'`, '\'\'', 'COALESCE(s.visibility,w.visibility)', 'CASE WHEN c.id IS NOT NULL THEN \'mediaComment:\' || c.id WHEN s.id IS NOT NULL THEN \'mediaSession:\' || s.id ELSE \'mediaWork:\' || x."workId" END', 'LEFT JOIN hatady_media_comment c ON c.id=x."commentId" LEFT JOIN hatady_media_session s ON s.id=COALESCE(x."sessionId",c."sessionId") LEFT JOIN hatady_media_work w ON w.id=COALESCE(x."workId",c."workId",s."workId")', 'x.reaction'),
].join(' UNION ALL ');
export const HATADY_MODERATION_CTE = `WITH content AS (${HATADY_MODERATION_UNION}), versioned AS (
	SELECT c.*, c."targetType" || ':' || c."targetId" AS key,
	encode(sha256(convert_to(((CASE WHEN c.category='record' AND COALESCE(c.data->'fileIds','[]'::jsonb)='[]'::jsonb THEN c.data-'fileIds' ELSE c.data END) - 'reactionsCount' - 'commentsCount')::text,'UTF8')),'hex') AS "contentVersion"
	FROM content c
), reviewed AS (
	SELECT c.*, COALESCE(r.note,'') AS note, COALESCE(r.revision,0) AS revision,
	r."reviewerId", r."reviewedAt", r."contentVersion" IS NOT NULL AND r."contentVersion" <> c."contentVersion" AS stale,
	CASE WHEN r."contentVersion"=c."contentVersion" THEN r.state ELSE 'unreviewed' END AS state
	FROM versioned c LEFT JOIN hatady_moderation_review r ON r."targetType"=c."targetType" AND r."targetId"=c."targetId"
)`;
const cte = HATADY_MODERATION_CTE;
const iso = (value: Date | string) => new Date(value).toISOString();

const fieldLabels: Record<string, string> = {
	author: '作者', creator: '作者・制作者', originalTitle: '原題', totalPages: '総ページ', currentPage: '現在のページ', status: '状態', coverColorIndex: '表紙色', isFavorite: 'お気に入り', isRecommended: 'おすすめ', finishedAt: '完了日時',
	subject: 'ジャンル・分野', studiedAt: '記録日時', occurredAt: '記録日時', startedAt: '開始時刻', durationMinutes: '時間（分）', durationSeconds: '時間（秒）', tag: '旧タグ', tags: 'タグ', pageFrom: '開始ページ', pageTo: '終了ページ',
	synopsis: 'あらすじ', synopsisSpoiler: 'あらすじのネタバレ', review: '感想', reviewSpoiler: '感想のネタバレ', noteSpoiler: '本文のネタバレ', spoiler: 'ネタバレ', officialUrl: '公式URL', runtimeMinutes: '上映時間（分）', releaseDate: '公開日', releaseYear: '公開年',
	genres: 'ジャンル', origin: '製作区分', viewingMode: '鑑賞方式', primaryLanguage: '言語', highlights: '見どころ', highlightsSpoiler: '見どころのネタバレ', platforms: 'プラットフォーム', developer: '開発元', publisher: '販売元', recommendationRating: 'おすすめ評価',
	details: '詳しい情報', genre: 'ジャンル・分野', description: '説明', memo: '私的メモ', nextStep: '次にすること', place: '場所', calories: '消費カロリー', workSnapshot: '記録時の作品情報', kind: '種別', bookmarks: 'しおり（本人用）', memos: '内容メモ（本人用）', name: '名前', text: '本文', page: 'ページ', color: '色',
};
export function moderationFields(data: Record<string, unknown>): { label: string; value: string }[] {
	const result: { label: string; value: string }[] = [];

	function visit(value: unknown, path: string) {
		if (value == null) return;
		if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path} ${index + 1}`)); return; }
		if (typeof value === 'object') {
			for (const [key, child] of Object.entries(value)) {
				if (['id', 'userId', 'bookId', 'mediaWorkId', 'workId', 'sessionId', 'commentId', 'logId', 'replyId', 'reactionsCount', 'commentsCount', 'isPublic', 'createdAt', 'updatedAt'].includes(key)) continue;
				visit(child, [path, fieldLabels[key] ?? key].filter(Boolean).join(' · '));
			}
		} else result.push({ label: path, value: typeof value === 'boolean' ? value ? 'はい' : 'いいえ' : String(value) });
	}

	for (const [key, value] of Object.entries(data)) {
		if (['title', 'body', 'note', 'text', 'reaction', 'visibility', 'fileIds'].includes(key)) continue;
		visit({ [key]: value }, '');
	}
	return result;
}

@Injectable()
export class HatadyModerationService {
	constructor(@Inject(DI.db) private db: DataSource, private roleService: RoleService, private userEntityService: UserEntityService, private hatadyAttachmentService: HatadyAttachmentService) {}

	private async authorize(viewer: MiUser, token: unknown) {
		if (token != null || !viewer?.id || !(await this.roleService.isModerator(viewer))) throw new Error(MODERATION_ERRORS.denied);
	}
	private validateTarget(type: HatadyModerationTarget, id: string) {
		if (!HATADY_MODERATION_TARGETS.includes(type) || !/^[A-Za-z0-9]{1,32}$/.test(id)) throw new Error(MODERATION_ERRORS.invalid);
	}
	private async raw(type: HatadyModerationTarget, id: string, db: Query = this.db): Promise<Row | null> {
		const rows: Row[] = await db.query(`${cte} SELECT * FROM reviewed WHERE "targetType"=$1 AND "targetId"=$2`, [type, id]);
		return rows[0] ?? null;
	}
	private async pack(rows: Row[], viewer: MiUser): Promise<ModerationEntry[]> {
		if (!rows.length) return [];
		const ids = [...new Set(rows.flatMap(row => [row.userId, ...(row.reviewerId ? [row.reviewerId] : [])]))];
		const users = await this.userEntityService.packMany(ids, viewer, { schema: 'UserLite' });
		const lookup = new Map(users.map(user => [user.id, user]));
		const attachments = rows.filter(row => row.category === 'record').map(row => ({ id: row.key, userId: row.userId, fileIds: Array.isArray(row.data.fileIds) ? row.data.fileIds as string[] : [] }));
		const files = await this.hatadyAttachmentService.packRecords(attachments);
		const idsByKey = new Map(attachments.map(record => [record.id, record.fileIds]));
		return rows.filter(row => lookup.has(row.userId)).map(row => ({
			key: row.key, targetType: row.targetType, targetId: row.targetId, category: row.category, activity: row.activity,
			actor: lookup.get(row.userId)!, title: row.title, body: row.body, createdAt: iso(row.createdAt), visibility: row.visibility,
			fileIds: idsByKey.get(row.key) ?? [], files: files.get(row.key) ?? [],
			emoji: row.emoji, parentKey: row.parentKey, contentVersion: row.contentVersion,
			review: { state: row.state, note: row.note, revision: row.revision, reviewer: row.reviewerId ? lookup.get(row.reviewerId) ?? null : null, reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null, stale: row.stale },
		}));
	}

	@bindThis
	public async list(viewer: MiUser, options: ModerationOptions, token: unknown = null) {
		await this.authorize(viewer, token);
		const filters = normalizeModerationOptions(options), fingerprint = moderationFingerprint(filters);
		const cursor = options.cursor ? decodeModerationCursor(options.cursor, fingerprint) : null;
		const params: unknown[] = [], clauses: string[] = [];
		const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
		for (const field of ['category', 'activity', 'visibility', 'status'] as const) {
			if (filters[field] !== 'all') clauses.push(`r.${field === 'status' ? 'state' : field}=${bind(filters[field])}`);
		}
		if (filters.since != null) clauses.push(`r."createdAt">=${bind(new Date(filters.since))}`);
		if (filters.until != null) clauses.push(`r."createdAt"<=${bind(new Date(filters.until))}`);
		if (filters.query) {
			const term = bind(`%${filters.query.replace(/[\\%_]/g, value => `\\${value}`)}%`);
			// Actor and full content, including private notes and direct context, are staff-only.
			clauses.push(`(concat_ws(' ',r.title,r.body,r.emoji,r.data::text,u.name,u.username,u.host,parent.title,parent.body) ILIKE ${term})`);
		}
		const where = clauses.length ? clauses.join(' AND ') : 'TRUE';
		const joins = 'JOIN "user" u ON u.id=r."userId" LEFT JOIN versioned parent ON parent.key=r."parentKey"';
		const cursorClauses: string[] = [];
		if (cursor) cursorClauses.push(`(r."createdAt",r."targetType",r."targetId") ${filters.sort === 'asc' ? '>' : '<'} (${bind(new Date(cursor.time))},${bind(cursor.type)},${bind(cursor.id)})`);
		const limit = bind(filters.limit + 1), direction = filters.sort === 'asc' ? 'ASC' : 'DESC';
		// The counters/filtered total and page share one MVCC snapshot. Cursor never changes total.
		const result = await this.db.query(`${cte}, filtered AS (SELECT r.* FROM reviewed r ${joins} WHERE ${where}), page AS (
			SELECT r.* FROM filtered r ${cursorClauses.length ? `WHERE ${cursorClauses.join(' AND ')}` : ''}
			ORDER BY r."createdAt" ${direction},r."targetType" ${direction},r."targetId" ${direction} LIMIT ${limit}
		) SELECT COALESCE((SELECT jsonb_agg(p ORDER BY p."createdAt" ${direction},p."targetType" ${direction},p."targetId" ${direction}) FROM page p),'[]'::jsonb) AS items,
		(SELECT count(*)::integer FROM filtered) AS total,
		(SELECT jsonb_build_object('unreviewed',count(*) FILTER (WHERE state='unreviewed'),'flagged',count(*) FILTER (WHERE state='flagged'),'reviewed',count(*) FILTER (WHERE state='reviewed')) FROM reviewed) AS counts`, params);
		const response = result[0] as { items: Row[]; total: number; counts: Record<HatadyModerationState, number> };
		const hasMore = response.items.length > filters.limit, rows = response.items.slice(0, filters.limit), last = rows.at(-1);
		return { items: await this.pack(rows, viewer), total: response.total, counts: response.counts, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ v: 1, f: fingerprint, time: iso(last.createdAt), type: last.targetType, id: last.targetId } satisfies Cursor)).toString('base64url') : null };
	}

	private async detail(viewer: MiUser, type: HatadyModerationTarget, id: string, db: Query = this.db): Promise<ModerationDetail> {
		const item = await this.raw(type, id, db);
		if (!item) throw new Error(MODERATION_ERRORS.missing);
		const ancestors: Row[] = [], seen = new Set([item.key]);
		let key = item.parentKey;
		// Corrupt legacy replies cannot form an unbounded traversal.
		while (key && !seen.has(key) && ancestors.length < 32) {
			seen.add(key);
			const [parentType, parentId] = key.split(':');
			if (!HATADY_MODERATION_TARGETS.includes(parentType as HatadyModerationTarget)) break;
			const parent = await this.raw(parentType as HatadyModerationTarget, parentId, db);
			if (!parent) break;
			ancestors.unshift(parent); key = parent.parentKey;
		}
		const children: Row[] = await db.query(`${cte} SELECT * FROM reviewed WHERE "parentKey"=$1 ORDER BY "createdAt" DESC,"targetType" DESC,"targetId" DESC LIMIT 51`, [item.key]);
		const related = children.slice(0, 50);
		const packed = new Map((await this.pack([item, ...ancestors, ...related], viewer)).map(entry => [entry.key, entry]));
		const main = packed.get(item.key);
		if (!main) throw new Error(MODERATION_ERRORS.missing);
		const present = (rows: Row[]) => rows.flatMap(row => { const entry = packed.get(row.key); return entry ? [entry] : []; });
		return { item: main, fields: moderationFields(item.data), ancestors: present(ancestors), related: present(related), relatedHasMore: children.length > 50 };
	}

	@bindThis
	public async show(viewer: MiUser, type: HatadyModerationTarget, id: string, token: unknown = null): Promise<ModerationDetail> {
		await this.authorize(viewer, token); this.validateTarget(type, id);
		return this.detail(viewer, type, id);
	}

	@bindThis
	public async review(viewer: MiUser, request: { targetType: HatadyModerationTarget; targetId: string; state: HatadyModerationState; note: string; expectedRevision: number; expectedContentVersion: string }, token: unknown = null): Promise<ModerationDetail> {
		await this.authorize(viewer, token);
		const { targetType, targetId, state, note, expectedRevision, expectedContentVersion } = request;
		this.validateTarget(targetType, targetId);
		if (!HATADY_MODERATION_STATES.includes(state) || typeof note !== 'string' || Array.from(note).length > 1000 || !Number.isInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 2147483646 || !/^[a-f0-9]{64}$/.test(expectedContentVersion)) throw new Error(MODERATION_ERRORS.invalid);
		return this.db.transaction(async manager => {
			// Serialize first inserts as well as updates; table names come only from the fixed map.
			await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`hatady-review:${targetType}:${targetId}`]);
			const sourceRows: { id: string }[] = await manager.query(`SELECT id FROM "${TABLES[targetType]}" WHERE id=$1 FOR SHARE`, [targetId]);
			if (!sourceRows.length) throw new Error(MODERATION_ERRORS.missing);
			const current = await this.raw(targetType, targetId, manager);
			if (!current) throw new Error(MODERATION_ERRORS.missing);
			if (current.revision !== expectedRevision || current.contentVersion !== expectedContentVersion) throw new Error(MODERATION_ERRORS.conflict);
			await manager.query(`INSERT INTO hatady_moderation_review ("targetType","targetId",state,note,revision,"contentVersion","reviewerId","reviewedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())
				ON CONFLICT ("targetType","targetId") DO UPDATE SET state=EXCLUDED.state,note=EXCLUDED.note,revision=EXCLUDED.revision,"contentVersion"=EXCLUDED."contentVersion","reviewerId"=EXCLUDED."reviewerId","reviewedAt"=EXCLUDED."reviewedAt"`,
			[targetType, targetId, state, note, expectedRevision + 1, expectedContentVersion, viewer.id]);
			return this.detail(viewer, targetType, targetId, manager);
		});
	}
}
