/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { AvatarDecorationService } from '@/core/AvatarDecorationService.js';
import { hasCompletedHataskFlowerCollection, hasCompletedHataskFlowerCollectionMany } from '@/core/hatask-flower-completion.js';
import { HATASK_FLOWER_CATALOG } from '@/misc/hatask-flower-catalog.js';
import { flowerSeason } from '@/core/hatask-flower-v2.js';
import type { FindOperator } from 'typeorm';

vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/ReactionsBufferingService.js', () => ({ ReactionsBufferingService: class {} }));

/* eslint-disable @typescript-eslint/no-explicit-any -- Services are exercised with in-memory repositories. */
type Node = { id: string; userId: string; channelId: string | null; replyId: string | null; renoteId: string | null };

function visibilityFixture(nodes: Node[], privateChannelIds: string[] = [], members: string[] = []) {
	const byId = new Map(nodes.map(node => [node.id, node]));
	const notesRepository = { find: vi.fn(async ({ where }: { where: { id: FindOperator<string[]> } }) => where.id.value.flatMap(id => {
		const node = byId.get(id);
		return node ? [{ ...node }] : [];
	})) };
	const channelsRepository = { findBy: vi.fn(async ({ id }: { id: FindOperator<string[]> }) => id.value.map(key => ({ id: key, isPrivate: privateChannelIds.includes(key), userId: 'owner', moderatorUserIds: [] }))) };
	const channelMembersRepository = { findBy: vi.fn(async ({ channelId, userId }: { channelId: FindOperator<string[]>; userId: string }) => members.includes(userId) ? channelId.value.map(id => ({ channelId: id, userId })) : []) };
	const roleService = { isModerator: vi.fn(async () => false), isAdministrator: vi.fn(async () => false) };
	const service = Object.assign(Object.create(NoteEntityService.prototype), { notesRepository, channelsRepository, channelMembersRepository, roleService }) as NoteEntityService;
	return { service, notesRepository, channelsRepository };
}

// A deep public thread: leaf -> 7 -> ... -> 1 -> root.
const thread: Node[] = [
	{ id: 'root', userId: 'a', channelId: null, replyId: null, renoteId: null },
	...Array.from({ length: 8 }, (_, index) => ({ id: index === 7 ? 'leaf' : `n${index + 1}`, userId: 'a', channelId: null, replyId: index === 0 ? 'root' : `n${index}`, renoteId: null })),
];

describe('channel visibility reuses immutable ancestor data', () => {
	test('a repeated check of the same reply chain does not walk the database again', async () => {
		const f = visibilityFixture(thread);
		const leaf = { id: 'leaf', userId: 'a', channelId: null, replyId: 'n7', renoteId: null };
		expect(await f.service.isChannelVisibleForMe(leaf, 'viewer')).toBe(true);
		const firstWalk = f.notesRepository.find.mock.calls.length;
		expect(firstWalk).toBe(8);
		// Every subsequent reaction event for the same note (any viewer) is answered from memory.
		for (const viewer of ['viewer', 'other', null]) expect(await f.service.isChannelVisibleForMe(leaf, viewer)).toBe(true);
		expect(f.notesRepository.find).toHaveBeenCalledTimes(firstWalk);
	});

	test('cached ancestors still apply each viewer\'s current channel access', async () => {
		const nodes: Node[] = [
			{ id: 'secret', userId: 'a', channelId: 'private', replyId: null, renoteId: null },
			{ id: 'reply', userId: 'b', channelId: 'private', replyId: 'secret', renoteId: null },
		];
		const f = visibilityFixture(nodes, ['private'], ['member']);
		const reply = { id: 'reply', userId: 'b', channelId: 'private', replyId: 'secret', renoteId: null };
		expect(await f.service.isChannelVisibleForMe(reply, 'member')).toBe(true);
		expect(await f.service.isChannelVisibleForMe(reply, 'stranger')).toBe(false);
		expect(await f.service.isChannelVisibleForMe(reply, null)).toBe(false);
		// Access is never cached: the channel row is reread for every decision.
		expect(f.channelsRepository.findBy).toHaveBeenCalledTimes(3);
		expect(f.notesRepository.find).toHaveBeenCalledTimes(1);
	});

	test('the cache is per instance, so independent services never share stale graphs', async () => {
		const first = visibilityFixture(thread);
		const second = visibilityFixture(thread);
		const leaf = { id: 'leaf', userId: 'a', channelId: null, replyId: 'n7', renoteId: null };
		await first.service.isChannelVisibleForMe(leaf, null);
		await second.service.isChannelVisibleForMe(leaf, null);
		expect(second.notesRepository.find).toHaveBeenCalledTimes(8);
	});
});

