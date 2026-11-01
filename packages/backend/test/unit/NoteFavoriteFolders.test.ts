/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { MiUser } from '@/models/User.js';
import { MiNote } from '@/models/Note.js';
import { MiNoteFavorite } from '@/models/NoteFavorite.js';
import { MiNoteFavoriteFolder } from '@/models/NoteFavoriteFolder.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';
import { DEFAULT_POLICIES, normalizeFavoriteFolderLimit } from '@/core/RoleService.js';
import { NoteFavoriteEntityService } from '@/core/entities/NoteFavoriteEntityService.js';
import CreateFavorite, { meta as favoriteCreateMeta } from '@/server/api/endpoints/notes/favorites/create.js';
import DeleteFavorite, { meta as favoriteDeleteMeta } from '@/server/api/endpoints/notes/favorites/delete.js';
import MoveFavorite, { meta as favoriteMoveMeta } from '@/server/api/endpoints/notes/favorites/move.js';
import Favorites, { meta as favoritesMeta } from '@/server/api/endpoints/i/favorites.js';
import State from '@/server/api/endpoints/notes/state.js';
import ListFolder, { meta as listMeta } from '@/server/api/endpoints/notes/favorites/folders/list.js';
import CreateFolder, { meta as createMeta } from '@/server/api/endpoints/notes/favorites/folders/create.js';
import UpdateFolder, { meta as updateMeta } from '@/server/api/endpoints/notes/favorites/folders/update.js';
import DeleteFolder, { meta as deleteMeta } from '@/server/api/endpoints/notes/favorites/folders/delete.js';
import UpdateDefaultPolicies from '@/server/api/endpoints/admin/roles/update-default-policies.js';
import UpdateRole from '@/server/api/endpoints/admin/roles/update.js';

// Transactional in-memory repository: row-lock acquisition happens before a
// transaction snapshot, with injected failure/rollback. No developer DB is used.
type Row = Record<string, any>;
type Tables = { folders: Row[]; favorites: Row[]; notes: Row[] };
const owner = { id: 'owner' } as never;

function fixture() {
	let data: Tables = { folders: [], favorites: [], notes: [1, 2, 3, 4, 5].map(n => ({ id: `n${n}`, userId: 'author', userHost: null })) };
	const policy = { favoriteFolderLimit: 5, canCreateFavoriteSubfolders: true };
	const locks = new Map<string, Promise<void>>();
	const calls: string[] = [];
	let serial = 1;
	let failOn = '';
	const visible = vi.fn().mockResolvedValue(true);
	const policies = vi.fn(async () => ({ ...policy }));
	const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => value?.type === 'in' ? value.value.includes(row[key]) : row[key] === value);

	function repositories(getData: () => Tables, locked: () => boolean) {
		return (model: unknown) => {
			const key = model === MiNoteFavoriteFolder ? 'folders' : model === MiNoteFavorite ? 'favorites' : 'notes';
			const rows = () => getData()[key];
			const write = (operation: string) => {
				if (!locked()) throw new Error('write without owner lock');
				calls.push(`${key}.${operation}`);
				if (`${key}.${operation}` === failOn) throw new Error('injected write failure');
			};
			return {
				find: async ({ where }: Row) => structuredClone(rows().filter(row => matches(row, where)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))),
				findOneBy: async (where: Row) => structuredClone(rows().find(row => matches(row, where)) ?? null),
				existsBy: async (where: Row) => rows().some(row => matches(row, where)),
				countBy: async (where: Row) => rows().filter(row => matches(row, where)).length,
				create: (row: Row) => row,
				insert: async (row: Row) => { write('insert'); rows().push(structuredClone(row)); },
				update: async (where: Row, patch: Row) => {
					write('update'); let affected = 0;
					for (const row of rows()) if (matches(row, where)) { Object.assign(row, patch); affected++; }
					return { affected };
				},
				delete: async (where: Row) => {
					write('delete'); getData()[key] = rows().filter(row => !matches(row, where));
				},
				createQueryBuilder: () => {
					let userId = '';
					const query: Row = {
						select: () => query, addSelect: () => query, groupBy: () => query,
						where: (_: string, params: Row) => { userId = params.userId; return query; },
						getRawMany: async () => {
							const counts = new Map<string | null, number>();
							for (const favorite of rows().filter(row => row.userId === userId)) counts.set(favorite.folderId, (counts.get(favorite.folderId) ?? 0) + 1);
							return [...counts].map(([folderId, count]) => ({ folderId, count: String(count) }));
						},
					};
					return query;
				},
			};
		};
	}

	const transaction = vi.fn(async (...args: any[]) => {
		const callback = args.at(-1);
		let snapshot = structuredClone(data);
		let release: (() => void) | undefined;
		let locked = false;
		const ordinaryRepository = repositories(() => snapshot, () => locked);
		const manager = { getRepository: (model: unknown) => model === MiUser ? {
			findOneOrFail: async ({ where, lock }: Row) => {
				expect(lock).toEqual({ mode: 'pessimistic_write' });
				const prior = locks.get(where.id) ?? Promise.resolve();
				locks.set(where.id, new Promise<void>(resolveLock => { release = resolveLock; }));
				await prior;
				calls.push(`lock:${where.id}`);
				locked = true; snapshot = structuredClone(data);
				return { id: where.id };
			},
		} : ordinaryRepository(model) };
		try {
			const result = await callback(manager);
			if (locked) data = snapshot;
			return result;
		} finally { release?.(); }
	});
	const db = { transaction, getRepository: repositories(() => data, () => false) };
	const service = new NoteFavoriteFolderService(db as never, { gen: () => `saved${serial++}` } as never, { getUserPolicies: policies } as never, { isVisibleForMe: visible } as never);
	return {
		service, policy, policies, visible, calls, transaction,
		get data() { return data; },
		fail(operation: string) { failOn = operation; },
		root(name = 'Folder') { return service.create('owner', { name, color: 'rose' }); },
	};
}

