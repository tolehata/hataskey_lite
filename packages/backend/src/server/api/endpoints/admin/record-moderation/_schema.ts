/* SPDX-License-Identifier: AGPL-3.0-only */
import { recordModerationErrors } from '@/misc/record-moderation.js';
export const text = { type: 'string' } as const;
export const targetProperties = {
	product: { type: 'string', enum: ['hatady', 'hatask'] },
	targetType: { type: 'string', enum: ['record', 'book', 'log', 'comment', 'reaction', 'mediaWork', 'mediaSession', 'mediaComment', 'mediaReaction'] },
	targetId: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-zA-Z0-9]+$' },
} as const;
export const targetRequired = ['product', 'targetType', 'targetId'] as const;
export const targetParams = { type: 'object', properties: targetProperties, required: targetRequired, additionalProperties: false } as const;
export const impactSchema = { type: 'array', items: { type: 'object', properties: { label: text, count: { type: 'integer', minimum: 0 } }, required: ['label', 'count'] } } as const;
export const resultSchema = { type: 'object', properties: {
	operationId: text, action: { ...text, enum: ['delete', 'warn'] }, performedAt: { ...text, format: 'date-time' }, warningId: { ...text, nullable: true },
}, required: ['operationId', 'action', 'performedAt', 'warningId'] } as const;
export const infoSchema = { type: 'object', properties: {
	...resultSchema.properties, ...targetProperties, title: text, targetUserId: text, targetUsername: text, targetName: text,
	moderatorId: text, moderatorUsername: text, moderatorName: text, reason: text, impact: impactSchema,
}, required: [...resultSchema.required, ...targetRequired, 'title', 'targetUserId', 'targetUsername', 'targetName', 'moderatorId', 'moderatorUsername', 'moderatorName', 'reason', 'impact'] } as const;
export const baseMeta = {
	tags: ['admin'], requireCredential: true, requireModerator: true, secure: true,
	errors: recordModerationErrors, limit: { duration: 60 * 1000, max: 30 },
} as const;
