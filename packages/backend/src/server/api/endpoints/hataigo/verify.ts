/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { hataigoApi, hataigoApiErrors, hataigoReadQuota } from '@/misc/hataigo/api.js';

export const meta = {
	requireCredential: false,
	kind: 'read:account',
	errors: hataigoApiErrors,
	res: { type: 'object', properties: { desynced: { type: 'boolean', optional: false }, game: { type: 'object', ref: 'HataigoGameDetailed', optional: true } } },
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: { gameId: { type: 'string', format: 'misskey:id' }, revision: { type: 'integer', minimum: 0 } }, required: ['gameId', 'revision'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService, private packer: HataigoGameEntityService) {
		super(meta, paramDef, (ps, me, _token, _flashToken, _file, _cleanup, ip) => hataigoApi(async () => {
			await hataigoReadQuota(this.games, me, ip);
			const game = await this.packer.packDetail(ps.gameId, me ?? null);
			return game.revision === ps.revision ? { desynced: false } : { desynced: true, game };
		}));
	}
}