function identity(rows: Row[]) {
	return rows.map(({ folderId, ...rest }) => rest);
}

describe('favorites folder preservation and ownership', () => {
	test('legacy favorites remain unfiled with the original ID, note and save order', async () => {
		const f = fixture();
		f.data.favorites.push({ id: 'old1', userId: 'owner', noteId: 'n1', folderId: null }, { id: 'old2', userId: 'owner', noteId: 'n2', folderId: null });
		const before = identity(f.data.favorites);
		const root = await f.root();
		await f.service.moveFavorite('owner', 'n1', root.id);
		expect(identity(f.data.favorites)).toEqual(before);
		await f.service.moveFavorite('owner', 'n1', null);
		expect(f.data.favorites.map(row => row.folderId)).toEqual([null, null]);
		expect(identity(f.data.favorites)).toEqual(before);
	});
	test('parent deletion moves all parent/child favorites to unfiled, preserving unrelated folders and records', async () => {
		const f = fixture(), root = await f.root(), other = await f.root('Other');
		const child = await f.service.create('owner', { name: 'Child', color: 'green', parentId: root.id });
		for (const [noteId, folderId] of [['n1', root.id], ['n2', child.id], ['n3', other.id], ['n4', null]]) await f.service.createFavorite('owner', noteId!, folderId);
		const before = identity(f.data.favorites);
		expect(await f.service.delete('owner', root.id)).toEqual({ movedCount: 2 });
		expect(f.data.folders.map(row => row.id)).toEqual([other.id]);
		expect(identity(f.data.favorites)).toEqual(before);
		expect(f.data.favorites.map(row => row.folderId)).toEqual([null, null, other.id, null]);
	});
	test('child deletion keeps its parent and parent favorites', async () => {
		const f = fixture(), root = await f.root();
		const child = await f.service.create('owner', { name: 'Child', color: 'blue', parentId: root.id });
		await f.service.createFavorite('owner', 'n1', root.id); await f.service.createFavorite('owner', 'n2', child.id);
		expect(await f.service.delete('owner', child.id)).toEqual({ movedCount: 1 });
		expect(f.data.favorites.map(row => row.folderId)).toEqual([root.id, null]);
		expect(f.data.folders.map(row => row.id)).toEqual([root.id]);
	});
	test('failed folder deletion rolls back the preceding unfiled update', async () => {
		const f = fixture(), root = await f.root();
		await f.service.createFavorite('owner', 'n1', root.id); const before = structuredClone(f.data);
		f.fail('folders.delete'); await expect(f.service.delete('owner', root.id)).rejects.toThrow('injected');
		expect(f.data).toEqual(before);
	});
	test('failed reorder rolls back both the moved folder and sibling order', async () => {
		const f = fixture(), root = await f.root(), other = await f.root('Other');
		const before = structuredClone(f.data); f.fail('folders.update');
		await expect(f.service.update('owner', other.id, { position: 0, name: 'changed' })).rejects.toThrow('injected');
		expect(f.data).toEqual(before); expect(root.position).toBe(0);
	});
	test('foreign ownership is rejected for create parent, read filter, update, delete and favorite destination', async () => {
		const f = fixture();
		const foreign = await f.service.create('other', { name: 'Secret', color: 'blue' });
		const before = structuredClone(f.data);
		for (const operation of [
			() => f.service.create('owner', { name: 'Child', color: 'rose', parentId: foreign.id }),
			() => f.service.assertFolderOwner('owner', foreign.id),
			() => f.service.update('owner', foreign.id, { name: 'Leaked' }),
			() => f.service.delete('owner', foreign.id),
			() => f.service.createFavorite('owner', 'n1', foreign.id),
		]) await expect(operation()).rejects.toMatchObject({ code: 'noSuchFolder' });
		expect(f.data).toEqual(before);
		expect((await f.service.list('owner')).folders).toEqual([]);
	});
	test('moving favorites cannot modify another account favorite or use its folder', async () => {
		const f = fixture(), root = await f.root();
		await f.service.createFavorite('other', 'n1');
		await expect(f.service.moveFavorite('owner', 'n1', root.id)).rejects.toMatchObject({ code: 'notFavorited' });
		await f.service.createFavorite('owner', 'n2');
		const foreign = await f.service.create('other', { name: 'Secret', color: 'blue' });
		await expect(f.service.moveFavorite('owner', 'n2', foreign.id)).rejects.toMatchObject({ code: 'noSuchFolder' });
		expect(f.data.favorites.every(row => row.folderId === null)).toBe(true);
	});
	test('create and move require current visibility, and failures preserve favorite identity/destination', async () => {
		const f = fixture(), root = await f.root();
		await f.service.createFavorite('owner', 'n1'); const before = structuredClone(f.data);
		f.visible.mockResolvedValue(false);
		await expect(f.service.createFavorite('owner', 'n2', root.id)).rejects.toMatchObject({ code: 'noSuchNote' });
		await expect(f.service.moveFavorite('owner', 'n1', root.id)).rejects.toMatchObject({ code: 'noSuchNote' });
		expect(f.data).toEqual(before);
		// An inaccessible old favorite can still be explicitly removed by its owner.
		await f.service.deleteFavorite('owner', 'n1'); expect(f.data.favorites).toHaveLength(0);
	});
	test('visibility receives reply context so replies to the viewer remain eligible', async () => {
		const f = fixture();
		f.data.notes[0].userId = 'owner';
		f.data.notes[1].replyId = 'n1';
		f.visible.mockImplementation(async note => note.reply?.userId === 'owner');
		await f.service.createFavorite('owner', 'n2');
		expect(f.visible).toHaveBeenCalledWith(expect.objectContaining({ reply: expect.objectContaining({ id: 'n1', userId: 'owner' }) }), 'owner');
		expect(f.data.favorites).toHaveLength(1);
	});
	test('missing destinations fail without silently creating an unfiled favorite', async () => {
		const f = fixture(), root = await f.root(); await f.service.delete('owner', root.id);
		await expect(f.service.createFavorite('owner', 'n1', root.id)).rejects.toMatchObject({ code: 'noSuchFolder' });
		expect(f.data.favorites).toEqual([]);
	});
	test('counts describe direct membership only and exclude other owners', async () => {
		const f = fixture(), root = await f.root();
		const child = await f.service.create('owner', { name: 'Child', color: 'green', parentId: root.id });
		await f.service.createFavorite('owner', 'n1', root.id); await f.service.createFavorite('owner', 'n2', child.id);
		await f.service.createFavorite('owner', 'n3'); await f.service.createFavorite('other', 'n4');
		const list = await f.service.list('owner');
		expect(list).toMatchObject({ totalCount: 3, unfiledCount: 1, folderLimit: 5, canCreateSubfolders: true });
		expect(list.folders.map(folder => folder.count)).toEqual([1, 1]);
		expect(list.folders[0]).not.toHaveProperty('userId');
		expect(f.transaction).toHaveBeenLastCalledWith('REPEATABLE READ', expect.any(Function));
	});
});

