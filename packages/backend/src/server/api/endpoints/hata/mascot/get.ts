/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import type { UserProfilesRepository } from '@/models/_.js';

// 旗鯖fork: マスコット機能のデータ(キャラ・表情・文言)を取得する。
// 画像はドライブのURL参照のみを保持し、画像本体はクライアントがDLしてローカルにキャッシュする。
export const meta = {
	tags: ['hata'],

	requireCredential: true,

	kind: 'read:account',

	res: {
		type: 'object',
		nullable: false, optional: false,
		properties: {
			data: {
				type: 'object',
				nullable: false, optional: false,
				additionalProperties: true,
			},
			limits: {
				type: 'object',
				nullable: false, optional: false,
				properties: {
					maxCharacters: { type: 'number' },
					maxExpressions: { type: 'number' },
					maxPhrases: { type: 'number' },
				},
			},
			consented: { type: 'boolean' },
			canUseMascot: { type: 'boolean' },
		},
	},
	// 旗鯖fork(セキュリティ): マスコットデータの読取。設定画面の都度取得を想定して 1分60回。
	limit: { duration: ms('1min'), max: 60 },
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
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });
			const policies = await this.roleService.getUserPolicies(me.id);

			// 旗鯖fork: マスコット機能の利用がロールで許可されていなければ、データを返さない(空扱い)。
			// フロントはこのフラグでも機能を出し分けるが、サーバーでもデータ自体を伏せる。
			const allowed = policies.canUseMascot === true;

			return {
				data: allowed ? (profile.hataMascotData ?? {}) : {},
				limits: {
					maxCharacters: policies.mascotMaxCharacters,
					maxExpressions: policies.mascotMaxExpressions,
					maxPhrases: policies.mascotMaxPhrases,
				},
				consented: profile.hataConsentMascot === true,
				canUseMascot: allowed,
			};
		});
	}
}
