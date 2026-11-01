/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** A catalog entry is a destination in an existing screen, not a new route. */
export type HatagoesApp = 'hatask' | 'hatady' | 'hatafeed';

/** UI visibility hint only. The destination must still enforce its existing ACL. */
export type HatagoesAccess = 'canAccessHataFeed' | 'canUseMascot' | 'moderator' | 'admin' | 'hatafeedStaff';

export type HatagoesCatalogEntry = {
	readonly id: string;
	readonly app: HatagoesApp;
	readonly label: string;
	readonly icon: string;
	readonly path: string;
	/** Existing in-page tab. Consumers must activate it when opening the path. */
	readonly tab?: string;
	/** Existing modal action on the owning app. Path is its real route fallback. */
	readonly action?: 'settings' | 'drawing-tool' | 'whats-new';
	readonly access?: HatagoesAccess;
	/** HataGoes の中で展開せず、HataGoes を出てそのページを独立した画面として開く */
	readonly standalone?: true;
};

// Paths are taken from router.definition.ts. Hatady and HataFeed use in-page
// tabs; their design-document paths such as /hatady/records and
// /hatafeed/issues are not routes. Detail variants are not separate catalog
// entries. HataGoes home and All Screens are permanent UI
// slots, outside the five account-wide pins.
export const HATAGOES_CATALOG = [
	{ id: 'hatask.today', app: 'hatask', label: 'きょう', icon: 'ti ti-home', path: '/hatask' },
	{ id: 'hatask.cal', app: 'hatask', label: 'カレンダー', icon: 'ti ti-calendar', path: '/hatask?tab=cal' },
	{ id: 'hatask.todo', app: 'hatask', label: 'ToDo', icon: 'ti ti-checkbox', path: '/hatask?tab=todo' },
	{ id: 'hatask.mood', app: 'hatask', label: 'きもち', icon: 'ti ti-mood-smile', path: '/hatask?tab=mood' },
	{ id: 'hatask.meal', app: 'hatask', label: 'ごはん', icon: 'ti ti-bowl', path: '/hatask?tab=meal' },
	{ id: 'hatask.recipe', app: 'hatask', label: 'レシピ', icon: 'ti ti-chef-hat', path: '/hatask?tab=recipe' },
	{ id: 'hatask.garden', app: 'hatask', label: 'おはな', icon: 'ti ti-flower', path: '/hatask?tab=garden' },
	{ id: 'hatask.support', app: 'hatask', label: '支援情報', icon: 'ti ti-heart-handshake', path: '/hatask?tab=support' },
	{ id: 'hatask.ranking', app: 'hatask', label: 'ランキング', icon: 'ti ti-trophy', path: '/hatask?tab=ranking' },
	{ id: 'hatask.review', app: 'hatask', label: 'Hatask モデレーション', icon: 'ti ti-shield-search', path: '/hatask?tab=review', access: 'moderator' },
	{ id: 'hatask.apps', app: 'hatask', label: 'Hatask App', icon: 'ti ti-layout-grid', path: '/hatask?tab=hataskapps' },
	{ id: 'hatask.tools', app: 'hatask', label: 'Hataskey App', icon: 'ti ti-apps', path: '/hatask?tab=apps' },
	{ id: 'hatask.appearance', app: 'hatask', label: 'Hatask の設定', icon: 'ti ti-settings', path: '/hatask', action: 'settings' },
	{ id: 'hatask.drawing-tool', app: 'hatask', label: 'Hatadint', icon: 'ti ti-brush', path: '/hatask', action: 'drawing-tool' },
	{ id: 'hatask.whats-new', app: 'hatask', label: '新着情報', icon: 'ti ti-news', path: '/hatask', action: 'whats-new' },

	{ id: 'hatady.home', app: 'hatady', label: 'Hatady ホーム', icon: 'ti ti-home', path: '/hatady', tab: 'home' },
	{ id: 'hatady.records', app: 'hatady', label: 'Hatady 記録', icon: 'ti ti-notebook', path: '/hatady', tab: 'records' },
	{ id: 'hatady.collection', app: 'hatady', label: 'Hatady コレクション', icon: 'ti ti-books', path: '/hatady', tab: 'collection' },
	{ id: 'hatady.profile', app: 'hatady', label: 'Hatady プロフィール', icon: 'ti ti-user', path: '/hatady', tab: 'profile' },
	{ id: 'hatady.moderation', app: 'hatady', label: 'Hatady モデレーション', icon: 'ti ti-shield', path: '/hatady', tab: 'moderation', access: 'moderator' },
	{ id: 'hatady.settings', app: 'hatady', label: 'Hatady の設定', icon: 'ti ti-settings', path: '/hatady', action: 'settings' },

	{ id: 'hatafeed.home', app: 'hatafeed', label: 'HataFeed ホーム', icon: 'ti ti-home', path: '/hatafeed', tab: 'home', access: 'canAccessHataFeed' },
	{ id: 'hatafeed.issues', app: 'hatafeed', label: 'イシュー', icon: 'ti ti-message-report', path: '/hatafeed', tab: 'issues', access: 'canAccessHataFeed' },
	{ id: 'hatafeed.roadmap', app: 'hatafeed', label: 'ロードマップ', icon: 'ti ti-map', path: '/hatafeed', tab: 'roadmap', access: 'canAccessHataFeed' },
	{ id: 'hatafeed.beta', app: 'hatafeed', label: 'ベータ', icon: 'ti ti-flask', path: '/hatafeed/beta', access: 'canAccessHataFeed' },
	{ id: 'hatafeed.emoji', app: 'hatafeed', label: '絵文字管理', icon: 'ti ti-mood-smile', path: '/hatafeed', tab: 'emoji', access: 'hatafeedStaff' },
	{ id: 'hatafeed.display-settings', app: 'hatafeed', label: 'HataFeed の設定', icon: 'ti ti-settings', path: '/hatafeed', action: 'settings', access: 'canAccessHataFeed' },
	{ id: 'hatafeed.settings', app: 'hatafeed', label: 'HataFeed 設定', icon: 'ti ti-settings', path: '/settings/hatafeed', access: 'canAccessHataFeed' },

	{ id: 'hatask.intro', app: 'hatask', label: 'HataIntro', icon: 'ti ti-book', path: '/hatask/intro' },
	{ id: 'hatask.card-maker', app: 'hatask', label: 'HataCardMaker', icon: 'ti ti-id', path: '/hatask/card-maker' },
	{ id: 'hatask.emotion-analysis', app: 'hatask', label: 'HATAlyze', icon: 'ti ti-scan', path: '/hatask/emotion-analysis' },
	{ id: 'hatask.side-studio', app: 'hatask', label: 'HataSideStudio', icon: 'ti ti-layout-sidebar', path: '/hata-side-studio' },
	{ id: 'hatask.earthquake', app: 'hatask', label: '地震情報', icon: 'ti ti-activity', path: '/earthquake' },
	{ id: 'hatask.mascot', app: 'hatask', label: 'マスコット', icon: 'ti ti-mood-smile', path: '/mascot', access: 'canUseMascot' },
	{ id: 'hatask.games', app: 'hatask', label: 'ゲーム', icon: 'ti ti-device-gamepad', path: '/games' },
	{ id: 'hatask.bubble-game', app: 'hatask', label: 'バブルゲーム', icon: 'ti ti-bubble', path: '/bubble-game' },
	{ id: 'hatask.reversi', app: 'hatask', label: 'リバーシ', icon: 'ti ti-grid-dots', path: '/reversi' },
	// 旗鯖fork: HataIgo — not a HataGoes app tab; one entry under All apps that opens /hataigo.
	{ id: 'hatask.hataigo', app: 'hatask', label: 'HataIgo', icon: 'ti ti-circles', path: '/hataigo', standalone: true },
	{ id: 'hatask.clicker', app: 'hatask', label: 'クリッカー', icon: 'ti ti-pointer', path: '/clicker' },
	{ id: 'hatask.qr', app: 'hatask', label: 'QRコード', icon: 'ti ti-qrcode', path: '/qr' },
	{ id: 'hatask.scratchpad', app: 'hatask', label: 'スクラッチパッド', icon: 'ti ti-pencil', path: '/scratchpad' },
	{ id: 'hatask.api-console', app: 'hatask', label: 'APIコンソール', icon: 'ti ti-terminal', path: '/api-console' },
	{ id: 'hatask.hata-docs', app: 'hatask', label: 'Hata Docs', icon: 'ti ti-book', path: '/hata-docs' },
	{ id: 'hatask.pages', app: 'hatask', label: 'ページ', icon: 'ti ti-news', path: '/pages' },
	{ id: 'hatask.play', app: 'hatask', label: 'Play', icon: 'ti ti-player-play', path: '/play' },
	{ id: 'hatask.gallery', app: 'hatask', label: 'ギャラリー', icon: 'ti ti-icons', path: '/gallery' },
	{ id: 'hatask.settings', app: 'hatask', label: 'Hataskey 全体の設定', icon: 'ti ti-settings', path: '/settings/hata-custom' },
	{ id: 'hatask.support-admin', app: 'hatask', label: '支援管理', icon: 'ti ti-shield', path: '/admin/support', access: 'admin' },
] as const satisfies readonly HatagoesCatalogEntry[];

