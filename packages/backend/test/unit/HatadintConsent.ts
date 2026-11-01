/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { unlink } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import ConsentGet, { meta as getMeta } from '@/server/api/endpoints/hata/consent/get.js';
import ConsentUpdate, { DRAWING_CONSENT_VERSION, meta as updateMeta } from '@/server/api/endpoints/hata/consent/update.js';
import ConsentList, { meta as listMeta } from '@/server/api/endpoints/admin/hata/consent-list.js';
import DriveCreate, { meta as driveMeta } from '@/server/api/endpoints/drive/files/create.js';
import type { MiLocalUser } from '@/models/User.js';
import type { MiUserProfile, MiMeta, UserProfilesRepository, UsersRepository, MiDriveFile } from '@/models/_.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { DriveService } from '@/core/DriveService.js';

vi.mock('node:fs', async (importOriginal) => ({
	...await importOriginal<typeof import('node:fs')>(),
	unlink: vi.fn(),
}));

const user = { id: 'owner' } as MiLocalUser;
const file = { name: 'canvas.png', path: '/tmp/hatadint-consent-unit-only.png' };

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('Hatadintのアカウント同意', () => {
	test('本人同意APIは第三者トークンを拒否し、一覧はモデレーターに限定する', () => {
		expect(getMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'read:account' });
		expect(updateMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(listMeta).toMatchObject({ requireCredential: true, requireModerator: true, secure: true, kind: 'read:admin:show-user' });
		expect(driveMeta).toMatchObject({ requireCredential: true, kind: 'write:drive' });
	});

	test('他人のIDや同意日時を送っても本人の未同意状態だけを取得する', async () => {
		const profiles = mockDeep<UserProfilesRepository>();
		profiles.findOneByOrFail.mockResolvedValue({ hataConsentDrawing: false, hataConsentDrawingDate: null, hataConsentDrawingVersion: null } as MiUserProfile);
		const result = await new ConsentGet(profiles).exec({ userId: 'other', agreedAt: '2000-01-01' }, user, null, null);
		expect(profiles.findOneByOrFail).toHaveBeenCalledWith({ userId: user.id });
		expect(result).toEqual({ agreed: false, agreedAt: null, version: null });
	});

	test('古い版でも同意済みとし、初回の日時と版を返す', async () => {
		const profiles = mockDeep<UserProfilesRepository>();
		profiles.findOneByOrFail.mockResolvedValue({ hataConsentDrawing: true, hataConsentDrawingDate: new Date('2020-01-02T03:04:05Z'), hataConsentDrawingVersion: 'old' } as MiUserProfile);
		expect(await new ConsentGet(profiles).exec({}, user, null, null)).toEqual({ agreed: true, agreedAt: '2020-01-02T03:04:05.000Z', version: 'old' });
	});

	test('初回のみサーバー日時と固定版を記録し、再同意・同時同意で変更しない', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
		const profiles = mockDeep<UserProfilesRepository>();
		let record: Partial<MiUserProfile> = { userId: user.id, hataConsentDrawing: false };
		profiles.update.mockImplementation(async (criteria, values) => {
			expect(criteria).toEqual({ userId: user.id, hataConsentDrawing: false });
			if (record.hataConsentDrawing) return { affected: 0, generatedMaps: [], raw: [] };
			record = { ...record, ...values } as Partial<MiUserProfile>;
			return { affected: 1, generatedMaps: [], raw: [] };
		});
		const endpoint = new ConsentUpdate(profiles);
		await Promise.all([0, 1].map(() => endpoint.exec({ type: 'drawing', agree: true, userId: 'other', version: 'forged' }, user, null, null)));
		vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
		await endpoint.exec({ type: 'drawing', agree: true }, user, null, null);
		expect(record).toEqual({ userId: user.id, hataConsentDrawing: true, hataConsentDrawingDate: new Date('2026-09-09T00:00:00Z'), hataConsentDrawingVersion: DRAWING_CONSENT_VERSION });
	});

	test('不同意では既存の初回記録を変更しない', async () => {
		const profiles = mockDeep<UserProfilesRepository>();
		await expect(new ConsentUpdate(profiles).exec({ type: 'drawing', agree: false }, user, null, null)).rejects.toMatchObject({ code: 'CONSENT_CANNOT_BE_REVOKED' });
		expect(profiles.update).not.toHaveBeenCalled();
	});

	test.each(['externalTl', 'customFont', 'mascot'])('既存の%sの取り消し処理を維持する', async (type) => {
		const profiles = mockDeep<UserProfilesRepository>();
		await new ConsentUpdate(profiles).exec({ type, agree: false }, user, null, null);
		const prefix = `hataConsent${type[0].toUpperCase()}${type.slice(1)}`;
		expect(profiles.update).toHaveBeenCalledWith(user.id, { [prefix]: false, [`${prefix}Date`]: null });
	});

	test.each([
		['drawing', true],
		['drawingPending', false],
	] as const)('管理一覧の%sフィルタと初回記録を返す', async (filter, agreed) => {
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
		userQuery.getMany.mockResolvedValue([user]);
		profileQuery.getMany.mockResolvedValue([{ userId: user.id, hataConsentDrawing: agreed, hataConsentDrawingDate: agreed ? new Date('2026-09-09T00:00:00Z') : null, hataConsentDrawingVersion: agreed ? 'old' : null } as MiUserProfile]);
		const result = await new ConsentList(users, profiles).exec({ filter }, user, null, null);
		expect(userQuery.where).toHaveBeenCalledWith('user.host IS NULL');
		expect(userQuery.andWhere).toHaveBeenCalledWith('user.isDeleted = false');
		expect(profileQuery.andWhere).toHaveBeenCalledWith(`profile."hataConsentDrawing" = ${agreed}`);
		expect(result.users[0]).toMatchObject({ hataConsentDrawing: agreed, hataConsentDrawingDate: agreed ? '2026-09-09T00:00:00.000Z' : null, hataConsentDrawingVersion: agreed ? 'old' : null });
	});
});

