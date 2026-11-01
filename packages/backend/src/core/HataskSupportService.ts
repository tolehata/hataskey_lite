/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiUser, RolesRepository, UsersRepository } from '@/models/_.js';
import { ApiError } from '@/server/api/error.js';
import { MetaService } from '@/core/MetaService.js';
import { RoleService, normalizeFavoriteFolderLimit } from '@/core/RoleService.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATASK_SUPPORT_POLICY_KEYS, defaultHataskSupportSettings, safeSupportUrl, supportConfigured, supportReflected, supportRolePolicies, supportSnapshot } from './hatask-support.js';
import type { HataskSupportSettings } from './hatask-support.js';

export const HATASK_SUPPORT_ERRORS = {
	invalidSettings: { message: 'Invalid support settings.', code: 'INVALID_SUPPORT_SETTINGS', id: '74a15e0b-b852-44a3-b4e8-6aa0a2bbdf87' },
	noSuchUser: { message: 'No eligible local user.', code: 'NO_SUCH_USER', id: '7a5cbf61-8d38-4377-9d84-231e354b66e9' },
} as const;

@Injectable()
export class HataskSupportService {
	constructor(
		@Inject(DI.usersRepository) private users: UsersRepository,
		@Inject(DI.rolesRepository) private roles: RolesRepository,
		private metaService: MetaService,
		private roleService: RoleService,
		private queryService: QueryService,
		private userEntityService: UserEntityService,
	) {}

	private async settings(): Promise<HataskSupportSettings> {
		const settings = (await this.metaService.fetch()).hataskSupport ?? defaultHataskSupportSettings();
		// 廃止したポリシーを特典として保存した旧設定は、表示・再保存の対象から外す。
		const known = new Set<string>(HATASK_SUPPORT_POLICY_KEYS);
		return { ...settings, navButtonVisible: settings.navButtonVisible ?? true, benefits: settings.benefits.filter(benefit => known.has(benefit.key)) };
	}

	private async basePolicies() {
		return await this.roleService.getUserPolicies(null);
	}

	private userQuery(me: MiUser, publicView: boolean) {
		const query = this.users.createQueryBuilder('user')
			.where('user.host IS NULL')
			.andWhere('user.isSuspended = FALSE')
			.andWhere('user.isDeleted = FALSE');
		if (publicView) {
			this.queryService.generateMutedUserQueryForUsers(query, me);
			this.queryService.generateBlockQueryForUsers(query, me);
		}
		return query;
	}

	public async show(me: MiUser) {
		const settings = await this.settings();
		if (!supportConfigured(settings)) return { configured: false, navButtonVisible: settings.navButtonVisible, settings: null, isSupporter: false, benefits: [], supporterCount: 0 };
		const [base, current, user, roles, supporterCount] = await Promise.all([
			this.basePolicies(), this.roleService.getUserPolicies(me.id),
			this.users.findOneBy({ id: me.id, host: IsNull(), isSuspended: false, isDeleted: false }),
			this.roles.findBy({ id: In(settings.benefits.filter(b => b.visible && b.roleId !== null).map(b => b.roleId!)) }),
			this.userQuery(me, true).andWhere('user.hataskSupporter = TRUE').getCount(),
		]);
		const roleMap = new Map(roles.map(role => [role.id, role]));
		const benefits = settings.benefits.filter(b => b.visible).map(benefit => {
			const role = benefit.roleId === null ? null : roleMap.get(benefit.roleId);
			const offered = role ? supportSnapshot(benefit.key, supportRolePolicies(base, role, normalizeFavoriteFolderLimit), base) : null;
			const actual = supportSnapshot(benefit.key, current, base);
			return {
				key: benefit.key, title: benefit.title, description: benefit.description, showBaseline: benefit.showBaseline,
				baseline: benefit.showBaseline ? supportSnapshot(benefit.key, base) : null,
				offered, current: actual, reflected: supportReflected(benefit.key, actual, offered),
			};
		});
		// Do not serialize settings wholesale: role identifiers and hidden benefits are admin-only.
		return { configured: true, navButtonVisible: settings.navButtonVisible, settings: {
			platform: settings.platform, url: settings.url, manageUrl: settings.manageUrl, intro: settings.intro,
			bannerTitle: settings.bannerTitle, bannerMessage: settings.bannerMessage, bannerVisible: settings.bannerVisible,
		}, isSupporter: user?.hataskSupporter === true, benefits, supporterCount };
	}

