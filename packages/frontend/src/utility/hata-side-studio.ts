/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * HataSideStudio の端末ローカル設定。
 * サイドメニューは端末の幅・入力方法に強く依存するため prefer へは保存せず、
 * UIごとの miLocalStorage キーで完結させる。サーバー・連合へは送信しない。
 */

import { ref } from 'vue';
import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';
import { normalizeHatagoesSidebar, RETIRED_HATA_SIDEBAR_IDS } from '@/utility/hatagoes-sidebar.js';
import {
	HATA_SIDE_WIDGET_REGISTRY,
	HATA_SIDE_WIDGET_SIZES,
	getHataSideWidgetDisplayLabel,
	normalizeHataSideWidgetKind,
} from '@/utility/hata-side-studio-widgets.js';
import type {
	HataSideWidgetContent,
	HataSideWidgetData,
	HataSideWidgetKind,
	HataSideWidgetSize,
	HataSideWidgetSizeSetting,
} from '@/utility/hata-side-studio-widgets.js';

export type {
	HataSideNativeWidgetKind,
	HataSideWidgetContent,
	HataSideWidgetData,
	HataSideWidgetDefinition,
	HataSideWidgetKind,
	HataSideWidgetSizeSetting,
} from '@/utility/hata-side-studio-widgets.js';

export { getHataSideWidgetDisplayLabel };

export const HATA_SIDE_STUDIO_FORMAT_VERSION = 9;
export const HATA_SIDE_STUDIO_DEFAULT_PROFILE_LIMIT = 3;
export const HATA_SIDE_STUDIO_STORAGE_KEY = 'hataSideStudio';
export const HATA_SIDE_STUDIO_UI_S_STORAGE_KEY = 'hataSideStudioUiS';
export const HATA_SIDE_STUDIO_CHANGE_EVENT = 'hata-side-studio:change';
export const HATA_SIDE_STUDIO_BROADCAST_CHANNEL = 'hata-side-studio';

export const HATA_SIDE_STUDIO_FIXED_IDS = new Set(['more', 'settings', 'realtime', 'admin']);
export const HATA_SIDE_STUDIO_DEAD_IDS = new Set(['whatsNew', 'portal']);
export const HATA_SIDE_STUDIO_REQUIRED_MENU_IDS = new Set(['externalNotifications']);
export const HATA_SIDE_STUDIO_MENU_ID_ALIASES: Readonly<Record<string, string>> = {
	// 「もっと！」では ui、従来のHataskey UIサイドバーでは uiSetup という
	// 異なるIDだが、どちらも同じUI切り替えを開く。別ボタンとして重複させない。
	ui: 'uiSetup',
};

export function normalizeHataSideStudioMenuId(menuId: string): string {
	return HATA_SIDE_STUDIO_MENU_ID_ALIASES[menuId] ?? menuId;
}

export type HataSideButtonShape = 'rounded' | 'circle' | 'pill';
export type HataSideButtonSize = HataSideWidgetSize;
export type HataSideExpandedWidth = 'normal' | 'wide';
export type HataSideGradientEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type HataSideBorderStyle = 'solid' | 'dashed' | 'double';
export type HataSidePostButtonIcon = 'pencil' | 'paw';

export type HataSidePostButtonAppearance = {
	icon: HataSidePostButtonIcon;
	background: string;
	foreground: string;
	gradientEnabled: boolean;
	gradientTo: string;
	gradientAngle: number;
	gradientEasing: HataSideGradientEasing;
};

export type HataSideAppearance = {
	shape: HataSideButtonShape;
	size: HataSideButtonSize;
	background: string;
	border: string;
	foreground: string;
	borderWidth: number;
	borderStyle: HataSideBorderStyle;
	gradientEnabled: boolean;
	gradientTo: string;
	gradientAngle: number;
	gradientEasing: HataSideGradientEasing;
	rotation: number;
	showLabel: boolean;
};

export type HataSideButton = HataSideAppearance & {
	type: 'button';
	id: string;
	menuId: string;
	icon: string;
	label: string;
	targetId?: string;
	/** 縮小メニューでは既定で非表示。色・太さの設定は保持して再表示できる。 */
	borderVisible: boolean;
};

export type HataSideWidget = Omit<HataSideAppearance, 'showLabel' | 'rotation'> & {
	type: 'widget';
	id: string;
	kind: HataSideWidgetKind;
	label: string;
	/** Native widget の `widget.data` と同じ形。 */
	data: HataSideWidgetData;
	/** 表示サイズごとの native data 上書きとレイアウト最適化。 */
	sizeSettings: Record<HataSideButtonSize, HataSideWidgetSizeSetting>;
	/** @deprecated v2 UIとの互換投影。sizeSettings[*].content が正本。 */
	content: Record<HataSideButtonSize, HataSideWidgetContent>;
};

export type HataSideGroup = {
	type: 'group';
	id: string;
	name: string;
	showName: boolean;
	columns: 1 | 2 | 3;
	masonry: boolean;
	background: string;
	border: string;
	foreground: string;
	borderWidth: number;
	borderStyle: HataSideBorderStyle;
	gradientEnabled: boolean;
	gradientTo: string;
	gradientAngle: number;
	gradientEasing: HataSideGradientEasing;
	children: Array<HataSideButton | HataSideWidget>;
};

export type HataSideNode = HataSideButton | HataSideWidget | HataSideGroup;

export function hataSideStudioNodeContainsRequiredMenu(node: HataSideNode): boolean {
	if (node.type === 'button') return HATA_SIDE_STUDIO_REQUIRED_MENU_IDS.has(node.menuId);
	return node.type === 'group' && node.children.some(child => child.type === 'button' && HATA_SIDE_STUDIO_REQUIRED_MENU_IDS.has(child.menuId));
}

export type HataSideStudioProfile = {
	id: string;
	name: string;
	postButton: HataSidePostButtonAppearance;
	expanded: {
		nodes: HataSideNode[];
		columns: 1 | 2 | 3;
		width: HataSideExpandedWidth;
		parallax: boolean;
	};
	collapsed: {
		buttons: HataSideButton[];
	};
	updatedAt: string;
};

export type HataSideStudioStore = {
	version: typeof HATA_SIDE_STUDIO_FORMAT_VERSION;
	activeProfileId: string;
	profiles: HataSideStudioProfile[];
};

