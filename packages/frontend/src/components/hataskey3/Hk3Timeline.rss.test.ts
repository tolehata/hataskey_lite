/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, inject, nextTick, reactive } from 'vue';
import type { Component } from 'vue';
import Hk3Timeline from './Hk3Timeline.vue';
import { hk3Toasts, hk3PostedNote, setHk3ToastsPaused } from './hk3-state.js';
import { prefer } from '@/preferences.js';
import { tabSwipeEnabled } from '@/utility/hatasaba-device-prefs.js';
import { hk3PostContextKey } from './hk3-post-context.js';
import { hk3ComposerEmojiHostKey } from './hk3-composer-emoji-host.js';
import type { Hk3ComposerEmojiHost } from './hk3-composer-emoji-host.js';
import type { Hk3PostContext } from './hk3-post-context.js';
import type * as Misskey from 'cherrypick-js';

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(), sound: vi.fn(), api: vi.fn(), channel: vi.fn(), dispose: vi.fn(), lists: vi.fn(), antennas: vi.fn(),
	note: null as null | ((note: unknown) => void), rssMounts: 0, live: false,
	storage: new Map<string, string>(),
	externalNotice: null as any,
	externalReload: vi.fn(),
	hatadyReload: vi.fn(), hatadyRefresh: vi.fn(),
	intersection: null as null | ((entries: { isIntersecting: boolean }[]) => void),
	entrance: vi.fn(), stopEntrance: vi.fn(),
	commit: vi.fn(),
	blockedTabs: new Set<string>(),
}));
vi.mock('./hk3-post-entrance.js', () => ({ animateHk3PostEntrance: mocks.entrance }));
vi.mock('@/cache.js', async () => {
	const { ref } = await import('vue');
	const lists = ref([]);
	const antennas = ref([]);
	return {
		userListsCache: { fetch: async () => (lists.value = await mocks.lists()), value: lists },
		antennasCache: { fetch: async () => (antennas.value = await mocks.antennas()), value: antennas },
	};
});
vi.mock('@/utility/sound.js', () => ({ playMisskeySfx: mocks.sound }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/router.js', () => ({ mainRouter: { pushByPath: mocks.navigate } }));
vi.mock('@/i.js', () => ({ $i: { id: 'me', mutedWords: [], hardMutedWords: [] } }));
// Not connected: keeps these tests independent of the Concrnt runtime and its preference/uploader imports.
vi.mock('@/utility/concrnt/runtime.js', () => ({ concrntState: { connection: null, settings: { enabled: false, notifications: false, popups: false }, notifications: [], toasts: [] } }));
vi.mock('@/i18n.js', () => ({ i18n: { tsx: { newNoteRecivedCount: ({ n }: { n: number }) => `${n} new notes` }, ts: {
	options: 'Options', showRenotes: 'Renotes', fileAttachedOnly: 'Files', withSensitive: 'Sensitive', retry: 'Retry',
	_hata: {
		_hataskeyUi3: { tabHome: 'Home', tabLocal: 'Local', tabSocial: 'Social', tabGlobal: 'Global', tabTrending: 'Trending', tabHatady: 'Hatady', tabExternalHome: 'External home', tabExternalLocal: 'External local', realtime: 'LIVE', retry: 'Retry', loadFailed: 'Load failed', _rss: { settings: 'RSS settings' } },
		_hatasabaUi: { _simple: { list: 'Lists', channel: 'Channels', antenna: 'Antennas', selectList: 'Select list', selectAntenna: 'Select antenna', switchList: 'Switch list', switchAntenna: 'Switch antenna', configureList: 'Configure list', configureAntenna: 'Configure antenna', noLists: 'No lists', noAntennas: 'No antennas', options: 'Options' } },
	},
} } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const { ref } = await import('vue');
	return { tabSwipeEnabled: ref(true) };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { commit: mocks.commit, r: {
		animation: ref(false), enablePullToRefresh: ref(false), hataskeyUi3RssEnabled: ref(true), ltlEmojiVoteEnabled: ref(false), hataskeyUi3ComposerPosition: ref('bottom'),
		'external.enabled': ref(false), 'external.token': ref(null), 'external.host': ref(''),
		'external.enableOHTL': ref(false), 'external.enableOLTL': ref(false),
		'simpleUi.topNav': ref([{ id: 'local', icon: '', label: 'Local', visible: true }]), 'simpleUi.showTrendingTab': ref(false), 'simpleUi.showHatadyTab': ref(false),
	} } };
});
vi.mock('./hk3-state.js', async () => {
	const { ref } = await import('vue');
	return { hk3Toasts: ref([]), hk3ComposerLink: ref(null), hk3PostedNote: ref(null), pushHk3Toast: vi.fn(), dismissHk3Toast: vi.fn(), setHk3ToastsPaused: vi.fn() };
});
vi.mock('@/store.js', async () => {
	const { ref } = await import('vue');
	const filter = { withRenotes: true, onlyFiles: false, withSensitive: true };
	return { store: { r: { tl: ref({ filter }) }, s: { tl: { filter } } } };
});
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: mocks.channel }) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/instance.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/instance.js')>();
	return { ...original, instance: { ...original.instance, notesPerOneAd: 2 } };
});
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => key === 'hataskeyUi3Live' && mocks.live ? 'true' : mocks.storage.get(key) ?? null,
	setItem: (key: string, value: string) => mocks.storage.set(key, value),
} }));
vi.mock('@/utility/external-api.js', () => ({ getExternalEmojiUrlMapForHost: () => ({}) }));
vi.mock('@/events.js', () => ({ useGlobalEvent: vi.fn() }));
vi.mock('@/composables/use-note-removal.js', () => ({ useNoteRemoval: () => ({ cancelAll: vi.fn(), remove: vi.fn() }) }));
vi.mock('@/utility/hataskey-timeline-availability.js', () => ({ isHataskeyTimelineAllowed: (id: string) => !mocks.blockedTabs.has(id) }));
vi.mock('@/utility/ltl-emoji-vote-anchor.js', () => ({ getLtlEmojiVoteAnchor: () => null }));
vi.mock('@/utility/ltl-emoji-vote.js', async () => {
	const { ref } = await import('vue');
	return { useLtlEmojiVote: () => ({ round: ref(null), phase: ref('idle'), refresh: vi.fn() }) };
});
vi.mock('./Hk3RssReader.vue', () => ({ default: {
	props: ['interrupted', 'paused'],
	setup() { mocks.rssMounts++; },
	template: '<div data-rss-reader :data-interrupted="String(interrupted)" :data-paused="String(paused)">Reader</div>',
} }));
vi.mock('./Hk3Note.vue', () => ({ default: {
	props: ['note', 'instanceBadgePosition', 'showAudienceIcons', 'showLocalOnlyIcon', 'size', 'inLocal', 'inSocial'],
	template: '<div :data-rendered-note="note.id" :data-badge-position="instanceBadgePosition" :data-audience-enabled="String(showAudienceIcons)" :data-local-only-enabled="String(showLocalOnlyIcon)" :data-note-size="size" :data-utage-local="String(inLocal)" :data-utage-social="String(inSocial)" />',
} }));
vi.mock('./Hk3PostSuccess.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkLtlPunch.vue', () => ({ default: {
	props: ['active'],
	template: '<div data-punch :data-punch-active="String(active)" />',
} }));
vi.mock('@/components/MkExternalTimeline.vue', async () => {
	const { defineComponent, h, ref } = await import('vue');
	const { useHataskeyTimelineNewNotes } = await import('@/utility/hataskey-timeline-new-notes.js');
	mocks.externalNotice = ref(null);
	return { default: defineComponent({
		props: ['src', 'newNotesNavbarKey', 'sound'],
		setup(props, { expose }) {
			useHataskeyTimelineNewNotes(() => props.newNotesNavbarKey, mocks.externalNotice);
			expose({ reloadTimeline: mocks.externalReload });
			return () => h('div', { 'data-external-timeline': props.src, 'data-sound': String(props.sound) });
		},
	}) };
});
vi.mock('@/components/MkHatadyTimeline.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['variant', 'active', 'newNotesNavbarKey'],
		setup(props, { expose }) {
			expose({ reloadTimeline: mocks.hatadyReload, refreshFromPull: mocks.hatadyRefresh, releaseQueue: vi.fn() });
			return () => h('div', { 'data-hatady-timeline': props.variant, 'data-active': String(props.active) });
		},
	}) };
});
vi.mock('@/components/MkLtlEmojiVote.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkNoteActionAnimation.vue', () => ({ default: { render: () => null } }));

const cleanups: (() => void)[] = [];
let timelineVm: InstanceType<typeof Hk3Timeline> | null = null;

async function settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); await nextTick(); } }

