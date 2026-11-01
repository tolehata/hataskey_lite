/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { MetaService } from '@/core/MetaService.js';
import {
	hanaawaseEventIndexSchema,
	parseHanaawaseEventIndex,
} from '@/misc/hanaawase-event-index.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['admin', 'games'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:meta',

	res: hanaawaseEventIndexSchema,

	errors: {
		invalidEventIndex: {
			message: 'The Hanaawase event schedule is invalid.',
			code: 'INVALID_EVENT_INDEX',
			id: '5bd0cb44-a6d9-4f45-8e2b-c7aab3b5112f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		eventIndex: hanaawaseEventIndexSchema,
	},
	required: ['eventIndex'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private metaService: MetaService,
		private moderationLogService: ModerationLogService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const eventIndex = parseHanaawaseEventIndex(ps.eventIndex);
			if (eventIndex == null) throw new ApiError(meta.errors.invalidEventIndex);

			const before = await this.metaService.fetch(true);
			const after = await this.metaService.update({
				hanaawaseEventIndex: eventIndex,
			});

			await this.moderationLogService.log(me, 'updateServerSettings', {
				before: { hanaawaseEventIndex: before.hanaawaseEventIndex },
				after: { hanaawaseEventIndex: after.hanaawaseEventIndex },
			});

			return eventIndex;
		});
	}
}
