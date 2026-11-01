/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHk3ComposerScroll } from './hk3-composer-scroll.js';

const cleanups: (() => void)[] = [];

function fixture(initialTop = 0) {
	const root = window.document.createElement('div');
	const viewport = window.document.createElement('div');
	const composer = window.document.createElement('form');
	const input = window.document.createElement('textarea');
	composer.append(input);
	root.append(viewport, composer);
	window.document.body.append(root);
	viewport.scrollTop = initialTop;
	let blocked = false;
	const controller = createHk3ComposerScroll({ viewport: () => viewport, composer: () => composer, blocked: () => blocked });
	controller.start();
	cleanups.push(() => { controller.dispose(); root.remove(); });
	const moveScroll = (delta: number) => {
		viewport.scrollTop += delta;
		viewport.dispatchEvent(new Event('scroll'));
	};
	const wheel = (deltaY = 24, deltaX = 0) => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaX, bubbles: true }));
	const sustained = (withWheel = true) => {
		for (let index = 0; index < 3; index++) {
			if (index > 0) vi.advanceTimersByTime(60);
			if (withWheel) wheel();
			moveScroll(24);
		}
	};
	return { viewport, composer, input, controller, moveScroll, wheel, sustained, setBlocked: (value: boolean) => { blocked = value; } };
}

function touch(target: HTMLElement, type: string, x: number, y: number) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ identifier: 1, clientX: x, clientY: y }] });
	target.dispatchEvent(event);
}

