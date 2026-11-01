/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type NoteCharm = {
	url: string;
	size: number;
	pattern: 'cutout' | 'clear' | 'dots' | 'stripes' | 'check';
	color: string;
};

export const CHARM_MIN_SIZE = 48;
export const CHARM_MAX_SIZE = 64;
export const CHARM_DEFAULT_SIZE = 60;
export const CHARM_COMPACT_MAX_SIZE = 56;
export const CHARM_CORD_LENGTH = 60;
export const CHARM_RAIL_WIDTH = 110;
// Scale forces and damping, not elapsed time, to keep the integration cost fixed.
const CHARM_MOTION_SPEED = 2;
// A faster scroll response needs less launch gain than the full motion speed.
const CHARM_SCROLL_IMPULSE_GAIN = 1.7;
export const CHARM_WIND_DURATION = 2.8 / CHARM_MOTION_SPEED;
export const clampCharm = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type Point = { x: number; y: number };

export function charmWindForce(elapsed: number, strength: number): number {
	if (!Number.isFinite(elapsed) || !Number.isFinite(strength) || elapsed <= 0 || elapsed >= CHARM_WIND_DURATION) return 0;
	const phase = elapsed / CHARM_WIND_DURATION;
	return 560 * CHARM_MOTION_SPEED ** 2 * clampCharm(Math.abs(strength), 0, 1) * Math.sin(Math.PI * phase) ** 2 * (1 + .07 * Math.sin(phase * 5 * Math.PI));
}
export function createCharmState() {
	return { angle: 0, velocity: 0, stretch: 0, stretchVelocity: 0, liftX: 0, liftY: 0, liftVX: 0, liftVY: 0, releasing: false };
}
export function createCharmScrollState() { return { displacement: 0, velocity: 0 }; }
export type CharmScrollState = ReturnType<typeof createCharmScrollState>;
export type CharmState = ReturnType<typeof createCharmState>;
export type CharmGeometry = ReturnType<typeof charmGeometry>;

export function releaseCharm(state: CharmState) {
	state.releasing = state.liftY < -1;
}