/**
 * 要素の現在位置を解決する。ドラッグ中はvuedraggableの更新順によって
 * 移動先のルートと移動元グループへ同じIDが一時的に見えることがあるため、
 * ルート直下に存在する要素を常に正本として優先する。
 */
export function findHataSideNodeParentGroup(profile: HataSideStudioProfile, nodeId: string): HataSideGroup | null {
	if (profile.expanded.nodes.some(node => node.id === nodeId)) return null;
	return profile.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.children.some(child => child.id === nodeId)) ?? null;
}

export function getHataSideNodeContainerColumns(profile: HataSideStudioProfile, nodeId: string): 1 | 2 | 3 {
	return findHataSideNodeParentGroup(profile, nodeId)?.columns ?? profile.expanded.columns;
}

export type SidebarSourceItem = {
	id: string;
	icon: string;
	label: string;
	group?: string;
	visible?: boolean;
	external?: boolean;
	url?: string;
};

export type HataSideStudioSourceCatalog = {
	sidebar: SidebarSourceItem[];
	more: SidebarSourceItem[];
	all: SidebarSourceItem[];
};

/**
 * 既存プロファイルとの互換用の保存名。共通localeの文言を保存JSONへ入れない。
 */
const HATA_SIDE_STUDIO_MENU_STORAGE_LABELS: Readonly<Record<string, string>> = {
	timeline: 'タイムライン',
	search: '検索',
	notifications: '通知',
	externalNotifications: '外部通知',
	chat: 'メッセージ',
	announcements: 'お知らせ',
	drive: 'ドライブ',
	favorites: 'お気に入り',
	hatask: 'Hatask',
	hatafeed: 'HataFeed',
	hatady: 'Hatady',
	hatagoes: 'HataGoes',
	earthquake: '地震・津波情報',
	uiSetup: 'UI切り替え',
	explore: 'みつける',
	followRequests: 'フォロー申請',
	channels: 'チャンネル',
	reload: 'リロード',
	cacheClear: 'キャッシュをクリア',
};

const fallbackSidebar: SidebarSourceItem[] = [
	{ id: 'timeline', icon: 'ti ti-home', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.timeline, group: 'basic' },
	{ id: 'search', icon: 'ti ti-search', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.search, group: 'basic' },
	{ id: 'notifications', icon: 'ti ti-bell', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.notifications, group: 'basic' },
	{ id: 'externalNotifications', icon: 'ti ti-bell', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.externalNotifications, group: 'basic' },
	{ id: 'chat', icon: 'ti ti-messages', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.chat, group: 'basic' },
	{ id: 'announcements', icon: 'ti ti-speakerphone', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.announcements, group: 'basic' },
	{ id: 'drive', icon: 'ti ti-cloud', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.drive, group: 'basic' },
	{ id: 'favorites', icon: 'ti ti-star', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.favorites, group: 'basic' },
	{ id: 'hatagoes', icon: 'ti ti-sparkles', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.hatagoes, group: 'hata' },
	{ id: 'earthquake', icon: 'ti ti-activity', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.earthquake, group: 'hata' },
	{ id: 'uiSetup', icon: 'ti ti-wand', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.uiSetup, group: 'discover' },
	{ id: 'explore', icon: 'ti ti-hash', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.explore, group: 'discover' },
	{ id: 'followRequests', icon: 'ti ti-user-plus', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.followRequests, group: 'discover' },
	{ id: 'channels', icon: 'ti ti-device-tv', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.channels, group: 'discover' },
	{ id: 'reload', icon: 'ti ti-refresh', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.reload, group: 'more' },
	{ id: 'cacheClear', icon: 'ti ti-trash', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.cacheClear, group: 'more' },
];

const HATA_SIDE_STUDIO_GROUP_STORAGE_NAMES: Readonly<Record<string, string>> = {
	basic: '基本機能',
	hata: 'Hataskey独自',
	discover: '発見・交流',
	more: 'その他',
};

const HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES = {
	newGroup: '新しいグループ',
	defaultProfile: 'デフォルト',
	groupFallback: 'グループ',
	profileFallback: 'プロファイル',
	collapsedCopyGroup: '縮小メニューからコピー',
} as const;

type HataSideStudioUtilityCopy = {
	menuLabels: Record<string, string>;
	groupNames: Record<string, string>;
	defaultNames: Record<keyof typeof HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES, string>;
};

function utilityCopy(): HataSideStudioUtilityCopy {
	return i18n.ts._hata._hataSideStudio._utility as HataSideStudioUtilityCopy;
}

/** 既知のメニュー名を表示時だけ翻訳し、利用者が付けた名前は保持する。 */
export function getHataSideStudioMenuDisplayLabel(menuId: string, storedLabel?: string): string {
	const normalizedId = normalizeHataSideStudioMenuId(menuId);
	const canonicalLabel = HATA_SIDE_STUDIO_MENU_STORAGE_LABELS[normalizedId];
	const fallback = typeof storedLabel === 'string' && storedLabel.length > 0 ? storedLabel : canonicalLabel ?? normalizedId;
	if (normalizedId === 'earthquake' || canonicalLabel == null) return fallback;
	if (typeof storedLabel === 'string' && storedLabel.length > 0 && storedLabel !== canonicalLabel) return storedLabel;
	return utilityCopy().menuLabels[normalizedId] ?? fallback;
}

/** キャッシュクリアのラベルを狭いセルでも1行に収めるための文字幅係数。 */
export function getHataSideStudioCacheLabelSize(label: string): string {
	return `${Math.min(10.5, 94 / Math.max(1, Array.from(label).length)).toFixed(3)}cqi`;
}

/** 既定のグループ名だけを表示時に翻訳する。利用者が編集した名前はそのまま返す。 */
export function getHataSideStudioGroupDisplayName(name: string): string {
	const entry = Object.entries(HATA_SIDE_STUDIO_GROUP_STORAGE_NAMES).find(([, storedName]) => storedName === name);
	if (entry) return utilityCopy().groupNames[entry[0]] ?? name;
	if (name === HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.newGroup) return utilityCopy().defaultNames.newGroup ?? name;
	if (name === HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.groupFallback) return utilityCopy().defaultNames.groupFallback ?? name;
	if (name === HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.collapsedCopyGroup) return utilityCopy().defaultNames.collapsedCopyGroup ?? name;
	return name;
}

