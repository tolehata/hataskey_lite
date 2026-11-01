/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, createApp, h, nextTick, provide } from 'vue';
import type { App } from 'vue';
import HataFeedHeader from './HataFeedHeader.vue';
import MkHataskeyNotificationToasts from './MkHataskeyNotificationToasts.vue';
import { createHataskeyNotificationToasts, getNotificationPageContext, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false), useBlurEffect: ref(false), 'external.disableNotificationToast': ref(false) }, s: { animation: false } } };
});
vi.mock('@/os.js', () => ({ toast: vi.fn() }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/MkNotification.vue', () => ({ default: { props: ['notification'], template: '<p>{{ notification.id }}</p>' } }));
vi.mock('@/components/MkExternalNotificationToast.vue', () => ({ default: { props: ['notification'], template: '<p>{{ notification.id }}</p>' } }));

let app: App | undefined;
beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('IntersectionObserver', class {
		constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
		observe() { this.callback([{ isIntersecting: true }]); }
		disconnect() {}
	});
	vi.stubGlobal('ResizeObserver', class {
		constructor(private callback: () => void) {}
		observe(element: HTMLElement) {
			// Synthetic content height only; happy-dom does not render page geometry.
			if (element.hasAttribute('data-toast-id')) {
				vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 64));
				this.callback();
			} else if (element.querySelector('[data-hy-page-controls]')) {
				vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 120));
				this.callback();
			}
		}
		disconnect() {}
	});
	vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { app?.unmount(); app = undefined; window.document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function mount(inherited: boolean) {
	const context = createHataskeyNotificationToasts(computed(() => true), computed(() => true));
	const target = window.document.createElement('div'); window.document.body.append(target);
	app = createApp({
		setup() {
			if (inherited) provide(hataskeyNotificationToastsKey, context);
			return () => h('main', {}, [h(HataFeedHeader, { tab: 'home', projectName: 'Hataskey', staff: true, unread: 0 }), inherited ? h(MkHataskeyNotificationToasts, { context }) : null, h('section', { 'data-content': true }, '本文')]);
		},
	});
	app.mount(target); await nextTick();
	return { target, context: getNotificationPageContext()! };
}

describe('HataFeed navbar with the production notification renderer', () => {
	test.each([false, true])('reuses a single outlined surface with inherited=%s', async inherited => {
		const { target, context } = await mount(inherited);
		const tabs = target.querySelector('[data-hy-page-controls]');
		const nav = target.querySelector('nav')!;
		const content = target.querySelector('[data-content]');
		hataFeedNotify('更新しました'); await nextTick(); await nextTick();
		const viewport = context.surface.value!.target.value!;
		const outline = context.surface.value!.outline.value!;
		expect(viewport.querySelector('[data-toast-id]')?.textContent).toContain('更新しました');
		expect(viewport.style.height).toBe('64px');
		expect(outline.parentElement).toBe(nav);
		expect(outline.firstElementChild?.contains(viewport)).toBe(true);
		expect(outline.firstElementChild?.contains(tabs!)).toBe(true);
		expect(outline.querySelector(':scope > svg[data-integrated="true"]')).not.toBeNull();
		expect(viewport.contains(outline.querySelector(':scope > svg[data-integrated="true"]'))).toBe(false);
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
		context.items.value[0].elapsed = 2000; await nextTick();
		expect(outline.querySelector(':scope > svg[data-integrated="true"] path')?.getAttribute('stroke-dashoffset')).toBe('0.6');
		hataFeedNotify('端末に下書きを保存しました'); await nextTick(); await nextTick();
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
		expect(viewport.textContent).toContain('端末に下書きを保存しました');
		viewport.querySelector<HTMLButtonElement>('[aria-label="閉じる"]')!.click(); await nextTick();
		expect(viewport.style.height).toBe('0px');
		expect(outline.querySelector(':scope > svg[data-integrated="true"]')).toBeNull();
		expect(target.querySelector('[data-hy-page-controls]')).toBe(tabs);
		expect(target.querySelector('[data-content]')).toBe(content);
	});
});
