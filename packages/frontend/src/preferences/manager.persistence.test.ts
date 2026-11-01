/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';
import type { Theme } from '@/theme.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({ waiting: () => () => {}, alert: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

async function fixture() {
	let saved: PreferencesProfile | null = null;
	const io: StorageProvider = {
		load: () => saved && copy(saved),
		save: vi.fn(({ profile }) => { saved = copy(profile); }),
		cloudGetBulk: vi.fn(async () => ({})),
		cloudGet: vi.fn(async () => null),
		cloudSet: vi.fn(async () => undefined),
	};
	const boot = (account = 'a', overrides: Partial<StorageProvider> = {}) => new PreferencesManager({ ...io, ...overrides }, { id: account });
	const seed = boot();
	await seed.cloudReady;
	seed.commit('deck.profile', 'main');
	seed.commit('deck.profiles', [{ id: 'main', name: 'main', layout: [['notification']], columns: [
		{ id: 'notification', type: 'notifications', name: null, width: 300, excludeBots: false },
	] }]);
	seed.commit('widgets', [{ id: 'widget', name: 'notifications', place: 'right', data: { excludeBots: false, height: 300 } }]);
	return { io, boot, seed, get saved() { return copy(saved!); }, replace: (profile: PreferencesProfile) => { saved = copy(profile); } };
}

const excludesBots = (preferences: PreferencesManager) => preferences.s['deck.profiles'][0].columns[0].excludeBots;

describe('forward-compatible preference persistence', () => {
	test('unknown settings survive normalization, known commits, and a new manager reload', async () => {
		const f = await fixture();
		const profile = f.saved;
		const storedPreferences = profile.preferences as Record<string, unknown>;
		const unknown = [[{ server: 'example.test', account: 'a' }, { enabled: false, nested: ['future'] }, { sync: true, updatedAt: 123 }]];
		storedPreferences.futurePreference = copy(unknown);
		Reflect.deleteProperty(storedPreferences, 'animation');
		f.replace(profile);
		const preferences = f.boot();
		await preferences.cloudReady;
		expect((f.saved.preferences as Record<string, unknown>).futurePreference).toEqual(unknown);
		expect(preferences.s).not.toHaveProperty('futurePreference');
		expect(preferences.r).not.toHaveProperty('futurePreference');
		await preferences.commit('animation', !preferences.s.animation);

		const reload = f.boot();
		await reload.cloudReady;
		expect((f.saved.preferences as Record<string, unknown>).futurePreference).toEqual(unknown);
		expect(reload.s.animation).toBe(preferences.s.animation);
		expect(reload.s).not.toHaveProperty('futurePreference');
	});

	test('an old tab preserves the latest unknown settings added or changed by another version', async () => {
		const f = await fixture();
		const oldTab = f.boot();
		await oldTab.cloudReady;
		for (const value of [false, true]) {
			const profile = f.saved;
			const storedPreferences = profile.preferences as Record<string, unknown>;
			storedPreferences.futurePreference = [[{}, value, { updatedAt: 123 }]];
			f.replace(profile);
			await oldTab.commit('animation', !oldTab.s.animation);
			oldTab.reloadProfile();
			await oldTab.cloudReady;
			expect((f.saved.preferences as Record<string, unknown>).futurePreference).toEqual(storedPreferences.futurePreference);
			expect(oldTab.r).not.toHaveProperty('futurePreference');
		}
	});

	test('an old profile missing all three background preferences defaults to on and persists all off after another tab save and reload', async () => {
		const f = await fixture();
		const keys = ['hataskeyUi3TimelineBackground', 'hataskeyUi3SideMenuBackground', 'hataskeyUi3RightPaneBackground'] as const;
		const profile = f.saved;
		for (const key of keys) {
			Reflect.deleteProperty(profile.preferences, key);
			expect(profile.preferences).not.toHaveProperty(key);
		}
		f.replace(profile);
		const preferences = f.boot();
		const otherTab = f.boot();
		for (const key of keys) expect(preferences.s[key]).toBe(true);
		await Promise.all([preferences.cloudReady, otherTab.cloudReady]);
		for (const key of keys) {
			expect(preferences.s[key]).toBe(true);
			expect(f.saved.preferences).toHaveProperty(key);
			await preferences.commit(key, false);
		}
		await otherTab.commit('animation', !otherTab.s.animation);
		preferences.reloadProfile();
		await preferences.cloudReady;
		const reload = f.boot();
		await reload.cloudReady;
		for (const key of keys) {
			expect(preferences.s[key]).toBe(false);
			expect(reload.s[key]).toBe(false);
		}
	});

	test.each(['hataskeyUi3TimelineBackground', 'hataskeyUi3SideMenuBackground', 'hataskeyUi3RightPaneBackground'] as const)('%s defaults to on and persists off after reload and another tab save', async (key) => {
		const f = await fixture();
		const preferences = f.boot();
		const oldTab = f.boot();
		await Promise.all([preferences.cloudReady, oldTab.cloudReady]);
		expect(preferences.s[key]).toBe(true);
		await preferences.commit(key, false);
		await oldTab.commit('animation', !oldTab.s.animation);
		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.s[key]).toBe(false);
	});
});

