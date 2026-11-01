/*
 * 旗鯖fork(Hatady): 本人の学習データを横断検索する(ログ/本/内容メモ/しおりメモ)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'object', optional: false, nullable: false },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', minLength: 2, maxLength: 128 },
		types: { type: 'array', items: { type: 'string', enum: ['logs', 'books', 'bookMemos', 'bookmarks', 'mediaWorks', 'mediaSessions'] }, nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 30, default: 15 },
	},
	required: ['query'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return this.hatadyService.search(me.id, ps.query, ps.types ?? null, ps.limit);
		});
	}
}
