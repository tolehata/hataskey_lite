/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, it, vi } from 'vitest';
import { scrollParentOf, scrollToTop } from './scroll.js';

afterEach(() => { window.document.body.innerHTML = ''; vi.restoreAllMocks(); });

function scroller(scrollTop: number): HTMLElement {
	const element = window.document.createElement('div');
	element.style.overflowY = 'auto';
	Object.defineProperties(element, { scrollHeight: { value: 2000 }, clientHeight: { value: 800 } });
	element.scrollTop = scrollTop;
	element.scrollTo = vi.fn();
	return element;
}

it('scrolls the nearest scrolling ancestor back to the top after a screen change', () => {
	const outer = scroller(640);
	const inner = window.document.createElement('section');
	const target = window.document.createElement('div');
	inner.append(target);
	outer.append(inner);
	window.document.body.append(outer);
	expect(scrollParentOf(target)).toBe(outer);
	scrollToTop(target);
	expect(outer.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
});

it('does nothing when already at the top, and falls back to the window when nothing scrolls', () => {
	const outer = scroller(0);
	const target = window.document.createElement('div');
	outer.append(target);
	window.document.body.append(outer);
	scrollToTop(target);
	expect(outer.scrollTo).not.toHaveBeenCalled();
	const plain = window.document.createElement('div');
	window.document.body.append(plain);
	const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 });
	scrollToTop(plain);
	expect(windowScroll).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
	Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});
