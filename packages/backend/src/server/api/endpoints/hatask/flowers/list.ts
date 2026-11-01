/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { FollowingsRepository, HataskFlowersRepository, UserProfilesRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATASK_FLOWER_RATE_LIMITS, hataskFlowerSchema } from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATASK_FLOWER_RATE_LIMITS.read,
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			items: { type: 'array', optional: false, nullable: false, items: hataskFlowerSchema },
			total: { type: 'integer', optional: false, nullable: false, minimum: 0 },
			page: { type: 'integer', optional: false, nullable: false, minimum: 1 },
			totalPages: { type: 'integer', optional: false, nullable: false, minimum: 0 },
			myVisibility: { type: 'string', optional: false, nullable: false, enum: ['public', 'followers', 'private'] },
		},
		required: ['items', 'total', 'page', 'totalPages', 'myVisibility'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
		limit: { type: 'integer', minimum: 1, maximum: 24, default: 12 },
		order: { type: 'string', enum: ['newest', 'oldest'], default: 'newest' },
	},
	required: [],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskFlowersRepository)
		private hataskFlowersRepository: HataskFlowersRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
		private queryService: QueryService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const page = ps.page ?? 1;
			const limit = ps.limit ?? 12;
			const order = ps.order ?? 'newest';
			const followingQuery = this.followingsRepository.createQueryBuilder('following')
				.select('following.followeeId')
				.where('following.followerId = :followingViewerId', { followingViewerId: me.id })
				.andWhere('following.followeeId = user.id');

			const query = this.hataskFlowersRepository.createQueryBuilder('flower')
				.innerJoinAndSelect('flower.user', 'user')
				.innerJoin('user_profile', 'profile', 'profile.userId = user.id')
				.where('user.host IS NULL')
				.andWhere('user.isSuspended = FALSE')
				.andWhere('flower.userId != :viewerId', { viewerId: me.id })
				.andWhere(new Brackets(qb => {
					qb.where('profile.hataskFlowerVisibility = :publicVisibility', { publicVisibility: 'public' })
						.orWhere(`profile.hataskFlowerVisibility = :followersVisibility AND EXISTS (${ followingQuery.getQuery() })`, { followersVisibility: 'followers' });
				}));
			query.setParameters(followingQuery.getParameters());

			// コミュニティ表示は Misskey 本体のユーザー mute と双方向 block を共通判定で除外する。
			this.queryService.generateMutedUserQueryForUsers(query, me);
			this.queryService.generateBlockQueryForUsers(query, me);

			const total = await query.getCount();
			const flowers = await query
				.orderBy('flower.harvestedAt', order === 'oldest' ? 'ASC' : 'DESC')
				.addOrderBy('flower.id', order === 'oldest' ? 'ASC' : 'DESC')
				.limit(limit)
				.offset((page - 1) * limit)
				.getMany();

			const users = [...new Map(flowers.map(flower => [flower.userId, flower.user])).values()]
				.filter((user): user is NonNullable<typeof user> => user != null);
			const packedUsers = await this.userEntityService.packMany(users, me, { schema: 'UserLite' });
			const packedById = new Map(packedUsers.map(user => [user.id, user]));
			const myVisibility = await this.userProfilesRepository.findOneBy({ userId: me.id })
				.then(profile => profile?.hataskFlowerVisibility ?? 'public');

			return {
				items: flowers.map(flower => ({
					id: flower.id,
					clientFlowerId: flower.clientFlowerId,
					emoji: flower.emoji,
					name: flower.name,
					hanakotoba: flower.hanakotoba,
					harvestedAt: flower.harvestedAt.toISOString(),
					isOwner: flower.userId === me.id,
					user: packedById.get(flower.userId)!,
				})),
				total,
				page,
				totalPages: total === 0 ? 0 : Math.ceil(total / limit),
				myVisibility,
			};
		});
	}
}
