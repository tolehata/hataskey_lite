/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SettingsSearchNavigationTargetV2 } from '@/utility/settings-search-v2-context.js';
import { i18n } from '@/i18n.js';

export type SettingsDestination = SettingsSearchNavigationTargetV2 & {
	id: string;
	label: string;
	icon: string;
	showCount?: boolean;
	primary?: boolean;
	categoryId?: string;
	description?: string;
	legacyGroup?: string;
	brand?: 'Hataskey' | 'Hatask' | 'Hatady' | 'HataFeed';
	/**
	 * 旗鯖fork: Tabler の代わりに出す絵。⚠️これがあるときは icon を描かない。
	 *   ⚠️icon は空にしないこと。検索索引が icon を持つ前提で並べている。
	 */
	iconImage?: string;
};
export type SettingsDestinationSection = { id: string; label: string; description: string; icon: string; iconImage?: string; brand?: SettingsDestination['brand']; items: SettingsDestination[] };

const copy = i18n.ts._hata._settingsRedesign;
const pref = '/settings/preferences';
const destination = (id: string, label: string, route: string, icon: string, extra: Partial<SettingsDestination> = {}): SettingsDestination => ({
	id, stableId: 'settings.destination.' + id, label, route, icon, ...extra,
});

/**
 * Explicit IA source of truth. Never infer categories from the shared legacy route.
 *
 * 旗鯖fork: 並び順は「この端末で最初に触るもの」から。独自UIを先頭に置き、
 * 本体(Misskey/CherryPick)由来の設定を後ろへ回す。
 * ⚠️節のidは `CATEGORY_BY_DESTINATION_SECTION` と検査が参照している。改名しないこと。
 * ⚠️項目のidは `preferenceDestinationIds` が参照している。消すと起動時に例外になる。
 */
