/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { HatadyCommentsRepository, HatadyReactionsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { HatadyService } from '@/core/HatadyService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';

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
	errors: {
		invalidTarget: {
			message: 'Specify exactly one of logId or commentId.',
			code: 'INVALID_TARGET',
			id: '0462a94e-402f-4993-9cf4-4837cc914df0',
		},
		noSuchTarget: {
			message: 'No such Hatady reaction target or access denied.',
			code: 'NO_SUCH_HATADY_REACTION_TARGET',
			id: '32464e49-b494-47c0-8f5a-227b36e305d1',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id', nullable: true },
		commentId: { type: 'string', format: 'misskey:id', nullable: true },
		reaction: { type: 'string', minLength: 1, maxLength: 260 },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hatadyCommentsRepository)
		private commentsRepository: HatadyCommentsRepository,
		@Inject(DI.hatadyReactionsRepository)
		private reactionsRepository: HatadyReactionsRepository,
		private hatadyService: HatadyService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me, token, flashToken) => {
			if ((ps.logId != null) === (ps.commentId != null)) throw new ApiError(meta.errors.invalidTarget);
			const comment = ps.commentId == null ? null : await this.commentsRepository.findOneBy({ id: ps.commentId });
			if (ps.commentId != null && comment == null) throw new ApiError(meta.errors.noSuchTarget);
			const log = await this.hatadyService.getLog(comment?.logId ?? ps.logId!);
			if (log == null || !(await this.hatadyService.canViewLog(log, me.id, token == null && flashToken == null))) throw new ApiError(meta.errors.noSuchTarget);

			const query = this.reactionsRepository.createQueryBuilder('reaction')
				.where(comment == null ? 'reaction.logId = :targetId' : 'reaction.commentId = :targetId', { targetId: comment?.id ?? log.id });
			if (ps.reaction != null) query.andWhere('reaction.reaction = :reaction', { reaction: ps.reaction });
			if (ps.untilId != null) query.andWhere('reaction.id < :untilId', { untilId: ps.untilId });
			const reactions = await query.orderBy('reaction.id', 'DESC').take(ps.limit).getMany();
			const users = await this.userEntityService.packMany([...new Set(reactions.map(reaction => reaction.userId))], me, { schema: 'UserLite' });
			const usersById = new Map(users.map(user => [user.id, user]));
			return reactions.flatMap(reaction => {
				const user = usersById.get(reaction.userId);
				return user == null ? [] : [{ id: reaction.id, createdAt: reaction.createdAt.toISOString(), reaction: reaction.reaction, user }];
			});
		});
	}
}