async function mount(compact = false, composer?: Component, extraProps: Record<string, unknown> = {}) {
	const host = window.document.createElement('div');
	host.style.overflowY = 'auto';
	host.dataset.hk3Theme = 'dark';
	window.document.body.append(host);
	const app = createApp({ render: () => h(Hk3Timeline, { compact, ...extraProps, ref: instance => { timelineVm = instance as InstanceType<typeof Hk3Timeline> | null; } }, composer ? { default: () => h(composer) } : undefined) });
	app.component('MkLoading', { render: () => null });
	app.component('MkAd', { props: ['preferForms'], template: '<div data-timeline-ad :data-forms="preferForms.join(\',\')" />' });
	app.component('MkAvatar', { props: ['user', 'link', 'preview'], template: '<span :data-avatar-user="user?.id" :data-avatar-decorations="JSON.stringify(user?.avatarDecorations)" :data-avatar-link="String(link)" :data-avatar-preview="String(preview)" />' });
	app.component('Mfm', { props: ['text', 'author', 'emojiUrls'], template: '<span :data-mfm-author="author?.host" :data-mfm-emojis="JSON.stringify(emojiUrls)">{{ text }}</span>' });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	return host;
}

beforeEach(() => {
	mocks.commit.mockReset().mockImplementation((key: keyof typeof prefer.r, value: unknown) => { (prefer.r[key] as { value: unknown }).value = value; });
	mocks.entrance.mockReset().mockReturnValue(mocks.stopEntrance);
	mocks.stopEntrance.mockClear();
	prefer.r.animation.value = false;
	prefer.r.enablePullToRefresh.value = false;
	tabSwipeEnabled.value = true;
	hk3Toasts.value = [];
	prefer.r.hataskeyUi3RssEnabled.value = true;
	prefer.r['simpleUi.topNav'].value = [{ id: 'local', icon: '', label: 'Local', visible: true }];
	prefer.r['simpleUi.showTrendingTab'].value = false;
	prefer.r['simpleUi.showHatadyTab'].value = false;
	prefer.r['external.enabled'].value = false;
	prefer.r['external.token'].value = null;
	prefer.r['external.host'].value = '';
	prefer.r['external.enableOHTL'].value = false;
	prefer.r['external.enableOLTL'].value = false;
	mocks.externalNotice.value = null;
	mocks.rssMounts = 0;
	mocks.navigate.mockClear();
	mocks.sound.mockClear();
	mocks.live = false;
	mocks.storage.clear();
	mocks.blockedTabs.clear();
	mocks.api.mockReset().mockResolvedValue([]);
	mocks.externalReload.mockReset().mockResolvedValue(undefined);
	mocks.hatadyReload.mockReset().mockResolvedValue(undefined);
	mocks.hatadyRefresh.mockReset().mockResolvedValue(undefined);
	mocks.lists.mockReset().mockResolvedValue([]);
	mocks.antennas.mockReset().mockResolvedValue([]);
	mocks.dispose.mockReset();
	mocks.channel.mockReset().mockImplementation(() => ({
		on: (_name: string, handler: (note: unknown) => void) => { mocks.note = handler; }, dispose: mocks.dispose,
	}));
	hk3PostedNote.value = null;
	vi.stubGlobal('IntersectionObserver', class {
		constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { mocks.intersection = callback; }
		observe() {} disconnect() {}
	});
});

function navButton(host: Element, title: string) {
	const button = host.querySelector<HTMLButtonElement>(`button[title="${title}"], button[aria-label="${title}"]`);
	expect(button, title).not.toBeNull();
	return button!;
}

describe('UI S collection navigation', () => {
	it('loads mobile branch candidates without changing TL and routes settings directly to management', async () => {
		mocks.lists.mockResolvedValue([{ id: 'one', name: 'First' }]);
		await mount(true);
		const navigation = timelineVm!.mobileNavigation;
		const previousRequests = mocks.api.mock.calls.length;
		expect(await navigation.load('list')).toEqual([{ id: 'one', name: 'First' }]);
		expect(mocks.api.mock.calls).toHaveLength(previousRequests);
		expect(timelineVm!.mobileNavigation.active).toBe('local');
		navigation.selectCollection('list', 'one');
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'one' }));
		timelineVm!.mobileNavigation.settings('list');
		expect(mocks.navigate).toHaveBeenLastCalledWith('/my/lists');
		timelineVm!.mobileNavigation.settings('antenna');
		expect(mocks.navigate).toHaveBeenLastCalledWith('/my/antennas');
	});

	it('restores a mobile collection without flashing the old popup and sends empty-list selection to the dock', async () => {
		mocks.storage.set('hataskeyUi3Tab', 'list');
		mocks.storage.set('hatasabaLastListId', 'deleted');
		const target = window.document.createElement('div');
		window.document.body.append(target);
		cleanups.push(() => target.remove());
		const openBranch = vi.fn();
		const host = await mount(true, undefined, { mobileComposerTarget: target, onMobileCollection: openBranch });
		expect(host.querySelector('[data-collection-picker]')).toBeNull();
		expect(openBranch).not.toHaveBeenCalled();
		const selection = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Select list');
		expect(selection).toBeDefined();
		selection!.click();
		await settle();
		expect(openBranch).toHaveBeenCalledWith('list');
		expect(host.querySelector('[data-collection-picker]')).toBeNull();
	});

	it('keeps the composer mounted and its text intact while the mobile selector opens', async () => {
		const target = window.document.createElement('div');
		window.document.body.append(target);
		cleanups.push(() => target.remove());
		let mounts = 0;
		const props = reactive({ mobileComposerTarget: target, mobileDockHeight: 180, mobileMenuOpen: false });
		const host = await mount(true, { setup: () => { mounts++; return () => h('textarea', { 'aria-label': 'Draft' }); } }, props);
		const input = target.querySelector('textarea')!;
		input.value = 'Unsent draft';
		props.mobileMenuOpen = true;
		await settle();
		expect(target.querySelector('textarea')).toBe(input);
		expect(input.value).toBe('Unsent draft');
		expect(input.closest('[inert]')).not.toBeNull();
		expect(host.querySelector('[data-rss-reader]')).not.toBeNull();
		props.mobileMenuOpen = false;
		await settle();
		expect(input.closest('[inert]')).toBeNull();
		expect(mounts).toBe(1);
	});

	it('saves the mobile order without losing hidden navbar preferences and honours later settings changes', async () => {
		prefer.r['simpleUi.topNav'].value = [
			{ id: 'following', icon: 'home', label: 'Home', visible: true },
			{ id: 'social', icon: 'users', label: 'Social', visible: false },
			{ id: 'local', icon: 'planet', label: 'Local', visible: true },
		];
		await mount(true);
		const ids = ['following', 'antenna', 'channel', 'list', 'local'];
		timelineVm!.mobileNavigation.reorder(ids);
		await settle();
		expect(timelineVm!.mobileNavigation.choices.map(item => item.id)).toEqual(ids);
		expect(prefer.r['simpleUi.topNav'].value.map(item => item.id)).toEqual(['local', 'social', 'following']);
		expect(prefer.r['simpleUi.topNav'].value[1].visible).toBe(false);
		expect(mocks.storage.has('hataskeyUi3MobileOrder')).toBe(true);
		prefer.r['simpleUi.topNav'].value = [...prefer.r['simpleUi.topNav'].value].reverse();
		await settle();
		expect(timelineVm!.mobileNavigation.choices.map(item => item.id)).toEqual(['antenna', 'channel', 'list', 'local', 'following']);
	});

	it.each([false, true])('opens the remembered list with UI S notes and its own stream (compact=%s)', async compact => {
		mocks.lists.mockResolvedValue([{ id: 'first', name: 'First list' }, { id: 'saved', name: 'Saved list' }]);
		mocks.storage.set('hatasabaLastListId', 'saved');
		mocks.api.mockImplementation(async (endpoint: string) => endpoint === 'notes/user-list-timeline' ? [{ id: 'list-note', userId: 'other', user: { id: 'other' }, text: 'body' }] : []);
		const host = await mount(compact);
		navButton(host, 'Lists').click();
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'saved', limit: 20 }));
		expect(mocks.channel).toHaveBeenLastCalledWith('userList', expect.objectContaining({ listId: 'saved' }));
		expect(mocks.dispose).toHaveBeenCalled();
		expect(host.querySelector('[data-rendered-note="list-note"]')).not.toBeNull();
		expect(host.querySelector('[data-rendered-note="list-note"]')?.getAttribute('data-badge-position')).toBe('left');
		expect(host.textContent).toContain('Saved list');
		mocks.intersection?.([{ isIntersecting: true }]);
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'saved', untilId: 'list-note' }));
		hk3PostedNote.value = { id: 'unrelated-own-note', userId: 'me' } as NonNullable<typeof hk3PostedNote.value>;
		await settle();
		expect(host.querySelector('[data-rendered-note="unrelated-own-note"]')).toBeNull();
		navButton(host, 'Configure list').click();
		expect(mocks.navigate).toHaveBeenCalledWith('/my/lists/saved');
	});

	it('falls back from a deleted antenna and opens channels through the existing page', async () => {
		mocks.antennas.mockResolvedValue([{ id: 'available', name: 'My antenna' }]);
		mocks.storage.set('hatasabaLastAntennaId', 'deleted');
		const host = await mount();
		navButton(host, 'Antennas').click();
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('antennas/notes', expect.objectContaining({ antennaId: 'available' }));
		expect(mocks.channel).toHaveBeenLastCalledWith('antenna', { antennaId: 'available' });
		expect(mocks.storage.get('hatasabaLastAntennaId')).toBe('available');
		navButton(host, 'Channels').click();
		expect(mocks.navigate).toHaveBeenCalledWith('/channels');
	});

	it('restores a saved collection tab only after validating its remembered ID', async () => {
		mocks.storage.set('hataskeyUi3Tab', 'list');
		mocks.storage.set('hatasabaLastListId', 'removed');
		mocks.lists.mockResolvedValue([{ id: 'valid', name: 'Valid list' }]);
		await mount();
		expect(mocks.api).toHaveBeenCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'valid' }));
		expect(mocks.api.mock.calls.some(([, params]) => params?.listId === 'removed')).toBe(false);
	});

	it('keeps the current timeline when no collection exists and offers management', async () => {
		const host = await mount();
		navButton(host, 'Lists').click();
		await settle();
		expect(host.textContent).toContain('No lists');
		expect(mocks.api.mock.calls.some(([endpoint]) => endpoint === 'notes/user-list-timeline')).toBe(false);
		expect(mocks.channel).toHaveBeenLastCalledWith('localTimeline', expect.anything());
	});

	it('switches between lists and persists the new selection', async () => {
		mocks.lists.mockResolvedValue([{ id: 'one', name: 'List one' }, { id: 'two', name: 'List two' }]);
		const host = await mount();
		navButton(host, 'Lists').click();
		await settle();
		navButton(host, 'Switch list').click();
		await settle();
		const second = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'List two');
		expect(second).toBeDefined();
		second!.click();
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'two' }));
		expect(mocks.storage.get('hatasabaLastListId')).toBe('two');
		expect(mocks.dispose).toHaveBeenCalledTimes(2);
	});

	it('does not switch back when a dismissed selection request finishes late', async () => {
		let finish!: (items: { id: string; name: string }[]) => void;
		mocks.lists.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		const host = await mount();
		navButton(host, 'Lists').click();
		await settle();
		navButton(host, 'Local').click();
		finish([{ id: 'late', name: 'Late list' }]);
		await settle();
		expect(mocks.api.mock.calls.some(([endpoint]) => endpoint === 'notes/user-list-timeline')).toBe(false);
		expect(mocks.channel).toHaveBeenLastCalledWith('localTimeline', expect.anything());
	});

	it('distinguishes a fetch failure from an empty list and retries without losing the current timeline', async () => {
		mocks.lists.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([{ id: 'recovered', name: 'Recovered list' }]);
		const host = await mount();
		navButton(host, 'Lists').click();
		await settle();
		expect(host.querySelector('[data-collection-picker]')?.getAttribute('data-state')).toBe('error');
		expect(host.textContent).not.toContain('No lists');
		host.querySelector<HTMLButtonElement>('[data-collection-retry]')!.click();
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/user-list-timeline', expect.objectContaining({ listId: 'recovered' }));
	});

	it('closes an empty picker with Escape and returns focus to the navigation button', async () => {
		const host = await mount();
		const opener = navButton(host, 'Lists');
		opener.click();
		await settle();
		expect(host.querySelector('[data-collection-picker]')).not.toBeNull();
		window.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(host.querySelector('[data-collection-picker]')).toBeNull();
		expect(window.document.activeElement).toBe(opener);
	});
});

