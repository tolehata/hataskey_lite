/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { computed } from 'vue';
import WelcomeHataskPreview from './welcome.entrance.hatask-preview.vue';
import WelcomeHatadyPreview from './welcome.entrance.hatady-preview.vue';
import WelcomeHataFeedPreview from './welcome.entrance.hatafeed-preview.vue';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';
import type { Component } from 'vue';
import HatadyHome from '@/components/HatadyHome.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { prefer } from '@/preferences.js';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';

vi.mock('@@/js/locale.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	return { locale: load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) };
});
vi.mock('@/account.js', () => ({ $i: null }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(async () => []) }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false) }, s: {}, commit: vi.fn() } };
});
vi.mock('@/components/MkHataskeyNotificationToasts.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HyDialog.vue', () => ({ default: { render: () => null } }));

const mounted: { app: ReturnType<typeof createApp>; host: HTMLElement }[] = [];

async function flush() { await nextTick(); await Promise.resolve(); await nextTick(); }

async function mount(component: Component, props: Record<string, unknown> = {}) {
	const host = window.document.createElement('div');
	host.dataset.hataskeyEntrance = '';
	window.document.body.append(host);
	const signin = vi.fn();
	const app = createApp({ render: () => h(component, { mode: 'light', language: 'ja', now: new Date(2026, 8, 15, 10, 24), onSignin: signin, ...props }) });
	const notifications = createHataskeyNotificationToasts(computed(() => true), computed(() => true));
	const register = vi.spyOn(notifications, 'registerSurface');
	app.provide(hataskeyNotificationToastsKey, notifications);
	app.component('MkUserName', { props: ['user'], setup: props => () => h('span', props.user?.name ?? '') });
	app.component('MkTime', { props: ['time'], setup: props => () => h('time', props.time) });
	app.component('MkAvatar', { render: () => h('span') });
	app.component('Mfm', { props: ['text'], setup: props => () => h('span', props.text) });
	app.mount(host);
	mounted.push({ app, host });
	await flush();
	return { host, signin, register };
}

function button(host: HTMLElement, text: string): HTMLButtonElement {
	const match = [...host.querySelectorAll('button')].find(el => el.textContent?.includes(text) || el.getAttribute('aria-label') === text);
	if (!match) throw new Error(`Missing button ${text}`);
	return match;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
	vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
});
afterEach(() => { for (const { app, host } of mounted.splice(0)) { app.unmount(); host.remove(); } vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('Hataskの実部品でテーマとToDoを操作し、見本を保存せずログインへつなぐ', async () => {
	const { host, signin, register } = await mount(WelcomeHataskPreview);
	expect(host.querySelector('.htk-akatsuki-layout')).not.toBeNull();
	expect(host.querySelector('.hak-next-lead')?.textContent).toBe('つぎは、');
	expect(host.querySelector('.hak-next-title')?.textContent).toBe('作業の時間');
	const themes = [...host.querySelectorAll<HTMLButtonElement>('[data-welcome-theme]')];
	expect(themes).toHaveLength(6);
	for (const theme of themes) { theme.click(); await flush(); expect(host.querySelector('.welcome-hatask')?.getAttribute('data-theme')).toBe(theme.dataset.welcomeTheme); }
	const todo = button(host, '読みかけの本を返す');
	todo.click(); await flush();
	expect(todo.getAttribute('aria-pressed')).toBe('true');
	button(host, '予定を開く').click();
	expect(signin).toHaveBeenCalledOnce();
	expect(prefer.commit).not.toHaveBeenCalled();
	expect(misskeyApi).not.toHaveBeenCalled();
	expect(register).not.toHaveBeenCalled();
	const controller = new HataskeyWelcomeController();
	controller.rootRef(host);
	controller.setupReveal = vi.fn();
	controller.bindScroll = vi.fn();
	controller.setupTextMotion();
	expect(host.querySelector('.hak-next-lead')?.textContent).toBe('つぎは、');
	expect(host.querySelector('.hak-next-title')?.textContent).toBe('作業の時間');
});

test('Hatadyの実ホームを見本データで描画し、認証APIと外部通知を開始しない', async () => {
	const { host, signin, register } = await mount(WelcomeHatadyPreview);
	expect(host.querySelector('[data-preview=true][inert]')).not.toBeNull();
	expect(host.textContent).toContain('朝の読書');
	expect(host.textContent).toContain('風の便り');
	window.document.dispatchEvent(new Event('visibilitychange'));
	await flush();
	expect(misskeyApi).not.toHaveBeenCalled();
	const record = host.querySelector<HTMLButtonElement>('header .hy-primary');
	expect(record).not.toBeNull();
	record!.click();
	expect(signin).toHaveBeenCalledOnce();
	expect(prefer.commit).not.toHaveBeenCalled();
	expect(register).not.toHaveBeenCalled();
});

test('陽性対照：見本指定を外した実ホームではAPI呼び出しを検出する', async () => {
	await mount(HatadyHome, { revision: 0 });
	expect(misskeyApi).toHaveBeenCalled();
});

test('HataFeedの実ホーム・イシュー・ロードマップを切り替え、送信はログインへつなぐ', async () => {
	const { host, signin, register } = await mount(WelcomeHataFeedPreview);
	expect(host.textContent).toContain('改善予定');
	button(host, 'イシュー').click(); await flush();
	expect(host.querySelector('form[role=search]')).not.toBeNull();
	const search = host.querySelector<HTMLInputElement>('input[type=search]')!;
	search.value = '予定'; search.dispatchEvent(new Event('input')); await flush();
	expect(host.textContent).toContain('予定をもっと見つけやすくしたい');
	expect(host.textContent).not.toContain('ご意見・不具合報告はこちらへ');
	button(host, 'ロードマップ').click(); await flush();
	expect(host.textContent).toContain('記録を一覧で振り返りたい');
	host.querySelector<HTMLButtonElement>('[aria-label="報告・申請"]')!.click(); await flush();
	button(host, '新規イシュー').click();
	expect(signin).toHaveBeenCalledOnce();
	expect(misskeyApi).not.toHaveBeenCalled();
	expect(prefer.commit).not.toHaveBeenCalled();
	expect(register).not.toHaveBeenCalled();
});
