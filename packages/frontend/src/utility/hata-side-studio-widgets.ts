/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * HataSideStudio で扱う native widget の正規レジストリ。
 * packages/frontend/src/widgets/index.ts の公開順と同じ順序を保つ。
 */

import { i18n } from '@/i18n.js';

export const HATA_SIDE_WIDGET_SIZES = ['small', 'normal', 'large'] as const;

export type HataSideWidgetSize = typeof HATA_SIDE_WIDGET_SIZES[number];
export type HataSideWidgetContent = 'compact' | 'normal' | 'detail';
export type HataSideWidgetData = Record<string, unknown>;

export type HataSideWidgetSizeSetting = {
	content: HataSideWidgetContent;
	/**
	 * native widget の内容領域に保証する最低高。
	 * 実際の内容がこれを超える場合は、途中で切らずホスト側を自動で伸ばす。
	 */
	minHeight: number;
	data: HataSideWidgetData;
};

export type HataSideWidgetDefinition = {
	/**
	 * 保存互換用の既定名。localeを切り替えても保存JSONを変えないため、
	 * 表示には getHataSideWidgetDisplayLabel() を使う。
	 */
	label: string;
	icon: string;
	defaultData: HataSideWidgetData;
	availability: {
		requiresFederation: boolean;
		adminOnly: boolean;
		legacy: boolean;
	};
	sizes: Record<HataSideWidgetSize, HataSideWidgetSizeSetting>;
};

type SizeOverrides = Partial<Record<HataSideWidgetSize, Partial<Omit<HataSideWidgetSizeSetting, 'data'>> & {
	data?: HataSideWidgetData;
}>>;

function sizeSettings(overrides: SizeOverrides = {}): Record<HataSideWidgetSize, HataSideWidgetSizeSetting> {
	const defaults: Record<HataSideWidgetSize, HataSideWidgetSizeSetting> = {
		small: { content: 'compact', minHeight: 72, data: {} },
		normal: { content: 'normal', minHeight: 160, data: {} },
		large: { content: 'detail', minHeight: 280, data: {} },
	};
	return {
		small: { ...defaults.small, ...overrides.small, data: { ...defaults.small.data, ...overrides.small?.data } },
		normal: { ...defaults.normal, ...overrides.normal, data: { ...defaults.normal.data, ...overrides.normal?.data } },
		large: { ...defaults.large, ...overrides.large, data: { ...defaults.large.data, ...overrides.large?.data } },
	};
}

function defineWidget(
	label: string,
	icon: string,
	options: {
		requiresFederation?: boolean;
		adminOnly?: boolean;
		legacy?: boolean;
		defaultData?: HataSideWidgetData;
		sizes?: SizeOverrides;
	} = {},
): HataSideWidgetDefinition {
	return {
		label,
		icon,
		defaultData: { ...(options.defaultData ?? {}) },
		availability: {
			requiresFederation: options.requiresFederation === true,
			adminOnly: options.adminOnly === true,
			legacy: options.legacy === true,
		},
		sizes: sizeSettings(options.sizes),
	};
}

function heightOnly(small: number, normal: number, large: number): SizeOverrides {
	return {
		small: { minHeight: small },
		normal: { minHeight: normal },
		large: { minHeight: large },
	};
}