describe('UI S streamed note sounds', () => {
	it.each([false, true])('plays once for a new note (LIVE=%s), without replaying duplicates or released queues', async live => {
		mocks.live = live;
		const host = await mount();
		expect(mocks.sound).not.toHaveBeenCalled();
		const note = { id: 'new-note', userId: 'other', user: { id: 'other' }, text: 'hello' };
		mocks.note?.(note);
		await settle();
		expect(mocks.sound).toHaveBeenCalledExactlyOnceWith('note');
		mocks.note?.(note);
		host.querySelector<HTMLButtonElement>('[data-kind="queue"]')?.click();
		await settle();
		mocks.note?.(note);
		expect(mocks.sound).toHaveBeenCalledTimes(1);
	});

	it('uses the configured own-note sound for an own note received from the stream', async () => {
		await mount();
		mocks.note?.({ id: 'own-note', userId: 'me', user: { id: 'me' }, text: 'hello' });
		expect(mocks.sound).toHaveBeenCalledExactlyOnceWith('noteMy');
	});
});

describe('retained timeline visibility and narrow layout', () => {
	const note = (id: string, userId = 'other') => ({ id, userId, user: { id: userId, username: userId }, text: id, files: [], visibility: 'public' }) as unknown as Misskey.entities.Note;

	it('changes only note density for narrow split view, keeping the desktop rail and composer draft', async () => {
		mocks.api.mockResolvedValue([note('original')]);
		const props = reactive({ narrow: false });
		let mounts = 0;
		const host = await mount(false, { setup: () => { mounts++; return () => h('textarea', { 'aria-label': 'Draft' }); } }, props);
		const input = host.querySelector('textarea')!;
		input.value = 'unsent';
		const renderedNote = host.querySelector('[data-rendered-note="original"]')!;
		expect(renderedNote.getAttribute('data-note-size')).toBe('lg');
		expect(host.querySelector('[data-desktop-rail]')).not.toBeNull();
		props.narrow = true;
		await settle();
		expect(host.querySelector('[data-rendered-note="original"]')).toBe(renderedNote);
		expect(renderedNote.getAttribute('data-note-size')).toBe('sm');
		expect(host.querySelector('[data-desktop-rail]')).not.toBeNull();
		expect(host.querySelector('textarea')).toBe(input);
		expect(input.value).toBe('unsent');
		expect(mounts).toBe(1);
		expect(mocks.api).toHaveBeenCalledTimes(1);
	});

	it('queues hidden LIVE arrivals without sound, scroll changes or reload, then resumes the retained stream', async () => {
		mocks.live = true;
		mocks.api.mockResolvedValue([note('original')]);
		const props = reactive({ active: true });
		const host = await mount(false, undefined, props);
		const original = host.querySelector('[data-rendered-note="original"]');
		const viewport = host.querySelector<HTMLElement>('[data-timeline-tab-gestures]')!;
		viewport.scrollTop = 0;
		const rss = host.querySelector('[data-rss-reader]');
		const initialHandler = mocks.note;
		props.active = false;
		await settle();
		expect(rss?.getAttribute('data-paused')).toBe('true');
		expect(host.querySelector('[data-punch]')?.getAttribute('data-punch-active')).toBe('false');
		mocks.note?.(note('hidden-at-top'));
		expect(host.querySelectorAll('[data-rendered-note]')).toHaveLength(1);
		viewport.scrollTop = 37;
		mocks.note?.(note('hidden-while-reading'));
		hk3PostedNote.value = note('posted');
		await settle();
		expect(mocks.sound).not.toHaveBeenCalled();
		expect(host.querySelectorAll('[data-rendered-note]')).toHaveLength(1);
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('3 new notes');
		expect(viewport.scrollTop).toBe(37);
		props.active = true;
		await settle();
		expect(rss?.getAttribute('data-paused')).toBe('false');
		expect(host.querySelector('[data-punch]')?.getAttribute('data-punch-active')).toBe('true');
		expect(host.querySelector('[data-rendered-note="original"]')).toBe(original);
		expect(mocks.api).toHaveBeenCalledTimes(1);
		expect(mocks.note).toBe(initialHandler);
		mocks.note?.(note('visible'));
		expect(mocks.sound).toHaveBeenCalledExactlyOnceWith('note');
	});

	it('closes teleported collection and options menus without taking focus when hidden', async () => {
		prefer.r.animation.value = true;
		const props = reactive({ active: true });
		const host = await mount(false, undefined, props);
		navButton(host, 'Lists').click();
		await settle();
		expect(host.querySelector('[data-collection-picker]')).not.toBeNull();
		const elsewhere = window.document.createElement('button');
		window.document.body.append(elsewhere);
		cleanups.push(() => elsewhere.remove());
		elsewhere.focus();
		props.active = false;
		await settle();
		expect(host.querySelector('[data-collection-picker]')).toBeNull();
		expect(window.document.activeElement).toBe(elsewhere);
		props.active = true;
		await settle();
		navButton(host, 'Options').click();
		await settle();
		expect(host.querySelector('[role="menu"]')).not.toBeNull();
		props.active = false;
		await settle();
		expect(host.querySelector('[role="menu"]')).toBeNull();
		expect(window.document.activeElement).toBe(elsewhere);
	});

	it('resets a pull gesture and ignores hidden tab gestures', async () => {
		prefer.r.enablePullToRefresh.value = true;
		prefer.r['simpleUi.topNav'].value = ['local', 'following'].map(id => ({ id, icon: '', label: id, visible: true }));
		mocks.api.mockResolvedValue([note('original')]);
		const props = reactive({ active: true });
		const host = await mount(false, undefined, props);
		const rendered = host.querySelector('[data-rendered-note]')!;
		rendered.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180, cancelable: true }));
		await settle();
		expect(host.querySelector('[data-pulling]')).not.toBeNull();
		props.active = false;
		await settle();
		expect(host.querySelector('[data-pulling]')).toBeNull();
		window.dispatchEvent(new MouseEvent('mouseup'));
		const viewport = host.querySelector('[data-timeline-tab-gestures]')!;
		viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: 120, bubbles: true, cancelable: true }));
		await settle();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		props.active = true;
		await settle();
		viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: 120, bubbles: true, cancelable: true }));
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/timeline', expect.anything());
	});

	it('keeps the external timeline mounted while its sound and punch activity follow visibility', async () => {
		prefer.r['external.enabled'].value = true;
		prefer.r['external.token'].value = 'token';
		prefer.r['external.host'].value = 'remote.example';
		prefer.r['external.enableOHTL'].value = true;
		mocks.storage.set('hataskeyUi3Tab', 'ohtl');
		const props = reactive({ active: true });
		const host = await mount(false, undefined, props);
		const external = host.querySelector('[data-external-timeline]')!;
		expect(external.getAttribute('data-sound')).toBe('true');
		props.active = false;
		await settle();
		expect(host.querySelector('[data-external-timeline]')).toBe(external);
		expect(external.getAttribute('data-sound')).toBe('false');
		props.active = true;
		await settle();
		expect(external.getAttribute('data-sound')).toBe('true');
	});
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('composer to timeline arrival', () => {
	async function withComposer(compact = false, extraProps: Record<string, unknown> = {}) {
		let context: Hk3PostContext | undefined;
		const probe = { setup() { context = inject(hk3PostContextKey)!; return () => null; } };
		const host = await mount(compact, probe, extraProps);
		return { host, context: context! };
	}

	const ownNote = (id = 'posted') => ({ id, userId: 'me', user: { id: 'me', username: 'me' }, text: 'new post', files: [], visibility: 'public' }) as unknown as Misskey.entities.Note;

	it.each([false, true])('opens the retained mobile composer for focus/confirmation and posting, without changing desktop behavior (compact=%s)', async compact => {
		const target = window.document.createElement('div');
		window.document.body.append(target);
		cleanups.push(() => target.remove());
		const reveal = vi.fn();
		const { context } = await withComposer(compact, { mobileComposerTarget: target, onRevealComposer: reveal });
		context.reveal?.();
		const receipt = context.begin();
		expect(reveal).toHaveBeenCalledTimes(compact ? 2 : 0);
		receipt.cancel();
	});

	it.each([false, true])('deduplicates a stream echo before the API result and animates once (compact=%s)', async compact => {
		const { host, context } = await withComposer(compact);
		const receipt = context.begin();
		const note = ownNote();
		mocks.note?.(note);
		await settle();
		expect(host.querySelector('[data-rendered-note="posted"]')).toBeNull();
		const source = new DOMRect(10, compact ? 50 : 600, 320, 90);
		receipt.complete(note, source);
		await settle();
		mocks.note?.(note);
		receipt.complete(note, source);
		await settle();
		expect(host.querySelectorAll('[data-rendered-note="posted"]')).toHaveLength(1);
		expect(mocks.entrance).toHaveBeenCalledTimes(1);
		expect(mocks.entrance).toHaveBeenCalledWith(expect.objectContaining({ source, motion: false }));
		expect(mocks.sound).toHaveBeenCalledTimes(1);
	});

	it('counts a pending own stream echo once and carries its ad onto the API result', async () => {
		const { host, context } = await withComposer();
		mocks.note?.({ id: 'other', userId: 'other', user: { id: 'other' }, text: 'hello' });
		const receipt = context.begin();
		const posted = ownNote();
		mocks.note?.(posted);
		mocks.note?.(posted);
		receipt.complete(posted, null);
		await settle();
		mocks.note?.(posted);
		expect(host.querySelector('[data-rendered-note="posted"]')?.nextElementSibling?.hasAttribute('data-timeline-ad')).toBe(true);
		mocks.note?.({ id: 'third', userId: 'other', user: { id: 'other' }, text: 'hello' });
		mocks.note?.({ id: 'fourth', userId: 'other', user: { id: 'other' }, text: 'hello' });
		await settle();
		host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!.click();
		await settle();
		expect(host.querySelector('[data-rendered-note="third"]')?.nextElementSibling?.hasAttribute('data-timeline-ad')).toBe(false);
		expect(host.querySelector('[data-rendered-note="fourth"]')?.nextElementSibling?.hasAttribute('data-timeline-ad')).toBe(true);
	});

	it('counts successful own posts even when no stream echo arrives', async () => {
		const { host, context } = await withComposer();
		context.begin().complete(ownNote('first'), null);
		await settle();
		context.begin().complete(ownNote('second'), null);
		await settle();
		const first = host.querySelector('[data-rendered-note="first"]');
		expect(first).not.toBeNull();
		expect(first?.nextElementSibling?.hasAttribute('data-timeline-ad') ?? false).toBe(false);
		expect(host.querySelector('[data-rendered-note="second"]')?.nextElementSibling?.hasAttribute('data-timeline-ad')).toBe(true);
		mocks.note?.(ownNote('second'));
		mocks.note?.({ id: 'third', userId: 'other', user: { id: 'other' }, text: 'hello' });
		await settle();
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('1 new notes');
	});

	it('releases buffered stream notes on failure without a success animation', async () => {
		mocks.live = true;
		const { host, context } = await withComposer();
		const receipt = context.begin();
		mocks.note?.(ownNote('another-device'));
		receipt.cancel();
		await settle();
		expect(host.querySelector('[data-rendered-note="another-device"]')).not.toBeNull();
		expect(mocks.entrance).not.toHaveBeenCalled();
	});

	it('does not inject the result into another timeline after navigation', async () => {
		prefer.r['simpleUi.topNav'].value = ['following', 'local'].map(id => ({ id, label: id, icon: '', visible: true }));
		const { host, context } = await withComposer();
		const receipt = context.begin();
		mocks.note?.(ownNote());
		navButton(host, 'Home').click();
		await settle();
		receipt.complete(ownNote(), new DOMRect(0, 500, 320, 90));
		await settle();
		expect(host.querySelector('[data-rendered-note="posted"]')).toBeNull();
		expect(mocks.entrance).not.toHaveBeenCalled();
	});

	it('does not add a followers-only post to the local timeline', async () => {
		const { host, context } = await withComposer();
		const receipt = context.begin();
		receipt.complete({ ...ownNote(), visibility: 'followers' }, new DOMRect(0, 500, 320, 90));
		await settle();
		expect(host.querySelector('[data-rendered-note="posted"]')).toBeNull();
		expect(mocks.entrance).not.toHaveBeenCalled();
	});

	it('keeps a server-confirmed collection echo without forcing an unrelated arrival', async () => {
		mocks.live = true;
		mocks.lists.mockResolvedValue([{ id: 'saved', name: 'My list' }]);
		const { host, context } = await withComposer();
		navButton(host, 'Lists').click();
		await settle();
		const receipt = context.begin();
		const note = ownNote();
		mocks.note?.(note);
		receipt.complete(note, new DOMRect(0, 500, 320, 90));
		await settle();
		expect(host.querySelectorAll('[data-rendered-note="posted"]')).toHaveLength(1);
		expect(mocks.entrance).not.toHaveBeenCalled();
		expect(mocks.sound).toHaveBeenCalledTimes(1);
	});

	it('stops the in-flight animation when its timeline is unmounted', async () => {
		const { context } = await withComposer();
		context.begin().complete(ownNote(), new DOMRect(0, 500, 320, 90));
		await settle();
		cleanups.splice(0).forEach(fn => fn());
		expect(mocks.stopEntrance).toHaveBeenCalledTimes(1);
	});

	it('cancels an entrance and queues a post completed while hidden without another sound', async () => {
		const props = reactive({ active: true });
		const { host, context } = await withComposer(false, props);
		context.begin().complete(ownNote('visible-post'), new DOMRect(0, 500, 320, 90));
		await settle();
		expect(mocks.entrance).toHaveBeenCalledTimes(1);
		expect(mocks.sound).toHaveBeenCalledTimes(1);
		props.active = false;
		await settle();
		expect(mocks.stopEntrance).toHaveBeenCalledTimes(1);
		context.begin().complete(ownNote('hidden-post'), new DOMRect(0, 500, 320, 90));
		await settle();
		expect(mocks.sound).toHaveBeenCalledTimes(1);
		expect(mocks.entrance).toHaveBeenCalledTimes(1);
		expect(host.querySelector('[data-rendered-note="hidden-post"]')).toBeNull();
		props.active = true;
		await settle();
		host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!.click();
		await settle();
		expect(host.querySelector('[data-rendered-note="hidden-post"]')).not.toBeNull();
		expect(mocks.entrance).toHaveBeenCalledTimes(1);
	});
});

