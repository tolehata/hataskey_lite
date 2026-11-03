/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import { hemisphere } from '@@/js/intl-const.js';
import { prefersReducedMotion } from '@@/js/config.js';
import { definePreferences } from './manager.js';
import type { Theme } from '@/theme.js';
import type { SoundType } from '@/utility/sound.js';
import type { Plugin } from '@/plugin.js';
import type { DeviceKind } from '@/utility/device-kind.js';
import type { DeckProfile } from '@/deck.js';
import type { WatermarkPreset } from '@/utility/watermark.js';
import { genId } from '@/utility/id.js';
import { DEFAULT_DEVICE_KIND } from '@/utility/device-kind.js';
import { deepEqual } from '@/utility/deep-equal.js';

/** サウンド設定 */
export type SoundStore = {
	type: Exclude<SoundType, '_driveFile_'>;
	volume: number;
} | {
	type: '_driveFile_';

	/** ドライブのファイルID */
	fileId: string;

	/** ファイルURL（こちらが優先される） */
	fileUrl: string;

	volume: number;
};

export type StatusbarStore = {
	name: string | null;
	id: string;
	type: string | null;
	size: 'verySmall' | 'small' | 'medium' | 'large' | 'veryLarge';
	black: boolean;
	props: Record<string, any>;
};

export type DataSaverStore = {
	media: boolean;
	avatar: boolean;
	urlPreviewThumbnail: boolean;
	disableUrlPreview: boolean;
	code: boolean;
};

type OmitStrict<T, K extends keyof T> = T extends any ? Pick<T, Exclude<keyof T, K>> : never;

// NOTE: デフォルト値は他の設定の状態に依存してはならない(依存していた場合、ユーザーがその設定項目単体で「初期値にリセット」した場合不具合の原因になる)

