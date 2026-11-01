/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, createApp, defineComponent, h, KeepAlive, nextTick, provide, ref } from 'vue';
import type { entities } from 'cherrypick-js';
import HyNav from './HyNav.vue';
import MkHataskeyNotificationToasts from './MkHataskeyNotificationToasts.vue';
import { hatadyDialogSurfaces, hatadyNotice, hatadyNotify, registerHatadySurface } from '@/utility/hatady-ui.js';
import { prefer } from '@/preferences.js';
import { createHataskeyNotificationToasts, getNotificationPageContext, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';
import { resetNotificationToastSuppressionForTest } from '@/utility/notification-toast-suppression.js';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true), useBlurEffect: ref(false), 'external.disableNotificationToast': ref(false) }, s: { animation: true, 'external.disableNotificationToast': false } } };
});
vi.mock('@/utility/hatady-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hatadyTheme: ref('light') };
});

vi.mock('@/i18n.js', () => ({ i18n: { ts: { close: '閉じる', notifications: '通知' } } }));
vi.mock('@/components/MkNotification.vue', () => ({ default: { props: ['notification'], template: '<p data-local-notification>{{ notification.id }}</p>' } }));
vi.mock('@/components/MkExternalNotificationToast.vue', () => ({ default: { props: ['notification'], template: '<p data-external-notification>{{ notification.id }}</p>' } }));
// The real toast imports the router (and through it every page); the toast host only needs a placeholder here.
vi.mock('@/components/concrnt/ConcrntNotificationToast.vue', () => ({ default: { props: ['notification'], template: '<p data-concrnt-notification>{{ notification.id }}</p>' } }));

const cleanups: Array<() => void> = [];
let reduced = false, baseWidth = 280, toastHeight = 60;
let motionListeners: Array<(event: MediaQueryListEvent) => void>;
type Motion = { frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null; currentWidth: number; finish: () => void };
let animations: Motion[];
let active: Map<HTMLElement, Motion>;

beforeEach(() => {
	vi.useFakeTimers();
	reduced = false;
	baseWidth = 280;
	toastHeight = 60;
	motionListeners = [];
	animations = [];
	active = new Map();
	hatadyNotice.value = null;
	hatadyDialogSurfaces.value = [];
	resetNotificationToastSuppressionForTest();
	expect(getNotificationPageContext()).toBeUndefined();
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	prefer.r.animation.value = true;
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => motionListeners.push(callback), removeEventListener: vi.fn() }));
	vi.stubGlobal('ResizeObserver', class {
		constructor(private callback: () => void) {}
		observe(element: HTMLElement) {
			// Synthetic observer delivery only; happy-dom does not render geometry.
			if (element.hasAttribute('data-toast-id')) this.callback();
		}
		unobserve() {}
		disconnect() {}
	});
	vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const width = active.get(this)?.currentWidth ?? (this.tagName === 'NAV'
			? Number.parseFloat(this.style.width) || (this.dataset.notice === 'true' ? 480 : baseWidth)
			: 80);
		const height = this.hasAttribute('data-toast-id') ? toastHeight : 60;
		return { x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height, toJSON: () => ({}) };
	});
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement, frames, options) {
		const motion: Motion = {
			frames: frames as Keyframe[], options: options as KeyframeAnimationOptions,
			currentWidth: Number.parseFloat((frames as Keyframe[])[0].width as string),
			onfinish: null,
			cancel: vi.fn(() => active.delete(this)),
			finish: () => { active.delete(this); motion.onfinish?.(); },
		};
		animations.push(motion);
		active.set(this, motion);
		return motion as unknown as Animation;
	});
});
afterEach(async () => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	await nextTick();
	window.document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function settle() { await nextTick(); await nextTick(); }

async function mountNav() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HyNav, { modelValue: 'home', options: [{ value: 'home', label: 'ホーム', icon: 'ti ti-home' }] }) });
	app.mount(target);
	const unmount = () => { app.unmount(); target.remove(); };
	cleanups.push(unmount);
	await settle();
	return { target, nav: target.querySelector('nav')!, unmount };
}