/** 既定のプロファイル名だけを表示時に翻訳する。 */
export function getHataSideStudioProfileDisplayName(name: string): string {
	return name === HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.defaultProfile
		? utilityCopy().defaultNames.defaultProfile ?? name
		: name === HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.profileFallback
			? utilityCopy().defaultNames.profileFallback ?? name
			: name;
}

function uid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function isColor(value: unknown): value is string {
	return typeof value === 'string' && (/^#[0-9a-f]{3,8}$/i.test(value) || /^var\(--[a-z0-9-_]+(?:,\s*[^)]+)?\)$/i.test(value) || value === 'transparent');
}

export function createDefaultAppearance(): HataSideAppearance {
	return {
		shape: 'rounded',
		size: 'normal',
		background: 'transparent',
		border: 'transparent',
		borderWidth: 1,
		borderStyle: 'solid',
		foreground: 'var(--MI_THEME-fg)',
		gradientEnabled: false,
		gradientTo: '#7c5cff',
		gradientAngle: 135,
		gradientEasing: 'linear',
		rotation: 0,
		showLabel: true,
	};
}

export function createDefaultPostButtonAppearance(): HataSidePostButtonAppearance {
	return {
		icon: 'pencil',
		background: 'var(--MI_THEME-buttonGradateA)',
		foreground: 'var(--MI_THEME-fgOnAccent, #fff)',
		gradientEnabled: true,
		gradientTo: 'var(--MI_THEME-buttonGradateB)',
		gradientAngle: 90,
		gradientEasing: 'linear',
	};
}

export function createButton(source: SidebarSourceItem, appearance?: Partial<HataSideAppearance & Pick<HataSideButton, 'borderVisible'>>): HataSideButton {
	const sourceId = normalizeHataSideStudioMenuId(source.id);
	const menuId = RETIRED_HATA_SIDEBAR_IDS.has(sourceId) ? 'hatagoes' : sourceId;
	return {
		type: 'button',
		id: uid('button'),
		menuId,
		icon: menuId === 'hatagoes' && sourceId !== menuId ? 'ti ti-sparkles' : source.icon,
		// 既知IDはlocale表示名ではなく互換用の固定名を保存する。
		label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS[menuId] ?? source.label,
		...createDefaultAppearance(),
		borderVisible: true,
		...appearance,
	};
}

function cloneWidgetSizeSettings(kind: HataSideWidgetKind): Record<HataSideButtonSize, HataSideWidgetSizeSetting> {
	const definition = HATA_SIDE_WIDGET_REGISTRY[kind];
	return {
		small: { ...definition.sizes.small, data: { ...definition.sizes.small.data } },
		normal: { ...definition.sizes.normal, data: { ...definition.sizes.normal.data } },
		large: { ...definition.sizes.large, data: { ...definition.sizes.large.data } },
	};
}

export function createWidget(kind: HataSideWidgetKind = 'clock'): HataSideWidget {
	const base = createDefaultAppearance();
	const normalizedKind = normalizeHataSideWidgetKind(kind);
	const definition = HATA_SIDE_WIDGET_REGISTRY[normalizedKind];
	const sizeSettings = cloneWidgetSizeSettings(normalizedKind);
	return {
		type: 'widget',
		id: uid('widget'),
		kind: normalizedKind,
		label: definition.label,
		shape: 'rounded',
		size: 'normal',
		background: 'var(--MI_THEME-panel)',
		border: 'var(--MI_THEME-divider)',
		borderWidth: 1,
		borderStyle: 'solid',
		foreground: base.foreground,
		gradientEnabled: false,
		gradientTo: '#7c5cff',
		gradientAngle: 135,
		gradientEasing: 'linear',
		data: { ...definition.defaultData },
		sizeSettings,
		content: {
			small: sizeSettings.small.content,
			normal: sizeSettings.normal.content,
			large: sizeSettings.large.content,
		},
	};
}

export function createGroup(name: string = HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.newGroup): HataSideGroup {
	return {
		type: 'group',
		id: uid('group'),
		name,
		showName: true,
		columns: 2,
		masonry: false,
		background: 'transparent',
		border: 'var(--MI_THEME-divider)',
		foreground: 'var(--MI_THEME-fg)',
		borderWidth: 1,
		borderStyle: 'solid',
		gradientEnabled: false,
		gradientTo: '#7c5cff',
		gradientAngle: 135,
		gradientEasing: 'linear',
		children: [],
	};
}

function sanitizeSourceItem(value: unknown, forcedGroup?: string): SidebarSourceItem | null {
	if (!isRecord(value) || typeof value.id !== 'string' || !/^[a-z0-9:_-]{1,80}$/i.test(value.id)) return null;
	const id = normalizeHataSideStudioMenuId(value.id);
	if (HATA_SIDE_STUDIO_DEAD_IDS.has(id) || HATA_SIDE_STUDIO_FIXED_IDS.has(id)) return null;
	const group = forcedGroup ?? (typeof value.group === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(value.group) ? value.group : undefined);
	const url = typeof value.url === 'string' && /^https?:\/\//i.test(value.url) ? value.url.slice(0, 2048) : undefined;
	return {
		id,
		icon: typeof value.icon === 'string' ? value.icon.slice(0, 120) : 'ti ti-point',
		label: typeof value.label === 'string' && value.label.length > 0 ? value.label.slice(0, 80) : value.id,
		...(group ? { group } : {}),
		...(typeof value.visible === 'boolean' ? { visible: value.visible } : {}),
		...(value.external === true && url ? { external: true, url } : {}),
	};
}

function sanitizeSourceList(source: readonly unknown[], forcedGroup?: string): SidebarSourceItem[] {
	const result: SidebarSourceItem[] = [];
	const seen = new Set<string>();
	for (const raw of source) {
		const item = sanitizeSourceItem(raw, forcedGroup);
		if (!item || seen.has(item.id)) continue;
		seen.add(item.id);
		result.push(item);
	}
	return normalizeHatagoesSidebar(result);
}

export function createHataSideStudioSourceCatalog(
	sidebarSource: readonly unknown[],
	moreSource: readonly unknown[] = [],
): HataSideStudioSourceCatalog {
	const sidebar = sanitizeSourceList(sidebarSource);
	const more = sanitizeSourceList(moreSource, 'more');
	const all = [...sidebar];
	const seen = new Set(sidebar.map(item => item.id));
	for (const item of more) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		all.push(item);
	}
	return { sidebar, more, all };
}

