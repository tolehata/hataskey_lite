/*
 * 旗鯖fork(Hatady): 分野(subject)を削除する。
 *   reassignTo を指定すると、その分野が付いた本人の学習ログを付け替える(ログ自体は非破壊)。
 *   レジストリ行(色・明示登録)は削除する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.destructive,
	res: { type: 'object', optional: false, nullable: false },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		reassignTo: { type: 'string', nullable: true, maxLength: 128 },
	},
	required: ['name'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return this.hatadyService.deleteSubject(me.id, ps.name, ps.reassignTo ?? null);
		});
	}
}
