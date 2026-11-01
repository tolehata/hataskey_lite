import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue を更新する(ステータス/優先度/カテゴリ/ピン/解決メモ)。
 * 対処系の更新は管理者またはその Issue に個別権限を付与されたモデレーターのみ。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: 'fb1a2c3d-1700-48ba-14d6-031425364758' },
		accessDenied: { message: 'You cannot manage this issue.', code: 'HATAFEED_MANAGE_DENIED', id: '0c2b3d4e-2811-49cb-25e7-142536475869' },
	},
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		status: { type: 'string', enum: ['open', 'planned', 'nextFixConfirmed', 'nextFixPlanned', 'inProgress', 'monitoring', 'resolved', 'wontfix', 'unknown'] },
		category: { type: 'string', enum: ['bug', 'improvement', 'unresolved', 'featureRequest', 'adoptionRequest', 'security', 'other'] },
		priority: { type: 'string', enum: ['low', 'normal', 'high'] },
		pinned: { type: 'boolean' },
		resolutionNote: { type: 'string', maxLength: 4096, nullable: true },
	},
	required: ['issueId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);
			if (!await this.feedbackService.canManageIssue(me.id, issue)) throw new ApiError(meta.errors.accessDenied);

			// ステータス変更は通知込みでサービス経由。
			if (ps.status != null) {
				await this.feedbackService.setIssueStatus(me, issue, ps.status, ps.resolutionNote);
			}
			// 旗鯖fork(セキュリティ修正): スタッフ専用カテゴリ(security/improvement)への変更はスタッフのみ可。
			//   個別Issueモデレーター権限を持つ一般ユーザーがcategoryを書き換えて隠蔽攻撃するのを防ぐ。
			if (ps.category != null && (ps.category === 'security' || ps.category === 'improvement')) {
				if (!await this.feedbackService.isStaff(me.id)) throw new ApiError(meta.errors.accessDenied);
			}
			// それ以外のメタ更新。
			const patch: Record<string, unknown> = { updatedAt: new Date() };
			if (ps.category != null) patch.category = ps.category;
			if (ps.priority != null) patch.priority = ps.priority;
			if (ps.pinned != null) patch.pinned = ps.pinned;
			if (ps.status == null && ps.resolutionNote !== undefined) patch.resolutionNote = ps.resolutionNote;
			await this.feedbackIssuesRepository.update(issue.id, patch);

			return await this.feedbackEntityService.packIssue(ps.issueId, me);
		});
	}
}
