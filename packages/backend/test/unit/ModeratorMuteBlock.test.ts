/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { RoleService } from '@/core/RoleService.js';
import MuteEndpoint from '@/server/api/endpoints/mute/create.js';
import BlockingEndpoint from '@/server/api/endpoints/blocking/create.js';
import RenoteMuteEndpoint from '@/server/api/endpoints/renote-mute/create.js';

function fixture() {
	const actor = { id: 'actor', host: null };
	const people = new Map(['ordinary', 'moderator', 'administrator', 'both', 'root'].map(id => [id, { id, host: null }]));
	const roleDefinitions = [
		{ id: 'moderatorRole', target: 'manual', isModerator: true, isAdministrator: false },
		{ id: 'administratorRole', target: 'manual', isModerator: false, isAdministrator: true },
	];
	const assignments = [
		{ userId: 'moderator', roleId: 'moderatorRole', expiresAt: null },
		{ userId: 'administrator', roleId: 'administratorRole', expiresAt: null },
		{ userId: 'both', roleId: 'moderatorRole', expiresAt: null },
		{ userId: 'both', roleId: 'administratorRole', expiresAt: null },
	];
	// Exercise the real administrator/root checks and role lookup with in-memory data.
	const roles = Object.assign(Object.create(RoleService.prototype), {
		meta: { rootUserId: 'root' },
		rolesCache: { fetch: vi.fn().mockResolvedValue(roleDefinitions) },
		roleAssignmentByUserIdCache: { fetch: vi.fn((_id: string, load: () => Promise<unknown>) => load()) },
		roleAssignmentsRepository: { findBy: vi.fn(async ({ userId }: { userId: string }) => assignments.filter(assignment => assignment.userId === userId)) },
	}) as RoleService;
	const relations = { exists: vi.fn().mockResolvedValue(false) };
	const getter = { getUser: vi.fn(async (id: string) => people.get(id)) };
	const users = { findOneByOrFail: vi.fn().mockResolvedValue(actor) };
	const entity = { pack: vi.fn(async (id: string) => people.get(id)) };
	const muting = { mute: vi.fn().mockResolvedValue(undefined) };
	const blocking = { block: vi.fn().mockResolvedValue(undefined) };
	const renoteMuting = { mute: vi.fn().mockResolvedValue(undefined) };
	const endpoints = {
		mute: new MuteEndpoint(relations as never, getter as never, muting as never, roles),
		blocking: new BlockingEndpoint(users as never, relations as never, entity as never, getter as never, blocking as never, roles),
		renoteMute: new RenoteMuteEndpoint(relations as never, getter as never, renoteMuting as never, roles),
	};
	const writes = { mute: muting.mute, blocking: blocking.block, renoteMute: renoteMuting.mute };
	return { actor, people, roles, relations, entity, endpoints, writes };
}

describe.each([
	{ name: 'mute/create', key: 'mute', error: 'CANNOT_MUTE_ADMINISTRATOR' },
	{ name: 'blocking/create', key: 'blocking', error: 'CANNOT_BLOCK_ADMINISTRATOR' },
	{ name: 'renote-mute/create', key: 'renoteMute', error: 'CANNOT_RENOTE_MUTE_ADMINISTRATOR' },
] as const)('$name の管理者保護', ({ key, error }) => {
	test.each(['ordinary', 'moderator'])('%s を対象に作成できる', async targetId => {
		const f = fixture();
		const target = f.people.get(targetId);
		if (!target) throw new Error(`Missing test user: ${targetId}`);
		expect(await f.roles.isAdministrator(target)).toBe(false);
		if (targetId === 'moderator') {
			expect(await f.roles.isModerator(target)).toBe(true);
		}

		await f.endpoints[key].exec({ userId: targetId }, f.actor as never, null, null);

		expect(f.writes[key]).toHaveBeenCalledExactlyOnceWith(...(key === 'mute' ? [f.actor, target, null] : [f.actor, target]));
		expect(f.relations.exists).toHaveBeenCalledExactlyOnceWith({
			where: key === 'blocking'
				? { blockerId: f.actor.id, blockeeId: targetId }
				: { muterId: f.actor.id, muteeId: targetId },
		});
	});

	test.each(['administrator', 'both', 'root'])('%s は変更前に拒否する', async targetId => {
		const f = fixture();
		const target = f.people.get(targetId);
		if (!target) throw new Error(`Missing test user: ${targetId}`);
		expect(await f.roles.isAdministrator(target)).toBe(true);

		await expect(f.endpoints[key].exec({ userId: targetId }, f.actor as never, null, null)).rejects.toMatchObject({ code: error });

		for (const write of Object.values(f.writes)) {
			expect(write).not.toHaveBeenCalled();
		}
		expect(f.relations.exists).not.toHaveBeenCalled();
		expect(f.entity.pack).not.toHaveBeenCalled();
	});
});
