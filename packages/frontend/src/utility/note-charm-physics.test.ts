/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test } from 'vitest';
import { charmGeometry, charmWindForce, constrainCharm, createCharmScrollState, createCharmState, driveCharmScroll, getCharmPose, kickCharm, releaseCharm, stepCharm, CHARM_CORD_LENGTH, CHARM_WIND_DURATION } from './note-charm-physics.js';

const arc = (points: { x: number; y: number }[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
describe('approved acrylic endpoint motion', () => {
	test('rests on the note edge on a fixed 60px chain', () => {
		const geometry = charmGeometry(60), pose = getCharmPose(createCharmState(), geometry);
		expect(CHARM_CORD_LENGTH).toBe(60);
		expect(pose.eyeX).toBe(33);
		expect(pose.eyeY).toBeCloseTo(4 + Math.sqrt(3600 - 900));
		expect(arc(pose.points)).toBeCloseTo(60, 2);
	});
	test('lifting produces gravity-facing slack without stretching the chain', () => {
		const geometry = charmGeometry(60), state = { ...createCharmState(), liftX: 3, liftY: -35 };
		constrainCharm(state, geometry);
		const pose = getCharmPose(state, geometry);
		expect(arc(pose.points)).toBeCloseTo(60, 2);
		expect(Math.max(...pose.points.map(p => p.y))).toBeGreaterThan(pose.eyeY);
		expect(pose.balls).toHaveLength(15);
		expect(pose.transform).toContain('translate(6.000px,');
	});
	test('a released lifted body falls under gravity rather than a restoring spring', () => {
		const geometry = charmGeometry(60), state = { ...createCharmState(), liftY: -30 };
		stepCharm(state, geometry, 1 / 120);
		expect(state.liftVY).toBeGreaterThan(4);
		expect(state.liftY).toBeGreaterThan(-30);
		for (let i = 0; i < 2400; i++) stepCharm(state, geometry, 1 / 120);
		expect(state).toEqual(createCharmState());
	});
	test.each([30, 60, 120])('scroll-driven vertical motion stays bounded and settles at %s fps', fps => {
		for (const width of [48, 60, 64]) {
			const geometry = charmGeometry(width), state = createCharmState(), scroll = createCharmScrollState();
			let highest = 0, previousY = 0, largestStep = 0, active = false;
			let firstReturn = Infinity, settledAt = Infinity, previousVelocity = 0;
			for (let frame = 0; frame < fps * 4; frame++) {
				scroll.displacement = frame < fps / 4 ? 600 / fps : 0;
				const driven = driveCharmScroll(state, scroll, 1 / fps);
				const moving = stepCharm(state, geometry, 1 / fps);
				active = driven || moving;
				if (previousVelocity < 0 && state.liftVY >= 0) firstReturn = Math.min(firstReturn, (frame + 1) / fps);
				if (!active && frame >= fps / 4) settledAt = Math.min(settledAt, (frame + 1) / fps);
				previousVelocity = state.liftVY;
				highest = Math.min(highest, state.liftY);
				largestStep = Math.max(largestStep, Math.abs(state.liftY - previousY));
				previousY = state.liftY;
				expect(Math.hypot(geometry.restX + state.liftX - geometry.anchorX, geometry.restY + state.liftY - geometry.anchorY)).toBeLessThanOrEqual(60.001);
			}
			expect(highest).toBeLessThan(-2);
			expect(highest).toBeGreaterThan(-16);
			expect(largestStep).toBeLessThan(3);
			expect(firstReturn).toBeLessThanOrEqual(.2);
			expect(settledAt).toBeLessThan(1.2);
			expect(active).toBe(false);
			expect(state).toEqual(createCharmState());
		}
	});
	test.each([48, 60, 64])('a width %s charm released with a horizontal chain falls instead of sticking at its reach limit', width => {
		const geometry = charmGeometry(width, 3, 110);
		const state = { ...createCharmState(), liftX: geometry.anchorX + 60 - geometry.restX, liftY: geometry.anchorY - geometry.restY };
		constrainCharm(state, geometry, true);
		const releaseY = geometry.restY + state.liftY;
		for (let frame = 0; frame < 15; frame++) {
			stepCharm(state, geometry, 1 / 60);
			const pose = getCharmPose(state, geometry);
			expect(Math.hypot(pose.eyeX - geometry.anchorX, pose.eyeY - geometry.anchorY)).toBeLessThanOrEqual(60.001);
		}
		expect(geometry.restY + state.liftY).toBeGreaterThan(releaseY + 10);
		for (let frame = 0; frame < 180; frame++) stepCharm(state, geometry, 1 / 60);
		expect(state).toEqual(createCharmState());
	});
	test.each([120, 60, 30, 15])('a released charm keeps falling in real time at %s fps', fps => {
		const geometry = charmGeometry(60, 3, 110);
		const state = { ...createCharmState(), liftY: -60 };
		for (let frame = 0; frame < fps / 3; frame++) stepCharm(state, geometry, 1 / fps);
		// Ordinary motion returns promptly, even when the renderer supplies fewer frames.
		expect(Math.abs(state.liftY)).toBeLessThan(1);
	});
	test.each([40, 76, 110])('releasing a height %spx charm drops 30–60px within 220ms without changing its launch velocity', height => {
		const geometry = charmGeometry(60, 3, height);
		for (const liftY of [-30, -60]) for (const liftVY of [-45, 0, 45]) {
			const state = { ...createCharmState(), liftY, liftVY };
			releaseCharm(state);
			expect(state.liftVY).toBe(liftVY);
			for (let frame = 0; frame < 26; frame++) stepCharm(state, geometry, 1 / 120);
			expect(Math.abs(state.liftY)).toBeLessThanOrEqual(1);
			expect(state.releasing).toBe(false);
		}
	});
	test.each([48, 60, 64])('a width %spx charm released at the horizontal reach limit returns within 250ms', width => {
		const geometry = charmGeometry(width, 3, 110);
		for (const liftVY of [-45, 0, 45]) {
			const state = { ...createCharmState(), liftX: geometry.anchorX + 60 - geometry.restX, liftY: geometry.anchorY - geometry.restY, liftVY };
			releaseCharm(state);
			for (let frame = 0; frame < 30; frame++) stepCharm(state, geometry, 1 / 120);
			expect(Math.abs(state.liftY)).toBeLessThanOrEqual(1);
			expect(state.releasing).toBe(false);
		}
	});
	test('an idle scroll driver preserves the velocity gained during a hand release', () => {
		const state = { ...createCharmState(), liftY: -60, liftVX: 80, liftVY: 200 };
		releaseCharm(state);
		const before = { ...state };
		expect(driveCharmScroll(state, createCharmScrollState(), 1 / 60)).toBe(false);
		expect(state).toEqual(before);
	});
	test.each([0, -600, 600])('release still falls within 200ms when the scroll driver has velocity %s', velocity => {
		const geometry = charmGeometry(60, 3, 110);
		const state = { ...createCharmState(), liftY: -60, liftVY: -45 };
		const scroll = { ...createCharmScrollState(), velocity };
		releaseCharm(state);
		for (let frame = 0; frame < 12; frame++) {
			driveCharmScroll(state, scroll, 1 / 60);
			stepCharm(state, geometry, 1 / 60);
		}
		expect(Math.abs(state.liftY)).toBeLessThanOrEqual(1);
		expect(state.releasing).toBe(false);
	});
	test('outward gusts move the endpoint and independently tilt the plate', () => {
		const geometry = charmGeometry(60), state = createCharmState();
		for (let i = 0; i < CHARM_WIND_DURATION * .65 * 60; i++) stepCharm(state, geometry, 1 / 60, charmWindForce(i / 60, 1));
		expect(state.liftX).toBeGreaterThan(2);
		expect(state.angle).toBeLessThan(0);
		for (let i = 0; i < 1800; i++) stepCharm(state, geometry, 1 / 120);
		expect(state).toEqual(createCharmState());
	});
	test.each([30, 60, 120])('a gust starts promptly and finishes within two seconds at %s fps', fps => {
		const geometry = charmGeometry(60), state = createCharmState();
		let firstMovement = Infinity, settledAt = Infinity, peak = 0;
		for (let frame = 0; frame < fps * 4; frame++) {
			const elapsed = (frame + 1) / fps;
			const moving = stepCharm(state, geometry, 1 / fps, charmWindForce(elapsed, 1));
			peak = Math.max(peak, state.liftX);
			if (state.liftX > .5) firstMovement = Math.min(firstMovement, elapsed);
			if (!moving && elapsed >= CHARM_WIND_DURATION) settledAt = Math.min(settledAt, elapsed);
		}
		expect(firstMovement).toBeLessThan(.7);
		expect(settledAt).toBeLessThan(2);
		expect(peak).toBeGreaterThan(5);
		expect(peak).toBeLessThan(15);
		expect(state).toEqual(createCharmState());
	});
	test.each([48, 60, 64])('keeps all rotated plate corners outside the note and inside its rail at width %s', width => {
		const geometry = charmGeometry(width, 3, 110), state = createCharmState();
		for (let i = 0; i < 800; i++) {
			kickCharm(state, i % 2 ? 1600 : -1600);
			stepCharm(state, geometry, 1 / 60, charmWindForce(CHARM_WIND_DURATION / 2, 1));
			const pose = getCharmPose(state, geometry), a = state.angle * Math.PI / 180;
			expect(Math.hypot(pose.eyeX - geometry.anchorX, pose.eyeY - 4)).toBeLessThanOrEqual(60.001);
			for (const x of [-width / 2, width / 2]) for (const y of [0, 110]) {
				const px = pose.eyeX + Math.cos(a) * x - Math.sin(a) * y;
				expect(px).toBeGreaterThanOrEqual(2.99);
				expect(px).toBeLessThanOrEqual(geometry.railWidth - 4 + .01);
			}
		}
	});
	test('scroll impulses lift outward for either scroll direction and stop after suspension', () => {
		for (const sign of [-1, 1]) {
			const state = createCharmState(); kickCharm(state, sign * 600);
			expect(state.liftVX).toBeGreaterThan(0);
			expect(state.liftVY).toBeLessThan(0);
			const extreme = createCharmState(); kickCharm(extreme, sign * 1_000_000);
			expect(extreme.liftVX).toBe(state.liftVX);
			expect(extreme.liftVY).toBe(state.liftVY);
		}
		const state = createCharmState(), scroll = { displacement: 1000, velocity: 600 };
		expect(driveCharmScroll(state, scroll, 1)).toBe(false);
		expect(scroll).toEqual(createCharmScrollState());
		expect(state).toEqual(createCharmState());
	});
	test.each([-20, 20])('a single %spx scroll moves the charm sideways and vertically before returning to rest', displacement => {
		const geometry = charmGeometry(64), state = createCharmState();
		const scroll = { ...createCharmScrollState(), displacement };
		let peak = 0, highest = 0, previousY = 0, largestStep = 0, active = true;
		for (let frame = 0; frame < 120; frame++) {
			const driven = driveCharmScroll(state, scroll, 1 / 60);
			const moving = stepCharm(state, geometry, 1 / 60);
			active = driven || moving;
			peak = Math.max(peak, state.liftX);
			highest = Math.min(highest, state.liftY);
			largestStep = Math.max(largestStep, Math.abs(state.liftY - previousY));
			previousY = state.liftY;
		}
		expect(peak).toBeGreaterThan(1);
		expect(peak).toBeLessThan(12);
		expect(highest).toBeLessThan(-2);
		expect(highest).toBeGreaterThan(-12);
		expect(largestStep).toBeLessThan(2);
		expect(active).toBe(false);
		expect(state).toEqual(createCharmState());
	});
	test.each([-20, 20])('steady %spx scroll frames settle after the initial acceleration', displacement => {
		const geometry = charmGeometry(64), state = createCharmState(), scroll = createCharmScrollState();
		let peak = 0;
		for (let frame = 0; frame < 120; frame++) {
			scroll.displacement = displacement;
			driveCharmScroll(state, scroll, 1 / 60);
			stepCharm(state, geometry, 1 / 60);
			peak = Math.max(peak, state.liftX);
		}
		expect(peak).toBeGreaterThan(.5);
		expect(peak).toBeLessThan(20);
		expect(state).toEqual(createCharmState());
	});
	test('gust fades to quiet at both ends and rejects nonfinite input', () => {
		for (const t of [0, CHARM_WIND_DURATION, Infinity, NaN]) expect(charmWindForce(t, 1)).toBe(0);
		expect(charmWindForce(CHARM_WIND_DURATION / 2, 1)).toBeGreaterThan(500);
		expect(charmWindForce(1, NaN)).toBe(0);
	});
});
