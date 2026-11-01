/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSettingsSurfaceLeaveGuard } from './settings-surface-leave-guard.js';
import type { SettingsSurfaceLeaveGuardRouter } from './settings-surface-leave-guard.js';
import type { RouterFlag } from '@/lib/nirax.js';

class RouterFixture implements SettingsSurfaceLeaveGuardRouter {
	public navHook: SettingsSurfaceLeaveGuardRouter['navHook'] = null;
	public current = '/settings/hata-custom';
	public pushed: Array<{ fullPath: string; flag?: RouterFlag | null }> = [];

	getCurrentFullPath() {
		return this.current;
	}

	pushByPath(fullPath: string, flag?: RouterFlag | null) {
		if (this.navHook?.(fullPath, flag ?? undefined)) return;
		this.current = fullPath;
		this.pushed.push({ fullPath, flag });
	}
}

async function flush(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

afterEach(() => {
	window.history.replaceState({}, '', '/settings/hata-custom');
});

describe('settings surface leave guard', () => {
	test('external Nirax navigation chains the prior hook, prompts once, and retries once after discard', async () => {
		const router = new RouterFixture();
		const upstream = vi.fn(() => false);
		router.navHook = upstream;
		let approve: (value: boolean) => void = () => {};
		const requestDiscard = vi.fn(() => new Promise<boolean>(resolve => { approve = resolve; }));
		const guard = createSettingsSurfaceLeaveGuard({
			router,
			shouldBlockNavigation: path => path !== '/settings/hata-custom',
			shouldWarnBeforeUnload: () => true,
			requestDiscard,
		});
		guard.install();

		router.pushByPath('/notes/example');
		expect(router.pushed).toEqual([]);
		expect(requestDiscard).toHaveBeenCalledTimes(1);
		expect(upstream).toHaveBeenCalledWith('/notes/example', undefined);
		approve(true);
		await flush();
		expect(router.pushed).toEqual([{ fullPath: '/notes/example', flag: undefined }]);
		expect(requestDiscard).toHaveBeenCalledTimes(1);
		expect(upstream).toHaveBeenCalledTimes(2);
		guard.dispose();
	});

	test('cancelled confirmation has no loop and a later retry gets exactly one new confirmation', async () => {
		const router = new RouterFixture();
		const requestDiscard = vi.fn()
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		const guard = createSettingsSurfaceLeaveGuard({
			router,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard,
		});
		guard.install();

		router.pushByPath('/notes/first');
		await flush();
		expect(router.pushed).toEqual([]);
		expect(requestDiscard).toHaveBeenCalledTimes(1);
		router.pushByPath('/notes/first');
		await flush();
		expect(router.pushed).toEqual([{ fullPath: '/notes/first', flag: undefined }]);
		expect(requestDiscard).toHaveBeenCalledTimes(2);
		guard.dispose();
	});

	test('an upstream cancellation is preserved and never opens the draft confirmation', () => {
		const router = new RouterFixture();
		const upstream = vi.fn(() => true);
		router.navHook = upstream;
		const requestDiscard = vi.fn(async () => true);
		const guard = createSettingsSurfaceLeaveGuard({
			router,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard,
		});
		guard.install();

		router.pushByPath('/notes/upstream');
		expect(upstream).toHaveBeenCalledWith('/notes/upstream', undefined);
		expect(requestDiscard).not.toHaveBeenCalled();
		expect(router.pushed).toEqual([]);
		guard.dispose();
	});

	test('browser back is restored before router replacement, then the approved target retries without a second prompt', async () => {
		const router = new RouterFixture();
		const requestDiscard = vi.fn(async () => true);
		const guard = createSettingsSurfaceLeaveGuard({
			router,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard,
		});
		guard.install();
		window.history.pushState({}, '', '/notes/from-history');
		window.dispatchEvent(new PopStateEvent('popstate'));
		expect(window.location.pathname).toBe('/settings/hata-custom');
		await flush();
		expect(requestDiscard).toHaveBeenCalledTimes(1);
		expect(router.pushed).toEqual([{ fullPath: '/notes/from-history', flag: undefined }]);
		guard.dispose();
	});

	test('beforeunload only requests the browser prompt while a draft remains dirty', () => {
		const router = new RouterFixture();
		let dirty = true;
		const guard = createSettingsSurfaceLeaveGuard({
			router,
			shouldBlockNavigation: () => dirty,
			shouldWarnBeforeUnload: () => dirty,
			requestDiscard: async () => true,
		});
		guard.install();
		const dirtyEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(dirtyEvent);
		expect(dirtyEvent.defaultPrevented).toBe(true);
		dirty = false;
		const cleanEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
		window.dispatchEvent(cleanEvent);
		expect(cleanEvent.defaultPrevented).toBe(false);
		guard.dispose();
	});
});
