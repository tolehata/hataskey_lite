/*
 * SPDX-FileCopyrightText: Hata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { UserProfilesRepository } from '@/models/_.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		properties: {
			rank: { type: 'number' },
			totalUsers: { type: 'number' },
		},
	},
	// 旗鯖fork(セキュリティ): 全プロファイルを集計する COUNT クエリ2発で重い。1分30回に抑制。
	limit: { duration: ms('1min'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 自分のログイン日数を取得
			const myProfile = await this.userProfilesRepository.findOneBy({ userId: me.id });
			const myDays = myProfile?.loggedInDates?.length ?? 0;

			// 自分より多いユーザー数をカウント
			const result = await this.userProfilesRepository
				.createQueryBuilder('profile')
				.select('COUNT(*)', 'count')
				.where('array_length(profile."loggedInDates", 1) > :myDays', { myDays })
				.getRawOne();

			const rank = (parseInt(result?.count ?? '0', 10)) + 1;

			// 総ユーザー数
			const totalResult = await this.userProfilesRepository
				.createQueryBuilder('profile')
				.select('COUNT(*)', 'count')
				.where('array_length(profile."loggedInDates", 1) > 0')
				.getRawOne();

			const totalUsers = parseInt(totalResult?.count ?? '0', 10);

			return {
				rank,
				totalUsers,
			};
		});
	}
}
