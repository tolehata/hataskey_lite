/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { CSSProperties, Ref } from 'vue';
import { prefer } from '@/preferences.js';
import { CHARM_CORD_LENGTH, CHARM_MAX_SIZE, CHARM_MIN_SIZE, CHARM_WIND_DURATION, charmGeometry, charmWindForce, clampCharm, constrainCharm, createCharmScrollState, createCharmState, driveCharmScroll, getCharmPose, releaseCharm, stepCharm } from '@/utility/note-charm-physics.js';

type CharmClient = {
	frame: (dt: number) => boolean;
	scroll: (event: Event, delta: number) => void;
	pointer: (event: PointerEvent | null) => void;
	reset: () => void;
	position: () => void;
	measure: () => void;
	transition: (event: Event, active: boolean) => void;
	wind: (strength: number) => void;
};

// One set of page listeners and one sleeping animation loop for every visible charm.
const clients = new Set<CharmClient>();
const awake = new Set<CharmClient>();
const positioning = new Set<CharmClient>();
const tracking = new Set<CharmClient>();
const windClients = new Set<CharmClient>();
let windTimer: number | undefined;
let windCycle = 0;
let windResponseId = 0;
let windSuspended = false;
let frameId = 0;
let pointerFrame = 0;
let previousTime = 0;
let lastPointer: PointerEvent | null = null;
let scrollPositions = new WeakMap<EventTarget, number>();
const exclusionSelector = '[data-note-charm-exclusion]';
let exclusions: HTMLElement[] = [];
let exclusionBounds: { element: HTMLElement; rect: DOMRect }[] | null = null;
let exclusionObserver: MutationObserver | undefined;
let exclusionResize: ResizeObserver | undefined;
const exclusionTransitions = new Map<Element, Set<string>>();

function invalidateExclusions() {
	exclusionBounds = null;
	for (const client of clients) placeOnFrame(client);
}

function refreshExclusions() {
	exclusions = Array.from(window.document.querySelectorAll<HTMLElement>(exclusionSelector));
	exclusionResize?.disconnect();
	for (const element of exclusions) exclusionResize?.observe(element);
	for (const element of exclusionTransitions.keys()) if (!exclusions.some(exclusion => element.contains(exclusion))) exclusionTransitions.delete(element);
	invalidateExclusions();
}

function observeExclusions() {
	if (typeof ResizeObserver !== 'undefined') exclusionResize = new ResizeObserver(invalidateExclusions);
	refreshExclusions();
	if (typeof MutationObserver === 'undefined') return;
	exclusionObserver = new MutationObserver(records => {
		let refresh = false;
		let changed = false;
		for (const record of records) {
			if (record.type === 'childList') {
				refresh ||= exclusions.some(element => !element.isConnected) || Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches(exclusionSelector) || node.querySelector(exclusionSelector)));
			} else if (record.target instanceof Element) {
				const target = record.target;
				refresh ||= record.attributeName === 'data-note-charm-exclusion';
				changed ||= exclusions.some(element => target.contains(element));
			}
		}
		if (refresh) refreshExclusions(); else if (changed) invalidateExclusions();
	});
	exclusionObserver.observe(window.document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'data-note-charm-exclusion'] });
}

function getExclusionBounds() {
	// Share layout reads across charms; widget transitions invalidate once per RAF.
	return exclusionBounds ??= exclusions.flatMap(element => {
		const rect = element.getBoundingClientRect();
		const css = window.getComputedStyle(element);
		return rect.width > 0 && rect.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' ? [{ element, rect }] : [];
	});
}

function trackExclusionTransition(event: Event, active: boolean) {
	const target = event.target;
	if (!(target instanceof Element) || !exclusions.some(element => target.contains(element))) return;
	const key = 'propertyName' in event ? String(event.propertyName) : 'animationName' in event ? String(event.animationName) : '';
	const keys = exclusionTransitions.get(target) ?? new Set<string>();
	if (active) keys.add(key); else keys.delete(key);
	if (keys.size) exclusionTransitions.set(target, keys); else exclusionTransitions.delete(target);
	invalidateExclusions();
}

