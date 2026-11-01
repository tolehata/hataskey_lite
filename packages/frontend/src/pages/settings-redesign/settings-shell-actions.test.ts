/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createSettingsShellActions } from './settings-shell-actions.js';

function createHarness(canceled = false) {
	const clearCache = vi.fn(async () => {});
	const signout = vi.fn();
	const signoutAll = vi.fn();
	const confirm = vi.fn(async () => ({ canceled }));
	return {
		clearCache,
		signout,
		signoutAll,
		confirm,
		actions: createSettingsShellActions({
			clearCache,
			signout,
			signoutAll,
			confirm,
			labels: {
				logoutConfirm: 'ログアウトの確認',
				logoutAllConfirm: '全端末からログアウトの確認',
				logoutWillClearClientData: 'この端末のデータも消去します',
			},
		}),
	};
}

describe('redesigned settings shell destructive actions', () => {
	test('キャッシュ削除は明示クリック時だけ既存clearCacheを一度呼ぶ', async () => {
		const harness = createHarness();
		await harness.actions['clear-cache']();
		expect(harness.clearCache).toHaveBeenCalledTimes(1);
		expect(harness.confirm).not.toHaveBeenCalled();
	});

	test('ログアウトを取り消したときは既存signoutを呼ばない', async () => {
		const harness = createHarness(true);
		await harness.actions.logout();
		expect(harness.confirm).toHaveBeenCalledWith({
			type: 'warning',
			title: 'ログアウトの確認',
			text: 'この端末のデータも消去します',
		});
		expect(harness.signout).not.toHaveBeenCalled();
	});

	test('ログアウトと全端末ログアウトは確認後に対応する既存処理だけを呼ぶ', async () => {
		const harness = createHarness(false);
		await harness.actions.logout();
		await harness.actions['logout-all']();
		expect(harness.signout).toHaveBeenCalledTimes(1);
		expect(harness.signoutAll).toHaveBeenCalledTimes(1);
		expect(harness.confirm).toHaveBeenLastCalledWith({
			type: 'warning',
			title: '全端末からログアウトの確認',
			text: 'この端末のデータも消去します',
		});
	});
});
