/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, KeepAlive, nextTick, reactive, ref } from 'vue';
import MkSeasonalTree from './MkSeasonalTree.vue';

const preference = vi.hoisted(() => ({ animation: undefined as unknown as { value: boolean } }));

vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _seasonalTree: {
	title: '四季の木', description: '景色', season: '季節', timeOfDay: '時間',
	_seasons: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' },
	_times: { dawn: '朝', day: '昼', dusk: '夕', night: '夜' },
} } } } }));
vi.mock('@/preferences.js', async () => {
	preference.animation = (await import('vue')).ref(true);
	return { prefer: { r: { animation: preference.animation } } };
});

let app: ReturnType<typeof createApp> | undefined;
let host: HTMLElement;
let intersection: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
let motionListeners: Set<(event: { matches: boolean }) => void>;
const originalHidden = Object.getOwnPropertyDescriptor(window.document, 'hidden');

function mount(props: Record<string, unknown> = {}, count = 1) {
	app = createApp({ render: () => h('div', Array.from({ length: count }, () => h(MkSeasonalTree, props))) });
	app.mount(host);
}

function setHidden(hidden: boolean) {
	Object.defineProperty(window.document, 'hidden', { configurable: true, value: hidden });
	window.document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-06-01T03:00:00Z'));
	host = window.document.createElement('div');
	window.document.body.append(host);
	intersection = undefined;
	preference.animation.value = true;
	motionListeners = new Set();
	vi.stubGlobal('IntersectionObserver', class {
		constructor(callback: typeof intersection) { intersection = callback; }
		observe() {}
		disconnect() { intersection = undefined; }
	});
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => motionListeners.add(listener),
		removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => motionListeners.delete(listener),
	}));
});
afterEach(() => {
	app?.unmount(); app = undefined;
	host.remove();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	if (originalHidden) Object.defineProperty(window.document, 'hidden', originalHidden);
	else Reflect.deleteProperty(window.document, 'hidden');
});

describe('seasonal tree scene', () => {
	it('keeps SVG references unique between instances', () => {
		mount({ season: 'spring', timeOfDay: 'day' }, 2);
		const svgs = [...host.querySelectorAll('svg')];
		const ids = svgs.map(svg => [...svg.querySelectorAll('[id]')].map(node => node.id));
		expect(svgs).toHaveLength(2);
		expect(ids[0].length).toBeGreaterThan(0);
		expect(ids[0].some(id => ids[1].includes(id))).toBe(false);
		for (const svg of svgs) {
			for (const reference of [...svg.querySelectorAll('[fill^="url(#"], [clip-path^="url(#"]')]) {
				const id = (reference.getAttribute('fill') ?? reference.getAttribute('clip-path'))?.slice(5, -1);
				expect(ids[svgs.indexOf(svg)]).toContain(id);
			}
		}
		expect(vi.getTimerCount()).toBe(0);
	});
	it('updates only while intersecting and visible, and clears its timer on unmount', async () => {
		mount();
		expect(vi.getTimerCount()).toBe(0);
		intersection?.([{ isIntersecting: true }]); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		setHidden(true); await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		setHidden(false); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		intersection?.([{ isIntersecting: false }]); await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		app?.unmount(); app = undefined;
		expect(vi.getTimerCount()).toBe(0);
		expect(intersection).toBeUndefined();
		expect(motionListeners.size).toBe(0);
	});
	it('preserves geometry nodes when time, wind, or motion changes', async () => {
		const props = reactive({ season: 'spring', timeOfDay: 'day', animated: true, windStrength: 60 });
		mount(props);
		intersection?.([{ isIntersecting: true }]); await nextTick();
		const paths = [...host.querySelectorAll('svg path')];
		const geometry = paths.map(path => path.getAttribute('d'));
		const sky = host.querySelector('stop')?.getAttribute('stop-color');
		props.timeOfDay = 'dusk'; props.windStrength = 100; await nextTick();
		expect(host.querySelector('stop')?.getAttribute('stop-color')).not.toBe(sky);
		expect(host.querySelectorAll('svg path')).toHaveLength(paths.length);
		paths.forEach((path, index) => expect(host.querySelectorAll('svg path')[index]).toBe(path));
		expect(paths.map(path => path.getAttribute('d'))).toEqual(geometry);
		props.animated = false; await nextTick();
		paths.forEach((path, index) => expect(host.querySelectorAll('svg path')[index]).toBe(path));
		expect(host.querySelector<SVGGElement>('g[aria-hidden="true"]')?.style.display).toBe('none');
		expect(vi.getTimerCount()).toBe(0);
	});
	it('bounds malformed wind values without changing the tree', async () => {
		const props = reactive({ season: 'winter', timeOfDay: 'day', windStrength: 0 });
		mount(props);
		const figure = host.querySelector('figure');
		if (!figure) throw new Error('Scene figure was not mounted');
		const tree = host.querySelector('svg');
		const still = figure.style.cssText;
		props.windStrength = -50; await nextTick();
		expect(figure.style.cssText).toBe(still);
		props.windStrength = 100; await nextTick();
		const strongest = figure.style.cssText;
		props.windStrength = 500; await nextTick();
		expect(figure.style.cssText).toBe(strongest);
		props.windStrength = 60; await nextTick();
		const fallback = figure.style.cssText;
		for (const wind of [NaN, Infinity, -Infinity]) {
			props.windStrength = wind; await nextTick();
			expect(figure.style.cssText).toBe(fallback);
			expect(figure.style.cssText).not.toMatch(/NaN|Infinity/);
		}
		expect(host.querySelector('svg')).toBe(tree);
	});
	it('keeps one clock across KeepAlive and ignores late offscreen callbacks', async () => {
		const show = ref(true);
		app = createApp({ render: () => h(KeepAlive, null, { default: () => show.value ? h(MkSeasonalTree) : null }) });
		app.mount(host);
		intersection?.([{ isIntersecting: true }]); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		show.value = false; await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		intersection?.([{ isIntersecting: true }]); await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		show.value = true; await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		intersection?.([{ isIntersecting: true }]); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
	});
	it('honors animation preferences without disabling automatic time updates', async () => {
		mount({ animated: true });
		intersection?.([{ isIntersecting: true }]); await nextTick();
		const figure = host.querySelector('figure');
		if (!figure) throw new Error('Scene figure was not mounted');
		const playing = figure.className;
		preference.animation.value = false; await nextTick();
		expect(figure.className).not.toBe(playing);
		expect(vi.getTimerCount()).toBe(1);
		preference.animation.value = true; await nextTick();
		expect(figure.className).toBe(playing);
		for (const listener of motionListeners) listener({ matches: true });
		await nextTick();
		expect(figure.className).not.toBe(playing);
		expect(vi.getTimerCount()).toBe(1);
		for (const listener of motionListeners) listener({ matches: false });
		await nextTick();
		expect(figure.className).toBe(playing);
	});
	it('resumes after page cache restoration and removes page listeners on unmount', async () => {
		mount();
		intersection?.([{ isIntersecting: true }]); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		window.dispatchEvent(new Event('pagehide')); await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		window.dispatchEvent(new Event('pageshow')); await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		app?.unmount(); app = undefined;
		window.dispatchEvent(new Event('pageshow')); await nextTick();
		expect(vi.getTimerCount()).toBe(0);
	});
});
