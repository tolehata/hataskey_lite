/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { computed, createApp, defineComponent, h, KeepAlive, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/preferences.js', async () => {
	const { ref: preferenceRef } = await import('vue');
	return { prefer: { r: { emojiStyle: preferenceRef('twemoji') } } };
});
import HataskAkatsukiLayout from './HataskAkatsukiLayout.vue';
import type { App } from 'vue';
import type { HataskAkatsukiFavoriteId, HataskAkatsukiHomeSectionId, HataskAkatsukiLayoutProps } from './hatask-akatsuki-types.js';
import type { HataskeyNotificationToasts } from '@/utility/hataskey-notification-toast.js';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';
import { getHataskDaylightStyle } from '@/utility/hatask-daylight.js';
import { globalEvents } from '@/events.js';
import { buildHataskAkatsukiModel } from '@/utility/hatask-akatsuki.js';
import { prefer } from '@/preferences.js';

const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];
let size = { width: 1200, height: 800 };
let prefersReducedMotion = false;
let resizeCallbacks: (() => void)[] = [];
let motionCallbacks: (() => void)[] = [];

beforeEach(() => {
	prefer.r.emojiStyle.value = 'twemoji';
	size = { width: 1200, height: 800 };
	prefersReducedMotion = false;
	resizeCallbacks = [];
	motionCallbacks = [];
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: () => void) { resizeCallbacks.push(callback); }
		observe() {}
		unobserve() {}
		disconnect() {}
	});
	vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return prefersReducedMotion; }, addEventListener: vi.fn((_type: string, callback: () => void) => { motionCallbacks.push(callback); }), removeEventListener: vi.fn() })));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		return { width: this.classList.contains('hak-body') ? size.width - 64 : size.width, height: size.height, x: 0, y: 0, top: 0, right: size.width, bottom: size.height, left: 0, toJSON: () => ({}) } as DOMRect;
	});
	vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {});
	// Motion tests install their own observable animation; happy-dom eagerly rejects finished on cancel.
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
});

