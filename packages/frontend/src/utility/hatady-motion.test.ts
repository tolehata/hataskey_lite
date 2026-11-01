/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { captureHatadyPageTurn } from './hatady-motion.js';
import { prefer } from '@/preferences.js';

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));

type MotionProbe = {
	node: HTMLElement;
	frames: Keyframe[];
	options: KeyframeAnimationOptions;
	animation: Animation;
	finish: () => void;
};
const cleanups: Array<() => void> = [];
let styles: string, classes: Record<string, string>;
let probes: MotionProbe[], reduced: boolean, media: EventTarget;

beforeAll(async () => {
	const filename = resolve(process.cwd(), 'src/pages/hatady.vue');
	const sfc = parse(readFileSync(filename, 'utf8'));
	const style = sfc.descriptor.styles.find(block => block.module);
	if (!style) throw new Error('Hatady module style is missing');
	const compiled = await compileStyleAsync({ filename, source: style.content, id: 'hatady-motion-check', preprocessLang: 'scss', modules: true });
	if (compiled.errors.length || !compiled.modules) throw new Error(`Hatady style failed to compile: ${compiled.errors.join(', ')}`);
	classes = compiled.modules;
	styles = `${compiled.code}\n${readFileSync(resolve(process.cwd(), 'src/components/hatady-ui.css'), 'utf8')}`;
});

beforeEach(() => {
	vi.useFakeTimers();
	probes = [];
	reduced = false;
	prefer.r.animation.value = true;
	media = new EventTarget();
	Object.defineProperty(media, 'matches', { get: () => reduced });
	vi.stubGlobal('matchMedia', () => media);
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement, frames, options) {
		let finish: () => void = () => { throw new Error('Animation promise not initialized'); };
		const finished = new Promise<Animation>(done => { finish = () => done(animation); });
		const animation = { cancel: vi.fn(), finished, startTime: null } as unknown as Animation;
		probes.push({ node: this, frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, animation, finish });
		return animation;
	});
	const style = window.document.createElement('style');
	style.textContent = styles;
	window.document.head.append(style);
	cleanups.push(() => style.remove());
});

afterEach(() => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function mountPage(width = 1920) {
	const main = window.document.createElement('main');
	main.id = 'original-main';
	main.className = classes.main;
	main.style.width = `${width}px`;
	main.innerHTML = `<section class="${classes.page}"><article data-hy-entrance="movie" data-card="above"><button id="old-offscreen">Above viewport</button></article><article data-hy-entrance="work" data-card="visible"><div data-nested-scroll><label for="record-title">Title</label><input id="record-title" name="title" value="Saved title"><div data-inner-scroll>Nested content</div></div></article><article data-hy-entrance="game" data-card="below"><button>Below viewport</button></article></section>`;
	window.document.body.append(main);
	Object.defineProperties(main, { clientWidth: { value: width }, clientHeight: { value: 600 } });
	vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ left: 0, right: width, top: 100, bottom: 700, width, height: 600 } as DOMRect);
	for (const [name, top, height] of [['above', 0, 90], ['visible', 180, 220], ['below', 710, 130]] as const) {
		vi.spyOn(main.querySelector<HTMLElement>(`[data-card="${name}"]`)!, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + height, height, width } as DOMRect);
	}
	cleanups.push(() => main.remove());
	return {
		main,
		capture(direction = 1) {
			const motion = captureHatadyPageTurn(main, direction);
			cleanups.push(motion.cancel);
			return motion;
		},
	};
}

