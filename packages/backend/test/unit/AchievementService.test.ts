/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import {
	AchievementService,
	getUtageAchievementTypesForCounts,
	UTAGE_ACHIEVEMENT_MILESTONES,
} from '@/core/AchievementService.js';
import { ACHIEVEMENT_TYPES, CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES } from '@/models/UserProfile.js';
import IEndpoint from '@/server/api/endpoints/i.js';
import ClaimAchievementEndpoint from '@/server/api/endpoints/i/claim-achievement.js';
import UsersAchievementsEndpoint, { meta as usersAchievementsMeta } from '@/server/api/endpoints/users/achievements.js';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

function queryBuilder(count: number) {
	const builder = {
		innerJoin: vi.fn(),
		where: vi.fn(),
		andWhere: vi.fn(),
		getCount: vi.fn().mockResolvedValue(count),
	};
	builder.innerJoin.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);
	builder.andWhere.mockReturnValue(builder);
	return builder;
}

describe('宴の回数実績', () => {
	test('10刻みで100までの成功・阻止実績だけを返す', () => {
		expect(UTAGE_ACHIEVEMENT_MILESTONES.map(x => x.count)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
		expect(getUtageAchievementTypesForCounts(9, 9)).toEqual([]);
		expect(getUtageAchievementTypesForCounts(25, 35)).toEqual([
			'utageSuccess10',
			'utageInterruption10',
			'utageSuccess20',
			'utageInterruption20',
			'utageInterruption30',
		]);
		expect(getUtageAchievementTypesForCounts(1000, 1000)).toHaveLength(20);
		expect(getUtageAchievementTypesForCounts(1000, 1000)).not.toContain('utageInterruptionWithin5Seconds');
	});

	test('既存DBの公開宴だけを集計し、到達済みの未解除実績をすべて補完する', async () => {
		const profile = { achievements: [] as { name: string; unlockedAt: number }[] };
		const transactionalProfiles = {
			findOneOrFail: vi.fn().mockResolvedValue(profile),
			update: vi.fn().mockImplementation((_userId, value) => {
				profile.achievements = value.achievements;
			}),
		};
		const userProfilesRepository = {
			findOneByOrFail: vi.fn().mockResolvedValue(profile),
			manager: {
				transaction: vi.fn().mockImplementation(async callback => callback({
					getRepository: () => transactionalProfiles,
				})),
			},
		};
		const successQuery = queryBuilder(25);
		const interruptionQuery = queryBuilder(35);
		const quickInterruptionQuery = queryBuilder(0);
		const utageSessionsRepository = {
			createQueryBuilder: vi.fn()
				.mockReturnValueOnce(successQuery)
				.mockReturnValueOnce(interruptionQuery)
				.mockReturnValueOnce(quickInterruptionQuery),
		};
		const notificationService = { createNotification: vi.fn() };
		const service = new AchievementService(
			userProfilesRepository as never,
			utageSessionsRepository as never,
			notificationService as never,
		);

		await service.reconcileUtageAchievements('user-a');

		expect(profile.achievements.map(x => x.name)).toEqual([
			'utageSuccess10',
			'utageInterruption10',
			'utageSuccess20',
			'utageInterruption20',
			'utageInterruption30',
		]);
		expect(notificationService.createNotification).toHaveBeenCalledTimes(5);
		expect(userProfilesRepository.manager.transaction).toHaveBeenCalledTimes(1);
		expect(transactionalProfiles.findOneOrFail).toHaveBeenCalledWith({
			where: { userId: 'user-a' },
			lock: { mode: 'pessimistic_write' },
		});
		expect(transactionalProfiles.update).toHaveBeenCalledTimes(1);
		for (const builder of [successQuery, interruptionQuery, quickInterruptionQuery]) {
			expect(builder.innerJoin).toHaveBeenCalledWith('session.note', 'note');
			expect(builder.andWhere).toHaveBeenCalledWith('note.visibility = :visibility', { visibility: 'public' });
		}
		expect(quickInterruptionQuery.andWhere).toHaveBeenCalledWith(
			'session.interruptedWithin5Seconds = :interruptedWithin5Seconds',
			{ interruptedWithin5Seconds: true },
		);
	});

	test('記録済みの5秒以内阻止を照合時に再取得し、一時的な付与失敗を修復できる', async () => {
		const profile = { achievements: [] as { name: string; unlockedAt: number }[] };
		const transactionalProfiles = {
			findOneOrFail: vi.fn().mockResolvedValue(profile),
			update: vi.fn().mockImplementation((_userId, value) => {
				profile.achievements = value.achievements;
			}),
		};
		const userProfilesRepository = {
			findOneByOrFail: vi.fn().mockResolvedValue(profile),
			manager: {
				transaction: vi.fn().mockImplementation(async callback => callback({
					getRepository: () => transactionalProfiles,
				})),
			},
		};
		const interruptionQuery = queryBuilder(1);
		const quickInterruptionQuery = queryBuilder(1);
		const utageSessionsRepository = {
			createQueryBuilder: vi.fn()
				.mockReturnValueOnce(interruptionQuery)
				.mockReturnValueOnce(quickInterruptionQuery),
		};
		const notificationService = { createNotification: vi.fn() };
		const service = new AchievementService(
			userProfilesRepository as never,
			utageSessionsRepository as never,
			notificationService as never,
		);

		await service.reconcileUtageAchievements('user-a', 'interruption');

		expect(profile.achievements.map(x => x.name)).toEqual(['utageInterruptionWithin5Seconds']);
		expect(notificationService.createNotification).toHaveBeenCalledOnce();
	});

	test('解除済み実績の再照合ではtransactionと通知を発生させない', async () => {
		const profile = { achievements: [{ name: 'utageSuccess10', unlockedAt: 1 }] };
		const transaction = vi.fn();
		const service = new AchievementService(
			{ findOneByOrFail: vi.fn().mockResolvedValue(profile), manager: { transaction } } as never,
			{} as never,
			{ createNotification: vi.fn() } as never,
		);

		await service.create('user-a', 'utageSuccess10');

		expect(transaction).not.toHaveBeenCalled();
	});

	test('事前確認後に並行付与されてもtransaction内で重複更新と通知を防ぐ', async () => {
		const lockedProfile = { achievements: [{ name: 'utageSuccess10', unlockedAt: 1 }] };
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
			{} as never,
			notificationService as never,
		);

		await service.create('user-a', 'utageSuccess10');

		expect(transactionalProfiles.update).not.toHaveBeenCalled();
		expect(notificationService.createNotification).not.toHaveBeenCalled();
	});

	test('成功確定時の照合では阻止回数を読まない', async () => {
		const profile = { achievements: [] as { name: string; unlockedAt: number }[] };
		const transactionalProfiles = {
			findOneOrFail: vi.fn().mockResolvedValue(profile),
			update: vi.fn().mockImplementation((_userId, value) => {
				profile.achievements = value.achievements;
			}),
		};
		const userProfilesRepository = {
			findOneByOrFail: vi.fn().mockResolvedValue(profile),
			manager: {
				transaction: vi.fn().mockImplementation(async callback => callback({
					getRepository: () => transactionalProfiles,
				})),
			},
		};
		const successQuery = queryBuilder(10);
		const utageSessionsRepository = { createQueryBuilder: vi.fn().mockReturnValue(successQuery) };
		const notificationService = { createNotification: vi.fn() };
		const service = new AchievementService(
			userProfilesRepository as never,
			utageSessionsRepository as never,
			notificationService as never,
		);

		await service.reconcileUtageAchievements('user-a', 'success');

		expect(utageSessionsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
		expect(profile.achievements.map(x => x.name)).toEqual(['utageSuccess10']);
	});

	test('宴実績はクライアントの自己申告APIから除外する', async () => {
		expect(ACHIEVEMENT_TYPES).toContain('utageSuccess10');
		expect(ACHIEVEMENT_TYPES).toContain('utageInterruptionWithin5Seconds');
		expect(CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES.some(type => type.startsWith('utage'))).toBe(false);

		const achievementService = { create: vi.fn().mockResolvedValue(undefined) };
		const endpoint = new ClaimAchievementEndpoint(achievementService as never);
		await expect(endpoint.exec({ name: 'utageSuccess10' }, { id: 'usera' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(achievementService.create).not.toHaveBeenCalled();

		await expect(endpoint.exec({ name: 'notes1' }, { id: 'usera' } as never, null, null)).resolves.toBeUndefined();
		expect(achievementService.create).toHaveBeenCalledWith('usera', 'notes1');
	});

	test('他人向け実績一覧は宴回数の公開設定を尊重し、本人には全件を返す', async () => {
		const profile = {
			showUtageSuccessCount: false,
			showUtageInterruptionCount: true,
			achievements: [
				{ name: 'notes1', unlockedAt: 1 },
				{ name: 'utageSuccess10', unlockedAt: 2 },
				{ name: 'utageInterruption10', unlockedAt: 3 },
				{ name: 'utageInterruptionWithin5Seconds', unlockedAt: 4 },
			],
		};
		const endpoint = new UsersAchievementsEndpoint({ findOneByOrFail: vi.fn().mockResolvedValue(profile) } as never);

		expect(usersAchievementsMeta.kind).toBe('read:account');
		await expect(endpoint.exec({ userId: 'usera' }, null, null, null)).resolves.toEqual([
			profile.achievements[0],
			profile.achievements[2],
			profile.achievements[3],
		]);
		await expect(endpoint.exec({ userId: 'usera' }, { id: 'usera' } as never, null, null)).resolves.toEqual(profile.achievements);
	});

	test('既存DBの遡及付与は公開ノートと記録済み阻止者だけを使い、5秒実績を含めない', () => {
		const migration = readFileSync(join(backendDir, 'migration/1788600000000-add-utage-achievements.js'), 'utf8');
		expect(migration).toContain('generate_series(10, 100, 10)');
		expect(migration).toContain('"note"."visibility" = \'public\'');
		expect(migration).toContain('session."interruptedByUserId" IS NOT NULL');
		expect(migration).toContain('ADD "interruptedWithin5Seconds" boolean NOT NULL DEFAULT false');
		expect(migration).not.toContain('utageInterruptionWithin5Seconds');
	});

	test('/iは公式クライアントだけで再照合し、外部アプリのread:accountでは永続更新を起こさない', async () => {
		const now = new Date();
		const today = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
		const profile = { userId: 'usera', user: { id: 'usera' }, loggedInDates: [today] };
		const repository = { findOne: vi.fn().mockResolvedValue(profile), update: vi.fn() };
		const userEntityService = { pack: vi.fn().mockResolvedValue({ id: 'usera' }) };
		const achievementService = { reconcileUtageAchievements: vi.fn().mockResolvedValue(undefined), create: vi.fn() };
		const endpoint = new IEndpoint(repository as never, userEntityService as never, achievementService as never);

		await endpoint.exec({}, { id: 'usera' } as never, { permission: ['read:account'] } as never, null);
		expect(achievementService.reconcileUtageAchievements).not.toHaveBeenCalled();

		await endpoint.exec({}, { id: 'usera' } as never, null, null);
		expect(achievementService.reconcileUtageAchievements).toHaveBeenCalledOnce();
		expect(userEntityService.pack).toHaveBeenCalledTimes(2);
	});
});
