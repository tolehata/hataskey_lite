/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HataskeyUiSRssSettings from './HataskeyUiSRssSettings.vue';
import type { Locale } from '../../../../../locales/index.js';
import type { PreferencesProfile, StorageProvider } from '@/preferences/manager.js';
import { PreferencesManager } from '@/preferences/manager.js';
import { i18n } from '@/i18n.js';

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
} }));

// Replace the backing instance between mounts, while preserving the real commit and PREF_DEF.
let manager: PreferencesManager;
const storageKey = 'test:hataskey-ui-s-rss:preferences';
const storage: StorageProvider = {
	load: () => {
		const value = window.localStorage.getItem(storageKey);
		return value == null ? null : JSON.parse(value) as PreferencesProfile;
	},
	save: ({ profile }) => window.localStorage.setItem(storageKey, JSON.stringify(profile)),
	cloudGetBulk: async () => ({}),
	cloudGet: async () => null,
	cloudSet: async () => undefined,
};
const cleanups: (() => void)[] = [];

async function settle() {
	for (let i = 0; i < 5; i++) { await Promise.resolve(); await nextTick(); }
}

async function boot() {
	manager = new PreferencesManager(storage, { id: 'rss-test-account' });
	await manager.cloudReady;
}

async function mount() {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const errors: unknown[] = [];
	const app = createApp({ render: () => h(HataskeyUiSRssSettings) });
	app.config.errorHandler = error => { errors.push(error); };
	app.mount(host);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); host.remove(); mounted = false; } };
	cleanups.push(unmount);
	await settle();
	return { host, errors, unmount };
}

function element<T extends Element>(host: HTMLElement, selector: string): T {
	const found = host.querySelector<T>(selector);
	expect(found, selector).not.toBeNull();
	if (found == null) throw new Error(`Missing element: ${selector}`);
	return found;
}

async function input(host: HTMLElement, selector: string, value: string) {
	const field = element<HTMLInputElement>(host, selector);
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}

async function change(host: HTMLElement, selector: string, value: string | boolean) {
	const field = element<HTMLInputElement | HTMLSelectElement>(host, selector);
	if (typeof value === 'boolean') (field as HTMLInputElement).checked = value;
	else field.value = value;
	field.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
}

async function submit(host: HTMLElement) {
	expect(element<HTMLButtonElement>(host, 'form button[type="submit"]').disabled).toBe(false);
	element<HTMLFormElement>(host, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
}

async function clickSave(host: HTMLElement) {
	const button = element<HTMLButtonElement>(host, 'form button[type="submit"]');
	expect(button.disabled).toBe(false);
	button.click();
	await settle();
}

beforeEach(async () => { window.localStorage.removeItem(storageKey); await boot(); });
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	window.localStorage.removeItem(storageKey);
});