describe('UI S shared RSS banner', () => {
	it('shows the header glow only at the measured scroll top and restores it on return', async () => {
		const host = await mount();
		const header = host.querySelector('header')!;
		const viewport = host.querySelector<HTMLElement>('[data-timeline-tab-gestures]')!;
		expect(header.hasAttribute('data-at-top')).toBe(true);
		viewport.scrollTop = 2;
		viewport.dispatchEvent(new Event('scroll'));
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(true);
		viewport.scrollTop = 3;
		viewport.dispatchEvent(new Event('scroll'));
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
		viewport.scrollTop = -4;
		viewport.dispatchEvent(new Event('scroll'));
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(true);
	});

	it('gates the glow for hidden, confirming and collapsing timelines and empty desktop headers', async () => {
		const props = reactive({ active: true, confirmationActive: false });
		const host = await mount(false, undefined, props);
		const header = host.querySelector('header')!;
		const viewport = host.querySelector<HTMLElement>('[data-timeline-tab-gestures]')!;
		expect(header.hasAttribute('data-at-top')).toBe(true);
		props.active = false;
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
		viewport.scrollTop = 30;
		props.active = true;
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
		viewport.scrollTop = 0;
		viewport.dispatchEvent(new Event('scroll'));
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(true);
		props.confirmationActive = true;
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
		props.confirmationActive = false;
		host.setAttribute('data-hata-timeline-collapse-active', 'true');
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
		host.removeAttribute('data-hata-timeline-collapse-active');
		prefer.r.hataskeyUi3RssEnabled.value = false;
		await settle();
		expect(header.hasAttribute('data-at-top')).toBe(false);
	});

	it('keeps the reader mounted through a notice, queued notes, and their dismissal', async () => {
		const host = await mount();
		const reader = host.querySelector('[data-rss-reader]');
		expect(reader?.getAttribute('data-interrupted')).toBe('false');
		mocks.note?.({ id: 'new-note', user: { id: 'other' }, text: 'hello' });
		hk3Toasts.value = [{ id: 'notice', icon: 'star', text: 'Saved' }];
		await settle();
		expect(host.querySelector('[data-kind="toast"]')?.textContent).toContain('Saved');
		expect(reader?.getAttribute('data-interrupted')).toBe('true');
		hk3Toasts.value = [];
		await settle();
		const queued = host.querySelector<HTMLButtonElement>('[data-kind="queue"]');
		expect(queued).not.toBeNull();
		queued?.click();
		await settle();
		expect(reader?.getAttribute('data-interrupted')).toBe('false');
		expect(host.querySelector('[data-rss-reader]')).toBe(reader);
		expect(mocks.rssMounts).toBe(1);
	});
	it('pauses RSS for timeline collapse and exposes settings even when RSS is disabled', async () => {
		const host = await mount();
		host.setAttribute('data-hata-timeline-collapse-active', 'true');
		await settle();
		expect(host.querySelector('[data-rss-reader]')?.getAttribute('data-paused')).toBe('true');
		host.removeAttribute('data-hata-timeline-collapse-active');
		await settle();
		expect(host.querySelector('[data-rss-reader]')?.getAttribute('data-paused')).toBe('false');
		prefer.r.hataskeyUi3RssEnabled.value = false;
		await settle();
		expect(host.querySelector('[data-rss-reader]')).toBeNull();
		host.querySelector<HTMLButtonElement>('[aria-label="Options"]')?.click();
		await settle();
		host.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
		expect(mocks.navigate).toHaveBeenCalledWith('/settings/preferences?destination=hataskey-ui-s#hataskey-ui-s-rss-heading');
	});
});

