/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test } from 'vitest';
import { acquireNotificationToastSuppression, notificationToastsSuppressed, resetNotificationToastSuppressionForTest, shouldSuppressNotificationToasts } from './notification-toast-suppression.js';

describe('画面単位の通知トースト抑止', () => {
	afterEach(resetNotificationToastSuppressionForTest);

	test('取得中だけ抑止し、最後の画面が離れた時点で復帰する', () => {
		const releaseA = acquireNotificationToastSuppression();
		const releaseB = acquireNotificationToastSuppression();
		expect(shouldSuppressNotificationToasts()).toBe(true);
		expect(notificationToastsSuppressed.value).toBe(true);

		releaseA();
		expect(shouldSuppressNotificationToasts()).toBe(true);
		releaseB();
		expect(shouldSuppressNotificationToasts()).toBe(false);
		expect(notificationToastsSuppressed.value).toBe(false);

		// 二重解除でほかの取得状態を壊さない。
		releaseB();
		expect(shouldSuppressNotificationToasts()).toBe(false);
	});
});
