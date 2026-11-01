/* SPDX-License-Identifier: AGPL-3.0-only */

export type TimelineTabDirection = -1 | 1;
export type TimelineTabGestureSource = 'touch' | 'wheel';

/** Do not take gestures belonging to an editor, media scroller or the RSS reader. */
export function blocksTimelineTabGesture(target: EventTarget | null, root: HTMLElement | null): boolean {
	let element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
	while (element && element !== root) {
		if (element.matches('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [data-timeline-tab-gesture-ignore]')) return true;
		if (element instanceof HTMLElement && element.scrollWidth > element.clientWidth + 1) {
			const overflow = window.getComputedStyle(element).overflowX;
			if (overflow === 'auto' || overflow === 'scroll') return true;
		}
		element = element.parentElement;
	}
	return false;
}

/** One horizontal gesture switches at most one tab, including trackpad inertia. */
export function createTimelineTabGestures(options: {
	enabled: () => boolean;
	root: () => HTMLElement | null;
	canMove: (direction: TimelineTabDirection, source: TimelineTabGestureSource) => boolean;
	move: (direction: TimelineTabDirection, source: TimelineTabGestureSource) => void;
}) {
	let touch: { id: number; x: number; y: number } | null = null;
	let wheelX = 0;
	let wheelMoved = false;
	let wheelTimer: number | undefined;
	let lockUntil = 0;
	const blocked = (target: EventTarget | null) => blocksTimelineTabGesture(target, options.root());
	function cancelTouch() { touch = null; }
	function reset() {
		cancelTouch();
		window.clearTimeout(wheelTimer);
		wheelTimer = undefined;
		wheelX = 0;
		wheelMoved = false;
		lockUntil = 0;
	}
	function touchStart(event: TouchEvent) {
		cancelTouch();
		if (!options.enabled() || Date.now() < lockUntil || event.touches.length !== 1 || blocked(event.target)) return;
		const point = event.touches[0];
		touch = { id: point.identifier, x: point.clientX, y: point.clientY };
	}
	function touchMove(event: TouchEvent) {
		if (!touch) return;
		if (!options.enabled() || event.touches.length !== 1) { cancelTouch(); return; }
		const point = event.touches[0];
		if (point.identifier !== touch.id) { cancelTouch(); return; }
		const dx = point.clientX - touch.x;
		const dy = point.clientY - touch.y;
		// Once vertical scrolling starts, ending sideways must not switch a tab.
		if (Math.abs(dy) > Math.max(12, Math.abs(dx))) { cancelTouch(); return; }
		const direction = dx < 0 ? 1 : -1;
		if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && options.canMove(direction, 'touch') && event.cancelable) event.preventDefault();
	}
	function touchEnd(event: TouchEvent) {
		const started = touch;
		cancelTouch();
		if (!started || !options.enabled() || Date.now() < lockUntil || event.touches.length !== 0) return;
		const point = Array.from(event.changedTouches).find(item => item.identifier === started.id);
		if (!point) return;
		const dx = point.clientX - started.x;
		const dy = point.clientY - started.y;
		if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy) * 1.2 || Math.abs(dy) > 50) return;
		const direction = dx < 0 ? 1 : -1;
		if (!options.canMove(direction, 'touch')) return;
		lockUntil = Date.now() + 450;
		options.move(direction, 'touch');
	}
	function wheel(event: WheelEvent) {
		if (!options.enabled() || event.ctrlKey || event.metaKey || blocked(event.target)) return;
		if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.2) return;
		const direction = event.deltaX > 0 ? 1 : -1;
		// A moved gesture still owns its remaining inertia at a newly reached edge.
		if (!wheelMoved && !options.canMove(direction, 'wheel')) return;
		if (event.cancelable) event.preventDefault();
		window.clearTimeout(wheelTimer);
		wheelTimer = window.setTimeout(() => { wheelX = 0; wheelMoved = false; wheelTimer = undefined; }, 150);
		if (wheelMoved || Date.now() < lockUntil) return;
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (options.root()?.clientWidth ?? 800) : 1;
		const delta = event.deltaX * scale;
		wheelX = wheelX * delta < 0 ? delta : wheelX + delta;
		if (Math.abs(wheelX) < 90) return;
		wheelMoved = true;
		wheelX = 0;
		lockUntil = Date.now() + 450;
		options.move(direction, 'wheel');
	}
	return { touchStart, touchMove, touchEnd, touchCancel: cancelTouch, wheel, reset, destroy: reset };
}
