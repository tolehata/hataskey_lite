/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { packedRolePoliciesSchema } from '@/models/json-schema/role.js';
import CreateHatalyzeEndpoint, { HATALYZE_ANALYSIS_RATE_LIMIT, meta as createMeta, paramDef as createParamDef } from '@/server/api/endpoints/hata/hatask/emotion-analysis/create.js';
import { meta as deleteMeta } from '@/server/api/endpoints/hata/hatask/emotion-analysis/delete.js';
import { meta as listMeta } from '@/server/api/endpoints/hata/hatask/emotion-analysis/list.js';
import { meta as showMeta } from '@/server/api/endpoints/hata/hatask/emotion-analysis/show.js';
import { HATALYZE_MIN_ANALYZED_NOTES, validateHatalyzeAggregateCounts } from '@/server/api/endpoints/hata/hatask/emotion-analysis/_shared.js';

function createParams(accepted: number) {
	return {
		saveToHistory: true,
		analysisVersion: '1.1.0',
		lexiconVersion: '1.0.0',
		scope: { mode: 'latest', noteLimit: 1000, visibility: 'all', includeReplies: false, includeCw: true, timezoneOffsetMinutes: 540 },
		source: { kind: 'localAccountNotes', fetchedNoteCount: accepted, analyzedNoteCount: accepted },
		summary: { averageScore: 0, emotionalPostRate: 0, levels: { strong_positive: 0, positive: 0, neutral: accepted, negative: 0, strong_negative: 0 } },
		result: {
			format: 'hata-emotion-analysis', formatVersion: 2, timezoneOffsetMinutes: 540,
			input: { received: accepted, accepted, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 0 },
			overview: { averageScore: 0, emotionalPostRate: 0, levels: { strong_positive: 0, positive: 0, neutral: accepted, negative: 0, strong_negative: 0 } },
			evidence: { phrases: [], shortcodes: [], negations: [], excludedContexts: [], intensifiers: [] },
			daily: [], weekly: [], hourly: [], topics: [],
			posting: { averageTextLength: 0, averageReactions: 0, averageReplies: 0, averageRenotes: 0, mediaPostRate: 0, cwPostRate: 0 },
		},
	};
}

describe('Hatask 感情分析の利用設定と API 境界', () => {
	test('既定では利用できず、API の返却形式に利用設定を含める', () => {
		expect(DEFAULT_POLICIES.canUseHatalyze).toBe(false);
		expect(packedRolePoliciesSchema.properties).toHaveProperty('canUseHatalyze');
	});

	test.each([createMeta, listMeta, showMeta, deleteMeta])('全 API が本人認証・外部アプリ拒否・利用設定を要求する', meta => {
		expect(meta.requireCredential).toBe(true);
		expect(meta.secure).toBe(true);
		expect(meta.requiredRolePolicy).toBe('canUseHatalyze');
	});

	test('新しい分析はアカウント単位で10分に1回までにする', () => {
		expect(createMeta).not.toHaveProperty('limit');
		expect(HATALYZE_ANALYSIS_RATE_LIMIT).toMatchObject({
			key: 'hatalyze-analysis',
			duration: 10 * 60 * 1000,
			max: 1,
			minInterval: 10 * 60 * 1000,
		});
		expect(createMeta.errors.rateLimited.code).toBe('HATALYZE_RATE_LIMIT_EXCEEDED');
		expect(createMeta.errors.briefRequestInterval.code).toBe('HATALYZE_BRIEF_REQUEST_INTERVAL');
	});

	test('保存用 JSON は未知の項目を拒否し、投稿単位の配列を持たない', () => {
		expect(createParamDef.additionalProperties).toBe(false);
		expect(createParamDef.properties.scope.additionalProperties).toBe(false);
		expect(createParamDef.properties.source.additionalProperties).toBe(false);
		expect(createParamDef.properties.summary.additionalProperties).toBe(false);
		expect(createParamDef.properties.result.additionalProperties).toBe(false);
		expect(createParamDef.properties.result.properties).not.toHaveProperty('posts');
	});

	test('厳密スキーマは認証専用の i を業務パラメータとして受け取らない', async () => {
		const limit = vi.fn().mockResolvedValue(null);
		const endpoint = new CreateHatalyzeEndpoint({ insertOne: vi.fn() } as never, { gen: () => 'analysis-id' } as never, { limit } as never);

		await expect(endpoint.exec({ ...createParams(10), i: 'native-token' }, { id: 'user-a' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(limit).not.toHaveBeenCalled();
	});

	test('HATAlyze は実分析対象が10件未満の集計を保存しない', () => {
		expect(HATALYZE_MIN_ANALYZED_NOTES).toBe(10);
		expect(validateHatalyzeAggregateCounts({ fetchedNoteCount: 9, analyzedNoteCount: 9 }, { received: 9, accepted: 9, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 0 })).toBe('insufficient');
		expect(validateHatalyzeAggregateCounts({ fetchedNoteCount: 10, analyzedNoteCount: 10 }, { received: 10, accepted: 10, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 0 })).toBe('ok');
		expect(validateHatalyzeAggregateCounts({ fetchedNoteCount: 11, analyzedNoteCount: 10 }, { received: 11, accepted: 9, skippedInvalidTimestamp: 1, skippedNoAnalyzableText: 1 })).toBe('insufficient');
		expect(validateHatalyzeAggregateCounts({ fetchedNoteCount: 11, analyzedNoteCount: 10 }, { received: 10, accepted: 10, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 0 })).toBe('inconsistent');
		expect(validateHatalyzeAggregateCounts({ fetchedNoteCount: 12, analyzedNoteCount: 10 }, { received: 12, accepted: 10, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 1 })).toBe('inconsistent');
		expect(createMeta.errors.insufficientNotes.code).toBe('INSUFFICIENT_HATALYZE_NOTES');
	});

	test('不足件数では10分枠を消費せず、検証後の制限だけを固有エラーにする', async () => {
		const limit = vi.fn().mockResolvedValue(null);
		const insertOne = vi.fn();
		const endpoint = new CreateHatalyzeEndpoint({ insertOne } as never, { gen: () => 'analysis-id' } as never, { limit } as never);

		await expect(endpoint.exec(createParams(9), { id: 'user-a' } as never, null, null)).rejects.toMatchObject({ code: 'INSUFFICIENT_HATALYZE_NOTES' });
		expect(limit).not.toHaveBeenCalled();
		expect(insertOne).not.toHaveBeenCalled();

		limit.mockResolvedValueOnce({ code: 'RATE_LIMIT_EXCEEDED', info: { resetMs: 2_000_000 } });
		await expect(endpoint.exec(createParams(10), { id: 'user-a' } as never, null, null)).rejects.toMatchObject({ code: 'HATALYZE_RATE_LIMIT_EXCEEDED', httpStatusCode: 429 });
		expect(limit).toHaveBeenCalledWith(HATALYZE_ANALYSIS_RATE_LIMIT, 'user-a');
		expect(insertOne).not.toHaveBeenCalled();
	});
});