function pointer(target: HTMLElement, type: string, x = 195, y = 50) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperties(event, {
		button: { value: 0 }, pointerType: { value: 'mouse' }, clientX: { value: x }, clientY: { value: y },
	});
	target.dispatchEvent(event);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(1000);
	vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('HK3 composer user scroll visibility', () => {
	it('hides only after wheel scrolling lasts 120ms and accumulates 48px', () => {
		const { controller, wheel, moveScroll } = fixture();
		wheel(); moveScroll(24);
		vi.advanceTimersByTime(60);
		wheel(); moveScroll(24);
		expect(controller.hidden.value).toBe(false);
		vi.advanceTimersByTime(60);
		wheel(); moveScroll(1);
		expect(controller.hidden.value).toBe(true);
	});

	it('does not hide for one scroll, even when the delta is large or input is old', () => {
		const { controller, wheel, moveScroll } = fixture();
		wheel();
		vi.advanceTimersByTime(130);
		moveScroll(100);
		expect(controller.hidden.value).toBe(false);
		vi.advanceTimersByTime(200);
		expect(controller.hidden.value).toBe(false);
	});

	it('does not hide for a long sequence of tiny movements under 48px', () => {
		const { controller, wheel, moveScroll } = fixture();
		for (let index = 0; index < 5; index++) {
			wheel(); moveScroll(5);
			vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
	});

	it('stays hidden during momentum, then shows exactly 200ms after the last actual scroll', () => {
		const { controller, wheel, moveScroll, sustained } = fixture();
		wheel(); sustained(false);
		expect(controller.hidden.value).toBe(true);
		vi.advanceTimersByTime(199);
		moveScroll(10);
		vi.advanceTimersByTime(199);
		expect(controller.hidden.value).toBe(true);
		vi.advanceTimersByTime(1);
		expect(controller.hidden.value).toBe(false);
		// A new single movement cannot inherit the previous duration/distance.
		wheel(); moveScroll(1);
		expect(controller.hidden.value).toBe(false);
	});

	it('does not extend hidden time with input that produces no scroll at a boundary', () => {
		const { controller, wheel, sustained } = fixture();
		sustained();
		vi.advanceTimersByTime(190);
		wheel();
		vi.advanceTimersByTime(10);
		expect(controller.hidden.value).toBe(false);
	});

	it('does not count opposite direction changes or unchanged scrollTop after wheel input', () => {
		const { controller, wheel, moveScroll } = fixture(500);
		for (let index = 0; index < 3; index++) {
			wheel(); moveScroll(-24); moveScroll(0);
			vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
	});

	it('ignores programmatic scroll, insertion and resize without user intent, updating its baseline', () => {
		const { viewport, controller, moveScroll, wheel, sustained } = fixture(500);
		sustained(false);
		viewport.append(window.document.createElement('div'));
		moveScroll(100);
		window.dispatchEvent(new Event('resize'));
		expect(controller.hidden.value).toBe(false);
		wheel(); moveScroll(1);
		vi.advanceTimersByTime(120);
		wheel(); moveScroll(1);
		expect(controller.hidden.value).toBe(false);
	});

	it('expires input without actual movement and ignores repeated scroll events at the top', () => {
		const { controller, moveScroll, wheel, sustained } = fixture();
		for (let index = 0; index < 4; index++) {
			wheel(-100); moveScroll(0); vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
		wheel();
		vi.advanceTimersByTime(201);
		sustained(false);
		expect(controller.hidden.value).toBe(false);
	});

	it('clears a pending gesture when resize occurs', () => {
		const { controller, wheel, moveScroll, sustained } = fixture();
		wheel(); moveScroll(24);
		window.dispatchEvent(new Event('resize'));
		sustained(false);
		expect(controller.hidden.value).toBe(false);
		sustained();
		expect(controller.hidden.value).toBe(true);
		window.dispatchEvent(new Event('resize'));
		expect(controller.hidden.value).toBe(false);
	});

	it('shows immediately on composer focusin and stays visible while focus is inside', () => {
		const { input, controller, sustained } = fixture();
		sustained();
		expect(controller.hidden.value).toBe(true);
		input.focus();
		expect(controller.hidden.value).toBe(false);
		sustained();
		expect(controller.hidden.value).toBe(false);
		input.blur();
		sustained();
		expect(controller.hidden.value).toBe(true);
	});

	it('never hides when blocked and resets immediately when the caller shows for busy state', () => {
		const { controller, sustained, setBlocked } = fixture();
		setBlocked(true); sustained();
		expect(controller.hidden.value).toBe(false);
		setBlocked(false); sustained();
		expect(controller.hidden.value).toBe(true);
		setBlocked(true); controller.show();
		expect(controller.hidden.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		setBlocked(false); sustained(false);
		expect(controller.hidden.value).toBe(false);
	});

	it('also checks blocking on actual scroll after user intent', () => {
		const { controller, sustained, moveScroll, setBlocked } = fixture();
		sustained();
		setBlocked(true); moveScroll(5);
		expect(controller.hidden.value).toBe(false);
	});

	it('ignores horizontal wheel and horizontal touch gestures even if scrollTop changes', () => {
		const { viewport, controller, moveScroll, wheel } = fixture();
		wheel(); moveScroll(24);
		for (let index = 0; index < 3; index++) {
			vi.advanceTimersByTime(60);
			wheel(1, 30); moveScroll(24);
		}
		expect(controller.hidden.value).toBe(false);
		touch(viewport, 'touchstart', 100, 100);
		for (let index = 0; index < 3; index++) {
			touch(viewport, 'touchmove', 70 - index * 30, 99 - index); moveScroll(24);
			vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
	});

	it('counts vertical touch movement and momentum after touchend', () => {
		const { viewport, controller, moveScroll } = fixture();
		touch(viewport, 'touchstart', 100, 100);
		touch(viewport, 'touchmove', 100, 70); moveScroll(24);
		vi.advanceTimersByTime(60);
		touch(viewport, 'touchmove', 100, 40); moveScroll(24);
		touch(viewport, 'touchend', 100, 40);
		vi.advanceTimersByTime(60); moveScroll(24);
		expect(controller.hidden.value).toBe(true);
		vi.advanceTimersByTime(200);
		expect(controller.hidden.value).toBe(false);
	});

	it.each(['PageDown', 'ArrowDown', 'End', ' ', 'PageUp', 'ArrowUp', 'Home'])('accepts %s only with actual scrolling', key => {
		const { controller, moveScroll } = fixture(500);
		const delta = ['PageUp', 'ArrowUp', 'Home'].includes(key) ? -24 : 24;
		for (let index = 0; index < 3; index++) {
			if (index > 0) vi.advanceTimersByTime(60);
			window.document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			moveScroll(delta);
		}
		expect(controller.hidden.value).toBe(true);
	});

	it('accepts Shift+Space for upward scrolling and ignores keys without actual scroll', () => {
		const { controller, moveScroll } = fixture(500);
		for (let index = 0; index < 3; index++) {
			window.document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
			vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
		for (let index = 0; index < 3; index++) {
			window.document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: true, bubbles: true }));
			moveScroll(-24);
			if (index < 2) vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(true);
	});

	it.each(['textarea', 'input', 'select', 'button', 'div'])('excludes scrolling keys from form/editor element %s', tag => {
		const { viewport, controller, moveScroll } = fixture();
		const field = window.document.createElement(tag);
		if (tag === 'div') field.setAttribute('contenteditable', 'true');
		viewport.append(field);
		for (let index = 0; index < 3; index++) {
			field.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
			moveScroll(24); vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
	});

	it('accepts only scrollbar pointerdown, including a drag held longer than the input window', () => {
		const { viewport, controller, moveScroll } = fixture();
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 200, top: 0, bottom: 300, width: 200, height: 300, x: 0, y: 0, toJSON: () => ({}) });
		Object.defineProperties(viewport, { clientWidth: { value: 180 }, clientHeight: { value: 300 } });
		pointer(viewport, 'pointerdown', 50);
		moveScroll(24); vi.advanceTimersByTime(120); moveScroll(24);
		expect(controller.hidden.value).toBe(false);
		pointer(viewport, 'pointerdown');
		vi.advanceTimersByTime(300);
		moveScroll(24); vi.advanceTimersByTime(120); moveScroll(24);
		expect(controller.hidden.value).toBe(true);
		vi.advanceTimersByTime(200);
		expect(controller.hidden.value).toBe(false);
		moveScroll(24); vi.advanceTimersByTime(120); moveScroll(24);
		expect(controller.hidden.value).toBe(true);
		pointer(window.document.body, 'pointerup');
		vi.advanceTimersByTime(200);
		moveScroll(24); vi.advanceTimersByTime(120); moveScroll(24);
		expect(controller.hidden.value).toBe(false);
	});

	it('supports a missing viewport at mount and rebinds with the new initial scrollTop', () => {
		const { viewport, composer } = fixture();
		let target: HTMLElement | null = null;
		const controller = createHk3ComposerScroll({ viewport: () => target, composer: () => composer, blocked: () => false });
		cleanups.push(controller.dispose);
		controller.start();
		target = window.document.createElement('div');
		viewport.append(target);
		target.scrollTop = 800;
		controller.start();
		const old = target;
		const removed = vi.spyOn(old, 'removeEventListener');
		target = window.document.createElement('div');
		viewport.append(target);
		target.scrollTop = 500;
		controller.start();
		expect(removed).toHaveBeenCalledWith('scroll', expect.any(Function), expect.any(Object));
		for (let index = 0; index < 3; index++) {
			target.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
			target.scrollTop += 1;
			target.dispatchEvent(new Event('scroll'));
			vi.advanceTimersByTime(60);
		}
		expect(controller.hidden.value).toBe(false);
		target = null;
		controller.start();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('shows and resets intent when the document becomes hidden', () => {
		const { controller, sustained } = fixture();
		sustained();
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(controller.hidden.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		sustained();
		expect(controller.hidden.value).toBe(false);
		vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		sustained(false);
		expect(controller.hidden.value).toBe(false);
	});

	it('starts once and removes every listener and pending timer on dispose', () => {
		const { viewport, controller, sustained } = fixture();
		const added = vi.spyOn(viewport, 'addEventListener');
		controller.start();
		expect(added).not.toHaveBeenCalled();
		const removed = vi.spyOn(viewport, 'removeEventListener');
		const removedDocument = vi.spyOn(window.document, 'removeEventListener');
		const removedWindow = vi.spyOn(window, 'removeEventListener');
		sustained();
		controller.dispose(); controller.dispose(); controller.start();
		expect(controller.hidden.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		for (const name of ['scroll', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown']) {
			expect(removed).toHaveBeenCalledWith(name, expect.any(Function), expect.any(Object));
		}
		for (const name of ['pointerup', 'pointercancel', 'keydown', 'focusin', 'visibilitychange']) {
			expect(removedDocument).toHaveBeenCalledWith(name, expect.any(Function), expect.any(Object));
		}
		for (const name of ['resize', 'blur']) expect(removedWindow).toHaveBeenCalledWith(name, expect.any(Function), expect.any(Object));
		sustained();
		expect(controller.hidden.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});
