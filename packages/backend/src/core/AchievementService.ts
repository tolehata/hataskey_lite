/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ACHIEVEMENT_TYPES, MiUserProfile } from '@/models/UserProfile.js';

@Injectable()
export class AchievementService {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private notificationService: NotificationService,
	) {
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
