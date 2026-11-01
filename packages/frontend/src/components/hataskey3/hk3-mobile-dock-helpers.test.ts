/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { containsPoint, mobileArrowOffset, mobileEdgeScroll, moveMobileChoice } from './hk3-mobile-dock-helpers.js';

const viewport = { left: 10, right: 210, top: 50, bottom: 250, height: 200 };
describe('mobile dock geometry and reorder', () => {
	it('never hits empty or clipped geometry', () => {
		expect(containsPoint(viewport, 10, 50)).toBe(true);
		expect(containsPoint(viewport, 9, 50)).toBe(false);
		expect(containsPoint({ left: 0, right: 0, top: 0, bottom: 0 }, 0, 0)).toBe(false);
	});
	it('scrolls proportionally only inside viewport edges with bounded frame time', () => {
		expect(mobileEdgeScroll(viewport, 100, 50, 16)).toBe(-5.12);
		expect(mobileEdgeScroll(viewport, 100, 250, 16)).toBe(5.12);
		expect(mobileEdgeScroll(viewport, 100, 150, 16)).toBe(0);
		expect(mobileEdgeScroll(viewport, 211, 250, 16)).toBe(0);
		expect(mobileEdgeScroll(viewport, 100, 250, 1000)).toBe(10.24);
	});
	it('moves within the same grid column or across columns without losing IDs', () => {
		const ids = ['antenna', 'list', 'global', 'home'];
		expect(moveMobileChoice(ids, 'antenna', 2)).toEqual(['list', 'global', 'antenna', 'home']);
		expect(moveMobileChoice(ids, 'home', -1)).toEqual(['home', 'antenna', 'list', 'global']);
		expect(moveMobileChoice(ids, 'missing', 0)).toBe(ids);
		expect(ids).toEqual(['antenna', 'list', 'global', 'home']);
		expect(mobileArrowOffset('ArrowDown', 2)).toBe(2);
		expect(mobileArrowOffset('ArrowDown', 1)).toBe(1);
		expect(mobileArrowOffset('ArrowLeft', 2)).toBe(-1);
		expect(mobileArrowOffset('Escape', 2)).toBeNull();
	});
});