async function notify(id = 1, duration = 5000) {
	hatadyNotice.value = { id, message: '端末に下書きを保存しました', duration };
	await settle();
}

async function dismiss(target: HTMLElement) {
	target.querySelector<HTMLButtonElement>('[data-toast-id] button[aria-label="閉じる"]')!.click();
	await vi.advanceTimersByTimeAsync(550);
	await settle();
}

describe('navbar notification width exit', () => {
	test('removes the faded content then interpolates measured widths without leaving a fixed width', async () => {
		const { target, nav } = await mountNav();
		await notify();
		expect(nav.getBoundingClientRect().width).toBe(480);
		target.querySelector<HTMLButtonElement>('[data-toast-id] button[aria-label="閉じる"]')!.click();
		await settle();
		await vi.advanceTimersByTimeAsync(349);
		expect(target.querySelector('[data-toast-id]')).not.toBeNull();
		expect(nav.style.width).toBe('480px');
		expect(animations).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(target.querySelector('[data-toast-id]')).toBeNull();
		expect(nav.style.width).toBe('480px');
		await vi.advanceTimersByTimeAsync(200);
		await settle();
		expect(animations).toHaveLength(1);
		expect(animations[0].frames).toEqual([{ width: '480px' }, { width: '280px' }]);
		expect(animations[0].options).toEqual({ duration: 350, easing: 'cubic-bezier(.22,1,.36,1)' });
		animations[0].finish();
		expect(nav.style.width).toBe('');
		expect(nav.getBoundingClientRect().width).toBe(280);
	});

	test('a new notification cancels the old width effect and its earlier removal', async () => {
		const { target, nav } = await mountNav();
		await notify();
		await dismiss(target);
		const old = animations[0];
		old.currentWidth = 350;
		await notify(2);
		expect(old.cancel).toHaveBeenCalledOnce();
		old.finish();
		expect(nav.getBoundingClientRect().width).toBe(480);
		const secondId = getNotificationPageContext()!.items.value[0].id;
		expect(hatadyNotice.value).toBeNull();
		target.querySelector<HTMLButtonElement>('[data-toast-id] button[aria-label="閉じる"]')!.click();
		await vi.advanceTimersByTimeAsync(200);
		await notify(3);
		await vi.advanceTimersByTimeAsync(400);
		expect(getNotificationPageContext()!.items.value).toHaveLength(1);
		expect(getNotificationPageContext()!.items.value[0].id).not.toBe(secondId);
		expect(hatadyNotice.value).toBeNull();
		expect(target.querySelector('[data-toast-id]')).not.toBeNull();
	});

	test('resize and a reduced-motion change release the in-flight width', async () => {
		const { target, nav } = await mountNav();
		await notify();
		await dismiss(target);
		baseWidth = 220;
		window.dispatchEvent(new Event('resize'));
		expect(animations[0].cancel).toHaveBeenCalledOnce();
		expect(nav.getBoundingClientRect().width).toBe(220);
		await notify(2);
		await dismiss(target);
		reduced = true;
		motionListeners.forEach(listener => listener({ matches: reduced } as MediaQueryListEvent));
		await settle();
		expect(animations[1].cancel).toHaveBeenCalledOnce();
		expect(nav.style.width).toBe('');
	});

	test('reduced motion and disabled application animation dismiss without width interpolation', async () => {
		reduced = true;
		const { target, nav } = await mountNav();
		await notify();
		await dismiss(target);
		expect(animations).toHaveLength(0);
		reduced = false;
		motionListeners.forEach(listener => listener({ matches: reduced } as MediaQueryListEvent));
		prefer.r.animation.value = false;
		await notify(2);
		await dismiss(target);
		expect(animations).toHaveLength(0);
		expect(nav.style.width).toBe('');
	});

	test('unmount cancels the width animation and all notification timers', async () => {
		const { target, unmount } = await mountNav();
		await notify();
		await dismiss(target);
		unmount();
		cleanups.pop();
		expect(animations[0].cancel).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});
});

