/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { UserProfilesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { AchievementService } from '@/core/AchievementService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../error.js';

export const meta = {
	tags: ['account'],

	requireCredential: true,
	kind: 'read:account',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'MeDetailed',
	},

	errors: {
		userIsDeleted: {
			message: 'User is deleted.',
			code: 'USER_IS_DELETED',
			id: 'e5b3b9f0-2b8f-4b9f-9c1f-8c5c1b2e1b1a',
			kind: 'permission',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private userEntityService: UserEntityService,
		private achievementService: AchievementService,
	) {
		super(meta, paramDef, async (ps, user, token, flashToken) => {
			const isSecure = token == null && flashToken == null;

			// 旗鯖fork: 既にDBへ確定済みの宴成功・阻止回数も含め、
			// 公式クライアントから自分の情報を取得した時点で未解除実績を補完する。
			// read:account だけの外部アプリから永続更新や通知を起こさせない。
			if (isSecure) {
				await this.achievementService.reconcileUtageAchievements(user.id).catch(err => {
					console.error('[utage] login achievement reconciliation failed:', err);
				});
			}

			const now = new Date();
			const today = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;

			// 渡ってきている user はキャッシュされていて古い可能性 があるので改めて取得
			const userProfile = await this.userProfilesRepository.findOne({
				where: {
					userId: user.id,
				},
				relations: { user: true },
			});

			if (userProfile == null) {
				throw new ApiError(meta.errors.userIsDeleted);
			}

			if (!userProfile.loggedInDates.includes(today)) {
				this.userProfilesRepository.update({ userId: user.id }, {
					loggedInDates: [...userProfile.loggedInDates, today],
				});
				userProfile.loggedInDates = [...userProfile.loggedInDates, today];

				// ログインボーナス：ログイン日数に応じた実績を解放
				const loginDays = userProfile.loggedInDates.length;
				const loginAchievements: { days: number; achievement: string }[] = [
					{ days: 3, achievement: 'login3' },
					{ days: 7, achievement: 'login7' },
					{ days: 15, achievement: 'login15' },
					{ days: 30, achievement: 'login30' },
					{ days: 60, achievement: 'login60' },
					{ days: 100, achievement: 'login100' },
					{ days: 200, achievement: 'login200' },
					{ days: 300, achievement: 'login300' },
					{ days: 400, achievement: 'login400' },
					{ days: 500, achievement: 'login500' },
					{ days: 600, achievement: 'login600' },
					{ days: 700, achievement: 'login700' },
					{ days: 800, achievement: 'login800' },
					{ days: 900, achievement: 'login900' },
					{ days: 1000, achievement: 'login1000' },
				];

				for (const { days, achievement } of loginAchievements) {
					if (loginDays >= days) {
						this.achievementService.create(user.id, achievement as any);
					}
				}
			}

			return await this.userEntityService.pack(userProfile.user!, userProfile.user!, {
				schema: 'MeDetailed',
				includeSecrets: isSecure,
				userProfile,
			});
		});
	}
}
