/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, provide, ref } from 'vue';
import type { Component, Ref } from 'vue';
import MkPageHeader from './MkPageHeader.vue';
import CPPageHeader from './CPPageHeader.vue';
import { mainRouter } from '@/router.js';

vi.mock('@@/js/scroll.js', () => ({ getScrollPosition: () => 0, scrollToTop: vi.fn() }));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/store.js', async () => {
	const { ref } = await import('vue');
	return { store: { r: { darkMode: ref(false) } } };
});
vi.mock('@/events.js', () => ({ globalEvents: {} }));
vi.mock('@/accounts.js', () => ({ getAccountMenu: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'self' } }));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { reload: 'Reload' } } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { useBlurEffect: false, animation: false } } }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => 'default' } }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/utility/hatasaba-navigation.js', () => ({ getVisibleBottomNav: () => [] }));
vi.mock('@/utility/scroll-to-visibility.js', async () => {
	const { ref } = await import('vue');
	return { scrollToVisibility: () => ({ showEl: ref(false) }) };
});
vi.mock('@/router.js', async () => {
	const { ref } = await import('vue');
	const router = { currentRoute: ref({ path: '/', name: 'index' }), push: vi.fn(), pushByPath: vi.fn() };
	return { mainRouter: router, useRouter: () => router };
});
vi.mock('@/components/MkFollowButton.vue', async () => {
	const { h } = await import('vue');
	return { default: { render: () => h('button', { 'data-test-follow': '' }, 'Follow') } };
});
vi.mock('./MkPageHeader.tabs.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['tabs'],
		emits: ['update:tab', 'tabClick'],
		setup(props, { emit }) {
			return () => h('div', props.tabs.map((tab: { key: string; title: string }) => h('button', { onClick: () => emit('update:tab', tab.key) }, tab.title)));
		},
	}) };
});

const cleanups: Array<() => void> = [];
beforeEach(() => {
	vi.clearAllMocks();
	mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'index' };
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.unstubAllGlobals();
});

function mount(Header: Component, omission: boolean | Ref<boolean>, extra: Record<string, unknown> = {}, omitBack: boolean | Ref<boolean> = false) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ setup() {
		provide('shouldOmitHeaderTitle', omission);
		provide('shouldOmitHeaderBack', omitBack);
		return () => h(Header, { overridePageMetadata: { title: 'Page heading' }, ...extra });
	} });
	app.directive('tooltip', {});
	app.component('MkAvatar', { render: () => h('span', 'Avatar') });
	app.component('MkUserName', { render: () => h('span', 'User') });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return host;
}

describe.each([{ name: 'MkPageHeader', Header: MkPageHeader }, { name: 'CPPageHeader', Header: CPPageHeader }])('$name title omission', ({ Header }) => {
	it('renders an explicit app identity while preserving custom titles', () => {
		const home = mount(Header, false, { overridePageMetadata: { title: 'Hatask', icon: 'ti ti-checklist', hataApp: 'hatask' } });
		expect(home.querySelector('[data-hata-app-logo][data-app="hatask"]')).not.toBeNull();
		expect(home.querySelector('[data-app="hatask"][data-inherit-color="true"]')).not.toBeNull();
		expect(home.querySelector('i.ti-checklist')).toBeNull();

		const detail = mount(Header, false, { overridePageMetadata: { title: 'Record details', icon: 'ti ti-checklist', hataApp: 'hatask' } });
		expect(detail.querySelector('[data-hata-app-logo][data-app="hatask"]')).not.toBeNull();
		expect(detail.textContent).toContain('Record details');
		expect(detail.querySelector('[data-inherit-color="true"]')).toBeNull();
	});

	it('reacts to a provided ref instead of treating the ref itself as true', async () => {
		const omission = ref(false);
		const host = mount(Header, omission);
		expect(host.textContent).toContain('Page heading');
		omission.value = true;
		await nextTick();
		expect(host.textContent).not.toContain('Page heading');
		omission.value = false;
		await nextTick();
		expect(host.textContent).toContain('Page heading');
	});

	it('keeps a back-only header when its title is omitted', async () => {
		mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'details' };
		const host = mount(Header, true, { backPath: '/parent' });
		await nextTick();
		const back = host.querySelector('i.ti-chevron-left')?.closest('button');
		expect(back).not.toBeNull();
		back?.click();
		expect(mainRouter.pushByPath).toHaveBeenCalledWith('/parent');
		expect(host.textContent).not.toContain('Page heading');
	});

	it('removes a back-only header when both title and back are omitted', async () => {
		mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'details' };
		const host = mount(Header, true, { backPath: '/parent' }, true);
		await nextTick();
		expect(host.querySelector('div')).toBeNull();
		expect(host.querySelector('i.ti-chevron-left')).toBeNull();
	});

	it('restores the same back handler when back omission is cleared', async () => {
		mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'details' };
		const omitBack = ref(true);
		const host = mount(Header, true, { backPath: '/parent' }, omitBack);
		expect(host.querySelector('i.ti-chevron-left')).toBeNull();
		omitBack.value = false;
		await nextTick();
		const back = host.querySelector('i.ti-chevron-left')?.closest('button');
		expect(back).not.toBeNull();
		back?.click();
		expect(mainRouter.pushByPath).toHaveBeenCalledWith('/parent');
	});

	it('keeps tabs and action handlers available', async () => {
		const action = vi.fn();
		const changeTab = vi.fn();
		const host = mount(Header, true, {
			actions: [{ text: 'Save', icon: 'ti ti-check', handler: action }],
			tabs: [{ key: 'notes', title: 'Notes' }],
			'onUpdate:tab': changeTab,
		});
		await nextTick();
		host.querySelector<HTMLButtonElement>('[aria-label="Save"]')?.click();
		Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Notes'))?.click();
		expect(action).toHaveBeenCalledOnce();
		expect(changeTab).toHaveBeenCalledWith('notes');
	});

	it('keeps tabs and actions when both title and back are omitted', async () => {
		mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'details' };
		const action = vi.fn();
		const changeTab = vi.fn();
		const host = mount(Header, true, {
			actions: [{ text: 'Save', icon: 'ti ti-check', handler: action }],
			tabs: [{ key: 'notes', title: 'Notes' }],
			'onUpdate:tab': changeTab,
		}, true);
		await nextTick();
		expect(host.querySelector('i.ti-chevron-left')).toBeNull();
		expect(host.textContent).not.toContain('Page heading');
		host.querySelector<HTMLButtonElement>('[aria-label="Save"]')?.click();
		Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Notes'))?.click();
		expect(action).toHaveBeenCalledOnce();
		expect(changeTab).toHaveBeenCalledWith('notes');
	});

	it('keeps a follow-only header even when thin hides its back button', async () => {
		mainRouter.currentRoute.value = { ...mainRouter.currentRoute.value, name: 'user' };
		const host = mount(Header, true, {
			thin: true,
			overridePageMetadata: { title: 'Other user', avatar: { id: 'other' }, userName: { id: 'other' } },
		}, true);
		await nextTick();
		expect(host.querySelector('[data-test-follow]')).not.toBeNull();
		expect(host.textContent).not.toContain('Other user');
	});
});
