/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';

const state = vi.hoisted(() => ({
	routers: [] as unknown[],
	hataskMounts: 0,
	hataskLive: 0,
	hataskMode: 'light' as 'light' | 'dark' | undefined,
	pendingHatask: null as Promise<void> | null,
	feedMounts: 0,
	toolMounts: 0,
	toolActivations: 0,
	toolDeactivations: 0,
}));

vi.mock('@/di.js', () => ({ DI: {
	router: Symbol('router'), routerCurrentDepth: Symbol('routerCurrentDepth'),
	pageMetadata: Symbol('pageMetadata'), currentStickyTop: Symbol('currentStickyTop'),
	currentStickyBottom: Symbol('currentStickyBottom'), pageWindowClose: Symbol('pageWindowClose'),
} }));
vi.mock('@/i.js', () => ({ $i: { id: 'owner' } }));
vi.mock('@/router.definition.js', async () => {
	const { defineAsyncComponent } = await import('vue');
	return { page: (loader: () => Promise<unknown>) => defineAsyncComponent(loader as never) };
});
vi.mock('@/pages/hatafeed.vue', async () => {
	const { defineComponent, h, onMounted } = await import('vue');
	return { __esModule: true, default: defineComponent({ setup() {
		onMounted(() => { state.feedMounts++; });
		return () => h('div', { 'data-owner': 'hatafeed' }, 'Feed owner');
	} }) };
});
vi.mock('@/router.js', async () => {
	const { Nirax } = await import('@/lib/nirax.js');
	const { defineAsyncComponent, defineComponent, h, onActivated, onDeactivated, onMounted, onUnmounted } = await import('vue');
	const HataskOwner = defineComponent({ emits: ['tabChange'], setup(_props, { emit }) {
		onMounted(() => { state.hataskMounts++; state.hataskLive++; });
		onUnmounted(() => { state.hataskLive--; });
		return () => h('button', { 'data-owner': 'hatask', class: 'htk-root', 'data-mode': state.hataskMode, onClick: () => emit('tabChange', 'todo') }, 'Hatask owner');
	} });
	const Tool = defineComponent({ setup() {
		onMounted(() => { state.toolMounts++; });
		onActivated(() => { state.toolActivations++; });
		onDeactivated(() => { state.toolDeactivations++; });
		return () => h('div', { 'data-owner': 'tool' }, 'Tool');
	} });
	const HatadyOwner = defineComponent({ emits: ['scopeChange'], setup(_props, { emit }) {
		return () => h('button', { 'data-scope': 'mine', onClick: () => emit('scopeChange', 'mine') }, 'My records');
	} });
	// The two legacy HataFeed routes deliberately have distinct async wrappers.
	const routes = [
		{ path: '/hatask', component: HataskOwner },
		{ path: '/hatady', component: HatadyOwner },
		{ path: '/hatafeed', component: defineAsyncComponent(() => import('@/pages/hatafeed.vue')) },
		{ path: '/hatafeed/:issueId', component: defineAsyncComponent(() => import('@/pages/hatafeed.vue')) },
		{ path: '/hatafeed/beta', component: defineAsyncComponent(() => import('@/pages/hatafeed.vue')) },
		{ path: '/scratchpad', component: Tool },
	];
	return { createRouter: (path: string) => {
		const pending = state.pendingHatask;
		const currentRoutes = pending ? routes.map(route => route.path === '/hatask' ? {
			...route,
			component: defineAsyncComponent(async () => { await pending; return HataskOwner; }),
		} : route) : routes;
		const router = new Nirax(currentRoutes, path, true, Tool);
		state.routers.push(router);
		return router;
	} };
});

import type { Nirax } from '@/lib/nirax.js';
import HatagoesPane from './HatagoesPane.vue';

type Router = Nirax<never[]>;

async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

let cleanup: (() => void) | undefined;

