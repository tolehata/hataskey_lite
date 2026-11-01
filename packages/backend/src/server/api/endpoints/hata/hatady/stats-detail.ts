/*
 * 旗鯖fork(Hatady): 統計深掘り(月別/曜日/時間帯/分野推移/自己ベスト/月別読了)を返す。
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
		kind: { type: 'string', enum: ['all', 'study', 'movie', 'game', 'exercise', 'work', 'cooking'], default: 'all' },
		months: { type: 'integer', minimum: 1, maximum: 24, default: 6 },
		// 旗鯖fork: 月別/曜日/時間帯をユーザーの壁時計で集計するためのオフセット(分。JST は -540)。
		tzOffset: { type: 'integer', minimum: -840, maximum: 840, default: 0 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return this.hatadyService.getStatsDetail(me.id, ps.months, ps.tzOffset, ps.kind);
		});
	}
}
