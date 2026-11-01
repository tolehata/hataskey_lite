/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { HataskEmotionAnalysesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { packHataskEmotionAnalysis } from './_shared.js';

export const meta = {
	tags: ['hata', 'hatask'],
	requireCredential: true,
	secure: true,
	requiredRolePolicy: 'canUseHatalyze',
	kind: 'read:account',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskEmotionAnalysesRepository)
		private hataskEmotionAnalysesRepository: HataskEmotionAnalysesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const analyses = await this.hataskEmotionAnalysesRepository.find({
				where: { userId: me.id },
				order: { createdAt: 'DESC', id: 'DESC' },
				take: ps.limit,
			});
			return analyses.map(packHataskEmotionAnalysis);
		});
	}
}
