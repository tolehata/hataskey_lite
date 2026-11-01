/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import * as os from '@/os.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), notify: vi.fn(), picker: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api, misskeyApiGet: fixture.api }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixture.notify }));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: { show: fixture.picker } }));
vi.mock('@/utility/hatagoes-emoji-pickers.js', () => ({ useHataGoesEmojiPickers: () => ({ showReactionPicker: fixture.picker }) }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/os.js', () => ({ popup: vi.fn(), popupMenu: vi.fn(), confirm: vi.fn() }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: { showingAnimatedImages: 'always' }, r: { emojiStyle: ref('twemoji') } } };
});
vi.mock('@/custom-emojis.js', async () => {
	const { ref } = await import('vue');
	return { customEmojis: ref([]), customEmojisMap: new Map([['hatady_yatta', { url: '/emoji/hatady_yatta.webp' }]]) };
});
vi.mock('@/utility/emoji-mute.js', async () => {
	const { ref } = await import('vue');
	return { checkMuted: () => ref(false), makeEmojiMuteKey: () => '', mute: vi.fn(), unmute: vi.fn() };
});
vi.mock('@/utility/media-proxy.js', () => ({ getProxiedImageUrl: (url: string) => url, getStaticImageUrl: (url: string) => url }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/utility/emoji-palette.js', () => ({ addToEmojiPalette: vi.fn() }));
vi.mock('@/components/MkCustomEmojiDetailedDialog.vue', () => ({ default: {} }));
import HatadyReactions from './HatadyReactions.vue';
import MkCustomEmoji from './global/MkCustomEmoji.vue';
import MkEmoji from './global/MkEmoji.vue';
import { DI } from '@/di.js';

type ReactionState = { reactions: Record<string, number>; myReaction: string | null };
type ReactionTarget = { logId?: string; commentId?: string; sessionId?: string; mediaCommentId?: string };
const cleanups: Array<() => void> = [];

async function settle() {
	for (let step = 0; step < 8; step++) await Promise.resolve();
	await nextTick();
}

async function mountReactions(target: ReactionTarget, reactions: Record<string, number>, myReaction: string | null = null) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const changed = vi.fn<(value: ReactionState) => void>();
	const app = createApp({ render: () => h(HatadyReactions, { target, reactions, myReaction, onChanged: changed }) });
	app.component('MkCustomEmoji', MkCustomEmoji);
	app.component('MkEmoji', MkEmoji);
	app.provide(DI.mfmEmojiReactCallback, () => {});
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	return { host, changed };
}

function pill(host: HTMLElement, index = 0) {
	return host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')[index];
}

beforeEach(() => {
	vi.useFakeTimers();
	fixture.api.mockReset().mockImplementation(async (endpoint: string) => endpoint.endsWith('/list') ? [] : undefined);
	fixture.notify.mockReset();
	fixture.picker.mockReset();
	vi.mocked(os.popup).mockReset().mockReturnValue({ dispose: vi.fn() } as never);
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('Hatady reaction pills', () => {
	test.each([
		{ target: { logId: 'log' }, payload: { logId: 'log' }, prefix: 'hata/hatady', emoji: '👍' },
		{ target: { commentId: 'comment' }, payload: { commentId: 'comment' }, prefix: 'hata/hatady', emoji: ':hatady_yatta:' },
		{ target: { sessionId: 'session' }, payload: { targetType: 'session', targetId: 'session' }, prefix: 'hata/hatady/media', emoji: '👍' },
		{ target: { mediaCommentId: 'media-comment' }, payload: { targetType: 'comment', targetId: 'media-comment' }, prefix: 'hata/hatady/media', emoji: ':hatady_yatta:' },
	])('$prefix $emoji: the decorative emoji yields to the button and its count toggles the same target', async ({ target, payload, prefix, emoji }) => {
		const { host, changed } = await mountReactions(target, { [emoji]: 2 });
		const button = pill(host);
		const image = button.querySelector('img')!;
		expect(image).not.toBeNull();
		// Happy DOM has no pointer hit testing. Verify the actual renderer's computed
		// hit-target contract separately, then activate the native button it exposes.
		expect(getComputedStyle(image).pointerEvents).toBe('none');
		button.focus();
		expect(window.document.activeElement).toBe(button);
		button.click();
		await settle();
		expect(fixture.api).toHaveBeenCalledWith(`${prefix}/reactions/create`, { ...payload, reaction: emoji });
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(changed).toHaveBeenLastCalledWith({ reactions: { [emoji]: 3 }, myReaction: emoji });
		button.querySelector<HTMLElement>('span')!.click();
		await settle();
		expect(fixture.api.mock.calls.at(-1)).toEqual([`${prefix}/reactions/delete`, payload]);
		expect(fixture.api.mock.calls.filter(([endpoint]) => !String(endpoint).endsWith('/list'))).toHaveLength(2);
		expect(button.getAttribute('aria-pressed')).toBe('false');
		expect(changed).toHaveBeenLastCalledWith({ reactions: { [emoji]: 2 }, myReaction: null });
	});

	test('Unicode native fallback and a missing custom emoji retain the same non-interactive icon contract', async () => {
		const { host } = await mountReactions({ logId: 'log' }, { '👍': 1, ':missing:': 1 });
		pill(host).querySelector('img')!.dispatchEvent(new Event('error'));
		await settle();
		const nativeEmoji = pill(host).querySelector<HTMLElement>('[alt="👍"]')!;
		expect(nativeEmoji.tagName).toBe('SPAN');
		expect(getComputedStyle(nativeEmoji).pointerEvents).toBe('none');
		const missingEmoji = pill(host, 1).querySelector('img')!;
		expect(missingEmoji.getAttribute('src')).toMatch(/\/dummy\.png$/);
		expect(getComputedStyle(missingEmoji).pointerEvents).toBe('none');
	});

	test('busy blocks duplicate actions, and a rejected request keeps the existing reaction and count', async () => {
		let rejectRequest!: (error: Error) => void;
		fixture.api.mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
		const { host, changed } = await mountReactions({ logId: 'log' }, { '👍': 2 }, '👍');
		const button = pill(host);
		button.click();
		button.click();
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(1);
		expect(Array.from(host.querySelectorAll('button')).every(item => item.disabled)).toBe(true);
		rejectRequest(new Error('offline'));
		await settle();
		expect(button.disabled).toBe(false);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(button.textContent?.trim()).toBe('2');
		expect(changed).not.toHaveBeenCalled();
		expect(fixture.notify).toHaveBeenCalledWith('リアクションを変更できませんでした');
		button.click();
		await settle();
		expect(changed).toHaveBeenLastCalledWith({ reactions: { '👍': 1 }, myReaction: null });
	});

	test('choosing another emoji still replaces only the current user reaction', async () => {
		const { host, changed } = await mountReactions({ sessionId: 'session' }, { '👍': 2, ':hatady_yatta:': 3 }, '👍');
		const add = host.querySelector<HTMLButtonElement>('button:not([aria-pressed])')!;
		add.click();
		expect(fixture.picker).toHaveBeenCalledWith(add, null, expect.any(Function));
		fixture.picker.mock.calls[0][2](':hatady_yatta:');
		await settle();
		expect(fixture.api).toHaveBeenCalledWith('hata/hatady/media/reactions/create', { targetType: 'session', targetId: 'session', reaction: ':hatady_yatta:' });
		expect(changed).toHaveBeenLastCalledWith({ reactions: { '👍': 1, ':hatady_yatta:': 4 }, myReaction: ':hatady_yatta:' });
	});

	test('hover waits 100ms, reuses the user list, and invalidates it after a reaction', async () => {
		fixture.api.mockImplementation(async (endpoint: string) => endpoint.endsWith('/list') ? [{ user: { id: 'u1', username: 'user' } }] : undefined);
		const { host } = await mountReactions({ logId: 'hover-log' }, { '👍': 2 });
		const button = pill(host);
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(99);
		await settle();
		expect(fixture.api).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		await settle();
		expect(fixture.api).toHaveBeenCalledWith('hata/hatady/reactions/list', { logId: 'hover-log', reaction: '👍', limit: 10 });
		expect(os.popup).toHaveBeenCalledTimes(1);
		button.dispatchEvent(new MouseEvent('mouseleave'));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(100);
		await settle();
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/list'))).toHaveLength(1);
		button.click();
		await settle();
		button.dispatchEvent(new MouseEvent('mouseleave'));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(100);
		await settle();
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/list'))).toHaveLength(2);
	});

	test('touch hold opens after 450ms, closes on release, and consumes the synthetic click', async () => {
		const { host, changed } = await mountReactions({ sessionId: 'touch-session' }, { '👍': 2 });
		const button = pill(host);
		const touch = (type: string, x = 4) => {
			const event = new Event(type, { bubbles: true });
			const point = { clientX: x, clientY: 4 };
			Object.defineProperty(event, 'touches', { value: { length: type === 'touchend' ? 0 : 1, item: () => point } });
			Object.defineProperty(event, 'changedTouches', { value: { length: 1, item: () => point } });
			button.dispatchEvent(event);
		};
		touch('touchstart');
		vi.advanceTimersByTime(450);
		await settle();
		expect(fixture.api).toHaveBeenCalledWith('hata/hatady/media/reactions/list', { targetType: 'session', targetId: 'touch-session', reaction: '👍', limit: 10 });
		expect(os.popup).toHaveBeenCalledTimes(1);
		const showing = (vi.mocked(os.popup).mock.calls[0][1] as unknown as { showing: { value: boolean } }).showing;
		touch('touchend');
		expect(showing.value).toBe(false);
		button.click();
		await settle();
		expect(changed).not.toHaveBeenCalled();
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/create'))).toHaveLength(0);
	});

	test('a list response arriving after touch release does not reopen details', async () => {
		let resolveList!: (rows: unknown[]) => void;
		fixture.api.mockImplementation((endpoint: string) => endpoint.endsWith('/list') ? new Promise(resolve => { resolveList = resolve; }) : Promise.resolve());
		const { host } = await mountReactions({ commentId: 'comment-late' }, { '👍': 3 });
		const button = pill(host);
		const dispatch = (type: string, x: number) => {
			const point = { clientX: x, clientY: 10 };
			const event = new Event(type, { bubbles: true });
			Object.defineProperty(event, 'touches', { value: { length: type === 'touchend' ? 0 : 1, item: () => point } });
			Object.defineProperty(event, 'changedTouches', { value: { length: 1, item: () => point } });
			button.dispatchEvent(event);
		};
		dispatch('touchstart', 10);
		vi.advanceTimersByTime(450);
		await settle();
		dispatch('touchend', 10);
		resolveList([{ user: { id: 'u1', username: 'user' } }]);
		await settle();
		expect(os.popup).not.toHaveBeenCalled();

		dispatch('touchstart', 10);
		dispatch('touchmove', 23);
		vi.advanceTimersByTime(450);
		await settle();
		expect(os.popup).not.toHaveBeenCalled();
	});

	test('a list response for a previous target does not open details on a reused pill', async () => {
		let resolveList!: (rows: unknown[]) => void;
		fixture.api.mockImplementation((endpoint: string) => endpoint.endsWith('/list') ? new Promise(resolve => { resolveList = resolve; }) : Promise.resolve());
		const target = { logId: 'old-log' };
		const { host } = await mountReactions(target, { '👍': 2 });
		pill(host).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(100);
		await settle();
		target.logId = 'new-log';
		resolveList([{ user: { id: 'u1', username: 'user' } }]);
		await settle();
		expect(os.popup).not.toHaveBeenCalled();
	});

	test('keyboard focus opens one detail popup, including when hover overlaps, and blur closes it', async () => {
		const { host } = await mountReactions({ logId: 'keyboard-log' }, { '👍': 2 });
		const button = pill(host);
		const originalMatches = button.matches.bind(button);
		vi.spyOn(button, 'matches').mockImplementation(selector => selector === ':focus-visible' || originalMatches(selector));
		button.dispatchEvent(new FocusEvent('focus'));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(100);
		await settle();
		expect(os.popup).toHaveBeenCalledTimes(1);
		const showing = (vi.mocked(os.popup).mock.calls[0][1] as unknown as { showing: { value: boolean } }).showing;
		button.dispatchEvent(new MouseEvent('mouseleave'));
		expect(showing.value).toBe(true);
		button.dispatchEvent(new FocusEvent('blur'));
		expect(showing.value).toBe(false);
	});

	test('hover detail remains open when the pointer leaves while keyboard focus continues', async () => {
		const { host } = await mountReactions({ logId: 'hover-focus' }, { '👍': 2 });
		const button = pill(host);
		const originalMatches = button.matches.bind(button);
		vi.spyOn(button, 'matches').mockImplementation(selector => selector === ':focus-visible' || originalMatches(selector));
		button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		vi.advanceTimersByTime(100); await settle();
		expect(os.popup).toHaveBeenCalledTimes(1);
		const showing = (vi.mocked(os.popup).mock.calls[0][1] as unknown as { showing: { value: boolean } }).showing;
		button.dispatchEvent(new FocusEvent('focus'));
		button.dispatchEvent(new MouseEvent('mouseleave'));
		expect(showing.value).toBe(true);
		button.dispatchEvent(new FocusEvent('blur'));
		expect(showing.value).toBe(false);
		expect(os.popup).toHaveBeenCalledTimes(1);
	});

	test('a list response after keyboard blur cannot reopen details', async () => {
		let resolveList!: (rows: unknown[]) => void;
		fixture.api.mockImplementation((endpoint: string) => endpoint.endsWith('/list') ? new Promise(resolve => { resolveList = resolve; }) : Promise.resolve());
		const { host } = await mountReactions({ logId: 'blurred-log' }, { '👍': 2 });
		const button = pill(host);
		const originalMatches = button.matches.bind(button);
		vi.spyOn(button, 'matches').mockImplementation(selector => selector === ':focus-visible' || originalMatches(selector));
		button.dispatchEvent(new FocusEvent('focus'));
		await settle();
		button.dispatchEvent(new FocusEvent('blur'));
		resolveList([{ user: { id: 'u1', username: 'user' } }]);
		await settle();
		expect(os.popup).not.toHaveBeenCalled();
	});
});
