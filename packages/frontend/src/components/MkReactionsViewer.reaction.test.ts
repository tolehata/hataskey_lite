/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, ref } from 'vue';
import type { ComponentProps } from 'vue-component-type-helpers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
	api: vi.fn(),
	noteEvent: vi.fn(),
	popup: vi.fn(),
	popupMenu: vi.fn(),
	fetchMutedUsers: vi.fn(),
	isMutedUser: vi.fn(),
	ripple: vi.fn(),
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api, misskeyApiGet: fixture.api }));
vi.mock('@/os.js', () => ({ popup: fixture.popup, popupMenu: fixture.popupMenu, confirm: vi.fn() }));
vi.mock('@/utility/muted-users.js', () => ({ fetchMutedUsers: fixture.fetchMutedUsers, isMutedUser: fixture.isMutedUser }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hideMutedReactionsLocal: ref(false) };
});
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: true, reactionsDisplaySize: 'large' } } }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@@/js/emojilist.js', () => ({ getUnicodeEmojiOrNull: () => null }));
vi.mock('@@/js/emoji-name.js', () => ({ getEmojiNameFromReaction: () => 'test', isLocalCustomEmojiReaction: () => true }));
vi.mock('@/custom-emojis.js', async () => {
	const { ref } = await import('vue');
	return { customEmojis: ref([]), customEmojisMap: new Map([['test', { name: 'test' }]]) };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _reactionVisibility: { hideReaction: 'hide' } }, emojiMute: 'mute' } } }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: vi.fn() }));
vi.mock('@/composables/use-note-capture.js', () => ({ noteEvents: { emit: fixture.noteEvent } }));
vi.mock('@/utility/emoji-mute.js', async () => {
	const { ref } = await import('vue');
	return { mute: vi.fn(), unmute: vi.fn(), checkMuted: () => ref(false) };
});
vi.mock('@/utility/emoji-palette.js', () => ({ addToEmojiPalette: vi.fn() }));
vi.mock('@/utility/hidden-reactions.js', () => ({ hideReaction: vi.fn(), unhideReaction: vi.fn(), isReactionHidden: () => false }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('./MkCustomEmojiDetailedDialog.vue', () => ({ default: { name: 'EmojiDetails', render: () => null } }));
vi.mock('@/components/MkReactionsViewer.details.vue', () => ({ default: { name: 'ReactionDetails', render: () => null } }));
vi.mock('@/components/MkReactionEffect.vue', () => ({ default: { name: 'ReactionEffect', render: () => null } }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => h('span', { 'data-builtin-emoji': '' }) } }));

import Reaction from './MkReactionsViewer.reaction.vue';
import Details from './MkReactionsViewer.details.vue';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';

const cleanups: Array<() => void> = [];

async function mountReaction(overrides: Partial<ComponentProps<typeof Reaction>> = {}) {
	const activate = vi.fn();
	const props = ref({
		noteId: 'details-note', reaction: ':test:', reactionEmojis: {}, myReaction: null,
		count: 2, isInitial: false, note: { id: 'different-note', user: { host: null } },
		custom: true, ...overrides,
	} as ComponentProps<typeof Reaction>);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp({
		render: () => h(Reaction, { ...props.value, class: 'parent-chip', onActivate: activate }, {
			default: () => h('span', { 'data-custom-slot': '' }, 'custom chip'),
		}),
	});
	app.directive('ripple', { mounted: (_el, binding) => fixture.ripple(binding.value) });
	app.mount(container);
	let mounted = true;
	const unmount = () => {
		if (mounted) app.unmount();
		mounted = false;
		container.remove();
	};
	cleanups.push(unmount);
	await nextTick();
	return { button: container.querySelector('button')!, activate, props, unmount };
}

function startHold(button: HTMLButtonElement) {
	const point = { clientX: 10, clientY: 10 };
	const touches = { length: 1, item: () => point };
	const event = new Event('touchstart', { bubbles: true });
	Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: touches } });
	button.dispatchEvent(event);
}

