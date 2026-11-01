/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { hataigoApi, hataigoApiErrors } from '@/misc/hataigo/api.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',
	errors: hataigoApiErrors,
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: { }, required: [] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService, private packer: HataigoGameEntityService) {
		super(meta, paramDef, (ps, me) => hataigoApi(async () => {
			await this.games.cancelMatch(me);
		}));
	}
}
