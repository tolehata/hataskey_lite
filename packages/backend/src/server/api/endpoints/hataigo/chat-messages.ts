/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoChatService } from '@/core/HataigoChatService.js';
import { hataigoApi, hataigoApiErrors, hataigoReadQuota } from '@/misc/hataigo/api.js';

export const meta = {
	requireCredential: false,
	kind: 'read:account',
	errors: hataigoApiErrors,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'HataigoChatMessage' } },
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: { gameId: { type: 'string', format: 'misskey:id' }, untilId: { type: 'string', format: 'misskey:id' }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } }, required: ['gameId'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService, private chat: HataigoChatService) {
		super(meta, paramDef, (ps, me, _token, _flashToken, _file, _cleanup, ip) => hataigoApi(async () => {
			await hataigoReadQuota(this.games, me, ip);
			return this.chat.list(ps.gameId, me, ps);
		}));
	}
}