describe('UI S mobile capsule navbar', () => {
	function choices(host: Element) {
		return [...host.querySelectorAll<HTMLButtonElement>('[data-mobile-choice]')];
	}

	function choice(host: Element, id: string) {
		return host.querySelector<HTMLButtonElement>(`[data-mobile-choice="${id}"]`)!;
	}

	it('provides an always mounted header host and disables it during mobile interruptions', async () => {
		let emojiHost: Hk3ComposerEmojiHost | undefined;
		const props = reactive({ active: true, confirmationActive: false, mobileMenuOpen: false });
		const host = await mount(true, { setup: () => { emojiHost = inject(hk3ComposerEmojiHostKey); return () => h('div'); } }, props);
		const target = host.querySelector<HTMLElement>('[data-hk3-composer-emoji-host]');
		expect(emojiHost?.target.value).toBe(target);
		expect(emojiHost?.enabled.value).toBe(true);
		emojiHost!.open.value = true;
		await settle();
		expect(target?.dataset.open).toBe('true');
		navButton(host, 'Options').click(); await settle();
		expect(emojiHost?.enabled.value).toBe(false);
		expect(target?.dataset.open).toBeUndefined();
		navButton(host, 'Options').click(); await settle();
		props.mobileMenuOpen = true; await settle();
		expect(emojiHost?.enabled.value).toBe(false);
		expect(host.querySelector('[data-hk3-composer-emoji-host]')).toBe(target);
		props.mobileMenuOpen = false;
		props.confirmationActive = true; await settle();
		expect(emojiHost?.enabled.value).toBe(false);
	});

	it('reverses the lower Home menu order while preserving its order and availability after updates', async () => {
		prefer.r['simpleUi.topNav'].value = [
			{ id: 'mixed', icon: 'ti ti-moon', label: 'Global', visible: true },
			{ id: 'social', icon: 'ti ti-star', label: 'Social', visible: true },
			{ id: 'local', icon: 'ti ti-sun', label: 'Local', visible: true },
			{ id: 'following', icon: 'ti ti-home', label: 'Home', visible: false },
		];
		mocks.blockedTabs.add('social');
		const host = await mount(true);
		const ids = () => choices(host).map(button => button.dataset.mobileChoice);
		const lowerIds = () => timelineVm!.mobileNavigation.choices.map(item => item.id);
		expect(ids()).toEqual(lowerIds().reverse());
		expect(ids()).not.toContain('social');
		expect(ids()).not.toContain('following');
		expect(choice(host, 'mixed').querySelector('.ti-moon')).not.toBeNull();
		expect(choice(host, 'local').querySelector('.ti-sun')).not.toBeNull();
		const reordered = lowerIds().reverse();
		timelineVm!.mobileNavigation.reorder(reordered);
		await settle();
		expect(lowerIds()).toEqual(reordered);
		expect(ids()).toEqual([...reordered].reverse());
		prefer.r['simpleUi.topNav'].value = [{ id: 'local', icon: 'ti ti-sun', label: 'Local', visible: true }];
		await settle();
		expect(ids()).toEqual(lowerIds().reverse());
		expect(ids()).not.toContain('mixed');
	});

	it('reveals an offscreen selected label within the capsule after dock selection and reorder', async () => {
		prefer.r['simpleUi.topNav'].value = ['following', 'local'].map(id => ({ id, icon: '', label: id, visible: true }));
		const host = await mount(true);
		const capsule = host.querySelector<HTMLElement>('[data-mobile-capsule]')!;
		const home = choice(host, 'following');
		vi.spyOn(capsule, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 44));
		vi.spyOn(home, 'getBoundingClientRect').mockReturnValue(new DOMRect(180, 0, 80, 40));
		timelineVm!.mobileNavigation.select('following'); await settle();
		expect(capsule.scrollLeft).toBe(160);
		capsule.scrollLeft = 0;
		timelineVm!.mobileNavigation.reorder([...timelineVm!.mobileNavigation.choices.map(item => item.id)].reverse());
		await settle();
		expect(capsule.scrollLeft).toBe(160);
	});

	it('selects tabs, scrolls to top on a repeated tap, and keeps RSS and notices below the capsule', async () => {
		prefer.r['simpleUi.topNav'].value = ['following', 'local'].map(id => ({ id, icon: '', label: id, visible: true }));
		const host = await mount(true);
		const capsule = host.querySelector('[data-mobile-capsule]')!;
		const reader = host.querySelector('[data-rss-reader]')!;
		expect(capsule.compareDocumentPosition(reader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const home = choice(host, 'following');
		expect(home.getAttribute('aria-label')).toBe('Home');
		home.click(); await settle();
		expect(home.dataset.active).toBe('true');
		expect(home.querySelector('span')?.textContent).toBe('Home');
		expect(mocks.storage.get('hataskeyUi3Tab')).toBe('following');
		const requests = mocks.api.mock.calls.length;
		home.click(); await settle();
		expect(mocks.api.mock.calls).toHaveLength(requests);
		hk3Toasts.value = [{ id: 'notice', icon: 'star', text: 'Saved' }];
		await settle();
		expect(host.querySelector('[data-kind="toast"]')).not.toBeNull();
		expect(host.querySelector('[data-rss-reader]')).toBe(reader);
	});

	it('includes trending and linked external timelines only when available', async () => {
		prefer.r['simpleUi.showTrendingTab'].value = true;
		prefer.r['external.enabled'].value = true;
		prefer.r['external.token'].value = 'token';
		prefer.r['external.enableOHTL'].value = true;
		prefer.r['external.enableOLTL'].value = true;
		const host = await mount(true);
		for (const id of ['trending', 'ohtl', 'oltl']) expect(choice(host, id)).not.toBeNull();
		choice(host, 'oltl').click(); await settle();
		expect(choice(host, 'oltl').dataset.active).toBe('true');
		prefer.r['external.token'].value = null;
		await settle();
		expect(choices(host).some(button => button.dataset.mobileChoice === 'oltl')).toBe(false);
	});

	it('shows Hatady after Trending without opening a note stream, and routes refresh to the Hatady timeline', async () => {
		prefer.r['simpleUi.showTrendingTab'].value = true;
		prefer.r['simpleUi.showHatadyTab'].value = true;
		const host = await mount(true);
		const ids = choices(host).map(button => button.dataset.mobileChoice);
		expect(ids.indexOf('hatady')).toBe(ids.indexOf('trending') + 1);
		const streams = mocks.channel.mock.calls.length;
		choice(host, 'hatady').click(); await settle();
		expect(host.querySelector('[data-hatady-timeline="uis"]')).not.toBeNull();
		expect(mocks.channel.mock.calls).toHaveLength(streams);
		expect(mocks.hatadyReload).toHaveBeenCalled();
		await timelineVm?.reload();
		expect(mocks.hatadyReload).toHaveBeenCalledTimes(2);
	});

	it('restores a saved Hatady tab on startup without requesting a note timeline', async () => {
		prefer.r['simpleUi.showHatadyTab'].value = true;
		mocks.storage.set('hataskeyUi3Tab', 'hatady');
		const host = await mount(true);
		expect(choice(host, 'hatady').dataset.active).toBe('true');
		expect(host.querySelector('[data-hatady-timeline="uis"]')).not.toBeNull();
		expect(mocks.channel).not.toHaveBeenCalled();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	it('opens collections and channel, and retains collection switch and settings controls', async () => {
		mocks.lists.mockResolvedValue([{ id: 'saved', name: 'My list' }]);
		const host = await mount(true);
		choice(host, 'list').click(); await settle();
		expect(choice(host, 'list').getAttribute('aria-label')).toBe('Lists · My list');
		expect(choice(host, 'list').querySelector('span')?.textContent).toBe('Lists · My list');
		navButton(host, 'Switch list').click(); await settle();
		expect(host.querySelector('[data-collection-picker="list"]')).not.toBeNull();
		navButton(host, 'Configure list').click();
		expect(mocks.navigate).toHaveBeenLastCalledWith('/my/lists/saved');
		choice(host, 'channel').click();
		expect(mocks.navigate).toHaveBeenLastCalledWith('/channels');
	});

	it('keeps all filters, LIVE and RSS settings reachable from compact options', async () => {
		const host = await mount(true);
		navButton(host, 'Options').click(); await settle();
		const menu = host.querySelector('[role="menu"]')!;
		expect([...menu.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Renotes', 'Files', 'Sensitive', 'LIVE', 'RSS settings']);
		expect(menu.querySelectorAll('[role="menuitemcheckbox"]')).toHaveLength(4);
		const rss = [...menu.querySelectorAll('button')].find(button => button.textContent === 'RSS settings')!;
		rss.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
		expect(menu.isConnected).toBe(true);
		rss.dispatchEvent(new MouseEvent('click', { bubbles: true })); await settle();
		expect(mocks.navigate).toHaveBeenLastCalledWith('/settings/preferences?destination=hataskey-ui-s#hataskey-ui-s-rss-heading');
		expect(menu.isConnected).toBe(false);
	});

	it('gates tabs while inactive, confirming or showing the mobile menu and omits capsule on desktop', async () => {
		prefer.r['simpleUi.topNav'].value = ['following', 'local'].map(id => ({ id, icon: '', label: id, visible: true }));
		const props = reactive({ active: true, confirmationActive: false, mobileMenuOpen: false });
		const host = await mount(true, undefined, props);
		for (const key of ['active', 'confirmationActive', 'mobileMenuOpen'] as const) {
			if (key === 'active') props.active = false; else props[key] = true;
			await settle();
			expect(choice(host, 'following').disabled).toBe(true);
			choice(host, 'following').click(); await settle();
			expect(choice(host, 'local').dataset.active).toBe('true');
			if (key === 'active') props.active = true; else props[key] = false;
		}
		const desktop = await mount();
		expect(desktop.querySelector('[data-mobile-navbar]')).toBeNull();
		expect(desktop.querySelector('[data-hk3-composer-emoji-host]')).toBeNull();
	});
});

describe('UI S audience icon tab gating', () => {
	it.each([false, true])('passes the audience flag only for home/social through tab switches (compact=%s)', async compact => {
		mocks.storage.set('hataskeyUi3Tab', 'following');
		prefer.r['simpleUi.topNav'].value = ['following', 'social', 'local', 'mixed'].map(id => ({ id, icon: '', label: id, visible: true }));
		prefer.r['simpleUi.showTrendingTab'].value = true;
		prefer.r['external.enabled'].value = true;
		prefer.r['external.token'].value = 'test-token';
		prefer.r['external.host'].value = 'external.example';
		prefer.r['external.enableOHTL'].value = true;
		prefer.r['external.enableOLTL'].value = true;
		mocks.lists.mockResolvedValue([{ id: 'list', name: 'My list' }]);
		mocks.antennas.mockResolvedValue([{ id: 'antenna', name: 'My antenna' }]);
		mocks.api.mockResolvedValue([{ id: 'same-note', userId: 'other', user: { id: 'other' }, text: 'body' }]);
		const host = await mount(compact);
		const assertAudience = (enabled: boolean, localOnly = false, tab = '') => {
			const rendered = host.querySelector('[data-rendered-note="same-note"]');
			expect(rendered).not.toBeNull();
			expect(rendered?.getAttribute('data-audience-enabled')).toBe(String(enabled));
			expect(rendered?.getAttribute('data-local-only-enabled')).toBe(String(localOnly));
			expect(rendered?.getAttribute('data-note-size')).toBe(compact ? 'sm' : 'lg');
			expect(rendered?.getAttribute('data-utage-local')).toBe(String(tab === 'local'));
			expect(rendered?.getAttribute('data-utage-social')).toBe(String(tab === 'social'));
		};
		assertAudience(true, false, 'following');
		for (const [label, enabled] of [
			['Social', true], ['Local', false], ['Global', false], ['Trending', false],
			['Lists', false], ['Antennas', false], ['Home', true],
		] as const) {
			navButton(host, label).click();
			await settle();
			assertAudience(enabled, label === 'Local' || label === 'Global', label.toLowerCase());
		}
		for (const [label, src] of [['External home', 'ohtl'], ['External local', 'oltl']] as const) {
			navButton(host, label).click();
			await settle();
			expect(host.querySelector(`[data-external-timeline="${src}"]`)).not.toBeNull();
			expect(host.querySelector('[data-rendered-note]')).toBeNull();
		}
		navButton(host, 'Social').click();
		await settle();
		assertAudience(true, false, 'social');
	});

	it.each(['following', 'social', 'local', 'mixed', 'trending', 'list', 'antenna'])('applies gating on a restored %s tab', async tab => {
		prefer.r['simpleUi.topNav'].value = ['following', 'social', 'local', 'mixed'].map(id => ({ id, icon: '', label: id, visible: true }));
		prefer.r['simpleUi.showTrendingTab'].value = true;
		mocks.storage.set('hataskeyUi3Tab', tab);
		mocks.lists.mockResolvedValue([{ id: 'list', name: 'My list' }]);
		mocks.antennas.mockResolvedValue([{ id: 'antenna', name: 'My antenna' }]);
		mocks.api.mockResolvedValue([{ id: 'restored-note', userId: 'other', user: { id: 'other' }, text: 'body' }]);
		const host = await mount();
		expect(host.querySelector('[data-rendered-note="restored-note"]')?.getAttribute('data-audience-enabled')).toBe(String(tab === 'following' || tab === 'social'));
		expect(host.querySelector('[data-rendered-note="restored-note"]')?.getAttribute('data-local-only-enabled')).toBe(String(tab === 'local' || tab === 'mixed'));
		expect(host.querySelector('[data-rendered-note="restored-note"]')?.getAttribute('data-utage-local')).toBe(String(tab === 'local'));
		expect(host.querySelector('[data-rendered-note="restored-note"]')?.getAttribute('data-utage-social')).toBe(String(tab === 'social'));
	});
});

describe('UI S new notes shared content', () => {
	it('passes the newest three queued notes, counts and real decorations and releases that queue', async () => {
		const host = await mount();
		for (let n = 1; n <= 4; n++) mocks.note?.({ id: `new-${n}`, userId: `user-${n}`, user: { id: `user-${n}`, avatarDecorations: [{ id: 'deco', url: 'https://example.com/deco.png' }] }, text: 'hello' });
		await settle();
		const banner = host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!;
		expect(banner.getAttribute('aria-label')).toBe('4 new notes');
		expect(banner.querySelector('[data-new-notes-part="count"]')?.textContent).toBe('4');
		expect([...banner.querySelectorAll('[data-new-notes-face]')].map(el => el.getAttribute('data-new-notes-face'))).toEqual(['new-4', 'new-3', 'new-2']);
		expect(banner.querySelector('[data-avatar-user="user-4"]')?.getAttribute('data-avatar-decorations')).toContain('deco.png');
		expect(banner.querySelector('[data-avatar-user]')?.getAttribute('data-avatar-link')).toBe('false');
		expect(banner.querySelector('[data-avatar-user]')?.getAttribute('data-avatar-preview')).toBe('false');
		banner.click();
		await settle();
		expect(host.querySelector('[data-kind="queue"]')).toBeNull();
		expect(host.querySelectorAll('[data-rendered-note]')).toHaveLength(4);
	});

	it('keeps external custom text, author, emoji dictionary and avatar metadata', async () => {
		prefer.r['external.enabled'].value = true;
		prefer.r['external.token'].value = 'token';
		prefer.r['external.host'].value = 'external.example';
		prefer.r['external.enableOHTL'].value = true;
		const host = await mount();
		navButton(host, 'External home').click();
		await settle();
		const show = vi.fn(() => { mocks.externalNotice.value = null; });
		mocks.externalNotice.value = {
			text: ':wave: new notes', icon: 'ti ti-arrow-up', show,
			avatars: [{ id: 'external-note', url: 'https://external.example/avatar.png', user: { id: 'external-user', host: 'external.example', avatarDecorations: [{ id: 'external-deco', url: 'https://external.example/deco.png' }] } }],
			author: { id: 'external-user', host: 'external.example' }, emojiUrls: { wave: 'https://external.example/wave.png' },
		};
		await settle();
		const banner = host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!;
		expect(banner.getAttribute('aria-label')).toBe(':wave: new notes');
		expect(banner.querySelector('[data-new-notes-part="count"]')).toBeNull();
		expect(banner.querySelector('[data-mfm-author]')?.getAttribute('data-mfm-author')).toBe('external.example');
		expect(banner.querySelector('[data-mfm-emojis]')?.getAttribute('data-mfm-emojis')).toContain('wave.png');
		expect(banner.querySelector('[data-avatar-user="external-user"]')?.getAttribute('data-avatar-decorations')).toContain('external-deco');
		banner.click();
		await settle();
		expect(show).toHaveBeenCalledOnce();
		expect(host.querySelector('[data-kind="queue"]')).toBeNull();
	});
});

describe('UI S navbar pull refresh', () => {
	function makeNote(id: string) { return { id, userId: 'other', user: { id: 'other' }, text: 'body' }; }

	it.each([[false, false], [false, true], [true, false], [true, true]])('keeps feedback and deferred notices stable with composer open=%s, RSS=%s', async (open, rssEnabled) => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		prefer.r.hataskeyUi3RssEnabled.value = rssEnabled;
		mocks.api.mockResolvedValue([makeNote('original')]);
		const target = window.document.createElement('div'); window.document.body.append(target);
		cleanups.push(() => target.remove());
		const props = reactive({ mobileComposerTarget: target, mobileComposerOpen: open });
		const host = await mount(true, undefined, props);
		const rss = host.querySelector('[data-rss-reader]');
		const note = host.querySelector('[data-rendered-note]')!;
		note.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true }));
		props.mobileComposerOpen = !open; await settle();
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180, cancelable: true })); await settle();
		expect(timelineVm!.mobilePullState).toMatchObject({ phase: 'ready', presentation: open ? 'dock' : 'navbar' });
		expect(host.querySelector('[data-pulling]') != null).toBe(!open);
		if (rssEnabled) expect(rss?.getAttribute('data-paused')).toBe('true');
		let finish!: (notes: unknown[]) => void;
		mocks.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		window.dispatchEvent(new MouseEvent('mouseup')); await settle();
		await vi.advanceTimersByTimeAsync(250);
		expect(timelineVm!.mobilePullState).toMatchObject({ phase: 'refreshing', height: 56 });
		hk3Toasts.value = [{ id: 'hourly-during-pull', icon: 'clock', text: 'Hourly notice' }];
		mocks.note?.(makeNote('during-refresh')); await settle();
		if (!open) expect(host.querySelector('[data-kind="toast"]')).toBeNull();
		expect(setHk3ToastsPaused).toHaveBeenLastCalledWith(expect.any(Symbol), true);
		finish([makeNote('original')]); await settle();
		expect(timelineVm!.mobilePullState.phase).toBe('success');
		await vi.advanceTimersByTimeAsync(1000); await settle();
		expect(timelineVm!.mobilePullState.phase).toBe('idle');
		expect(setHk3ToastsPaused).toHaveBeenLastCalledWith(expect.any(Symbol), false);
		expect(host.querySelector('[data-rss-reader]')).toBe(rss);
		if (rssEnabled) expect(rss?.getAttribute('data-paused')).toBe('false');
		expect(host.textContent).toContain('Hourly notice');
		hk3Toasts.value = []; await settle();
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('1 new notes');
	});

	it('does not begin a pull while the composer emoji picker is open', async () => {
		vi.useFakeTimers(); prefer.r.enablePullToRefresh.value = true;
		mocks.api.mockResolvedValue([makeNote('original')]);
		let emojiHost: Hk3ComposerEmojiHost | undefined;
		const host = await mount(true, { setup: () => { emojiHost = inject(hk3ComposerEmojiHostKey); return () => h('div'); } });
		emojiHost!.open.value = true; await settle();
		host.querySelector('[data-rendered-note]')!.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180 }));
		window.dispatchEvent(new MouseEvent('mouseup')); await vi.advanceTimersByTimeAsync(1000); await settle();
		expect(mocks.api).toHaveBeenCalledOnce();
		expect(timelineVm!.mobilePullState.phase).toBe('idle');
		expect(host.querySelector('[data-pulling]')).toBeNull();
	});

	it('reloads the external timeline through its exposed method on an upward dock pull', async () => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		prefer.r['external.enabled'].value = true;
		prefer.r['external.token'].value = 'test-token';
		prefer.r['external.host'].value = 'external.example';
		prefer.r['external.enableOHTL'].value = true;
		mocks.storage.set('hataskeyUi3Tab', 'ohtl');
		const target = window.document.createElement('div');
		const dock = window.document.createElement('nav');
		window.document.body.append(target, dock);
		cleanups.push(() => { target.remove(); dock.remove(); });
		const host = await mount(true, undefined, { mobileComposerTarget: target });
		expect(host.querySelector('[data-external-timeline="ohtl"]')).not.toBeNull();
		const gesture = timelineVm!.attachMobilePullGesture(dock, vi.fn(), () => true);
		cleanups.push(() => gesture.dispose());
		dock.dispatchEvent(new MouseEvent('mousedown', { button: 0, screenY: 600, bubbles: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 420, cancelable: true }));
		await settle();
		expect(timelineVm!.mobilePullState.phase).toBe('ready');
		window.dispatchEvent(new MouseEvent('mouseup'));
		await settle();
		expect(mocks.externalReload).toHaveBeenCalledOnce();
		expect(mocks.api).not.toHaveBeenCalled();
	});

	it('routes upward dock feedback through the shared refresh owner while leaving top banners intact', async () => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		const target = window.document.createElement('div');
		window.document.body.append(target);
		cleanups.push(() => target.remove());
		const props = reactive({ mobileComposerTarget: target, mobileMenuOpen: false });
		const host = await mount(true, undefined, props);
		const rss = host.querySelector('[data-rss-reader]');
		const dock = window.document.createElement('nav');
		window.document.body.append(dock);
		const gesture = timelineVm!.attachMobilePullGesture(dock, vi.fn(), () => true);
		cleanups.push(() => { gesture.dispose(); dock.remove(); });
		dock.dispatchEvent(new MouseEvent('mousedown', { button: 0, screenY: 600, bubbles: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 420, cancelable: true }));
		await settle();
		expect(timelineVm!.mobilePullState).toMatchObject({ phase: 'ready', direction: 'up' });
		expect(host.querySelector('[data-pulling]')).toBeNull();
		expect(rss?.getAttribute('data-paused')).toBe('true');
		props.mobileMenuOpen = true;
		await settle();
		window.dispatchEvent(new MouseEvent('mouseup'));
		await vi.advanceTimersByTimeAsync(250);
		expect(timelineVm!.mobilePullState.phase).toBe('idle');
		expect(mocks.api).toHaveBeenCalledOnce();
		expect(mocks.externalReload).not.toHaveBeenCalled();
		expect(host.querySelector('[data-rss-reader]')).toBe(rss);
		expect(rss?.getAttribute('data-paused')).toBe('false');
	});

	it('pauses RSS without remounting it and retains notes received during the refresh request', async () => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		const original = { id: 'original', userId: 'other', user: { id: 'other' }, text: 'body' };
		mocks.api.mockResolvedValue([original]);
		const host = await mount(true);
		const initialRssMounts = mocks.rssMounts;
		const note = host.querySelector('[data-rendered-note]')!;
		note.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180, cancelable: true }));
		await settle();
		expect(host.querySelector('[data-pulling]')).not.toBeNull();
		expect(host.querySelector('[data-rss-reader]')?.getAttribute('data-paused')).toBe('true');
		let finish!: (notes: unknown[]) => void;
		mocks.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		await settle();
		mocks.note?.({ id: 'during-refresh', userId: 'other', user: { id: 'other' }, text: 'new' });
		finish([original]);
		await settle();
		await vi.advanceTimersByTimeAsync(250);
		await settle();
		expect(mocks.rssMounts).toBe(initialRssMounts);
		expect(host.querySelector('[data-rss-reader]')?.getAttribute('data-paused')).toBe('false');
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('1 new notes');
		expect(host.querySelector('[data-rendered-note="original"]')).not.toBeNull();
	});

	it('retains displayed notes and old and incoming queues when pull refresh fails', async () => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		mocks.api.mockResolvedValue([makeNote('original')]);
		const host = await mount(true);
		mocks.note?.(makeNote('old-only'));
		mocks.note?.(makeNote('shared'));
		await settle();
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('2 new notes');
		let fail!: (error: Error) => void;
		mocks.api.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
		host.querySelector('[data-rendered-note]')!.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		await settle();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(host.querySelector('[data-rendered-note="original"]')).not.toBeNull();
		mocks.note?.(makeNote('shared'));
		mocks.note?.(makeNote('during-refresh'));
		fail(new Error('offline'));
		await settle();
		await vi.advanceTimersByTimeAsync(250);
		await settle();
		expect([...host.querySelectorAll('[data-rendered-note]')].map(el => el.getAttribute('data-rendered-note'))).toEqual(['original']);
		const banner = host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!;
		expect(banner.getAttribute('aria-label')).toBe('3 new notes');
		expect([...banner.querySelectorAll('[data-new-notes-face]')].map(el => el.getAttribute('data-new-notes-face'))).toEqual(['during-refresh', 'shared', 'old-only']);
		banner.click();
		await settle();
		expect([...host.querySelectorAll('[data-rendered-note]')].map(el => el.getAttribute('data-rendered-note'))).toEqual(['during-refresh', 'shared', 'old-only', 'original']);
	});

	it('retains old and incoming queues outside the fetched page and removes fetched and shared duplicates', async () => {
		vi.useFakeTimers();
		prefer.r.enablePullToRefresh.value = true;
		mocks.api.mockResolvedValue([makeNote('original')]);
		const host = await mount(true);
		mocks.note?.(makeNote('old-only'));
		mocks.note?.(makeNote('old-fetched'));
		mocks.note?.(makeNote('shared'));
		await settle();
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('3 new notes');
		let finish!: (notes: unknown[]) => void;
		mocks.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		host.querySelector('[data-rendered-note]')!.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/local-timeline', expect.objectContaining({ limit: 20 }));
		mocks.note?.(makeNote('shared'));
		mocks.note?.(makeNote('incoming-fetched'));
		mocks.note?.(makeNote('during-refresh'));
		const fetched = [makeNote('old-fetched'), makeNote('incoming-fetched'), ...Array.from({ length: 18 }, (_, i) => makeNote(`fetched-${i}`))];
		finish(fetched);
		await settle();
		await vi.advanceTimersByTimeAsync(250);
		await settle();
		expect([...host.querySelectorAll('[data-rendered-note]')].map(el => el.getAttribute('data-rendered-note'))).toEqual(fetched.map(note => note.id));
		const banner = host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!;
		expect(banner.getAttribute('aria-label')).toBe('3 new notes');
		expect([...banner.querySelectorAll('[data-new-notes-face]')].map(el => el.getAttribute('data-new-notes-face'))).toEqual(['during-refresh', 'shared', 'old-only']);
		banner.click();
		await settle();
		expect([...host.querySelectorAll('[data-rendered-note]')].map(el => el.getAttribute('data-rendered-note'))).toEqual(['during-refresh', 'shared', 'old-only', ...fetched.map(note => note.id)]);
	});
});

