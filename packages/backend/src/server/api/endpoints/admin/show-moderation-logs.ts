/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { MiModerationLog, ModerationLogsRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import { DI } from '@/di-symbols.js';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { moderatorLogInfoSql } from '@/misc/moderation-log-visibility.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'read:admin:show-moderation-log',
	limit: { duration: 60000, max: 60 },

	errors: {
		accessDenied: {
			message: 'Moderator access required.',
			code: 'ACCESS_DENIED',
			id: '21d10c8d-21af-4663-b146-3ab43e7e1bb2',
			kind: 'permission',
			httpStatusCode: 403,
		},
	},

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
					format: 'date-time',
				},
				type: {
					type: 'string',
					optional: false, nullable: false,
				},
				info: {
					type: 'object',
					optional: false, nullable: false,
				},
				isRedacted: {
					type: 'boolean',
					optional: false, nullable: false,
				},
				userId: {
					type: 'string',
					optional: false, nullable: false,
					format: 'id',
				},
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserLite',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		type: { type: 'string', nullable: true },
		userId: { type: 'string', format: 'misskey:id', nullable: true },
		applicationId: { type: 'string', format: 'misskey:id', maxLength: 32, nullable: true },
		search: { type: 'string', maxLength: 256, nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.moderationLogsRepository)
		private moderationLogsRepository: ModerationLogsRepository,

		private moderationLogEntityService: ModerationLogEntityService,
		private queryService: QueryService,
		private registrationApplicationReviewService: RegistrationApplicationReviewService,
	) {
		super(meta, paramDef, async (ps, me, token, flashToken) => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defend direct executor calls as well as the credential-checked HTTP path.
			if (me == null || token != null || flashToken != null) throw new ApiError(meta.errors.accessDenied);
			const requireStaff = async () => {
				// This reads current role assignments and user state from the database,
				// including conditional roles, without the normal staff-role caches.
				const viewer = await this.registrationApplicationReviewService.getCurrentStaffMember(me.id);
				if (viewer == null) throw new ApiError(meta.errors.accessDenied);
				return viewer;
			};
			const { isAdministrator } = await requireStaff();
			const query = this.queryService.makePaginationQuery(this.moderationLogsRepository.createQueryBuilder('log'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate);

			if (ps.type != null) {
				query.andWhere('log.type = :type', { type: ps.type });
			}

			if (ps.userId != null) {
				query.andWhere('log.userId = :userId', { userId: ps.userId });
			}

			if (ps.applicationId != null) {
				// The registration-history filter follows the same visibility rules,
				// including for administrators: unrelated/unknown payloads cannot match.
				query.andWhere(`${moderatorLogInfoSql}->>'applicationId' = :applicationId`, { applicationId: ps.applicationId });
			}

			if (ps.search != null) {
				const escapedSearch = sqlLikeEscape(ps.search);
				query.andWhere(`${isAdministrator ? 'log.info' : moderatorLogInfoSql}::text ILIKE :search`, { search: `%${escapedSearch}%` });
			}

			query.limit(ps.limit);
			const logs = isAdministrator ? await query.getMany() : await query
				.select('log.id', 'id')
				.addSelect('log.type', 'type')
				.addSelect('log.userId', 'userId')
				.addSelect(moderatorLogInfoSql, 'info')
				.getRawMany<Pick<MiModerationLog, 'id' | 'type' | 'userId' | 'info'>>();

			const packed = await this.moderationLogEntityService.packMany(logs, { isAdministrator });
			// Do not return a previously selected administrator payload after demotion.
			const currentViewer = await requireStaff();
			if (isAdministrator && !currentViewer.isAdministrator) throw new ApiError(meta.errors.accessDenied);
			return packed;
		});
	}
}