export type HatagoesScreenId = (typeof HATAGOES_CATALOG)[number]['id'];

export type HatagoesCatalogGroup = 'hatask' | 'hataskey' | 'developer' | 'games' | 'contents' | 'hatady' | 'hatafeed';
// These existing routes are outside the HataGoes mock. Keep their catalog IDs
// for legacy navigation and saved preferences, but omit them from its selectors.
const hiddenHataGoesIds = new Set<string>([
	'hatask.scratchpad', 'hatask.api-console', 'hatask.reversi',
	'hatask.clicker', 'hatask.bubble-game', 'hatask.play', 'hatask.gallery',
	'hatask.games', 'hatask.qr', 'hatask.pages', 'hatask.hata-docs', 'hatask.settings', 'hatask.support-admin', 'hatafeed.settings',
]);
export function isHatagoesVisibleScreen(screen: HatagoesCatalogEntry): boolean {
	return !hiddenHataGoesIds.has(screen.id);
}
const developerIds = new Set<string>(['hatask.scratchpad', 'hatask.api-console']);
const gameIds = new Set<string>(['hatask.games', 'hatask.bubble-game', 'hatask.reversi', 'hatask.clicker']);
const contentIds = new Set<string>(['hatask.intro', 'hatask.hata-docs', 'hatask.pages', 'hatask.play', 'hatask.gallery', 'hatask.whats-new']);
const hataskeyIds = new Set<string>(['hatask.tools', 'hatask.card-maker', 'hatask.emotion-analysis', 'hatask.drawing-tool', 'hatask.side-studio', 'hatask.earthquake', 'hatask.mascot', 'hatask.hataigo', 'hatask.qr', 'hatask.settings', 'hatask.support-admin']);

