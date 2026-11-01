/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createHatadyListEntrance } from './hatady-list-motion.js';
import { prefer } from '@/preferences.js';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true) } } };
});

type RecordedAnimation = {
	target: HTMLElement;
	frames: Keyframe[];
	options: KeyframeAnimationOptions;
	animation: Animation;
	finish: () => void;
};

const cleanups: Array<() => void> = [];
let recorded: RecordedAnimation[];
let reduced: boolean;
let hidden: boolean;
let motionEvent: EventTarget;
let animateDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
	recorded = [];
	reduced = false;
	hidden = false;
	prefer.r.animation.value = true;
	motionEvent = new EventTarget();
	Object.defineProperty(motionEvent, 'matches', { get: () => reduced });
	vi.spyOn(window, 'matchMedia').mockReturnValue(motionEvent as MediaQueryList);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	animateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
	Object.defineProperty(HTMLElement.prototype, 'animate', {
		configurable: true,
		writable: true,
		value: vi.fn(function (this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
			let resolve!: () => void;
			let reject!: (error: Error) => void;
			const finished = new Promise<void>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
			const animation = { startTime: null, finished, cancel: vi.fn(() => reject(new DOMException('Canceled', 'AbortError'))) } as unknown as Animation;
			recorded.push({ target: this, frames, options, animation, finish: resolve });
			return animation;
		}),
	});
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	if (animateDescriptor) Object.defineProperty(HTMLElement.prototype, 'animate', animateDescriptor);
	else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
	vi.restoreAllMocks();
});

function mount() {
	const container = window.document.createElement('section');
	window.document.body.append(container);
	const motion = createHatadyListEntrance(container);
	cleanups.push(() => { motion.cancel(); container.remove(); });
	return { container, motion };
}

function append(container: HTMLElement, kind: string): HTMLElement {
	const node = window.document.createElement('article');
	node.dataset.hyEntrance = kind;
	const button = window.document.createElement('button');
	button.textContent = '記録をひらく';
	node.append(button);
	container.append(node);
	return node;
}

async function settle(): Promise<void> {
	for (let index = 0; index < 5; index++) await Promise.resolve();
}

