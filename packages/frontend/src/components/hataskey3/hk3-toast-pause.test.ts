/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { dismissHk3Toast, hk3Toasts, pushHk3Toast, setHk3ToastsPaused } from './hk3-state.js';
const owner = Symbol('pull');
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
	for (const toast of hk3Toasts.value) dismissHk3Toast(toast.id);
	setHk3ToastsPaused(owner, false); vi.clearAllTimers(); vi.useRealTimers();
});
test('preserves visible time while pulling and shows only the latest notice afterwards', () => {
	pushHk3Toast({ icon: 'star', text: 'favorite' }, 2800);
	vi.advanceTimersByTime(1000);
	setHk3ToastsPaused(owner, true);
	vi.advanceTimersByTime(9000);
	expect(hk3Toasts.value[0]?.text).toBe('favorite');
	setHk3ToastsPaused(owner, false);
	vi.advanceTimersByTime(1799);
	expect(hk3Toasts.value).toHaveLength(1);
	vi.advanceTimersByTime(1);
	expect(hk3Toasts.value).toHaveLength(0);
	setHk3ToastsPaused(owner, true);
	pushHk3Toast({ icon: 'star', text: 'first' });
	pushHk3Toast({ icon: 'clock', text: 'latest' });
	vi.advanceTimersByTime(9000);
	setHk3ToastsPaused(owner, false);
	expect(hk3Toasts.value.map(item => item.text)).toEqual(['latest']);
	vi.advanceTimersByTime(2800);
	expect(hk3Toasts.value).toHaveLength(0);
});
