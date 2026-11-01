/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type EntranceArgs = {
	source: DOMRectReadOnly;
	target: HTMLElement;
	viewport: HTMLElement;
	note: {
		text?: string | null;
		cw?: string | null;
		user: { name?: string | null; username: string; avatarUrl?: string | null };
	};
	motion: boolean;
};

const active = new WeakMap<HTMLElement, () => void>();
const anchors = new WeakMap<HTMLElement, { owners: number; restore: () => void }>();
const noop = () => {};
const EXPAND_MS = 360;
const FLIGHT_MS = 620;
const FADE_MS = 120;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const layoutProperties = [
	'height', 'padding-top', 'padding-bottom', 'border-top-width', 'border-bottom-width',
	'margin-top', 'margin-bottom', 'min-height', 'max-height', 'box-sizing', 'overflow-x', 'overflow-y',
] as const;

function safely(action: () => void) {
	try { action(); } catch { /* Continue restoring the other resources. */ }
}

/** Restore only properties we own, including their original !important priority. */
function backup(element: HTMLElement, properties: readonly string[]) {
	const saved = properties.map(property => ({
		property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property),
	}));
	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		for (const { property, value, priority } of saved) safely(() => {
			if (value) element.style.setProperty(property, value, priority);
			else element.style.removeProperty(property);
		});
	};
}

function holdAnchor(list: HTMLElement) {
	let entry = anchors.get(list);
	if (!entry) {
		entry = { owners: 0, restore: backup(list, ['overflow-anchor']) };
		try {
			list.style.setProperty('overflow-anchor', 'none', 'important');
		} catch (error) {
			entry.restore();
			throw error;
		}
		anchors.set(list, entry);
	}
	entry.owners++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--entry.owners === 0) {
			entry.restore();
			anchors.delete(list);
		}
	};
}

function validRect(rect: DOMRectReadOnly) {
	return [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite) &&
		rect.width > 0 && rect.height > 0 && rect.width <= 32768 && rect.height <= 32768 &&
		Math.abs(rect.right - rect.left - rect.width) < 1 && Math.abs(rect.bottom - rect.top - rect.height) < 1;
}

