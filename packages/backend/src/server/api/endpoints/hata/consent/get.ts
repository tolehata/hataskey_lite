/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository } from '@/models/_.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	secure: true,
	kind: 'read:account',
	res: {
		type: 'object',
		properties: {
			agreed: { type: 'boolean' },
			agreedAt: { type: 'string', format: 'date-time', nullable: true },
			version: { type: 'string', nullable: true },
		},
		required: ['agreed', 'agreedAt', 'version'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		type: { type: 'string', enum: ['drawing', 'noteCharm'], default: 'drawing' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });
			if (ps.type === 'noteCharm') {
				return {
					agreed: profile.hataConsentNoteCharm === true,
					agreedAt: profile.hataConsentNoteCharmDate?.toISOString() ?? null,
					version: null,
				};
			}
			return {
				agreed: profile.hataConsentDrawing,
				agreedAt: profile.hataConsentDrawingDate?.toISOString() ?? null,
				version: profile.hataConsentDrawingVersion,
			};
		});
	}
}