function mountPane(appName: 'hatask' | 'hatady' | 'hatafeed', initialPath: string, initiallyActive = true) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const path = ref(initialPath);
	const active = ref(initiallyActive);
	const navigation: [string, boolean | undefined][] = [];
	const modes: string[] = [];
	const app = createApp(defineComponent({
		render: () => h(HatagoesPane, {
			app: appName, path: path.value, active: active.value,
			onNavigate: (next: string, replace?: boolean) => navigation.push([next, replace]),
			onMode: (mode: string) => modes.push(mode),
		}),
	}));
	app.component('MkLoading', defineComponent({ render: () => h('span', 'loading') }));
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	return { target, path, active, navigation, modes, router: state.routers.at(-1) as Router };
}

beforeEach(() => { state.routers.length = 0; state.hataskMounts = 0; state.hataskLive = 0; state.hataskMode = 'light'; state.pendingHatask = null; state.feedMounts = 0; state.toolMounts = 0; state.toolActivations = 0; state.toolDeactivations = 0; });
afterEach(() => { cleanup?.(); cleanup = undefined; });

describe('HataGoes embedded pane', () => {
	test.each(['light', 'dark'] as const)('reports the first Hatask %s mode and subsequent changes exactly once', async mode => {
		state.hataskMode = mode;
		const view = mountPane('hatask', '/hatask');
		await settle();
		expect(view.modes).toEqual([mode]);
		const root = view.target.querySelector<HTMLElement>('.htk-root');
		if (!root) throw new Error('Missing Hatask root');
		const next = mode === 'light' ? 'dark' : 'light';
		root.dataset.mode = next;
		await vi.waitFor(() => expect(view.modes).toEqual([mode, next]));
		root.dataset.mode = next;
		await settle();
		expect(view.modes).toEqual([mode, next]);
		root.dataset.mode = mode;
		await vi.waitFor(() => expect(view.modes).toEqual([mode, next, mode]));
	});

	test('waits for an actual Hatask mode while its page is loading', async () => {
		state.hataskMode = undefined;
		const view = mountPane('hatask', '/hatask');
		await settle();
		expect(view.modes).toEqual([]);
		const root = view.target.querySelector<HTMLElement>('.htk-root');
		if (!root) throw new Error('Missing Hatask root');
		root.dataset.mode = 'light';
		await vi.waitFor(() => expect(view.modes).toEqual(['light']));
	});

	test('does not replace the Hatask mode when an auxiliary page has no Hatask root', async () => {
		const view = mountPane('hatask', '/scratchpad');
		await settle();
		expect(view.modes).toEqual([]);
	});

	test('reports the first light mode when the asynchronous Hatask root is inserted', async () => {
		let release!: () => void;
		state.pendingHatask = new Promise<void>(resolve => { release = resolve; });
		const view = mountPane('hatask', '/hatask');
		await settle();
		expect(view.target.querySelector('.htk-root')).toBeNull();
		expect(view.modes).toEqual([]);
		release();
		await vi.waitFor(() => expect(view.modes).toEqual(['light']));
		expect(view.target.querySelector('.htk-root')?.getAttribute('data-mode')).toBe('light');
	});

	test('keeps a changed community scope in the route for the next activation', async () => {
		const view = mountPane('hatady', '/hatady?tab=records&hgScope=recent', false);
		await settle();
		(view.target.querySelector('[data-scope=mine]') as HTMLButtonElement).click();
		expect(view.navigation).toEqual([]);
		view.active.value = true;
		await settle();
		(view.target.querySelector('[data-scope=mine]') as HTMLButtonElement).click();
		await settle();
		expect(view.navigation).toEqual([['/hatady?tab=records&hgScope=mine', true]]);
		expect(view.router.getCurrentFullPath()).toBe('/hatady?tab=records&hgScope=mine');
	});

	test('deactivates auxiliary tools while hidden and restores the same instance', async () => {
		const view = mountPane('hatask', '/scratchpad');
		await settle();
		expect(state.toolMounts).toBe(1);
		expect(state.toolActivations).toBe(1);
		view.active.value = false;
		await settle();
		expect(state.toolDeactivations).toBe(1);
		expect(view.target.querySelector('[data-owner=tool]')).toBeNull();
		view.active.value = true;
		await settle();
		expect(state.toolMounts).toBe(1);
		expect(state.toolActivations).toBe(2);
		expect(view.target.querySelector('[data-owner=tool]')).not.toBeNull();
	});

	test('keeps the same mounted HataFeed owner across root and issue routes', async () => {
		const view = mountPane('hatafeed', '/hatafeed');
		await vi.waitFor(() => expect(view.target.querySelector('[data-owner=hatafeed]')).not.toBeNull());
		expect(state.feedMounts).toBe(1);
		view.path.value = '/hatafeed/issue-1';
		await settle();
		expect(view.router.getCurrentFullPath()).toBe('/hatafeed/issue-1');
		expect(state.feedMounts).toBe(1);
		view.path.value = '/hatafeed/beta';
		await settle();
		expect(view.router.getCurrentFullPath()).toBe('/hatafeed/beta');
		expect(state.feedMounts).toBe(1);
	});

	test('keeps one Hatask owner across tabs while a tool has its own pane', async () => {
		const view = mountPane('hatask', '/hatask?tab=cal');
		await settle();
		view.path.value = '/hatask?tab=todo';
		await settle();
		expect(state.hataskMounts).toBe(1);
		expect(state.hataskLive).toBe(1);
		const toolTarget = window.document.createElement('div');
		view.target.append(toolTarget);
		const toolApp = createApp({ render: () => h(HatagoesPane, { app: 'hatask', path: '/scratchpad', active: true }) });
		toolApp.component('MkLoading', defineComponent({ render: () => h('span') }));
		toolApp.mount(toolTarget);
		await settle();
		expect(state.toolMounts).toBe(1);
		expect(state.hataskLive).toBe(1);
		toolApp.unmount();
	});

	test('syncs local push and replace to the parent, but does not echo parent updates', async () => {
		const view = mountPane('hatask', '/hatask');
		view.router.pushByPath('/hatask?tab=cal');
		view.router.replaceByPath('/hatask?tab=todo');
		expect(view.navigation).toEqual([['/hatask?tab=cal', undefined], ['/hatask?tab=todo', true]]);
		view.path.value = '/hatask?tab=mood';
		await settle();
		expect(view.router.getCurrentFullPath()).toBe('/hatask?tab=mood');
		expect(view.navigation).toHaveLength(2);
	});

	test('delegates navigation outside its pane before the child router moves', () => {
		const view = mountPane('hatask', '/hatask');
		view.router.pushByPath('/scratchpad');
		expect(view.navigation).toEqual([['/scratchpad', undefined]]);
		expect(view.router.getCurrentFullPath()).toBe('/hatask');
	});

	test('delegates an external or other-tool replace without remounting the child', async () => {
		const view = mountPane('hatask', '/hatask');
		await settle();
		view.router.replaceByPath('/scratchpad');
		expect(view.navigation).toEqual([['/scratchpad', true]]);
		expect(view.router.getCurrentFullPath()).toBe('/hatask');
		expect(state.hataskMounts).toBe(1);
		cleanup?.();
		cleanup = undefined;

		const tool = mountPane('hatask', '/scratchpad');
		await settle();
		tool.router.replaceByPath('/hatask');
		expect(tool.navigation).toEqual([['/hatask', true]]);
		expect(tool.router.getCurrentFullPath()).toBe('/scratchpad');
		expect(state.toolMounts).toBe(1);
	});

	test('ignores tab changes emitted by an inactive pane', async () => {
		const view = mountPane('hatask', '/hatask?tab=cal', false);
		await settle();
		(view.target.querySelector('[data-owner=hatask]') as HTMLButtonElement).click();
		await settle();
		expect(view.navigation).toEqual([]);
		expect(view.router.getCurrentFullPath()).toBe('/hatask?tab=cal');
		view.active.value = true;
		await settle();
		(view.target.querySelector('[data-owner=hatask]') as HTMLButtonElement).click();
		await settle();
		expect(view.navigation).toEqual([['/hatask?tab=todo', undefined]]);
	});
});
