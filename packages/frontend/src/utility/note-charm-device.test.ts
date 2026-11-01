/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { effectScope } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isNoteCharmMobileDisplay, isNoteCharmSmartphone, useNoteCharmMobileDisplay } from './note-charm-device.js';

const shell = vi.hoisted(() => ({ ui: 'simple' as string | null }));
vi.mock('@@/js/config.js', () => shell);

afterEach(() => vi.unstubAllGlobals());

describe('note charm smartphone availability', () => {
	test.each([
		['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'],
		['iPhone PWA', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'],
		['iPod', 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'],
		['Android Chrome', 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'],
		['Android Firefox', 'Mozilla/5.0 (Android 16; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0'],
		['generic mobile browser', 'Mozilla/5.0 Mobile Safari/537.36'],
	])('excludes %s in both portrait and landscape', (_name, userAgent) => {
		for (const innerWidth of [390, 932]) {
			vi.stubGlobal('innerWidth', innerWidth);
			expect(isNoteCharmSmartphone({ userAgent, maxTouchPoints: 5 })).toBe(true);
		}
	});

	test('uses the mobile client hint when the user agent omits a phone marker', () => {
		expect(isNoteCharmSmartphone({ userAgent: 'Mozilla/5.0', maxTouchPoints: 5, userAgentData: { mobile: true } })).toBe(true);
	});

	test.each([
		['iPad mobile mode', 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 5],
		['iPad desktop mode', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', 5],
		['Android tablet', 'Mozilla/5.0 (Linux; Android 16; SM-X926B) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', 10],
		['macOS Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', 0],
		['Windows touch laptop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36', 10],
		['Linux desktop', 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/145.0', 0],
	])('keeps %s available even in a narrow window', (_name, userAgent, maxTouchPoints) => {
		vi.stubGlobal('innerWidth', 390);
		expect(isNoteCharmSmartphone({ userAgent, maxTouchPoints, userAgentData: { mobile: false } })).toBe(false);
	});

	test('detects an iPhone from the current browser navigator', () => {
		vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
		expect(isNoteCharmSmartphone()).toBe(true);
	});
});

describe('note charm mobile layout availability', () => {
	test.each([
		['simple', 1099, true], ['simple', 1100, false],
		['default', 500, true], ['default', 501, false],
		[null, 1099, true], [null, 1100, false],
		['friendly', 1099, true], ['friendly', 1100, false],
		['unknown', 1099, true], ['unknown', 1100, false],
	])('follows the %s shell at %s px', (ui, width, expected) => {
		shell.ui = ui;
		vi.stubGlobal('navigator', { userAgent: 'desktop', maxTouchPoints: 0 });
		vi.stubGlobal('innerWidth', width);
		expect(isNoteCharmMobileDisplay()).toBe(expected);
	});

	test('keeps phones disabled at desktop width', () => {
		shell.ui = 'simple';
		vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
		vi.stubGlobal('innerWidth', 1400);
		expect(isNoteCharmMobileDisplay()).toBe(true);
	});

	test('shares one resize listener and restores desktop availability without remounting', () => {
		shell.ui = 'simple';
		vi.stubGlobal('navigator', { userAgent: 'desktop', maxTouchPoints: 0 });
		vi.stubGlobal('innerWidth', 1400);
		const add = vi.spyOn(window, 'addEventListener');
		const remove = vi.spyOn(window, 'removeEventListener');
		const first = effectScope();
		const second = effectScope();
		try {
			const a = first.run(useNoteCharmMobileDisplay)!;
			const b = second.run(useNoteCharmMobileDisplay)!;
			expect(a.value).toBe(false);
			expect(b.value).toBe(false);
			expect(add.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
			vi.stubGlobal('innerWidth', 390);
			window.dispatchEvent(new Event('resize'));
			expect(a.value).toBe(true);
			expect(b.value).toBe(true);
			first.stop();
			expect(remove.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(0);
			vi.stubGlobal('innerWidth', 1400);
			window.dispatchEvent(new Event('resize'));
			expect(b.value).toBe(false);
			second.stop();
			expect(remove.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
		} finally {
			first.stop(); second.stop(); add.mockRestore(); remove.mockRestore();
		}
	});
});
