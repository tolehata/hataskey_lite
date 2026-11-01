/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { canExposeLocalProfileBadge, isLocalProfileBadgeOnlyUpdate } from '@/misc/local-profile-badge.js';

describe('canExposeLocalProfileBadge', () => {
	test('自鯖ユーザーの有効なバッジを表示する', () => {
		expect(canExposeLocalProfileBadge(null, false, true)).toBe(true);
	});

	test('非表示設定でも本人には同期用の値を返す', () => {
		expect(canExposeLocalProfileBadge(null, true, false)).toBe(true);
	});

	test('リモートユーザーのバッジは本人扱いでも返さない', () => {
		expect(canExposeLocalProfileBadge('remote.example', true, true)).toBe(false);
	});
});

describe('isLocalProfileBadgeOnlyUpdate', () => {
	test('独自バッジだけの更新を検出する', () => {
		expect(isLocalProfileBadgeOnlyUpdate(['hataskFlowerCount'])).toBe(true);
		expect(isLocalProfileBadgeOnlyUpdate(['showUtageSuccessCount', 'showHataskFlowerCount'])).toBe(true);
	});

	test('連合対象の通常プロフィール項目が混ざった更新は除外しない', () => {
		expect(isLocalProfileBadgeOnlyUpdate(['name', 'showUtageSuccessCount'])).toBe(false);
		expect(isLocalProfileBadgeOnlyUpdate([])).toBe(false);
	});
});
