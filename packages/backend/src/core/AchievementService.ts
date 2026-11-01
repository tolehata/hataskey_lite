/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository, UtageSessionsRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ACHIEVEMENT_TYPES, MiUserProfile } from '@/models/UserProfile.js';

export const UTAGE_ACHIEVEMENT_MILESTONES = [
	{ count: 10, success: 'utageSuccess10', interruption: 'utageInterruption10' },
	{ count: 20, success: 'utageSuccess20', interruption: 'utageInterruption20' },
	{ count: 30, success: 'utageSuccess30', interruption: 'utageInterruption30' },
	{ count: 40, success: 'utageSuccess40', interruption: 'utageInterruption40' },
	{ count: 50, success: 'utageSuccess50', interruption: 'utageInterruption50' },
	{ count: 60, success: 'utageSuccess60', interruption: 'utageInterruption60' },
	{ count: 70, success: 'utageSuccess70', interruption: 'utageInterruption70' },
	{ count: 80, success: 'utageSuccess80', interruption: 'utageInterruption80' },
	{ count: 90, success: 'utageSuccess90', interruption: 'utageInterruption90' },
	{ count: 100, success: 'utageSuccess100', interruption: 'utageInterruption100' },
] as const satisfies readonly {
	count: number;
	success: typeof ACHIEVEMENT_TYPES[number];
	interruption: typeof ACHIEVEMENT_TYPES[number];
}[];

export type UtageAchievementScope = 'all' | 'success' | 'interruption';

export function getUtageAchievementTypesForCounts(
	successCount: number,
	interruptionCount: number,
	scope: UtageAchievementScope = 'all',
): typeof ACHIEVEMENT_TYPES[number][] {
	const achievements: typeof ACHIEVEMENT_TYPES[number][] = [];
	for (const milestone of UTAGE_ACHIEVEMENT_MILESTONES) {
		if (scope !== 'interruption' && successCount >= milestone.count) achievements.push(milestone.success);
		if (scope !== 'success' && interruptionCount >= milestone.count) achievements.push(milestone.interruption);
	}
	return achievements;
}

@Injectable()
export class AchievementService {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.utageSessionsRepository)
		private utageSessionsRepository: UtageSessionsRepository,

		private notificationService: NotificationService,
	) {
	}

	@bindThis
	private countUtageSessions(
		actorColumn: 'session.userId' | 'session.interruptedByUserId',
		userId: MiUser['id'],
		status: 'succeeded' | 'failed',
		interruptedWithin5Seconds = false,
	): Promise<number> {
		const query = this.utageSessionsRepository.createQueryBuilder('session')
			.innerJoin('session.note', 'note')
			.where(`${actorColumn} = :userId`, { userId })
			.andWhere('session.status = :status', { status })
			.andWhere('note.visibility = :visibility', { visibility: 'public' });
		if (interruptedWithin5Seconds) {
			query.andWhere('session.interruptedWithin5Seconds = :interruptedWithin5Seconds', { interruptedWithin5Seconds: true });
		}
		return query.getCount();
	}

	/**
	 * DB に確定済みの宴回数から、未解除の10回刻み実績を補完する。
	 * 既存データの遡及付与にも、成功・阻止が確定した直後の付与にも同じ集計を使う。
	 */
	@bindThis
	public async reconcileUtageAchievements(
		userId: MiUser['id'],
		scope: UtageAchievementScope = 'all',
	): Promise<void> {
		const [successCount, interruptionCount, quickInterruptionCount] = await Promise.all([
			scope === 'interruption' ? Promise.resolve(0) : this.countUtageSessions('session.userId', userId, 'succeeded'),
			scope === 'success' ? Promise.resolve(0) : this.countUtageSessions('session.interruptedByUserId', userId, 'failed'),
			scope === 'success' ? Promise.resolve(0) : this.countUtageSessions('session.interruptedByUserId', userId, 'failed', true),
		]);

		const achievementTypes = getUtageAchievementTypesForCounts(successCount, interruptionCount, scope);
		if (quickInterruptionCount > 0) achievementTypes.push('utageInterruptionWithin5Seconds');
		await this.createMany(userId, achievementTypes);
	}

	@bindThis
	private async createMany(
		userId: MiUser['id'],
		types: readonly (typeof ACHIEVEMENT_TYPES[number])[],
	): Promise<void> {
		const requested = [...new Set(types)].filter(type => ACHIEVEMENT_TYPES.includes(type));
		if (requested.length === 0) return;

		// 再照合のたびにプロフィール行をロックしないよう、すべて解除済みなら先に抜ける。
		// 未解除候補がある場合は下のtransaction内でも再確認し、並行付与との競合を防ぐ。
		const currentProfile = await this.userProfilesRepository.findOneByOrFail({ userId });
		const currentAchievements = new Set(currentProfile.achievements.map(achievement => achievement.name));
		if (requested.every(type => currentAchievements.has(type))) return;

		// 宴の遡及付与では最大20件を同時に満たし得る。プロフィール行をロックして
		// 未解除分だけを一括追記し、別workerやログイン実績とのread-modify-write競合を防ぐ。
		const created = await this.userProfilesRepository.manager.transaction(async manager => {
			const profiles = manager.getRepository(MiUserProfile);
			const profile = await profiles.findOneOrFail({
				where: { userId },
				lock: { mode: 'pessimistic_write' },
			});
			const claimed = new Set(profile.achievements.map(achievement => achievement.name));
			const missing = requested.filter(type => !claimed.has(type));
			if (missing.length === 0) return [];

			const unlockedAt = Date.now();
			await profiles.update(userId, {
				achievements: [
					...profile.achievements,
					...missing.map(name => ({ name, unlockedAt })),
				],
			});
			return missing;
		});

		for (const achievement of created) {
			this.notificationService.createNotification(userId, 'achievementEarned', {
				achievement,
			});
		}
	}

	@bindThis
	public async create(
		userId: MiUser['id'],
		type: typeof ACHIEVEMENT_TYPES[number],
	): Promise<void> {
		await this.createMany(userId, [type]);
	}
}
