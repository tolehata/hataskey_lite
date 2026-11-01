/*
 * 旗鯖fork: HataFeed のプロジェクト一覧。公式プロジェクトと、自分が作成したプロジェクトを返す。
 * mine=true で自分のもののみ。
 */
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
	kind: 'read:account',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'd9eafb67-f5ee-4698-e283-647596a7b8c9' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		mine: { type: 'boolean', default: false },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
	},
	required: [],
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

			const query = this.feedbackProjectsRepository.createQueryBuilder('project');
			// mine 指定時は自分のプロジェクトのみ。それ以外は全プロジェクトを返す
			// (一般ユーザーも他の人のプロジェクトを閲覧できるようにする)。
			if (ps.mine) {
				query.where('project.ownerId = :me', { me: me.id });
			}

			// 旗鯖fork: サスペンド中のプロジェクトは、作成者・鯖缶(モデレーター)以外には出さない。
			if (!await this.feedbackService.isStaff(me.id)) {
				query.andWhere('(project.suspended = FALSE OR project.ownerId = :viewer)', { viewer: me.id });
			}

			query.orderBy('project.isOfficial', 'DESC').addOrderBy('project.id', 'DESC');

			const projects = await query.limit(ps.limit).getMany();
			return await Promise.all(projects.map(p => this.feedbackEntityService.packProject(p)));
		});
	}
}
