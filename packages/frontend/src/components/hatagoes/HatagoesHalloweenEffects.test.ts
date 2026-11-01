/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));
import { prefer } from '@/preferences.js';
import HatagoesHalloweenEffects from './HatagoesHalloweenEffects.vue';

const cleanups: Array<() => void> = [];
let media: MediaQueryList;
type StyleRule = { selector: string; property: string; value: string; containers: string[] };
// Only the fields walked here; avoids comparing two bundled postcss type trees.
type CssParent = { type: string; name?: string; params?: unknown; parent?: CssParent };
const compiledRules: StyleRule[] = [];

beforeAll(async () => {
	for (const name of ['components/hatagoes/HatagoesHome', 'components/hatagoes/HatagoesHalloweenEffects', 'pages/hatagoes']) {
		const filename = resolve(process.cwd(), `src/${name}.vue`);
		const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename });
		for (const style of descriptor.styles) {
			const compiled = await compileStyleAsync({ filename, source: style.content, id: `data-v-${name.replaceAll('/', '-')}`, scoped: style.scoped, preprocessLang: style.lang === 'scss' ? 'scss' : undefined });
			if (compiled.errors.length || !compiled.rawResult?.root) throw new Error(`Styles did not compile: ${compiled.errors.join(', ')}`);
			compiled.rawResult.root.walkRules(rule => {
				const selector = normalizeSelector(rule.selector);
				const containers: string[] = [];
				for (let parent = rule.parent as CssParent | undefined; parent; parent = parent.parent) {
					if (parent.type === 'atrule' && parent.name === 'container' && parent.params != null) containers.push(String(parent.params));
				}
				rule.walkDecls(declaration => { compiledRules.push({ selector, property: declaration.prop, value: declaration.value, containers }); });
			});
		}
	}
});

function normalizeSelector(selector: string): string {
	return selector.replace(/\[data-v-[^\]]+\]/g, '').replace(/=(["'])([\w-]+)\1\]/g, '=$2]');
}

function declarations(selector: string, container?: string): Record<string, string> {
	return Object.fromEntries(compiledRules.filter(rule => rule.selector.split(',').some(part => part.trim() === normalizeSelector(selector)) && (container === undefined || rule.containers.includes(container))).map(rule => [rule.property, rule.value]));
}

function geometry(left: number, top: number, width: number, height: number): DOMRect {
	return { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) };
}

function mount(initial: Partial<{ active: boolean; count: number | null; day: string; revision: number; origin: HTMLElement | null; container: HTMLElement | null; viewport: HTMLElement | null; decorationHost: HTMLElement | null }> = {}) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const props = reactive({ active: true, count: 0 as number | null, day: '2026-10-19', revision: 0, ...initial });
	const app = createApp({ render: () => h(HatagoesHalloweenEffects, props) });
	app.mount(target);
	let mounted = true;
	const unmount = () => {
		if (!mounted) return;
		app.unmount();
		target.remove();
		mounted = false;
	};
	cleanups.push(unmount);
	return { target, props, unmount };
}