describe('UI S timeline tab gestures', () => {
	function sendTouch(target: Element, type: string, x: number, end = false) {
		const event = new Event(type, { bubbles: true, cancelable: true });
		const point = { clientX: x, clientY: 0, identifier: 1 };
		Object.assign(event, { touches: end ? [] : [point], changedTouches: [point] });
		target.dispatchEvent(event);
	}

	it('moves adjacent tabs with touch and keeps one trackpad gesture to one tab at compact width', async () => {
		vi.useFakeTimers();
		prefer.r['simpleUi.topNav'].value = ['following', 'local', 'social'].map(id => ({ id, label: id, icon: '', visible: true }));
		const host = await mount(true);
		const surface = host.querySelector('[data-timeline-tab-gestures]')!;
		sendTouch(surface, 'touchstart', 100); sendTouch(surface, 'touchend', 0, true);
		await settle();
		expect(mocks.storage.get('hataskeyUi3Tab')).toBe('social');
		vi.advanceTimersByTime(451);
		surface.dispatchEvent(new WheelEvent('wheel', { deltaX: -110, bubbles: true, cancelable: true }));
		await settle();
		expect(mocks.storage.get('hataskeyUi3Tab')).toBe('local');
		vi.advanceTimersByTime(100);
		surface.dispatchEvent(new WheelEvent('wheel', { deltaX: -110, bubbles: true, cancelable: true }));
		await settle();
		expect(mocks.storage.get('hataskeyUi3Tab')).toBe('local');
	});
	it('respects the setting and leaves RSS gestures alone', async () => {
		prefer.r['simpleUi.topNav'].value = ['following', 'local', 'social'].map(id => ({ id, label: id, icon: '', visible: true }));
		const host = await mount();
		const surface = host.querySelector('[data-timeline-tab-gestures]')!;
		tabSwipeEnabled.value = false; await settle();
		sendTouch(surface, 'touchstart', 100); sendTouch(surface, 'touchend', 0, true);
		surface.dispatchEvent(new WheelEvent('wheel', { deltaX: 110, bubbles: true, cancelable: true }));
		await settle(); expect(mocks.storage.get('hataskeyUi3Tab')).toBeUndefined();
		tabSwipeEnabled.value = true; await settle();
		const rss = host.querySelector('[data-rss-reader]')!;
		sendTouch(rss, 'touchstart', 100); sendTouch(rss, 'touchend', 0, true);
		rss.dispatchEvent(new WheelEvent('wheel', { deltaX: 110, bubbles: true, cancelable: true }));
		await settle(); expect(mocks.storage.get('hataskeyUi3Tab')).toBeUndefined();
	});
});

