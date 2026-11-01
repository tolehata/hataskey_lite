/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HatagoesSearchService } from '@/core/HatagoesSearchService.js';

const count = { type: 'integer', optional: false, nullable: false } as const;
export const meta = {
	tags: ['hata'],
	requireCredential: true,
	// Searches the native client's private Registry, not an application's domain.
	secure: true,
	kind: 'read:account',
	limit: { duration: 60 * 1000, max: 60 },
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			items: { type: 'array', optional: false, nullable: false, items: {
				type: 'object', optional: false, nullable: false,
				properties: {
					id: { type: 'string', optional: false, nullable: false },
					app: { type: 'string', optional: false, nullable: false },
					kind: { type: 'string', optional: false, nullable: false },
					title: { type: 'string', optional: false, nullable: false },
					text: { type: 'string', optional: false, nullable: false },
					url: { type: 'string', optional: false, nullable: false },
					targetId: { type: 'string', optional: true, nullable: true },
					userId: { type: 'string', optional: true, nullable: true },
				},
				required: ['id', 'app', 'kind', 'title', 'text', 'url'],
			} },
			total: count,
			counts: { type: 'object', optional: false, nullable: false, properties: {
				hatask: count, hatady: count, hatafeed: count, users: count,
			}, required: ['hatask', 'hatady', 'hatafeed', 'users'] },
			hasMore: { type: 'boolean', optional: false, nullable: false },
		},
		required: ['items', 'total', 'counts', 'hasMore'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', minLength: 1, maxLength: 100 },
		app: { type: 'string', enum: ['all', 'hatask', 'hatady', 'hatafeed', 'users'], default: 'all' },
		offset: { type: 'integer', minimum: 0, default: 0 },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
	},
	required: ['query'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private hatagoesSearchService: HatagoesSearchService) {
		super(meta, paramDef, async (ps, me) => this.hatagoesSearchService.search(me, ps.query, ps.app, ps.offset, ps.limit));
	}
}
