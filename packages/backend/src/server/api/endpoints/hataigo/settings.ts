/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type { HataigoSettingsPatch } from '@/misc/hataigo/types.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { hataigoApi, hataigoApiErrors, hataigoSettingsSchema } from '@/misc/hataigo/api.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',
	errors: hataigoApiErrors,
	res: { type: 'object', optional: false, nullable: false, ref: 'HataigoGameDetailed' },
} as const;

export const paramDef = { type: 'object', additionalProperties: false, properties: { gameId: { type: 'string', format: 'misskey:id' }, expectedRevision: { type: 'integer', minimum: 0 }, settings: hataigoSettingsSchema }, required: ['gameId', 'expectedRevision', 'settings'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private games: HataigoService, private packer: HataigoGameEntityService) {
		super(meta, paramDef, (ps, me) => hataigoApi(async () => {
			return this.packer.packDetail(await this.games.updateSettings(ps.gameId, me, ps.settings as HataigoSettingsPatch, ps.expectedRevision), me);
		}));
	}
}
