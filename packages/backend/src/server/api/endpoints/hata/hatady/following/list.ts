/*
 * 旗鯖fork(1c): 対象ユーザーがフォロー中(type=following) / フォロワー(type=followers)の一覧。
 *   各ユーザーに、閲覧者自身がフォローしているか(isFollowing)を付与する。
 */
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { UsersRepository, HatadyFollowingsRepository } from '@/models/_.js';
import { HatadyService } from '@/core/HatadyService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id', nullable: true },
		type: { type: 'string', enum: ['following', 'followers'], default: 'following' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,
		@Inject(DI.hatadyFollowingsRepository)
		private hatadyFollowingsRepository: HatadyFollowingsRepository,

		private hatadyService: HatadyService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const targetId = ps.userId ?? me.id;
			const ids = ps.type === 'followers'
				? await this.hatadyService.getFollowerUserIds(targetId)
				: await this.hatadyService.getFollowingUserIds(targetId);
			if (ids.length === 0) return [];

			const users = await this.usersRepository.findBy({ id: In(ids) });
			const packed = await this.userEntityService.packMany(users, me);
			const packedMap = new Map(packed.map(u => [u.id, u]));

			// 閲覧者自身がフォローしている相手を判定。
			const myFollowRows = await this.hatadyFollowingsRepository.createQueryBuilder('f')
				.where('f.followerId = :me', { me: me.id })
				.andWhere('f.followeeId IN (:...ids)', { ids })
				.getMany();
			const iFollow = new Set(myFollowRows.map(r => r.followeeId));

			// 元の並び(新しい順)を維持。
			return ids
				.map(id => packedMap.get(id))
				.filter((u): u is NonNullable<typeof u> => u != null)
				.map(u => ({ user: u, isFollowing: iFollow.has(u.id), isMe: u.id === me.id }));
		});
	}
}
