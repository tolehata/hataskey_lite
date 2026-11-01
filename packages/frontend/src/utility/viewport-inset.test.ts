/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getViewportTopInset, initViewportInset, isIOSDevice } from './viewport-inset.js';

afterEach(() => {
	vi.unstubAllGlobals();
	window.document.documentElement.removeAttribute('data-ios-top-inset');
	window.document.documentElement.style.removeProperty('--MI-fixed-top-inset');
});

describe('iOS top-edge inset', () => {
	test.each([
		['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1', 5],
		['iPhone PWA', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 5],
		['iPad mobile mode', 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 5],
		['iPad desktop mode', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', 5],
	])('reserves space on %s', (_label, userAgent, maxTouchPoints) => {
		expect(isIOSDevice({ userAgent, maxTouchPoints })).toBe(true);
		vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
		initViewportInset();
		expect(window.document.documentElement.hasAttribute('data-ios-top-inset')).toBe(true);
	});

	test.each([
		['macOS Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', 0],
		['Windows touch screen', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', 10],
		['Android phone', 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36', 5],
		['Android tablet', 'Mozilla/5.0 (Linux; Android 16; SM-X926B) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', 10],
	])('keeps the original layout on %s', (_label, userAgent, maxTouchPoints) => {
		window.document.documentElement.setAttribute('data-ios-top-inset', '');
		expect(isIOSDevice({ userAgent, maxTouchPoints })).toBe(false);
		vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
		initViewportInset();
		expect(window.document.documentElement.hasAttribute('data-ios-top-inset')).toBe(false);
	});

	test('reads the local fixed-position boundary without double-counting an inset shell', () => {
		window.document.documentElement.style.setProperty('--MI-fixed-top-inset', '16px');
		expect(getViewportTopInset()).toBe(16);
		const containedShell = window.document.createElement('div');
		containedShell.style.setProperty('--MI-fixed-top-inset', '0px');
		window.document.body.append(containedShell);
		try {
			expect(getViewportTopInset(containedShell)).toBe(0);
		} finally {
			containedShell.remove();
		}
	});

	test.each(['', '-16px', 'NaN', 'Infinity'])('ignores an invalid or absent CSS inset: %s', value => {
		window.document.documentElement.style.setProperty('--MI-fixed-top-inset', value);
		expect(getViewportTopInset()).toBe(0);
	});
});
