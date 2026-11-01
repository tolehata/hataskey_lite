/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { revealHatagoesSetting } from './hatagoes-setting-section.js';

afterEach(() => { window.document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('HataGoes settings search target', () => {
	test('focuses a named section and scrolls only its scrollable dialog body', () => {
		const windowFrame = window.document.createElement('div');
		windowFrame.style.overflowY = 'hidden';
		const body = window.document.createElement('div');
		body.style.overflowY = 'auto';
		Object.defineProperties(body, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
		const target = window.document.createElement('section');
		target.dataset.hatagoesSetting = 'sync';
		body.append(target); windowFrame.append(body); window.document.body.append(windowFrame);
		const scroll = vi.fn(); body.scrollTo = scroll;
		const frameScroll = vi.fn(); windowFrame.scrollTo = frameScroll;
		revealHatagoesSetting(body, 'sync');
		expect(scroll).toHaveBeenCalledOnce();
		expect(frameScroll).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(target);
	});

	test('an unknown section never steals focus or modifies the current setting', () => {
		const root = window.document.createElement('div');
		const input = window.document.createElement('input'); input.value = 'unsaved';
		root.append(input); window.document.body.append(root); input.focus();
		revealHatagoesSetting(root, 'missing');
		expect(window.document.activeElement).toBe(input);
		expect(input.value).toBe('unsaved');
	});
});