function visibleSource(source: readonly SidebarSourceItem[]): SidebarSourceItem[] {
	const visible = sanitizeSourceList(source).filter(item => item.visible !== false || HATA_SIDE_STUDIO_REQUIRED_MENU_IDS.has(item.id));
	if (visible.some(item => item.id === 'externalNotifications')) return visible;
	const externalNotifications: SidebarSourceItem = {
		id: 'externalNotifications',
		icon: 'ti ti-bell',
		label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.externalNotifications,
		group: 'basic',
	};
	const notificationsIndex = visible.findIndex(item => item.id === 'notifications');
	visible.splice(notificationsIndex >= 0 ? notificationsIndex + 1 : 0, 0, externalNotifications);
	return visible;
}

export function createDefaultProfile(source: readonly SidebarSourceItem[] = fallbackSidebar, name: string = HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.defaultProfile): HataSideStudioProfile {
	const visible = visibleSource(source);
	// 同じgroupが途中で再登場しても先頭のgroupへ吸い上げない。設定画面に並んでいる
	// 順序を連続したまとまりとして写し取り、「現在の並び」を完全に保持する。
	const groups: HataSideGroup[] = [];
	let currentGroupKey: string | null = null;
	let currentGroup: HataSideGroup | null = null;
	for (const item of visible) {
		const key = item.group ?? 'basic';
		if (currentGroup == null || currentGroupKey !== key) {
			currentGroup = createGroup(HATA_SIDE_STUDIO_GROUP_STORAGE_NAMES[key] ?? key);
			groups.push(currentGroup);
			currentGroupKey = key;
		}
		currentGroup.children.push(createButton(item));
	}
	return {
		id: uid('profile'),
		name,
		postButton: createDefaultPostButtonAppearance(),
		expanded: { nodes: groups.filter(group => group.children.length > 0), columns: 1, width: 'normal', parallax: false },
		collapsed: { buttons: visible.map(item => createButton(item, { shape: 'circle', showLabel: false, size: 'small', border: 'var(--MI_THEME-divider)', borderVisible: false })) },
		updatedAt: new Date().toISOString(),
	};
}

export function createDefaultStore(source: readonly SidebarSourceItem[] = fallbackSidebar): HataSideStudioStore {
	const profile = createDefaultProfile(source);
	return { version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profile.id, profiles: [profile] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

const UNSAFE_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
	if (value == null || typeof value === 'boolean' || typeof value === 'string') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (depth >= 20) return undefined;
	if (Array.isArray(value)) {
		return value.slice(0, 1000).map(item => sanitizeJsonValue(item, depth + 1)).filter(item => item !== undefined);
	}
	if (!isRecord(value)) return undefined;
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value).slice(0, 1000)) {
		if (UNSAFE_DATA_KEYS.has(key)) continue;
		const sanitized = sanitizeJsonValue(item, depth + 1);
		if (sanitized !== undefined) result[key] = sanitized;
	}
	return result;
}

function sanitizeWidgetData(value: unknown): HataSideWidgetData {
	const sanitized = sanitizeJsonValue(value);
	return isRecord(sanitized) ? sanitized : {};
}

function isWidgetContent(value: unknown): value is HataSideWidgetContent {
	return value === 'compact' || value === 'normal' || value === 'detail';
}

function sanitizeWidgetSizeSetting(
	value: unknown,
	fallback: HataSideWidgetSizeSetting,
	legacyContent: unknown,
): HataSideWidgetSizeSetting {
	const raw = isRecord(value) ? value : {};
	return {
		content: isWidgetContent(raw.content) ? raw.content : isWidgetContent(legacyContent) ? legacyContent : fallback.content,
		minHeight: raw.minHeight == null ? fallback.minHeight : clamp(Number(raw.minHeight), 40, 1600),
		data: { ...sanitizeWidgetData(fallback.data), ...sanitizeWidgetData(raw.data) },
	};
}

function sanitizeAppearance(value: Record<string, unknown>, collapsed = false): HataSideAppearance {
	const base = createDefaultAppearance();
	return {
		shape: value.shape === 'circle' || value.shape === 'pill' || value.shape === 'rounded' ? value.shape : base.shape,
		size: value.size === 'small' || value.size === 'large' || value.size === 'normal' ? value.size : base.size,
		background: isColor(value.background) ? value.background : base.background,
		border: isColor(value.border) ? value.border : base.border,
		borderWidth: value.borderWidth == null ? base.borderWidth : clamp(Number(value.borderWidth), 0, 5),
		borderStyle: value.borderStyle === 'dashed' || value.borderStyle === 'double' ? value.borderStyle : 'solid',
		foreground: isColor(value.foreground) ? value.foreground : base.foreground,
		gradientEnabled: value.gradientEnabled === true,
		gradientTo: isColor(value.gradientTo) ? value.gradientTo : base.gradientTo,
		gradientAngle: clamp(Number(value.gradientAngle), 0, 360),
		gradientEasing: value.gradientEasing === 'ease-in' || value.gradientEasing === 'ease-out' || value.gradientEasing === 'ease-in-out' ? value.gradientEasing : 'linear',
		rotation: collapsed ? 0 : clamp(Number(value.rotation), -12, 12),
		showLabel: collapsed ? false : value.showLabel !== false,
	};
}

function sanitizePostButtonAppearance(value: unknown): HataSidePostButtonAppearance {
	const base = createDefaultPostButtonAppearance();
	const raw = isRecord(value) ? value : {};
	return {
		icon: raw.icon === 'paw' ? 'paw' : 'pencil',
		background: isColor(raw.background) ? raw.background : base.background,
		foreground: isColor(raw.foreground) ? raw.foreground : base.foreground,
		gradientEnabled: raw.gradientEnabled == null ? base.gradientEnabled : raw.gradientEnabled === true,
		gradientTo: isColor(raw.gradientTo) ? raw.gradientTo : base.gradientTo,
		gradientAngle: raw.gradientAngle == null ? base.gradientAngle : clamp(Number(raw.gradientAngle), 0, 360),
		gradientEasing: raw.gradientEasing === 'ease-in' || raw.gradientEasing === 'ease-out' || raw.gradientEasing === 'ease-in-out' ? raw.gradientEasing : 'linear',
	};
}

