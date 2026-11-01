/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import MkMobileNavbarSearch from './MkMobileNavbarSearch.vue';

const child = vi.hoisted(() => ({
	focus: vi.fn(),
	ready: Promise.resolve(),
	resolve: () => {},
	emit: null as ((event: 'height' | 'close', height?: number) => void) | null,
}));

vi.mock('@/i18n.js', () => ({ i18n: { ts: { search: '検索' } } }));
vi.mock('@/pages/search.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: ['embedded', 'active', 'maxHeight', 'motion'],
		emits: ['height', 'close'],
		async setup(props, { expose, emit }) {
			expose({ focus: child.focus });
			child.emit = emit;
			await child.ready;
			return () => render('div', { 'data-search': true, 'data-active': props.active }, '検索');
		},
	}) };
});

let app: App | undefined;
let host: HTMLElement;
const active = ref(true);
const maxHeight = ref(300);
const wrapper = ref<{ focus: () => void } | null>(null);
const heights: number[] = [];
const close = vi.fn();
const warnings: string[] = [];

async function flush() {
	for (let index = 0; index < 6; index++) await nextTick();
}

function mount() {
	app = createApp({ render: () => h(MkMobileNavbarSearch, {
		ref: wrapper, active: active.value, maxHeight: maxHeight.value, motion: false,
		onHeight: (height: number) => heights.push(height), onClose: close,
	}) });
	app.config.warnHandler = message => warnings.push(message);
	app.mount(host);
}

beforeEach(() => {
	active.value = true; maxHeight.value = 300; wrapper.value = null;
	heights.length = 0; warnings.length = 0; child.emit = null;
	child.focus.mockClear(); close.mockClear();
	child.ready = new Promise<void>(resolve => { child.resolve = resolve; });
	host = window.document.createElement('div'); window.document.body.append(host);
});

afterEach(async () => {
	child.resolve(); await flush();
	app?.unmount(); app = undefined; host.remove();
	expect(warnings).toEqual([]);
});

describe('mobile navbar search adapter', () => {
	test('Suspense forwards an explicit focus request once the async search is ready', async () => {
		mount();
		wrapper.value?.focus();
		expect(heights).toEqual([59]);
		expect(child.focus).not.toHaveBeenCalled();
		child.resolve(); await flush();
		expect(child.focus).toHaveBeenCalledOnce();
		expect(host.querySelector('[data-search]')).not.toBeNull();
		child.emit?.('height', 480);
		expect(heights.at(-1)).toBe(300);
		child.emit?.('close');
		expect(close).toHaveBeenCalledOnce();
	});

	test('deactivation cancels pending focus and suppresses late height and close events', async () => {
		mount(); wrapper.value?.focus();
		active.value = false; await flush();
		const count = heights.length;
		child.resolve(); await flush();
		wrapper.value?.focus();
		child.emit?.('height', 200); child.emit?.('close');
		maxHeight.value = 160; await flush();
		expect(child.focus).not.toHaveBeenCalled();
		expect(heights).toHaveLength(count);
		expect(close).not.toHaveBeenCalled();
		expect(host.querySelector('[data-mobile-navbar-search]')?.hasAttribute('inert')).toBe(true);
		const content = host.querySelector('[data-search]');
		active.value = true; await flush();
		expect(host.querySelector('[data-search]')).toBe(content);
		expect(child.focus).not.toHaveBeenCalled();
		wrapper.value?.focus();
		expect(child.focus).toHaveBeenCalledOnce();
	});

	test('initially inactive content resolves without emitting a height or focusing', async () => {
		active.value = false; mount();
		wrapper.value?.focus(); child.resolve(); await flush();
		expect(heights).toEqual([]);
		expect(child.focus).not.toHaveBeenCalled();
	});
});
