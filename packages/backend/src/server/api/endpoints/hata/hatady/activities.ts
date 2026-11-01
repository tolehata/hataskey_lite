/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { RECORD_ATTACHMENT_PROPERTIES } from './_record.js';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { SchemaType } from '@/misc/json-schema.js';
import { HatadyActivityService, HATADY_ACTIVITY_INVALID_CURSOR, HATADY_ACTIVITY_INVALID_FILTER } from '@/core/HatadyActivityService.js';
import { mediaSessionSchema, mediaWorkSchema } from './media/_schemas.js';

const userLiteSchema = { type: 'object', optional: false, nullable: true, ref: 'UserLite' } as const;

const bookSchema = {
	type: 'object',
	optional: false,
	nullable: true,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		updatedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		userId: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		title: { type: 'string', optional: false, nullable: false },
		author: { type: 'string', optional: false, nullable: true },
		totalPages: { type: 'integer', optional: false, nullable: true, minimum: 0 },
		currentPage: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		status: { type: 'string', enum: ['reading', 'finished', 'want', 'tsundoku'], optional: false, nullable: false },
		coverColorIndex: { type: 'integer', optional: false, nullable: true },
		isFavorite: { type: 'boolean', optional: false, nullable: false },
		isRecommended: { type: 'boolean', optional: false, nullable: false },
		finishedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
		progress: { type: 'integer', optional: false, nullable: true, minimum: 0, maximum: 100 },
	},
	required: ['id', 'createdAt', 'updatedAt', 'userId', 'title', 'author', 'totalPages', 'currentPage', 'status', 'coverColorIndex', 'isFavorite', 'isRecommended', 'finishedAt', 'progress'],
} as const;

const studySchema = {
	type: 'object',
	optional: false,
	nullable: true,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		studiedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		userId: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		user: userLiteSchema,
		title: { type: 'string', optional: false, nullable: false },
		subject: { type: 'string', optional: false, nullable: false },
		tag: { type: 'string', optional: false, nullable: true },
		...RECORD_ATTACHMENT_PROPERTIES,
		body: { type: 'string', optional: false, nullable: true },
		bookId: { type: 'string', format: 'misskey:id', optional: false, nullable: true },
		book: bookSchema,
		pageFrom: { type: 'integer', optional: false, nullable: true },
		pageTo: { type: 'integer', optional: false, nullable: true },
		durationMinutes: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		durationSeconds: { type: 'number', nullable: true },
		startedAt: { type: 'string', nullable: true },
		tags: { type: 'array', items: { type: 'string' } },
		kind: { type: 'string', enum: ['study', 'exercise', 'work', 'cooking'] },
		details: { type: 'object', additionalProperties: true },
		mediaWorkId: { type: 'string', nullable: true },
		isPublic: { type: 'boolean', optional: false, nullable: false },
		visibility: { type: 'string', enum: ['private', 'followers', 'public'], optional: false, nullable: false },
		reactionsCount: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		commentsCount: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		reactions: { type: 'object', optional: false, nullable: false, additionalProperties: true },
		myReaction: { type: 'string', optional: false, nullable: true },
		isMine: { type: 'boolean', optional: false, nullable: false },
	},
	required: ['fileIds', 'files', 'id', 'createdAt', 'studiedAt', 'userId', 'user', 'title', 'subject', 'tag', 'body', 'bookId', 'book', 'pageFrom', 'pageTo', 'durationMinutes', 'isPublic', 'visibility', 'reactionsCount', 'commentsCount', 'reactions', 'myReaction', 'isMine'],
} as const;

const mediaSchema = {
	type: 'object',
	optional: false,
	nullable: true,
	properties: {
		work: { ...mediaWorkSchema, nullable: true },
		session: mediaSessionSchema,
	},
	required: ['work', 'session'],
} as const;

const activitySchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		type: { type: 'string', enum: ['study', 'exercise', 'work', 'cooking', 'movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'], optional: false, nullable: false },
		occurredAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		visibility: { type: 'string', enum: ['private', 'followers', 'public'], optional: false, nullable: false },
		user: userLiteSchema,
		isMine: { type: 'boolean', optional: false, nullable: false },
		study: studySchema,
		media: mediaSchema,
	},
	required: ['id', 'type', 'occurredAt', 'visibility', 'user', 'isMine', 'study', 'media'],
} as const;

const errors = {
	invalidCursor: {
		message: 'The Hatady activity cursor is invalid or belongs to different filters.',
		code: 'INVALID_HATADY_ACTIVITY_CURSOR',
		id: '943f589b-30ba-49c7-a92a-59deba6a05c1',
	},
	invalidFilter: {
		message: 'The Hatady activity filters are invalid.',
		code: 'INVALID_HATADY_ACTIVITY_FILTER',
		id: '8a9b818a-0e5c-4ce4-aea8-f85c3ef36b25',
	},
} as const;

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	errors,
	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			items: { type: 'array', optional: false, nullable: false, items: activitySchema },
			nextCursor: { type: 'string', optional: false, nullable: true },
			hasMore: { type: 'boolean', optional: false, nullable: false },
		},
		required: ['items', 'nextCursor', 'hasMore'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		scope: { type: 'string', enum: ['mine', 'recent', 'public', 'popular', 'following', 'all'], default: 'recent' },
		kinds: { type: 'array', minItems: 1, maxItems: 6, uniqueItems: true, items: { type: 'string', enum: ['study', 'movie', 'game', 'exercise', 'work', 'cooking'] } },
		sinceDate: { type: 'integer', minimum: 0, maximum: 8640000000000000, nullable: true },
		untilDate: { type: 'integer', minimum: 0, maximum: 8640000000000000, nullable: true },
		cursor: { type: 'string', minLength: 1, maxLength: 1024 },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private hatadyActivityService: HatadyActivityService) {
		super(meta, paramDef, async (ps, me, token) => {
			try {
				if (ps.scope === 'all' && token != null) throw new Error(HATADY_ACTIVITY_INVALID_FILTER);
				const result = await this.hatadyActivityService.list(me, {
					scope: ps.scope,
					userId: ps.userId,
					kinds: ps.kinds,
					sinceDate: ps.sinceDate,
					untilDate: ps.untilDate,
					cursor: ps.cursor,
					limit: ps.limit,
				});
				return result as SchemaType<typeof meta.res>;
			} catch (error) {
				if (error instanceof Error && error.message === HATADY_ACTIVITY_INVALID_CURSOR) throw new ApiError(errors.invalidCursor);
				if (error instanceof Error && error.message === HATADY_ACTIVITY_INVALID_FILTER) throw new ApiError(errors.invalidFilter);
				throw error;
			}
		});
	}
}
