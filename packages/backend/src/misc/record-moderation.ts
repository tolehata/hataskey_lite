/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { ApiError } from '@/server/api/error.js';
import { HATADY_MODERATION_TARGETS } from '@/models/HatadyModerationReview.js';
import type { HatadyModerationTarget } from '@/models/HatadyModerationReview.js';

export const recordModerationErrors = {
	denied: { message: 'A first-party moderator session is required.', code: 'RECORD_MODERATION_ACCESS_DENIED', id: '6f241763-0ce5-4411-b610-595f18147749', kind: 'permission' },
	invalid: { message: 'A reason, valid target and confirmation version are required.', code: 'INVALID_RECORD_MODERATION', id: 'd431812e-49ac-4937-8aee-cff7d6ee1744' },
	missing: { message: 'The record no longer exists.', code: 'NO_SUCH_MODERATION_RECORD', id: '597f90b6-a27a-441e-9748-160d9c9e1553' },
	conflict: { message: 'The record, its related content or review changed. Confirm the latest content.', code: 'RECORD_MODERATION_CONFLICT', id: '358a3b0a-c64c-46a1-946d-c8c40f456eea' },
} as const;
export type RecordModerationTarget = { product: 'hatady' | 'hatask'; targetType: HatadyModerationTarget | 'record'; targetId: string };
export type RecordModerationRequest = RecordModerationTarget & { requestId: string; version: string; action: 'delete' | 'warn'; reason: string; warning: string | null };
export type RecordModerationImpact = { label: string; count: number };
export type RecordModerationInfo = RecordModerationTarget & {
	operationId: string; title: string;
	targetUserId: string; targetUsername: string; targetName: string;
	moderatorId: string; moderatorUsername: string; moderatorName: string;
	performedAt: string; reason: string; impact: RecordModerationImpact[]; warningId: string | null;
};
export function recordModerationHash(value: unknown): string {
	function sorted(input: unknown): unknown {
		if (input instanceof Date) return input.toISOString();
		if (Array.isArray(input)) return input.map(sorted);
		if (input != null && typeof input === 'object') return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]));
		return input;
	}

	return createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
}
export function validateRecordModerationTarget(target: RecordModerationTarget): void {
	const valid = target.product === 'hatady'
		? (HATADY_MODERATION_TARGETS as readonly string[]).includes(target.targetType) && /^[a-zA-Z0-9]{1,32}$/.test(target.targetId)
		: target.product === 'hatask' && target.targetType === 'record' && /^[a-f0-9]{64}$/.test(target.targetId);
	if (!valid) throw new ApiError(recordModerationErrors.invalid);
}
export function normalizeRecordModerationRequest(input: RecordModerationRequest): RecordModerationRequest {
	validateRecordModerationTarget(input);
	if (!['delete', 'warn'].includes(input.action) || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId) || !/^[a-f0-9]{64}$/.test(input.version)
		|| typeof input.reason !== 'string' || !input.reason.trim() || Array.from(input.reason).length > 1000
		|| input.warning !== null && (typeof input.warning !== 'string' || !input.warning.trim() || Array.from(input.warning).length > 2000)
		|| input.action === 'warn' && input.warning === null) throw new ApiError(recordModerationErrors.invalid);
	return { ...input, reason: input.reason.trim(), warning: input.warning?.trim() ?? null };
}
