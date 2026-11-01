/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Explicit inventory for the redesigned preferences surface. The old
 * preferences page is deliberately not imported: the gateway keeps it as a
 * legacy fallback, while this module owns the new destination/index contract.
 */
import { destinationForId, settingsDestinationSections } from './settings-destinations.js';
import type { SettingsDestination } from './settings-destinations.js';
import { i18n } from '@/i18n.js';
import { HK3_COMPOSER_EMOJI_POSITIONS, HK3_COMPOSER_SHORTCUT_OPTIONS } from '@/components/hataskey3/hk3-composer-tools.js';

const preferencesRoute = '/settings/preferences';
export const uiSDisplaySizeSearchId = 'settings.control.device.hataskey-ui-s-display-size';

function manifestDestination(id: string): SettingsDestination {
	const item = destinationForId(id);
	if (item == null || item.route !== preferencesRoute) throw new Error(`[settings-preferences] missing manifest destination: ${id}`);
	return item;
}

/** Manifest ids only; no preferences-* aliases are allowed here. */
export const preferenceDestinationIds = [
	'hataskey-ui-s', 'display-general', 'display-preferences', 'timeline-note-display', 'timeline-post-form', 'timeline-group',
	'notifications-preferences', 'timeline-chat', 'cherrypick-display', 'cherrypick-search', 'misskey-general',
	'misskey-accessibility', 'misskey-performance', 'misskey-data-saver', 'cherrypick-external-navigation',
	'misskey-other',
].map(id => manifestDestination(id).id) as readonly string[];
export type PreferenceDestinationId = typeof preferenceDestinationIds[number];
export type PreferenceControlKind = 'switch' | 'select' | 'range' | 'radios' | 'reaction' | 'color';

/** Legacy MkPreferenceContainer keys plus controls owned by the new settings. */
export const preferenceContainerKeys = [
	'advancedMfm', 'allMediaNoteCollapse', 'alwaysConfirmFollow', 'alwaysShowCw', 'animatedMfm', 'animation',
	'autoLoadMoreConversation', 'autoLoadMoreReplies', 'chat.sendOnEnter', 'chat.showSenderName',
	'collapseDefault', 'collapseLongNoteContent', 'collapseRenotes', 'collapseReplies', 'confirmOnReact',
	'confirmWhenRevealingSensitiveMedia', 'contextMenu', 'defaultFollowWithReplies', 'defaultNoteLocalOnly',
	'defaultNoteVisibility', 'disableNyaize', 'disableShowingAnimatedImages', 'emojiStyle', 'enableAbsoluteTime',
	'enableHighQualityImagePlaceholders', 'enableHorizontalSwipe', 'enableInfiniteScroll', 'enableMarkByDate',
	'enablePullToRefresh', 'enableQuickAddMfmFunction', 'enableSeasonalScreenEffect', 'filesGridLayoutInUserPage',
	'fontSize', 'forceCollapseAllRenotes', 'forceRenoteVisibilitySelection', 'forceShowAds', 'hemisphere',
	'hideAvatarsInNote', 'highlightSensitiveMedia', 'imageNewTab', 'infoButtonForNoteActionsEnabled', 'instanceTicker',
	'keepCw', 'keepScreenOn', 'limitWidthOfReaction', 'loadRawImages', 'ltlEmojiVoteEnabled', 'makeEveryTextElementsSelectable',
	'mediaListWithOneImageAppearance', 'menuStyle', 'newNoteReceivedNotificationBehavior', 'emojiAdditionNotice', 'hourlyTimeNotice', 'notificationPosition',
	'notificationStackAxis', 'nsfw', 'nsfwOpenBehavior', 'numberOfPageCache', 'pollingInterval', 'reactionsDisplaySize',
	'rememberNoteVisibility', 'removeModalBgColorForBlur', 'renoteQuoteButtonSeparation', 'renoteVisibilitySelection',
	'requireRefreshBehavior', 'selectReaction', 'serverDisconnectedBehavior', 'setFederationAvatarShape',
	'showAvailableReactionsFirstInNote', 'showAvatarDecorations', 'showClipButtonInNoteFooter',
	'showDoReactionButtonInNoteFooter', 'showFixedPostForm', 'showFixedPostFormInChannel', 'showFixedPostFormInReplies',
	'showGapBetweenNotesInTimeline', 'showGapBodyOfTheNote', 'showMoreButtonInNoteFooter', 'showNoAltTextWarning',
	'showNoteActionsOnlyHover', 'showPageTabBarBottom', 'showPreview', 'showProfilePreview', 'showQuoteButtonInNoteFooter',
	'showReactionsCount', 'showRenoteButtonInNoteFooter', 'showReplyButtonInNoteFooter', 'showReplyInNotification',
	'showReplyTargetNote', 'showReplyTargetNoteInSemiTransparent', 'showSubNoteFooterButton', 'showTitlebar',
	'showUnreadNotificationsCount', 'showingAnimatedImages', 'smoothTransitionAnimations', 'squareAvatars', 'useBlurEffect',
	'useBlurEffectForModal', 'useGroupedNotifications', 'useNativeUiForVideoAudioPlayer', 'useReactionPickerForContextMenu',
	'useStickyIcons', 'welcomeBackToast',
	'hataskeyUi3TimelineBackground',
	'hataskeyUi3SideMenuBackground', 'hataskeyUi3RightPaneBackground',
	'hataskeyUi3GlassDensity',
	'hataskeyUi3ComposerShortcut1', 'hataskeyUi3ComposerShortcut2', 'hataskeyUi3ComposerEmojiPosition', 'hataskeyUi3ComposerPosition',
	'postFormVisibilityBorder.enabled', 'postFormVisibilityBorder.width', 'postFormVisibilityBorder.color.public', 'postFormVisibilityBorder.color.home', 'postFormVisibilityBorder.color.followers', 'postFormVisibilityBorder.color.specified',
	'hataskeyUi3RssEnabled', 'hataskeyUi3RssFeeds', 'hataskeyUi3RssAutoSwitch', 'hataskeyUi3RssReadSeconds', 'hataskeyUi3RssReadMode',
] as const;
export type PreferenceContainerKey = typeof preferenceContainerKeys[number];