describe('Hatady category list entrances', () => {
	test('finishes measuring every card before writing animation styles or inserting flair', () => {
		const { container, motion } = mount();
		const nodes = ['movie', 'game', 'work'].map(kind => append(container, kind));
		const measured: { node: Element; active: number; flair: number }[] = [];
		const getStyle = window.getComputedStyle.bind(window);
		vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => {
			measured.push({ node, active: container.querySelectorAll('[data-hy-list-motion]').length, flair: container.querySelectorAll('.hy-list-flair').length });
			return getStyle(node, pseudo);
		});
		motion.play(500);
		expect(measured.map(item => item.node)).toEqual(nodes);
		expect(measured.map(item => [item.active, item.flair])).toEqual([[0, 0], [0, 0], [0, 0]]);
		expect(recorded).toHaveLength(6);
		expect(recorded.every(item => item.animation.startTime === 500)).toBe(true);
	});

	test('animates only visible cards while keeping offscreen content and later async arrivals intact', () => {
		const { container, motion } = mount();
		vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 700, height: 600 } as DOMRect);
		const visible = [append(container, 'movie'), append(container, 'game')];
		const outside = Array.from({ length: 40 }, () => append(container, 'movie'));
		const setRect = (node: HTMLElement, top: number, height: number) => vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + height, height } as DOMRect);
		setRect(visible[0], 120, 140);
		setRect(visible[1], 680, 140);
		const above = setRect(outside[0], 0, 100);
		outside.slice(1).forEach((node, index) => setRect(node, 700 + index * 140, 140));
		motion.play(250);
		expect(recorded.filter(item => !item.target.classList.contains('hy-list-flair')).map(item => item.target)).toEqual(visible);
		expect(recorded).toHaveLength(4);
		expect(container.querySelectorAll('button')).toHaveLength(42);
		expect(outside.every(node => !node.hasAttribute('data-hy-list-motion') && !node.querySelector('.hy-list-flair'))).toBe(true);
		// Scrolling into a card must not restart an entrance from this tab visit.
		above.mockReturnValue({ top: 150, bottom: 250, height: 100 } as DOMRect);
		motion.play(300);
		expect(recorded).toHaveLength(4);
		const arrived = append(container, 'work');
		setRect(arrived, 200, 100);
		motion.play(350);
		expect(recorded.filter(item => item.target === arrived)).toHaveLength(1);
		expect(recorded).toHaveLength(6);
	});

	test('keeps the approved category timings, DOM stagger, shared clock and three trailing effects', () => {
		const { container, motion } = mount();
		const kinds = ['study', 'book', 'movie', 'game', 'exercise', 'work', 'study', 'work'];
		const nodes = kinds.map(kind => append(container, kind));
		nodes.forEach((node, index) => vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ top: 100 - index * 10, left: 0 } as DOMRect));
		motion.play(1234);
		const entrances = recorded.filter(item => nodes.includes(item.target));
		expect(entrances.map(item => item.target)).toEqual(nodes);
		expect(entrances.map(item => item.options.duration)).toEqual([520, 520, 620, 550, 600, 620, 520, 620]);
		expect(entrances.map(item => item.options.delay)).toEqual([0, 55, 110, 165, 220, 275, 330, 330]);
		expect(entrances[0].frames[0].transform).toBe('translateY(24px) rotate(-16deg)');
		expect(entrances[4].frames.map(frame => frame.offset)).toEqual([0, 0.45, 0.72, 1]);
		for (const item of recorded) {
			expect(item.animation.startTime).toBe(1234);
			expect(item.options.fill).toBe('both');
		}
		const flairs = recorded.filter(item => item.target.className === 'hy-list-flair');
		expect(flairs.map(item => [item.target.dataset.kind, item.options.duration, item.options.delay])).toEqual([
			['movie', 950, 110], ['game', 800, 165], ['work', 800, 275], ['work', 800, 330],
		]);
		for (const item of flairs) {
			expect(item.target.getAttribute('aria-hidden')).toBe('true');
			expect(item.options.easing).toBe('ease-out');
		}
		expect(container.querySelectorAll('button')).toHaveLength(nodes.length);
	});

	test('home entrances follow visual rows and columns rather than responsive grid DOM order', () => {
		const { container, motion } = mount();
		const nodes = [append(container, 'home'), append(container, 'home'), append(container, 'home')];
		const positions = [{ top: 100, left: 0 }, { top: 0, left: 200 }, { top: 1, left: 0 }];
		nodes.forEach((node, index) => vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(positions[index] as DOMRect));
		motion.play(0);
		expect(recorded.map(item => item.target)).toEqual([nodes[2], nodes[1], nodes[0]]);
		expect(recorded.map(item => item.options.delay)).toEqual([0, 65, 130]);
		expect(recorded.map(item => item.options.duration)).toEqual([460, 460, 460]);
		expect(recorded.every(item => item.animation.startTime === 0)).toBe(true);
	});

	test('async arrivals animate once per DOM node without replaying existing or moved cards', async () => {
		const { container, motion } = mount();
		motion.play();
		const first = append(container, 'study');
		motion.play();
		motion.play();
		expect(recorded).toHaveLength(1);
		recorded[0].finish();
		await settle();
		const next = append(container, 'game');
		container.append(first);
		motion.play(5678);
		expect(recorded.filter(item => item.target === first)).toHaveLength(1);
		expect(recorded.filter(item => item.target === next)).toHaveLength(1);
		first.remove();
		const replacement = append(container, 'study');
		motion.play();
		expect(recorded.filter(item => item.target === replacement)).toHaveLength(1);
	});

	test('waits for the trailing effect and restores pre-existing transforms, opacity and origin', async () => {
		const { container, motion } = mount();
		const node = append(container, 'movie');
		node.style.transform = 'translateX(5px)';
		node.style.opacity = '0.7';
		node.style.setProperty('transform-origin', 'top right', 'important');
		const originalTransform = window.getComputedStyle(node).transform;
		motion.play();
		expect(recorded[0].frames.at(-1)).toMatchObject({ transform: originalTransform, opacity: 0.7 });
		recorded[0].finish();
		await settle();
		expect(node.querySelector('.hy-list-flair')).not.toBeNull();
		recorded[1].finish();
		await settle();
		expect(node.querySelector('.hy-list-flair')).toBeNull();
		expect(node.hasAttribute('data-hy-list-motion')).toBe(false);
		expect(node.style.transform).toBe('translateX(5px)');
		expect(node.style.opacity).toBe('0.7');
		expect(node.style.getPropertyValue('transform-origin')).toBe('top right');
		expect(node.style.getPropertyPriority('transform-origin')).toBe('important');
		for (const item of recorded) expect(item.animation.cancel).toHaveBeenCalledOnce();
	});

	test('cancel removes animation, decoration and temporary styles and ends the controller', async () => {
		const { container, motion } = mount();
		const node = append(container, 'work');
		motion.play();
		motion.cancel();
		motion.cancel();
		await settle();
		expect(node.querySelector('.hy-list-flair')).toBeNull();
		expect(node.hasAttribute('data-hy-list-motion')).toBe(false);
		expect(node.style.getPropertyValue('transform-origin')).toBe('');
		expect(node.style.transform).toBe('');
		for (const item of recorded) expect(item.animation.cancel).toHaveBeenCalledOnce();
		append(container, 'movie');
		motion.play();
		expect(recorded).toHaveLength(2);
	});

	test('finish settles the current cards but keeps unseen async arrivals eligible until cancel', async () => {
		const { container, motion } = mount();
		const original = append(container, 'movie');
		motion.play(100);
		motion.finish();
		await settle();
		expect(original.querySelector('.hy-list-flair')).toBeNull();
		expect(original.hasAttribute('data-hy-list-motion')).toBe(false);
		expect(original.style.getPropertyValue('transform-origin')).toBe('');
		for (const item of recorded) expect(item.animation.cancel).toHaveBeenCalledOnce();
		const arrived = append(container, 'game');
		motion.play(200);
		expect(recorded.filter(item => item.target === original)).toHaveLength(1);
		expect(recorded.filter(item => item.target === arrived)).toHaveLength(1);
		expect(arrived.querySelector('.hy-list-flair')).not.toBeNull();
		expect(recorded.at(-1)?.animation.startTime).toBe(200);
		motion.cancel();
		await settle();
		expect(container.querySelector('.hy-list-flair')).toBeNull();
		append(container, 'work');
		motion.play();
		expect(recorded).toHaveLength(4);
	});

	test.each(['app', 'OS', 'hidden'])('%s motion gate suppresses entrances and cancels an already running effect', async gate => {
		const { container, motion } = mount();
		const toggle = (disabled: boolean) => {
			if (gate === 'app') prefer.r.animation.value = !disabled;
			if (gate === 'OS') { reduced = disabled; motionEvent.dispatchEvent(new Event('change')); }
			if (gate === 'hidden') { hidden = disabled; window.document.dispatchEvent(new Event('visibilitychange')); }
		};
		toggle(true);
		const previous = append(container, 'movie');
		motion.play();
		expect(recorded).toHaveLength(0);
		toggle(false);
		const next = append(container, 'game');
		motion.play();
		expect(recorded.filter(item => item.target === next)).toHaveLength(1);
		expect(recorded.filter(item => item.target === previous)).toHaveLength(0);
		toggle(true);
		await settle();
		expect(container.querySelector('.hy-list-flair')).toBeNull();
		expect(container.querySelector('[data-hy-list-motion]')).toBeNull();
		for (const item of recorded) expect(item.animation.cancel).toHaveBeenCalledOnce();
	});

	test('does not target decorative paper copies, hidden or inert content or unknown kinds', () => {
		const { container, motion } = mount();
		for (const attribute of ['inert', 'hidden', 'aria-hidden']) {
			const wrapper = window.document.createElement('section');
			wrapper.setAttribute(attribute, 'true');
			container.append(wrapper);
			append(wrapper, 'book');
		}
		const paper = window.document.createElement('div');
		paper.className = 'hy-page-leaf';
		container.append(paper);
		append(paper, 'book');
		append(container, 'unknown');
		const live = append(container, 'book');
		motion.play();
		expect(recorded.map(item => item.target)).toEqual([live]);
	});

	test('an animation failure restores the card and does not block later cards', () => {
		const { container, motion } = mount();
		const failed = append(container, 'movie');
		const next = append(container, 'book');
		Object.defineProperty(failed, 'animate', { value: () => { throw new Error('animation unavailable'); } });
		motion.play();
		expect(failed.hasAttribute('data-hy-list-motion')).toBe(false);
		expect(failed.style.getPropertyValue('transform-origin')).toBe('');
		expect(recorded.map(item => item.target)).toEqual([next]);
	});
});
