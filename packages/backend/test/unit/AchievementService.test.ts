/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { AchievementService } from '@/core/AchievementService.js';
import { ACHIEVEMENT_TYPES } from '@/models/UserProfile.js';
import ClaimAchievementEndpoint from '@/server/api/endpoints/i/claim-achievement.js';
import UsersAchievementsEndpoint, { meta as usersAchievementsMeta } from '@/server/api/endpoints/users/achievements.js';

describe('実績の付与', () => {
	test('解除済み実績の再付与ではtransactionと通知を発生させない', async () => {
		const profile = { achievements: [{ name: 'notes1', unlockedAt: 1 }] };
		const transaction = vi.fn();
		const service = new AchievementService(
			{ findOneByOrFail: vi.fn().mockResolvedValue(profile), manager: { transaction } } as never,
			{ createNotification: vi.fn() } as never,
		);

		await service.create('user-a', 'notes1');

		expect(transaction).not.toHaveBeenCalled();
	});

	test('事前確認後に並行付与されてもtransaction内で重複更新と通知を防ぐ', async () => {
		const lockedProfile = { achievements: [{ name: 'notes1', unlockedAt: 1 }] };
		const transactionalProfiles = {
			findOneOrFail: vi.fn().mockResolvedValue(lockedProfile),
			update: vi.fn(),
		};
		const notificationService = { createNotification: vi.fn() };
		const service = new AchievementService(
			{
				findOneByOrFail: vi.fn().mockResolvedValue({ achievements: [] }),
				manager: {
					transaction: vi.fn().mockImplementation(async callback => callback({
						getRepository: () => transactionalProfiles,
					})),
				},
			} as never,
			notificationService as never,
		);

		await service.create('user-a', 'notes1');

		expect(transactionalProfiles.update).not.toHaveBeenCalled();
		expect(notificationService.createNotification).not.toHaveBeenCalled();
	});

	test('撤去したLTLパンチの実績は自己申告APIで受け付けない', async () => {
		expect(ACHIEVEMENT_TYPES).not.toContain('ltlPunchVictory');
		expect(ACHIEVEMENT_TYPES).not.toContain('ltlPunchDefeat');

		const achievementService = { create: vi.fn().mockResolvedValue(undefined) };
		const endpoint = new ClaimAchievementEndpoint(achievementService as never);
		await expect(endpoint.exec({ name: 'ltlPunchVictory' }, { id: 'usera' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(achievementService.create).not.toHaveBeenCalled();

		await expect(endpoint.exec({ name: 'notes1' }, { id: 'usera' } as never, null, null)).resolves.toBeUndefined();
		expect(achievementService.create).toHaveBeenCalledWith('usera', 'notes1');
	});

	test('実績一覧は本人にも他人にも同じ全件を返す', async () => {
		const profile = { achievements: [{ name: 'notes1', unlockedAt: 1 }, { name: 'hataSideStudioPioneer', unlockedAt: 2 }] };
		const endpoint = new UsersAchievementsEndpoint({ findOneByOrFail: vi.fn().mockResolvedValue(profile) } as never);

		expect(usersAchievementsMeta.kind).toBe('read:account');
		await expect(endpoint.exec({ userId: 'usera' }, null, null, null)).resolves.toEqual(profile.achievements);
		await expect(endpoint.exec({ userId: 'usera' }, { id: 'usera' } as never, null, null)).resolves.toEqual(profile.achievements);
	});
});