export function charmGeometry(requestedWidth: number, anchorX = 3, requestedHeight?: number) {
	const width = clampCharm(Number.isFinite(requestedWidth) ? requestedWidth : CHARM_DEFAULT_SIZE, CHARM_MIN_SIZE, CHARM_MAX_SIZE);
	const bodyHeight = Number.isFinite(requestedHeight) ? clampCharm(requestedHeight!, 40, 110) : width * 1.15 + 7;
	// Keep the body outside the original note even when a framed note's hole is inset.
	const restX = width / 2 + 3;
	const pin = Math.max(restX - CHARM_CORD_LENGTH + .1, Number.isFinite(anchorX) ? anchorX : 3);
	const restY = 4 + Math.sqrt(CHARM_CORD_LENGTH ** 2 - (restX - pin) ** 2);
	return { width, bodyHeight, railWidth: CHARM_RAIL_WIDTH, height: CHARM_CORD_LENGTH + bodyHeight + 16, maxAngle: .14 * 180 / Math.PI, anchorX: pin, anchorY: 4, restX, restY };
}
export function kickCharm(state: CharmState, amount: number) {
	const impulse = clampCharm(Number.isFinite(amount) ? amount : 0, -1600, 1600);
	// A scroll acceleration lifts the chain into a small slack arc. Gravity
	// brings it back down; the outward velocity keeps both directions of
	// scrolling away from the note text. Never override a hand release.
	if (state.releasing) return;
	if (!impulse) return;
	state.liftVX = clampCharm(state.liftVX + Math.abs(impulse) * .1 * CHARM_SCROLL_IMPULSE_GAIN, -50 * CHARM_SCROLL_IMPULSE_GAIN, 50 * CHARM_SCROLL_IMPULSE_GAIN);
	state.liftVY = clampCharm(state.liftVY - Math.abs(impulse) * .22 * CHARM_SCROLL_IMPULSE_GAIN, -96 * CHARM_SCROLL_IMPULSE_GAIN, 96 * CHARM_SCROLL_IMPULSE_GAIN);
}
export function driveCharmScroll(state: CharmState, scroll: CharmScrollState, elapsed: number): boolean {
	if (!Number.isFinite(elapsed) || elapsed > .25) { Object.assign(scroll, createCharmScrollState()); return false; }
	const dt = clampCharm(elapsed, 0, .05);
	if (!dt) return scroll.displacement !== 0 || scroll.velocity !== 0;
	const speed = clampCharm(scroll.displacement / dt, -1600, 1600), previous = scroll.velocity;
	scroll.velocity += (speed - previous) * (1 - Math.exp(-dt / (.08 / CHARM_MOTION_SPEED)));
	if (!speed && Math.abs(scroll.velocity) < .1) scroll.velocity = 0;
	scroll.displacement = 0;
	kickCharm(state, scroll.velocity - previous);
	return scroll.velocity !== 0;
}
export function constrainCharm(state: CharmState, geometry: CharmGeometry, held = false) {
	const a = clampCharm(state.angle * Math.PI / 180, -.14, .14);
	state.angle = a * 180 / Math.PI;
	const left = geometry.width / 2 * Math.cos(a) + Math.max(0, Math.sin(a) * geometry.bodyHeight) + 3;
	const right = Math.min(geometry.anchorX + CHARM_CORD_LENGTH, 106 - geometry.width / 2 * Math.cos(a) - Math.max(0, -Math.sin(a) * geometry.bodyHeight));
	let x = clampCharm(geometry.restX + state.liftX, left, Math.max(left, right));
	let beforeY = geometry.restY + state.liftY;
	const distance = Math.hypot(x - geometry.anchorX, beforeY - geometry.anchorY);
	const taut = !held && distance > CHARM_CORD_LENGTH;
	if (taut) {
		// Project both coordinates onto the cord's circle. Clamping only y locks
		// a horizontal cord at its reach limit, even while gravity builds speed.
		const scale = CHARM_CORD_LENGTH / distance;
		x = clampCharm(geometry.anchorX + (x - geometry.anchorX) * scale, left, Math.max(left, right));
		beforeY = geometry.anchorY + (beforeY - geometry.anchorY) * scale;
	}
	const dx = x - geometry.anchorX, drop = Math.sqrt(Math.max(0, CHARM_CORD_LENGTH ** 2 - dx ** 2));
	const bottom = geometry.anchorY + drop;
	const y = clampCharm(beforeY, Math.max(-10, geometry.anchorY - drop), bottom);
	if (taut || y !== beforeY) {
		const nx = dx / CHARM_CORD_LENGTH, ny = (y - geometry.anchorY) / CHARM_CORD_LENGTH;
		const radial = state.liftVX * nx + state.liftVY * ny;
		if (radial > 0) { state.liftVX -= radial * nx; state.liftVY -= radial * ny; }
	}
	if (!held && x <= left + .01 && state.liftVX < 0) { state.liftVX = 0; if (y >= bottom - .01 && state.liftVY > 0) state.liftVY = 0; }
	if (!held && x >= right - .01 && state.liftVX > 0) state.liftVX = 0;
	state.liftX = x - geometry.restX; state.liftY = y - geometry.restY;
}
export function stepCharm(state: CharmState, geometry: CharmGeometry, elapsed: number, windAcceleration = 0): boolean {
	const dt = clampCharm(Number.isFinite(elapsed) ? elapsed : 0, 0, .1);
	const wind = clampCharm(Number.isFinite(windAcceleration) ? windAcceleration : 0, 0, 650 * CHARM_MOTION_SPEED ** 2);
	const steps = Math.max(1, Math.ceil(dt / (1 / 120))), sub = dt / steps;
	const restAngle = Math.atan2(geometry.restX - geometry.anchorX, geometry.restY - geometry.anchorY);
	for (let n = 0; n < steps; n++) {
		// Hand releases already fall promptly; accelerate ordinary wind and scroll motion.
		const gravity = state.releasing ? 5400 : 1150 * CHARM_MOTION_SPEED ** 2 / (1 + geometry.bodyHeight / 120);
		state.liftVX = (state.liftVX + wind * sub) * Math.exp(-1.4 * CHARM_MOTION_SPEED * sub);
		state.liftVY = (state.liftVY + gravity * sub) * Math.exp(-.7 * CHARM_MOTION_SPEED * sub);
		state.liftX += state.liftVX * sub; state.liftY += state.liftVY * sub;
		constrainCharm(state, geometry);
		const target = -(Math.atan2(geometry.restX + state.liftX - geometry.anchorX, Math.max(12, geometry.restY + state.liftY - geometry.anchorY)) - restAngle) * .58;
		let angle = state.angle * Math.PI / 180, velocity = state.velocity * Math.PI / 180;
		velocity += ((target - angle) * 64 * CHARM_MOTION_SPEED ** 2 * (60 / geometry.width) - velocity * 10 * CHARM_MOTION_SPEED) * sub;
		angle = clampCharm(angle + velocity * sub, -.14, .14);
		state.angle = angle * 180 / Math.PI; state.velocity = velocity * 180 / Math.PI;
		constrainCharm(state, geometry);
		if (state.liftY >= -1) state.releasing = false;
	}
	if (!wind && Math.abs(state.liftX) < .045 && Math.abs(state.liftY) < .045 && Math.abs(state.liftVX) < .15 && Math.abs(state.liftVY) < .15 && Math.abs(state.angle) < .001 * 180 / Math.PI && Math.abs(state.velocity) < .003 * 180 / Math.PI) {
		Object.assign(state, createCharmState()); return false;
	}
	return true;
}

