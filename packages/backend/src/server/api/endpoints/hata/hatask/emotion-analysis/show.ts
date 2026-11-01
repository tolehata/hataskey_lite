/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { HataskEmotionAnalysesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { packHataskEmotionAnalysis } from './_shared.js';

export const meta = {
	tags: ['hata', 'hatask'],
	requireCredential: true,
	secure: true,
	requiredRolePolicy: 'canUseHatalyze',
	kind: 'read:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchAnalysis: {
			message: 'No such emotion analysis.',
			code: 'NO_SUCH_EMOTION_ANALYSIS',
			id: 'd91ca173-99cd-4b0b-943b-5007c4ddc9da',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		analysisId: { type: 'string', format: 'misskey:id' },
	},
	required: ['analysisId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskEmotionAnalysesRepository)
		private hataskEmotionAnalysesRepository: HataskEmotionAnalysesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const analysis = await this.hataskEmotionAnalysesRepository.findOneBy({ id: ps.analysisId, userId: me.id });
			if (analysis == null) throw new ApiError(meta.errors.noSuchAnalysis);
			return packHataskEmotionAnalysis(analysis);
		});
	}
}
