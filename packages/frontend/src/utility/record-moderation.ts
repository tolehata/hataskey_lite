/* SPDX-License-Identifier: AGPL-3.0-only */
import type { Endpoints } from 'cherrypick-js';
import * as os from '@/os.js';
export type RecordModerationTarget = Endpoints['admin/record-moderation/preview']['req'];
export type RecordModerationResult = Endpoints['admin/record-moderation/execute']['res'];
export async function openRecordModeration(target: RecordModerationTarget, action: 'delete' | 'warn' | 'history', done: (result: RecordModerationResult) => void, mode?: 'light' | 'dark') {
	const focus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	const { dispose } = os.popup((await import('@/components/RecordModerationDialog.vue')).default, { target, action, mode }, {
		done,
		closed: () => { dispose(); if (focus?.isConnected) focus.focus({ preventScroll: true }); },
	});
}