function sanitizeButton(value: unknown, collapsed = false): HataSideButton | null {
	if (!isRecord(value) || value.type !== 'button' || typeof value.menuId !== 'string') return null;
	const menuId = normalizeHataSideStudioMenuId(value.menuId);
	if (HATA_SIDE_STUDIO_DEAD_IDS.has(menuId) || HATA_SIDE_STUDIO_FIXED_IDS.has(menuId)) return null;
	return {
		type: 'button',
		id: typeof value.id === 'string' ? value.id : uid('button'),
		menuId,
		icon: typeof value.icon === 'string' ? value.icon : 'ti ti-point',
		label: typeof value.label === 'string' ? value.label.slice(0, 80) : value.menuId,
		...(typeof value.targetId === 'string' && /^[a-z0-9]+$/i.test(value.targetId) ? { targetId: value.targetId } : {}),
		...sanitizeAppearance(value, collapsed),
		// v7以前にはこの値がない。縮小メニューの枠線は新しい既定どおり隠すが、
		// 利用者が選んだ色・太さはそのまま残して、後から表示を戻せるようにする。
		borderVisible: collapsed ? value.borderVisible === true : value.borderVisible !== false,
	};
}

function sanitizeWidget(value: unknown, refreshLayoutDefaults = false): HataSideWidget | null {
	if (!isRecord(value) || value.type !== 'widget') return null;
	const kind = normalizeHataSideWidgetKind(value.kind);
	const definition = HATA_SIDE_WIDGET_REGISTRY[kind];
	const appearance = sanitizeAppearance(value);
	const legacyContent = isRecord(value.content) ? value.content : {};
	// v4 以前は一部ウィジェットの既定高が過大で、保存済み値がCSS修正後も
	// レイアウトを押し広げていた。v5移行時だけ高さとnative propsの既定を
	// レジストリから再取得し、利用者が選んだ表示内容・色・形・基礎dataは保つ。
	const rawSizeSettings = !refreshLayoutDefaults && isRecord(value.sizeSettings) ? value.sizeSettings : {};
	const sizeSettings = Object.fromEntries(HATA_SIDE_WIDGET_SIZES.map(size => [
		size,
		sanitizeWidgetSizeSetting(rawSizeSettings[size], definition.sizes[size], legacyContent[size]),
	])) as Record<HataSideButtonSize, HataSideWidgetSizeSetting>;
	return {
		type: 'widget', id: typeof value.id === 'string' ? value.id : uid('widget'), kind,
		label: typeof value.label === 'string' ? value.label.slice(0, 80) : definition.label,
		shape: appearance.shape, size: appearance.size, background: appearance.background, border: appearance.border,
		borderWidth: appearance.borderWidth, borderStyle: appearance.borderStyle,
		foreground: appearance.foreground, gradientEnabled: appearance.gradientEnabled, gradientTo: appearance.gradientTo,
		gradientAngle: appearance.gradientAngle, gradientEasing: appearance.gradientEasing,
		data: { ...sanitizeWidgetData(definition.defaultData), ...sanitizeWidgetData(value.data) },
		sizeSettings,
		content: {
			small: sizeSettings.small.content,
			normal: sizeSettings.normal.content,
			large: sizeSettings.large.content,
		},
	};
}

function sanitizeGroup(value: unknown, refreshLayoutDefaults = false): HataSideGroup | null {
	if (!isRecord(value) || value.type !== 'group') return null;
	const children = Array.isArray(value.children) ? value.children.map(child => isRecord(child) && child.type === 'widget' ? sanitizeWidget(child, refreshLayoutDefaults) : sanitizeButton(child)).filter((child): child is HataSideButton | HataSideWidget => child != null) : [];
	const columns = value.columns === 2 || value.columns === 3 ? value.columns : 1;
	const safeChildren = columns === 1 ? children : children.map(child => child.size === 'large' ? { ...child, size: 'normal' as const } : child);
	return {
		type: 'group', id: typeof value.id === 'string' ? value.id : uid('group'),
		name: typeof value.name === 'string' ? value.name.slice(0, 80) : HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.groupFallback, showName: value.showName !== false,
		columns, masonry: value.masonry === true,
		background: isColor(value.background) ? value.background : 'transparent', border: isColor(value.border) ? value.border : 'var(--MI_THEME-divider)',
		foreground: isColor(value.foreground) ? value.foreground : 'var(--MI_THEME-fg)',
		borderWidth: value.borderWidth == null ? 1 : clamp(Number(value.borderWidth), 0, 5), borderStyle: value.borderStyle === 'dashed' || value.borderStyle === 'double' ? value.borderStyle : 'solid',
		gradientEnabled: value.gradientEnabled === true, gradientTo: isColor(value.gradientTo) ? value.gradientTo : '#7c5cff',
		gradientAngle: clamp(Number(value.gradientAngle), 0, 360),
		gradientEasing: value.gradientEasing === 'ease-in' || value.gradientEasing === 'ease-out' || value.gradientEasing === 'ease-in-out' ? value.gradientEasing : 'linear',
		children: safeChildren,
	};
}

function isExternalNotificationsButton(value: HataSideButton | HataSideNode): value is HataSideButton {
	return value.type === 'button' && value.menuId === 'externalNotifications';
}

/**
 * v8以前は画面側が外部通知を固定注入していたため、全プロファイルの保存配列へ一度だけ補う。
 * 既存の外部通知は位置も装飾も変えず、重複した場合は最初の1件だけを残す。
 */
