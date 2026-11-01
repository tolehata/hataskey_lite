/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = await vi.hoisted(async () => {
	const vue = await import('vue');
	const { Nirax } = await import('@/lib/nirax.js');
	const { rememberHatagoesOrigin, getHatagoesOrigin } = await import('@/utility/hatagoes-navigation.js');
	const { settingsSearchV2ContextKey } = await import('@/utility/settings-search-v2-context.js');
	const empty = vue.defineComponent({ render: () => null });
	const routes = ['/', '/settings', '/settings/:page(*)', '/hatask', '/hatady', '/hatafeed', '/hatagoes', '/hata-side-studio'].map(path => ({ path, component: empty }));
	const createRouter = () => new Nirax(routes, '/settings', true, empty);
	const router = createRouter();
	const pushes: string[] = [];
	router.addListener('push', ({ beforeFullPath, fullPath }) => {
		pushes.push(fullPath);
		rememberHatagoesOrigin(router, beforeFullPath, fullPath);
	});
	router.init();
	const page = vue.defineComponent({ setup: (_, { slots }) => () => vue.h('div', slots.default?.()) });
	const category = vue.defineComponent({
		emits: ['openDestination'],
		setup: (_, { emit }) => () => vue.h('button', {
			'data-settings-destination-id': 'hata-hatady',
			onClick: (event: MouseEvent) => emit('openDestination', 'hata-hatady', event),
		}, 'Hatady'),
	});
	const popup = vue.defineComponent({
		emits: ['closed'],
		setup: (_, { emit }) => () => vue.h('button', { 'data-close-popup': '', onClick: () => emit('closed') }, 'Close popup'),
	});
	const requestDiscard = vi.fn(async () => true);
	const uiSurface = vue.defineComponent({
		emits: ['sideStudio'],
		setup(_, { expose, emit }) {
			const context = vue.inject(settingsSearchV2ContextKey);
			expose({ hasChanges: false, requestDiscard });
			return () => vue.h('div', [
				vue.h('button', {
					'data-ui2-popup': '',
					onClick: () => context?.navigateToSetting({ route: '/settings/hata-custom', activation: { kind: 'popup', category: 'hatady', popup: 'hatady' } }),
				}, 'Hatady'),
				vue.h('button', { 'data-ui2-studio': '', onClick: () => emit('sideStudio') }, 'Side studio'),
			]);
		},
	});
	const popupDisposers = new Set<() => void>();
	const openPopup = vi.fn((_component: unknown, props: Record<string, unknown>, events: { closed: () => void }) => {
		const container = window.document.createElement('div');
		window.document.body.append(container);
		const app = vue.createApp(popup, { ...props, onClosed: events.closed });
		app.mount(container);
		const dispose = () => {
			app.unmount();
			container.remove();
			popupDisposers.delete(dispose);
		};
		popupDisposers.add(dispose);
		return { dispose };
	});
	const search = vue.defineComponent({
		props: { 'open': Boolean },
		emits: ['close'],
		setup(props, { emit }) {
			const input = vue.ref<HTMLInputElement | null>(null);
			vue.watch(() => props.open, async shown => {
				if (shown) {
					await vue.nextTick();
					input.value?.focus();
				}
			});
			return () => props.open ? vue.h('input', {
				ref: input,
				'data-settings-search-overlay': '',
				'data-search-input': '',
				onKeydown: (event: KeyboardEvent) => {
					if (event.key === 'Tab') emit('close', { reason: 'tab', direction: event.shiftKey ? 'previous' : 'next' });
					if (event.key === 'Escape') emit('close', { reason: 'escape' });
				},
			}) : null;
		},
	});
	return { router, activeRouter: router, createRouter, pushes, getHatagoesOrigin, empty, page, category, popup, uiSurface, requestDiscard, search, openPopup, popupDisposers, width: 1024, animation: vue.ref(true), deviceKind: vue.ref('desktop') };
});

