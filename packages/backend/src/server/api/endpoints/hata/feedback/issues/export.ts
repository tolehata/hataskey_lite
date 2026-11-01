import ms from 'ms';
/*
 * 旗鯖fork: HataFeed のイシュー一覧(タイトル・本文・会話・ステータス等)を
 *   AIが読みやすい構造化JSONでエクスポートする。
 *   エクスポートできるのは鯖缶(管理者/モデレーター)とプロジェクト作成者のみ。
 */
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository, FeedbackCommentsRepository, FeedbackProjectsRepository, UsersRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '5172e8df-1f3a-4b6c-8d9e-0a1b2c3d4e5f' },
		exportDenied: { message: 'Only the server staff or the project owner can export.', code: 'HATAFEED_EXPORT_DENIED', id: '628390e1-2a4b-4c7d-9e0f-1b2c3d4e5f60' },
		invalidRange: { message: 'The export range is invalid.', code: 'HATAFEED_EXPORT_INVALID_RANGE', id: '89cb7bbc-f8ac-4a8a-bf71-c9c5793d66b2' },
	},
	limit: { duration: ms('1hour'), max: 10 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// null/未指定 = 公式(インスタンス本体)のフィードバック。鯖缶のみエクスポート可。
		projectId: { type: 'string', format: 'misskey:id', nullable: true },
		numberFrom: { type: 'integer', minimum: 1 },
		numberTo: { type: 'integer', minimum: 1 },
		createdFrom: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T', maxLength: 64 },
		createdTo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T', maxLength: 64 },
		closedState: { type: 'string', enum: ['all', 'open', 'closed'], default: 'all' },
		statuses: {
			type: 'array',
			items: { type: 'string', enum: ['open', 'planned', 'nextFixConfirmed', 'nextFixPlanned', 'inProgress', 'monitoring', 'resolved', 'wontfix', 'unknown', 'closed'] },
			minItems: 1,
			maxItems: 10,
			uniqueItems: true,
		},
		categories: {
			type: 'array',
			items: { type: 'string', enum: ['bug', 'improvement', 'unresolved', 'featureRequest', 'adoptionRequest', 'security', 'betaFeature', 'other'] },
			minItems: 1,
			maxItems: 8,
			uniqueItems: true,
		},
		includeDescription: { type: 'boolean', default: true },
		includeComments: { type: 'boolean', default: true },
		includeCode: { type: 'boolean', default: true },
		includeResolution: { type: 'boolean', default: true },
		includeAuthors: { type: 'boolean', default: true },
		includeStats: { type: 'boolean', default: true },
		// v1 クライアントとの互換用。新UIは closedState を使用する。
		includeClosed: { type: 'boolean', default: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const projectId = ps.projectId ?? null;
			if (!await this.feedbackService.canExport(me.id, projectId)) throw new ApiError(meta.errors.exportDenied);
			if (ps.numberFrom != null && ps.numberTo != null && ps.numberFrom > ps.numberTo) throw new ApiError(meta.errors.invalidRange);
			const createdFrom = ps.createdFrom != null ? new Date(ps.createdFrom) : null;
			const createdTo = ps.createdTo != null ? new Date(ps.createdTo) : null;
			if ((createdFrom != null && !Number.isFinite(createdFrom.getTime())) || (createdTo != null && !Number.isFinite(createdTo.getTime()))) throw new ApiError(meta.errors.invalidRange);
			if (createdFrom != null && createdTo != null && createdFrom.getTime() > createdTo.getTime()) throw new ApiError(meta.errors.invalidRange);

			// 対象イシュー(番号順)。
			const issueQuery = this.feedbackIssuesRepository.createQueryBuilder('issue')
				.where(projectId != null ? 'issue.projectId = :projectId' : 'issue.projectId IS NULL', { projectId });
			if (ps.numberFrom != null) issueQuery.andWhere('issue.number >= :numberFrom', { numberFrom: ps.numberFrom });
			if (ps.numberTo != null) issueQuery.andWhere('issue.number <= :numberTo', { numberTo: ps.numberTo });
			if (createdFrom != null) issueQuery.andWhere('issue.createdAt >= :createdFrom', { createdFrom });
			if (createdTo != null) issueQuery.andWhere('issue.createdAt <= :createdTo', { createdTo });
			if (ps.closedState === 'open' || (ps.closedState === 'all' && !ps.includeClosed)) issueQuery.andWhere('issue.closed = FALSE');
			if (ps.closedState === 'closed') issueQuery.andWhere('issue.closed = TRUE');
			if (ps.statuses != null) issueQuery.andWhere('issue.status IN (:...statuses)', { statuses: ps.statuses });
			if (ps.categories != null) issueQuery.andWhere('issue.category IN (:...categories)', { categories: ps.categories });
			// セキュリティ対応カテゴリは一覧・詳細と同様、非スタッフには存在ごと返さない。
			if (!await this.feedbackService.isStaff(me.id)) issueQuery.andWhere('issue.category != :securityCategory', { securityCategory: 'security' });
			const issues = await issueQuery.orderBy('issue.number', 'ASC').getMany();

			// 会話を含める場合だけ一括取得する。不要なエクスポートでは本文量とDB負荷を抑える。
			const issueIds = issues.map(i => i.id);
			const comments = ps.includeComments && issueIds.length > 0
				? await this.feedbackCommentsRepository.createQueryBuilder('c')
					.where('c.feedbackId IN (:...issueIds)', { issueIds })
					.orderBy('c.id', 'ASC')
					.getMany()
				: [];

			// 投稿者名を含める場合だけユーザーを解決する。
			const userIds = new Set<string>();
			if (ps.includeAuthors) {
				for (const i of issues) if (i.createdById) userIds.add(i.createdById);
				for (const c of comments) userIds.add(c.userId);
			}
			const users = userIds.size > 0 ? await this.usersRepository.findBy({ id: In([...userIds]) }) : [];
			const userMap = new Map(users.map(u => [u.id, u.host ? `@${u.username}@${u.host}` : `@${u.username}`]));

			const commentsByIssue = new Map<string, typeof comments>();
			for (const c of comments) {
				const arr = commentsByIssue.get(c.feedbackId) ?? [];
				arr.push(c);
				commentsByIssue.set(c.feedbackId, arr);
			}

			const project = projectId != null ? await this.feedbackProjectsRepository.findOneBy({ id: projectId }) : null;

			return {
				schema: 'hatafeed-issues-export/v2',
				exportedAt: new Date().toISOString(),
				project: project != null
					? { id: project.id, name: project.name, description: project.description, url: project.url }
					: { id: null, name: '公式フィードバック (Hataskey)', description: '', url: null },
				issueCount: issues.length,
				selection: {
					numberFrom: ps.numberFrom ?? null,
					numberTo: ps.numberTo ?? null,
					createdFrom: ps.createdFrom ?? null,
					createdTo: ps.createdTo ?? null,
					closedState: ps.closedState,
					statuses: ps.statuses ?? null,
					categories: ps.categories ?? null,
				},
				includedContent: {
					description: ps.includeDescription,
					comments: ps.includeComments,
					code: ps.includeCode,
					resolution: ps.includeResolution,
					authors: ps.includeAuthors,
					stats: ps.includeStats,
				},
				issues: issues.map(issue => ({
					number: issue.number,
					title: issue.title,
					category: issue.category,
					status: issue.status,
					priority: issue.priority,
					closed: issue.closed,
					pinned: issue.pinned,
					createdAt: issue.createdAt.toISOString(),
					updatedAt: issue.updatedAt.toISOString(),
					...(ps.includeDescription ? { description: issue.description } : {}),
					...(ps.includeStats ? { agreementsCount: issue.agreementsCount, commentsCount: issue.commentsCount } : {}),
					...(ps.includeCode ? { code: issue.code ?? null } : {}),
					...(ps.includeResolution ? { resolutionNote: issue.resolutionNote ?? null } : {}),
					...(ps.includeAuthors ? { author: issue.createdById ? (userMap.get(issue.createdById) ?? null) : null } : {}),
					...(ps.includeComments ? {
						comments: (commentsByIssue.get(issue.id) ?? []).map(c => ({
							id: c.id,
							...(ps.includeAuthors ? { author: userMap.get(c.userId) ?? null } : {}),
							text: c.text,
							replyToId: c.replyToId,
							mark: c.mark,
							createdAt: c.createdAt.toISOString(),
						})),
					} : {}),
				})),
			};
		});
	}
}
