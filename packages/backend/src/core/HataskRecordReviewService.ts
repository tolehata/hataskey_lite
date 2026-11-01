/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { MiUser } from '@/models/User.js';
import { HATASK_REVIEW_STATES } from '@/models/HataskRecordReview.js';
import type { HataskReviewState } from '@/models/HataskRecordReview.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATASK_REVIEW_CTE, HATASK_REVIEW_ERRORS, normalizeReviewOptions, decodeReviewCursor, reviewHash, reviewFields } from './hatask-record-review.js';
import type { DataSource, EntityManager } from 'typeorm';
import type { HataskReviewOptions, HataskReviewRow, HataskReviewItem, ReviewCursor } from './hatask-record-review.js';

@Injectable()
export class HataskRecordReviewService {
	constructor(@Inject(DI.db) private db: DataSource, private roleService: RoleService, private userEntityService: UserEntityService) {}

	private async authorize(viewer: MiUser, token: unknown) {
		if (token != null || !viewer?.id || !await this.roleService.isModerator(viewer)) throw new ApiError(HATASK_REVIEW_ERRORS.denied);
	}
	private validateId(id: string) {
		if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(HATASK_REVIEW_ERRORS.invalid);
	}
	private async pack(rows: HataskReviewRow[], viewer: MiUser): Promise<HataskReviewItem[]> {
		const ids = [...new Set(rows.flatMap(row => [row.userId, ...(row.reviewerId ? [row.reviewerId] : [])]))];
		const users = await this.userEntityService.packMany(ids, viewer, { schema: 'UserLite' });
		const byId = new Map(users.map(user => [user.id, user]));
		return rows.map(row => {
			const user = byId.get(row.userId);
			if (!user) throw new ApiError(HATASK_REVIEW_ERRORS.missing);
			return {
				id: row.id, user, kind: row.kind, title: row.title, body: row.body,
				date: row.date, time: row.time, visibility: row.visibility, dateFallback: row.dateFallback,
				contentVersion: row.contentVersion, revision: row.revision, state: row.state, stale: row.stale,
				reviewer: row.reviewerId ? byId.get(row.reviewerId) ?? null : null, reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
			};
		});
	}

	@bindThis
	public async list(viewer: MiUser, input: HataskReviewOptions, token: unknown = null) {
		await this.authorize(viewer, token);
		const options = normalizeReviewOptions(input), filter = reviewHash(options), cursor = decodeReviewCursor(input.cursor, filter);
		const params: unknown[] = [], clauses: string[] = [];
		const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
		if (options.userId) clauses.push(`"userId"=${bind(options.userId)}`);
		if (options.visibility !== 'all') clauses.push(`visibility=${bind(options.visibility)}`);
		if (options.dateFrom) clauses.push(`date>=${bind(options.dateFrom)}`);
		if (options.dateTo) clauses.push(`date<=${bind(options.dateTo)}`);
		if (options.query) clauses.push(`normalize(concat_ws(' ',title,body,data::text,id,username,user_name),NFKC) ILIKE ${bind(`%${options.query.replace(/[\\%_]/g, value => `\\${value}`)}%`)}`);
		const kind = options.kind === 'all' ? 'TRUE' : `kind=${bind(options.kind)}`;
		const state = options.state === 'all' ? 'TRUE' : `state=${bind(options.state)}`;
		const direction = options.sort === 'newest' ? 'DESC' : 'ASC';
		const pageWhere = cursor ? `(date,time,id) ${options.sort === 'newest' ? '<' : '>'} (${bind(cursor.date)},${bind(cursor.time)},${bind(cursor.id)})` : 'TRUE';
		const limit = bind(options.limit + 1);
		const [result] = await this.db.query(`${HATASK_REVIEW_CTE}, base AS (SELECT * FROM reviewed WHERE ${clauses.join(' AND ') || 'TRUE'}),
			by_kind AS (SELECT * FROM base WHERE ${kind}), filtered AS (SELECT * FROM by_kind WHERE ${state}), page AS (
				SELECT id,"userId",kind,left(title,300) AS title,left(body,240) AS body,date,time,visibility,"dateFallback","contentVersion",revision,state,stale,"reviewerId","reviewedAt"
				FROM filtered WHERE ${pageWhere} ORDER BY date ${direction},time ${direction},id ${direction} LIMIT ${limit}
			) SELECT COALESCE((SELECT jsonb_agg(p ORDER BY date ${direction},time ${direction},id ${direction}) FROM page p),'[]'::jsonb) AS items,
			(SELECT count(*)::integer FROM filtered) AS total,
			COALESCE((SELECT jsonb_object_agg(kind,n) FROM (SELECT kind,count(*)::integer AS n FROM base GROUP BY kind) c),'{}'::jsonb) AS kinds,
			COALESCE((SELECT jsonb_object_agg(state,n) FROM (SELECT state,count(*)::integer AS n FROM by_kind GROUP BY state) c),'{}'::jsonb) AS states`, params);
		const page: HataskReviewRow[] = result.items.slice(0, options.limit), last = page.at(-1);
		return { items: await this.pack(page, viewer), total: result.total as number, kinds: result.kinds as Record<string, number>, states: result.states as Record<string, number>,
											nextCursor: result.items.length > options.limit && last ? Buffer.from(JSON.stringify({ filter, date: last.date, time: last.time, id: last.id } satisfies ReviewCursor)).toString('base64url') : null };
	}

