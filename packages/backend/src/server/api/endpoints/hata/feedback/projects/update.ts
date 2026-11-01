/*
 * 旗鯖fork: HataFeed のプロジェクトを更新する(スタッフのみ)。
 */
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackProjectsRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'ea0b1c78-06ff-47a9-f394-7c8192031425' },
		staffOnly: { message: 'Only staff can manage projects.', code: 'HATAFEED_PROJECT_STAFF_ONLY', id: 'fb1c2d89-170a-48ba-04a5-8d92031425a6' },
		noSuchProject: { message: 'No such project.', code: 'HATAFEED_NO_SUCH_PROJECT', id: '0c2d3e9a-281b-49cb-15b6-9e031425a6b7' },
	},
	// 旗鯖fork(セキュリティ): スタッフ向け編集操作は連続編集を許容しつつスパム抑止。
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		projectId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', maxLength: 4096 },
		url: { type: 'string', maxLength: 512, nullable: true },
		iconFileId: { type: 'string', format: 'misskey:id', nullable: true },
		color: { type: 'string', maxLength: 16, nullable: true },
		genre: { type: 'string', maxLength: 128, nullable: true },
		// 旗鯖fork: サスペンド(一時停止)。true で owner/鯖缶以外に非表示。
		suspended: { type: 'boolean' },
	},
	required: ['projectId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			if (!await this.feedbackService.isStaff(me.id)) throw new ApiError(meta.errors.staffOnly);

			const project = await this.feedbackProjectsRepository.findOneBy({ id: ps.projectId });
			if (project == null) throw new ApiError(meta.errors.noSuchProject);

			await this.feedbackService.updateProject(project.id, {
				...(ps.name !== undefined ? { name: ps.name } : {}),
				...(ps.description !== undefined ? { description: ps.description } : {}),
				...(ps.url !== undefined ? { url: ps.url } : {}),
				...(ps.iconFileId !== undefined ? { iconFileId: ps.iconFileId } : {}),
				...(ps.color !== undefined ? { color: ps.color } : {}),
				...(ps.genre !== undefined ? { genre: ps.genre } : {}),
				...(ps.suspended !== undefined ? { suspended: ps.suspended } : {}),
			});

			return await this.feedbackEntityService.packProject(project.id);
		});
	}
}