const localNotification = (id: string): entities.Notification => ({ id, type: 'test', createdAt: '2026-09-15T00:00:00Z' });

async function mountSharedNav(inherited: boolean, preloaded = false) {
	const shown = ref(true);
	const shell = window.document.createElement('aside');
	const shellHost = window.document.createElement('div');
	shell.append(shellHost);
	window.document.body.append(shell);
	const parentContext = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
	parentContext.target.value = shellHost;
	parentContext.outline.value = shell;
	if (preloaded) {
		parentContext.enqueueStatus('引き継いだ通知');
		parentContext.height.value = toastHeight;
	}
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const InactivePage = defineComponent({ render: () => h('section', '別のページ') });
	const app = createApp({
		setup() {
			if (inherited) provide(hataskeyNotificationToastsKey, parentContext);
			return () => [
				h(KeepAlive, null, { default: () => shown.value
					? h(HyNav, { modelValue: 'home', options: [{ value: 'home', label: 'ホーム', icon: 'ti ti-home' }] })
					: h(InactivePage) }),
				inherited ? h(MkHataskeyNotificationToasts, { context: parentContext }) : null,
			];
		},
	});
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); shell.remove(); });
	await settle();
	return { target, nav: target.querySelector('nav')!, shown, parentContext, shellHost };
}

