/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import ConcrntTimeline from './ConcrntTimeline.vue';
import type { ConcrntMessage } from '@/utility/concrnt/types.js';
import { concrntState } from '@/utility/concrnt/runtime.js';
import { concrntPostedRevision } from '@/utility/concrnt/composer.js';

const calls = vi.hoisted(() => ({
	initialize: vi.fn(), loadSelection: vi.fn(), saveSelection: vi.fn(), popup: vi.fn(), popupMenu: vi.fn(), confirm: vi.fn(), alert: vi.fn(), mediaLists: [] as unknown[][],
	client: { getLists: vi.fn(), getTimeline: vi.fn(), getMessage: vi.fn(), addReaction: vi.fn(), removeReaction: vi.fn(), getReactionUsers: vi.fn() },
}));
vi.mock('@/utility/concrnt/runtime.js', async () => {
	const { reactive } = await import('vue');
	return {
		concrntState: reactive({ initialized: true, busy: false, currentOwner: 'local.example/owner-one', status: 'connected', connection: { ccid: 'con1example', ckid: 'cck1example', domain: 'social.example' }, settings: { profile: 'main', enabled: true, notifications: true, popups: true, save: 'device' }, profiles: [], revision: 0, operations: [], read: [], error: null }),
		initializeConcrnt: calls.initialize,
		runConcrntAction: (action: (client: typeof calls.client) => Promise<unknown>) => action(calls.client),
		loadConcrntListSelection: calls.loadSelection, saveConcrntListSelection: calls.saveSelection,
	};
});
vi.mock('@/os.js', () => ({ popup: calls.popup, popupMenu: calls.popupMenu, confirm: calls.confirm, alert: calls.alert, toast: vi.fn() }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { enableInfiniteScroll: false }, r: { 'simpleUi.deckMode': { value: false }, 'simpleUi.noteSpacing': { value: 'moderate' } } } }));
vi.mock('@/components/MkMediaList.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: ['mediaList'], setup: p => () => { calls.mediaLists.push(p.mediaList); return h('div', { 'data-media': p.mediaList.length }); } }) };
});
vi.mock('@@/js/config.js', async importOriginal => ({ ...await importOriginal<object>(), ui: 'simple' }));

const message: ConcrntMessage = {
	uri: 'cckv://con1author/concrnt.world/profiles/main/posts/one', key: 'one', schema: 'https://schema.concrnt.world/m/markdown.json', kind: 'markdown',
	author: 'con1author', authorName: '', authorProfile: 'main', createdAt: '2026-10-20T00:00:00Z',
	body: 'テスト投稿 ![図](https://cdn.example/inline.png)', emojis: {}, media: [{ url: 'https://cdn.example/a.png', type: 'image/png' }], distributes: ['target-timeline'], visibility: 'unknown',
	reactions: [{ imageUrl: 'https://cdn.example/like.png', shortcode: '', count: 2, ownAssociationUris: [] }], associationCounts: {}, webUrl: 'https://concrnt.world/post/one',
};
const cleanups: Array<() => void> = [];
const mediaLists = calls.mediaLists;

async function flush() {
	for (let tick = 0; tick < 10; tick++) { await Promise.resolve(); await nextTick(); }
}

async function mountTimeline(initial: { active?: boolean } = {}) {
	const props = reactive({ active: true, embedded: true, hataskeyUi: true, ...initial });
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const app = createApp({ render: () => h(ConcrntTimeline, props) });
	app.directive('tooltip', {});
	app.directive('appear', {});
	app.component('MkTime', { render: () => h('time') });
	app.component('MkLoading', { render: () => h('p', '読み込み中') });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await flush();
	return { target, props };
}