export const HATA_SIDE_NATIVE_WIDGET_REGISTRY = {
	// WidgetProfile / WidgetInstanceInfo は設定propsを持たないため、存在しないdataを足さず高さだけを最適化する。
	profile: defineWidget('プロフィール', 'ti ti-user', { sizes: heightOnly(92, 112, 146) }),
	instanceInfo: defineWidget('サーバー情報', 'ti ti-server', { sizes: heightOnly(104, 150, 210) }),
	memo: defineWidget('メモ', 'ti ti-note', { sizes: {
		small: { minHeight: 80, data: { showHeader: false, height: 80 } },
		normal: { minHeight: 130, data: { showHeader: true, height: 100 } },
		large: { minHeight: 260, data: { showHeader: true, height: 220 } },
	} }),
	notifications: defineWidget('通知', 'ti ti-bell', { sizes: {
		small: { minHeight: 112, data: { showHeader: false, height: 112 } },
		normal: { minHeight: 220, data: { showHeader: true, height: 220 } },
		large: { minHeight: 340, data: { showHeader: true, height: 340 } },
	} }),
	externalNotifications: defineWidget('外部通知', 'ti ti-bell-ringing', { sizes: {
		small: { minHeight: 88, data: { showHeader: false, height: 88 } },
		normal: { minHeight: 168, data: { showHeader: true, height: 168 } },
		large: { minHeight: 264, data: { showHeader: true, height: 264 } },
	} }),
	timeline: defineWidget('タイムライン', 'ti ti-home', { sizes: {
		small: { minHeight: 160, data: { showHeader: false, height: 160 } },
		normal: { minHeight: 300, data: { showHeader: true, height: 300 } },
		large: { minHeight: 480, data: { showHeader: true, height: 480 } },
	} }),
	calendar: defineWidget('カレンダー', 'ti ti-calendar', { sizes: {
		small: { minHeight: 126, data: { transparent: true } },
		normal: { minHeight: 210, data: { transparent: false } },
		large: { minHeight: 300, data: { transparent: false } },
	} }),
	rss: defineWidget('RSSリーダー', 'ti ti-rss', { sizes: {
		small: { minHeight: 86, data: { showHeader: false, maxEntries: 2 } },
		normal: { minHeight: 150, data: { showHeader: true, maxEntries: 4 } },
		large: { minHeight: 236, data: { showHeader: true, maxEntries: 7 } },
	} }),
	rssTicker: defineWidget('RSSティッカー', 'ti ti-rss', { sizes: {
		small: { minHeight: 48, data: { showHeader: false, maxEntries: 6 } },
		normal: { minHeight: 56, data: { showHeader: false, maxEntries: 12 } },
		large: { minHeight: 72, data: { showHeader: false, maxEntries: 20 } },
	} }),
	trends: defineWidget('トレンド', 'ti ti-trending-up', { sizes: {
		small: { minHeight: 84, data: { showHeader: false } },
		normal: { minHeight: 132, data: { showHeader: true } },
		large: { minHeight: 190, data: { showHeader: true } },
	} }),
	clock: defineWidget('時計', 'ti ti-clock', { sizes: {
		small: { minHeight: 124, data: { size: 'small', label: 'none', fadeGraduations: false } },
		normal: { minHeight: 178, data: { size: 'medium', label: 'time', fadeGraduations: false } },
		large: { minHeight: 240, data: { size: 'large', label: 'timeAndTz', fadeGraduations: false } },
	} }),
	activity: defineWidget('アクティビティ', 'ti ti-chart-line', { sizes: {
		small: { minHeight: 118, data: { showHeader: false, transparent: true } },
		normal: { minHeight: 220, data: { showHeader: true, transparent: false } },
		large: { minHeight: 330, data: { showHeader: true, transparent: false } },
	} }),
	photos: defineWidget('写真', 'ti ti-photo', { sizes: {
		small: { minHeight: 128, data: { showHeader: false, transparent: true } },
		normal: { minHeight: 230, data: { showHeader: true, transparent: false } },
		large: { minHeight: 360, data: { showHeader: true, transparent: false } },
	} }),
	digitalClock: defineWidget('デジタル時計', 'ti ti-clock-hour-4', { sizes: {
		small: { minHeight: 58, data: { fontSize: 1, showMs: false, showLabel: false } },
		normal: { minHeight: 78, data: { fontSize: 1.35, showMs: false, showLabel: true } },
		large: { minHeight: 108, data: { fontSize: 1.8, showMs: true, showLabel: true } },
	} }),
	unixClock: defineWidget('UNIX時計', 'ti ti-binary', { sizes: {
		small: { minHeight: 60, data: { fontSize: 1, showMs: false, showLabel: false } },
		normal: { minHeight: 92, data: { fontSize: 1.5, showMs: false, showLabel: true } },
		large: { minHeight: 142, data: { fontSize: 2.2, showMs: true, showLabel: true } },
	} }),
	// WidgetPostForm は設定propsを持たないため、高さだけを3段階で確保する。
	postForm: defineWidget('投稿フォーム', 'ti ti-pencil', { sizes: heightOnly(220, 290, 390) }),
	slideshow: defineWidget('スライドショー', 'ti ti-slideshow', { sizes: {
		small: { minHeight: 150, data: { height: 150 } },
		normal: { minHeight: 300, data: { height: 300 } },
		large: { minHeight: 480, data: { height: 480 } },
	} }),
	serverMetric: defineWidget('サーバーメトリクス', 'ti ti-device-desktop-analytics', { sizes: {
		// 円グラフ4枚の view:2 は狭いサイドメニューで重なるため、小はCPU/RAMの
		// 2枚表示に限定する。元ウィジェットの既定値には触れずStudio内だけで変える。
		small: { minHeight: 118, data: { showHeader: false, transparent: true, view: 3 } },
		normal: { minHeight: 190, data: { showHeader: true, transparent: false, view: 0 } },
		large: { minHeight: 280, data: { showHeader: true, transparent: false, view: 1 } },
	} }),
	onlineUsers: defineWidget('オンラインユーザー', 'ti ti-users', { sizes: {
		small: { minHeight: 42, data: { transparent: true } },
		normal: { minHeight: 54, data: { transparent: true } },
		large: { minHeight: 72, data: { transparent: false } },
	} }),
	jobQueue: defineWidget('ジョブキュー', 'ti ti-list-details', { adminOnly: true, sizes: {
		small: { minHeight: 128, data: { transparent: true } },
		normal: { minHeight: 250, data: { transparent: false } },
		large: { minHeight: 380, data: { transparent: false } },
	} }),
	// WidgetButton のlabel/scriptは利用者データで、サイズ連動させるべきpropsではない。
	button: defineWidget('ボタン', 'ti ti-square-rounded', {
		defaultData: { label: 'BUTTON', colored: true, script: 'Mk:dialog("hello" "world")' },
		sizes: heightOnly(58, 76, 104),
	}),
	aiscript: defineWidget('AiScriptコンソール', 'ti ti-terminal-2', { sizes: {
		small: { minHeight: 120, data: { showHeader: false } },
		normal: { minHeight: 230, data: { showHeader: true } },
		large: { minHeight: 360, data: { showHeader: true } },
	} }),
	aiscriptApp: defineWidget('AiScriptアプリ', 'ti ti-app-window', {
		// WidgetAiscriptApp が保持する利用者スクリプトを詳細ペインから編集できるようにする。
		defaultData: { script: '' },
		sizes: {
		small: { minHeight: 120, data: { showHeader: false } },
		normal: { minHeight: 230, data: { showHeader: true } },
		large: { minHeight: 360, data: { showHeader: true } },
	} }),
	aichan: defineWidget('藍', 'ti ti-sparkles', { sizes: {
		// 藍の実体は高さ350pxのiframe。極端に低い枠へ押し込むと全身が切れるため、
		// Studio側では縦横比を保って縮小できるだけの表示高を確保する。
		small: { minHeight: 168, data: { transparent: true } },
		normal: { minHeight: 248, data: { transparent: false } },
		large: { minHeight: 350, data: { transparent: false } },
	} }),
	userList: defineWidget('ユーザーリスト', 'ti ti-list', { sizes: {
		small: { minHeight: 130, data: { showHeader: false } },
		normal: { minHeight: 250, data: { showHeader: true } },
		large: { minHeight: 390, data: { showHeader: true } },
	} }),
	clicker: defineWidget('クリッカー', 'ti ti-hand-click', { sizes: {
		small: { minHeight: 92, data: { showHeader: false } },
		normal: { minHeight: 160, data: { showHeader: false } },
		large: { minHeight: 250, data: { showHeader: true } },
	} }),
	birthdayFollowings: defineWidget('フォロー中の誕生日', 'ti ti-cake', { sizes: {
		small: { minHeight: 110, data: { showHeader: false } },
		normal: { minHeight: 200, data: { showHeader: true } },
		large: { minHeight: 310, data: { showHeader: true } },
	} }),
	chat: defineWidget('チャット', 'ti ti-messages', { sizes: {
		small: { minHeight: 150, data: { showHeader: false } },
		normal: { minHeight: 290, data: { showHeader: true } },
		large: { minHeight: 460, data: { showHeader: true } },
	} }),
	search: defineWidget('検索', 'ti ti-search', { sizes: {
		small: { minHeight: 68, data: { showHeader: false } },
		normal: { minHeight: 96, data: { showHeader: false } },
		large: { minHeight: 136, data: { showHeader: true } },
	} }),
	dice: defineWidget('サイコロ', 'ti ti-dice-5', { sizes: {
		small: { minHeight: 84, data: { showMinTotal: false, showMaxTotal: false, showAverageTotal: false } },
		normal: { minHeight: 128, data: { showMinTotal: false, showMaxTotal: false, showAverageTotal: true } },
		large: { minHeight: 188, data: { showMinTotal: true, showMaxTotal: true, showAverageTotal: true } },
	} }),
	weather: defineWidget('天気', 'ti ti-cloud-sun', { sizes: {
		small: { minHeight: 118, data: { showSurfacePressure: false, show12Hours: false } },
		normal: { minHeight: 220, data: { showSurfacePressure: false, show12Hours: true } },
		large: { minHeight: 340, data: { showSurfacePressure: true, show12Hours: true } },
	} }),
	mascot: defineWidget('マスコット', 'ti ti-paw', { sizes: {
		small: { minHeight: 92, data: { showHeader: false, size: 'small', showPhrase: false } },
		normal: { minHeight: 150, data: { showHeader: false, size: 'small', showPhrase: true } },
		large: { minHeight: 220, data: { showHeader: true, size: 'medium', showPhrase: true } },
	} }),
	earthquake: defineWidget('地震・津波情報', 'ti ti-activity-heartbeat', { sizes: {
		small: { minHeight: 94, data: { showHeader: false, maxItems: 1 } },
		normal: { minHeight: 140, data: { showHeader: true, maxItems: 1 } },
		large: { minHeight: 190, data: { showHeader: true, maxItems: 1 } },
	} }),
	hataskFlowers: defineWidget('Hatask お花', 'ti ti-flower', { sizes: {
		small: { minHeight: 84, data: { showHeader: false, maxItems: '3' } },
		normal: { minHeight: 132, data: { showHeader: false, maxItems: '3' } },
		large: { minHeight: 190, data: { showHeader: true, maxItems: '5' } },
	} }),
	seasonalTree: defineWidget('季節の木', 'ti ti-tree', { sizes: {
		small: { minHeight: 180, data: { showHeader: false, height: 180, season: 'auto', timeOfDay: 'auto', animated: true, windStrength: 60, showCaption: true } },
		normal: { minHeight: 240, data: { showHeader: true, height: 240, season: 'auto', timeOfDay: 'auto', animated: true, windStrength: 60, showCaption: true } },
		large: { minHeight: 320, data: { showHeader: true, height: 320, season: 'auto', timeOfDay: 'auto', animated: true, windStrength: 60, showCaption: true } },
	} }),
	federation: defineWidget('連合', 'ti ti-whirl', { requiresFederation: true, sizes: {
		small: { minHeight: 126, data: { showHeader: false } },
		normal: { minHeight: 220, data: { showHeader: true } },
		large: { minHeight: 340, data: { showHeader: true } },
	} }),
	instanceCloud: defineWidget('インスタンスクラウド', 'ti ti-cloud', { requiresFederation: true, sizes: {
		small: { minHeight: 128, data: { transparent: true } },
		normal: { minHeight: 230, data: { transparent: false } },
		large: { minHeight: 350, data: { transparent: false } },
	} }),
} as const satisfies Record<string, HataSideWidgetDefinition>;

