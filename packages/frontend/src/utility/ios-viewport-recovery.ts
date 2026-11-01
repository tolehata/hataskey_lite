/* SPDX-License-Identifier: AGPL-3.0-only */
import { isIOSDevice } from './viewport-inset.js';

type RecoveryRouter = {
	on(event: 'change', listener: () => void): unknown;
	off(event: 'change', listener: () => void): unknown;
};

let stopActiveRecovery: (() => void) | undefined;

// These two UI shells scroll inside their own panes. Safari may retain a document
// offset on return; recover only that offset, without changing viewport height or
// treating visualViewport.offsetTop (keyboard/zoom/browser chrome) as document scroll.
export function attachIOSViewportRecovery(router: RecoveryRouter): () => void {
	if (!isIOSDevice(navigator)) return () => {};
	stopActiveRecovery?.();

	const viewport = window.visualViewport;
	const listeners: Array<() => void> = [];
	const pointers = new Set<number>();
	let touching = false;
	let stopped = false;
	let frame: number | undefined;
	let timers: number[] = [];

	function cancelPending() {
		if (frame !== undefined) window.cancelAnimationFrame(frame);
		frame = undefined;
		for (const timer of timers) window.clearTimeout(timer);
		timers = [];
	}

	function canRecover() {
		if (stopped || window.document.hidden || pointers.size > 0 || touching) return false;
		if (!(Math.abs((window.visualViewport?.scale ?? 1) - 1) < 0.001)) return false;
		const active = window.document.activeElement;
		return !(active instanceof HTMLElement && (active.matches('input, textarea, select') || active.isContentEditable));
	}

	function recover() {
		// Recheck at every settle point: editing or zoom may have begun meanwhile.
		if (!canRecover()) return;
		const root = window.document.scrollingElement;
		if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
		if (root && (root.scrollLeft !== 0 || root.scrollTop !== 0)) root.scrollTo({ left: 0, top: 0, behavior: 'instant' });
	}

	function schedule() {
		cancelPending();
		if (stopped || window.document.hidden || pointers.size > 0 || touching) return;
		// During focusout Safari can still report the departing editor as active.
		// Editing and zoom are therefore checked when each correction actually runs.
		// The route event precedes Vue's DOM update; the frame runs after that update.
		frame = window.requestAnimationFrame(() => { frame = undefined; recover(); });
		timers = [100, 350].map(delay => window.setTimeout(recover, delay));
	}

	function suspend() {
		cancelPending();
		pointers.clear();
		touching = false;
	}

	function visibility() {
		if (window.document.hidden) suspend();
		else schedule();
	}

	function pointerStarted(event: Event) {
		pointers.add((event as PointerEvent).pointerId);
		cancelPending();
	}

	function pointerEnded(event: Event) { pointers.delete((event as PointerEvent).pointerId); }

	function touchStarted() { touching = true; cancelPending(); }

	function touchEnded(event: Event) { touching = (event as TouchEvent).touches.length > 0; }

	function listen(target: EventTarget, event: string, handler: EventListener, capture = false) {
		target.addEventListener(event, handler, capture);
		listeners.push(() => target.removeEventListener(event, handler, capture));
	}

	listen(window, 'pageshow', schedule);
	listen(window, 'pagehide', suspend);
	listen(window, 'focus', schedule);
	listen(window, 'resize', schedule);
	if (viewport) listen(viewport, 'resize', schedule);
	listen(window.document, 'visibilitychange', visibility);
	listen(window.document, 'focusout', schedule, true);
	listen(window.document, 'pointerdown', pointerStarted, true);
	listen(window, 'pointerup', pointerEnded, true);
	listen(window, 'pointercancel', pointerEnded, true);
	listen(window.document, 'touchstart', touchStarted, true);
	listen(window, 'touchend', touchEnded, true);
	listen(window, 'touchcancel', touchEnded, true);
	listen(window.document, 'keydown', cancelPending, true);
	listen(window, 'wheel', cancelPending, true);
	router.on('change', schedule);

	function stop() {
		if (stopped) return;
		stopped = true;
		suspend();
		for (const remove of listeners) remove();
		router.off('change', schedule);
		if (stopActiveRecovery === stop) stopActiveRecovery = undefined;
	}

	stopActiveRecovery = stop;
	schedule();
	return stop;
}