function ensureExternalNotificationsExpanded(nodes: HataSideNode[]): HataSideNode[] {
	let found = false;
	const deduplicated: HataSideNode[] = [];
	for (const node of nodes) {
		if (isExternalNotificationsButton(node)) {
			if (found) continue;
			found = true;
			deduplicated.push(node);
			continue;
		}
		if (node.type !== 'group') {
			deduplicated.push(node);
			continue;
		}
		const children: Array<HataSideButton | HataSideWidget> = [];
		for (const child of node.children) {
			if (isExternalNotificationsButton(child)) {
				if (found) continue;
				found = true;
			}
			children.push(child);
		}
		deduplicated.push(children.length === node.children.length ? node : { ...node, children });
	}
	if (found) return deduplicated;

	const button = createButton({
		id: 'externalNotifications',
		icon: 'ti ti-bell',
		label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.externalNotifications,
		group: 'basic',
	});
	for (let index = 0; index < deduplicated.length; index++) {
		const node = deduplicated[index];
		if (node.type === 'button' && node.menuId === 'notifications') {
			deduplicated.splice(index + 1, 0, button);
			return deduplicated;
		}
		if (node.type !== 'group') continue;
		const notificationsIndex = node.children.findIndex(child => child.type === 'button' && child.menuId === 'notifications');
		if (notificationsIndex < 0) continue;
		const children = [...node.children];
		children.splice(notificationsIndex + 1, 0, button);
		deduplicated[index] = { ...node, children };
		return deduplicated;
	}
	deduplicated.unshift(button);
	return deduplicated;
}

function ensureExternalNotificationsCollapsed(buttons: HataSideButton[]): HataSideButton[] {
	let found = false;
	const deduplicated = buttons.filter(button => {
		if (!isExternalNotificationsButton(button)) return true;
		if (found) return false;
		found = true;
		return true;
	});
	if (found) return deduplicated;

	const button = createButton({
		id: 'externalNotifications',
		icon: 'ti ti-bell',
		label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.externalNotifications,
		group: 'basic',
	}, {
		shape: 'circle',
		showLabel: false,
		size: 'small',
		border: 'var(--MI_THEME-divider)',
		borderVisible: false,
	});
	const notificationsIndex = deduplicated.findIndex(item => item.menuId === 'notifications');
	deduplicated.splice(notificationsIndex >= 0 ? notificationsIndex + 1 : 0, 0, button);
	return deduplicated;
}

/** 拡大メニューはルートとグループの子を表示順に1つの並びとして統合する。 */
function normalizeHatagoesButtons<T extends HataSideButton | HataSideWidget>(items: T[], keep: HataSideButton | undefined): T[] {
	return items.flatMap(item => {
		if (item.type !== 'button' || (item.menuId !== 'hatagoes' && !RETIRED_HATA_SIDEBAR_IDS.has(item.menuId))) return [item];
		if (item !== keep) return [];
		if (item.menuId === 'hatagoes') return [item];
		const { targetId: _targetId, ...button } = item;
		return [{ ...button, menuId: 'hatagoes', icon: 'ti ti-sparkles', label: HATA_SIDE_STUDIO_MENU_STORAGE_LABELS.hatagoes } as T];
	});
}

function preferredHatagoesButton(buttons: HataSideButton[]): HataSideButton | undefined {
	return buttons.find(button => button.menuId === 'hatagoes')
		?? buttons.find(button => RETIRED_HATA_SIDEBAR_IDS.has(button.menuId));
}

function normalizeHatagoesExpanded(nodes: HataSideNode[]): HataSideNode[] {
	const buttons = nodes.flatMap(node => node.type === 'button' ? [node] : node.type === 'group' ? node.children.filter((child): child is HataSideButton => child.type === 'button') : []);
	const keep = preferredHatagoesButton(buttons);
	return nodes.flatMap<HataSideNode>(node => {
		if (node.type !== 'group') return normalizeHatagoesButtons([node], keep);
		const children = normalizeHatagoesButtons(node.children, keep);
		return [children.length === node.children.length && children.every((child, index) => child === node.children[index]) ? node : { ...node, children }];
	});
}

function normalizeHatagoesCollapsed(buttons: HataSideButton[]): HataSideButton[] {
	return normalizeHatagoesButtons(buttons, preferredHatagoesButton(buttons));
}

export function sanitizeHataSideStudioStore(value: unknown, source: readonly SidebarSourceItem[] = fallbackSidebar): HataSideStudioStore {
	if (!isRecord(value) || !Array.isArray(value.profiles)) return createDefaultStore(source);
	const storedVersion = Number(value.version);
	// ウィジェット高の再取得はv5移行だけに限定する。今後formatを上げても、
	// 利用者がサイズ別に調整した高さを毎回既定値へ戻さない。
	const refreshLayoutDefaults = !Number.isFinite(storedVersion) || storedVersion < 5;
	const profiles: HataSideStudioProfile[] = [];
	for (const raw of value.profiles.slice(0, 50)) {
		if (!isRecord(raw)) continue;
		const expandedRaw = isRecord(raw.expanded) ? raw.expanded : {};
		const collapsedRaw = isRecord(raw.collapsed) ? raw.collapsed : {};
		const columns = expandedRaw.columns === 2 || expandedRaw.columns === 3 ? expandedRaw.columns : 1;
		const nodes = normalizeHatagoesExpanded(ensureExternalNotificationsExpanded((Array.isArray(expandedRaw.nodes) ? expandedRaw.nodes.map(node => isRecord(node) && node.type === 'group' ? sanitizeGroup(node, refreshLayoutDefaults) : isRecord(node) && node.type === 'widget' ? sanitizeWidget(node, refreshLayoutDefaults) : sanitizeButton(node)).filter((node): node is HataSideNode => node != null) : [])
			.map(node => columns > 1 && node.type !== 'group' && node.size === 'large' ? { ...node, size: 'normal' as const } : node)));
		const buttons = normalizeHatagoesCollapsed(ensureExternalNotificationsCollapsed(Array.isArray(collapsedRaw.buttons) ? collapsedRaw.buttons
			.map(button => sanitizeButton(button, true))
			.filter((button): button is HataSideButton => button != null) : []));
		profiles.push({
			id: typeof raw.id === 'string' ? raw.id : uid('profile'), name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.profileFallback,
			postButton: sanitizePostButtonAppearance(raw.postButton),
			expanded: {
				nodes,
				columns,
				width: expandedRaw.width === 'wide' ? 'wide' : 'normal',
				parallax: expandedRaw.parallax === true,
			},
			collapsed: { buttons }, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
		});
	}
	if (profiles.length === 0) profiles.push(createDefaultProfile(source));
	const requestedActive = typeof value.activeProfileId === 'string' ? value.activeProfileId : '';
	return { version: HATA_SIDE_STUDIO_FORMAT_VERSION, activeProfileId: profiles.some(profile => profile.id === requestedActive) ? requestedActive : profiles[0].id, profiles };
}