describe('Hatadintからのドライブ保存', () => {
	function setup(agreed: boolean) {
		const profiles = mockDeep<UserProfilesRepository>();
		profiles.findOneBy.mockResolvedValue({ hataConsentDrawing: agreed, hataConsentDrawingVersion: 'old' } as MiUserProfile);
		const drive = mockDeep<DriveService>();
		const entity = mockDeep<DriveFileEntityService>();
		entity.validateFileName.mockReturnValue(true);
		drive.addFile.mockResolvedValue({ id: 'saved' } as MiDriveFile);
		const endpoint = new DriveCreate({ enableIpLogging: false } as MiMeta, profiles, entity, drive);
		return { profiles, drive, entity, endpoint };
	}

	test('未同意の作品は保存せず、一時ファイルを消す（拒否の陽性対照）', async () => {
		const { profiles, drive, endpoint } = setup(false);
		await expect(endpoint.exec({ source: 'hatadint', userId: 'other' }, user, null, null, file)).rejects.toMatchObject({ code: 'DRAWING_CONSENT_REQUIRED' });
		expect(profiles.findOneBy).toHaveBeenCalledWith({ userId: user.id });
		expect(drive.addFile).not.toHaveBeenCalled();
		expect(unlink).toHaveBeenCalledWith(file.path, expect.any(Function));
	});

	test('アカウント記録が取得できない時は保存を止め、一時ファイルを消す', async () => {
		const { profiles, drive, endpoint } = setup(true);
		profiles.findOneBy.mockRejectedValue(new Error('repository unavailable'));
		await expect(endpoint.exec({ source: 'hatadint' }, user, null, null, file)).rejects.toThrow('repository unavailable');
		expect(drive.addFile).not.toHaveBeenCalled();
		expect(unlink).toHaveBeenCalledOnce();
	});

	test('同意済みなら古い版でも保存し、一時ファイルを消す', async () => {
		const { drive, endpoint } = setup(true);
		await endpoint.exec({ source: 'hatadint' }, user, null, null, file);
		expect(drive.addFile).toHaveBeenCalledWith(expect.objectContaining({ user, path: file.path }));
		expect(unlink).toHaveBeenCalledOnce();
	});

	test('通常のアップロードには同意の追加条件を課さない', async () => {
		const { profiles, drive, endpoint } = setup(false);
		await endpoint.exec({}, user, null, null, file);
		expect(profiles.findOneBy).not.toHaveBeenCalled();
		expect(drive.addFile).toHaveBeenCalledOnce();
	});

	test.each(['hatadint', undefined])('不正ファイル名は保存せず一時ファイルを1回だけ消す（source=%s）', async (source) => {
		const { drive, entity, endpoint } = setup(true);
		entity.validateFileName.mockReturnValue(false);
		await expect(endpoint.exec({ source, name: 'invalid/name.png' }, user, null, null, file)).rejects.toMatchObject({ code: 'INVALID_FILE_NAME' });
		expect(drive.addFile).not.toHaveBeenCalled();
		expect(unlink).toHaveBeenCalledOnce();
		expect(unlink).toHaveBeenCalledWith(file.path, expect.any(Function));
	});

	test('未知の送信元はスキーマで拒否する', async () => {
		const { drive, endpoint } = setup(true);
		await expect(endpoint.exec({ source: 'unknown' }, user, null, null, file)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(drive.addFile).not.toHaveBeenCalled();
		expect(unlink).toHaveBeenCalledOnce();
	});
});
