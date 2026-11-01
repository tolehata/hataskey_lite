/* SPDX-License-Identifier: AGPL-3.0-only */
import { RECORD_ATTACHMENT_PROPERTIES } from '../../_record.js';
import { ApiError } from '@/server/api/error.js';
import { HATADY_MODERATION_TARGETS, HATADY_MODERATION_STATES } from '@/models/HatadyModerationReview.js';
import { MODERATION_ERRORS } from '@/core/HatadyModerationService.js';

const text = { type: 'string', optional: false, nullable: false } as const;
const integer = { type: 'integer', optional: false, nullable: false } as const;
const flag = { type: 'boolean', optional: false, nullable: false } as const;
export const moderationEntrySchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		...RECORD_ATTACHMENT_PROPERTIES,
		key: text,
		targetType: { ...text, enum: HATADY_MODERATION_TARGETS }, targetId: { ...text, format: 'misskey:id' },
		category: { ...text, enum: ['collection', 'record', 'comment', 'reaction'] },
		activity: { ...text, enum: ['study', 'movie', 'game', 'exercise', 'work', 'cooking'] },
		actor: { type: 'object', optional: false, nullable: false, ref: 'UserLite' },
		title: text, body: text, createdAt: { ...text, format: 'date-time' },
		visibility: { ...text, enum: ['public', 'followers', 'private'] },
		emoji: { ...text, nullable: true }, parentKey: { ...text, nullable: true }, contentVersion: text,
		review: {
			type: 'object', optional: false, nullable: false,
			properties: {
				state: { ...text, enum: HATADY_MODERATION_STATES }, note: text, revision: integer,
				reviewer: { type: 'object', optional: false, nullable: true, ref: 'UserLite' },
				reviewedAt: { ...text, format: 'date-time', nullable: true }, stale: flag,
			},
			required: ['state', 'note', 'revision', 'reviewer', 'reviewedAt', 'stale'],
		},
	},
	required: ['fileIds', 'files', 'key', 'targetType', 'targetId', 'category', 'activity', 'actor', 'title', 'body', 'createdAt', 'visibility', 'emoji', 'parentKey', 'contentVersion', 'review'],
} as const;
export const moderationEntriesSchema = { type: 'array', optional: false, nullable: false, items: moderationEntrySchema } as const;
export const moderationCountsSchema = {
	type: 'object', optional: false, nullable: false,
	properties: { unreviewed: integer, flagged: integer, reviewed: integer }, required: ['unreviewed', 'flagged', 'reviewed'],
} as const;
export const moderationDetailSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		item: moderationEntrySchema,
		fields: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, properties: { label: text, value: text }, required: ['label', 'value'] } },
		ancestors: moderationEntriesSchema, related: moderationEntriesSchema, relatedHasMore: flag,
	},
	required: ['item', 'fields', 'ancestors', 'related', 'relatedHasMore'],
} as const;
export const moderationTargetParams = {
	targetType: { type: 'string', enum: HATADY_MODERATION_TARGETS },
	targetId: { type: 'string', format: 'misskey:id', minLength: 1, maxLength: 32 },
} as const;
export const moderationErrors = {
	accessDenied: { message: 'Staff access from a first-party session is required.', code: MODERATION_ERRORS.denied, id: '0e0ea463-e07e-4daf-b6d0-0bf0961484cd', kind: 'permission', httpStatusCode: 403 },
	noSuchTarget: { message: 'The content no longer exists.', code: MODERATION_ERRORS.missing, id: 'd5057f7c-57c9-4380-8a7a-d25398afbbef', httpStatusCode: 404 },
	reviewConflict: { message: 'The content or its review changed. Reload before saving.', code: MODERATION_ERRORS.conflict, id: '2c725123-3ec8-4aba-89b9-94ba354e86d4', httpStatusCode: 409 },
	invalidFilter: { message: 'Invalid moderation filter or review.', code: MODERATION_ERRORS.invalid, id: '16c69b8a-51ab-4e0d-ac9c-a0fc960d3758' },
	invalidCursor: { message: 'Invalid moderation cursor.', code: MODERATION_ERRORS.cursor, id: '58e62b5e-7796-425a-809a-e93d2a5b0417' },
} as const;
export async function moderationResult<T>(execute: () => Promise<T>): Promise<T> {
	try { return await execute(); } catch (error) {
		const definition = Object.values(moderationErrors).find(item => item.code === (error instanceof Error ? error.message : null));
		if (definition) throw new ApiError(definition);
		throw error;
	}
}
