/* SPDX-License-Identifier: AGPL-3.0-only */

export type HatadyShelfMotionState = { overflow: boolean; running: boolean };
export type HatadyShelfMotionOptions = {
	element: HTMLElement;
	paused: () => boolean;
	motionEnabled: () => boolean;
	blocked: () => boolean;
	onStateChange?: (state: HatadyShelfMotionState) => void;
};
export type HatadyShelfMotion = { refresh: () => void; measure: () => void; dispose: () => void };

/** Mount after the shelf's buttons render; dispose before replacing those buttons. */
export function createHatadyShelfMotion(options: HatadyShelfMotionOptions): HatadyShelfMotion {
	const shelf = options.element;
	const ownerDocument = shelf.ownerDocument;
	const view = ownerDocument.defaultView ?? window;
	const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
	const originals = Array.from(shelf.children).filter((element): element is HTMLButtonElement => element.tagName === 'BUTTON');
	// Copies only fill the visual loop. Links, focus targets, IDs, and accessible names stay on originals.
	const copies = originals.map(original => {
		const copy = ownerDocument.createElement('span');
		copy.className = original.className;
		copy.style.cssText = original.style.cssText;
		copy.dataset.hatadyShelfCopy = '';
		copy.setAttribute('aria-hidden', 'true');
		copy.title = original.getAttribute('aria-label') ?? '';
		for (const child of original.childNodes) copy.append(child.cloneNode(true));
		for (const child of copy.children) if (child instanceof view.HTMLElement) child.inert = true;
		for (const child of copy.querySelectorAll<HTMLElement>('*')) {
			child.removeAttribute('id');
			child.removeAttribute('autofocus');
			if (child.matches('a,button,input,select,textarea,summary,[tabindex],[contenteditable]')) {
				child.tabIndex = -1;
				child.removeAttribute('contenteditable');
			}
		}
		copy.hidden = true;
		copy.style.display = 'none';
		shelf.append(copy);
		return copy;
	});
	let frame = 0;
	let timer: number | undefined;
	let maximum = 0;
	let loop = 0;
	let last: number | null = null;
	let position = shelf.scrollLeft;
	let hovered = false;
	let focused = shelf.contains(ownerDocument.activeElement);
	let inView = true;
	let manual = false;
	let disposed = false;
	let previousState: HatadyShelfMotionState | undefined;
	let lastMotionEnabled = options.motionEnabled();
	const listeners: Array<() => void> = [];

	function listen(target: EventTarget, event: string, handler: EventListener, listenerOptions?: AddEventListenerOptions): void {
		target.addEventListener(event, handler, listenerOptions);
		listeners.push(() => target.removeEventListener(event, handler, listenerOptions));
	}

	function stop(): void {
		view.cancelAnimationFrame(frame);
		frame = 0;
		last = null;
	}

	function canRun(): boolean {
		return !disposed && shelf.isConnected && loop > 0 && maximum > 1 && !options.paused() && options.motionEnabled() && !options.blocked() && !reducedMotion.matches && !ownerDocument.hidden && !hovered && !focused && !manual && inView;
	}

	function publishState(): void {
		const state = { overflow: maximum > 1, running: frame !== 0 };
		if (previousState && state.overflow === previousState.overflow && state.running === previousState.running) return;
		previousState = state;
		options.onStateChange?.(state);
	}

	function paint(now: number): void {
		frame = 0;
		if (!canRun()) {
			stop();
			publishState();
			return;
		}
		if (last === null) position = shelf.scrollLeft;
		else {
			// Keep subpixel progress even when the scroll surface rounds each write.
			// Read the actual position only on resume, after any manual scrolling.
			position = (position + Math.max(0, Math.min(80, now - last)) * 0.018) % loop;
			shelf.scrollLeft = position;
		}
		last = now;
		frame = view.requestAnimationFrame(paint);
	}

	function refresh(): void {
		if (disposed) return;
		if (lastMotionEnabled !== options.motionEnabled()) {
			measure();
			return;
		}
		if (!canRun()) stop();
		else if (!frame) frame = view.requestAnimationFrame(paint);
		publishState();
	}

	function measure(): void {
		if (disposed) return;
		stop();
		position = shelf.scrollLeft;
		copies.forEach(copy => { copy.hidden = true; copy.style.display = 'none'; });
		maximum = Math.max(0, shelf.scrollWidth - shelf.clientWidth);
		loop = 0;
		lastMotionEnabled = options.motionEnabled();
		if (maximum > 1 && !reducedMotion.matches && lastMotionEnabled) {
			copies.forEach((copy, index) => { copy.hidden = false; copy.style.display = originals[index].style.display; });
			if (copies[0] && originals[0]) loop = copies[0].offsetLeft - originals[0].offsetLeft;
		}
		shelf.scrollLeft = loop > 0 ? position % loop : Math.min(maximum, position);
		refresh();
	}

	function hold(): void {
		manual = true;
		stop();
		view.clearTimeout(timer);
		timer = view.setTimeout(() => { manual = false; refresh(); }, 3500);
		publishState();
	}

	listen(shelf, 'pointerenter', event => {
		if ((event as PointerEvent).pointerType === 'touch') return;
		hovered = true;
		refresh();
	});
	listen(shelf, 'pointerleave', () => { hovered = false; refresh(); });
	listen(shelf, 'focusin', () => { focused = true; refresh(); });
	listen(shelf, 'focusout', event => {
		const target = (event as FocusEvent).relatedTarget;
		focused = target instanceof view.Node && shelf.contains(target);
		refresh();
	});
	for (const event of ['pointerdown', 'pointerup', 'pointercancel', 'wheel']) listen(shelf, event, hold, { passive: true });
	// A visible cover keeps its existing action even when the loop shows its decorative copy.
	copies.forEach((copy, index) => listen(copy, 'click', event => {
		const original = originals[index];
		if (!original.isConnected || original.disabled) return;
		event.preventDefault();
		original.focus({ preventScroll: true });
		original.click();
	}));
	listen(ownerDocument, 'visibilitychange', refresh);
	listen(reducedMotion, 'change', measure);
	listen(view, 'resize', measure);
	const resize = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(measure) : undefined;
	resize?.observe(shelf);
	const intersection = typeof view.IntersectionObserver === 'function' ? new view.IntersectionObserver(entries => {
		inView = entries.some(entry => entry.isIntersecting);
		refresh();
	}) : undefined;
	intersection?.observe(shelf);

	measure();
	return {
		refresh,
		measure,
		dispose() {
			if (disposed) return;
			disposed = true;
			stop();
			view.clearTimeout(timer);
			resize?.disconnect();
			intersection?.disconnect();
			listeners.splice(0).forEach(remove => remove());
			copies.forEach(copy => copy.remove());
			maximum = 0;
			publishState();
		},
	};
}
