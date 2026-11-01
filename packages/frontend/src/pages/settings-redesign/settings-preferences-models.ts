/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Explicit model registry for the redesigned preferences surface.  Every
 * profile preference is named at the call site on purpose; a dynamic
 * prefer.model(key) fallback would silently lose persistence semantics when a
 * key is renamed or a setting is device-local.
 */
import { computed, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { PreferenceContainerKey } from './settings-preferences-catalog.js';
import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { globalEvents } from '@/events.js';
import { genId } from '@/utility/id.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { suggestReload } from '@/utility/reload-suggest.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { claimAchievement } from '@/utility/achievements.js';
import { instance } from '@/instance.js';
import { useHorizontalSwipeModel } from '@/utility/horizontal-swipe-preference.js';

export type DataSaverKey = 'media' | 'avatar' | 'disableUrlPreview' | 'urlPreviewThumbnail' | 'code';
export type DataSaverState = Record<DataSaverKey, boolean>;

function unknownRef<T>(value: Ref<T>): Ref<unknown> {
	return value as unknown as Ref<unknown>;
}

export type SettingsPreferenceModels = {
	controls: Record<PreferenceContainerKey, Ref<unknown>>;
	lang: Ref<string | null>;
	overridedDeviceKind: Ref<unknown>;
	realtimeMode: Ref<boolean>;
	useBoldFont: Ref<boolean>;
	useSystemFont: Ref<boolean>;
	fontSizeBefore: Ref<string | null>;
	dataSaver: Ref<DataSaverState>;
	trustedDomains: Ref<string>;
	trustedDomainsChanged: Ref<boolean>;
	externalNavigationWarning: Ref<unknown>;
	searchEngine: Ref<unknown>;
	searchEngineUrl: Ref<unknown>;
	searchEngineUrlQuery: Ref<unknown>;
	setAllDataSaver: (value: boolean) => void;
	setPinnedList: () => Promise<void>;
	removePinnedList: () => void;
	testNotification: () => void;
	downloadEmojiIndex: (language: typeof emojiIndexLangs[number]) => void;
	removeEmojiIndex: (language: typeof emojiIndexLangs[number]) => void;
	chooseNewReaction: (event: MouseEvent) => void;
	resetReaction: () => void;
	saveTrustedDomains: () => Promise<void>;
	clearTrustedDomains: () => Promise<void>;
	reload: () => void;
	cantUseSetFederationAvatarShape: () => Promise<void>;
	learnMoreCantUseSetFederationAvatarShape: () => void;
};

export const emojiIndexLangs = ['en-US', 'ja-JP', 'ja-JP_hira'] as const;

export function createSettingsPreferenceModels(): SettingsPreferenceModels {
	const lang = ref(miLocalStorage.getItem('lang'));
	const fontSizeBefore = ref(miLocalStorage.getItem('fontSize'));
	const useBoldFont = ref(miLocalStorage.getItem('useBoldFont') === 'true');
	const useSystemFont = ref(miLocalStorage.getItem('useSystemFont') != null);
	const realtimeMode = computed(store.makeGetterSetter('realtimeMode'));
	const dataSaver = ref<DataSaverState>({ ...prefer.s.dataSaver });
	const trustedDomains = ref(prefer.s.trustedDomains.join('\n'));
	const trustedDomainsChanged = ref(false);

	/* Keep this map exhaustive and literal. Do not replace it with a key loop. */
	const controls = {
		advancedMfm: unknownRef(prefer.model('advancedMfm')),
		allMediaNoteCollapse: unknownRef(prefer.model('allMediaNoteCollapse')),
		alwaysConfirmFollow: unknownRef(prefer.model('alwaysConfirmFollow')),
		alwaysShowCw: unknownRef(prefer.model('alwaysShowCw')),
		animatedMfm: unknownRef(prefer.model('animatedMfm')),
		animation: unknownRef(prefer.model('animation', value => !value, value => !value)),
		autoLoadMoreConversation: unknownRef(prefer.model('autoLoadMoreConversation')),
		autoLoadMoreReplies: unknownRef(prefer.model('autoLoadMoreReplies')),
		'chat.sendOnEnter': unknownRef(prefer.model('chat.sendOnEnter')),
		'chat.showSenderName': unknownRef(prefer.model('chat.showSenderName')),
		collapseDefault: unknownRef(prefer.model('collapseDefault')),
		collapseLongNoteContent: unknownRef(prefer.model('collapseLongNoteContent')),
		collapseRenotes: unknownRef(prefer.model('collapseRenotes')),
		collapseReplies: unknownRef(prefer.model('collapseReplies')),
		confirmOnReact: unknownRef(prefer.model('confirmOnReact')),
		confirmWhenRevealingSensitiveMedia: unknownRef(prefer.model('confirmWhenRevealingSensitiveMedia')),
		contextMenu: unknownRef(prefer.model('contextMenu')),
		defaultFollowWithReplies: unknownRef(prefer.model('defaultFollowWithReplies')),
		defaultNoteLocalOnly: unknownRef(prefer.model('defaultNoteLocalOnly')),
		defaultNoteVisibility: unknownRef(prefer.model('defaultNoteVisibility')),
		disableNyaize: unknownRef(prefer.model('disableNyaize')),
		disableShowingAnimatedImages: unknownRef(prefer.model('disableShowingAnimatedImages')),
		emojiStyle: unknownRef(prefer.model('emojiStyle')),
		enableAbsoluteTime: unknownRef(prefer.model('enableAbsoluteTime')),
		enableHighQualityImagePlaceholders: unknownRef(prefer.model('enableHighQualityImagePlaceholders')),
		enableHorizontalSwipe: unknownRef(useHorizontalSwipeModel()),
		enableInfiniteScroll: unknownRef(prefer.model('enableInfiniteScroll')),
		enableMarkByDate: unknownRef(prefer.model('enableMarkByDate')),
		enablePullToRefresh: unknownRef(prefer.model('enablePullToRefresh')),
		enableQuickAddMfmFunction: unknownRef(prefer.model('enableQuickAddMfmFunction')),
		enableSeasonalScreenEffect: unknownRef(prefer.model('enableSeasonalScreenEffect')),
		filesGridLayoutInUserPage: unknownRef(prefer.model('filesGridLayoutInUserPage')),
		fontSize: unknownRef(prefer.model('fontSize')),
		forceCollapseAllRenotes: unknownRef(prefer.model('forceCollapseAllRenotes')),
		forceRenoteVisibilitySelection: unknownRef(prefer.model('forceRenoteVisibilitySelection')),
		forceShowAds: unknownRef(prefer.model('forceShowAds')),
		hemisphere: unknownRef(prefer.model('hemisphere')),
		hideAvatarsInNote: unknownRef(prefer.model('hideAvatarsInNote')),
		highlightSensitiveMedia: unknownRef(prefer.model('highlightSensitiveMedia')),
		imageNewTab: unknownRef(prefer.model('imageNewTab')),
		infoButtonForNoteActionsEnabled: unknownRef(prefer.model('infoButtonForNoteActionsEnabled')),
		instanceTicker: unknownRef(prefer.model('instanceTicker')),
		hataskeyUi3TimelineBackground: unknownRef(prefer.model('hataskeyUi3TimelineBackground')),
		hataskeyUi3SideMenuBackground: unknownRef(prefer.model('hataskeyUi3SideMenuBackground')),
		hataskeyUi3RightPaneBackground: unknownRef(prefer.model('hataskeyUi3RightPaneBackground')),
		hataskeyUi3GlassDensity: unknownRef(prefer.model('hataskeyUi3GlassDensity')),
		hataskeyUi3ComposerShortcut1: unknownRef(prefer.model('hataskeyUi3ComposerShortcut1')),
		hataskeyUi3ComposerShortcut2: unknownRef(prefer.model('hataskeyUi3ComposerShortcut2')),
		hataskeyUi3ComposerEmojiPosition: unknownRef(prefer.model('hataskeyUi3ComposerEmojiPosition')),
		hataskeyUi3ComposerPosition: unknownRef(prefer.model('hataskeyUi3ComposerPosition')),
		'postFormVisibilityBorder.enabled': unknownRef(prefer.model('postFormVisibilityBorder.enabled')),
		'postFormVisibilityBorder.width': unknownRef(prefer.model('postFormVisibilityBorder.width')),
		'postFormVisibilityBorder.color.public': unknownRef(prefer.model('postFormVisibilityBorder.color.public')),
		'postFormVisibilityBorder.color.home': unknownRef(prefer.model('postFormVisibilityBorder.color.home')),
		'postFormVisibilityBorder.color.followers': unknownRef(prefer.model('postFormVisibilityBorder.color.followers')),
		'postFormVisibilityBorder.color.specified': unknownRef(prefer.model('postFormVisibilityBorder.color.specified')),
		hataskeyUi3RssEnabled: unknownRef(prefer.model('hataskeyUi3RssEnabled')),
		hataskeyUi3RssFeeds: unknownRef(prefer.model('hataskeyUi3RssFeeds')),
		hataskeyUi3RssAutoSwitch: unknownRef(prefer.model('hataskeyUi3RssAutoSwitch')),
		hataskeyUi3RssReadSeconds: unknownRef(prefer.model('hataskeyUi3RssReadSeconds')),
		hataskeyUi3RssReadMode: unknownRef(prefer.model('hataskeyUi3RssReadMode')),
		keepCw: unknownRef(prefer.model('keepCw')),
		keepScreenOn: unknownRef(prefer.model('keepScreenOn')),
		limitWidthOfReaction: unknownRef(prefer.model('limitWidthOfReaction')),
		loadRawImages: unknownRef(prefer.model('loadRawImages')),
		ltlEmojiVoteEnabled: unknownRef(prefer.model('ltlEmojiVoteEnabled')),
		makeEveryTextElementsSelectable: unknownRef(prefer.model('makeEveryTextElementsSelectable')),
		mediaListWithOneImageAppearance: unknownRef(prefer.model('mediaListWithOneImageAppearance')),
		menuStyle: unknownRef(prefer.model('menuStyle')),
		newNoteReceivedNotificationBehavior: unknownRef(prefer.model('newNoteReceivedNotificationBehavior')),
		notificationPosition: unknownRef(prefer.model('notificationPosition')),
		emojiAdditionNotice: unknownRef(prefer.model('emojiAdditionNotice')),
		hourlyTimeNotice: unknownRef(prefer.model('hourlyTimeNotice')),
		notificationStackAxis: unknownRef(prefer.model('notificationStackAxis')),
		nsfw: unknownRef(prefer.model('nsfw')),
		nsfwOpenBehavior: unknownRef(prefer.model('nsfwOpenBehavior')),
		numberOfPageCache: unknownRef(prefer.model('numberOfPageCache')),
		pollingInterval: unknownRef(prefer.model('pollingInterval')),
		reactionsDisplaySize: unknownRef(prefer.model('reactionsDisplaySize')),
		rememberNoteVisibility: unknownRef(prefer.model('rememberNoteVisibility')),
		removeModalBgColorForBlur: unknownRef(prefer.model('removeModalBgColorForBlur')),
		renoteQuoteButtonSeparation: unknownRef(prefer.model('renoteQuoteButtonSeparation')),
		renoteVisibilitySelection: unknownRef(prefer.model('renoteVisibilitySelection')),
		requireRefreshBehavior: unknownRef(prefer.model('requireRefreshBehavior')),
		selectReaction: unknownRef(prefer.model('selectReaction')),
		serverDisconnectedBehavior: unknownRef(prefer.model('serverDisconnectedBehavior')),
		setFederationAvatarShape: unknownRef(prefer.model('setFederationAvatarShape')),
		showAvailableReactionsFirstInNote: unknownRef(prefer.model('showAvailableReactionsFirstInNote')),
		showAvatarDecorations: unknownRef(prefer.model('showAvatarDecorations')),
		showClipButtonInNoteFooter: unknownRef(prefer.model('showClipButtonInNoteFooter')),
		showDoReactionButtonInNoteFooter: unknownRef(prefer.model('showDoReactionButtonInNoteFooter')),
		showFixedPostForm: unknownRef(prefer.model('showFixedPostForm')),
		showFixedPostFormInChannel: unknownRef(prefer.model('showFixedPostFormInChannel')),
		showFixedPostFormInReplies: unknownRef(prefer.model('showFixedPostFormInReplies')),
		showGapBetweenNotesInTimeline: unknownRef(prefer.model('showGapBetweenNotesInTimeline')),
		showGapBodyOfTheNote: unknownRef(prefer.model('showGapBodyOfTheNote')),
		showMoreButtonInNoteFooter: unknownRef(prefer.model('showMoreButtonInNoteFooter')),
		showNoAltTextWarning: unknownRef(prefer.model('showNoAltTextWarning')),
		showNoteActionsOnlyHover: unknownRef(prefer.model('showNoteActionsOnlyHover')),
		showPageTabBarBottom: unknownRef(prefer.model('showPageTabBarBottom')),
		showPreview: unknownRef(prefer.model('showPreview')),
		showProfilePreview: unknownRef(prefer.model('showProfilePreview')),
		showQuoteButtonInNoteFooter: unknownRef(prefer.model('showQuoteButtonInNoteFooter')),
		showReactionsCount: unknownRef(prefer.model('showReactionsCount')),
		showRenoteButtonInNoteFooter: unknownRef(prefer.model('showRenoteButtonInNoteFooter')),
		showReplyButtonInNoteFooter: unknownRef(prefer.model('showReplyButtonInNoteFooter')),
		showReplyInNotification: unknownRef(prefer.model('showReplyInNotification')),
		showReplyTargetNote: unknownRef(prefer.model('showReplyTargetNote')),
		showReplyTargetNoteInSemiTransparent: unknownRef(prefer.model('showReplyTargetNoteInSemiTransparent')),
		showSubNoteFooterButton: unknownRef(prefer.model('showSubNoteFooterButton')),
		showTitlebar: unknownRef(prefer.model('showTitlebar')),
		showUnreadNotificationsCount: unknownRef(prefer.model('showUnreadNotificationsCount')),
		showingAnimatedImages: unknownRef(prefer.model('showingAnimatedImages')),
		smoothTransitionAnimations: unknownRef(prefer.model('smoothTransitionAnimations', value => !value, value => !value)),
		squareAvatars: unknownRef(prefer.model('squareAvatars')),
		useBlurEffect: unknownRef(prefer.model('useBlurEffect')),
		useBlurEffectForModal: unknownRef(prefer.model('useBlurEffectForModal')),
		useGroupedNotifications: unknownRef(prefer.model('useGroupedNotifications')),
		useNativeUiForVideoAudioPlayer: unknownRef(prefer.model('useNativeUiForVideoAudioPlayer')),
		useReactionPickerForContextMenu: unknownRef(prefer.model('useReactionPickerForContextMenu')),
		useStickyIcons: unknownRef(prefer.model('useStickyIcons')),
		welcomeBackToast: unknownRef(prefer.model('welcomeBackToast')),
	};

	const externalNavigationWarning = unknownRef(prefer.model('externalNavigationWarning'));
	const overridedDeviceKind = unknownRef(prefer.model('overridedDeviceKind'));
	const searchEngine = unknownRef(computed(store.makeGetterSetter('searchEngine')));
	const searchEngineUrl = unknownRef(computed(store.makeGetterSetter('searchEngineUrl')));
	const searchEngineUrlQuery = unknownRef(computed(store.makeGetterSetter('searchEngineUrlQuery')));

	watch(lang, value => {
		miLocalStorage.setItem('lang', value as string);
	});
	watch(controls.fontSize, value => {
		if (value == null) miLocalStorage.removeItem('fontSize');
		else miLocalStorage.setItem('fontSize', String(value));
	});
	watch(useBoldFont, value => {
		if (value) miLocalStorage.setItem('useBoldFont', `${value}`);
		else miLocalStorage.removeItem('useBoldFont');
	});
	watch(useSystemFont, value => {
		if (value) miLocalStorage.setItem('useSystemFont', 't');
		else miLocalStorage.removeItem('useSystemFont');
	});
	onMounted(() => {
		if (fontSizeBefore.value == null) fontSizeBefore.value = String(controls.fontSize.value);
	});

	watch([controls.squareAvatars, controls.setFederationAvatarShape], () => {
		void misskeyApi('i/update', {
			setFederationAvatarShape: Boolean($i?.policies.canSetFederationAvatarShape && controls.setFederationAvatarShape.value),
			isSquareAvatars: Boolean(controls.squareAvatars.value),
		});
	});

	watch([
		controls.hemisphere,
		lang,
		realtimeMode,
		controls.pollingInterval,
		controls.showNoteActionsOnlyHover,
		overridedDeviceKind,
		controls.alwaysConfirmFollow,
		controls.confirmWhenRevealingSensitiveMedia,
		controls.showGapBetweenNotesInTimeline,
		controls.squareAvatars,
		controls.enableSeasonalScreenEffect,
		controls['chat.showSenderName'],
		controls.useStickyIcons,
		controls.enableHighQualityImagePlaceholders,
		controls.disableShowingAnimatedImages,
		controls.keepScreenOn,
		controls.contextMenu,
		useSystemFont,
		controls.makeEveryTextElementsSelectable,
		controls.enableHorizontalSwipe,
		controls.showPageTabBarBottom,
		controls.enablePullToRefresh,
		controls.animation,
		controls.showAvailableReactionsFirstInNote,
		controls.animatedMfm,
		controls.advancedMfm,
		controls.showFixedPostFormInReplies,
		controls.useBlurEffect,
		controls.useBlurEffectForModal,
		controls.removeModalBgColorForBlur,
		useBoldFont,
		controls.setFederationAvatarShape,
		controls.showUnreadNotificationsCount,
		controls.filesGridLayoutInUserPage,
		controls.showingAnimatedImages,
		controls.smoothTransitionAnimations,
	], () => suggestReload());

	watch([
		controls.hideAvatarsInNote,
		controls.mediaListWithOneImageAppearance,
		controls.reactionsDisplaySize,
		controls.limitWidthOfReaction,
		controls.instanceTicker,
		controls.highlightSensitiveMedia,
		controls.enableAbsoluteTime,
		controls.enableMarkByDate,
		controls.showReplyTargetNote,
		controls.showReplyTargetNoteInSemiTransparent,
		controls.collapseLongNoteContent,
		controls.collapseDefault,
		controls.showNoteActionsOnlyHover,
		controls.showClipButtonInNoteFooter,
		controls.showReplyInNotification,
		controls.showGapBodyOfTheNote,
		controls.showSubNoteFooterButton,
		controls.infoButtonForNoteActionsEnabled,
		controls.renoteQuoteButtonSeparation,
		controls.allMediaNoteCollapse,
		controls.alwaysShowCw,
		controls.showReplyButtonInNoteFooter,
		controls.showRenoteButtonInNoteFooter,
		controls.showDoReactionButtonInNoteFooter,
		controls.showQuoteButtonInNoteFooter,
		controls.showMoreButtonInNoteFooter,
	], () => {
		globalEvents.emit('reloadTimeline');
		globalEvents.emit('reloadNotification');
	});
	watch([
		controls.enableInfiniteScroll,
		controls.disableNyaize,
		controls.forceCollapseAllRenotes,
		controls.collapseRenotes,
		controls.collapseReplies,
	], () => globalEvents.emit('reloadTimeline'));
	watch([controls.showReplyInNotification], () => globalEvents.emit('reloadNotification'));
	watch(dataSaver, value => prefer.commit('dataSaver', value), { deep: true });
	watch(trustedDomains, () => { trustedDomainsChanged.value = true; });

	let smashCount = 0;
	let smashTimer: number | null = null;

	function testNotification(): void {
		const notification: Misskey.entities.Notification = {
			id: genId(),
			createdAt: new Date().toUTCString(),
			type: 'test',
		};
		globalEvents.emit('clientNotification', notification);
		smashCount++;
		if (smashCount >= 10) {
			claimAchievement('smashTestNotificationButton');
			smashCount = 0;
		}
		if (smashTimer != null) window.clearTimeout(smashTimer);
		smashTimer = window.setTimeout(() => { smashCount = 0; }, 300);
	}

	async function setPinnedList(): Promise<void> {
		const lists = await misskeyApi('users/lists/list');
		const { canceled, result } = await os.select({
			title: i18n.ts.selectList,
			items: lists.map(list => ({ value: list.id, label: list.name })),
		});
		if (canceled || result == null) return;
		const selected = lists.find(list => list.id === result);
		if (selected != null) prefer.commit('pinnedUserLists', [selected]);
	}

	function removePinnedList(): void {
		prefer.commit('pinnedUserLists', []);
	}

	function setAllDataSaver(value: boolean): void {
		dataSaver.value = {
			media: value,
			avatar: value,
			disableUrlPreview: value,
			urlPreviewThumbnail: value,
			code: value,
		};
	}

	function downloadEmojiIndex(language: typeof emojiIndexLangs[number]): void {
		os.promiseDialog((async () => {
			const indexes = store.s.additionalUnicodeEmojiIndexes;
			const loaders = {
				'en-US': () => import('@misskey-dev/emoji-data/indexes/en-US.json'),
				'ja-JP': () => import('@misskey-dev/emoji-data/indexes/ja-JP.json'),
				'ja-JP_hira': () => import('@misskey-dev/emoji-data/indexes/ja-JP_hira.json'),
			};
			indexes[language] = (await loaders[language]()).default;
			await store.set('additionalUnicodeEmojiIndexes', indexes);
		})());
	}

	function removeEmojiIndex(language: typeof emojiIndexLangs[number]): void {
		os.promiseDialog((async () => {
			const indexes = store.s.additionalUnicodeEmojiIndexes;
			delete indexes[language];
			await store.set('additionalUnicodeEmojiIndexes', indexes);
		})());
	}

	async function chooseNewReaction(event: MouseEvent): Promise<void> {
		const target = (event.currentTarget ?? event.target) as HTMLElement;
		const emoji = await os.pickEmoji(target, { showPinned: false });
		if (emoji != null) controls.selectReaction.value = emoji as string;
	}

	function resetReaction(): void {
		controls.selectReaction.value = '';
	}

	async function clearTrustedDomains(): Promise<void> {
		await os.promiseDialog((async () => {
			await prefer.commit('trustedDomains', []);
			trustedDomains.value = '';
		})());
	}

	async function saveTrustedDomains(): Promise<void> {
		await os.promiseDialog((async () => {
			const domains = trustedDomains.value.trim().split('\n').map(value => value.trim()).filter(Boolean);
			await prefer.commit('trustedDomains', domains);
			trustedDomainsChanged.value = false;
			trustedDomains.value = domains.join('\n');
		})());
	}

	async function cantUseSetFederationAvatarShape(): Promise<void> {
		if (!$i?.policies.canSetFederationAvatarShape && Boolean(controls.setFederationAvatarShape.value)) controls.setFederationAvatarShape.value = false;
	}

	function learnMoreCantUseSetFederationAvatarShape(): void {
		void os.alert({
			type: 'info',
			title: i18n.ts.setFederationAvatarShape,
			text: i18n.tsx.cantUseThisFunctionDescription({ name: i18n.ts.setFederationAvatarShape }),
			caption: i18n.tsx.cantUseThisFunctionCaption({ name: i18n.ts.setFederationAvatarShape }),
		});
	}

	function reload(): void {
		unisonReload();
	}

	return {
		controls,
		lang,
		overridedDeviceKind,
		realtimeMode,
		useBoldFont,
		useSystemFont,
		fontSizeBefore,
		dataSaver,
		trustedDomains,
		trustedDomainsChanged,
		externalNavigationWarning,
		searchEngine,
		searchEngineUrl,
		searchEngineUrlQuery,
		setAllDataSaver,
		setPinnedList,
		removePinnedList,
		testNotification,
		downloadEmojiIndex,
		removeEmojiIndex,
		chooseNewReaction,
		resetReaction,
		saveTrustedDomains,
		clearTrustedDomains,
		reload,
		cantUseSetFederationAvatarShape,
		learnMoreCantUseSetFederationAvatarShape,
	};
}

export function isFederationAvatarShapeAvailable(): boolean {
	return Boolean($i?.policies.canSetFederationAvatarShape);
}

export function canUseUrlPreview(): boolean {
	return instance.enableUrlPreview;
}
