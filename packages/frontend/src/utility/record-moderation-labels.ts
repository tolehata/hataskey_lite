/* SPDX-License-Identifier: AGPL-3.0-only */
import { i18n } from '@/i18n.js';
const labels: Record<string, string> = {
	deleteHatadyRecord: 'Hatadyの記録を削除', deleteHataskRecord: 'Hataskの記録を削除',
	warnHatadyUser: 'Hatadyの利用者へ警告', warnHataskUser: 'Hataskの利用者へ警告',
};
export const isRecordModerationLog = (type: string) => Object.hasOwn(labels, type);
export const moderationLogLabel = (type: string) => labels[type] ?? (i18n.ts._moderationLogTypes as Record<string, string>)[type] ?? type;
