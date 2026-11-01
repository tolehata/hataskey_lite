/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, ref } from 'vue';
import { useHataskeyNavbarNotices } from './use-hataskey-navbar-notices.js';
import type { EffectScope } from 'vue';
import type { entities } from 'cherrypick-js';
import { createHataskeyNotificationToasts } from '@/utility/hataskey-notification-toast.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { useStream } from '@/stream.js';

const listeners = vi.hoisted(() => new Map<string, Set<(payload: entities.EmojiAdded | entities.EmojiDeleted) => void>>());
vi.mock('@/stream.js', () => ({ useStream: vi.fn(() => ({
	on: (event: string, listener: (payload: entities.EmojiAdded | entities.EmojiDeleted) => void) => {
		const handlers = listeners.get(event) ?? new Set();
		handlers.add(listener);
		listeners.set(event, handlers);
	},
	off: (event: string, listener: (payload: entities.EmojiAdded | entities.EmojiDeleted) => void) => listeners.get(event)?.delete(listener),
})) }));
vi.mock('@/preferences.js', async () => {
	const vue = await import('vue');
	return { prefer: { r: { emojiAdditionNotice: vue.ref(true), hourlyTimeNotice: vue.ref(true) } } };
});
vi.mock('@/store.js', async () => ({ store: { r: { realtimeMode: (await import('vue')).ref(true) } } }));

const emoji = (id: string, name = id): entities.EmojiDetailed => ({
	id, name, url: `https://local.test/emoji/${id}.webp`, host: null, aliases: [], category: null,
	license: null, isSensitive: false, localOnly: false, roleIdsThatCanBeUsedThisEmojiAsReaction: [],
});

function emit(event: string, payload: entities.EmojiAdded | entities.EmojiDeleted) {
	for (const listener of listeners.get(event) ?? []) listener(payload);
}

const scopes: EffectScope[] = [];

