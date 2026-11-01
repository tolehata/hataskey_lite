/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { HatadyMediaCommentsRepository, HatadyMediaReactionsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MEDIA_ERRORS, mapMediaError } from '../_shared.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.read,
	res: {
		type: 'array', optional: false, nullable: false,
		items: {
			type: 'object', optional: false, nullable: false,
			properties: {
				id: { type: 'string', optional: false, nullable: false, format: 'misskey:id' },
				createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
				reaction: { type: 'string', optional: false, nullable: false },
				user: { type: 'object', optional: false, nullable: false, ref: 'UserLite' },
			},
		},
	},
	errors: MEDIA_ERRORS,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		targetType: { type: 'string', enum: ['work', 'session', 'comment'] },
		targetId: { type: 'string', format: 'misskey:id' },
		reaction: { type: 'string', minLength: 1, maxLength: 260 },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
	},
	required: ['targetType', 'targetId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hatadyMediaCommentsRepository)
		private commentsRepository: HatadyMediaCommentsRepository,
		@Inject(DI.hatadyMediaReactionsRepository)
		private reactionsRepository: HatadyMediaReactionsRepository,
		private hatadyMediaService: HatadyMediaService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me, token, flashToken) => {
			try {
				const staffAccess = token == null && flashToken == null;
				if (ps.targetType === 'work') {
					await this.hatadyMediaService.getVisibleWork(ps.targetId, me.id, staffAccess);
				} else if (ps.targetType === 'session') {
					await this.hatadyMediaService.getVisibleSession(ps.targetId, me.id, staffAccess);
				} else {
					const comment = await this.commentsRepository.findOneBy({ id: ps.targetId });
					if (comment == null || (comment.workId == null) === (comment.sessionId == null)) throw new Error(HatadyMediaService.ERR_NOT_FOUND);
					if (comment.sessionId != null) await this.hatadyMediaService.getVisibleSession(comment.sessionId, me.id, staffAccess);
					else await this.hatadyMediaService.getVisibleWork(comment.workId!, me.id, staffAccess);
				}

				const column = ps.targetType === 'work' ? 'workId' : ps.targetType === 'session' ? 'sessionId' : 'commentId';
				const query = this.reactionsRepository.createQueryBuilder('reaction')
					.where(`reaction.${column} = :targetId`, { targetId: ps.targetId });
				if (ps.reaction != null) query.andWhere('reaction.reaction = :reaction', { reaction: ps.reaction });
				if (ps.untilId != null) query.andWhere('reaction.id < :untilId', { untilId: ps.untilId });
				const reactions = await query.orderBy('reaction.id', 'DESC').take(ps.limit).getMany();
				const users = await this.userEntityService.packMany([...new Set(reactions.map(reaction => reaction.userId))], me, { schema: 'UserLite' });
				const usersById = new Map(users.map(user => [user.id, user]));
				return reactions.flatMap(reaction => {
					const user = usersById.get(reaction.userId);
					return user == null ? [] : [{ id: reaction.id, createdAt: reaction.createdAt.toISOString(), reaction: reaction.reaction, user }];
				});
			} catch (error) {
				return mapMediaError(error);
			}
		});
	}
}
