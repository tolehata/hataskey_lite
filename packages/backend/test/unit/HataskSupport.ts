/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { IsNull } from 'typeorm';
import { HataskSupportService } from '@/core/HataskSupportService.js';
import { DEFAULT_POLICIES, normalizeFavoriteFolderLimit } from '@/core/RoleService.js';
import { defaultHataskSupportSettings, HATASK_SUPPORT_POLICY_KEYS, safeSupportUrl, supportReflected, supportRolePolicies, supportSnapshot } from '@/core/hatask-support.js';
import SupportShow, { meta as publicMeta } from '@/server/api/endpoints/hatask/support/show.js';
import Supporters, { meta as supportersMeta } from '@/server/api/endpoints/hatask/support/supporters.js';
import AdminShow, { meta as adminShowMeta } from '@/server/api/endpoints/admin/hatask/support/show.js';
import AdminUpdate, { meta as adminUpdateMeta } from '@/server/api/endpoints/admin/hatask/support/update.js';
import AdminSupporters, { meta as adminSupportersMeta } from '@/server/api/endpoints/admin/hatask/support/supporters.js';
import Register, { meta as registerMeta } from '@/server/api/endpoints/admin/hatask/support/register.js';
import Unregister, { meta as unregisterMeta } from '@/server/api/endpoints/admin/hatask/support/unregister.js';
import type { HataskSupportSettings } from '@/core/hatask-support.js';
import type { MetaService } from '@/core/MetaService.js';
import type { RoleService } from '@/core/RoleService.js';
import type { QueryService } from '@/core/QueryService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { MiMeta, MiRole, MiUser, UsersRepository, RolesRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { AddHataskSupport1789080000000 } from '../../migration/1789080000000-add-hatask-support.js';

const me = { id: 'owner', host: null } as MiLocalUser;
const configured = (): HataskSupportSettings => ({ ...defaultHataskSupportSettings(), enabled: true, url: 'https://support.example.invalid/', benefits: HATASK_SUPPORT_POLICY_KEYS.map(key => ({ key, title: key, description: '', roleId: 'secretrole', visible: true, showBaseline: true })) });

function setup(settings = configured()) {
	const users = mockDeep<UsersRepository>();
	const roles = mockDeep<RolesRepository>();
	const meta = mockDeep<MetaService>();
	const policyService = mockDeep<RoleService>();
	const queryService = mockDeep<QueryService>();
	const packer = mockDeep<UserEntityService>();
	const query = mockDeep<ReturnType<UsersRepository['createQueryBuilder']>>();
	users.createQueryBuilder.mockReturnValue(query);
	for (const method of ['where', 'andWhere', 'orderBy', 'skip', 'take'] as const) query[method].mockReturnValue(query);
	query.getCount.mockResolvedValue(1);
	query.getManyAndCount.mockResolvedValue([[], 0]);
	packer.packMany.mockResolvedValue([]);
	users.findOneBy.mockResolvedValue({ ...me, hataskSupporter: true } as MiUser);
	roles.findBy.mockResolvedValue([]);
	roles.find.mockResolvedValue([]);
	meta.fetch.mockImplementation(async () => ({ hataskSupport: settings }) as MiMeta);
	meta.update.mockImplementation(async data => { settings = data.hataskSupport!; return { hataskSupport: settings } as MiMeta; });
	policyService.getUserPolicies.mockResolvedValue({ ...DEFAULT_POLICIES });
	return { service: new HataskSupportService(users, roles, meta, policyService, queryService, packer), users, roles, meta, policyService, queryService, query, packer };
}

