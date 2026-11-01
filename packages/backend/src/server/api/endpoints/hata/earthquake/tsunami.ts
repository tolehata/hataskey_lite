/*
 * 旗鯖fork: 発表済みの津波予報(code 552)の直近履歴を返す。
 *   データ出典: 気象庁 / P2P地震情報(P2PQuake)。サーバーが代理取得＋短時間キャッシュして配る。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EarthquakeService } from '@/core/EarthquakeService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private earthquakeService: EarthquakeService,
	) {
		super(meta, paramDef, async (ps) => {
			return await this.earthquakeService.getRecentTsunami(ps.limit) as Record<string, unknown>[];
		});
	}
}
