/* SPDX-License-Identifier: AGPL-3.0-only */
import { ApiError } from '@/server/api/error.js';
export const hataskModeratedRecordError = {
	message: 'This saved data contains a record removed by moderation. Reload before saving.',
	code: 'HATASK_RECORD_MODERATED', id: '75486ea4-9835-408f-a5a5-f53b0e66ec15',
} as const;
export function rethrowHataskModerationError(error: unknown): never {
	if ((error as { driverError?: { constraint?: string } })?.driverError?.constraint === 'hatask_record_moderated') throw new ApiError(hataskModeratedRecordError);
	throw error;
}
