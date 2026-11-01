/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { settingsInventoryKeys } from './settings-preferences-catalog.js';
import type { SettingsInventoryKey } from './settings-preferences-catalog.js';
import { i18n } from '@/i18n.js';

export const settingsBentoCategoryIds = ['profile', 'privacy', 'security', 'appearance', 'timeline', 'post', 'notify', 'access', 'mute', 'drive', 'apps', 'data', 'advanced'] as const;
export type SettingsBentoCategoryId = typeof settingsBentoCategoryIds[number];
export type SettingsBentoGroupId = 'you' | 'usage' | 'management';
export const bentoSectionIds = [
	'profile.section0',
	'profile.section1',
	'profile.section2',
	'profile.section3',
	'privacy.section0',
	'privacy.section1',
	'privacy.section2',
	'privacy.section3',
	'privacy.section4',
	'security.section0',
	'security.section1',
	'security.section2',
	'security.section3',
	'appearance.section0',
	'appearance.section1',
	'appearance.section2',
	'appearance.section3',
	'appearance.section4',
	'appearance.section5',
	'timeline.section0',
	'timeline.section1',
	'timeline.section2',
	'timeline.section3',
	'timeline.section4',
	'timeline.section5',
	'timeline.section6',
	'post.section0',
	'post.section1',
	'post.section2',
	'post.section3',
	'post.section4',
	'post.section5',
	'notify.section0',
	'notify.section1',
	'notify.section2',
	'notify.section3',
	'access.section0',
	'access.section1',
	'access.section2',
	'access.section3',
	'mute.section0',
	'mute.section1',
	'mute.section2',
	'drive.section0',
	'drive.section1',
	'drive.section2',
	'drive.section3',
	'apps.section0',
	'apps.section1',
	'data.section0',
	'data.section1',
	'data.section2',
	'data.section3',
	'advanced.section0',
	'advanced.section1',
	'advanced.section2',
	'advanced.section3',
] as const;
export type SettingsBentoSectionId = typeof bentoSectionIds[number];

export type SettingsBentoCategory = {
	id: SettingsBentoCategoryId;
	label: string;
	description: string;
	icon: string;
	groupId: SettingsBentoGroupId;
	groupLabel: string;
	preview: readonly string[];
	brand?: 'Hataskey';
};

const categorySpecs: readonly [SettingsBentoCategoryId, SettingsBentoGroupId, string][] = [
	['profile', 'you', 'ti ti-user-circle'],
	['privacy', 'you', 'ti ti-shield-lock'],
	['security', 'you', 'ti ti-key'],
	['appearance', 'usage', 'ti ti-palette'],
	['timeline', 'usage', 'ti ti-layout-list'],
	['post', 'usage', 'ti ti-pencil'],
	['notify', 'usage', 'ti ti-bell'],
	['access', 'usage', 'ti ti-accessible'],
	['mute', 'management', 'ti ti-ban'],
	['drive', 'management', 'ti ti-cloud'],
	['apps', 'management', 'ti ti-apps'],
	['data', 'management', 'ti ti-database-export'],
	['advanced', 'management', 'ti ti-adjustments'],
];

/** Presentation changes do not replace existing routes or search destinations. */
export const settingsBentoCategories: readonly SettingsBentoCategory[] = categorySpecs.map(([id, groupId, icon]) => ({
	id, groupId, icon,
	get label() { return i18n.ts._hata._settingsBento.categories[id].label; },
	get description() { return i18n.ts._hata._settingsBento.categories[id].description; },
	get groupLabel() { return i18n.ts._hata._settingsBento.groups[groupId]; },
	get preview() { const copy = i18n.ts._hata._settingsBento.categories[id]; return [copy.preview1, copy.preview2, copy.preview3]; },
	...(id === 'apps' ? { brand: 'Hataskey' as const } : {}),
}));

export function parseSettingsBentoCategory(value: unknown): SettingsBentoCategoryId | undefined {
	return typeof value === 'string' && settingsBentoCategoryIds.includes(value as SettingsBentoCategoryId) ? value as SettingsBentoCategoryId : undefined;
}