describe('Hatady paper viewport and cleanup', () => {
	test('inserts the complete paper and restores every scroll before starting any animation', () => {
		const { main, capture } = mountPage(380);
		main.scrollTop = 320;
		main.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollTop = 45;
		const phases: { strips: number; scrolls: number[]; nested: number[] }[] = [];
		const animate = vi.mocked(HTMLElement.prototype.animate).getMockImplementation()!;
		vi.mocked(HTMLElement.prototype.animate).mockImplementation(function (this: HTMLElement, frames, options) {
			const copies = Array.from(main.querySelectorAll<HTMLElement>('.hy-paper-copy'));
			phases.push({
				strips: main.querySelectorAll('.hy-paper-strip').length,
				scrolls: copies.map(copy => copy.scrollTop),
				nested: copies.map(copy => copy.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollTop),
			});
			return animate.call(this, frames, options);
		});
		capture().play(125);
		const stripCount = main.querySelectorAll('.hy-paper-strip').length;
		expect(stripCount).toBeGreaterThan(1);
		expect(phases).toHaveLength(stripCount * 3 + 1);
		for (const phase of phases) {
			expect(phase.strips).toBe(stripCount);
			expect(phase.scrolls).toEqual(Array(stripCount).fill(320));
			expect(phase.nested).toEqual(Array(stripCount).fill(45));
		}
	});

	test.each([1920, 380])('paper covers the %ipx viewport while both real and copied pages retain the compiled width constraint', width => {
		const { main, capture } = mountPage(width);
		const page = main.firstElementChild!;
		// Positive control: the real compiled direct-child rule must be active.
		expect(getComputedStyle(page).maxWidth).toBe('1280px');
		const motion = capture();
		motion.play(125);
		const leaf = main.querySelector<HTMLElement>('[data-hy-page-leaf]')!;
		expect(leaf).not.toBeNull();
		expect(getComputedStyle(leaf).width).toBe(`${width}px`);
		expect(getComputedStyle(leaf).maxWidth).not.toBe('1280px');
		const strips = Array.from(leaf.querySelectorAll<HTMLElement>('.hy-paper-strip'));
		expect(strips.reduce((sum, strip) => sum + Number.parseFloat(strip.style.width), 0)).toBeCloseTo(width);
		for (const copy of leaf.querySelectorAll<HTMLElement>('.hy-paper-copy')) {
			expect(copy.classList.contains(classes.main)).toBe(true);
			expect(copy.style.width).toBe(`${width}px`);
			expect(copy.style.height).toBe('600px');
			expect(getComputedStyle(copy.firstElementChild!).maxWidth).toBe('1280px');
			expect(getComputedStyle(copy.firstElementChild!).getPropertyValue('margin-inline')).toBe('auto');
		}
		expect(leaf.inert).toBe(true);
		expect(leaf.getAttribute('aria-hidden')).toBe('true');
		expect(probes.every(probe => probe.options.duration === (width < 600 ? 760 : 840))).toBe(true);
	});

	test('the old viewport and nested scrolls survive pruning without changing the live page, input or focus', () => {
		const { main, capture } = mountPage();
		const nested = main.querySelector<HTMLElement>('[data-nested-scroll]')!;
		const inner = main.querySelector<HTMLElement>('[data-inner-scroll]')!;
		const input = main.querySelector<HTMLInputElement>('input')!;
		main.scrollTop = 320;
		nested.scrollTop = 45; nested.scrollLeft = 16;
		inner.scrollTop = 12;
		input.value = 'Unsaved title'; input.focus();
		const before = main.innerHTML;
		const motion = capture();
		expect(main.innerHTML).toBe(before);
		// Navigation has restored the destination viewport before the copy mounts.
		main.scrollTop = 25;
		motion.play(150);
		const leaf = main.querySelector<HTMLElement>('[data-hy-page-leaf]')!;
		expect(leaf.style.top).toBe('25px');
		for (const copy of leaf.querySelectorAll<HTMLElement>('.hy-paper-copy')) {
			expect(copy.scrollTop).toBe(320);
			expect(copy.style.top).toBe('0px');
			expect(copy.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollTop).toBe(45);
			expect(copy.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollLeft).toBe(16);
			expect(copy.querySelector<HTMLElement>('[data-inner-scroll]')!.scrollTop).toBe(12);
			for (const [name, height] of [['above', 90], ['below', 130]] as const) {
				const card = copy.querySelector<HTMLElement>(`[data-card="${name}"]`)!;
				expect(card.childElementCount).toBe(0);
				expect(card.style.height).toBe(`${height}px`);
				expect(card.style.minHeight).toBe(`${height}px`);
				expect(card.style.visibility).toBe('hidden');
			}
			expect(copy.querySelector('[data-card="visible"] input')).not.toBeNull();
			expect(copy.querySelector('[id],[name],[for],[data-hy-entrance],[data-hy-paper-scroll]')).toBeNull();
			expect(copy.querySelector('input')!.tabIndex).toBe(-1);
		}
		expect(window.document.activeElement).toBe(input);
		expect(input.value).toBe('Unsaved title');
		expect(main.querySelector('#old-offscreen')?.textContent).toBe('Above viewport');
		expect(nested.scrollTop).toBe(45);
		expect(main.scrollTop).toBe(25);
		motion.cancel();
		expect(main.innerHTML).toBe(before);
	});

	test.each([1, -1])('the shadow and both faces share the paper timeline in direction %i and finish together', async direction => {
		const { main, capture } = mountPage();
		capture(direction).play(777);
		const shadow = probes.find(probe => probe.node.classList.contains('hy-paper-shadow'))!;
		const front = probes.find(probe => probe.node.parentElement?.classList.contains('hy-paper-front'))!;
		const back = probes.find(probe => probe.node.parentElement?.classList.contains('hy-paper-back'))!;
		expect(shadow.node.style.transformOrigin).toBe(direction < 0 ? 'right center' : 'left center');
		expect(probes.every(probe => probe.animation.startTime === 777)).toBe(true);
		expect(Number(shadow.frames[0].opacity)).toBe(0);
		expect(Number(shadow.frames[16].opacity)).toBeCloseTo(0.32);
		expect(Number(shadow.frames.at(-1)!.opacity)).toBeCloseTo(0);
		expect(Number(back.frames[16].opacity)).toBeCloseTo(Number(front.frames[16].opacity) * 0.8);
		probes.filter(probe => probe !== shadow).forEach(probe => probe.finish());
		await Promise.resolve(); await Promise.resolve();
		expect(main.querySelector('[data-hy-page-leaf]')).not.toBeNull();
		shadow.finish();
		await vi.advanceTimersByTimeAsync(0);
		expect(main.querySelector('[data-hy-page-leaf]')).toBeNull();
		expect(probes.every(probe => vi.mocked(probe.animation.cancel).mock.calls.length > 0)).toBe(true);
	});

	test('cancel, reduced motion and the deadline remove only decorative layers, and canceled captures cannot replay', async () => {
		const { main, capture } = mountPage();
		const page = main.firstElementChild;
		const canceled = capture();
		canceled.play(0);
		canceled.cancel(); canceled.cancel(); canceled.play(0);
		expect(main.children).toHaveLength(1);
		expect(main.firstElementChild).toBe(page);
		const live = capture();
		live.play(0);
		reduced = true; media.dispatchEvent(new Event('change'));
		expect(main.querySelector('[data-hy-page-leaf]')).toBeNull();
		capture().play(0);
		expect(main.children).toHaveLength(1);
		reduced = false;
		const disabledBeforePlay = capture();
		prefer.r.animation.value = false;
		disabledBeforePlay.play(0);
		expect(main.children).toHaveLength(1);
		prefer.r.animation.value = true;
		capture().play(0);
		await vi.advanceTimersByTimeAsync(1099);
		expect(main.querySelector('[data-hy-page-leaf]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(1);
		expect(main.children).toHaveLength(1);
		expect(main.firstElementChild).toBe(page);
	});
});