describe('folder policy, hierarchy and concurrency', () => {
	test('defaults allow two folders but no children, with finite hard caps for legacy policy values', () => {
		expect(DEFAULT_POLICIES).toMatchObject({ favoriteFolderLimit: 2, canCreateFavoriteSubfolders: false });
		for (const [value, expected] of [[100, 5], [-1, 0], [2.9, 2], [NaN, 2], [Infinity, 2], ['5', 2]]) expect(normalizeFavoriteFolderLimit([value])).toBe(expected);
	});
	test('owner locks serialize concurrent folder creation at the actual total including children', async () => {
		const f = fixture(); f.policy.favoriteFolderLimit = 2;
		const results = await Promise.allSettled(['A', 'B', 'C'].map(name => f.root(name)));
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
		expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'folderLimitExceeded' } });
		expect(f.data.folders).toHaveLength(2); expect(f.calls.filter(call => call === 'lock:owner')).toHaveLength(3);
		const childFixture = fixture(); childFixture.policy.favoriteFolderLimit = 2; const root = await childFixture.root();
		await childFixture.service.create('owner', { name: 'Child', color: 'blue', parentId: root.id });
		await expect(childFixture.root('Third')).rejects.toMatchObject({ code: 'folderLimitExceeded' });
	});
	test('concurrent duplicate favorites and sibling names are rejected without duplicates', async () => {
		const f = fixture();
		const names = await Promise.allSettled([f.root('Same'), f.root(' Same ')]);
		expect(names.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(names.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'duplicateFolderName' } });
		const favorites = await Promise.allSettled([f.service.createFavorite('owner', 'n1'), f.service.createFavorite('owner', 'n1')]);
		expect(favorites.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(favorites.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'alreadyFavorited' } });
		expect(f.data.favorites).toHaveLength(1);
	});
	test('delete before concurrent save fails the stale destination, without reverting to unfiled', async () => {
		const f = fixture(), root = await f.root();
		const results = await Promise.allSettled([f.service.delete('owner', root.id), f.service.createFavorite('owner', 'n1', root.id)]);
		expect(results[0].status).toBe('fulfilled'); expect(results[1]).toMatchObject({ reason: { code: 'noSuchFolder' } });
		expect(f.data.favorites).toEqual([]);
	});
	test('save before concurrent folder deletion preserves that favorite as unfiled', async () => {
		const f = fixture(), root = await f.root();
		await Promise.all([f.service.createFavorite('owner', 'n1', root.id), f.service.delete('owner', root.id)]);
		expect(f.data.favorites).toEqual([expect.objectContaining({ noteId: 'n1', userId: 'owner', folderId: null })]);
	});
	test('role loss/quota reduction keeps existing children, saves, edits, same-depth moves and extraction', async () => {
		const f = fixture(), root = await f.root('A'), other = await f.root('B');
		const child = await f.service.create('owner', { name: 'Child', color: 'green', parentId: root.id });
		f.policy.favoriteFolderLimit = 0; f.policy.canCreateFavoriteSubfolders = false;
		await expect(f.root('New')).rejects.toMatchObject({ code: 'folderLimitExceeded' });
		await f.service.createFavorite('owner', 'n1', child.id);
		await f.service.moveFavorite('owner', 'n1', root.id);
		await f.service.update('owner', child.id, { name: 'Renamed', color: 'blue', parentId: other.id });
		await f.service.update('owner', other.id, { position: 0 });
		expect((await f.service.list('owner')).folders).toHaveLength(3);
		await f.service.update('owner', child.id, { parentId: null });
		await expect(f.service.update('owner', child.id, { parentId: root.id })).rejects.toMatchObject({ code: 'subfoldersNotAllowed' });
	});
	test('new children and increased depth require the role, but third levels/cycles never work', async () => {
		const f = fixture(), root = await f.root('A'), other = await f.root('B');
		f.policy.canCreateFavoriteSubfolders = false;
		await expect(f.service.create('owner', { name: 'Child', color: 'rose', parentId: root.id })).rejects.toMatchObject({ code: 'subfoldersNotAllowed' });
		f.policy.canCreateFavoriteSubfolders = true;
		const child = await f.service.create('owner', { name: 'Child', color: 'blue', parentId: root.id });
		for (const operation of [
			() => f.service.update('owner', root.id, { parentId: root.id }),
			() => f.service.update('owner', root.id, { parentId: child.id }),
			() => f.service.update('owner', root.id, { parentId: other.id }),
			() => f.service.create('owner', { name: 'Grandchild', color: 'rose', parentId: child.id }),
		]) await expect(operation()).rejects.toMatchObject({ code: 'invalidFolderHierarchy' });
	});
	test('name collision is checked on rename/reparent; blank and too-long names fail, other parents may repeat', async () => {
		const f = fixture(), root = await f.root('Name'), other = await f.root('Other');
		const child = await f.service.create('owner', { name: ' Name ', color: 'green', parentId: root.id });
		expect(child.name).toBe('Name');
		await expect(f.service.update('owner', other.id, { name: ' Name ' })).rejects.toMatchObject({ code: 'duplicateFolderName' });
		await expect(f.service.update('owner', child.id, { parentId: null })).rejects.toMatchObject({ code: 'duplicateFolderName' });
		for (const name of ['　 ', 'x'.repeat(101)]) await expect(f.service.update('owner', child.id, { name })).rejects.toMatchObject({ code: 'invalidFolderName' });
		await expect(f.service.update('owner', child.id, { color: 'red' as never })).rejects.toMatchObject({ code: 'invalidFolderColor' });
	});
	test('folder ordering is independent of favorite IDs, membership and child order', async () => {
		const f = fixture(), first = await f.root('A'), second = await f.root('B');
		const child = await f.service.create('owner', { name: 'Child', color: 'green', parentId: first.id });
		await f.service.createFavorite('owner', 'n1', child.id); const before = structuredClone(f.data.favorites);
		await f.service.update('owner', second.id, { position: 0 });
		expect(f.data.folders.find(row => row.id === first.id)?.position).toBe(1);
		expect(f.data.folders.find(row => row.id === second.id)?.position).toBe(0);
		expect(f.data.folders.find(row => row.id === child.id)).toMatchObject({ parentId: first.id, position: 0 });
		expect(f.data.favorites).toEqual(before);
	});
});