vi.mock('@/router.js', () => ({ mainRouter: fixtures.router, useRouter: () => fixtures.activeRouter }));
vi.mock('@/preferences.js', () => ({ prefer: { r: { animation: fixtures.animation, overridedDeviceKind: fixtures.deviceKind } } }));
vi.mock('@/preferences/utility.js', () => ({ getPreferencesProfileMenu: () => [] }));
vi.mock('@/utility/clear-cache.js', () => ({ clearCache: vi.fn() }));
vi.mock('@/signout.js', () => ({ signout: vi.fn(), signoutAll: vi.fn() }));
vi.mock('@/page.js', () => ({ definePage: vi.fn(), provideReactiveMetadata: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/os.js', () => ({ confirm: vi.fn(), popup: fixtures.openPopup, popupMenu: vi.fn(), claimZIndex: () => 100 }));
vi.mock('@/utility/intl-string.js', () => ({ initIntlString: vi.fn().mockResolvedValue(undefined), compareStringEquals: (a: string, b: string) => a === b, normalizeStringWithHiragana: (value: string) => value }));
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as Locale) };
});
vi.mock('search-index:settings', () => ({ searchIndexes: [] }));
vi.mock('search-index-v2:settings', () => ({ settingsControlSearchIndexV2: [] }));
vi.mock('./settings-preferences-search-index.js', () => ({ mergeRedesignedPreferenceSearchItems: () => [], redesignedPreferenceStableIdAliases: () => [], settingsDestinationCatalogItemsV2: () => [], suppressLegacyPreferenceSearchMarkers: vi.fn() }));
vi.mock('./SettingsCategorySurface.vue', () => ({ default: fixtures.category }));
vi.mock('./SettingsPopupBridge.vue', () => ({ default: fixtures.popup }));
vi.mock('./SettingsSearchPanel.vue', () => ({ default: fixtures.search }));
vi.mock('./SettingsCategoryExplainer.vue', () => ({ default: fixtures.empty }));
vi.mock('./SettingsNavigationNotice.vue', () => ({ default: fixtures.empty }));
vi.mock('./SettingsRelatedLinks.vue', () => ({ default: fixtures.empty }));
vi.mock('./HatasabaUi2SettingsSurface.vue', () => ({ default: fixtures.uiSurface }));
vi.mock('./SettingsPreferencesSurface.vue', () => ({ default: fixtures.empty }));
vi.mock('./SettingsServiceConnectionSurface.vue', () => ({ default: fixtures.empty }));

import SettingsShell from './index.vue';
import type { App } from 'vue';
import type { Locale } from '../../../../../locales/index.js';

const mounted: Array<{ app: App; container: HTMLDivElement }> = [];
const resizeCallbacks = new Map<Element, Set<(width: number) => void>>();
let originalStartViewTransition: PropertyDescriptor | undefined;

async function settle() {
	for (let index = 0; index < 6; index++) await nextTick();
}

async function mountShell(path = '/settings', router = fixtures.router) {
	fixtures.activeRouter = router;
	router.replaceByPath(path);
	const app = createApp(SettingsShell);
	app.component('PageWithHeader', fixtures.page);
	app.component('NestedRouterView', fixtures.empty);
	app.component('MkAvatar', fixtures.empty);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	await settle();
	return container;
}

function button(container: HTMLElement, selector: string): HTMLButtonElement {
	const element = container.querySelector<HTMLButtonElement>(selector);
	if (element == null) throw new Error(`Missing button: ${selector}`);
	return element;
}

function resizeShell(container: HTMLElement, width: number) {
	const root = container.querySelector<HTMLElement>('[data-smartphone]');
	const callbacks = root == null ? undefined : resizeCallbacks.get(root);
	if (callbacks == null || callbacks.size === 0) throw new Error('Settings shell is not observed');
	fixtures.width = width;
	for (const notify of callbacks) notify(width);
}

function deferredNativeTransition() {
	let update: (() => Promise<void>) | undefined;
	let finish: (() => void) | undefined;
	const updateCallbackDone = new Promise<void>(resolve => { finish = resolve; });
	const skipTransition = vi.fn();
	const start = vi.fn((callback: () => Promise<void>) => {
		update = callback;
		return { ready: Promise.resolve(), finished: updateCallbackDone, updateCallbackDone, skipTransition };
	});
	Object.defineProperty(window.document, 'startViewTransition', { value: start, configurable: true });
	return {
		start,
		skipTransition,
		async complete() {
			if (update == null || finish == null) throw new Error('Native transition callback was not scheduled');
			await update();
			finish();
			await settle();
		},
	};
}

const externalPaths = ['/', '/hatask', '/hatady', '/hatafeed', '/hatagoes'] as const;

