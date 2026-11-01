/*
 * 旗鯖fork(1c): Hatady プロフィールの個別設定(バナー色)を更新する(本人のみ)。
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
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// バナー色のプリセットキー(空文字/未指定で既定に戻す)。
		bannerColor: { type: 'string', maxLength: 32, nullable: true },
		design: { type: 'object', additionalProperties: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.hatadyService.updateProfile(me, { bannerColor: ps.bannerColor === undefined ? undefined : ps.bannerColor || null, design: ps.design });
		});
	}
}
