/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HataskeyUiSBottomNavSettings from './HataskeyUiSBottomNavSettings.vue';
import type { Locale } from '../../../../../locales/index.js';
import type { PreferencesProfile, StorageProvider } from '@/preferences/manager.js';
import { PreferencesManager } from '@/preferences/manager.js';
import { getVisibleBottomNav } from '@/utility/hatasaba-navigation.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/os.js', () => ({ waiting: () => () => {}, alert: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as Locale) };
});
vi.mock('@/router.js', async () => {
	const { ref } = await import('vue');
	return { useRouter: () => ({ currentRef: ref('/settings/preferences'), getCurrentFullPath: () => '/settings/preferences' }) };
});
vi.mock('@/preferences.js', () => ({ prefer: {
	get r() { return manager.r; },
	commit: (...args: Parameters<PreferencesManager['commit']>) => manager.commit(...args),
	isAccountOverrided: (...args: Parameters<PreferencesManager['isAccountOverrided']>) => manager.isAccountOverrided(...args),
	isSyncEnabled: (...args: Parameters<PreferencesManager['isSyncEnabled']>) => manager.isSyncEnabled(...args),
	getPerPrefMenu: (...args: Parameters<PreferencesManager['getPerPrefMenu']>) => manager.getPerPrefMenu(...args),
} }));

let manager: PreferencesManager;
const storageKey = 'test:hataskey-ui-s-bottom-nav';
const storage: StorageProvider = {
	load: () => {
		const value = window.localStorage.getItem(storageKey);
		return value == null ? null : JSON.parse(value) as PreferencesProfile;
	},
	save: ({ profile }) => window.localStorage.setItem(storageKey, JSON.stringify(profile)),
	cloudGetBulk: async () => ({}), cloudGet: async () => null, cloudSet: async () => undefined,
};
const cleanups: (() => void)[] = [];

async function settle() { for (let i = 0; i < 5; i++) { await Promise.resolve(); await nextTick(); } }

async function boot() { manager = new PreferencesManager(storage, { id: 'bottom-nav-test' }); await manager.cloudReady; }

async function mount() {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const errors: unknown[] = [];
	const app = createApp({ render: () => h(HataskeyUiSBottomNavSettings) });
	app.config.errorHandler = error => { errors.push(error); };
	app.mount(host);
	const unmount = () => { app.unmount(); host.remove(); };
	cleanups.push(unmount);
	await settle();
	return { host, errors, unmount };
}

function rows(host: HTMLElement): string[] { return [...host.querySelectorAll<HTMLElement>('[data-nav-id]')].map(item => item.dataset.navId!); }

function checkbox(host: HTMLElement, id: string): HTMLInputElement { return host.querySelector<HTMLInputElement>(`[data-nav-id="${id}"] input[type="checkbox"]`)!; }

beforeEach(async () => { window.localStorage.removeItem(storageKey); await boot(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); window.localStorage.removeItem(storageKey); });

