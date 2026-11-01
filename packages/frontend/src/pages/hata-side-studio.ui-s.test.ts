/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, computed, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataSideStudio from './hata-side-studio.vue';
import type { App, PropType, Ref } from 'vue';
import type { HataSideGroup, HataSideStudioStore } from '@/utility/hata-side-studio.js';
import Hk3SideNav from '@/components/hataskey3/Hk3SideNav.vue';
import { HK3_THEME_CONTEXT, hk3ThemeStyle } from '@/components/hataskey3/hk3-theme.js';
import { HATA_SIDE_STUDIO_FORMAT_VERSION, HATA_SIDE_STUDIO_STORAGE_KEY, createButton, createDefaultProfile, hataSideStudioStore } from '@/utility/hata-side-studio.js';
import { i18n } from '@/i18n.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@/i18n.js', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { load } = await import('js-yaml');
	const locale = load(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Record<string, unknown>;
	const format = (value: unknown): unknown => value == null ? value : typeof value === 'string'
		? (params: Record<string, string>) => value.replace(/\{(\w+)\}/gu, (_match, name: string) => params[name] ?? '')
		: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, format(child)]));
	return { i18n: { ts: locale, tsx: format(locale) } };
});
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => { storage.set(key, value); },
	removeItem: (key: string) => { storage.delete(key); },
} }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: {
		animation: ref(false),
		hataskeyUi3SideMenuBackground: ref(false),
		'simpleUi.sidebar': ref([
			{ id: 'timeline', icon: 'ti ti-home', label: 'Timeline', group: 'basic' },
			{ id: 'notifications', icon: 'ti ti-bell', label: 'Notifications', group: 'basic' },
			{ id: 'externalNotifications', icon: 'ti ti-bell', label: 'External notifications', group: 'basic' },
			{ id: 'hatask', icon: 'ti ti-check', label: 'Hatask', group: 'hata' },
		]),
		'simpleUi.deckMode': ref(false),
	} } };
});
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/instance.js', () => ({ instance: { name: 'Hataskey', iconUrl: null, federation: 'none' } }));
vi.mock('@/router.js', () => {
	const router = { currentRoute: { value: { path: '/hata-side-studio' } }, navHook: null, pushByPath: vi.fn(), replace: vi.fn(), push: vi.fn() };
	return { mainRouter: router, useRouter: () => router };
});
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
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		inheritAttrs: false,
		props: { modelValue: { type: Array as PropType<Array<{ id: string }>>, required: true }, itemKey: String },
		setup: (props, { attrs, slots }) => () => h('div', attrs, props.modelValue.map((element, index) => slots.item?.({ element, index }))),
	}) };
});

const copy = i18n.ts._hata._hataSideStudio._main;
const apps: Array<{ app: App<Element>; host: HTMLDivElement }> = [];

function fixture(): { store: HataSideStudioStore; group: HataSideGroup } {
	const source = [
		{ id: 'timeline', icon: 'ti ti-home', label: 'Timeline', group: 'basic' },
		{ id: 'notifications', icon: 'ti ti-bell', label: 'Notifications', group: 'basic' },
		{ id: 'externalNotifications', icon: 'ti ti-bell', label: 'External notifications', group: 'basic' },
		{ id: 'hatask', icon: 'ti ti-check', label: 'Hatask', group: 'hata' },
	];
	const profile = createDefaultProfile(source);
	const group = profile.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group');
	if (!group) throw new Error('group fixture missing');
	const search = createButton({ id: 'search', icon: 'ti ti-search', label: 'Search' });
	Object.assign(search, { size: 'large', shape: 'pill', background: '#123456', border: '#654321', foreground: '#fefefe', gradientEnabled: true, gradientTo: '#abcdef', gradientAngle: 205, rotation: 7 });
	group.children = [search, ...group.children];
	group.columns = 1;
	group.masonry = true;
	group.background = '#102030';
	profile.expanded.parallax = true;
	profile.postButton.gradientEnabled = true;
	profile.postButton.gradientTo = '#aabbcc';
	return { store: { version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profile.id, profiles: [profile] }, group };
}

