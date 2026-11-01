/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, reactive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkNoteCharm from './MkNoteCharm.vue';
import { prefer } from '@/preferences.js';
import { useNoteCharm } from '@/composables/use-note-charm.js';

vi.mock('@@/js/config.js', () => ({ ui: 'default' }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true) } } };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { lift: 'チャームを持ち上げる', lower: 'チャームを下ろす' } } } }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => `${url}?static` }));
vi.mock('@/utility/note-charm-image-cache.js', () => ({ acquireNoteCharmImage: async (url: string) => ({ url, release: () => {} }) }));
vi.mock('@/utility/note-charm-artwork.js', async importOriginal => {
	const artwork = await importOriginal<typeof import('@/utility/note-charm-artwork.js')>();
	// Interaction tests do not need image decoding or network access.
	return { ...artwork, loadCharmArtwork: async (_url: string, size: number, pattern: Parameters<typeof artwork.createCharmArtwork>[1]) => artwork.createCharmArtwork(size, pattern) };
});

const cleanup: (() => void)[] = [];

function mountCharm(parent: HTMLElement = window.document.body, rect?: () => DOMRect) {
	const props = reactive({ charm: { url: '/charm.png', size: 76, pattern: 'dots' as const, color: '#6ba5e3' }, motion: false, interactive: true });
	const container = window.document.createElement('div');
	if (rect) container.getBoundingClientRect = rect;
	parent.append(container);
	const app = createApp({ render: () => h(MkNoteCharm, props) });
	app.mount(container);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); container.remove(); mounted = false; } };
	cleanup.push(unmount);
	const button = window.document.querySelector<HTMLButtonElement>('[data-note-charm] button')!;
	return { props, container, button, unmount };
}

function mountAttachment(frameAttachment = false, hasFrame = true) {
	const layout = {
		host: new DOMRect(100, 200, 800, 600),
		frame: new DOMRect(140, 320, 720, 440),
	};
	let state: ReturnType<typeof useNoteCharm>;
	let host: HTMLElement;
	let frame: HTMLElement;
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp({
		setup() {
			const source = ref<HTMLElement | null>(null);
			const rail = ref<HTMLElement | null>(null);
			const pendulum = ref<HTMLElement | null>(null);
			const button = ref<HTMLButtonElement | null>(null);
			state = useNoteCharm({ source, rail, pendulum, button, size: () => 76, motion: () => false, interactive: () => true });
			return () => h('section', {
				ref: element => {
					if (!(element instanceof HTMLElement)) return;
					host = element;
					Object.defineProperties(host, { offsetWidth: { value: 400, configurable: true }, offsetHeight: { value: 300, configurable: true } });
					host.getBoundingClientRect = () => layout.host;
				},
			}, [
				hasFrame ? h('article', {
					'data-note-charm-frame': 'on',
					'data-note-charm-attachment': frameAttachment ? 'frame' : undefined,
					ref: element => {
						if (!(element instanceof HTMLElement)) return;
						frame = element;
						frame.getBoundingClientRect = () => layout.frame;
					},
				}) : null,
				h('span', { ref: source }),
				h('div', { ref: rail }, h('div', { ref: pendulum }, h('button', { ref: button }))),
			]);
		},
	});
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	return { layout, get state() { return state; }, get host() { return host; }, get frame() { return frame; } };
}

function pointer(button: HTMLButtonElement, type: string, x: number, y: number) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', clientX: x, clientY: y });
	button.dispatchEvent(event);
}

