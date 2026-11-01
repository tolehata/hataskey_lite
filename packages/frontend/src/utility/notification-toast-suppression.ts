/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 画面単位で標準通知トーストを抑止するための参照カウント。
 * 永続設定は変更せず、取得した解除関数を呼ぶと必ず元の挙動へ戻る。
 */

import { shallowRef } from 'vue';

const activeTokens = new Set<symbol>();

/**
 * 既に描画済みのトーストも画面切替と同時に消せるようにする反応値。
 * 永続設定ではなく、Hataskey UI 3 のタイムラインが表示されている間だけtrueになる。
 */
export const notificationToastsSuppressed = shallowRef(false);

function syncSuppressionState(): void {
	notificationToastsSuppressed.value = activeTokens.size > 0;
}

export function acquireNotificationToastSuppression(): () => void {
	const token = Symbol('notification-toast-suppression');
	activeTokens.add(token);
	syncSuppressionState();
	let released = false;

	return () => {
		if (released) return;
		released = true;
		activeTokens.delete(token);
		syncSuppressionState();
	};
}

export function shouldSuppressNotificationToasts(): boolean {
	return activeTokens.size > 0;
}

/** テストで状態を隔離するためだけに使用する。 */
export function resetNotificationToastSuppressionForTest(): void {
	activeTokens.clear();
	syncSuppressionState();
}
