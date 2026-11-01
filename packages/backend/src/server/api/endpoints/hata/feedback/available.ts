/*
 * 旗鯖fork: HataFeed を利用できるか(ロールポリシー canAccessHataFeed / スタッフ)を返す。
 * フロントのロールゲート(使用できない場合「この機能は現在解放されていません」表示)に使う。
 */
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackService } from '@/core/FeedbackService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			available: { type: 'boolean', optional: false, nullable: false },
			isStaff: { type: 'boolean', optional: false, nullable: false },
		},
	},
	// 旗鯖fork(セキュリティ): フロントでロールゲート判定に多用するため、やや緩めの 1分120回。
	limit: { duration: ms('1min'), max: 120 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return {
				available: await this.feedbackService.canAccess(me.id),
				isStaff: await this.feedbackService.isStaff(me.id),
			};
		});
	}
}
