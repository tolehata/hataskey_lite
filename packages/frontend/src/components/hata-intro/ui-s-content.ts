/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { IntroCourse, IntroDetail as GuideDetail, IntroFeature } from './content.js';

export const uiSFeatures: Record<string, IntroFeature> = {
	uiSOverview: {
		name: 'UI S の画面と切り替え', icon: 'panels-top-left', title: 'UI S のタイムライン',
		benefit: 'PCの右側メニューとスマホの上部タブから、読むタイムラインを選べます。',
		where: 'メニュー → UI切り替え → Hataskey UI S',
		steps: ['メニューの「UI切り替え」で「Hataskey UI S」を選ぶと、画面が読み込み直されます。', 'PCではタイムライン右端のアイコンを選びます。マウスを重ねると項目名が表示されます。', 'スマホでは上部のタブで切り替えます。下部のホームを長押しすると、タイムラインの一覧が開きます。', 'ホームの長押しから指を滑らせて選ぶこともできます。短くタップすると先頭に戻ります。'],
		note: '表示する項目は設定やサーバーの利用条件によって変わります。図の「PC」「スマホ」で配置の違いを見比べられます。',
		source: 'components/MkUISetup.vue; components/hataskey3/Hk3App.vue; components/hataskey3/Hk3Timeline.vue; components/hataskey3/Hk3MobileDock.vue',
	},
	uiSPost: {
		name: 'UI S から投稿する', icon: 'square-pen', title: 'UI S の投稿欄',
		benefit: '本文の下にある道具で添付や公開範囲を選び、紙飛行機のボタンから投稿します。',
		where: 'PC：タイムラインの投稿欄 ／ スマホ：下部の鉛筆',
		steps: ['PCではタイムラインの投稿欄に本文を書きます。スマホでは下部の鉛筆を押して開きます。', '画像はクリップの「添付」、絵文字は顔のボタンから追加できます。投票やお絵描きは「投稿機能」にあります。', '投稿欄の下部で公開範囲と「連合あり／連合なし」を確認します。ダイレクトでは宛先も選びます。', '本文と添付を見直して、右端の紙飛行機を押します。PCではCtrl＋Enter、Macでは⌘＋Enterでも送信できます。'],
		note: '「ホーム」は非公開ではありません。「連合なし」も、誰が読めるかを決める公開範囲とは別の設定です。図の投稿は練習用で、サーバーには送信しません。',
		source: 'components/hataskey3/Hk3Composer.vue; components/hataskey3/hk3-composer-tools.ts; components/hataskey3/Hk3MobileDock.vue',
	},
	uiSWorkspace: {
		name: 'UI S の左右表示とデッキ', icon: 'columns-3', title: '画面を並べて使う',
		benefit: 'PCでは別のページとタイムラインを並べたり、デッキで複数の列を表示したりできます。',
		where: 'PCのサイドメニュー ／ ホーム画面の左下 → デッキ',
		steps: ['サイドメニューからページを開くと、対応する画面ではタイムラインと左右に並びます。', 'ページを広く使うときは「全画面で表示」を押します。「左右表示に戻す」で元の配置に戻せます。', '「閉じてタイムラインに戻る」を押すと、開いたページを閉じます。', '複数の列を使うときは、ホーム画面の左下から「デッキ」を選びます。「標準」で通常の表示に戻せます。'],
		note: 'デッキは幅のあるPC画面で利用できます。スマホは1画面ずつ表示します。HataGoesなど、独自のナビゲーションを持つ画面は全面に表示されます。',
		source: 'components/hataskey3/Hk3App.vue; components/hataskey3/Hk3SideWorkspace.vue; components/hataskey3/use-hk3-side-page.ts; components/hataskey3/Hk3SideNav.vue',
	},
	uiSSettings: {
		name: 'UI S を使いやすくする', icon: 'sliders-horizontal', title: 'UI S の設定',
		benefit: '文字の大きさや背景、投稿欄の位置、スマホの下部ナビを調整できます。',
		where: '設定 → Hataskey UI S',
		steps: ['設定の「Hataskey UI S」を開きます。見つからない項目は設定内の検索で探せます。', '「表示サイズ」やすりガラスの背景を選びます。PC・タブレットでは投稿欄を上か下に配置できます。', '「下部ナビバー (モバイル)」では、ホームを含む最大5項目の表示と並び順を変えられます。PCからも編集できます。', 'よく使う投稿機能は2つのショートカット枠へ置けます。変更はその場で保存されます。'],
		note: 'スマホの投稿欄は下部に固定されます。RSSを読みたいときは同じ設定内の「RSS」、またはタイムラインの「…」→「RSS」からフィードを登録します。図の設定は本体には反映されません。',
		source: 'pages/settings-redesign/SettingsPreferencesSurface.vue; pages/settings-redesign/HataskeyUiSBottomNavSettings.vue; pages/settings-redesign/HataskeyUiSRssSettings.vue; locales/ja-JP.yml:_hataskeyUi3',
	},
};

