/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type { HataigoMatchOptions } from '@/misc/hataigo/types.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { hataigoApi, hataigoApiErrors } from '@/misc/hataigo/api.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',
	errors: hataigoApiErrors,
	res: { type: 'object', optional: false, nullable: true, ref: 'HataigoGameDetailed' },
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: { userId: { type: 'string', format: 'misskey:id', nullable: true }, size: { type: 'integer', minimum: 9, maximum: 19, default: 19 }, clockKind: { type: 'string', enum: ['byoyomi', 'correspondence'], default: 'byoyomi' }, allowSpectate: { type: 'boolean', default: false }, allowSpectatorChat: { type: 'boolean', default: false }, publicAfterEnd: { type: 'boolean', default: false }, anySize: { type: 'boolean', default: false } }, required: [] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService, private packer: HataigoGameEntityService) {
		super(meta, paramDef, (ps, me) => hataigoApi(async () => {
			const game = ps.userId ? await this.games.invite(me, ps.userId) : await this.games.matchAnyUser(me, ps as HataigoMatchOptions);
			return game === null ? null : this.packer.packDetail(game, me);
		}));
	}
}
