/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖独自設定の持ち運び。秘密情報・利用者データを混ぜないため、保存対象は許可リストで固定する。
 */

import { version } from '@@/js/config.js';
import type { PREF_DEF } from '@/preferences/def.js';
import type { Keys as LocalStorageKey } from '@/local-storage.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { isHataskMoodReminderTimeZone } from '@/utility/hatask-mood-reminder.js';

export const HATA_SETTINGS_TRANSFER_FORMAT = 'hataskey-custom-settings';
export const HATA_SETTINGS_TRANSFER_VERSION = 3;
export const HATA_SETTINGS_TRANSFER_MAX_BYTES = 1024 * 1024;
const copy = i18n.ts._hata._settingsTransfer._utility;
const copyx = i18n.tsx._hata._settingsTransfer._utility;

type PreferenceKey = keyof typeof PREF_DEF;
export type HataSettingsCategoryId = 'general' | 'hatasabaUi' | 'hataSideStudio' | 'hatask' | 'hatady' | 'hatafeed' | 'mascot' | 'earthquake';

type RegistryTarget = {
	id: string;
	scope: string[];
	key: string;
	validate: (value: unknown) => boolean;
	fields?: Readonly<Partial<Record<string, (value: unknown) => boolean>>>;
};

type CategoryDefinition = {
	id: HataSettingsCategoryId;
	label: string;
	description: string;
	preferenceKeys?: readonly PreferenceKey[];
	localKeys?: readonly LocalStorageKey[];
	registry?: readonly RegistryTarget[];
	profileBadges?: boolean;
	earthquakeNotifications?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value);
const isBooleanString = (value: unknown) => value === 'true' || value === 'false';
const isString = (value: unknown) => typeof value === 'string';
const isBoolean = (value: unknown) => typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString);
const isPollSeconds = (value: unknown) => typeof value === 'string' && ['10', '30', '60', '300', '600'].includes(value);
const isPostDelaySeconds = (value: unknown) => typeof value === 'string' && ['3', '5', '10'].includes(value);
// HataSideStudio 本体は読み込み時に端末設定を初期化するため、設定転送の構文検査からは
// import しない。ここではファイルを開くだけで現在のサイドバー状態へ触れない純粋検査にする。
const isHataSideStudioStorageString = (value: unknown) => {
	if (typeof value !== 'string' || value.length > 512 * 1024) return false;
	try {
		const parsed: unknown = JSON.parse(value);
		return isRecord(parsed) && Array.isArray(parsed.profiles);
	} catch {
		return false;
	}
};

const localValidators: Partial<Record<LocalStorageKey, (value: unknown) => boolean>> = {
	hatasabaLastListId: isString,
	hatasabaLastAntennaId: isString,
	hatasabaDeckIgnoreWidth: isBooleanString,
	hatasabaTabSwipeEnabled: isBooleanString,
	hataHideMutedReactions: isBooleanString,
	hataGlassUi: isBooleanString,
	hataGlassUiBubble: isBooleanString,
	hatadyTheme: value => value === 'paper' || value === 'espresso' || value === 'hataskey',
	// 旧形式の設定ファイルを安全に読み取るため検証器だけ残す。新規の書き出し・読み込み対象にはしない。
	hatadyLang: value => value === 'ja' || value === 'en' || value === 'auto',
	hataEarthquakePref: isString,
	hataEarthquakePollSec: isPollSeconds,
	hataPostDelayEnabled: isBooleanString,
	hataPostDelaySeconds: isPostDelaySeconds,
	hataSideStudio: isHataSideStudioStorageString,
	hataSideStudioUiS: isHataSideStudioStorageString,
};

const generalPreferenceKeys = [
	'showHashtagButtonInPostForm', 'showDrawingButtonInPostForm', 'showLoginBonusPopup', 'timelineAnimationDirection',
	'postFormVisibilityBorder.enabled', 'postFormVisibilityBorder.width', 'postFormVisibilityBorder.color.public',
	'postFormVisibilityBorder.color.home', 'postFormVisibilityBorder.color.followers', 'postFormVisibilityBorder.color.specified',
	'weatherEffect.enabled', 'weatherEffect.scope', 'weatherEffect.duration', 'weatherEffect.intensity', 'weatherEffect.respectReducedMotion',
	'hataFont.id', 'hataFont.customUrl', 'hataFont.customName', 'hataFont.customFontConsent',
] as const satisfies readonly PreferenceKey[];

