/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { getNoteClipMenu, getNoteMenu } from './get-note-menu.js';

const mocks = vi.hoisted(() => ({
	api: vi.fn(), toast: vi.fn(), claim: vi.fn(), confirm: vi.fn(), form: vi.fn(), apiWithDialog: vi.fn(),
	cacheFetch: vi.fn(), cacheSet: vi.fn(), cacheDelete: vi.fn(),
	post: vi.fn(), alert: vi.fn(),
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/cache.js', () => ({ clipsCache: { fetch: mocks.cacheFetch, set: mocks.cacheSet, delete: mocks.cacheDelete }, favoritedChannelsCache: {} }));
vi.mock('@/os.js', () => ({
	toast: mocks.toast, confirm: mocks.confirm, form: mocks.form, apiWithDialog: mocks.apiWithDialog,
	post: mocks.post, alert: mocks.alert,
	promiseDialog: (promise: Promise<unknown>, success?: (value: unknown) => void, failure?: (error: { id: string; message: string }) => void) => {
		void promise.then(success).catch(error => failure?.(error));
		return promise;
	},
	popup: vi.fn(),
}));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: mocks.claim }));
vi.mock('@/utility/get-appear-note.js', () => ({ getAppearNote: (note: unknown) => note }));
vi.mock('@/preferences.js', () => ({ prefer: { s: {} } }));
vi.mock('@/store.js', () => ({ store: { s: {} } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/utility/get-user-menu.js', () => ({ getUserMenu: vi.fn() }));
vi.mock('@/utility/favorite-folders.js', () => ({ openFavoriteFolderPicker: vi.fn(), removeFavoriteNote: vi.fn() }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/navigator.js', () => ({ isSupportShare: () => false }));
vi.mock('@/utility/get-embed-code.js', () => ({ genEmbedCode: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('@/utility/add-dividers-between-menu-sections.js', () => ({ addDividersBetweenMenuSections: (...sections: unknown[][]) => sections.flat() }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: {} }));
vi.mock('@/i.js', () => ({ $i: { id: 'self', policies: { noteEachClipsLimit: 10 } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { createNew: 'Create', createNewClip: 'Create clip', name: 'Name', description: 'Description', public: 'Public', clipNoteLimitExceeded: 'Limit', _hata: { _navbarNotice: { clipAdded: 'Added to clip', noteDeleted: 'Deleted' } } }, tsx: { confirmToUnclipAlreadyClippedNote: ({ name }: { name: string }) => name } } }));

const clip = { id: 'clip', name: 'Read later', userId: 'self', notesCount: 1 };
const note = { id: 'note' };

async function redraftAction() {
	const original = { id: 'own-note', userId: 'self', createdAt: '2026-01-01T00:00:00Z', text: 'Preserve this', visibility: 'public' };
	const result = getNoteMenu({ note: original as Parameters<typeof getNoteMenu>[0]['note'], viewTextSource: ref(false), noNyaize: ref(false) });
	const entries = await Promise.all(result.menu);
	const action = entries.find(item => item && typeof item === 'object' && 'icon' in item && item.icon === 'ti ti-eraser');
	if (!action || typeof action !== 'object' || !('action' in action)) throw new Error('Missing redraft action');
	return () => action.action(new MouseEvent('click'));
}

describe('delete and edit sequencing', () => {
	it('opens the composer and announces success only after deletion finishes', async () => {
		mocks.api.mockResolvedValue({});
		const invoke = await redraftAction();
		let finish!: () => void;
		mocks.api.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
		mocks.confirm.mockResolvedValueOnce({ canceled: false });
		invoke();
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledWith('notes/delete', { noteId: 'own-note' }));
		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.toast).not.toHaveBeenCalled();
		finish();
		await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({ initialNote: expect.objectContaining({ text: 'Preserve this' }) })));
		expect(mocks.toast).toHaveBeenCalledWith('Deleted', 'deleted');
	});
	it('does not open a replacement draft or announce success when deletion fails', async () => {
		mocks.api.mockResolvedValue({});
		const invoke = await redraftAction();
		mocks.api.mockRejectedValueOnce(new Error('Delete failed'));
		mocks.confirm.mockResolvedValueOnce({ canceled: false });
		invoke();
		await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith({ type: 'error', text: 'Delete failed' }));
		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.toast).not.toHaveBeenCalled();
	});
});

async function menu() {
	const items = await getNoteClipMenu({ note: note as Parameters<typeof getNoteClipMenu>[0]['note'] });
	const existing = await items[0];
	const create = await items.at(-1);
	if (!existing || !('action' in existing) || !create || !('action' in create)) throw new Error('Missing clip menu actions');
	return {
		existing: () => existing.action(new MouseEvent('click')),
		create: () => Promise.resolve(create.action(new MouseEvent('click'))),
	};
}

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.cacheFetch.mockResolvedValue([clip]);
	mocks.apiWithDialog.mockResolvedValue(undefined);
	mocks.confirm.mockResolvedValue({ canceled: true });
});

describe('clip action feedback', () => {
	it('announces and increments the selected clip only after add succeeds', async () => {
		const { existing } = await menu();
		mocks.api.mockResolvedValue(undefined);
		existing();
		await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Added to clip', 'clipped', false, 'Read later'));
		expect(mocks.claim).toHaveBeenCalledWith('noteClipped1');
		expect(mocks.cacheSet.mock.calls[0][0][0].notesCount).toBe(2);
	});
	it('does not announce failed add or a duplicate followed by cancelled removal', async () => {
		const { existing } = await menu();
		mocks.api.mockRejectedValue({ id: '734806c4-542c-463a-9311-15c512803965', message: 'already clipped' });
		existing();
		await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
		expect(mocks.apiWithDialog).not.toHaveBeenCalled();
		expect(mocks.toast).not.toHaveBeenCalled();
		expect(mocks.claim).not.toHaveBeenCalled();
		expect(mocks.cacheSet).not.toHaveBeenCalled();
	});
	it('does not announce a cancelled new clip form or failed add to a created clip', async () => {
		const { create } = await menu();
		mocks.form.mockResolvedValueOnce({ canceled: true });
		await create();
		expect(mocks.api).not.toHaveBeenCalled();
		mocks.form.mockResolvedValueOnce({ canceled: false, result: { name: 'New' } });
		mocks.apiWithDialog.mockResolvedValueOnce({ id: 'new', name: 'New' });
		mocks.api.mockRejectedValueOnce(new Error('add failed'));
		await expect(create()).rejects.toThrow('add failed');
		expect(mocks.toast).not.toHaveBeenCalled();
		expect(mocks.claim).not.toHaveBeenCalled();
	});
});
