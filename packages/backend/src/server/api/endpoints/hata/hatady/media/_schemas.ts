/* Hatady 映画・ゲーム API の OpenAPI 正本。SDK 自動生成で空 object にしない。 */

import { RECORD_ATTACHMENT_PROPERTIES } from '../_record.js';

const reactionSummarySchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		reaction: { type: 'string', optional: false, nullable: false },
		count: { type: 'integer', optional: false, nullable: false, minimum: 0 },
	},
	required: ['reaction', 'count'],
} as const;

export const mediaWorkSchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		updatedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		userId: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		user: { type: 'object', optional: true, nullable: true, ref: 'UserLite' },
		kind: { type: 'string', enum: ['movie', 'game', 'work'], optional: false, nullable: false },
		title: { type: 'string', optional: false, nullable: false },
		activity: { type: 'object', optional: true, nullable: true, additionalProperties: true },
		details: { type: 'object', optional: false, additionalProperties: true },
		originalTitle: { type: 'string', optional: false, nullable: true },
		creator: { type: 'string', optional: false, nullable: true },
		releaseDate: { type: 'string', optional: false, nullable: true },
		releaseYear: { type: 'integer', optional: false, nullable: true },
		status: { type: 'string', enum: ['planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped'], optional: false, nullable: false },
		visibility: { type: 'string', enum: ['private', 'followers', 'public'], optional: false, nullable: false },
		isFavorite: { type: 'boolean', optional: false, nullable: false },
		isRecommended: { type: 'boolean', optional: false, nullable: false },
		recommendationRating: { type: 'integer', minimum: 0, maximum: 10, optional: false, nullable: true },
		coverColorIndex: { type: 'integer', optional: false, nullable: true },
		synopsis: { type: 'string', optional: false, nullable: true },
		synopsisSpoiler: { type: 'boolean', optional: false, nullable: false },
		review: { type: 'string', optional: false, nullable: true },
		reviewSpoiler: { type: 'boolean', optional: false, nullable: false },
		officialUrl: { type: 'string', optional: false, nullable: true },
		runtimeMinutes: { type: 'integer', optional: false, nullable: true },
		genres: { type: 'array', optional: false, nullable: false, items: { type: 'string' } },
		origin: { type: 'string', enum: ['domestic', 'foreign', 'co_production', 'other'], optional: false, nullable: true },
		viewingMode: { type: 'string', enum: ['dubbed', 'subtitled', 'original'], optional: false, nullable: true },
		primaryLanguage: { type: 'string', optional: false, nullable: true },
		highlights: { type: 'array', optional: false, nullable: false, items: { type: 'string' } },
		highlightsSpoiler: { type: 'boolean', optional: false, nullable: false },
		platforms: { type: 'array', optional: false, nullable: false, items: { type: 'string' } },
		developer: { type: 'string', optional: false, nullable: true },
		publisher: { type: 'string', optional: false, nullable: true },
	},
	required: ['details', 'id', 'createdAt', 'updatedAt', 'userId', 'kind', 'title', 'originalTitle', 'creator', 'releaseDate', 'releaseYear', 'status', 'visibility', 'isFavorite', 'isRecommended', 'recommendationRating', 'coverColorIndex', 'synopsis', 'synopsisSpoiler', 'review', 'reviewSpoiler', 'officialUrl', 'runtimeMinutes', 'genres', 'origin', 'viewingMode', 'primaryLanguage', 'highlights', 'highlightsSpoiler', 'platforms', 'developer', 'publisher'],
} as const;

export const mediaWorkDetailSchema = {
	...mediaWorkSchema,
	properties: {
		...mediaWorkSchema.properties,
		logs: { type: 'array', items: { type: 'object', additionalProperties: true } },
		isMine: { type: 'boolean', optional: false, nullable: false },
		reactions: { type: 'array', optional: false, nullable: false, items: reactionSummarySchema },
		myReaction: { type: 'string', optional: false, nullable: true },
		commentsCount: { type: 'integer', optional: false, nullable: false, minimum: 0 },
	},
	required: [...mediaWorkSchema.required, 'isMine', 'reactions', 'myReaction', 'commentsCount'],
} as const;

export const mediaSessionSchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		updatedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		userId: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		workId: { type: 'string', format: 'misskey:id', optional: false, nullable: true },
		kind: { type: 'string', enum: ['movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'], optional: false, nullable: false },
		occurredAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		durationMinutes: { type: 'integer', optional: false, nullable: true },
		durationSeconds: { type: 'number', optional: false, nullable: true },
		startedAt: { type: 'string', optional: false, nullable: true },
		tags: { type: 'array', optional: false, items: { type: 'string' } },
		...RECORD_ATTACHMENT_PROPERTIES,
		workSnapshot: { type: 'object', optional: false, additionalProperties: true },
		note: { type: 'string', optional: false, nullable: true },
		noteSpoiler: { type: 'boolean', optional: false, nullable: false },
		visibility: { type: 'string', enum: ['private', 'followers', 'public'], optional: false, nullable: false },
		details: { type: 'object', optional: false, nullable: false, additionalProperties: true },
	},
	required: ['fileIds', 'files', 'durationSeconds', 'startedAt', 'tags', 'workSnapshot', 'id', 'createdAt', 'updatedAt', 'userId', 'workId', 'kind', 'occurredAt', 'durationMinutes', 'note', 'noteSpoiler', 'visibility', 'details'],
} as const;

export const mediaCommentSchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		updatedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		workId: { type: 'string', format: 'misskey:id', optional: false, nullable: true },
		sessionId: { type: 'string', format: 'misskey:id', optional: false, nullable: true },
		userId: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		user: { type: 'object', optional: false, nullable: true, ref: 'UserLite' },
		replyId: { type: 'string', format: 'misskey:id', optional: false, nullable: true },
		text: { type: 'string', optional: false, nullable: false },
		spoiler: { type: 'boolean', optional: false, nullable: false },
		reactionsCount: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		reactions: { type: 'array', optional: false, nullable: false, items: reactionSummarySchema },
		myReaction: { type: 'string', optional: false, nullable: true },
	},
	required: ['sessionId', 'id', 'createdAt', 'updatedAt', 'workId', 'userId', 'user', 'replyId', 'text', 'spoiler', 'reactionsCount', 'reactions', 'myReaction'],
} as const;

export const mediaWorkListSchema = { type: 'array', optional: false, nullable: false, items: mediaWorkSchema } as const;
export const mediaSessionListSchema = { type: 'array', optional: false, nullable: false, items: mediaSessionSchema } as const;
export const mediaCommentListSchema = { type: 'array', optional: false, nullable: false, items: mediaCommentSchema } as const;