describe('RSS preference persistence with real storage manager', () => {
	const rss = {
		hataskeyUi3RssEnabled: true,
		hataskeyUi3RssFeeds: [{ id: 'rss-test', url: 'https://example.test/feed.xml', name: 'Test feed', color: '#34a1c9' }],
		hataskeyUi3RssAutoSwitch: false,
		hataskeyUi3RssReadSeconds: 15 as const,
		hataskeyUi3RssReadMode: 'summary' as const,
	};

	async function saveRss(preferences: PreferencesManager) {
		await preferences.commit('hataskeyUi3RssEnabled', rss.hataskeyUi3RssEnabled);
		await preferences.commit('hataskeyUi3RssFeeds', copy(rss.hataskeyUi3RssFeeds));
		await preferences.commit('hataskeyUi3RssAutoSwitch', rss.hataskeyUi3RssAutoSwitch);
		await preferences.commit('hataskeyUi3RssReadSeconds', rss.hataskeyUi3RssReadSeconds);
		await preferences.commit('hataskeyUi3RssReadMode', rss.hataskeyUi3RssReadMode);
	}

	test('all five RSS preferences survive a new instance and auto-switch defaults to true', async () => {
		const f = await fixture();
		const preferences = f.boot();
		await preferences.cloudReady;
		expect(preferences.s.hataskeyUi3RssAutoSwitch).toBe(true);
		await saveRss(preferences);

		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.s).toMatchObject(rss);
	});

	test('an old tab saving another setting preserves all five RSS preferences', async () => {
		const f = await fixture();
		const preferences = f.boot();
		const oldTab = f.boot();
		await Promise.all([preferences.cloudReady, oldTab.cloudReady]);
		await saveRss(preferences);
		const animation = !oldTab.s.animation;
		await oldTab.commit('animation', animation);

		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.s).toMatchObject(rss);
		expect(reload.s.animation).toBe(animation);
	});
});

function setExcluded(preferences: PreferencesManager, value: boolean) {
	const profiles = copy(preferences.s['deck.profiles']);
	profiles[0].columns[0].excludeBots = value;
	return preferences.commit('deck.profiles', profiles);
}

describe('guest theme preference persistence', () => {
	test.each(['lightTheme', 'darkTheme'] as const)('%s can be saved from null and reset without changing other preferences', async (key) => {
		const f = await fixture();
		const guest = new PreferencesManager(f.io, null);
		await guest.cloudReady;
		const untouched = copy(f.saved.preferences);
		const theme: Theme = {
			id: `server-${key}`, name: 'Server theme', author: 'test',
			base: key === 'lightTheme' ? 'light' : 'dark', props: { accent: '#34a1c9' },
		};

		expect(guest.s[key]).toBeNull();
		await guest.commit(key, theme);
		const reload = new PreferencesManager(f.io, null);
		await reload.cloudReady;
		expect(reload.s[key]).toEqual(theme);

		await reload.commit(key, null);
		const reset = new PreferencesManager(f.io, null);
		await reset.cloudReady;
		expect(reset.s[key]).toBeNull();
		for (const otherKey of Object.keys(untouched)) {
			if (otherKey !== key) expect(f.saved.preferences[otherKey]).toEqual(untouched[otherKey]);
		}
	});
});