function readStore(key: typeof HATA_SIDE_STUDIO_STORAGE_KEY | typeof HATA_SIDE_STUDIO_UI_S_STORAGE_KEY): HataSideStudioStore {
	const raw = miLocalStorage.getItem(key);
	if (raw == null) return createDefaultStore();
	try {
		return sanitizeHataSideStudioStore(JSON.parse(raw));
	} catch {
		return createDefaultStore();
	}
}

// 実行中のUIは別タブのUI切替に影響されないよう、モジュールの初期化時に固定する。
const initialStorageKey = miLocalStorage.getItem('ui') === 'hataskey3'
	? HATA_SIDE_STUDIO_UI_S_STORAGE_KEY : HATA_SIDE_STUDIO_STORAGE_KEY;
// 旧データがある場合は初回アクセス時にUI Sの初期値を固定する。旧データがない
// 場合は sidebar source を受け取る ensure まで待つ。
const initialLegacyRaw = miLocalStorage.getItem(HATA_SIDE_STUDIO_STORAGE_KEY);
const legacyInitialStore = readStore(HATA_SIDE_STUDIO_STORAGE_KEY);
if (initialLegacyRaw != null && miLocalStorage.getItem(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY) == null) {
	miLocalStorage.setItem(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY, JSON.stringify(legacyInitialStore));
}
const legacyStore = ref<HataSideStudioStore>(legacyInitialStore);
const uiSStore = ref<HataSideStudioStore>(readStore(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY));

export function getHataSideStudioStorageKey(): typeof HATA_SIDE_STUDIO_STORAGE_KEY | typeof HATA_SIDE_STUDIO_UI_S_STORAGE_KEY {
	return initialStorageKey;
}

function storeForKey(key: ReturnType<typeof getHataSideStudioStorageKey>) {
	return key === HATA_SIDE_STUDIO_UI_S_STORAGE_KEY ? uiSStore : legacyStore;
}

export const hataSideStudioStore = storeForKey(initialStorageKey);

function ensureUiSSeed(source?: readonly SidebarSourceItem[]): void {
	if (miLocalStorage.getItem(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY) != null) return;
	let initial: HataSideStudioStore;
	if (initialStorageKey === HATA_SIDE_STUDIO_UI_S_STORAGE_KEY && initialLegacyRaw == null) {
		initial = source != null ? createDefaultStore(source) : legacyInitialStore;
	} else if (miLocalStorage.getItem(HATA_SIDE_STUDIO_STORAGE_KEY) != null) {
		initial = readStore(HATA_SIDE_STUDIO_STORAGE_KEY);
	} else {
		initial = source != null ? createDefaultStore(source) : legacyInitialStore;
	}
	uiSStore.value = initial;
	miLocalStorage.setItem(HATA_SIDE_STUDIO_UI_S_STORAGE_KEY, JSON.stringify(initial));
}

type HataSideStudioSyncDetail = {
	sourceId: string;
	serialized: string;
	storageKey?: ReturnType<typeof getHataSideStudioStorageKey>;
};

const syncSourceId = uid('sync');
let syncStarted = false;
let syncChannel: BroadcastChannel | null = null;

function isSyncDetail(value: unknown): value is HataSideStudioSyncDetail {
	return isRecord(value) && typeof value.sourceId === 'string' && typeof value.serialized === 'string';
}

function applySerializedHataSideStudioStore(serialized: string, sourceId = '', key: ReturnType<typeof getHataSideStudioStorageKey> = HATA_SIDE_STUDIO_STORAGE_KEY): void {
	if (sourceId === syncSourceId || !isHataSideStudioStorageString(serialized)) return;
	try {
		const next = sanitizeHataSideStudioStore(JSON.parse(serialized));
		const target = storeForKey(key);
		if (JSON.stringify(target.value) !== JSON.stringify(next)) target.value = next;
	} catch {
		// 他ウィンドウから壊れた値が来ても、現在表示中の正常な設定は維持する。
	}
}

function onHataSideStudioCustomEvent(event: Event): void {
	const detail = (event as CustomEvent<unknown>).detail;
	if (isSyncDetail(detail)) applySerializedHataSideStudioStore(detail.serialized, detail.sourceId, detail.storageKey);
}

function onHataSideStudioStorage(event: StorageEvent): void {
	if ((event.key === HATA_SIDE_STUDIO_STORAGE_KEY || event.key === HATA_SIDE_STUDIO_UI_S_STORAGE_KEY) && event.newValue != null) applySerializedHataSideStudioStore(event.newValue, '', event.key);
}

function onHataSideStudioBroadcast(event: MessageEvent<unknown>): void {
	if (isSyncDetail(event.data)) applySerializedHataSideStudioStore(event.data.serialized, event.data.sourceId, event.data.storageKey);
}

export function startHataSideStudioSync(): void {
	if (syncStarted || typeof window === 'undefined') return;
	syncStarted = true;
	window.addEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, onHataSideStudioCustomEvent);
	window.addEventListener('storage', onHataSideStudioStorage);
	try {
		if (typeof window.BroadcastChannel === 'function') {
			syncChannel = new window.BroadcastChannel(HATA_SIDE_STUDIO_BROADCAST_CHANNEL);
			syncChannel.addEventListener('message', onHataSideStudioBroadcast);
			(syncChannel as BroadcastChannel & { unref?: () => void }).unref?.();
		}
	} catch {
		syncChannel = null;
	}
}

export function stopHataSideStudioSync(): void {
	if (!syncStarted || typeof window === 'undefined') return;
	syncStarted = false;
	window.removeEventListener(HATA_SIDE_STUDIO_CHANGE_EVENT, onHataSideStudioCustomEvent);
	window.removeEventListener('storage', onHataSideStudioStorage);
	if (syncChannel) {
		syncChannel.removeEventListener('message', onHataSideStudioBroadcast);
		syncChannel.close();
		syncChannel = null;
	}
}

