/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import ExternalAccount from './external-account.vue';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const calls = vi.hoisted(() => ({ commit: vi.fn(), restart: vi.fn(), confirm: vi.fn(), clearCache: vi.fn(), getFavorites: vi.fn(), setFavorites: vi.fn(), removeFavorite: vi.fn(), api: vi.fn() }));
vi.mock('@/preferences.js', async () => {
	const { reactive, computed } = await import('vue');
	const state = reactive<Record<string, unknown>>({});
	return { prefer: {
		s: state,
		model: (key: string) => computed({ get: () => state[key], set: value => { calls.commit(key, value); state[key] = value; } }),
		commit: (key: string, value: unknown) => { calls.commit(key, value); state[key] = value; },
	} };
});
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	return { i18n: createTestHataskI18n() };
});
vi.mock('@/instance.js', () => ({ instance: { name: '検証サーバー' } }));
vi.mock('@/store.js', () => ({ store: { r: { darkMode: { value: false } } } }));
vi.mock('@@/js/config.js', () => ({ hostname: 'test.example', instanceName: 'fallback.example', lang: 'ja-JP' }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/utility/id.js', () => ({ genId: vi.fn(() => 'test-session') }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: calls.api }));
vi.mock('@/os.js', () => ({ confirm: calls.confirm, success: vi.fn(), actions: vi.fn(), popup: vi.fn() }));
vi.mock('@/utility/external-notification-stream.js', () => ({ restartExternalNotificationStream: calls.restart }));
vi.mock('@/utility/external-api.js', () => ({
	getExternalFavoriteEmojis: calls.getFavorites, setExternalFavoriteEmojis: calls.setFavorites,
	removeExternalFavoriteEmoji: calls.removeFavorite, clearExternalEmojiCache: calls.clearCache,
	getExternalCustomEmojis: vi.fn(async () => []), isAllowedExternalHost: vi.fn(() => true),
}));

const cleanups: Array<() => void> = [];

async function flush() { for (let tick = 0; tick < 5; tick++) { await Promise.resolve(); await nextTick(); } }

function button(target: HTMLElement, label: string) {
	const found = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label);
	expect(found, `button: ${label}`).toBeDefined();
	return found!;
}

async function mountSettings() {
	const target = window.document.createElement('main'); window.document.body.append(target);
	const app = createApp({ render: () => h(ExternalAccount) });
	app.component('SearchMarker', { setup: (_props, { slots }) => () => h('div', slots.default?.()) });
	app.component('MkA', { props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) });
	app.mount(target); cleanups.push(() => { app.unmount(); target.remove(); });
	await flush(); return target;
}

beforeEach(() => {
	Object.values(calls).forEach(call => call.mockReset());
	calls.confirm.mockResolvedValue({ canceled: false });
	calls.api.mockResolvedValue(undefined);
	calls.getFavorites.mockReturnValue(['🙂', ':custom:']);
	Object.assign(prefer.s, { 'external.enabled': true, 'external.host': 'social.example', 'external.token': 'test-token', 'external.userId': 'test-user', 'external.username': 'linked-user', 'external.avatarUrl': null, 'external.enableOHTL': true, 'external.enableOLTL': true, 'external.disableNotificationToast': false, 'hataConsent.externalTl': true });
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('external account capsule settings', () => {
	test('retains the existing feature name and linked account identity', async () => {
		const target = await mountSettings();
		expect(target.querySelector('h1')?.textContent).toBe('外部アカウント連携');
		expect(target.querySelector('header')?.textContent).toContain('検証サーバー');
		expect(target.textContent).toContain('@linked-user');
	});
	test('each timeline switch commits to its original preference', async () => {
		const target = await mountSettings(); button(target, '表示・投稿').click(); await flush();
		const inputs = target.querySelectorAll<HTMLInputElement>('input[role="switch"]');
		inputs[0].checked = false; inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
		inputs[1].checked = false; inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
		await flush();
		expect(calls.commit).toHaveBeenCalledWith('external.enableOHTL', false);
		expect(calls.commit).toHaveBeenCalledWith('external.enableOLTL', false);
	});
	test('notification toggle saves its original setting and restarts the external stream', async () => {
		const target = await mountSettings(); button(target, '通知').click(); await flush();
		const input = target.querySelector<HTMLInputElement>('input[role="switch"]')!;
		input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); await flush();
		await vi.dynamicImportSettled();
		expect(calls.commit).toHaveBeenCalledWith('external.disableNotificationToast', true);
		expect(calls.restart).toHaveBeenCalledOnce();
		expect(target.querySelector('a')?.getAttribute('href')).toBe('/my/external-notifications');
	});
	test('favorite removal and cache clearing keep their separate existing operations', async () => {
		const target = await mountSettings(); button(target, '絵文字・データ').click(); await flush();
		button(target, '🙂をお気に入りから削除').click(); await flush();
		expect(calls.removeFavorite).toHaveBeenCalledWith('🙂');
		button(target, i18n.ts._hata._externalAccount.clearCache).click(); await flush();
		expect(calls.confirm).toHaveBeenCalledOnce();
		expect(calls.clearCache).toHaveBeenCalledOnce();
		expect(calls.setFavorites).not.toHaveBeenCalled();
	});
	test('unlink cancellation preserves credentials and confirmed unlink clears only the external account', async () => {
		calls.confirm.mockResolvedValueOnce({ canceled: true });
		const target = await mountSettings();
		button(target, i18n.ts._hata._externalAccount.unlink).click(); await flush();
		expect(prefer.s['external.token']).toBe('test-token');
		button(target, i18n.ts._hata._externalAccount.unlink).click(); await flush();
		expect(calls.commit).toHaveBeenCalledWith('external.token', null);
		expect(calls.commit).toHaveBeenCalledWith('external.userId', null);
		expect(prefer.s['external.host']).toBe('social.example');
	});
});

describe('external account server identity', () => {
	test('shows the linked server by its published name and icon instead of the host name', async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify({ name: 'ソーシャル検証', iconUrl: 'https://cdn.social.example/icon.png' })));
		vi.stubGlobal('fetch', fetcher);
		// A host no earlier test has looked up, so the display cache starts empty.
		Object.assign(prefer.s, { 'external.host': 'meta.example' });
		const target = await mountSettings();
		await vi.waitFor(() => expect(target.querySelector('.connection-identity .connection-server-name')?.textContent).toBe('ソーシャル検証'));
		expect(fetcher).toHaveBeenCalledWith('https://meta.example/api/meta', expect.objectContaining({ method: 'POST', credentials: 'omit' }));
		expect(target.querySelector<HTMLImageElement>('.connection-identity img.connection-server-icon')?.getAttribute('src')).toBe('https://cdn.social.example/icon.png');
		// The host stays only as the secondary line under the name.
		expect(target.querySelector('.connection-identity .connection-server-domain')?.textContent).toBe('meta.example');
	});
});