/** All old script/template settings which were outside MkPreferenceContainer. */
export const preferenceAuxiliaryControls = [
	{ key: 'lang', destinationId: 'display-general', kind: 'select', label: i18n.ts.uiLanguage, caption: [i18n.ts.i18nInfo] },
	{ key: 'overridedDeviceKind', destinationId: 'display-general', kind: 'radios', label: i18n.ts.overridedDeviceKind, caption: [] },
	{ key: 'realtimeMode', destinationId: 'display-general', kind: 'switch', label: i18n.ts.realtimeMode, caption: [i18n.ts._settings.realtimeMode_description] },
	{ key: 'useBoldFont', destinationId: 'display-preferences', kind: 'switch', label: i18n.ts.useBoldFont, caption: [] },
	{ key: 'useSystemFont', destinationId: 'display-preferences', kind: 'switch', label: i18n.ts.useSystemFont, caption: [] },
	{ key: 'externalNavigationWarning', destinationId: 'cherrypick-external-navigation', kind: 'switch', label: i18n.ts._externalNavigationWarning.enableExternalNavigationWarning, caption: [], cherry: true },
	{ key: 'trustedDomains', destinationId: 'cherrypick-external-navigation', kind: 'text', label: i18n.ts._externalNavigationWarning.trustedDomainList, caption: [i18n.ts._externalNavigationWarning.trustedDomainListDescription, i18n.ts._externalNavigationWarning.trustedDomainListDescription2], cherry: true },
	{ key: 'dataSaver.media', destinationId: 'misskey-data-saver', kind: 'switch', label: i18n.ts._dataSaver._media.title, caption: [i18n.ts._dataSaver._media.description] },
	{ key: 'dataSaver.avatar', destinationId: 'misskey-data-saver', kind: 'switch', label: i18n.ts._dataSaver._avatar.title, caption: [i18n.ts._dataSaver._avatar.description] },
	{ key: 'dataSaver.disableUrlPreview', destinationId: 'misskey-data-saver', kind: 'switch', label: i18n.ts._dataSaver._disableUrlPreview.title, caption: [i18n.ts._dataSaver._disableUrlPreview.description] },
	{ key: 'dataSaver.urlPreviewThumbnail', destinationId: 'misskey-data-saver', kind: 'switch', label: i18n.ts._dataSaver._urlPreviewThumbnail.title, caption: [i18n.ts._dataSaver._urlPreviewThumbnail.description] },
	{ key: 'dataSaver.code', destinationId: 'misskey-data-saver', kind: 'switch', label: i18n.ts._dataSaver._code.title, caption: [i18n.ts._dataSaver._code.description] },
	{ key: 'searchEngine', destinationId: 'cherrypick-search', kind: 'select', label: i18n.ts._searchSite.title, caption: [i18n.ts._searchSite.description], cherry: true },
	{ key: 'searchEngineUrl', destinationId: 'cherrypick-search', kind: 'text', label: i18n.ts._searchSite.otherSearchEngine, caption: [i18n.ts._searchSite.otherDescription], cherry: true },
	{ key: 'searchEngineUrlQuery', destinationId: 'cherrypick-search', kind: 'text', label: i18n.ts._searchSite.query, caption: [i18n.ts._searchSite.queryDescription], cherry: true },
	{ key: 'pinnedUserLists', destinationId: 'timeline-note-display', kind: 'action', label: i18n.ts.pinnedList, caption: [] },
	{ key: 'testNotification', destinationId: 'notifications-preferences', kind: 'action', label: i18n.ts._notification.checkNotificationBehavior, caption: [] },
	{ key: 'additionalUnicodeEmojiIndexes', destinationId: 'misskey-other', kind: 'action', label: i18n.ts.additionalEmojiDictionary, caption: [] },
] as const;
export type PreferenceAuxiliaryKey = typeof preferenceAuxiliaryControls[number]['key'];
export type SettingsInventoryKey = PreferenceContainerKey | PreferenceAuxiliaryKey;

