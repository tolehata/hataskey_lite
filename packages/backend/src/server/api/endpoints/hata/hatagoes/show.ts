/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { BlockingsRepository, HataskEventsRepository, HataskFlowersRepository, HataskRsvpsRepository, UsersRepository } from '@/models/_.js';
import { ApiError } from '@/server/api/error.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HataskRecipeService } from '@/core/HataskRecipeService.js';
import { canViewHataskEvent } from '@/server/api/endpoints/hatask/events/_visibility.js';
import { packHataskEvent } from '@/server/api/endpoints/hatask/events/_shared.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: { type: 'object', optional: false, nullable: false, properties: {
		kind: { type: 'string', enum: ['event', 'flower', 'cookingRecord'], optional: false, nullable: false },
		item: { type: 'object', optional: false, nullable: false },
	} },
	errors: { noSuchItem: { message: 'No such HataGoes item.', code: 'NO_SUCH_HATAGOES_ITEM', id: '35642130-d2d7-4577-9701-869a320d1a24' } },
} as const;
export const paramDef = {
	type: 'object',
	properties: {
		kind: { type: 'string', enum: ['event', 'flower', 'cookingRecord'] },
		id: { type: 'string', format: 'misskey:id' },
	},
	required: ['kind', 'id'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskEventsRepository) private eventsRepository: HataskEventsRepository,
		@Inject(DI.hataskFlowersRepository) private flowersRepository: HataskFlowersRepository,
		@Inject(DI.hataskRsvpsRepository) private rsvpsRepository: HataskRsvpsRepository,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
		@Inject(DI.blockingsRepository) private blockingsRepository: BlockingsRepository,
		private queryService: QueryService,
		private userEntityService: UserEntityService,
		private recipeService: HataskRecipeService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.kind === 'event') {
				const event = await this.eventsRepository.findOneBy({ id: ps.id });
				if (event == null || !canViewHataskEvent(event, me.id)) throw new ApiError(meta.errors.noSuchItem);
				if (event.userId !== me.id && await this.blockingsRepository.exists({ where: [
					{ blockerId: me.id, blockeeId: event.userId }, { blockerId: event.userId, blockeeId: me.id },
				] })) throw new ApiError(meta.errors.noSuchItem);
				return { kind: ps.kind, item: await packHataskEvent(event, me.id, this.rsvpsRepository, this.usersRepository) };
			}
			if (ps.kind === 'cookingRecord') {
				const record = await this.recipeService.showCookingRecord(me, ps.id);
				if (record == null) throw new ApiError(meta.errors.noSuchItem);
				return { kind: ps.kind, item: record };
			}

			const query = this.flowersRepository.createQueryBuilder('flower')
				.innerJoinAndSelect('flower.user', 'user')
				.leftJoin('user_profile', 'profile', 'profile.userId = user.id')
				.where('flower.id = :flowerId', { flowerId: ps.id })
				.andWhere(new Brackets(qb => {
					qb.where('flower.userId = :viewerId', { viewerId: me.id });
					qb.orWhere(`flower.userId != :viewerId AND user.host IS NULL AND user.isSuspended = FALSE
						AND (profile.hataskFlowerVisibility = :publicVisibility
							OR (profile.hataskFlowerVisibility = :followersVisibility AND EXISTS (
								SELECT 1 FROM following fl WHERE fl."followerId" = :viewerId AND fl."followeeId" = flower."userId"
							)))`, { followersVisibility: 'followers', publicVisibility: 'public' });
				}));
			this.queryService.generateMutedUserQueryForUsers(query, me);
			this.queryService.generateBlockQueryForUsers(query, me);
			const flower = await query.getOne();
			if (flower == null || flower.user == null) throw new ApiError(meta.errors.noSuchItem);
			const [user] = await this.userEntityService.packMany([flower.user], me, { schema: 'UserLite' });
			if (user == null) throw new ApiError(meta.errors.noSuchItem);
			return { kind: ps.kind, item: {
				id: flower.id,
				clientFlowerId: flower.clientFlowerId,
				emoji: flower.emoji,
				name: flower.name,
				hanakotoba: flower.hanakotoba,
				harvestedAt: flower.harvestedAt.toISOString(),
				isOwner: flower.userId === me.id,
				user,
			} };
		});
	}
}
