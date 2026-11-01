/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';

const UTAGE_SUCCESS_ACHIEVEMENT_PREFIX = 'utageSuccess';
const UTAGE_INTERRUPTION_ACHIEVEMENT_PREFIX = 'utageInterruption';

export const meta = {
	requireCredential: false,
	kind: 'read:account',

	res: {
		type: 'array',
		items: {
			ref: 'Achievement',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: ps.userId });

			if (me?.id === ps.userId) return profile.achievements;

			return profile.achievements.filter(achievement => {
				if (achievement.name.startsWith(UTAGE_SUCCESS_ACHIEVEMENT_PREFIX)) {
					return profile.showUtageSuccessCount;
				}
				if (achievement.name.startsWith(UTAGE_INTERRUPTION_ACHIEVEMENT_PREFIX)) {
					return profile.showUtageInterruptionCount;
				}
				return true;
			});
		});
	}
}