afterEach(() => {
	for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function mountLayout(options: Partial<HataskAkatsukiLayoutProps> & { embedded?: boolean } = {}, context?: HataskeyNotificationToasts) {
	const liveProps = reactive<HataskAkatsukiLayoutProps>({ enabled: true, activeTab: 'home', model: {}, now: new Date(2026, 8, 5, 13, 24), searchQuery: '', searchOpen: false, ...options });
	const handlers = { navigate: vi.fn(), settings: vi.fn(), search: vi.fn(), closeSearch: vi.fn(), action: vi.fn(), saveFavorites: vi.fn(), slotMounted: vi.fn(), slotUnmounted: vi.fn() };
	const Child = defineComponent({ setup() { onMounted(handlers.slotMounted); onUnmounted(handlers.slotUnmounted); return () => h('input', { 'data-draft': '', value: '' }); } });
	const app = createApp({ render: () => h(HataskAkatsukiLayout, { ...liveProps, 'onUpdate:searchQuery': (value: string) => { liveProps.searchQuery = value; }, onCloseSearch: () => { liveProps.searchOpen = false; handlers.closeSearch(); }, onNavigate: handlers.navigate, onSettings: handlers.settings, onSearch: handlers.search, onAction: handlers.action, onSaveFavorites: handlers.saveFavorites }, { default: () => h(Child), 'home-feedback': () => h('button', { 'data-feedback-fixture': '' }, '返信が届きました'), 'home-extra': () => h('div', { 'data-home-extra': '' }, '保存済みの補足'), 'search-results': () => h('div', { 'data-search-results': '' }, liveProps.searchQuery) }) });
	if (context) app.provide(hataskeyNotificationToastsKey, context);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	await nextTick();
	await nextTick();
	return { container, liveProps, handlers };
}

function required<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
	const result = container.querySelector<T>(selector);
	if (!result) throw new Error(`Expected control: ${selector}`);
	return result;
}

function click(container: ParentNode, selector: string) { required<HTMLButtonElement>(container, selector).click(); }

test('staff review entry is role-gated and has a full-width desktop workspace', async () => {
	const { container, liveProps, handlers } = await mountLayout();
	expect(container.querySelector('[aria-label="記録確認"]')).toBeNull();
	liveProps.model.canModerate = true; await nextTick();
	click(container, '.hak-rail-tab[aria-label="記録確認"]');
	expect(handlers.navigate).toHaveBeenCalledWith('review');
	liveProps.activeTab = 'review'; await nextTick();
	expect(required(container, '.htk-akatsuki-layout').getAttribute('data-hide-aside')).toBe('true');
	liveProps.model.canModerate = false; await nextTick();
	expect(container.querySelector('[aria-label="記録確認"]')).toBeNull();
});

test.each([320, 390])('compact staff navigation keeps review directly before the persistent create button at %ipx', async (width) => {
	size = { width, height: 700 };
	const saved = ['home', 'todo', 'hataskapps', 'apps'] as const;
	const { container, liveProps, handlers } = await mountLayout({ model: { canModerate: true, mobileTabs: [...saved] } });
	const bottom = required(container, 'nav[aria-label="Hatask 下部ナビゲーション"]');
	const fab = required(bottom, '.hak-fab');
	const savedTabs = liveProps.model.mobileTabs;
	for (const tab of ['home', 'cal', 'todo', 'mood', 'meal', 'garden', 'support', 'ranking', 'hataskapps', 'apps'] as const) {
		liveProps.activeTab = tab; await nextTick();
		expect([...bottom.querySelectorAll('.hak-mobile-tab')].map(button => button.getAttribute('aria-label'))).toEqual(['ホーム', 'ToDo', 'Hatask App', 'Hataskey App', '記録確認']);
		expect(required(bottom, '[aria-label="記録確認"]').hasAttribute('aria-current')).toBe(false);
		expect(container.querySelector('.hak-review-entry')).toBeNull();
		expect(required(bottom, '[aria-label="記録確認"]').nextElementSibling).toBe(fab);
	}
	click(bottom, '[aria-label="記録確認"]');
	expect(handlers.navigate).toHaveBeenCalledExactlyOnceWith('review');
	liveProps.activeTab = 'review'; await nextTick();
	expect(required(bottom, '[aria-label="記録確認"]').nextElementSibling).toBe(fab);
	expect(required(bottom, '.hak-mobile-tab[aria-current="page"]').getAttribute('aria-label')).toBe('記録確認');
	expect(bottom.querySelectorAll('.hak-mobile-tab')).toHaveLength(5);
	click(bottom, '.hak-fab'); await nextTick();
	expect(fab.getAttribute('aria-expanded')).toBe('true');
	click(container, '.hak-sheet-action'); await nextTick();
	expect(handlers.action).toHaveBeenCalledExactlyOnceWith({ type: 'create-event' });
	expect(fab.getAttribute('aria-expanded')).toBe('false');
	expect(window.document.activeElement).toBe(fab);
	click(bottom, '[aria-label="ホーム"]');
	expect(handlers.navigate).toHaveBeenLastCalledWith('home');
	liveProps.activeTab = 'home';
	liveProps.model.canModerate = false; await nextTick();
	expect(bottom.querySelector('[aria-label="記録確認"]')).toBeNull();
	expect(bottom.querySelectorAll('.hak-mobile-tab')).toHaveLength(4);
	expect(bottom.querySelector('.hak-fab')).toBe(fab);
	expect(liveProps.model.mobileTabs).toBe(savedTabs);
	expect(liveProps.model.mobileTabs).toEqual(saved);
});

function sideModel(): HataskAkatsukiLayoutProps['model'] {
	return {
		week: ['月', '火', '水', '木', '金', '土', '日'].map((label, index) => ({ id: `day-${index}`, label, description: index === 6 ? 'まだ記録していません' : '穏やかな一日', emoji: index === 6 ? undefined : '🙂', pending: index === 6, today: index === 6 })),
		flower: { name: '大切なお花', progress: 45, detail: '育てています' },
		mealSummary: '朝と昼を記録しました',
		streakLabel: '3日続いています',
		rankLabel: 'RANK 2',
		eye: { text: 'ひと息いれましょう', number: 3 },
		todos: [
			{ id: 'todo-open', title: '買い物', completed: false },
			{ id: 'todo-done', title: '散歩', completed: true },
			{ id: 'todo-readonly', title: '共有メモ', readOnly: true },
		],
		apps: [{ id: 'feed', label: 'HataFeed', icon: 'ti ti-message', description: '要望や不具合を送る' }],
	};
}

function adaptiveHome(recommended: HataskAkatsukiHomeSectionId = 'tools'): NonNullable<HataskAkatsukiLayoutProps['model']['home']> {
	return {
		recommended, hasUsage: true,
		sections: (['tools', 'calendar', 'todo', 'feedback', 'meal'] as const).map((id, index) => ({
			id, label: id, icon: 'ti ti-apps', summary: `内容 ${id}`, reason: `表示理由 ${id}`, priority: 100 - index,
		})),
	};
}

function introductoryHome(now: Date, createdAt: string): HataskAkatsukiLayoutProps['model'] {
	return buildHataskAkatsukiModel({
		now, accountCreatedAt: createdAt, locale: 'ja-JP', loading: false,
		known: { planner: true, moods: true, meals: true, flower: true }, readOnly: false,
		events: [], todos: [{ id: 'guide-next', text: '次の用事', done: false, due: '2026-01-01' }], moods: [], meals: [],
		flower: { name: 'わかば', emoji: '🌱', progress: 20, remaining: '明日' },
		loginDays: 1, loginRanking: 0, eyePhrase: '', feedbackUnread: 0, settings: {},
	}).model;
}

function searchDisclosure(container: ParentNode, opened: boolean): HTMLElement {
	const wrapper = required<HTMLElement>(container, '.hak-search-disclosure');
	expect(wrapper.getAttribute('data-open')).toBe(String(opened));
	expect(wrapper.getAttribute('aria-hidden')).toBe(String(!opened));
	expect(wrapper.hasAttribute('inert')).toBe(!opened);
	return wrapper;
}

function observeTabMotion(container: ParentNode) {
	const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = [];
	const animate = vi.fn(() => {
		const animation = { cancel: vi.fn(), onfinish: null as (() => void) | null };
		animations.push(animation);
		return animation;
	});
	Object.defineProperty(required(container, '.hak-center'), 'animate', { configurable: true, value: animate });
	return { animate, animations };
}

describe('HataskAkatsukiLayout', () => {
	test.each([
		['light', 'twemoji', '/twemoji/1f33c.svg'],
		['dark', 'twemoji', '/twemoji/1f33c.svg'],
		['light', 'native', '/twemoji/1f33c.svg'],
		['dark', 'native', '/twemoji/1f33c.svg'],
		['light', 'fluentEmoji', '/fluent-emoji/1f33c.png'],
		['dark', 'fluentEmoji', '/fluent-emoji/1f33c.png'],
	] as const)('季の %s・%s 設定でホームとサイドの同じ花を画像描画する', async (mode, style, expected) => {
		prefer.r.emojiStyle.value = style;
		const model = { ...sideModel(), flower: { name: 'ヒナギク', emoji: '🌼', progress: 45 }, home: { ...adaptiveHome(), favorites: ['flower'] as HataskAkatsukiFavoriteId[] } };
		const { container } = await mountLayout({ mode, model });
		container.classList.add('htk-root');
		container.dataset.theme = 'kisetsu';
		container.dataset.mode = mode;
		const flowers = [...container.querySelectorAll('.hak-flower-emoji')];
		expect(flowers).toHaveLength(2);
		for (const flower of flowers) {
			expect(flower.tagName).toBe('IMG');
			expect(flower.getAttribute('src')).toBe(expected);
			expect(flower.getAttribute('aria-hidden')).toBe('true');
		}
		expect(required(container, '.hak-side').textContent).not.toContain('🌼');
		expect(required(container, '[data-home-panel="flower"]').textContent).not.toContain('🌼');
	});

	test.each([599, 600, 1200])('表示を選ぶは幅%sでも所定の隣接位置にあり、同じ編集画面を開く', async width => {
		size = { width, height: 844 };
		const { container } = await mountLayout({ model: { home: adaptiveHome('calendar') } });
		const desktop = required<HTMLButtonElement>(container, '[data-home-display-options="desktop"]');
		const mobile = required<HTMLButtonElement>(container, '[data-home-display-options="mobile"]');
		expect(desktop.previousElementSibling?.classList.contains('hak-focus-options')).toBe(true);
		expect(mobile.closest('.hak-mobile-date')?.querySelector('.hak-date')).not.toBeNull();
		for (const button of [desktop, mobile]) {
			expect(button.textContent?.trim()).toBe('');
			expect(button.getAttribute('aria-label')).toBe('表示を選ぶ');
		}
		(width < 600 ? mobile : desktop).click(); await nextTick();
		expect(container.querySelectorAll('.hak-favorites-editor')).toHaveLength(1);
		expect(desktop.disabled).toBe(true);
		expect(mobile.disabled).toBe(true);
	});

	test('初回のお気に入り編集中も、おすすめと往復した選択を保存まで保持する', async () => {
		const { container, handlers } = await mountLayout({ model: { home: adaptiveHome('calendar') } });
		click(container, '[data-home-display-options=desktop]'); await nextTick();
		required<HTMLInputElement>(container, 'input[value="todo"]').click(); await nextTick();
		click(container, '.hak-focus-option[aria-label="おすすめ"]'); await nextTick();
		click(container, '[data-home-select="favorites"]'); await nextTick();
		expect(required<HTMLInputElement>(container, 'input[value="todo"]').checked).toBe(true);
		click(container, '.hak-favorites-editor [type="submit"]');
		expect(handlers.saveFavorites).toHaveBeenCalledWith(['todo']);
	});

	test('末尾のフェードは未表示の続きがある間だけ有効で、内容や高さの変更にも追従する', async () => {
		const { container, liveProps } = await mountLayout();
		const scroller = required<HTMLElement>(container, '.hak-scroll');
		let height = 900;
		Object.defineProperties(scroller, { clientHeight: { configurable: true, get: () => 600 }, scrollHeight: { configurable: true, get: () => height } });
		resizeCallbacks.forEach(callback => callback()); await nextTick();
		expect(scroller.dataset.scrollMore).toBe('true');
		scroller.scrollTop = 300; scroller.dispatchEvent(new Event('scroll')); await nextTick();
		expect(scroller.dataset.scrollMore).toBe('false');
		height = 1100; resizeCallbacks.forEach(callback => callback()); await nextTick();
		expect(scroller.dataset.scrollMore).toBe('true');
		height = 500; liveProps.model = { summary: '短い内容へ変更' }; await nextTick(); await nextTick();
		expect(scroller.dataset.scrollMore).toBe('false');
	});

	test('共有通知をモバイルとPCのナビバー間で切り替え、検索中の入力とフォーカスを保持する', async () => {
		size = { width: 599, height: 844 };
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const nativeTarget = window.document.createElement('div');
		context.target.value = nativeTarget;
		const { container, liveProps } = await mountLayout({ model: { mealSummary: '昼ごはんは、これから' } }, context);
		const viewport = required<HTMLElement>(container, '.hak-mobile-bar .hak-notification-viewport');
		expect(context.surface.value?.target.value).toBe(viewport);
		click(container, '.hak-search-toggle'); await nextTick();
		const input = required<HTMLInputElement>(container, '.hak-mobile-search input');
		input.value = '残しておく検索'; input.dispatchEvent(new Event('input')); input.focus();
		context.enqueue({ id: 'actual', type: 'test', createdAt: '2026-09-14T00:00:00Z' }, 'local', 0);
		context.height.value = 108; await nextTick();
		expect(viewport.style.height).toBe('108px');
		expect(window.document.activeElement).toBe(input);
		expect(input.value).toBe('残しておく検索');
		expect(required(container, '.hak-meal-row > .hak-side-row-main').textContent).toBe('昼ごはんは、\nこれから');
		context.tick(2300, new Set());
		size.width = 600; resizeCallbacks.forEach(callback => callback()); await nextTick();
		const desktopViewport = required<HTMLElement>(container, '.hak-desktop-bar .hak-notification-viewport');
		const desktopOutline = required<HTMLElement>(container, '.hak-desktop-bar');
		expect(context.surface.value?.target.value).toBe(desktopViewport);
		expect(context.surface.value?.outline.value).toBe(desktopOutline);
		expect(context.target.value).toBe(nativeTarget);
		expect(context.items.value[0].elapsed).toBe(2300);
		expect(viewport.style.height).toBe('0px');
		expect(desktopViewport.style.height).toBe('108px');
		expect(desktopOutline.dataset.notification).toBe('true');
		context.height.value = 0; await nextTick();
		expect(desktopViewport.style.height).toBe('0px');
		context.height.value = 108; await nextTick();
		size.width = 599; resizeCallbacks.forEach(callback => callback()); await nextTick();
		expect(context.surface.value?.target.value).toBe(viewport);
		expect(viewport.style.height).toBe('108px');
		expect(desktopViewport.style.height).toBe('0px');
		liveProps.enabled = false; await nextTick(); await nextTick();
		expect(context.surface.value).toBeUndefined();
	});

	test('PC通知は固定高の上部バーに重なって伸縮し、無効化すると表示先を解放する', async () => {
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const { container, liveProps } = await mountLayout({}, context);
		const header = required<HTMLElement>(container, '.hak-desktop-top');
		const outline = required<HTMLElement>(header, '.hak-desktop-bar');
		const surface = required<HTMLElement>(outline, '.hak-desktop-surface');
		const viewport = required<HTMLElement>(surface, '.hak-notification-viewport');
		expect(context.surface.value?.target.value).toBe(viewport);
		expect(context.surface.value?.outline.value).toBe(outline);
		expect(viewport.style.height).toBe('0px');
		context.enqueue({ id: 'desktop', type: 'test', createdAt: '2026-09-14T00:00:00Z' }, 'local', 0);
		context.height.value = 96; await nextTick();
		expect(viewport.style.height).toBe('96px');
		expect(outline.dataset.notification).toBe('true');
		context.clear(); context.height.value = 0; await nextTick();
		expect(viewport.style.height).toBe('0px');
		expect(outline.dataset.notification).toBe('false');
		liveProps.enabled = false; await nextTick(); await nextTick();
		expect(context.surface.value).toBeUndefined();
	});

	test('プレビューはPCでも共有通知の表示先を取得しない', async () => {
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const { container } = await mountLayout({ preview: true }, context);
		expect(container.querySelector('.hak-desktop-bar')).not.toBeNull();
		expect(context.surface.value).toBeUndefined();
	});

	test('PC通知の重なりとテーマ別の角丸、内側フォームの枠解除をCSSに保持する', async () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const { descriptor } = parse(source);
		const style = descriptor.styles[0];
		const compiled = await compileStyleAsync({ source: style.content, filename: 'HataskAkatsukiLayout.vue', id: 'data-v-notice-test', scoped: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const rawResult = compiled.rawResult;
		if (!rawResult) throw new Error('Missing compiled CSS');
		const declarations = (fragment: string) => {
			const values = new Map<string, string>();
			rawResult.root.walkRules(rule => {
				if (rule.selector.includes(fragment)) rule.walkDecls(decl => { if (!values.has(decl.prop)) values.set(decl.prop, decl.value); });
			});
			return values;
		};
		expect(declarations('.hak-desktop-top').get('height')).toBe('82px');
		expect(declarations('.hak-desktop-bar').get('border-radius')).toBe('min(var(--case-radius, 28px), 28px)');
		expect(declarations('.hak-mobile-bar').get('border-radius')).toBe('min(var(--case-radius, 24px), 24px)');
		const form = declarations('.hak-desktop-bar .hak-desktop-surface > form.hak-desktop-case');
		expect(form.get('border')).toBe('0');
		expect(form.get('background')).toBe('transparent');
		expect(form.get('box-shadow')).toBe('none');
		expect(declarations('.hak-notification-viewport').get('overflow')).toBe('hidden');
		expect(declarations('data-motion').get('transition')).toBe('none');
	});

	test('KeepAliveで閉じたページの通知先を解放し、再表示で同じ検索入力へ戻る', async () => {
		size = { width: 390, height: 844 };
		const context = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
		const shown = ref(true);
		const Page = defineComponent({ setup: () => () => h(HataskAkatsukiLayout, { enabled: true, activeTab: 'home', model: {} }) });
		const Other = defineComponent({ render: () => h('div', '別の画面') });
		const app = createApp({ render: () => h(KeepAlive, {}, () => shown.value ? h(Page) : h(Other)) });
		app.provide(hataskeyNotificationToastsKey, context);
		const container = window.document.createElement('div'); window.document.body.append(container);
		app.mount(container); mounted.push({ app, container }); await nextTick(); await nextTick();
		const target = context.surface.value?.target.value;
		expect(target).toBeInstanceOf(HTMLElement);
		shown.value = false; await nextTick(); await nextTick();
		expect(context.surface.value).toBeUndefined();
		shown.value = true; await nextTick(); await nextTick();
		expect(context.surface.value?.target.value).toBe(target);
		app.unmount(); mounted.pop(); container.remove();
		expect(context.surface.value).toBeUndefined();
	});

	test.each<{ favorites: HataskAkatsukiFavoriteId[] }>([{ favorites: ['calendar', 'todo'] }, { favorites: ['meal', 'flower'] }, { favorites: ['todo'] }])('保存したお気に入り $favorites をホームで開き直し、選択した既存表示だけを並べる', async ({ favorites }) => {
		const model = { ...sideModel(), home: { ...adaptiveHome('feedback'), favorites }, next: { id: 'next', title: '打ち合わせ', timeLabel: '14:00' }, meals: [{ id: 'lunch', label: '昼', text: 'おにぎり', recorded: true }] };
		const { container, handlers } = await mountLayout({ model });
		expect([...container.querySelectorAll('.hak-focus-option')].slice(0, 2).map(button => button.getAttribute('aria-label'))).toEqual(['お気に入り', 'おすすめ']);
		expect(required(container, '[data-home-select="favorites"]').getAttribute('aria-pressed')).toBe('true');
		expect([...container.querySelectorAll('[data-home-panel]')].map(pane => pane.getAttribute('data-home-panel'))).toEqual(favorites);
		expect(required(container, '.hak-home-panes').getAttribute('data-two-panes')).toBe(String(favorites.length === 2));
		expect(container.querySelector('.hak-suggestions')).toBeNull();
		expect(required(container, '[data-home-extra]').textContent).toBe('保存済みの補足');
		if (favorites.includes('calendar')) {
			click(container, '[data-home-panel="calendar"] .hak-action-button');
			expect(handlers.action).toHaveBeenLastCalledWith({ type: 'open-event', id: 'next' });
		}
		if (favorites.includes('todo')) {
			click(container, '[data-home-panel="todo"] .hak-todo-row');
			expect(handlers.action).toHaveBeenLastCalledWith({ type: 'toggle-todo', id: 'todo-open', value: true });
			expect(required<HTMLButtonElement>(container, '[data-home-panel="todo"] .hak-todo-row:last-of-type').disabled).toBe(true);
		}
		if (favorites.includes('meal')) {
			expect(required(container, '[data-home-panel="meal"]').textContent).toContain('おにぎり');
			click(container, '[data-home-panel="meal"] .hak-rich-row');
			expect(handlers.action).toHaveBeenLastCalledWith({ type: 'record-meal', id: 'lunch' });
		}
		if (favorites.includes('flower')) {
			expect(required(container, '[data-home-panel="flower"]').textContent).toContain('45%');
			click(container, '[data-home-panel="flower"] .hak-flower-row');
			expect(handlers.navigate).toHaveBeenLastCalledWith('garden');
		}
		click(container, '.hak-focus-option[aria-label="おすすめ"]');
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('feedback');
		const reopened = await mountLayout({ model: JSON.parse(JSON.stringify(model)) });
		expect(required(reopened.container, '[data-home-select="favorites"]').getAttribute('aria-pressed')).toBe('true');
		expect([...reopened.container.querySelectorAll('[data-home-panel]')].map(pane => pane.getAttribute('data-home-panel'))).toEqual(favorites);
	});

	test('非同期で読んだお気に入りを初期表示し、時計更新や画面幅の変化で選択を戻さない', async () => {
		const { container, liveProps } = await mountLayout({ model: { loading: true, home: adaptiveHome('calendar') }, favoritesReady: false });
		liveProps.model = { ...sideModel(), home: { ...adaptiveHome(), favorites: ['todo', 'flower'] } };
		liveProps.favoritesReady = true;
		await nextTick();
		expect(required(container, '[data-home-select="favorites"]').getAttribute('aria-pressed')).toBe('true');
		const todoPane = required(container, '[data-home-panel="todo"]');
		for (const width of [599, 600, 1200]) {
			size = { width, height: 844 };
			resizeCallbacks.forEach(callback => callback());
			liveProps.now = new Date();
			await nextTick();
			expect(required(container, '[data-home-panel="todo"]')).toBe(todoPane);
			expect(container.querySelectorAll('[data-home-panel]')).toHaveLength(2);
		}
		click(container, '[data-home-select="calendar"]');
		await nextTick();
		liveProps.model = JSON.parse(JSON.stringify(liveProps.model));
		liveProps.activeTab = 'cal';
		await nextTick();
		liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('calendar');
	});

	test('お気に入りは最大2項目を選び、保存に成功するまで表示を変えず、失敗後も再試行できる', async () => {
		const { container, liveProps, handlers } = await mountLayout({ model: { ...sideModel(), home: { ...adaptiveHome(), favorites: ['todo'] } } });
		click(container, '[data-home-display-options=desktop]');
		await nextTick();
		required<HTMLInputElement>(container, 'input[value="flower"]').click();
		await nextTick();
		expect(required<HTMLInputElement>(container, 'input[value="calendar"]').disabled).toBe(true);
		expect(required<HTMLInputElement>(container, 'input[value="meal"]').disabled).toBe(true);
		click(container, '.hak-favorites-editor [type="submit"]');
		expect(handlers.saveFavorites).toHaveBeenLastCalledWith(['todo', 'flower']);
		expect(container.querySelectorAll('[data-home-panel]')).toHaveLength(1);
		liveProps.favoritesSaving = true;
		await nextTick();
		expect(required<HTMLFieldSetElement>(container, '.hak-favorites-editor fieldset').disabled).toBe(true);
		click(container, '.hak-favorites-editor [type="submit"]');
		expect(handlers.saveFavorites).toHaveBeenCalledTimes(1);
		liveProps.favoritesSaving = false;
		liveProps.favoritesError = '保存できませんでした';
		await nextTick();
		expect(required(container, '[role="alert"]').textContent).toBe('保存できませんでした');
		expect(required<HTMLInputElement>(container, 'input[value="flower"]').checked).toBe(true);
		click(container, '.hak-favorites-editor [type="submit"]');
		expect(handlers.saveFavorites).toHaveBeenCalledTimes(2);
		const savedHome = liveProps.model.home;
		if (!savedHome) throw new Error('Missing home settings');
		savedHome.favorites = ['todo', 'flower'];
		liveProps.favoritesError = '';
		await nextTick();
		expect(container.querySelector('.hak-favorites-editor')).toBeNull();
		expect(container.querySelectorAll('[data-home-panel]')).toHaveLength(2);
		click(container, '[data-home-display-options=desktop]');
		await nextTick();
		required<HTMLInputElement>(container, 'input[value="todo"]').click();
		required<HTMLInputElement>(container, 'input[value="flower"]').click();
		await nextTick();
		click(container, '.hak-favorites-editor [type="submit"]');
		expect(handlers.saveFavorites).toHaveBeenLastCalledWith([]);
		savedHome.favorites = [];
		await nextTick();
		expect(required(container, '.hak-focus-option[aria-label="おすすめ"]').getAttribute('aria-pressed')).toBe('true');
	});

	test('設定未取得では保存させず、未設定の編集キャンセルでおすすめへ戻る', async () => {
		const { container, handlers, liveProps } = await mountLayout({ favoritesReady: false });
		click(container, '[data-home-select="favorites"]');
		await nextTick();
		expect(required<HTMLFieldSetElement>(container, '.hak-favorites-editor fieldset').disabled).toBe(true);
		expect(required<HTMLButtonElement>(container, '.hak-favorites-editor [type="submit"]').disabled).toBe(true);
		liveProps.favoritesReady = true;
		await nextTick();
		required<HTMLInputElement>(container, 'input[value="calendar"]').click();
		await nextTick();
		click(container, '.hak-favorites-editor [type="button"]');
		await nextTick();
		expect(handlers.saveFavorites).not.toHaveBeenCalled();
		expect(required(container, '.hak-focus-option[aria-label="おすすめ"]').getAttribute('aria-pressed')).toBe('true');
	});

	test('お気に入りでも非表示設定や読み込み失敗を回避しない', async () => {
		const { container, liveProps } = await mountLayout({ model: { showEvents: false, flower: null, home: { ...adaptiveHome(), favorites: ['calendar', 'flower'] } } });
		expect(container.querySelector('.hak-next')).toBeNull();
		expect(container.querySelector('.hak-flower-row')).toBeNull();
		expect(required(container, '[data-home-panel="calendar"]').textContent).toContain('オフ');
		liveProps.model = { scheduleUnavailable: true, meals: [{ id: 'lunch', label: '昼', text: '読み込めません', recorded: false, unavailable: true }], home: { ...adaptiveHome(), favorites: ['todo', 'meal'] } };
		await nextTick();
		expect(required<HTMLButtonElement>(container, '[data-home-panel="todo"] .hak-action-button').disabled).toBe(true);
		expect(required<HTMLButtonElement>(container, '[data-home-panel="meal"] .hak-rich-row').disabled).toBe(true);
	});

	test('2項目はPC幅で横並び、既存のスマホ境界で縦並びにするCSSを生成する', async () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const { descriptor } = parse(source);
		const style = descriptor.styles[0];
		const compiled = await compileStyleAsync({ source: style.content, filename: 'HataskAkatsukiLayout.vue', id: 'data-v-favorites-test', scoped: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		if (!compiled.rawResult) throw new Error('Missing compiled CSS');
		const rules: { selector: string; container?: string; columns: string }[] = [];
		compiled.rawResult.root.walkRules(rule => {
			if (!rule.selector.includes('.hak-home-panes')) return;
			rule.walkDecls('grid-template-columns', decl => { rules.push({ selector: rule.selector, container: rule.parent?.type === 'atrule' ? rule.parent.params : undefined, columns: decl.value }); });
		});
		expect(rules).toEqual([
			{ selector: '.hak-home-panes[data-v-favorites-test]', container: undefined, columns: 'minmax(0, 1fr)' },
			{ selector: '.hak-home-panes[data-two-panes=true][data-v-favorites-test]', container: undefined, columns: 'repeat(2, minmax(0, 1fr))' },
			{ selector: '.hak-home-panes[data-two-panes=true][data-v-favorites-test]', container: 'hatask-akatsuki (max-width: 599px)', columns: 'minmax(0, 1fr)' },
		]);
	});

	test.each([390, 1200])('新規参加のおすすめを%s pxで小型特集として表示し、既存のHataIntro導線を使う', async width => {
		size = { width, height: 844 };
		const now = new Date('2026-09-10T12:00:00.000Z');
		const model = introductoryHome(now, now.toISOString());
		const { container, handlers } = await mountLayout({ model, now });
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('intro');
		expect(required(container, '.hak-intro-brand').textContent).toBe('HataIntro');
		expect(required(container, '.hak-intro-description').textContent).toContain('図と一緒に');
		expect(container.querySelector('.hak-focus-head')).toBeNull();
		expect(required(container, '[data-home-select="intro"]').getAttribute('aria-label')).toBe('HataIntro');
		click(container, '[data-home-intro]');
		expect(handlers.action).toHaveBeenCalledTimes(1);
		expect(handlers.action).toHaveBeenLastCalledWith({ type: 'open-app', id: 'intro' });
		expect(handlers.navigate).not.toHaveBeenCalled();
	});

	test('新規参加案内より手動選択を優先し、別タブ・旧テーマから戻っても選択を保持する', async () => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const createdAt = now.toISOString();
		const { container, liveProps } = await mountLayout({ model: introductoryHome(now, createdAt), now });
		click(container, '[data-home-select="todo"]');
		await nextTick();
		liveProps.model = introductoryHome(new Date(now.getTime() + 30_000), createdAt);
		liveProps.activeTab = 'cal';
		await nextTick();
		liveProps.enabled = false;
		await nextTick();
		expect(container.querySelector('[data-home-intro]')).toBeNull();
		liveProps.enabled = true;
		liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		click(container, '.hak-focus-option[aria-label="おすすめ"]');
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('intro');
	});

	test.each(['pointer', 'focus'])('参加日時の読込後でも%s操作中の通常おすすめを案内へ差し替えない', async interaction => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const { container, liveProps } = await mountLayout({ model: introductoryHome(now, '2025-01-01T00:00:00.000Z'), now });
		const focus = required(container, '.hak-focus');
		const control = required<HTMLButtonElement>(container, '.hak-focus-option[aria-label="おすすめ"]');
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerenter')); else control.focus();
		await nextTick();
		liveProps.model = introductoryHome(now, now.toISOString());
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerleave')); else control.blur();
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('intro');
	});

	test.each(['pointer', 'focus'])('14日を過ぎても案内の%s操作が終わるまで同じボタンを保持する', async interaction => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const createdAt = '2026-08-27T12:00:00.000Z';
		const { container, liveProps } = await mountLayout({ model: introductoryHome(now, createdAt), now });
		const focus = required(container, '.hak-focus');
		const button = required<HTMLButtonElement>(container, '[data-home-intro]');
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerenter')); else button.focus();
		await nextTick();
		liveProps.model = introductoryHome(new Date(now.getTime() + 1), createdAt);
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('intro');
		expect(required(container, '[data-home-intro]')).toBe(button);
		if (interaction === 'focus') expect(window.document.activeElement).toBe(button);
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerleave')); else button.blur();
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(container.querySelector('[data-home-select="intro"]')).toBeNull();
		expect(container.querySelector('[data-home-intro]')).toBeNull();
	});

	test('対象期間の終わりは選択中の案内を通常へ戻し、手動で選んだほかの項目は維持する', async () => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const createdAt = '2026-08-27T12:00:00.000Z';
		for (const selection of ['intro', 'meal']) {
			const { container, liveProps } = await mountLayout({ model: introductoryHome(now, createdAt), now });
			click(container, `[data-home-select="${selection}"]`);
			await nextTick();
			liveProps.model = introductoryHome(new Date(now.getTime() + 1), createdAt);
			await nextTick();
			expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe(selection === 'intro' ? 'todo' : 'meal');
			expect(container.querySelector('[data-home-select="intro"]')).toBeNull();
		}
	});

	test.each(['theme', 'tab'])('案内にフォーカスしたまま%sを切り替えても、期限後のホームでは通常おすすめへ戻る', async target => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const createdAt = '2026-08-27T12:00:00.000Z';
		const { container, liveProps } = await mountLayout({ model: introductoryHome(now, createdAt), now });
		required<HTMLButtonElement>(container, '[data-home-intro]').focus();
		await nextTick();
		if (target === 'theme') liveProps.enabled = false; else liveProps.activeTab = 'cal';
		await nextTick();
		liveProps.model = introductoryHome(new Date(now.getTime() + 1), createdAt);
		await nextTick();
		if (target === 'theme') liveProps.enabled = true; else liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(container.querySelector('[data-home-intro]')).toBeNull();
	});

	test('案内にフォーカスしてKeepAlive離脱しても、期限後の復帰時に保持を残さない', async () => {
		const now = new Date('2026-09-10T12:00:00.000Z');
		const createdAt = '2026-08-27T12:00:00.000Z';
		const visible = ref(true);
		const model = ref(introductoryHome(now, createdAt));
		const app = createApp({ render: () => h(KeepAlive, null, { default: () => visible.value ? h(HataskAkatsukiLayout, { enabled: true, activeTab: 'home', model: model.value, now }) : null }) });
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);
		mounted.push({ app, container });
		await nextTick();
		await nextTick();
		required<HTMLButtonElement>(container, '[data-home-intro]').focus();
		await nextTick();
		visible.value = false;
		await nextTick();
		model.value = introductoryHome(new Date(now.getTime() + 1), createdAt);
		await nextTick();
		visible.value = true;
		await nextTick();
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(container.querySelector('[data-home-intro]')).toBeNull();
	});

	test('599から600 pxへ切り替えても案内は残り、記録の読込中にもガイドを開ける', async () => {
		size = { width: 599, height: 844 };
		const now = new Date('2026-09-10T12:00:00.000Z');
		const { container, liveProps, handlers } = await mountLayout({ model: introductoryHome(now, now.toISOString()), now });
		liveProps.model.loading = true;
		size = { width: 600, height: 844 };
		resizeCallbacks.forEach(callback => callback());
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('intro');
		expect(container.querySelector('[data-home-select="tools"]')).toBeNull();
		click(container, '[data-home-intro]');
		expect(handlers.action).toHaveBeenCalledTimes(1);
		expect(handlers.action).toHaveBeenLastCalledWith({ type: 'open-app', id: 'intro' });
	});

	test('案内だけ既存おすすめの固定最小高さを外し、狭幅と明暗は局所のテーマ変数で調整する', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		expect(source).toContain(".hak-focus-panel[data-home-panel='intro'] { container: hak-intro-recommendation / inline-size; min-height: 0; padding: 0;");
		expect(source).toContain('@container hak-intro-recommendation (max-width: 520px)');
		expect(source).toContain('font: 400 32px/1.2 Righteous');
		expect(source).toContain('background: var(--fg); color: var(--bg)');
		expect(source).toContain('.hak-intro-open:focus-visible');
	});

	test('おすすめ枠を手動で切り替えても入力中の下書きを保持し、自動へ戻せる', async () => {
		const home = adaptiveHome('tools');
		home.sections = home.sections.map(section => ({ ...section, priority: section.id === 'todo' ? 200 : section.priority }));
		const { container, liveProps, handlers } = await mountLayout({ model: { ...sideModel(), home, meals: [{ id: 'lunch', label: '昼', text: 'まだ記録がありません', recorded: false }] } });
		const draft = required<HTMLInputElement>(container, '[data-draft]');
		draft.value = '書きかけの予定';
		expect(container.querySelector('[data-home-select="tools"]')).toBeNull();
		expect(container.querySelector('[data-home-suggestion="tools"]')).toBeNull();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(required(container, '.hak-focus-option[aria-label="おすすめ"]').getAttribute('aria-pressed')).toBe('true');
		click(container, '[data-home-select="meal"]');
		await nextTick();
		liveProps.model.home = adaptiveHome('todo');
		liveProps.activeTab = 'cal';
		await nextTick();
		liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('meal');
		expect(required(container, '[data-home-select="meal"]').getAttribute('aria-pressed')).toBe('true');
		click(container, '.hak-focus-option[aria-label="おすすめ"]');
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(required(container, '[data-draft]')).toBe(draft);
		expect(draft.value).toBe('書きかけの予定');
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
		expect(handlers.slotUnmounted).not.toHaveBeenCalled();
	});

	test.each(['pointer', 'focus'])('%sで操作している間は自動で表示を入れ替えない', async interaction => {
		const { container, liveProps } = await mountLayout({ model: { home: adaptiveHome('tools') } });
		const focus = required(container, '.hak-focus');
		const control = required<HTMLButtonElement>(container, '.hak-focus-option[aria-label="おすすめ"]');
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerenter'));
		else control.focus();
		await nextTick();
		liveProps.model.home = adaptiveHome('todo');
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('calendar');
		if (interaction === 'pointer') focus.dispatchEvent(new Event('pointerleave'));
		else control.blur();
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
	});

	test('HataFeedを選択中でも利用権限や表示設定がなくなれば通知を外す', async () => {
		const { container, liveProps } = await mountLayout({ model: { home: adaptiveHome('feedback') } });
		expect(required(container, '[data-home-panel] [data-feedback-fixture]').textContent).toContain('返信');
		click(container, '[data-home-select="feedback"]');
		await nextTick();
		const home = adaptiveHome();
		home.sections = home.sections.filter(section => section.id !== 'feedback');
		liveProps.model.home = home;
		await nextTick();
		expect(container.querySelector('[data-home-select="feedback"]')).toBeNull();
		expect(container.querySelector('[data-feedback-fixture]')).toBeNull();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('calendar');
	});

	test('小さな画面でもツール・ごはん・ToDoの既存操作につながる', async () => {
		size = { width: 390, height: 844 };
		const model = { ...sideModel(), home: adaptiveHome('tools'), meals: [{ id: 'lunch', label: '昼', text: 'まだ記録がありません', recorded: false }] };
		const { container, handlers } = await mountLayout({ model });
		click(container, '[data-home-tool="feed"]');
		expect(handlers.action).toHaveBeenLastCalledWith({ type: 'open-app', id: 'feed' });
		click(container, '[data-home-select="meal"]');
		await nextTick();
		click(container, '[data-home-panel="meal"] .hak-rich-row');
		expect(handlers.action).toHaveBeenLastCalledWith({ type: 'record-meal', id: 'lunch' });
		click(container, '[data-home-select="todo"]');
		await nextTick();
		const rows = [...container.querySelectorAll<HTMLButtonElement>('[data-home-panel="todo"] .hak-todo-row')];
		rows[0].click();
		expect(handlers.action).toHaveBeenLastCalledWith({ type: 'toggle-todo', id: 'todo-open', value: true });
		expect(rows[2].disabled).toBe(true);
		rows[2].click();
		expect(handlers.action).toHaveBeenCalledTimes(3);
		expect(model.todos?.[0].completed).toBe(false);
		expect([...container.querySelectorAll('[data-home-select]')]).toHaveLength(6);
		size = { width: 599, height: 844 };
		resizeCallbacks.forEach(callback => callback());
		await nextTick();
		click(container, '[data-home-select="tools"]');
		await nextTick();
		expect(required(container, '[data-home-select="tools"]').getAttribute('aria-pressed')).toBe('true');
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('tools');
		size = { width: 600, height: 844 };
		resizeCallbacks.forEach(callback => callback());
		await nextTick();
		expect(container.querySelector('[data-home-select="tools"]')).toBeNull();
		expect(container.querySelector('[data-home-suggestion="tools"]')).toBeNull();
		expect(required(container, '.hak-focus-option[aria-label="おすすめ"]').getAttribute('aria-pressed')).toBe('true');
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('calendar');
	});

	test('予定の時間図は閉じて表示し、補助候補からの切替は手動選択として保持する', async () => {
		const { container, liveProps } = await mountLayout({ model: { home: adaptiveHome('calendar'), next: { id: 'next', title: '打ち合わせ', timeLabel: '14:00' } } });
		expect(required<HTMLDetailsElement>(container, '.hak-schedule-details').open).toBe(false);
		expect(container.querySelectorAll('[data-home-suggestion]')).toHaveLength(2);
		click(container, '[data-home-suggestion="todo"]');
		await nextTick();
		liveProps.model.home = adaptiveHome('meal');
		await nextTick();
		expect(required(container, '[data-home-panel]').getAttribute('data-home-panel')).toBe('todo');
		expect(required(container, '[data-home-select="todo"]').getAttribute('aria-pressed')).toBe('true');
	});

	test('embedded navigation leaves the fade to HataGoes and keeps draft ownership with motion settings disabled', async () => {
		prefersReducedMotion = true;
		const { container, liveProps, handlers } = await mountLayout({ embedded: true, animations: false });
		const { animate } = observeTabMotion(container);
		const draft = required<HTMLInputElement>(container, '[data-draft]');
		draft.value = '入力を保持する';
		liveProps.activeTab = 'cal';
		await nextTick();
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-motion')).toBe('on');
		expect(animate).not.toHaveBeenCalled();
		expect(required(container, '[data-draft]')).toBe(draft);
		expect(draft.value).toBe('入力を保持する');
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
		expect(handlers.slotUnmounted).not.toHaveBeenCalled();
	});

	test('all categories fade without remounting the draft or making visibility depend on finish', async () => {
		const { container, liveProps, handlers } = await mountLayout();
		const { animate, animations } = observeTabMotion(container);
		const draft = required<HTMLInputElement>(container, '[data-draft]');
		draft.value = 'カテゴリを移っても残る入力';
		for (const tab of ['cal', 'todo', 'garden', 'support', 'ranking', 'mood', 'meal', 'hataskapps', 'apps', 'home'] as const) {
			liveProps.activeTab = tab;
			await nextTick();
			await nextTick();
			expect(required(container, '.htk-akatsuki-layout').getAttribute('data-tab')).toBe(tab);
			expect(required(container, '[data-draft]')).toBe(draft);
			expect(draft.value).toBe('カテゴリを移っても残る入力');
		}
		expect(animate).toHaveBeenCalledTimes(10);
		for (const animation of animations.slice(0, -1)) expect(animation.cancel).toHaveBeenCalledTimes(1);
		expect(animate).toHaveBeenLastCalledWith([{ opacity: expect.any(Number) }, { opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2, 0, 0, 1)' });
		expect(required<HTMLElement>(container, '.hak-center').style.opacity).toBe('');
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
		expect(handlers.slotUnmounted).not.toHaveBeenCalled();
	});

	test('an interrupted fade starts at its current opacity and releases itself on finish', async () => {
		const { container, liveProps } = await mountLayout();
		const { animate, animations } = observeTabMotion(container);
		liveProps.activeTab = 'cal';
		await nextTick();
		await nextTick();
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({ opacity: '.64' } as CSSStyleDeclaration);
		liveProps.activeTab = 'todo';
		await nextTick();
		await nextTick();
		expect(animations[0].cancel).toHaveBeenCalledTimes(1);
		expect(animate).toHaveBeenLastCalledWith([{ opacity: .64 }, { opacity: 1 }], expect.any(Object));
		animations[1].onfinish?.();
		liveProps.activeTab = 'mood';
		await nextTick();
		await nextTick();
		expect(animations[1].cancel).not.toHaveBeenCalled();
		expect(animate).toHaveBeenLastCalledWith([{ opacity: .2 }, { opacity: 1 }], expect.any(Object));
	});

	test('motion settings, reduced motion and unmount cancel a running category fade', async () => {
		const { container, liveProps } = await mountLayout({ animations: false });
		const { animate, animations } = observeTabMotion(container);
		liveProps.activeTab = 'cal';
		await nextTick();
		await nextTick();
		expect(animate).not.toHaveBeenCalled();
		liveProps.animations = true;
		liveProps.activeTab = 'todo';
		await nextTick();
		await nextTick();
		liveProps.animations = false;
		await nextTick();
		expect(animations[0].cancel).toHaveBeenCalledTimes(1);
		liveProps.animations = true;
		liveProps.activeTab = 'garden';
		await nextTick();
		await nextTick();
		prefersReducedMotion = true;
		motionCallbacks.forEach(callback => callback());
		await nextTick();
		expect(animations[1].cancel).toHaveBeenCalledTimes(1);
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-motion')).toBe('off');
		prefersReducedMotion = false;
		motionCallbacks.forEach(callback => callback());
		liveProps.activeTab = 'mood';
		await nextTick();
		await nextTick();
		mounted[0].app.unmount();
		mounted.shift()?.container.remove();
		expect(animations[2].cancel).toHaveBeenCalledTimes(1);
	});

	test('clock colors blend between ticks, pair with dark mode and do not leak into old themes', async () => {
		const { container, liveProps } = await mountLayout({ now: new Date(2026, 8, 5, 6), mode: 'light' });
		const root = required<HTMLElement>(container, '.htk-akatsuki-layout');
		const checkColors = () => {
			if (!liveProps.now || !liveProps.mode) throw new Error('Clock test requires an explicit date and mode');
			for (const [name, value] of Object.entries(getHataskDaylightStyle(liveProps.now, liveProps.mode))) expect(root.style.getPropertyValue(name)).toBe(value);
		};
		checkColors();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('0s');
		liveProps.now = new Date(2026, 8, 5, 12);
		await nextTick();
		checkColors();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('30s');
		liveProps.mode = 'dark';
		await nextTick();
		checkColors();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('220ms');
		liveProps.animations = false;
		await nextTick();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('0s');
		liveProps.enabled = false;
		await nextTick();
		expect(root.getAttribute('style') ?? '').not.toContain('--hak-daylight-');
	});

	test('user theme changes blend promptly and release the existing event subscription on disable/unmount', async () => {
		const listeners = globalEvents.listenerCount('themeChanging');
		const { container, liveProps } = await mountLayout({ now: new Date(2026, 8, 5, 6), mode: 'light' });
		const root = required<HTMLElement>(container, '.htk-akatsuki-layout');
		expect(globalEvents.listenerCount('themeChanging')).toBe(listeners + 1);
		liveProps.now = new Date(2026, 8, 5, 7);
		await nextTick();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('30s');
		globalEvents.emit('themeChanging');
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('220ms');
		await nextTick();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('220ms');
		expect(root.style.getPropertyValue('--hak-daylight-start')).toContain('var(--MI_THEME-accent,');
		liveProps.animations = false;
		globalEvents.emit('themeChanging');
		await nextTick();
		expect(root.style.getPropertyValue('--hak-daylight-duration')).toBe('0s');
		liveProps.enabled = false;
		await nextTick(); await nextTick();
		expect(globalEvents.listenerCount('themeChanging')).toBe(listeners);
		liveProps.enabled = true;
		await nextTick(); await nextTick();
		expect(globalEvents.listenerCount('themeChanging')).toBe(listeners + 1);
		const item = mounted.pop();
		item?.app.unmount(); item?.container.remove();
		expect(globalEvents.listenerCount('themeChanging')).toBe(listeners);
	});

	test('disabled layout keeps one original child and does not render Akatsuki controls', async () => {
		const { container, handlers } = await mountLayout({ enabled: false });
		expect(container.querySelectorAll('[data-draft]')).toHaveLength(1);
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-enabled')).toBe('false');
		expect(container.querySelector('.hak-rail')).toBeNull();
		expect(container.querySelector('.hak-home')).toBeNull();
		expect(container.querySelector('.hak-bottom')).toBeNull();
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
	});

	test('suspending and restoring the layout preserves the exact draft node and slot instance', async () => {
		const { container, liveProps, handlers } = await mountLayout({ enabled: false, activeTab: 'mood' });
		const draft = required<HTMLInputElement>(container, '[data-draft]');
		draft.value = 'テーマを切り替えても残す下書き';
		for (const enabled of [true, false, true, false]) {
			liveProps.enabled = enabled;
			await nextTick();
			await nextTick();
			expect(required(container, '[data-draft]')).toBe(draft);
			expect(draft.value).toBe('テーマを切り替えても残す下書き');
		}
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
		expect(handlers.slotUnmounted).not.toHaveBeenCalled();
	});

	test('tab changes keep the single default slot and its draft input mounted', async () => {
		const { container, liveProps, handlers } = await mountLayout({ activeTab: 'todo' });
		const draft = required<HTMLInputElement>(container, '[data-draft]');
		draft.value = 'まだ保存していない記録';
		liveProps.activeTab = 'mood';
		await nextTick();
		liveProps.activeTab = 'home';
		await nextTick();
		liveProps.activeTab = 'meal';
		await nextTick();
		expect(required(container, '[data-draft]')).toBe(draft);
		expect(draft.value).toBe('まだ保存していない記録');
		expect(container.querySelectorAll('[data-draft]')).toHaveLength(1);
		expect(handlers.slotMounted).toHaveBeenCalledTimes(1);
		expect(handlers.slotUnmounted).not.toHaveBeenCalled();
	});

	test('portrait non-home hides the aside and home restores it using element size', async () => {
		size = { width: 820, height: 1180 };
		const { container, liveProps } = await mountLayout({ activeTab: 'todo' });
		const root = required(container, '.htk-akatsuki-layout');
		expect(root.getAttribute('data-hide-aside')).toBe('true');
		liveProps.activeTab = 'home';
		await nextTick();
		expect(root.getAttribute('data-hide-aside')).toBe('false');
		size = { width: 1180, height: 820 };
		resizeCallbacks.forEach(callback => callback());
		liveProps.activeTab = 'todo';
		await nextTick();
		expect(root.getAttribute('data-hide-aside')).toBe('false');
	});

	test('narrow app body hides the aside without hiding a wide landscape home', async () => {
		size = { width: 820, height: 600 };
		const { container, liveProps } = await mountLayout({ activeTab: 'apps' });
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-hide-aside')).toBe('true');
		liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-hide-aside')).toBe('false');
	});

	test.each(['ranking', 'support'] as const)('%s uses the full content width and restores the home aside on return', async (activeTab) => {
		size = { width: 1440, height: 900 };
		const { container, liveProps } = await mountLayout({ activeTab });
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-hide-aside')).toBe('true');
		liveProps.activeTab = 'home';
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-hide-aside')).toBe('false');
	});

	test('右ペインは記録・お花・ごはん・継続・EYE・ToDoをそれぞれ一つのケースで包む', async () => {
		const { container } = await mountLayout({ model: sideModel() });
		const aside = required(container, '.hak-side');
		const cases = [...aside.querySelectorAll('.hak-side-case')];
		expect(cases).toHaveLength(6);
		for (const item of cases) expect(item.parentElement).toBe(aside);
		for (const [index, selector] of ['.hak-record-case', '.hak-flower-row', '.hak-meal-row', '.hak-streak', '.hak-side-eye', '.hak-todo-block'].entries()) {
			expect(cases[index]).toBe(required(aside, selector));
		}
		const recordCase = required(aside, '.hak-record-case');
		expect(required(recordCase, 'h2').textContent).toBe('きろく');
		expect(recordCase.querySelectorAll('.hak-week-day')).toHaveLength(7);
		expect(required(recordCase, '.hak-week').getAttribute('aria-label')).toBe('今週のきもち');
		expect(required(aside, '.hak-todo-block h3').textContent).toBe('ToDo');
		expect(aside.querySelector('.hak-side-apps')).toBeNull();
	});

	test('右ペインのケース化で既存操作・完了状態・読み取り専用の制約を変えない', async () => {
		const model = sideModel();
		const original = JSON.stringify(model);
		const { container, liveProps, handlers } = await mountLayout({ model });
		const aside = required(container, '.hak-side');
		for (const day of aside.querySelectorAll<HTMLButtonElement>('.hak-week-day')) day.click();
		click(aside, '.hak-flower-row');
		expect(handlers.navigate.mock.calls).toEqual([...Array.from({ length: 7 }, () => ['mood']), ['garden']]);
		click(aside, '.hak-meal-row button');
		const todos = [...aside.querySelectorAll<HTMLButtonElement>('.hak-todo-row')];
		expect(todos.map(todo => todo.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
		expect(todos.map(todo => todo.disabled)).toEqual([false, false, true]);
		for (const todo of todos) todo.click();
		expect(handlers.action.mock.calls).toEqual([
			[{ type: 'record-meal' }],
			[{ type: 'toggle-todo', id: 'todo-open', value: true }],
			[{ type: 'toggle-todo', id: 'todo-done', value: false }],
		]);
		expect(JSON.stringify(liveProps.model)).toBe(original);
	});

	test.each(['home', 'todo'] as const)('%sでもEYEの一言は表示を保ち、クリックやキー操作で遷移しない', async activeTab => {
		const { container, liveProps, handlers } = await mountLayout({ activeTab, model: sideModel() });
		const phrase = required<HTMLElement>(container, '.hak-side-eye');
		expect(phrase.tagName).toBe('DIV');
		expect(phrase.textContent).toContain('ひと息いれましょう');
		expect(required(phrase, 'small').textContent).toBe(' — EYE 3');
		expect(phrase.matches('button, a, [role="button"], [tabindex]')).toBe(false);
		expect(phrase.querySelector('button, a, [role="button"], [tabindex]')).toBeNull();
		expect(phrase.tabIndex).toBe(-1);
		// A neighboring control proves that the mounted navigation listener is connected.
		click(container, '.hak-flower-row');
		expect(handlers.navigate).toHaveBeenLastCalledWith('garden');
		handlers.navigate.mockClear();
		phrase.click();
		for (const key of ['Enter', ' ']) phrase.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		expect(handlers.navigate).not.toHaveBeenCalled();
		expect(handlers.action).not.toHaveBeenCalled();
		liveProps.model.eye = { text: 'きょうも、自分のペースで', number: 0 };
		await nextTick();
		expect(required(container, '.hak-side-eye')).toBe(phrase);
		expect(phrase.textContent).toContain('きょうも、自分のペースで');
		expect(required(phrase, 'small').textContent).toBe(' — EYE 0');
	});

	test('読込中は記録ケース内の案内だけを表示し、読込後に保存済みの内容を戻す', async () => {
		const { container, liveProps, handlers } = await mountLayout({ model: { ...sideModel(), loading: true } });
		const aside = required(container, '.hak-side');
		const recordCase = required(aside, '.hak-record-case');
		expect(aside.querySelectorAll('.hak-side-case')).toHaveLength(1);
		expect(recordCase.textContent).toContain('記録を読み込んでいます');
		expect(aside.querySelector('button')).toBeNull();
		liveProps.model.loading = false;
		await nextTick();
		expect(required(aside, '.hak-record-case')).toBe(recordCase);
		expect(aside.querySelectorAll('.hak-side-case')).toHaveLength(6);
		expect(aside.textContent).not.toContain('記録を読み込んでいます');
		expect(handlers.action).not.toHaveBeenCalled();
		expect(handlers.navigate).not.toHaveBeenCalled();
		liveProps.model = {};
		await nextTick();
		expect(aside.querySelectorAll('.hak-side-case')).toHaveLength(1);
		expect(aside.querySelector('button')).toBeNull();
	});

	test('PCサイドはおはな・支援情報・ランキング・Hatask Appの順に並び、各タブの既存導線を保つ', async () => {
		const { container, handlers } = await mountLayout();
		expect([...container.querySelectorAll('.hak-rail-tab')].map(button => button.getAttribute('aria-label'))).toEqual([
			'ホーム', 'カレンダー', 'ToDo', 'きもち', 'ごはん', 'レシピ', 'おはな', '支援情報', 'ランキング', 'Hatask App', 'Hataskey App', 'Hatask を閉じる',
		]);
		click(container, '.hak-rail [aria-label="おはな"]');
		click(container, '.hak-rail [aria-label="支援情報"]');
		click(container, '.hak-rail [aria-label="ランキング"]');
		click(container, '.hak-rail [aria-label="Hatask App"]');
		click(container, '.hak-rail [aria-label="Hataskey App"]');
		expect(handlers.navigate.mock.calls).toEqual([['garden'], ['support'], ['ranking'], ['hataskapps'], ['apps']]);
		expect(container.querySelector('.hak-rail [aria-label="EYE"]')).toBeNull();
	});

	test('the desktop brand sits immediately right of the hamburger in one vertically centered row', async () => {
		const { container } = await mountLayout();
		const header = required(container, '.hak-rail > .hak-rail-head');
		expect([...header.children].map(element => element.className)).toEqual(['hak-rail-menu hak-icon', 'hak-rail-brand hak-brand']);
		expect(required(header, '.hak-rail-brand').textContent).toBe('Hatask');
		expect(required(header, '.hak-rail-menu').getAttribute('aria-label')).toBe('メニューを開閉');
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		expect(source).toMatch(/\.hak-rail-head\s*\{\s*display:\s*flex;\s*align-items:\s*center;/u);
		expect(source).toMatch(/\.hak-rail-brand\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*font-size:\s*20px;[^}]*white-space:\s*nowrap;\s*\}/u);
		expect(source).toMatch(/\.hak-brand\s*\{[^}]*font-family:\s*'Righteous'/u);
	});

	test('the expanded hamburger and tab icon columns share a horizontal center', async () => {
		const { container } = await mountLayout();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-rail-collapsed')).toBe('false');
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const menu = source.match(/\.htk-akatsuki-layout \.hak-rail-menu\s*\{([^}]+)\}/u)?.[1];
		const tab = source.match(/\.hak-rail-tab\s*\{([^}]+)\}/u)?.[1];
		const icon = source.match(/\.hak-rail-tab > \.ti\s*\{([^}]+)\}/u)?.[1];
		if (!menu || !tab || !icon) throw new Error('Actual rail layout rules are required');
		const menuWidth = Number(menu.match(/\bwidth:\s*(\d+)px;/u)?.[1]);
		const tabPadding = Number(tab.match(/\bpadding:\s*0 (\d+)px !important;/u)?.[1]);
		const iconWidth = Number(icon.match(/\bwidth:\s*(\d+)px;/u)?.[1]);
		const iconHeight = Number(icon.match(/\bheight:\s*(\d+)px;/u)?.[1]);
		expect(Number.isFinite(menuWidth + tabPadding + iconWidth)).toBe(true);
		const tabIconCenter = tabPadding + iconWidth / 2;
		expect(40 / 2, 'the previous 40px hamburger reproduces the left offset').not.toBe(tabIconCenter);
		expect(menuWidth / 2).toBe(tabIconCenter);
		expect(icon).toMatch(/\bdisplay:\s*grid;/u);
		expect(icon).toMatch(/\bplace-items:\s*center;/u);
		expect(icon).toContain(`flex: 0 0 ${iconWidth}px;`);
		expect(iconHeight).toBe(iconWidth);
	});

	test('railのアイコンは意味をボタン側に残し、ハンバーガーも正方形の字形枠を使う', async () => {
		const { container } = await mountLayout();
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('.hak-rail button')];
		expect(buttons).toHaveLength(13);
		for (const button of buttons) {
			expect(button.getAttribute('aria-label')?.length).toBeGreaterThan(0);
			const icons = [...button.querySelectorAll('.ti')];
			if (button.getAttribute('aria-label') === 'ホーム' || button.querySelector('[data-hata-feature]')) {
				expect(icons).toHaveLength(0);
				expect(button.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
			} else {
				expect(icons).toHaveLength(1);
				expect(icons[0].parentElement).toBe(button);
				expect(icons[0].getAttribute('aria-hidden')).toBe('true');
			}
		}
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const menuIcon = source.match(/\.hak-rail-menu > \.ti\s*\{([^}]+)\}/u)?.[1];
		if (!menuIcon) throw new Error('Actual hamburger icon rule is required');
		expect(menuIcon).toContain('width: 21px;');
		expect(menuIcon).toContain('height: 21px;');
		expect(menuIcon).toContain('display: grid;');
		expect(menuIcon).toContain('place-items: center;');
	});

	test('the collapsed hamburger centers within the same rail as its tab buttons', async () => {
		const { container } = await mountLayout();
		const menu = required<HTMLButtonElement>(container, '.hak-rail-menu');
		menu.click();
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-rail-collapsed')).toBe('true');
		expect(menu.getAttribute('aria-expanded')).toBe('false');
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		expect(source).toMatch(/\[data-rail-collapsed='true'\] \.hak-rail-head\s*\{\s*justify-content:\s*center;/u);
		expect(source).toMatch(/\[data-rail-collapsed='true'\] \.hak-rail-brand,[^}]*display:\s*none;/u);
		expect(source).toMatch(/\[data-rail-collapsed='true'\] \.hak-rail-tab\s*\{[^}]*justify-content:\s*center;[^}]*padding-inline:\s*0 !important;/u);
		menu.click();
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-rail-collapsed')).toBe('false');
		expect(menu.getAttribute('aria-expanded')).toBe('true');
	});

	test('Hatask App stays in mobile navigation and the optional Hataskey App retains its home return link', async () => {
		size = { width: 390, height: 790 };
		const { container, liveProps, handlers } = await mountLayout({ model: { mobileTabs: ['home', 'cal', 'hataskapps', 'mood'] } });
		const returnIds = () => [...container.querySelectorAll('[data-app-return]')].map(button => button.getAttribute('data-app-return'));
		expect(returnIds()).toEqual(['apps']);
		click(container, '.hak-mobile-tab[aria-label="Hatask App"]');
		click(container, '[data-app-return="apps"]');
		expect(handlers.navigate.mock.calls).toEqual([['hataskapps'], ['apps']]);
		expect(liveProps.model.mobileTabs).toEqual(['home', 'cal', 'hataskapps', 'mood']);
		liveProps.model.mobileTabs = ['hataskapps', 'apps', 'cal', 'home'];
		await nextTick();
		expect(returnIds()).toEqual([]);
		expect([...container.querySelectorAll('.hak-mobile-tab')].map(button => button.getAttribute('aria-label'))).toEqual(['Hatask App', 'Hataskey App', 'カレンダー', 'ホーム']);
		expect(liveProps.model.mobileTabs).toEqual(['hataskapps', 'apps', 'cal', 'home']);
		liveProps.model.mobileTabs = ['home', 'cal', 'todo', 'hataskapps'];
		size = { width: 1200, height: 800 };
		resizeCallbacks.forEach(callback => callback());
		await nextTick();
		expect(container.querySelector('.hak-app-return')).toBeNull();
		expect(liveProps.model.mobileTabs).toEqual(['home', 'cal', 'todo', 'hataskapps']);
	});

	test.each([
		{ saved: ['ranking', 'home', 'garden', 'hataskapps'], labels: ['ランキング', 'ホーム', 'おはな', 'Hatask App'] },
		{ saved: ['hataskapps', 'garden', 'home', 'ranking'], labels: ['Hatask App', 'おはな', 'ホーム', 'ランキング'] },
	] satisfies { saved: NonNullable<HataskAkatsukiLayoutProps['model']['mobileTabs']>; labels: string[] }[])('ランキングの標準位置を変えても保存済みモバイル4枠を幅変更後まで保持する: $saved', async ({ saved, labels }) => {
		size = { width: 390, height: 844 };
		const original = [...saved];
		const { container, liveProps, handlers } = await mountLayout({ activeTab: 'ranking', model: { mobileTabs: saved } });
		const savedTabs = liveProps.model.mobileTabs;
		for (const width of [390, 599, 600, 1200, 390]) {
			size = { width, height: 844 };
			resizeCallbacks.forEach(callback => callback());
			await nextTick();
			expect([...container.querySelectorAll('.hak-mobile-tab')].map(button => button.getAttribute('aria-label'))).toEqual(labels);
			expect(required(container, '.hak-mobile-tab[aria-current="page"]').getAttribute('aria-label')).toBe('ランキング');
			expect(liveProps.model.mobileTabs).toBe(savedTabs);
			expect(liveProps.model.mobileTabs).toEqual(original);
			expect(saved).toEqual(original);
		}
		for (const button of container.querySelectorAll<HTMLButtonElement>('.hak-mobile-tab')) button.click();
		expect(handlers.navigate.mock.calls).toEqual(original.map(id => [id]));
		expect(liveProps.model.mobileTabs).toEqual(original);
		expect(saved).toEqual(original);
	});

	test.each([
		{ saved: ['home', 'cal', 'todo', 'mood'], labels: ['ホーム', 'カレンダー', 'ToDo', 'Hatask App'] },
		{ saved: ['cal', 'todo', 'mood', 'home'], labels: ['カレンダー', 'ToDo', 'Hatask App', 'ホーム'] },
		{ saved: ['home', 'todo', 'todo', 'apps'], labels: ['ホーム', 'ToDo', 'Hatask App', 'Hataskey App'] },
		{ saved: ['cal', 'todo', 'hataskapps', 'apps'], labels: ['ホーム', 'ToDo', 'Hatask App', 'Hataskey App'] },
	] satisfies { saved: NonNullable<HataskAkatsukiLayoutProps['model']['mobileTabs']>; labels: string[] }[])('mobile navigation repairs missing mandatory tabs or duplicates only for display: $saved', async ({ saved, labels }) => {
		size = { width: 390, height: 790 };
		const original = [...saved];
		const { container, liveProps } = await mountLayout({ model: { mobileTabs: saved } });
		const rendered = [...container.querySelectorAll('.hak-mobile-tab')].map(button => button.getAttribute('aria-label'));
		expect(rendered).toEqual(labels);
		expect(new Set(rendered).size).toBe(4);
		expect(rendered).toContain('ホーム');
		expect(rendered).toContain('Hatask App');
		expect(container.querySelector('[data-app-return="hataskapps"]')).toBeNull();
		expect(liveProps.model.mobileTabs).toEqual(original);
		expect(saved).toEqual(original);
	});

	test('the live timed events define markers and extend the range beyond 8–22', async () => {
		const { container } = await mountLayout({ model: { timeline: [{ id: 'early', title: '早朝の予定', timeLabel: '06:00', startMinute: 360, endMinute: 420 }, { id: 'late', title: '夜の予定', timeLabel: '23:00', startMinute: 1380, endMinute: 1440 }, { id: 'all-day', title: '終日の予定', timeLabel: '終日' }] } });
		const markers = [...container.querySelectorAll<HTMLButtonElement>('.hak-time-block')];
		expect(markers.map(marker => marker.getAttribute('aria-label'))).toEqual(['06:00 早朝の予定', '23:00 夜の予定']);
		expect(markers[0].style.left).toBe('0%');
		expect(markers[1].style.left).toBe('94.44444444444444%');
		const labels = [...container.querySelectorAll('.hak-time-tick')].map(tick => tick.textContent);
		expect(labels[0]).toBe('6');
		expect(labels.at(-1)).toBe('24');
	});

	test('does not present loading or failed retrieval as an empty schedule', async () => {
		const { container, liveProps } = await mountLayout({ model: { loading: true } });
		expect(container.textContent).toContain('記録を読み込んでいます');
		expect(container.textContent).not.toContain('つぎの予定は、まだありません');
		liveProps.model = { scheduleUnavailable: true };
		await nextTick();
		expect(container.textContent).toContain('予定を読み込めませんでした');
		expect(container.textContent).not.toContain('つぎの予定は、まだありません');
		liveProps.model = {};
		await nextTick();
		expect(container.textContent).toContain('つぎの予定は、まだありません');
	});

	test('the empty schedule heading breaks after its complete lead, not inside the phrase', async () => {
		const { container } = await mountLayout();
		const heading = required(container, '.hak-next h1');
		expect([...heading.children].map(element => [element.className, element.textContent])).toEqual([
			['hak-next-lead', 'つぎの予定は、'],
			['hak-next-title', 'まだありません'],
		]);
		expect(heading.textContent).toBe('つぎの予定は、まだありません');
	});

	test.each([
		'病院に行く',
		'午前の打ち合わせのあとに図書館で資料を受け取る',
		'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(3),
	])('event headings separate the lead without inserting breaks into saved titles: %s', async title => {
		const { container, liveProps, handlers } = await mountLayout({ model: { next: { id: 'next', title, timeLabel: '14:00', meta: '今日 ・ 14:00 – 15:00' } } });
		const heading = required(container, '.hak-next h1');
		expect([...heading.children].map(element => [element.className, element.textContent])).toEqual([
			['hak-next-lead', 'つぎは、'],
			['hak-next-title', title],
		]);
		expect(heading.textContent).toBe(`つぎは、${title}`);
		expect(required(container, '.hak-next-title').childNodes).toHaveLength(1);
		expect(required(container, '.hak-next p').textContent).toBe('今日 ・ 14:00 – 15:00');
		expect(liveProps.model.next?.title).toBe(title);
		click(container, '.hak-next .hak-action-button');
		expect(handlers.action).toHaveBeenCalledWith({ type: 'open-event', id: 'next' });
	});

	test('heading line blocks keep the lead together and allow long titles to wrap within the pane', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		expect(source).toMatch(/\.hak-next-lead\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/u);
		expect(source).toMatch(/\.hak-next-title\s*\{[^}]*display:\s*block;[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*normal;/u);
		expect(source).toMatch(/\.hak-next\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*44ch;/u);
		expect(source).toMatch(/\.hak-next h1\s*\{[^}]*text-wrap:\s*balance;/u);
	});

	test('the saved showEvents switch hides the schedule sections', async () => {
		const { container } = await mountLayout({ model: { showEvents: false } });
		expect(container.querySelector('.hak-next')).toBeNull();
		expect(container.querySelector('.hak-later')).toBeNull();
		expect(container.querySelector('.hak-timeline')).toBeNull();
	});

	test('failed meal retrieval is not labeled as an unrecorded meal', async () => {
		const { container } = await mountLayout({ model: { meals: [{ id: 'dinner', label: '夜', text: '記録を読み込めません', recorded: false, unavailable: true }] } });
		click(container, '[data-home-select="meal"]');
		await nextTick();
		const row = required<HTMLButtonElement>(container, '[data-home-panel="meal"] .hak-rich-row');
		expect(row.textContent).toContain('記録を読み込めません');
		expect(row.querySelector('.hak-rich-status')).toBeNull();
		expect(row.textContent).not.toContain('未記録');
		expect(row.disabled).toBe(true);
	});

	test('loading blocks mutating actions but still permits exit', async () => {
		const { container, handlers } = await mountLayout({ model: { loading: true } });
		click(container, '.hak-sheet-action');
		click(container, '.hak-exit');
		expect(handlers.action.mock.calls).toEqual([[{ type: 'exit' }]]);
	});

	test('reduced motion leaves the mobile navigation expanded on scroll', async () => {
		size = { width: 390, height: 790 };
		prefersReducedMotion = true;
		const { container } = await mountLayout();
		required(container, '.hak-scroll').dispatchEvent(new Event('scroll'));
		await nextTick();
		const root = required(container, '.htk-akatsuki-layout');
		expect(root.getAttribute('data-motion')).toBe('off');
		expect(root.getAttribute('data-nav-hidden')).toBe('false');
	});

	test('the saved animation switch also leaves navigation expanded', async () => {
		size = { width: 390, height: 790 };
		const { container } = await mountLayout({ animations: false });
		required(container, '.hak-scroll').dispatchEvent(new Event('scroll'));
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-nav-hidden')).toBe('false');
	});

	test('mobile scroll hides tabs and restores them after 420 ms', async () => {
		size = { width: 390, height: 790 };
		const { container } = await mountLayout();
		vi.useFakeTimers();
		required(container, '.hak-scroll').dispatchEvent(new Event('scroll'));
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-nav-hidden')).toBe('true');
		expect(required(container, '.hak-mobile-tab').getAttribute('tabindex')).toBe('-1');
		vi.advanceTimersByTime(420);
		await nextTick();
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-nav-hidden')).toBe('false');
	});

	test('FAB names only actual operations and its choices emit intentions', async () => {
		size = { width: 390, height: 790 };
		const { container, handlers } = await mountLayout();
		expect(required(container, '.hak-fab-sheet').textContent).not.toContain('水やり');
		expect(required(container, '.hak-fab-sheet').textContent).toContain('おはなの様子を見る');
		click(container, '.hak-fab');
		await nextTick();
		expect(required(container, '.hak-fab').getAttribute('aria-expanded')).toBe('true');
		click(container, '.hak-sheet-action');
		await nextTick();
		expect(handlers.action).toHaveBeenCalledWith({ type: 'create-event' });
		expect(required(container, '.hak-fab').getAttribute('aria-expanded')).toBe('false');
	});

	test('submitting search emits the entered query instead of a mock result', async () => {
		const { container, handlers } = await mountLayout();
		const input = required<HTMLInputElement>(container, '.hak-desktop-search input');
		input.value = '  保存済みの予定  ';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		required(container, '.hak-desktop-case').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		expect(handlers.search).toHaveBeenCalledWith('保存済みの予定');
	});

	test('mobile search is focusable only while open and Escape restores the toggle', async () => {
		size = { width: 390, height: 790 };
		const { container } = await mountLayout();
		const input = required<HTMLInputElement>(container, '.hak-mobile-search input');
		expect(input.disabled).toBe(true);
		click(container, '.hak-search-toggle');
		await nextTick();
		await nextTick();
		expect(input.disabled).toBe(false);
		expect(window.document.activeElement).toBe(input);
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		expect(input.disabled).toBe(true);
		expect(window.document.activeElement).toBe(required(container, '.hak-search-toggle'));
	});

	test('検索結果だけを表示し、元の入力欄と共有クエリを維持する', async () => {
		const { container, liveProps, handlers } = await mountLayout();
		const input = required<HTMLInputElement>(container, '.hak-desktop-search input');
		const disclosure = searchDisclosure(container, false);
		const results = required(container, '.hak-search-results');
		expect(results.parentElement).toBe(required(disclosure, '.hak-search-disclosure-clip'));
		const originalInputs = Array.from(container.querySelectorAll('input[type="search"]'));
		input.focus();
		input.value = '予定';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		expect(liveProps.searchQuery).toBe('予定');
		liveProps.searchOpen = true;
		await nextTick();
		expect(searchDisclosure(container, true)).toBe(disclosure);
		expect(required(container, '[data-search-results]').textContent).toBe('予定');
		expect(container.querySelectorAll('.hak-search-results input')).toHaveLength(0);
		expect(Array.from(container.querySelectorAll('input[type="search"]'))).toEqual(originalInputs);
		expect(window.document.activeElement).toBe(input);
		expect(input.getAttribute('aria-controls')).toBe(required(container, '.hak-search-results').id);
		input.value = '更新';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		expect(required(container, '[data-search-results]').textContent).toBe('更新');
		click(container, '.hak-search-results-head button');
		await nextTick();
		expect(handlers.closeSearch).toHaveBeenCalledOnce();
		expect(searchDisclosure(container, false)).toBe(disclosure);
		expect(required(container, '.hak-search-results')).toBe(results);
		expect(input.getAttribute('aria-controls')).toBeNull();
		expect(window.document.activeElement).toBe(input);
		expect(input.value).toBe('更新');
	});

	test.each([
		{ animations: true, reducedMotion: false },
		{ animations: false, reducedMotion: false },
		{ animations: true, reducedMotion: true },
	])('検索の上下開閉は同じ結果DOMで反転し、動きの設定にかかわらず閉状態を即座に操作対象外にする: %o', async ({ animations, reducedMotion }) => {
		prefersReducedMotion = reducedMotion;
		const { container, liveProps } = await mountLayout({ animations, searchQuery: '保存済みの検索語' });
		const wrapper = searchDisclosure(container, false);
		const results = required(container, '.hak-search-results');
		const contents = required(container, '[data-search-results]');
		for (const opened of [true, false, true, false, true]) {
			liveProps.searchOpen = opened;
			await nextTick();
			expect(searchDisclosure(container, opened)).toBe(wrapper);
			expect(required(container, '.hak-search-results')).toBe(results);
			expect(required(container, '[data-search-results]')).toBe(contents);
			expect(container.querySelectorAll('.hak-search-results')).toHaveLength(1);
			expect(contents.textContent).toBe('保存済みの検索語');
		}
		expect(required(container, '.htk-akatsuki-layout').getAttribute('data-motion')).toBe(animations && !reducedMotion ? 'on' : 'off');
	});

	test.each([390, 1200])('%dpx: 結果はEscapeで閉じ、入力文字を残す', async width => {
		size = { width, height: 790 };
		const { container, liveProps } = await mountLayout({ searchOpen: true, searchQuery: '保存した検索語' });
		const ancestorKeydown = vi.fn();
		container.addEventListener('keydown', ancestorKeydown);
		const input = required<HTMLInputElement>(container, width < 600 ? '.hak-mobile-search input' : '.hak-desktop-search input');
		expect(input.disabled).toBe(false);
		input.focus();
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		expect(liveProps.searchOpen).toBe(false);
		searchDisclosure(container, false);
		expect(input.value).toBe('保存した検索語');
		expect(window.document.activeElement).toBe(input);
		expect(ancestorKeydown).not.toHaveBeenCalled();
		if (width > 599) {
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			expect(ancestorKeydown).toHaveBeenCalledOnce();
		}
	});

	test('無効なレイアウトでは検索結果を描画しない', async () => {
		const { container } = await mountLayout({ enabled: false, searchOpen: true });
		expect(container.querySelector('.hak-search-results')).toBeNull();
		expect(container.querySelector('.hak-search-disclosure')).toBeNull();
	});

	test('next-event metadata is not repeated and existing home supplements remain available', async () => {
		const { container } = await mountLayout({ model: { next: { id: 'event', title: '保存済みの予定', timeLabel: '14:00', meta: '今日 ・ 14:00 – 15:00' } } });
		expect(required(container, '.hak-next p').textContent).toBe('今日 ・ 14:00 – 15:00');
		expect(required(container, '.hak-home-extra').textContent).toBe('保存済みの補足');
	});
});