export function bentoSectionLabel(id: SettingsBentoSectionId): string {
	const [category, section] = id.split('.') as [SettingsBentoCategoryId, string];
	return (i18n.ts._hata._settingsBento.categories[category].sections as Readonly<Record<string, string>>)[section];
}

const bentoSectionIcons: Record<SettingsBentoSectionId, string> = {
	'profile.section0': 'ti ti-user-circle',
	'profile.section1': 'ti ti-list-details',
	'profile.section2': 'ti ti-sparkles',
	'profile.section3': 'ti ti-badges',
	'privacy.section0': 'ti ti-lock',
	'privacy.section1': 'ti ti-world-search',
	'privacy.section2': 'ti ti-message-circle',
	'privacy.section3': 'ti ti-shield-lock',
	'privacy.section4': 'ti ti-trash',
	'security.section0': 'ti ti-mail',
	'security.section1': 'ti ti-key',
	'security.section2': 'ti ti-history',
	'security.section3': 'ti ti-user-cog',
	'appearance.section0': 'ti ti-palette',
	'appearance.section1': 'ti ti-typography',
	'appearance.section2': 'ti ti-layout-dashboard',
	'appearance.section3': 'ti ti-compass',
	'appearance.section4': 'ti ti-blur',
	'appearance.section5': 'ti ti-mood-smile',
	'timeline.section0': 'ti ti-layout-list',
	'timeline.section1': 'ti ti-arrows-minimize',
	'timeline.section2': 'ti ti-note',
	'timeline.section3': 'ti ti-hand-click',
	'timeline.section4': 'ti ti-heart',
	'timeline.section5': 'ti ti-photo',
	'timeline.section6': 'ti ti-columns-3',
	'post.section0': 'ti ti-pencil',
	'post.section1': 'ti ti-world',
	'post.section2': 'ti ti-tools',
	'post.section3': 'ti ti-border-all',
	'post.section4': 'ti ti-mood-happy',
	'post.section5': 'ti ti-mood-search',
	'notify.section0': 'ti ti-bell',
	'notify.section1': 'ti ti-bell-ringing',
	'notify.section2': 'ti ti-device-mobile-message',
	'notify.section3': 'ti ti-volume',
	'access.section0': 'ti ti-player-play',
	'access.section1': 'ti ti-hand-finger',
	'access.section2': 'ti ti-bolt',
	'access.section3': 'ti ti-database',
	'mute.section0': 'ti ti-message-off',
	'mute.section1': 'ti ti-user-off',
	'mute.section2': 'ti ti-external-link',
	'drive.section0': 'ti ti-cloud',
	'drive.section1': 'ti ti-upload',
	'drive.section2': 'ti ti-photo',
	'drive.section3': 'ti ti-video',
	'apps.section0': 'ti ti-apps',
	'apps.section1': 'ti ti-puzzle',
	'data.section0': 'ti ti-database-export',
	'data.section1': 'ti ti-flag',
	'data.section2': 'ti ti-file-export',
	'data.section3': 'ti ti-plug-connected',
	'advanced.section0': 'ti ti-adjustments',
	'advanced.section1': 'ti ti-refresh',
	'advanced.section2': 'ti ti-code',
	'advanced.section3': 'ti ti-trash',
};

export function bentoSectionIcon(id: SettingsBentoSectionId): string {
	return bentoSectionIcons[id];
}

/** Existing leaf pages remain single owners; these are their section entry points. */
export const bentoLeadingDestinationIds: readonly string[] = ['hataskey-ui', 'hataskey-ui-s'];