// 旧HataSideStudioだけが持っていた種類。flowers は native の hataskFlowers へ
// 無損失で移せるが、announcements には対応する native component がまだ無いため残す。
export const HATA_SIDE_LEGACY_WIDGET_REGISTRY = {
	flowers: defineWidget('育てたお花', 'ti ti-flower', { legacy: true }),
	announcements: defineWidget('お知らせ', 'ti ti-speakerphone', { legacy: true }),
} as const satisfies Record<string, HataSideWidgetDefinition>;

export const HATA_SIDE_WIDGET_REGISTRY = {
	...HATA_SIDE_NATIVE_WIDGET_REGISTRY,
	...HATA_SIDE_LEGACY_WIDGET_REGISTRY,
} as const satisfies Record<string, HataSideWidgetDefinition>;

export const HATA_SIDE_WIDGET_LEGACY_ALIASES = {
	flowers: 'hataskFlowers',
} as const;

export type HataSideNativeWidgetKind = keyof typeof HATA_SIDE_NATIVE_WIDGET_REGISTRY;
export type HataSideLegacyWidgetKind = keyof typeof HATA_SIDE_LEGACY_WIDGET_REGISTRY;
export type HataSideWidgetKind = keyof typeof HATA_SIDE_WIDGET_REGISTRY;

