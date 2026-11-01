/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, inject, nextTick, reactive, unref } from 'vue';
import Hk3SideWorkspace from './Hk3SideWorkspace.vue';
import type { MaybeRef } from 'vue';
import { DI } from '@/di.js';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function mount(persistentPage = false) {
	const state = reactive({ mode: 'home' as 'home' | 'split' | 'full', pageActive: false, pageInert: false, timelineActive: true, controls: false, mobile: false, preservePageNavigation: false, reduceMotion: false, inert: false, glass: true, title: '' });
	const events = { toggle: vi.fn(), close: vi.fn() };
	const mounted = { timeline: 0, page: 0 };
	const Timeline = defineComponent({ setup() {
		mounted.timeline++;
		const omitTitle = inject<MaybeRef<boolean>>('shouldOmitHeaderTitle', false);
		const omitBack = inject<MaybeRef<boolean>>('shouldOmitHeaderBack', false);
		return () => h('input', { 'aria-label': 'Draft', 'data-omit-title': unref(omitTitle), 'data-omit-back': unref(omitBack) });
	} });
	const Page = defineComponent({ setup() {
		mounted.page++;
		const omitTitle = inject<MaybeRef<boolean>>('shouldOmitHeaderTitle', false);
		const omitBack = inject<MaybeRef<boolean>>('shouldOmitHeaderBack', false);
		const contained = inject(DI.pageControlsContained, computed(() => false));
		return () => h('div', { 'data-test-page': '', 'data-omit-title': unref(omitTitle), 'data-omit-back': unref(omitBack), 'data-contained-controls': unref(contained) }, 'Page');
	} });
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3SideWorkspace, {
		...state,
		expandLabel: 'Expand',
		restoreLabel: 'Restore',
		closeLabel: 'Close',
		onToggle: events.toggle,
		onClose: events.close,
	}, {
		page: () => persistentPage || state.pageActive ? h(Page) : null,
		timeline: () => h(Timeline),
	}) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { state, events, mounted, target };
}

