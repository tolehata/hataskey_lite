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
	'noteCharmDisplay' |
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
	'loginBonusLastShown' |
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
	'hatafeedTheme' | // HataFeed の表示テーマ。端末ローカル。
	'hatadyTheme' | // 旗鯖fork(Hatady): 表示テーマ(paper/espresso/hataskey)。端末ローカル(端末ごとに好みのテーマを持てる)
	'hatadyLang' | // 旗鯖fork(Hatady): 表示言語(ja/en/auto)。端末ローカル
	'hataEarthquakePref' | // 旗鯖fork(#34): 地震情報のお住いの都道府県(端末ローカルのみ・サーバー非送信)
	'hataEarthquakePollSec' | // 旗鯖fork(#34): 地震情報の取得間隔(秒・端末ローカル)
	'hata_muted_reactions_local_migrated' | // 旗鯖fork(#31): 旧設定→端末ローカルへの移行済みフラグ
	'hataWhatsNewShownVersion' | // 旗鯖fork: 「今回の更新内容」を出した旗鯖の版(端末ごと。版が上がると再表示)
	'hata_hask_tiles_v1_migrated' | // 旗鯖fork(#36): Haskホームの新タイル(feedbackNotif/earthquake)を既存ユーザーに追加済みか
	'hata_sidebar_v7_migrated' | // 旗鯖fork: サイドバーへ「キャッシュをクリア」を追加済みか
	`hata_external_notifications_sidebar_migrated:${string}` | // 旗鯖fork: 外部通知を並び替え可能な保存項目へ移行済みか（アカウント・プロファイルごと）
	'hataPostDelayEnabled' | // 旗鯖fork(ベータ): 投稿前カウントダウンを使うか(端末ローカル)
	'hataPostDelaySeconds' | // 旗鯖fork(ベータ): 投稿前カウントダウンの秒数(3・5・10秒)
	'hataSideStudio' | // 旗鯖fork: HataSideStudio の端末ローカルなプロファイルと拡大/縮小レイアウト
	'hataSideStudioUiS' | // 旗鯖fork: UI S 専用のHataSideStudio構成（初回のみ旧UIから複製）
	'hataSideStudioTutorialDone' | // 旗鯖fork: HataSideStudio の初回チュートリアルを完了またはスキップ済みか(端末ローカル)
	'hataskeyUi3Tab' | // 旗鯖fork: Hataskey UI 3 で最後に開いたタイムラインのタブ(端末ローカル)
	'hataskeyUi3Live' | // 旗鯖fork: Hataskey UI 3 のLIVE表示(新着を即時にタイムラインへ差し込む)を使うか(端末ローカル)
	'hataskeyUi3DeckMode' | // 旗鯖fork: Hataskey UI 3 でデッキ表示を使うか(端末ローカル)
	'hataskeyUi3PaneTab' | // 旗鯖fork: Hataskey UI 3 の右ペインで開いているタブ(ウィジェット/Hatask)(端末ローカル)
	'hataskeyUiSDisplaySize' | // UI S専用の表示サイズ(端末ローカル・プロファイル非同期)
	'hataskeyUi3MobileOrder' | // UI SのモバイルTLメニュー。上部ナビ設定が変わった場合はその並びを優先する。
	`hataskeyUi3MobileGuideShown:${string}` | // UI Sの長押し案内。端末・アカウントごと。
	`hataNotificationFilterPolicyNoticeShown:${string}` | // 旗鯖fork: 通知フィルタ方針変更の案内を表示済みか(端末・アカウントごと)
	'hataNotificationView' | // 通知画面のブランド・種別フィルタ。端末ローカル。
	`hatalyzeNoticeAcceptedV1:${string}` | // Hataskey fork: HATAlyzeの初回注意書きを確認済みか(端末・アカウントごと)
	`hatalyzeNoticeSyncedV1:${string}` | // Hataskey fork: HATAlyze注意書き確認をアカウントのRegistryへ同期済みか
	`hatalyzeCooldownV1:${string}` | // Hataskey fork: HATAlyzeの次回利用可能時刻(端末・アカウントごと)
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
	| `hataFormDrafts:${string}` // 旗鯖fork: HataFeed/Hatady 独自フォームの端末・アカウント別下書き
	| `hataskAkatsukiUsage:${string}` // 暁ホームのツール利用頻度（端末・アカウント別）
	| `hatagoes:${'state' | 'create' | 'scroll'}:${string}` // HataGoes の端末・アカウント別画面キャッシュ
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
