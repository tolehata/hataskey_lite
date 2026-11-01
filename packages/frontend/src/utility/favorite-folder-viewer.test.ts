/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type { App } from 'vue';

const fixtures = vi.hoisted(() => ({
	state: {} as any,
	paginators: [] as any[],
	menu: vi.fn(), refresh: vi.fn(), picker: vi.fn(), editor: vi.fn(), move: vi.fn(), reorder: vi.fn(), remove: vi.fn(),
	notes: [] as any[],
	api: vi.fn(),
	registry: new Map<string, unknown>(),
}));
vi.mock('@/i.js', () => ({ $i: { id: 'alice', token: 'alice-token' } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { favorites: 'お気に入り', noNotes: 'ノートなし', _hata: { _favoriteFolders: new Proxy({}, { get: (_, key) => String(key) }) } } } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false } } }));
vi.mock('@/os.js', () => ({ popupMenu: fixtures.menu, toast: vi.fn() }));
vi.mock('@/components/MkNote.vue', () => ({ default: { props: ['note'], setup: (props: any) => () => h('article', { 'data-note-id': props.note.id }, props.note.text) } }));
vi.mock('@/components/MkPagination.vue', async () => {
	const { onMounted } = await import('vue');
	return { default: { props: ['paginator', 'autoLoad'], setup: (props: any, { slots }: any) => {
		onMounted(() => { if (props.autoLoad !== false) props.paginator.init(); });
		return () => h('div', { 'data-pagination': '' }, slots.default?.({ items: props.paginator.items.value }));
	} } };
});
vi.mock('@/utility/paginator.js', async () => {
	const { ref } = await import('vue');
	return { Paginator: class {
		items = ref<any[]>([]);
		fetching = ref(false);
		fetchingOlder = ref(false);
		fetchingNewer = ref(false);
		params: any;
		constructor(_endpoint: string, options: any) { this.params = options.params; fixtures.paginators.push(this); }
		async init() { this.items.value = []; this.pushItems(fixtures.notes.filter(note => !('folderId' in this.params) || note.folderId === this.params.folderId).map(note => structuredClone(note))); }
		pushItems(items: any[]) { this.items.value.push(...items); }
		async reload() { await this.init(); }
		updateItem(id: string, update: (item: any) => any) { this.items.value = this.items.value.map(item => item.id === id ? update(item) : item); }
		removeItem(id: string) { this.items.value = this.items.value.filter(item => item.id !== id); }
	} };
});
vi.mock('@/utility/favorite-folders.js', async () => {
	const { reactive } = await import('vue');
	fixtures.state = reactive({});
	return {
		favoriteFoldersState: fixtures.state,
		refreshFavoriteFolders: fixtures.refresh,
		favoriteFolderPath: (id: string) => fixtures.state.folders.find((folder: any) => folder.id === id)?.name ?? '',
		favoriteFolderColorStyle: () => ({ '--favorite-folder-color': 'red' }),
		canCreateFavoriteFolder: (id: string | null = null) => fixtures.state.loaded && fixtures.state.folders.length < fixtures.state.folderLimit && (id === null || fixtures.state.canCreateSubfolders && fixtures.state.folders.some((folder: any) => folder.id === id && folder.parentId === null)),
		openFavoriteFolderPicker: fixtures.picker, openFavoriteFolderEditor: fixtures.editor,
		moveFavoriteFolder: fixtures.move, reorderFavoriteFolder: fixtures.reorder, removeFavoriteNote: fixtures.remove,
	};
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));

import MkFavoriteFolders from '@/components/MkFavoriteFolders.vue';
import { favoriteCapsules } from '@/utility/favorite-folder-capsules.js';

let app: App;
let host: HTMLElement;

async function settle() { await nextTick(); await Promise.resolve(); await nextTick(); }

async function mount(deck = false) {
	host = window.document.createElement('div'); window.document.body.appendChild(host);
	app = createApp(MkFavoriteFolders, { deck });
	app.component('MkResult', { render: () => null });
	const instance = app.mount(host) as unknown as { manageFolder: (anchor?: HTMLElement) => void; reload: () => Promise<void> };
	await settle(); return instance;
}

function capsule(id: string) { return host.querySelector<HTMLButtonElement>(`[data-capsule="${id}"]`)!; }

function change(value: any) { fixtures.state.lastChange = value; fixtures.state.revision++; }

function drag(type: string) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: { setData: vi.fn(), effectAllowed: '', dropEffect: '' } });
	return event;
}

