/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import _Ajv from 'ajv';
import { DEFAULT_POLICIES, RoleService } from '@/core/RoleService.js';
import { HATASK_SUPPORT_POLICY_KEYS } from '@/core/hatask-support.js';
import { isLocalProfileBadgeOnlyUpdate } from '@/misc/local-profile-badge.js';
import { paramDef } from '@/server/api/endpoints/i/update.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import type { MiUser } from '@/models/User.js';

const settings = { fileId: 'image123', enabled: true, size: 60, pattern: 'cutout' as const, color: '#123ABC' };
const file = { id: 'image123', userId: 'owner', userHost: null, type: 'image/png', size: 1024, isSensitive: false } as MiDriveFile;
const user = { id: 'owner', host: null, noteCharm: settings } as unknown as MiUser;

// These imports execute inside tests so a missing implementation is a recorded test failure.
const helpers = () => import('@/misc/note-charm.js');

describe('note charm contract', () => {
	test('strict i/update schema rejects malformed or extra fields and accepts null cleanup', () => {
		const ajv = new _Ajv.default();
		ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
		const validate = ajv.compile(paramDef);
		for (const noteCharm of [settings, { ...settings, size: 48 }, { ...settings, size: 64 }, { ...settings, enabled: false }, null]) expect(validate({ noteCharm })).toBe(true);
		for (const noteCharm of [{ ...settings, size: 47 }, { ...settings, size: 65 }, { ...settings, size: 76 }, { ...settings, size: 96 }, { ...settings, size: 97 }, { ...settings, size: 60.5 }, { ...settings, pattern: 'svg' }, { ...settings, color: 'red' }, { ...settings, fileId: '../bad' }, { ...settings, url: 'https://evil.test' }, { enabled: true }]) {
			expect(validate({ noteCharm })).toBe(false);
		}
	});

	test('default policy is opt in and support catalog includes the display policy', () => {
		expect(DEFAULT_POLICIES).toHaveProperty('canUseNoteCharm', false);
		expect(HATASK_SUPPORT_POLICY_KEYS).toContain('canUseNoteCharm');
		expect(HATASK_SUPPORT_POLICY_KEYS).toHaveLength(15);
	});

	test('charm-only and local badge mixed updates suppress federation', () => {
		expect(isLocalProfileBadgeOnlyUpdate(['noteCharm'])).toBe(true);
		expect(isLocalProfileBadgeOnlyUpdate(['noteCharm', 'showHataskFlowerCount'])).toBe(true);
		expect(isLocalProfileBadgeOnlyUpdate(['noteCharm', 'name'])).toBe(false);
	});

	test('save permission rejects every nonnull change after revocation but allows cleanup', async () => {
		const { validateNoteCharmUpdate } = await helpers();
		expect(validateNoteCharmUpdate(null, false, user.id, null)).toBeNull();
		for (const value of [settings, { ...settings, enabled: false }]) expect(validateNoteCharmUpdate(value, false, user.id, file)).toBe('restrictedByRole');
		expect(validateNoteCharmUpdate(settings, true, user.id, file)).toBeNull();
		for (const invalid of [null, { ...file, userId: 'other' }, { ...file, userHost: 'remote.test' }, { ...file, type: 'image/svg+xml' }, { ...file, size: 5 * 1024 * 1024 + 1 }, { ...file, isSensitive: true }]) {
			expect(validateNoteCharmUpdate(settings, true, user.id, invalid)).toBe('invalidNoteCharmFile');
		}
		for (const type of ['image/png', 'image/webp', 'image/jpeg']) expect(validateNoteCharmUpdate(settings, true, user.id, { ...file, type, size: 5 * 1024 * 1024 })).toBeNull();
	});

	test('public packing revalidates file and policy, never exposes saved fileId/enabled', async () => {
		const { packNoteCharms } = await helpers();
		let permitted = true;
		let files = [file];
		const dependencies = { findConsentedUserIds: async () => new Set(['owner']), getPolicies: vi.fn(async () => ({ canUseNoteCharm: permitted })), findFiles: vi.fn(async () => files), getPublicUrl: () => 'https://local.test/image.png' };
		const publicValue = { url: 'https://local.test/image.png', size: 60, pattern: 'cutout', color: '#123ABC' };
		expect((await packNoteCharms([user], dependencies)).get(user.id)).toEqual(publicValue);
		permitted = false;
		expect((await packNoteCharms([user], dependencies)).get(user.id)).toBeNull();
		permitted = true;
		for (const invalid of [[], [{ ...file, isSensitive: true }], [{ ...file, userId: 'other' }], [{ ...file, type: 'image/svg+xml' }]]) {
			files = invalid;
			expect((await packNoteCharms([user], dependencies)).get(user.id)).toBeNull();
		}
	});

	test('legacy widths keep their decoration and are capped without mutating saved data', async () => {
		const { packNoteCharms } = await helpers();
		const dependencies = { findConsentedUserIds: async () => new Set(['owner']), getPolicies: async () => ({ canUseNoteCharm: true }), findFiles: async () => [file], getPublicUrl: () => 'https://local.test/image.png' };
		for (const [size, expected] of [[48, 48], [64, 64], [65, 64], [76, 64], [96, 64]]) {
			const saved = Object.freeze({ ...settings, size, pattern: 'check' as const, color: '#334455' });
			const legacy = { ...user, noteCharm: saved };
			expect((await packNoteCharms([legacy], dependencies)).get(user.id)).toEqual({ url: 'https://local.test/image.png', size: expected, pattern: 'check', color: '#334455' });
			expect(legacy.noteCharm).toBe(saved);
			expect(saved.size).toBe(size);
		}
		for (const size of [47, 97, 64.5, Number.NaN]) {
			expect((await packNoteCharms([{ ...user, noteCharm: { ...settings, size } }], dependencies)).get(user.id)).toBeNull();
		}
	});

	test('bulk pack only looks up equipped local users and batches Drive files once', async () => {
		const { packNoteCharms } = await helpers();
		const users = [user, user, { ...user, id: 'plain', noteCharm: null }, { ...user, id: 'disabled', noteCharm: { ...settings, enabled: false } }, { ...user, id: 'remote', host: 'remote.test' }];
		const dependencies = { findConsentedUserIds: vi.fn(async () => new Set(['owner'])), getPolicies: vi.fn(async () => ({ canUseNoteCharm: true })), findFiles: vi.fn(async () => [file]), getPublicUrl: () => 'https://local.test/image.png' };
		const result = await packNoteCharms(users, dependencies);
		expect(dependencies.findConsentedUserIds.mock.calls).toEqual([[['owner']]]);
		expect(dependencies.getPolicies.mock.calls).toEqual([['owner']]);
		expect(dependencies.findFiles.mock.calls).toEqual([[['image123']]]);
		for (const id of ['plain', 'disabled', 'remote']) expect(result.get(id)).toBeNull();
		await packNoteCharms(users.slice(2), dependencies);
		expect(dependencies.findConsentedUserIds).toHaveBeenCalledTimes(1);
		expect(dependencies.getPolicies).toHaveBeenCalledTimes(1);
		expect(dependencies.findFiles).toHaveBeenCalledTimes(1);
	});

	test('public packing withholds unconsented saved charms without looking up files or changing settings', async () => {
		const { packNoteCharms } = await helpers();
		const dependencies = { findConsentedUserIds: vi.fn(async () => new Set<string>()), getPolicies: vi.fn(async () => ({ canUseNoteCharm: true })), findFiles: vi.fn(async () => [file]), getPublicUrl: () => 'https://local.test/image.png' };
		expect((await packNoteCharms([user], dependencies)).get(user.id)).toBeNull();
		expect(dependencies.getPolicies).not.toHaveBeenCalled();
		expect(dependencies.findFiles).not.toHaveBeenCalled();
		expect(user.noteCharm).toBe(settings);
	});

	test('policy honors strict booleans, higher role priority and inherited defaults', async () => {
		const service = Object.create(RoleService.prototype) as RoleService;
		Object.assign(service, { meta: { policies: {} }, config: { maxFileSize: 100 * 1024 * 1024 } });
		const getRoles = vi.spyOn(service, 'getUserRoles');
		getRoles.mockResolvedValue([]);
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(false);
		getRoles.mockResolvedValue([{ policies: { canUseNoteCharm: { value: true, priority: 0 } } }, { policies: { canUseNoteCharm: { value: false, priority: 2 } } }] as never);
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(false);
		getRoles.mockResolvedValue([{ policies: { canUseNoteCharm: { value: true, priority: 2 } } }] as never);
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(true);
		getRoles.mockResolvedValue([{ policies: { canUseNoteCharm: { value: true, useDefault: true, priority: 2 } } }] as never);
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(false);
	});
});