// A single timer wakes visible charms for a gust; calm intervals need no RAF.
function scheduleWind() {
	if (windTimer !== undefined || !windClients.size) return;
	const delay = windCycle ? 11000 + (windCycle * 1379) % 5000 : 3000;
	windTimer = window.setTimeout(() => {
		windTimer = undefined;
		windCycle++;
		const strength = windCycle % 2 ? 1 : .9;
		for (const client of windClients) client.wind(strength);
		scheduleWind();
	}, delay);
}

function setWindEligible(client: CharmClient, eligible: boolean) {
	if (eligible) windClients.add(client); else windClients.delete(client);
	if (windClients.size) { scheduleWind(); return; }
	if (windTimer !== undefined) window.clearTimeout(windTimer);
	windTimer = undefined;
	windCycle = 0;
}

function animate(time: number) {
	frameId = 0;
	exclusionBounds = null;
	const dt = previousTime ? (time - previousTime) / 1000 : 1 / 60;
	previousTime = time;
	for (const client of new Set([...positioning, ...tracking, ...(exclusionTransitions.size ? clients : [])])) client.position();
	positioning.clear();
	for (const client of awake) if (!client.frame(dt)) awake.delete(client);
	if (awake.size || tracking.size || (exclusionTransitions.size && !window.document.hidden)) frameId = requestAnimationFrame(animate);
	else previousTime = 0;
}

function wake(client: CharmClient) {
	awake.add(client);
	if (!frameId) frameId = requestAnimationFrame(animate);
}

function sleep(client: CharmClient) {
	awake.delete(client);
	if (!awake.size && !positioning.size && !tracking.size && !exclusionTransitions.size && frameId) {
		cancelAnimationFrame(frameId);
		frameId = 0;
		previousTime = 0;
	}
}

function placeOnFrame(client: CharmClient) {
	positioning.add(client);
	if (!frameId) frameId = requestAnimationFrame(animate);
}

function resizeClients() {
	exclusionBounds = null;
	for (const client of clients) client.measure();
}

function onScroll(event: Event) {
	exclusionBounds = null;
	const target = event.target;
	if (!target) return;
	const position = target instanceof Element ? target.scrollTop : window.scrollY;
	const previous = scrollPositions.get(target) ?? position;
	scrollPositions.set(target, position);
	const delta = position - previous;
	for (const client of clients) client.scroll(event, delta);
	if (lastPointer) updatePointerOnFrame();
}

function onPointer(event: PointerEvent) {
	lastPointer = event.pointerType === 'mouse' ? event : null;
	updatePointerOnFrame();
}

function updatePointerOnFrame() {
	if (pointerFrame) return;
	pointerFrame = requestAnimationFrame(() => {
		pointerFrame = 0;
		for (const client of clients) client.pointer(lastPointer);
	});
}

function resetClients() {
	exclusionBounds = null;
	lastPointer = null;
	for (const client of clients) { client.reset(); client.position(); }
}

function blurClients() {
	windSuspended = true;
	resetClients();
}

function focusClients() {
	windSuspended = !window.document.hasFocus();
	for (const client of clients) client.position();
}

function transitionStarted(event: Event) {
	trackExclusionTransition(event, true);
	for (const client of clients) client.transition(event, true);
}

function transitionEnded(event: Event) {
	trackExclusionTransition(event, false);
	for (const client of clients) client.transition(event, false);
}