beforeEach(() => {
	vi.useFakeTimers();
	prefer.r.animation.value = true;
	media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockReturnValue(media);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('HataGoes Halloween effects', () => {
	test('compiles decorations above the actual opaque home cards while keeping both effect layers noninteractive', () => {
		const cards = declarations('.hgh-cards');
		const ambient = declarations('.hgh-halloween-ambient');
		const effects = declarations('.hgh-halloween-effects');
		expect(declarations('.hgh-card').background).toBe('var(--hgh-surface)');
		expect(cards.position).toBe('relative');
		const isVisibleLayer = (layer: Record<string, string>) => Number(layer['z-index']) > Number(cards['z-index']);
		expect(isVisibleLayer({ ...ambient, 'z-index': '0' })).toBe(false);
		expect(isVisibleLayer(ambient)).toBe(true);
		expect(Number(effects['z-index'])).toBeGreaterThan(Number(ambient['z-index']));
		expect(ambient['pointer-events']).toBe('none');
		expect(effects['pointer-events']).toBe('none');
		expect(declarations('.hgh-halloween-banner').top).toContain('--hgh-stage-height');
		expect(compiledRules.some(rule => rule.property === 'transform' && rule.value === 'translateY(var(--hgh-stage-height, 520px)) rotate(var(--hgh-particle-rotation))')).toBe(true);
	});

	test('compiles the shell decoration between the body and navigation without obscuring controls', () => {
		const header = declarations('.hgh-halloween-header');
		const shellHeader = { ...header, ...declarations('.hgh-halloween-header[data-shell="true"]') };
		const body = declarations('.body');
		const navigation = declarations('.header');
		expect(declarations('.common').overflow).toBe('auto');
		expect(declarations('.shell').position).toBe('relative');
		expect(header.position).toBe('absolute');
		expect(header.inset).toBe('0');
		expect(header.bottom).toBe('auto');
		expect(header.height).toBe('120px');
		expect(header['pointer-events']).toBe('none');
		const isBetweenBodyAndNavigation = (layer: Record<string, string>) => Number(layer['z-index']) > Number(body['z-index']) && Number(layer['z-index']) < Number(navigation['z-index']);
		expect(isBetweenBodyAndNavigation({ ...shellHeader, 'z-index': '0' })).toBe(false);
		expect(isBetweenBodyAndNavigation({ ...shellHeader, 'z-index': '7' })).toBe(false);
		expect(isBetweenBodyAndNavigation(shellHeader)).toBe(true);
		expect(Number(shellHeader['z-index'])).toBeLessThan(Number(declarations('.screenNav')['z-index']));
		expect(declarations('.hgh-halloween-spider')).toMatchObject({ right: 'min(120px, 31%)', top: '44px' });
		expect(declarations('.hgh-halloween-spider').opacity).toBeUndefined();
	});

	test('teleports one set of header ornaments outside the scroll clip while ghosts and celebrations stay in the home', async () => {
		const setTimer = vi.spyOn(window, 'setTimeout');
		const clearTimer = vi.spyOn(window, 'clearTimeout');
		const shell = window.document.createElement('div');
		const viewport = window.document.createElement('div');
		viewport.style.overflow = 'auto';
		shell.append(viewport);
		window.document.body.append(shell);
		cleanups.push(() => shell.remove());
		const view = mount({ count: 4, decorationHost: shell });
		viewport.append(view.target);
		await nextTick();
		const header = shell.querySelector('.hgh-halloween-header')!;
		expect(header.parentElement).toBe(shell);
		expect(header.getAttribute('data-shell')).toBe('true');
		expect(header.getAttribute('aria-hidden')).toBe('true');
		expect(viewport.contains(header)).toBe(false);
		expect(shell.querySelectorAll('.hgh-halloween-star')).toHaveLength(4);
		expect(declarations('.hgh-halloween-star:nth-child(4)').display).toBe('none');
		expect(shell.querySelectorAll('.hgh-halloween-spider')).toHaveLength(1);
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')).not.toBeNull();
		expect(header.querySelector('[role="status"]')).toBeNull();
		expect(view.target.querySelectorAll('.hgh-halloween-rain > i')).toHaveLength(22);
		const effectTimers = setTimer.mock.calls.map((call, index) => ({ delay: call[1], id: setTimer.mock.results[index].value })).filter(timer => timer.delay === 900 || timer.delay === 3300);
		expect(effectTimers.map(timer => timer.delay)).toEqual([900, 3300]);
		view.props.active = false;
		await nextTick();
		expect(shell.querySelector('.hgh-halloween-header')).toBeNull();
		expect(view.target.querySelector('.hgh-halloween-ambient')).toBeNull();
		for (const timer of effectTimers) expect(clearTimer).toHaveBeenCalledWith(timer.id);
		view.props.active = true;
		await nextTick();
		expect(shell.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		expect(view.target.querySelector('[role="status"]')).toBeNull();
	});

	test('keeps mobile ornaments while compiling the four wide stars and an unclipped desktop spider only for the shell host', async () => {
		const query = '(min-width: 851px)';
		const headerSelector = '.hgh-halloween-header[data-shell=true]';
		const wideHeader = declarations(headerSelector, query);
		expect(wideHeader.height).toBe('280px');
		const wideRules = compiledRules.filter(rule => rule.selector.includes('hgh-halloween') && rule.containers.length > 0);
		expect(wideRules.length).toBeGreaterThan(0);
		for (const rule of wideRules) {
			expect(rule.containers).toEqual([query]);
			expect(rule.selector.startsWith(headerSelector)).toBe(true);
		}
		const mobilePositions = [['62%', '18px'], ['78%', '40px'], ['48%', '46px']];
		for (const [index, [left, top]] of mobilePositions.entries()) {
			expect(declarations(`.hgh-halloween-star:nth-child(${index + 1})`)).toMatchObject({ left, top });
		}
		expect(declarations('.hgh-halloween-star:nth-child(4)').display).toBe('none');
		const widePositions = [['22%', '18px'], ['70%', '22px'], ['84%', '52px'], ['36%', '58px']];
		for (const [index, [left, top]] of widePositions.entries()) {
			expect(declarations(`${headerSelector} > .hgh-halloween-star:nth-child(${index + 1})`, query)).toMatchObject({ left, top });
		}
		expect(declarations(`${headerSelector} > .hgh-halloween-star:nth-child(4)`, query).display).toBe('block');
		expect(declarations(`${headerSelector} > .hgh-halloween-star`, query)['font-size']).toBe('12px');
		const mobileSpider = declarations('.hgh-halloween-spider');
		expect(mobileSpider).toMatchObject({ right: 'min(120px, 31%)', top: '44px', 'font-size': '16px', '--hgh-spider-duration': '3.2s', '--hgh-thread-height': '22px', '--hgh-thread-travel': '24px' });
		const wideSpider = declarations(`${headerSelector} > .hgh-halloween-spider`, query);
		expect(wideSpider).toMatchObject({ right: '40px', top: '178px', 'font-size': '18px', '--hgh-spider-duration': '3.4s', '--hgh-thread-height': '30px', '--hgh-thread-travel': '34px' });
		const threadHeight = Number.parseFloat(wideSpider['--hgh-thread-height']);
		const maxThreadHeight = threadHeight * Number.parseFloat(wideSpider['--hgh-thread-scale']);
		expect(maxThreadHeight).toBeCloseTo(64);
		expect(threadHeight + Number.parseFloat(wideSpider['--hgh-thread-travel'])).toBeCloseTo(maxThreadHeight);
		expect(Number.parseFloat(wideHeader.height) - (Number.parseFloat(wideSpider.top) + maxThreadHeight + Number.parseFloat(wideSpider['font-size']))).toBeGreaterThanOrEqual(20);
		expect(declarations('.hgh-halloween-spider > span').height).toBe('var(--hgh-thread-height)');
		expect(compiledRules.some(rule => rule.property === 'transform' && rule.value === 'scaleY(var(--hgh-thread-scale))')).toBe(true);
		expect(compiledRules.some(rule => rule.property === 'transform' && rule.value === 'translateY(var(--hgh-thread-travel))')).toBe(true);
		const view = mount();
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-header')?.getAttribute('data-shell')).toBe('false');
		expect(view.target.querySelectorAll('.hgh-halloween-star')).toHaveLength(4);
		expect(declarations('.hgh-halloween-header').height).toBe('120px');
	});

	test('moves header ornaments when the host changes and restores the local fallback without duplication', async () => {
		const firstHost = window.document.createElement('div');
		const secondHost = window.document.createElement('div');
		window.document.body.append(firstHost, secondHost);
		cleanups.push(() => { firstHost.remove(); secondHost.remove(); });
		const view = mount({ decorationHost: null });
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-header')?.getAttribute('data-shell')).toBe('false');
		view.props.decorationHost = firstHost;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-header')).toBeNull();
		expect(firstHost.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		view.props.decorationHost = secondHost;
		await nextTick();
		expect(firstHost.querySelector('.hgh-halloween-header')).toBeNull();
		expect(secondHost.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		prefer.r.animation.value = false;
		await nextTick();
		expect(secondHost.querySelector('.hgh-halloween-header')).toBeNull();
		prefer.r.animation.value = true;
		await nextTick();
		expect(secondHost.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		view.props.decorationHost = null;
		await nextTick();
		expect(secondHost.querySelector('.hgh-halloween-header')).toBeNull();
		expect(view.target.querySelectorAll('.hgh-halloween-header')).toHaveLength(1);
		view.props.decorationHost = secondHost;
		await nextTick();
		view.unmount();
		expect(secondHost.querySelector('.hgh-halloween-header')).toBeNull();
	});

	test('does not celebrate an initial completed day, then celebrates a newly saved increase', async () => {
		const view = mount({ count: 5 });
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-ghost')).not.toBeNull();
		expect(view.target.querySelectorAll('.hgh-halloween-ghost')).toHaveLength(3);
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		expect(view.target.querySelector('[role="status"]')).toBeNull();
		view.props.count = 4;
		await nextTick();
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelectorAll('.hgh-halloween-burst > i')).toHaveLength(12);
		expect(view.target.querySelectorAll('.hgh-halloween-rain > i')).toHaveLength(22);
		expect(view.target.querySelector('[role="status"]')?.textContent).toContain('Happy Halloween!');
		expect(view.target.querySelector('[role="status"]')?.closest('[aria-hidden="true"]')).toBeNull();
		expect(view.target.textContent).not.toContain('おかし +5');
		await vi.advanceTimersByTimeAsync(900);
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		expect(view.target.querySelector('[role="status"]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(2400);
		expect(view.target.querySelector('.hgh-halloween-rain')).toBeNull();
		expect(view.target.querySelector('[role="status"]')).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('keeps the last known count during save loading and requires a committed local-save revision', async () => {
		const view = mount({ count: 1 });
		await nextTick();
		view.props.count = 2;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		view.props.count = null;
		await nextTick();
		view.props.count = 3;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelectorAll('.hgh-halloween-burst > i')).toHaveLength(12);
		expect(view.target.querySelector('[role="status"]')).toBeNull();
		await vi.advanceTimersByTimeAsync(900);
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
	});

	test('anchors a burst to the counter after its container moves or resizes, measuring only on a saved increase', async () => {
		const origin = window.document.createElement('strong');
		const container = window.document.createElement('div');
		const originRect = vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue(geometry(300, 180, 24, 28));
		const containerRect = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(geometry(40, 100, 390, 600));
		const view = mount({ count: 1, origin, container });
		await nextTick();
		expect(originRect).not.toHaveBeenCalled();
		expect(containerRect).not.toHaveBeenCalled();
		view.props.count = 2;
		view.props.revision++;
		await nextTick();
		const particle = view.target.querySelector<HTMLElement>('.hgh-halloween-burst > i')!;
		expect(particle.style.left).toBe('272px');
		expect(particle.style.top).toBe('94px');
		expect(particle.style.right).toBe('auto');
		originRect.mockReturnValue(geometry(180, 90, 40, 26));
		containerRect.mockReturnValue(geometry(20, 60, 300, 720));
		view.props.revision++;
		await nextTick();
		expect(originRect).toHaveBeenCalledTimes(1);
		view.props.count = 3;
		view.props.revision++;
		await nextTick();
		const movedParticle = view.target.querySelector<HTMLElement>('.hgh-halloween-burst > i')!;
		expect(movedParticle.style.left).toBe('180px');
		expect(movedParticle.style.top).toBe('43px');
		expect(originRect).toHaveBeenCalledTimes(2);
		expect(containerRect).toHaveBeenCalledTimes(2);
	});

	test('keeps the completion stage within the scrolled viewport and clamps a counter that is above the visible area', async () => {
		const container = window.document.createElement('div');
		const viewport = window.document.createElement('div');
		const origin = window.document.createElement('strong');
		const containerRect = vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(geometry(20, 100, 360, 1600));
		const viewportRect = vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(geometry(20, 100, 360, 500));
		const originRect = vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue(geometry(320, 140, 24, 28));
		const view = mount({ count: 4, origin, container, viewport });
		await nextTick();
		const stage = view.target.querySelector<HTMLElement>('.hgh-halloween-effects')!;
		expect(stage.style.top).toBe('0px');
		containerRect.mockReturnValue(geometry(20, -400, 360, 1600));
		originRect.mockReturnValue(geometry(320, -360, 24, 28));
		viewport.scrollTop = 500;
		viewport.dispatchEvent(new Event('scroll'));
		await nextTick();
		expect(stage.style.top).toBe('500px');
		expect(stage.style.height).toBe('500px');
		expect(stage.style.getPropertyValue('--hgh-stage-height')).toBe('500px');
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')?.parentElement).toBe(stage);
		expect(view.target.querySelectorAll('.hgh-halloween-rain > i')).toHaveLength(22);
		const particle = stage.querySelector<HTMLElement>('.hgh-halloween-burst > i')!;
		expect(particle.style.left).toBe('280px');
		expect(particle.style.top).toBe('80px');
		viewportRect.mockReturnValue(geometry(20, 100, 360, 720));
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(stage.style.height).toBe('720px');
		expect(stage.style.getPropertyValue('--hgh-stage-height')).toBe('720px');
	});

	test('stops viewport listeners and resize observation while inactive and disposes them on unmount', async () => {
		const observers: Array<{ notify: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
		vi.stubGlobal('ResizeObserver', class {
			observe = vi.fn();
			disconnect = vi.fn();
			constructor(notify: () => void) { observers.push({ notify, observe: this.observe, disconnect: this.disconnect }); }
		});
		const container = window.document.createElement('div');
		const viewport = window.document.createElement('div');
		vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(geometry(20, 100, 360, 1600));
		const viewportRect = vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(geometry(20, 100, 360, 500));
		const addListener = vi.spyOn(viewport, 'addEventListener');
		const removeListener = vi.spyOn(viewport, 'removeEventListener');
		const view = mount({ active: false, container, viewport });
		await nextTick();
		expect(observers).toHaveLength(0);
		expect(viewportRect).not.toHaveBeenCalled();
		view.props.active = true;
		await nextTick();
		expect(observers).toHaveLength(1);
		expect(observers[0].observe).toHaveBeenCalledWith(viewport);
		expect(observers[0].observe).toHaveBeenCalledWith(container);
		expect(addListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
		viewportRect.mockReturnValue(geometry(20, 100, 320, 600));
		observers[0].notify();
		await nextTick();
		expect(view.target.querySelector<HTMLElement>('.hgh-halloween-effects')?.style.width).toBe('320px');
		view.props.active = false;
		await nextTick();
		expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
		expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
		const callsWhileActive = viewportRect.mock.calls.length;
		viewport.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(viewportRect).toHaveBeenCalledTimes(callsWhileActive);
		view.props.active = true;
		await nextTick();
		expect(observers).toHaveLength(2);
		view.unmount();
		expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
		expect(removeListener).toHaveBeenCalledTimes(2);
		const callsBeforeUnmount = viewportRect.mock.calls.length;
		viewport.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		expect(viewportRect).toHaveBeenCalledTimes(callsBeforeUnmount);
	});

	test('uses the first known count as a baseline after mounting and returning to the home', async () => {
		const view = mount({ count: null });
		await nextTick();
		view.props.count = 4;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')).not.toBeNull();
		view.props.active = false;
		await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		view.props.revision++;
		view.props.count = null;
		await nextTick();
		view.props.active = true;
		await nextTick();
		view.props.count = 5;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		expect(view.target.querySelector('[role="status"]')).toBeNull();
	});

	test('clears the old celebration and resets its baseline across midnight', async () => {
		const view = mount({ count: 4 });
		await nextTick();
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')).not.toBeNull();
		view.props.day = '2026-10-20';
		view.props.count = null;
		view.props.revision++;
		await nextTick();
		view.props.count = 5;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});

	test.each(['OS', 'preference'] as const)('shows only a static completion banner when motion is disabled by %s', async source => {
		if (source === 'OS') Object.assign(media, { matches: true });
		else prefer.r.animation.value = false;
		const view = mount({ count: 3 });
		await nextTick();
		view.props.count = 4;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-ambient')).toBeNull();
		expect(view.target.querySelector('.hgh-halloween-header')).toBeNull();
		expect(view.target.querySelector('.hgh-halloween-burst')).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelector('[role="status"]')?.getAttribute('data-animated')).toBe('false');
		expect(view.target.querySelector('.hgh-halloween-rain')).toBeNull();
		await vi.advanceTimersByTimeAsync(3300);
		expect(view.target.querySelector('[role="status"]')).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('responds to motion changes without replaying a running banner', async () => {
		const view = mount({ count: 4 });
		await nextTick();
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(view.target.querySelectorAll('.hgh-halloween-rain > i')).toHaveLength(22);
		Object.assign(media, { matches: true });
		const event = Object.assign(new Event('change'), { matches: true });
		media.dispatchEvent(event);
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-rain')).toBeNull();
		expect(view.target.querySelector('[role="status"]')?.getAttribute('data-animated')).toBe('false');
		Object.assign(media, { matches: false });
		media.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
		await nextTick();
		expect(view.target.querySelector('.hgh-halloween-ambient')).not.toBeNull();
		expect(view.target.querySelector('.hgh-halloween-rain')).toBeNull();
		expect(view.target.querySelector('[role="status"]')?.getAttribute('data-animated')).toBe('false');
	});

	test('replaces a burst timer and removes timers and media listeners when inactive or unmounted', async () => {
		const addListener = vi.spyOn(media, 'addEventListener');
		const removeListener = vi.spyOn(media, 'removeEventListener');
		const view = mount({ active: false, count: 1 });
		await nextTick();
		expect(addListener).not.toHaveBeenCalled();
		view.props.active = true;
		await nextTick();
		expect(addListener).toHaveBeenCalledTimes(1);
		view.props.count = 2;
		view.props.revision++;
		await nextTick();
		await vi.advanceTimersByTimeAsync(450);
		view.props.count = 3;
		view.props.revision++;
		await nextTick();
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(450);
		expect(view.target.querySelector('.hgh-halloween-burst')).not.toBeNull();
		view.props.active = false;
		await nextTick();
		expect(vi.getTimerCount()).toBe(0);
		expect(removeListener).toHaveBeenCalledTimes(1);
		view.props.active = true;
		await nextTick();
		expect(addListener).toHaveBeenCalledTimes(2);
		view.props.count = 5;
		view.props.revision++;
		await nextTick();
		expect(vi.getTimerCount()).toBe(2);
		view.unmount();
		expect(vi.getTimerCount()).toBe(0);
		expect(removeListener).toHaveBeenCalledTimes(2);
	});
});
