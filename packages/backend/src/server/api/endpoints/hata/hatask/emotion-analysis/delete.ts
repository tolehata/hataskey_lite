/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { HataskEmotionAnalysesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata', 'hatask'],
	requireCredential: true,
	secure: true,
	requiredRolePolicy: 'canUseHatalyze',
	kind: 'write:account',
	res: { type: 'null', optional: false, nullable: true },
	errors: {
		noSuchAnalysis: {
			message: 'No such emotion analysis.',
			code: 'NO_SUCH_EMOTION_ANALYSIS',
			id: 'be064e10-ea34-41d4-8d43-a6e03fa18b82',
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
			const result = await this.hataskEmotionAnalysesRepository.delete({ id: ps.analysisId, userId: me.id });
			if (result.affected !== 1) throw new ApiError(meta.errors.noSuchAnalysis);
			return null;
		});
	}
}