describe('reward decoration completion is resolved once per page', () => {
	const season = flowerSeason(new Date());
	const speciesIds = HATASK_FLOWER_CATALOG.filter(flower => flower.season === season).map(flower => flower.id);

	function db(completedWallets: string[], harvested: Record<string, string[]>) {
		return {
			// EntityManager.query is generic (Promise<T>); the fake returns rows of several shapes.
			query: vi.fn(async (sql: string, params: unknown[] = []): Promise<any> => {
				if (sql.includes('hatask_drop_wallet') && sql.includes('ANY')) return (params[0] as string[]).filter(id => completedWallets.includes(id)).map(userId => ({ userId }));
				if (sql.includes('hatask_drop_wallet')) return [{ flowerCollectionCompletedAt: completedWallets.includes(params[0] as string) ? new Date() : null }];
				if (sql.includes('COUNT(DISTINCT')) return (params[0] as string[]).filter(id => id in harvested).map(userId => ({ userId, species: String(new Set(harvested[userId].filter(s => speciesIds.includes(s))).size) }));
				return (harvested[params[0] as string] ?? []).filter(s => speciesIds.includes(s)).map(speciesId => ({ speciesId }));
			}),
		};
	}

	test('the batched answer equals the per-user answer for every kind of collector', async () => {
		const harvested = { full: speciesIds, partial: speciesIds.slice(1), duplicate: [...speciesIds.slice(1), speciesIds[1]], none: [] as string[] };
		const users = ['wallet', 'full', 'partial', 'duplicate', 'none', 'unknown'];
		const batched = await hasCompletedHataskFlowerCollectionMany(db(['wallet'], harvested), users);
		for (const user of users) {
			expect(batched.get(user)).toBe(await hasCompletedHataskFlowerCollection(db(['wallet'], harvested), user));
		}
		expect([...batched.entries()].filter(([, done]) => done).map(([user]) => user).sort()).toEqual(['full', 'wallet']);
	});

	test('only local wearers of a reward decoration are looked up, in two queries total', async () => {
		const manager = db([], { a: speciesIds });
		const service = Object.assign(Object.create(AvatarDecorationService.prototype), { usersRepository: { manager } }) as AvatarDecorationService;
		// getAll is a @bindThis prototype getter; stub it on the instance.
		Object.defineProperty(service, 'getAll', { value: async () => [{ id: 'reward', requiresHataskFlowerCompletion: true }, { id: 'plain', requiresHataskFlowerCompletion: false }] });
		const completions = await service.getHataskFlowerCompletions([
			{ id: 'a', host: null, avatarDecorations: [{ id: 'reward' }] },
			{ id: 'b', host: null, avatarDecorations: [{ id: 'plain' }] },
			{ id: 'remote', host: 'remote.test', avatarDecorations: [{ id: 'reward' }] },
			{ id: 'bare', host: null, avatarDecorations: [] },
		] as any);
		expect([...completions.entries()]).toEqual([['a', true]]);
		expect(manager.query).toHaveBeenCalledTimes(2);
		expect((manager.query.mock.calls[0] as unknown as [string, string[][]])[1][0]).toEqual(['a']);
	});
});
