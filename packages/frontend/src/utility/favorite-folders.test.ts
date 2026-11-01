/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { $i } from '@/i.js';
import { canCreateFavoriteFolder, deleteFavoriteFolder, favoriteFolderMoveError, favoriteFoldersState, refreshFavoriteFolders, saveFavoriteNote, updateFavoriteFolder } from '@/utility/favorite-folders.js';

const api = vi.hoisted(() => vi.fn());
const achievement = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: achievement }));
vi.mock('@/os.js', () => ({ popup: vi.fn() }));
vi.mock('@/i.js', async () => ({ $i: (await import('vue')).reactive({ id: 'owner', token: 'owner-token' }) }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _favoriteFolders: { accountChanged: 'account changed', limitReached: 'limit', selectedFolderMissing: 'missing', childrenNotAllowed: 'permission', maxDepth: 'depth', invalidMove: 'move' } } } } }));

const parent = { id: 'parent', parentId: null, name: 'Read', color: 'rose' as const, position: 0, count: 2 };
const child = { id: 'child', parentId: 'parent', name: 'Later', color: 'green' as const, position: 0, count: 1 };
const list = () => ({ folders: [{ ...parent }, { ...child }], totalCount: 4, unfiledCount: 1, folderLimit: 2, canCreateSubfolders: false });

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

let counter = 0;

beforeEach(() => {
	$i!.id = `owner-${++counter}`;
	$i!.token = 'owner-token';
	api.mockReset();
	achievement.mockReset();
	api.mockImplementation(async (endpoint) => endpoint === 'notes/favorites/folders/list' ? list() : undefined);
});

describe('favorite folder account and mutation safety', () => {
	test('loads existing folders even after quota/child permission loss and allows existing child destinations', async () => {
		await refreshFavoriteFolders();
		expect(favoriteFoldersState.folders).toHaveLength(2);
		expect(canCreateFavoriteFolder()).toBe(false);
		expect(canCreateFavoriteFolder('parent')).toBe(false);
		await saveFavoriteNote('note', 'child', 'move');
		expect(api).toHaveBeenCalledWith('notes/favorites/move', { noteId: 'note', folderId: 'child' }, 'owner-token');
		expect(api.mock.calls.some(([endpoint]) => endpoint === 'notes/favorites/create' || endpoint === 'notes/favorites/delete')).toBe(false);
		expect(achievement).not.toHaveBeenCalled();
	});

	test('failed save changes no shared state or achievement and can be retried once', async () => {
		await refreshFavoriteFolders();
		const revision = favoriteFoldersState.revision;
		api.mockImplementation(async (endpoint) => {
			if (endpoint === 'notes/favorites/create') throw Object.assign(new Error('Favorite folder not found'), { code: 'NO_SUCH_FAVORITE_FOLDER' });
			return list();
		});
		await expect(saveFavoriteNote('note', 'child', 'create')).rejects.toMatchObject({ code: 'NO_SUCH_FAVORITE_FOLDER' });
		expect(favoriteFoldersState.revision).toBe(revision);
		expect(achievement).not.toHaveBeenCalled();
		api.mockImplementation(async endpoint => endpoint.endsWith('/list') ? list() : undefined);
		await saveFavoriteNote('note', null, 'create');
		expect(favoriteFoldersState.lastChange).toEqual({ type: 'noteCreate', noteId: 'note', folderId: null });
		expect(achievement).toHaveBeenCalledExactlyOnceWith('noteFavorited1');
	});

	test('two simultaneous saves for one note issue only one mutation', async () => {
		const result = deferred<void>();
		api.mockImplementation(endpoint => endpoint === 'notes/favorites/create' ? result.promise : Promise.resolve(list()));
		const first = saveFavoriteNote('note', null, 'create');
		expect(await saveFavoriteNote('note', 'parent', 'create')).toBe(false);
		expect(api.mock.calls.filter(([endpoint]) => endpoint === 'notes/favorites/create')).toHaveLength(1);
		result.resolve();
		expect(await first).toBe(true);
		expect(achievement).toHaveBeenCalledTimes(1);
	});

	test('a late list from another account cannot repopulate shared state', async () => {
		const result = deferred<ReturnType<typeof list>>();
		api.mockReturnValue(result.promise);
		const loading = refreshFavoriteFolders();
		$i!.id = 'next-account';
		$i!.token = 'next-token';
		result.resolve(list());
		await expect(loading).rejects.toThrow('account changed');
		expect(favoriteFoldersState.accountId).toBe('next-account');
		expect(favoriteFoldersState.folders).toEqual([]);
		expect(favoriteFoldersState.loaded).toBe(false);
	});

	test('a late mutation stays bound to its original token and emits no cross-account change', async () => {
		const result = deferred<void>();
		api.mockReturnValue(result.promise);
		const saving = saveFavoriteNote('note', null, 'create');
		$i!.id = 'next-account';
		$i!.token = 'next-token';
		result.resolve();
		await expect(saving).rejects.toThrow('account changed');
		expect(api).toHaveBeenCalledExactlyOnceWith('notes/favorites/create', { noteId: 'note', folderId: null }, 'owner-token');
		expect(favoriteFoldersState.lastChange).toBeNull();
		expect(achievement).not.toHaveBeenCalled();
	});

	test('parent deletion publishes affected child ids only after success and keeps favorite total', async () => {
		await refreshFavoriteFolders();
		const result = deferred<{ movedCount: number }>();
		api.mockImplementation(endpoint => endpoint === 'notes/favorites/folders/delete' ? result.promise : new Promise(() => {}));
		const deleting = deleteFavoriteFolder('parent');
		expect(favoriteFoldersState.folders).toHaveLength(2);
		result.resolve({ movedCount: 3 });
		await deleting;
		expect(favoriteFoldersState.folders).toEqual([]);
		expect(favoriteFoldersState.unfiledCount).toBe(4);
		expect(favoriteFoldersState.totalCount).toBe(4);
		expect(favoriteFoldersState.lastChange).toEqual({ type: 'folderDelete', folderIds: ['parent', 'child'] });
	});

	test('lost nesting permission permits extraction and rejects root nesting or third level', async () => {
		await refreshFavoriteFolders();
		favoriteFoldersState.folders.push({ ...parent, id: 'other', name: 'Other' });
		expect(favoriteFolderMoveError('child', null)).toBeNull();
		expect(favoriteFolderMoveError('child', 'other')).toBeNull();
		expect(favoriteFolderMoveError('other', 'parent')).toBe('permission');
		expect(favoriteFolderMoveError('parent', 'other')).toBe('move');
	});

	test('successful reorder normalizes all siblings even if subsequent recount is unavailable', async () => {
		await refreshFavoriteFolders();
		favoriteFoldersState.folders.push({ ...parent, id: 'other', name: 'Other', position: 1 });
		api.mockImplementation(async endpoint => {
			if (endpoint.endsWith('/list')) throw new Error('recount unavailable');
			return { ...parent, position: 1 };
		});
		await updateFavoriteFolder('parent', { position: 1 });
		expect(favoriteFoldersState.folders.find(f => f.id === 'parent')!.position).toBe(1);
		expect(favoriteFoldersState.folders.find(f => f.id === 'other')!.position).toBe(0);
		expect(favoriteFoldersState.folders.find(f => f.id === 'child')).toMatchObject(child);
	});
});
