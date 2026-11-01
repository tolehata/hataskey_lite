/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { SUPPORT_POLICIES, formatSupportSnapshot, supportBenefitHeading, supportDisclosureHeights, supportHttpsUrl, supportPolicyDisplay, supportSnapshotCondition, supportTextWidthBudget } from './hatask-support.js';
import type { SupportSnapshot } from './hatask-support.js';

vi.mock('@/i18n.js', async () => ({ i18n: (await import('./hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));

const snapshot = (value: SupportSnapshot['value'], extra: Partial<SupportSnapshot> = {}): SupportSnapshot => ({ value, available: true, unlimited: false, condition: null, rateMultiplier: null, ...extra });

describe('Hatask support display projections', () => {
	test('metadata covers every approved benefit without storing production limits', () => {
		expect(SUPPORT_POLICIES.map(item => item.key)).toEqual(['driveCapacityMb', 'canMakePrivateChannel', 'hataSideStudioProfileLimit', 'favoriteFolderLimit', 'canCreateFavoriteSubfolders', 'avatarDecorationLimit', 'emojiRequestLimit', 'hatadyBookLimit', 'canUseHatadySync', 'canUseNoteCharm', 'canUseMascot', 'mascotMaxExpressions', 'mascotMaxPhrases', 'mascotMaxCharacters', 'rateLimitFactor']);
		expect(SUPPORT_POLICIES.every(item => !('value' in item) && !('roleId' in item))).toBe(true);
	});
	test('localizes only the canonical defaults and retains administrator copy', () => {
		const policy = SUPPORT_POLICIES.find(item => item.key === 'favoriteFolderLimit');
		expect(policy).toBeDefined();
		if (!policy) throw new Error('Missing favoriteFolderLimit support policy');
		expect(supportPolicyDisplay(policy.key, policy.name, policy.description)).toEqual({ title: policy.name, description: policy.description });
		expect(supportPolicyDisplay(policy.key, 'Custom title', 'Custom description')).toEqual({ title: 'Custom title', description: 'Custom description' });
	});
	test.each([
		['driveCapacityMb', snapshot(100), '100 MB'], ['driveCapacityMb', snapshot(5120), '5 GB'],
		['canMakePrivateChannel', snapshot(true), '作成できます'], ['canMakePrivateChannel', snapshot(false), '作成できません'],
		['favoriteFolderLimit', snapshot(2), '2 個'], ['favoriteFolderLimit', snapshot(5), '5 個'],
		['emojiRequestLimit', snapshot(0, { available: false }), '0 件 / 7日'], ['emojiRequestLimit', snapshot(10), '10 件 / 7日'], ['emojiRequestLimit', snapshot(30), '30 件 / 7日'],
		['canUseNoteCharm', snapshot(true), '利用できます'], ['canUseNoteCharm', snapshot(false), '利用できません'],
		['canCreateFavoriteSubfolders', snapshot(true), '作成できます'], ['canCreateFavoriteSubfolders', snapshot(false), '作成できません'],
		['canUseHatadySync', snapshot(true), '同期できます'], ['canUseHatadySync', snapshot(false), '同期できません'],
		['hatadyBookLimit', snapshot(1000), '1,000 冊'], ['mascotMaxExpressions', snapshot(20), '20 表情 / キャラクター'],
		['mascotMaxPhrases', snapshot(50), '50 件 / キャラクター'], ['mascotMaxCharacters', snapshot(0), '0 体'],
		['rateLimitFactor', snapshot(0, { unlimited: true }), '一般APIの制限を免除'],
		['rateLimitFactor', snapshot(0.5, { rateMultiplier: 4 }), '回数上限 4倍相当'],
		['rateLimitFactor', snapshot(2, { rateMultiplier: 1 }), '標準の制限'],
		['rateLimitFactor', snapshot(0.5), '設定値 0.5'],
	])('%s formats a server projection as %s', (key, value, expected) => {
		expect(formatSupportSnapshot(key as string, value as SupportSnapshot)).toBe(expected);
	});
	test('invalid or missing values never become an available or unlimited claim', () => {
		for (const value of [null, NaN, Infinity]) expect(formatSupportSnapshot('mascotMaxCharacters', snapshot(value))).toBe('未設定');
		expect(formatSupportSnapshot('canUseMascot', snapshot(1))).toBe('未設定');
		expect(formatSupportSnapshot('driveCapacityMb', snapshot(true))).toBe('未設定');
		expect(formatSupportSnapshot('driveCapacityMb', null)).toBe('未設定');
		expect(formatSupportSnapshot('unknown', snapshot(100))).toBe('未設定');
	});
	test('disabled dependencies remain visible alongside counts and bypass projections', () => {
		expect(supportSnapshotCondition(snapshot(20, { condition: 'mascotUnavailable', available: false }))).toBe('マスコット機能は利用できません');
		expect(supportSnapshotCondition(null)).toBeNull();
	});
	test.each([
		['canMakePrivateChannel', 'プライベートチャンネル', ['プライベート', 'チャンネル']],
		['favoriteFolderLimit', 'お気に入りフォルダ', ['お気に入り', 'フォルダ']],
		['canCreateFavoriteSubfolders', 'お気に入りの子フォルダ', ['お気に入りの', '子フォルダ']],
		['avatarDecorationLimit', 'アバターデコレーション', ['アバター', 'デコレーション']],
		['mascotMaxPhrases', 'マスコットの最大文言数', ['マスコットの', '最大文言数']],
		['mascotMaxCharacters', 'マスコットの最大キャラクター数', ['マスコットの', '最大キャラクター数']],
	])('preserves approved %s title breaks and custom title text', (key, title, lines) => {
		expect(supportBenefitHeading(key as string, title as string)).toEqual(lines);
		expect(supportBenefitHeading(key as string, '<img src=x>')).toEqual(['<img src=x>']);
	});
	test('one-line sizing uses content width and full text rather than ellipsis', () => {
		expect(supportTextWidthBudget('同期できます')).toBeGreaterThan(6);
		expect(supportTextWidthBudget('50 件 / キャラクター')).toBeGreaterThan(supportTextWidthBudget('10 体'));
		expect(supportTextWidthBudget('')).toBeGreaterThan(0);
	});
	test('URLs are HTTPS-only and reject credentials and executable schemes', () => {
		expect(supportHttpsUrl('https://support.example.test/path?a=b')).toBe('https://support.example.test/path?a=b');
		for (const url of ['http://example.test', 'javascript:alert(1)', 'data:text/html,hello', 'https://name:secret@example.test/', '', 'not-a-url']) expect(supportHttpsUrl(url)).toBeNull();
	});
	test('disclosure includes all of card three and only a preview of the tail', () => {
		expect(supportDisclosureHeights(4000, 1000)).toEqual({ expanded: 4032, collapsed: 1108 });
		expect(supportDisclosureHeights(1000, 990)).toEqual({ expanded: 1032, collapsed: 1032 });
		expect(supportDisclosureHeights(0, 0, 0)).toEqual({ expanded: 0, collapsed: 0 });
	});
});
