/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import type { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: { type: 'object', optional: false, nullable: false, properties: {
		source: { type: 'string', enum: ['mine', 'recent'], optional: false, nullable: false },
		issues: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
	} },
	errors: { accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '019ad16d-d9f9-4c88-8d58-98d973b21e88' } },
} as const;
export const paramDef = { type: 'object', properties: {}, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository) private issuesRepository: FeedbackIssuesRepository,
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (_ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			const mine = await this.visibleLatest(me.id, me.id);
			const selected = mine.length ? mine : await this.visibleLatest(me.id);
			return { source: mine.length ? 'mine' : 'recent', issues: await this.feedbackEntityService.packIssues(selected, me) };
		});
	}

	private async visibleLatest(userId: string, createdById?: string): Promise<MiFeedbackIssue[]> {
		const selected: MiFeedbackIssue[] = [];
		let untilId: string | null = null;
		while (selected.length < 4) {
			const query = this.issuesRepository.createQueryBuilder('issue');
			query.where('issue.closed = FALSE');
			if (createdById) {
				query.andWhere('issue.createdById = :createdById', { createdById });
				query.andWhere('issue.status NOT IN (:...finishedStatuses)', { finishedStatuses: ['resolved', 'wontfix'] });
			}
			if (untilId) query.andWhere('issue.id < :untilId', { untilId });
			const page = await query.orderBy('issue.id', 'DESC').limit(50).getMany();
			if (page.length === 0) break;
			for (const issue of page) {
				if (await this.feedbackService.canViewIssue(userId, issue)) selected.push(issue);
				if (selected.length === 4) break;
			}
			if (page.length < 50) break;
			untilId = page[page.length - 1].id;
		}
		return selected;
	}
}