export const uiSGuideDetails: Record<string, GuideDetail> = {
	uiSOverview: {
		result: '画面幅によって、タイムラインを選ぶ場所が変わることを確認できます。',
		practice: '図の「PC」「スマホ」を切り替え、ホームとローカルを選んでみてください。スマホの例ではホームの長押し、または「一覧を開く」で一覧も試せます。',
		aliases: 'Hataskey UI S UIS UI3 切り替え タイムライン ホーム ローカル 長押し メニュー', related: ['uiSPost', 'uiSWorkspace', 'uiSSettings'],
		help: [['PCで上部にタブがありません', 'UI S のPC表示ではタイムライン右端の縦メニューから切り替えます。'], ['以前の画面へ戻れますか？', 'メニューの「UI切り替え」を開き、「Hataskey UI」を選びます。'], ['ローカルなどの項目が見つかりません', 'タイムラインの表示設定やサーバー側の利用条件によって、使える項目が異なります。']],
	},
	uiSPost: {
		result: '公開範囲と連合の設定を別々に確認し、送信ボタンの位置を覚えられます。',
		practice: '練習用の本文を書き、公開範囲を変更して紙飛行機を押してください。図の中だけに結果を表示します。',
		aliases: 'UI S 投稿 フォーム 紙飛行機 画像 添付 公開範囲 連合 MFM Hatadint', related: ['composer', 'visibility', 'attach', 'uiSSettings'],
		help: [['投票やMFMのボタンが見つかりません', '投稿欄左下の「投稿機能」を開きます。「フォームを広げる」から通常の投稿画面へ移ることもできます。'], ['投稿欄が上にあります', 'PC・タブレットでは設定の「Hataskey UI S の投稿フォームの位置」で上下を選べます。'], ['スマホでショートカットが見えません', 'スマホの投稿欄では2つのショートカット枠を表示しません。「投稿機能」から選べます。']],
	},
	uiSWorkspace: {
		result: '左右表示・全画面・デッキを使い分け、通常のタイムラインへ戻せます。',
		practice: '図の「通知」を開き、全画面への切り替えと閉じる操作を試してください。そのあと「デッキ」で列を並べられます。',
		aliases: 'UI S デッキ カラム 左右表示 全画面 閉じる ウィジェット Hatask', related: ['deck', 'uiSOverview', 'uiSPost'],
		help: [['デッキを選べません', 'ホーム画面へ戻り、画面を広げてください。UI S のスマホ表示ではデッキを利用できません。'], ['デッキで投稿したいときは？', '左下の鉛筆を押すと投稿用の小窓が開きます。上の持ち手で移動でき、「左下に戻す」で位置を戻せます。'], ['右側のHataskは何に使いますか？', '幅の広い画面では「ウィジェット」と「Hatask」を切り替えられます。Hataskでは今日の予定や記録を確認し、終わったToDoにチェックを付けられます。']],
	},
	uiSSettings: {
		result: 'UI S の設定はその場で保存されることと、スマホ用の設定をPCからも編集できることが分かります。',
		practice: '図の表示サイズや投稿欄の位置を変えてください。下部ナビの表示スイッチと上下ボタンも試せます。',
		aliases: 'UI S 設定 下部ナビ モバイル 並び替え RSS 表示サイズ 背景 ショートカット', related: ['uiSOverview', 'uiSPost', 'theme', 'layout'],
		help: [['保存ボタンはどこですか？', 'UI S の設定は変更するとすぐに保存されます。従来のHataskey UIの設定画面とは保存方法が異なります。'], ['下部ナビの項目を追加できません', 'ホームを含む最大5項目です。先に別の項目を非表示にしてください。左端のメニューとホームは非表示にできません。'], ['RSSのURLを追加したい', '「RSS」でフィードURLを入力し、「追加して保存」を押します。登録後の編集は自動保存されます。デッキのRSS設定とは別に管理されます。']],
	},
};

export const uiSCourse: IntroCourse = {
	id: 'uis', label: 'Hataskey UI S', title: 'Hataskey UI S',
	desc: 'PCとスマホの操作、投稿欄、左右表示とデッキ、画面の設定',
	icon: 'panels-top-left', tone: 'blue', features: ['uiSOverview', 'uiSPost', 'uiSWorkspace', 'uiSSettings'],
};

export const uiSDestinations: Partial<Record<string, string>> = {
	uiSSettings: '/settings/preferences?destination=hataskey-ui-s',
};
