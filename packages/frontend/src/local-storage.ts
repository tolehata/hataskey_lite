/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type Keys = (
	'v' |
	'basedMisskeyVersion' |
	'lastVersion' |
	'lastBasedMisskeyVersion' |
	'instance' |
	'instanceCachedAt' |
	'account' |
	'latestDonationInfoShownAt' |
	'neverShowDonationInfo' |
	'neverShowLocalOnlyInfo' |
	'modifiedVersionMustProminentlyOfferInAgplV3Section13Read' |
	'lastUsed' |
	'lang' |
	'drafts' |
	'hashtags' |
	'colorScheme' |
	'useSystemFont' |
	'fontSize' |
	'useBoldFont' |
	'ui' |
	'ui_temp' |
	'ui_setup_completed' |
	'bootloaderLocales' |
	'theme' |
	'themeId' |
	'themeCachedVersion' |
	'customCss' |
	'chatMessageDrafts' |
	'scratchpad' |
	'debug' |
	'preferences' |
	'latestPreferencesUpdate' |
	'hidePreferencesRestoreSuggestion' |
	'isSafeMode' |
	'hata_ui_migrated' |
	'hata_gap_body_migrated' |
	'hata_classic_spacing_migrated' |
	'hata_misskeyui_wide_spacing_migrated' |
	'hata_weather_default_off_migrated' |
	'hata_sidebar_v2_migrated' |
	'hata_sidebar_v3_migrated' |
	'hata_sidebar_v4_migrated' |
	'hata_sidebar_v5_migrated' |
	'hata_sidebar_v6_migrated' |
	'hata_docs_cleanup_migrated' |
	'hata_support_cleanup_migrated' |
	`hata_sound_default_migrated:${string}` | // プロファイル・設定キー・適用scopeごと
	`hata_portal_cleanup_migrated:${string}` | // アカウント・プロファイルごと。旧端末共通の完了印は引き継がない
	'hatasabaUiLastTab' | // 旗鯖fork: Hataskey UI で最後に開いていたタブ (再読み込み時の復元用)
	'hatasabaLastListId' | // 旗鯖fork: Hataskey UIで最後に開いたリスト(端末ごと)
	'hatasabaLastAntennaId' | // 旗鯖fork: Hataskey UIで最後に開いたアンテナ(端末ごと)
	'hatasabaDeckIgnoreWidth' | // 旗鯖fork(#6): 画面幅に関係なくデッキ表示を強制する端末ローカル設定(プロファイル非同期)
	'hatasabaTabSwipeEnabled' | // 旗鯖fork: Hataskey UIの左右スワイプによるタブ移動(端末ローカル・既定ON)
	'hataRightWidgetsCollapsed' | // 右ウィジェットバーの開閉。端末ローカル。
	'hataFoldableLayout' | // 旗鯖fork: 横開き折りたたみ端末向けレイアウト(auto/on/off・端末ローカル・プロファイル非同期)
	'hataHideMutedReactions' | // 旗鯖fork(#31): ミュートユーザーのリアクションをチップから隠す端末ローカル設定
	'hataGlassUi' | // 旗鯖fork(ベータ): Hataskey UI 2(グラスモーフィズム刷新)を有効化する端末ローカル設定
	'hataGlassUiBubble' | // 旗鯖fork(ベータ): Hataskey UI 2 でノートの吹き出しデザイン(枠+＜口)を表示する端末ローカル設定
	'hata_muted_reactions_local_migrated' | // 旗鯖fork(#31): 旧設定→端末ローカルへの移行済みフラグ
	'hataWhatsNewShownVersion' | // 旗鯖fork: 「今回の更新内容」を出した旗鯖の版(端末ごと。版が上がると再表示)
	'hata_sidebar_v7_migrated' | // 旗鯖fork: サイドバーへ「キャッシュをクリア」を追加済みか
	'hataPostDelayEnabled' | // 旗鯖fork(ベータ): 投稿前カウントダウンを使うか(端末ローカル)
	'hataPostDelaySeconds' | // 旗鯖fork(ベータ): 投稿前カウントダウンの秒数(3・5・10秒)
	'hataSideStudio' | // 旗鯖fork: HataSideStudio の端末ローカルなプロファイルと拡大/縮小レイアウト
	'hataSideStudioTutorialDone' | // 旗鯖fork: HataSideStudio の初回チュートリアルを完了またはスキップ済みか(端末ローカル)
	'hataskeyUi3MobileOrder' | // UI SのモバイルTLメニュー。上部ナビ設定が変わった場合はその並びを優先する。
	`hataskeyUi3MobileGuideShown:${string}` | // UI Sの長押し案内。端末・アカウントごと。
	`hataNotificationFilterPolicyNoticeShown:${string}` | // 旗鯖fork: 通知フィルタ方針変更の案内を表示済みか(端末・アカウントごと)
	'hataNotificationView' | // 通知画面のブランド・種別フィルタ。端末ローカル。
	`miux:${string}` |
	`ui:folder:${string}` |
	`themes:${string}` | // DEPRECATED
	`aiscript:${string}` |
	`aiscriptSecure:${string}` |
	'lastEmojisFetchedAt' | // DEPRECATED, stored in indexeddb (13.9.0~)
	'emojis' | // DEPRECATED, stored in indexeddb (13.9.0~);
	`channelLastReadedAt:${string}` |
	`idbfallback::${string}` |
	'neverShowNoteEditInfo' |
	'showPushNotificationDialog'
);

// セッション毎に廃棄されるLocalStorage代替（セーフモードなどで使用できそう）
//const safeSessionStorage = new Map<Keys, string>();

export const miLocalStorage = {
	getItem: (key: Keys): string | null => {
		return window.localStorage.getItem(key);
	},
	setItem: (key: Keys, value: string): void => {
		window.localStorage.setItem(key, value);
	},
	removeItem: (key: Keys): void => {
		window.localStorage.removeItem(key);
	},
	getItemAsJson: (key: Keys): any | undefined => {
		const item = miLocalStorage.getItem(key);
		if (item === null) {
			return undefined;
		}
		return JSON.parse(item);
	},
	setItemAsJson: (key: Keys, value: any): void => {
		miLocalStorage.setItem(key, JSON.stringify(value));
	},
};
