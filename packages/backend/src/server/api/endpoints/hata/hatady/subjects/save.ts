/*
 * 旗鯖fork(Hatady): 分野(subject)の色を設定/明示登録する(upsert)。
 *   color=null または不正な色で自動割当に戻す。存在しない名前は新規登録される。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	res: { type: 'object', optional: false, nullable: false },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		originalName: { type: 'string', minLength: 1, maxLength: 128 },
		color: { type: 'string', nullable: true, maxLength: 16 },
	},
	required: ['name'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return this.hatadyService.saveSubject(me.id, ps.name, ps.color, ps.originalName);
		});
	}
}
