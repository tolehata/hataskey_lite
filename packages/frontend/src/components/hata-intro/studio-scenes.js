/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Interactive teaching diagrams ported from the approved HataIntro A mock.
 * All profile, note, issue and settings data here are isolated examples.
 */
import { hataskGuideProse } from './prose.js';

export const templates = {
	'hg-studio-scene': `
  <section class="hgs4-scene" data-hgs4-scene aria-label="HataSideStudioの操作例">
    <p class="hgs4-guide"><strong>プレビューで選ぶ → スタジオ設定で調整する</strong><br>「拡大」と「縮小」は別々に編集できるよ — 本体の保存先は使っている端末<br>架空データの操作例・保存なし／作成・削除・高度な編集の一部は説明のみ</p>
    <div class="hgs4-app">
      <header class="hgs4-header">
        <div class="hgs4-brand"><button type="button" class="hgs4-button hgs4-icon-button" data-hgs4-action="explain" data-hgs4-value="back" aria-label="戻る（操作説明）"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><strong class="hgs4-logo">HataSideStudio</strong></div>
        <div class="hgs4-profiles" data-hgs4-profiles aria-label="保存プロファイル"></div>
        <div class="hgs4-actions" data-hgs4-header-actions></div>
      </header>
      <div class="hgs4-dialog-area" data-hgs4-dialog hidden></div>
      <div class="hgs4-main">
        <section class="hgs4-pane" aria-label="サイドメニュープレビュー">
          <div class="hgs4-pane-head"><div class="hgs4-pane-title"><h3>プレビュー</h3><small data-hgs4-count></small></div><div class="hgs4-preview-actions"><button type="button" class="hgs4-button" data-hgs4-action="copy-menu"><i class="ti ti-copy" aria-hidden="true"></i>並びをコピー<i class="ti ti-chevron-down" aria-hidden="true"></i></button><div class="hgs4-mode" data-hgs4-top-mode aria-label="編集するメニュー"></div></div></div>
          <div class="hgs4-stage">
            <div class="hgs4-rail" data-side="left">
              <button type="button" data-hgs4-action="explain" data-hgs4-value="create-widget" data-hgs4-expanded-only><i class="ti ti-app-window" aria-hidden="true"></i><span>ウィジェットを作成</span></button>
              <button type="button" data-hgs4-action="explain" data-hgs4-value="create-group" data-hgs4-expanded-only><i class="ti ti-category-plus" aria-hidden="true"></i><span>グループを作成</span></button>
              <button type="button" data-hgs4-action="create-button"><i class="ti ti-square-rounded-plus" aria-hidden="true"></i><span>ボタンを作成</span></button>
            </div>
            <div class="hgs4-rail" data-side="right"><button type="button" class="hgs4-delete" data-hgs4-action="explain" data-hgs4-value="delete"><i class="ti ti-trash-x" aria-hidden="true"></i><span>削除</span></button><button type="button" data-hgs4-action="explain" data-hgs4-value="advanced"><i class="ti ti-arrows-sort" aria-hidden="true"></i><span>高度な並び替え</span></button></div>
            <div class="hgs4-sidebar" data-hgs4-sidebar></div>
          </div>
          <p class="hgs4-help" data-hgs4-preview-help>並び替えは項目を選んで左上の点々をドラッグ — ボタンを押すと、右側（狭い画面では下）の設定が開く</p>
        </section>
        <section class="hgs4-pane" aria-label="HataSideStudio設定">
          <div class="hgs4-pane-head"><div class="hgs4-pane-title"><h3>スタジオ設定</h3><small data-hgs4-kind>全体</small></div></div>
          <div class="hgs4-inspector"><div class="hgs4-selected" data-hgs4-selected></div><nav class="hgs4-tabs" data-hgs4-tabs aria-label="スタジオ設定の分類"></nav><div class="hgs4-bento" data-hgs4-settings></div></div>
        </section>
      </div>
      <div class="hgs4-status" role="status" aria-live="polite" aria-atomic="true" data-hgs4-status><strong>操作例</strong> プロファイルと項目の配置は架空のサンプル — まずプレビューの「通知」を選んでみて</div>
    </div>
    <div class="hgs4-notice"><strong>この図で試せること</strong> プロファイルの切替・追加・改名、拡大／縮小、項目選択、右タブ、幅・形・大きさ・ラベル・グループ列数、ボタン追加、同じ囲い内のドラッグ、Undo／Redo<br><strong>保存はしない</strong> 「保存」は本体での保存先を説明するだけ — 本体の設定・アカウント・メモには触れず、この図の変更も再表示で消える<br><strong>省略した操作</strong> プロファイル削除、ウィジェット／グループの追加、項目削除、高度な並び替え、グループをまたぐ移動・統合、クイック編集、色・回転・グラデーション、現在の設定の読込、書出し／読込、管理者向け設定、実ウィジェットの更新は説明のみ<br><strong>表示上の違い</strong> サーバー・利用者・メモ・プロファイルはすべて架空例、上限3件は既定値の例 — 読みやすさのため文字は基本12px以上、間隔は一部拡張。ダイアログは画面上部へ展開、ドラッグ中の簡易タイムラインは省略。狭い画面は本体と同じくプレビューの下に設定を配置</div>
  </section>
`,
};