describe('UI S RSS settings persistence through the real manager', () => {
	it('saves exactly one feed from one button click and restores it and all four controls after a new manager and mount', async () => {
		const first = await mount();
		const checkboxes = '.settingsGrid input[type="checkbox"]';
		expect(first.host.querySelectorAll(checkboxes)).toHaveLength(2);
		expect(element<HTMLInputElement>(first.host, '.settingsGrid label:nth-child(2) input').checked).toBe(true);
		await change(first.host, '.settingsGrid label:nth-child(1) input', true);
		await change(first.host, '.settingsGrid label:nth-child(2) input', false);
		await change(first.host, '.settingsGrid label:nth-child(3) select', '15');
		await change(first.host, '.settingsGrid label:nth-child(4) select', 'summary');
		await input(first.host, 'form input[type="url"]', 'https://example.test/feed.xml');
		await input(first.host, 'form input[type="text"]', '永続化テスト');
		await input(first.host, 'form input[type="color"]', '#34a1c9');
		expect(manager.s.hataskeyUi3RssFeeds).toEqual([]);
		await clickSave(first.host);
		expect(manager.s.hataskeyUi3RssFeeds).toHaveLength(1);
		expect(first.host.querySelectorAll('.feed')).toHaveLength(1);
		expect(first.errors).toEqual([]);
		expect(element<HTMLElement>(first.host, '.success[role="status"]').textContent).toBe(i18n.ts._hata._hataskeyUi3._rss.feedSaved);
		expect(element<HTMLInputElement>(first.host, 'form input[type="url"]').value).toBe('');
		const feeds = JSON.parse(JSON.stringify(manager.s.hataskeyUi3RssFeeds));
		expect(feeds).toEqual([{ id: expect.any(String), url: 'https://example.test/feed.xml', name: '永続化テスト', color: '#34a1c9' }]);
		expect(window.localStorage.getItem(storageKey)).not.toBeNull();
		const previous = manager;
		first.unmount();
		await boot();
		expect(manager).not.toBe(previous);
		expect(manager.s).toMatchObject({ hataskeyUi3RssFeeds: feeds, hataskeyUi3RssEnabled: true, hataskeyUi3RssAutoSwitch: false, hataskeyUi3RssReadSeconds: 15, hataskeyUi3RssReadMode: 'summary' });
		const second = await mount();
		expect(second.errors).toEqual([]);
		expect(second.host.querySelectorAll('.feed')).toHaveLength(1);
		expect(element<HTMLInputElement>(second.host, '.feed input[type="url"]').value).toBe('https://example.test/feed.xml');
		expect(element<HTMLInputElement>(second.host, '.feed input[type="text"]').value).toBe('永続化テスト');
		expect(element<HTMLInputElement>(second.host, '.feed input[type="color"]').value).toBe('#34a1c9');
		expect(element<HTMLInputElement>(second.host, '.settingsGrid label:nth-child(1) input').checked).toBe(true);
		expect(element<HTMLInputElement>(second.host, '.settingsGrid label:nth-child(2) input').checked).toBe(false);
		expect(element<HTMLSelectElement>(second.host, '.settingsGrid label:nth-child(3) select').value).toBe('15');
		expect(element<HTMLSelectElement>(second.host, '.settingsGrid label:nth-child(4) select').value).toBe('summary');
	});

	it('preserves the form submit route used by Enter and restores its feed after a new manager and mount', async () => {
		const first = await mount();
		await input(first.host, 'form input[type="url"]', 'https://example.test/enter.xml');
		await input(first.host, 'form input[type="text"]', 'Enter保存');
		// Native implicit submission from Enter reaches this same form submit handler.
		await submit(first.host);
		expect(first.errors).toEqual([]);
		expect(manager.s.hataskeyUi3RssFeeds).toHaveLength(1);
		expect(element<HTMLElement>(first.host, '.success[role="status"]').textContent).toBe(i18n.ts._hata._hataskeyUi3._rss.feedSaved);
		const feeds = JSON.parse(JSON.stringify(manager.s.hataskeyUi3RssFeeds));
		first.unmount();
		await boot();
		expect(manager.s.hataskeyUi3RssFeeds).toEqual(feeds);
		const second = await mount();
		expect(second.errors).toEqual([]);
		expect(second.host.querySelectorAll('.feed')).toHaveLength(1);
		expect(element<HTMLInputElement>(second.host, '.feed input[type="url"]').value).toBe('https://example.test/enter.xml');
		expect(element<HTMLInputElement>(second.host, '.feed input[type="text"]').value).toBe('Enter保存');
	});

	it('does not announce a successful save when localStorage.setItem throws, and a new mount has no unsaved feed', async () => {
		const first = await mount();
		await input(first.host, 'form input[type="url"]', 'https://example.test/unsaved.xml');
		const saved = window.localStorage.getItem(storageKey);
		const failure = new Error('localStorage quota exceeded');
		const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw failure; });
		await submit(first.host);
		expect(write).toHaveBeenCalled();
		expect(first.errors).toEqual([failure]);
		expect(element<HTMLElement>(first.host, '.success[role="status"]').textContent).toBe('');
		expect(window.localStorage.getItem(storageKey)).toBe(saved);
		write.mockRestore();
		first.unmount();
		await boot();
		const second = await mount();
		expect(manager.s.hataskeyUi3RssFeeds).toEqual([]);
		expect(second.host.querySelectorAll('.feed')).toHaveLength(0);
		expect(second.errors).toEqual([]);
	});
});
