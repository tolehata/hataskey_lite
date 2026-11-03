/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type { Ref } from 'vue';

const fixture = vi.hoisted(() => ({ ui: 'universal', menu: ['drive', 'ui', 'hidden'], sidebar: [{ id: 'drive' }, { id: 'ui' }] }));

vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => fixture.ui } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: {
	get menu() { return fixture.menu; },
	get 'simpleUi.sidebar'() { return fixture.sidebar; },
	useBlurEffect: false, useBlurEffectForModal: false, removeModalBgColorForBlur: false,
} } }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/navbar.js', () => ({ navbarItemDef: {
	drive: { title: 'Drive', to: '/drive', icon: 'drive', show: true },
	ui: { title: 'UI settings', to: '/ui', icon: 'ui', show: true },
	hidden: { title: 'Restricted', to: '/hidden', icon: 'hidden', show: false },
} }));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/utility/hata-side-studio.js', async () => ({
	hataSideStudioStore: (await import('vue')).ref({ menuIds: [] as string[] }),
	getActiveHataSideStudioMenuIds: (store: { menuIds: string[] }) => new Set(store.menuIds),
	normalizeHataSideStudioMenuId: (id: string) => id === 'ui' ? 'uiSetup' : id,
}));
vi.mock('@/components/MkModal.vue', () => ({ default: { template: '<section><slot :type="\'dialog\'" :maxHeight="null"/></section>' } }));

import MkLaunchPad from './MkLaunchPad.vue';
import { hataSideStudioStore } from '@/utility/hata-side-studio.js';
import { store } from '@/store.js';

const cleanups: Array<() => void> = [];
const studioStore = hataSideStudioStore as unknown as Ref<{ menuIds: string[] }>;

async function mount() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(MkLaunchPad) });
	app.component('MkA', { props: ['to'], template: '<a :href="to"><slot/></a>' });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick();
	return target;
}

function labels(target: HTMLElement) {
	return [...target.querySelectorAll('.main .item')].map(item => item.textContent?.trim());
}

beforeEach(() => {
	fixture.ui = 'universal';
	fixture.menu = ['drive', 'ui', 'hidden'];
	fixture.sidebar = [{ id: 'drive' }, { id: 'ui' }];
	studioStore.value = { menuIds: ['drive', 'uiSetup'] };
	store.r.darkMode.value = false;
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

describe('MkLaunchPad menu placement', () => {

	test('simple and other UIs retain their existing menu rules', async () => {
		fixture.ui = 'simple';
		studioStore.value = { menuIds: [] };
		const simple = await mount();
		expect(labels(simple)).toEqual(['Drive', 'UI settings']);
		fixture.ui = 'universal';
		const universal = await mount();
		expect(labels(universal)).toEqual([]);
		fixture.ui = 'deck';
		const deck = await mount();
		expect(labels(deck)).toEqual([]);
	});
});
