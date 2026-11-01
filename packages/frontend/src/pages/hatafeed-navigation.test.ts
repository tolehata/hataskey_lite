/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, ref } from 'vue';
import type { Ref } from 'vue';

const fixture = vi.hoisted(() => ({ guide: vi.fn(), stopGuide: vi.fn(), api: vi.fn(), popup: vi.fn(), menu: vi.fn(), path: null as Ref<string> | null }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: (path: string) => { fixture.path!.value = path; } }) }));
vi.mock('@/utility/hatafeed-tutorial-launcher.js', () => ({ showHataFeedTutorial: fixture.guide }));
vi.mock('@/utility/hatagoes-pickers.js', () => ({ useHataGoesPickers: () => ({ selectUser: vi.fn() }) }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'staff' }, iAmModerator: true }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false), 'hatafeed.leaves': (await import('vue')).ref(false) } } }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ popup: fixture.popup, popupMenu: fixture.menu, toast: vi.fn(), alert: vi.fn() }));
vi.mock('@/utility/hatafeed.js', async () => ({
	hataFeedUnreadCount: (await import('vue')).ref(0), categoryLabel: {}, categoryKeys: [], staffOnlyCategoryKeys: [], statusLabel: {}, statusKeys: [], emojiStatusLabel: {}, emojiStatusIcon: {},
}));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/components/MkHataskeyNotificationToasts.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HataFeedBeta.vue', () => ({ default: { template: '<section data-beta>ベータ機能</section>' } }));
vi.mock('@/components/HataFeedIssue.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HataFeedLeaves.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfStatusPill.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfCategoryBadge.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfAvatar.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HfQuotaMeter.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/HataFeedNotifications.vue', () => ({ default: { name: 'HataFeedNotifications', template: '<div/>' } }));
vi.mock('@/components/HataFeedDisplaySettings.vue', () => ({ default: { name: 'HataFeedDisplaySettings', template: '<div/>' } }));
import HataFeed from './hatafeed.vue';
import HataFeedBetaPage from './hatafeed-beta.vue';
import { hataFeedTab } from '@/utility/hatafeed-ui.js';
import { getNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { DI } from '@/di.js';

const cleanups: Array<() => void> = [];
beforeEach(() => {
	fixture.guide.mockReset().mockResolvedValue(fixture.stopGuide); fixture.stopGuide.mockReset();
	hataFeedTab.value = 'home'; fixture.path = ref('/hatafeed');
	fixture.popup.mockReset().mockReturnValue({ dispose: vi.fn() }); fixture.menu.mockReset();
	fixture.api.mockReset().mockImplementation(async (endpoint: string) => {
		if (endpoint.endsWith('/available')) return { available: true, isStaff: true };
		if (endpoint.endsWith('/notifications')) return { unreadCount: 0 };
		if (endpoint.endsWith('/emoji-quota')) return { limit: 5, remaining: 5 };
		return [];
	});
	vi.stubGlobal('IntersectionObserver', class { constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {} observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} });
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });

async function mount(closePageWindow?: () => void, embedded = false) {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(KeepAlive, {}, { default: () => fixture.path!.value === '/' ? h('main', { 'data-timeline': true }) : h(fixture.path!.value === '/hatafeed/beta' ? HataFeedBetaPage : HataFeed, { key: fixture.path!.value, ...(embedded ? { embedded: true, requestedTab: 'issues' } : {}) }) }) });
	if (closePageWindow) app.provide(DI.pageWindowClose, closePageWindow);
	app.component('MkTime', { template: '<time/>' }); app.component('MkUserName', { template: '<span/>' });
	app.mount(target); cleanups.push(() => { app.unmount(); target.remove(); });
	await vi.waitFor(() => expect(target.querySelector('main')).not.toBeNull()); return target;
}

async function click(target: HTMLElement, label: string) {
	const button = target.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
	expect(button).not.toBeNull(); button!.click(); await nextTick();
}

