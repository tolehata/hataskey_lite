/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { hataskGuideProse, escapeHtml as esc, brandName, icon } from './prose.js';
import { note } from './note-scenes.js';

export const composerTools = [
	['cancel', 'x', '閉じる', '投稿画面を閉じる。本体では未投稿の内容がある場合、確認が出ることがある'],
	['account', 'user-circle', '投稿するアカウント', '左上のアバターから投稿先のアカウントを確認・切り替えできる'],
	['scope', 'world', '公開範囲', 'このノートを誰に見せるかを選ぶ。「公開範囲」の項目で4種類を比較できる'],
	['federation', 'rocket', '連合の切り替え', 'ロケットに斜線が付くと連合なし。他サーバーへ配送しない設定で、非公開とは別のもの'],
	['options', 'dots', 'その他の設定', 'リアクションの受け入れ、配信先、予約投稿・削除、MFM早見表、プレビューなど。利用できる項目は権限によって変わる'],
	['send', 'send', 'ノートを投稿', '内容を送信するボタン。このガイドでは投稿せず、操作の説明だけを表示する'],
	['sendMenu', 'caret-down-filled', '投稿ボタンのメニュー', '利用可能なら下書き保存を選べる。添付がある場合は右クリックの禁止もここから'],
	['photo-plus', 'photo-plus', '端末からファイルを添付', 'PCやスマホの画像を選んでアップロードする'],
	['cloud-download', 'cloud-download', 'ドライブからファイルを添付', '保存済みの画像や、Hatadintからドライブに保存した画像を選ぶ'],
	['chart-arrows', 'chart-arrows', 'アンケート', '本文の下に選択肢の編集欄を追加する'],
	['eye-off', 'eye-off', 'CW：本文を隠す', '本文の上に注意書き欄が出る。読む人が開いてから本文を見る表示で、閲覧できる相手は変わらない'],
	['hash', 'hash', 'ハッシュタグ', '投稿に付けるハッシュタグの入力欄を表示する'],
	['at', 'at', 'メンション', 'ユーザーを選んで本文へ @宛先を入れる。空リプのときは付けなくて大丈夫'],
	['calendar', 'calendar', 'イベント', '日時やタイトルを入れたイベントをノートへ添える'],
	['palette', 'brush', 'Hatadint', 'Hatadintを開く。「書き出す」→「投稿に添付」で、描いた絵を投稿フォームへ添える'],
	['mood-happy', 'mood-happy', '本文へ絵文字を入れる', '絵文字を本文へ挿入する。ノートの下に付けるリアクションとは別の操作'],
];

