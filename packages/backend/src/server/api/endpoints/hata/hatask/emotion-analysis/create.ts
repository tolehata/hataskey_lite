/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { HataskEmotionAnalysesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { RateLimiterService } from '@/server/api/RateLimiterService.js';
import {
	aggregateResultJsonSchema,
	HATALYZE_HISTORY_LIMIT,
	packHataskEmotionAnalysis,
	scopeJsonSchema,
	selectHatalyzeOverflowIds,
	sourceJsonSchema,
	summaryJsonSchema,
	validateHatalyzeAggregateCounts,
} from './_shared.js';

export const HATALYZE_ANALYSIS_RATE_LIMIT = {
	key: 'hatalyze-analysis',
	duration: ms('10min'),
	max: 1,
	minInterval: ms('10min'),
} as const;

export const meta = {
	tags: ['hata', 'hatask'],
	requireCredential: true,
	secure: true,
	requiredRolePolicy: 'canUseHatalyze',
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		insufficientNotes: {
			message: 'At least 10 analyzable notes are required for HATAlyze.',
			code: 'INSUFFICIENT_HATALYZE_NOTES',
			id: '76c994a1-6b1a-48b9-b472-6031bd2f1c1e',
		},
		invalidAggregate: {
			message: 'The HATAlyze aggregate counts are inconsistent.',
			code: 'INVALID_HATALYZE_AGGREGATE',
			id: 'b3a190c4-871c-4e58-bbb2-528bf2876256',
		},
		rateLimited: {
			message: 'HATAlyze can only run once every 10 minutes per account.',
			code: 'HATALYZE_RATE_LIMIT_EXCEEDED',
			id: '32dc8eb5-2574-465a-a4bd-b59696246c0b',
		},
		briefRequestInterval: {
			message: 'HATAlyze can only run once every 10 minutes per account.',
			code: 'HATALYZE_BRIEF_REQUEST_INTERVAL',
			id: '8e298851-3445-492d-82b7-58f8cdf164fb',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		saveToHistory: { type: 'boolean', default: true },
		analysisVersion: { type: 'string', minLength: 1, maxLength: 64 },
		lexiconVersion: { type: 'string', minLength: 1, maxLength: 64 },
		scope: scopeJsonSchema,
		source: sourceJsonSchema,
		summary: summaryJsonSchema,
		result: aggregateResultJsonSchema,
	},
	required: ['analysisVersion', 'lexiconVersion', 'scope', 'source', 'summary', 'result'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskEmotionAnalysesRepository)
		private hataskEmotionAnalysesRepository: HataskEmotionAnalysesRepository,
		private idService: IdService,
		private rateLimiterService: RateLimiterService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const countValidation = validateHatalyzeAggregateCounts(ps.source, ps.result.input);
			if (countValidation === 'insufficient') throw new ApiError(meta.errors.insufficientNotes);
			if (countValidation === 'inconsistent') throw new ApiError(meta.errors.invalidAggregate);

			// 件数・集計形式を検証してから利用枠を消費する。投稿取得失敗や不足件数で
			// HATAlyze の10分待機が始まらないよう、Endpoint共通の事前limitは使わない。
			const rateLimit = await this.rateLimiterService.limit(HATALYZE_ANALYSIS_RATE_LIMIT, me.id);
			if (rateLimit != null) {
				throw new ApiError(
					{
						...(rateLimit.code === 'BRIEF_REQUEST_INTERVAL' ? meta.errors.briefRequestInterval : meta.errors.rateLimited),
						httpStatusCode: 429,
					},
					rateLimit.info,
				);
			}

			const createdAt = new Date();
			if (!ps.saveToHistory) {
				return {
					id: null,
					createdAt: createdAt.toISOString(),
					analysisVersion: ps.analysisVersion,
					lexiconVersion: ps.lexiconVersion,
					scope: ps.scope,
					source: ps.source,
					summary: ps.summary,
					result: ps.result,
				};
			}

			const created = await this.hataskEmotionAnalysesRepository.insertOne({
				id: this.idService.gen(),
				createdAt,
				userId: me.id,
				analysisVersion: ps.analysisVersion,
				lexiconVersion: ps.lexiconVersion,
				scope: ps.scope,
				source: ps.source,
				summary: ps.summary,
				result: ps.result,
			});

			// 旗鯖fork: 保存する履歴は最新 HATALYZE_HISTORY_LIMIT 件まで。
			//   ⚠️挿入したあとに超過分を消すので、いま保存した1件が消えることはない。
			//   ⚠️取得は必ず「新しい順」。順序を誤ると新しい方を削除してしまう。
			const stored = await this.hataskEmotionAnalysesRepository.find({
				where: { userId: me.id },
				order: { createdAt: 'DESC', id: 'DESC' },
				select: { id: true },
			});
			const overflowIds = selectHatalyzeOverflowIds(stored.map(item => item.id), HATALYZE_HISTORY_LIMIT);
			if (overflowIds.length > 0) await this.hataskEmotionAnalysesRepository.delete(overflowIds);

			return packHataskEmotionAnalysis(created);
		});
	}
}
