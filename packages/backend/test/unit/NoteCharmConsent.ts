/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import ConsentGet, { meta as getMeta } from '@/server/api/endpoints/hata/consent/get.js';
import ConsentUpdate, { meta as updateMeta } from '@/server/api/endpoints/hata/consent/update.js';
import ConsentList, { meta as listMeta } from '@/server/api/endpoints/admin/hata/consent-list.js';
import type { MiLocalUser } from '@/models/User.js';
import type { MiUserProfile, UserProfilesRepository, UsersRepository } from '@/models/_.js';

const user = { id: 'owner' } as MiLocalUser;

afterEach(() => {
	vi.useRealTimers();
});

describe('note charm account consent', () => {
	test('consent reads/writes require the account session and the list requires staff scope', () => {
		expect(getMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'read:account' });
		expect(updateMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(listMeta).toMatchObject({ requireCredential: true, requireModerator: true, secure: true, kind: 'read:admin:show-user' });
	});

	test.each([false, true])('reads the authenticated owner consent separately from drawing (agreed=%s)', async (agreed) => {
		const profiles = mockDeep<UserProfilesRepository>();
		const agreedAt = agreed ? new Date('2026-10-27T00:00:00Z') : null;
		profiles.findOneByOrFail.mockResolvedValue({ hataConsentDrawing: !agreed, hataConsentDrawingDate: new Date('2026-09-09T00:00:00Z'), hataConsentDrawingVersion: 'old', hataConsentNoteCharm: agreed, hataConsentNoteCharmDate: agreedAt } as unknown as MiUserProfile);
		const result = await new ConsentGet(profiles).exec({ type: 'noteCharm', userId: 'other' }, user, null, null);
		expect(profiles.findOneByOrFail).toHaveBeenCalledExactlyOnceWith({ userId: user.id });
		expect(result).toEqual({ agreed, agreedAt: agreedAt?.toISOString() ?? null, version: null });
	});

	test('records server time for the authenticated account and clears only the charm consent on revocation', async () => {
		vi.useFakeTimers();
		const now = new Date('2026-10-27T00:00:00Z');
		vi.setSystemTime(now);
		const profiles = mockDeep<UserProfilesRepository>();
		const endpoint = new ConsentUpdate(profiles);
		await endpoint.exec({ type: 'noteCharm', agree: true, userId: 'other', agreedAt: '2000-01-01', version: 'forged' }, user, null, null);
		expect(profiles.update).toHaveBeenNthCalledWith(1, user.id, { hataConsentNoteCharm: true, hataConsentNoteCharmDate: now });
		await endpoint.exec({ type: 'noteCharm', agree: false }, user, null, null);
		expect(profiles.update).toHaveBeenNthCalledWith(2, user.id, { hataConsentNoteCharm: false, hataConsentNoteCharmDate: null });
	});

	test.each([
		['noteCharm', true],
		['noteCharmPending', false],
	] as const)('admin %s filter returns matching accounts, total and recorded timestamp', async (filter, agreed) => {
		const profiles = mockDeep<UserProfilesRepository>();
		const users = mockDeep<UsersRepository>();
		const userQuery = mockDeep<ReturnType<UsersRepository['createQueryBuilder']>>();
		const profileQuery = mockDeep<ReturnType<UserProfilesRepository['createQueryBuilder']>>();
		userQuery.where.mockReturnValue(userQuery);
		userQuery.andWhere.mockReturnValue(userQuery);
		userQuery.orderBy.mockReturnValue(userQuery);
		profileQuery.where.mockReturnValue(profileQuery);
		profileQuery.andWhere.mockReturnValue(profileQuery);
		users.createQueryBuilder.mockReturnValue(userQuery);
		profiles.createQueryBuilder.mockReturnValue(profileQuery);
		userQuery.getMany.mockResolvedValue([user, { ...user, id: 'other' }]);
		const agreedAt = agreed ? new Date('2026-10-27T00:00:00Z') : null;
		profileQuery.getMany.mockResolvedValue([{ userId: user.id, hataConsentNoteCharm: agreed, hataConsentNoteCharmDate: agreedAt } as unknown as MiUserProfile]);
		const result = await new ConsentList(users, profiles).exec({ filter, limit: 1 }, user, null, null);
		expect(userQuery.where).toHaveBeenCalledWith('user.host IS NULL');
		expect(userQuery.andWhere).toHaveBeenCalledWith('user.isDeleted = false');
		expect(profileQuery.andWhere).toHaveBeenCalledWith(`profile."hataConsentNoteCharm" = ${agreed}`);
		expect(result.total).toBe(1);
		expect(result.users).toHaveLength(1);
		expect(result.users[0]).toMatchObject({ id: user.id, hataConsentNoteCharm: agreed, hataConsentNoteCharmDate: agreedAt?.toISOString() ?? null });
	});

	test('migration defaults existing accounts to unconsented and has a reversible two-column change', async () => {
		const { NoteCharmConsent1793059200000 } = await import('../../migration/1793059200000-note-charm-consent.js');
		const statements: string[] = [];
		const runner = { query: async (sql: string) => { statements.push(sql); } };
		const migration = new NoteCharmConsent1793059200000();
		await migration.up(runner);
		expect(statements).toEqual([
			'ALTER TABLE "user_profile" ADD "hataConsentNoteCharm" boolean NOT NULL DEFAULT false',
			'ALTER TABLE "user_profile" ADD "hataConsentNoteCharmDate" TIMESTAMP WITH TIME ZONE',
		]);
		statements.length = 0;
		await migration.down(runner);
		expect(statements).toEqual([
			'ALTER TABLE "user_profile" DROP COLUMN "hataConsentNoteCharmDate"',
			'ALTER TABLE "user_profile" DROP COLUMN "hataConsentNoteCharm"',
		]);
	});
});