export function sceneMarkup(id, state, uid, templates) {
	const ti = name => '<i class="ti ti-' + name + '" aria-hidden="true"></i>';
	const pin = n => '<span class="hg-pin" aria-label="図の目印 ' + String.fromCharCode(64 + n) + '">' + String.fromCharCode(64 + n) + '</span>';
	const pill = (text, on = false) => '<span class="hg-ui-pill"' + (on ? ' data-on' : '') + '>' + text + '</span>';
	const screen = (title, body, extra = '') => '<div class="hg-screen ' + extra + '"' + (extra === 'hg-theme-screen' ? ' data-sample="' + state.previewTheme + '" data-live-theme' : '') + '><div class="hg-screen-head"><strong>' + title + '</strong><span class="hg-small">説明用の画面抜粋</span></div>' + body + '</div>';

	function composer(text, highlight = '') {
		const control = (id, label = '') => {const item = composerTools.find(x => x[0] === id); return '<button type="button" data-action="composer-help" data-id="' + id + '" aria-label="' + item[2] + 'の説明" aria-pressed="false"' + (highlight === id ? ' class="hg-highlight"' : '') + '>' + ti(item[1]) + (label ? '<span>' + label + '</span>' : '') + '</button>';};
		return '<div class="hg-composer-guide" data-composer-example><div class="hg-post-form"><header><div class="hg-post-left">' + control('cancel') + control('account') + '</div><div class="hg-post-right">' + control('scope', 'パブリック') + control('federation') + control('options') + '<div class="hg-post-submit">' + control('send', 'ノート') + control('sendMenu') + '</div></div></header><div class="hg-post-text" role="textbox" aria-label="投稿本文の表示例" aria-readonly="true">' + esc(text) + '</div><footer>' + ['photo-plus', 'cloud-download', 'chart-arrows', 'eye-off', 'hash', 'at', 'calendar', 'palette', 'mood-happy'].map(id => control(id)).join('') + '</footer></div><div class="hg-control-help" data-composer-help aria-live="polite"><strong>' + ti('hand-click') + ' ボタンを押すと、ここに意味が出るよ</strong><p>配置は実装に合わせた説明用の投稿フォーム。<br>送信・ファイル選択は行わない</p></div></div>';
	}

	function composerLegend() {
		return '<div class="hg-form-map"><section><h3>右上：届く相手と、送る前の確認</h3><dl>' + composerTools.slice(2, 7).map(x => '<div><dt>' + ti(x[1]) + ' ' + brandName(x[2]) + '</dt><dd>' + hataskGuideProse(x[3]) + '</dd></div>').join('') + '</dl></section><section><h3>下部：本文に添える道具</h3><dl>' + composerTools.slice(7).map(x => '<div><dt>' + ti(x[1]) + ' ' + brandName(x[2]) + '</dt><dd>' + hataskGuideProse(x[3]) + '</dd></div>').join('') + '</dl></section></div><div class="hg-related"><span>この章でもう少し詳しく</span>' + [['visibility', '公開範囲'], ['attach', '画像の添付'], ['airreply', '空リプ']].map(([id, label]) => '<button class="hg-link" data-action="feature" data-id="' + id + '">' + label + ' ' + icon('arrow-right') + '</button>').join('') + '</div>' + caption('MFM入力やプラグインのボタンが追加される設定もある。Hatadintは筆、装飾は文字のアイコンで区別できます。図は従来のHataskey UIです');
	}

	const menu = (items, label = '') => '<div class="hg-menu-figure">' + (label ? '<div class="hg-menu-label">' + label + '</div>' : '') + items.map(([ico, title, desc, on]) => '<div class="hg-menu-item"' + (on ? ' data-active' : '') + '>' + ti(ico) + '<div><strong>' + title + '</strong>' + (desc ? '<small>' + hataskGuideProse(desc) + '</small>' : '') + '</div></div>').join('') + '</div>';
	const caption = text => '<div class="hg-figure-caption">' + ti('info-circle') + '<span>' + hataskGuideProse(text.replace(/[①②③]/g, c => ({ '①': 'A', '②': 'B', '③': 'C' }[c]))) + '</span></div>';

	function renderScene(id) {
		const newScenes = { uiSOverview: 'hg-ui-s-overview-scene', uiSPost: 'hg-ui-s-post-scene', uiSWorkspace: 'hg-ui-s-workspace-scene', uiSSettings: 'hg-ui-s-settings-scene', goesHome: 'hg-goes-home-scene', goesApps: 'hg-goes-apps-scene', goesSearch: 'hg-goes-search-scene', goesSettings: 'hg-goes-settings-scene' };
		const interactive = Object.hasOwn(newScenes, id) || ['theme', 'deck', 'hatady', 'timeline', 'noteActions', 'reaction', 'composer', 'card', 'feed', 'studio', 'todo', 'calendar', 'mood', 'layout', 'channels', 'antenna'].includes(id);
		let body = '';
		if (Object.hasOwn(newScenes, id)) {
			body = templates[newScenes[id]] || '<p>画面を読み込めませんでした</p>';
		} else if (['timeline', 'noteActions', 'reaction'].includes(id)) {
			const templateId = { timeline: 'hg-timeline-scene', noteActions: 'hg-note-scene', reaction: 'hg-reaction-scene' }[id];
			body = templates[templateId] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'composer') {
			body = composer('今日は、気になっていた映画を観たよ') + composerLegend();
		} else if (id === 'antenna') {
			body = templates['hg-collection-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'visibility') {
			body = composer('いま書いているノートの公開範囲は、右上で分かる', 'scope')
      + '<div class="hg-privacy-layout"><div>' + pin(2) + ' ' + pill('アイコンを押すと開くメニュー') + menu([['world', 'パブリック', '全てのユーザーに公開', true], ['home', 'ホーム', 'ホームタイムラインのみに公開'], ['lock', 'フォロワー', '自分のフォロワーのみに公開'], ['mail', '指名', '指定したユーザーのみに公開']], '公開範囲') + '</div><div class="hg-reach">'
      + [['world', 'パブリック → 誰でも', '広く公開するノート。ローカルなどの公開タイムラインにも流れる'], ['home', 'ホーム → 誰でも読める', 'フォロワーのホームを中心に流す。ローカルなどには流さないが、ノート自体は非公開ではない'], ['lock', 'フォロワー → フォロワーを中心に限定', '返信先や @メンションした相手には、フォロワーでなくても読める場合がある'], ['mail', '指名 → 選んだ相手だけ', '宛先に追加した相手に見せる。投稿画面に宛先欄が出る']].map(([i, t, d]) => '<div class="hg-reach-row">' + ti(i) + '<div><strong>' + t + '</strong><p>' + hataskGuideProse(d) + '</p></div></div>').join('') + '</div></div>'
      + '<div class="hg-ui-panel" style="margin-top:14px">' + pin(3) + ' 送信前に確認：' + pill(ti('mail') + ' 指名') + ' ' + pill('宛先 @aoi') + '</div>';
		} else if (id === 'theme') {
			body = screen(ti('palette') + ' テーマ', '<div class="hg-screen-body"><div class="hg-theme-mode">' + pin(1) + '<span>ライト</span><span class="hg-day-switch" aria-label="太陽と月の明暗切替の位置（操作は本体で行う）"></span><span>ダーク</span></div><div class="hg-small" style="margin:12px 0">' + ti('toggle-left') + ' デバイスのダークモードと同期する</div><div class="hg-ui-panel"><strong>' + ti('palette') + ' はたLite／はたDark の選択例</strong><p class="hg-small" data-theme-provisional style="margin-top:12px">ライトとダークのテーマを並べた説明用の図です。<br>配色は仮表示で、実際のテーマ色はまだ適用していません ' + pin(2) + '</p><div class="hg-theme-cards">' + [['cherry', 'はたLite'], ['mirerado', 'はたDark']].map(([value, label]) => '<div class="hg-theme-choice"><input id="' + uid + '-' + value + '" type="radio" name="' + uid + '-theme" data-preview-theme value="' + value + '"' + (state.previewTheme === value ? ' checked' : '') + '><label for="' + uid + '-' + value + '"><div class="hg-theme-preview" data-sample="' + value + '" aria-hidden="true"><aside><b></b><i></i><i></i><i></i></aside><div class="hg-theme-preview-body"><b></b><div><b></b><p></p><p></p></div><div><b></b><p></p></div></div></div><span>' + label + '</span></label></div>').join('') + '</div></div><div class="hg-theme-feedback" data-theme-feedback data-sample="' + state.previewTheme + '" aria-live="polite">' + pin(3) + ' ' + (state.previewTheme === 'cherry' ? 'はたLite' : 'はたDark') + ' を選択中 — 配色は仮表示</div></div>', 'hg-theme-screen');
		} else if (id === 'deck') {
			body = '<div class="hg-screen"><div class="hg-deck-app" data-deck="' + state.deckView + '"><aside class="hg-deck-rail"><div class="hg-brand">H<span class="hg-rail-text">ataskey</span></div>' + [['home', 'ホーム'], ['bell', '通知'], ['settings', '設定']].map(([i, t]) => '<div class="hg-ui-row">' + ti(i) + '<span class="hg-rail-text">' + t + '</span></div>').join('') + '<div class="hg-deck-bottom"><span class="hg-ui-pill" data-on>' + ti('pencil') + '<span class="hg-rail-text">ノート</span></span><div class="hg-mode-switch hg-highlight"><button data-action="demo-view" data-view="standard" aria-label="通常表示にする" aria-pressed="' + !state.deckView + '">' + ti('device-mobile') + '</button><button data-action="demo-view" data-view="deck" aria-label="デッキ表示にする" aria-pressed="' + state.deckView + '">' + ti('layout-columns') + '</button></div><div class="hg-ui-row"><span class="hg-avatar">' + ti('user') + '</span><span class="hg-rail-text">はる</span></div></div></aside><div class="hg-deck-content">' + (state.deckView ? [['ローカル', '同じサーバーの投稿'], ['ホーム', 'フォローした人の投稿'], ['通知', '自分への反応']] : [['ホーム', 'タイムラインをひとつ表示']]).map(([t, d]) => '<section class="hg-deck-col"><strong>' + t + '</strong><p>' + d + '</p><p class="hg-small">サンプルのノート</p></section>').join('') + '</div></div></div>'
      + caption(state.deckView ? '② デッキ表示になった例。左下のスマホ形を押すと通常表示へ戻る。初回チュートリアルはこの例では省略' : '① 左下の縦列アイコンを押してみよう。投稿ボタンの下・アカウントの上にある');
		} else if (id === 'hatady') {
			const entries = [['study', 'book-2', '読書の記録', '20:30 · 学習 · 30分', '気になった言葉をノートに残した'], ['movie', 'movie', '週末に観た映画', '18:00 · 鑑賞 · 110分', '最後の場面が印象に残った'], ['game', 'device-gamepad-2', 'いつものゲーム', '16:00 · 通常プレイ · 45分', '寄り道しながら探索した']];
			body = '<div class="hg-screen hg-activity-screen"><div class="hg-screen-head"><strong class="hg-brand">Hatady</strong><span class="hg-ui-pill" data-on>' + pin(1) + ' ' + ti('pencil-plus') + ' 活動を記録</span></div><div class="hg-mini-tabs"><span>ホーム</span><span data-on>記録</span><span>コレクション</span><span>プロフィール</span></div><div class="hg-screen-body"><div class="hg-ui-row-between"><strong>自分の記録 ' + pin(3) + '</strong>' + pill(ti('calendar-search') + ' 期間・ジャンプ') + '</div><div class="hg-log-filters"><span>表示する記録</span>' + [['all', 'notebook', 'すべて'], ['study', 'book-2', '勉強・読書'], ['movie', 'movie', '映画'], ['game', 'device-gamepad-2', 'ゲーム']].map(([k, i, l]) => '<button data-action="demo-log-kind" data-kind="' + k + '" aria-pressed="' + (state.logKind === k) + '">' + ti(i) + ' ' + l + '</button>').join('') + '</div>' + pill(ti('calendar-event') + ' 9月5日（土）・記録例') + '<div class="hg-log-rail">' + entries.filter(([k]) => state.logKind === 'all' || state.logKind === k).map(([k, i, t, meta, d]) => '<article class="hg-log-entry" data-kind="' + k + '"><div class="hg-ui-row">' + ti(i) + '<strong>' + t + '</strong></div><small>' + meta + ' · 自分のみ</small><p>' + d + '</p></article>').join('') + '' + '</div></div></div><div class="hg-step-flow">' + [['book-2', '学習を記録', '読書・勉強の内容と時間'], ['movie', '映画を記録', '作品を選んで鑑賞日時と感想'], ['device-gamepad-2', 'ゲームを記録', '作品を選んでプレイ内容']].map(([i, t, d]) => '<div>' + ti(i) + '<strong>' + t + '</strong><span>' + d + '</span></div>').join('') + '</div>' + caption('② ＋から種類を選んで記録し、「記録」で確認します。運動・作業も選べ、料理はHataskへ進みます。図は学習・映画・ゲームの記録例です');
		} else if (id === 'favorite') {
			body = '<div class="hg-two"><div>' + note('あとで読みたい、本屋さんの紹介', 'dots') + '</div><div>' + pin(2) + menu([['star', 'お気に入り', '保存先を選ぶ画面へ', true]], 'ノートの「…」から') + menu([['inbox', '未分類'], ['folder', 'あとで読む', '選択中の保存先', true], ['folder', '暮らし']], '保存先を選んで「保存」') + '</div></div>' + caption('③ 保存したノートは選んだフォルダに入ります。一覧のフォルダ名から移動でき、フォルダを削除すると中のノートは「未分類」へ移ります。図の名前は例です');
		} else if (id === 'airreply') {
			body = '<div class="hg-two"><div>' + note('駅前に新しい本屋さんができていた', '', 'あおい') + '</div><div>' + pin(1) + ' ' + pill('自分の投稿画面') + composer('あの本屋さん、私も気になってる') + '</div></div>' + caption('② 返信先・@宛先を付けない独立したノート。③ 公開範囲は別に選ぶので、空リプだから非公開になるわけではない');
		} else if (id === 'lists') {
			const mark = (i, label) => '<span class="hgl-header-icon" role="img" aria-label="' + label + '">' + ti(i) + '</span>';
			const head = (title, actions = '') => '<header class="hgl-header">' + mark('chevron-left', '戻る') + '<strong>' + ti('list') + title + '</strong><span>' + actions + '</span></header>';
			const avatar = () => '<span class="hgl-avatar" aria-hidden="true">' + ti('user') + '</span>';
			body = '<div class="hg-two"><section><h3 class="hg-cut-title">A 一覧の右上の＋から作る</h3><div class="hg-screen">' + head('リストの管理', mark('plus', 'リストを作成する位置') + mark('refresh', 'リロード')) + '<div class="hg-screen-body"><div class="hgl-hint">' + ti('bulb') + '<p>任意のユーザーが含まれるリストを作成できます。<br>作成したリストはタイムラインとして表示可能です。</p></div><div class="hgl-list-row"><strong>本の話</strong> <small>（2/100人）</small><div class="hgl-avatars">' + avatar() + avatar() + '</div></div></div></div></section><section><h3 class="hg-cut-title">B リスト名を開き、メンバーを追加</h3><div class="hg-screen">' + head('本の話') + '<div class="hg-screen-body"><div class="hgl-folder"><div class="hgl-folder-header">' + ti('chevron-right') + '<strong>設定</strong></div></div><div class="hgl-folder"><div class="hgl-folder-header">' + ti('chevron-down') + '<strong>メンバー</strong><small>2/100人</small></div><div class="hgl-folder-body"><div class="hgl-add-user">ユーザーを追加</div>' + [['あおい', '@aoi'], ['こはる', '@koharu']].map(([name, handle]) => '<div class="hgl-member"><div class="hgl-user">' + avatar() + '<span><strong>' + name + '</strong><small>' + handle + '</small></span></div><span role="img" aria-label="メンバーのメニュー">' + ti('dots') + '</span><span role="img" aria-label="このリストから外す">' + ti('x') + '</span></div>').join('') + '</div></div></div></div></section></div>' + caption('二つの画面を並べた操作場所の図。人物・人数・上限は例で、本体の上限はアカウントによって異なる。ユーザー選択で確定するとメンバー欄に反映される。右端の…はメンバーのメニュー、×はリストから外すための入口');
		} else if (id === 'quiet') {
			body = screen('Hataskey独自機能', '<div class="hg-screen-body"><p class="hg-small">タイムライン</p><h3 class="hg-cut-title">' + pin(1) + ' Bot 投稿の非表示</h3><div class="hg-ui-panel" style="margin-top:12px"><div class="hg-ui-row">' + ti('toggle-right') + '<strong>bot ユーザーの投稿をタイムラインに表示しない</strong></div><p class="hg-small" style="margin-top:10px">ノート単体は対象外。通知のBotフィルタは通知画面で別に設定します</p></div><div class="hg-ui-panel" style="margin-top:12px"><strong>表示を許可するBotの例外リスト</strong><div style="margin-top:10px">' + pin(2) + ' <span class="hg-ui-save">' + ti('plus') + ' 追加</span></div></div></div>') + caption('設定をオンにしたあとの抜粋。B の「追加」から、読み続けたいBotを選べる');
		} else if (id === 'channels') {
			body = templates['hg-channel-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'feed') {
			body = templates['hg-feed-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'draw') {
			body = '';
		} else if (id === 'attach') {
			body = composer('写真に、今日のひとことを添える', 'photo-plus') + '<div class="hg-two" style="margin-top:18px"><div class="hg-ui-panel"><h3>添付した画像を押す</h3><svg class="hg-attachment-image" viewBox="0 0 240 120" role="img" aria-label="説明用の架空の風景画像"><rect width="240" height="120" fill="var(--hg-blue-bg)"/><circle cx="180" cy="35" r="15" fill="var(--hg-panel)"/><path d="M0 120V96L70 34l95 86zm102 0 70-57 68 41v16z" fill="var(--hg-green)"/></svg><p class="hg-small">画像を選んだあとは、本文の下のサムネイルから操作</p></div><div>' + menu([['pencil', 'キャプションを付ける', '画像の内容を説明する文章'], ['eye-off', 'センシティブ設定', '必要なときに画像を隠す'], ['x', '添付取り消し', 'このノートの添付から外す']], '添付メニューの一部') + '</div></div>' + caption('添付後に開けるメニューの図。「キャプションを付ける」で説明を入力できる。「添付取り消し」は、ドライブのファイル削除とは別');
		} else if (id === 'card') {
			body = templates['hg-card-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'todo') {
			body = templates['hg-todo-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'calendar') {
			body = templates['hg-calendar-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'mood') {
			body = templates['hg-mood-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'analyze') {
			body = screen('<span class="hg-brand">HATAlyze</span>', '<div class="hg-mini-tabs"><span data-on>新しい分析</span><span>今回の結果</span><span>履歴・比較</span></div><div class="hg-screen-body"><div class="hg-step-flow"><div>' + pin(1) + '<strong>対象のノート</strong>期間と公開範囲</div><div>' + pin(2) + '<strong>含める内容</strong>返信・CW・履歴保存</div><div>' + pin(3) + '<strong>条件を確認</strong>内容を見直して分析</div></div><div class="hg-ui-panel"><strong>どの投稿を振り返りますか</strong><div class="hg-ui-row" style="margin:12px 0">' + pill('直近1,000件', true) + pill('7日') + pill('30日') + pill('90日') + '</div><p class="hg-small">実画面は説明付きの選択肢。公開範囲は「分析に使うノート」の条件</p></div><div class="hg-two" style="margin-top:14px"><div class="hg-ui-panel"><strong>今回の結果</strong><p class="hg-small">日ごとの傾向、判断につながった言葉、感情や話題の内訳</p></div><div class="hg-ui-panel"><strong>履歴・比較</strong><p class="hg-small">保存した2件を選び、変化と根拠を読み返す</p></div></div></div>') + caption('本人向けの振り返りで、医療的な診断ではない。ここでは分析を実行せず、架空のスコアも出さない');
		} else if (id === 'layout') {
			body = templates['hg-layout-scene'] || '<p>画面を読み込めませんでした</p>';
		} else if (id === 'studio') {
			body = templates['hg-studio-scene'] || '<p>画面を読み込めませんでした</p>';
		} else { throw new Error('Missing guide scene: ' + id); }
		return '<div class="hg-scene-head"><strong>' + ti('focus-2') + ' 画面で見る</strong><span>' + (interactive ? 'ここで試せる例 · 本体の設定や記録は変わらない' : '操作場所を示す図 · 操作は本体で行う') + '</span></div>' + body;
	}

	return renderScene(id);
}
