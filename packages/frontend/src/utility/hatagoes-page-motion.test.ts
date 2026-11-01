/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { captureHatagoesPageTurn } from './hatagoes-page-motion.js';

afterEach(() => { window.document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('HataGoes page motion', () => {
	test('slides the existing live form without altering its value, focus, or scroll', () => {
		const page = window.document.createElement('section');
		const input = window.document.createElement('input'); input.value = 'unfinished';
		page.append(input); window.document.body.append(page); input.focus(); page.scrollTop = 40;
		const cancel = vi.fn();
		const animate = vi.spyOn(page, 'animate').mockReturnValue({ cancel, finished: Promise.resolve(), onfinish: null } as unknown as Animation);
		const motion = captureHatagoesPageTurn(page);
		motion.play();
		expect(animate).toHaveBeenCalledOnce();
		expect(animate).toHaveBeenCalledWith([
			{ transform: 'translateX(10px)' },
			{ transform: 'translateX(0)' },
		], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
		expect(page.querySelector('input')).toBe(input);
		expect(input.value).toBe('unfinished');
		expect(window.document.activeElement).toBe(input);
		expect(page.scrollTop).toBe(40);
		motion.cancel();
		expect(cancel).toHaveBeenCalledOnce();
		motion.play();
		expect(animate).toHaveBeenCalledOnce();
	});

	test('uses the opposite direction when returning to an earlier screen', () => {
		const page = window.document.createElement('section');
		window.document.body.append(page);
		const animate = vi.spyOn(page, 'animate').mockReturnValue({ cancel: vi.fn(), finished: Promise.resolve(), onfinish: null } as unknown as Animation);
		captureHatagoesPageTurn(page, -1).play();
		expect(animate.mock.calls[0][0]).toEqual([
			{ transform: 'translateX(-10px)' },
			{ transform: 'translateX(0)' },
		]);
	});

	test('never starts a stale transition after its page was detached', () => {
		const page = window.document.createElement('section');
		const animate = vi.spyOn(page, 'animate');
		captureHatagoesPageTurn(page).play();
		expect(animate).not.toHaveBeenCalled();
	});
});
