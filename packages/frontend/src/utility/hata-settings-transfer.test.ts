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
			hataskLabel: 'Hatask', hataskDescription: 'テーマやホーム表示などの設定（ToDo・記録は含みません）',
			hatadyLabel: 'Hatady', hatadyDescription: 'テーマ（学習記録・本棚は含みません）',
			hatafeedLabel: 'HataFeed', hatafeedDescription: 'HataFeedの表示設定（イシュー・申請内容は含みません）',
			mascotLabel: 'マスコット', mascotDescription: '通知、表示位置、表情切替の設定（キャラクター素材は含みません）',
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

	test('カテゴリ表示は共通localeを使い、地震津波は日本語固定を維持する', () => {
		expect(HATA_SETTINGS_CATEGORIES.find(category => category.id === 'general')).toMatchObject({
			label: 'Hataskey全体',
			description: '投稿フォーム、演出、フォント、プロフィールの表示設定',
		});
		expect(HATA_SETTINGS_CATEGORIES.find(category => category.id === 'earthquake')).toMatchObject({
			label: '地震・津波情報',
			description: '地域、更新間隔、通知条件',
		});
	});

	test('保管した花常は未知カテゴリとして扱い、既存の端末キャッシュやRegistryを変更しない', async () => {
		const existingProgress = '{"v":1,"storySeen":["chapter-1"]}';
		local.set('miux:hanaawase:progress', existingProgress);
		const parsed = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: HATA_SETTINGS_TRANSFER_VERSION,
			categories: {
				hatady: { device: { hatadyTheme: 'espresso' } },
				hanaawase: { registry: { settings: { se: false, motion: 'reduced' } } },
			},
		}));
		expect(parsed.unknownCategories).toEqual(['hanaawase']);
		const result = await applyHataSettingsTransfer(parsed.file, HATA_SETTINGS_CATEGORIES.map(category => category.id));
		expect(result.applied).toBe(1);
		expect(local.get('hatadyTheme')).toBe('espresso');
		expect(local.get('miux:hanaawase:progress')).toBe(existingProgress);
		expect(api).not.toHaveBeenCalled();
	});

	test('全カテゴリの書き出しでも花常の保存領域を取得しない', async () => {
		const file = await createHataSettingsTransfer(HATA_SETTINGS_CATEGORIES.map(category => category.id));
		expect(file.categories).not.toHaveProperty('hanaawase');
		expect(api.mock.calls.some(([, data]) => data?.scope?.includes('hanaawase'))).toBe(false);
		expect(api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/get')).toBe(true);
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
					preferences: { 'simpleUi.showTrendingTab': false, 'simpleUi.showHatadyTab': false },
				},
			},
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		expect(local.get('hatasabaTabSwipeEnabled')).toBe('false');
		expect(local.has('hatasabaLastListId')).toBe(false);
		expect(commits).toContainEqual(['simpleUi.showTrendingTab', false]);
		expect(commits).toContainEqual(['simpleUi.showHatadyTab', false]);
		expect(result.applied).toBe(3);
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

	test('通知詳細フィルタを旧カラム・旧プロファイル・新デッキで書き出し→復元→再書き出しする', async () => {
		const column = {
			id: 'column-1', type: 'notifications', width: 340, excludeTypes: ['reaction'], notificationFilterKnownTypes: ['reaction', 'mention'], excludeBots: true,
			notificationFilterDetails: { includeBrands: null, includeHataskApp: false, excludeHatadySubtypes: ['future-subtype'], knownHatadySubtypes: ['future-subtype'] },
		};
		const profileColumn = {
			...column, id: 'column-2', notificationFilterDetails: {
				includeBrands: ['hatady', 'future-brand'], includeHataskApp: true,
				excludeHatadySubtypes: ['note', 'future-subtype'], knownHatadySubtypes: ['note', 'future-subtype'],
			},
		};
		const tab = {
			id: 'tab-1', type: 'notifications', tabColor: '#336699', excludeTypes: ['mention'], notificationFilterKnownTypes: ['mention'], excludeBots: false,
			notificationFilterDetails: { includeBrands: [], includeHataskApp: false, excludeHatadySubtypes: ['future-subtype'], knownHatadySubtypes: ['future-subtype'] },
		};
		const values = {
			'simpleUi.deckColumns': [column],
			'simpleUi.deckProfiles': [{ id: 'profile-old', name: '旧デッキ', layout: 'row', columns: [profileColumn] }],
			'simpleUi.deckProfilesV2': [{ id: 'profile-new', name: '新デッキ', layout: 'row', slots: [{ id: 'slot-1', width: 380, frames: [{ id: 'frame-1', tabs: [tab] }] }] }],
		};
		for (const [key, value] of Object.entries(values)) preferenceValues.set(key, value);
		const exported = await createHataSettingsTransfer(['hatasabaUi']);
		const imported = parseHataSettingsTransfer(JSON.stringify(exported)).file;
		const result = await applyHataSettingsTransfer(imported, ['hatasabaUi']);
		const exportedAgain = await createHataSettingsTransfer(['hatasabaUi']);
		for (const [key, value] of Object.entries(values)) {
			expect(commits).toContainEqual([key, value]);
			expect(exportedAgain.categories.hatasabaUi?.preferences?.[key]).toEqual(exported.categories.hatasabaUi?.preferences?.[key]);
		}
		expect(result.skipped.filter(item => Object.hasOwn(values, item.key))).toEqual([]);
	});

	test('通知詳細フィルタの不正な値だけをスキップし、未知の文字列は保持する', async () => {
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT, formatVersion: HATA_SETTINGS_TRANSFER_VERSION,
			categories: { hatasabaUi: { preferences: { 'simpleUi.deckColumns': [{
				id: 'column-1', type: 'notifications', width: 340,
				notificationFilterDetails: {
					includeBrands: ['hatady', 42, 'future-brand'], includeHataskApp: 'false',
					excludeHatadySubtypes: ['future-subtype', false], knownHatadySubtypes: ['future-subtype'],
				},
			}] } } },
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatasabaUi']);
		expect(commits).toContainEqual(['simpleUi.deckColumns', [{
			id: 'column-1', type: 'notifications', width: 340,
			notificationFilterDetails: {
				includeBrands: ['hatady', 'future-brand'], excludeHatadySubtypes: ['future-subtype'], knownHatadySubtypes: ['future-subtype'],
			},
		}]]);
		expect(result.skipped).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'simpleUi.deckColumns[0].notificationFilterDetails.includeBrands[1]' }),
			expect.objectContaining({ key: 'simpleUi.deckColumns[0].notificationFilterDetails.includeHataskApp' }),
			expect.objectContaining({ key: 'simpleUi.deckColumns[0].notificationFilterDetails.excludeHatadySubtypes[1]' }),
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

	test('新形式は両UIの構成を書き出して復元し、旧形式は既存UI Sを保持する', async () => {
		const legacy = JSON.stringify({ version: 9, activeProfileId: 'old', profiles: [{ id: 'old', name: '旧UI' }] });
		const uiS = JSON.stringify({ version: 9, activeProfileId: 'new', profiles: [{ id: 'new', name: 'UI S' }] });
		local.set('hataSideStudio', legacy);
		const beforeFirstUiS = await createHataSettingsTransfer(['hataSideStudio']);
		expect(beforeFirstUiS.categories.hataSideStudio?.device?.hataSideStudioUiS).toBe(legacy);
		local.set('hataSideStudioUiS', uiS);
		const exported = await createHataSettingsTransfer(['hataSideStudio']);
		expect(exported.categories.hataSideStudio?.device).toMatchObject({ hataSideStudio: legacy, hataSideStudioUiS: uiS });
		local.set('hataSideStudioUiS', uiS);
		const oldFile = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT, formatVersion: 1,
			categories: { hatasabaUi: { device: { hataSideStudio: legacy } } },
		})).file;
		await applyHataSettingsTransfer(oldFile, ['hataSideStudio']);
		expect(local.get('hataSideStudioUiS')).toBe(uiS);
		await applyHataSettingsTransfer(exported, ['hataSideStudio']);
		expect(JSON.parse(local.get('hataSideStudioUiS')!).profiles[0].name).toBe('UI S');
	});

	test('廃止した起動時表示と未知項目は捨て、既存項目を残して既知項目だけを上書きする', async () => {
		api.mockImplementation((endpoint: string, data: { value?: unknown }) => {
			if (endpoint === 'i/registry/get') return Promise.resolve({ showClock: true, theme: 'kisetsu', openOnStart: true });
			if (endpoint === 'i/registry/set') return Promise.resolve(data.value);
			return Promise.reject(new Error('unexpected'));
		});
		const exported = await createHataSettingsTransfer(['hatask']);
		expect(exported.categories.hatask?.registry?.settings).toEqual({ showClock: true, theme: 'kisetsu' });
		const file = parseHataSettingsTransfer(JSON.stringify({
			format: HATA_SETTINGS_TRANSFER_FORMAT,
			formatVersion: 2,
			serverVersion: '2027.1.0-hata.13.0',
			exportedAt: '2027-01-01T00:00:00.000Z',
			categories: { hatask: { registry: { settings: { showClock: false, openOnStart: true, futureSetting: 'unknown' } } } },
		})).file;
		const result = await applyHataSettingsTransfer(file, ['hatask']);
		const setCall = api.mock.calls.find(call => call[0] === 'i/registry/set');
		expect(setCall?.[1].value).toEqual({ showClock: false, theme: 'kisetsu', openOnStart: true });
		expect(result.applied).toBe(1);
		expect(result.skipped).toContainEqual(expect.objectContaining({ key: 'settings.futureSetting' }));
		expect(result.skipped).toContainEqual(expect.objectContaining({ key: 'settings.openOnStart' }));
	});

	test('Hatadyはテーマだけを書き出し、読み込み時も旧言語設定を消さない', async () => {
		api.mockImplementation((endpoint: string, data: { value?: unknown }) => {
			if (endpoint === 'i/registry/get') return Promise.resolve({ theme: 'paper', lang: 'en', futureDisplay: true });
			if (endpoint === 'i/registry/set') return Promise.resolve(data.value);
			return Promise.reject(new Error('unexpected'));
		});

		const exported = await createHataSettingsTransfer(['hatady']);
		expect(exported.categories.hatady?.registry?.display).toEqual({ theme: 'paper' });
		expect(exported.categories.hatady?.device).toBeUndefined();

		const imported = parseHataSettingsTransfer(JSON.stringify({
			...exported,
			categories: { hatady: { registry: { display: { theme: 'espresso' } } } },
		})).file;
		const result = await applyHataSettingsTransfer(imported, ['hatady']);
		const setCall = api.mock.calls.find(call => call[0] === 'i/registry/set');
		expect(setCall?.[1].value).toEqual({ theme: 'espresso', lang: 'en', futureDisplay: true });
		expect(result.applied).toBe(1);
	});
});
