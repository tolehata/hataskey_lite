/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { MetaService } from '@/core/MetaService.js';
import {
	hanaawaseEventIndexSchema,
	parseHanaawaseEventIndex,
} from '@/misc/hanaawase-event-index.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = {
	tags: ['admin', 'games'],

	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:meta',

	res: hanaawaseEventIndexSchema,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private metaService: MetaService,
	) {
		super(meta, paramDef, async () => {
			const instance = await this.metaService.fetch(true);
			const eventIndex = parseHanaawaseEventIndex(instance.hanaawaseEventIndex);
			if (eventIndex == null) throw new Error('Invalid Hanaawase event index in server settings');
			return eventIndex;
		});
	}
}
