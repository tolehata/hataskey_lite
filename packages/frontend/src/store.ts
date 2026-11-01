/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { markRaw, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import lightTheme from '@@/themes/l-cherrypick.json5';
import darkTheme from '@@/themes/d-cherrypick.json5';
import type { Plugin } from '@/plugin.js';
import type { TIPS } from '@/tips.js';
import { miLocalStorage } from '@/local-storage.js';
import { Pizzax } from '@/lib/pizzax.js';
import { DEFAULT_DEVICE_KIND } from '@/utility/device-kind.js';

/**
 * 「状態」を管理するストア(not「設定」)
 */
export const store = markRaw(new Pizzax('base', {
	accountSetupWizard: {
		where: 'account',
		default: 0,
	},
	tips: {
		where: 'device',
		default: {} as Partial<Record<typeof TIPS[number], boolean>>, // true = 既読
	},
	memo: {
		where: 'account',
		default: null as string | null,
	},
	reactionAcceptance: {
		where: 'account',
		default: null as 'likeOnly' | 'likeOnlyForRemote' | 'nonSensitiveOnly' | 'nonSensitiveOnlyForLocalLikeOnlyForRemote' | null,
	},
	mutedAds: {
		where: 'account',
		default: [] as string[],
	},
	visibility: {
		where: 'deviceAccount',
		default: 'public' as (typeof Misskey.noteVisibilities)[number],
	},
	localOnly: {
		where: 'deviceAccount',
		default: false,
	},
	tl: {
		where: 'deviceAccount',
		default: {
			src: 'home' as 'home' | 'local' | 'social' | 'global' | 'media' | 'bubble' | `list:${string}` | 'ohtl' | 'oltl' | 'trending' | 'ctl',
			userList: null as Misskey.entities.UserList | null,
			filter: {
				withReplies: false,
				withRenotes: true,
				withSensitive: true,
				onlyFiles: false,
				onlyCats: false,
			},
		},
	},
	darkMode: {
		where: 'device',
		default: false,
	},
	realtimeMode: {
		where: 'device',
		default: true,
	},
	recentlyUsedEmojis: {
		where: 'device',
		default: [] as string[],
	},
	recentlyUsedUsers: {
		where: 'device',
		default: [] as string[],
	},
	menuDisplay: {
		where: 'device',
		default: 'sideFull' as 'sideFull' | 'sideIcon' | 'top',
	},
	postFormWithHashtags: {
		where: 'device',
		default: false,
	},
	postFormHashtags: {
		where: 'device',
		default: '',
	},
	additionalUnicodeEmojiIndexes: {
		where: 'device',
		default: {} as Record<string, Record<string, string[]>>,
	},
	pluginTokens: {
		where: 'deviceAccount',
		default: {} as Record<string, string>, // plugin id, token
	},
	accountTokens: {
		where: 'device',
		default: {} as Record<string, string>, // host/userId, token
	},
	accountInfos: {
		where: 'device',
		default: {} as Record<string, Misskey.entities.MeDetailed>, // host/userId, user
	},

	enablePreferencesAutoCloudBackup: {
		where: 'device',
		default: false,
	},
	showPreferencesAutoCloudBackupSuggestion: {
		where: 'device',
		default: true,
	},

	// #region CherryPick
	// - Settings/Appearance
	fontSize: {
		where: 'device',
		default: 8,
	},
	showUnreadNotificationsCount: {
		where: 'deviceAccount',
		default: false,
	},
	setFederationAvatarShape: {
		where: 'account',
		default: true,
	},
	filesGridLayoutInUserPage: {
		where: 'device',
		default: true,
	},

	// - Settings/Timeline and Note
	forceCollapseAllRenotes: {
		where: 'account',
		default: false,
	},
	collapseReplies: {
		where: 'account',
		default: false,
	},
	collapseLongNoteContent: {
		where: 'account',
		default: true,
	},
	collapseDefault: {
		where: 'account',
		default: true,
	},
	allMediaNoteCollapse: {
		where: 'device',
		default: false,
	},
	showSubNoteFooterButton: {
		where: 'device',
		default: true,
	},
	infoButtonForNoteActionsEnabled: {
		where: 'account',
		default: true,
	},
	showGapBodyOfTheNote: {
		where: 'device',
		default: false,
	},
	showReplyButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showRenoteButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showLikeButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showDoReactionButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showQuoteButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	showMoreButtonInNoteFooter: {
		where: 'device',
		default: true,
	},
	selectReaction: {
		where: 'device',
		default: '❤️' as string,
	},
	showReplyInNotification: {
		where: 'device',
		default: false,
	},
	renoteQuoteButtonSeparation: {
		where: 'device',
		default: true,
	},
	renoteVisibilitySelection: {
		where: 'device',
		default: true,
	},
	forceRenoteVisibilitySelection: {
		where: 'device',
		default: 'none' as 'none' | 'public' | 'home' | 'followers',
	},
	showFixedPostFormInReplies: {
		where: 'device',
		default: true,
	},
	showNoAltTextWarning: {
		where: 'device',
		default: false,
	},
	alwaysShowCw: {
		where: 'device',
		default: false,
	},
	hideAvatarsInNote: {
		where: 'device',
		default: false,
	},
	enableAbsoluteTime: {
		where: 'device',
		default: false,
	},
	enableMarkByDate: {
		where: 'device',
		default: false,
	},
	showReplyTargetNote: {
		where: 'device',
		default: true,
	},
	showReplyTargetNoteInSemiTransparent: {
		where: 'device',
		default: true,
	},
	nsfwOpenBehavior: {
		where: 'device',
		default: 'click' as 'click' | 'doubleClick',
	},

	// - Settings/Posting form
	showPreview: {
		where: 'device',
		default: false,
	},
	showProfilePreview: {
		where: 'device',
		default: true,
	},

	// - Settings/Navigate to an external site warning
	externalNavigationWarning: {
		where: 'device',
		default: true,
	},
	trustedDomains: {
		where: 'device',
		default: [] as string[],
	},

	// - Settings/Accessibility
	showingAnimatedImages: {
		where: 'device',
		default: /mobile|ipad|iphone|android/.test(navigator.userAgent.toLowerCase()) ? 'inactive' : 'always' as 'always' | 'interaction' | 'inactive',
	},

	// - Settings/Performance
	removeModalBgColorForBlur: {
		where: 'device',
		default: DEFAULT_DEVICE_KIND === 'desktop',
	},
	smoothTransitionAnimations: {
		where: 'device',
		default: false,
	},

	// - Settings/Other
	autoLoadMoreReplies: {
		where: 'device',
		default: false,
	},
	autoLoadMoreConversation: {
		where: 'device',
		default: false,
	},
	welcomeBackToast: {
		where: 'device',
		default: true,
	},
	disableNyaize: {
		where: 'device',
		default: false,
	},
	requireRefreshBehavior: {
		where: 'device',
		default: 'dialog' as 'quiet' | 'dialog',
	},
	newNoteReceivedNotificationBehavior: {
		where: 'device',
		default: 'count' as 'default' | 'count' | 'none',
	},
	searchEngine: {
		where: 'device',
		default: 'google' as 'google' | 'bing' | 'yahoo' | 'baidu' | 'naver' | 'daum' | 'duckduckgo' | 'other',
	},
	searchEngineUrl: {
		where: 'device',
		default: 'https://www.ecosia.org/search?',
	},
	searchEngineUrlQuery: {
		where: 'device',
		default: 'q',
	},

	// - Settings/Navigation bar
	bannerDisplay: {
		where: 'device',
		default: 'topBottom' as 'all' | 'topBottom' | 'top' | 'bottom' | 'bg' | 'hide',
	},
	showMenuButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showHomeButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showExploreButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showSearchButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showNotificationButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showChatButtonInNavbar: {
		where: 'device',
		default: false,
	},
	showWidgetButtonInNavbar: {
		where: 'device',
		default: true,
	},
	showPostButtonInNavbar: {
		where: 'device',
		default: true,
	},

	// - Settings/Timeline
	enableHomeTimeline: {
		where: 'device',
		default: true,
	},
	enableLocalTimeline: {
		where: 'device',
		default: true,
	},
	enableSocialTimeline: {
		where: 'device',
		default: true,
	},
	enableGlobalTimeline: {
		where: 'device',
		default: true,
	},
	enableMediaTimeline: {
		where: 'device',
		default: true,
	},
	enableBubbleTimeline: {
		where: 'device',
		default: true,
	},
	enableListTimeline: {
		where: 'device',
		default: true,
	},
	enableAntennaTimeline: {
		where: 'device',
		default: true,
	},
	enableChannelTimeline: {
		where: 'device',
		default: true,
	},

	// - Settings/CherryPick
	nicknameEnabled: {
		where: 'account',
		default: true,
	},
	nicknameMap: {
		where: 'account',
		default: {} as Record<string, string>,
	},
	useEnterToSend: {
		where: 'device',
		default: false,
	},
	postFormVisibilityHotkey: {
		where: 'device',
		default: true,
	},
	showRenoteConfirmPopup: {
		where: 'device',
		default: true,
	},
	expandOnNoteClick: {
		where: 'device',
		default: true,
	},
	expandOnNoteClickBehavior: {
		where: 'device',
		default: 'click' as 'click' | 'doubleClick',
	},
	displayHeaderNavBarWhenScroll: {
		where: 'device',
		default: 'hideHeaderFloatBtn' as 'all' | 'hideHeaderOnly' | 'hideHeaderFloatBtn' | 'hideFloatBtnOnly' | 'hideFloatBtnNavBar' | 'hide',
	},
	reactableRemoteReactionEnabled: {
		where: 'account',
		default: true,
	},
	showFollowingMessageInsteadOfButtonEnabled: {
		where: 'account',
		default: true,
	},
	mobileHeaderChange: {
		where: 'device',
		default: false,
	},
	renameTheButtonInPostFormToNya: {
		where: 'account',
		default: false,
	},
	renameTheButtonInPostFormToNyaManualSet: {
		where: 'account',
		default: false,
	},
	enableWidgetsArea: {
		where: 'device',
		default: true,
	},
	enableLongPressOpenAccountMenu: {
		where: 'device',
		default: true,
	},
	// #endregion
}));

// TODO: 他のタブと永続化されたstateを同期

const PREFIX = 'miux:' as const;

interface Watcher {
	key: string;
	callback: (value: unknown) => void;
}

// TODO: 消す(preferに移行済みのため)
/**
 * 常にメモリにロードしておく必要がないような設定情報を保管するストレージ(非リアクティブ)
 */
export class ColdDeviceStorage {
	public static default = {
		lightTheme, // TODO: 消す(preferに移行済みのため)
		darkTheme, // TODO: 消す(preferに移行済みのため)
		syncDeviceDarkMode: true, // TODO: 消す(preferに移行済みのため)
		plugins: [] as (Omit<Plugin, 'installId'> & { id: string })[], // TODO: 消す(preferに移行済みのため)
	};

	public static watchers: Watcher[] = [];

	public static get<T extends keyof typeof ColdDeviceStorage.default>(key: T): typeof ColdDeviceStorage.default[T] {
		// TODO: indexedDBにする
		//       ただしその際はnullチェックではなくキー存在チェックにしないとダメ
		//       (indexedDBはnullを保存できるため、ユーザーが意図してnullを格納した可能性がある)
		const value = miLocalStorage.getItem(`${PREFIX}${key}`);
		if (value == null) {
			return ColdDeviceStorage.default[key];
		} else {
			return JSON.parse(value);
		}
	}

	public static getAll(): Partial<typeof this.default> {
		return (Object.keys(this.default) as (keyof typeof this.default)[]).reduce<Partial<typeof this.default>>((acc, key) => {
			const value = localStorage.getItem(PREFIX + key);
			if (value != null) {
				acc[key] = JSON.parse(value);
			}
			return acc;
		}, {});
	}

	public static set<T extends keyof typeof ColdDeviceStorage.default>(key: T, value: typeof ColdDeviceStorage.default[T]): void {
		// 呼び出し側のバグ等で undefined が来ることがある
		// undefined を文字列として miLocalStorage に入れると参照する際の JSON.parse でコケて不具合の元になるため無視

		if (value === undefined) {
			console.error(`attempt to store undefined value for key '${key}'`);
			return;
		}

		miLocalStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));

		for (const watcher of this.watchers) {
			if (watcher.key === key) watcher.callback(value);
		}
	}

	public static watch(key, callback) {
		this.watchers.push({ key, callback });
	}

	// TODO: VueのcustomRef使うと良い感じになるかも
	public static ref<T extends keyof typeof ColdDeviceStorage.default>(key: T) {
		const v = ColdDeviceStorage.get(key);
		const r = ref(v);
		// TODO: このままではwatcherがリークするので開放する方法を考える
		this.watch(key, v => {
			r.value = v;
		});
		return r;
	}

	/**
	 * 特定のキーの、簡易的なgetter/setterを作ります
	 * 主にvue場で設定コントロールのmodelとして使う用
	 */
	public static makeGetterSetter<K extends keyof typeof ColdDeviceStorage.default>(key: K) {
		// TODO: VueのcustomRef使うと良い感じになるかも
		const valueRef = ColdDeviceStorage.ref(key);
		return {
			get: () => {
				return valueRef.value;
			},
			set: (value: typeof ColdDeviceStorage.default[K]) => {
				const val = value;
				ColdDeviceStorage.set(key, val);
			},
		};
	}
}
