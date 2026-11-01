// @vitest-environment happy-dom
/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateHk3PostEntrance } from './hk3-post-entrance.js';

type Args = Parameters<typeof animateHk3PostEntrance>[0];
let now = 0;
let sequence = 0;
let reduced = false;
const frames = new Map<number, FrameRequestCallback>();
const cleanups: (() => void)[] = [];
const observers: ViewObserver[] = [];

class ViewObserver {
	observe = vi.fn();
	disconnect = vi.fn();
	constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
	resize() { this.callback([], this as unknown as ResizeObserver); }
}

function rect(left: number, top: number, width = 300, height = 120) {
	return new DOMRect(left, top, width, height);
}

function deferred() {
	let resolve!: () => void;
	let reject!: (reason: Error) => void;
	const finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { finished, resolve, reject, cancel: vi.fn() };
}

function fixture(top = 150, sourceTop = 500) {
	const viewport = window.document.createElement('div');
	const list = window.document.createElement('div');
	const target = window.document.createElement('article');
	const sibling = window.document.createElement('article');
	viewport.append(list);
	list.append(target, sibling);
	window.document.body.append(viewport);
	list.style.rowGap = '12px';
	list.style.setProperty('overflow-anchor', 'auto', 'important');
	target.style.paddingTop = '10px';
	target.style.paddingBottom = '14px';
	target.style.borderTopWidth = '2px';
	target.style.borderBottomWidth = '3px';
	target.style.marginTop = '4px';
	target.style.marginBottom = '8px';
	target.style.fontFamily = 'serif';
	target.style.fontSize = '17px';
	target.style.setProperty('--hk3-bg', '#faf7f4');
	target.style.setProperty('--hk3-text', '#221d19');
	target.style.setProperty('--hk3-divider', '#bdb7b1');
	target.style.color = '#221d19';
	target.inert = false;
	const state = { destination: rect(100, top), view: rect(50, 50, 600, 650) };
	const bounds = vi.fn(() => state.destination);
	vi.spyOn(target, 'getBoundingClientRect').mockImplementation(bounds);
	vi.spyOn(viewport, 'getBoundingClientRect').mockImplementation(() => state.view);
	const animations: ReturnType<typeof deferred>[] = [];
	const animate = vi.fn((_keyframes: Keyframe[], _options: KeyframeAnimationOptions) => {
		const animation = deferred();
		animations.push(animation);
		return animation as unknown as Animation;
	});
	Object.defineProperty(target, 'animate', { configurable: true, value: animate });
	const args: Args = {
		source: rect(160, sourceTop, 260, 80), target, viewport, motion: true,
		note: { text: 'A plain note', user: { name: 'Display name', username: 'author' } },
	};
	const run = (overrides: Partial<Args> = {}) => {
		const cancel = animateHk3PostEntrance({ ...args, ...overrides });
		cleanups.push(cancel);
		return cancel;
	};
	cleanups.push(() => viewport.remove());
	return { viewport, list, target, sibling, state, bounds, args, animate, animations, run };
}

function ghost() {
	return window.document.body.querySelector<HTMLElement>('[data-hk3-post-entrance-ghost]');
}

function step(time: number) {
	now = time;
	const callbacks = [...frames.values()];
	frames.clear();
	callbacks.forEach(callback => callback(time));
}