// お知らせ既読・チュートリアル完了などの進行状態は「設定」ではないため含めない。
const hatasabaUiPreferenceKeys = [
	'simpleUi.showTrendingTab', 'simpleUi.showHatadyTab', 'simpleUi.topNav', 'simpleUi.bottomNav', 'simpleUi.sidebar', 'simpleUi.widgetBorder',
	'simpleUi.glassEffect', 'simpleUi.showPageHeader', 'simpleUi.deckMode', 'simpleUi.sidebarCollapsed',
	'simpleUi.topNavMode', 'simpleUi.deckNoBannerBg', 'simpleUi.normalNoBannerBg', 'simpleUi.profileNoBannerBg',
	'simpleUi.deckLatestNoteText', 'simpleUi.glassUiCardOpacity', 'simpleUi.showLegacyChannelPostButton',
	'simpleUi.hideBotsInTimeline', 'simpleUi.botAllowlist', 'simpleUi.deckLayout', 'simpleUi.deckColumns',
	'simpleUi.deckProfiles', 'simpleUi.deckActiveProfile', 'simpleUi.deckLocked', 'simpleUi.deckProfilesV2',
	'simpleUi.deckActiveProfileV2', 'simpleUi.deckToolbarPos', 'simpleUi.deckClock', 'simpleUi.deckRssFeeds',
	'simpleUi.deckRssEnabled', 'simpleUi.deckOnlineUsers', 'simpleUi.noteSpacing', 'simpleUi.showTimelineDateOnMobile',
	'simpleUi.disableBubbleInHatasabaDeck', 'simpleUi.disableBubbleInHatasabaNormal', 'simpleUi.classicNoteSpacing',
] as const satisfies readonly PreferenceKey[];

export const HATA_SETTINGS_CATEGORIES: readonly CategoryDefinition[] = [
	{
		id: 'general', label: copy.categories.generalLabel, description: copy.categories.generalDescription,
		preferenceKeys: generalPreferenceKeys, localKeys: ['hataHideMutedReactions'], profileBadges: true,
	},
	{
		id: 'hatasabaUi', label: copy.categories.hatasabaUiLabel, description: copy.categories.hatasabaUiDescription,
		preferenceKeys: hatasabaUiPreferenceKeys,
		localKeys: ['hatasabaLastListId', 'hatasabaLastAntennaId', 'hatasabaDeckIgnoreWidth', 'hatasabaTabSwipeEnabled', 'hataGlassUi', 'hataGlassUiBubble'],
	},
	{
		id: 'hataSideStudio', label: copy.categories.hataSideStudioLabel, description: copy.categories.hataSideStudioDescription,
		localKeys: ['hataSideStudio', 'hataSideStudioUiS'],
	},
	{
		id: 'hatask', label: copy.categories.hataskLabel, description: copy.categories.hataskDescription,
		registry: [{
			id: 'settings', scope: ['client', 'hatask'], key: 'settings', validate: isRecord,
			fields: {
				darkMode: isBoolean, autoTheme: isBoolean, weekStart: value => value === 'mon' || value === 'sun',
				showClock: isBoolean, showEvents: isBoolean, showFlower: isBoolean, showMoodSummary: isBoolean,
				showMealSection: isBoolean, showFeedbackNotif: isBoolean, showEarthquake: isBoolean,
				moodRemind: isBoolean, moodRemindTimes: isStringArray, moodRemindTimeZone: isHataskMoodReminderTimeZone,
				showMealSummary: isBoolean, theme: isString, animations: isBoolean,
			},
		}],
	},
	{
		id: 'hatady', label: copy.categories.hatadyLabel, description: copy.categories.hatadyDescription,
		localKeys: ['hatadyTheme'],
		registry: [{
			id: 'display', scope: ['client', 'hatady'], key: 'display', validate: isRecord,
			fields: {
				theme: value => value === 'paper' || value === 'espresso' || value === 'hataskey',
			},
		}],
	},
	{
		id: 'hatafeed', label: copy.categories.hatafeedLabel, description: copy.categories.hatafeedDescription,
		preferenceKeys: ['hatafeed.leaves'],
		localKeys: ['hataPostDelayEnabled', 'hataPostDelaySeconds'],
	},
	{
		id: 'mascot', label: copy.categories.mascotLabel, description: copy.categories.mascotDescription,
		registry: [{
			id: 'displaySettings', scope: ['client', 'hataMascot'], key: 'displaySettings', validate: isRecord,
			fields: {
				tellBirthday: isBoolean, tellNotifications: isBoolean, tellRandomPhrases: isBoolean,
				tellUnreadOnLogin: isBoolean, tellHataskNotifications: isBoolean, suppressStandardToast: isBoolean,
				notifyDurationSec: isFiniteNumber, floatingEnabledDesktop: isBoolean, floatingEnabledMobile: isBoolean,
				floatingX: isFiniteNumber, floatingY: isFiniteNumber, floatingBackdropOpacity: isFiniteNumber,
				floatingBackdropColor: isString, floatingFlip: isBoolean, floatingOpacity: isFiniteNumber,
				floatingMinimizeCorner: value => value === 'left' || value === 'right', idleMinSec: isFiniteNumber, idleMaxSec: isFiniteNumber,
			},
		}],
	},
	{
		id: 'earthquake', label: '地震・津波情報', description: '地域、更新間隔、通知条件',
		localKeys: ['hataEarthquakePref', 'hataEarthquakePollSec'], earthquakeNotifications: true,
	},
] as const;

