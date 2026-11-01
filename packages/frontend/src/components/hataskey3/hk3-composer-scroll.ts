/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import type { Ref } from 'vue';

type ComposerScrollOptions = {
	viewport: () => HTMLElement | null;
	composer: () => HTMLElement | null;
	blocked: () => boolean;
};

const IDLE_MS = 200;
const SUSTAINED_MS = 120;
const MIN_DISTANCE = 48;
const FORM_CONTROL = 'form, input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], [role="combobox"], [role="slider"], [role="spinbutton"]';

/** The caller starts after mount, calls show when busy state changes, and disposes on unmount. */
export function createHk3ComposerScroll(options: ComposerScrollOptions): {
	hidden: Ref<boolean>;
	start: () => void;
	show: () => void;
	dispose: () => void;
} {
	const hidden = ref(false);
	let viewport: HTMLElement | null = null;
	let ownerDocument: Document | null = null;
	let lastTop = 0;
	let intentUntil = 0;
	let direction = 0;
	let firstScrollAt: number | null = null;
	let distance = 0;
	let scrollbarHeld = false;
	let touch: { identifier: number; x: number; y: number } | null = null;
	let idleTimer: number | null = null;
	let disposed = false;
	const listeners: (() => void)[] = [];

	function show() {
		hidden.value = false;
		if (idleTimer !== null) window.clearTimeout(idleTimer);
		idleTimer = null;
		intentUntil = 0;
		direction = 0;
		firstScrollAt = null;
		distance = 0;
		scrollbarHeld = false;
		touch = null;
		lastTop = viewport?.scrollTop ?? 0;
	}

	function cannotHide() {
		const composer = options.composer();
		return !composer || !ownerDocument || ownerDocument.hidden || options.blocked()
			|| (ownerDocument.activeElement !== null && composer.contains(ownerDocument.activeElement));
	}

	function arm(nextDirection: number) {
		if (cannotHide()) {
			show();
			return;
		}
		const now = Date.now();
		if (now >= intentUntil && !scrollbarHeld) {
			firstScrollAt = null;
			distance = 0;
		}
		lastTop = viewport?.scrollTop ?? 0;
		direction = nextDirection;
		intentUntil = now + IDLE_MS;
	}

	function onScroll() {
		if (!viewport) return;
		const top = viewport.scrollTop;
		const delta = top - lastTop;
		lastTop = top; // Also track programmatic movement, without counting it as user movement.
		if (cannotHide()) {
			show();
			return;
		}
		const now = Date.now();
		if (delta === 0 || (!scrollbarHeld && now >= intentUntil)
			|| (direction !== 0 && Math.sign(delta) !== direction)) return;
		firstScrollAt ??= now;
		distance += Math.abs(delta);
		// Preserve the input's intent through touch/wheel inertia until scrolling stops.
		intentUntil = now + IDLE_MS;
		if (now - firstScrollAt >= SUSTAINED_MS && distance >= MIN_DISTANCE) hidden.value = true;
		if (idleTimer !== null) window.clearTimeout(idleTimer);
		idleTimer = window.setTimeout(() => {
			// A paused scrollbar drag may resume without a second pointerdown.
			const held = scrollbarHeld;
			show();
			scrollbarHeld = held;
		}, IDLE_MS);
	}

	function onWheel(event: WheelEvent) {
		if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
			intentUntil = 0;
			return;
		}
		arm(Math.sign(event.deltaY));
	}

	function onTouchStart(event: TouchEvent) {
		touch = event.touches.length === 1
			? { identifier: event.touches[0].identifier, x: event.touches[0].clientX, y: event.touches[0].clientY }
			: null;
		intentUntil = 0;
	}

	function onTouchMove(event: TouchEvent) {
		const current = event.touches[0];
		if (event.defaultPrevented || event.touches.length !== 1 || !touch || current.identifier !== touch.identifier) {
			touch = null;
			intentUntil = 0;
			return;
		}
		const dx = touch.x - current.clientX;
		const dy = touch.y - current.clientY;
		touch = { identifier: current.identifier, x: current.clientX, y: current.clientY };
		if (Math.abs(dy) > Math.abs(dx)) {
			arm(Math.sign(dy));
		} else {
			intentUntil = 0;
		}
	}

	function onTouchEnd() {
		touch = null;
	}

	function onTouchCancel() {
		touch = null;
		intentUntil = 0;
	}

	function onPointerDown(event: PointerEvent) {
		if (!viewport || event.defaultPrevented || event.button !== 0 || event.pointerType !== 'mouse' || event.target !== viewport) return;
		const rect = viewport.getBoundingClientRect();
		const left = rect.left + viewport.clientLeft;
		const right = left + viewport.clientWidth;
		const top = rect.top + viewport.clientTop;
		// Only the vertical scrollbar gutter; clicking timeline content is not scroll intent.
		if (event.clientY < top || event.clientY >= top + viewport.clientHeight
			|| event.clientX < rect.left || event.clientX > rect.right
			|| (event.clientX >= left && event.clientX < right)) return;
		arm(0);
		if (!cannotHide()) scrollbarHeld = true;
	}

	function onPointerUp() {
		scrollbarHeld = false;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!viewport || !ownerDocument || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
		const target = event.target;
		if (!(target instanceof Element) || target.closest(FORM_CONTROL) || options.composer()?.contains(target)) return;
		if (target !== ownerDocument.body && target !== ownerDocument.documentElement && !viewport.contains(target)) return;
		let nextDirection: number;
		switch (event.key) {
			case 'PageDown': case 'ArrowDown': case 'End': nextDirection = 1; break;
			case 'PageUp': case 'ArrowUp': case 'Home': nextDirection = -1; break;
			case ' ': case 'Spacebar': nextDirection = event.shiftKey ? -1 : 1; break;
			default: return;
		}
		arm(nextDirection);
	}

	function onFocusIn(event: FocusEvent) {
		if (event.target instanceof Node && options.composer()?.contains(event.target)) show();
	}

	function onVisibilityChange() {
		if (ownerDocument?.hidden) show();
	}

	function listen<E extends Event>(target: EventTarget, name: string, handler: (event: E) => void, settings: AddEventListenerOptions = {}) {
		target.addEventListener(name, handler as EventListener, settings);
		listeners.push(() => target.removeEventListener(name, handler as EventListener, settings));
	}

	function detach() {
		show();
		for (const remove of listeners.splice(0)) remove();
		viewport = null;
		ownerDocument = null;
	}

	function start() {
		if (disposed) return;
		const next = options.viewport();
		if (viewport === next) return;
		detach();
		if (!next) return;
		viewport = next;
		ownerDocument = next.ownerDocument;
		lastTop = next.scrollTop;
		listen(next, 'scroll', onScroll, { passive: true });
		listen(next, 'wheel', onWheel, { passive: true });
		listen(next, 'touchstart', onTouchStart, { passive: true });
		listen(next, 'touchmove', onTouchMove, { passive: true });
		listen(next, 'touchend', onTouchEnd, { passive: true });
		listen(next, 'touchcancel', onTouchCancel, { passive: true });
		listen(next, 'pointerdown', onPointerDown, { passive: true });
		listen(ownerDocument, 'pointerup', onPointerUp, { passive: true });
		listen(ownerDocument, 'pointercancel', onPointerUp, { passive: true });
		listen(ownerDocument, 'keydown', onKeyDown);
		listen(ownerDocument, 'focusin', onFocusIn, { capture: true });
		listen(ownerDocument, 'visibilitychange', onVisibilityChange);
		if (ownerDocument.defaultView) {
			listen(ownerDocument.defaultView, 'resize', show, { passive: true });
			listen(ownerDocument.defaultView, 'blur', show);
		}
	}

	function dispose() {
		disposed = true;
		detach();
	}

	return { hidden, start, show, dispose };
}