async function settle() {
	await Promise.resolve();
	await Promise.resolve();
	await nextTick();
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetAllMocks();
	fixture.api.mockResolvedValue([{ user: { id: 'visible' } }, { user: { id: 'muted' } }]);
	fixture.popup.mockReturnValue({ dispose: vi.fn() });
	fixture.fetchMutedUsers.mockResolvedValue(undefined);
	fixture.isMutedUser.mockImplementation(id => id === 'muted');
	hideMutedReactionsLocal.value = false;
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('shared reaction custom rendering', () => {
	test('renders only the slot, retains parent classes and emits the original click without built-in effects', async () => {
		const { button, activate, props } = await mountReaction();
		expect(button.querySelector('[data-custom-slot]')).not.toBeNull();
		expect(button.querySelector('[data-builtin-emoji]')).toBeNull();
		expect([...button.classList]).toEqual(['parent-chip']);
		expect(fixture.ripple).toHaveBeenCalledWith(false);
		const event = new MouseEvent('click', { bubbles: true });
		button.dispatchEvent(event);
		expect(activate).toHaveBeenCalledExactlyOnceWith(event);
		expect(fixture.api).not.toHaveBeenCalled();
		props.value = { ...props.value, count: props.value.count + 1 };
		await nextTick();
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('450ms hold shows details for the supplied note and reaction and suppresses synthetic activation', async () => {
		const { button, activate } = await mountReaction();
		startHold(button);
		await vi.advanceTimersByTimeAsync(449);
		expect(fixture.api).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fixture.api).toHaveBeenCalledExactlyOnceWith('notes/reactions', { noteId: 'details-note', type: ':test:', limit: 10 });
		expect(fixture.popup).toHaveBeenCalledWith(Details, expect.objectContaining({ reaction: ':test:', count: expect.any(Object), anchorElement: button }), expect.any(Object));
		expect(fixture.popup.mock.calls[0][1].count.value).toBe(2);
		const showing = fixture.popup.mock.calls[0][1].showing;
		button.dispatchEvent(new Event('touchend', { bubbles: true }));
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		button.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
		expect(activate).not.toHaveBeenCalled();
		expect(showing.value).toBe(false);
		button.click();
		expect(activate).toHaveBeenCalledTimes(1);
	});

	test('hover opens the users tooltip and leaving closes it', async () => {
		const { button } = await mountReaction();
		button.dispatchEvent(new Event('mouseover'));
		await vi.advanceTimersByTimeAsync(100);
		expect(fixture.popup).toHaveBeenCalledWith(Details, expect.objectContaining({
			anchorElement: button,
			users: [{ id: 'visible' }, { id: 'muted' }],
		}), expect.any(Object));
		const showing = fixture.popup.mock.calls[0][1].showing;
		button.dispatchEvent(new Event('mouseleave'));
		expect(showing.value).toBe(false);
		expect(fixture.api).toHaveBeenCalledTimes(1);
	});

	test('long press pages past muted and duplicate users until ten distinct visible users are found', async () => {
		hideMutedReactionsLocal.value = true;
		fixture.isMutedUser.mockImplementation(id => id.startsWith('m'));
		const page = (start: number, users: string[]) => users.map((id, index) => ({ id: `r${start - index}`, user: { id } }));
		fixture.api
			.mockResolvedValueOnce(page(20, ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'v1', 'v2', 'v3', 'v4']))
			.mockResolvedValueOnce(page(10, ['v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'm7', 'm8', 'm9', 'm10']))
			.mockResolvedValueOnce(page(0, ['v10']));
		const { button } = await mountReaction({ count: 12 });
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		expect(fixture.api.mock.calls).toEqual([
			['notes/reactions', { noteId: 'details-note', type: ':test:', limit: 10 }],
			['notes/reactions', { noteId: 'details-note', type: ':test:', limit: 10, untilId: 'r11' }],
			['notes/reactions', { noteId: 'details-note', type: ':test:', limit: 10, untilId: 'r1' }],
		]);
		expect(fixture.popup.mock.calls[0][1].users.map(user => user.id)).toEqual(Array.from({ length: 10 }, (_, i) => `v${i + 1}`));
	});

	test('count changes refresh the actors, removing a canceled reaction while details stay open', async () => {
		fixture.api
			.mockResolvedValueOnce([{ user: { id: 'A' } }, { user: { id: 'B' } }])
			.mockResolvedValueOnce([{ user: { id: 'B' } }])
			.mockResolvedValueOnce([{ user: { id: 'C' } }, { user: { id: 'B' } }]);
		const { button, props } = await mountReaction({ count: 2 });
		button.dispatchEvent(new Event('mouseover'));
		await vi.advanceTimersByTimeAsync(100);
		const details = fixture.popup.mock.calls[0][1];
		expect(details.count.value).toBe(2);
		expect(details.users.map(user => user.id)).toEqual(['A', 'B']);
		props.value = { ...props.value, count: 1 };
		await settle();
		expect(details.count.value).toBe(1);
		expect(details.users.map(user => user.id)).toEqual(['B']);
		props.value = { ...props.value, count: 2 };
		await settle();
		expect(details.count.value).toBe(2);
		expect(details.users.map(user => user.id)).toEqual(['C', 'B']);
		expect(fixture.api).toHaveBeenCalledTimes(3);
		expect(fixture.popup).toHaveBeenCalledTimes(1);
	});

	test('older refresh responses cannot overwrite newer actors, including after unmount', async () => {
		const older = deferred<Array<{ user: { id: string } }>>();
		const newer = deferred<Array<{ user: { id: string } }>>();
		const afterUnmount = deferred<Array<{ user: { id: string } }>>();
		fixture.api
			.mockResolvedValueOnce([{ user: { id: 'A' } }, { user: { id: 'B' } }])
			.mockReturnValueOnce(older.promise)
			.mockReturnValueOnce(newer.promise)
			.mockReturnValueOnce(afterUnmount.promise);
		const { button, props, unmount } = await mountReaction({ count: 2 });
		button.dispatchEvent(new Event('mouseover'));
		await vi.advanceTimersByTimeAsync(100);
		const details = fixture.popup.mock.calls[0][1];
		props.value = { ...props.value, count: 1 };
		await nextTick();
		expect(details.users).toEqual([]);
		props.value = { ...props.value, count: 2 };
		await nextTick();
		newer.resolve([{ user: { id: 'B' } }, { user: { id: 'C' } }]);
		await settle();
		expect(details.users.map(user => user.id)).toEqual(['B', 'C']);
		older.resolve([{ user: { id: 'A' } }]);
		await settle();
		expect(details.users.map(user => user.id)).toEqual(['B', 'C']);
		props.value = { ...props.value, count: 1 };
		await nextTick();
		expect(details.users).toEqual([]);
		unmount();
		afterUnmount.resolve([{ user: { id: 'A' } }]);
		await settle();
		expect(details.users).toEqual([]);
		expect(fixture.api).toHaveBeenCalledTimes(4);
		expect(fixture.popup).toHaveBeenCalledTimes(1);
	});

	test('closing while a later page is pending stops paging and never opens stale details', async () => {
		hideMutedReactionsLocal.value = true;
		fixture.isMutedUser.mockReturnValue(true);
		const later = deferred<Array<{ id: string; user: { id: string } }>>();
		fixture.api.mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: `r${20 - i}`, user: { id: `m${i}` } })));
		fixture.api.mockReturnValueOnce(later.promise);
		const { button } = await mountReaction({ count: 12 });
		button.dispatchEvent(new Event('mouseover'));
		await vi.advanceTimersByTimeAsync(100);
		expect(fixture.api).toHaveBeenCalledTimes(2);
		button.dispatchEvent(new Event('mouseleave'));
		later.resolve(Array.from({ length: 10 }, (_, i) => ({ id: `r${10 - i}`, user: { id: `v${i}` } })));
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(2);
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('a repeated page cursor stops pagination', async () => {
		hideMutedReactionsLocal.value = true;
		fixture.isMutedUser.mockReturnValue(true);
		const page = Array.from({ length: 10 }, (_, i) => ({ id: `r${20 - i}`, user: { id: `m${i}` } }));
		fixture.api.mockResolvedValue(page);
		const { button } = await mountReaction({ count: 12 });
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		expect(fixture.api).toHaveBeenCalledTimes(2);
		expect(fixture.popup.mock.calls[0][1].users).toEqual([]);
	});

	test('a continuous 3s hold retains the menu including hide and emoji mute', async () => {
		const { button } = await mountReaction();
		startHold(button);
		await vi.advanceTimersByTimeAsync(2999);
		expect(fixture.popupMenu).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fixture.popupMenu).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ text: 'hide', action: expect.any(Function) }),
			expect.objectContaining({ text: 'mute', action: expect.any(Function) }),
		]), button);
	});

	test('a details request resolved after unmount never opens a popup', async () => {
		const request = deferred<Array<{ user: { id: string } }>>();
		fixture.api.mockReturnValueOnce(request.promise);
		const { button, unmount } = await mountReaction();
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		unmount();
		request.resolve([{ user: { id: 'late' } }]);
		await settle();
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('fetches shared muted users before filtering and rechecks visibility after that await', async () => {
		hideMutedReactionsLocal.value = true;
		const request = deferred<void>();
		fixture.fetchMutedUsers.mockReturnValueOnce(request.promise);
		const { button } = await mountReaction();
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		expect(fixture.fetchMutedUsers).toHaveBeenCalledTimes(1);
		expect(fixture.isMutedUser).not.toHaveBeenCalled();
		expect(fixture.popup).not.toHaveBeenCalled();
		request.resolve();
		await settle();
		expect(fixture.popup).toHaveBeenCalledWith(Details, expect.objectContaining({ users: [{ id: 'visible' }] }), expect.any(Object));

		fixture.popup.mockClear();
		const late = deferred<void>();
		fixture.fetchMutedUsers.mockReturnValueOnce(late.promise);
		// Use a fresh mount so the second hold has its own pending muted-user request.
		const second = await mountReaction();
		startHold(second.button);
		await vi.advanceTimersByTimeAsync(450);
		second.unmount();
		late.resolve();
		await settle();
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('keyboard focus opens details and blur closes them', async () => {
		const { button } = await mountReaction();
		vi.spyOn(button, 'matches').mockReturnValue(true);
		button.dispatchEvent(new Event('focus'));
		await settle();
		expect(fixture.popup).toHaveBeenCalledWith(Details, expect.objectContaining({ anchorElement: button }), expect.any(Object));
		const showing = fixture.popup.mock.calls[0][1].showing;
		button.dispatchEvent(new Event('blur'));
		expect(showing.value).toBe(false);
	});

	test('revealMuted keeps all users without fetching the mute list', async () => {
		hideMutedReactionsLocal.value = true;
		const { button } = await mountReaction({ revealMuted: true });
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		expect(fixture.fetchMutedUsers).not.toHaveBeenCalled();
		expect(fixture.popup).toHaveBeenCalledWith(Details, expect.objectContaining({ users: [{ id: 'visible' }, { id: 'muted' }] }), expect.any(Object));
	});

	test('rejected details requests are caught for both touch and the standard hover tooltip', async () => {
		fixture.api.mockRejectedValue(new Error('offline'));
		const { button } = await mountReaction();
		button.dispatchEvent(new Event('mouseover'));
		await vi.advanceTimersByTimeAsync(100);
		startHold(button);
		await vi.advanceTimersByTimeAsync(450);
		expect(fixture.api).toHaveBeenCalledTimes(2);
		expect(fixture.popup).not.toHaveBeenCalled();
	});

	test('omitting custom retains built-in rendering, ripple and normal reaction creation', async () => {
		// The create response carries the saved (normalized) reaction; no follow-up notes/show.
		fixture.api.mockResolvedValueOnce({ reaction: ':test@.:' });
		const { button, activate } = await mountReaction({ custom: undefined, isInitial: true });
		expect(button.classList.contains('_button')).toBe(true);
		expect(button.querySelector('[data-builtin-emoji]')).not.toBeNull();
		expect(button.querySelector('[data-custom-slot]')).toBeNull();
		expect(button.textContent).toBe('2');
		expect(fixture.ripple).toHaveBeenCalledWith(true);
		button.click();
		await settle();
		expect(fixture.api.mock.calls).toEqual([
			['notes/reactions/create', { noteId: 'details-note', reaction: ':test:' }],
		]);
		expect(fixture.noteEvent).toHaveBeenCalledExactlyOnceWith('reacted:details-note', expect.objectContaining({ userId: 'me', reaction: ':test@.:' }));
		expect(activate).not.toHaveBeenCalled();
	});
});
