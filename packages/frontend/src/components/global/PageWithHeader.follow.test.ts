/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import PageWithHeader from './PageWithHeader.vue';
import { prefer } from '@/preferences.js';

vi.mock('@@/js/scroll.js', () => ({ scrollInContainer: vi.fn() }));
vi.mock('@/composables/use-scroll-position-keeper.js', () => ({ useScrollPositionKeeper: vi.fn() }));
vi.mock('@/utility/detect-scrolling.js', () => ({ detectScrolling: vi.fn() }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ useListener: vi.fn() }) }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { mobileHeaderChange: false, showPageTabBarBottom: false } } }));
vi.mock('@/utility/horizontal-swipe-preference.js', async () => ({ horizontalSwipeEnabled: (await import('vue')).ref(false) }));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { notifications: 'Notifications' } } }));
vi.mock('@/components/MkSwiper.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkTabs.vue', () => ({ default: { render: () => null } }));

function header(name: string) {
	return defineComponent({
		props: { disableFollowButton: Boolean },
		setup(props) {
			return () => h('div', { 'data-header': name, 'data-follow-disabled': String(props.disableFollowButton === true) });
		},
	});
}

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function mount() {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const explicit = ref(true);
	const blocked = ref(false);
	const blocking = ref(false);
	const bottomTabs = ref(false);
	const app = createApp({
		setup() {
			return () => h(PageWithHeader, {
				user: { id: 'other', isBlocked: blocked.value, isBlocking: blocking.value } as Misskey.entities.UserDetailed,
				disableFollowButton: explicit.value,
				tabs: bottomTabs.value ? [{ key: 'notes', title: 'Notes' }] : [],
			}, { default: () => h('div', 'Content') });
		},
	});
	app.component('MkStickyContainer', { template: '<div><slot name="header"/><slot/><slot name="footer"/></div>' });
	app.component('MkPageHeader', header('desktop'));
	app.component('CPPageHeader', header('mobile'));
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return { host, explicit, blocked, blocking, bottomTabs };
}

describe('PageWithHeader follow visibility', () => {
	it('preserves an explicit override and blocked state across header branches', async () => {
		const view = mount();
		const disabled = () => view.host.querySelector('[data-header]')?.getAttribute('data-follow-disabled');
		expect(disabled()).toBe('true');
		view.explicit.value = false;
		await nextTick();
		expect(disabled()).toBe('false');
		view.blocked.value = true;
		await nextTick();
		expect(disabled()).toBe('true');
		view.blocked.value = false;
		view.blocking.value = true;
		await nextTick();
		expect(disabled()).toBe('true');
		view.blocking.value = false;
		view.bottomTabs.value = true;
		prefer.s.showPageTabBarBottom = true;
		await nextTick();
		expect(disabled()).toBe('false');
		prefer.s.showPageTabBarBottom = false;
	});

	it('forwards the same override to the mobile header', async () => {
		const initialWidth = window.innerWidth;
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
		prefer.s.mobileHeaderChange = true;
		try {
			const view = mount();
			expect(view.host.querySelector('[data-header="mobile"]')).not.toBeNull();
			expect(view.host.querySelector('[data-follow-disabled="true"]')).not.toBeNull();
			view.explicit.value = false;
			await nextTick();
			expect(view.host.querySelector('[data-follow-disabled="false"]')).not.toBeNull();
		} finally {
			Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialWidth });
			prefer.s.mobileHeaderChange = false;
		}
	});
});