type Placement = { destinationId: string };
/** Exactly one manifest destination for every legacy container key. */
const placements: Readonly<Record<PreferenceContainerKey, Placement>> = {
	advancedMfm: { destinationId: 'display-general' }, allMediaNoteCollapse: { destinationId: 'cherrypick-display' },
	alwaysConfirmFollow: { destinationId: 'misskey-general' }, alwaysShowCw: { destinationId: 'cherrypick-display' },
	animatedMfm: { destinationId: 'misskey-accessibility' }, animation: { destinationId: 'misskey-accessibility' },
	autoLoadMoreConversation: { destinationId: 'cherrypick-display' }, autoLoadMoreReplies: { destinationId: 'cherrypick-display' },
	'chat.sendOnEnter': { destinationId: 'timeline-chat' }, 'chat.showSenderName': { destinationId: 'timeline-chat' },
	collapseDefault: { destinationId: 'cherrypick-display' }, collapseLongNoteContent: { destinationId: 'cherrypick-display' },
	collapseRenotes: { destinationId: 'timeline-note-display' }, collapseReplies: { destinationId: 'cherrypick-display' },
	confirmOnReact: { destinationId: 'timeline-note-display' }, confirmWhenRevealingSensitiveMedia: { destinationId: 'misskey-general' },
	contextMenu: { destinationId: 'misskey-accessibility' }, defaultFollowWithReplies: { destinationId: 'misskey-other' },
	defaultNoteLocalOnly: { destinationId: 'timeline-post-form' }, defaultNoteVisibility: { destinationId: 'timeline-post-form' },
	disableNyaize: { destinationId: 'cherrypick-display' }, disableShowingAnimatedImages: { destinationId: 'cherrypick-display' },
	emojiStyle: { destinationId: 'display-general' }, enableAbsoluteTime: { destinationId: 'cherrypick-display' },
	enableHighQualityImagePlaceholders: { destinationId: 'misskey-performance' }, enableHorizontalSwipe: { destinationId: 'misskey-accessibility' },
	enableInfiniteScroll: { destinationId: 'timeline-group' }, enableMarkByDate: { destinationId: 'cherrypick-display' },
	enablePullToRefresh: { destinationId: 'misskey-accessibility' }, enableQuickAddMfmFunction: { destinationId: 'timeline-post-form' },
	enableSeasonalScreenEffect: { destinationId: 'display-preferences' }, filesGridLayoutInUserPage: { destinationId: 'cherrypick-display' },
	fontSize: { destinationId: 'cherrypick-display' }, forceCollapseAllRenotes: { destinationId: 'cherrypick-display' },
	forceRenoteVisibilitySelection: { destinationId: 'cherrypick-display' }, forceShowAds: { destinationId: 'misskey-other' },
	hemisphere: { destinationId: 'misskey-other' }, hideAvatarsInNote: { destinationId: 'cherrypick-display' },
	highlightSensitiveMedia: { destinationId: 'display-preferences' }, imageNewTab: { destinationId: 'misskey-other' },
	infoButtonForNoteActionsEnabled: { destinationId: 'cherrypick-display' }, instanceTicker: { destinationId: 'display-preferences' },
	hataskeyUi3TimelineBackground: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3SideMenuBackground: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3RightPaneBackground: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3GlassDensity: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3ComposerShortcut1: { destinationId: 'hataskey-ui-s' }, hataskeyUi3ComposerShortcut2: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3ComposerEmojiPosition: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3ComposerPosition: { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.enabled': { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.width': { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.color.public': { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.color.home': { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.color.followers': { destinationId: 'hataskey-ui-s' },
	'postFormVisibilityBorder.color.specified': { destinationId: 'hataskey-ui-s' },
	hataskeyUi3RssEnabled: { destinationId: 'hataskey-ui-s' }, hataskeyUi3RssFeeds: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3RssAutoSwitch: { destinationId: 'hataskey-ui-s' }, hataskeyUi3RssReadSeconds: { destinationId: 'hataskey-ui-s' },
	hataskeyUi3RssReadMode: { destinationId: 'hataskey-ui-s' },
	keepCw: { destinationId: 'timeline-post-form' }, keepScreenOn: { destinationId: 'misskey-accessibility' },
	limitWidthOfReaction: { destinationId: 'timeline-note-display' }, loadRawImages: { destinationId: 'timeline-note-display' },
	ltlEmojiVoteEnabled: { destinationId: 'timeline-group' },
	makeEveryTextElementsSelectable: { destinationId: 'misskey-accessibility' }, mediaListWithOneImageAppearance: { destinationId: 'display-preferences' },
	menuStyle: { destinationId: 'misskey-accessibility' }, newNoteReceivedNotificationBehavior: { destinationId: 'cherrypick-display' },
	notificationPosition: { destinationId: 'notifications-preferences' }, notificationStackAxis: { destinationId: 'notifications-preferences' },
	emojiAdditionNotice: { destinationId: 'notifications-preferences' }, hourlyTimeNotice: { destinationId: 'notifications-preferences' },
	nsfw: { destinationId: 'display-preferences' }, nsfwOpenBehavior: { destinationId: 'cherrypick-display' },
	numberOfPageCache: { destinationId: 'misskey-other' }, pollingInterval: { destinationId: 'display-general' },
	reactionsDisplaySize: { destinationId: 'timeline-note-display' }, rememberNoteVisibility: { destinationId: 'timeline-post-form' },
	removeModalBgColorForBlur: { destinationId: 'cherrypick-display' }, renoteQuoteButtonSeparation: { destinationId: 'cherrypick-display' },
	renoteVisibilitySelection: { destinationId: 'cherrypick-display' }, requireRefreshBehavior: { destinationId: 'cherrypick-display' },
	selectReaction: { destinationId: 'cherrypick-display' }, serverDisconnectedBehavior: { destinationId: 'cherrypick-display' },
	setFederationAvatarShape: { destinationId: 'cherrypick-display' }, showAvailableReactionsFirstInNote: { destinationId: 'timeline-note-display' },
	showAvatarDecorations: { destinationId: 'display-preferences' }, showClipButtonInNoteFooter: { destinationId: 'timeline-note-display' },
	showDoReactionButtonInNoteFooter: { destinationId: 'cherrypick-display' }, showFixedPostForm: { destinationId: 'timeline-post-form' },
	showFixedPostFormInChannel: { destinationId: 'timeline-post-form' }, showFixedPostFormInReplies: { destinationId: 'cherrypick-display' },
	showGapBetweenNotesInTimeline: { destinationId: 'timeline-note-display' }, showGapBodyOfTheNote: { destinationId: 'cherrypick-display' },
	showMoreButtonInNoteFooter: { destinationId: 'cherrypick-display' }, showNoAltTextWarning: { destinationId: 'cherrypick-display' },
	showNoteActionsOnlyHover: { destinationId: 'timeline-note-display' }, showPageTabBarBottom: { destinationId: 'misskey-accessibility' },
	showPreview: { destinationId: 'timeline-post-form' }, showProfilePreview: { destinationId: 'cherrypick-display' },
	showQuoteButtonInNoteFooter: { destinationId: 'cherrypick-display' }, showReactionsCount: { destinationId: 'timeline-note-display' },
	showRenoteButtonInNoteFooter: { destinationId: 'cherrypick-display' }, showReplyButtonInNoteFooter: { destinationId: 'cherrypick-display' },
	showReplyInNotification: { destinationId: 'cherrypick-display' }, showReplyTargetNote: { destinationId: 'cherrypick-display' },
	showReplyTargetNoteInSemiTransparent: { destinationId: 'cherrypick-display' }, showSubNoteFooterButton: { destinationId: 'cherrypick-display' },
	showTitlebar: { destinationId: 'display-general' }, showUnreadNotificationsCount: { destinationId: 'cherrypick-display' },
	showingAnimatedImages: { destinationId: 'cherrypick-display' }, smoothTransitionAnimations: { destinationId: 'cherrypick-display' },
	squareAvatars: { destinationId: 'display-preferences' }, useBlurEffect: { destinationId: 'misskey-performance' },
	useBlurEffectForModal: { destinationId: 'misskey-performance' }, useGroupedNotifications: { destinationId: 'notifications-preferences' },
	useNativeUiForVideoAudioPlayer: { destinationId: 'misskey-accessibility' }, useReactionPickerForContextMenu: { destinationId: 'timeline-note-display' },
	useStickyIcons: { destinationId: 'misskey-performance' }, welcomeBackToast: { destinationId: 'cherrypick-display' },
};

const rangeSpec: Readonly<Partial<Record<PreferenceContainerKey, { min: number; max: number }>>> = {
	'postFormVisibilityBorder.width': { min: 1, max: 12 },
	pollingInterval: { min: 1, max: 3 }, fontSize: { min: 1, max: 19 }, numberOfPageCache: { min: 1, max: 10 },
};
const radioKeys = new Set<PreferenceContainerKey>(['emojiStyle', 'notificationPosition', 'notificationStackAxis', 'reactionsDisplaySize', 'mediaListWithOneImageAppearance', 'hemisphere', 'hataskeyUi3GlassDensity', 'hataskeyUi3ComposerEmojiPosition', 'hataskeyUi3ComposerPosition']);
const selectKeys = new Set<PreferenceContainerKey>(['forceRenoteVisibilitySelection', 'defaultNoteVisibility', 'instanceTicker', 'menuStyle', 'contextMenu', 'newNoteReceivedNotificationBehavior', 'nsfw', 'nsfwOpenBehavior', 'requireRefreshBehavior', 'serverDisconnectedBehavior', 'showingAnimatedImages', 'hataskeyUi3ComposerShortcut1', 'hataskeyUi3ComposerShortcut2', 'hataskeyUi3RssReadSeconds', 'hataskeyUi3RssReadMode']);
const optionValues: Readonly<Partial<Record<PreferenceContainerKey, readonly string[]>>> = {
	emojiStyle: ['native', 'fluentEmoji', 'twemoji'], forceRenoteVisibilitySelection: ['none', 'public', 'home', 'followers'],
	defaultNoteVisibility: ['public', 'home', 'followers', 'specified'], instanceTicker: ['none', 'remote', 'always'],
	menuStyle: ['auto', 'popup', 'drawer'], contextMenu: ['app', 'appWithShift', 'native'],
	newNoteReceivedNotificationBehavior: ['default', 'count', 'none'], notificationPosition: ['leftTop', 'rightTop', 'leftBottom', 'rightBottom'],
	notificationStackAxis: ['vertical', 'horizontal'], nsfw: ['respect', 'ignore', 'force'], nsfwOpenBehavior: ['click', 'doubleClick'],
	requireRefreshBehavior: ['dialog', 'quiet'], serverDisconnectedBehavior: ['reload', 'dialog', 'quiet', 'none'],
	showingAnimatedImages: ['always', 'interaction', 'inactive'], reactionsDisplaySize: ['small', 'medium', 'large'],
	mediaListWithOneImageAppearance: ['expand', '16_9', '1_1', '2_3'], hemisphere: ['N', 'S'],
	hataskeyUi3ComposerShortcut1: HK3_COMPOSER_SHORTCUT_OPTIONS, hataskeyUi3ComposerShortcut2: HK3_COMPOSER_SHORTCUT_OPTIONS,
	hataskeyUi3ComposerEmojiPosition: HK3_COMPOSER_EMOJI_POSITIONS,
	hataskeyUi3ComposerPosition: ['top', 'bottom'],
	hataskeyUi3GlassDensity: ['light', 'dense'],
	hataskeyUi3RssReadSeconds: ['6', '10', '15', '30'],
	hataskeyUi3RssReadMode: ['full', 'summary'],
};
const cherryKeys = new Set<PreferenceContainerKey>([
	'fontSize', 'setFederationAvatarShape', 'showUnreadNotificationsCount', 'filesGridLayoutInUserPage', 'showFixedPostFormInReplies',
	'forceCollapseAllRenotes', 'collapseReplies', 'collapseLongNoteContent', 'collapseDefault', 'allMediaNoteCollapse', 'hideAvatarsInNote',
	'enableAbsoluteTime', 'enableMarkByDate', 'showReplyTargetNote', 'showReplyTargetNoteInSemiTransparent', 'showGapBodyOfTheNote',
	'showSubNoteFooterButton', 'infoButtonForNoteActionsEnabled', 'renoteQuoteButtonSeparation', 'renoteVisibilitySelection',
	'forceRenoteVisibilitySelection', 'showNoAltTextWarning', 'alwaysShowCw', 'nsfwOpenBehavior', 'showProfilePreview', 'showReplyInNotification',
	'disableShowingAnimatedImages', 'smoothTransitionAnimations', 'removeModalBgColorForBlur', 'autoLoadMoreReplies', 'autoLoadMoreConversation',
	'welcomeBackToast', 'disableNyaize', 'serverDisconnectedBehavior', 'requireRefreshBehavior', 'newNoteReceivedNotificationBehavior',
]);

const labelValues: Readonly<Record<PreferenceContainerKey, string>> = {
	advancedMfm: i18n.ts.enableAdvancedMfm,
	allMediaNoteCollapse: i18n.ts.allMediaNoteCollapse,
	alwaysConfirmFollow: i18n.ts.alwaysConfirmFollow,
	alwaysShowCw: i18n.ts.alwaysShowCw,
	animatedMfm: i18n.ts.enableAnimatedMfm,
	animation: i18n.ts.reduceUiAnimation,
	autoLoadMoreConversation: i18n.ts.autoLoadMoreConversation,
	autoLoadMoreReplies: i18n.ts.autoLoadMoreReplies,
	'chat.sendOnEnter': i18n.ts._settings._chat.sendOnEnter,
	'chat.showSenderName': i18n.ts._settings._chat.showSenderName,
	collapseDefault: i18n.ts.collapseDefault,
	collapseLongNoteContent: i18n.ts.collapseLongNoteContent,
	collapseRenotes: i18n.ts.collapseRenotes,
	collapseReplies: i18n.ts.collapseReplies,
	confirmOnReact: i18n.ts.confirmOnReact,
	confirmWhenRevealingSensitiveMedia: i18n.ts.confirmWhenRevealingSensitiveMedia,
	contextMenu: i18n.ts._contextMenu.title,
	defaultFollowWithReplies: i18n.ts.withRepliesByDefaultForNewlyFollowed,
	defaultNoteLocalOnly: i18n.ts._visibility.disableFederation,
	defaultNoteVisibility: i18n.ts.defaultNoteVisibility,
	disableNyaize: i18n.ts.noNyaization,
	disableShowingAnimatedImages: i18n.ts.disableShowingAnimatedImages,
	emojiStyle: i18n.ts.emojiStyle,
	enableAbsoluteTime: i18n.ts.enableAbsoluteTime,
	enableHighQualityImagePlaceholders: i18n.ts._settings.enableHighQualityImagePlaceholders,
	enableHorizontalSwipe: i18n.ts.enableHorizontalSwipe,
	enableInfiniteScroll: i18n.ts.enableInfiniteScroll,
	enableMarkByDate: i18n.ts.enableMarkByDate,
	enablePullToRefresh: i18n.ts._settings.enablePullToRefresh,
	enableQuickAddMfmFunction: i18n.ts.enableQuickAddMfmFunction,
	enableSeasonalScreenEffect: i18n.ts.seasonalScreenEffect,
	filesGridLayoutInUserPage: i18n.ts.filesGridLayoutInUserPage,
	fontSize: i18n.ts.fontSize,
	forceCollapseAllRenotes: i18n.ts.forceCollapseAllRenotes,
	forceRenoteVisibilitySelection: i18n.ts.forceRenoteVisibilitySelector,
	forceShowAds: i18n.ts.forceShowAds,
	hemisphere: i18n.ts.hemisphere,
	hideAvatarsInNote: i18n.ts.hideAvatarsInNote,
	highlightSensitiveMedia: i18n.ts.highlightSensitiveMedia,
	imageNewTab: i18n.ts.openImageInNewTab,
	infoButtonForNoteActionsEnabled: i18n.ts.infoButtonForNoteActions,
	instanceTicker: i18n.ts.instanceTicker,
	hataskeyUi3TimelineBackground: i18n.ts._hata._customSettings._general.ui3TimelineBackground,
	hataskeyUi3SideMenuBackground: i18n.ts._hata._customSettings._general.ui3SideMenuBackground,
	hataskeyUi3RightPaneBackground: i18n.ts._hata._customSettings._general.ui3RightPaneBackground,
	hataskeyUi3GlassDensity: i18n.ts._hata._customSettings._general.ui3GlassDensity,
	hataskeyUi3ComposerShortcut1: i18n.ts._hata._customSettings._general.ui3ComposerShortcut1,
	hataskeyUi3ComposerShortcut2: i18n.ts._hata._customSettings._general.ui3ComposerShortcut2,
	hataskeyUi3ComposerEmojiPosition: i18n.ts._hata._customSettings._general.ui3ComposerEmojiPosition,
	hataskeyUi3ComposerPosition: i18n.ts._hata._customSettings._general.ui3ComposerPosition,
	'postFormVisibilityBorder.enabled': i18n.ts._hata._customSettings._general.colorByVisibility,
	'postFormVisibilityBorder.width': i18n.ts._hata._customSettings._general.borderWidth,
	'postFormVisibilityBorder.color.public': i18n.ts._hata._customSettings._general.public,
	'postFormVisibilityBorder.color.home': i18n.ts._hata._customSettings._general.home,
	'postFormVisibilityBorder.color.followers': i18n.ts._hata._customSettings._general.followers,
	'postFormVisibilityBorder.color.specified': i18n.ts._hata._customSettings._general.direct,
	hataskeyUi3RssEnabled: i18n.ts._hata._hataskeyUi3._rss.enabled,
	hataskeyUi3RssFeeds: i18n.ts._hata._hataskeyUi3._rss.feeds,
	hataskeyUi3RssAutoSwitch: i18n.ts._hata._hataskeyUi3._rss.autoSwitch,
	hataskeyUi3RssReadSeconds: i18n.ts._hata._hataskeyUi3._rss.readSeconds,
	hataskeyUi3RssReadMode: i18n.ts._hata._hataskeyUi3._rss.readMode,
	keepCw: i18n.ts.keepCw,
	keepScreenOn: i18n.ts.keepScreenOn,
	limitWidthOfReaction: i18n.ts.limitWidthOfReaction,
	loadRawImages: i18n.ts.loadRawImages,
	ltlEmojiVoteEnabled: i18n.ts._hata._customSettings._general.showLtlEmojiVote,
	makeEveryTextElementsSelectable: i18n.ts._settings.makeEveryTextElementsSelectable,
	mediaListWithOneImageAppearance: i18n.ts.mediaListWithOneImageAppearance,
	menuStyle: i18n.ts.menuStyle,
	newNoteReceivedNotificationBehavior: i18n.ts.newNoteReceivedNotification,
	notificationPosition: i18n.ts._hata._notificationToast.position,
	emojiAdditionNotice: i18n.ts._hata._navbarNotice.emojiSetting,
	hourlyTimeNotice: i18n.ts._hata._navbarNotice.timeSetting,
	notificationStackAxis: i18n.ts._hata._notificationToast.stack,
	nsfw: i18n.ts.displayOfSensitiveMedia,
	nsfwOpenBehavior: i18n.ts.nsfwOpenBehavior,
	numberOfPageCache: i18n.ts.numberOfPageCache,
	pollingInterval: i18n.ts._settings.contentsUpdateFrequency,
	reactionsDisplaySize: i18n.ts.reactionsDisplaySize,
	rememberNoteVisibility: i18n.ts.rememberNoteVisibility,
	removeModalBgColorForBlur: i18n.ts.removeModalBgColorForBlur,
	renoteQuoteButtonSeparation: i18n.ts.renoteQuoteButtonSeparation,
	renoteVisibilitySelection: i18n.ts.showRenoteVisibilitySelector,
	requireRefreshBehavior: i18n.ts.requireRefresh,
	selectReaction: i18n.ts.selectReaction,
	serverDisconnectedBehavior: i18n.ts.whenServerDisconnected,
	setFederationAvatarShape: i18n.ts.setFederationAvatarShape,
	showAvailableReactionsFirstInNote: i18n.ts._settings.showAvailableReactionsFirstInNote,
	showAvatarDecorations: i18n.ts.showAvatarDecorations,
	showClipButtonInNoteFooter: i18n.ts.showClipButtonInNoteFooter,
	showDoReactionButtonInNoteFooter: i18n.ts.doReaction,
	showFixedPostForm: i18n.ts.showFixedPostForm,
	showFixedPostFormInChannel: i18n.ts.showFixedPostFormInChannel,
	showFixedPostFormInReplies: i18n.ts.showFixedPostFormInReplies,
	showGapBetweenNotesInTimeline: i18n.ts.showGapBetweenNotesInTimeline,
	showGapBodyOfTheNote: i18n.ts.showGapBodyOfTheNote,
	showMoreButtonInNoteFooter: i18n.ts.more,
	showNoAltTextWarning: i18n.ts.showNoAltWarning,
	showNoteActionsOnlyHover: i18n.ts.showNoteActionsOnlyHover,
	showPageTabBarBottom: i18n.ts._settings.showPageTabBarBottom,
	showPreview: i18n.ts.previewNoteText,
	showProfilePreview: i18n.ts.previewNoteProfile,
	showQuoteButtonInNoteFooter: i18n.ts.quote,
	showReactionsCount: i18n.ts.showReactionsCount,
	showRenoteButtonInNoteFooter: i18n.ts.renote,
	showReplyButtonInNoteFooter: i18n.ts.reply,
	showReplyInNotification: i18n.ts.showReplyInNotification,
	showReplyTargetNote: i18n.ts.showReplyTargetNote,
	showReplyTargetNoteInSemiTransparent: i18n.ts.showReplyTargetNoteInSemiTransparent,
	showSubNoteFooterButton: i18n.ts.showSubNoteFooterButton,
	showTitlebar: i18n.ts.showTitlebar,
	showUnreadNotificationsCount: i18n.ts.showUnreadNotificationsCount,
	showingAnimatedImages: i18n.ts.disableShowingAnimatedImages,
	smoothTransitionAnimations: i18n.ts._settings.smoothTransitionAnimations,
	squareAvatars: i18n.ts.squareAvatars,
	useBlurEffect: i18n.ts.useBlurEffect,
	useBlurEffectForModal: i18n.ts.useBlurEffectForModal,
	useGroupedNotifications: i18n.ts.useGroupedNotifications,
	useNativeUiForVideoAudioPlayer: i18n.ts.useNativeUIForVideoAudioPlayer,
	useReactionPickerForContextMenu: i18n.ts.useReactionPickerForContextMenu,
	useStickyIcons: i18n.ts._settings.useStickyIcons,
	welcomeBackToast: i18n.ts.welcomeBackToast,
};

const captionValues: Readonly<Partial<Record<PreferenceContainerKey, readonly string[]>>> = {
	'postFormVisibilityBorder.enabled': [i18n.ts._hata._customSettings._general.colorByVisibilityCaption],
	'postFormVisibilityBorder.width': [i18n.ts._hata._customSettings._general.postFormBorder],
	'postFormVisibilityBorder.color.public': [i18n.ts._hata._customSettings._general.postFormBorder],
	'postFormVisibilityBorder.color.home': [i18n.ts._hata._customSettings._general.postFormBorder],
	'postFormVisibilityBorder.color.followers': [i18n.ts._hata._customSettings._general.postFormBorder],
	'postFormVisibilityBorder.color.specified': [i18n.ts._hata._customSettings._general.postFormBorder],
	hataskeyUi3TimelineBackground: [i18n.ts._hata._customSettings._general.ui3TimelineBackgroundCaption],
	hataskeyUi3SideMenuBackground: [i18n.ts._hata._customSettings._general.ui3SideMenuBackgroundCaption],
	hataskeyUi3RightPaneBackground: [i18n.ts._hata._customSettings._general.ui3RightPaneBackgroundCaption],
	hataskeyUi3GlassDensity: [i18n.ts._hata._customSettings._general.ui3GlassDensityCaption],
	emojiAdditionNotice: [i18n.ts._hata._navbarNotice.emojiSettingDescription, i18n.ts._hata._navbarNotice.deliveryDescription],
	hourlyTimeNotice: [i18n.ts._hata._navbarNotice.timeSettingDescription, i18n.ts._hata._navbarNotice.deliveryDescription],
	ltlEmojiVoteEnabled: [i18n.ts._hata._customSettings._general.showLtlEmojiVoteDescription],
	hataskeyUi3ComposerShortcut1: [i18n.ts._hata._customSettings._general.ui3ComposerShortcutCaption],
	hataskeyUi3ComposerShortcut2: [i18n.ts._hata._customSettings._general.ui3ComposerShortcutCaption],
	hataskeyUi3ComposerPosition: [i18n.ts._hata._customSettings._general.ui3ComposerPositionCaption],
	hemisphere: [i18n.ts._hemisphere.caption],
	notificationPosition: [i18n.ts._hata._notificationToast.placement, i18n.ts._hata._notificationToast.otherUi],
	notificationStackAxis: [i18n.ts._hata._notificationToast.sequence, i18n.ts._hata._notificationToast.otherUi],
	pollingInterval: [i18n.ts._settings.contentsUpdateFrequency_description, i18n.ts._settings.contentsUpdateFrequency_description2],
	filesGridLayoutInUserPage: [i18n.ts.filesGridLayoutInUserPageDescription],
	showFixedPostFormInReplies: [i18n.ts.showFixedPostFormInRepliesDescription],
	forceCollapseAllRenotes: [i18n.ts.forceCollapseAllRenotesDescription],
	collapseRenotes: [i18n.ts.collapseRenotesDescription],
	collapseReplies: [i18n.ts.collapseRepliesDescription],
	showSubNoteFooterButton: [i18n.ts.showSubNoteFooterButtonDescription],
	infoButtonForNoteActionsEnabled: [i18n.ts.infoButtonForNoteActionsDescription],
	showNoAltTextWarning: [i18n.ts.showNoAltWarningDescription],
	disableShowingAnimatedImages: [i18n.ts.disableShowingAnimatedImagesDescription, i18n.ts.disableShowingAnimatedImages_caption],
	showingAnimatedImages: [i18n.ts.showingAnimatedImagesDescription],
	enablePullToRefresh: [i18n.ts._settings.enablePullToRefresh_description],
	makeEveryTextElementsSelectable: [i18n.ts._settings.makeEveryTextElementsSelectable_description],
	useBlurEffect: [i18n.ts.turnOffToImprovePerformance],
	useBlurEffectForModal: [i18n.ts.turnOffToImprovePerformance],
	enableHighQualityImagePlaceholders: [i18n.ts.turnOffToImprovePerformance],
	smoothTransitionAnimations: [i18n.ts.turnOffToImprovePerformance],
	useStickyIcons: [i18n.ts.turnOffToImprovePerformance],
	numberOfPageCache: [i18n.ts.numberOfPageCacheDescription],
};

export type PreferenceControl = {
	key: PreferenceContainerKey;
	source: 'legacy-container';
	destinationId: PreferenceDestinationId;
	canonicalSearchId: string;
	legacyDescriptorIds: readonly string[];
	cherry: boolean;
	kind: PreferenceControlKind;
	options?: readonly string[];
	min?: number;
	max?: number;
	label: string;
	caption: readonly string[];
};

function slugForKey(key: string): string { return key.replace(/[^A-Za-z0-9]+/gu, '-').replace(/^-|-$/gu, '').toLowerCase(); }

export function generatedPreferenceSearchId(key: string): string { return `settings.control.preference.${slugForKey(key)}`; }

function kindFor(key: PreferenceContainerKey): PreferenceControlKind {
	if (key.startsWith('postFormVisibilityBorder.color.')) return 'color';
	if (key === 'selectReaction') return 'reaction';
	if (rangeSpec[key] != null) return 'range';
	if (radioKeys.has(key)) return 'radios';
	if (selectKeys.has(key)) return 'select';
	return 'switch';
}

export const preferenceControls: readonly PreferenceControl[] = preferenceContainerKeys.map(key => ({
	key,
	source: 'legacy-container' as const,
	destinationId: placements[key].destinationId as PreferenceDestinationId,
	canonicalSearchId: generatedPreferenceSearchId(key),
	legacyDescriptorIds: [],
	cherry: cherryKeys.has(key),
	kind: kindFor(key),
	...(optionValues[key] != null ? { options: optionValues[key] } : {}),
	...(rangeSpec[key] != null ? rangeSpec[key] : {}),
	label: labelValues[key],
	caption: captionValues[key] ?? [],
}));
export const settingsInventoryKeys: readonly SettingsInventoryKey[] = Object.freeze([...preferenceContainerKeys, ...preferenceAuxiliaryControls.map(item => item.key)]);
export type SettingsInventoryItem = { key: string; destinationId: string };

/** Shared production matcher used by positive and negative tests. */
export function assertPreferenceInventory(controls: readonly SettingsInventoryItem[], auxiliary: readonly SettingsInventoryItem[] = preferenceAuxiliaryControls): void {
	const expected = new Set(settingsInventoryKeys);
	const seen = new Map<string, string>();
	for (const item of [...controls, ...auxiliary]) {
		if (!expected.has(item.key as SettingsInventoryKey)) throw new Error(`[settings-preferences] unknown inventory key: ${item.key}`);
		const previous = seen.get(item.key);
		if (previous != null) throw new Error(`[settings-preferences] duplicate inventory key: ${item.key} (${previous}, ${item.destinationId})`);
		seen.set(item.key, item.destinationId);
		const destination = destinationForId(item.destinationId);
		if (destination == null || destination.route !== preferencesRoute) throw new Error(`[settings-preferences] inventory has no preference destination: ${item.key} -> ${item.destinationId}`);
	}
	for (const key of expected) if (!seen.has(key)) throw new Error(`[settings-preferences] missing inventory key: ${key}`);
}
assertPreferenceInventory(preferenceControls, preferenceAuxiliaryControls);

const legacyPreferenceDestinationAliases: Readonly<Record<string, PreferenceDestinationId>> = {
	'misskey-external-navigation': 'cherrypick-external-navigation',
};
export function parsePreferenceDestination(id: string): SettingsDestination | null {
	const canonicalId = legacyPreferenceDestinationAliases[id] ?? id;
	const item = destinationForId(canonicalId);
	return item?.route === preferencesRoute ? item : null;
}
export function controlsForPreferenceDestination(id: string): readonly PreferenceControl[] { return preferenceControls.filter(control => control.destinationId === id); }
export function auxiliaryForPreferenceDestination(id: string) { return preferenceAuxiliaryControls.filter(control => control.destinationId === id); }
export function destinationForPreferenceKey(key: string): string | null {
	if (key === 'simpleUi.bottomNav' || key === 'hataskeyUi3BottomNav') return 'hataskey-ui-s';
	const destinations = [...new Set([...preferenceControls.filter(control => control.key === key).map(control => control.destinationId), ...preferenceAuxiliaryControls.filter(control => control.key === key).map(control => control.destinationId)])];
	return destinations.length === 1 ? destinations[0] : null;
}
export function legacyDescriptorIdsForPreferenceKey(key: string, descriptors: readonly { stableId: string; preferenceKeys: readonly string[] }[]): readonly string[] {
	return descriptors.filter(descriptor => descriptor.preferenceKeys.includes(key)).map(descriptor => descriptor.stableId);
}
export function canonicalSearchIdForPreferenceKey(key: string, _descriptors: readonly { stableId: string; preferenceKeys: readonly string[] }[] = []): string {
	void _descriptors;
	return generatedPreferenceSearchId(key === 'hataskeyUi3BottomNav' ? 'simpleUi.bottomNav' : key);
}
export function canonicalSearchIdForDescriptor(descriptor: { stableId: string; preferenceKeys: readonly string[] }, descriptors: readonly { stableId: string; preferenceKeys: readonly string[] }[]): string | null {
	if (descriptor.stableId === uiSDisplaySizeSearchId) return uiSDisplaySizeSearchId;
	const key = descriptor.preferenceKeys.find(value => destinationForPreferenceKey(value) != null);
	return key == null ? null : canonicalSearchIdForPreferenceKey(key, descriptors);
}
export function destinationForSearchDescriptor(descriptor: { stableId?: string; preferenceKeys: readonly string[] }): string | null {
	if (descriptor.stableId === uiSDisplaySizeSearchId) return 'hataskey-ui-s';
	const destinations = [...new Set(descriptor.preferenceKeys.map(destinationForPreferenceKey).filter((value): value is string => value != null))];
	return destinations.length === 1 ? destinations[0] : null;
}
export function searchIdForPreferenceKey(key: string, descriptors: readonly { stableId: string; source?: string; route: string; preferenceKeys: readonly string[] }[]): string | null {
	void descriptors;
	return destinationForPreferenceKey(key) == null ? null : canonicalSearchIdForPreferenceKey(key);
}

function sectionForDestination(item: SettingsDestination): { title: string; description: string } {
	const section = settingsDestinationSections.find(candidate => candidate.items.some(child => child.id === item.id));
	return { title: item.label, description: item.description ?? section?.description ?? item.label };
}

/** Header copy comes from settings-destinations.ts/i18n, never Japanese literals. */
export const preferenceGroups = Object.freeze(Object.fromEntries(preferenceDestinationIds.map(id => [id, sectionForDestination(manifestDestination(id))]))) as Readonly<Record<PreferenceDestinationId, { title: string; description: string }>>;
export const preferenceDestinationManifest = Object.freeze(preferenceDestinationIds.map(id => manifestDestination(id)));