async function flush() { await nextTick(); await Promise.resolve(); await nextTick(); }

async function mountStudio(uiS = false, goesActive?: Ref<boolean>) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const mode = ref<'light' | 'dark'>('light');
	const theme = computed(() => hk3ThemeStyle(mode.value));
	const app = createApp({ setup: () => () => h(HataSideStudio) });
	if (uiS) app.provide(HK3_THEME_CONTEXT, theme);
	if (goesActive) app.provide(HATA_GOES_HOST, { active: goesActive, register: () => () => {}, changed: vi.fn() });
	app.mount(host);
	apps.push({ app, host });
	await flush();
	return { host, mode };
}

function buttonByText(root: ParentNode, label: string): HTMLButtonElement {
	const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label);
	if (!button) throw new Error(`Missing button: ${label}`);
	return button;
}

beforeEach(() => {
	storage.clear();
	storage.set('hataSideStudioTutorialDone', '1');
	storage.set('ui', 'simple');
	vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
});
afterEach(() => {
	for (const { app, host } of apps.splice(0)) { app.unmount(); host.remove(); }
	vi.unstubAllGlobals();
});

describe('HataSideStudio in Hataskey UI and UI S', () => {
	test('keeps the unload warning for unsaved edits while another HataGoes app is active', async () => {
		const { store, group } = fixture();
		group.children[0].size = 'normal';
		storage.set(HATA_SIDE_STUDIO_STORAGE_KEY, JSON.stringify(store));
		const active = ref(true);
		const { host } = await mountStudio(false, active);
		const clean = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(clean);
		expect(clean.defaultPrevented).toBe(false);
		host.querySelector<HTMLElement>(`[data-group-id="${group.id}"]`)?.click();
		await flush();
		buttonByText(host, copy.grid).click();
		await flush();
		active.value = false;
		await flush();
		const dirty = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(dirty);
		expect(dirty.defaultPrevented).toBe(true);
	});

	test('without the UI S provider, legacy appearance controls and custom search preview remain', async () => {
		const { store, group } = fixture();
		storage.set(HATA_SIDE_STUDIO_STORAGE_KEY, JSON.stringify(store));
		const { host } = await mountStudio();
		const root = host.firstElementChild as HTMLElement;
		expect(root.hasAttribute('data-ui-s')).toBe(false);
		expect(root.querySelector('[data-parallax="on"]')).not.toBeNull();
		expect(root.querySelector(`[data-group-id="${group.id}"][data-masonry="on"]`)).not.toBeNull();
		expect(root.querySelector('input[type="search"]')).not.toBeNull();
		expect(root.textContent).toContain(copy.parallaxBeta);
		expect(root.textContent).toContain(copy.twoColorGradient);
		const search = group.children[0];
		root.querySelector<HTMLElement>(`[data-node-id="${search.id}"]`)?.click();
		await flush();
		expect(root.textContent).toContain(copy.shape);
		expect(root.textContent).toContain(copy.rotation);
	});

	test('UI S injects the same reactive theme into the root and both Teleport wrappers', async () => {
		const { store, group } = fixture();
		storage.set(HATA_SIDE_STUDIO_STORAGE_KEY, JSON.stringify(store));
		const { host, mode } = await mountStudio(true);
		const root = host.firstElementChild as HTMLElement;
		const wrappers = [...window.document.body.querySelectorAll<HTMLElement>('[data-ui-s="true"]')];
		expect(wrappers).toHaveLength(3);
		expect(wrappers).toContain(root);
		for (const element of wrappers) {
			expect(element.style.getPropertyValue('--hk3-bg')).toBe(hk3ThemeStyle('light')['--hk3-bg']);
			expect(element.style.getPropertyValue('--MI_THEME-accent')).toBe(hk3ThemeStyle('light')['--MI_THEME-accent']);
		}
		mode.value = 'dark';
		await flush();
		for (const element of wrappers) {
			expect(element.style.getPropertyValue('--hk3-bg')).toBe(hk3ThemeStyle('dark')['--hk3-bg']);
			expect(element.style.getPropertyValue('--MI_THEME-accent')).toBe(hk3ThemeStyle('dark')['--MI_THEME-accent']);
		}
		expect(root.querySelector('[data-parallax="off"]')).not.toBeNull();
		expect(root.querySelector(`[data-group-id="${group.id}"][data-masonry="on"]`)).toBeNull();
		expect(root.querySelector('input[type="search"]')).toBeNull();
		expect(root.textContent).not.toContain(copy.parallaxBeta);
		expect(root.textContent).not.toContain(copy.twoColorGradient);
	});

	test('UI S column edits preserve saved legacy masonry and appearance values', async () => {
		const { store, group } = fixture();
		// Multiple columns cannot contain a large button, so start with a normal-sized legacy button.
		group.children[0].size = 'normal';
		const original = structuredClone(store.profiles[0]);
		storage.set(HATA_SIDE_STUDIO_STORAGE_KEY, JSON.stringify(store));
		const { host } = await mountStudio(true);
		const root = host.firstElementChild as HTMLElement;
		root.querySelector<HTMLElement>(`[data-group-id="${group.id}"]`)?.click();
		await flush();
		buttonByText(root, copy.grid).click();
		await flush();
		buttonByText(root, copy.save).click();
		await flush();
		const saved = hataSideStudioStore.value.profiles[0];
		const savedGroup = saved.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.id === group.id);
		if (!savedGroup) throw new Error('saved group missing');
		const originalGroup = original.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.id === group.id);
		if (!originalGroup) throw new Error('original group missing');
		expect(savedGroup.columns).toBe(2);
		expect(savedGroup.masonry).toBe(true);
		expect(savedGroup.background).toBe(originalGroup.background);
		expect(savedGroup.children[0]).toMatchObject(originalGroup.children[0]);
		expect(saved.expanded.parallax).toBe(true);
		expect(saved.postButton).toMatchObject(original.postButton);
	});
	test.each([1, 2, 3] as const)('saving %i columns renders the same grid in the live UI S menu', async columns => {
		const { store, group } = fixture();
		group.columns = columns === 1 ? 2 : 1;
		group.children[0].size = 'normal';
		group.children.push(createButton({ id: 'earthquake', icon: 'ti ti-activity', label: '地震・津波情報' }));
		storage.set(HATA_SIDE_STUDIO_STORAGE_KEY, JSON.stringify(store));
		const { host } = await mountStudio(true);
		const liveHost = window.document.createElement('div');
		window.document.body.append(liveHost);
		const app = createApp(Hk3SideNav);
		app.mount(liveHost);
		apps.push({ app, host: liveHost });
		await flush();
		const root = host.firstElementChild as HTMLElement;
		root.querySelector<HTMLElement>(`[data-group-id="${group.id}"]`)!.click();
		await flush();
		buttonByText(root, [copy.oneColumn, copy.grid, copy.threeColumns][columns - 1]).click();
		await flush();
		const previewGrid = root.querySelector<HTMLElement>(`[data-group-id="${group.id}"] [style*="--hss-columns"]`)!;
		expect(previewGrid.style.getPropertyValue('--hss-columns')).toBe(String(columns));
		const liveGrid = liveHost.querySelector('[data-menu-id="earthquake"]')!.parentElement!;
		expect(liveGrid.style.gridTemplateColumns).toBe(`repeat(${group.columns}, minmax(0, 1fr))`);
		buttonByText(root, copy.save).click();
		await flush();
		expect(liveGrid.style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
		expect(liveHost.querySelector('[data-menu-id="earthquake"]')?.textContent).toBe('地震・津波情報');
		expect(root.querySelector('[data-menu-id="earthquake"]')?.textContent).toContain('地震・津波情報');
	});
});
