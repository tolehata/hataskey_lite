/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const local = new Map<string, string>();
const commits: [string, unknown][] = [];
const preferenceValues = new Map<string, unknown>();
const api = vi.fn();
const settingsTransferLocale = vi.hoisted(() => ({
	ts: {
		categories: {
			generalLabel: 'Hataskey全体', generalDescription: '投稿フォーム、演出、フォント、プロフィールの表示設定',
			hatasabaUiLabel: 'Hataskey UI 2', hatasabaUiDescription: 'ナビ、デッキ、見た目と端末ごとの操作設定',
			hataSideStudioLabel: 'HataSideStudio', hataSideStudioDescription: 'プロファイル、拡大・縮小の配置、色、グループとウィジェット設定',
		},
		unknownVersion: '不明な版',
		validation: {
			typeMismatch: '値の型が合いません',
			unsupportedValue: 'この版では扱わない値です',
			stringLengthMismatch: '文字数の範囲が合いません',
			numberRangeMismatch: '値の範囲が合いません',
			noImportableItems: '読み込める項目がありません',
			unsupportedItem: 'この版では扱わない項目です',
			requiredItemMissing: '必要な項目がありません',
			categoryDataMissing: 'このカテゴリのデータがありません',
			unsupportedDeviceSetting: 'この版では扱わない端末設定です',
			unsupportedSetting: 'この版では扱わない設定です',
			unsupportedRegistryArea: 'この版では扱わない保存領域です',
			valueFormatMismatch: '値の形式が合いません',
			serverSaveFailed: 'サーバーへ保存できませんでした',
			notificationSettingsFormatMismatch: '通知設定の形式が合いません',
		},
	},
	tsx: {
		versionMismatch: ({ fileVersion, serverVersion }: { fileVersion: string; serverVersion: string }) => `この設定ファイルは Hataskey ${fileVersion} で作られ、現在のサーバーは ${serverVersion} です。\n古い／新しい版の設定は一部が合わず、表示や操作が壊れる場合があります。読み込める項目だけを適用し、未知・廃止・型が合わない項目はスキップします。`,
		validation: {
			overItemLimit: ({ max }: { max: string }) => `上限${max}件を超えた項目は読み込みません`,
			tooFewRequiredItems: ({ min }: { min: string }) => `必要な項目が${min}件未満です`,
		},
	},
}));

vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: { _hata: { _settingsTransfer: { _utility: settingsTransferLocale.ts } } },
		tsx: { _hata: { _settingsTransfer: { _utility: settingsTransferLocale.tsx } } },
	},
}));

vi.mock('@@/js/config.js', () => ({ version: '2026.7.0-hata.12.1.3' }));
vi.mock('@/local-storage.js', () => ({
	miLocalStorage: {
		getItem: (key: string) => local.get(key) ?? null,
		setItem: (key: string, value: string) => local.set(key, value),
		removeItem: (key: string) => local.delete(key),
	},
}));
vi.mock('@/preferences.js', () => ({
	prefer: {
		s: new Proxy({}, { get: (_target, key) => preferenceValues.has(String(key)) ? preferenceValues.get(String(key)) : `value:${String(key)}` }),
		commit: (key: string, value: unknown) => { commits.push([key, value]); preferenceValues.set(key, value); },
	},
}));
vi.mock('@/preferences/manager.js', () => ({
	getInitialPrefValue: (key: string) => key === 'postFormVisibilityBorder.width' ? 3 : key.endsWith('Nav') || key.endsWith('sidebar') ? [] : key.includes('enabled') || key.includes('show') || key.includes('Effect') || key.includes('Consent') ? false : '',
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => api(...args) }));
vi.mock('@/i.js', () => ({ $i: {
	id: 'user-a',
	showUtageSuccessCount: true,
	showUtageInterruptionCount: false,
	showHataskFlowerCount: true,
} }));

import {
	applyHataSettingsTransfer,
	createHataSettingsTransfer,
	getVersionMismatchMessage,
	HATA_SETTINGS_CATEGORIES,
	HATA_SETTINGS_TRANSFER_FORMAT,
	HATA_SETTINGS_TRANSFER_VERSION,
	parseHataSettingsTransfer,
} from './hata-settings-transfer.js';

