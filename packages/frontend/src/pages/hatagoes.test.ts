/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, inject, KeepAlive, nextTick, ref } from 'vue';
import Hatagoes from './hatagoes.vue';
import type { PropType } from 'vue';
import { HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';
import { getNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { hatadyDialogSurfaces, hatadyNotice } from '@/utility/hatady-ui.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import type { Nirax } from '@/lib/nirax.js';
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';
import { definePage, provideMetadataReceiver } from '@/page.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';

const fixture = vi.hoisted(() => ({
	initialPath: '/hatagoes',
	router: null as unknown,
	delayedApps: new Set<string>(),
	registrations: new Map<string, () => void>(),
	created: [] as { app: string; kind: string; signal: AbortSignal; surface?: HTMLElement }[],
	settingsCalls: [] as string[],
	results: [] as { kind: string; id: string; closed: () => void }[],
	failResult: false,
	homeActions: [] as string[],
	homeScrolls: 0,
	refreshCount: 0,
	pendingRefresh: null as Promise<void> | null,
	pendingCreate: null as Promise<void> | null,
	closePopup: null as (() => void) | null,
	appearance: null as { theme: string; cssVars: Record<string, string> } | null,
	hataskMode: null as 'light' | 'dark' | null,
	popupClosed: vi.fn(),
}));

vi.mock('@/os.js', () => ({ popup: vi.fn(() => ({ dispose: vi.fn() })), popupMenu: vi.fn() }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn(() => null) }));
vi.mock('@/components/MkHataskeyNotificationToasts.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/hatady-ui.js', async () => {
	const { shallowRef } = await import('vue');
	return { hatadyNotice: shallowRef(null), hatadyDialogSurfaces: shallowRef([]) };
});

vi.mock('@/router.js', async () => {
	const { Nirax } = await import('@/lib/nirax.js');
	const Page = { render: () => null };
	return { useRouter: () => {
		fixture.router ??= new Nirax([{ path: '/', component: Page }, { path: '/hatagoes', component: Page }, { path: '/hataigo', component: Page }], fixture.initialPath, true, Page);
		return fixture.router;
	} };
});
vi.mock('@/i.js', () => ({ $i: { id: 'owner', isAdmin: true, isModerator: false, policies: { canAccessHataFeed: true } } }));
vi.mock('@/di.js', () => ({ DI: { pageWindowClose: Symbol('pageWindowClose'), pageMetadata: Symbol('pageMetadata') } }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/hatagoes-preferences.js', async () => {
	const { ref } = await import('vue');
	return { useHatagoesPreferences: () => ({
		pins: ref([]), hataskPins: ref(['hatask.today', 'hatask.cal', 'hatask.todo', 'hatask.mood', 'hatask.meal']), hataskPinsDesktop: ref(['hatask.today', 'hatask.cal', 'hatask.todo', 'hatask.mood', 'hatask.meal']), appPins: ref([]), cards: ref([]), theme: ref({ theme: 'akatsuki', darkMode: false, autoTheme: true }),
		ready: ref(true), saving: ref(false), error: ref(false), load: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined),
	}) };
});
vi.mock('@/components/hatagoes/HatagoesPane.vue', async () => {
	const { defineComponent, h, onMounted, onUnmounted } = await import('vue');
	return { default: defineComponent({
		props: { app: { type: String, required: true }, path: { type: String, required: true }, active: Boolean, hatadyHeaderDate: Object, hatadyHeaderActions: Object, hatadyHeaderOverview: { type: Object as PropType<HTMLElement | null>, default: null } },
		emits: ['register', 'unregister', 'appearance', 'mode'],
		setup(props, { emit }) {
			const session = inject(HATA_GOES_SESSION, null);
			definePage(() => ({ title: `Embedded ${props.app}` }));
			const bridge = {
				openResult(kind: string, id: string, closed: () => void) {
					if (fixture.failResult) throw new Error('unavailable');
					let untrack = () => {};
					const notifyClosed = () => { untrack(); closed(); };
					untrack = session?.track(notifyClosed) ?? untrack;
					fixture.results.push({ kind, id, closed: notifyClosed });
				},
				recordMood: async (level: number) => { fixture.homeActions.push(`mood:${level}`); },
				water: async (day: string) => { fixture.homeActions.push(`water:${day}`); },
				recordMeal: async (slot: string, signal?: AbortSignal, surface?: HTMLElement) => {
					fixture.homeActions.push(`meal:${slot}`);
					if (!signal || signal.aborted || !surface) throw new Error('Meal capture is not visible');
					const form = window.document.createElement('form');
					form.dataset.mealSlot = slot;
					surface.append(form);
				},
				recordReading: async (bookId: string) => { fixture.homeActions.push(`reading:${bookId}`); },
				openSettings: vi.fn(() => { fixture.settingsCalls.push(props.app); }),
				refresh: vi.fn(() => { fixture.refreshCount++; return fixture.pendingRefresh ?? Promise.resolve(); }),
				create(kind: string, signal: AbortSignal, surface?: HTMLElement) {
					fixture.created.push({ app: props.app, kind, signal, surface });
					return fixture.pendingCreate ?? Promise.resolve();
				},
			};
			const register = () => emit('register', props.app, bridge);
			onMounted(() => {
				if (fixture.appearance && props.app === 'hatask') emit('appearance', fixture.appearance);
				if (fixture.hataskMode && props.app === 'hatask') emit('mode', fixture.hataskMode);
				fixture.registrations.set(props.app, register);
				if (!fixture.delayedApps.has(props.app)) register();
				if (props.app === 'hatask') fixture.closePopup = session?.track(() => fixture.popupClosed()) ?? null;
			});
			onUnmounted(() => { fixture.closePopup?.(); fixture.closePopup = null; emit('unregister', props.app, bridge); });
			return () => h('div', { 'data-pane': props.app, 'data-path': props.path, 'data-active': props.active, 'data-header-ready': !!props.hatadyHeaderDate?.isConnected && !!props.hatadyHeaderActions?.isConnected, 'data-overview-before-bell': props.hatadyHeaderOverview?.nextElementSibling?.getAttribute('aria-label') === '3アプリの通知' });
		},
	}) };
});
vi.mock('@/components/hatagoes/HatagoesHome.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { active: Boolean, launcherApps: Array, recordRevision: Number, decorationHost: Object as PropType<HTMLElement> }, emits: ['recordMood', 'water', 'recordMeal', 'recordReading', 'openApp', 'allApps'], setup(props, { emit, expose }) {
		expose({ scrollToTop: () => { fixture.homeScrolls++; }, markWatered: vi.fn() });
		return () => h('div', { 'data-home-active': props.active, 'data-record-revision': props.recordRevision, 'data-decoration-host': props.decorationHost?.getAttribute('data-hatagoes-root') === '' ? 'shell' : 'missing' }, [
			h('button', { 'data-action': 'mood', onClick: () => emit('recordMood', 3) }),
			h('button', { 'data-action': 'water', onClick: () => emit('water', '2026-10-03') }),
			h('button', { 'data-action': 'meal', onClick: () => emit('recordMeal', 'lunch') }),
			h('button', { 'data-action': 'reading', onClick: () => emit('recordReading', 'book') }),
			h('button', { 'data-action': 'launcher-open', onClick: () => emit('openApp', 'hatask.cal') }),
			h('button', { 'data-action': 'launcher-all', onClick: () => emit('allApps') }),
			h('div', { 'data-launcher-apps': '' }, (props.launcherApps as Array<{ id: string }>).map(screen => screen.id).join(',')),
		]);
	} }) };
});
vi.mock('@/components/hatagoes/HatagoesSearch.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { active: Boolean }, emits: ['close', 'open'], setup(props, { emit }) {
		return () => h('section', { 'data-search-active': String(props.active) }, [
			h('button', { 'aria-label': '検索を閉じる', onClick: () => emit('close') }),
			h('button', { 'aria-label': '検索結果を開く', onClick: () => emit('open', { url: '/hatask?tab=todo', kind: 'todo' }) }),
		]);
	} }) };
});
vi.mock('@/components/hatagoes/HatagoesNotifications.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/hatagoes/HatagoesSettings.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/hatask/HatagoesSupportButton.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ emits: ['open'], setup(_props, { emit }) { return () => h('button', { 'aria-label': '支援情報', onClick: () => emit('open') }); } }) };
});
vi.mock('@/components/hatagoes/HatagoesDialog.vue', async () => {
	const { defineComponent, h, watch } = await import('vue');
	return { default: defineComponent({ props: { open: Boolean }, emits: ['closed'], setup(props, { slots, emit }) {
		watch(() => props.open, open => { if (!open) emit('closed'); });
		const content = slots.default ?? (() => []);
		return () => props.open ? h('div', content()) : null;
	} }) };
});