function intersects(a: DOMRectReadOnly, b: { left: number; top: number; right: number; bottom: number }) {
	return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

// Invert the cubic's x coordinate so RAF follows the same easing as WAAPI.
function ease(progress: number) {
	if (progress <= 0 || progress >= 1) return progress;
	const cubic = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
	let low = 0;
	let high = 1;
	for (let i = 0; i < 16; i++) {
		const middle = (low + high) / 2;
		if (cubic(middle, 0.22, 0.36) < progress) low = middle;
		else high = middle;
	}
	return cubic((low + high) / 2, 1, 1);
}

function paper(doc: Document, style: CSSStyleDeclaration, note: EntranceArgs['note']) {
	const ghost = doc.createElement('div');
	const surface = style.getPropertyValue('--hk3-bg') || style.getPropertyValue('--MI_THEME-panel') || style.backgroundColor;
	ghost.dataset.hk3PostEntranceGhost = '';
	ghost.setAttribute('aria-hidden', 'true');
	ghost.setAttribute('inert', '');
	ghost.inert = true;
	for (const property of [
		'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'direction', 'color-scheme',
		'--hk3-bg', '--hk3-text', '--hk3-divider', '--hk3-shadow-md', '--hk3-glass-note-alpha', '--MI_THEME-panel', '--MI_THEME-fg',
	]) {
		const value = style.getPropertyValue(property);
		if (value) ghost.style.setProperty(property, value);
	}
	Object.assign(ghost.style, {
		position: 'fixed', pointerEvents: 'none', zIndex: '10000', boxSizing: 'border-box',
		overflow: 'hidden', margin: '0', padding: '16px', opacity: '1',
		color: style.color,
		backgroundColor: surface,
		borderRadius: '16px',
		boxShadow: style.getPropertyValue('--hk3-shadow-md') || style.boxShadow,
	});
	// The body overlay must carry the timeline's palette and density outside the app root.
	// Only the backdrop is blurred; the avatar and text stay sharp throughout the flight.
	ghost.style.setProperty('background-color', `color-mix(in srgb, ${surface} var(--hk3-glass-note-alpha, 62%), transparent)`);
	ghost.style.setProperty('-webkit-backdrop-filter', 'blur(20px)');
	ghost.style.setProperty('backdrop-filter', 'blur(20px)');
	const header = doc.createElement('div');
	Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', marginBottom: '8px' });
	if (note.user.avatarUrl) {
		const avatar = doc.createElement('img');
		avatar.src = note.user.avatarUrl;
		avatar.alt = '';
		avatar.draggable = false;
		Object.assign(avatar.style, { width: '32px', height: '32px', flex: '0 0 32px', objectFit: 'cover', borderRadius: '50%' });
		header.append(avatar);
	}
	const name = doc.createElement('span');
	name.textContent = note.user.name || note.user.username;
	Object.assign(name.style, { fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
	header.append(name);
	const text = doc.createElement('div');
	text.dataset.hk3PostEntranceText = '';
	text.textContent = note.cw != null ? note.cw : note.text ?? '';
	Object.assign(text.style, { display: '-webkit-box', overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
	text.style.setProperty('-webkit-box-orient', 'vertical');
	text.style.setProperty('-webkit-line-clamp', '5');
	ghost.append(header, text);
	return ghost;
}

/** Call after nextTick, when the real note has its final natural layout. Preference changes cancel via the caller. */
export function animateHk3PostEntrance({ source, target, viewport, note, motion }: EntranceArgs): () => void {
	active.get(target)?.();
	const doc = target.ownerDocument;
	const win = doc.defaultView;
	const list = target.parentElement;
	if (!motion || !win || !list || !doc.body || !target.isConnected || !viewport.isConnected ||
		!viewport.contains(target) || doc.visibilityState === 'hidden' || typeof target.animate !== 'function' ||
		typeof win.requestAnimationFrame !== 'function' || typeof win.cancelAnimationFrame !== 'function') return noop;

	let initial: DOMRectReadOnly;
	let view: DOMRectReadOnly;
	let style: CSSStyleDeclaration;
	let gap: number;
	let ghost: HTMLElement;
	let start: number;
	try {
		if (typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches) return noop;
		initial = target.getBoundingClientRect();
		view = viewport.getBoundingClientRect();
		const visual = win.visualViewport;
		const screen = {
			left: Math.max(0, visual?.offsetLeft ?? 0), top: Math.max(0, visual?.offsetTop ?? 0),
			right: Math.min(win.innerWidth, (visual?.offsetLeft ?? 0) + (visual?.width ?? win.innerWidth)),
			bottom: Math.min(win.innerHeight, (visual?.offsetTop ?? 0) + (visual?.height ?? win.innerHeight)),
		};
		const visible = {
			left: Math.max(view.left, screen.left), top: Math.max(view.top, screen.top),
			right: Math.min(view.right, screen.right), bottom: Math.min(view.bottom, screen.bottom),
		};
		if (!validRect(source) || !validRect(initial) || !validRect(view) || source.width < 24 || source.height < 24 ||
			!intersects(source, screen) || visible.right <= visible.left || visible.bottom <= visible.top ||
			initial.height > visible.bottom - visible.top || initial.left < visible.left || initial.right > visible.right ||
			initial.top < visible.top || initial.bottom > visible.bottom) return noop;
		for (let element: HTMLElement | null = target; element; element = element.parentElement) {
			const computed = win.getComputedStyle(element);
			if (computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse' ||
				Number.parseFloat(computed.opacity) <= 0 || computed.contentVisibility === 'hidden') return noop;
		}
		style = win.getComputedStyle(target);
		const hasOtherRow = Array.from(list.children).some(child => child !== target && !active.has(child as HTMLElement) &&
			!child.hasAttribute('data-note-removal-pending') && !child.hasAttribute('data-note-removal-collapsed') &&
			win.getComputedStyle(child).display !== 'none');
		gap = hasOtherRow ? Number.parseFloat(win.getComputedStyle(list).rowGap) || 0 : 0;
		if (!Number.isFinite(gap) || gap < 0 || gap > 32768) return noop;
		ghost = paper(doc, style, note);
		start = win.performance.now();
		if (!Number.isFinite(start)) return noop;
	} catch { return noop; }

	const restoreLayout = backup(target, layoutProperties);
	const restoreAppearance = backup(target, ['opacity', 'transition-property']);
	const inert = target.inert;
	const inertAttribute = target.getAttribute('inert');
	const opacity = Number.parseFloat(style.opacity) || 1;
	const listeners: (() => void)[] = [];
	let releaseAnchor = noop;
	let observer: ResizeObserver | undefined;
	let frame: number | undefined;
	let animation: Animation | undefined;
	let stopped = false;
	let expanded = false;
	const cleanup = () => {
		if (stopped) return;
		stopped = true;
		if (active.get(target) === cleanup) active.delete(target);
		if (frame !== undefined) safely(() => win.cancelAnimationFrame(frame!));
		frame = undefined;
		if (animation) safely(() => animation!.cancel());
		animation = undefined;
		listeners.splice(0).forEach(remove => safely(remove));
		if (observer) safely(() => observer!.disconnect());
		safely(() => ghost.remove());
		restoreLayout();
		restoreAppearance();
		safely(() => { target.inert = inert; });
		safely(() => {
			if (inertAttribute === null) target.removeAttribute('inert');
			else target.setAttribute('inert', inertAttribute);
		});
		releaseAnchor();
	};
	const finishExpansion = () => {
		if (stopped || expanded) return;
		expanded = true;
		restoreLayout();
		const completed = animation;
		animation = undefined;
		if (completed) safely(() => completed.cancel());
	};
	const listen = (eventTarget: EventTarget, event: string, listener: EventListener, capture = false) => {
		eventTarget.addEventListener(event, listener, { capture, passive: true });
		listeners.push(() => eventTarget.removeEventListener(event, listener, capture));
	};
	const place = (destination: DOMRectReadOnly, progress: number) => {
		const mix = (from: number, to: number) => `${from + (to - from) * progress}px`;
		ghost.style.left = mix(source.left, destination.left);
		ghost.style.top = mix(source.top, destination.top);
		ghost.style.width = mix(source.width, destination.width);
		// The live row is collapsed at first; never use its animated height as the flight destination.
		ghost.style.height = mix(source.height, initial.height);
	};
	const tick: FrameRequestCallback = time => {
		frame = undefined;
		if (stopped) return;
		try {
			if (!target.isConnected || !viewport.isConnected || target.parentElement !== list ||
				!viewport.contains(target) || doc.visibilityState === 'hidden' || !Number.isFinite(time)) return cleanup();
			const elapsed = Math.max(0, time - start);
			if (elapsed >= EXPAND_MS) finishExpansion();
			const destination = target.getBoundingClientRect();
			// Zero height is expected during expansion, but width and position must remain usable.
			if (![destination.left, destination.top, destination.width].every(Number.isFinite) ||
				destination.width <= 0 || destination.width > 32768) return cleanup();
			place(destination, ease(Math.min(1, elapsed / FLIGHT_MS)));
			const fade = Math.min(1, Math.max(0, (elapsed - (FLIGHT_MS - FADE_MS)) / FADE_MS));
			// Crossfade the rounded glass into the real timeline row's own shape and contents.
			ghost.style.opacity = String(1 - fade);
			target.style.setProperty('opacity', String(opacity * fade), 'important');
			if (elapsed >= FLIGHT_MS) return cleanup();
			frame = win.requestAnimationFrame(tick);
		} catch { cleanup(); }
	};

	try {
		const px = (value: string) => `${Number.parseFloat(value) || 0}px`;
		const full = {
			height: `${initial.height}px`, paddingTop: px(style.paddingTop), paddingBottom: px(style.paddingBottom),
			borderTopWidth: px(style.borderTopWidth), borderBottomWidth: px(style.borderBottomWidth),
			marginTop: px(style.marginTop), marginBottom: px(style.marginBottom),
		};
		const collapsed = {
			height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px',
			marginTop: '0px', marginBottom: `${-gap}px`,
		};
		active.set(target, cleanup);
		releaseAnchor = holdAnchor(list);
		place(initial, 0);
		doc.body.append(ghost);
		target.inert = true;
		target.style.setProperty('transition-property', 'none', 'important');
		target.style.setProperty('opacity', '0', 'important');
		target.style.setProperty('min-height', '0', 'important');
		target.style.setProperty('max-height', 'none', 'important');
		target.style.setProperty('box-sizing', 'border-box', 'important');
		target.style.setProperty('overflow-x', 'hidden', 'important');
		target.style.setProperty('overflow-y', 'hidden', 'important');
		// Normal priority lets WAAPI override the collapsed inline values.
		for (const property of layoutProperties.slice(0, 7)) target.style.setProperty(property, property === 'margin-bottom' ? `${-gap}px` : '0px');
		animation = target.animate([collapsed, full], { duration: EXPAND_MS, easing: EASING, fill: 'forwards' });
		animation.finished.then(finishExpansion, () => { if (!expanded) cleanup(); });
		listen(win, 'resize', cleanup);
		listen(win, 'scroll', cleanup, true);
		listen(win, 'wheel', cleanup, true);
		listen(win, 'touchmove', cleanup, true);
		listen(doc, 'visibilitychange', () => { if (doc.visibilityState === 'hidden') cleanup(); });
		if (win.visualViewport) {
			listen(win.visualViewport, 'resize', cleanup);
			listen(win.visualViewport, 'scroll', cleanup);
		}
		if (typeof win.ResizeObserver === 'function') {
			observer = new win.ResizeObserver(() => {
				try {
					const current = viewport.getBoundingClientRect();
					// Clearing the composer changes available height during its preview transition.
					// Keep following that relayout; only a width change invalidates the flight geometry.
					if (!viewport.isConnected || Math.abs(current.width - view.width) > 0.5) cleanup();
				} catch { cleanup(); }
			});
			observer.observe(viewport);
		}
		frame = win.requestAnimationFrame(tick);
	} catch { cleanup(); }
	return cleanup;
}