describe('旗鯖独自設定の入出力', () => {
	beforeEach(() => {
		local.clear();
		commits.length = 0;
		preferenceValues.clear();
		api.mockReset();
		api.mockRejectedValue(new Error('未設定'));
	});

	test('カテゴリ表示は共通localeを使う', () => {
		expect(HATA_SETTINGS_CATEGORIES.find(category => category.id === 'general')).toMatchObject({
			label: 'Hataskey全体',
			description: '投稿フォーム、演出、フォント、プロフィールの表示設定',
		});
	});

	test('保管した花常は未知カテゴリとして扱い、既存の端末キャッシュやRegistryを変更しない', async () => {
		const existingProgress = '{"v":1,"storySeen":["chapter-1"]}';
		local.set('miux:hanaawase:progress', existingProgress);
		const parsed = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: HATA_SETTINGS_TRANSFER_VERSION,
			categories: {
				hanaawase: { registry: { settings: { se: false, motion: 'reduced' } } },
			},
		}));
		expect(parsed.unknownCategories).toEqual(['hanaawase']);
		const result = await applyHataSettingsTransfer(parsed.file, HATA_SETTINGS_CATEGORIES.map(category => category.id));
		expect(result.applied).toBe(0);
		expect(local.get('miux:hanaawase:progress')).toBe(existingProgress);
		expect(api).not.toHaveBeenCalled();
	});

	test('全カテゴリの書き出しでも花常の保存領域を取得しない', async () => {
		const file = await createHataSettingsTransfer(HATA_SETTINGS_CATEGORIES.map(category => category.id));
		expect(file.categories).not.toHaveProperty('hanaawase');
		expect(api.mock.calls.some(([, data]) => data?.scope?.includes('hanaawase'))).toBe(false);
		// Lite has no registry-backed category any more (the mascot was the only one), so the export reads no registry at all.
		expect(api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/get')).toBe(false);
	});

	test('未知カテゴリを残した新しい版のファイルも解析し、警告対象にする', () => {
		const parsed = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 99,
			serverVersion: '2099.1.0-hata.99.0',
			exportedAt: '2099-01-01T00:00:00.000Z',
			categories: { general: {}, futureTool: { setting: true } },
		}));
		expect(parsed.unknownCategories).toEqual(['futureTool']);
		expect(getVersionMismatchMessage(parsed.file)).toContain('2099.1.0-hata.99.0');
		expect(getVersionMismatchMessage(parsed.file)).toContain('スキップ');
	});

	test('書き出しは許可した設定だけを含み、外部ログイン情報を含めない', async () => {
		local.set('hatasabaTabSwipeEnabled', 'false');
		local.set('hataSideStudio', JSON.stringify({ version: 5, activeProfileId: 'p1', profiles: [{ id: 'p1', name: '持ち運び', expanded: { nodes: [], columns: 1, width: 'normal', parallax: false }, collapsed: { buttons: [] }, updatedAt: '2026-08-07T00:00:00.000Z' }] }));
		local.set('account', JSON.stringify({ token: 'SECRET' }));
		const file = await createHataSettingsTransfer(['hatasabaUi', 'hataSideStudio']);
		const text = JSON.stringify(file);
		expect(file.categories.hatasabaUi?.device?.hatasabaTabSwipeEnabled).toBe('false');
		expect(file.categories.hatasabaUi?.device).not.toHaveProperty('hataSideStudio');
		expect(JSON.parse(String(file.categories.hataSideStudio?.device?.hataSideStudio)).profiles[0].name).toBe('持ち運び');
		expect(text).not.toContain('external.token');
		expect(text).not.toContain('SECRET');
		expect(text).not.toContain('account');
	});

	test('端末設定を先に適用し、型の合わない項目だけをスキップする', async () => {
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 1,
			serverVersion: '2026.7.0-hata.12.0',
			exportedAt: '2026-08-06T00:00:00.000Z',
			categories: {
				hatasabaUi: {
					device: { hatasabaTabSwipeEnabled: 'false', hatasabaLastListId: 123 },
					preferences: { 'simpleUi.showTrendingTab': false },
				},
			},
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		expect(local.get('hatasabaTabSwipeEnabled')).toBe('false');
		expect(local.has('hatasabaLastListId')).toBe(false);
		expect(commits).toContainEqual(['simpleUi.showTrendingTab', false]);
		expect(result.applied).toBe(2);
		expect(result.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'hatasabaLastListId' })]));
	});

	test('ナビ配列の壊れた要素と未知フィールドだけを落とし、正常な要素を読み込む', async () => {
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 2,
			serverVersion: '2026.7.0-hata.12.0',
			exportedAt: '2026-08-07T00:00:00.000Z',
			categories: {
				hatasabaUi: {
					preferences: {
						'simpleUi.topNav': [
							{ id: 'local', icon: 'ti ti-planet', label: 'ローカル', visible: true, futureOption: 'skip-me' },
							{ id: 123, icon: 'ti ti-home', label: '壊れた項目', visible: true },
							'not-an-item',
						],
					},
				},
			},
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		expect(commits).toContainEqual(['simpleUi.topNav', [{ id: 'local', icon: 'ti ti-planet', label: 'ローカル', visible: true }]]);
		expect(result.applied).toBe(1);
		expect(result.skipped).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'simpleUi.topNav[0].futureOption', reason: 'この版では扱わない項目です' }),
			expect.objectContaining({ key: 'simpleUi.topNav[1].id' }),
			expect.objectContaining({ key: 'simpleUi.topNav[2]' }),
		]));
	});

	test('新デッキのネストした壊れたタブだけを落とし、既知の設定と兄弟タブを残す', async () => {
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 2,
			serverVersion: '2027.1.0-hata.13.0',
			exportedAt: '2027-01-01T00:00:00.000Z',
			categories: {
				hatasabaUi: {
					preferences: {
						'simpleUi.deckProfilesV2': [{
							id: 'profile-1', name: '持ち込み', layout: 'row', futureProfileField: true,
							slots: [{
								id: 'slot-1', width: 380,
								frames: [{
									id: 'frame-1', activeTab: 'tab-ok', height: 420,
									tabs: [
										{ id: 'tab-ok', type: 'local', tabColor: '#336699', excludeTypes: ['reaction'], notificationFilterKnownTypes: ['mention', 'reaction'], excludeBots: true },
										{ id: 'tab-broken', type: 42 },
									],
								}],
							}],
						}],
					},
				},
			},
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		const imported = commits.find(([key]) => key === 'simpleUi.deckProfilesV2')?.[1] as Array<Record<string, unknown>>;
		expect(imported).toHaveLength(1);
		expect(imported[0]).not.toHaveProperty('futureProfileField');
		expect((((imported[0].slots as Array<Record<string, unknown>>)[0].frames as Array<Record<string, unknown>>)[0].tabs as unknown[])).toEqual([
			{ id: 'tab-ok', type: 'local', tabColor: '#336699', excludeTypes: ['reaction'], notificationFilterKnownTypes: ['mention', 'reaction'], excludeBots: true },
		]);
		expect(result.applied).toBe(1);
		expect(result.skipped).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'simpleUi.deckProfilesV2[0].futureProfileField' }),
			expect.objectContaining({ key: 'simpleUi.deckProfilesV2[0].slots[0].frames[0].tabs[1].type' }),
		]));
	});

	test('配列の全要素が壊れている設定は現在値を空配列で上書きしない', async () => {
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 2,
			serverVersion: '2026.7.0-hata.12.0',
			exportedAt: '2026-08-07T00:00:00.000Z',
			categories: { hatasabaUi: { preferences: { 'simpleUi.deckRssFeeds': [{ id: 1, url: false }] } } },
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		expect(commits.some(([key]) => key === 'simpleUi.deckRssFeeds')).toBe(false);
		expect(result.applied).toBe(0);
		expect(result.skipped).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'simpleUi.deckRssFeeds[0].id' }),
			expect.objectContaining({ key: 'simpleUi.deckRssFeeds[0].url' }),
		]));
	});

	test('v1のHataSideStudio設定を独立カテゴリへ移し、JSON形状を検査して端末へ読み込む', async () => {
		const studio = JSON.stringify({
			version: 1,
			activeProfileId: 'p1',
			profiles: [{ id: 'p1', name: '持ち込み', expanded: { nodes: [], columns: 1, parallax: false }, collapsed: { buttons: [] }, updatedAt: '2026-08-06T00:00:00.000Z' }],
		});
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 1,
			serverVersion: '2026.7.0-hata.12.0',
			exportedAt: '2026-08-06T00:00:00.000Z',
			categories: { hatasabaUi: { device: { hataSideStudio: studio } } },
		})).file;
		expect(file.categories.hataSideStudio?.device?.hataSideStudio).toBe(studio);
		const result = await applyHataSettingsTransfer(file, ['hataSideStudio']);
		expect(JSON.parse(local.get('hataSideStudio') ?? '{}').profiles[0].name).toBe('持ち込み');
		expect(result.applied).toBe(1);
	});

});