let cleanup: (() => void) | undefined;

async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function router(): Nirax<never[]> { return fixture.router as Nirax<never[]>; }

function button(scope: ParentNode, label: string): HTMLButtonElement {
	const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label);
	if (!found) throw new Error(`Missing button: ${label}`);
	return found;
}

async function mount(path: string) {
	fixture.initialPath = path;
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp(Hatagoes);
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	await settle();
	return target;
}

async function showCreate(target: HTMLElement) {
	(target.querySelector('[aria-label="作成"]') as HTMLButtonElement).click();
	await settle();
	const dialog = window.document.body.querySelector('[role="dialog"]');
	if (!dialog) throw new Error('Missing create dialog');
	return dialog;
}

beforeEach(() => {
	if (!$i) throw new Error('Missing mock account');
	$i.isAdmin = true;
	$i.isModerator = false;
	fixture.router = null;
	fixture.delayedApps.clear();
	fixture.registrations.clear();
	fixture.created.length = 0;
	fixture.settingsCalls.length = 0;
	fixture.results.length = 0;
	fixture.failResult = false;
	fixture.homeActions.length = 0;
	fixture.homeScrolls = 0;
	fixture.refreshCount = 0;
	fixture.pendingRefresh = null;
	fixture.pendingCreate = null;
	fixture.closePopup = null;
	fixture.appearance = null;
	fixture.hataskMode = null;
	store.r.darkMode.value = false;
	fixture.popupClosed.mockClear();
	hatadyNotice.value = null;
	hatadyDialogSurfaces.value = [];
	window.localStorage.removeItem('hatagoes:create:owner');
	window.localStorage.removeItem('hatagoes:state:owner');
	window.localStorage.removeItem('hataskAkatsukiUsage:owner');
});
afterEach(() => { cleanup?.(); cleanup = undefined; });

