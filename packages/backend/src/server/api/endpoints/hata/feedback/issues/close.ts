import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue をクローズ/再オープンする。
 * クローズできるのは管理者、またはその Issue に個別権限を付与されたモデレーターのみ。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: 'd9e8091a-f588-4698-f2b4-819203142536' },
		accessDenied: { message: 'You cannot manage this issue.', code: 'HATAFEED_MANAGE_DENIED', id: 'ea091b2c-0699-47a9-03c5-920314253647' },
	},
	limit: { duration: ms('1hour'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		close: { type: 'boolean', default: true },
	},
	required: ['issueId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);
			if (!await this.feedbackService.canManageIssue(me.id, issue)) throw new ApiError(meta.errors.accessDenied);

			if (ps.close) {
				await this.feedbackService.closeIssue(me, issue);
			} else {
				await this.feedbackService.reopenIssue(me, issue);
			}
		});
	}
}
