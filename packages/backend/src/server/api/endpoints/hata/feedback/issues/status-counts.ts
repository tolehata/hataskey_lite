/*
 * 旗鯖fork: HataFeed のイシュー一覧の「対応状況」に出す状態別件数。
 *   一覧と同じ絞り込み(状態以外)で数えるので、状態で絞り込んでも他の数値は変わらない。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository, FeedbackProjectsRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { applyFeedbackIssueListFilter } from '@/misc/feedback-issue-list-filter.js';

const STATUSES = ['open', 'planned', 'nextFixConfirmed', 'nextFixPlanned', 'inProgress', 'monitoring', 'resolved', 'wontfix', 'unknown', 'closed'] as const;
const countSchema = { type: 'integer', optional: false, nullable: false } as const;

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			total: countSchema,
			open: countSchema,
			planned: countSchema,
			nextFixConfirmed: countSchema,
			nextFixPlanned: countSchema,
			inProgress: countSchema,
			monitoring: countSchema,
			resolved: countSchema,
			wontfix: countSchema,
			unknown: countSchema,
			closed: countSchema,
		},
	},
	errors: {
		accessDenied: {
			message: 'HataFeed is not available for your account.',
			code: 'HATAFEED_ACCESS_DENIED',
			id: '3f0f3b8e-5f1d-4c52-9a86-7c2d4b1e9a10',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		projectId: { type: 'string', format: 'misskey:id', nullable: true },
		category: { type: 'string', nullable: true },
		createdById: { type: 'string', format: 'misskey:id', nullable: true },
		query: { type: 'string', nullable: true },
		includeClosed: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const counts = { total: 0, ...Object.fromEntries(STATUSES.map(status => [status, 0])) } as Record<'total' | typeof STATUSES[number], number>;

			// 一覧と同じく、閲覧できないサスペンド中プロジェクトは 0 件として返す。
			if (ps.projectId != null) {
				const project = await this.feedbackProjectsRepository.findOneBy({ id: ps.projectId });
				if (project != null && !await this.feedbackService.canViewProject(me.id, project)) return counts;
			}

			const query = this.feedbackIssuesRepository.createQueryBuilder('issue')
				.select('issue.status', 'status')
				.addSelect('COUNT(*)', 'count')
				.groupBy('issue.status');
			applyFeedbackIssueListFilter(query, { ...ps, status: null }, await this.feedbackService.isStaff(me.id));

			for (const row of await query.getRawMany<{ status: string; count: string }>()) {
				const count = Number(row.count);
				counts.total += count;
				if (row.status in counts) counts[row.status as typeof STATUSES[number]] = count;
			}
			return counts;
		});
	}
}