describe('favorites API compatibility and validation', () => {
	test('all endpoints retain credentials and read/write favorites scopes; new writes declare limits', () => {
		for (const meta of [favoritesMeta, listMeta]) expect(meta).toMatchObject({ requireCredential: true, kind: 'read:favorites' });
		for (const meta of [favoriteCreateMeta, favoriteDeleteMeta, favoriteMoveMeta, createMeta, updateMeta, deleteMeta]) expect(meta).toMatchObject({ requireCredential: true, kind: 'write:favorites' });
		for (const meta of [favoriteMoveMeta, createMeta, updateMeta, deleteMeta]) expect(meta.limit.max).toBeGreaterThan(0);
		expect(favoriteCreateMeta.limit).toEqual({ duration: 3600000, max: 20 });
	});
	test('legacy create omits folderId, preserves duplicate error ID/achievement, and delete only removes one favorite', async () => {
		const f = fixture(), achievement = { create: vi.fn() };
		const create = new CreateFavorite(f.service, achievement as never);
		await create.exec({ noteId: 'n1' }, owner, null, null);
		expect(f.data.favorites[0]).toMatchObject({ noteId: 'n1', folderId: null });
		expect(achievement.create).toHaveBeenCalledWith('author', 'myNoteFavorited1');
		await expect(create.exec({ noteId: 'n1' }, owner, null, null)).rejects.toMatchObject({ code: 'ALREADY_FAVORITED', id: 'a402c12b-34dd-41d2-97d8-4d2ffd96a1a6' });
		await new DeleteFavorite(f.service).exec({ noteId: 'n1' }, owner, null, null);
		expect(f.data.favorites).toEqual([]); expect(f.data.notes).toHaveLength(5);
	});
	test('legacy list omits the folder filter while explicit null filters unfiled and IDs require owner validation', async () => {
		const f = fixture(), root = await f.root();
		const where = vi.fn(); const query = { andWhere: where, leftJoinAndSelect: vi.fn(), limit: vi.fn(), getMany: vi.fn(async () => []) };
		where.mockReturnValue(query); query.leftJoinAndSelect.mockReturnValue(query); query.limit.mockReturnValue(query);
		const endpoint = new Favorites({ createQueryBuilder: () => query } as never, { packMany: vi.fn(async rows => rows) } as never, { makePaginationQuery: () => query, generateChannelVisibilityQuery: vi.fn(async () => {}) } as never, f.service);
		await endpoint.exec({}, owner, null, null); expect(where).toHaveBeenCalledExactlyOnceWith('favorite.userId = :meId', { meId: 'owner' });
		where.mockClear(); await endpoint.exec({ folderId: null }, owner, null, null); expect(where).toHaveBeenCalledWith('favorite.folderId IS NULL');
		where.mockClear(); await endpoint.exec({ folderId: root.id }, owner, null, null); expect(where).toHaveBeenCalledWith('favorite.folderId = :folderId', { folderId: root.id });
		await expect(endpoint.exec({ folderId: 'foreign' }, owner, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_FAVORITE_FOLDER' });
	});
	test('folder and favorite endpoint callbacks use the session owner and validation rejects invalid colors/positions', async () => {
		const f = fixture();
		const created = await new CreateFolder(f.service).exec({ name: 'Folder' }, owner, null, null);
		expect(created).toMatchObject({ color: 'rose', parentId: null });
		await expect(new UpdateFolder(f.service).exec({ folderId: created.id, color: '<script>' }, owner, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(new UpdateFolder(f.service).exec({ folderId: created.id, position: -1 }, owner, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await new CreateFavorite(f.service, { create: vi.fn() } as never).exec({ noteId: 'n1', folderId: created.id }, owner, null, null);
		await new MoveFavorite(f.service).exec({ noteId: 'n1', folderId: null }, owner, null, null);
		expect(await new ListFolder(f.service).exec({}, owner, null, null)).toMatchObject({ totalCount: 1, unfiledCount: 1 });
		await new DeleteFolder(f.service).exec({ folderId: created.id }, owner, null, null);
		expect(f.data.favorites).toHaveLength(1);
	});
	test('notes/state reads only the owner favorite and exposes optional nullable destination', async () => {
		const findOne = vi.fn(async () => ({ folderId: 'folder' }));
		const endpoint = new State({ findOneBy: async () => ({ id: 'n1' }), count: async () => 0 } as never, { count: async () => 0 } as never, { findOne } as never, { isChannelVisibleForMe: async () => true } as never);
		expect(await endpoint.exec({ noteId: 'n1' }, owner, null, null)).toMatchObject({ isFavorited: true, favoriteFolderId: 'folder' });
		expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', noteId: 'n1' } }));
		findOne.mockResolvedValueOnce(null as never);
		expect(await endpoint.exec({ noteId: 'n1' }, owner, null, null)).toEqual({ isFavorited: false, isMutedThread: false, isRenoted: false });
	});
	test('notes/state restricts folder membership to first-party sessions or read:favorites tokens', async () => {
		const endpoint = new State({ findOneBy: async () => ({ id: 'n1' }), count: async () => 0 } as never, { count: async () => 0 } as never, { findOne: async () => ({ folderId: 'folder' }) } as never, { isChannelVisibleForMe: async () => true } as never);
		for (const token of [null, { permission: ['read:account', 'read:favorites'] }]) {
			expect(await endpoint.exec({ noteId: 'n1' }, owner, token as never, null)).toMatchObject({ isFavorited: true, favoriteFolderId: 'folder' });
		}
		expect(await endpoint.exec({ noteId: 'n1' }, owner, { permission: ['read:account'] } as never, null)).toEqual({ isFavorited: true, isMutedThread: false, isRenoted: false });
	});
	test('packing preserves the favorite saved timestamp and makes old missing folder fields null', async () => {
		const pack = vi.fn(async () => ({ id: 'n1' }));
		const entity = new NoteFavoriteEntityService({} as never, { pack } as never, { parse: () => ({ date: new Date('2020-01-01T00:00:00Z') }) } as never);
		const row = { id: 'original', noteId: 'n1', userId: 'owner' };
		expect(await entity.pack(row as never, owner)).toMatchObject({ id: 'original', noteId: 'n1', folderId: null, createdAt: '2020-01-01T00:00:00.000Z' });
	});
	test('value-only new role policies receive real defaults while unrelated policies remain unchanged', async () => {
		const update = vi.fn();
		const endpoint = new UpdateRole({ findOneBy: async () => ({ id: 'role' }) } as never, { update } as never);
		await endpoint.exec({ roleId: 'role', policies: { favoriteFolderLimit: { value: 3 }, canCreateFavoriteSubfolders: { value: true }, unrelated: { value: 'original', priority: 2, useDefault: false } } }, owner, null, null);
		expect(update.mock.calls[0][1].policies).toEqual({
			favoriteFolderLimit: { value: 3, priority: 0, useDefault: false },
			canCreateFavoriteSubfolders: { value: true, priority: 0, useDefault: false },
			unrelated: { value: 'original', priority: 2, useDefault: false },
		});
	});
	test('admin policies reject invalid folder counts/types before changing roles/defaults', async () => {
		const defaults = new UpdateDefaultPolicies({} as never, {} as never, {} as never);
		const role = new UpdateRole({} as never, {} as never);
		for (const value of [-1, 6, 2.5, '2', null]) {
			await expect(defaults.exec({ policies: { favoriteFolderLimit: value } }, owner, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
			await expect(role.exec({ roleId: 'role', policies: { favoriteFolderLimit: { value } } }, owner, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		await expect(defaults.exec({ policies: { canCreateFavoriteSubfolders: 'true' } }, owner, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});
});

describe('additive migration guard', () => {
	test('folder deletion relations SET NULL favorites while cascading only child folders', () => {
		const relations = getMetadataArgsStorage().relations;
		expect(relations.find(relation => relation.target === MiNoteFavorite && relation.propertyName === 'folder')?.options.onDelete).toBe('SET NULL');
		expect(relations.find(relation => relation.target === MiNoteFavoriteFolder && relation.propertyName === 'parent')?.options.onDelete).toBe('CASCADE');
		const column = getMetadataArgsStorage().columns.find(column => column.target === MiNoteFavorite && column.propertyName === 'folderId');
		expect(column?.options.nullable).toBe(true);
	});
	test('migration adds nullable membership without rewriting/deleting existing favorites; detector has positive control', () => {
		const source = readFileSync(resolve(process.cwd(), 'migration/1789580000000-add-note-favorite-folders.js'), 'utf8');
		const destructive = (sql: string) => /(?:DELETE FROM|TRUNCATE|UPDATE|DROP TABLE)\s+"?note_favorite"?(?:\s|;|$)/i.test(sql);
		expect(destructive('DELETE FROM "note_favorite";')).toBe(true);
		expect(destructive(source)).toBe(false);
		expect(source).toContain('ADD "folderId" varchar(32) NULL');
		expect(source).toContain('REFERENCES "note_favorite_folder"("id") ON DELETE SET NULL');
		expect(source).toContain('"userId", "name") WHERE "parentId" IS NULL');
		expect(source).toContain('"userId", "parentId", "name") WHERE "parentId" IS NOT NULL');
		expect(source).toContain('rollback requires an explicit folder assignment backup');
	});
});