function register(client: CharmClient, rail: HTMLElement | null) {
	// Capture the actual starting offsets before the first event, including
	// nested column scrollers. Unrelated elements never drive this charm.
	for (let ancestor = rail?.parentElement; ancestor; ancestor = ancestor.parentElement) {
		scrollPositions.set(ancestor, ancestor.scrollTop);
	}
	scrollPositions.set(window.document, window.scrollY);
	scrollPositions.set(window, window.scrollY);
	if (!clients.size) {
		observeExclusions();
		windSuspended = !window.document.hasFocus();
		window.addEventListener('scroll', onScroll, { capture: true, passive: true });
		window.addEventListener('resize', resizeClients, { passive: true });
		window.visualViewport?.addEventListener('resize', resizeClients, { passive: true });
		window.visualViewport?.addEventListener('scroll', resizeClients, { passive: true });
		window.addEventListener('blur', blurClients);
		window.addEventListener('focus', focusClients);
		window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
		window.addEventListener('pointerout', onPointerOut, { passive: true });
		window.document.addEventListener('visibilitychange', resetClients);
		window.addEventListener('transitionrun', transitionStarted, true);
		window.addEventListener('transitionend', transitionEnded, true);
		window.addEventListener('transitioncancel', transitionEnded, true);
		window.addEventListener('animationstart', transitionStarted, true);
		window.addEventListener('animationend', transitionEnded, true);
		window.addEventListener('animationcancel', transitionEnded, true);
	}
	clients.add(client);
	return () => {
		setWindEligible(client, false);
		positioning.delete(client);
		tracking.delete(client);
		sleep(client);
		clients.delete(client);
		if (clients.size) return;
		exclusionObserver?.disconnect();
		exclusionResize?.disconnect();
		exclusions = [];
		exclusionBounds = null;
		exclusionTransitions.clear();
		sleep(client);
		window.removeEventListener('scroll', onScroll, true);
		window.removeEventListener('resize', resizeClients);
		window.visualViewport?.removeEventListener('resize', resizeClients);
		window.visualViewport?.removeEventListener('scroll', resizeClients);
		window.removeEventListener('blur', blurClients);
		window.removeEventListener('focus', focusClients);
		window.removeEventListener('pointermove', onPointer, true);
		window.removeEventListener('pointerout', onPointerOut);
		window.document.removeEventListener('visibilitychange', resetClients);
		window.removeEventListener('transitionrun', transitionStarted, true);
		window.removeEventListener('transitionend', transitionEnded, true);
		window.removeEventListener('transitioncancel', transitionEnded, true);
		window.removeEventListener('animationstart', transitionStarted, true);
		window.removeEventListener('animationend', transitionEnded, true);
		window.removeEventListener('animationcancel', transitionEnded, true);
		if (pointerFrame) cancelAnimationFrame(pointerFrame);
		pointerFrame = 0;
		lastPointer = null;
		scrollPositions = new WeakMap();
	};
}

function onPointerOut(event: PointerEvent) {
	if (event.relatedTarget !== null) return;
	lastPointer = null;
	for (const client of clients) client.pointer(null);
}

type Grab = {
	id: number;
	x: number;
	y: number;
	startX: number;
	startY: number;
	time: number;
	vx: number;
	vy: number;
};