describe('note charm endpoint and entity integration', () => {
	test('i/update stores disabled settings, restricts revoked writes, clears without permission, and only sends meUpdated', async () => {
		const { default: Update } = await import('@/server/api/endpoints/i/update.js');
		const stored = { ...user, name: null, isLocked: false };
		const profile = { fields: [], description: null, followedMessage: null, hataConsentNoteCharm: true as unknown };
		const users = { findOneByOrFail: async () => stored, update: vi.fn(async (_id, value) => Object.assign(stored, value)) };
		const profiles = { findOneByOrFail: async () => profile, update: vi.fn() };
		const drive = { findOneBy: vi.fn(async () => file) };
		let permitted = true;
		const roles = { getUserPolicies: vi.fn(async () => ({ ...DEFAULT_POLICIES, canUseNoteCharm: permitted })) };
		const global = { publishInternalEvent: vi.fn(), publishMainStream: vi.fn() };
		const federation = { publishToFollowers: vi.fn() };
		const packed = { noteCharm: null, noteCharmSettings: { ...settings, enabled: false } };
		const endpoint = new Update({} as never, {} as never, users as never, profiles as never, drive as never, {} as never,
			{ pack: async () => packed } as never, {} as never, global as never, {} as never, federation as never,
			{} as never, {} as never, { updateUsertags: vi.fn() } as never, roles as never,
			{ userProfileCache: { set: vi.fn() } } as never, {} as never, {} as never, {} as never);
		for (const size of [65, 76, 96]) {
			await expect(endpoint.exec({ noteCharm: { ...settings, size } }, stored as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		expect(users.update).not.toHaveBeenCalled();
		for (const consent of [false, undefined, 'true']) {
			profile.hataConsentNoteCharm = consent;
			for (const value of [settings, { ...settings, enabled: false }]) {
				await expect(endpoint.exec({ noteCharm: value, hataConsentNoteCharm: true }, stored as never, null, null)).rejects.toMatchObject({ code: 'NOTE_CHARM_NOT_CONSENTED' });
			}
		}
		expect(users.update).not.toHaveBeenCalled();
		expect(drive.findOneBy).not.toHaveBeenCalled();
		profile.hataConsentNoteCharm = true;
		await endpoint.exec({ noteCharm: { ...settings, enabled: false } }, stored as never, null, null);
		expect(stored.noteCharm).toEqual({ ...settings, enabled: false });
		expect(users.update).toHaveBeenCalledWith('owner', expect.objectContaining({ noteCharm: { ...settings, enabled: false } }));
		expect(global.publishMainStream).toHaveBeenCalledWith('owner', 'meUpdated', packed);
		expect(federation.publishToFollowers).not.toHaveBeenCalled();
		permitted = false;
		await expect(endpoint.exec({ noteCharm: settings }, stored as never, null, null)).rejects.toMatchObject({ code: 'RESTRICTED_BY_ROLE' });
		await expect(endpoint.exec({ noteCharm: { ...settings, url: 'https://evil.test' } }, stored as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		permitted = true;
		drive.findOneBy.mockResolvedValue({ ...file, userId: 'foreign' });
		await expect(endpoint.exec({ noteCharm: settings }, stored as never, null, null)).rejects.toMatchObject({ code: 'INVALID_NOTE_CHARM_FILE' });
		permitted = false;
		profile.hataConsentNoteCharm = false;
		roles.getUserPolicies.mockClear();
		drive.findOneBy.mockClear();
		await endpoint.exec({ noteCharm: null }, stored as never, null, null);
		expect(stored.noteCharm).toBeNull();
		expect(roles.getUserPolicies).not.toHaveBeenCalled();
		expect(drive.findOneBy).not.toHaveBeenCalled();
		expect(federation.publishToFollowers).not.toHaveBeenCalled();
	});

	test('UserEntityService keeps revoked/disabled settings private and resolves current config on each retrieval', async () => {
		const { UserEntityService } = await import('@/core/entities/UserEntityService.js');
		const service = new UserEntityService(...([] as unknown as ConstructorParameters<typeof UserEntityService>));
		let permitted = true;
		let currentFiles = [file];
		const roles = { getUserPolicies: vi.fn(async () => ({ ...DEFAULT_POLICIES, canUseNoteCharm: permitted })), getUserRoles: async () => [], getUserBadgeRoles: async () => [], isModerator: async () => false, isAdministrator: async () => false };
		let consented = true;
		const profile = { fields: [], loggedInDates: [], verifiedLinks: [] };
		const findConsents = vi.fn(async () => consented ? [{ userId: user.id }] : []);
		const findFiles = vi.fn(async () => currentFiles);
		Object.assign(service, {
			utageSessionsRepository: { createQueryBuilder: () => ({ innerJoin() { return this; }, where() { return this; }, andWhere() { return this; }, getCount: async () => 0 }) },
			meta: {}, config: { url: 'https://local.test', host: 'local.test' }, roleService: roles,
			driveFilesRepository: { findBy: findFiles }, driveFileEntityService: { getPublicUrl: () => 'https://local.test/image.png' },
			avatarDecorationService: { packUserDecorations: () => [], getHataskFlowerCompletions: async () => new Map() }, customEmojiService: { populateEmojis: () => [] },
			noteEntityService: { packMany: async () => [] }, userProfilesRepository: { findOneByOrFail: async () => profile, find: findConsents },
			userMemosRepository: { findOneBy: async () => null }, announcementService: { getUnreadAnnouncements: async () => [] },
			idService: { parse: () => ({ date: new Date(0) }) }, chatService: { hasUnreadMessages: async () => false },
		});
		vi.spyOn(service, 'getNotificationsInfo').mockResolvedValue({ hasUnread: false, unreadCount: 0 });
		vi.spyOn(service, 'getHasPendingReceivedFollowRequest').mockResolvedValue(false);
		const actualUser = { ...user, username: 'owner', lastActiveDate: null, avatarId: null, emojis: [] };
		const options = { pinNotes: new Map() };
		const publicValue = { url: 'https://local.test/image.png', size: 60, pattern: 'cutout', color: '#123ABC' };
		const publicUser = await service.pack(actualUser, null);
		expect(publicUser.noteCharm).toEqual(publicValue);
		expect(publicUser).not.toHaveProperty('noteCharmSettings');
		expect(findConsents).toHaveBeenCalledWith({ select: { userId: true }, where: { userId: expect.objectContaining({ _value: ['owner'] }), hataConsentNoteCharm: true } });
		consented = false;
		const unconsentedSelf = await service.pack(actualUser, actualUser, { ...options, schema: 'MeDetailed' });
		expect(unconsentedSelf.noteCharm).toBeNull();
		expect(unconsentedSelf.noteCharmSettings).toEqual(settings);
		expect(actualUser.noteCharm).toBe(settings);
		consented = true;
		for (const [size, expected] of [[48, 48], [64, 64], [76, 64], [96, 64]]) {
			const saved = Object.freeze({ ...settings, size });
			const legacy = { ...actualUser, noteCharm: saved };
			const legacySelf = await service.pack(legacy, legacy, { ...options, schema: 'MeDetailed' });
			expect(legacySelf.noteCharm).toEqual({ ...publicValue, size: expected });
			expect(legacySelf.noteCharmSettings).toEqual({ ...saved, size: expected });
			expect(legacy.noteCharm).toBe(saved);
			expect(saved.size).toBe(size);
		}
		permitted = false;
		const self = await service.pack(actualUser, actualUser, { ...options, schema: 'MeDetailed' });
		expect(self.noteCharm).toBeNull();
		expect(self.noteCharmSettings).toEqual(settings);
		permitted = true;
		actualUser.noteCharm = { ...settings, enabled: false };
		const disabled = await service.pack(actualUser, actualUser, { ...options, schema: 'MeDetailed' });
		expect(disabled.noteCharm).toBeNull();
		expect(disabled.noteCharmSettings).toEqual({ ...settings, enabled: false });
		actualUser.noteCharm = settings;
		currentFiles = [];
		expect((await service.pack(actualUser, null)).noteCharm).toBeNull();
		currentFiles = [{ ...file, isSensitive: true }];
		expect((await service.pack(actualUser, null)).noteCharm).toBeNull();
		currentFiles = [file];
		roles.getUserPolicies.mockClear();
		findFiles.mockClear();
		findConsents.mockClear();
		const bulk = await service.packMany([actualUser, { ...actualUser, id: 'plain', noteCharm: null }], null, { schema: 'UserLite' });
		expect(bulk.map(value => value.noteCharm)).toEqual([publicValue, null]);
		expect(roles.getUserPolicies).toHaveBeenCalledExactlyOnceWith('owner');
		expect(findFiles).toHaveBeenCalledTimes(1);
		expect(findConsents).toHaveBeenCalledTimes(1);
	});
});

describe('note charm persistence and role input', () => {
	test('migration adds only one nullable user column with no backfill or foreign key', async () => {
		const { NoteCharm1792886400000 } = await import('../../migration/1792886400000-note-charm.js');
		const statements: string[] = [];
		await new NoteCharm1792886400000().up({ query: async (sql: string) => { statements.push(sql); } });
		expect(statements).toEqual(['ALTER TABLE "user" ADD "noteCharm" jsonb']);
	});

	test('all admin policy schemas validate booleans and preserve standard priority/default fields', async () => {
		const { paramDef: create } = await import('@/server/api/endpoints/admin/roles/create.js');
		const { paramDef: update } = await import('@/server/api/endpoints/admin/roles/update.js');
		const { paramDef: defaults } = await import('@/server/api/endpoints/admin/roles/update-default-policies.js');
		const ajv = new _Ajv.default({ useDefaults: true });
		ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
		for (const schema of [create, update]) {
			const validate = ajv.compile(schema.properties.policies);
			for (const value of ['true', 1, null]) expect(validate({ canUseNoteCharm: { value } })).toBe(false);
			const policies = { canUseNoteCharm: { value: true } };
			expect(validate(policies)).toBe(true);
			expect(policies.canUseNoteCharm).toEqual({ value: true, priority: 0, useDefault: false });
		}
		const validate = ajv.compile(defaults.properties.policies);
		expect(validate({ canUseNoteCharm: true })).toBe(true);
		expect(validate({ canUseNoteCharm: 'true' })).toBe(false);
	});
});

describe('note charm role expiration', () => {
	test('expired assignments lose permission even while assignment cache still retains the row', async () => {
		const service = Object.create(RoleService.prototype) as RoleService;
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
		Object.assign(service, {
			meta: { policies: {} }, config: { maxFileSize: 100 * 1024 * 1024 },
			rolesCache: { fetch: async () => [{ id: 'charmrole', target: 'manual', policies: { canUseNoteCharm: { value: true, priority: 1, useDefault: false } } }] },
			roleAssignmentByUserIdCache: { fetch: async () => [{ userId: 'owner', roleId: 'charmrole', expiresAt: new Date(now + 1000) }] },
		});
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(true);
		clock.mockReturnValue(now + 1000);
		expect((await service.getUserPolicies('owner')).canUseNoteCharm).toBe(false);
		clock.mockRestore();
	});
});