/** Presentation only: route ownership and saved pin IDs remain stable. */
export function getHatagoesCatalogGroup(screen: HatagoesCatalogEntry): HatagoesCatalogGroup {
	if (screen.app !== 'hatask') return screen.app;
	if (developerIds.has(screen.id)) return 'developer';
	if (gameIds.has(screen.id)) return 'games';
	if (contentIds.has(screen.id)) return 'contents';
	if (hataskeyIds.has(screen.id)) return 'hataskey';
	return 'hatask';
}

const screensById: ReadonlyMap<string, HatagoesCatalogEntry> = new Map(
	HATAGOES_CATALOG.map(screen => [screen.id, screen]),
);

export function getHatagoesScreen(id: string): HatagoesCatalogEntry | undefined {
	return screensById.get(id);
}

export function canonicalHatagoesScreenId(id: string): string {
	return id === 'hatask.hata-docs' ? 'hatask.intro' : id;
}

export const DEFAULT_HATAGOES_PINS = [
	'hatask.cal',
	'hatask.todo',
	'hatady.records',
	'hatady.collection',
	'hatafeed.issues',
] as const satisfies readonly HatagoesScreenId[];

export const HATAGOES_PIN_LIMIT = 5;

/** Normalize stored account data without filling intentionally empty slots. */
export function normalizeHatagoesPins(value: unknown): HatagoesScreenId[] {
	if (!Array.isArray(value)) return [...DEFAULT_HATAGOES_PINS];
	const result: HatagoesScreenId[] = [];
	const seen = new Set<string>();
	for (const rawId of value) {
		if (typeof rawId !== 'string') continue;
		const id = canonicalHatagoesScreenId(rawId);
		if (!screensById.has(id) || seen.has(id)) continue;
		seen.add(id);
		result.push(id as HatagoesScreenId);
		if (result.length === HATAGOES_PIN_LIMIT) break;
	}
	return result;
}