function chainPoints(a: Point, b: Point, length: number) {
	const direct = Math.hypot(b.x - a.x, b.y - a.y);
	if (direct >= length - .025) return Array.from({ length: 25 }, (_, i) => ({
		x: a.x + (b.x - a.x) * i / 24,
		y: a.y + (b.y - a.y) * i / 24,
	}));
	const spread = Math.min(16, (length - direct) * .55);

	function samples(sag: number) {
		const first = { x: a.x + (b.x - a.x) / 3 - spread, y: a.y + (b.y - a.y) / 3 + sag };
		const second = { x: a.x + (b.x - a.x) * 2 / 3 + spread, y: a.y + (b.y - a.y) * 2 / 3 + sag };
		return Array.from({ length: 33 }, (_, i) => {
			const t = i / 32, u = 1 - t;
			return {
				x: u * u * u * a.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t * t * t * b.x,
				y: u * u * u * a.y + 3 * u * u * t * first.y + 3 * u * t * t * second.y + t * t * t * b.y,
			};
		});
	}

	const arc = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
	let low = 0, high = length * 1.5;
	for (let i = 0; i < 16; i++) {
		const mid = (low + high) / 2;
		if (arc(samples(mid)) > length) high = mid; else low = mid;
	}
	return samples((low + high) / 2);
}

function atDistance(points: Point[], distance: number) {
	let traversed = 0;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1], b = points[i], segment = Math.hypot(b.x - a.x, b.y - a.y);
		if (traversed + segment >= distance) {
			const t = segment ? (distance - traversed) / segment : 0;
			return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
		}
		traversed += segment;
	}
	return points[points.length - 1];
}

export function getCharmPose(state: CharmState, geometry: CharmGeometry) {
	const eyeX = geometry.restX + state.liftX, eyeY = geometry.restY + state.liftY;
	const points = chainPoints({ x: geometry.anchorX, y: geometry.anchorY }, { x: eyeX, y: eyeY }, CHARM_CORD_LENGTH);
	const a = state.angle * Math.PI / 180, holeX = eyeX - Math.sin(a) * 3.5, holeY = eyeY + 1 + Math.cos(a) * 3.5;
	return {
		eyeX, eyeY, points,
		balls: Array.from({ length: 15 }, (_, i) => atDistance(points, 2 + i * 4)),
		ring: { x: (eyeX + holeX) / 2, y: (eyeY + holeY) / 2, ry: Math.hypot(holeX - eyeX, holeY - eyeY) / 2 + .55, angle: Math.atan2(eyeX - holeX, holeY - eyeY) * 180 / Math.PI },
		chain: points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' '),
		transform: `translate(${(eyeX - geometry.width / 2).toFixed(3)}px, ${(eyeY + 1).toFixed(3)}px) rotate(${state.angle.toFixed(3)}deg)`,
		stretch: '0px',
	};
}