type CategoryPayload = {
	device?: Record<string, string>;
	preferences?: Record<string, unknown>;
	registry?: Record<string, unknown>;
	profileBadges?: Record<string, boolean>;
	earthquakeNotifications?: Record<string, unknown>;
};

export type HataSettingsTransferFile = {
	format: typeof HATA_SETTINGS_TRANSFER_FORMAT;
	formatVersion: number;
	serverVersion: string;
	exportedAt: string;
	categories: Partial<Record<HataSettingsCategoryId, CategoryPayload>>;
};

export type SettingsTransferSkip = { category: string; key: string; reason: string };
export type SettingsTransferResult = { applied: number; skipped: SettingsTransferSkip[] };

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

type NestedSchema =
	| { type: 'string'; values?: readonly string[]; minLength?: number; maxLength?: number }
	| { type: 'boolean' }
	| { type: 'number'; integer?: boolean; min?: number; max?: number }
	| { type: 'nullable'; value: NestedSchema }
	| { type: 'array'; item: NestedSchema; minItems?: number; maxItems: number }
	| { type: 'object'; fields: Readonly<Record<string, { schema: NestedSchema; required?: boolean }>> };

type NestedValueSkip = { path: string; reason: string };
type NestedValueResult = { accepted: true; value: unknown; skipped: NestedValueSkip[] } | { accepted: false; skipped: NestedValueSkip[] };

const stringSchema = (maxLength = 512, minLength = 0): NestedSchema => ({ type: 'string', minLength, maxLength });
const required = (schema: NestedSchema) => ({ schema, required: true });
const optional = (schema: NestedSchema) => ({ schema });
const nullableStringSchema: NestedSchema = { type: 'nullable', value: stringSchema(512) };
const layoutSchema: NestedSchema = { type: 'string', values: ['row', 'grid2', 'grid3', 'stack'] };
const dimensionSchema: NestedSchema = { type: 'number', min: 1, max: 10000 };

const navItemSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		icon: required(stringSchema(256, 1)),
		label: required(stringSchema(512, 1)),
		visible: optional({ type: 'boolean' }),
	},
};

const sidebarItemSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		icon: required(stringSchema(256, 1)),
		label: required(stringSchema(512, 1)),
		group: optional(stringSchema(256)),
		external: optional({ type: 'boolean' }),
		url: optional(stringSchema(16384)),
	},
};