describe('UI S bottom navigation settings', () => {
	it('normalizes restored Hatask, Hatady, and HataFeed candidates before editing and saving', async () => {
		manager.commit('hataskeyUi3BottomNav', [
			{ id: 'home', visible: true },
			{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', visible: true },
			{ id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', visible: true },
			{ id: 'hatafeed', icon: 'ti ti-message-report', label: 'HataFeed', visible: true },
		]);
		const mounted = await mount();
		expect(rows(mounted.host)).toContain('hatagoes');
		expect(rows(mounted.host)).not.toContain('hatask');
		expect(rows(mounted.host)).not.toContain('hatady');
		expect(rows(mounted.host)).not.toContain('hatafeed');
		expect(rows(mounted.host).filter(id => id === 'hatagoes')).toHaveLength(1);
		checkbox(mounted.host, 'hatagoes').checked = false;
		checkbox(mounted.host, 'hatagoes').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(manager.s.hataskeyUi3BottomNav?.some(item => ['hatask', 'hatady', 'hatafeed'].includes(item.id))).toBe(false);
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'hatagoes')?.visible).toBe(false);
	});

	it('converts a saved HataFeed-only candidate into a selectable HataGoes row across reloads', async () => {
		manager.commit('hataskeyUi3BottomNav', [{ id: 'home', visible: true }, { id: 'hatafeed', visible: false, extra: 'feed' }] as typeof manager.s.hataskeyUi3BottomNav);
		const first = await mount();
		expect(rows(first.host)).not.toContain('hatafeed');
		expect(rows(first.host)).toContain('hatagoes');
		expect(checkbox(first.host, 'hatagoes').checked).toBe(false);
		checkbox(first.host, 'hatagoes').checked = true;
		checkbox(first.host, 'hatagoes').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'hatagoes')).toMatchObject({ visible: true, extra: 'feed' });
		expect(manager.s.hataskeyUi3BottomNav?.some(item => item.id === 'hatafeed')).toBe(false);
		first.unmount();
		cleanups.pop();
		await boot();
		const restored = await mount();
		expect(rows(restored.host)).not.toContain('hatafeed');
		expect(checkbox(restored.host, 'hatagoes').checked).toBe(true);
	});

	it.each([false, true])('keeps home on and reorderable without enabling it in shared settings (missing: %s)', async missing => {
		const home = { id: 'home', icon: 'ti ti-home', label: 'Home', visible: false };
		manager.commit('simpleUi.bottomNav', [
			{ id: 'search', icon: 'ti ti-search', label: 'Search', visible: true },
			{ id: 'notifications', icon: 'ti ti-bell', label: 'Notifications', visible: true },
			{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', visible: true },
			{ id: 'hatafeed', icon: 'ti ti-message-report', label: 'HataFeed', visible: true },
			...(missing ? [] : [home]),
		]);
		const before = manager.s['simpleUi.bottomNav'].map(item => ({ ...item }));
		const commit = vi.spyOn(manager, 'commit');
		const mounted = await mount();
		expect(commit).not.toHaveBeenCalled();
		expect(manager.s['simpleUi.bottomNav']).toEqual(before);
		const homeSwitch = checkbox(mounted.host, 'home');
		expect(homeSwitch.checked).toBe(true);
		expect(homeSwitch.disabled).toBe(true);
		expect(homeSwitch.closest('.item')?.classList.contains('hidden')).toBe(false);
		homeSwitch.checked = false;
		homeSwitch.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(homeSwitch.checked).toBe(true);
		expect(commit).not.toHaveBeenCalled();
		checkbox(mounted.host, 'widgets').checked = true;
		checkbox(mounted.host, 'widgets').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(checkbox(mounted.host, 'widgets').checked).toBe(true);
		const oldIndex = rows(mounted.host).indexOf('home');
		mounted.host.querySelector<HTMLButtonElement>('[data-nav-id="home"] .bottomNavHandle')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await settle();
		expect(rows(mounted.host).indexOf('home')).toBe(oldIndex - 1);
		expect(manager.s['simpleUi.bottomNav']).toEqual(before);
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'home')?.visible).toBe(true);
		expect(getVisibleBottomNav([...manager.s['simpleUi.bottomNav']]).some(item => item.id === 'home')).toBe(false);
		expect(new Set(commit.mock.calls.map(([key]) => key))).toEqual(new Set(['hataskeyUi3BottomNav']));
		expect(mounted.errors).toEqual([]);
		mounted.unmount();
		cleanups.pop();
		await boot();
		const restored = await mount();
		expect(rows(restored.host).indexOf('home')).toBe(oldIndex - 1);
		expect(checkbox(restored.host, 'home').checked).toBe(true);
		expect(checkbox(restored.host, 'home').disabled).toBe(true);
		expect(manager.s['simpleUi.bottomNav']).toEqual(before);
	});

	it('inherits custom order then saves only UI S while retaining hidden and unknown metadata', async () => {
		manager.commit('simpleUi.bottomNav', [
			{ id: 'search', icon: 'ti ti-search', label: 'Custom search', visible: true },
			{ id: 'home', icon: 'ti ti-home', label: 'Home', visible: true },
			{ id: 'notifications', icon: 'ti ti-bell', label: 'Notifications', visible: false },
			{ id: 'future', icon: 'ti ti-star', label: 'Future', visible: false, extra: 'keep' },
		] as typeof manager.s['simpleUi.bottomNav']);
		const legacy = manager.s['simpleUi.bottomNav'].map(item => ({ ...item }));
		const first = await mount();
		expect(first.host.querySelector('[data-settings-search-id]')?.getAttribute('data-settings-search-id')).toBe('settings.control.preference.simpleui-bottomnav');
		expect(rows(first.host)).toContain('widgets');
		const commit = vi.spyOn(manager, 'commit');
		const handle = first.host.querySelector<HTMLButtonElement>('[data-nav-id="home"] .bottomNavHandle')!;
		handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await settle();
		expect(rows(first.host).slice(0, 2)).toEqual(['home', 'search']);
		checkbox(first.host, 'search').checked = false;
		checkbox(first.host, 'search').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		checkbox(first.host, 'widgets').checked = true;
		checkbox(first.host, 'widgets').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'future')).toMatchObject({ icon: 'ti ti-star', label: 'Future', visible: false, extra: 'keep' });
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'search')).toMatchObject({ label: 'Custom search', visible: false });
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'widgets')?.visible).toBe(true);
		expect(manager.s['simpleUi.bottomNav']).toEqual(legacy);
		expect(new Set(commit.mock.calls.map(([key]) => key))).toEqual(new Set(['hataskeyUi3BottomNav']));
		expect(first.errors).toEqual([]);
		first.unmount();
		cleanups.pop();
		await boot();
		const second = await mount();
		expect(rows(second.host).slice(0, 2)).toEqual(['home', 'search']);
		expect(checkbox(second.host, 'widgets').checked).toBe(true);
		expect(manager.s.hataskeyUi3BottomNav?.find(item => item.id === 'future')).toMatchObject({ extra: 'keep', visible: false });
		expect(manager.s['simpleUi.bottomNav']).toEqual(legacy);
		expect(second.errors).toEqual([]);
	});

	it('defaults to Widgets, offers only five unified candidates, and resets only the UI S order', async () => {
		const legacy = manager.s['simpleUi.bottomNav'].map(item => ({ ...item }));
		const mounted = await mount();
		expect(mounted.host.querySelector('.warning')).toBeNull();
		expect(mounted.host.querySelector('.saveHint')?.textContent).toContain('ウィジェット');
		expect(checkbox(mounted.host, 'hatagoes').checked).toBe(true);
		expect(rows(mounted.host).slice(0, 5)).toEqual(['search', 'home', 'notifications', 'hatagoes', 'widgets']);
		expect(rows(mounted.host)).toHaveLength(5);
		expect(rows(mounted.host)).not.toContain('hatafeed');
		checkbox(mounted.host, 'widgets').checked = false;
		checkbox(mounted.host, 'widgets').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		checkbox(mounted.host, 'widgets').checked = true;
		checkbox(mounted.host, 'widgets').dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(checkbox(mounted.host, 'widgets').checked).toBe(true);
		expect(manager.s.hataskeyUi3BottomNav?.filter(item => item.visible !== false)).toHaveLength(5);
		expect(mounted.host.querySelector('.saveHint')?.textContent).toContain('ウィジェット');
		expect(mounted.host.querySelector('.warning')).toBeNull();
		const handle = mounted.host.querySelector<HTMLButtonElement>('[data-nav-id="home"] .bottomNavHandle')!;
		handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await settle();
		mounted.host.querySelector<HTMLButtonElement>('.heading button')!.click();
		await settle();
		expect(rows(mounted.host).slice(0, 5)).toEqual(['search', 'home', 'notifications', 'hatagoes', 'widgets']);
		expect(manager.s.hataskeyUi3BottomNav?.filter(item => item.visible !== false)).toHaveLength(5);
		expect(manager.s['simpleUi.bottomNav']).toEqual(legacy);
	});

	it('reacts to dedicated profile updates and resetting to legacy fallback without rewriting shared settings', async () => {
		const mounted = await mount();
		const legacy = manager.s['simpleUi.bottomNav'].map(item => ({ ...item }));
		manager.commit('hataskeyUi3BottomNav', [{ id: 'widgets', visible: true }, { id: 'home', visible: true }]);
		await settle();
		expect(rows(mounted.host).slice(0, 2)).toEqual(['widgets', 'home']);
		expect(checkbox(mounted.host, 'search').checked).toBe(false);
		const reset = manager.getPerPrefMenu('hataskeyUi3BottomNav').find(item => item && typeof item === 'object' && 'icon' in item && item.icon === 'ti ti-refresh');
		if (!reset || typeof reset !== 'object' || !('action' in reset) || typeof reset.action !== 'function') throw new Error('Missing reset action');
		reset.action(new MouseEvent('click')); await settle();
		expect(manager.s.hataskeyUi3BottomNav).toBeNull();
		expect(rows(mounted.host).slice(0, 5)).toEqual(['search', 'home', 'notifications', 'hatagoes', 'widgets']);
		expect(manager.s['simpleUi.bottomNav']).toEqual(legacy);
	});
});