function mount(activeInitially = true) {
	const active = ref(activeInitially);
	const context = createHataskeyNotificationToasts(computed(() => false), computed(() => false));
	const scope = effectScope();
	scopes.push(scope);
	scope.run(() => useHataskeyNavbarNotices(context, computed(() => active.value)));
	return { active, context, scope };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 8, 19, 11, 59, 59));
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	prefer.r.emojiAdditionNotice.value = true;
	prefer.r.hourlyTimeNotice.value = true;
	store.r.realtimeMode.value = true;
	vi.mocked(useStream).mockClear();
});
afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop();
	listeners.clear();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('normal Hataskey navbar notices', () => {
	it('receives local additions into the shared navbar slot, including successive approval/admin registrations', () => {
		const { context } = mount();
		for (const id of ['approved', 'admin-added']) {
			emit('emojiAdded', { emoji: emoji(id) });
			expect(context.items.value).toHaveLength(1);
			expect(context.items.value[0]).toMatchObject({ source: 'status', navbarNotice: { kind: 'emojiAdded', emoji: { id, name: id, url: emoji(id).url } } });
			expect(context.integrated.value).toBe(true);
		}
		expect(listeners.get('emojiAdded')?.size).toBe(1);
	});
	it('does not announce remote emoji, repeated events, updates or a rename broadcast as delete/add', () => {
		const { context } = mount();
		emit('emojiAdded', { emoji: { ...emoji('remote'), host: 'remote.test' } });
		expect(context.items.value).toEqual([]);
		emit('emojiAdded', { emoji: emoji('new') });
		const item = context.items.value[0];
		emit('emojiAdded', { emoji: emoji('new') });
		expect(context.items.value[0]).toBe(item);
		emit('emojiUpdated', { emojis: [emoji('old')] });
		expect(context.items.value[0]).toBe(item);
		emit('emojiDeleted', { emojis: [emoji('old')] });
		emit('emojiAdded', { emoji: emoji('old', 'renamed') });
		expect(context.items.value[0]).toBe(item);
		emit('emojiDeleted', { emojis: [emoji('new')] });
		expect(context.items.value).toEqual([]);
	});
	it('honors a saved emoji opt-out without disabling the hourly signal', () => {
		prefer.r.emojiAdditionNotice.value = false;
		const { context } = mount();
		expect(useStream).not.toHaveBeenCalled();
		emit('emojiAdded', { emoji: emoji('disabled') });
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(1000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '12:00' } });
		prefer.r.emojiAdditionNotice.value = true;
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime' } });
		emit('emojiAdded', { emoji: emoji('enabled') });
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'emojiAdded' } });
		prefer.r.emojiAdditionNotice.value = false;
		expect(context.items.value).toEqual([]);
		expect(listeners.get('emojiAdded')?.size).toBe(0);
	});
	it('honors a saved hourly opt-out without disabling additions or clearing another status', () => {
		prefer.r.hourlyTimeNotice.value = false;
		const { context } = mount();
		vi.advanceTimersByTime(1000);
		expect(context.items.value).toEqual([]);
		emit('emojiAdded', { emoji: emoji('addition') });
		prefer.r.hourlyTimeNotice.value = true;
		prefer.r.hourlyTimeNotice.value = false;
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'emojiAdded' } });
		context.enqueueStatus('saved');
		prefer.r.emojiAdditionNotice.value = false;
		expect(context.items.value[0]).toMatchObject({ source: 'status', message: 'saved' });
	});
	it('waits for each local hour and formats midnight with two digits', () => {
		vi.setSystemTime(new Date(2026, 8, 19, 23, 59, 59));
		const { context } = mount();
		vi.advanceTimersByTime(999);
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '00:00' } });
		vi.advanceTimersByTime(3_600_000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '01:00' } });
		prefer.r.hourlyTimeNotice.value = false;
		expect(context.items.value).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('skips background hours and additions instead of replaying them after return', () => {
		const { context } = mount();
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(120_000);
		emit('emojiAdded', { emoji: emoji('while-away') });
		expect(context.items.value).toEqual([]);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(3_480_999);
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(1);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '13:00' } });
	});
	it('skips delayed timers and reschedules at the next local hour', () => {
		const { context } = mount();
		vi.setSystemTime(new Date(2026, 8, 19, 12, 10, 0));
		vi.advanceTimersByTime(1000);
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(2_999_000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '13:00' } });
	});
	it('discards a displayed hourly signal when hidden instead of resuming an old time', () => {
		const { context } = mount();
		vi.advanceTimersByTime(1000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '12:00' } });
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(context.items.value).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(60_000);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(context.items.value).toEqual([]);
		vi.advanceTimersByTime(3_540_000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime', time: '13:00' } });
	});
	it.each(['ordinary', 'status', 'favorite'] as const)('preserves an existing %s notification when the tab becomes hidden', (kind) => {
		const { context } = mount();
		if (kind === 'ordinary') context.enqueue({ id: 'notification', type: 'test', createdAt: '2026-09-19T02:59:59Z' }, 'local', 0);
		else context.enqueueStatus('saved', 0, undefined, kind === 'favorite' ? true : undefined);
		const item = context.items.value[0];
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0]).toBe(item);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('does not subscribe or schedule outside the normal navbar, and cleans up on exit and disposal', () => {
		const { context, active, scope } = mount(false);
		expect(useStream).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		active.value = true;
		emit('emojiAdded', { emoji: emoji('here') });
		expect(context.navbarNotice.value).toBeDefined();
		active.value = false;
		expect(context.items.value).toEqual([]);
		expect(context.integrated.value).toBe(false);
		expect(listeners.get('emojiAdded')?.size).toBe(0);
		expect(listeners.get('emojiDeleted')?.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		active.value = true;
		vi.advanceTimersByTime(1000);
		expect(context.navbarNotice.value).toBeDefined();
		scope.stop();
		expect(context.items.value).toEqual([]);
		expect(listeners.get('emojiAdded')?.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('respects no-WebSocket mode for additions while keeping the local clock available', () => {
		store.r.realtimeMode.value = false;
		const { context } = mount();
		expect(useStream).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(context.items.value[0]).toMatchObject({ navbarNotice: { kind: 'hourlyTime' } });
		store.r.realtimeMode.value = true;
		expect(listeners.get('emojiAdded')?.size).toBe(1);
		store.r.realtimeMode.value = false;
		expect(listeners.get('emojiAdded')?.size).toBe(0);
	});
});