	private async raw(id: string, db: Pick<EntityManager, 'query'> = this.db): Promise<HataskReviewRow> {
		const [row] = await db.query(`${HATASK_REVIEW_CTE} SELECT * FROM reviewed WHERE id=$1`, [id]);
		if (!row) throw new ApiError(HATASK_REVIEW_ERRORS.missing);
		return row;
	}
	private async detail(row: HataskReviewRow, viewer: MiUser) {
		const audienceIds = Array.isArray(row.data.visibleUserIds) ? [...new Set(row.data.visibleUserIds.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(id)))] : [];
		return { item: (await this.pack([row], viewer))[0], fields: reviewFields(row.data), audience: await this.userEntityService.packMany(audienceIds, viewer, { schema: 'UserLite' }) };
	}
	@bindThis
	public async show(viewer: MiUser, id: string, token: unknown = null) {
		await this.authorize(viewer, token); this.validateId(id);
		return this.detail(await this.raw(id), viewer);
	}
	@bindThis
	public async review(viewer: MiUser, input: { id: string; state: HataskReviewState; expectedRevision: number; expectedContentVersion: string }, token: unknown = null) {
		await this.authorize(viewer, token); this.validateId(input.id);
		if (!HATASK_REVIEW_STATES.includes(input.state) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= 2147483647 || !/^[a-f0-9]{64}$/.test(input.expectedContentVersion)) throw new ApiError(HATASK_REVIEW_ERRORS.invalid);
		const row = await this.db.transaction(async manager => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`hatask-review:${input.id}`]);
			const current = await this.raw(input.id, manager);
			if (current.revision !== input.expectedRevision || current.contentVersion !== input.expectedContentVersion) throw new ApiError(HATASK_REVIEW_ERRORS.conflict);
			await manager.query(`INSERT INTO hatask_record_review (id,"userId",state,"contentVersion",revision,"reviewerId","reviewedAt") VALUES ($1,$2,$3,$4,$5,$6,now())
				ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state,"contentVersion"=EXCLUDED."contentVersion",revision=EXCLUDED.revision,"reviewerId"=EXCLUDED."reviewerId","reviewedAt"=EXCLUDED."reviewedAt"`,
			[input.id, current.userId, input.state, current.contentVersion, current.revision + 1, viewer.id]);
			// If source content changed while reviewing, its fingerprint makes this unread.
			return this.raw(input.id, manager);
		});
		return this.detail(row, viewer);
	}
}
