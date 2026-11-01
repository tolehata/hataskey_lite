/* SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only */
import type { IntroCourse, IntroDetail, IntroFeature } from './content.js';

export const hatagoesFeatures: Record<string, IntroFeature> = {
	goesHome: {
		name: 'HataGoesのホーム', icon: 'home', title: '予定と記録をホームで確認する',
		benefit: 'Hatask・Hatady・HataFeedを切り替えて使えます。ホームでは予定やToDo、きもち、読みかけの本などを確認できます。',
		where: 'メニュー → HataGoes → ホーム',
		steps: ['メニューから「HataGoes」を開きます。', 'ホームで予定や記録を確認します。スマホでは「きょうの記録」の行を押すと、きもち・ごはん・ToDo・水やり・読書の操作が開きます。', 'PCは上部、スマホは下部のボタンから、使いたいアプリを選びます。', 'HataGoesのアイコンでホームへ戻ります。終了するときは左上の×を押します。'],
		note: '「きょうの記録」はきもち・ごはん・ToDo・水やり・読書の記録状況を示します。すべてを毎日そろえる必要はありません。HataFeedなどの表示はサーバーやアカウントの設定によって異なります。',
		source: 'navbar.ts; pages/hatagoes.vue; components/hatagoes/HatagoesHome.vue',
	},
	goesApps: {
		name: 'アプリ一覧と＋メニュー', icon: 'shapes', title: '使いたいアプリを探して＋に追加する',
		benefit: '「すべての App」からアプリを探せます。よく使う項目は＋メニューに8件まで追加できます。',
		where: 'HataGoesのホーム → すべての App ／ ＋ → 編集',
		steps: ['ホームの「すべての App」を開き、名前でアプリを探します。HataIntroもここから開けます。', '使いたいアプリを押して開きます。長押し、または右クリックでは「＋にピン留め」を選べます。', '＋メニューの「編集」から、項目の追加・解除・並べ替えを行います。', '「保存」を押すと、選んだ項目が＋メニューに表示されます。'],
		note: 'ホームの「Favorite App」は、利用状況に合わせて並びます。Hatask内のナビは「全てのアプリ」の鉛筆から編集する別の設定です。「きょう」を含めてスマホは5項目、PCは6項目まで表示でき、「きょう」は外せません。',
		source: 'pages/hatagoes.vue; components/hatagoes/HatagoesScreenPicker.vue; components/hatagoes/HatagoesAppPins.vue; utility/hatagoes-hatask-pins.ts; utility/hatagoes-launcher-usage.ts',
	},
	goesSearch: {
		name: 'HataGoesの横断検索', icon: 'search', title: '予定・本・記録をまとめて探す',
		benefit: '探したい言葉を入力すると、予定やToDo、本、記録、イシューなどをまとめて検索できます。',
		where: 'HataGoes上部 → 虫眼鏡',
		steps: ['上部の虫眼鏡を押し、探したい言葉を入力します。', '必要に応じて、Hatask・Hatady・HataFeed・人から検索対象を選びます。', '結果を押すと、対応するアプリで詳細を開けます。', '詳細を閉じ、別の結果を見たいときは虫眼鏡から検索を開き直します。'],
		note: '詳細を閉じる操作と、前の画面へ戻る←は別です。HataGoesの←は前に開いた画面へ戻り、戻る画面がないときはホームを開きます。',
		source: 'components/hatagoes/HatagoesSearch.vue; pages/hatagoes.vue; utility/hatagoes-search.ts',
	},
	goesSettings: {
		name: 'HataGoesの設定', icon: 'sliders-horizontal', title: 'ホームの見た目とカードを変える',
		benefit: 'ホームのテーマ、カードの表示と並び、＋メニューの項目を自分に合わせて選べます。',
		where: 'HataGoesのホーム → 歯車',
		steps: ['ホームの歯車を押し、HataGoesの設定を開きます。', 'ホーム専用テーマを選びます。明るさは端末に合わせるか、手動で選べます。', '「ホームのカード」で表示・非表示を選び、矢印で順番を変えます。PCではハンドルのドラッグでも並べ替えられます。', '各アプリの設定を変えるときは「各アプリの設定」から選びます。'],
		note: 'ホーム専用テーマはHataGoesのホームにだけ適用されます。スマホでは5つの記録を「きょうの記録」にまとめます。アプリ内の歯車ではアプリの設定と共通設定を選べます。',
		source: 'components/hatagoes/HatagoesSettings.vue; pages/hatagoes.vue; utility/hatagoes-preferences.ts',
	},
};

export const hatagoesGuideDetails: Record<string, IntroDetail> = {
	goesHome: { result: 'ホームのカードとアプリの切り替え場所が分かります。', practice: '図でToDoを完了にし、水やりの表示が変わる様子を試してください。', aliases: 'HataGoes ハタゴーズ ホーム きょうの記録 水やり', related: ['goesApps', 'goesSearch', 'todo', 'hatady'], help: [['スマホではどこから切り替えますか？', '下部のアプリボタンから切り替えます。中央の＋は作成やアプリへの移動に使います。'], ['HataGoesを終了するには？', '左上の×を押します。スマホでは確認画面で「終了する」を選びます。']] },
	goesApps: { result: 'アプリ一覧から目的の画面を開き、＋メニューに追加できます。', practice: '図で＋メニューを編集し、追加・並べ替え・保存を試してください。', aliases: 'アプリ一覧 全てのアプリ すべてのApp ピン留め ＋メニュー ショートカット HataIntro', related: ['goesHome', 'goesSettings'], help: [['アプリが見つからないときは？', 'ホームの「すべての App」で探してください。アプリ内の一覧はそのアプリの項目に絞られます。'], ['項目を外すと記録は消えますか？', '＋メニューから入口を外す操作です。予定や記録は削除されません。']] },
	goesSearch: { result: 'アプリごとに画面を開かず、検索から目的の情報を探せます。', practice: '図で「本」と検索し、対象をHatadyに絞って詳細を開いてください。', aliases: '横断検索 検索 虫眼鏡 記録 作品 本 イシュー 人', related: ['goesHome', 'hatady', 'feed'], help: [['検索結果をもう一度見るには？', '虫眼鏡から検索を開き直します。開いている間の検索語と結果は残ります。'], ['全体のノート検索と同じですか？', 'HataGoesの横断検索はアプリの記録や作品、イシュー、人などを探す機能です。タイムラインのノート検索とは別です。']] },
	goesSettings: { result: 'ホームの見た目と、カードの表示・順番を変更できます。', practice: '図でテーマを切り替え、カードの表示と順番を変えてください。', aliases: 'HataGoes 設定 テーマ カード 並べ替え 表示 非表示 ダークモード', related: ['goesHome', 'goesApps', 'theme'], help: [['アプリを開いているときの歯車は？', 'そのアプリの設定と、HataGoesの共通設定を選ぶ画面が開きます。']] },
};

export const hatagoesCourse: IntroCourse = {
	id: 'hatagoes', label: 'HataGoes', title: 'HataGoes', icon: 'home', tone: 'green',
	desc: 'ホームの見方、アプリの切り替え、横断検索と設定を紹介します。',
	features: ['goesHome', 'goesApps', 'goesSearch', 'goesSettings'],
};

export const hatagoesDestinations: Partial<Record<string, string>> = {
	goesHome: '/hatagoes', goesApps: '/hatagoes?view=screens', goesSearch: '/hatagoes?view=search', goesSettings: '/hatagoes?view=settings',
};
