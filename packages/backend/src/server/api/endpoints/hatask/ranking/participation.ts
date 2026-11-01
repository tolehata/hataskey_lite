/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository } from '@/models/_.js';

export const meta = {
	tags: ['hatask'], requireCredential: true, kind: 'write:account',
	limit: { duration: 60 * 1000, max: 20 },
	res: {
		type: 'object', optional: false, nullable: false,
		properties: { participating: { type: 'boolean', optional: false, nullable: false } },
		required: ['participating'],
	},
} as const;

export const paramDef = {
	type: 'object', properties: { participating: { type: 'boolean' } },
	required: ['participating'], additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository) {
		super(meta, paramDef, async (ps, me) => {
			await this.profiles.findOneByOrFail({ userId: me.id });
			await this.profiles.update({ userId: me.id }, { hataskRankingParticipating: ps.participating });
			return { participating: ps.participating };
		});
	}
}