const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
const icon = name => '<i class="ti ti-' + name + '" aria-hidden="true"></i>';
const b = (label, action, value = '', extra = '') => {
	const classMatch = extra.match(/\bclass="([^"]*)"/);
	const className = classMatch ? classMatch[1] : 'hgs4-button';
	return '<button type="button" class="' + className + '" data-hgs4-action="' + action + '" data-hgs4-value="' + esc(value) + '" ' + extra.replace(/\bclass="[^"]*"\s*/, '') + '>' + label + '</button>';
};
const card = (title, content) => '<section class="hgs4-card"><h4>' + title + '</h4>' + content + '</section>';
const catalog = { timeline: ['タイムライン', 'home'], notifications: ['通知', 'bell'], hatask: ['Hatask', 'eye'], favorites: ['お気に入り', 'star'], search: ['検索', 'search'], hatady: ['Hatady', 'book-2'] };
const makeButton = (id, menuId) => ({ id, type: 'button', menuId, name: catalog[menuId][0], icon: catalog[menuId][1], shape: 'rounded', size: 'normal', showLabel: true });
const initial = () => ({ active: 'default', profiles: [
	{ id: 'default', name: 'デフォルト', wide: false, columns: 1, postIcon: 'pencil', expanded: [makeButton('home', 'timeline'), makeButton('notice', 'notifications'), { id: 'group', type: 'group', name: 'よく使う', columns: 1, showName: true, children: [makeButton('hatask', 'hatask'), makeButton('favorite', 'favorites')] }, { id: 'memo', type: 'widget', name: 'メモ', size: 'normal' }], collapsed: ['timeline', 'notifications', 'hatask', 'favorites'].map((id, i) => ({ ...makeButton('c' + i, id), shape: 'circle', size: 'small', showLabel: false })) },
	{ id: 'reading', name: '読書用', wide: false, columns: 1, postIcon: 'pencil', expanded: [makeButton('book', 'hatady'), makeButton('saved', 'favorites'), { id: 'memo2', type: 'widget', name: 'メモ', size: 'normal' }], collapsed: ['hatady', 'favorites', 'timeline'].map((id, i) => ({ ...makeButton('r' + i, id), shape: 'circle', size: 'small', showLabel: false })) },
] });

