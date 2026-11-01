/* SPDX-License-Identifier: AGPL-3.0-only */
import { HATASK_RECORD_KINDS, HATASK_RECORD_VISIBILITIES } from '@/core/hatask-record-review.js';
import { HATASK_REVIEW_STATES } from '@/models/HataskRecordReview.js';

const text = { type: 'string', nullable: false } as const;
const integer = { type: 'integer', minimum: 0 } as const;
const bool = { type: 'boolean' } as const;
const user = { type: 'object', ref: 'UserLite' } as const;
export const reviewId = { type: 'string', pattern: '^[a-f0-9]{64}$' } as const;
export const itemSchema = {
	type: 'object', properties: {
		id: text, user, kind: { ...text, enum: HATASK_RECORD_KINDS }, title: text, body: text, date: text, time: text,
		visibility: { ...text, enum: HATASK_RECORD_VISIBILITIES }, dateFallback: bool, contentVersion: text,
		revision: integer, state: { ...text, enum: HATASK_REVIEW_STATES }, stale: bool,
		reviewer: { ...user, nullable: true }, reviewedAt: { ...text, nullable: true, format: 'date-time' },
	}, required: ['id', 'user', 'kind', 'title', 'body', 'date', 'time', 'visibility', 'dateFallback', 'contentVersion', 'revision', 'state', 'stale', 'reviewer', 'reviewedAt'],
} as const;
export const detailSchema = {
	type: 'object', properties: {
		item: itemSchema, audience: { type: 'array', items: user },
		fields: { type: 'array', items: { type: 'object', properties: { label: text, value: text }, required: ['label', 'value'] } },
	}, required: ['item', 'fields', 'audience'],
} as const;
export const pageSchema = {
	type: 'object', properties: {
		items: { type: 'array', items: itemSchema }, total: integer, nextCursor: { ...text, nullable: true },
		kinds: { type: 'object', properties: { event: integer, todo: integer, mood: integer, meal: integer, flower: integer } },
		states: { type: 'object', properties: { unread: integer, flagged: integer, reviewed: integer } },
	}, required: ['items', 'total', 'nextCursor', 'kinds', 'states'],
} as const;
export const listParams = {
	type: 'object', properties: {
		query: { type: 'string', maxLength: 200, default: '' }, kind: { type: 'string', enum: ['all', ...HATASK_RECORD_KINDS], default: 'all' },
		state: { type: 'string', enum: ['all', ...HATASK_REVIEW_STATES], default: 'all' }, visibility: { type: 'string', enum: ['all', ...HATASK_RECORD_VISIBILITIES], default: 'all' },
		userId: { type: 'string', format: 'misskey:id', nullable: true }, dateFrom: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true }, dateTo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
		sort: { type: 'string', enum: ['newest', 'oldest'], default: 'newest' }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
		cursor: { type: 'string', maxLength: 1024, nullable: true },
	}, additionalProperties: false,
} as const;
