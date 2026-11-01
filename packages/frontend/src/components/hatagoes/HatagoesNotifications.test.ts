/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { Nirax } from '@/lib/nirax.js';
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';
import HatagoesNotifications from './HatagoesNotifications.vue';

const fixture = vi.hoisted(() => ({
	routers: [] as unknown[],
	api: vi.fn(),
	dispose: vi.fn(),
	reload: vi.fn(),
}));

vi.mock('@/di.js', () => ({ DI: { router: Symbol('router') } }));
vi.mock('@/router.js', async () => {
	const { Nirax } = await import('@/lib/nirax.js');
	const Page = { render: () => null };
	return { createRouter: (path: string) => {
		const router = new Nirax([{ path: '/hatagoes', component: Page }], path, true, Page);
		fixture.routers.push(router);
		return router;
	} };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: () => ({ on: vi.fn(), dispose: fixture.dispose }) }) }));
vi.mock('@/components/MkStreamingNotificationsTimeline.vue', async () => {
	const { defineComponent, h, inject } = await import('vue');
	const { DI } = await import('@/di.js');
	return { default: defineComponent({
		props: { includeBrands: Array, includeHataskApp: Boolean, active: Boolean, notUseGrouped: Boolean },
		setup(props, { expose }) {
			const router = inject(DI.router);
			if (!router) throw new Error('Missing notification router');
			expose({ reload: fixture.reload });
			return () => h('div', {
				'data-timeline': '',
				'data-brands': props.includeBrands?.join(','),
				'data-active': String(props.active),
				'data-hatask': String(props.includeHataskApp),
				'data-ungrouped': String(props.notUseGrouped),
			}, [
				h('button', { onClick: () => router.pushByPath('/hatafeed/n/123') }, 'イシューを開く'),
				h('button', { onClick: () => router.pushByPath('/hatask?notice=calendar') }, '予定を開く'),
			]);
		},
	}) };
});

let cleanup: (() => void) | undefined;

async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function button(scope: ParentNode, label: string): HTMLButtonElement {
	const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.startsWith(label));
	if (!found) throw new Error(`Missing button: ${label}`);
	return found;
}

function childRouter(): Nirax<never[]> { return fixture.routers[0] as Nirax<never[]>; }

async function mount() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const active = ref(true);
	const revision = ref(0);
	const outerPath = ref('/hatagoes?view=notifications');
	const navigations: string[] = [];
	const counts: number[] = [];
	const app = createApp(defineComponent({ render: () => h(HatagoesNotifications, {
		active: active.value, pollingActive: false, revision: revision.value,
		onNavigate: (path: string) => { navigations.push(path); outerPath.value = hatagoesUrl(path); },
		onCount: (count: number) => counts.push(count),
	}) }));
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	await settle();
	return { target, active, revision, outerPath, navigations, counts };
}

beforeEach(() => {
	fixture.routers.length = 0;
	fixture.api.mockReset().mockResolvedValue({ count: 6, hatask: 1, hatady: 2, hataFeed: 3 });
	fixture.dispose.mockReset();
	fixture.reload.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup?.(); cleanup = undefined; });

describe('HataGoes notifications', () => {
	test('routes both legacy notification links to the parent without moving the child router', async () => {
		const view = await mount();
		button(view.target, 'イシューを開く').click();
		button(view.target, '予定を開く').click();
		await settle();
		expect(view.navigations).toEqual(['/hatafeed/n/123', '/hatask?notice=calendar']);
		expect(view.outerPath.value).toBe(hatagoesUrl('/hatask?notice=calendar'));
		expect(childRouter().getCurrentFullPath()).toBe('/hatagoes?view=notifications');
	});

	test('passes only the three app brands, the selected filter, and active state to the timeline', async () => {
		const view = await mount();
		const timeline = () => view.target.querySelector<HTMLElement>('[data-timeline]');
		expect(timeline()?.dataset).toMatchObject({ brands: 'hatask,hatady,hataFeed', active: 'true', hatask: 'true', ungrouped: 'true' });
		expect(view.counts).toEqual([6]);
		button(view.target, 'Hatady').click();
		await settle();
		expect(timeline()?.dataset.brands).toBe('hatady');
		button(view.target, 'HataFeed').click();
		await settle();
		expect(timeline()?.dataset.brands).toBe('hataFeed');
		view.active.value = false;
		await settle();
		expect(timeline()?.dataset.active).toBe('false');
	});

	test('refreshes counts and the mounted timeline on button and active revision changes', async () => {
		const view = await mount();
		expect(fixture.api).toHaveBeenCalledTimes(1);
		button(view.target, '通知を更新').click();
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(2);
		expect(fixture.reload).toHaveBeenCalledTimes(1);
		view.revision.value++;
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(3);
		expect(fixture.reload).toHaveBeenCalledTimes(2);
		view.active.value = false;
		await settle();
		view.revision.value++;
		await settle();
		expect(fixture.api).toHaveBeenCalledTimes(3);
		expect(fixture.reload).toHaveBeenCalledTimes(2);
	});
});
