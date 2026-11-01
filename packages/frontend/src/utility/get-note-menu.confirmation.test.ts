/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { getNoteMenu } from './get-note-menu.js';
import { registerNoteActionConfirmation } from './note-action-confirmation.js';
import type { NoteActionConfirmation } from './note-action-confirmation.js';

const mocks = vi.hoisted(() => ({
	account: { id: 'me', policies: { canEditNote: false }, isAdmin: false, isModerator: false },
	api: vi.fn(), confirm: vi.fn(), alert: vi.fn(), post: vi.fn(), toast: vi.fn(),
	emit: vi.fn(), achievement: vi.fn(),
}));

vi.mock('@/i.js', () => ({ $i: mocks.account }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	delete: 'Delete', deleteAndEdit: 'Delete and edit', noteDeleteConfirm: 'Delete?',
	deleteAndEditConfirm: 'Delete and edit?', error: 'Error',
	_hata: { _navbarNotice: { noteDeleted: 'Deleted' }, _favoriteFolders: {} },
} } }));
vi.mock('@/os.js', () => ({ confirm: mocks.confirm, alert: mocks.alert, post: mocks.post, toast: mocks.toast }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: mocks.emit } }));
vi.mock('./achievements.js', () => ({ claimAchievement: mocks.achievement }));
vi.mock('@/utility/navigator.js', () => ({ isSupportShare: () => false }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { devMode: false } } }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/get-user-menu.js', () => ({ getUserMenu: () => [] }));
vi.mock('@/utility/favorite-folders.js', () => ({ openFavoriteFolderPicker: vi.fn(), removeFavoriteNote: vi.fn() }));
vi.mock('@/store.js', () => ({ store: { s: {} } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/cache.js', () => ({ clipsCache: { fetch: vi.fn() }, favoritedChannelsCache: { fetch: vi.fn(async () => []) } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => null, setItem: vi.fn() } }));

const releases: (() => void)[] = [];

function fixture(id: string) {
	return {
		id, userId: 'me', user: { id: 'me', username: 'me', host: null },
		createdAt: new Date().toISOString(), visibility: 'public', text: 'text',
		renote: null, reply: null, channel: null, renoteId: null, replyId: null, files: [], fileIds: [], poll: null, cw: null,
	} as unknown as Misskey.entities.Note;
}

function actions(note: Misskey.entities.Note) {
	const { menu } = getNoteMenu({ note, viewTextSource: ref(false), noNyaize: ref(false) });
	const find = (label: string) => {
		const item = menu.find(item => !(item instanceof Promise) && 'text' in item && item.text === label);
		if (!item || item instanceof Promise || !('action' in item)) throw new Error(`Menu action not found: ${label}`);
		return () => item.action(new MouseEvent('click'));
	};
	return { del: find('Delete'), delEdit: find('Delete and edit') };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.account.id = 'me';
	mocks.api.mockImplementation((endpoint: string) => Promise.resolve(endpoint === 'notes/state' ? { isFavorited: false, isMutedThread: false } : undefined));
	mocks.confirm.mockResolvedValue({ canceled: false });
	mocks.alert.mockResolvedValue(undefined);
});

afterEach(() => { releases.splice(0).forEach(release => release()); });

describe('note menu confirmation handoff', () => {
	it.each([['delete', 'Delete'], ['deleteAndEdit', 'Delete and edit']] as const)('delegates %s and only deletes the appeared note when run', async (kind, label) => {
		const original = fixture('original');
		const wrapper = { ...fixture('wrapper'), text: null, renoteId: original.id, renote: original } as Misskey.entities.Note;
		let request: NoteActionConfirmation | undefined;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		const action = actions(wrapper)[label === 'Delete' ? 'del' : 'delEdit'];
		await action();
		expect(request).toMatchObject({ kind, note: original });
		expect(mocks.confirm).not.toHaveBeenCalled();
		expect(mocks.api).not.toHaveBeenCalledWith('notes/delete', expect.anything());
		await request!.run();
		expect(mocks.api).toHaveBeenCalledWith('notes/delete', { noteId: 'original' });
		expect(mocks.api).not.toHaveBeenCalledWith('notes/delete', { noteId: 'wrapper' });
		expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('noteDeleted', 'original');
		expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('Deleted', 'deleted');
		expect(mocks.achievement).toHaveBeenCalledExactlyOnceWith('noteDeletedWithin1min');
		if (kind === 'deleteAndEdit') {
			expect(mocks.post).toHaveBeenCalledExactlyOnceWith({ initialNote: original, renote: original.renote, reply: original.reply, channel: original.channel });
		} else {
			expect(mocks.post).not.toHaveBeenCalled();
		}
		await request!.run();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/delete')).toHaveLength(1);
	});

	it('deletes a quote itself and never its quoted original', async () => {
		const original = fixture('original');
		const quote = { ...fixture('quote'), text: 'my comment', renoteId: original.id, renote: original };
		let request: NoteActionConfirmation | undefined;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		await actions(quote).del();
		expect(request?.note).toBe(quote);
		await request!.run();
		expect(mocks.api).toHaveBeenCalledWith('notes/delete', { noteId: 'quote' });
		expect(mocks.api).not.toHaveBeenCalledWith('notes/delete', { noteId: 'original' });
	});

	it('propagates API failure and does not emit success or reopen the composer', async () => {
		let request: NoteActionConfirmation | undefined;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		await actions(fixture('target')).delEdit();
		mocks.api.mockRejectedValueOnce(new Error('delete failed'));
		await expect(request!.run()).rejects.toThrow('delete failed');
		expect(mocks.emit).not.toHaveBeenCalled();
		expect(mocks.toast).not.toHaveBeenCalled();
		expect(mocks.achievement).not.toHaveBeenCalled();
		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.alert).not.toHaveBeenCalled();
	});

	it('retains the legacy confirmation and alerts on a failed deletion', async () => {
		const action = actions(fixture('target')).del;
		mocks.api.mockRejectedValueOnce(new Error('delete failed'));
		await action();
		expect(mocks.confirm).toHaveBeenCalledWith({ type: 'warning', text: 'Delete?' });
		expect(mocks.alert).toHaveBeenCalledWith({ type: 'error', text: 'delete failed' });
		expect(mocks.emit).not.toHaveBeenCalled();
		mocks.confirm.mockResolvedValueOnce({ canceled: true });
		await action();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/delete')).toHaveLength(1);
	});

	it('checks the starting account again when the delegated action runs', async () => {
		let request: NoteActionConfirmation | undefined;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		await actions(fixture('target')).del();
		mocks.account.id = 'other';
		await expect(request!.run()).rejects.toThrow('Error');
		expect(mocks.api).not.toHaveBeenCalledWith('notes/delete', expect.anything());
	});

	it('shares one pending deletion across repeated runs from the same menu', async () => {
		let request: NoteActionConfirmation | undefined;
		let finish!: () => void;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		await actions(fixture('target')).del();
		mocks.api.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
		const first = request!.run();
		const second = request!.run();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'notes/delete')).toHaveLength(1);
		expect(mocks.emit).not.toHaveBeenCalled();
		finish();
		await Promise.all([first, second]);
		expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('noteDeleted', 'target');
	});

	it('does not restore a deleted note into another account after an account switch', async () => {
		let request: NoteActionConfirmation | undefined;
		let finish!: () => void;
		releases.push(registerNoteActionConfirmation(next => { request = next; return true; }));
		await actions(fixture('target')).delEdit();
		mocks.api.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
		const pending = request!.run();
		mocks.account.id = 'other';
		finish();
		await pending;
		expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('noteDeleted', 'target');
		expect(mocks.post).not.toHaveBeenCalled();
		expect(mocks.achievement).not.toHaveBeenCalled();
		expect(mocks.toast).not.toHaveBeenCalled();
	});
});