beforeEach(() => {
	originalStartViewTransition = Object.getOwnPropertyDescriptor(window.document, 'startViewTransition');
	fixtures.animation.value = true;
	fixtures.deviceKind.value = 'desktop';
	fixtures.width = 1024;
	fixtures.openPopup.mockClear();
	fixtures.requestDiscard.mockReset().mockResolvedValue(true);
	fixtures.router.navHook = null;
	fixtures.router.replaceByPath('/settings');
	fixtures.activeRouter = fixtures.router;
	fixtures.pushes.length = 0;
	resizeCallbacks.clear();
	vi.spyOn(fixtures.router, 'pushByPath');
	vi.stubGlobal('ResizeObserver', class {
		private observed = new Map<Element, (width: number) => void>();
		constructor(private callback: (entries: { target: Element; contentRect: { width: number } }[]) => void) {}
		observe(target: Element) {
			this.unobserve(target);
			const notify = (width: number) => this.callback([{ target, contentRect: { width } }]);
			this.observed.set(target, notify);
			const callbacks = resizeCallbacks.get(target) ?? new Set<(width: number) => void>();
			callbacks.add(notify);
			resizeCallbacks.set(target, callbacks);
			notify(fixtures.width);
		}
		disconnect = vi.fn(() => {
			for (const target of this.observed.keys()) this.unobserve(target);
		});
		unobserve = vi.fn((target: Element) => {
			const notify = this.observed.get(target);
			if (notify == null) return;
			const callbacks = resizeCallbacks.get(target);
			callbacks?.delete(notify);
			if (callbacks?.size === 0) resizeCallbacks.delete(target);
			this.observed.delete(target);
		});
	});
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
});

afterEach(async () => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	for (const dispose of fixtures.popupDisposers) dispose();
	await settle();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	if (originalStartViewTransition != null) Object.defineProperty(window.document, 'startViewTransition', originalStartViewTransition);
	else Reflect.deleteProperty(window.document, 'startViewTransition');
});

