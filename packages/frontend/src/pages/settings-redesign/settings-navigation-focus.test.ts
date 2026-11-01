/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { waitForSettingsNavigationFocus } from './settings-navigation-focus.js';

afterEach(() => {
	window.document.body.replaceChildren();
	vi.useRealTimers();
});

describe('settings navigation focus waiter', () => {
	test('exact controlが現れて実際にfocusできた時だけ成功する', async () => {
		const control = window.document.createElement('button');
		window.document.body.append(control);
		const waiter = waitForSettingsNavigationFocus({
			find: () => ({ state: 'found', element: control }),
			focus: element => {
				element.focus();
				return window.document.activeElement === element;
			},
			isCurrent: () => true,
		});

		await expect(waiter.promise).resolves.toBe(true);
		expect(window.document.activeElement).toBe(control);
	});

	test('controlまたはmarkerが2500ms以内に現れない時は失敗として検索面を維持できる', async () => {
		vi.useFakeTimers();
		const focus = vi.fn(() => true);
		const waiter = waitForSettingsNavigationFocus({
			find: () => ({ state: 'missing' }),
			focus,
			isCurrent: () => true,
		});

		await vi.advanceTimersByTimeAsync(2500);
		await expect(waiter.promise).resolves.toBe(false);
		expect(focus).not.toHaveBeenCalled();
	});

	test('条件付きtargetが後から一意にmountされた時はMutationObserverでfocus成功になる', async () => {
		let control: HTMLButtonElement | null = null;
		const waiter = waitForSettingsNavigationFocus({
			find: () => control == null ? { state: 'missing' } : { state: 'found', element: control },
			focus: element => {
				element.focus();
				return window.document.activeElement === element;
			},
			isCurrent: () => true,
		});

		control = window.document.createElement('button');
		window.document.body.append(control);
		await expect(waiter.promise).resolves.toBe(true);
	});
});