beforeEach(() => { prefer.r.animation.value = true; });
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('note charm interaction', () => {
	test('offscreen ancestor resizes defer layout reads until the charm is visible again', async () => {
		const intersections = new Map<Element, IntersectionObserverCallback>();
		const resizes: { callback: ResizeObserverCallback; targets: Set<Element> }[] = [];
		vi.stubGlobal('IntersectionObserver', class {
			constructor(private callback: IntersectionObserverCallback) {}
			observe(target: Element) { intersections.set(target, this.callback); }
			disconnect() {}
		});
		vi.stubGlobal('ResizeObserver', class {
			targets = new Set<Element>();
			constructor(callback: ResizeObserverCallback) { resizes.push({ callback, targets: this.targets }); }
			observe(target: Element) { this.targets.add(target); }
			disconnect() { this.targets.clear(); }
		});
		const ancestor = window.document.createElement('div');
		window.document.body.append(ancestor);
		cleanup.push(() => ancestor.remove());
		let top = 2000;
		const rect = vi.fn(() => new DOMRect(100, top, 500, 200));
		const { container, button } = mountCharm(ancestor, rect);
		const visibility = intersections.get(container)!;
		visibility([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver);
		await nextTick();
		const styles = vi.spyOn(window, 'getComputedStyle');
		rect.mockClear();
		const affected = resizes.filter(observer => observer.targets.has(ancestor));
		expect(affected).toHaveLength(1);
		container.querySelector<HTMLElement>('span')!.style.setProperty('--MI_THEME-panel', '#123456');
		for (const observer of affected) observer.callback([], {} as ResizeObserver);
		await nextTick();
		expect(styles).not.toHaveBeenCalled();
		expect(rect).not.toHaveBeenCalled();
		expect(button.closest<HTMLElement>('[data-note-charm-layer]')!.style.visibility).toBe('hidden');
		// Positive control: re-entry must refresh the dirty geometry and theme.
		top = 120;
		visibility([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
		await nextTick();
		expect(styles).toHaveBeenCalled();
		expect(rect).toHaveBeenCalled();
		expect(button.closest<HTMLElement>('[data-note-charm-layer]')!.style.visibility).toBe('visible');
		expect(button.closest<HTMLElement>('[data-note-charm]')!.style.getPropertyValue('--MI_THEME-panel')).toBe('#123456');
	});

	test('a charm mounted in a hidden document observes its ancestors after returning', async () => {
		let hidden = true;
		vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
		const resizes: { callback: ResizeObserverCallback; targets: Set<Element> }[] = [];
		vi.stubGlobal('ResizeObserver', class {
			targets = new Set<Element>();
			constructor(callback: ResizeObserverCallback) { resizes.push({ callback, targets: this.targets }); }
			observe(target: Element) { this.targets.add(target); }
			disconnect() { this.targets.clear(); }
		});
		const ancestor = window.document.createElement('div');
		window.document.body.append(ancestor);
		cleanup.push(() => ancestor.remove());
		const { button } = mountCharm(ancestor, () => new DOMRect(100, 120, 500, 200));
		const observer = resizes.find(observer => observer.targets.has(ancestor));
		expect(observer).toBeDefined();
		hidden = false;
		window.document.dispatchEvent(new Event('visibilitychange'));
		await nextTick();
		expect(button.closest<HTMLElement>('[data-note-charm-layer]')!.style.visibility).toBe('visible');
		ancestor.setAttribute('inert', '');
		observer!.callback([], {} as ResizeObserver);
		await nextTick();
		expect(button.closest('[data-note-charm-layer]')!.hasAttribute('inert')).toBe(true);
	});

	test('a short clipped note keeps its full charm while outer scroll clipping remains', async () => {
		const scroller = window.document.createElement('div');
		scroller.style.overflowY = 'auto';
		scroller.getBoundingClientRect = () => new DOMRect(0, 40, 700, 500);
		window.document.body.append(scroller);
		cleanup.push(() => scroller.remove());
		const { container, button } = mountCharm(scroller, () => new DOMRect(100, 120, 500, 40));
		container.style.overflow = 'clip';
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		expect(layer.style.top).toBe('40px');
		expect(layer.style.height).toBe('500px');
		expect(layer.style.visibility).toBe('visible');
	});

	test('resizing through mobile view forgets transitions from the removed source', async () => {
		vi.stubGlobal('innerWidth', 1250);
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		const shell = window.document.createElement('div');
		window.document.body.append(shell);
		cleanup.push(() => shell.remove());
		mountCharm(shell, () => new DOMRect(100, 120, 500, 300));
		const transition = (type: string, propertyName: string) => {
			const event = new Event(type, { bubbles: true });
			Object.assign(event, { propertyName });
			shell.dispatchEvent(event);
		};
		transition('transitionrun', 'width');
		vi.stubGlobal('innerWidth', 390);
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		transition('transitionend', 'width');
		vi.stubGlobal('innerWidth', 1250);
		window.dispatchEvent(new Event('resize'));
		await nextTick(); await nextTick();
		transition('transitionrun', 'height');
		transition('transitionend', 'height');
		for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
		await nextTick();
		expect(frames.size).toBe(0);
	});

	test('desktop window resizing removes and restores the mounted charm without changing its settings', async () => {
		vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36');
		vi.stubGlobal('innerWidth', 1250);
		const { props } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		const saved = { ...props.charm };
		await nextTick();
		expect(window.document.querySelector('[data-note-charm-layer]')).not.toBeNull();
		vi.stubGlobal('innerWidth', 390);
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(window.document.querySelector('[data-note-charm-layer]')).toBeNull();
		vi.stubGlobal('innerWidth', 1250);
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		await nextTick();
		const layer = window.document.querySelector<HTMLElement>('[data-note-charm-layer]');
		expect(layer).not.toBeNull();
		expect(layer!.style.visibility).toBe('visible');
		expect(layer!.querySelector('button')).not.toBeNull();
		expect(props.charm).toEqual(saved);
	});

	test.each([601, 603])('a widget at x=%s leaves no invisible charm button in the tab order', async left => {
		const widget = window.document.createElement('aside');
		widget.setAttribute('data-note-charm-exclusion', '');
		widget.getBoundingClientRect = () => new DOMRect(left, 0, 350, window.innerHeight);
		window.document.body.append(widget);
		cleanup.push(() => widget.remove());
		const { button } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		await nextTick();
		expect(button.closest<HTMLElement>('[data-note-charm-layer]')!.style.visibility).toBe('hidden');
	});

	test.each(['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36'])('smartphones do not mount the charm or chain: %s', async userAgent => {
		vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
		const { props, container } = mountCharm();
		await nextTick();
		expect(window.document.querySelector('[data-note-charm-layer]')).toBeNull();
		expect(container.children.length).toBe(0);
		expect(props.charm.url).toBe('/charm.png');
	});

	test('a desktop charm retains its curved chain and beads', async () => {
		vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36');
		const { button } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		await nextTick();
		const hardware = button.closest('[data-note-charm]')!.querySelector('svg')!;
		expect(hardware.querySelector(':scope > path')?.getAttribute('d')).toMatch(/^M/);
		expect(hardware.querySelectorAll('[data-note-charm-ball]').length).toBeGreaterThan(6);
	});

	test.each([[48, 48], [64, 64], [76, 64], [96, 64]])('the displayed charm clamps legacy width %s to %s without mutating its settings', async (requested, expected) => {
		const { props, button } = mountCharm();
		props.charm.size = requested;
		await nextTick();
		expect(button.style.width).toBe(`${expected}px`);
		expect(props.charm.size).toBe(requested);
	});

	test('the drawing leaves the note flow and attaches to the original right edge', async () => {
		const { container, button, unmount } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		await nextTick();
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const layer = rail.closest<HTMLElement>('[data-note-charm-layer]');
		expect(container.contains(button)).toBe(false);
		expect(layer?.parentElement).toBe(window.document.body);
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('600px');
		expect(rail.style.getPropertyValue('--note-charm-top')).toBe('152px');
		unmount();
		expect(layer?.isConnected).toBe(false);
	});

	test.each([false, true])('a clipped source scroller positions a static portal and keeps its vertical bounds (reduced=%s)', async reduced => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		vi.spyOn(window, 'matchMedia').mockImplementation(query => Object.assign(new EventTarget(), { matches: reduced && query.includes('reduced-motion') }) as MediaQueryList);
		const scroller = window.document.createElement('div');
		scroller.style.overflowY = 'auto';
		scroller.getBoundingClientRect = () => new DOMRect(0, 40, 700, 500);
		window.document.body.append(scroller);
		cleanup.push(() => scroller.remove());
		let top = 120;
		const { button } = mountCharm(scroller, () => new DOMRect(100, top, 500, 300));
		await nextTick();
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const layer = rail.closest<HTMLElement>('[data-note-charm-layer]');
		expect(layer?.style.top).toBe('40px');
		expect(layer?.style.height).toBe('500px');
		expect(rail.style.getPropertyValue('--note-charm-top')).toBe('112px');
		top = 60;
		scroller.scrollTop = 60;
		scroller.dispatchEvent(new Event('scroll'));
		for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
		await nextTick();
		expect(rail.style.getPropertyValue('--note-charm-top')).toBe('52px');
		expect(button.parentElement!.style.transform).toContain('rotate(0.000deg)');
	});

	test('a timeline portal stays inside its column beside a widget and follows column resizing', async () => {
		const shell = window.document.createElement('div');
		const timeline = window.document.createElement('div');
		const widget = window.document.createElement('aside');
		widget.setAttribute('data-note-charm-exclusion', '');
		let columnWidth = 550;
		timeline.style.overflow = 'hidden';
		timeline.getBoundingClientRect = () => new DOMRect(100, 40, columnWidth, 500);
		widget.getBoundingClientRect = () => new DOMRect(100 + columnWidth, 40, 350, 500);
		shell.append(timeline, widget);
		window.document.body.append(shell);
		cleanup.push(() => shell.remove());
		const { container, button } = mountCharm(timeline, () => new DOMRect(100, 120, 500, 300));
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const layer = rail.closest<HTMLElement>('[data-note-charm-layer]')!;
		await nextTick();
		expect(layer.style.right).toBe(`${window.innerWidth - 650}px`);
		expect(layer.style.visibility).toBe('visible');
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('600px');
		expect(container.getBoundingClientRect().width).toBe(500);
		columnWidth = 490;
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(layer.style.visibility).toBe('hidden');
		expect(layer.style.right).toBe(`${window.innerWidth - 590}px`);
		columnWidth = 700;
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(layer.style.visibility).toBe('visible');
		expect(layer.style.right).toBe(`${window.innerWidth - 800}px`);
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('600px');
	});

	test('a widget drawer opening, hiding, reopening and removal update existing portals', async () => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		const { button } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		const widget = window.document.createElement('aside');
		widget.setAttribute('data-note-charm-exclusion', '');
		widget.getBoundingClientRect = () => new DOMRect(620, 0, 310, window.innerHeight);
		cleanup.push(() => widget.remove());
		const flush = async () => {
			await new Promise(resolve => window.setTimeout(resolve, 0));
			for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
			await nextTick();
		};
		window.document.body.append(widget);
		await flush();
		expect(layer.style.right).toBe(`${window.innerWidth - 620}px`);
		widget.style.display = 'none';
		await flush();
		expect(layer.style.right).toBe('0px');
		widget.style.display = '';
		await flush();
		expect(layer.style.right).toBe(`${window.innerWidth - 620}px`);
		widget.remove();
		await flush();
		expect(layer.style.right).toBe('0px');
		expect(frames.size).toBe(0);
	});

	test('widget transitions share one measurement per frame and stop tracking when complete', async () => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		const widget = window.document.createElement('aside');
		widget.setAttribute('data-note-charm-exclusion', '');
		let left = 750;
		const measure = vi.fn(() => new DOMRect(left, 0, 350, window.innerHeight));
		widget.getBoundingClientRect = measure;
		window.document.body.append(widget);
		cleanup.push(() => widget.remove());
		const { button } = mountCharm(window.document.body, () => new DOMRect(100, 120, 500, 300));
		mountCharm(window.document.body, () => new DOMRect(100, 400, 500, 300));
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		const flush = async () => {
			measure.mockClear();
			for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
			await nextTick();
			expect(measure).toHaveBeenCalledTimes(1);
		};
		const transition = (type: string) => {
			const event = new Event(type, { bubbles: true });
			Object.assign(event, { propertyName: 'width' });
			widget.dispatchEvent(event);
		};
		transition('transitionrun');
		left = 620;
		await flush();
		expect(layer.style.right).toBe(`${window.innerWidth - 620}px`);
		left = 590;
		await flush();
		expect(layer.style.visibility).toBe('hidden');
		left = 900;
		await flush();
		expect(layer.style.visibility).toBe('visible');
		transition('transitionend');
		await flush();
		expect(frames.size).toBe(0);
	});

	test.each(['inside', 'window', 'below'] as const)('a widget does not clip a charm %s its affected column', async location => {
		const widget = window.document.createElement('aside');
		widget.setAttribute('data-note-charm-exclusion', '');
		widget.getBoundingClientRect = () => new DOMRect(620, location === 'below' ? 600 : 0, 310, 300);
		window.document.body.append(widget);
		const parent = location === 'inside' ? widget : window.document.createElement('section');
		if (location === 'window') parent.setAttribute('data-mk-window', '');
		if (parent !== widget) window.document.body.append(parent);
		cleanup.push(() => { widget.remove(); if (parent !== widget) parent.remove(); });
		const { button } = mountCharm(parent, () => new DOMRect(100, 120, 500, 300));
		await nextTick();
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		expect(layer.style.right).toBe('0px');
		expect(layer.style.visibility).toBe('visible');
	});

	test('portal inherits local theme, compact sizing, window level and inert preview state', async () => {
		const source = window.document.createElement('section');
		source.style.setProperty('--MI_THEME-fg', '#123456');
		source.style.setProperty('--note-charm-slot-size', '48px');
		source.style.zIndex = '1000100';
		source.setAttribute('data-mk-window', '');
		source.setAttribute('inert', '');
		window.document.body.append(source);
		cleanup.push(() => source.remove());
		// The DOM shim does not inherit custom properties; provide the browser's
		// resolved values at the marker boundary while retaining real component DOM.
		const computedStyle = window.getComputedStyle.bind(window);
		vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
			const style = computedStyle(element);
			if (element.tagName === 'SPAN') {
				return new Proxy(style, { get(target, property) {
					if (property === 'getPropertyValue') return (name: string) => name === '--MI_THEME-fg' ? '#123456' : name === '--note-charm-slot-size' ? '48px' : target.getPropertyValue(name);
					const value = Reflect.get(target, property, target);
					return typeof value === 'function' ? value.bind(target) : value;
				} });
			}
			return style;
		});
		const { button } = mountCharm(source);
		await nextTick();
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const layer = rail.closest<HTMLElement>('[data-note-charm-layer]');
		expect(rail.style.getPropertyValue('--MI_THEME-fg')).toBe('#123456');
		expect(rail.style.getPropertyValue('--charm-width')).toBe('48px');
		expect(layer?.style.zIndex).toBe('1000101');
		expect(layer?.hasAttribute('inert')).toBe(true);
	});

	test('horizontal scroll and source transforms update position without driving the pendulum', async () => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		let left = 100;
		const { container, button } = mountCharm(window.document.body, () => new DOMRect(left, 120, 500, 300));
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const flush = async () => {
			for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
			await nextTick();
		};
		left = 40;
		container.scrollLeft = 60;
		container.dispatchEvent(new Event('scroll'));
		await flush();
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('540px');
		const event = (type: string) => { const e = new Event(type, { bubbles: true }); Object.assign(e, { propertyName: 'transform' }); container.dispatchEvent(e); };
		event('transitionrun');
		left = 50;
		await flush();
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('550px');
		left = 80;
		await flush();
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe('580px');
		event('transitionend');
		await flush();
		expect(frames.size).toBe(0);
	});

	test('a fully offscreen portal cannot receive focus and becomes visible again with its source', async () => {
		let left = window.innerWidth;
		const { button } = mountCharm(window.document.body, () => new DOMRect(left, 100, 100, 300));
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		await nextTick();
		expect(layer.style.visibility).toBe('hidden');
		left = 100;
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(layer.style.visibility).toBe('visible');
		const hidden = vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(layer.style.visibility).toBe('hidden');
		hidden.mockReturnValue(false);
		window.document.dispatchEvent(new Event('visibilitychange'));
		await nextTick();
		expect(layer.style.visibility).toBe('visible');
	});

	test('an attached transition keeps tracking when the rail leaves the viewport and returns', async () => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		let left = window.innerWidth - 490;
		const { container, button } = mountCharm(window.document.body, () => new DOMRect(left, 120, 500, 300));
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		const layer = button.closest<HTMLElement>('[data-note-charm-layer]')!;
		const flush = async () => {
			for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
			await nextTick();
		};
		const event = (type: string) => { const e = new Event(type, { bubbles: true }); Object.assign(e, { propertyName: 'transform' }); container.dispatchEvent(e); };
		event('transitionrun');
		await flush();
		expect(layer.style.visibility).toBe('hidden');
		left = window.innerWidth - 540;
		await flush();
		expect(layer.style.visibility).toBe('visible');
		expect(rail.style.getPropertyValue('--note-charm-left')).toBe(`${window.innerWidth - 40}px`);
		event('transitionend');
		await flush();
		expect(frames.size).toBe(0);
	});

	test('scaled source hover and drag use the same visible coordinates as the fixed drawing', async () => {
		const frames = new Map<number, FrameRequestCallback>();
		let id = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
		vi.spyOn(window, 'matchMedia').mockImplementation(query => Object.assign(new EventTarget(), { matches: query.includes('hover: hover') }) as MediaQueryList);
		const { container, button } = mountCharm(window.document.body, () => new DOMRect(0, 0, 800, 600));
		Object.defineProperties(container, { offsetWidth: { value: 400 }, offsetHeight: { value: 300 } });
		window.dispatchEvent(new Event('resize'));
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		rail.getBoundingClientRect = () => new DOMRect(800, 64, 214.4, 297.6);
		const event = new Event('pointermove');
		Object.assign(event, { pointerType: 'mouse', clientX: 908, clientY: 252 });
		window.dispatchEvent(event);
		for (const [key, cb] of [...frames]) { frames.delete(key); cb(100); }
		await nextTick();
		expect(rail.dataset.near).toBe('true');
		button.setPointerCapture = vi.fn();
		pointer(button, 'pointerdown', 900, 300);
		pointer(button, 'pointermove', 916, 280);
		await nextTick();
		expect(button.parentElement!.style.transform).toContain('translate(11.000px, 45.754px)');
	});
	test('the outer attachment follows the body frame below reply context in CSS pixels', () => {
		let onResize: ResizeObserverCallback | undefined;
		const observed = new Set<Element>();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: ResizeObserverCallback) { onResize = callback; }
			observe(element: Element) { observed.add(element); }
			disconnect() {}
		});
		const fixture = mountAttachment();
		expect(fixture.state.attachmentTop.value).toBe(92);
		expect(fixture.state.geometry.value.anchorX).toBe(3);
		expect(observed.has(fixture.host)).toBe(true);
		expect(observed.has(fixture.frame)).toBe(true);
		const eyeX = fixture.state.pose.value.eyeX;
		fixture.layout.frame = new DOMRect(140, 400, 720, 360);
		onResize!([], {} as ResizeObserver);
		expect(fixture.state.attachmentTop.value).toBe(132);
		expect(fixture.state.geometry.value.anchorX).toBe(3);
		expect(fixture.state.pose.value.eyeX).toBe(eyeX);
	});

	test('bubble attachment moves only the chain pin inward while the body stays outside the root', () => {
		const fixture = mountAttachment(true);
		expect(fixture.state.attachmentTop.value).toBe(92);
		expect(fixture.state.geometry.value.anchorX).toBe(-17);
		expect(fixture.state.pose.value.chain).toMatch(/^M -17\.000 4\.000 L /);
		expect(fixture.state.pose.value.eyeX).toBe(fixture.state.geometry.value.restX);
	});

	test('standalone charms keep the default outer attachment without a note frame', () => {
		const fixture = mountAttachment(false, false);
		expect(fixture.state.attachmentTop.value).toBe(32);
		expect(fixture.state.geometry.value.anchorX).toBe(3);
	});

	test('native button click holds and lowers a static charm with an accessible name', async () => {
		const { button } = mountCharm();
		expect(button.getAttribute('aria-label')).toBe('チャームを持ち上げる');
		button.click();
		await nextTick();
		await nextTick(); // Cached image acquisition resolves asynchronously.
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(button.getAttribute('aria-label')).toBe('チャームを下ろす');
		expect(button.querySelector('img')?.getAttribute('src')).toBe('/charm.png?static');
		button.click();
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	test('drag release rests without toggling again on the compatibility click', async () => {
		const { button } = mountCharm();
		const release = vi.fn();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = release;
		pointer(button, 'pointerdown', 50, 100);
		pointer(button, 'pointermove', 55, 50);
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('true');
		pointer(button, 'pointerup', 55, 50);
		button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('false');
		expect(release).toHaveBeenCalledWith(1);
	});

	test('a pointer tap releases instead of leaving the acrylic body latched', async () => {
		const { button } = mountCharm();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = vi.fn();
		pointer(button, 'pointerdown', 50, 100);
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('true');
		pointer(button, 'pointerup', 50, 100);
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('false');
		button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	test('dragging back from beyond the upper limit follows the finger immediately', async () => {
		const { button } = mountCharm();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = vi.fn();
		const y = () => Number(button.parentElement!.style.transform.match(/translate\([^,]+, ([-\d.]+)px\)/)![1]);
		pointer(button, 'pointerdown', 50, 100);
		pointer(button, 'pointermove', 50, -200);
		await nextTick();
		const atLimit = y();
		pointer(button, 'pointermove', 50, -188);
		await nextTick();
		expect(y() - atLimit).toBeCloseTo(12, 1);
		pointer(button, 'pointerup', 50, -188);
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	test('turning interaction off releases a held pointer and resets the pose', async () => {
		const { props, button } = mountCharm();
		const release = vi.fn();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = release;
		pointer(button, 'pointerdown', 50, 100);
		pointer(button, 'pointermove', 50, 60);
		props.interactive = false;
		await nextTick();
		expect(release).toHaveBeenCalledWith(1);
		expect(button.disabled).toBe(true);
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});

	test('double clicking a charm never reaches the note navigation handler', () => {
		const { container, button } = mountCharm();
		const navigate = vi.fn();
		container.addEventListener('dblclick', navigate);
		button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
		expect(navigate).not.toHaveBeenCalled();
	});

	test('scroll events without displacement do not start a sway', async () => {
		const callbacks = new Map<number, FrameRequestCallback>();
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.set(1, cb); return 1; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
		const { props, container, button } = mountCharm();
		props.motion = true;
		await nextTick();
		container.dispatchEvent(new Event('scroll'));
		window.document.dispatchEvent(new Event('scroll'));
		for (const [id, cb] of [...callbacks]) { callbacks.delete(id); cb(100); }
		await nextTick();
		expect(button.parentElement!.style.transform).toContain('rotate(0.000deg)');
	});

	test('splitting the same scroll displacement into events preserves the sway', async () => {
		async function response(positions: number[]) {
			const callbacks = new Map<number, FrameRequestCallback>();
			let nextId = 1;
			vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = nextId++; callbacks.set(id, cb); return id; });
			vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
			const { props, container, button, unmount } = mountCharm();
			props.motion = true;
			await nextTick();
			for (const position of positions) {
				container.scrollTop = position;
				container.dispatchEvent(new Event('scroll'));
			}
			for (let frame = 0; frame < 12 && callbacks.size; frame++) {
				const [id, callback] = callbacks.entries().next().value!;
				callbacks.delete(id);
				callback(100 + frame * 1000 / 60);
			}
			await nextTick();
			const result = button.parentElement!.style.transform;
			unmount();
			return result;
		}

		const single = await response([40]);
		const split = await response([10, 20, 30, 40]);
		expect(single).not.toMatch(/NaN|Infinity/);
		expect(split).toBe(single);
	});

	test('constant-speed scroll does not pin the charm to its swing limit and stops smoothly', async () => {
		const callbacks = new Map<number, FrameRequestCallback>();
		let nextId = 1;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = nextId++; callbacks.set(id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
		const { props, container, button } = mountCharm();
		props.motion = true;
		await nextTick();
		const frameAt = async (frame: number) => {
			for (const [id, callback] of [...callbacks]) {
				callbacks.delete(id);
				callback(100 + frame * 1000 / 60);
			}
			await nextTick();
		};
		const angle = () => Number(button.parentElement!.style.transform.match(/rotate\((-?[\d.]+)deg\)/)![1]);
		let peak = 0;
		for (let frame = 0; frame < 180; frame++) {
			container.scrollTop += 10;
			container.dispatchEvent(new Event('scroll'));
			await frameAt(frame);
			peak = Math.max(peak, Math.abs(angle()));
		}
		expect(peak).toBeLessThan(8.1);
		expect(Math.abs(angle())).toBeLessThan(.1);
		await frameAt(180);
		expect(Math.abs(angle())).toBeLessThan(1);
		for (let frame = 181; callbacks.size && frame < 900; frame++) await frameAt(frame);
		expect(callbacks.size).toBe(0);
		expect(angle()).toBe(0);
	});

	test('a nested scroller records its initial offset before the first scroll', async () => {
		async function response(initial: number) {
			const callbacks = new Map<number, FrameRequestCallback>();
			let nextId = 1;
			vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = nextId++; callbacks.set(id, cb); return id; });
			vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
			const ancestor = window.document.createElement('div');
			ancestor.scrollTop = initial;
			window.document.body.append(ancestor);
			const { props, button, unmount } = mountCharm(ancestor);
			props.motion = true;
			await nextTick();
			const resting = button.parentElement!.style.transform;
			ancestor.scrollTop = initial + 20;
			ancestor.dispatchEvent(new Event('scroll'));
			const [id, callback] = callbacks.entries().next().value!;
			callbacks.delete(id);
			callback(100);
			await nextTick();
			const result = button.parentElement!.style.transform;
			unmount();
			ancestor.remove();
			return { resting, result };
		}

		const fromTop = await response(0);
		expect(fromTop.result).not.toBe(fromTop.resting);
		expect(await response(300)).toEqual(fromTop);
	});

	test.each([{ motion: false, reduced: false }, { motion: true, reduced: true }])('scroll updates stationary-mouse transparency once per frame (motion=$motion, reduced=$reduced)', async ({ motion, reduced }) => {
		const callbacks = new Map<number, FrameRequestCallback>();
		let nextId = 1;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = nextId++; callbacks.set(id, cb); return id; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
		vi.spyOn(window, 'matchMedia').mockImplementation(query => Object.assign(new EventTarget(), { matches: query.includes('hover: hover') || reduced }) as MediaQueryList);
		const { props, container, button } = mountCharm();
		props.motion = motion;
		await nextTick();
		const rail = button.closest<HTMLElement>('[data-note-charm]')!;
		let top = 300;
		const measure = vi.spyOn(rail, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, top, 126, 204));
		const pointerEvent = new Event('pointermove', { bubbles: true });
		Object.assign(pointerEvent, { pointerType: 'mouse', clientX: 63, clientY: 130 });
		const flush = async () => {
			for (const [id, callback] of [...callbacks]) {
				callbacks.delete(id);
				callback(100);
			}
			await nextTick();
		};
		window.dispatchEvent(pointerEvent);
		await flush();
		expect(rail.dataset.near).toBe('false');
		expect(measure).toHaveBeenCalledTimes(1);
		top = 0;
		for (const position of [100, 200, 300]) {
			container.scrollTop = position;
			container.dispatchEvent(new Event('scroll'));
		}
		expect(measure).toHaveBeenCalledTimes(1);
		await flush();
		expect(measure).toHaveBeenCalledTimes(2);
		expect(rail.dataset.near).toBe('true');
		top = 300;
		container.scrollTop = 0;
		container.dispatchEvent(new Event('scroll'));
		await flush();
		expect(rail.dataset.near).toBe('false');
	});

	test('scrolling another column does not move this charm', async () => {
		const requestFrame = vi.fn();
		vi.stubGlobal('requestAnimationFrame', requestFrame);
		const { props } = mountCharm();
		props.motion = true;
		await nextTick();
		const other = window.document.createElement('div');
		window.document.body.append(other);
		other.scrollTop = 200;
		other.dispatchEvent(new Event('scroll'));
		expect(requestFrame).not.toHaveBeenCalled();
		other.remove();
	});

	test.each(['scroll', 'resize', 'blur', 'visibilitychange', 'pointercancel', 'lostpointercapture', 'offscreen', 'unmount'])('%s cancels a captured drag', async reason => {
		let visibility: IntersectionObserverCallback | undefined;
		vi.stubGlobal('IntersectionObserver', class {
			constructor(callback: IntersectionObserverCallback) { visibility = callback; }
			observe() {}
			disconnect() {}
		});
		const { container, button, unmount } = mountCharm();
		const release = vi.fn();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = release;
		pointer(button, 'pointerdown', 50, 100);
		pointer(button, 'pointermove', 50, 60);
		if (reason === 'scroll' || reason === 'visibilitychange') window.document.dispatchEvent(new Event(reason));
		else if (reason === 'offscreen') visibility!([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver);
		else if (reason === 'unmount') unmount();
		else if (reason === 'pointercancel' || reason === 'lostpointercapture') pointer(button, reason, 50, 60);
		else window.dispatchEvent(new Event(reason));
		await nextTick();
		expect(release).toHaveBeenCalledWith(1);
		if (reason !== 'unmount') expect(button.getAttribute('aria-pressed')).toBe('false');
		else expect(container.children.length).toBe(0);
	});

	test('system reduced motion and the animation preference both request a static image', async () => {
		const media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
		vi.spyOn(window, 'matchMedia').mockReturnValue(media);
		const { props, button } = mountCharm();
		props.motion = true;
		await nextTick();
		await nextTick();
		expect(button.querySelector('img')?.getAttribute('src')).toBe('/charm.png');
		prefer.r.animation.value = false;
		await nextTick();
		await nextTick();
		expect(button.querySelector('img')?.getAttribute('src')).toBe('/charm.png?static');
		prefer.r.animation.value = true;
		Object.assign(media, { matches: true });
		media.dispatchEvent(new Event('change'));
		await nextTick();
		await nextTick();
		expect(button.querySelector('img')?.getAttribute('src')).toBe('/charm.png?static');
		button.click();
		await nextTick();
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});

	test('replacing the image at the same size releases the previous image drag', async () => {
		const { props, button } = mountCharm();
		const release = vi.fn();
		button.setPointerCapture = vi.fn();
		button.hasPointerCapture = () => true;
		button.releasePointerCapture = release;
		pointer(button, 'pointerdown', 50, 100);
		pointer(button, 'pointermove', 50, 60);
		props.charm = { ...props.charm, url: '/replacement.png' };
		await nextTick();
		expect(release).toHaveBeenCalledWith(1);
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});
});