export const bentoDestinationLinkSections: readonly {
	sectionId: SettingsBentoSectionId;
	destinationIds: readonly string[];
	explain: boolean;
}[] = [
	{ sectionId: 'profile.section2', destinationIds: ['account-avatar'], explain: false },
	{ sectionId: 'security.section3', destinationIds: ['account-stats', 'account-switch', 'account-migration'], explain: true },
	{ sectionId: 'appearance.section1', destinationIds: ['hataskey-ui-font'], explain: false },
	{ sectionId: 'appearance.section2', destinationIds: ['hataskey-ui', 'hataskey-ui-s', 'cherrypick-settings'], explain: false },
	{ sectionId: 'appearance.section3', destinationIds: ['misskey-navbar', 'misskey-statusbar'], explain: false },
	{ sectionId: 'timeline.section0', destinationIds: ['timeline-display'], explain: false },
	{ sectionId: 'timeline.section4', destinationIds: ['timeline-hidden-reactions'], explain: false },
	{ sectionId: 'timeline.section6', destinationIds: ['misskey-deck'], explain: true },
	{ sectionId: 'drive.section0', destinationIds: ['account-drive-cleaner'], explain: false },
	{ sectionId: 'apps.section0', destinationIds: ['hata-hatask', 'hata-hatady', 'hata-hatafeed'], explain: true },
	{ sectionId: 'apps.section1', destinationIds: ['hata-earthquake', 'hata-mascot'], explain: true },
	{ sectionId: 'data.section1', destinationIds: ['hata-settings-transfer'], explain: false },
	{ sectionId: 'data.section3', destinationIds: ['account-external', 'account-concrnt', 'account-connect', 'account-apps'], explain: true },
	{ sectionId: 'advanced.section2', destinationIds: ['account-plugins', 'display-css'], explain: true },
];