export const settingsDestinationSections: SettingsDestinationSection[] = [{
	id: 'hataskey-ui', label: 'hataskeyUI / S', description: copy.nav.appearanceDescription, icon: 'ti ti-sparkles', brand: 'Hataskey', items: [
		destination('hataskey-ui', 'Hataskey UI', '/settings/hata-custom', 'ti ti-sparkles', { brand: 'Hataskey', primary: true, showCount: true, activation: { kind: 'hata-custom-category', category: 'glassUi' } }),
		destination('hataskey-ui-s', 'Hataskey UI S', pref, 'ti ti-pencil', { brand: 'Hataskey', categoryId: 'hataskey-ui', description: i18n.ts._hata._uiSetup.ui3SettingsDescription }),
	],
}, {
	id: 'hataskey-tools', label: copy.nav.hataTools, description: copy.nav.hataToolsDescription, icon: 'ti ti-flag', brand: 'Hataskey', items: [
		destination('hata-hatask', 'Hatask', '/settings/hata-custom', 'ti ti-checklist', { brand: 'Hatask', activation: { kind: 'popup', category: 'hatask', popup: 'hatask' } }),
		destination('hata-hatady', 'Hatady', '/settings/hata-custom', 'ti ti-book-2', { brand: 'Hatady', activation: { kind: 'popup', category: 'hatady', popup: 'hatady' } }),
		destination('hata-hatafeed', 'HataFeed', '/settings/hatafeed', 'ti ti-message-heart', { brand: 'HataFeed', primary: true, showCount: true }),
		destination('hata-earthquake', copy.nav.weatherViewer, '/settings/hata-custom', 'ti ti-activity', { activation: { kind: 'popup', category: 'earthquake', popup: 'earthquake' } }),
		destination('hata-mascot', copy.nav.mascotHatakyu, '/settings/hata-custom', 'ti ti-mood-smile-beam', { activation: { kind: 'popup', category: 'mascot', popup: 'mascot' } }),
		destination('hata-settings-transfer', copy.nav.settingsTransfer, '/settings/hata-custom', 'ti ti-package', { activation: { kind: 'popup', category: 'general', popup: 'settings-transfer' } }),
	],
}, {
	id: 'display-appearance', label: copy.nav.appearanceAndTheme, description: copy.nav.appearanceAndThemeDescription, icon: 'ti ti-palette', items: [
		// 旗鯖fork: テーマは1項目にまとめる。管理とインストールは /settings/theme の
		// 中から辿れる(FormLinkが置いてある)ので、左ペインを3つに割らない。
		destination('display-theme', i18n.ts.theme, '/settings/theme', 'ti ti-palette', { primary: true, showCount: true, categoryId: 'theme-font' }),
		destination('hataskey-ui-font', copy.nav.font, '/settings/hata-custom', 'ti ti-typography', { activation: { kind: 'hata-custom-category', category: 'font' } }),
		destination('display-css', i18n.ts.customCss, '/settings/custom-css', 'ti ti-code', { primary: true, showCount: true, categoryId: 'theme-font' }),
		destination('display-emoji', copy.nav.emojiPalette, '/settings/emoji-palette', 'ti ti-mood-happy', { primary: true, showCount: true, categoryId: 'reactions' }),
		destination('display-general', i18n.ts.preferences, pref, 'ti ti-adjustments', { legacyGroup: 'general', categoryId: 'display-notes' }),
		destination('display-preferences', copy.nav.appearanceDetails, pref, 'ti ti-eye', { legacyGroup: 'appearance', categoryId: 'display-notes' }),
	],
}, {
	id: 'timeline-posting', label: copy.nav.timelineAndPosts, description: copy.nav.timelineAndPostsDescription, icon: 'ti ti-list', items: [
		destination('timeline-note-display', copy.nav.noteDisplayAndCollapse, pref, 'ti ti-note', { controlId: 'settings.control.showreplytargetnote-1kw238d', legacyGroup: 'timelineAndNote', categoryId: 'timeline-posting' }),
		destination('timeline-post-form', i18n.ts.postForm, pref, 'ti ti-pencil', { controlId: 'settings.control.showfixedpostform-h9wq8p', legacyGroup: 'postForm', categoryId: 'timeline-posting' }),
		destination('timeline-group', copy.nav.timelineOptions, pref, 'ti ti-list-details', { legacyGroup: 'timelineAndNote', categoryId: 'timeline-posting' }),
	],
}, {
	id: 'notifications-sound', label: copy.catalog.categories.notificationSound, description: i18n.ts.notificationSoundSettings, icon: 'ti ti-bell', items: [
		destination('notifications-page', i18n.ts.notifications, '/settings/notifications', 'ti ti-bell', { primary: true, showCount: true }),
		destination('notifications-sounds', i18n.ts.sounds, '/settings/sounds', 'ti ti-music', { primary: true, showCount: true }),
		destination('notifications-preferences', copy.nav.notificationBehavior, pref, 'ti ti-bell-ringing', { legacyGroup: 'notifications', categoryId: 'notification-sound' }),
		destination('timeline-chat', i18n.ts.chat, pref, 'ti ti-message', { controlId: 'settings.control.chatsendonenter-1d3fj7q', legacyGroup: 'directMessage', categoryId: 'notification-sound' }),
	],
}, {
	// 旗鯖fork: ⚠️プロフィールだけの節は作らない。左ペインの最上部に
	//   プロフィールへ飛ぶ行が常に出ているので、同じ入口が2つ並んでしまう。
	//   ⚠️ただし項目そのものは消さないこと。消すと検索の関連付けが行き先を
	//   失い、索引の構築が例外で止まる（実際に止まった）。ここの兄弟タブへ移す。
	id: 'account-login', label: copy.nav.accountAndLogin, description: copy.nav.accountAndLoginDescription, icon: 'ti ti-lock', items: [
		destination('account-profile', i18n.ts.profile, '/settings/profile', 'ti ti-user', { primary: true, showCount: true }),
		destination('account-avatar', copy.nav.avatarDecoration, '/settings/avatar-decoration', 'ti ti-sparkles', { primary: true, showCount: true }),
		destination('account-stats', copy.nav.accountStats, '/settings/account-stats', 'ti ti-chart-bar', { primary: true, showCount: true }),
		destination('account-privacy', i18n.ts.privacy, '/settings/privacy', 'ti ti-lock-open', { primary: true, showCount: true }),
		destination('account-email', i18n.ts.email, '/settings/email', 'ti ti-mail', { primary: true, showCount: true }),
		destination('account-security', i18n.ts.security, '/settings/security', 'ti ti-lock', { primary: true, showCount: true }),
		destination('account-switch', copy.nav.accountSwitch, '/settings/accounts', 'ti ti-users', { primary: true, showCount: true }),
		destination('account-migration', i18n.ts.accountMigration, '/settings/other', 'ti ti-truck', { primary: true, showCount: true, legacyGroup: 'other' }),
	],
}, {
	// 旗鯖fork: 「見せないもの」をまとめる。⚠️非表示リアクションもここが探し場所。
	id: 'mute-block', label: i18n.ts.muteAndBlock, description: copy.nav.muteAndBlockDescription, icon: 'ti ti-ban', items: [
		destination('account-mute', i18n.ts.muteAndBlock, '/settings/mute-block', 'ti ti-ban', { primary: true, showCount: true }),
		destination('timeline-hidden-reactions', copy.nav.hiddenReactions, '/settings/hidden-reactions', 'ti ti-mood-off', { primary: true, showCount: true }),
	],
}, {
	id: 'drive', label: i18n.ts.drive, description: copy.nav.driveDescription, icon: 'ti ti-cloud', items: [
		destination('account-drive', i18n.ts.drive, '/settings/drive', 'ti ti-cloud', { primary: true, showCount: true }),
		destination('account-drive-cleaner', copy.nav.driveCleaner, '/settings/drive/cleaner', 'ti ti-brush', { primary: true, showCount: true }),
	],
}, {
	id: 'data-migration', label: copy.nav.dataAndMigration, description: copy.nav.dataAndMigrationDescription, icon: 'ti ti-package', items: [
		destination('account-export', copy.nav.accountDataExport, '/settings/account-data', 'ti ti-file-export', { primary: true, showCount: true }),
		destination('account-profiles', copy.nav.settingsProfiles, '/settings/profiles', 'ti ti-adjustments', { primary: true, showCount: true }),
	],
}, {
	id: 'connections', label: copy.nav.externalServices, description: copy.nav.externalServicesDescription, icon: 'ti ti-link', items: [
		destination('account-external', copy.nav.externalAccount, '/settings/external-account', 'ti ti-user-share', { primary: true, showCount: true }),
		destination('account-concrnt', 'コンカレント連携(BETA)', '/settings/concrnt', 'concrnt-icon', { primary: true, showCount: true }),
		destination('account-connect', copy.nav.serviceConnect, '/settings/connect', 'ti ti-link', { primary: true, showCount: true }),
		destination('account-apps', copy.nav.linkedApps, '/settings/apps', 'ti ti-apps', { primary: true, showCount: true }),
		destination('account-plugins', copy.nav.plugins, '/settings/plugin', 'ti ti-plug', { primary: true, showCount: true }),
	],
}, {
	id: 'misskey-ui', label: copy.nav.misskey, description: copy.nav.misskeyDescription, icon: 'ti ti-archive', items: [
		// 旗鯖fork: ⚠️「表示するタイムライン」は Misskey 由来の画面なのでこの節に置く。
		destination('timeline-display', copy.nav.displayTimeline, '/settings/timeline', 'ti ti-list', { primary: true, showCount: true }),
		destination('misskey-navbar', i18n.ts.navbar, '/settings/navbar', 'ti ti-layout-navbar', { primary: true, showCount: true }),
		destination('misskey-statusbar', i18n.ts.statusbar, '/settings/statusbar', 'ti ti-layout-bottombar', { primary: true, showCount: true }),
		destination('misskey-deck', i18n.ts.deck, '/settings/deck', 'ti ti-columns', { primary: true, showCount: true }),
	],
}, {
	// 旗鯖fork: Misskey UI には画面まわりだけを残し、
	// 画面と関係ない設定はこちらへ集める。
	// ⚠️`misskey-search` は項目が0件で、検索は `cherrypick-search` が持っている。
	//   左ペインに空の重複を出さないため、ここにも置かない。
	id: 'misc', label: copy.nav.miscLabel, description: copy.nav.miscDescription, icon: 'ti ti-dots', items: [
		destination('misskey-general', copy.nav.misskeyGeneral, pref, 'ti ti-settings', { legacyGroup: 'general' }),
		destination('misskey-accessibility', i18n.ts.accessibility, pref, 'ti ti-accessible', { legacyGroup: 'accessibility' }),
		destination('misskey-performance', i18n.ts.performance, pref, 'ti ti-gauge', { legacyGroup: 'performance' }),
		destination('misskey-data-saver', i18n.ts.dataSaver, pref, 'ti ti-leaf', { legacyGroup: 'dataSaver' }),
		destination('misskey-other', i18n.ts.other, pref, 'ti ti-dots', { primary: true, legacyGroup: 'other' }),
	],
}, {
	id: 'cherrypick', label: copy.nav.cherrypick, description: copy.nav.cherrypickDescription, icon: 'ti ti-cherry', items: [
		destination('cherrypick-settings', copy.nav.cherrypick, '/settings/cherrypick', 'ti ti-cherry', { primary: true, showCount: true, categoryId: 'cherrypick' }),
		destination('cherrypick-display', i18n.ts.appearance, pref, 'ti ti-layout-dashboard', { legacyGroup: 'appearance', categoryId: 'cherrypick' }),
		destination('cherrypick-search', i18n.ts.search, pref, 'ti ti-world-search', { legacyGroup: 'other', categoryId: 'cherrypick' }),
		destination('cherrypick-external-navigation', i18n.ts._externalNavigationWarning.externalNavigationWarning, pref, 'ti ti-external-link', { legacyGroup: 'externalNavigationWarning', categoryId: 'cherrypick' }),
	],
}];

export const settingsDestinations = settingsDestinationSections.flatMap(section => section.items);
export function destinationForId(id: string): SettingsDestination | undefined {
	return settingsDestinations.find(destination => destination.id === id || destination.stableId === id);
}
export function destinationForPath(path: string, id?: string): SettingsDestination | undefined {
	if (id != null) return destinationForId(id);
	const matches = settingsDestinations.filter(destination => destination.route === path);
	return matches.length === 1 ? matches[0] : undefined;
}
