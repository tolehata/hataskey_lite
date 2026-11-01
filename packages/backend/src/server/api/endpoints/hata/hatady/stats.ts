/*
 * 旗鯖fork: Hatady マイログのヘッダ統計 + 学習ヒートマップ + 分野別フォーカスを取得する。
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
		// 旗鯖fork: 集計をユーザーのローカル日付で行うためのタイムゾーンオフセット(分)。
		//   Date#getTimezoneOffset と同符号(JST は -540)。省略時は UTC 基準。
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
			return await this.hatadyService.getStats(me.id, ps.tzOffset);
		});
	}
}