const notificationFilterDetailsSchema: NestedSchema = {
	type: 'object',
	fields: {
		includeBrands: optional({ type: 'nullable', value: { type: 'array', item: stringSchema(128, 1), maxItems: 100 } }),
		includeHataskApp: optional({ type: 'boolean' }),
		excludeHatadySubtypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
		knownHatadySubtypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
	},
};

const deckColumnSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		type: required(stringSchema(128, 1)),
		width: required(dimensionSchema),
		height: optional(dimensionSchema),
		name: optional(stringSchema(512)),
		sourceId: optional(stringSchema(512)),
		withRenotes: optional({ type: 'boolean' }),
		borderColor: optional(nullableStringSchema),
		fullWidth: optional({ type: 'boolean' }),
		fullHeight: optional({ type: 'boolean' }),
		excludeTypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
		notificationFilterKnownTypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
		notificationFilterDetails: optional(notificationFilterDetailsSchema),
		excludeBots: optional({ type: 'boolean' }),
	},
};

const deckTabSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		type: required(stringSchema(128, 1)),
		name: optional(stringSchema(512)),
		sourceId: optional(stringSchema(512)),
		withRenotes: optional({ type: 'boolean' }),
		tabName: optional(stringSchema(512)),
		tabColor: optional(nullableStringSchema),
		excludeTypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
		notificationFilterKnownTypes: optional({ type: 'array', item: stringSchema(128, 1), maxItems: 100 }),
		notificationFilterDetails: optional(notificationFilterDetailsSchema),
		excludeBots: optional({ type: 'boolean' }),
	},
};

const deckFrameSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		activeTab: optional(stringSchema(256)),
		borderColor: optional(nullableStringSchema),
		height: optional(dimensionSchema),
		tabs: required({ type: 'array', item: deckTabSchema, minItems: 1, maxItems: 100 }),
	},
};

const deckSlotSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		width: required(dimensionSchema),
		height: optional(dimensionSchema),
		fullWidth: optional({ type: 'boolean' }),
		fullHeight: optional({ type: 'boolean' }),
		frames: required({ type: 'array', item: deckFrameSchema, maxItems: 100 }),
	},
};

const deckProfileSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		name: required(stringSchema(512, 1)),
		layout: required(layoutSchema),
		columns: required({ type: 'array', item: deckColumnSchema, maxItems: 100 }),
	},
};

const deckProfileV2Schema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		name: required(stringSchema(512, 1)),
		layout: required(layoutSchema),
		slots: required({ type: 'array', item: deckSlotSchema, maxItems: 100 }),
	},
};

const deckRssFeedSchema: NestedSchema = {
	type: 'object',
	fields: {
		id: required(stringSchema(256, 1)),
		url: required(stringSchema(16384, 1)),
		name: optional(stringSchema(512)),
		color: optional(stringSchema(512)),
	},
};

const nestedPreferenceSchemas: Partial<Record<PreferenceKey, NestedSchema>> = {
	'simpleUi.topNav': { type: 'array', item: navItemSchema, maxItems: 100 },
	'simpleUi.bottomNav': { type: 'array', item: navItemSchema, maxItems: 100 },
	'simpleUi.sidebar': { type: 'array', item: sidebarItemSchema, maxItems: 200 },
	'simpleUi.botAllowlist': { type: 'array', item: stringSchema(512, 1), maxItems: 5000 },
	'simpleUi.deckColumns': { type: 'array', item: deckColumnSchema, maxItems: 100 },
	'simpleUi.deckProfiles': { type: 'array', item: deckProfileSchema, maxItems: 50 },
	'simpleUi.deckProfilesV2': { type: 'array', item: deckProfileV2Schema, maxItems: 50 },
	'simpleUi.deckRssFeeds': { type: 'array', item: deckRssFeedSchema, maxItems: 5 },
};

function joinNestedPath(path: string, part: string): string {
	return part.startsWith('[') ? `${path}${part}` : path ? `${path}.${part}` : part;
}

