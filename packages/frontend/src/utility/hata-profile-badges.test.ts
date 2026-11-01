/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getHataProfileBadges } from './hata-profile-badges.js';

describe('getHataProfileBadges', () => {
	test('自分のプロフィールは各トグルに従う', () => {
		const badges = getHataProfileBadges({
			id: 'me', host: null,
			utageSuccessCount: 7,
			utageInterruptionCount: 3,
			hataskFlowerCount: 12,
			showUtageSuccessCount: true,
			showUtageInterruptionCount: false,
			showHataskFlowerCount: true,
		}, 'me');

		expect(badges.map(badge => badge.key)).toEqual(['utageSuccess', 'hataskFlower']);
	});

	test('他人の非表示バッジは値が返らなければ表示しない', () => {
		const badges = getHataProfileBadges({
			id: 'local', host: null,
			utageSuccessCount: 2,
		}, 'me');

		expect(badges.map(badge => badge.key)).toEqual(['utageSuccess']);
	});

	test('リモートユーザーは値があっても一切表示しない', () => {
		const badges = getHataProfileBadges({
			id: 'remote', host: 'remote.example',
			utageSuccessCount: 99,
			utageInterruptionCount: 99,
			hataskFlowerCount: 99,
		}, 'me');

		expect(badges).toEqual([]);
	});
});
