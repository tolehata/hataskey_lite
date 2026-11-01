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
	tags: ['games'],

	requireCredential: false,

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
			// MetaServiceのRedis同期キャッシュを使い、公開APIへの連打でDBを直撃しない。
			const instance = await this.metaService.fetch();
			const eventIndex = parseHanaawaseEventIndex(instance.hanaawaseEventIndex);

			// 壊れた開催設定を推測で補わず、クライアント側を非開催に倒す。
			if (eventIndex == null) throw new Error('Invalid Hanaawase event index in server settings');
			return eventIndex;
		});
	}
}