function rejectNested(path: string, reason: string): NestedValueResult {
	return { accepted: false, skipped: [{ path, reason }] };
}

function sanitizeNestedValue(value: unknown, schema: NestedSchema, path = ''): NestedValueResult {
	if (schema.type === 'string') {
		if (typeof value !== 'string') return rejectNested(path, copy.validation.typeMismatch);
		if (schema.values && !schema.values.includes(value)) return rejectNested(path, copy.validation.unsupportedValue);
		if ((schema.minLength != null && value.length < schema.minLength) || (schema.maxLength != null && value.length > schema.maxLength)) return rejectNested(path, copy.validation.stringLengthMismatch);
		return { accepted: true, value, skipped: [] };
	}
	if (schema.type === 'boolean') return typeof value === 'boolean' ? { accepted: true, value, skipped: [] } : rejectNested(path, copy.validation.typeMismatch);
	if (schema.type === 'number') {
		if (!isFiniteNumber(value) || (schema.integer === true && !Number.isInteger(value))) return rejectNested(path, copy.validation.typeMismatch);
		if ((schema.min != null && value < schema.min) || (schema.max != null && value > schema.max)) return rejectNested(path, copy.validation.numberRangeMismatch);
		return { accepted: true, value, skipped: [] };
	}
	if (schema.type === 'nullable') return value === null ? { accepted: true, value: null, skipped: [] } : sanitizeNestedValue(value, schema.value, path);
	if (schema.type === 'array') {
		if (!Array.isArray(value)) return rejectNested(path, copy.validation.typeMismatch);
		const next: unknown[] = [];
		const skipped: NestedValueSkip[] = [];
		const limit = Math.min(value.length, schema.maxItems);
		for (let index = 0; index < limit; index++) {
			const item = sanitizeNestedValue(value[index], schema.item, joinNestedPath(path, `[${index}]`));
			skipped.push(...item.skipped);
			if (item.accepted) next.push(item.value);
		}
		if (value.length > schema.maxItems) skipped.push({ path: joinNestedPath(path, `[${schema.maxItems}…]`), reason: copyx.validation.overItemLimit({ max: schema.maxItems.toString() }) });
		if (schema.minItems != null && next.length < schema.minItems) {
			skipped.push({ path, reason: copyx.validation.tooFewRequiredItems({ min: schema.minItems.toString() }) });
			return { accepted: false, skipped };
		}
		if (value.length > 0 && next.length === 0) return { accepted: false, skipped: skipped.length > 0 ? skipped : [{ path, reason: copy.validation.noImportableItems }] };
		return { accepted: true, value: next, skipped };
	}
	if (!isRecord(value)) return rejectNested(path, copy.validation.typeMismatch);
	const next: Record<string, unknown> = {};
	const skipped: NestedValueSkip[] = [];
	for (const key of Object.keys(value)) {
		if (!Object.hasOwn(schema.fields, key)) skipped.push({ path: joinNestedPath(path, key), reason: copy.validation.unsupportedItem });
	}
	for (const [key, definition] of Object.entries(schema.fields)) {
		const childPath = joinNestedPath(path, key);
		if (!Object.hasOwn(value, key)) {
			if (definition.required) skipped.push({ path: childPath, reason: copy.validation.requiredItemMissing });
			continue;
		}
		const child = sanitizeNestedValue(value[key], definition.schema, childPath);
		skipped.push(...child.skipped);
		if (child.accepted) next[key] = child.value;
	}
	for (const [key, definition] of Object.entries(schema.fields)) {
		if (definition.required && !Object.hasOwn(next, key)) return { accepted: false, skipped };
	}
	return { accepted: true, value: next, skipped };
}

function valueMatchesDefault(value: unknown, expected: unknown): boolean {
	if (expected === null) return value === null;
	if (Array.isArray(expected)) return Array.isArray(value);
	if (isRecord(expected)) return isRecord(value);
	if (typeof expected === 'number') return isFiniteNumber(value);
	return typeof value === typeof expected;
}

