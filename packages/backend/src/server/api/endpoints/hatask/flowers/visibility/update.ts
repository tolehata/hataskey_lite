/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { HATASK_FLOWER_RATE_LIMITS } from '../_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATASK_FLOWER_RATE_LIMITS.visibility,
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			visibility: { type: 'string', optional: false, nullable: false, enum: ['public', 'followers', 'private'] },
		},
		required: ['visibility'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		visibility: { type: 'string', enum: ['public', 'followers', 'private'] },
	},
	required: ['visibility'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.userProfilesRepository.update({ userId: me.id }, { hataskFlowerVisibility: ps.visibility });
			return { visibility: ps.visibility };
		});
	}
}