export const PREF_DEF = definePreferences({
	accounts: {
		default: [] as [host: string, user: {
			id: string;
			username: string;
		}][],
	},

	pinnedUserLists: {
		accountDependent: true,
		default: [] as Misskey.entities.UserList[],
	},
	uploadFolder: {
		accountDependent: true,
		default: null as string | null,
	},
	widgets: {
		accountDependent: true,
		default: () => [{
			name: 'calendar',
			id: genId(), place: 'right', data: {},
		}, {
			name: 'notifications',
			id: genId(), place: 'right', data: {},
		}, {
			name: 'trends',
			id: genId(), place: 'right', data: {},
		}] as {
			name: string;
			id: string;
			place: string | null;
			data: Record<string, any>;
		}[],
	},
	'deck.profile': {
		accountDependent: true,
		default: null as string | null,
	},
	'deck.profiles': {
		accountDependent: true,
		default: [] as DeckProfile[],
	},

	emojiPalettes: {
		serverDependent: true,
		default: () => [{
			id: genId(),
			name: '',
			emojis: ['👍', '❤️', '😆', '🤔', '😮', '🎉', '💢', '😥', '😇', '🍮'],
		}] as {
			id: string;
			name: string;
			emojis: string[];
		}[],
		mergeStrategy: (a, b) => {
			const mergedItems = [] as typeof a;
			for (const x of a.concat(b)) {
				const sameIdItem = mergedItems.find(y => y.id === x.id);
				if (sameIdItem != null) {
					if (deepEqual(x, sameIdItem)) { // 完全な重複は無視
						continue;
					} else { // IDは同じなのに内容が違う場合はマージ不可とする
						throw new Error();
					}
				} else {
					mergedItems.push(x);
				}
			}
			return mergedItems;
		},
	},
	emojiPaletteForReaction: {
		serverDependent: true,
		default: null as string | null,
	},
	emojiPaletteForMain: {
		serverDependent: true,
		default: null as string | null,
	},

	overridedDeviceKind: {
		default: null as DeviceKind | null,
	},
	themes: {
		default: [] as Theme[],
		mergeStrategy: (a, b) => {
			const mergedItems = [] as typeof a;
			for (const x of a.concat(b)) {
				const sameIdItem = mergedItems.find(y => y.id === x.id);
				if (sameIdItem != null) {
					if (deepEqual(x, sameIdItem)) { // 完全な重複は無視
						continue;
					} else { // IDは同じなのに内容が違う場合はマージ不可とする
						throw new Error();
					}
				} else {
					mergedItems.push(x);
				}
			}
			return mergedItems;
		},
	},
	lightTheme: {
		default: null as Theme | null,
	},
	darkTheme: {
		default: null as Theme | null,
	},
	syncDeviceDarkMode: {
		default: true,
	},
	defaultNoteVisibility: {
		default: 'public' as (typeof Misskey.noteVisibilities)[number],
	},
	defaultNoteLocalOnly: {
		default: false,
	},
	keepCw: {
		default: true,
	},
	rememberNoteVisibility: {
		default: false,
	},
	reportError: {
		default: false,
	},
	collapseRenotes: {
		default: true,
	},
	menu: {
		default: [
			'notifications',
			'chat',
			'favorites',
			'explore',
			'followRequests',
			'-',
			'announcements',
			'channels',
			'search',
			'-',
		],
	},
	statusbars: {
		default: [] as StatusbarStore[],
	},
	serverDisconnectedBehavior: {
		default: 'quiet' as 'quiet' | 'reload' | 'dialog' | 'none',
	},
	nsfw: {
		default: 'respect' as 'respect' | 'force' | 'ignore',
	},
	highlightSensitiveMedia: {
		default: false,
	},
	animation: {
		default: !prefersReducedMotion,
	},
	animatedMfm: {
		default: !prefersReducedMotion,
	},
	advancedMfm: {
		default: true,
	},
	showReactionsCount: {
		default: true,
	},
	enableQuickAddMfmFunction: {
		default: true,
	},
	loadRawImages: {
		default: false,
	},
	imageNewTab: {
		default: false,
	},
	disableShowingAnimatedImages: {
		default: prefersReducedMotion,
	},
	emojiStyle: {
		default: 'twemoji', // twemoji / fluentEmoji / native
	},
	menuStyle: {
		default: 'auto' as 'auto' | 'popup' | 'drawer',
	},
	useBlurEffectForModal: {
		default: true,
	},
	useBlurEffect: {
		default: true,
	},
	useStickyIcons: {
		default: true,
	},
	enableHighQualityImagePlaceholders: {
		default: true,
	},
	showFixedPostForm: {
		default: false,
	},
	showFixedPostFormInChannel: {
		default: false,
	},
	enableInfiniteScroll: {
		default: true,
	},
	useReactionPickerForContextMenu: {
		default: false,
	},
	showGapBetweenNotesInTimeline: {
		default: true,
	},
	instanceTicker: {
		default: 'remote' as 'none' | 'remote' | 'always',
	},
	emojiPickerScale: {
		default: 3,
	},
	emojiPickerWidth: {
		default: 2,
	},
	emojiPickerHeight: {
		default: 3,
	},
	emojiPickerStyle: {
		default: 'auto' as 'auto' | 'popup' | 'drawer',
	},
	squareAvatars: {
		default: false,
	},
	showAvatarDecorations: {
		default: true,
	},
	numberOfPageCache: {
		default: 3,
	},
	pollingInterval: {
		// 1 ... 低
		// 2 ... 中
		// 3 ... 高
		default: 2,
	},
	showNoteActionsOnlyHover: {
		default: false,
	},
	showClipButtonInNoteFooter: {
		default: false,
	},
	reactionsDisplaySize: {
		default: 'small' as 'small' | 'medium' | 'large',
	},
	limitWidthOfReaction: {
		default: true,
	},
	forceShowAds: {
		default: true,
	},
	aiChanMode: {
		default: false,
	},
	devMode: {
		default: false,
	},
	mediaListWithOneImageAppearance: {
		default: 'expand' as 'expand' | '16_9' | '1_1' | '2_3',
	},
	notificationPosition: {
		default: 'rightBottom' as 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom',
	},
	notificationStackAxis: {
		default: 'vertical' as 'vertical' | 'horizontal',
	},
	notificationExcludeBots: {
		accountDependent: true,
		default: false,
	},
	emojiAdditionNotice: {
		default: true,
	},
	hourlyTimeNotice: {
		default: true,
	},
	enableCondensedLine: {
		default: false,
	},
	keepScreenOn: {
		default: false,
	},
	useGroupedNotifications: {
		default: true,
	},
	dataSaver: {
		default: {
			media: false,
			avatar: false,
			urlPreviewThumbnail: false,
			disableUrlPreview: false,
			code: false,
		} as DataSaverStore,
	},
	hemisphere: {
		default: hemisphere as 'N' | 'S',
	},
	enableSeasonalScreenEffect: {
		default: false,
	},
	enableHorizontalSwipe: {
		default: false,
	},
	enablePullToRefresh: {
		default: true,
	},
	useNativeUiForVideoAudioPlayer: {
		default: false,
	},
	keepOriginalFilename: {
		default: true,
	},
	alwaysConfirmFollow: {
		default: true,
	},
	confirmWhenRevealingSensitiveMedia: {
		default: false,
	},
	contextMenu: {
		default: 'app' as 'app' | 'appWithShift' | 'native',
	},
	skipNoteRender: {
		default: true,
	},
	showSoftWordMutedWord: {
		default: false,
	},
	confirmOnReact: {
		default: false,
	},
	defaultFollowWithReplies: {
		default: true,
	},
	makeEveryTextElementsSelectable: {
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	showNavbarSubButtons: {
		default: true,
	},
	showTitlebar: {
		default: false,
	},
	showAvailableReactionsFirstInNote: {
		default: false,
	},
	showPageTabBarBottom: {
		default: false,
	},
	plugins: {
		default: [] as (OmitStrict<Plugin, 'config'> & { config: Record<string, any> })[],
		mergeStrategy: (a, b) => {
			const sameIdExists = a.some(x => b.some(y => x.installId === y.installId));
			if (sameIdExists) throw new Error();
			const sameNameExists = a.some(x => b.some(y => x.name === y.name));
			if (sameNameExists) throw new Error();
			return a.concat(b);
		},
	},
	mutingEmojis: {
		default: [] as string[],
		mergeStrategy: (a, b) => {
			return [...new Set(a.concat(b))];
		},
	},
	watermarkPresets: {
		accountDependent: true,
		default: [] as WatermarkPreset[],
		mergeStrategy: (a, b) => {
			const mergedItems = [] as typeof a;
			for (const x of a.concat(b)) {
				const sameIdItem = mergedItems.find(y => y.id === x.id);
				if (sameIdItem != null) {
					if (deepEqual(x, sameIdItem)) { // 完全な重複は無視
						continue;
					} else { // IDは同じなのに内容が違う場合はマージ不可とする
						throw new Error();
					}
				} else {
					mergedItems.push(x);
				}
			}
			return mergedItems;
		},
	},
	defaultWatermarkPresetId: {
		accountDependent: true,
		default: null as WatermarkPreset['id'] | null,
	},
	defaultImageCompressionLevel: {
		default: 2 as 0 | 1 | 2 | 3,
	},
	defaultVideoCompressionLevel: {
		default: 2 as 0 | 1 | 2 | 3,
	},

	'sound.masterVolume': {
		default: 0.5,
	},
	'sound.notUseSound': {
		default: false,
	},
	'sound.useSoundOnlyWhenActive': {
		default: false,
	},
	'sound.on.note': {
		default: { type: 'hataskey-sound/note', volume: 1 } as SoundStore,
	},
	'sound.on.noteMy': {
		default: { type: 'hataskey-sound/noteMy', volume: 1 } as SoundStore,
	},
	'sound.on.noteSchedulePost': {
		default: { type: 'hataskey-sound/noteSchedulePost', volume: 1 } as SoundStore,
	},
	'sound.on.noteEdited': {
		default: { type: 'hataskey-sound/noteEdited', volume: 1 } as SoundStore,
	},
	'sound.on.notification': {
		default: { type: 'hataskey-sound/notification', volume: 1 } as SoundStore,
	},
	'sound.on.reaction': {
		default: { type: 'hataskey-sound/reaction', volume: 1 } as SoundStore,
	},
	'sound.on.chatMessage': {
		default: { type: 'hataskey-sound/chatMessage', volume: 1 } as SoundStore,
	},

	'deck.alwaysShowMainColumn': {
		default: true,
	},
	'deck.navWindow': {
		default: true,
	},
	'deck.useSimpleUiForNonRootPages': {
		default: true,
	},
	'deck.columnAlign': {
		default: 'center' as 'left' | 'right' | 'center',
	},
	'deck.columnGap': {
		default: 6,
	},
	'deck.menuPosition': {
		default: 'bottom' as 'right' | 'bottom',
	},
	'deck.navbarPosition': {
		default: 'left' as 'left' | 'top' | 'bottom',
	},
	'deck.wallpaper': {
		default: null as string | null,
	},

	'chat.showSenderName': {
		default: true,
	},
	'chat.sendOnEnter': {
		default: true,
	},

	'game.dropAndFusion': {
		default: {
			bgmVolume: 0.25,
			sfxVolume: 1,
		},
	},

	// #region CherryPick
	// - Settings/Appearance
	fontSize: {
		default: 8,
	},
	showUnreadNotificationsCount: {
		default: true,
	},
	setFederationAvatarShape: {
		default: true,
	},
	filesGridLayoutInUserPage: {
		default: true,
	},

	// - Settings/Timeline and Note
	forceCollapseAllRenotes: {
		default: false,
	},
	collapseReplies: {
		default: false,
	},
	collapseLongNoteContent: {
		default: true,
	},
	collapseDefault: {
		default: true,
	},
	allMediaNoteCollapse: {
		default: false,
	},
	showSubNoteFooterButton: {
		default: true,
	},
	infoButtonForNoteActionsEnabled: {
		default: true,
	},
	showGapBodyOfTheNote: {
		default: true,
	},
	showReplyButtonInNoteFooter: {
		default: true,
	},
	showRenoteButtonInNoteFooter: {
		default: true,
	},
	showLikeButtonInNoteFooter: {
		default: false,
	},
	showDoReactionButtonInNoteFooter: {
		default: true,
	},
	showQuoteButtonInNoteFooter: {
		default: true,
	},
	showMoreButtonInNoteFooter: {
		default: true,
	},
	selectReaction: {
		default: '❤️' as string,
	},
	showReplyInNotification: {
		default: false,
	},
	renoteQuoteButtonSeparation: {
		default: true,
	},
	renoteVisibilitySelection: {
		default: true,
	},
	forceRenoteVisibilitySelection: {
		default: 'none' as 'none' | 'public' | 'home' | 'followers',
	},
	showFixedPostFormInReplies: {
		default: true,
	},
	showNoAltTextWarning: {
		default: false,
	},
	alwaysShowCw: {
		default: false,
	},
	hideAvatarsInNote: {
		default: false,
	},
	enableAbsoluteTime: {
		default: false,
	},
	enableMarkByDate: {
		default: false,
	},
	showReplyTargetNote: {
		default: true,
	},
	showReplyTargetNoteInSemiTransparent: {
		default: true,
	},
	nsfwOpenBehavior: {
		default: 'click' as 'click' | 'doubleClick',
	},

	// - Settings/Posting form
	showPreview: {
		default: false,
	},
	showProfilePreview: {
		default: true,
	},

	// - Settings/Navigate to an external site warning
	externalNavigationWarning: {
		default: true,
	},
	trustedDomains: {
		default: [] as string[],
	},

	// - Settings/Accessibility
	showingAnimatedImages: {
		default: /mobile|ipad|iphone|android/.test(navigator.userAgent.toLowerCase()) ? 'inactive' : 'always' as 'always' | 'interaction' | 'inactive',
	},

	// - Settings/Performance
	removeModalBgColorForBlur: {
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	smoothTransitionAnimations: {
		default: false,
	},

	// - Settings/Other
	autoLoadMoreReplies: {
		default: false,
	},
	autoLoadMoreConversation: {
		default: false,
	},
	welcomeBackToast: {
		default: true,
	},
	disableNyaize: {
		default: false,
	},
	requireRefreshBehavior: {
		default: 'dialog' as 'quiet' | 'dialog',
	},
	newNoteReceivedNotificationBehavior: {
		default: 'count' as 'default' | 'count' | 'none',
	},

	// - Settings/Navigation bar
	bannerDisplay: {
		default: 'topBottom' as 'all' | 'topBottom' | 'top' | 'bottom' | 'bg' | 'hide',
	},

	// - Settings/Timeline
	enableHomeTimeline: {
		default: true,
	},
	enableLocalTimeline: {
		default: true,
	},
	enableSocialTimeline: {
		default: true,
	},
	enableGlobalTimeline: {
		default: true,
	},
	enableMediaTimeline: {
		default: true,
	},
	enableBubbleTimeline: {
		default: true,
	},
	enableListTimeline: {
		default: true,
	},
	enableAntennaTimeline: {
		default: true,
	},
	enableChannelTimeline: {
		default: true,
	},

	// - Settings/CherryPick
	nicknameEnabled: {
		default: true,
	},
	nicknameMap: {
		default: {} as Record<string, string>,
	},
	useEnterToSend: {
		default: false,
	},
	postFormVisibilityHotkey: {
		default: true,
	},
	showRenoteConfirmPopup: {
		default: true,
	},
	expandOnNoteClick: {
		default: false,
        },
        timelineAnimationDirection: {
                default: 'left' as 'top' | 'left' | 'right' | 'random',
	},
	ltlEmojiVoteEnabled: {
		default: true,
	},
	expandOnNoteClickBehavior: {
		default: 'click' as 'click' | 'doubleClick',
	},
	displayHeaderNavBarWhenScroll: {
		default: 'hideHeaderFloatBtn' as 'all' | 'hideHeaderOnly' | 'hideHeaderFloatBtn' | 'hideFloatBtnOnly' | 'hideFloatBtnNavBar' | 'hide',
	},
	reactableRemoteReactionEnabled: {
		default: true,
	},
	showFollowingMessageInsteadOfButtonEnabled: {
		default: true,
	},
	mobileHeaderChange: {
		default: false,
	},
	renameTheButtonInPostFormToNya: {
		default: false,
	},
	renameTheButtonInPostFormToNyaManualSet: {
		default: false,
        },
        showHashtagButtonInPostForm: {
                default: true,
        },
        showEventButtonInPostForm: {
                default: true,
	},
        showDrawingButtonInPostForm: {
		default: true,
	},
	hataskeyUi3TimelineBackground: { default: true },
	hataskeyUi3SideMenuBackground: { default: true },
	hataskeyUi3RightPaneBackground: { default: true },
	hataskeyUi3GlassDensity: { default: 'light' as 'light' | 'dense' },
	// null は旧 simpleUi.bottomNav の読み取り互換。UI S の編集は専用キーに保存する。
	hataskeyUi3BottomNav: {
		default: null as { id: string; icon?: string; label?: string; visible?: boolean }[] | null,
	},
	// 旗鯖fork: Hataskey UI 3 の投稿欄に置く、よく使う機能のショートカット2枠('none' の枠は＋ボタン)。
	hataskeyUi3ComposerShortcut1: {
		default: 'none' as string,
	},
	hataskeyUi3ComposerShortcut2: {
		default: 'none' as string,
	},
	// 旗鯖fork: Hataskey UI 3 の投稿欄で絵文字ボタンを置く位置(ショートカットのすぐ右/公開範囲のすぐ左)。
	hataskeyUi3ComposerEmojiPosition: {
		default: 'afterShortcuts' as 'afterShortcuts' | 'beforeVisibility',
	},
	// 旗鯖fork: Hataskey UI 3 のタイムライン内投稿欄の位置。
	hataskeyUi3ComposerPosition: {
		default: 'bottom' as 'top' | 'bottom',
	},
	// UI S RSS is account-independent and separate from deck RSS. Optional
	// preference cloud backup follows the existing preference manager policy.
	hataskeyUi3RssEnabled: { default: false },
	hataskeyUi3RssFeeds: { default: [] as { id: string; url: string; name?: string; color?: string }[] },
	hataskeyUi3RssAutoSwitch: { default: true },
	hataskeyUi3RssReadSeconds: { default: 6 as 6 | 10 | 15 | 30 },
	hataskeyUi3RssReadMode: { default: 'full' as 'full' | 'summary' },
	// 旗鯖fork: ショートカットを初めて選んだときの「設定で変更できます」案内を表示済みか(アカウントごとに1回)。
	hataskeyUi3ShortcutGuideShown: {
		default: false,
		accountDependent: true,
	},
        useSimpleTL: {
        default: false,
	},
	        simpleTLLastListId: {
	        default: null as string | null,
	        },
	enableWidgetsArea: {
		default: true,
	},
	enableLongPressOpenAccountMenu: {
		default: true,
	},
	// ログインボーナスポップアップ表示設定（旗鯖独自機能）
	showLoginBonusPopup: {
		default: true,
	},
	// ミュートしたユーザーのリアクションを非表示（旗鯖独自機能）
	hideMutedUserReactions: {
		default: false,
	},
	// 外部サーバー連携（旗鯖独自機能）
	'external.enabled': {
		default: false,
	},
	'external.host': {
		default: '' as string,
	},
	'external.token': {
		default: null as string | null,
	},
	'external.userId': {
		default: null as string | null,
	},
	'external.username': {
		default: null as string | null,
	},
	'external.avatarUrl': {
		default: null as string | null,
	},
	'external.enableOHTL': {
		default: true,
	},
	'external.enableOLTL': {
		default: true,
	},
	// 旗鯖fork: 外部通知のトースト無効化トグル。true の場合、WebSocket接続も行わない。
	'external.disableNotificationToast': {
		default: false,
	},
	// ======== シンプルUI設定 ========
	// 旗鯖fork: Hataskey UI でのトレンドタイムライン (TTL) タブの表示/非表示
	// デフォルト true (最左に表示)。topNav 設定とは独立して管理することで、
	// 既存ユーザーの保存済み topNav 設定を変更せずにトレンドタブを出せる。
	'simpleUi.showTrendingTab': {
		default: true,
	},
	'simpleUi.showHatadyTab': {
		default: true,
	},
	'simpleUi.topNav': {
		default: [
			{ id: 'following', icon: 'ti ti-home', label: 'ホーム', visible: true },
			{ id: 'local', icon: 'ti ti-planet', label: 'ローカル', visible: true },
			{ id: 'social', icon: 'ti ti-users', label: 'ソーシャル', visible: false },
			{ id: 'mixed', icon: 'ti ti-universe', label: 'グローバル', visible: true },
		] as { id: string; icon: string; label: string; visible: boolean }[],
	},
	'simpleUi.bottomNav': {
		default: [
			{ id: 'search', icon: 'ti ti-search', label: '検索', visible: true },
			{ id: 'home', icon: 'ti ti-home', label: 'ホーム', visible: true },
			{ id: 'notifications', icon: 'ti ti-bell', label: '通知', visible: true },
			{ id: 'widgets', icon: 'ti ti-apps', label: 'ウィジェット', visible: false },
		] as { id: string; icon: string; label: string; visible: boolean }[],
	},
	'simpleUi.sidebar': {
		default: [
			// 旗鯖fork: サイドメニューを3グループに再編 (基本機能 / 旗鯖独自 / 発見・交流)
			// グループ1: 基本機能
			{ id: 'timeline', icon: 'ti ti-home', label: 'タイムライン', group: 'basic' },
			{ id: 'search', icon: 'ti ti-search', label: '検索', group: 'basic' },
			{ id: 'notifications', icon: 'ti ti-bell', label: '通知', group: 'basic' },
			// 旗鯖fork: chat はかつて ui/simple.vue で動的注入していたが、ユーザーが非表示/並び替えできるよう
			// 通常項目として扱う (v5 マイグレで既存ユーザーにも insertAfter で追加)
			{ id: 'chat', icon: 'ti ti-messages', label: 'メッセージ', group: 'basic' },
			{ id: 'announcements', icon: 'ti ti-speakerphone', label: 'お知らせ', group: 'basic' },
			{ id: 'drive', icon: 'ti ti-cloud', label: 'ドライブ', group: 'basic' },
			{ id: 'favorites', icon: 'ti ti-star', label: 'お気に入り', group: 'basic' },
			// グループ3: 発見・交流
			{ id: 'uiSetup', icon: 'ti ti-wand', label: 'UI切り替え', group: 'discover' },
			{ id: 'explore', icon: 'ti ti-hash', label: 'みつける', group: 'discover' },
			{ id: 'followRequests', icon: 'ti ti-user-plus', label: 'フォロー申請', group: 'discover' },
			{ id: 'channels', icon: 'ti ti-device-tv', label: 'チャンネル', group: 'discover' },
			// 末尾: もっと (ランチパッド)
			{ id: 'more', icon: 'ti ti-dots', label: 'もっと', group: 'more' },
			// 旗鯖fork: ページ全体リロード。かつて ui/simple.vue で「もっと」の下にハードコード表示
			// していたが、ユーザーが非表示/並び替えできるよう通常項目として扱う
			// (v5 マイグレで既存ユーザーにも insertAfter で追加)
			{ id: 'reload', icon: 'ti ti-refresh', label: 'リロード', group: 'more' },
			{ id: 'cacheClear', icon: 'ti ti-trash', label: 'キャッシュをクリア', group: 'more' },
		] as { id: string; icon: string; label: string; group?: string; visible?: boolean; external?: boolean; url?: string }[],
	},
	'simpleUi.widgetBorder': {
		default: true,
	},
	// 旗鯖fork: hata-13.0 でユーザーパネルを廃止し参照箇所はない。保存済みプロファイルを読むために残す互換定義
	'simpleUi.directProfile': {
		default: false,
	},
	'simpleUi.glassEffect': {
		default: true,
	},
	// 旗鯖fork: Hataskeyオリジナルのブランディングイラスト(ハタキュ)を各所のアイコンとして使うか。
	//   false にすると、設定メニュー・UIタブ・各設定ページのバナー・エラー表示・ダイアログ等が
	//   従来の Tabler アイコン / 絵文字 / SVG へ戻る。
	//   ⚠️管理画面のブランディング画像(instance.*ImageUrl)は、この値に関わらず従来どおり最優先。
	'hataBranding.useHatakyu': {
		default: true,
	},
	// 旗鯖fork: Hataskey UI のページヘッダー(ページタイトル+戻るボタン)を表示するか。
	// ページ自身が MkPageHeader を持っているため、デフォルトでは非表示にしてタイトル二重表示を回避する。
	// ONにすると Hataskey UI 独自のシンプルなヘッダーがページの上に追加で出る。
	'simpleUi.showPageHeader': {
		default: false,
	},
	// 旗鯖fork: Hataskey UI デッキモード
	'simpleUi.deckMode': {
		default: false,
	},
	// 旗鯖fork: 通常Hataskey UI(左サイドメニュー)を手動で縮小(折りたたみ)するか。
	// true = アイコンのみの細い表示。デスクトップのみ。
	'simpleUi.sidebarCollapsed': {
		default: false,
	},
	// 旗鯖fork: ユーザーページの宴成功バッジ初回アナウンス吹き出しを表示済みか
	// (preferを使うとマルチデバイス同期されるため、媒体問わず通算1回で恒久 dismiss)。
	'simpleUi.utageBadgeTipShown': {
		default: false,
	},
	// 旗鯖fork: 上部メニューモード。ONでサイドバーの代わりに画面上部へ
	// 横並びピル型のナビバー(Hataskey UIナビバー)を出す。デスクトップのみ。
	'simpleUi.topNavMode': {
		default: false,
	},
	// 旗鯖fork: デッキUIの背景にヘッダー画像のぼかしを使うか(アクセシビリティ)。
	// default false = ぼかし背景を使う。true = 使わない(無地背景)。
	'simpleUi.deckNoBannerBg': {
		default: false,
	},
	// 旗鯖fork: Hataskey UI 通常表示(デッキUIではないタイムライン)の背景にヘッダー画像の
	// ぼかしを使うか(Hataskey UI 2 有効時のみ効く)。deckNoBannerBg の通常モード版。
	// default false = ぼかし背景を使う。true = 使わない(無地背景)。
	'simpleUi.normalNoBannerBg': {
		default: false,
	},
	// 旗鯖fork(Hataskey UI 2): プロフィールページのヘッダー画像のぼかしレイヤを使うか。
	// Hataskey UI 2 有効時にのみ効く (通常時はぼかしレイヤ自体が無効)。
	// default false = ぼかしを使う。true = 使わない (プロフィールカードを不透明パネルに)。
	'simpleUi.profileNoBannerBg': {
		default: false,
	},
	// 旗鯖fork: Hataskey UI デッキで、カラム最上部に到達したときの表示を「最新のノートです」
	// テキストに戻すか。default false = テーマカラーの横線でシンプル表示 (新既定)。
	// true = 従来通り「(↑) 最新のノートです」テキスト表示。
	'simpleUi.deckLatestNoteText': {
		default: false,
	},
	// 旗鯖fork(Hataskey UI 2): タイムラインノートカード面 (bubbleBody) の不透明度 (%)。
	// 0-100 の整数。既定 55 (=これまで固定で使っていた panel 55%)。
	// 小さいほど透け感が強く、大きいほど不透明パネルに近づく。
	'simpleUi.glassUiCardOpacity': {
		default: 55,
	},
	// 旗鯖fork: デッキUI/Hataskey UI で、チャンネルカラムの従来の投稿ボタン
	// (カラムヘッダ右のペン+ボタン + 三点メニュー「このチャンネルへ投稿」項目) を表示するか。
	// default false = 非表示 (=新設のノートリスト最上部固定ボタンを主とする)。
	// true = 従来通り表示。
	'simpleUi.showLegacyChannelPostButton': {
		default: false,
	},
	// 旗鯖fork: タイムラインから bot ユーザーの投稿を非表示にするか。
	// bot ノイズが多いユーザー向け。例外は botAllowlist で個別に許可する。
	// default false = すべての bot ノートを表示 (従来通り)。
	'simpleUi.hideBotsInTimeline': {
		default: false,
	},
	// 旗鯖fork: hideBotsInTimeline が true のとき、それでも表示を許可する bot の userId 配列。
	// 例外リスト。空配列は「すべての bot を非表示」を意味する。
	'simpleUi.botAllowlist': {
		default: [] as string[],
	},
	// 旗鯖fork: デッキUIの初回チュートリアルを表示済みか(端末ローカル)
	'simpleUi.deckTutorialDone': {
		default: false,
	},
	'simpleUi.deckLayout': {
		default: 'row' as 'row' | 'grid2' | 'grid3' | 'stack',
	},
	'simpleUi.deckColumns': {
		default: [
			{ id: 'col-local', type: 'local', width: 380 },
			{ id: 'col-home', type: 'home', width: 380 },
			{ id: 'col-notifications', type: 'notifications', width: 340 },
		] as { id: string; type: string; width: number; height?: number; name?: string; sourceId?: string; withRenotes?: boolean; excludeBots?: boolean; excludeTypes?: string[]; notificationFilterKnownTypes?: string[]; borderColor?: string | null; fullWidth?: boolean; fullHeight?: boolean }[],
	},
	// 旗鯖fork: デッキのシート構成プロファイル(複数保存・切替)。
	// 旧 deckColumns/deckLayout は後方互換のため残し、hatasaba-deck.vue 側で
	// プロファイルが空のとき旧キーから自動マイグレーションする。
	// locked: ロック中はカラムの追加/削除/移動/ドラッグを抑止する。
	'simpleUi.deckProfiles': {
		default: [] as {
			id: string;
			name: string;
			layout: 'row' | 'grid2' | 'grid3' | 'stack';
			columns: { id: string; type: string; width: number; height?: number; name?: string; sourceId?: string; withRenotes?: boolean; excludeBots?: boolean; excludeTypes?: string[]; notificationFilterKnownTypes?: string[]; borderColor?: string | null; fullWidth?: boolean; fullHeight?: boolean }[];
		}[],
	},
	'simpleUi.deckActiveProfile': {
		default: '' as string,
	},
	'simpleUi.deckLocked': {
		default: false,
	},
	// 旗鯖fork: デッキ D2 — 3階層モデル(slot→frame→tab)のプロファイル。
	// 旧 simpleUi.deckProfiles(columns形式)は後方互換・ロールバック用に温存し、
	// V2が空のとき旧データから一度だけ変換して埋める(hatasaba-deck.vue 側)。
	// slot   = レイアウトの1マス(横並び:列 / グリッド:セル / 縦一列:段)
	// frame  = スロット内に縦積みされる箱。tabsが複数ならタブ切替表示になる
	// tab    = 表示内容(カラム本体)
	'simpleUi.deckProfilesV2': {
		default: [] as {
			id: string;
			name: string;
			layout: 'row' | 'grid2' | 'grid3' | 'stack';
			slots: {
				id: string;
				width: number;
				height?: number;
				fullWidth?: boolean;
				fullHeight?: boolean;
				frames: {
					id: string;
					activeTab?: string;
					borderColor?: string | null;
					tabs: {
						id: string;
						type: string;
						name?: string;
						sourceId?: string;
						withRenotes?: boolean;
						excludeBots?: boolean;
						excludeTypes?: string[];
						notificationFilterKnownTypes?: string[];
						tabName?: string;
					}[];
				}[];
			}[];
		}[],
	},
	'simpleUi.deckActiveProfileV2': {
		default: '' as string,
	},
	// 旗鯖fork: デッキのツールバー配置(上/右/下)。デフォルトは上。
	'simpleUi.deckToolbarPos': {
		default: 'top' as 'top' | 'right' | 'bottom',
	},
	'simpleUi.deckClock': {
		default: false,
	},
	// 旗鯖fork: デッキRSSティッカーのフィード(端末ローカル/最大5/配列順=優先順位/フィードごとに色)。
	// accountDependent を付けないことでサーバー同期されず端末ごとに保持される。
	'simpleUi.deckRssFeeds': {
		default: [] as { id: string; url: string; name?: string; color?: string }[],
	},
	'simpleUi.deckRssEnabled': {
		default: false,
	},
	'simpleUi.deckOnlineUsers': {
		default: false,
	},
	'simpleUi.noteSpacing': {
		default: 'moderate' as 'compact' | 'moderate' | 'wide',
	},
	// 旗鯖fork(#15): スマホ/狭幅でHataskey UIを使う際、日付セパレータを従来位置(中央インライン)で表示するか。
	// 既定OFF(非表示)。ONにすると狭幅でも日付を表示する。
	'simpleUi.showTimelineDateOnMobile': {
		default: false,
	},
	'simpleUi.disableBubbleInDeck': {
		default: true,
	},
	'simpleUi.disableBubbleInDefault': {
		default: false,
	},
	// 旗鯖fork: Hataskey UI のデッキ表示モード (simpleUi.deckMode=ON) 時の吹き出し無効化トグル。
	// 従来 Misskey デッキ UI (ui=deck) とは別 UI のため、別キーで管理する。
	'simpleUi.disableBubbleInHatasabaDeck': {
		default: true,
	},
	// 旗鯖fork: Hataskey UI の通常モード (ui=simple かつ deckMode=OFF) 時の吹き出し無効化トグル。
	// 従来は通常モードには無効化手段が無く常に吹き出しONだったが、標準カード表示を望む
	// ユーザー向けにトグルを追加。デフォルトは吹き出しON(=false)で従来の見た目を維持。
	'simpleUi.disableBubbleInHatasabaNormal': {
		default: false,
	},
	'simpleUi.classicNoteSpacing': {
		default: false,
	},
	// ======== シンプルUI設定ここまで ========
	//#endregion

	// ======== 旗鯖fork: 天気エフェクト (weatherEffect) ========
	// ノート本文の「雨」「雪」などの単語に応じて、タイムラインの背景に控えめな天気演出を出す機能。
	// 光過敏症(光感受性てんかん)への配慮を最優先し、デフォルトはOFF。強い明滅・点滅は一切行わない。
	// 機能全体のON/OFF。デフォルトON。初回エフェクト発火時にチュートリアルで無効化方法を案内する。
	// 光や動きに敏感な人向けに、OSの prefers-reduced-motion: reduce 設定時は描画側で自動的に動きを止める。
	'weatherEffect.enabled': {
		// 光過敏症への配慮を最優先し、デフォルトはOFF(以前は誤って true になっていた)。
		default: false,
	},
	// 表示スコープ。'note' = 該当ノートが画面内にある間だけ控えめに表示、'global' = しっかり全体表示。
	// ※ Step1では両モードとも「TL全体に1枚レイヤー」を敷き、強度・面積で差をつける実装。
	'weatherEffect.scope': {
		default: 'note' as 'note' | 'global',
	},
	// 旗鯖fork: 演出の長さ。long=該当ノートがある限りずっと / short=出てから約10秒で消える。
	// ※ 朝/就寝の挨拶(おはよう/おやすみ等)由来の演出は、この設定に関わらず常に短時間で消える。
	'weatherEffect.duration': {
		default: 'long' as 'long' | 'short',
	},
	// 粒子の強度(=量)。minimal=控えめ / moderate=標準 / lively=多め。
	'weatherEffect.intensity': {
		default: 'moderate' as 'minimal' | 'moderate' | 'lively',
	},
	// OSの「視差効果を減らす」(prefers-reduced-motion: reduce)に追従するか。デフォルトON(安全側)。
	'weatherEffect.respectReducedMotion': {
		default: true,
	},
	// 各天気種別の初回チップス表示済みフラグ(端末ローカル)。初めてそのエフェクトが発火した時に説明を出す。
	'weatherEffect.firstTipShown.rain': {
		default: false,
	},
	'weatherEffect.firstTipShown.heavyRain': {
		default: false,
	},
	'weatherEffect.firstTipShown.snow': {
		default: false,
	},
	'weatherEffect.firstTipShown.sunny': {
		default: false,
	},
	'weatherEffect.firstTipShown.windy': {
		default: false,
	},
	'weatherEffect.firstTipShown.shootingStar': {
		default: false,
	},
	// ======== 天気エフェクトここまで ========

	// 旗鯖fork: HataFeed ホームの背景に若葉のアニメーションを舞わせるか(アクセシビリティ配慮でデフォルトOFF)。
	'hatafeed.leaves': {
		default: false,
	},

	// 旗鯖fork(Hatady): テーマ・言語は端末ローカル(miLocalStorage)へ移行した。
	//   prefer 同期経由だとクラウド/タブ間同期の巻き戻しで既定へ戻る事象があったため。
	//   → @/utility/hatady-prefs.ts を参照。

	// 旗鯖fork: 投稿フォームの枠色を「投稿範囲(公開/ホーム/フォロワー/ダイレクト)」に応じて変える(アクセシビリティ)。
	'postFormVisibilityBorder.enabled': {
		default: false,
	},
	'postFormVisibilityBorder.width': {
		default: 3,
	},
	'postFormVisibilityBorder.color.public': {
		default: '#3b9eff',
	},
	'postFormVisibilityBorder.color.home': {
		default: '#41b883',
	},
	'postFormVisibilityBorder.color.followers': {
		default: '#e6a23c',
	},
	'postFormVisibilityBorder.color.specified': {
		default: '#f56c6c',
	},

	// ======== フォント設定 ========
	'hataFont.id': {
		default: 'line-seed-jp' as 'line-seed-jp' | 'zen-kaku' | 'zen-kaku-antique' | 'm-plus-1p' | 'dotgothic16' | 'train-one' | 'ibm-plex-sans-jp' | 'custom' | 'system',
	},
	'hataFont.customUrl': {
		default: '' as string,
	},
	'hataFont.customName': {
		default: '' as string,
	},
	'hataFont.customFontConsent': {
		default: false as boolean,
	},
	// ======== 同意管理フラグ ========
	'hataConsent.externalTl': {
		default: false as boolean,
	},
	'hataConsent.externalTlDate': {
		default: '' as string,
	},
	'hataConsent.customFont': {
		default: false as boolean,
	},
	'hataConsent.customFontDate': {
		default: '' as string,
	},
	// ======== お知らせピン留め (旗鯖独自) ========
	'hataPinnedAnnouncementIds': {
		default: [] as string[],
	},
	// ======== 旗鯖独自機能ここまで ========

	'experimental.stackingRouterView': {
		default: false,
	},
	'experimental.enableFolderPageView': {
		default: false,
	},
	'experimental.enableHapticFeedback': {
		default: false,
	},
	'experimental.enableWebTranslatorApi': {
		default: false,
	},
});