describe('HataGoes search popup', () => {
	test.each(['book', 'mediaWork', 'mediaSession', 'log'])('closing %s synchronizes the URL and allows the same result to reopen', async kind => {
		const path = `/hatady?tab=records&hgKind=${kind}&hgId=record`;
		const target = await mount(hatagoesUrl(path));
		expect(fixture.results).toHaveLength(1);
		const capsule = () => target.querySelector<HTMLElement>('[aria-label="画面一覧"] > [class*=screenCapsuleSlot]')!;
		expect(capsule().style.display).toBe('none');
		fixture.results[0].closed(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady?tab=records'));
		expect(capsule().style.display).not.toBe('none');
		router().pushByPath(hatagoesUrl(path)); await settle();
		expect(fixture.results).toHaveLength(2);
	});

	test('an old result close cannot replace a new result or another app', async () => {
		await mount(hatagoesUrl('/hatady?tab=records&hgKind=book&hgId=first'));
		const previous = fixture.results[0];
		const next = hatagoesUrl('/hatady?tab=records&hgKind=book&hgId=second');
		router().pushByPath(next); await settle();
		previous.closed(); await settle();
		expect(router().getCurrentFullPath()).toBe(next);
		router().pushByPath(hatagoesUrl('/hatask?tab=todo')); await settle();
		fixture.results[1].closed(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask?tab=todo'));
	});

	test('a failed detail open releases the URL so it can be retried', async () => {
		fixture.failResult = true;
		const path = hatagoesUrl('/hatady?tab=records&hgKind=log&hgId=missing');
		await mount(path);
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady?tab=records'));
		fixture.failResult = false;
		router().pushByPath(path); await settle();
		expect(fixture.results).toHaveLength(1);
	});

	test('forced detail disposal on KeepAlive exit cannot navigate the inactive shell', async () => {
		const active = ref(true);
		const path = hatagoesUrl('/hatady?tab=records&hgKind=book&hgId=first');
		fixture.initialPath = path;
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Hatagoes) : null }) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		await settle();
		const replace = vi.spyOn(router(), 'replaceByPath');
		active.value = false; await settle();
		expect(replace).not.toHaveBeenCalled();
		expect(router().getCurrentFullPath()).toBe(path);
		replace.mockRestore();
	});

	test('opens above the current app without changing its route and returns focus on close', async () => {
		const path = hatagoesUrl('/hatask?tab=todo');
		const target = await mount(path);
		const trigger = target.querySelector<HTMLButtonElement>('button[aria-label="横断検索"]')!;
		trigger.click(); await settle();
		expect(router().getCurrentFullPath()).toBe(path);
		expect(target.querySelector('[data-pane="hatask"]')?.getAttribute('data-active')).toBe('true');
		expect(window.document.body.querySelector('[data-search-active="true"]')).not.toBeNull();
		(window.document.body.querySelector('[aria-label="検索を閉じる"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(path);
		expect(window.document.body.querySelector('[data-search-active="true"]')).toBeNull();
		expect(window.document.activeElement).toBe(trigger);
	});

	test('renders a direct search URL over Home and closes to Home', async () => {
		const target = await mount('/hatagoes?view=search');
		expect(target.querySelector('[data-home-active="true"]')).not.toBeNull();
		expect(window.document.body.querySelector('[data-search-active="true"]')).not.toBeNull();
		(window.document.body.querySelector('[aria-label="検索を閉じる"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe('/hatagoes');
	});

	test('closes the popup before opening the selected result', async () => {
		const target = await mount('/hatagoes');
		(target.querySelector('[aria-label="横断検索"]') as HTMLButtonElement).click();
		await settle();
		(window.document.body.querySelector('[aria-label="検索結果を開く"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask?tab=todo'));
		expect(window.document.body.querySelector('[data-search-active="true"]')).toBeNull();
	});
});

test.each(['/hatagoes?view=settings', '/hatagoes?view=notifications'])('keeps back and directory controls without an empty app capsule on %s', async path => {
	const target = await mount(path);
	const nav = target.querySelector('nav[aria-label="画面一覧"]')!;
	expect((nav.querySelector('div') as HTMLElement).style.display).toBe('none');
	expect(nav.querySelector('button[aria-label="戻る"]')).not.toBeNull();
	expect(nav.querySelector('button[aria-label="全てのアプリ"]')).not.toBeNull();
});

test.each(['/hatask/intro', '/hata-docs', '/hatask/intro?from=guide#home', '/hata-docs?from=guide#home'])('hides the outer back button only while HataIntro is active at %s', async path => {
	const target = await mount(hatagoesUrl('/hatask'));
	const backButton = () => target.querySelector<HTMLButtonElement>('nav[aria-label="画面一覧"] button[aria-label="戻る"]');
	expect(backButton()).not.toBeNull();
	router().pushByPath(hatagoesUrl(path));
	await settle();
	expect(backButton()).toBeNull();
	expect(target.querySelector('[data-active="true"][data-path]')?.getAttribute('data-path')).toBe(path);
	router().pushByPath('/hatagoes?view=settings');
	await settle();
	expect(backButton()).not.toBeNull();
	backButton()?.click();
	await settle();
	expect(router().getCurrentFullPath()).toBe(hatagoesUrl(path));
	expect(backButton()).toBeNull();
});

describe('HataGoes common create', () => {
	test('Hatask support button opens the existing support page', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		(target.querySelector('[aria-label="支援情報"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask?tab=support'));
	});
	test('feeds eligible ranked screens to Home and opens launcher choices as explicit destinations', async () => {
		const target = await mount('/hatagoes');
		const launcher = target.querySelector('[data-launcher-apps]')!.textContent ?? '';
		expect(launcher.startsWith('hatask.cal,hatask.todo,hatask.mood')).toBe(true);
		expect(launcher).not.toContain('hatask.scratchpad');
		(target.querySelector('[data-action="launcher-open"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask?tab=cal'));
		(target.querySelector('button[aria-label="HataGoesホーム"]') as HTMLButtonElement).click();
		await settle();
		(target.querySelector('[data-action="launcher-all"]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('screens'));
		expect(window.document.body.querySelector('#hatagoes-screens-heading')?.textContent).toBe('全てのアプリ');
	});

	test('shows Home header actions and returns to top without the retired feed header', async () => {
		const target = await mount('/hatagoes');
		const header = target.querySelector('header')!;
		expect(target.querySelector('[data-home-active]')?.getAttribute('data-decoration-host')).toBe('shell');
		for (const label of ['横断検索', '3アプリの通知', '設定', '再読み込み']) {
			expect(header.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
		}
		expect(header.querySelector('small')).toBeNull();
		expect(header.querySelector('button[aria-label="先頭へ戻る"]')).toBeNull();
		const homeScrolls = fixture.homeScrolls;
		(header.querySelector('button[class*=brand]') as HTMLButtonElement).click();
		expect(router().getCurrentFullPath()).toBe('/hatagoes');
		expect(fixture.homeScrolls).toBe(homeScrolls + 1);
	});

	test('app tabs always open their Home while explicit screen routes remain available', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const tab = (label: string) => target.querySelector<HTMLButtonElement>(`nav[aria-label="モバイルアプリ"] button[aria-label="${label}"]`)!;
		expect(tab('HataGoesホーム').getAttribute('aria-label')).toBe('HataGoesホーム');
		expect(tab('HataGoesホーム').textContent).not.toContain('ホーム');
		tab('Hatady').click(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady'));
		router().pushByPath(hatagoesUrl('/hatady?tab=collection')); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady?tab=collection'));
		tab('Hatask').click(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask'));
		tab('Hatady').click(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady'));
		tab('HataFeed').click(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatafeed'));
		tab('HataGoesホーム').click(); await settle();
		expect(tab('HataGoesホーム').textContent).toContain('ホーム');
	});

	test('keeps a light Hatask palette while its embedded appearance is still loading', async () => {
		const target = await mount('/hatagoes');
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]')!;
		expect(shell.dataset.hataskTheme).toBe('akatsuki');
		expect(shell.dataset.hataskMode).toBe('light');
		(target.querySelector('nav[aria-label="モバイルアプリ"] button[aria-label="Hatask"]') as HTMLButtonElement).click();
		await settle();
		expect(shell.dataset.hataskTheme).toBe('akatsuki');
		expect(shell.dataset.hataskMode).toBe('light');
	});

	test.each([
		['light', 'light'], ['light', 'dark'], ['dark', 'light'], ['dark', 'dark'],
	] as const)('keeps independent Home %s and Hatask %s navigation palettes at narrow and wide widths', async (homeMode, appMode) => {
		store.r.darkMode.value = homeMode === 'dark';
		fixture.hataskMode = appMode;
		fixture.appearance = { theme: 'akatsuki', cssVars: {} };
		const target = await mount('/hatagoes');
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]');
		if (!shell) throw new Error('Missing HataGoes shell');
		const nav = shell.querySelector('nav[aria-label="画面一覧"]');
		const openHatask = target.querySelector<HTMLButtonElement>('nav[aria-label="モバイルアプリ"] button[aria-label="Hatask"]');
		const home = target.querySelector<HTMLButtonElement>('nav[aria-label="モバイルアプリ"] button[aria-label="HataGoesホーム"]');
		if (!nav || !openHatask || !home) throw new Error('Missing HataGoes navigation');
		for (const width of [390, 1280]) {
			Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width });
			window.dispatchEvent(new Event('resize'));
			await settle();
			expect(shell.dataset.hataskMode).toBe(homeMode);
			openHatask.click();
			await settle();
			expect(shell.dataset.hataskMode).toBe(appMode);
			expect(nav.closest<HTMLElement>('[data-hatask-mode]')?.dataset.hataskMode).toBe(appMode);
			expect(shell.dataset.narrow).toBe(String(width <= 850));
			home.click();
			await settle();
			expect(shell.dataset.hataskMode).toBe(homeMode);
		}
	});

	test('keeps Home quick actions in their owning apps and Home tab returns to top', async () => {
		const target = await mount('/hatagoes');
		for (const action of ['mood', 'water', 'meal', 'reading']) {
			(target.querySelector(`[data-action="${action}"]`) as HTMLButtonElement).click();
			await settle();
		}
		expect(fixture.homeActions).toEqual(['mood:3', 'water:2026-10-03', 'meal:lunch', 'reading:book']);
		expect(router().getCurrentFullPath()).toBe('/hatagoes');
		expect(target.querySelector('[data-hatagoes-mobile-create] form[data-meal-slot="lunch"]')).not.toBeNull();
		const mobileNav = target.querySelector('nav[aria-label="モバイルアプリ"]')!;
		for (const app of ['ホーム', 'Hatask', 'Hatady', 'HataFeed']) expect(mobileNav.textContent).toContain(app);
		expect(mobileNav.textContent).not.toContain('HataIgo');
		expect(mobileNav.querySelector('button[aria-label="作成を閉じる"]')).not.toBeNull();
		expect(mobileNav.parentElement?.querySelector(':scope > button[aria-label="作成を閉じる"]')).toBeNull();
		(target.querySelector('nav[aria-label="モバイルアプリ"] button[aria-label="HataGoesホーム"]') as HTMLButtonElement).click();
		expect(fixture.homeScrolls).toBe(1);
		expect(target.querySelector('[data-home-active]')?.getAttribute('data-record-revision')).toBe('1');
		(target.querySelector('button[aria-label="再読み込み"]') as HTMLButtonElement).click();
		await settle();
		expect(target.querySelector('[data-home-active]')?.getAttribute('data-record-revision')).toBe('1');
	});

	test('keeps one plus button in the third mobile tab on Home and app screens', async () => {
		const target = await mount('/hatagoes');
		const nav = target.querySelector('nav[aria-label="モバイルアプリ"]')!;
		const labels = () => [...nav.querySelectorAll(':scope > button')].map(item => item.getAttribute('aria-label'));
		expect(labels()).toEqual(['HataGoesホーム', 'Hatask', '作成', 'Hatady', 'HataFeed']);
		const plus = nav.querySelector<HTMLButtonElement>('button[aria-label="作成"]')!;
		(nav.querySelector('button[aria-label="Hatask"]') as HTMLButtonElement).click(); await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask'));
		expect(nav.querySelector('button[aria-label="作成"]')).toBe(plus);
		expect(labels()).toEqual(['HataGoesホーム', 'Hatask', '作成', 'Hatady', 'HataFeed']);
		(nav.querySelector('button[aria-label="HataGoesホーム"]') as HTMLButtonElement).click(); await settle();
		expect(nav.querySelector('button[aria-label="作成"]')).toBe(plus);
		expect(nav.parentElement?.querySelector(':scope > button[aria-label="作成"]')).toBeNull();
		expect(nav.querySelector('button[aria-label="HataIgo"]')).toBeNull();
	});
	test('opens both other apps on mobile Home and resets their disclosure state on reopening', async () => {
		const target = await mount('/hatagoes');
		await showCreate(target);
		const disclosure = (label: string) => button(window.document.body.querySelector('[role="dialog"]')!, label);
		for (const label of ['Hatady', 'HataFeed']) expect(disclosure(label).getAttribute('aria-expanded')).toBe('true');
		disclosure('Hatady').click();
		await settle();
		expect(disclosure('Hatady').getAttribute('aria-expanded')).toBe('false');
		expect(disclosure('HataFeed').getAttribute('aria-expanded')).toBe('true');
		(target.querySelector('[aria-label="作成を閉じる"]') as HTMLButtonElement).click();
		await settle();
		await showCreate(target);
		for (const label of ['Hatady', 'HataFeed']) expect(disclosure(label).getAttribute('aria-expanded')).toBe('true');
	});
	test('joins the mobile create panel to the bottom nav and reuses the same plus button to close it', async () => {
		const target = await mount('/hatagoes');
		const nav = target.querySelector<HTMLElement>('nav[aria-label="モバイルアプリ"]')!.parentElement!;
		const plus = nav.querySelector<HTMLButtonElement>('button[aria-label="作成"]')!;
		expect(plus.parentElement).toBe(nav.querySelector('nav[aria-label="モバイルアプリ"]'));
		expect(plus).toBe(nav.querySelector('nav[aria-label="モバイルアプリ"]')?.querySelectorAll(':scope > button')[2]);
		plus.click();
		await settle();
		const panel = target.querySelector<HTMLElement>('[data-hatagoes-mobile-create]');
		expect(panel?.nextElementSibling).toBe(nav);
		expect(nav.dataset.createExpanded).toBe('true');
		expect(plus.dataset.open).toBe('true');
		expect(plus.getAttribute('aria-label')).toBe('作成を閉じる');
		expect(panel?.querySelector('[aria-label="作成"]')).not.toBeNull();
		const returnFocus = vi.spyOn(plus, 'focus');
		plus.click();
		await settle();
		expect(plus.dataset.open).toBe('false');
		await vi.waitFor(() => expect(target.querySelector('[data-hatagoes-mobile-create]')).toBeNull());
		expect(returnFocus).toHaveBeenCalledWith({ preventScroll: true });
		expect(nav.dataset.createExpanded).toBe('false');
	});

	test('cancels a mobile close when plus is pressed again and closes with Escape', async () => {
		const target = await mount('/hatagoes');
		const nav = target.querySelector<HTMLElement>('nav[aria-label="モバイルアプリ"]')!.parentElement!;
		const plus = nav.querySelector<HTMLButtonElement>('button[aria-label="作成"]')!;
		plus.click(); await settle();
		plus.click(); plus.click();
		await settle();
		expect(target.querySelector('[data-hatagoes-mobile-create]')).not.toBeNull();
		expect(nav.dataset.createExpanded).toBe('true');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(plus.dataset.open).toBe('false');
		await vi.waitFor(() => expect(nav.dataset.createExpanded).toBe('false'));
	});

	test('caps the mobile sheet, preserves an open form across width changes, then adopts the new layout on reopen', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]')!;
		const header = shell.querySelector<HTMLElement>('header')!;
		const screens = shell.querySelector<HTMLElement>('nav[aria-label="画面一覧"]')!;
		const nav = shell.querySelector<HTMLElement>('nav[aria-label="モバイルアプリ"]')!.parentElement!;
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 400 });
		Object.defineProperty(shell, 'clientHeight', { configurable: true, value: 300 });
		Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 60 });
		Object.defineProperty(screens, 'offsetHeight', { configurable: true, value: 70 });
		Object.defineProperty(nav, 'offsetHeight', { configurable: true, value: 60 });
		Object.defineProperty(nav.querySelector('nav'), 'offsetHeight', { configurable: true, value: 60 });
		window.dispatchEvent(new Event('resize'));
		(nav.querySelector('button[aria-label="作成"]') as HTMLButtonElement).click();
		await settle();
		expect(shell.querySelector<HTMLElement>('[data-hatagoes-mobile-create] > div')?.style.maxHeight).toBe('78px');
		const surface = fixture.created.at(-1)?.surface;
		if (!surface) throw new Error('Missing inline create surface');
		const draft = window.document.createElement('input');
		draft.value = '入力途中のToDo';
		surface.append(draft);
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 1000 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(shell.querySelector('[data-hatagoes-mobile-create]')).not.toBeNull();
		expect(fixture.created.at(-1)?.surface).toBe(surface);
		expect(surface.querySelector('input')).toBe(draft);
		expect(draft.value).toBe('入力途中のToDo');
		expect(window.document.body.querySelectorAll('[role="dialog"][aria-label="作成"]')).toHaveLength(1);
		(nav.querySelector('button[data-open="true"]') as HTMLButtonElement).click();
		await settle();
		await vi.waitFor(() => expect(shell.querySelector('[data-hatagoes-mobile-create]')).toBeNull());
		(nav.querySelector('button[aria-label="作成"]') as HTMLButtonElement).click();
		await settle();
		expect(shell.querySelectorAll('[data-hatagoes-mobile-create]')).toHaveLength(0);
		expect(window.document.body.querySelectorAll('[role="dialog"][aria-label="作成"]')).toHaveLength(1);
	});
	test('offers an explicit app or common settings choice and lets cancel preserve the page', async () => {
		const original = hatagoesUrl('/hatafeed?tab=home');
		const target = await mount(original);
		(target.querySelector('button[aria-label="設定"]') as HTMLButtonElement).click();
		await settle();
		const choice = window.document.body.querySelector('[aria-label="設定の選択"]')!;
		expect(choice.textContent).toContain('HataFeed設定に移動しますか？');
		expect(choice.className).toContain('hatady-scope');
		for (const label of ['HataFeed の設定', '共通設定', 'キャンセル']) {
			expect(button(choice, label).querySelector('i[aria-hidden="true"]')).not.toBeNull();
		}
		button(choice, 'キャンセル').click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(original);
		expect(fixture.settingsCalls).toEqual([]);
		(target.querySelector('button[aria-label="設定"]') as HTMLButtonElement).click();
		await settle();
		button(window.document.body.querySelector('[aria-label="設定の選択"]')!, 'HataFeed の設定').click();
		await settle();
		expect(fixture.settingsCalls).toEqual(['hatafeed']);
		(target.querySelector('button[aria-label="設定"]') as HTMLButtonElement).click();
		await settle();
		button(window.document.body.querySelector('[aria-label="設定の選択"]')!, '共通設定').click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('settings'));
	});

	test('uses the Hatask palette in the settings choice popup', async () => {
		const target = await mount(hatagoesUrl('/hatask'));
		(target.querySelector('button[aria-label="設定"]') as HTMLButtonElement).click();
		await settle();
		const choice = window.document.body.querySelector<HTMLElement>('[aria-label="設定の選択"]')!;
		expect(choice.dataset.hataskTheme).toBe('akatsuki');
		expect(choice.dataset.hataskMode).toBe('light');
		expect(button(choice, 'Hatask の設定').querySelector('i[aria-hidden="true"]')).not.toBeNull();
	});

	test('holds a single refresh until the app bridge finishes and keeps the existing notice queue', async () => {
		let finish!: () => void;
		fixture.pendingRefresh = new Promise<void>(resolve => { finish = resolve; });
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const context = getNotificationPageContext();
		expect(context).toBeDefined();
		context?.enqueueStatus('保存しました');
		const refresh = target.querySelector<HTMLButtonElement>('button[aria-label="再読み込み"]')!;
		refresh.click(); refresh.click();
		await settle();
		expect(fixture.refreshCount).toBe(1);
		expect(refresh.disabled).toBe(true);
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		expect(getNotificationPageContext()).toBe(context);
		expect(context?.items.value[0]?.source).toBe('status');
		finish();
		await settle();
		expect(refresh.disabled).toBe(false);
	});

	test('routes Hatady and HataFeed status notices through the shell queue', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=home'));
		const context = getNotificationPageContext()!;
		hatadyNotice.value = { id: 1, message: '記録しました', duration: 5000 };
		await settle();
		expect(context.items.value[0]).toMatchObject({ source: 'status', message: '記録しました' });
		expect(hatadyNotice.value).toBeNull();
		(target.querySelector('button[aria-label="HataFeed"]') as HTMLButtonElement).click();
		await settle();
		hataFeedNotify('更新しました。');
		await settle();
		expect(context.items.value[0]).toMatchObject({ source: 'status', message: '更新しました' });
		expect(context.surface.value?.target.value?.isConnected).toBe(true);
	});
	test('moves the mobile notification host between its fallback and central capsule without changing the outer navigation', async () => {
		const target = await mount('/hatagoes');
		const context = getNotificationPageContext()!;
		const screenNav = target.querySelector('nav[aria-label="画面一覧"]');
		const fallback = context.surface.value?.outline.value;
		expect(fallback).not.toBe(screenNav);
		expect(fallback?.contains(context.surface.value?.target.value ?? null)).toBe(true);
		expect(screenNav?.contains(fallback ?? null)).toBe(true);
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		const central = context.surface.value?.outline.value;
		expect(central).not.toBe(fallback);
		expect(central?.contains(context.surface.value?.target.value ?? null)).toBe(true);
		expect(screenNav?.contains(central ?? null)).toBe(true);
	});
	test('pauses a mobile notice only while a mouse is over its actual notification surface', async () => {
		const target = await mount(hatagoesUrl('/hatafeed?tab=home'));
		const context = getNotificationPageContext()!;
		context.enqueueStatus('更新しました');
		await settle();
		const actualSurface = context.surface.value?.outline.value;
		const bottomApps = target.querySelector('nav[aria-label="モバイルアプリ"]')!;
		const outerNav = target.querySelector('nav[aria-label="画面一覧"]')!;

		function pointer(element: Element, type: string, pointerType: string) {
			const event = new window.Event(type);
			Object.defineProperty(event, 'pointerType', { value: pointerType });
			element.dispatchEvent(event);
		}

		expect(actualSurface).not.toBe(outerNav);
		pointer(bottomApps, 'pointerenter', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(false);
		pointer(outerNav, 'pointerenter', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(false);
		pointer(actualSurface!, 'pointerenter', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(true);
		pointer(actualSurface!, 'pointerleave', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(false);
		pointer(actualSurface!, 'pointerenter', 'touch');
		expect(context.surface.value?.paused?.value).toBe(false);
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]')!;
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 1000 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		const desktopSurface = context.surface.value?.outline.value;
		expect(desktopSurface).not.toBe(actualSurface);
		pointer(actualSurface!, 'pointerenter', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(false);
		pointer(desktopSurface!, 'pointerenter', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(true);
		pointer(desktopSurface!, 'pointerleave', 'mouse');
		expect(context.surface.value?.paused?.value).toBe(false);
	});
	test('holds the notification host through glow exit and cancels the exit for a new notice', async () => {
		await mount(hatagoesUrl('/hatady?tab=home'));
		const context = getNotificationPageContext()!;
		const host = context.surface.value?.target.value as HTMLElement;
		vi.useFakeTimers();
		try {
			context.enqueueStatus('一件目');
			context.height.value = 72;
			await settle();
			expect(host.style.height).toBe('72px');
			context.dismiss(context.items.value[0].id);
			await settle();
			expect(host.style.height).toBe('72px');
			vi.advanceTimersByTime(300);
			context.enqueueStatus('二件目');
			await settle();
			expect(host.style.height).toBe('72px');
			vi.advanceTimersByTime(550);
			await settle();
			expect(host.style.height).toBe('72px');
			context.dismiss(context.items.value[0].id);
			await settle();
			vi.advanceTimersByTime(550);
			await settle();
			expect(host.style.height).toBe('0px');
		} finally { vi.useRealTimers(); }
	});
	test('uses the dialog as the notification target and outline while it is active', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=home'));
		const context = getNotificationPageContext()!;
		context.enqueueStatus('保存しました');
		await settle();
		const shellOutline = context.surface.value?.outline.value;
		const hover = new window.Event('pointerenter');
		Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
		shellOutline?.dispatchEvent(hover);
		expect(context.surface.value?.paused?.value).toBe(true);
		const dialog = window.document.createElement('div');
		window.document.body.append(dialog);
		hatadyDialogSurfaces.value = [dialog];
		await settle();
		expect(context.surface.value?.target.value).toBe(dialog);
		expect(context.surface.value?.outline.value).toBe(dialog);
		expect(context.surface.value?.paused?.value).toBe(false);
		expect(target.querySelectorAll('[aria-hidden="true"] svg[data-integrated="true"]')).toHaveLength(0);
		hatadyDialogSurfaces.value = [];
		await settle();
		expect(context.surface.value?.outline.value).toBe(shellOutline);
		dialog.remove();
	});
	test('does not revive a dismissed glow when a dialog opens during its exit', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=home'));
		const context = getNotificationPageContext()!;
		const host = context.surface.value?.target.value as HTMLElement;
		const dialog = window.document.createElement('div');
		window.document.body.append(dialog);
		vi.useFakeTimers();
		try {
			context.enqueueStatus('保存しました');
			await settle();
			context.dismiss(context.items.value[0].id);
			await settle();
			expect(host.style.height).toBe('64px');
			hatadyDialogSurfaces.value = [dialog];
			await settle();
			expect(host.style.height).toBe('0px');
			hatadyDialogSurfaces.value = [];
			await settle();
			vi.advanceTimersByTime(550);
			await settle();
			expect(host.style.height).toBe('0px');
			expect(target.querySelector('[data-leaving="true"]')).toBeNull();
		} finally { vi.useRealTimers(); dialog.remove(); }
	});
	test('keeps browser metadata owned by the shell across embedded app changes', async () => {
		fixture.initialPath = hatagoesUrl('/hatask?tab=todo');
		const titles: string[] = [];
		const target = window.document.createElement('div'); window.document.body.append(target);
		const app = createApp({ setup: () => {
			provideMetadataReceiver(getter => { titles.push(getter().title); });
			return () => h(Hatagoes);
		} });
		app.mount(target); cleanup = () => { app.unmount(); target.remove(); };
		await settle();
		expect(titles.at(-1)).toBe('Hatask');
		(target.querySelector('button[aria-label="HataGoesホーム"]') as HTMLButtonElement).click();
		await settle();
		expect(titles.at(-1)).toBe('HataGoes');
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		expect(titles.at(-1)).toBe('Hatady');
		expect(titles).not.toContain('Embedded hatask');
		expect(titles).not.toContain('Embedded hatady');
	});
	test('uses the owning app screens and puts Back beside the capsule', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=collection&hgScope=mine'));
		const screens = target.querySelector('nav[aria-label="画面一覧"]')!;
		expect(screens.querySelector('button[aria-label="コレクション"]')?.getAttribute('aria-current')).toBe('page');
		expect(screens.querySelector('button[aria-label="記録"]')).not.toBeNull();
		expect(screens.querySelector('button[aria-label="ToDo"]')).toBeNull();
		expect(screens.firstElementChild).toBe(screens.querySelector('[class*=hatadyDate]'));
		expect(screens.firstElementChild?.nextElementSibling?.getAttribute('aria-label')).toBe('戻る');
		expect(screens.querySelector('button[aria-label="全てのアプリ"]')?.parentElement).toBe(screens);
		expect(target.querySelector('[class*="breadcrumb"]')).toBeNull();
		expect(target.querySelector('nav[aria-label="共通ピン"]')).toBeNull();
		expect(target.querySelector('select[aria-label="画面"]')).toBeNull();
		expect(target.querySelector('header button[class*=brand]')?.textContent).toBe('Hatady');
		expect(screens.querySelector('button[aria-current="page"]')?.textContent).toBe('コレクション');
		(target.querySelector('header button[class*=brand]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady'));
		expect(target.querySelector('header button[class*=brand]')?.textContent).toBe('Hatady');
	});

	test('places the Hatady action target beside its capsule and hides it for other apps', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=records'));
		Object.defineProperty(target.querySelector('[data-hatagoes-root]'), 'clientWidth', { configurable: true, value: 1000 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		const nav = target.querySelector<HTMLElement>('nav[aria-label="画面一覧"]');
		expect(nav?.dataset.hatady).toBe('true');
		const actions = nav?.querySelector<HTMLElement>('[class*=hatadyActions]');
		const date = nav?.querySelector<HTMLElement>('[class*=hatadyDate]');
		expect(nav?.querySelector('[class*=hatadyHeading]')).toBeNull();
		expect(nav?.querySelector('button[aria-label="記録"]')).not.toBeNull();
		expect(nav?.querySelector('button[aria-label="コレクション"]')).not.toBeNull();
		expect(actions?.parentElement).toBe(nav);
		expect(date?.parentElement).toBe(nav);
		expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-header-ready')).toBe('true');
		target.querySelector<HTMLButtonElement>('button[aria-label="Hatask"]')?.click();
		await settle();
		expect(nav?.dataset.hatady).toBe('false');
		expect(actions?.style.display).toBe('none');
		expect(date?.style.display).toBe('none');
	});

	test('background layout follows the actual shell width when resizing across the mobile boundary', async () => {
		const target = await mount('/hatagoes');
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]');
		if (!shell) throw new Error('Missing HataGoes shell');
		for (const width of [390, 1280, 850, 851, 320]) {
			Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width });
			window.dispatchEvent(new Event('resize'));
			await settle();
			expect(shell.dataset.narrow).toBe(String(width <= 850));
		}
	});

	test('mobile Hatady releases the date column and hosts overview immediately before notifications', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=home'));
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]');
		if (!shell) throw new Error('Missing HataGoes shell');
		const nav = shell.querySelector<HTMLElement>('nav[aria-label="画面一覧"]');
		if (!nav) throw new Error('Missing screen navigation');
		const date = nav.querySelector<HTMLElement>('[class*=hatadyDate]');
		const overview = shell.querySelector<HTMLElement>('[class*=hatadyOverview]');
		if (!date || !overview) throw new Error('Missing Hatady header targets');
		for (const width of [320, 360, 390, 600, 850]) {
			Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width });
			window.dispatchEvent(new Event('resize'));
			await settle();
			expect(date.style.display).toBe('none');
			expect(overview.style.display).not.toBe('none');
			expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-header-ready')).toBe('false');
			expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-overview-before-bell')).toBe('true');
			expect(nav.querySelector('[class*=screenCapsule]')?.querySelectorAll('button')).toHaveLength(5);
		}
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 1000 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(date.style.display).not.toBe('none');
		expect(overview.style.display).toBe('none');
		expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-header-ready')).toBe('true');
		expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-overview-before-bell')).toBe('false');
		target.querySelector<HTMLButtonElement>('button[aria-label="Hatask"]')?.click();
		await settle();
		expect(overview.style.display).toBe('none');
	});

	test('uses the two-row mobile Hatask navigation only for its capsule view', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const shell = target.querySelector<HTMLElement>('[data-hatagoes-root]')!;
		const nav = shell.querySelector<HTMLElement>('nav[aria-label="画面一覧"]')!;
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 320 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(nav.dataset.mobileHatask).toBe('true');
		for (const label of ['戻る', '全てのアプリ', '支援情報', 'モデレーション']) {
			const actions = nav.querySelectorAll<HTMLButtonElement>(`:scope > button[aria-label="${label}"]`);
			expect(actions).toHaveLength(1);
		}
		expect(nav.querySelector('button[aria-label="ToDo"]')?.getAttribute('aria-current')).toBe('page');
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		expect(nav.dataset.mobileHatask).toBe('false');
		(target.querySelector('button[aria-label="Hatask"]') as HTMLButtonElement).click();
		await settle();
		expect(nav.dataset.mobileHatask).toBe('true');
		Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 1000 });
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(nav.dataset.mobileHatask).toBe('false');
	});

	test.each([
	[hatagoesUrl('/hatask?tab=todo'), 'Hatask', hatagoesUrl('/hatask')],
	[hatagoesUrl('/hatafeed?tab=issues'), 'HataFeed', hatagoesUrl('/hatafeed')],
	['/hatagoes?view=settings', 'HataGoes', '/hatagoes'],
])('header brand returns from %s to its owning Home', async (path, label, home) => {
		const target = await mount(path);
		const brand = target.querySelector<HTMLButtonElement>('header button[class*=brand]')!;
		expect(brand.getAttribute('aria-label')).toBe(label);
		brand.click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(home);
	});

	test('shows only five saved Hatask screens and a temporary current screen', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=recipe'));
		const screens = target.querySelector('nav[aria-label="画面一覧"]')!;
		for (const label of ['きょう', 'カレンダー', 'ToDo', 'きもち', 'ごはん', 'レシピ']) {
			expect(screens.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
		}
		expect(screens.querySelector('button[aria-label="おはな"]')).toBeNull();
		expect(screens.querySelector('button[aria-label="レシピ"]')?.className).toContain('temporaryScreen');
	});

	test('shows a current Hatask tool as a temporary tab', async () => {
		const target = await mount(hatagoesUrl('/hatask/emotion-analysis'));
		const screen = target.querySelector('nav[aria-label="画面一覧"] button[aria-label="HATAlyze"]');
		expect(screen?.getAttribute('aria-current')).toBe('page');
		expect(screen?.className).toContain('temporaryScreen');
	});

	test('scrolls the capsule horizontally when the selected tab is out of view', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const capsule = target.querySelector<HTMLElement>('nav[aria-label="画面一覧"] > div > div > div')!;
		const meal = capsule.querySelector<HTMLButtonElement>('button[aria-label="ごはん"]')!;
		Object.defineProperty(capsule, 'clientWidth', { configurable: true, value: 100 });
		capsule.getBoundingClientRect = () => ({ left: 0, right: 100 } as DOMRect);
		meal.getBoundingClientRect = () => ({ left: 125, right: 180 } as DOMRect);
		capsule.scrollTo = vi.fn();
		meal.click();
		await settle();
		expect(capsule.scrollTo).toHaveBeenCalledWith({ left: 84, behavior: 'smooth' });
	});

	test.each(['admin', 'moderator', 'user'])('keeps staff access and places Hatady moderation inside its capsule for %s', async role => {
		if (!$i) throw new Error('Missing mock account');
		$i.isAdmin = role === 'admin';
		$i.isModerator = role === 'moderator';
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const nav = target.querySelector('nav[aria-label="画面一覧"]')!;
		const hataskModeration = nav.querySelector('button[aria-label="モデレーション"]');
		if (role === 'user') expect(hataskModeration).toBeNull();
		else expect(hataskModeration?.parentElement).toBe(nav);
		expect(nav.querySelector('button[aria-label="支援管理"]')).toBeNull();
		expect(target.querySelector('button[aria-label="スタッフ画面"]')).toBeNull();
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		const capsule = nav.querySelector('[class*=screenCapsuleSlot] [class*=screenCapsule]');
		const moderation = nav.querySelector<HTMLButtonElement>('button[aria-label="モデレーション"]');
		expect(capsule?.querySelectorAll('button')).toHaveLength(role === 'user' ? 4 : 5);
		expect(nav.querySelector(':scope > button[aria-label="モデレーション"]')).toBeNull();
		if (role === 'user') {
			expect(moderation).toBeNull();
		} else {
			expect(moderation?.parentElement).toBe(capsule);
			moderation?.click();
			await settle();
			expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatady?tab=moderation'));
			expect(moderation?.getAttribute('aria-current')).toBe('page');
			expect(moderation?.textContent).toBe('モデレーション');
		}
		expect(nav.querySelector('button[aria-label="支援管理"]')).toBeNull();
	});

	test('includes the existing Hatask moderation tab in the Hatask app directory', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		(target.querySelector('nav[aria-label="画面一覧"] button[aria-label="全てのアプリ"]') as HTMLButtonElement).click();
		await settle();
		const picker = window.document.body.querySelector('[role="dialog"][aria-labelledby="hatagoes-screens-heading"]')!;
		expect(picker.querySelector('button[aria-label="Hatask モデレーション"]')).not.toBeNull();
		expect(picker.querySelector('button[aria-label="Hata Docs"]')).toBeNull();
	});

	test('opens HataIgo as its own page instead of inside HataGoes', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		(target.querySelector('nav[aria-label="画面一覧"] button[aria-label="全てのアプリ"]') as HTMLButtonElement).click();
		await settle();
		const igo = window.document.body.querySelector<HTMLButtonElement>('[role="dialog"][aria-labelledby="hatagoes-screens-heading"] button[aria-label="HataIgo"]');
		expect(igo).not.toBeNull();
		igo?.click();
		await settle();
		expect(router().getCurrentFullPath()).toBe('/hataigo');
	});

	test('keeps the owning app palette in its directory', async () => {
		const target = await mount(hatagoesUrl('/hatady?tab=records'));
		(target.querySelector('nav[aria-label="画面一覧"] button[aria-label="全てのアプリ"]') as HTMLButtonElement).click();
		await settle();
		expect(target.firstElementChild?.classList.contains('hatady-scope')).toBe(true);
		expect(window.document.body.querySelector('#hatagoes-screens-heading')?.textContent).toBe('Hatady の全てのアプリ');
	});

	test('does not carry a captured dark canvas into a light Hatask overlay', async () => {
		fixture.appearance = { theme: 'akatsuki', cssVars: { '--bg': 'oklab(0.1 0 0)', '--bg-image': 'linear-gradient(#111, #222)', '--surface': '#ffffffd1', '--fg': '#2b1f2c' } };
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const root = target.querySelector<HTMLElement>('[data-hatagoes-root]')!;
		expect(root.style.getPropertyValue('--bg')).toBe('');
		expect(root.style.getPropertyValue('--bg-image')).toBe('');
		expect(root.style.getPropertyValue('--surface')).toBe('#ffffffd1');
		(target.querySelector('button[aria-label="全てのアプリ"]') as HTMLButtonElement).click();
		await settle();
		const overlay = window.document.body.querySelector('#hatagoes-screens-heading')?.closest<HTMLElement>('[data-hatask-theme="akatsuki"]');
		expect(overlay?.style.getPropertyValue('--bg')).toBe('');
	});
	test('uses short HataFeed screen names while the brand names the app', async () => {
		const target = await mount(hatagoesUrl('/hatafeed?tab=home'));
		const screens = target.querySelector('nav[aria-label="画面一覧"]')!;
		expect(target.querySelector('header button[class*=brand]')?.textContent).toBe('HataFeed');
		expect(screens.querySelector('button[aria-label="ホーム"]')?.getAttribute('aria-current')).toBe('page');
	});
	test('hides the screen picker on KeepAlive exit and restores it on return', async () => {
		fixture.initialPath = '/hatagoes?view=screens';
		const active = ref(true);
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Hatagoes) : null }) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		await settle();
		expect(window.document.body.querySelector('[aria-labelledby="hatagoes-screens-heading"]')).not.toBeNull();
		active.value = false;
		await settle();
		expect(window.document.body.querySelector('[aria-labelledby="hatagoes-screens-heading"]')).toBeNull();
		active.value = true;
		await settle();
		expect(window.document.body.querySelector('[aria-labelledby="hatagoes-screens-heading"]')).not.toBeNull();
	});

	test('resets Home scroll on KeepAlive return but preserves it across tabs in one session', async () => {
		fixture.initialPath = '/hatagoes';
		const active = ref(true);
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Hatagoes) : null }) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		await settle();
		const homeScroll = target.querySelector<HTMLElement>('[data-hatagoes-home-scroll]')!;
		homeScroll.scrollTop = 180;
		(target.querySelector('nav[aria-label="モバイルアプリ"] button[aria-label="Hatask"]') as HTMLButtonElement).click();
		await settle();
		expect(homeScroll.scrollTop).toBe(180);
		(target.querySelector('nav[aria-label="モバイルアプリ"] button[aria-label="HataGoesホーム"]') as HTMLButtonElement).click();
		await settle();
		expect(homeScroll.scrollTop).toBe(180);
		active.value = false;
		await settle();
		active.value = true;
		await settle();
		expect(target.querySelector('[data-hatagoes-home-scroll]')).toBe(homeScroll);
		expect(homeScroll.scrollTop).toBe(0);
	});

	test('app switching preserves its session popup until shell exit', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		expect(fixture.closePopup).not.toBeNull();
		(target.querySelector('button[aria-label="Hatady"]') as HTMLButtonElement).click();
		await settle();
		expect(fixture.popupClosed).not.toHaveBeenCalled();
		(target.querySelector('button[aria-label="終了"]') as HTMLButtonElement).click();
		await settle();
		expect(fixture.popupClosed).not.toHaveBeenCalled();
		button(window.document.body.querySelector('[aria-label="HataGoesの終了確認"]')!, '終了する').click();
		expect(fixture.popupClosed).toHaveBeenCalledOnce();
	});

	test('mobile exit confirmation can be cancelled and returns focus', async () => {
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const trigger = target.querySelector<HTMLButtonElement>('button[aria-label="終了"]')!;
		trigger.click();
		await settle();
		expect(fixture.popupClosed).not.toHaveBeenCalled();
		button(window.document.body.querySelector('[aria-label="HataGoesの終了確認"]')!, 'キャンセル').click();
		await settle();
		expect(window.document.body.querySelector('[aria-label="HataGoesの終了確認"]')).toBeNull();
		expect(window.document.activeElement).toBe(trigger);
		expect(fixture.popupClosed).not.toHaveBeenCalled();
	});

	test('KeepAlive deactivation closes the session popup and deactivates home', async () => {
		const active = ref(true);
		const target = window.document.createElement('div');
		window.document.body.append(target);
		fixture.initialPath = hatagoesUrl('/hatask');
		const app = createApp({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Hatagoes) : null }) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		await settle();
		expect(fixture.closePopup).not.toBeNull();
		active.value = false;
		await settle();
		expect(fixture.popupClosed).toHaveBeenCalledOnce();
		active.value = true;
		await settle();
		expect(target.querySelector('[data-home-active]')?.getAttribute('data-home-active')).toBe('false');
		(target.querySelector('header button[class*=brand]') as HTMLButtonElement).click();
		await settle();
		expect(router().getCurrentFullPath()).toBe(hatagoesUrl('/hatask'));
		expect(target.querySelector('[data-home-active]')?.getAttribute('data-home-active')).toBe('false');
	});

	test('opens mood and meal pages from the common button without quick capture', async () => {
		const target = await mount('/hatagoes');
		for (const [label, kind] of [['予定', 'event'], ['ToDo', 'todo']]) {
			const dialog = await showCreate(target);
			button(dialog, label).click();
			await settle();
			expect(fixture.created.at(-1)).toMatchObject({ app: 'hatask', kind });
		}
		expect(fixture.created.map(item => item.kind)).toEqual(['event', 'todo']);
		for (const [label, tab] of [['きもちを開く', 'mood'], ['ごはんを開く', 'meal']]) {
			const dialog = await showCreate(target);
			button(dialog, label).click();
			await settle();
			expect(router().getCurrentFullPath()).toBe(hatagoesUrl(`/hatask?tab=${tab}`));
			expect(fixture.created.map(item => item.kind)).toEqual(['event', 'todo']);
		}
		for (const [label, tab] of [['水やり', 'garden'], ['レシピ', 'recipe']]) {
			const dialog = await showCreate(target);
			expect([...dialog.querySelectorAll('button')].filter(item => item.textContent?.trim() === '料理')).toHaveLength(0);
			button(dialog, label).click();
			await settle();
			expect(router().getCurrentFullPath()).toBe(hatagoesUrl(`/hatask?tab=${tab}`));
		}
	});
	test('shows a legacy cooking recent as one recipe entry', async () => {
		window.localStorage.setItem('hatagoes:create:owner', JSON.stringify([
			{ app: 'hatask', kind: 'cooking', label: '料理' },
			{ app: 'hatask', kind: 'recipe', label: 'レシピ' },
		]));
		const target = await mount('/hatagoes');
		const dialog = await showCreate(target);
		const recent = [...dialog.querySelectorAll('button')].filter(item => item.textContent?.trim() === 'Hatask · レシピ');
		expect(recent).toHaveLength(1);
		expect([...dialog.querySelectorAll('button')].some(item => item.textContent?.trim() === 'Hatask · 料理')).toBe(false);
	});

	test('opens the current ToDo form directly inside the common sheet and cancels it on close', async () => {
		const original = hatagoesUrl('/hatask?tab=todo');
		const target = await mount(original);
		const dialog = await showCreate(target);
		const captured = fixture.created[0];
		expect(captured.kind).toBe('todo');
		expect(captured.surface?.isConnected).toBe(true);
		expect(captured.surface?.dataset.embedded).toBe('true');
		expect(dialog.contains(captured.surface!)).toBe(true);
		expect(router().getCurrentFullPath()).toBe(original);
		expect(dialog.querySelector('[aria-label="閉じる"]')).toBeNull();
		const closeCreateButton = target.querySelector<HTMLButtonElement>('[aria-label="作成を閉じる"]')!;
		closeCreateButton.focus();
		closeCreateButton.click();
		await settle();
		expect(captured.signal.aborted).toBe(true);
		expect(window.document.activeElement?.getAttribute('aria-label')).toBe('作成');
	});

	test('late bridge registration after exit cannot create or change the exit URL', async () => {
		fixture.delayedApps.add('hatady');
		const target = await mount(hatagoesUrl('/hatask?tab=todo'));
		const dialog = await showCreate(target);
		button(dialog, 'Hatady').click();
		await settle();
		button(dialog, '記録').click();
		await settle();
		expect(fixture.registrations.has('hatady')).toBe(true);
		(target.querySelector('button[aria-label="終了"]') as HTMLButtonElement).click();
		await settle();
		button(window.document.body.querySelector('[aria-label="HataGoesの終了確認"]')!, '終了する').click();
		expect(router().getCurrentFullPath()).toBe('/');
		fixture.registrations.get('hatady')?.();
		await settle();
		expect(fixture.created.filter(item => item.app === 'hatady')).toEqual([]);
		expect(router().getCurrentFullPath()).toBe('/');
	});

	test('aborts the AbortSignal passed to an in-flight bridge on exit', async () => {
		fixture.pendingCreate = new Promise<void>(() => {});
		const target = await mount(hatagoesUrl('/hatask?tab=cal'));
		await showCreate(target);
		await settle();
		expect(fixture.created).toHaveLength(1);
		const signal = fixture.created[0].signal;
		expect(signal.aborted).toBe(false);
		(target.querySelector('button[aria-label="終了"]') as HTMLButtonElement).click();
		await settle();
		button(window.document.body.querySelector('[aria-label="HataGoesの終了確認"]')!, '終了する').click();
		expect(signal.aborted).toBe(true);
	});

	test('creating in another app keeps the visible app and path', async () => {
		const original = hatagoesUrl('/hatask?tab=cal');
		const target = await mount(original);
		const dialog = await showCreate(target);
		button(dialog, 'Hatady').click();
		await settle();
		button(dialog, '記録').click();
		await settle();
		expect(fixture.created.at(-1)).toMatchObject({ app: 'hatady', kind: 'activity' });
		expect(router().getCurrentFullPath()).toBe(original);
		expect(target.querySelector('[data-pane="hatask"]')?.getAttribute('data-active')).toBe('true');
		expect(target.querySelector('[data-pane="hatady"]')?.getAttribute('data-active')).toBe('false');
	});
});