describe('notification preference persistence with real storage manager', () => {
	test('an old tab saving another setting preserves the latest notification filters and unrelated preferences', async () => {
		const f = await fixture();
		const a = f.boot();
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		a.commit('widgets', [{ ...a.s.widgets[0], data: { excludeBots: true, height: 300 } }]);
		setExcluded(a, true);
		const untouched = copy(a.s.emojiPalettes);
		b.commit('animation', !b.s.animation);
		const reload = f.boot();
		await reload.cloudReady;
		expect(excludesBots(reload)).toBe(true);
		expect(reload.s.widgets[0].data.excludeBots).toBe(true);
		expect(reload.s.emojiPalettes).toEqual(untouched);
		expect(reload.s.animation).toBe(b.s.animation);
	});

	test('editing another column property preserves concurrent Bot filtering within the same layout record', async () => {
		const f = await fixture();
		const a = f.boot();
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		setExcluded(a, true);
		const profiles = copy(b.s['deck.profiles']);
		profiles[0].columns[0].width = 450;
		b.commit('deck.profiles', profiles);
		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.s['deck.profiles'][0].columns[0]).toMatchObject({ excludeBots: true, width: 450 });
	});

	test('widget property edits merge while explicit local filter edits win', async () => {
		const f = await fixture();
		const a = f.boot();
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		a.commit('widgets', [{ ...a.s.widgets[0], data: { excludeBots: true, height: 300 } }]);
		b.commit('widgets', [{ ...b.s.widgets[0], data: { excludeBots: false, height: 500 } }]);
		expect(b.s.widgets[0].data).toEqual({ excludeBots: true, height: 500 });
		b.commit('widgets', [{ ...b.s.widgets[0], data: { excludeBots: false, height: 500 } }]);
		expect(f.boot().s.widgets[0].data).toEqual({ excludeBots: false, height: 500 });
	});

	test('layout merges retain additions and deletions and do not undo another tab reorder', async () => {
		const f = await fixture();
		const first = copy(f.seed.s.widgets[0]);
		const second = { ...first, id: 'second' };
		f.seed.commit('widgets', [first, second]);
		const a = f.boot();
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		a.commit('widgets', [second, { ...first, data: { excludeBots: true, height: 300 } }, { ...first, id: 'third' }]);
		b.commit('widgets', [{ ...first, data: { excludeBots: false, height: 500 } }, second]);
		expect(b.s.widgets.map(widget => widget.id)).toEqual(['second', 'widget', 'third']);
		expect(b.s.widgets[1].data).toEqual({ excludeBots: true, height: 500 });
		const old = f.boot();
		await old.cloudReady;
		b.commit('widgets', b.s.widgets.filter(widget => widget.id !== 'third'));
		old.commit('widgets', old.s.widgets.map(widget => widget.id === 'widget' ? { ...widget, data: { ...widget.data, height: 600 } } : widget));
		expect(old.s.widgets.map(widget => widget.id)).toEqual(['second', 'widget']);
	});

	test('saving a different account keeps both account scopes', async () => {
		const f = await fixture();
		const a = f.boot('a');
		const b = f.boot('b');
		await Promise.all([a.cloudReady, b.cloudReady]);
		setExcluded(a, true);
		b.commit('widgets', [{ id: 'b', name: 'notifications', place: null, data: { excludeBots: true } }]);
		const againA = f.boot('a');
		const againB = f.boot('b');
		await Promise.all([againA.cloudReady, againB.cloudReady]);
		expect(excludesBots(againA)).toBe(true);
		expect(againA.s.widgets[0].id).toBe('widget');
		expect(againB.s.widgets[0].id).toBe('b');
	});

	test('a deliberate account override deletion is not restored by merging', async () => {
		const f = await fixture();
		f.seed.setAccountOverride('animation');
		const a = f.boot();
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		a.commit('widgets', [{ ...a.s.widgets[0], data: { excludeBots: true } }]);
		b.clearAccountOverride('animation');
		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.isAccountOverrided('animation')).toBe(false);
		expect(reload.s.widgets[0].data.excludeBots).toBe(true);
	});

	test('a delayed cloud response cannot undo a local edit or an edit changed back to its initial value', async () => {
		for (const changeBack of [false, true]) {
			const f = await fixture();
			f.seed.getMatchedRecordOf('deck.profiles')[2].sync = true;
			f.seed.save();
			const response = deferred<Awaited<ReturnType<StorageProvider['cloudGetBulk']>>>();
			const remote = copy(f.seed.s['deck.profiles']);
			remote[0].columns[0].excludeBots = changeBack;
			const a = f.boot('a', { cloudGetBulk: (() => response.promise) as StorageProvider['cloudGetBulk'] });
			await setExcluded(a, true);
			if (changeBack) await setExcluded(a, false);
			response.resolve({ 'deck.profiles': remote });
			await a.cloudReady;
			expect(excludesBots(a)).toBe(!changeBack);
			expect(excludesBots(f.boot())).toBe(!changeBack);
		}
	});

	test('a cloud response also respects edits saved by another tab during the request', async () => {
		const f = await fixture();
		f.seed.getMatchedRecordOf('deck.profiles')[2].sync = true;
		f.seed.save();
		const response = deferred<Awaited<ReturnType<StorageProvider['cloudGetBulk']>>>();
		const remote = copy(f.seed.s['deck.profiles']);
		const a = f.boot('a', { cloudGetBulk: (() => response.promise) as StorageProvider['cloudGetBulk'] });
		await setExcluded(f.seed, true);
		response.resolve({ 'deck.profiles': remote });
		await a.cloudReady;
		expect(excludesBots(a)).toBe(true);
	});

	test('older fetches cannot override a later reload and cloudReady follows that reload', async () => {
		const f = await fixture();
		f.seed.getMatchedRecordOf('deck.profiles')[2].sync = true;
		f.seed.save();
		const first = deferred<Awaited<ReturnType<StorageProvider['cloudGetBulk']>>>();
		const second = deferred<Awaited<ReturnType<StorageProvider['cloudGetBulk']>>>();
		let count = 0;
		const a = f.boot('a', { cloudGetBulk: (() => count++ === 0 ? first.promise : second.promise) as StorageProvider['cloudGetBulk'] });
		const firstReady = a.cloudReady;
		a.reloadProfile();
		expect(a.cloudReady).not.toBe(firstReady);
		const remote = copy(f.seed.s['deck.profiles']);
		remote[0].columns[0].excludeBots = true;
		second.resolve({ 'deck.profiles': remote });
		await a.cloudReady;
		first.resolve({ 'deck.profiles': f.seed.s['deck.profiles'] });
		await firstReady;
		expect(excludesBots(a)).toBe(true);
	});

	test('another tab changing a value and changing it back invalidates an older cloud response', async () => {
		const f = await fixture();
		f.seed.getMatchedRecordOf('notificationExcludeBots')[2].sync = true;
		f.seed.save();
		const other = f.boot();
		await other.cloudReady;
		const response = deferred<{ notificationExcludeBots: boolean }>();
		const a = f.boot('a', { cloudGetBulk: () => response.promise as never });
		await other.commit('notificationExcludeBots', true);
		await other.commit('notificationExcludeBots', false);
		response.resolve({ notificationExcludeBots: true });
		await a.cloudReady;
		expect(a.s.notificationExcludeBots).toBe(false);
	});

	test('enabling sync survives an unrelated save while its cloud write is pending', async () => {
		const f = await fixture();
		const started = deferred<void>();
		const gate = deferred<void>();
		const a = f.boot('a', { cloudSet: async () => { started.resolve(); await gate.promise; } });
		await a.cloudReady;
		const enabling = a.enableSync('notificationExcludeBots');
		await started.promise;
		a.commit('keepScreenOn', true);
		gate.resolve();
		expect(await enabling).toEqual({ enabled: true });
		expect(a.isSyncEnabled('notificationExcludeBots')).toBe(true);
	});

	test('enabling sync does not overwrite an edit made while its cloud lookup is pending', async () => {
		const f = await fixture();
		const gate = deferred<null>();
		const a = f.boot('a', { cloudGet: () => gate.promise });
		await a.cloudReady;
		const enabling = a.enableSync('notificationExcludeBots');
		a.commit('notificationExcludeBots', true);
		gate.resolve(null);
		expect(await enabling).toEqual({ enabled: false });
		expect(a.s.notificationExcludeBots).toBe(true);
		expect(a.isSyncEnabled('notificationExcludeBots')).toBe(false);
	});

	test('enabling sync does not activate an old cloud value after a concurrent local edit', async () => {
		const f = await fixture();
		const started = deferred<void>();
		const gate = deferred<void>();
		const a = f.boot('a', { cloudSet: async () => { started.resolve(); await gate.promise; } });
		await a.cloudReady;
		const enabling = a.enableSync('notificationExcludeBots');
		await started.promise;
		a.commit('notificationExcludeBots', true);
		gate.resolve();
		expect(await enabling).toEqual({ enabled: false });
		expect(a.s.notificationExcludeBots).toBe(true);
		expect(a.isSyncEnabled('notificationExcludeBots')).toBe(false);
	});

	test('enabling sync does not activate an old cloud value after another tab edits the setting', async () => {
		const f = await fixture();
		const started = deferred<void>();
		const gate = deferred<void>();
		const a = f.boot('a', { cloudSet: async () => { started.resolve(); await gate.promise; } });
		const b = f.boot();
		await Promise.all([a.cloudReady, b.cloudReady]);
		const enabling = a.enableSync('notificationExcludeBots');
		await started.promise;
		b.commit('notificationExcludeBots', true);
		gate.resolve();
		expect(await enabling).toEqual({ enabled: false });
		const reload = f.boot();
		await reload.cloudReady;
		expect(reload.s.notificationExcludeBots).toBe(true);
		expect(reload.isSyncEnabled('notificationExcludeBots')).toBe(false);
	});

	test('cloud writes for one setting are ordered and a reload waits for their completion', async () => {
		const f = await fixture();
		f.seed.getMatchedRecordOf('deck.profiles')[2].sync = true;
		f.seed.save();
		const gate = deferred<void>();
		let remote = copy(f.seed.s['deck.profiles']);
		const cloudSet: StorageProvider['cloudSet'] = vi.fn(async context => {
			if (vi.mocked(cloudSet).mock.calls.length === 1) await gate.promise;
			remote = copy(context.value) as typeof remote;
		});
		const get = vi.fn(async () => ({ 'deck.profiles': copy(remote) }));
		const a = f.boot('a', { cloudGetBulk: get as StorageProvider['cloudGetBulk'], cloudSet });
		await a.cloudReady;
		const first = setExcluded(a, true);
		const second = setExcluded(a, false);
		const third = setExcluded(a, true);
		expect(cloudSet).toHaveBeenCalledTimes(1);
		a.reloadProfile();
		expect(excludesBots(a)).toBe(true);
		expect(get).toHaveBeenCalledTimes(1);
		gate.resolve();
		await Promise.all([first, second, third, a.cloudReady]);
		expect(cloudSet).toHaveBeenCalledTimes(3);
		expect(excludesBots(a)).toBe(true);
		expect(remote[0].columns[0].excludeBots).toBe(true);
	});

	test('an old tab cannot restore a profile replaced by an import', async () => {
		const f = await fixture();
		const a = f.boot();
		await a.cloudReady;
		const replacement = f.saved;
		replacement.id = 'imported';
		replacement.name = 'Imported profile';
		f.replace(replacement);
		a.commit('animation', !a.s.animation);
		await a.cloudReady;
		expect(f.saved.id).toBe('imported');
		expect(a.profile.name).toBe('Imported profile');
	});
});
