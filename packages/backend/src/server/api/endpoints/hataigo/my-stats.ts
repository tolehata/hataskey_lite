/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { hataigoApi, hataigoApiErrors, hataigoReadQuota } from '@/misc/hataigo/api.js';

const count = { type: 'number', optional: false, nullable: false } as const;
export const meta = {
	requireCredential: true,
	kind: 'read:account',
	errors: hataigoApiErrors,
	res: { type: 'object', optional: false, nullable: false, properties: {
		wins: count, losses: count, draws: count, streak: count, wins9: count, wins19: count, distinctOpponents: count,
	} },
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: {}, required: [] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService) {
		super(meta, paramDef, (_ps, me) => hataigoApi(async () => {
			await hataigoReadQuota(this.games, me);
			return this.games.personalStats(me);
		}));
	}
}
