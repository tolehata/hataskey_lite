/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { FeedbackEmojiChangeRequestsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackEmojiService } from '@/core/FeedbackEmojiService.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { feedbackEmojiErrors } from '@/misc/feedback-emoji-errors.js';

export const meta = { tags: ['hata'], requireCredential: true, prohibitMoved: true, kind: 'write:account', errors: feedbackEmojiErrors, limit: { duration: 3600000, max: 30 }, res: { type: 'object', optional: false, nullable: false } } as const;
export const paramDef = {
	type: 'object',
	properties: {
		originalRequestId: { type: 'string', format: 'misskey:id' }, kind: { type: 'string', enum: ['updateImage', 'withdraw'] },
		reason: { type: 'string', minLength: 1, maxLength: 1024 }, fileId: { type: 'string', format: 'misskey:id', nullable: true }, license: { type: 'string', maxLength: 1024, nullable: true },
	}, required: ['originalRequestId', 'kind', 'reason'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.feedbackEmojiChangeRequestsRepository) private changes: FeedbackEmojiChangeRequestsRepository,
		private feedbackEmojiService: FeedbackEmojiService, private entities: FeedbackEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const id = await this.feedbackEmojiService.create(me, ps);
			return this.entities.packEmojiChangeRequest(await this.changes.findOneByOrFail({ id }));
		});
	}
}