describe('UI S timeline ads', () => {
	const makeNote = (id: string) => ({ id, userId: 'other', user: { id: 'other' }, text: 'body' });
	const rows = (host: Element) => [...host.querySelector('[data-hata-collapse-items]')!.children].map(el => el.getAttribute('data-rendered-note') ?? (el.hasAttribute('data-timeline-ad') ? 'ad' : '?'));

	it('places page ads after the fourth and eleventh notes, retaining note-only API pagination', async () => {
		const first = Array.from({ length: 20 }, (_, i) => Object.freeze(makeNote(`first-${i}`)));
		const older = Array.from({ length: 20 }, (_, i) => Object.freeze(makeNote(`older-${i}`)));
		mocks.api.mockResolvedValueOnce(first).mockResolvedValueOnce(older);
		const host = await mount();
		expect(rows(host).slice(0, 6)).toEqual(['first-0', 'first-1', 'first-2', 'first-3', 'ad', 'first-4']);
		expect(host.querySelector('[data-timeline-ad]')?.getAttribute('data-forms')).toBe('horizontal,horizontal-big');
		mocks.intersection?.([{ isIntersecting: true }]);
		await settle();
		expect(mocks.api).toHaveBeenLastCalledWith('notes/local-timeline', expect.objectContaining({ limit: 20, untilId: 'first-19' }));
		expect(rows(host).slice(21, 34)).toEqual(['older-0', 'older-1', 'older-2', 'older-3', 'older-4', 'older-5', 'older-6', 'older-7', 'older-8', 'older-9', 'older-10', 'ad', 'older-11']);
		expect(host.querySelectorAll('[data-rendered-note]')).toHaveLength(40);
		expect(first[3]).not.toHaveProperty('_shouldInsertAd_');
		expect(older[10]).not.toHaveProperty('_shouldInsertAd_');
	});

	it('counts unique streamed notes, keeps queued markers, and restarts cadence on reload', async () => {
		mocks.api.mockResolvedValue([makeNote('base')]);
		const host = await mount();
		mocks.note?.(makeNote('new-1'));
		mocks.note?.(makeNote('new-1'));
		mocks.note?.(makeNote('new-2'));
		mocks.note?.(makeNote('new-3'));
		await settle();
		expect(host.querySelector('[data-kind="queue"]')?.getAttribute('aria-label')).toBe('3 new notes');
		host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!.click();
		await settle();
		expect(rows(host).slice(0, 5)).toEqual(['new-3', 'new-2', 'ad', 'new-1', 'base']);
		await timelineVm!.reload();
		await settle();
		mocks.note?.(makeNote('after-1'));
		mocks.note?.(makeNote('after-2'));
		await settle();
		host.querySelector<HTMLButtonElement>('[data-kind="queue"]')!.click();
		await settle();
		expect(rows(host).slice(0, 4)).toEqual(['after-2', 'ad', 'after-1', 'base']);
	});
});
