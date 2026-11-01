/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blocksTimelineTabGesture, createTimelineTabGestures } from './timeline-tab-gestures.js';

function point(x: number, y = 0, identifier = 1) { return { clientX: x, clientY: y, identifier } as Touch; }
function touch(target: EventTarget, points: Touch[], changed = points) {
	return { target, touches: points, changedTouches: changed, cancelable: true, preventDefault: vi.fn() } as unknown as TouchEvent;
}
function wheel(target: EventTarget, deltaX: number, deltaY = 0) {
	return { target, deltaX, deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, cancelable: true, preventDefault: vi.fn() } as unknown as WheelEvent;
}
const controllers: ReturnType<typeof createTimelineTabGestures>[] = [];
function fixture() {
	const root = document.createElement('div'); document.body.append(root);
	let enabled = true;
	let index = 1;
	const moves = vi.fn((direction: number) => { index += direction; });
	const gestures = createTimelineTabGestures({ enabled: () => enabled, root: () => root, canMove: direction => index + direction >= 0 && index + direction <= 2, move: moves });
	controllers.push(gestures);
	return { root, gestures, moves, enable: (value: boolean) => { enabled = value; }, index: () => index };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { controllers.splice(0).forEach(item => item.destroy()); document.body.replaceChildren(); vi.useRealTimers(); });

describe('timeline tab gestures', () => {
	it('moves once for horizontal touch and ignores short or vertical gestures', () => {
		const { root, gestures, moves } = fixture();
		gestures.touchStart(touch(root, [point(100)]));
		const move = touch(root, [point(20)]); gestures.touchMove(move);
		expect(move.preventDefault).toHaveBeenCalledOnce();
		gestures.touchEnd(touch(root, [], [point(20)]));
		expect(moves).toHaveBeenCalledExactlyOnceWith(1, 'touch');
		vi.advanceTimersByTime(451);
		gestures.touchStart(touch(root, [point(100)])); gestures.touchEnd(touch(root, [], [point(80)]));
		gestures.touchStart(touch(root, [point(100)])); gestures.touchMove(touch(root, [point(95, 30)])); gestures.touchEnd(touch(root, [], [point(0, 30)]));
		expect(moves).toHaveBeenCalledTimes(1);
	});

	it('cancels on multi-touch, touchcancel and a changed touch identity', () => {
		const { root, gestures, moves } = fixture();
		gestures.touchStart(touch(root, [point(100), point(110, 0, 2)])); gestures.touchEnd(touch(root, [], [point(0)]));
		gestures.touchStart(touch(root, [point(100)])); gestures.touchCancel(); gestures.touchEnd(touch(root, [], [point(0)]));
		gestures.touchStart(touch(root, [point(100)])); gestures.touchMove(touch(root, [point(0, 0, 2)])); gestures.touchEnd(touch(root, [], [point(0)]));
		expect(moves).not.toHaveBeenCalled();
	});

	it('accumulates a trackpad gesture once and consumes inertia without moving again', () => {
		const { root, gestures, moves } = fixture();
		gestures.wheel(wheel(root, 45));
		gestures.wheel(wheel(root, 50));
		for (let n = 0; n < 6; n++) { vi.advanceTimersByTime(100); gestures.wheel(wheel(root, 110)); }
		expect(moves).toHaveBeenCalledExactlyOnceWith(1, 'wheel');
		vi.advanceTimersByTime(151);
		gestures.wheel(wheel(root, -100));
		expect(moves).toHaveBeenLastCalledWith(-1, 'wheel');
		expect(moves).toHaveBeenCalledTimes(2);
	});

	it('does not switch vertically, at an edge, while disabled or during pinch zoom', () => {
		const current = fixture();
		current.gestures.wheel(wheel(current.root, 20, 100));
		current.enable(false); current.gestures.wheel(wheel(current.root, 100)); current.gestures.touchStart(touch(current.root, [point(100)])); current.gestures.touchEnd(touch(current.root, [], [point(0)]));
		current.enable(true); const pinch = wheel(current.root, 100); Object.assign(pinch, { ctrlKey: true }); current.gestures.wheel(pinch);
		expect(current.moves).not.toHaveBeenCalled();
		current.gestures.wheel(wheel(current.root, 100)); vi.advanceTimersByTime(451);
		const edge = wheel(current.root, 100); current.gestures.wheel(edge);
		expect(current.moves).toHaveBeenCalledTimes(1); expect(edge.preventDefault).not.toHaveBeenCalled();
	});

	it('shares a cooldown between touch and wheel and clears its timer on destroy', () => {
		const { root, gestures, moves } = fixture();
		gestures.touchStart(touch(root, [point(100)])); gestures.touchEnd(touch(root, [], [point(0)]));
		gestures.wheel(wheel(root, -100));
		expect(moves).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(1);
		gestures.destroy(); expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['input', 'textarea', 'button', 'a', 'select'])('leaves gestures on %s to that control', tag => {
		const { root, gestures, moves } = fixture(); const control = document.createElement(tag); root.append(control);
		expect(blocksTimelineTabGesture(control, root)).toBe(true);
		gestures.wheel(wheel(control, 100)); gestures.touchStart(touch(control, [point(100)])); gestures.touchEnd(touch(control, [], [point(0)]));
		expect(moves).not.toHaveBeenCalled();
	});

	it('leaves RSS, editable text and horizontally scrolling descendants alone', () => {
		const { root, gestures, moves } = fixture();
		for (const marker of ['data-timeline-tab-gesture-ignore', 'contenteditable']) {
			const child = document.createElement('div'); child.setAttribute(marker, 'true'); const text = document.createElement('span'); child.append(text); root.append(child);
			gestures.wheel(wheel(text, 100)); expect(blocksTimelineTabGesture(text, root)).toBe(true);
		}
		const scroller = document.createElement('pre'); scroller.style.overflowX = 'auto'; root.append(scroller);
		Object.defineProperties(scroller, { scrollWidth: { value: 300 }, clientWidth: { value: 100 } });
		gestures.wheel(wheel(scroller, 100)); expect(blocksTimelineTabGesture(scroller, root)).toBe(true);
		expect(moves).not.toHaveBeenCalled();
	});
});