function expectRestored(view: ReturnType<typeof fixture>) {
	expect(view.target.isConnected).toBe(true);
	expect(view.target.inert).toBe(false);
	expect(view.target.style.opacity).toBe('');
	expect(view.target.style.height).toBe('');
	expect(view.target.style.paddingTop).toBe('10px');
	expect(view.target.style.paddingBottom).toBe('14px');
	expect(view.target.style.borderTopWidth).toBe('2px');
	expect(view.target.style.borderBottomWidth).toBe('3px');
	expect(view.target.style.marginBottom).toBe('8px');
	expect(view.list.style.getPropertyValue('overflow-anchor')).toBe('auto');
	expect(view.list.style.getPropertyPriority('overflow-anchor')).toBe('important');
	expect(ghost()).toBeNull();
	expect(frames.size).toBe(0);
	for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
	now = 0;
	sequence = 0;
	reduced = false;
	frames.clear();
	observers.length = 0;
	vi.spyOn(window.performance, 'now').mockImplementation(() => now);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
		frames.set(++sequence, callback);
		return sequence;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id); }));
	vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return reduced; } })));
	vi.stubGlobal('ResizeObserver', ViewObserver);
	vi.stubGlobal('innerWidth', 1024);
	vi.stubGlobal('innerHeight', 768);
	vi.stubGlobal('visualViewport', undefined);
	vi.spyOn(window.document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('animateHk3PostEntrance', () => {
	it.each([
		['up', 150, 500], ['down', 500, 100],
	] as const)('moves naturally %s while preserving the real note', (_direction, top, sourceTop) => {
		const view = fixture(top, sourceTop);
		view.target.innerHTML = '<button>real control</button><iframe></iframe><video></video>';
		const child = view.target.firstChild;
		view.run();
		const paper = ghost()!;
		expect(paper.parentElement).toBe(window.document.body);
		expect(paper.getAttribute('aria-hidden')).toBe('true');
		expect(paper.inert).toBe(true);
		expect(paper.style.pointerEvents).toBe('none');
		expect(paper.querySelector('button, a, iframe, video, audio, input')).toBeNull();
		expect(view.target.firstChild).toBe(child);
		expect(view.target.isConnected).toBe(true);
		expect(view.target.inert).toBe(true);
		expect(view.target.style.opacity).toBe('0');
		expect(paper.style.top).toBe(`${sourceTop}px`);
		step(200);
		const current = Number.parseFloat(paper.style.top);
		expect(current).toBeGreaterThan(Math.min(top, sourceTop));
		expect(current).toBeLessThan(Math.max(top, sourceTop));
		step(620);
		expect(paper.style.top).toBe(`${top}px`);
		expectRestored(view);
	});

	it.each([
		['light', '#faf7f4', '#221d19', '62%'],
		['light', '#faf7f4', '#221d19', '86%'],
		['dark', '#1c1a18', '#e6e1db', '62%'],
		['dark', '#1c1a18', '#e6e1db', '86%'],
	] as const)('carries the %s theme and %s / %s / %s density into rounded body glass', (scheme, background, foreground, alpha) => {
		const view = fixture();
		const properties = vi.spyOn(window.CSSStyleDeclaration.prototype, 'setProperty');
		// Happy DOM does not expose inherited custom properties in getComputedStyle.
		// Supply the resolved tokens a browser returns for the timeline row.
		view.target.style.setProperty('--hk3-bg', background);
		view.target.style.setProperty('--hk3-text', foreground);
		view.target.style.setProperty('--hk3-divider', foreground);
		view.target.style.setProperty('--hk3-glass-note-alpha', alpha);
		view.target.style.setProperty('color-scheme', scheme);
		view.target.style.color = foreground;
		view.target.style.borderRadius = '0px';
		view.run({ note: { text: 'Sharp text', user: { username: 'author', avatarUrl: '/avatar.png' } } });
		const paper = ghost()!;
		expect(paper.parentElement).toBe(window.document.body);
		expect(paper.style.getPropertyValue('--hk3-bg')).toBe(background);
		expect(paper.style.getPropertyValue('--hk3-text')).toBe(foreground);
		expect(paper.style.getPropertyValue('--hk3-divider')).toBe(foreground);
		expect(paper.style.getPropertyValue('--hk3-glass-note-alpha')).toBe(alpha);
		expect(paper.style.getPropertyValue('color-scheme')).toBe(scheme);
		expect(paper.style.color).toBe(window.getComputedStyle(view.target).color);
		// Happy DOM rejects color-mix; verify the overlay's declaration at the CSSOM boundary.
		const glassBackground = properties.mock.calls.find((args, index) =>
			properties.mock.contexts[index] === paper.style && args[0] === 'background-color' && args[1]?.startsWith('color-mix('));
		expect(glassBackground).toEqual(['background-color', `color-mix(in srgb, ${background} var(--hk3-glass-note-alpha, 62%), transparent)`]);
		expect(paper.style.getPropertyValue('-webkit-backdrop-filter')).toBe('blur(20px)');
		expect(paper.style.getPropertyValue('backdrop-filter')).toBe('blur(20px)');
		expect(paper.style.cssText.indexOf('-webkit-backdrop-filter:')).toBeLessThan(paper.style.cssText.indexOf(' backdrop-filter:'));
		expect(paper.style.borderRadius).toBe('16px');
		expect(paper.style.overflow).toBe('hidden');
		for (const element of [paper, ...paper.querySelectorAll<HTMLElement>('*')]) {
			expect(element.style.filter).toBe('');
			if (element !== paper) expect(element.style.getPropertyValue('backdrop-filter')).toBe('');
		}
		step(560);
		expect(paper.style.borderRadius).toBe('16px');
		expect(paper.style.opacity).toBe('0.5');
		expect(view.target.style.opacity).toBe('0.5');
		expect(view.target.style.borderRadius).toBe('0px');
		step(620);
		expect(view.target.style.borderRadius).toBe('0px');
		expectRestored(view);
	});

	it.each([null, undefined, ''] as const)('keeps empty or attachment-only bodies safe and completes the glass flight (%s)', text => {
		const view = fixture();
		view.target.innerHTML = '<img src="/attachment.png"><button>reaction</button>';
		const attachment = view.target.firstChild;
		view.run({ note: { text, user: { username: 'author' } } });
		const paper = ghost()!;
		expect(paper.querySelector('[data-hk3-post-entrance-text]')?.textContent).toBe('');
		expect(paper.style.borderRadius).toBe('16px');
		expect(paper.style.getPropertyValue('backdrop-filter')).toBe('blur(20px)');
		expect(view.target.firstChild).toBe(attachment);
		step(620);
		expect(view.target.firstChild).toBe(attachment);
		expectRestored(view);
	});

	it.each([null, undefined, 'Warning only', ''] as const)('uses only CW when present, including empty CW (%s)', cw => {
		const view = fixture();
		view.run({ note: { text: '<img src=x>private body', cw, user: { username: 'fallback' } } });
		const paper = ghost()!;
		expect(paper.querySelector('span')?.textContent).toBe('fallback');
		expect(paper.querySelector('[data-hk3-post-entrance-text]')?.textContent).toBe(cw != null ? cw : '<img src=x>private body');
		expect(paper.querySelector('img')).toBeNull();
		expect(paper.style.fontFamily).toBe('serif');
		expect(paper.style.fontSize).toBe('17px');
		expect(paper.style.getPropertyValue('--hk3-bg')).toBe('#faf7f4');
	});

	it('clamps long plain text and optionally adds only the avatar image', () => {
		const view = fixture();
		const text = '<script>not markup</script>\n'.repeat(100);
		view.run({ note: { text, user: { username: 'author', avatarUrl: '/avatar.png' } } });
		const paper = ghost()!;
		const content = paper.querySelector<HTMLElement>('[data-hk3-post-entrance-text]')!;
		expect(content.textContent).toBe(text);
		expect(content.style.getPropertyValue('-webkit-line-clamp')).toBe('5');
		expect(content.style.overflow).toBe('hidden');
		expect(paper.querySelectorAll('img')).toHaveLength(1);
		expect(paper.querySelector('img')?.getAttribute('src')).toBe('/avatar.png');
		expect(paper.querySelector('script, iframe, button, video')).toBeNull();
	});

	it('expands for 360ms, flies for 620ms and crossfades only in the last 120ms', async () => {
		const view = fixture();
		view.run();
		expect(view.animate).toHaveBeenCalledWith([
			expect.objectContaining({ height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginTop: '0px', marginBottom: '-12px' }),
			expect.objectContaining({ height: '120px', paddingTop: '10px', paddingBottom: '14px', borderTopWidth: '2px', borderBottomWidth: '3px', marginTop: '4px', marginBottom: '8px' }),
		], { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
		expect(view.target.style.height).toBe('0px');
		step(359);
		expect(view.target.style.height).toBe('0px');
		step(360);
		expect(view.target.style.height).toBe('');
		expect(view.animations[0].cancel).toHaveBeenCalledTimes(1);
		// A late WAAPI rejection caused by cancelling its fill cannot end the flight.
		view.animations[0].reject(new Error('cancelled fill'));
		await Promise.resolve();
		step(500);
		expect(ghost()?.style.opacity).toBe('1');
		expect(view.target.style.opacity).toBe('0');
		step(560);
		expect(ghost()?.style.opacity).toBe('0.5');
		expect(view.target.style.opacity).toBe('0.5');
		expect(view.target.inert).toBe(true);
		step(619);
		expect(ghost()).not.toBeNull();
		step(620);
		expectRestored(view);
	});

	it('tracks a moving destination every frame, keeping its original full height', () => {
		const view = fixture();
		view.run();
		const paper = ghost()!;
		view.state.destination = rect(80, 300, 320, 0);
		step(200);
		expect(view.bounds).toHaveBeenCalledTimes(2);
		expect(Number.parseFloat(paper.style.height)).toBeGreaterThan(80);
		view.state.destination = rect(90, 350, 340, 600);
		step(400);
		expect(view.bounds).toHaveBeenCalledTimes(3);
		expect(Number.parseFloat(paper.style.height)).toBeLessThan(120);
		step(620);
		expect(paper.style.left).toBe('90px');
		expect(paper.style.top).toBe('350px');
		expect(paper.style.width).toBe('340px');
		expect(paper.style.height).toBe('120px');
		expectRestored(view);
	});

	it('keeps flying through composer height changes while following the landing position', () => {
		const view = fixture();
		view.run();
		const paper = ghost()!;
		for (const [time, top, height] of [[80, 200, 700], [160, 240, 730], [220, 260, 750]]) {
			view.state.view = rect(50, 50, 600, height);
			view.state.destination = rect(100, top, 300, 0);
			observers[0].resize();
			step(time);
			expect(ghost()).toBe(paper);
			expect(view.target.inert).toBe(true);
			expect(view.animations[0].cancel).not.toHaveBeenCalled();
		}
		view.state.destination = rect(100, 260);
		step(620);
		expect(paper.style.top).toBe('260px');
		expect(paper.style.height).toBe('120px');
		expectRestored(view);
	});

	it('cancel restores property priorities and inert without reverting unrelated reactive CSS', () => {
		const view = fixture();
		view.target.style.setProperty('height', '120px', 'important');
		view.target.style.setProperty('opacity', '0.8', 'important');
		view.target.style.setProperty('padding-top', '10px', 'important');
		view.target.style.setProperty('transition', 'color 1s', 'important');
		view.target.inert = true;
		view.target.setAttribute('inert', 'saved');
		const cancel = view.run();
		view.target.style.color = 'red';
		view.target.style.setProperty('--reactive-token', 'updated');
		cancel();
		cancel();
		expect(view.target.style.height).toBe('120px');
		expect(view.target.style.opacity).toBe('0.8');
		for (const property of ['height', 'opacity', 'padding-top', 'transition']) expect(view.target.style.getPropertyPriority(property)).toBe('important');
		expect(view.target.style.transition).toBe('color 1s');
		expect(view.target.style.color).toBe('red');
		expect(view.target.style.getPropertyValue('--reactive-token')).toBe('updated');
		expect(view.target.inert).toBe(true);
		expect(view.target.getAttribute('inert')).toBe('saved');
		expect(view.animations[0].cancel).toHaveBeenCalledTimes(1);
		expect(frames.size).toBe(0);
		expect(ghost()).toBeNull();
	});

	it('restores independent overflow and transition properties with their priorities', () => {
		const view = fixture();
		view.target.style.setProperty('overflow-x', 'clip', 'important');
		view.target.style.setProperty('overflow-y', 'scroll');
		view.target.style.setProperty('transition-property', 'color', 'important');
		view.target.style.setProperty('transition-duration', '2s');
		view.target.style.setProperty('transition-delay', '30ms', 'important');
		const cancel = view.run();
		view.target.style.setProperty('transition-duration', '3s');
		cancel();
		expect(view.target.style.getPropertyValue('overflow-x')).toBe('clip');
		expect(view.target.style.getPropertyPriority('overflow-x')).toBe('important');
		expect(view.target.style.getPropertyValue('overflow-y')).toBe('scroll');
		expect(view.target.style.getPropertyPriority('overflow-y')).toBe('');
		expect(view.target.style.getPropertyValue('transition-property')).toBe('color');
		expect(view.target.style.getPropertyPriority('transition-property')).toBe('important');
		expect(view.target.style.getPropertyValue('transition-duration')).toBe('3s');
		expect(view.target.style.getPropertyValue('transition-delay')).toBe('30ms');
		expect(view.target.style.getPropertyPriority('transition-delay')).toBe('important');
		expectRestored(view);
	});

	it.each(['motion', 'reduced', 'WAAPI', 'RAF', 'cancelRAF', 'zero source', 'small source', 'offscreen source', 'zero target', 'offscreen target', 'too tall', 'NaN', 'hidden target', 'hidden ancestor', 'hidden page', 'viewport offscreen'] as const)(
		'leaves the real note completely untouched for fallback: %s', reason => {
			const view = fixture();
			if (reason === 'motion') view.args.motion = false;
			if (reason === 'reduced') reduced = true;
			if (reason === 'WAAPI') Object.defineProperty(view.target, 'animate', { value: undefined });
			if (reason === 'RAF') vi.stubGlobal('requestAnimationFrame', undefined);
			if (reason === 'cancelRAF') vi.stubGlobal('cancelAnimationFrame', undefined);
			if (reason === 'zero source') view.args.source = rect(160, 500, 0, 80);
			if (reason === 'small source') view.args.source = rect(160, 500, 10, 10);
			if (reason === 'offscreen source') view.args.source = rect(1200, 500);
			if (reason === 'zero target') view.state.destination = rect(100, 150, 300, 0);
			if (reason === 'offscreen target') view.state.destination = rect(100, 800);
			if (reason === 'too tall') view.state.destination = rect(100, 50, 300, 660);
			if (reason === 'NaN') view.args.source = rect(Number.NaN, 500);
			if (reason === 'hidden target') view.target.style.visibility = 'hidden';
			if (reason === 'hidden ancestor') view.viewport.style.opacity = '0';
			if (reason === 'hidden page') vi.spyOn(window.document, 'visibilityState', 'get').mockReturnValue('hidden');
			if (reason === 'viewport offscreen') view.state.view = rect(1200, 50, 600, 650);
			const before = view.target.getAttribute('style');
			view.run()();
			expect(view.target.getAttribute('style')).toBe(before);
			expect(view.target.inert).toBe(false);
			expect(view.animate).not.toHaveBeenCalled();
			expect(ghost()).toBeNull();
			expect(frames.size).toBe(0);
			expect(observers).toHaveLength(0);
			expect(view.list.style.getPropertyValue('overflow-anchor')).toBe('auto');
		});

	it.each(['scroll', 'wheel', 'touchmove', 'window resize', 'visibility', 'target unmount', 'viewport unmount', 'observer resize'] as const)(
		'restores immediately on %s', reason => {
			const view = fixture();
			view.run();
			if (reason === 'scroll') view.viewport.dispatchEvent(new Event('scroll'));
			if (reason === 'wheel' || reason === 'touchmove') view.viewport.dispatchEvent(new Event(reason, { bubbles: true }));
			if (reason === 'window resize') window.dispatchEvent(new Event('resize'));
			if (reason === 'visibility') {
				vi.spyOn(window.document, 'visibilityState', 'get').mockReturnValue('hidden');
				window.document.dispatchEvent(new Event('visibilitychange'));
			}
			if (reason === 'target unmount') { view.target.remove(); step(16); view.list.prepend(view.target); }
			if (reason === 'viewport unmount') { view.viewport.remove(); step(16); window.document.body.append(view.viewport); }
			if (reason === 'observer resize') { view.state.view = rect(50, 50, 500, 650); observers[0].resize(); }
			expectRestored(view);
			expect(view.animations[0].cancel).toHaveBeenCalledTimes(1);
		});

	it.each(['resize', 'scroll'] as const)('cancels on visualViewport %s and respects its visible height before starting', event => {
		const visual = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 100, width: 1024, height: 300 });
		vi.stubGlobal('visualViewport', visual);
		const view = fixture();
		view.run({ source: rect(160, 300, 260, 80) });
		expect(ghost()).not.toBeNull();
		visual.dispatchEvent(new Event(event));
		expectRestored(view);
		visual.height = 80;
		view.run();
		expect(view.animate).toHaveBeenCalledTimes(1);
		expect(ghost()).toBeNull();
	});

	it('ignores the initial observer notification and removes every listener on cancel', () => {
		const windowRemove = vi.spyOn(window, 'removeEventListener');
		const documentRemove = vi.spyOn(window.document, 'removeEventListener');
		const view = fixture();
		const cancel = view.run();
		expect(observers[0].observe).toHaveBeenCalledWith(view.viewport);
		observers[0].resize();
		expect(ghost()).not.toBeNull();
		cancel();
		for (const event of ['resize', 'scroll', 'wheel', 'touchmove']) expect(windowRemove).toHaveBeenCalledWith(event, expect.any(Function), event !== 'resize');
		expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function), false);
		expectRestored(view);
	});

	it.each(['animate throw', 'animate reject', 'initial RAF throw', 'later RAF throw', 'bounds throw'] as const)(
		'restores all resources on %s', async reason => {
			const view = fixture();
			if (reason === 'animate throw') view.animate.mockImplementationOnce(() => { throw new Error('WAAPI failure'); });
			if (reason === 'initial RAF throw') vi.stubGlobal('requestAnimationFrame', () => { throw new Error('RAF failure'); });
			view.run();
			if (reason === 'animate reject') { view.animations[0].reject(new Error('WAAPI rejected')); await Promise.resolve(); }
			if (reason === 'later RAF throw') { vi.stubGlobal('requestAnimationFrame', () => { throw new Error('RAF failure'); }); step(16); }
			if (reason === 'bounds throw') { view.bounds.mockImplementationOnce(() => { throw new Error('layout failure'); }); step(16); }
			expectRestored(view);
		});

	it('replaces an earlier flight for the same target without stale cancel or completion affecting the new flight', async () => {
		const view = fixture();
		const oldCancel = view.run();
		const newCancel = view.run();
		expect(view.animate).toHaveBeenCalledTimes(2);
		expect(view.animations[0].cancel).toHaveBeenCalledTimes(1);
		expect(window.document.querySelectorAll('[data-hk3-post-entrance-ghost]')).toHaveLength(1);
		oldCancel();
		view.animations[0].resolve();
		await Promise.resolve();
		expect(view.target.style.opacity).toBe('0');
		expect(frames.size).toBe(1);
		expect(view.list.style.getPropertyValue('overflow-anchor')).toBe('none');
		newCancel();
		expectRestored(view);
	});

	it('keeps shared list anchoring disabled until every concurrent flight ends', () => {
		const view = fixture();
		const other = window.document.createElement('article');
		view.list.append(other);
		vi.spyOn(other, 'getBoundingClientRect').mockReturnValue(rect(100, 350));
		const animation = deferred();
		Object.defineProperty(other, 'animate', { value: vi.fn(() => animation as unknown as Animation) });
		const firstCancel = view.run();
		const secondCancel = view.run({ target: other });
		firstCancel();
		expect(view.list.style.getPropertyValue('overflow-anchor')).toBe('none');
		expect(window.document.querySelectorAll('[data-hk3-post-entrance-ghost]')).toHaveLength(1);
		secondCancel();
		expectRestored(view);
		expect(animation.cancel).toHaveBeenCalledTimes(1);
	});

	it('does not compensate for a gap when there is no other row', () => {
		const view = fixture();
		view.sibling.remove();
		view.run();
		expect(view.animate.mock.calls[0][0]).toEqual([
			expect.objectContaining({ marginBottom: '0px' }), expect.objectContaining({ marginBottom: '8px' }),
		]);
	});
});
