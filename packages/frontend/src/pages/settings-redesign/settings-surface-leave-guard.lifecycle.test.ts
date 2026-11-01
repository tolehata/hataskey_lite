/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable vue/one-component-per-file -- Fixtures reproduce the settings and studio hook owners inside the real cached RouterView. */

import { createApp, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, onUnmounted } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HataSideStudio from '../hata-side-studio.vue';
import { createSettingsSurfaceLeaveGuard } from './settings-surface-leave-guard.js';
import type { SettingsSurfaceLeaveGuard } from './settings-surface-leave-guard.js';
import type { App, Component, PropType } from 'vue';
import type { Locale } from '../../../../../locales/index.js';
import type { Router } from '@/router.js';
import type { RouteDef } from '@/lib/nirax.js';
import { Nirax } from '@/lib/nirax.js';
import RouterView from '@/components/global/RouterView.vue';
import { i18n } from '@/i18n.js';

const studioFixture = vi.hoisted(() => ({ router: null as Nirax<RouteDef[]> | null, storage: new Map<string, string>() }));

vi.mock('@/preferences.js', async () => {
	const vue = await import('vue');
	return { prefer: {
		s: { numberOfPageCache: 10, animation: false, smoothTransitionAnimations: false },
		r: { animation: vue.ref(false), hataskeyUi3SideMenuBackground: vue.ref(false), 'simpleUi.sidebar': vue.ref([{ id: 'timeline', icon: 'ti ti-home', label: 'Timeline', group: 'basic' }]), 'simpleUi.deckMode': vue.ref(false) },
	} };
});
vi.mock('@/router.js', () => ({ get mainRouter() { return studioFixture.router; }, useRouter: () => studioFixture.router }));
vi.mock('@/i18n.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	return { i18n: new I18n(load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Locale) };
});
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => studioFixture.storage.get(key) ?? null,
	setItem: (key: string, value: string) => { studioFixture.storage.set(key, value); },
	removeItem: (key: string) => { studioFixture.storage.delete(key); },
} }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/instance.js', () => ({ instance: { name: 'Hataskey', iconUrl: null, federation: 'none' } }));
vi.mock('@/accounts.js', () => ({ getAccountMenu: vi.fn() }));
vi.mock('@/ui/_common_/common.js', () => ({ openInstanceMenu: vi.fn() }));
vi.mock('@/utility/external-api.js', () => ({ getExternalAccount: () => ({}) }));
vi.mock('@/components/MkLaunchPad.vue', () => ({ default: { render: () => null } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/navbar.js', () => ({ navbarItemDef: {} }));
vi.mock('@/cache.js', () => ({ antennasCache: {}, userListsCache: {} }));
vi.mock('@/os.js', () => ({ toast: vi.fn(), popup: vi.fn() }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/components/HataSideStudioEarthquake.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HataSideStudioFlowers.vue', () => ({ default: { render: () => null } }));
vi.mock('vuedraggable', async () => {
	const vue = await import('vue');
	return { default: vue.defineComponent({
		inheritAttrs: false,
		props: { modelValue: { type: Array as PropType<Array<{ id: string }>>, required: true }, itemKey: String },
		setup: (props, { attrs, slots }) => () => vue.h('div', attrs, props.modelValue.map((element, index) => slots.item?.({ element, index }))),
	}) };
});

const guards: SettingsSurfaceLeaveGuard[] = [];
const mounted: Array<{ app: App; container: HTMLDivElement }> = [];
const listeners: Array<() => void> = [];
const emptyPage = defineComponent({ render: () => h('main') });

function deferred() {
	let resolve: (approved: boolean) => void = () => {};
	let reject: (reason: Error) => void = () => {};
	const promise = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function createRouter(settingsPage: Component = emptyPage, studioPage: Component = emptyPage) {
	return new Nirax<RouteDef[]>([
		{ path: '/', component: emptyPage },
		{ path: '/settings', component: settingsPage },
		{ path: '/hata-side-studio', component: studioPage },
		{ path: '/hatady', component: emptyPage },
	], '/settings', true, emptyPage);
}

function createGuard(router: Nirax<RouteDef[]>, requestDiscard: () => Promise<boolean>, dirty = () => true) {
	const guard = createSettingsSurfaceLeaveGuard({ router, requestDiscard, shouldBlockNavigation: dirty, shouldWarnBeforeUnload: dirty });
	guards.push(guard);
	return guard;
}

async function settle() {
	for (let index = 0; index < 6; index++) await nextTick();
}

async function mountRouter(router: Nirax<RouteDef[]>) {
	const app = createApp({ render: () => h(RouterView, { router: router as unknown as Router }) });
	app.component('MkLoading', emptyPage);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	await settle();
	return container;
}

function clickText(root: ParentNode, label: string) {
	const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent.trim() === label);
	if (button == null) throw new Error(`Missing button: ${label}`);
	button.click();
}

afterEach(async () => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	for (const guard of guards.splice(0)) guard.dispose();
	for (const remove of listeners.splice(0)) remove();
	await settle();
	vi.unstubAllGlobals();
	window.history.replaceState({}, '', '/settings');
});

describe('settings leave guard with Nirax and cached page lifecycles', () => {
	test('TLと別アプリを往復しても設定以外では元hookへ戻り、復帰後の遷移を一度だけ実行する', async () => {
		const requestDiscard = vi.fn(async () => true);
		const settingsPage = defineComponent({
			setup() {
				const guard = createGuard(router, requestDiscard, () => false);
				onMounted(guard.install);
				onActivated(guard.install);
				onDeactivated(guard.dispose);
				onUnmounted(guard.dispose);
				return () => h('main', 'settings');
			},
		});
		const router = createRouter(settingsPage);
		const upstream = vi.fn(() => false);
		router.navHook = upstream;
		const pushed = vi.fn();
		router.on('push', pushed);
		await mountRouter(router);
		for (let round = 0; round < 3; round++) {
			for (const path of ['/', '/hatady']) {
				router.pushByPath(path);
				await settle();
				expect(router.getCurrentFullPath()).toBe(path);
				expect(router.navHook).toBe(upstream);
			}
			router.pushByPath('/settings');
			await settle();
			expect(router.navHook).not.toBe(upstream);
		}
		expect(pushed).toHaveBeenCalledTimes(9);
		expect(upstream).toHaveBeenCalledTimes(9);
		expect(requestDiscard).not.toHaveBeenCalled();
	});

	test('設定→studio→設定のKeepAlive復帰で以前のhookと循環せずTLへ離脱できる', async () => {
		let studioPreviousHook: Nirax<RouteDef[]>['navHook'] = null;
		const settingsPage = defineComponent({
			setup() {
				const guard = createGuard(router, async () => true, () => false);
				onMounted(guard.install);
				onActivated(guard.install);
				onDeactivated(guard.dispose);
				onUnmounted(guard.dispose);
				return () => h('main', 'settings');
			},
		});
		const studioPage = defineComponent({
			setup() {
				// Match hata-side-studio.vue: capture during setup, delegate when clean,
				// and restore only on unmount. KeepAlive deactivation retains this hook.
				const previous = router.navHook;
				studioPreviousHook = previous;
				const studioHook: NonNullable<typeof previous> = (path, flag) => previous?.(path, flag) ?? false;
				router.navHook = studioHook;
				onBeforeUnmount(() => { if (router.navHook === studioHook) router.navHook = previous; });
				return () => h('main', 'studio');
			},
		});
		const router = createRouter(settingsPage, studioPage);
		await mountRouter(router);
		const originalSettingsHook = router.navHook;
		router.pushByPath('/hata-side-studio');
		await settle();
		expect(studioPreviousHook).toBe(originalSettingsHook);
		router.pushByPath('/settings');
		await settle();
		expect(() => router.pushByPath('/')).not.toThrow();
		await settle();
		expect(router.getCurrentFullPath()).toBe('/');
	});

	test('旧確認のrejectが復帰後の新しい確認を消さず、最新の移動先を承認後に通す', async () => {
		const router = createRouter();
		const oldConfirmation = deferred();
		const newConfirmation = deferred();
		const requestDiscard = vi.fn()
			.mockReturnValueOnce(oldConfirmation.promise)
			.mockReturnValueOnce(newConfirmation.promise);
		const guard = createGuard(router, requestDiscard);
		guard.install();
		router.pushByPath('/hatady');
		guard.dispose();
		guard.install();
		router.pushByPath('/');
		expect(requestDiscard).toHaveBeenCalledTimes(2);
		oldConfirmation.reject(new Error('old dialog failed after deactivation'));
		await settle();
		expect(router.getCurrentFullPath()).toBe('/settings');
		newConfirmation.resolve(true);
		await settle();
		expect(router.getCurrentFullPath()).toBe('/');
		expect(requestDiscard).toHaveBeenCalledTimes(2);
	});

	test('実studioで保存せず設定へ戻った後、非activeなdirty確認がTLや別アプリへの遷移を止めない', async () => {
		studioFixture.storage.set('hataSideStudioTutorialDone', '1');
		studioFixture.storage.set('ui', 'simple');
		vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
		const settingsPage = defineComponent({
			setup() {
				const guard = createGuard(router, async () => true, () => false);
				onMounted(guard.install);
				onActivated(guard.install);
				onDeactivated(guard.dispose);
				onUnmounted(guard.dispose);
				return () => h('main', 'settings');
			},
		});
		const router = createRouter(settingsPage, HataSideStudio);
		studioFixture.router = router;
		const container = await mountRouter(router);
		router.pushByPath('/hata-side-studio');
		await settle();
		const copy = i18n.ts._hata._hataSideStudio._main;
		clickText(container, copy.createGroup);
		await settle();
		const activeUnload = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(activeUnload);
		expect(activeUnload.defaultPrevented).toBe(true);
		router.pushByPath('/settings');
		await settle();
		expect(router.getCurrentFullPath()).toBe('/hata-side-studio');
		clickText(window.document.body, copy.discardAndMove);
		await settle();
		expect(router.getCurrentFullPath()).toBe('/settings');
		const inactiveUnload = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(inactiveUnload);
		expect(inactiveUnload.defaultPrevented).toBe(false);
		for (const path of ['/', '/hatady']) {
			router.pushByPath(path);
			await settle();
			expect(router.getCurrentFullPath()).toBe(path);
		}
		router.pushByPath('/hata-side-studio');
		await settle();
		const reactivatedUnload = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(reactivatedUnload);
		expect(reactivatedUnload.defaultPrevented).toBe(true);
		router.pushByPath('/settings');
		await settle();
		expect(router.getCurrentFullPath()).toBe('/hata-side-studio');
		expect(window.document.body.textContent).toContain(copy.discardAndMove);
	});

	test('popstateの連続操作は一つの確認へまとめ、最後の行き先へ一度だけ進む', async () => {
		const router = createRouter();
		const confirmation = deferred();
		const requestDiscard = vi.fn(() => confirmation.promise);
		const pushed = vi.fn(({ fullPath }: { fullPath: string }) => window.history.pushState({}, '', fullPath));
		router.on('push', pushed);
		const browserRouter = vi.fn(() => router.replaceByPath(window.location.pathname));
		window.addEventListener('popstate', browserRouter);
		listeners.push(() => window.removeEventListener('popstate', browserRouter));
		const guard = createGuard(router, requestDiscard);
		guard.install();
		for (const path of ['/hatady', '/']) {
			window.history.replaceState({}, '', path);
			window.dispatchEvent(new PopStateEvent('popstate'));
			expect(window.location.pathname).toBe('/settings');
		}
		expect(browserRouter).not.toHaveBeenCalled();
		expect(requestDiscard).toHaveBeenCalledTimes(1);
		confirmation.resolve(true);
		await settle();
		expect(pushed).toHaveBeenCalledTimes(1);
		expect(router.getCurrentFullPath()).toBe('/');
		expect(window.location.pathname).toBe('/');
	});
});
