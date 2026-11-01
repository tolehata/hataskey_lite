/*
 * 旗鯖fork(Hatady): 連続学習の詳細履歴(現在・最長・過去の連続期間)を返す。
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
		// 旗鯖fork: 連続日数をユーザーのローカル日付で判定するためのオフセット(分。JST は -540)。
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
			return this.hatadyService.getStreaks(me.id, ps.tzOffset);
		});
	}
}