describe('Hatask支援管理の権限境界と保持', () => {
	test('migrationは新しい列と索引だけを作り、初期設定が実装と一致する', async () => {
		const statements: string[] = [];
		await new AddHataskSupport1789080000000().up({ query: async (sql: string) => { statements.push(sql); } });
		expect(statements).toHaveLength(3);
		expect(statements[0]).toMatch(/^ALTER TABLE "meta" ADD "hataskSupport" jsonb NOT NULL DEFAULT '/);
		const defaultJson = statements[0].match(/ DEFAULT '(.+)'$/)?.[1];
		expect(defaultJson).toBeDefined();
		const { navButtonVisible, ...legacyDefault } = defaultHataskSupportSettings();
		expect(navButtonVisible).toBe(true);
		expect(JSON.parse(defaultJson!.replaceAll("''", "'"))).toEqual(legacyDefault);
		expect(statements[1]).toBe('ALTER TABLE "user" ADD "hataskSupporter" boolean NOT NULL DEFAULT false');
		expect(statements[2]).toBe('CREATE INDEX "IDX_user_hatask_supporter" ON "user" ("hataskSupporter", "id")');
	});

	test('公開は認証必須、管理は管理者と本人トークン限定、全経路にレート制限がある', () => {
		for (const meta of [publicMeta, supportersMeta]) expect(meta).toMatchObject({ requireCredential: true, kind: 'read:account', limit: { max: 60 } });
		for (const meta of [adminShowMeta, adminUpdateMeta, adminSupportersMeta, registerMeta, unregisterMeta]) {
			expect(meta).toMatchObject({ requireCredential: true, requireAdmin: true, secure: true });
			expect(meta.limit.max).toBeGreaterThan(0);
		}
		for (const meta of [adminUpdateMeta, registerMeta, unregisterMeta]) expect(meta.kind).toBe('write:admin:meta');
	});

	test('OFFとURL未設定では設定も支援者も公開しない、再有効化で復元する', async () => {
		const settings = configured();
		const ctx = setup({ ...settings, enabled: false });
		expect(await ctx.service.show(me)).toEqual({ configured: false, navButtonVisible: true, settings: null, isSupporter: false, benefits: [], supporterCount: 0 });
		expect(await ctx.service.supporters(me, 0, 30)).toEqual({ users: [], total: 0, hasMore: false });
		expect(ctx.users.createQueryBuilder).not.toHaveBeenCalled();
		expect((await ctx.service.adminShow()).settings.benefits).toHaveLength(HATASK_SUPPORT_POLICY_KEYS.length);
		await ctx.service.update(settings);
		expect((await ctx.service.show(me)).configured).toBe(true);
		await ctx.service.update({ ...settings, url: '' });
		expect((await ctx.service.show(me)).configured).toBe(false);
		expect(ctx.users.update).not.toHaveBeenCalled();
	});

	test('旧管理クライアントの保存はナビ表示設定を保持し、未設定時も公開フラグを返す', async () => {
		const settings = { ...configured(), enabled: false, navButtonVisible: false };
		const ctx = setup(settings);
		expect((await ctx.service.show(me)).navButtonVisible).toBe(false);
		const { navButtonVisible, ...oldClientSettings } = configured();
		await new AdminUpdate(ctx.service).exec({ settings: oldClientSettings }, me, null, null);
		expect(ctx.meta.update).toHaveBeenCalledWith({ hataskSupport: { ...oldClientSettings, navButtonVisible: false } });
		expect((await ctx.service.show(me)).navButtonVisible).toBe(false);
		await new AdminUpdate(ctx.service).exec({ settings: { ...oldClientSettings, navButtonVisible: true } }, me, null, null);
		expect((await ctx.service.show(me)).navButtonVisible).toBe(true);
		const legacy = setup({ ...oldClientSettings } as HataskSupportSettings);
		expect((await legacy.service.show(me)).navButtonVisible).toBe(true);
	});

	test('隠した特典・base・非公開ロール情報を公開しない、削除済み参照はnull', async () => {
		const settings = configured();
		settings.benefits[0].visible = false;
		settings.benefits[1].showBaseline = false;
		const ctx = setup(settings);
		ctx.roles.findBy.mockResolvedValue([{ id: 'secretrole', name: 'SECRET NAME', policies: { canMakePrivateChannel: { value: true, useDefault: false, priority: 2 }, canManageCustomEmojis: { value: true } } } as unknown as MiRole]);
		const result = await ctx.service.show(me);
		expect(result.benefits).toHaveLength(HATASK_SUPPORT_POLICY_KEYS.length - 1);
		expect(result.benefits.find(b => b.key === 'driveCapacityMb')).toBeUndefined();
		expect(result.benefits[0]).toMatchObject({ baseline: null, offered: { value: true } });
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain('secretrole');
		expect(serialized).not.toContain('SECRET NAME');
		expect(serialized).not.toContain('canManageCustomEmojis');
		ctx.roles.findBy.mockResolvedValue([]);
		expect((await ctx.service.show(me)).benefits.every(b => b.offered === null && !b.reflected)).toBe(true);
	});

	test('base・参照ロール・現在権限を分離し、正規化とuseDefaultを適用する', async () => {
		const ctx = setup();
		const role = { id: 'secretrole', name: '支援', policies: { driveCapacityMb: { value: 5000, useDefault: true }, favoriteFolderLimit: { value: 99, useDefault: false } } } as unknown as MiRole;
		ctx.roles.find.mockResolvedValue([role]);
		ctx.roles.findBy.mockResolvedValue([role]);
		ctx.policyService.getUserPolicies.mockImplementation(async id => ({ ...DEFAULT_POLICIES, driveCapacityMb: id ? 8000 : 300, favoriteFolderLimit: id ? 4 : 2 }));
		const result = await ctx.service.show(me);
		expect(result.benefits[0]).toMatchObject({ baseline: { value: 300 }, offered: { value: 300 }, current: { value: 8000 }, reflected: true });
		expect(result.benefits.find(b => b.key === 'favoriteFolderLimit')).toMatchObject({ baseline: { value: 2 }, offered: { value: 5 }, current: { value: 4 } });
		const admin = await ctx.service.adminShow('secretrole');
		expect(admin.rolePreview?.benefits[0].snapshot.value).toBe(300);
		expect(admin.roles).toEqual([{ id: 'secretrole', name: '支援' }]);
		expect((await ctx.service.adminShow('deleted')).rolePreview).toBeNull();
	});

	test('登録変更はローカル対象の専用フラグだけを更新しロールを変更しない', async () => {
		const ctx = setup();
		ctx.users.update.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
		expect(await ctx.service.setSupporter('local', true)).toEqual({ isSupporter: true });
		expect(ctx.users.update).toHaveBeenLastCalledWith({ id: 'local', host: IsNull(), isSuspended: false, isDeleted: false }, { hataskSupporter: true });
		await ctx.service.setSupporter('local', false);
		expect(ctx.users.update).toHaveBeenLastCalledWith({ id: 'local', host: IsNull() }, { hataskSupporter: false });
		expect(ctx.policyService.assign).not.toHaveBeenCalled();
		expect(ctx.policyService.unassign).not.toHaveBeenCalled();
		expect(ctx.meta.update).not.toHaveBeenCalled();
		ctx.users.update.mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] });
		await expect(ctx.service.setSupporter('remote', true)).rejects.toMatchObject({ code: 'NO_SUCH_USER' });
	});

	test('公開ページングと人数に同じローカル・停止・削除・mute/block条件を適用する', async () => {
		const ctx = setup();
		ctx.query.getManyAndCount.mockResolvedValue([[{ id: 'local', hataskSupporter: true } as MiUser], 31]);
		ctx.packer.packMany.mockResolvedValue([{ id: 'local', username: 'local', host: null }] as never);
		expect(await ctx.service.supporters(me, 30, 30)).toMatchObject({ total: 31, hasMore: false });
		expect(ctx.query.skip).toHaveBeenCalledWith(30);
		expect(ctx.query.take).toHaveBeenCalledWith(30);
		expect(ctx.query.where).toHaveBeenCalledWith('user.host IS NULL');
		expect(ctx.query.andWhere).toHaveBeenCalledWith('user.isSuspended = FALSE');
		expect(ctx.query.andWhere).toHaveBeenCalledWith('user.isDeleted = FALSE');
		expect(ctx.query.andWhere).toHaveBeenCalledWith('user.hataskSupporter = TRUE');
		expect(ctx.queryService.generateMutedUserQueryForUsers).toHaveBeenCalledWith(ctx.query, me);
		expect(ctx.queryService.generateBlockQueryForUsers).toHaveBeenCalledWith(ctx.query, me);
		expect((await ctx.service.supporters(me, 0, 30)).users[0]).not.toHaveProperty('isSupporter');
		expect((await ctx.service.adminSupporters(me, 0, 30, '%_', false)).users[0]).toHaveProperty('isSupporter', true);
		expect(ctx.query.andWhere).toHaveBeenCalledWith('user.usernameLower LIKE :query', { query: '%\\%\\_%' });
	});

	test('HTTPS以外・認証情報付きURL・重複項目を拒否する', async () => {
		const ctx = setup();
		for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', '//example.com']) {
			expect(safeSupportUrl(url)).toBe(false);
			await expect(ctx.service.update({ ...configured(), url })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_SETTINGS' });
		}
		const settings = configured();
		settings.benefits.push(settings.benefits[0]);
		await expect(ctx.service.update(settings)).rejects.toMatchObject({ code: 'INVALID_SUPPORT_SETTINGS' });
		expect(ctx.meta.update).not.toHaveBeenCalled();
		expect(safeSupportUrl('https://example.com/path')).toBe(true);
	});

	test('各endpointは他人のuserId・権限・未定義設定の混入と無効ページングを拒否する', async () => {
		const service = mockDeep<HataskSupportService>();
		for (const EndpointClass of [SupportShow, Supporters, AdminShow, AdminSupporters]) {
			await expect(new EndpointClass(service).exec({ userId: 'other' }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		for (const value of [{ offset: -1 }, { limit: 0 }, { limit: 101 }]) await expect(new Supporters(service).exec(value, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(new AdminUpdate(service).exec({ settings: { ...configured(), policies: {} } }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		for (const EndpointClass of [Register, Unregister]) {
			await expect(new EndpointClass(service).exec({ userId: 'valid', roleId: 'forged' }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		await new AdminUpdate(service).exec({ settings: configured() }, me, null, null);
		expect(service.update).toHaveBeenCalledWith(configured());
	});
});

describe('支援特典の値と実効権限', () => {
	test('15項目が実ポリシーに存在する', () => {
		expect(HATASK_SUPPORT_POLICY_KEYS).toHaveLength(15);
		for (const key of HATASK_SUPPORT_POLICY_KEYS) expect(DEFAULT_POLICIES).toHaveProperty(key);
	});

	test('絵文字申請の7日間上限は0件で利用不可、ロール値と既定値継承を反映する', async () => {
		const key = 'emojiRequestLimit';
		expect(supportSnapshot(key, { ...DEFAULT_POLICIES, emojiRequestLimit: 0 })).toMatchObject({ value: 0, available: false, unlimited: false });
		expect(supportSnapshot(key, { ...DEFAULT_POLICIES, emojiRequestLimit: 10 })).toMatchObject({ value: 10, available: true, unlimited: false });
		const offered = supportSnapshot(key, { ...DEFAULT_POLICIES, emojiRequestLimit: 30 });
		expect(supportReflected(key, supportSnapshot(key, { ...DEFAULT_POLICIES, emojiRequestLimit: 10 }), offered)).toBe(false);
		expect(supportReflected(key, supportSnapshot(key, { ...DEFAULT_POLICIES, emojiRequestLimit: 30 }), offered)).toBe(true);
		const inherited = { policies: { emojiRequestLimit: { value: 30, useDefault: true } } } as unknown as MiRole;
		expect(supportRolePolicies(DEFAULT_POLICIES, inherited, normalizeFavoriteFolderLimit).emojiRequestLimit).toBe(10);
		const role = { policies: { emojiRequestLimit: { value: 30, useDefault: false } } } as unknown as MiRole;
		expect(supportRolePolicies(DEFAULT_POLICIES, role, normalizeFavoriteFolderLimit).emojiRequestLimit).toBe(30);
		const settings = configured();
		const ctx = setup(settings);
		await new AdminUpdate(ctx.service).exec({ settings }, me, null, null);
		expect(ctx.meta.update).toHaveBeenCalledWith({ hataskSupport: settings });
	});

	test('お気に入り特典を既存設定と保存し、ロールの上限と子フォルダ権限を比較する', async () => {
		const settings = configured();
		const ctx = setup({ ...settings, benefits: settings.benefits.filter(benefit => !['favoriteFolderLimit', 'canCreateFavoriteSubfolders'].includes(benefit.key)) });
		const role = { id: 'secretrole', name: '支援', policies: { favoriteFolderLimit: { value: 99, useDefault: false }, canCreateFavoriteSubfolders: { value: true, useDefault: false } } } as unknown as MiRole;
		ctx.roles.find.mockResolvedValue([role]); ctx.roles.findBy.mockResolvedValue([role]);
		const adminBeforeSave = await ctx.service.adminShow('secretrole');
		expect(adminBeforeSave.benefits.find(benefit => benefit.key === 'favoriteFolderLimit')?.baseline.value).toBe(2);
		expect(adminBeforeSave.benefits.find(benefit => benefit.key === 'canCreateFavoriteSubfolders')?.baseline.value).toBe(false);
		expect(adminBeforeSave.rolePreview?.benefits.find(benefit => benefit.key === 'favoriteFolderLimit')?.snapshot.value).toBe(5);
		expect(adminBeforeSave.rolePreview?.benefits.find(benefit => benefit.key === 'canCreateFavoriteSubfolders')?.snapshot.value).toBe(true);
		// Use the actual endpoint validator so unsupported benefit keys cannot silently pass a mock.
		await expect(new AdminUpdate(ctx.service).exec({ settings: { ...settings, benefits: [{ ...settings.benefits[0], key: 'canManageCustomEmojis' }] } }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await new AdminUpdate(ctx.service).exec({ settings }, me, null, null);
		expect(ctx.meta.update).toHaveBeenCalledWith({ hataskSupport: settings });
		const response = await ctx.service.show(me);
		expect(response.benefits.find(benefit => benefit.key === 'favoriteFolderLimit')).toMatchObject({ baseline: { value: 2 }, offered: { value: 5 }, current: { value: 2 }, reflected: false });
		expect(response.benefits.find(benefit => benefit.key === 'canCreateFavoriteSubfolders')).toMatchObject({ baseline: { value: false }, offered: { value: true }, current: { value: false }, reflected: false });
		ctx.policyService.getUserPolicies.mockImplementation(async id => ({ ...DEFAULT_POLICIES, favoriteFolderLimit: id ? 5 : 2, canCreateFavoriteSubfolders: !!id }));
		const supported = await ctx.service.show(me);
		for (const key of ['favoriteFolderLimit', 'canCreateFavoriteSubfolders']) expect(supported.benefits.find(benefit => benefit.key === key)?.reflected).toBe(true);
		expect(JSON.stringify(supported)).not.toContain('secretrole');
		expect(ctx.roles.update).not.toHaveBeenCalled();
		expect(ctx.users.update).not.toHaveBeenCalled();
		expect(ctx.policyService.assign).not.toHaveBeenCalled();
	});

	test('お気に入りの参照値にもロールと同じ整数上限・既定値の継承を適用する', () => {
		for (const [raw, expected] of [[99, 5], [-1, 0], [2.9, 2], [NaN, 2], ['5', 2]] as const) {
			const role = { policies: { favoriteFolderLimit: { value: raw, useDefault: false }, canCreateFavoriteSubfolders: { value: 'true', useDefault: false } } } as unknown as MiRole;
			const value = supportRolePolicies(DEFAULT_POLICIES, role, normalizeFavoriteFolderLimit);
			expect(value.favoriteFolderLimit).toBe(expected);
			expect(value.canCreateFavoriteSubfolders).toBe(false);
		}
		const role = { policies: { favoriteFolderLimit: { value: 5, useDefault: true }, canCreateFavoriteSubfolders: { value: true, useDefault: true } } } as unknown as MiRole;
		expect(supportRolePolicies(DEFAULT_POLICIES, role, normalizeFavoriteFolderLimit)).toMatchObject({ favoriteFolderLimit: 2, canCreateFavoriteSubfolders: false });
	});

	test('マスコット上限は親機能無効なら利用可能に見せない、0は無制限にしない', () => {
		for (const key of ['mascotMaxExpressions', 'mascotMaxPhrases', 'mascotMaxCharacters'] as const) {
			expect(supportSnapshot(key, { ...DEFAULT_POLICIES, canUseMascot: false, [key]: 20 })).toMatchObject({ value: 20, available: false, condition: 'mascotUnavailable', unlimited: false });
			expect(supportSnapshot(key, { ...DEFAULT_POLICIES, canUseMascot: true, [key]: 0 })).toMatchObject({ value: 0, available: false, unlimited: false });
		}
	});

	test('廃止したポリシーを保存済みの特典は表示と管理画面から除外する', async () => {
		const settings = configured();
		const ctx = setup({ ...settings, benefits: [...settings.benefits, { ...settings.benefits[0], key: 'hatacordingUiRateLimit' } as unknown as typeof settings.benefits[number]] });
		expect((await ctx.service.show(me)).benefits.some(benefit => (benefit.key as string) === 'hatacordingUiRateLimit')).toBe(false);
		expect((await ctx.service.adminShow()).settings.benefits.some(benefit => (benefit.key as string) === 'hatacordingUiRateLimit')).toBe(false);
	});

	test('rateは実baseとの倍率・無制限同士を正しく比較、false設定も反映扱い', () => {
		const base = { ...DEFAULT_POLICIES, rateLimitFactor: 2 };
		expect(supportSnapshot('rateLimitFactor', { ...base, rateLimitFactor: .5 }, base)).toMatchObject({ value: .5, rateMultiplier: 4 });
		expect(supportReflected('rateLimitFactor', supportSnapshot('rateLimitFactor', { ...base, rateLimitFactor: 0 }), supportSnapshot('rateLimitFactor', { ...base, rateLimitFactor: -1 }))).toBe(true);
		const disabled = supportSnapshot('canMakePrivateChannel', { ...DEFAULT_POLICIES, canMakePrivateChannel: false });
		expect(supportReflected('canMakePrivateChannel', disabled, disabled)).toBe(true);
		const enabled = supportSnapshot('canMakePrivateChannel', { ...DEFAULT_POLICIES, canMakePrivateChannel: true });
		expect(supportReflected('canMakePrivateChannel', enabled, disabled)).toBe(true);
		expect(supportReflected('canMakePrivateChannel', enabled, enabled)).toBe(true);
		expect(supportReflected('canMakePrivateChannel', disabled, enabled)).toBe(false);
		expect(supportReflected('canMakePrivateChannel', disabled, null)).toBe(false);
	});

	test('参照ロール計算でuseDefaultと既存quota正規化を使う', () => {
		const role = { policies: { favoriteFolderLimit: { value: 99, useDefault: false }, driveCapacityMb: { value: 9999, useDefault: true } } } as unknown as MiRole;
		const policies = supportRolePolicies({ ...DEFAULT_POLICIES, driveCapacityMb: 300 }, role, normalizeFavoriteFolderLimit);
		expect(policies.favoriteFolderLimit).toBe(5);
		expect(policies.driveCapacityMb).toBe(300);
	});
});
