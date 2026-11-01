/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATASK_RECIPE_ERRORS, HataskRecipeService } from '@/core/HataskRecipeService.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: 60 * 1000, max: 30 },
	errors: { noSuchRecord: HATASK_RECIPE_ERRORS.noSuchRecord },
} as const;

export const paramDef = {
	type: 'object',
	properties: { recordId: { type: 'string', format: 'misskey:id' } },
	required: ['recordId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskRecipeService) {
		super(meta, paramDef, async (ps, me) => { await service.deleteCookingRecord(me, ps.recordId); });
	}
}