describe('HataFeed page navigation and header actions', () => {
	test('embedded issue filters stay visible and drive the paged issue request', async () => {
		const target = await mount(undefined, true);
		const filters = target.querySelector<HTMLElement>('section[aria-busy]')!;
		expect([...filters.querySelectorAll('button')].some(button => button.textContent?.includes('受付終了も含む'))).toBe(true);
		const include = [...filters.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('受付終了も含む'))!;
		include.click();
		await vi.waitFor(() => expect(fixture.api.mock.calls.some(([endpoint, params]) => endpoint === 'hata/feedback/issues' && params.includeClosed === true && params.limit === 11)).toBe(true));
		const dropdowns = filters.querySelectorAll<HTMLButtonElement>('button');
		const category = [...dropdowns].find(button => button.textContent?.includes('カテゴリ'))!;
		category.click();
		await nextTick();
		expect(target.querySelector('[role="dialog"][aria-label="絞り込み"]')).not.toBeNull();
	});
	test.each([false, true])('exit returns to the timeline or closes the containing window (window=%s)', async inWindow => {
		const close = vi.fn();
		const target = await mount(inWindow ? close : undefined);
		await click(target, 'ベータ');
		await vi.waitFor(() => expect(target.querySelector('[data-beta]')).not.toBeNull());
		fixture.api.mockClear();
		await click(target, 'HataFeed から退出');
		if (inWindow) {
			expect(close).toHaveBeenCalledOnce();
			expect(fixture.path!.value).toBe('/hatafeed/beta');
		} else {
			expect(close).not.toHaveBeenCalled();
			expect(fixture.path!.value).toBe('/');
			expect(target.querySelector('[data-timeline]')).not.toBeNull();
		}
		expect(fixture.api).not.toHaveBeenCalled();
	});
	test('returning to the cached beta URL restores beta after leaving through admin', async () => {
		const target = await mount();
		await click(target, 'ベータ');
		await vi.waitFor(() => expect(target.querySelector('[data-beta]')).not.toBeNull());
		await click(target, '申請管理');
		await vi.waitFor(() => expect(target.querySelector('[aria-label="申請管理"]')?.getAttribute('aria-pressed')).toBe('true'));
		expect(fixture.path!.value).toBe('/hatafeed');
		await click(target, 'ベータ');
		await vi.waitFor(() => expect(target.querySelector('[data-beta]')).not.toBeNull());
		expect(target.querySelector('[aria-label="ベータ"]')?.getAttribute('aria-pressed')).toBe('true');
		await click(target, 'ホーム'); await nextTick();
		expect(target.querySelector('[aria-label="ホーム"]')?.getAttribute('aria-pressed')).toBe('true');
	});
	test('automatically offers a guide after loading and cancels it when its cached page deactivates', async () => {
		const target = await mount();
		await vi.waitFor(() => expect(fixture.guide).toHaveBeenCalledOnce());
		const owner = fixture.guide.mock.calls[0][0];
		expect(owner).toMatchObject({ isStaff: true, hasExistingActivity: false });
		expect(owner.isActive()).toBe(true);
		await click(target, 'ベータ');
		await vi.waitFor(() => expect(fixture.stopGuide).toHaveBeenCalled());
		expect(owner.isActive()).toBe(false);
	});

	test('retains the bell element across the asynchronous component import', async () => {
		const target = await mount();
		const bell = target.querySelector<HTMLButtonElement>('[aria-label="通知"]')!;
		await click(target, '通知');
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalled());
		expect(fixture.popup.mock.calls[0][1].anchorElement).toBe(bell);
	});
	test('the gear opens settings directly, without an intermediate menu', async () => {
		const target = await mount(); await click(target, '設定');
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalled());
		expect(fixture.popup.mock.calls[0][0].name).toBe('HataFeedDisplaySettings');
		expect(fixture.menu).not.toHaveBeenCalled();
	});
	test('project settings changes refresh the name without putting management back in the project menu', async () => {
		const target = await mount(); await click(target, '設定');
		await vi.waitFor(() => expect(fixture.popup).toHaveBeenCalled());
		fixture.api.mockImplementationOnce(async () => [{ id: 'official', name: '編集したプロジェクト', isOfficial: true }]);
		await fixture.popup.mock.calls[0][2].projectsChanged(); await nextTick();
		expect(target.querySelector('[aria-label^="プロジェクトを切り替え"]')?.getAttribute('title')).toBe('編集したプロジェクト');
		target.querySelector<HTMLButtonElement>('[aria-label^="プロジェクトを切り替え"]')!.click();
		expect(fixture.menu.mock.calls[0][0].filter(Boolean).map((item: { text: string }) => item.text)).toEqual(['編集したプロジェクト', '概要']);
	});
	test('refresh shows its busy state and reports completion to the navbar', async () => {
		const target = await mount();
		let resolve!: (value: unknown[]) => void;
		fixture.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		await click(target, '更新');
		expect(target.querySelector<HTMLButtonElement>('[aria-label="更新"]')?.disabled).toBe(true);
		resolve([]);
		await vi.waitFor(() => expect(target.querySelector<HTMLButtonElement>('[aria-label="更新"]')?.disabled).toBe(false));
		expect(getNotificationPageContext()?.items.value[0]).toMatchObject({ source: 'status', message: '更新しました' });
	});
});