function initOne(root) {
	const existing = mounts.get(root);
	if (existing) return existing;
	const listeners = [];
	const on = (target, type, handler) => {
		target.addEventListener(type, handler);
		listeners.push(() => target.removeEventListener(type, handler));
	};
	let draft = initial(), mode = 'expanded', tab = 'layout', selectedId = null, serial = 0, dialog = null, dialogShape = 'rounded', history = [JSON.stringify(draft)], historyIndex = 0, drag = null;
	const q = selector => root.querySelector(selector);
	const qa = selector => [...root.querySelectorAll(selector)];
	const active = () => draft.profiles.find(p => p.id === draft.active);
	const nodes = () => mode === 'expanded' ? active().expanded : active().collapsed;
	const all = () => nodes().flatMap(n => n.type === 'group' ? [n, ...n.children] : [n]);
	const selected = () => all().find(n => n.id === selectedId);
	const containerFor = id => { const p = active(); if (mode === 'collapsed') return p.collapsed; const group = p.expanded.find(n => n.type === 'group' && n.children.some(c => c.id === id)); return group ? group.children : p.expanded; };
	const status = (title, text) => { q('[data-hgs4-status]').innerHTML = '<strong>' + esc(title) + '</strong> ' + hataskGuideProse(text); };
	const record = () => { const next = JSON.stringify(draft); if (next === history[historyIndex]) return; history = history.slice(0, historyIndex + 1); history.push(next); historyIndex++; };
	const explain = {
		back: ['戻る', '本体では前の画面へ戻る入口 — この図はページを移動しない'],
		save: ['保存先はこの端末', '本体では右上の「保存」で変更を確定する — サーバーや連合には送られない。この図では保存せず、未保存の表示も残す'],
		help: ['使い方', '本体は「作成 → 並べる → 調整 → 保存」を案内するチュートリアルを開く。この図はプレビューの選択から試せる'],
		'create-widget': ['ウィジェットを作成', '本体では種類を選んで追加する。拡大メニューだけで使える。この図は既存の「メモ」の選択と設定表示まで'],
		'create-group': ['グループを作成', '本体では囲いを追加し、ボタンやウィジェットをドラッグしてまとめる。この図では既存の「よく使う」を選んで列数や名前を変えられる'],
		delete: ['削除', '本体では削除モードに切り替え、項目の×または削除先へのドラッグで確認する。この図は削除を行わない'],
		advanced: ['高度な並び替え', '本体には別ウィンドウの並び順編集がある。この図では開かず、プレビュー上のドラッグだけを試せる'],
		'profile-delete': ['プロファイルを削除', '本体は確認後に選択中のプロファイルを削除する。保存するまでは確定しない。この図では削除を行わない'],
		quick: ['その場で編集', '本体では鉛筆から形・色などのクイック編集を開く。この図は対応する右側の詳細設定へ切り替える'],
		import: ['現在の並びを読み込む', '本体では既存サイドメニューの表示・非表示・並び順から、このプロファイルの拡大と縮小を作り直す。この図は実設定を読み込まない'],
		colors: ['色とグラデーション', '本体では背景・枠・文字色、枠線の種類や太さ、2色目と方向を編集できる。この図では本体の明暗配色を維持する'],
		motion: ['動き', '本体ではパララックススクロールを設定できる。動きを減らす設定のときは停止する。この図では動かさない'],
		transfer: ['設定を書き出し・読み込み', '本体の端末間移行用の入口。この図からファイルや端末設定は読み書きしない'],
		fixed: ['固定部分', '「もっと」「設定」「リアルタイム」、ノートボタン、表示切替、アカウントはプレビュー下部に並ぶ。管理者・モデレーターにはコントロールパネルも追加される'],
		server: ['サーバー行', 'サーバーアイコン、サーバー名、タイムライン設定、拡大／縮小の矢印が並ぶ。この図のサーバーと利用者は架空例'],
		memo: ['メモのプレビュー', '本体は実際のメモウィジェットを表示する。この図のメモは架空の固定文で、編集・保存・自動保存は行わない'],
	};

	function choices(values, action, current) { return '<div class="hgs4-choices">' + values.map(([value, label, disabled]) => b(label, action, value, 'aria-pressed="' + (String(value) === String(current)) + '" ' + (disabled ? 'disabled' : ''))).join('') + '</div>'; }

	function modes() { return ['expanded', 'collapsed'].map(v => '<button type="button" data-hgs4-action="mode" data-hgs4-value="' + v + '" aria-pressed="' + (mode === v) + '">' + (v === 'expanded' ? '拡大' : '縮小') + '</button>').join(''); }

	function nodeMarkup(n) {
		const common = ' data-hgs4-node="' + n.id + '" data-selected="' + (selectedId === n.id) + '"';
		const grip = n.type === 'group' ? '' : '<button type="button" class="hgs4-drag" data-hgs4-drag="' + n.id + '" aria-label="' + esc(n.name) + 'をドラッグして移動">' + icon('grip-vertical') + '</button>';
		const pencil = '<button type="button" class="hgs4-pencil" data-hgs4-action="quick" data-hgs4-value="' + n.id + '" aria-label="' + esc(n.name) + 'をその場で編集（この図は詳細設定を表示）">' + icon('pencil') + '</button>';
		if (n.type === 'group') return '<div class="hgs4-node hgs4-group"' + common + '><div class="hgs4-group-head"><button type="button" class="hgs4-group-name" data-hgs4-action="select" data-hgs4-value="' + n.id + '">' + (n.showName ? esc(n.name) : '<span aria-label="グループを選択">' + icon('category') + '</span>') + '</button><div class="hgs4-group-tools"><button type="button" class="hgs4-button hgs4-icon-button" data-hgs4-action="select" data-hgs4-value="' + n.id + '" aria-label="グループを編集">' + icon('settings') + '</button><button type="button" class="hgs4-button hgs4-icon-button hgs4-group-grip" data-hgs4-drag="' + n.id + '" aria-label="' + esc(n.name) + 'グループをドラッグして移動">' + icon('grip-vertical') + '</button></div></div><div class="hgs4-group-grid" style="--hgs-group-columns:' + n.columns + '">' + n.children.map(nodeMarkup).join('') + '</div></div>';
		if (n.type === 'widget') return '<div class="hgs4-node hgs4-widget"' + common + '><div class="hgs4-memo"><button type="button" class="hgs4-memo-head" data-hgs4-action="select" data-hgs4-value="' + n.id + '">' + icon('note') + 'メモ</button><textarea aria-label="架空のメモ（読み取り専用）" readonly>気になったノートを\nあとで読み返す\n\nサンプルのメモ</textarea>' + b('保存', 'explain', 'memo', 'class="hgs4-button hgs4-memo-save"') + '</div>' + grip + pencil + '</div>';
		return '<div class="hgs4-node"' + common + ' data-shape="' + n.shape + '" data-size="' + n.size + '" data-show-label="' + n.showLabel + '"><button type="button" class="hgs4-node-button" data-hgs4-action="select" data-hgs4-value="' + n.id + '" ' + (mode === 'collapsed' ? 'data-hgs4-drag="' + n.id + '"' : '') + ' aria-label="' + esc(n.name) + 'の設定を開く">' + icon(n.icon) + '<span><b>' + esc(n.name) + '</b>' + (n.size === 'large' ? '<small>' + (n.menuId === 'hatask' ? '予定・ToDo・ごはん・きもち' : n.menuId === 'hatady' ? '学習状況・読書・本日の記録' : '') + '</small>' : '') + '</span></button>' + grip + pencil + '</div>';
	}

	function renderSidebar() {
		const p = active(), collapsed = mode === 'collapsed', side = q('[data-hgs4-sidebar]');
		side.dataset.mode = mode; side.dataset.wide = String(p.wide);
		side.innerHTML = '<div class="hgs4-server"><button type="button" class="hgs4-server-icon" data-hgs4-action="explain" data-hgs4-value="server" aria-label="架空サーバーのメニュー説明">' + icon('server') + '</button>' + (!collapsed ? '<div class="hgs4-server-name"><small>ここは</small><b>Hataskey（例）</b></div>' + b(icon('adjustments'), 'explain', 'server', 'class="hgs4-button hgs4-icon-button hgs4-server-action" aria-label="タイムライン設定（操作説明）"') : '') + b(icon(collapsed ? 'chevron-right' : 'chevron-left'), 'mode', collapsed ? 'expanded' : 'collapsed', 'class="hgs4-button hgs4-icon-button hgs4-server-action" aria-label="' + (collapsed ? 'メニューを広げる' : 'メニューを縮小') + '"') + '</div><div class="hgs4-custom"><div class="hgs4-nodes" style="--hgs-columns:' + p.columns + '">' + nodes().map(nodeMarkup).join('') + '</div></div><div class="hgs4-fixed">' + [['dots', 'もっと'], ['settings', '設定'], ['bolt', 'リアルタイム']].map(([i, label]) => '<button type="button" data-hgs4-action="explain" data-hgs4-value="fixed" aria-label="' + label + '（固定部分の説明）">' + icon(i) + (collapsed ? '' : '<span>' + label + '</span>') + '</button>').join('') + '</div><div class="hgs4-bottom"><button type="button" class="hgs4-post" data-hgs4-action="explain" data-hgs4-value="fixed" aria-label="ノートボタン（固定部分の説明）">' + icon(p.postIcon) + (collapsed ? '' : '<span>ノート</span>') + '</button><div class="hgs4-bottom-mode" aria-label="表示モード">' + [['expanded', 'device-mobile', '通常表示'], ['collapsed', 'layout-columns', 'デッキ表示']].map(([m, i, label]) => '<button type="button" data-hgs4-action="mode" data-hgs4-value="' + m + '" aria-pressed="' + (mode === m) + '" aria-label="' + label + '">' + icon(i) + '</button>').join('') + '</div><button type="button" class="hgs4-account" data-hgs4-action="explain" data-hgs4-value="fixed" aria-label="架空のアカウント"><span class="hgs4-avatar">' + icon('user-circle') + '</span>' + (!collapsed ? '<span><b>はじめてさん（例）</b><small>@guide_example</small></span>' : '') + '</button></div>';
	}

	function renderSettings() {
		const p = active(), n = selected(), kind = n?.type, large = p.expanded.some(v => v.type !== 'group' && v.size === 'large');
		q('[data-hgs4-kind]').textContent = { button: 'ボタン', widget: 'ウィジェット', group: 'グループ' }[kind] || '全体';
		q('[data-hgs4-selected]').innerHTML = icon(n?.icon || (kind === 'group' ? 'category' : kind === 'widget' ? 'app-window' : 'layout-sidebar')) + '<div><b>' + esc(n?.name || '全体レイアウト') + '</b><small>プレビュー内の項目を選ぶと、ここで細かく調整できます</small></div>';
		q('[data-hgs4-tabs]').innerHTML = [['layout', '配置'], ['button', 'ボタン'], ['widget', 'ウィジェット'], ['group', 'グループ'], ['role', '上限']].map(([id, label]) => '<button type="button" data-hgs4-action="tab" data-hgs4-value="' + id + '" aria-pressed="' + (tab === id) + '" ' + (!['layout', 'role', kind].includes(id) ? 'disabled' : '') + '>' + label + '</button>').join('');
		let html = '';
		if (tab === 'layout')html =
      card('編集するメニュー', '<div class="hgs4-mode">' + modes() + '</div>') +
      card('通常メニューの列数', choices([['1', '1列'], ['2', '2列', large], ['3', '3列', large]], 'columns', p.columns) + (large ? '<small>「大」の項目がある間は複数列にできません</small>' : '')) +
      card('サイドメニューの幅', choices([['normal', '今のサイズ'], ['wide', 'ワイド']], 'width', p.wide ? 'wide' : 'normal') + '<small>本体ではプレビューとPCサイドメニューへ反映 — この図ではプレビューだけ</small>') +
      card('既存設定', b(icon('list-check') + '現在の並びを読み込む', 'explain', 'import') + '<small>本体の設定は読み込まない</small>') +
      card('動き', b('パララックススクロール（ベータ）', 'explain', 'motion') + '<small>この図は動きなし</small>') +
      card('ノートボタン', choices([['pencil', icon('pencil') + '鉛筆'], ['paw', icon('paw') + '猫の肉球']], 'post-icon', p.postIcon) + '<small>サイドメニュー下部のノートボタン</small>' + b('色・グラデーションの説明', 'explain', 'colors')) +
      card('縮小メニューの規則', '<p>ボタンのみ・縦一列・アイコン表示に固定<br>色・形・順番は縮小側で個別に編集できる</p>');
		else if (tab === 'role')html = card('アカウントの保存上限', '<strong class="hgs4-limit">3件</strong><small>既定上限の例 — 実際の上限はロールによって変わる<br>プロファイルは端末ごとに保存</small>') + card('保存先', '<p>このスタジオの設定はこの端末にだけ保存され、サーバーや連合には送られない</p>' + b(icon('arrows-exchange') + '設定を書き出し・読み込み', 'explain', 'transfer') + '<small>この図では保存も読み書きも行わない</small>');
		else if (n?.type === 'button' && tab === 'button') {
			const parent = p.expanded.find(v => v.type === 'group' && v.children.some(c => c.id === n.id)), cols = parent ? parent.columns : p.columns;
			html = (mode === 'expanded' ? card('配置先', '<label class="hgs4-field"><select aria-label="配置先（この図では移動を省略）" disabled><option>' + esc(parent?.name || '通常メニュー') + '</option></select></label><small>囲いをまたぐ移動は省略</small>') : '') +
        card('形', choices([['rounded', '<span class="hgs4-shape"></span>角丸'], ['circle', '<span class="hgs4-shape" data-shape="circle"></span>丸型'], ['pill', '<span class="hgs4-shape" data-shape="pill"></span>錠剤型']], 'shape', n.shape)) +
        card('大きさ', choices([['small', '小'], ['normal', '中', mode === 'collapsed'], ['large', '大', mode === 'collapsed' || cols > 1]], 'size', n.size) + '<small>' + (mode === 'collapsed' ? '縮小は「小」に固定 — 実表示幅の中に収める' : cols > 1 ? '複数列では「大」を選べません' : '「大」は詳細付きの大きなボタン') + '</small>') +
        (mode === 'expanded' ? card('表示', '<label class="hgs4-check"><input type="checkbox" data-hgs4-field="showLabel" ' + (n.showLabel ? 'checked' : '') + '>アイコン下に文字を表示</label><small>丸型はアイコンだけ — 中・小はアイコン横、大はアイコン下に表示</small>' + b('回転・色などの説明', 'explain', 'colors')) : '') +
        card('色とグラデーション', b(icon('palette') + '編集できる項目を見る', 'explain', 'colors') + '<small>この図では明暗配色を固定</small>');
		} else if (n?.type === 'group' && tab === 'group')html =
      card('名前', '<label class="hgs4-field"><input type="text" data-hgs4-field="groupName" aria-label="グループ名" maxlength="80" value="' + esc(n.name) + '"></label><label class="hgs4-check"><input type="checkbox" data-hgs4-field="showName" ' + (n.showName ? 'checked' : '') + '>グループ左上に名前を表示</label>') +
      card('レイアウト', choices([['1', icon('layout-list') + '1列'], ['2', icon('layout-grid') + '田の字グリッド', n.children.some(c => c.size === 'large')], ['3', icon('layout-grid-add') + '3列', n.children.some(c => c.size === 'large')]], 'group-columns', n.columns) + '<small>メイソンリーはこの図では省略</small>') +
      card('グループの表面', b('背景・枠・文字色の説明', 'explain', 'colors')) +
      card('グループ内の項目', n.children.map(c => '<button type="button" class="hgs4-member" data-hgs4-action="select" data-hgs4-value="' + c.id + '">' + icon(c.icon) + '<span>' + esc(c.name) + '</span>' + icon('chevron-right') + '</button>').join(''));
		else if (n?.type === 'widget' && tab === 'widget')html = card('配置先', '<label class="hgs4-field"><select aria-label="配置先（この図では移動を省略）" disabled><option>グループ外</option></select></label>') +
      card('種類', '<label class="hgs4-field"><select aria-label="ウィジェットの種類（この図はメモの例）" disabled><option>メモ</option></select></label><small>本体は時計・カレンダーなども選べる</small>') +
      card('現在のサイズ', choices([['small', '小', true], ['normal', '中', true], ['large', '大', true]], 'size', n.size) + '<small>実ウィジェットのサイズ変更は省略</small>') +
      card('ウィジェットの内容', b('実ウィジェットとこの図の違い', 'explain', 'memo') + '<small>プレビューの本文は固定の架空例</small>') +
      card('色とグラデーション', b('設定できる項目の説明', 'explain', 'colors'));
		q('[data-hgs4-settings]').innerHTML = html || '<div class="hgs4-empty">' + icon('pointer') + '<b>プレビューから項目を選択</b><span>ボタン、ウィジェット、グループを選ぶと詳細設定を表示します</span></div>';
	}

	function render() {
		const focused = root.contains(root.ownerDocument.activeElement) ? root.ownerDocument.activeElement : null;
		const focusAction = focused?.dataset?.hgs4Action, focusValue = focused?.dataset?.hgs4Value, focusField = focused?.dataset?.hgs4Field;
		const p = active(), items = all(), dirty = JSON.stringify(draft) !== history[0];
		q('[data-hgs4-profiles]').innerHTML = draft.profiles.map(v => b(esc(v.name), 'profile', v.id, 'class="hgs4-button hgs4-profile" aria-pressed="' + (v.id === p.id) + '"')).join('') +
      b(icon('pencil'), 'rename', '', 'class="hgs4-button hgs4-icon-button" aria-label="アクティブなプロファイル名を変更"') +
      b(icon('trash'), 'explain', 'profile-delete', 'class="hgs4-button hgs4-icon-button" aria-label="アクティブなプロファイルを削除（操作説明）"') +
      b(icon('plus'), 'add-profile', '', 'class="hgs4-button hgs4-icon-button" aria-label="プロファイルを追加（上限3件の例）" ' + (draft.profiles.length >= 3 ? 'disabled' : '')) + '<span class="hgs4-counter">' + draft.profiles.length + ' / 3</span>';
		q('[data-hgs4-header-actions]').innerHTML = (dirty ? '<span class="hgs4-dirty">' + icon('device-floppy') + '未保存</span>' : '') + '<div class="hgs4-history">' + b(icon('restore'), 'reset-dialog', '', 'class="hgs4-button hgs4-icon-button" aria-label="この例を初期化"') + b(icon('arrow-back-up'), 'undo', '', 'class="hgs4-button hgs4-icon-button" aria-label="ひとつ前へ" ' + (historyIndex === 0 ? 'disabled' : '')) + b(icon('arrow-forward-up'), 'redo', '', 'class="hgs4-button hgs4-icon-button" aria-label="ひとつ後へ" ' + (historyIndex === history.length - 1 ? 'disabled' : '')) + '</div>' + b(icon('device-floppy') + '保存', 'explain', 'save', 'class="hgs4-button hgs4-primary" aria-label="保存（この図では保存先の説明のみ）"') + b(icon('help'), 'explain', 'help', 'class="hgs4-button hgs4-icon-button" aria-label="使い方（操作説明）"');
		q('[data-hgs4-top-mode]').innerHTML = modes();
		q('[data-hgs4-count]').textContent = mode === 'collapsed' ? 'ボタン ' + nodes().length + '個' : 'ボタン' + items.filter(n => n.type === 'button').length + '・グループ' + items.filter(n => n.type === 'group').length + '・ウィジェット' + items.filter(n => n.type === 'widget').length;
		qa('[data-hgs4-expanded-only]').forEach(el => el.disabled = mode === 'collapsed');
		q('[data-hgs4-preview-help]').innerHTML = hataskGuideProse(mode === 'collapsed' ? '縮小メニューはボタン専用 — ボタン本体をドラッグして順番を変更。グループとウィジェットは持ち込まず、縦一列・アイコンだけで表示' : '並び替えは項目を選んで左上の点々をドラッグ — ボタンを押すと、右側（狭い画面では下）の設定が開く');
		renderSidebar(); renderSettings();
		if (focusField)qa('[data-hgs4-field]').find(el => el.dataset.hgs4Field === focusField)?.focus({ preventScroll: true });
		else if (focusAction)qa('[data-hgs4-action]').find(el => el.dataset.hgs4Action === focusAction && el.dataset.hgs4Value === focusValue && !el.disabled)?.focus({ preventScroll: true });
	}

	function showDialog(title, body, kind, confirm = '変更する') {
		dialog = kind; const area = q('[data-hgs4-dialog]'); area.hidden = false;
		area.innerHTML = '<section class="hgs4-dialog" aria-label="' + esc(title) + '"><header><b>' + esc(title) + '</b>' + b(icon('x'), 'close-dialog', '', 'class="hgs4-button hgs4-icon-button" aria-label="閉じる"') + '</header>' + body + (kind === 'copy' ? '' : '<div class="hgs4-choices">' + b('やめる', 'close-dialog') + b(confirm, 'confirm-dialog', '', 'class="hgs4-button hgs4-primary"') + '</div>') + '</section>';
		(area.querySelector('input,select') || area.querySelector('button'))?.focus({ preventScroll: true });
		area.scrollIntoView({ block: 'nearest', behavior: 'auto' });
	}

	function closeDialog() { q('[data-hgs4-dialog]').hidden = true; q('[data-hgs4-dialog]').innerHTML = ''; dialog = null; }

	function select(id) { const n = all().find(v => v.id === id); if (!n) return; selectedId = id; tab = n.type; render(); status(n.name, '選択した項目の「' + ({ button: 'ボタン', widget: 'ウィジェット', group: 'グループ' }[n.type]) + '」設定を表示中'); }

	on(root, 'click', event => {
		const el = event.target.closest('[data-hgs4-action]'); if (!el || !root.contains(el) || el.disabled) return;
		const action = el.dataset.hgs4Action, value = el.dataset.hgs4Value, p = active(), n = selected();
		if (action === 'explain') {const e = explain[value]; if (e)status(...e); return;}
		if (action === 'select' || action === 'quick') {select(value); if (action === 'quick')status(...explain.quick); return;}
		if (action === 'mode') {mode = value; selectedId = null; tab = 'layout'; closeDialog(); render(); status(value === 'expanded' ? '拡大メニュー' : '縮小メニュー', value === 'expanded' ? 'ボタン・グループ・ウィジェットを配置できる' : '拡大とは別の並び — ボタンだけを縦一列に並べる'); return;}
		if (action === 'tab') {tab = value; render(); return;}
		if (action === 'profile') {draft.active = value; selectedId = null; tab = 'layout'; closeDialog(); record(); render(); status('保存プロファイル', active().name + 'の編集用サンプルへ切り替えた — 本体では保存して使用プロファイルを確定する'); return;}
		if (action === 'close-dialog') {closeDialog(); return;}
		if (action === 'rename') {showDialog('プロファイル名', '<p>端末内で区別しやすい名前を付ける — この図では一時的な変更だけ</p><label class="hgs4-field"><span>プロファイル名</span><input type="text" data-hgs4-dialog-name maxlength="80" value="' + esc(p.name) + '"></label>', 'rename', '変更する'); return;}
		if (action === 'add-profile') {if (draft.profiles.length >= 3) return; const next = JSON.parse(JSON.stringify(initial().profiles[0])); next.id = 'new' + (++serial); next.name = 'プロファイル ' + (draft.profiles.length + 1); draft.profiles.push(next); draft.active = next.id; selectedId = null; record(); render(); status('プロファイルを追加', '名前は上段の鉛筆で変更できる — この図の追加内容は保存しない'); return;}
		if (action === 'reset-dialog') {showDialog('このプロファイルを初期化しますか？', '<p>選択中のプロファイルだけをこの図の標準サンプルへ戻す — 名前は保ち、本体の設定は変更しない</p>', 'reset', 'デフォルトに戻す'); return;}
		if (action === 'create-button') {dialogShape = 'rounded'; showDialog('ボタンを作成', '<label class="hgs4-field"><span>機能</span><select data-hgs4-dialog-menu>' + Object.entries(catalog).map(([id, [label]]) => '<option value="' + id + '">' + label + '</option>').join('') + '</select></label><div class="hgs4-field"><span>ボタンの形</span><div class="hgs4-shape-picker">' + [['rounded', '角丸'], ['circle', '丸型'], ['pill', '錠剤型']].map(([id, label]) => b('<span class="hgs4-shape" data-shape="' + id + '"></span>' + label, 'create-shape', id, 'aria-pressed="' + (id === 'rounded') + '"')).join('') + '</div></div><p>この図は6機能の例だけを収録 — 選んでも本体の機能は開かない</p>', 'button', '追加'); return;}
		if (action === 'create-shape') {dialogShape = value; qa('[data-hgs4-action="create-shape"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.hgs4Value === value))); return;}
		if (action === 'copy-menu') {showDialog('並びをコピー', b(icon('layout-sidebar-left-collapse') + '拡大 → 縮小', 'copy', 'collapsed') + '<p>ボタンだけを縦一列へコピー</p>' + b(icon('layout-sidebar-left-expand') + '縮小 → 拡大', 'copy', 'expanded') + '<p>縮小側の順を拡大側へコピー</p>' + b(icon('list-check') + '現在の並びを読み込む', 'explain', 'import'), 'copy'); return;}
		if (action === 'copy') {showDialog((value === 'collapsed' ? '縮小' : '拡大') + 'へコピー', '<p>この例の' + (value === 'collapsed' ? '縮小' : '拡大') + '側の現在の並びを置き換える — 本体には反映しない</p>', 'copy-' + value, 'コピーする'); return;}
		if (action === 'confirm-dialog') {
			if (dialog === 'rename') {const name = q('[data-hgs4-dialog-name]').value.trim(); if (!name) {status('名前を入力', 'プロファイルを区別できる名前を付けてね'); return;}p.name = name;} else if (dialog === 'reset') {const fresh = initial().profiles[0]; Object.assign(p, fresh, { id: p.id, name: p.name }); selectedId = null;} else if (dialog === 'button') {const menu = q('[data-hgs4-dialog-menu]').value, node = makeButton('added' + (++serial), menu); node.shape = dialogShape; if (mode === 'collapsed') {node.showLabel = false; node.size = 'small';}nodes().push(node); selectedId = node.id; tab = 'button';} else if (dialog === 'copy-collapsed') {p.collapsed = p.expanded.flatMap(v => v.type === 'group' ? v.children : [v]).filter(v => v.type === 'button').map(v => ({ ...v, id: 'copy' + (++serial), shape: v.shape === 'pill' ? 'rounded' : v.shape, size: 'small', showLabel: false })); mode = 'collapsed'; selectedId = null; tab = 'layout';} else if (dialog === 'copy-expanded') {const widgets = p.expanded.filter(v => v.type === 'widget'); p.expanded = [{ id: 'copygroup' + (++serial), type: 'group', name: '縮小メニューからコピー', columns: 1, showName: true, children: p.collapsed.map(v => ({ ...v, id: 'copy' + (++serial), size: 'normal', showLabel: true })) }, ...widgets]; mode = 'expanded'; selectedId = null; tab = 'layout';}
			closeDialog(); record(); render(); status('この図のサンプルを変更', '変更はまだ保存されていない — この図の「保存」は説明のみ'); return;
		}
		if (action === 'undo' || action === 'redo') {historyIndex += action === 'undo' ? -1 : 1; historyIndex = Math.max(0, Math.min(history.length - 1, historyIndex)); draft = JSON.parse(history[historyIndex]); selectedId = null; tab = 'layout'; closeDialog(); render(); status(action === 'undo' ? 'ひとつ前へ' : 'ひとつ後へ', 'この図の編集履歴を移動した — 保存はしていない'); return;}
		if (action === 'width')p.wide = value === 'wide';
		else if (action === 'columns')p.columns = Number(value);
		else if (action === 'post-icon')p.postIcon = value;
		else if (action === 'shape' && n?.type === 'button')n.shape = value;
		else if (action === 'size' && n?.type === 'button')n.size = value;
		else if (action === 'group-columns' && n?.type === 'group')n.columns = Number(value);
		else return;
		record(); render(); status('プレビューに反映', 'この図の見た目を更新した — 本体では最後に右上の「保存」で確定する');
	});
	on(root, 'change', event => {
		const field = event.target.dataset.hgs4Field, n = selected(); if (!field || !n) return;
		if (field === 'showLabel' || field === 'showName')n[field] = event.target.checked;
		else if (field === 'groupName')n.name = event.target.value.trim() || 'グループ'; else return;
		record(); render(); status('プレビューに反映', 'この図の表示を変更した — 保存はしていない');
	});
	on(root, 'pointerdown', event => {
		const handle = event.target.closest('[data-hgs4-drag]'); if (!handle || !root.contains(handle) || event.button !== 0) return;
		const id = handle.dataset.hgs4Drag, node = all().find(n => n.id === id); if (!node) return;
		drag = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, handle, moved: false, target: null, container: containerFor(id) };
		handle.setPointerCapture?.(event.pointerId);
	});
	on(root, 'pointermove', event => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
		drag.moved = true; event.preventDefault();
		const dragged = qa('[data-hgs4-node]').find(el => el.dataset.hgs4Node === drag.id); if (dragged)dragged.dataset.dragging = 'true';
		qa('[data-drop]').forEach(el => delete el.dataset.drop);
		const target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-hgs4-node]');
		const id = target?.dataset.hgs4Node;
		drag.target = id && id !== drag.id && root.contains(target) && containerFor(id) === drag.container ? id : null;
		if (drag.target) {const box = target.getBoundingClientRect(); drag.after = event.clientY > box.top + box.height / 2; target.dataset.drop = drag.after ? 'after' : 'before';}
	});

	function finishDrag(event, cancelled = false) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const done = drag; drag = null; if (done.handle.hasPointerCapture?.(event.pointerId))done.handle.releasePointerCapture(event.pointerId);
		qa('[data-drop]').forEach(el => delete el.dataset.drop); qa('[data-dragging]').forEach(el => delete el.dataset.dragging);
		if (cancelled || !done.moved) return;
		event.preventDefault();
		if (done.target) {const from = done.container.findIndex(n => n.id === done.id); const [item] = done.container.splice(from, 1); const to = done.container.findIndex(n => n.id === done.target) + (done.after ? 1 : 0); done.container.splice(to, 0, item); selectedId = item.id; tab = item.type; record(); render(); status('並び順を変更', item.name + 'を移動した — この図は同じ囲い内だけ対応。本体には反映していない');} else status('ドラッグを終了', '同じ囲い内の別の項目に重ねると、その前後へ移動できる — 囲いをまたぐ移動はこの図では省略');
	}

	on(root, 'pointerup', event => finishDrag(event));
	on(root, 'pointercancel', event => finishDrag(event, true));
	on(root, 'lostpointercapture', event => finishDrag(event, true));
	on(root, 'keydown', event => {if (event.key === 'Escape' && dialog) {event.preventDefault(); event.stopPropagation(); closeDialog();}});
	render();
	let disposed = false;
	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		for (const remove of listeners.splice(0)) remove();
		if (drag) finishDrag({ pointerId: drag.pointerId }, true);
		closeDialog();
		history = [];
		root.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
		mounts.delete(root);
	};
	mounts.set(root, cleanup);
	return cleanup;
}

/** Mount only this diagram and release all scene-owned work on disposal. */
export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hgs4-scene]') ? [scene] : [...scene.querySelectorAll('[data-hgs4-scene]')];
	const cleanups = roots.map(root => initOne(root));
	return () => { for (const cleanup of cleanups) cleanup(); };
}