describe('Hk3SideWorkspace', () => {
	it('keeps page controls contained on desktop in split and full modes', async () => {
		const view = mount(true);
		const page = view.target.querySelector('[data-test-page]');
		const contained = () => page?.getAttribute('data-contained-controls');
		expect(contained()).toBe('true');
		view.state.mode = 'split'; view.state.pageActive = true;
		await nextTick();
		expect(contained()).toBe('true');
		view.state.mode = 'full';
		await nextTick();
		expect(contained()).toBe('true');
		view.state.mobile = true;
		await nextTick();
		expect(contained()).toBe('false');
		view.state.mobile = false; view.state.mode = 'split';
		await nextTick();
		expect(contained()).toBe('true');
		expect(view.target.querySelector('[data-test-page]')).toBe(page);
		expect(view.mounted.page).toBe(1);
	});

	it('updates the page-only back context without remounting the page across pane modes', async () => {
		const view = mount(true);
		const page = view.target.querySelector('[data-test-page]');
		const timeline = view.target.querySelector('input[aria-label="Draft"]');
		const omitBack = () => page?.getAttribute('data-omit-back');
		expect(omitBack()).toBe('false');
		expect(timeline?.getAttribute('data-omit-back')).toBe('false');

		view.state.mode = 'split'; view.state.pageActive = true; view.state.controls = true;
		await nextTick();
		expect(omitBack()).toBe('true');
		expect(timeline?.getAttribute('data-omit-back')).toBe('false');

		view.state.glass = false;
		await nextTick();
		expect(omitBack()).toBe('true');

		view.state.mode = 'full';
		await nextTick();
		expect(omitBack()).toBe('false');
		view.state.mode = 'split';
		await nextTick();
		expect(omitBack()).toBe('true');
		view.state.mobile = true;
		await nextTick();
		expect(omitBack()).toBe('false');
		view.state.mobile = false;
		await nextTick();
		expect(omitBack()).toBe('true');
		view.state.preservePageNavigation = true;
		await nextTick();
		expect(omitBack()).toBe('false');
		view.state.preservePageNavigation = false;
		await nextTick();
		expect(omitBack()).toBe('true');
		view.state.controls = false;
		await nextTick();
		expect(omitBack()).toBe('false');
		view.state.controls = true;
		await nextTick();
		expect(omitBack()).toBe('true');
		view.state.pageActive = false;
		await nextTick();
		expect(omitBack()).toBe('false');
		view.state.mode = 'home';
		await nextTick();
		expect(omitBack()).toBe('false');
		expect(timeline?.getAttribute('data-omit-back')).toBe('false');
		expect(view.target.querySelector('[data-test-page]')).toBe(page);
		expect(view.target.querySelector('input[aria-label="Draft"]')).toBe(timeline);
		expect(view.mounted.page).toBe(1);
		expect(view.mounted.timeline).toBe(1);
	});

	it('moves the page title into the toolbar without remounting the page or changing the timeline scope', async () => {
		const view = mount();
		view.state.mode = 'split'; view.state.pageActive = true; view.state.controls = true; view.state.title = 'Notifications';
		await nextTick();
		const page = view.target.querySelector('[data-test-page]');
		expect(view.target.querySelector('h1')?.textContent).toBe('Notifications');
		expect(page?.getAttribute('data-omit-title')).toBe('true');
		expect(view.target.querySelector('input')?.getAttribute('data-omit-title')).toBe('false');
		view.state.title = 'A long updated page title'; view.state.mode = 'full'; view.state.timelineActive = false;
		await nextTick();
		expect(view.target.querySelector('h1')?.getAttribute('title')).toBe(view.state.title);
		expect(view.target.querySelector('[data-test-page]')).toBe(page);
		view.state.controls = false;
		await nextTick();
		expect(view.target.querySelector('h1')).toBeNull();
		expect(page?.getAttribute('data-omit-title')).toBe('false');
		view.state.controls = true; view.state.title = '';
		await nextTick();
		expect(page?.getAttribute('data-omit-title')).toBe('false');
		expect(view.mounted.page).toBe(1);
		expect(view.mounted.timeline).toBe(1);
	});

	it('keeps the timeline and draft mounted through split, full, and home', async () => {
		const view = mount();
		const draft = view.target.querySelector<HTMLInputElement>('input[aria-label="Draft"]')!;
		draft.value = 'Unsent draft';
		view.state.mode = 'split'; view.state.pageActive = true; view.state.controls = true;
		await nextTick();
		expect(view.target.querySelector('[data-mode="split"]')).not.toBeNull();
		expect(view.target.querySelectorAll('[data-test-page]')).toHaveLength(1);
		expect(view.target.querySelector<HTMLInputElement>('input[aria-label="Draft"]')).toBe(draft);
		view.target.querySelector<HTMLButtonElement>('[aria-label="Expand"]')!.click();
		expect(view.events.toggle).toHaveBeenCalledOnce();
		view.state.mode = 'full'; view.state.timelineActive = false;
		await nextTick();
		expect(view.target.querySelector('[data-hk3-side-timeline]')?.hasAttribute('inert')).toBe(true);
		expect(view.target.querySelector('[data-hk3-side-timeline]')?.getAttribute('aria-hidden')).toBe('true');
		expect(view.target.querySelector<HTMLButtonElement>('[aria-label="Restore"]')).not.toBeNull();
		view.state.mode = 'split'; view.state.timelineActive = true;
		await nextTick();
		view.target.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
		expect(view.events.close).toHaveBeenCalledOnce();
		view.state.mode = 'home'; view.state.pageActive = false; view.state.controls = false;
		await nextTick();
		expect(view.target.querySelector<HTMLInputElement>('input[aria-label="Draft"]')).toBe(draft);
		expect(draft.value).toBe('Unsent draft');
		expect(view.mounted.timeline).toBe(1);
		expect(view.mounted.page).toBe(1);
	});

	it('shows only close on mobile and keeps hidden content inert during rapid reversals', async () => {
		const view = mount();
		view.state.mobile = true; view.state.mode = 'full'; view.state.pageActive = true; view.state.timelineActive = false; view.state.controls = true;
		await nextTick();
		expect(view.target.querySelectorAll('button')).toHaveLength(1);
		expect(view.target.querySelector('[data-hk3-side-timeline]')?.hasAttribute('inert')).toBe(true);
		view.state.mode = 'home'; view.state.pageActive = false; view.state.timelineActive = true;
		view.state.inert = true;
		await nextTick();
		expect(view.target.firstElementChild?.hasAttribute('inert')).toBe(true);
		expect(view.target.querySelector('[data-hk3-side-timeline]')?.getAttribute('data-active')).toBe('true');
		expect(view.target.querySelector('[data-hk3-side-timeline]')?.getAttribute('aria-hidden')).toBe('false');
		view.state.mode = 'full'; view.state.pageActive = true; view.state.timelineActive = false; view.state.reduceMotion = true;
		view.state.inert = false;
		await nextTick();
		expect(view.target.querySelector('[data-reduce-motion="true"]')).not.toBeNull();
		expect(view.target.querySelector('[data-hk3-side-page]')?.hasAttribute('inert')).toBe(false);
		expect(view.mounted.timeline).toBe(1);
	});
});

it('blocks the split page while leaving the retained timeline composer available for confirmation', async () => {
	const view = mount(true);
	view.state.mode = 'split'; view.state.pageActive = true;
	await nextTick();
	const draft = view.target.querySelector<HTMLInputElement>('input[aria-label="Draft"]')!;
	draft.value = 'kept draft';
	view.state.pageInert = true;
	await nextTick();
	expect(view.target.querySelector('[data-hk3-side-page]')?.hasAttribute('inert')).toBe(true);
	expect(draft.closest('[inert]')).toBeNull();
	view.state.pageInert = false;
	await nextTick();
	expect(view.target.querySelector('[data-hk3-side-page]')?.hasAttribute('inert')).toBe(false);
	expect(view.target.querySelector('input')).toBe(draft);
	expect(draft.value).toBe('kept draft');
});
