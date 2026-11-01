/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { pushAcceptedSidePage, useHk3SidePage } from './use-hk3-side-page.js';

class TestRouter {
	readonly current = ref('/');
	readonly currentRoute = shallowRef({ fullPath: '/' });
	readonly history = ['/'];
	index = 0;
	cancel: (to: string) => boolean = () => false;
	redirect: (to: string) => string = to => to;

	getCurrentFullPath() { return this.current.value; }
	pushByPath(to: string) {
		if (to === this.current.value || this.cancel(to)) return;
		this.change(this.redirect(to));
		this.history.splice(this.index + 1);
		this.history.push(this.current.value);
		this.index++;
	}
	back() {
		if (this.index === 0) return;
		this.index--;
		this.change(this.history[this.index]!);
	}
	private change(to: string) {
		this.current.value = to;
		this.currentRoute.value = { fullPath: to };
	}
}

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function setup() {
	const router = new TestRouter();
	const mobile = ref(false);
	const desktopDeck = ref(false);
	const scope = effectScope();
	const sidePage = scope.run(() => useHk3SidePage({
		router,
		currentRoute: () => router.currentRoute.value,
		isHome: () => router.current.value === '/',
		isMobile: () => mobile.value,
		isDesktopDeck: () => desktopDeck.value,
	}))!;
	cleanups.push(() => scope.stop());
	const sidebar = (to: string) => sidePage.sidebarNavigated(pushAcceptedSidePage(router, to));
	return { router, sidePage, mobile, desktopDeck, sidebar };
}

describe('UI3 sidebar page routing', () => {
	it('opens only after the router accepts navigation, using its actual redirected full path', async () => {
		const view = setup();
		view.router.cancel = to => to === '/search';
		expect(view.sidebar('/search')).toBe(false);
		await nextTick();
		expect(view.router.getCurrentFullPath()).toBe('/');
		expect(view.sidePage.session.value).toBe(false);
		view.router.cancel = () => false;
		view.router.redirect = to => to === '/search' ? '/search?q=accepted' : to;
		expect(view.sidebar('/search')).toBe(true);
		await nextTick();
		expect(view.router.getCurrentFullPath()).toBe('/search?q=accepted');
		expect(view.sidePage.mode.value).toBe('split');
		expect(view.sidePage.timelineVisible.value).toBe(true);
	});

	it('keeps the page open when the router cancels close', async () => {
		const view = setup();
		expect(view.sidebar('/settings')).toBe(true);
		await nextTick();
		view.router.cancel = to => to === '/';
		expect(view.sidePage.close()).toBe(false);
		expect(view.sidePage.session.value).toBe(true);
		expect(view.sidePage.mode.value).toBe('split');
		expect(view.router.getCurrentFullPath()).toBe('/settings');
		view.router.cancel = () => false;
		expect(view.sidePage.close()).toBe(true);
		expect(view.sidePage.mode.value).toBe('home');
	});

	it('restores the known full page after close and browser back, then keeps page navigation in the session', async () => {
		const view = setup();
		expect(view.sidebar('/search')).toBe(true);
		expect(view.sidePage.mode.value).toBe('split');
		expect(view.sidePage.toggle()).toBe(true);
		expect(view.sidePage.mode.value).toBe('full');
		expect(view.sidePage.timelineVisible.value).toBe(false);
		expect(view.sidePage.close()).toBe(true);
		await nextTick();
		expect(view.sidePage.mode.value).toBe('home');
		view.router.back();
		view.sidePage.restoreOnPopstate();
		await nextTick();
		expect(view.sidePage.session.value).toBe(true);
		expect(view.sidePage.mode.value).toBe('full');
		expect(view.sidePage.toggle()).toBe(true);
		view.router.pushByPath('/explore');
		await nextTick();
		expect(view.sidePage.mode.value).toBe('split');
		view.router.pushByPath('/');
		await nextTick();
		expect(view.sidePage.session.value).toBe(false);
		view.router.pushByPath('/direct');
		await nextTick();
		expect(view.sidePage.mode.value).toBe('full');
		expect(view.sidePage.timelineVisible.value).toBe(false);
	});

	it('leaves ordinary page routes full and excludes desktop deck from side pages', async () => {
		const view = setup();
		view.router.pushByPath('/settings');
		await nextTick();
		expect(view.sidePage.mode.value).toBe('full');
		expect(view.sidePage.session.value).toBe(false);
		view.router.pushByPath('/');
		await nextTick();
		view.desktopDeck.value = true;
		expect(view.sidebar('/search')).toBe(false);
		await nextTick();
		expect(view.sidePage.mode.value).toBe('full');
		view.desktopDeck.value = false;
		view.mobile.value = true;
		expect(view.sidebar('/my/notifications')).toBe(true);
		expect(view.sidePage.mode.value).toBe('full');
		expect(view.sidePage.timelineVisible.value).toBe(false);
	});

	it('does not restore a pane for an unrelated history entry', async () => {
		const view = setup();
		view.router.pushByPath('/direct');
		await nextTick();
		expect(view.sidebar('/search')).toBe(true);
		view.router.back();
		view.sidePage.restoreOnPopstate();
		await nextTick();
		expect(view.router.getCurrentFullPath()).toBe('/direct');
		expect(view.sidePage.session.value).toBe(false);
		expect(view.sidePage.mode.value).toBe('full');
	});

	it('restores a full desktop side page for a request only if the composer accepts it', () => {
		const view = setup();
		view.sidebar('/search');
		view.sidePage.toggle();
		const rejected = vi.fn(() => false);
		expect(view.sidePage.restoreForComposer(rejected)).toBe(false);
		expect(rejected).toHaveBeenCalledOnce();
		expect(view.sidePage.mode.value).toBe('full');
		const accepted = vi.fn(() => true);
		expect(view.sidePage.restoreForComposer(accepted)).toBe(true);
		expect(accepted).toHaveBeenCalledOnce();
		expect(view.sidePage.mode.value).toBe('split');
	});
});