beforeEach(() => {
	for (const call of [calls.initialize, calls.loadSelection, calls.saveSelection, calls.popup, calls.popupMenu, calls.confirm, calls.alert, ...Object.values(calls.client)]) call.mockReset();
	mediaLists.length = 0;
	calls.initialize.mockResolvedValue(undefined);
	calls.loadSelection.mockResolvedValue(null);
	calls.saveSelection.mockResolvedValue(undefined);
	calls.popup.mockReturnValue({ dispose: vi.fn() });
	calls.client.getLists.mockResolvedValue([{ uri: 'list-main', name: 'いつものリスト', timelines: ['one'], pinned: true, excludeSelf: false, defaultPostHome: true, defaultPostTimelines: ['one'] }]);
	calls.client.getTimeline.mockResolvedValue({ items: [message], next: null, unavailable: 0 });
	calls.client.getMessage.mockResolvedValue({ ...message, reactions: [{ ...message.reactions[0], count: 3, ownAssociationUris: ['ccfs://mine'] }] });
	calls.client.addReaction.mockResolvedValue({ status: 'complete' });
	Object.assign(concrntState, { currentOwner: 'local.example/owner-one', status: 'connected', settings: { profile: 'main', enabled: true, notifications: true, popups: true, save: 'device' }, revision: concrntState.revision + 1 });
	mediaLists.length = 0;
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('CTL timeline', () => {
	test('an inactive retained timeline waits until activated before loading data', async () => {
		const { props, target } = await mountTimeline({ active: false });
		expect(calls.client.getTimeline).not.toHaveBeenCalled();
		props.active = true;
		await flush();
		expect(calls.client.getTimeline).toHaveBeenCalledWith('main', undefined, undefined);
		expect(target.textContent).toContain('テスト投稿');
	});

	test('a result arriving after deactivation cannot appear in the retained list', async () => {
		let complete!: (page: unknown) => void;
		calls.client.getTimeline.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
		const { props, target } = await mountTimeline();
		props.active = false;
		await flush();
		complete({ items: [{ ...message, body: '破棄する古い応答' }], next: null, unavailable: 0 });
		await flush();
		expect(target.textContent).not.toContain('破棄する古い応答');
		props.active = true;
		await flush();
		expect(target.textContent).toContain('テスト投稿');
	});

	test('notes use the Hataskey UI card contract and never show the raw CCID', async () => {
		const { target } = await mountTimeline();
		expect(target.querySelector('[data-concrnt-timeline-ui="hataskey"]')).not.toBeNull();
		expect(target.querySelector('[data-concrnt-note-mode="hataskey-normal"]')).not.toBeNull();
		expect(target.textContent).toContain('名前未設定のユーザー');
		expect(target.textContent).not.toContain('con1author');
		// No inline composer, reaction picker or notification list is placed in the timeline.
		expect(target.querySelector('textarea')).toBeNull();
		expect(target.querySelector('form')).toBeNull();
	});

	test('attached and inline images go to the in-app media list instead of links', async () => {
		const { target } = await mountTimeline();
		expect(target.querySelector('a[href="https://cdn.example/a.png"]')).toBeNull();
		expect(target.querySelector('a[href="https://cdn.example/inline.png"]')).toBeNull();
		const files = mediaLists.at(-1) as { url: string }[];
		expect(files.map(file => file.url)).toEqual(['https://cdn.example/a.png', 'https://cdn.example/inline.png']);
		expect(target.textContent).not.toContain('![図]');
	});

	test('clicking the author opens the profile popup without navigating away', async () => {
		const { target } = await mountTimeline();
		target.querySelector<HTMLButtonElement>('button[aria-label$="のプロフィール"]')!.click();
		await flush();
		expect(calls.popup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ccid: 'con1author', profileId: 'main' }), expect.anything());
	});

	test('reacting to an existing reaction updates only that post instead of reloading the timeline', async () => {
		const { target } = await mountTimeline();
		const before = calls.client.getTimeline.mock.calls.length;
		target.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!.click();
		await flush();
		expect(calls.client.addReaction).toHaveBeenCalledWith('one', expect.objectContaining({ imageUrl: 'https://cdn.example/like.png' }), 'main');
		expect(calls.client.getTimeline.mock.calls.length).toBe(before);
		expect(target.querySelector('button[aria-pressed="true"]')?.textContent).toContain('3');
	});

	test('hovering a reaction lists who reacted', async () => {
		vi.useFakeTimers();
		calls.client.getReactionUsers.mockResolvedValue({ shortcode: 'like', users: [{ ccid: 'con1a', profile: 'main', name: 'リアクションした人' }, { ccid: 'con1b', profile: 'main', name: '' }] });
		const { target } = await mountTimeline();
		target.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!.dispatchEvent(new MouseEvent('mouseenter'));
		await vi.advanceTimersByTimeAsync(350);
		vi.useRealTimers();
		await flush();
		const tip = window.document.querySelector('.concrnt-reaction-tip');
		expect(calls.client.getReactionUsers).toHaveBeenCalledWith(message.uri, 'https://cdn.example/like.png', 10);
		expect(tip?.textContent).toContain('リアクションした人');
		expect(tip?.textContent).toContain(':like:');
		expect(tip?.textContent).not.toContain('con1a');
	});

	test('a confirmed post elsewhere refreshes an active timeline', async () => {
		await mountTimeline();
		const before = calls.client.getTimeline.mock.calls.length;
		concrntPostedRevision.value++;
		await flush();
		expect(calls.client.getTimeline.mock.calls.length).toBe(before + 1);
	});

	test('changing account generation clears the displayed messages', async () => {
		const { target } = await mountTimeline();
		calls.client.getTimeline.mockImplementation(() => new Promise(() => {}));
		concrntState.currentOwner = 'local.example/owner-two';
		concrntState.revision++;
		await flush();
		expect(target.textContent).not.toContain('テスト投稿');
	});
});
