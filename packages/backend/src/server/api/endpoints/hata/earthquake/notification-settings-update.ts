import ms from 'ms';
/*
 * 旗鯖fork: 地震・津波通知設定の更新。
 *   居住地(pref)は「居住地のみ」モードを選んだ場合のみ、本人の同意の上でサーバーに保存する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EarthquakeService } from '@/core/EarthquakeService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			enabled: { type: 'boolean', optional: false, nullable: false },
			mode: { type: 'string', optional: false, nullable: false },
			threshold: { type: 'integer', optional: false, nullable: false },
			pref: { type: 'string', optional: false, nullable: true },
		},
	},
	limit: { duration: ms('1min'), max: 30 },
} as const;

// 旗鯖fork: 震度しきい値の許容値(10/20/30/40/45/50/55/60/70 はそれぞれ 1/2/3/4/5弱/5強/6弱/6強/7 に対応)。
//   JSON Schema 型定義の enum は ReadonlyArray<string | null> しか受け付けないため、
//   paramDef では型のみを宣言し、許容値チェックはサービス層(EarthquakeService.updateSettings)で行う。
export const paramDef = {
	type: 'object',
	properties: {
		enabled: { type: 'boolean' },
		mode: { type: 'string', enum: ['intensity', 'pref'] },
		threshold: { type: 'integer' },
		pref: { type: 'string', nullable: true, maxLength: 32 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private earthquakeService: EarthquakeService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.earthquakeService.updateSettings(me.id, {
				enabled: ps.enabled,
				mode: ps.mode,
				threshold: ps.threshold,
				pref: ps.pref,
			});
			return await this.earthquakeService.getSettings(me.id);
		});
	}
}
