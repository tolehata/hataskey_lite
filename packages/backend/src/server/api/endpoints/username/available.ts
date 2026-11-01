/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IsNull, Raw } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { MiMeta, RegistrationApplicationsRepository, UsedUsernamesRepository, UsersRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { localUsernameSchema } from '@/models/User.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			available: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: localUsernameSchema,
	},
	required: ['username'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		// 旗鯖fork: 登録申請テーブルもチェック対象に
		@Inject(DI.registrationApplicationsRepository)
		private registrationApplicationsRepository: RegistrationApplicationsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 既存ユーザー
			const exist = await this.usersRepository.countBy({
				host: IsNull(),
				usernameLower: ps.username.toLowerCase(),
			});

			// 過去使われたユーザー名
			const exist2 = await this.usedUsernamesRepository.countBy({ username: ps.username.toLowerCase() });

			// 旗鯖fork: 登録申請中の username もチェック対象
			// - pending: まだ未処理の申請中ID
			// - rejected: 通常は reject 時に null になるが、旧仕様未クリーンアップで残ってるレコードを検出
			const applicationUsername = Raw(alias => `LOWER(${alias}) = :usernameLower`, { usernameLower: ps.username.toLowerCase() });
			const exist3 = await this.registrationApplicationsRepository.count({
				where: [
					{ username: applicationUsername, status: 'pending' },
					{ username: applicationUsername, status: 'rejected' },
				],
			});

			const isPreserved = this.serverSettings.preservedUsernames.map(x => x.toLowerCase()).includes(ps.username.toLowerCase());

			return {
				available: exist === 0 && exist2 === 0 && exist3 === 0 && !isPreserved,
			};
		});
	}
}