beforeEach(() => {
	vi.clearAllMocks(); fixtures.paginators.length = 0;
	fixtures.registry.clear();
	Object.assign(favoriteCapsules, { accountId: 'alice', order: [], loaded: false, saving: false });
	fixtures.api.mockImplementation(async (endpoint: string, params: { scope: string[]; key: string; value?: unknown }) => {
		// Match registry scope validation instead of accepting every persistence request.
		if (!params.scope.every(segment => /^[a-zA-Z0-9_]+$/.test(segment))) throw Object.assign(new Error('Invalid scope'), { code: 'INVALID_PARAM' });
		const key = JSON.stringify([params.scope, params.key]);
		if (endpoint === 'i/registry/get') {
			if (!fixtures.registry.has(key)) throw Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
			return structuredClone(fixtures.registry.get(key));
		}
		if (endpoint === 'i/registry/set') {
			fixtures.registry.set(key, structuredClone(params.value));
			return;
		}
		throw new Error(`Unexpected endpoint: ${endpoint}`);
	});
	Object.assign(fixtures.state, {
		accountId: 'alice', loaded: true, loading: false, revision: 0, lastChange: null, totalCount: 3, unfiledCount: 1, folderLimit: 3, canCreateSubfolders: true,
		folders: [{ id: 'read', name: '読む', color: 'rose', parentId: null, position: 0, count: 1 }, { id: 'book', name: '本', color: 'green', parentId: 'read', position: 0, count: 1 }],
	});
	fixtures.notes = [
		{ id: 'legacy-3', createdAt: '2020-01-01', note: { id: 'n3', text: 'legacy unfiled' }, folderId: null },
		{ id: 'legacy-2', createdAt: '2019-01-01', note: { id: 'n2', text: 'child note' }, folderId: 'book' },
		{ id: 'legacy-1', createdAt: '2018-01-01', note: { id: 'n1', text: 'parent note' }, folderId: 'read' },
	];
	fixtures.refresh.mockResolvedValue(undefined); fixtures.menu.mockResolvedValue(undefined); fixtures.move.mockResolvedValue(undefined);
	HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { app?.unmount(); host?.remove(); });

describe('favorite folder viewer integration', () => {
	test('legacy all query remains unfiltered and every folder, including children, is a capsule', async () => {
		await mount();
		expect(fixtures.paginators[0].params).toEqual({});
		expect(host.querySelectorAll('[data-note-id]')).toHaveLength(3);
		expect(host.querySelectorAll('[data-capsule]')).toHaveLength(4);
		capsule('book').click(); await settle();
		expect(fixtures.paginators.at(-1).params).toEqual({ folderId: 'book' });
		expect(host.querySelectorAll('[data-note-id]')).toHaveLength(1);
		capsule('unfiled').click(); await settle();
		expect(fixtures.paginators.at(-1).params).toEqual({ folderId: null });
	});
	test('moving a loaded favorite changes membership without recreating paginator, saved id or date', async () => {
		await mount();
		const active = fixtures.paginators[0];
		change({ type: 'noteMove', noteId: 'n1', folderId: 'book' }); await settle();
		expect(fixtures.paginators).toHaveLength(1);
		expect(active.items.value.find((item: any) => item.note.id === 'n1')).toMatchObject({ id: 'legacy-1', createdAt: '2018-01-01', folderId: 'book' });
		change({ type: 'noteDelete', noteId: 'n1' }); await settle();
		expect(active.items.value.map((item: any) => item.id)).toEqual(['legacy-3', 'legacy-2']);
	});
	test('a stale pending page cannot restore deleted favorites or old folder membership', async () => {
		await mount();
		const active = fixtures.paginators[0];
		change({ type: 'noteMove', noteId: 'late-move', folderId: 'book' }); await settle();
		change({ type: 'noteDelete', noteId: 'late-delete' }); await settle();
		active.pushItems([
			{ id: 'late-2', note: { id: 'late-move', text: 'old response' }, folderId: 'read' },
			{ id: 'late-1', note: { id: 'late-delete', text: 'old response' }, folderId: null },
		]); await settle();
		expect(active.items.value.find((item: any) => item.id === 'late-2').folderId).toBe('book');
		expect(active.items.value.find((item: any) => item.id === 'late-1')).toBeUndefined();
	});

	test('authoritative explicit reload clears local overlays and isolates an older pending paginator', async () => {
		await mount();
		const old = fixtures.paginators[0];
		change({ type: 'noteMove', noteId: 'n1', folderId: 'book' }); await settle();
		await old.reload(); await settle();
		const current = fixtures.paginators.at(-1);
		expect(current).not.toBe(old);
		expect(current.items.value.find((item: any) => item.note.id === 'n1').folderId).toBe('read');
		old.pushItems([{ id: 'old-late', note: { id: 'old-late' }, folderId: 'book' }]); await settle();
		expect(host.querySelector('[data-note-id="old-late"]')).toBeNull();
	});

	test('deletion of a folder overrides a prior successful move into that folder', async () => {
		await mount();
		const active = fixtures.paginators[0];
		change({ type: 'noteMove', noteId: 'late-move', folderId: 'book' }); await settle();
		change({ type: 'folderDelete', folderIds: ['book'] }); await settle();
		active.pushItems([{ id: 'late-1', note: { id: 'late-move' }, folderId: 'read' }]); await settle();
		expect(active.items.value.find((item: any) => item.id === 'late-1').folderId).toBeNull();
	});

	test('deleting active child via parent deletion selects unfiled and retains every favorite', async () => {
		await mount(); capsule('book').click(); await settle();
		fixtures.notes.forEach(note => { note.folderId = null; });
		fixtures.state.folders = []; fixtures.state.unfiledCount = 3;
		change({ type: 'folderDelete', folderIds: ['read', 'book'] }); await settle();
		expect(capsule('unfiled').getAttribute('aria-selected')).toBe('true');
		expect(fixtures.paginators.at(-1).items.value.map((item: any) => item.id)).toEqual(['legacy-3', 'legacy-2', 'legacy-1']);
	});
	test('deck uses header management, no page title or under-capsule folder actions', async () => {
		const instance = await mount(true); capsule('read').click(); await settle();
		expect(host.querySelector('h1')).toBeNull();
		expect(host.querySelector('[aria-label="読む: manageFolder"]')).toBeNull();
		instance.manageFolder();
		const menu = fixtures.menu.mock.calls.at(-1)![0];
		expect(menu[0].text).toBe('folderList');
		expect(menu.some((item: any) => item.text === 'deleteFolder')).toBe(true);
	});
	test('deck reorder button enters editing, saves changed order and restores it on a fresh mount', async () => {
		await mount(true);
		expect(host.querySelector('[role="status"]')).toBeNull();
		const before = structuredClone(fixtures.notes);
		host.querySelector<HTMLButtonElement>('[aria-label="reorderTabs"]')!.click(); await settle();
		expect(host.querySelector('[aria-label="finishReorder"]')?.getAttribute('aria-pressed')).toBe('true');
		capsule('read').click(); await settle();
		host.querySelector<HTMLButtonElement>('[aria-label="moveLeft"]')!.click(); await settle();
		const expected = ['all', 'read', 'unfiled', 'book'];
		expect(Array.from(host.querySelectorAll<HTMLElement>('[data-capsule]'), element => element.dataset.capsule)).toEqual(expected);
		expect(capsule('all').getAttribute('aria-selected')).toBe('true');
		host.querySelector<HTMLButtonElement>('[aria-label="finishReorder"]')!.click(); await settle();
		expect(host.querySelector('[aria-label="reorderTabs"]')?.getAttribute('aria-pressed')).toBe('false');
		expect(fixtures.api).toHaveBeenCalledWith('i/registry/set', { scope: ['client', 'favorite_folders'], key: 'capsuleOrder', value: expected }, 'alice-token');
		expect(fixtures.notes).toEqual(before);

		app.unmount(); host.remove();
		Object.assign(favoriteCapsules, { order: [], loaded: false });
		await mount(true);
		expect(Array.from(host.querySelectorAll<HTMLElement>('[data-capsule]'), element => element.dataset.capsule)).toEqual(expected);
		expect(host.querySelector('[role="status"]')).toBeNull();
	});
	test('quota and child permission changes hide creation controls immediately', async () => {
		await mount(); capsule('read').click(); await settle();
		expect(host.querySelector('[aria-label="newSubfolder"]')).not.toBeNull();
		fixtures.state.canCreateSubfolders = false; await settle();
		expect(host.querySelector('[aria-label="newSubfolder"]')).toBeNull();
		fixtures.state.folderLimit = 2; await settle();
		expect(host.querySelector('[aria-label="newFolder"]')).toBeNull();
		fixtures.state.folderLimit = 3; await settle();
		expect(host.querySelector('[aria-label="newFolder"]')).not.toBeNull();
	});
	test('child extraction sends a move only after drop and leaves note memberships untouched', async () => {
		await mount();
		const before = structuredClone(fixtures.notes);
		host.querySelector('[data-folder-id="book"]')!.dispatchEvent(drag('dragstart')); await settle();
		const rootDrop = Array.from(host.querySelectorAll('div')).find(el => el.textContent === 'extractToRoot')!;
		rootDrop.dispatchEvent(drag('dragover')); await settle();
		expect(fixtures.move).not.toHaveBeenCalled();
		rootDrop.dispatchEvent(drag('drop')); await settle();
		expect(fixtures.move).toHaveBeenCalledWith('book', null, 1);
		expect(fixtures.notes).toEqual(before);
	});
});
