/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackEmojiService } from '@/core/FeedbackEmojiService.js';
import { feedbackEmojiErrors } from '@/misc/feedback-emoji-errors.js';

export const meta = { tags: ['hata'], requireCredential: true, prohibitMoved: true, kind: 'write:account', errors: feedbackEmojiErrors, limit: { duration: 60000, max: 30 } } as const;
export const paramDef = {
	type: 'object',
	properties: { requestId: { type: 'string', format: 'misskey:id' }, reason: { type: 'string', maxLength: 1024, nullable: true } },
	required: ['requestId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(private feedbackEmojiService: FeedbackEmojiService) {
		super(meta, paramDef, async (ps, me) => this.feedbackEmojiService.cancel(me, ps.requestId, ps.reason));
	}
}