	public async adminShow(previewRoleId?: string | null) {
		const [settings, base, roles] = await Promise.all([this.settings(), this.basePolicies(), this.roles.find({ order: { displayOrder: 'DESC', id: 'ASC' } })]);
		const roleMap = new Map(roles.map(role => [role.id, role]));
		const previewRole = previewRoleId ? roleMap.get(previewRoleId) : null;
		return {
			settings,
			benefits: HATASK_SUPPORT_POLICY_KEYS.map(key => {
				const benefit = settings.benefits.find(item => item.key === key);
				const role = benefit?.roleId ? roleMap.get(benefit.roleId) : null;
				return { key, baseline: supportSnapshot(key, base), offered: role ? supportSnapshot(key, supportRolePolicies(base, role, normalizeFavoriteFolderLimit), base) : null };
			}),
			roles: roles.map(role => ({ id: role.id, name: role.name })),
			rolePreview: previewRole ? {
				id: previewRole.id, name: previewRole.name,
				benefits: HATASK_SUPPORT_POLICY_KEYS.map(key => ({ key, snapshot: supportSnapshot(key, supportRolePolicies(base, previewRole, normalizeFavoriteFolderLimit), base) })),
			} : null,
		};
	}

	public async update(settings: Omit<HataskSupportSettings, 'navButtonVisible'> & { navButtonVisible?: boolean }) {
		if (!safeSupportUrl(settings.url) || !safeSupportUrl(settings.manageUrl) || new Set(settings.benefits.map(b => b.key)).size !== settings.benefits.length) {
			throw new ApiError(HATASK_SUPPORT_ERRORS.invalidSettings);
		}
		// A removed reference is deliberately retained and shown as unavailable, never assigned.
		const current = await this.settings();
		await this.metaService.update({ hataskSupport: { ...settings, navButtonVisible: settings.navButtonVisible ?? current.navButtonVisible } });
		return { saved: true };
	}

	private async supporterPage(me: MiUser, offset: number, limit: number, admin: boolean, query = '', registeredOnly = true) {
		const usersQuery = this.userQuery(me, !admin);
		if (!admin || registeredOnly) usersQuery.andWhere('user.hataskSupporter = TRUE');
		if (admin && query) usersQuery.andWhere('user.usernameLower LIKE :query', { query: `%${query.toLowerCase().replace(/[\\%_]/g, '\\$&')}%` });
		const [users, total] = await usersQuery.orderBy('user.id', 'ASC').skip(offset).take(limit).getManyAndCount();
		const packed = await this.userEntityService.packMany(users, me, { schema: 'UserLite' });
		return { records: users, users: packed, total, hasMore: offset + users.length < total };
	}

	public async supporters(me: MiUser, offset: number, limit: number) {
		if (!supportConfigured(await this.settings())) return { users: [], total: 0, hasMore: false };
		const { users, total, hasMore } = await this.supporterPage(me, offset, limit, false);
		return { users, total, hasMore };
	}

	public async adminSupporters(me: MiUser, offset: number, limit: number, query: string, registeredOnly: boolean) {
		const { records, users, total, hasMore } = await this.supporterPage(me, offset, limit, true, query, registeredOnly);
		return { users: users.map((user, i) => ({ ...user, isSupporter: records[i].hataskSupporter })), total, hasMore };
	}

	public async setSupporter(userId: string, enabled: boolean) {
		const eligibility = { id: userId, host: IsNull(), ...(enabled ? { isSuspended: false, isDeleted: false } : {}) };
		const changed = await this.users.update(eligibility, { hataskSupporter: enabled });
		if (!changed.affected) throw new ApiError(HATASK_SUPPORT_ERRORS.noSuchUser);
		return { isSupporter: enabled };
	}
}