describe('settings shell DOM focus', () => {
	it.each([
		{ deviceKind: 'smartphone', width: 375 },
		...['desktop', 'tablet'].flatMap(deviceKind => [375, 600].map(width => ({ deviceKind, width }))),
	])('$deviceKind・幅$widthではカテゴリを開くと一覧を外し、戻ったホームで選択元へfocusを復元する', async ({ deviceKind, width }) => {
		fixtures.deviceKind.value = deviceKind;
		fixtures.width = width;
		fixtures.animation.value = false;
		const container = await mountShell();
		expect(container.querySelectorAll('[data-settings-category-id]')).toHaveLength(13);
		const category = button(container, '[data-settings-category-id="appearance"]');
		category.focus();
		category.click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings?category=appearance');
		expect(category.isConnected).toBe(false);
		expect(container.querySelector('aside')).toBeNull();
		expect(window.document.activeElement).toBe(container.querySelector('main'));
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		expect(container.querySelectorAll('[data-settings-category-id]')).toHaveLength(13);
		expect(window.document.activeElement).toBe(button(container, '[data-settings-category-id="appearance"]'));
	});

	it.each(['smartphone', 'desktop', 'tablet'].flatMap(deviceKind => ['/settings?category=profile', '/settings/profile'].map(path => ({ deviceKind, path }))))('幅375の$deviceKindで $path を直接開いても本文のみ表示しホームへ戻れる', async ({ deviceKind, path }) => {
		fixtures.deviceKind.value = deviceKind;
		fixtures.width = 375;
		fixtures.animation.value = false;
		const container = await mountShell(path);
		expect(container.querySelector('aside')).toBeNull();
		expect(container.querySelector('main')?.style.display).not.toBe('none');
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		expect(window.document.activeElement).toBe(button(container, '[data-settings-category-id="profile"]'));
	});

	it.each(['desktop', 'tablet'])('幅1024の %s ではカテゴリ一覧を残し、スマホへの切り替えで本文のrouteを維持する', async deviceKind => {
		fixtures.deviceKind.value = deviceKind;
		fixtures.width = 1024;
		const container = await mountShell('/settings?category=apps');
		expect(container.querySelector('aside')).not.toBeNull();
		expect(button(container, '[data-settings-category-id="apps"]').isConnected).toBe(true);
		fixtures.deviceKind.value = 'smartphone';
		await settle();
		expect(container.querySelector('aside')).toBeNull();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings?category=apps');
		expect(button(container, '[data-settings-destination-id="hata-hatady"]').isConnected).toBe(true);
	});

	it.each(['desktop', 'tablet'])('%sで幅601→600→375→601を通知しても本文とrouteを維持し一覧だけを切り替える', async deviceKind => {
		fixtures.deviceKind.value = deviceKind;
		fixtures.width = 601;
		const container = await mountShell('/settings?category=apps');
		const main = container.querySelector('main');
		const content = button(container, '[data-settings-destination-id="hata-hatady"]');
		content.focus();
		expect(container.querySelector('aside')).not.toBeNull();
		for (const width of [600, 375, 601]) {
			resizeShell(container, width);
			await settle();
			if (width <= 600) expect(container.querySelector('aside')).toBeNull();
			else expect(container.querySelector('aside')).not.toBeNull();
			expect(container.querySelector('main')).toBe(main);
			expect(button(container, '[data-settings-destination-id="hata-hatady"]')).toBe(content);
			expect(window.document.activeElement).toBe(content);
			expect(fixtures.router.getCurrentFullPath()).toBe('/settings?category=apps');
		}
		expect(fixtures.router.pushByPath).not.toHaveBeenCalled();
	});

	it.each(['smartphone', 'desktop', 'tablet'].flatMap(deviceKind => ['Tab', 'Escape'].map(key => ({ deviceKind, key }))))('幅375の$deviceKindのサブメニューで検索を$keyで閉じてもfocusが非表示のカテゴリへ逃げない', async ({ deviceKind, key }) => {
		fixtures.deviceKind.value = deviceKind;
		fixtures.width = 375;
		const container = await mountShell('/settings?category=apps');
		const searchTrigger = button(container, 'header button:has(.ti-search)');
		searchTrigger.focus();
		searchTrigger.click();
		await settle();
		const input = window.document.querySelector<HTMLInputElement>('[data-search-input]');
		expect(input).not.toBeNull();
		expect(window.document.activeElement).toBe(input);
		input?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		await settle();
		expect(window.document.activeElement).toBe(key === 'Escape' ? searchTrigger : button(container, 'header button:has(.ti-settings-2)'));
		expect(container.querySelector('aside')).toBeNull();
	});

	it('Hatagoesの出口で設定へ戻った後、設定出口からHatagoesへ循環しない', async () => {
		fixtures.animation.value = false;
		const container = await mountShell();
		fixtures.router.pushByPath('/hatagoes');
		await settle();
		expect(fixtures.getHatagoesOrigin(fixtures.router)).toBe('/settings');
		fixtures.router.pushByPath(fixtures.getHatagoesOrigin(fixtures.router));
		await settle();
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/');
		expect(fixtures.pushes).toEqual(['/hatagoes', '/settings', '/']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(3);
	});

	it.each(externalPaths)('設定から %s への通常移動を一度だけ確定し、設定へ戻さない', async path => {
		await mountShell('/settings?category=apps');
		fixtures.router.pushByPath(path);
		await settle();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe(path);
		expect(fixtures.pushes).toEqual([path]);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(1);
	});

	it.each(externalPaths.flatMap(path => [{ path, flushBeforeCallback: true }, { path, flushBeforeCallback: false }]))('外部 $path へ移動後の古いnative callbackを破棄する（Vue更新待ち=$flushBeforeCallback）', async ({ path, flushBeforeCallback }) => {
		const transition = deferredNativeTransition();
		const container = await mountShell();
		button(container, '[data-settings-category-id="appearance"]').click();
		await settle();
		expect(transition.start).toHaveBeenCalledTimes(1);
		fixtures.router.pushByPath(path);
		if (flushBeforeCallback) await settle();
		const externalButton = window.document.createElement('button');
		container.append(externalButton);
		externalButton.focus();
		await transition.complete();
		expect(fixtures.router.getCurrentFullPath()).toBe(path);
		expect(fixtures.pushes).toEqual([path]);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(1);
		expect(window.document.activeElement).toBe(externalButton);
		expect(transition.skipTransition).toHaveBeenCalledTimes(1);
	});

	it.each([true, false])('外部へ出て同じ設定routeへ戻っても古いnative callbackを復活させない（Vue更新待ち=%s）', async flushBeforeReturn => {
		const transition = deferredNativeTransition();
		const container = await mountShell();
		button(container, '[data-settings-category-id="appearance"]').click();
		await settle();
		expect(transition.start).toHaveBeenCalledTimes(1);
		fixtures.router.pushByPath('/hatask');
		if (flushBeforeReturn) await settle();
		fixtures.router.pushByPath('/settings');
		await transition.complete();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		expect(fixtures.pushes).toEqual(['/hatask', '/settings']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(2);
		expect(transition.skipTransition).toHaveBeenCalledTimes(1);
	});

	it.each([1024, 375])('変更確認の承認を待つ間に設定外へ出たら、承認後もpopupを開き直さない（幅=%s）', async width => {
		fixtures.width = width;
		let approve: ((value: boolean) => void) | undefined;
		fixtures.requestDiscard.mockImplementationOnce(() => new Promise<boolean>(resolve => { approve = resolve; }));
		const container = await mountShell('/settings/hata-custom');
		button(container, '[data-ui2-popup]').click();
		await settle();
		expect(fixtures.requestDiscard).toHaveBeenCalledTimes(1);
		fixtures.router.pushByPath('/hatask');
		await settle();
		if (approve == null) throw new Error('Draft discard confirmation was not requested');
		approve(true);
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/hatask');
		expect(window.document.querySelector('[data-close-popup]')).toBeNull();
		expect(fixtures.openPopup).not.toHaveBeenCalled();
		expect(fixtures.pushes).toEqual(['/hatask']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(1);
	});

	it('studio移動の変更確認を待つ間に設定外へ出たら、承認後にstudioへ引き戻さない', async () => {
		let approve: ((value: boolean) => void) | undefined;
		fixtures.requestDiscard.mockImplementationOnce(() => new Promise<boolean>(resolve => { approve = resolve; }));
		const container = await mountShell('/settings/hata-custom');
		button(container, '[data-ui2-studio]').click();
		await settle();
		expect(fixtures.requestDiscard).toHaveBeenCalledTimes(1);
		fixtures.router.pushByPath('/hatask');
		await settle();
		if (approve == null) throw new Error('Draft discard confirmation was not requested');
		approve(true);
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/hatask');
		expect(fixtures.pushes).toEqual(['/hatask']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(1);
	});

	it.each(externalPaths.flatMap(path => [{ path, width: 1024 }, { path, width: 375 }]))('popup表示から $path へ移動すると閉じ、設定へ戻っても再表示しない（幅=$width）', async ({ path, width }) => {
		fixtures.width = width;
		fixtures.animation.value = false;
		const container = await mountShell('/settings?category=apps');
		button(container, '[data-settings-destination-id="hata-hatady"]').click();
		await settle();
		const oldCloseButton = button(window.document.body, '[data-close-popup]');
		expect(oldCloseButton.isConnected).toBe(true);
		fixtures.router.pushByPath(path);
		await settle();
		expect(oldCloseButton.isConnected).toBe(false);
		expect(window.document.querySelector('[data-close-popup]')).toBeNull();
		oldCloseButton.click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe(path);
		fixtures.router.pushByPath('/settings?category=apps');
		await settle();
		expect(window.document.querySelector('[data-close-popup]')).toBeNull();
		expect(button(container, '[data-settings-destination-id="hata-hatady"]').isConnected).toBe(true);
		expect(fixtures.openPopup).toHaveBeenCalledTimes(width === 375 ? 1 : 0);
		expect(fixtures.pushes).toEqual([path, '/settings?category=apps']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(2);
	});

	it('カテゴリを複数回移っても、一覧の戻る出口は設定内の履歴を巡回しない', async () => {
		fixtures.animation.value = false;
		const container = await mountShell();
		for (const id of ['appearance', 'timeline', 'post']) {
			button(container, `[data-settings-category-id="${id}"]`).click();
			await settle();
		}
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/');
		expect(fixtures.pushes).toEqual(['/settings?category=appearance', '/settings?category=timeline', '/settings?category=post', '/settings', '/']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledTimes(5);
	});

	it('デッキの別窓hookがあってもmain設定の出口は別窓を増やさずTLへ出る', async () => {
		const openedWindows: string[] = [];
		fixtures.router.navHook = (path, flag) => {
			if (flag === 'forcePage') return false;
			openedWindows.push(path);
			return true;
		};
		const container = await mountShell();
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/');
		expect(fixtures.pushes).toEqual(['/']);
		expect(fixtures.router.pushByPath).toHaveBeenCalledExactlyOnceWith('/', 'forcePage');
		expect(openedWindows).toEqual([]);
	});

	it('独立した設定windowの出口はlocal routerを使いmainのデッキhookを呼ばない', async () => {
		const openedWindows: string[] = [];
		fixtures.router.navHook = (path, flag) => {
			if (flag === 'forcePage') return false;
			openedWindows.push(path);
			return true;
		};
		const localRouter = fixtures.createRouter();
		const localPush = vi.spyOn(localRouter, 'pushByPath');
		const container = await mountShell('/settings', localRouter);
		button(container, 'header button:has(.ti-arrow-left)').click();
		await settle();
		expect(localRouter.getCurrentFullPath()).toBe('/');
		expect(localPush).toHaveBeenCalledTimes(1);
		expect(localPush.mock.calls.map(([path, flag]) => ({ path, flag }))).toEqual([{ path: '/', flag: undefined }]);
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		expect(fixtures.router.pushByPath).not.toHaveBeenCalled();
		expect(openedWindows).toEqual([]);
	});

	it('カテゴリ選択はtabindex=-1の本文へ実際にfocusを移す', async () => {
		fixtures.animation.value = false;
		const container = await mountShell();
		button(container, '[data-settings-category-id="appearance"]').click();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings?category=appearance');
		expect(window.document.activeElement).toBe(container.querySelector('main'));
	});

	it('native遷移のcallbackが遅れても途中で開いた検索のfocusとrouteを奪わない', async () => {
		let update: (() => Promise<void>) | undefined;
		let finishUpdate: (() => void) | undefined;
		const updateCallbackDone = new Promise<void>(resolve => { finishUpdate = resolve; });
		const startTransition = vi.fn((callback: () => Promise<void>) => {
			update = callback;
			return { ready: Promise.resolve(), finished: updateCallbackDone, updateCallbackDone, skipTransition: vi.fn() };
		});
		Object.defineProperty(window.document, 'startViewTransition', { value: startTransition, configurable: true });
		const container = await mountShell();
		button(container, '[data-settings-category-id="appearance"]').click();
		await settle();
		expect(startTransition).toHaveBeenCalledTimes(1);
		button(container, 'header button:has(.ti-search)').click();
		await settle();
		const searchInput = window.document.querySelector('[data-search-input]');
		expect(searchInput).not.toBeNull();
		expect(window.document.activeElement).toBe(searchInput);
		await update?.();
		finishUpdate?.();
		await settle();
		expect(fixtures.router.getCurrentFullPath()).toBe('/settings');
		expect(window.document.activeElement).toBe(searchInput);
	});

	it('埋め込みpopupから閉じると、再描画された元のdestinationボタンへfocusを戻す', async () => {
		fixtures.animation.value = false;
		const container = await mountShell('/settings?category=apps');
		const opener = button(container, '[data-settings-destination-id="hata-hatady"]');
		opener.focus();
		opener.click();
		await settle();
		expect(opener.isConnected).toBe(false);
		expect(window.document.activeElement).toBe(container.querySelector('main'));
		button(container, '[data-close-popup]').click();
		await settle();
		const restored = button(container, '[data-settings-destination-id="hata-hatady"]');
		expect(restored).not.toBe(opener);
		expect(window.document.activeElement).toBe(restored);
	});

	it('スマホ幅ではfocusしないクリックでもpopupを閉じると押したdestinationボタンへ戻る', async () => {
		fixtures.width = 375;
		fixtures.animation.value = false;
		const container = await mountShell('/settings?category=apps');
		const opener = button(container, '[data-settings-destination-id="hata-hatady"]');
		expect(window.document.activeElement).not.toBe(opener);
		opener.click();
		await settle();
		expect(fixtures.openPopup).toHaveBeenCalledTimes(1);
		const closeButton = button(window.document.body, '[data-close-popup]');
		closeButton.focus();
		closeButton.click();
		await settle();
		expect(opener.isConnected).toBe(true);
		expect(closeButton.isConnected).toBe(false);
		expect(window.document.activeElement).toBe(opener);
	});
});