export function isHataSideWidgetKind(value: unknown): value is HataSideWidgetKind {
	return typeof value === 'string' && Object.hasOwn(HATA_SIDE_WIDGET_REGISTRY, value);
}

export function normalizeHataSideWidgetKind(value: unknown): HataSideWidgetKind {
	if (!isHataSideWidgetKind(value)) return 'clock';
	return value === 'flowers' ? HATA_SIDE_WIDGET_LEGACY_ALIASES.flowers : value;
}

const HATA_SIDE_WIDGET_DEFAULT_LABEL_ALIASES: Partial<Record<HataSideWidgetKind, readonly string[]>> = {
	// v2以前の flowers は sanitize 時に hataskFlowers へ移るが、当時の既定名は残る。
	hataskFlowers: ['Hatask お花', '育てたお花'],
};

/**
 * ウィジェット名を表示時だけ共通localeへ解決する。
 *
 * `storedLabel` は既存プロファイルとの互換用であり、利用者が変更した名前はそのまま返す。
 * 翻訳対象外の地震・津波情報は、localeに関係なく保存済み表示を維持する。
 */
export function getHataSideWidgetDisplayLabel(value: unknown, storedLabel?: string): string {
	const kind = normalizeHataSideWidgetKind(value);
	const canonicalLabel = HATA_SIDE_WIDGET_REGISTRY[kind].label;
	const fallback = typeof storedLabel === 'string' && storedLabel.length > 0 ? storedLabel : canonicalLabel;
	if (kind === 'earthquake') return fallback;

	const defaultAliases = HATA_SIDE_WIDGET_DEFAULT_LABEL_ALIASES[kind] ?? [canonicalLabel];
	if (typeof storedLabel === 'string' && storedLabel.length > 0 && !defaultAliases.includes(storedLabel)) return storedLabel;

	const labels = i18n.ts._hata._hataSideStudio._utility.widgetLabels as Record<string, string>;
	return labels[kind] ?? fallback;
}
