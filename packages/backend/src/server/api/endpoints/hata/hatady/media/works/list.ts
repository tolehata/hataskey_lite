import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { HATADY_MEDIA_DATE_TIME_PATTERN, MEDIA_ERRORS, mapMediaError } from '../_shared.js';
import { mediaWorkListSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'read:account', limit: HATADY_RATE_LIMITS.read, res: mediaWorkListSchema, errors: MEDIA_ERRORS } as const;
export const paramDef = {
	type: 'object',
	properties: {
		scope: { type: 'string', enum: ['mine', 'recent', 'public', 'following', 'all'] },
		userId: { type: 'string', format: 'misskey:id' },
		kind: { type: 'string', enum: ['movie', 'game', 'work'] },
		status: { type: 'string', enum: ['planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped'] },
		origin: { type: 'string', enum: ['domestic', 'foreign', 'co_production', 'other'] },
		viewingMode: { type: 'string', enum: ['dubbed', 'subtitled', 'original'] },
		isRecommended: { type: 'boolean' },
		minRecommendation: { type: 'integer', minimum: 0, maximum: 10 },
		sessionKind: { type: 'string', enum: ['movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'] },
		result: { type: 'string', minLength: 1, maxLength: 64 },
		weapon: { type: 'string', minLength: 1, maxLength: 512 },
		rank: { type: 'string', minLength: 1, maxLength: 512 },
		route: { type: 'string', minLength: 1, maxLength: 512 },
		since: { type: 'string', minLength: 20, maxLength: 35, pattern: HATADY_MEDIA_DATE_TIME_PATTERN },
		until: { type: 'string', minLength: 20, maxLength: 35, pattern: HATADY_MEDIA_DATE_TIME_PATTERN },
		sort: { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'releaseDate', 'releaseYear', 'status', 'recommendationRating'], default: 'createdAt' },
		order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
		query: { type: 'string', maxLength: 256 },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
	},
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) {
		super(meta, paramDef, async (ps, me, token) => {
			try {
				if (ps.scope === 'all' && token != null) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
				return await this.service.packWorks(await this.service.listWorks(me.id, ps.userId ?? me.id, { ...ps, limit: ps.limit }), me.id, ps.scope === 'all');
			} catch (e) {
				return mapMediaError(e);
			}
		});
	}
}