/** Every existing preference keeps one owner and one primary presentation section. */
export const bentoPreferencePlacements = {
	'advancedMfm': 'advanced.section0',
	'allMediaNoteCollapse': 'timeline.section1',
	'alwaysConfirmFollow': 'advanced.section0',
	'alwaysShowCw': 'timeline.section2',
	'animatedMfm': 'access.section0',
	'animation': 'access.section0',
	'autoLoadMoreConversation': 'advanced.section1',
	'autoLoadMoreReplies': 'advanced.section1',
	'chat.sendOnEnter': 'privacy.section2',
	'chat.showSenderName': 'privacy.section2',
	'collapseDefault': 'timeline.section1',
	'collapseLongNoteContent': 'timeline.section1',
	'collapseRenotes': 'timeline.section1',
	'collapseReplies': 'timeline.section1',
	'confirmOnReact': 'timeline.section4',
	'confirmWhenRevealingSensitiveMedia': 'timeline.section5',
	'contextMenu': 'access.section1',
	'defaultFollowWithReplies': 'advanced.section1',
	'defaultNoteLocalOnly': 'post.section1',
	'defaultNoteVisibility': 'post.section1',
	'disableNyaize': 'advanced.section0',
	'disableShowingAnimatedImages': 'access.section0',
	'emojiStyle': 'appearance.section5',
	'enableAbsoluteTime': 'timeline.section2',
	'enableHighQualityImagePlaceholders': 'access.section2',
	'enableHorizontalSwipe': 'access.section1',
	'enableInfiniteScroll': 'timeline.section0',
	'enableMarkByDate': 'timeline.section2',
	'enablePullToRefresh': 'access.section1',
	'enableQuickAddMfmFunction': 'post.section0',
	'enableSeasonalScreenEffect': 'appearance.section5',
	'filesGridLayoutInUserPage': 'timeline.section5',
	'fontSize': 'appearance.section1',
	'forceCollapseAllRenotes': 'timeline.section1',
	'forceRenoteVisibilitySelection': 'post.section1',
	'forceShowAds': 'advanced.section0',
	'hemisphere': 'advanced.section0',
	'hideAvatarsInNote': 'timeline.section2',
	'highlightSensitiveMedia': 'timeline.section5',
	'imageNewTab': 'timeline.section5',
	'infoButtonForNoteActionsEnabled': 'timeline.section3',
	'instanceTicker': 'timeline.section2',
	'keepCw': 'post.section0',
	'keepScreenOn': 'access.section1',
	'limitWidthOfReaction': 'timeline.section4',
	'loadRawImages': 'timeline.section5',
	'ltlEmojiVoteEnabled': 'timeline.section0',
	'makeEveryTextElementsSelectable': 'access.section1',
	'mediaListWithOneImageAppearance': 'timeline.section5',
	'menuStyle': 'access.section1',
	'newNoteReceivedNotificationBehavior': 'notify.section1',
	'emojiAdditionNotice': 'notify.section1',
	'hourlyTimeNotice': 'notify.section1',
	'notificationPosition': 'notify.section1',
	'notificationStackAxis': 'notify.section1',
	'nsfw': 'timeline.section5',
	'nsfwOpenBehavior': 'timeline.section5',
	'numberOfPageCache': 'advanced.section1',
	'pollingInterval': 'advanced.section0',
	'reactionsDisplaySize': 'timeline.section4',
	'rememberNoteVisibility': 'post.section1',
	'removeModalBgColorForBlur': 'access.section2',
	'renoteQuoteButtonSeparation': 'timeline.section3',
	'renoteVisibilitySelection': 'timeline.section3',
	'requireRefreshBehavior': 'advanced.section1',
	'selectReaction': 'timeline.section3',
	'serverDisconnectedBehavior': 'advanced.section1',
	'setFederationAvatarShape': 'appearance.section5',
	'showAvailableReactionsFirstInNote': 'timeline.section4',
	'showAvatarDecorations': 'appearance.section5',
	'showClipButtonInNoteFooter': 'timeline.section3',
	'showDoReactionButtonInNoteFooter': 'timeline.section3',
	'showFixedPostForm': 'post.section0',
	'showFixedPostFormInChannel': 'post.section0',
	'showFixedPostFormInReplies': 'post.section0',
	'showGapBetweenNotesInTimeline': 'timeline.section0',
	'showGapBodyOfTheNote': 'timeline.section2',
	'showMoreButtonInNoteFooter': 'timeline.section3',
	'showNoAltTextWarning': 'timeline.section5',
	'showNoteActionsOnlyHover': 'timeline.section3',
	'showPageTabBarBottom': 'access.section1',
	'showPreview': 'post.section0',
	'showProfilePreview': 'timeline.section3',
	'showQuoteButtonInNoteFooter': 'timeline.section3',
	'showReactionsCount': 'timeline.section4',
	'showRenoteButtonInNoteFooter': 'timeline.section3',
	'showReplyButtonInNoteFooter': 'timeline.section3',
	'showReplyInNotification': 'notify.section1',
	'showReplyTargetNote': 'timeline.section2',
	'showReplyTargetNoteInSemiTransparent': 'timeline.section2',
	'showSubNoteFooterButton': 'timeline.section3',
	'showTitlebar': 'appearance.section2',
	'showUnreadNotificationsCount': 'notify.section1',
	'showingAnimatedImages': 'access.section0',
	'smoothTransitionAnimations': 'access.section0',
	'squareAvatars': 'appearance.section5',
	'useBlurEffect': 'access.section2',
	'useBlurEffectForModal': 'access.section2',
	'useGroupedNotifications': 'notify.section1',
	'useNativeUiForVideoAudioPlayer': 'access.section1',
	'useReactionPickerForContextMenu': 'timeline.section4',
	'useStickyIcons': 'access.section2',
	'welcomeBackToast': 'advanced.section1',
	'hataskeyUi3TimelineBackground': 'appearance.section4',
	'hataskeyUi3SideMenuBackground': 'appearance.section4',
	'hataskeyUi3RightPaneBackground': 'appearance.section4',
	'hataskeyUi3GlassDensity': 'appearance.section4',
	'hataskeyUi3ComposerShortcut1': 'post.section2',
	'hataskeyUi3ComposerShortcut2': 'post.section2',
	'hataskeyUi3ComposerEmojiPosition': 'post.section2',
	'hataskeyUi3ComposerPosition': 'post.section0',
	'postFormVisibilityBorder.enabled': 'post.section3',
	'postFormVisibilityBorder.width': 'post.section3',
	'postFormVisibilityBorder.color.public': 'post.section3',
	'postFormVisibilityBorder.color.home': 'post.section3',
	'postFormVisibilityBorder.color.followers': 'post.section3',
	'postFormVisibilityBorder.color.specified': 'post.section3',
	'hataskeyUi3RssEnabled': 'appearance.section2',
	'hataskeyUi3RssFeeds': 'appearance.section2',
	'hataskeyUi3RssAutoSwitch': 'appearance.section2',
	'hataskeyUi3RssReadSeconds': 'appearance.section2',
	'hataskeyUi3RssReadMode': 'appearance.section2',
	'lang': 'advanced.section0',
	'overridedDeviceKind': 'appearance.section2',
	'realtimeMode': 'advanced.section0',
	'useBoldFont': 'appearance.section1',
	'useSystemFont': 'appearance.section1',
	'externalNavigationWarning': 'mute.section2',
	'trustedDomains': 'mute.section2',
	'dataSaver.media': 'access.section3',
	'dataSaver.avatar': 'access.section3',
	'dataSaver.disableUrlPreview': 'access.section3',
	'dataSaver.urlPreviewThumbnail': 'access.section3',
	'dataSaver.code': 'access.section3',
	'searchEngine': 'advanced.section0',
	'searchEngineUrl': 'advanced.section0',
	'searchEngineUrlQuery': 'advanced.section0',
	'pinnedUserLists': 'timeline.section0',
	'testNotification': 'notify.section1',
	'additionalUnicodeEmojiIndexes': 'post.section4',
} as const satisfies Readonly<Record<SettingsInventoryKey, SettingsBentoSectionId>>;

