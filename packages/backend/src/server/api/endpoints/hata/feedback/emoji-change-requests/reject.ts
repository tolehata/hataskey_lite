/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackEmojiService } from '@/core/FeedbackEmojiService.js';
import { feedbackEmojiErrors } from '@/misc/feedback-emoji-errors.js';

export const meta = { tags: ['hata'], requireCredential: true, requireModerator: true, prohibitMoved: true, secure: true, kind: 'write:admin', errors: feedbackEmojiErrors, limit: { duration: 60000, max: 60 } } as const;
export const paramDef = {
	type: 'object',
	properties: { requestId: { type: 'string', format: 'misskey:id' }, expectedUpdatedAt: { type: 'string', minLength: 20, maxLength: 32 }, comment: { type: 'string', minLength: 1, maxLength: 1024 } },
	required: ['requestId', 'expectedUpdatedAt', 'comment'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(private feedbackEmojiService: FeedbackEmojiService) {
		super(meta, paramDef, async (ps, me) => this.feedbackEmojiService.resolve(me, ps.requestId, 'rejected', ps.expectedUpdatedAt, ps.comment));
	}
}
