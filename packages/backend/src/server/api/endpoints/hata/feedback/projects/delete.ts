/*
 * 旗鯖fork: HataFeed のプロジェクトを削除する(スタッフのみ・公式プロジェクトは不可)。
 */
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackProjectsRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '1d3e4fab-392c-4adc-26c7-9f1425a6b7c8' },
		staffOnly: { message: 'Only staff can manage projects.', code: 'HATAFEED_PROJECT_STAFF_ONLY', id: '2e4f5abc-4a3d-4bed-37d8-0a25a6b7c8d9' },
		noSuchProject: { message: 'No such project.', code: 'HATAFEED_NO_SUCH_PROJECT', id: '3f506bcd-5b4e-4cfe-48e9-1b36b7c8d9ea' },
		cannotDeleteOfficial: { message: 'Cannot delete the official project.', code: 'HATAFEED_CANNOT_DELETE_OFFICIAL', id: '40617cde-6c5f-4daf-59fa-2c47c8d9eafb' },
	},
	// 旗鯖fork(セキュリティ): 破壊的操作のため、1時間あたり30回までに制限。
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		projectId: { type: 'string', format: 'misskey:id' },
	},
	required: ['projectId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			if (!await this.feedbackService.isStaff(me.id)) throw new ApiError(meta.errors.staffOnly);

			const project = await this.feedbackProjectsRepository.findOneBy({ id: ps.projectId });
			if (project == null) throw new ApiError(meta.errors.noSuchProject);
			if (project.isOfficial) throw new ApiError(meta.errors.cannotDeleteOfficial);

			await this.feedbackService.deleteProject(project.id);
		});
	}
}
