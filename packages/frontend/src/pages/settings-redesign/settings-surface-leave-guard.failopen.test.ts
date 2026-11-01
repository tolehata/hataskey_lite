/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 設定画面から離脱できずに固まる状態を作らないことを見張る。
 *
 * ⚠️このガードは Nirax の同期フックへ非同期の確認を橋渡ししている。
 *   確認が失敗したり、待っている間に画面が破棄されたりしたときに保留中の
 *   遷移を捨てると、⚠️**行き先を失って画面が空のまま動かせなくなる**。
 *   実際にそうなったので、ここで見張る。
 */

import { describe, expect, test, vi } from 'vitest';
import { createSettingsSurfaceLeaveGuard } from './settings-surface-leave-guard.js';

function makeRouter() {
	const pushed: string[] = [];
	let current = '/settings';
	return {
		router: {
			navHook: null as ((fullPath: string, flag?: any) => boolean) | null,
			getCurrentFullPath: () => current,
			pushByPath: (fullPath: string) => {
				pushed.push(fullPath);
				current = fullPath;
			},
		},
		pushed,
		setCurrent: (v: string) => { current = v; },
	};
}

describe('settings surface leave guard', () => {
	test('確認が取れれば、保留した遷移をその行き先へ通す', async () => {
		const { router, pushed } = makeRouter();
		const guard = createSettingsSurfaceLeaveGuard({
			router: router as any,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard: () => Promise.resolve(true),
		});
		guard.install();
		expect(router.navHook!('/my/notifications')).toBe(true); // いったん止める
		await Promise.resolve();
		await Promise.resolve();
		expect(pushed).toEqual(['/my/notifications']);
	});

	test('⚠️確認が失敗しても遷移を捨てず、行き先へ通す（詰ませない）', async () => {
		const { router, pushed } = makeRouter();
		const guard = createSettingsSurfaceLeaveGuard({
			router: router as any,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard: () => Promise.reject(new Error('boom')),
		});
		guard.install();
		expect(router.navHook!('/my/notifications')).toBe(true);
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(pushed).toEqual(['/my/notifications']);
	});

	test('⚠️画面が破棄されたら、そこからは遷移を起こさない', () => {
		// ⚠️dispose は後片付けの場所。ここからルートを押すと、保留していた
		//   古い行き先へあらゆる遷移が吸われる（実際にそうなった）。
		const { router, pushed } = makeRouter();
		const guard = createSettingsSurfaceLeaveGuard({
			router: router as any,
			shouldBlockNavigation: () => true,
			shouldWarnBeforeUnload: () => true,
			requestDiscard: () => new Promise<boolean>(() => { /* 解決しない */ }),
		});
		guard.install();
		expect(router.navHook!('/hatady')).toBe(true);
		guard.dispose();
		expect(pushed).toEqual([]);
	});

	test('検出器が生きている（止めるべきでないときは素通しする）', () => {
		// ⚠️陽性対照。常に true を返すだけの実装なら、この検査が落ちる。
		const { router } = makeRouter();
		const guard = createSettingsSurfaceLeaveGuard({
			router: router as any,
			shouldBlockNavigation: () => false,
			shouldWarnBeforeUnload: () => false,
			requestDiscard: vi.fn(() => Promise.resolve(true)),
		});
		guard.install();
		expect(router.navHook!('/my/notifications')).toBe(false);
		guard.dispose();
	});
});