function notifyHataSideStudioChange(serialized: string, storageKey: ReturnType<typeof getHataSideStudioStorageKey>): void {
	if (typeof window === 'undefined') return;
	const detail: HataSideStudioSyncDetail = { sourceId: syncSourceId, serialized, storageKey };
	try {
		window.dispatchEvent(new CustomEvent<HataSideStudioSyncDetail>(HATA_SIDE_STUDIO_CHANGE_EVENT, { detail }));
		syncChannel?.postMessage(detail);
	} catch {
		// 保存自体は成功しているため、通知機構が使えない環境でも状態を巻き戻さない。
	}
}

export function ensureHataSideStudioInitialized(source: readonly SidebarSourceItem[]): void {
	ensureUiSSeed(source);
	const key = getHataSideStudioStorageKey();
	const raw = miLocalStorage.getItem(key);
	if (raw == null) {
		applyHataSideStudioStore(createDefaultStore(source));
		return;
	}
	try {
		const migrated = sanitizeHataSideStudioStore(JSON.parse(raw), source);
		const serialized = JSON.stringify(migrated);
		storeForKey(key).value = migrated;
		if (serialized !== raw) {
			miLocalStorage.setItem(key, serialized);
			notifyHataSideStudioChange(serialized, key);
		}
		return;
	} catch {
		// JSONとして壊れている場合だけ、現在のサイドメニューから作り直す。
	}
	applyHataSideStudioStore(createDefaultStore(source));
}

export function applyHataSideStudioStore(value: HataSideStudioStore, key = getHataSideStudioStorageKey()): void {
	ensureUiSSeed();
	const next = sanitizeHataSideStudioStore(value);
	const serialized = JSON.stringify(next);
	storeForKey(key).value = next;
	miLocalStorage.setItem(key, serialized);
	notifyHataSideStudioChange(serialized, key);
}

startHataSideStudioSync();

export function getActiveHataSideProfile(store = hataSideStudioStore.value): HataSideStudioProfile {
	return store.profiles.find(profile => profile.id === store.activeProfileId) ?? store.profiles[0];
}

export function getHataSideStudioMenuIds(profile: HataSideStudioProfile): Set<string> {
	const ids = new Set<string>();
	for (const node of profile.expanded.nodes) {
		if (node.type === 'button') ids.add(node.menuId);
		else if (node.type === 'group') {
			for (const child of node.children) if (child.type === 'button') ids.add(child.menuId);
		}
	}
	for (const button of profile.collapsed.buttons) ids.add(button.menuId);
	return ids;
}

export function getActiveHataSideStudioMenuIds(store = hataSideStudioStore.value): Set<string> {
	return getHataSideStudioMenuIds(getActiveHataSideProfile(store));
}

export function getAvailableHataSideStudioMoreItems(
	catalog: HataSideStudioSourceCatalog,
	store = hataSideStudioStore.value,
): SidebarSourceItem[] {
	const usedIds = getActiveHataSideStudioMenuIds(store);
	return catalog.more.filter(item => !usedIds.has(item.id));
}

export function copyExpandedToCollapsed(profile: HataSideStudioProfile): HataSideStudioProfile {
	const buttons: HataSideButton[] = [];
	for (const node of profile.expanded.nodes) {
		if (node.type === 'button') buttons.push(node);
		if (node.type === 'group') buttons.push(...node.children.filter((child): child is HataSideButton => child.type === 'button'));
	}
	return {
		...profile,
		collapsed: { buttons: buttons.map(button => ({ ...button, id: uid('button'), shape: button.shape === 'pill' ? 'rounded' : button.shape, size: 'small', rotation: 0, showLabel: false, borderVisible: false })) },
		updatedAt: new Date().toISOString(),
	};
}

export function copyCollapsedToExpanded(profile: HataSideStudioProfile): HataSideStudioProfile {
	const widgets = profile.expanded.nodes.filter((node): node is HataSideWidget => node.type === 'widget');
	const copied = profile.collapsed.buttons.map(button => ({ ...button, id: uid('button'), size: 'normal' as const, showLabel: true, borderVisible: true }));
	const group = createGroup(HATA_SIDE_STUDIO_DEFAULT_STORAGE_NAMES.collapsedCopyGroup);
	group.children = copied;
	return { ...profile, expanded: { ...profile.expanded, nodes: [group, ...widgets] }, updatedAt: new Date().toISOString() };
}

export function mergeHataSideGroups(profile: HataSideStudioProfile, sourceId: string, targetId: string): HataSideStudioProfile {
	if (sourceId === targetId) return profile;
	const source = profile.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.id === sourceId);
	const target = profile.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.id === targetId);
	if (!source || !target) return profile;
	const nodes = profile.expanded.nodes.filter(node => node.id !== sourceId).map(node => node.id === targetId ? { ...target, children: [...target.children, ...source.children] } : node);
	return { ...profile, expanded: { ...profile.expanded, nodes }, updatedAt: new Date().toISOString() };
}

export function gradientCss(item: Pick<HataSideAppearance, 'background' | 'gradientEnabled' | 'gradientTo' | 'gradientAngle' | 'gradientEasing'>): string {
	if (!item.gradientEnabled) return item.background;
	const stops: Record<HataSideGradientEasing, string> = {
		linear: `${item.background} 0%, ${item.gradientTo} 100%`,
		'ease-in': `${item.background} 0%, ${item.background} 28%, ${item.gradientTo} 100%`,
		'ease-out': `${item.background} 0%, ${item.gradientTo} 72%, ${item.gradientTo} 100%`,
		'ease-in-out': `${item.background} 0%, color-mix(in srgb, ${item.background} 75%, ${item.gradientTo}) 28%, color-mix(in srgb, ${item.background} 25%, ${item.gradientTo}) 72%, ${item.gradientTo} 100%`,
	};
	return `linear-gradient(${clamp(item.gradientAngle, 0, 360)}deg, ${stops[item.gradientEasing]})`;
}

export function isHataSideStudioStorageString(value: unknown): boolean {
	if (typeof value !== 'string' || value.length > 512 * 1024) return false;
	try {
		const parsed = JSON.parse(value);
		return isRecord(parsed) && Array.isArray(parsed.profiles);
	} catch {
		return false;
	}
}

export function cloneHataSideStudioStore(store: HataSideStudioStore): HataSideStudioStore {
	return JSON.parse(JSON.stringify(store)) as HataSideStudioStore;
}