function preferenceSkipKey(key: PreferenceKey, path: string): string {
	if (!path) return key;
	return path.startsWith('[') ? `${key}${path}` : `${key}.${path}`;
}

function filterRegistryFields(value: unknown, target: RegistryTarget): Record<string, unknown> | undefined {
	if (!isRecord(value) || !target.fields) return target.validate(value) ? cloneJson(value as Record<string, unknown>) : undefined;
	const filtered: Record<string, unknown> = {};
	for (const [key, validate] of Object.entries(target.fields)) {
		if (validate && Object.hasOwn(value, key) && validate(value[key])) filtered[key] = cloneJson(value[key]);
	}
	return filtered;
}

export function parseHataSettingsTransfer(text: string): { file: HataSettingsTransferFile; unknownCategories: string[] } {
	const parsed: unknown = JSON.parse(text);
	if (!isRecord(parsed) || parsed.format !== HATA_SETTINGS_TRANSFER_FORMAT || !isRecord(parsed.categories)) {
		throw new Error('FORMAT');
	}
	if (typeof parsed.formatVersion !== 'number' || !Number.isInteger(parsed.formatVersion) || parsed.formatVersion < 1) {
		throw new Error('VERSION');
	}
	// v1ではHataSideStudioがHataskey UI 2内に入っていた。古い書き出しもそのまま
	// 読めるよう、新しい独立カテゴリへコピーしてから検査・選択へ渡す。
	const normalized = cloneJson(parsed) as Record<string, unknown>;
	const categories = normalized.categories as Record<string, unknown>;
	const oldUi = isRecord(categories.hatasabaUi) ? categories.hatasabaUi : null;
	const oldDevice = oldUi && isRecord(oldUi.device) ? oldUi.device : null;
	if (!isRecord(categories.hataSideStudio) && oldDevice && Object.hasOwn(oldDevice, 'hataSideStudio')) {
		categories.hataSideStudio = { device: { hataSideStudio: cloneJson(oldDevice.hataSideStudio) } };
	}
	const known = new Set(HATA_SETTINGS_CATEGORIES.map(category => category.id));
	return {
		file: normalized as unknown as HataSettingsTransferFile,
		unknownCategories: Object.keys(categories).filter(id => !known.has(id as HataSettingsCategoryId)),
	};
}

export function getVersionMismatchMessage(file: HataSettingsTransferFile): string | null {
	if (file.serverVersion === version) return null;
	return copyx.versionMismatch({ fileVersion: file.serverVersion || copy.unknownVersion, serverVersion: version });
}

async function registryGet(target: RegistryTarget): Promise<unknown | undefined> {
	try {
		return await misskeyApi('i/registry/get', { scope: target.scope, key: target.key }) as unknown;
	} catch {
		return undefined;
	}
}

export async function createHataSettingsTransfer(selected: readonly HataSettingsCategoryId[]): Promise<HataSettingsTransferFile> {
	const categories: HataSettingsTransferFile['categories'] = {};
	const preferAny = prefer as unknown as { s: Record<string, unknown> };
	for (const definition of HATA_SETTINGS_CATEGORIES) {
		if (!selected.includes(definition.id)) continue;
		const payload: CategoryPayload = {};
		for (const key of definition.localKeys ?? []) {
			const value = miLocalStorage.getItem(key);
			if (value != null) (payload.device ??= {})[key] = value;
		}
		// UI Sをまだ開いていない端末でも、旧UIの構成を移行前の初期値として持ち運ぶ。
		if (definition.id === 'hataSideStudio' && payload.device?.hataSideStudioUiS == null && payload.device?.hataSideStudio != null) {
			payload.device ??= {};
			payload.device.hataSideStudioUiS = payload.device.hataSideStudio;
		}
		for (const key of definition.preferenceKeys ?? []) {
			(payload.preferences ??= {})[key] = cloneJson(preferAny.s[key]);
		}
		for (const target of definition.registry ?? []) {
			const value = await registryGet(target);
			const filtered = value === undefined ? undefined : filterRegistryFields(value, target);
			if (filtered !== undefined) (payload.registry ??= {})[target.id] = filtered;
		}
		if (definition.profileBadges && $i) {
			const user = $i as unknown as {
				showUtageSuccessCount?: boolean;
				showUtageInterruptionCount?: boolean;
				showHataskFlowerCount?: boolean;
			};
			payload.profileBadges = {
				showUtageSuccessCount: user.showUtageSuccessCount ?? true,
				showUtageInterruptionCount: user.showUtageInterruptionCount ?? true,
				showHataskFlowerCount: user.showHataskFlowerCount ?? true,
			};
		}
		if (definition.earthquakeNotifications) {
			const value = await misskeyApi('hata/earthquake/notification-settings', {}).catch(() => undefined) as unknown;
			if (isRecord(value)) payload.earthquakeNotifications = cloneJson(value);
		}
		categories[definition.id] = payload;
	}
	return { format: HATA_SETTINGS_TRANSFER_FORMAT, formatVersion: HATA_SETTINGS_TRANSFER_VERSION, serverVersion: version, exportedAt: new Date().toISOString(), categories };
}

