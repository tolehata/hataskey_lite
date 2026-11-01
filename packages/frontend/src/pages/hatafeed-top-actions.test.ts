/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import bell from '../components/HataFeedNotifications.vue?raw';
import source from './hatafeed.vue?raw';
import type { HataFeedTab } from '@/utility/hatafeed-ui.js';
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/components/MkHataskeyNotificationToasts.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/os.js', () => ({ toast: vi.fn() }));
import HataFeedHeader from '@/components/HataFeedHeader.vue';
import { getNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import headerSource from '@/components/HataFeedHeader.vue?raw';
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });

async function mount() {
	vi.stubGlobal('IntersectionObserver', class { constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {} observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} });
	const tab = ref<HataFeedTab>('home');
	const create = vi.fn(), navigate = vi.fn(), exit = vi.fn();
	const projectName = ref('Hataskey');
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedHeader, { tab: tab.value, projectName: projectName.value, staff: true, unread: 2, onCreate: create, onNavigate: navigate, onExit: exit }) });
	app.mount(target); cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick(); return { target, tab, create, navigate, projectName, exit };
}

describe('HataFeed shared header', () => {
	test('keeps an independent exit before the capsule on every tab and dismisses the create menu', async () => {
		const { target, tab, exit, navigate } = await mount();
		const control = target.querySelector<HTMLButtonElement>('[aria-label="HataFeed から退出"]')!;
		expect(control.querySelector('.ti-logout-2')).not.toBeNull();
		expect(control.parentElement?.tagName).toBe('NAV');
		expect(control.nextElementSibling?.contains(target.querySelector('[data-hy-page-controls]'))).toBe(true);
		for (const value of ['home', 'issues', 'roadmap', 'emoji', 'beta'] as const) {
			tab.value = value; await nextTick();
			expect(target.querySelector('[aria-label="HataFeed から退出"]')).toBe(control);
			target.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click(); await nextTick();
			control.click(); await nextTick();
			expect(target.querySelector('[role="menu"]')).toBeNull();
		}
		expect(exit).toHaveBeenCalledTimes(5);
		expect(navigate).not.toHaveBeenCalled();
		// Source sizing only: no browser/device rectangles are measured here.
		expect(headerSource).toMatch(/\.exit\s*\{[^}]*display: none;[^}]*width: 44px;[^}]*height: 44px;[^}]*border-radius: 50%/u);
		expect(headerSource).toMatch(/@container hatafeed \(max-width: 850px\)[^\n]*\.exit \{ display: grid; place-items: center; \}/u);
	});
	test('the beta control emits beta for every selected tab', async () => {
		const { target, tab, navigate } = await mount();
		for (const value of ['home', 'emoji', 'issues', 'roadmap', 'beta'] as const) {
			tab.value = value; await nextTick();
			target.querySelector<HTMLButtonElement>('[aria-label="ベータ"]')!.click();
			expect(navigate).toHaveBeenLastCalledWith('beta');
		}
	});
	test('shows only the project icon when its full label does not fit, and restores the label when it fits', async () => {
		const { target, projectName } = await mount();
		const button = target.querySelector<HTMLButtonElement>('[aria-label^="プロジェクトを切り替え"]')!;
		const measure = button.querySelector<HTMLElement>('span[aria-hidden="true"]')!;
		Object.defineProperty(button, 'clientWidth', { configurable: true, value: 108 });
		vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ width: 160 } as DOMRect);
		projectName.value = '長いプロジェクト名'; await nextTick(); await nextTick();
		expect(button.dataset.iconOnly).toBe('true');
		expect(button.querySelector('span:not([aria-hidden])')).toBeNull();
		expect(button.getAttribute('aria-label')).toContain('長いプロジェクト名');
		vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue({ width: 55 } as DOMRect);
		projectName.value = 'Hataskey'; await nextTick(); await nextTick();
		await vi.waitFor(() => expect(button.dataset.iconOnly).toBe('false'));
		expect(button.querySelector('span:not([aria-hidden])')?.textContent).toBe('Hataskey');
	});
	test('all tabs retain the same create and project controls before the bell', async () => {
		const { target, tab } = await mount();
		const plus = target.querySelector('[aria-haspopup="menu"]');
		const project = target.querySelector('[aria-label^="プロジェクトを切り替え"]');
		for (const value of ['home', 'issues', 'roadmap', 'emoji', 'beta'] as const) {
			tab.value = value; await nextTick();
			expect(target.querySelector('[aria-haspopup="menu"]')).toBe(plus);
			expect(target.querySelector('[aria-label^="プロジェクトを切り替え"]')).toBe(project);
			const controls = [...target.querySelectorAll('button')];
			expect(controls.indexOf(plus as HTMLButtonElement)).toBeLessThan(controls.indexOf(project as HTMLButtonElement));
			expect(controls.indexOf(project as HTMLButtonElement)).toBeLessThan(controls.indexOf(target.querySelector('[aria-label="通知"]') as HTMLButtonElement));
		}
	});
	test('opens a dropdown, supports keyboard selection and restores the plus on dismissal', async () => {
		const { target, create } = await mount();
		const plus = target.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
		plus.click(); await nextTick();
		expect(plus.getAttribute('aria-expanded')).toBe('true');
		expect(plus.dataset.open).toBe('true');
		const items = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
		expect(items.map(item => item.textContent?.trim())).toEqual(['絵文字申請', '新規イシュー']);
		expect(window.document.activeElement).toBe(items[0]);
		items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await nextTick();
		expect(window.document.activeElement).toBe(items[1]);
		items[1].click(); await nextTick();
		expect(create).toHaveBeenCalledExactlyOnceWith('issue');
		expect(plus.getAttribute('aria-expanded')).toBe('false');
		expect(window.document.activeElement).toBe(plus);
		plus.click(); await nextTick();
		target.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await nextTick();
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});
	test('routes status notices to the shared navbar while the bell remains HataFeed only', async () => {
		await mount();
		hataFeedNotify('保存しました。');
		expect(getNotificationPageContext()?.items.value[0]).toMatchObject({ source: 'status', message: '保存しました' });
		expect(bell).toContain('hata/feedback/notifications');
		expect(bell).not.toContain('標準通知');
		expect(source).toContain('issues.value.slice(0, 3)');
		expect(source).toContain('@click="openReviewQueue"');
	});
});