export function bentoPreferenceCategory(key: SettingsInventoryKey): SettingsBentoCategoryId {
	return bentoPreferencePlacements[key].split('.')[0] as SettingsBentoCategoryId;
}

export function assertBentoPreferenceInventory(placements: Readonly<Record<string, string>>): void {
	const expected = new Set<string>(settingsInventoryKeys);
	const sections = new Set<string>(bentoSectionIds);
	for (const [key, section] of Object.entries(placements)) {
		if (!expected.has(key)) throw new Error(`Unknown settings preference: ${key}`);
		if (!sections.has(section)) throw new Error(`Unknown settings section: ${key} -> ${section}`);
	}
	for (const key of expected) if (!(key in placements)) throw new Error(`Missing settings preference: ${key}`);
}

assertBentoPreferenceInventory(bentoPreferencePlacements);

const destinationCategories: Readonly<Record<string, SettingsBentoCategoryId>> = {
	'hataskey-ui': 'appearance',
	'hataskey-ui-s': 'appearance',
	'hata-hatask': 'apps',
	'hata-hatady': 'apps',
	'hata-hatafeed': 'apps',
	'hata-earthquake': 'apps',
	'hata-mascot': 'apps',
	'hata-settings-transfer': 'data',
	'display-theme': 'appearance',
	'hataskey-ui-font': 'appearance',
	'display-css': 'advanced',
	'display-emoji': 'post',
	'display-general': 'appearance',
	'display-preferences': 'appearance',
	'timeline-note-display': 'timeline',
	'timeline-post-form': 'post',
	'timeline-group': 'timeline',
	'notifications-page': 'notify',
	'notifications-sounds': 'notify',
	'notifications-preferences': 'notify',
	'timeline-chat': 'privacy',
	'account-profile': 'profile',
	'account-avatar': 'profile',
	'account-stats': 'security',
	'account-privacy': 'privacy',
	'account-email': 'security',
	'account-security': 'security',
	'account-switch': 'security',
	'account-migration': 'security',
	'account-mute': 'mute',
	'timeline-hidden-reactions': 'timeline',
	'account-drive': 'drive',
	'account-drive-cleaner': 'drive',
	'account-export': 'data',
	'account-profiles': 'data',
	'account-external': 'data',
	'account-concrnt': 'data',
	'account-connect': 'data',
	'account-apps': 'data',
	'account-plugins': 'advanced',
	'timeline-display': 'timeline',
	'misskey-navbar': 'appearance',
	'misskey-statusbar': 'appearance',
	'misskey-deck': 'timeline',
	'misskey-general': 'advanced',
	'misskey-accessibility': 'access',
	'misskey-performance': 'access',
	'misskey-data-saver': 'access',
	'misskey-other': 'advanced',
	'cherrypick-settings': 'appearance',
	'cherrypick-display': 'timeline',
	'cherrypick-search': 'advanced',
	'cherrypick-external-navigation': 'mute',
};

export function bentoCategoryForDestination(id: string): SettingsBentoCategoryId | undefined {
	return destinationCategories[id];
}