export async function applyHataSettingsTransfer(file: HataSettingsTransferFile, selected: readonly HataSettingsCategoryId[]): Promise<SettingsTransferResult> {
	const result: SettingsTransferResult = { applied: 0, skipped: [] };
	const preferAny = prefer as unknown as { commit: (key: string, value: unknown) => void };
	for (const definition of HATA_SETTINGS_CATEGORIES) {
		if (!selected.includes(definition.id)) continue;
		const payload = file.categories[definition.id];
		if (!isRecord(payload)) { result.skipped.push({ category: definition.id, key: '*', reason: copy.validation.categoryDataMissing }); continue; }
		if (isRecord(payload.device)) {
			const known = new Set<string>(definition.localKeys ?? []);
			for (const key of Object.keys(payload.device)) if (!known.has(key)) result.skipped.push({ category: definition.id, key, reason: copy.validation.unsupportedDeviceSetting });
		}
		if (isRecord(payload.preferences)) {
			const known = new Set<string>(definition.preferenceKeys ?? []);
			for (const key of Object.keys(payload.preferences)) if (!known.has(key)) result.skipped.push({ category: definition.id, key, reason: copy.validation.unsupportedSetting });
		}
		if (isRecord(payload.registry)) {
			const known = new Set((definition.registry ?? []).map(target => target.id));
			for (const key of Object.keys(payload.registry)) if (!known.has(key)) result.skipped.push({ category: definition.id, key, reason: copy.validation.unsupportedRegistryArea });
		}

		// 端末設定を先に適用する。サーバー保存に失敗しても、この端末の復元は残る。
		for (const key of definition.localKeys ?? []) {
			if (!isRecord(payload.device) || !Object.hasOwn(payload.device, key)) continue;
			const value = payload.device[key];
			const validator = localValidators[key] ?? isString;
			if (!validator(value)) { result.skipped.push({ category: definition.id, key, reason: copy.validation.valueFormatMismatch }); continue; }
			// HataSideStudio は共有refでサイドバーへ即時反映する。静的importすると設定転送を
			// 開いただけで端末設定を初期化するため、実際に読み込んだ時だけ遅延反映する。
			if (key === 'hataSideStudio' || key === 'hataSideStudioUiS') {
				const { applyHataSideStudioStore, sanitizeHataSideStudioStore } = await import('@/utility/hata-side-studio.js');
				applyHataSideStudioStore(sanitizeHataSideStudioStore(JSON.parse(value as string)), key);
			} else miLocalStorage.setItem(key, value as string);
			result.applied++;
		}
		for (const key of definition.preferenceKeys ?? []) {
			if (!isRecord(payload.preferences) || !Object.hasOwn(payload.preferences, key)) continue;
			const value = payload.preferences[key];
			const nestedSchema = nestedPreferenceSchemas[key];
			if (nestedSchema) {
				const sanitized = sanitizeNestedValue(value, nestedSchema);
				for (const skipped of sanitized.skipped) result.skipped.push({ category: definition.id, key: preferenceSkipKey(key, skipped.path), reason: skipped.reason });
				if (!sanitized.accepted) continue;
				preferAny.commit(key, cloneJson(sanitized.value));
			} else {
				if (!valueMatchesDefault(value, getInitialPrefValue(key))) { result.skipped.push({ category: definition.id, key, reason: copy.validation.typeMismatch }); continue; }
				preferAny.commit(key, cloneJson(value));
			}
			result.applied++;
		}

		for (const target of definition.registry ?? []) {
			if (!isRecord(payload.registry) || !Object.hasOwn(payload.registry, target.id)) continue;
			const value = payload.registry[target.id];
			if (!target.validate(value)) { result.skipped.push({ category: definition.id, key: target.id, reason: copy.validation.valueFormatMismatch }); continue; }
			let nextValue: unknown = value;
			if (target.fields && isRecord(value)) {
				const accepted: Record<string, unknown> = {};
				for (const [key, raw] of Object.entries(value)) {
					const validator = target.fields[key];
					if (!validator) { result.skipped.push({ category: definition.id, key: `${target.id}.${key}`, reason: copy.validation.unsupportedSetting }); continue; }
					if (!validator(raw)) { result.skipped.push({ category: definition.id, key: `${target.id}.${key}`, reason: copy.validation.typeMismatch }); continue; }
					accepted[key] = cloneJson(raw);
				}
				if (Object.keys(accepted).length === 0) continue;
				const current = await registryGet(target);
				nextValue = { ...(isRecord(current) ? current : {}), ...accepted };
			}
			try {
				await misskeyApi('i/registry/set', { scope: target.scope, key: target.key, value: cloneJson(nextValue) });
				result.applied++;
			} catch {
				result.skipped.push({ category: definition.id, key: target.id, reason: copy.validation.serverSaveFailed });
			}
		}

		if (definition.profileBadges && isRecord(payload.profileBadges)) {
			const keys = ['showUtageSuccessCount', 'showUtageInterruptionCount', 'showHataskFlowerCount'] as const;
			const updates: Partial<Record<(typeof keys)[number], boolean>> = {};
			for (const key of keys) {
				if (!Object.hasOwn(payload.profileBadges, key)) continue;
				if (typeof payload.profileBadges[key] !== 'boolean') { result.skipped.push({ category: definition.id, key, reason: copy.validation.typeMismatch }); continue; }
				updates[key] = payload.profileBadges[key];
			}
			if (Object.keys(updates).length > 0) {
				try { await misskeyApi('i/update', updates); result.applied += Object.keys(updates).length; } catch {
					result.skipped.push({ category: definition.id, key: 'profileBadges', reason: copy.validation.serverSaveFailed });
				}
			}
		}

		if (definition.earthquakeNotifications && isRecord(payload.earthquakeNotifications)) {
			const source = payload.earthquakeNotifications;
			const enabled = typeof source.enabled === 'boolean' ? source.enabled : undefined;
			const mode = source.mode === 'pref' || source.mode === 'intensity' ? source.mode : undefined;
			const threshold = typeof source.threshold === 'number' && [30, 40, 45, 50, 55, 60, 70].includes(source.threshold) ? source.threshold : undefined;
			if (enabled === undefined || mode === undefined || threshold === undefined) {
				result.skipped.push({ category: definition.id, key: 'notifications', reason: copy.validation.notificationSettingsFormatMismatch });
			} else {
				try {
					await misskeyApi('hata/earthquake/notification-settings-update', {
						enabled, mode, threshold,
						pref: enabled && mode === 'pref' ? (miLocalStorage.getItem('hataEarthquakePref') ?? null) : null,
					});
					result.applied++;
				} catch { result.skipped.push({ category: definition.id, key: 'notifications', reason: copy.validation.serverSaveFailed }); }
			}
		}
	}
	return result;
}

export function downloadHataSettingsTransfer(file: HataSettingsTransferFile): void {
	const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = window.document.createElement('a');
	anchor.href = url;
	anchor.download = `hataskey-settings-${new Date().toISOString().slice(0, 10)}.json`;
	window.document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
