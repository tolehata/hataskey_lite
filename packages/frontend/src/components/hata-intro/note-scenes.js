/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { hataskGuideProse } from './prose.js';

export const templates = {
	'hg-timeline-scene': `
  <section class="hgn-scene" data-hgn-kind="timeline">
    <div class="hgn-kicker"><strong>タイムライン上部のアイコン</strong><span>押すと意味と表示例が変わる</span></div>
    <div class="hgn-surface"><nav class="hgn-navbar" data-hgn-navbar aria-label="タイムラインの種類の例"></nav><div data-hgn-note-slot></div></div>
    <div class="hgn-meaning" data-hgn-meaning aria-live="polite"></div>
    <details class="hgn-legend" open><summary>アイコンと名前を一覧で見る</summary><div class="hgn-legend-grid" data-hgn-nav-legend></div></details>
    <p class="hgn-caption">上部バーの抜粋。実画面も選択中の名前が広がる。狭い画面ではバーを横に送って右側のアイコンを探せる</p>
  </section>
`,
	'hg-note-scene': `
  <section class="hgn-scene" data-hgn-kind="note">
    <div class="hgn-kicker"><strong>ノートの下にあるボタン</strong><span>アイコンを押して操作の意味を確認</span></div>
    <div class="hgn-surface"><div data-hgn-note-slot></div><div class="hgn-inline-area" data-hgn-inline></div></div>
    <div class="hgn-meaning" data-hgn-meaning aria-live="polite"></div>
    <details class="hgn-legend"><summary>設定によって表示されるボタン</summary><div class="hgn-legend-grid" data-hgn-extra-actions></div></details>
    <p class="hgn-caption">公開ノートと既定のボタン設定をもとにした例。リノートできないノートでは禁止マークになり、設定によって並ぶボタンも変わる</p>
  </section>
`,
	'hg-reaction-scene': `
  <section class="hgn-scene" data-hgn-kind="reaction">
    <div class="hgn-kicker"><strong>カスタム絵文字で反応する</strong><span>顔の「＋」→ 画像を選ぶ → ノートへ反映</span></div>
    <div class="hgn-surface"><div data-hgn-note-slot></div><div class="hgn-inline-area" data-hgn-inline></div></div>
    <div class="hgn-meaning" data-hgn-meaning aria-live="polite"></div>
    <p class="hgn-caption">絵文字画像はガイド専用の作例。本体の絵文字とは異なる。ここで選んでも投稿者への通知や本体の記録は発生しない</p>
    <p class="hgn-caption">本体では検索やカテゴリから選べる。「いいねのみ」のノートでは顔の「＋」がハートに変わり、絵文字選択は開かない</p>
  </section>
`,
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const icon = value => '<i class="ti ti-' + value + '" aria-hidden="true"></i>';
const timelines = [
	{ id: 'home', icon: 'home', name: 'ホーム', text: '自分とフォローしている人のノートを読む場所', sample: 'フォローしている人と、今日の出来事をゆっくり話そう', condition: 'いつもの人の投稿を追いたいときに' },
	{ id: 'local', icon: 'planet', name: 'ローカル', text: '同じサーバーにいる人の公開ノートが流れる場所', sample: '同じサーバーの誰かが、おすすめの喫茶店を話している', condition: 'まだフォローしていない人とも出会える' },
	{ id: 'social', icon: 'users', name: 'ソーシャル', text: 'ホームとローカルを合わせて読む場所', sample: 'フォローしている人の話と、同じサーバーの話がひとつの流れに', condition: '設定で表示したときに追加されるタブ', optional: true },
	{ id: 'global', icon: 'universe', name: 'グローバル', text: 'このサーバーが受け取っている、他サーバーを含む公開ノートを読む場所', sample: '別のサーバーから、散歩で見つけた景色の話が届いた', condition: '世界中の全投稿が集まるわけではない' },
	{ id: 'trend', icon: 'flame', name: 'トレンド', text: '過去7日間でリアクションやリノートが多かったノートに出会う場所', sample: 'みんなが反応した、少し前の投稿を見つけた', condition: '新着順ではなく、集めたノートの順番を入れ替えて表示する' },
	{ id: 'external-home', icon: 'home', name: '外部ホーム', text: '連携した外部アカウントのホームを、この画面で読む場所', sample: '連携先のアカウントがフォローしている人の投稿', condition: '外部連携と外部ホームの表示設定が有効な場合だけ追加', optional: true, external: true },
	{ id: 'external-local', icon: 'planet', name: '外部ローカル', text: '連携先サーバーのローカルタイムラインを読む場所', sample: '連携先のサーバーで交わされている会話', condition: '外部連携と外部ローカルの表示設定が有効な場合だけ追加', optional: true, external: true },
	{ id: 'list', icon: 'list', name: 'リスト', text: '選んだ人をまとめたリストのタイムラインを開く', sample: '「本の話」リストに入れた人のおすすめを読む', condition: '未作成なら案内の「オプション」から作成。表示中は切替と設定のボタンも出る', page: true },
	{ id: 'channel', icon: 'device-tv', name: 'チャンネル', text: '話題ごとのチャンネルを探す一覧ページを開く', sample: '写真や趣味のチャンネルを探して、気になる場所へ', condition: 'このアイコンはチャンネル一覧への入口。押した先はタイムラインのタブではない', page: true },
	{ id: 'antenna', icon: 'antenna', name: 'アンテナ', text: 'キーワードなど、自分で決めた条件に合うノートを集めて読む', sample: '気になる言葉を含むノートがアンテナに集まった', condition: '未作成なら「オプション」から設定。表示中は切替と設定のボタンも出る', page: true },
];
const actions = {
	reply: { icon: 'arrow-back-up', name: '返信', text: 'このノートへの返信を書く投稿フォームが開く', detail: '自分の言葉で会話を続けたいときに使う' },
	renote: { icon: 'repeat', name: 'リノート', text: 'このノートをそのまま共有する', detail: '既定設定ではメニューからリノートや公開範囲を選ぶ。押しただけで必ず共有完了にはならない' },
	reaction: { icon: 'mood-plus', name: 'リアクションする', text: '絵文字をひとつ選んで、短い反応を返す', detail: 'カスタム絵文字の画像も使える。下の選択画面を試してみよう' },
	quote: { icon: 'quote', name: '引用', text: 'このノートを添えて、自分のコメントを書く投稿フォームが開く', detail: 'そのまま共有するリノートに、ひと言添えたいときに' },
	more: { icon: 'dots', name: 'もっと！', text: 'お気に入り、クリップ、リンクのコピーなどを開く', detail: '星のお気に入りはこのメニュー内。ハートや絵文字リアクションとは別の操作' },
	like: { icon: 'heart', name: 'いいね！', text: '設定してあるリアクションを直接送る。既定のリアクションはハート', detail: '単独のハートボタンは設定で表示したときに追加される' },
	clip: { icon: 'paperclip', name: 'クリップ', text: 'ノートをクリップにまとめて保存する', detail: '単独ボタンは設定で追加できる。既定では「もっと！」→「クリップ」から開く' },
	info: { icon: 'info-circle', name: '詳細', text: 'このノートの詳細ページを開く', detail: 'ノートの操作ボタンをホバー時だけ表示する設定など、特定の設定時に出る' },
};
const emojiDefs = [
	{ id: 'nice', word: 'いいね', alias: 'いいね nice good', color: '#217c86' },
	{ id: 'agree', word: 'わかる', alias: 'わかる agree wakaru', color: '#8057a5' },
	{ id: 'thanks', word: 'ありがとう', alias: 'ありがとう thanks 感謝', color: '#ad5e3c' },
	{ id: 'rest', word: 'おつかれ', alias: 'おつかれ rest otsukare', color: '#4d788d' },
	{ id: 'happy', word: 'うれしい', alias: 'うれしい happy 喜び', color: '#a44370' },
	{ id: 'cheer', word: '応援してる', alias: '応援 おうえん cheer', color: '#487945' },
];

function emojiImage(emoji) {
	const size = emoji.word.length > 4 ? 20 : 25;
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="132" height="52" viewBox="0 0 132 52"><rect x="1" y="1" width="130" height="50" rx="15" fill="' + emoji.color + '"/><text x="66" y="34" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="' + size + '" fill="white">' + emoji.word + '</text></svg>';
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function emojiMarkup(id) {
	const emoji = emojiDefs.find(e => e.id === id);
	return emoji ? '<img src="' + emojiImage(emoji) + '" width="132" height="52" alt="' + escape(emoji.word) + '（作例）">' : '<span class="hgn-unicode">' + escape(id) + '</span>';
}

function interactiveNote(text, highlight = '', name = 'はる', account = '@haru') {
	const map = { 'arrow-back-up': 'reply', repeat: 'renote', 'mood-plus': 'reaction', quote: 'quote', dots: 'more', heart: 'reaction' };
	highlight = map[highlight] || highlight;
	return '<article class="hgn-note"><div class="hgn-bubble"><div class="hgn-note-row"><div class="hgn-avatar" role="img" aria-label="風景を描いたサンプルアイコン"></div><div class="hgn-note-main"><div class="hgn-note-header"><strong>' + escape(name) + '</strong><small>' + escape(account) + '</small><small class="hgn-note-time">サンプル</small></div><div class="hgn-note-content"><p class="hgn-note-text">' + escape(text) + '</p></div></div></div><div class="hgn-note-bottom"><div class="hgn-chips" data-hgn-chips></div><footer class="hgn-note-actions">' + ['reply', 'renote', 'reaction', 'quote', 'more'].map(id => '<button type="button" class="hgn-note-action" data-hgn-action="' + id + '" aria-label="' + actions[id].name + '" title="' + actions[id].name + '"' + (highlight === id ? ' data-highlight="true"' : '') + '>' + icon(actions[id].icon) + '</button>').join('') + '</footer></div></div></article>';
}

function meaning(scene, item) {
	const area = scene.querySelector('[data-hgn-meaning]');
	if (area) area.innerHTML = '<div class="hgn-meaning-icon">' + icon(item.icon) + '</div><div><strong>' + escape(item.name) + '</strong><p>' + hataskGuideProse(item.text) + '</p><small>' + hataskGuideProse(item.detail || item.condition || '') + '</small></div>';
}

function renderTimeline(scene, state) {
	const selected = timelines.find(t => t.id === state.timeline);
	const navbar = scene.querySelector('[data-hgn-navbar]');
	const visible = timelines.filter(t => !t.optional || t.id === selected.id);
	navbar.innerHTML = visible.map(t => (t.id === 'list' ? '<span class="hgn-nav-divider" aria-hidden="true"></span>' : '') + '<button type="button" class="hgn-nav-button" data-hgn-timeline="' + t.id + '" data-external="' + !!t.external + '" aria-pressed="' + (t.id === selected.id) + '" aria-label="' + t.name + '" title="' + t.name + '">' + icon(t.icon) + (t.id === selected.id ? '<span>' + t.name + '</span>' : '') + '</button>' + (t.id === selected.id && ['list', 'antenna'].includes(t.id) ? '<button type="button" class="hgn-nav-button" data-hgn-collection="switch" aria-label="' + t.name + 'を切り替え">' + icon('selector') + '</button><button type="button" class="hgn-nav-button" data-hgn-collection="settings" aria-label="' + t.name + 'の設定">' + icon('settings') + '</button>' : '')).join('');
	scene.querySelector('[data-hgn-nav-legend]').innerHTML = timelines.map(t => '<button type="button" class="hgn-legend-item" data-hgn-timeline="' + t.id + '" aria-pressed="' + (t.id === selected.id) + '">' + icon(t.icon) + '<span>' + t.name + '<small>' + (t.optional ? '設定・連携時に表示' : t.page ? '専用ページへの入口' : 'タイムライン') + '</small></span></button>').join('');
	const slot = scene.querySelector('[data-hgn-note-slot]');
	slot.innerHTML = selected.page ? '<div class="hgn-meaning" style="margin-top:0"><div class="hgn-meaning-icon">' + icon(selected.icon) + '</div><div><strong>' + (selected.id === 'channel' ? 'チャンネル一覧へ' : selected.name + 'のタイムラインへ') + '</strong><p>' + hataskGuideProse(selected.sample) + '</p><small>このガイドでは移動先の意味を表示</small></div></div>' : interactiveNote(selected.sample);
	meaning(scene, selected);
}

function renderChips(scene, state) {
	const chips = scene.querySelector('[data-hgn-chips]');
	if (!chips) return;
	const ids = [...new Set(['agree', ...(state.reaction ? [state.reaction] : [])])];
	chips.innerHTML = ids.map(id => '<button type="button" class="hgn-chip" data-hgn-choose="' + escape(id) + '" aria-pressed="' + (state.reaction === id) + '" title="' + escape(emojiDefs.find(e => e.id === id)?.word || id) + '">' + emojiMarkup(id) + '<span>' + ((id === 'agree' ? 2 : 0) + (state.reaction === id ? 1 : 0)) + '</span></button>').join('');
	const button = scene.querySelector('[data-hgn-action="reaction"]');
	if (button) {
		const label = state.reaction ? 'リアクションを編集' : 'リアクションする';
		button.innerHTML = icon(state.reaction ? 'mood-edit' : 'mood-plus');
		button.setAttribute('aria-label', label); button.title = label;
		button.style.color = state.reaction ? 'var(--hg-accent)' : '';
	}
}

function closeInline(scene, focusAction) {
	const area = scene.querySelector('[data-hgn-inline]');
	if (area) area.innerHTML = '';
	if (focusAction) scene.querySelector('[data-hgn-action="' + focusAction + '"]')?.focus({ preventScroll: true });
}

function openPicker(scene, state) {
	state.pickerTab = 'index'; state.query = '';
	const area = scene.querySelector('[data-hgn-inline]');
	if (!area) return;
	area.innerHTML = '<section class="hgn-picker" aria-label="リアクションを選ぶ例"><div class="hgn-picker-head"><input type="search" class="hgn-search" data-hgn-search placeholder="検索" aria-label="絵文字の名前や別名で検索"><button type="button" class="hgn-picker-close" data-hgn-close aria-label="絵文字選択を閉じる">' + icon('x') + '</button></div><div class="hgn-picker-content" data-hgn-picker-content></div><div class="hgn-picker-tabs">' + [['index', 'asterisk', '最近使用'], ['custom', 'mood-happy', 'カスタム絵文字'], ['unicode', 'leaf', '絵文字'], ['tags', 'hash', '検索タグ']].map(([id, ico, label]) => '<button type="button" class="hgn-picker-tab" data-hgn-picker-tab="' + id + '" aria-label="' + label + '" title="' + label + '">' + icon(ico) + '</button>').join('') + '</div></section>';
	renderPicker(scene, state);
	scene.querySelector('[data-hgn-search]')?.focus({ preventScroll: true });
}

function renderPicker(scene, state) {
	const area = scene.querySelector('[data-hgn-picker-content]'); if (!area) return;
	scene.querySelectorAll('[data-hgn-picker-tab]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.hgnPickerTab === state.pickerTab)));
	if (state.pickerTab === 'unicode' && !state.query) {
		area.innerHTML = '<p class="hgn-picker-label">絵文字 · Unicode</p><div class="hgn-picker-grid">' + ['😊', '❤️', '👏'].map(e => '<button type="button" class="hgn-emoji-button" data-hgn-choose="' + e + '" aria-label="' + e + '"><span class="hgn-unicode">' + e + '</span></button>').join('') + '</div><p class="hgn-caption">こちらは文字の絵文字。<br>カスタム絵文字の画像とは別の種類</p>';
		return;
	}
	if (state.pickerTab === 'tags' && !state.query) {
		area.innerHTML = '<p class="hgn-picker-label">名前や別名で絵文字を探す</p><div class="hgn-chips">' + ['感謝', 'わかる', '応援'].map(q => '<button type="button" class="hgn-small-button" data-hgn-search-term="' + q + '">' + icon('hash') + q + '</button>').join('') + '</div><p class="hgn-caption">ガイド用の検索例。<br>タグや絵文字はサーバーによって異なる</p>';
		return;
	}
	const query = state.query.trim().toLowerCase();
	const found = emojiDefs.filter(e => !query || query.split(/\s+/).every(q => e.alias.includes(q) || e.id.includes(q)));
	const recent = state.pickerTab === 'index' && !query;
	const shown = recent ? emojiDefs.filter(e => e.id === state.reaction || e.id === 'agree') : found;
	area.innerHTML = '<p class="hgn-picker-label">' + (query ? '検索結果' : recent ? icon('clock') + ' 最近使用 · 作例' : 'カスタム絵文字 › あいさつ・気持ち（作例）') + '</p>' + (shown.length ? '<div class="hgn-picker-grid">' + shown.map(e => '<button type="button" class="hgn-emoji-button" data-hgn-choose="' + e.id + '" title=":' + e.id + ':" aria-label="' + e.word + '（作例）">' + emojiMarkup(e.id) + '<small>:' + e.id + ':</small></button>').join('') + '</div>' : '<p class="hgn-caption">この例には見つからなかったよ。<br>「わかる」や「ありがとう」で試してみて</p>') + (recent ? '<p class="hgn-caption">下の顔アイコンでカスタム絵文字の作例一覧へ。<br>上の検索からも探せる</p>' : '');
}

function applyReaction(scene, state, id) {
	state.reaction = id;
	renderChips(scene, state); closeInline(scene, 'reaction');
	meaning(scene, { icon: id ? 'mood-edit' : 'mood-plus', name: id ? 'ノートにリアクションが付いた' : 'リアクションを取り消した', text: id ? '本文の下に画像と件数が表示され、自分の反応が強調された' : '自分が付けた分が外れた。他の人の反応は残る', detail: '本体への送信はしていない、このガイドだけの操作' });
}

function chooseReaction(scene, state, id) {
	if (!state.reaction) { applyReaction(scene, state, id); return; }
	const area = scene.querySelector('[data-hgn-inline]');
	const cancel = state.reaction === id;
	area.innerHTML = '<div class="hgn-choice-note" role="group" aria-label="リアクションの確認"><p>' + (cancel ? 'リアクションを取り消しますか？' : 'リアクションを変更しますか？') + '</p><button type="button" class="hgn-small-button" data-hgn-confirm-cancel>キャンセル</button><button type="button" class="hgn-small-button" data-primary data-hgn-confirm-reaction="' + (cancel ? '' : escape(id)) + '">' + (cancel ? '取り消す' : '変更する') + '</button></div>';
	area.querySelector('[data-hgn-confirm-cancel]')?.focus({ preventScroll: true });
}

const menuItems = [
	['share', 'share', '共有', '対応する端末では、共有先を選ぶ画面を開く'],
	['link', 'link', 'リンクをコピー', 'ノートのURLをコピーする'],
	['copy', 'copy', '内容をコピー', 'ノートの本文をコピーする'],
	['code', 'qrcode', '二次元コードを取得', 'このノートを開く二次元コードを表示する'],
	['open', 'external-link', '新しいタブで開く', 'このノートを新しいタブで開く'],
	['favorite', 'star', 'お気に入り', 'あとから自分で読み返すために保存する'],
	['clip', 'paperclip', 'クリップ', 'ノートをまとめるクリップを選ぶ'],
	['mute', 'message-off', 'スレッドをミュート', 'この会話の通知を受け取らないようにする'],
	['note', 'note', 'ノート', '詳細・リノート一覧・リアクション一覧などを開く'],
	['user', 'user', 'ユーザー', 'この投稿者のプロフィールや操作を開く'],
	['report', 'exclamation-circle', '通報', '問題のある投稿をサーバーの管理者へ報告する'],
];

function openMore(scene, state) {
	scene.querySelector('[data-hgn-inline]').innerHTML = '<div class="hgn-menu" aria-label="もっと！メニューの例"><div class="hgn-menu-label">他の人の公開ノートを開いた例</div>' + menuItems.map(([id, ico, label]) => (['favorite', 'report'].includes(id) ? '<div class="hgn-menu-divider"></div>' : '') + '<button type="button" class="hgn-menu-button" data-hgn-menu="' + id + '">' + icon(id === 'favorite' && state.favorite ? 'star-off' : ico) + '<span>' + (id === 'favorite' && state.favorite ? 'お気に入り解除' : label) + '</span>' + (['clip', 'note', 'user'].includes(id) ? '<i class="ti ti-chevron-right hgn-menu-chevron" aria-hidden="true"></i>' : '') + '</button>').join('') + '<div class="hgn-menu-label">項目を押すと意味を表示。本体へは送信しない</div></div>';
}

function activateAction(scene, state, id) {
	const action = actions[id]; if (!action) return;
	scene.querySelectorAll('[data-hgn-action]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.hgnAction === id)));
	meaning(scene, action); closeInline(scene);
	if (id === 'reaction') openPicker(scene, state);
	if (id === 'more') openMore(scene, state);
	if (id === 'renote') scene.querySelector('[data-hgn-inline]').innerHTML = '<div class="hgn-menu" aria-label="リノートメニューの例"><div class="hgn-menu-label">公開ノートのリノート · 説明用</div>' + [['repeat', 'リノート'], ['world', 'リノート（パブリック）'], ['home', 'リノート（ホーム）'], ['lock', 'リノート（フォロワー）']].map(([ico, label]) => '<button type="button" class="hgn-menu-button" data-hgn-renote-info="' + label + '">' + icon(ico) + '<span>' + label + '</span></button>').join('') + '</div>';
}

function bindScene(scene) {
	if (scene.dataset.hgnInitialized) return () => {};
	scene.dataset.hgnInitialized = 'true';
	const controller = new scene.ownerDocument.defaultView.AbortController();
	const listen = (type, handler) => scene.addEventListener(type, handler, { signal: controller.signal });
	const kind = scene.dataset.hgnKind;
	const state = { timeline: 'home', reaction: null, favorite: false, pickerTab: 'custom', query: '' };
	if (kind === 'timeline') renderTimeline(scene, state);
	else {
		scene.querySelector('[data-hgn-note-slot]').innerHTML = interactiveNote(kind === 'reaction' ? '今日は少しだけ前に進めた。話を聞いてくれてありがとう' : '気になる本を読み始めた。誰かのおすすめから、新しい楽しみが増えていく', kind === 'reaction' ? 'reaction' : '');
		renderChips(scene, state);
		meaning(scene, kind === 'reaction' ? { icon: 'mood-plus', name: 'まずは顔の「＋」を押してみよう', text: '検索や画像タイルから、気持ちに合う絵文字を選べる', detail: 'すでに付いている「わかる」のチップを押して、同じ反応を返すこともできる' } : { icon: 'hand-click', name: 'ノートの下をひとつずつ押してみよう', text: '返信・リノート・リアクション・引用・もっと！が、既定の並び', detail: 'ボタンの意味がここに表示される' });
		const extra = scene.querySelector('[data-hgn-extra-actions]');
		if (extra) extra.innerHTML = ['like', 'clip', 'info'].map(id => '<button type="button" class="hgn-legend-item" data-hgn-action="' + id + '">' + icon(actions[id].icon) + '<span>' + actions[id].name + '<small>設定によって追加</small></span></button>').join('');
	}
	listen('input', ev => {
		if (ev.target.matches('[data-hgn-search]')) { state.query = ev.target.value; renderPicker(scene, state); }
	});
	listen('keydown', ev => {
		if (ev.key === 'Escape' && scene.querySelector('[data-hgn-inline]')?.children.length) { closeInline(scene, 'reaction'); ev.preventDefault(); ev.stopPropagation(); }
	});
	listen('click', ev => {
		const button = ev.target.closest('button'); if (!button || !scene.contains(button)) return;
		if (button.hasAttribute('data-hgn-timeline')) {
			const id = button.dataset.hgnTimeline; if (!timelines.some(t => t.id === id)) return;
			const fromNavbar = !!button.closest('[data-hgn-navbar]');
			state.timeline = id; renderTimeline(scene, state);
			const target = scene.querySelector((fromNavbar ? '[data-hgn-navbar]' : '[data-hgn-nav-legend]') + ' [data-hgn-timeline="' + id + '"]');
			target?.focus({ preventScroll: true });
			if (fromNavbar) target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		} else if (button.hasAttribute('data-hgn-collection')) {
			const t = timelines.find(t => t.id === state.timeline);
			meaning(scene, { icon: button.dataset.hgnCollection === 'switch' ? 'selector' : 'settings', name: t.name + (button.dataset.hgnCollection === 'switch' ? 'を切り替え' : 'の設定'), text: button.dataset.hgnCollection === 'switch' ? '上部バーの下に選択肢が開き、別の' + t.name + 'を選べる' : 'いま表示している' + t.name + 'の設定ページを開く', detail: 'この例では移動先の意味を表示' });
		} else if (button.hasAttribute('data-hgn-action')) {
			if (kind === 'timeline') meaning(scene, actions[button.dataset.hgnAction]);
			else activateAction(scene, state, button.dataset.hgnAction);
		} else if (button.hasAttribute('data-hgn-close') || button.hasAttribute('data-hgn-confirm-cancel')) closeInline(scene, 'reaction');
		else if (button.hasAttribute('data-hgn-picker-tab')) { state.pickerTab = button.dataset.hgnPickerTab; renderPicker(scene, state); } else if (button.hasAttribute('data-hgn-search-term')) { state.query = button.dataset.hgnSearchTerm; scene.querySelector('[data-hgn-search]').value = state.query; renderPicker(scene, state); } else if (button.hasAttribute('data-hgn-choose')) chooseReaction(scene, state, button.dataset.hgnChoose);
		else if (button.hasAttribute('data-hgn-confirm-reaction')) applyReaction(scene, state, button.dataset.hgnConfirmReaction || null);
		else if (button.hasAttribute('data-hgn-menu')) {
			const item = menuItems.find(m => m[0] === button.dataset.hgnMenu); if (!item) return;
			if (item[0] === 'favorite') { state.favorite = !state.favorite; openMore(scene, state); }
			meaning(scene, { icon: item[1], name: item[0] === 'favorite' ? state.favorite ? 'お気に入りに保存した例' : 'お気に入りを解除した例' : item[2], text: item[3], detail: item[0] === 'favorite' ? '反応を返す絵文字とは別。本体のお気に入りは変更していない' : 'この例では操作の意味を表示するだけで、コピー・移動・送信は行わない' });
		} else if (button.hasAttribute('data-hgn-renote-info')) meaning(scene, { icon: 'repeat', name: button.dataset.hgnRenoteInfo, text: '本体では、この項目を選ぶとノートを共有する', detail: 'これは説明用の画面。本体へのリノートは行っていない' });
	});
	return () => {
		controller.abort();
		delete scene.dataset.hgnInitialized;
	};
}

/** Display-only notes intentionally have no posting, reaction or menu controls. */
export function note(text, highlight, name, account) {
	return interactiveNote(text, highlight, name, account)
		.replace(/<button type="button" class="hgn-note-action" data-hgn-action="[^"]+"/g, '<span role="img" class="hgn-note-action"')
		.replace(/<\/button>/g, '</span>');
}

export function init(scene) {
	if (!scene) return () => {};
	const scenes = [...(scene.matches('[data-hgn-kind]') ? [scene] : []), ...scene.querySelectorAll('[data-hgn-kind]')];
	const cleanups = scenes.map(bindScene);
	return () => cleanups.forEach(cleanup => cleanup());
}
