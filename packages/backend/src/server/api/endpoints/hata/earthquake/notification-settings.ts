/*
 * 旗鯖fork: 地震・津波通知設定の取得。
 */
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EarthquakeService } from '@/core/EarthquakeService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
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
	// 旗鯖fork(セキュリティ): 設定画面の読取用途。1分60回に制限。
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private earthquakeService: EarthquakeService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return await this.earthquakeService.getSettings(me.id);
		});
	}
}