describe('Hatady shared notification routing', () => {
	beforeEach(() => { prefer.r.animation.value = false; });

	test.each([false, true])('routes local receipts through the registered nav context with one real renderer (inherited=%s)', async inherited => {
		const { nav, parentContext } = await mountSharedNav(inherited);
		const context = getNotificationPageContext();
		expect(context, 'an active Hatady navbar must register as the notification receiver').toBeDefined();
		if (inherited) expect(context).toBe(parentContext);
		context!.enqueue(localNotification('local-at-nav'), 'local');
		await settle();
		expect(context!.surface.value?.target.value?.closest('nav')).toBe(nav);
		expect(nav.querySelector('[data-local-notification]')?.textContent).toBe('local-at-nav');
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
		expect(window.document.querySelectorAll('[aria-live="polite"][aria-label="通知"]')).toHaveLength(1);
	});

	test.each([false, true])('consumes Hatady status into the same queue and shared card (inherited=%s)', async inherited => {
		const { nav, parentContext } = await mountSharedNav(inherited);
		hatadyNotify('端末に下書きを保存しました。、');
		await settle();
		const card = nav.querySelector('[data-toast-id]');
		expect(card).not.toBeNull();
		expect(card!.textContent).toContain('端末に下書きを保存しました');
		expect(card!.textContent).not.toMatch(/[。、]/);
		const context = getNotificationPageContext()!;
		if (inherited) expect(context).toBe(parentContext);
		expect(context.items.value).toHaveLength(1);
		expect(context.items.value[0]).toMatchObject({ source: 'status', message: '端末に下書きを保存しました' });
		expect(hatadyNotice.value).toBeNull();
		context.enqueue(localNotification('after-status'), 'local');
		await settle();
		expect(context.items.value).toHaveLength(1);
		expect(nav.querySelector('[data-local-notification]')?.textContent).toBe('after-status');
		expect(nav.textContent).not.toContain('端末に下書きを保存しました');
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
	});

	test('uses the inherited queue height on mount even when the existing card keeps the same height', async () => {
		// Geometry is a controlled input; this checks reactive height propagation, not browser layout.
		toastHeight = 100;
		const { nav, parentContext } = await mountSharedNav(true, true);
		expect(getNotificationPageContext()).toBe(parentContext);
		expect(parentContext.items.value).toHaveLength(1);
		expect(nav.querySelector('[data-toast-id]')?.textContent).toContain('引き継いだ通知');
		expect(parentContext.surface.value?.target.value?.style.height).toBe('100px');
		expect(parentContext.height.value).toBe(100);
	});

	test('an inherited host returns its live notification to the shell while Hatady is kept inactive', async () => {
		const { nav, shown, parentContext, shellHost } = await mountSharedNav(true);
		parentContext.enqueue(localNotification('retained'), 'local', 0);
		await settle();
		const card = nav.querySelector('[data-toast-id]');
		expect(card).not.toBeNull();
		parentContext.tick(1800, new Set());
		shown.value = false;
		await settle();
		expect(getNotificationPageContext()).toBeUndefined();
		expect(parentContext.surface.value).toBeUndefined();
		expect(shellHost.querySelector('[data-toast-id]')).toBe(card);
		expect(parentContext.items.value[0].elapsed).toBe(1800);
		hatadyNotify('非表示中の状態');
		await settle();
		expect(parentContext.items.value[0]).toMatchObject({ source: 'local', notification: { id: 'retained' } });
		shown.value = true;
		await settle();
		expect(getNotificationPageContext()).toBe(parentContext);
		expect(nav.querySelector('[data-toast-id]')).toBe(card);
		expect(nav.textContent).not.toContain('非表示中の状態');
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
	});

	test('a standalone kept-inactive navbar releases its renderer and receives no notification', async () => {
		const { nav, shown } = await mountSharedNav(false);
		const context = getNotificationPageContext();
		expect(context).toBeDefined();
		context!.enqueue(localNotification('before-hide'), 'local');
		await settle();
		expect(nav.querySelector('[data-toast-id]')).not.toBeNull();
		shown.value = false;
		await settle();
		expect(getNotificationPageContext()).toBeUndefined();
		expect(context!.items.value).toHaveLength(0);
		expect(window.document.querySelector('[data-toast-id]')).toBeNull();
		hatadyNotify('非表示中の下書き');
		await settle();
		expect(context!.items.value).toHaveLength(0);
		expect(window.document.querySelector('[data-toast-id]')).toBeNull();
		shown.value = true;
		await settle();
		expect(getNotificationPageContext()).toBe(context);
		expect(context!.items.value).toHaveLength(0);
		expect(nav.querySelector('[data-toast-id]')).toBeNull();
		hatadyNotify('戻ってからの保存');
		await settle();
		expect(context!.items.value[0]).toMatchObject({ source: 'status', message: '戻ってからの保存' });
	});

	test.each([false, true])('moves the same queued card into the foreground dialog and back without restarting it (inherited=%s)', async inherited => {
		const { nav } = await mountSharedNav(inherited);
		const context = getNotificationPageContext();
		expect(context).toBeDefined();
		context!.enqueue(localNotification('dialog-receipt'), 'local', 0);
		await settle();
		const card = nav.querySelector('[data-toast-id]');
		expect(card).not.toBeNull();
		context!.tick(2000, new Set());
		const dialogHost = window.document.createElement('div');
		window.document.body.append(dialogHost);
		const release = registerHatadySurface(dialogHost);
		cleanups.push(() => { release(); dialogHost.remove(); });
		await settle();
		expect(context!.surface.value?.target.value).toBe(dialogHost);
		expect(dialogHost.querySelector('[data-toast-id]')).toBe(card);
		expect(nav.querySelector('[data-toast-id]')).toBeNull();
		expect(context!.items.value[0].elapsed).toBe(2000);
		expect(window.document.querySelectorAll('[data-toast-id]')).toHaveLength(1);
		release();
		await settle();
		expect(nav.querySelector('[data-toast-id]')).toBe(card);
		expect(context!.items.value[0].elapsed).toBe(2000);
	});
});