export function useNoteCharm(options: {
	source: Ref<HTMLElement | null>;
	rail: Ref<HTMLElement | null>;
	pendulum: Ref<HTMLElement | null>;
	button: Ref<HTMLButtonElement | null>;
	motion: () => boolean;
	wind?: () => boolean;
	interactive: () => boolean;
	size: () => number;
	artworkHeight?: () => number;
}) {
	const geometry = shallowRef(charmGeometry(options.size(), 3, options.artworkHeight?.()));
	const attachmentTop = ref(32);
	const portalStyle = shallowRef<CSSProperties>({});
	const layerStyle = shallowRef<CSSProperties>({ visibility: 'hidden' });
	const portalInert = ref(false);
	const state = createCharmState();
	const scroll = createCharmScrollState();
	const pose = shallowRef(getCharmPose(state, geometry.value));
	const held = ref(false);
	const near = ref(false);
	const visible = ref(true);
	const reducedMotion = ref(true);
	const hover = ref(false);
	const canMove = computed(() => options.motion() && prefer.r.animation.value && !reducedMotion.value);
	let grab: Grab | null = null;
	let latched = false;
	let suppressClickUntil = 0;
	let restingRect: DOMRect | null = null;
	let dispose: (() => void) | undefined;
	let observer: IntersectionObserver | undefined;
	let resize: ResizeObserver | undefined;
	let motionQuery: MediaQueryList | undefined;
	let hoverQuery: MediaQueryList | undefined;
	let attributes: MutationObserver | undefined;
	let contextDirty = true;
	let clipping: HTMLElement[] = [];
	let ancestors: HTMLElement[] = [];
	let theme: Record<string, string> = {};
	let colorScheme = 'normal';
	let portalSize = options.size();
	let portalZ = 2;
	let portalWindow: HTMLElement | null = null;
	let sourceHidden = false;
	let stickyTop = 0;
	let stickyBottom = 0;
	let portalScaleX = 1;
	let portalScaleY = 1;
	const transitions = new Map<EventTarget, Set<string>>();
	let disposed = false;
	let portalVisible = false;
	let windElapsed: number | null = null;
	let windStrength = 0;
	const windResponse = 1 + (windResponseId++ % 4) * 30 / 560;
	const source = () => options.source.value;
	const host = () => source()?.parentElement;

	const draw = () => { pose.value = getCharmPose(state, geometry.value); };
	const rest = () => { Object.assign(state, createCharmState()); Object.assign(scroll, createCharmScrollState()); draw(); };

	function canBlow() {
		return !disposed && canMove.value && (options.wind?.() ?? true) && portalVisible &&
			!portalInert.value && !windSuspended && window.document.hasFocus() && !window.document.hidden && !grab && !latched;
	}

	function syncWind() {
		const eligible = canBlow();
		if (!eligible) windElapsed = null;
		setWindEligible(client, eligible);
	}

	function releaseCapture() {
		const current = grab;
		grab = null;
		if (current && options.button.value?.hasPointerCapture?.(current.id)) {
			try { options.button.value.releasePointerCapture(current.id); } catch { /* Capture can already have been released by the browser. */ }
		}
	}

	function reset() {
		windElapsed = null;
		if (window.document.hidden) tracking.delete(client);
		if (grab) suppressClickUntil = performance.now() + 500;
		releaseCapture();
		latched = false;
		held.value = false;
		near.value = false;
		restingRect = null;
		sleep(client);
		rest();
		syncWind();
	}

	function measure() {
		contextDirty = true;
		// All notes observe the growing timeline. Keep offscreen context dirty
		// until re-entry instead of measuring every ancestor for every old note.
		if (!visible.value) return;
		reset();
		position();
	}

	function refreshContext() {
		const marker = source();
		if (!marker) return;
		const note = host();
		const style = window.getComputedStyle(marker);
		colorScheme = style.colorScheme;
		stickyTop = Number.parseFloat(style.getPropertyValue('--MI-stickyTop')) || 0;
		stickyBottom = Number.parseFloat(style.getPropertyValue('--MI-stickyBottom')) || 0;
		theme = Object.fromEntries(['--MI_THEME-bg', '--MI_THEME-fg', '--MI_THEME-panel', '--MI_THEME-divider', '--MI_THEME-accent'].map(name => [name, style.getPropertyValue(name)]));
		portalSize = clampCharm(marker.offsetWidth || Math.min(options.size(), Number.parseFloat(style.getPropertyValue('--note-charm-slot-size')) || options.size()), CHARM_MIN_SIZE, CHARM_MAX_SIZE);
		clipping = [];
		ancestors = [];
		portalZ = 2;
		portalWindow = marker.closest<HTMLElement>('[data-mk-window]');
		sourceHidden = false;
		portalInert.value = false;
		for (let ancestor = marker.parentElement; ancestor; ancestor = ancestor.parentElement) {
			ancestors.push(ancestor);
			const css = window.getComputedStyle(ancestor);
			if (ancestor.hasAttribute('inert')) portalInert.value = true;
			if (css.display === 'none' || css.visibility === 'hidden' || css.contentVisibility === 'hidden') sourceHidden = true;
			const z = Number.parseInt(css.zIndex, 10);
			if (Number.isFinite(z)) portalZ = Math.max(portalZ, z + 1);
			// The drawing is teleported outside its own note. Preserve clipping
			// from the surrounding scroller, but not the note's shadow boundary.
			if (ancestor !== note && ancestor !== window.document.body && ancestor !== window.document.documentElement && /(auto|scroll|hidden|clip)/.test(css.overflowY || css.overflow)) clipping.push(ancestor);
		}
		contextDirty = false;
	}

	function position() {
		if (disposed) return;
		if (!visible.value || window.document.hidden) {
			const wasVisible = portalVisible;
			portalVisible = false;
			layerStyle.value = { ...layerStyle.value, visibility: 'hidden' };
			tracking.delete(client);
			positioning.delete(client);
			if (wasVisible) reset(); else syncWind();
			return;
		}
		if (contextDirty) refreshContext();
		const note = host();
		if (!note) return;
		const rect = note.getBoundingClientRect();
		const frame = note.querySelector<HTMLElement>('[data-note-charm-frame="on"]');
		const frameRect = frame?.getBoundingClientRect();
		const scaleX = note.offsetWidth > 0 && rect.width > 0 ? rect.width / note.offsetWidth : 1;
		const scaleY = note.offsetHeight > 0 && rect.height > 0 ? rect.height / note.offsetHeight : 1;
		portalScaleX = scaleX;
		portalScaleY = scaleY;
		const anchorX = 3 + (frame?.dataset.noteCharmAttachment === 'frame' && frameRect ? (frameRect.right - rect.right) / scaleX : 0);
		let top = window.visualViewport?.offsetTop ?? 0;
		let bottom = top + (window.visualViewport?.height || window.innerHeight);
		for (const ancestor of clipping) {
			const bounds = ancestor.getBoundingClientRect();
			top = Math.max(top, bounds.top);
			bottom = Math.min(bottom, bounds.bottom);
		}
		top += stickyTop;
		bottom -= stickyBottom;
		attachmentTop.value = 32 + (frameRect ? (frameRect.top - rect.top) / scaleY : 0);
		const y = rect.top + attachmentTop.value * scaleY;
		const left = window.visualViewport?.offsetLeft ?? 0;
		let right = left + (window.visualViewport?.width || window.innerWidth);
		for (const { element, rect: bounds } of getExclusionBounds()) {
			// Notes inside a widget and floating windows retain their own drawing area.
			if (element.contains(note) || (portalWindow && !portalWindow.contains(element))) continue;
			if (bounds.right <= rect.right || bounds.bottom <= y || bounds.top >= y + geometry.value.height * scaleY) continue;
			right = Math.min(right, bounds.left);
		}
		const outside = rect.right + 3 * scaleX >= right || rect.right + geometry.value.railWidth * scaleX <= left || y >= bottom || y + geometry.value.height * scaleY <= top;
		const hidden = !visible.value || sourceHidden || !note.isConnected || outside || bottom <= top || window.document.hidden;
		layerStyle.value = { top: `${top}px`, height: `${Math.max(0, bottom - top)}px`, right: `${Math.max(0, window.innerWidth - right)}px`, zIndex: portalZ, visibility: hidden ? 'hidden' : 'visible' };
		if (!visible.value || sourceHidden || !note.isConnected || window.document.hidden) tracking.delete(client);
		portalStyle.value = {
			...theme, colorScheme, '--charm-width': `${portalSize}px`,
			'--note-charm-left': `${rect.right}px`,
			'--note-charm-top': `${rect.top + attachmentTop.value * scaleY - top}px`,
			transform: `scale(${scaleX}, ${scaleY})`,
		};
		if (geometry.value.width !== portalSize || geometry.value.anchorX !== anchorX || geometry.value.bodyHeight !== (options.artworkHeight?.() ?? portalSize * 1.15 + 7)) {
			geometry.value = charmGeometry(portalSize, anchorX, options.artworkHeight?.());
			draw();
		}
		restingRect = null;
		const wasVisible = portalVisible;
		portalVisible = !hidden;
		if (!portalVisible && wasVisible) reset(); else syncWind();
	}

	const client: CharmClient = {
		frame(dt) {
			if (!canMove.value || !portalVisible || window.document.hidden || grab || latched) return false;
			const driven = driveCharmScroll(state, scroll, dt);
			let force = 0;
			if (windElapsed !== null) {
				if (!canBlow() || !Number.isFinite(dt) || dt > .25) windElapsed = null;
				else {
					const step = clampCharm(dt, 0, .1);
					force = charmWindForce(windElapsed + step / 2, windStrength);
					windElapsed += step;
					if (windElapsed >= CHARM_WIND_DURATION) windElapsed = null;
				}
			}
			const moving = stepCharm(state, geometry.value, dt, force);
			draw();
			return moving || driven || windElapsed !== null;
		},
		wind(strength) {
			// Recheck clipping/focus at delivery, including changes since scheduling.
			position();
			if (!canBlow()) return;
			windElapsed = 0;
			windStrength = strength * windResponse;
			wake(client);
		},
		scroll(event, delta) {
			if (event.target instanceof Element && !event.target.contains(source())) return;
			if (grab || latched) reset();
			restingRect = null;
			if (visible.value) placeOnFrame(client);
			if (!canMove.value || !visible.value || window.document.hidden) return;
			if (!Number.isFinite(delta) || !delta) return;
			scroll.displacement += delta;
			wake(client);
		},
		pointer(event) {
			if (!event || !hover.value || !options.interactive() || !visible.value || held.value) { near.value = false; return; }
			restingRect ??= options.rail.value?.getBoundingClientRect() ?? null;
			if (!restingRect) return;
			const sx = restingRect.width > 0 ? restingRect.width / geometry.value.railWidth : 1;
			const sy = restingRect.height > 0 ? restingRect.height / geometry.value.height : 1;
			const center = restingRect.left + geometry.value.railWidth * sx / 2;
			const padding = near.value ? 28 : 18;
			near.value = event.clientX >= center - geometry.value.width * sx / 2 - padding && event.clientX <= center + geometry.value.width * sx / 2 + padding && event.clientY >= restingRect.top + CHARM_CORD_LENGTH * sy - padding && event.clientY <= restingRect.top + (CHARM_CORD_LENGTH + geometry.value.width * 1.2) * sy + padding;
		},
		reset,
		position,
		measure,
		transition(event, active) {
			if (!(event.target instanceof Element) || !event.target.contains(source())) return;
			const key = 'propertyName' in event ? String(event.propertyName) : 'animationName' in event ? String(event.animationName) : '';
			if ('propertyName' in event && !/^(transform|translate|scale|rotate|inset|top|left|right|bottom|width|height|margin|padding)/.test(key)) return;
			const keys = transitions.get(event.target) ?? new Set<string>();
			if (active) keys.add(key); else keys.delete(key);
			if (keys.size) transitions.set(event.target, keys); else transitions.delete(event.target);
			if (transitions.size && visible.value && !window.document.hidden) {
				tracking.add(client);
				placeOnFrame(client);
			} else {
				tracking.delete(client);
				placeOnFrame(client);
			}
		},
	};

	function toggle() {
		if (!options.interactive() || !visible.value || window.document.hidden) return;
		if (latched) { releaseHeld(); return; }
		sleep(client);
		rest();
		latched = true;
		held.value = true;
		near.value = false;
		state.liftX = 3;
		state.liftY = geometry.value.anchorY + 19 - geometry.value.restY;
		state.angle = -.035 * 180 / Math.PI;
		constrainCharm(state, geometry.value, true);
		draw();
		syncWind();
	}

	function pointerDown(event: PointerEvent) {
		if (!options.interactive() || !visible.value || window.document.hidden || grab || !event.isPrimary || event.button !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
		sleep(client);
		grab = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: state.liftX, startY: state.liftY, time: performance.now(), vx: 0, vy: 0 };
		state.releasing = false;
		state.velocity = state.stretchVelocity = state.liftVX = state.liftVY = 0;
		held.value = true;
		near.value = false;
		syncWind();
		try { options.button.value?.setPointerCapture(event.pointerId); } catch { reset(); return; }
		event.preventDefault();
	}

	function pointerMove(event: PointerEvent) {
		if (!grab || grab.id !== event.pointerId || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
		const now = performance.now();
		const dt = clampCharm((now - grab.time) / 1000, .008, .06);
		const x = state.liftX, y = state.liftY;
		const dx = (event.clientX - grab.x) / portalScaleX, dy = (event.clientY - grab.y) / portalScaleY;
		state.liftX = grab.startX + dx;
		state.liftY = grab.startY + dy;
		constrainCharm(state, geometry.value, true);
		grab.vx = clampCharm((state.liftX - x) / dt, -70, 70);
		grab.vy = clampCharm((state.liftY - y) / dt, -70, 70);
		state.angle = clampCharm(-grab.vx * .0007, -.045, .045) * 180 / Math.PI;
		state.velocity = 0;
		constrainCharm(state, geometry.value, true);
		// Discard travel beyond the chain/rail limits so reversing the finger
		// immediately moves the charm instead of repaying that excess distance.
		grab.x = event.clientX;
		grab.y = event.clientY;
		grab.startX = state.liftX;
		grab.startY = state.liftY;
		grab.time = now;
		draw();
		event.preventDefault();
	}

	function pointerEnd(event: PointerEvent) {
		if (!grab || grab.id !== event.pointerId) return;
		const current = grab;

		releaseCapture();
		suppressClickUntil = performance.now() + 500;
		latched = false;
		held.value = false;

		syncWind();
		if (!canMove.value) { rest(); return; }
		const fresh = performance.now() - current.time < 100;
		state.liftVX = fresh ? clampCharm(current.vx, -36, 36) : 0;
		state.liftVY = fresh ? clampCharm(current.vy, -45, 45) : 0;
		releaseCharm(state);
		wake(client);
	}

	function releaseHeld() {
		if (!held.value) return;
		releaseCapture(); latched = false; held.value = false; syncWind();
		if (!canMove.value) rest(); else { releaseCharm(state); wake(client); }
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); releaseHeld(); } else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) toggle(); }
	}

	function blur() { if (latched) releaseHeld(); }

	function click(event: MouseEvent) {
		if (grab || event.detail > 0 || performance.now() < suppressClickUntil) return;
		toggle();
	}

	function mediaChange() {
		reducedMotion.value = motionQuery?.matches ?? true;
		hover.value = hoverQuery?.matches ?? false;
		reset();
	}

	watch([canMove, () => options.interactive()], reset);
	watch(() => options.wind?.() ?? true, syncWind);
	watch([() => options.size(), () => options.artworkHeight?.()], measure);

	function observeSource() {
		observer?.disconnect();
		observer = undefined;
		resize?.disconnect();
		attributes?.disconnect();
		transitions.clear();
		portalVisible = false;
		visible.value = false;
		reset();
		dispose?.();
		dispose = undefined;
		if (!source()) {
			layerStyle.value = { visibility: 'hidden' };
			return;
		}
		// Collect observer targets without layout reads, even if the document
		// is hidden and position() defers its first context refresh.
		ancestors = [];
		for (let ancestor = source()?.parentElement; ancestor; ancestor = ancestor.parentElement) ancestors.push(ancestor);
		visible.value = true;
		dispose = register(client, source());
		measure();
		if (typeof IntersectionObserver !== 'undefined' && options.rail.value) {
			const sourceObserver = new IntersectionObserver(entries => {
				// A disconnected observer can still have a queued notification.
				if (disposed || observer !== sourceObserver) return;
				// Each observer tracks one note. Zoom/resize changes can arrive
				// together, so the final entry is the current visibility.
				const latest = entries.at(-1);
				if (!latest) return;
				visible.value = latest.isIntersecting;
				if (!visible.value) { tracking.delete(client); reset(); } else if (transitions.size && !window.document.hidden) { tracking.add(client); placeOnFrame(client); }
				position();
			});
			observer = sourceObserver;
			observer.observe(host()!);
		}
		if (typeof ResizeObserver !== 'undefined' && options.pendulum.value) {
			resize = new ResizeObserver(measure);
			resize.observe(options.pendulum.value);
			const note = host();
			const frame = note?.querySelector<HTMLElement>('[data-note-charm-frame="on"]');
			if (note) resize.observe(note);
			if (frame) resize.observe(frame);
			if (options.source.value) {
				resize.observe(options.source.value);
				for (const ancestor of ancestors) resize.observe(ancestor);
			}
		}
		if (typeof MutationObserver !== 'undefined') {
			attributes = new MutationObserver(() => { contextDirty = true; if (!disposed && visible.value) placeOnFrame(client); });
			for (const ancestor of ancestors) attributes.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class', 'inert', 'hidden'] });
		}
	}

	onMounted(() => {
		motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
		mediaChange();
		motionQuery.addEventListener('change', mediaChange);
		hoverQuery.addEventListener('change', mediaChange);
		observeSource();
		// A responsive device gate can remove and later recreate the source/portal.
		watch(options.source, observeSource, { flush: 'post' });
	});
	onBeforeUnmount(() => {
		disposed = true;
		reset();
		dispose?.();
		observer?.disconnect();
		resize?.disconnect();
		attributes?.disconnect();
		motionQuery?.removeEventListener('change', mediaChange);
		hoverQuery?.removeEventListener('change', mediaChange);
	});
	return { pose, geometry, attachmentTop, portalStyle, layerStyle, portalInert, held, near, canMove, pointerDown, pointerMove, pointerEnd, click, keydown, blur, reset };
}
