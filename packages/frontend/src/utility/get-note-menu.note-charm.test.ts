/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { getNoteMenu } from './get-note-menu.js';
import { noteCharmDisplay } from './hatasaba-device-prefs.js';

const mocks = vi.hoisted(() => ({ signedIn: true, account: { id: 'me', policies: { canEditNote: false } }, api: vi.fn(), save: vi.fn() }));
vi.mock('@/i.js', () => ({ get $i() { return mocks.signedIn ? mocks.account : null; } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { hideOthers: '他のユーザーのチャームを非表示', showOthers: '他のユーザーのチャームを表示' }, _hata: { _favoriteFolders: {} } } } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('./achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/utility/navigator.js', () => ({ isSupportShare: () => false }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { devMode: false } } }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/components/MkRippleEffect.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/get-user-menu.js', () => ({ getUserMenu: () => [] }));
vi.mock('@/utility/favorite-folders.js', () => ({ openFavoriteFolderPicker: vi.fn(), removeFavoriteNote: vi.fn() }));
vi.mock('@/store.js', () => ({ store: { s: {} } }));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/cache.js', () => ({ clipsCache: { fetch: vi.fn() }, favoritedChannelsCache: { fetch: vi.fn(async () => []) } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => null, setItem: mocks.save } }));

function fixture(author = 'other', charm = true): Misskey.entities.Note {
	return {
		id: `note-${author}`, userId: author, user: { id: author, username: author, host: null, noteCharm: charm ? { url: '/charm.png', size: 76, pattern: 'cutout', color: '#123456' } : null },
		createdAt: new Date().toISOString(), visibility: 'public', text: 'text',
		renote: null, reply: null, channel: null, renoteId: null, replyId: null, files: [], fileIds: [], poll: null, cw: null,
	} as unknown as Misskey.entities.Note;
}

function charmAction(note: Misskey.entities.Note, showing = true) {
	const { menu } = getNoteMenu({ note, viewTextSource: ref(false), noNyaize: ref(false) });
	const label = showing ? '他のユーザーのチャームを非表示' : '他のユーザーのチャームを表示';
	const item = menu.find(item => !(item instanceof Promise) && 'text' in item && item.text === label);
	return item && !(item instanceof Promise) && 'action' in item ? item.action : undefined;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.signedIn = true;
	vi.stubGlobal('innerWidth', 1400);
	vi.stubGlobal('navigator', { userAgent: 'desktop', maxTouchPoints: 0 });
	noteCharmDisplay.value = { show: true, motion: true, showOthers: true, wind: true };
	mocks.api.mockImplementation(async () => ({ isFavorited: false, isMutedThread: false }));
});
afterEach(() => vi.unstubAllGlobals());

describe('note menu viewer charm visibility', () => {
	test.each([true, false])('smartphones omit the charm action without changing display settings: showing=%s', showing => {
		vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
		noteCharmDisplay.value.showOthers = showing;
		const before = { ...noteCharmDisplay.value };
		expect(charmAction(fixture(), showing)).toBeUndefined();
		expect(noteCharmDisplay.value).toEqual(before);
		expect(mocks.save).not.toHaveBeenCalled();
	});

	test('omits the action in a narrow desktop window and restores it without changing preferences', () => {
		const before = { ...noteCharmDisplay.value };
		expect(charmAction(fixture())).toBeDefined();
		vi.stubGlobal('innerWidth', 390);
		expect(charmAction(fixture())).toBeUndefined();
		vi.stubGlobal('innerWidth', 1400);
		expect(charmAction(fixture())).toBeDefined();
		expect(noteCharmDisplay.value).toEqual(before);
		expect(mocks.save).not.toHaveBeenCalled();
	});

	test.each([true, false])('他人のチャームは本人設定を更新せず端末で一括非表示・再表示できる signedIn=%s', signedIn => {
		mocks.signedIn = signedIn;
		const note = fixture();
		const saved = structuredClone(note.user.noteCharm);
		const hide = charmAction(note);
		expect(hide).toBeDefined();
		mocks.api.mockClear();
		hide!(new MouseEvent('click'));
		expect(noteCharmDisplay.value).toEqual({ show: true, motion: true, showOthers: false, wind: true });
		expect(mocks.save).toHaveBeenLastCalledWith('noteCharmDisplay', JSON.stringify(noteCharmDisplay.value));
		expect(mocks.api).not.toHaveBeenCalled();
		expect(note.user.noteCharm).toEqual(saved);
		const show = charmAction(note, false);
		expect(show).toBeDefined();
		show!(new MouseEvent('click'));
		expect(noteCharmDisplay.value.showOthers).toBe(true);
	});

	test('本人・チャームなし・全表示OFFでは操作を出さない', () => {
		expect(charmAction(fixture('me'))).toBeUndefined();
		expect(charmAction(fixture('other', false))).toBeUndefined();
		noteCharmDisplay.value.show = false;
		expect(charmAction(fixture())).toBeUndefined();
	});

	test('リノートした人ではなく実際に表示されるノートの作者で判定する', () => {
		const other = fixture();
		const mine = fixture('me');
		expect(charmAction({ ...mine, text: null, renoteId: other.id, renote: other })).toBeDefined();
		expect(charmAction({ ...other, text: null, renoteId: mine.id, renote: mine })).toBeUndefined();
	});
});
