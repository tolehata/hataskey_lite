/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { hataskGuideProse } from './prose.js';
import { note } from './note-scenes.js';

export const templates = {
	'hg-channel-scene': `
  <div data-hgc-scene>
    <div class="hgc-frame" data-hgc-frame aria-label="チャンネル画面の操作例"></div>
    <div class="hgc-feedback" data-hgc-feedback role="status" aria-live="polite">この例は「フォロー中」からスタート。<br>上部の「検索」で「本」を探し、検索結果のカードを開いてみよう</div>
    <div class="hgc-reading">
      <div><strong><i class="ti ti-info-circle" aria-hidden="true"></i>概要で、場所のルールを読む</strong><p>説明とピン留めされたノートを確認。<br>どんな話題を話す場所なのか、最初に見ておこう</p></div>
      <div><strong><i class="ti ti-home" aria-hidden="true"></i>タイムラインで、最近の投稿を読む</strong><p>チャンネル内のノートが並ぶ場所。<br>読むだけでも大丈夫で、必ず投稿する必要はないよ</p></div>
    </div>
    <p class="hgc-limit">ログイン中の通常権限で開いた、バナー未設定の公開チャンネルの例。<br>名前・人数・投稿・フォロー状態は架空で、この例の中だけのもの。<br>上部タブは横にスクロールできるよ。<br>アカウントメニュー、作成、あいことばでの参加、URLコピー、投稿は説明のみで、実行しない</p>
  </div>
`,
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const icon = name => '<i class="ti ti-' + name + '" aria-hidden="true"></i>';
const channels = [
	{ id: 'books', name: '本の話をする場所', description: '読んだ本や、気になった一冊の話をどうぞ。\n作品の結末に触れるときは、内容を隠す「CW」を付けてください。', users: 24, notes: 128, updated: '2時間前', posts: ['通勤中に少しずつ読んでいた短編集、今日読み終わった。一話ずつ余韻があってよかった', '図書館で借りた本の装丁がすてきで、しばらく表紙を眺めていた'], pinned: 'ここは本の話をするチャンネルです。ネタバレになる内容は、CWで隠してから書いてください。' },
	{ id: 'daily', name: 'きょうのひと息', description: '散歩、お茶、読んでいる本のこと。\n一日の小さなひと息を、気軽に置いていく場所です。', users: 18, notes: 64, updated: '30分前', posts: ['散歩の帰りに冷たいお茶。風が少し涼しくなっていた', '窓を開けて、読みかけの本の続きを少しだけ'], pinned: '気軽なひとことも、読むだけの参加もどうぞ。' },
];
const indexTabs = [['search', 'search', '検索'], ['featured', 'comet', 'トレンド'], ['favorites', 'star', 'お気に入り'], ['following', 'eye', 'フォロー中'], ['owned', 'edit', '管理中']];
const detailTabs = [['overview', 'info-circle', '概要'], ['timeline', 'home', 'タイムライン'], ['featured', 'bolt', 'ハイライト'], ['search', 'search', '検索']];
const empty = () => '<div class="hgc-empty">' + icon('info-circle') + 'ありません</div>';
const iconButton = (name, label, attr) => '<button type="button" class="hgc-icon-button" aria-label="' + escape(label) + '" title="' + escape(label) + '" ' + attr + '>' + icon(name) + '</button>';
const stats = c => '<span class="hgc-stat"><span>' + icon('users') + '<span><b>' + c.users + '</b>人が参加中</span></span><span>' + icon('pencil') + '<span><b>' + c.notes + '</b>投稿があります</span></span></span>';

function card(c) {
	return '<button type="button" class="hgc-card" data-hgc-open="' + c.id + '" aria-label="' + escape(c.name) + 'の概要を開く"><span class="hgc-card-banner"><span class="hgc-fade"></span><span class="hgc-card-name">' + icon('device-tv') + '<span>' + escape(c.name) + '</span></span>' + stats(c) + '</span><span class="hgc-card-description">' + escape(c.description.replace(/\n/g, ' ')) + '</span><span class="hgc-card-footer">最終更新：' + c.updated + '</span></button>';
}

let instanceSequence = 0;

function initOne(root) {
	if (root.dataset.hgcReady) return () => {};
	root.dataset.hgcReady = 'true';
	const controller = new root.ownerDocument.defaultView.AbortController();
	const listen = (type, handler) => root.addEventListener(type, handler, { signal: controller.signal });
	const searchTypeName = 'hata-intro-channel-search-' + ++instanceSequence;
	let disposeNav = () => {};
	const state = { tab: 'following', query: '', submitted: null, type: 'nameAndDescription', channel: null, detailTab: 'overview', noteQuery: '', noteSubmitted: null, following: new Set(['daily']), favorites: new Set() };
	const frame = root.querySelector('[data-hgc-frame]');
	const say = message => {root.querySelector('[data-hgc-feedback]').innerHTML = hataskGuideProse(message);};
	const current = () => channels.find(c => c.id === state.channel);
	const fold = (title, body, cls = '') => '<details class="hgc-fold ' + cls + '" open><summary>' + title + icon('chevron-down') + '</summary>' + body + '</details>';

	function tabs() {
		return '<div class="hgc-tabs-wrap"><nav class="hgc-tabs" aria-label="' + (state.channel ? 'チャンネル内' : 'チャンネル一覧') + 'の表示切替">' + (state.channel ? detailTabs : indexTabs).map(([id, i, label]) => '<button type="button" class="hgc-tab" data-hgc-tab="' + id + '" aria-pressed="' + ((state.channel ? state.detailTab : state.tab) === id) + '">' + icon(i) + '<span>' + label + '</span></button>').join('') + '</nav></div>';
	}

	function searchForm() {
		const detail = !!state.channel;
		return '<form data-hgc-search-form><div class="hgc-capsule">' + icon('search') + '<input type="search" data-hgc-query aria-label="' + (detail ? 'チャンネル内のノートを検索' : 'チャンネルを検索') + '" placeholder="検索" autocomplete="off" value="' + escape(detail ? state.noteQuery : state.query) + '"><button type="button" data-hgc-clear aria-label="クリア"' + ((detail ? state.noteQuery : state.query) ? '' : ' hidden') + '>' + icon('x') + '</button><button type="submit" aria-label="検索">' + icon('search') + '</button></div>' + (detail ? '' : '<fieldset class="hgc-radios" aria-label="チャンネルの検索対象">' + [['nameAndDescription', '名前と説明'], ['nameOnly', '名前のみ']].map(([v, t]) => '<label><input type="radio" name="' + searchTypeName + '" value="' + v + '" data-hgc-type' + (state.type === v ? ' checked' : '') + '>' + t + '</label>').join('') + '</fieldset>') + '</form><div data-hgc-search-results></div>';
	}

	const notes = (c, posts) => '<div class="hgc-note-list">' + posts.map((text, index) => note(text, '', index ? 'そら' : 'はる', index ? '@sora' : '@haru')).join('') + '</div>';

	function results() {
		const slot = frame.querySelector('[data-hgc-search-results]'); if (!slot) return;
		if (state.channel) {
			const c = current();
			slot.innerHTML = state.noteSubmitted === null ? '' : notes(c, c.posts.filter(p => p.includes(state.noteSubmitted))) || '';
			if (state.noteSubmitted !== null && !slot.querySelector('.hgn-note'))slot.innerHTML = empty();
			return;
		}
		if (state.submitted === null) {slot.innerHTML = ''; return;}
		const found = channels.filter(c => (c.name + (state.type === 'nameAndDescription' ? ' ' + c.description : '')).includes(state.submitted));
		slot.innerHTML = fold('検索結果', '<div class="hgc-results">' + (found.map(card).join('') || empty()) + '</div>');
	}

	function overview(c) {
		const following = state.following.has(c.id), favorite = state.favorites.has(c.id);
		return '<section class="hgc-detail-panel" aria-label="チャンネルの説明"><button type="button" class="hgc-follow" data-hgc-follow aria-pressed="' + following + '">' + (following ? 'フォロー解除' : 'フォロー') + icon(following ? 'minus' : 'plus') + '</button><button type="button" class="hgc-icon-button hgc-favorite" data-hgc-favorite aria-pressed="' + favorite + '" aria-label="' + (favorite ? 'お気に入り解除' : 'お気に入り') + '">' + icon('star') + '</button><div class="hgc-detail-banner"><span class="hgc-fade"></span>' + stats(c) + '</div><p class="hgc-description">' + escape(c.description) + '</p></section>' + fold(icon('pin') + ' ピン留めされたノート', notes(c, [c.pinned]), 'hgc-pinned');
	}

	function render(focusSelector) {
		disposeNav();
		const c = current();
		const view = c ? 'detail' : 'index';
		const tabsScroll = frame.dataset.hgcView === view ? (frame.querySelector('.hgc-tabs')?.scrollLeft || 0) : 0;
		frame.dataset.hgcView = view;
		const left = iconButton('chevron-left', c ? 'チャンネル一覧に戻る' : '戻る', c ? 'data-hgc-back' : 'data-hgc-info="back"') + (!c ? iconButton('user-circle', 'アカウントメニュー', 'data-hgc-info="account"') : '');
		const right = c ? iconButton('link', 'URLをコピー', 'data-hgc-info="copy"') : iconButton('door-enter', 'あいことばで参加', 'data-hgc-info="join"') + iconButton('plus', '作成', 'data-hgc-info="create"');
		let body = '';
		if (c)body = state.detailTab === 'overview' ? overview(c) : state.detailTab === 'search' ? searchForm() : notes(c, state.detailTab === 'featured' ? [c.posts[0]] : c.posts);
		else if (state.tab === 'search')body = searchForm();
		else if (state.tab === 'owned')body = '<button type="button" class="hg-btn" data-hgc-info="create">' + icon('plus') + ' 作成</button>' + empty();
		else {
			const found = state.tab === 'featured' ? channels : channels.filter(item => (state.tab === 'following' ? state.following : state.favorites).has(item.id));
			body = '<div class="hgc-card-grid">' + (found.map(card).join('') || empty()) + '</div>';
		}
		frame.innerHTML = '<header class="hgc-header"><div class="hgc-header-side">' + left + '</div><strong class="hgc-title" title="' + escape(c ? c.name : 'チャンネル') + '">' + icon('device-tv') + '<span>' + escape(c ? c.name : 'チャンネル') + '</span></strong><div class="hgc-header-side">' + right + '</div></header>' + tabs() + '<div class="hgc-body" data-hgc-wide="' + (!c && state.tab !== 'search') + '">' + body + '</div>' + (c ? '<footer class="hgc-bottom"><button type="button" class="hg-btn" data-hgc-info="post">' + icon('pencil') + ' チャンネルに投稿</button></footer>' : '');
		results();
		const nav = frame.querySelector('.hgc-tabs');
		const navController = new root.ownerDocument.defaultView.AbortController();
		const listenNav = (type, handler, options = {}) => nav.addEventListener(type, handler, {
			...(typeof options === 'boolean' ? { capture: options } : options),
			signal: navController.signal,
		});
		nav.scrollLeft = tabsScroll;
		listenNav('wheel', event => {
			if (nav.scrollWidth <= nav.clientWidth) return;
			const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
			if ((delta < 0 && nav.scrollLeft <= 0) || (delta > 0 && nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 1)) return;
			event.preventDefault(); nav.scrollLeft += delta;
		}, { passive: false });
		// Match the native page's overflowing pill bar without capturing touch scrolling.
		let drag = null, suppressClick = false;
		listenNav('pointerdown', event => {if (event.pointerType === 'touch' || event.button !== 0 || nav.scrollWidth <= nav.clientWidth) return; drag = { x: event.clientX, left: nav.scrollLeft, id: event.pointerId, moved: false }; suppressClick = false;});
		listenNav('pointermove', event => {
			if (!drag || event.pointerId !== drag.id) return;
			if (event.buttons === 0) {endDrag(); return;}
			if (Math.abs(event.clientX - drag.x) > 4) {drag.moved = true; nav.setPointerCapture?.(event.pointerId); nav.scrollLeft = drag.left - (event.clientX - drag.x);}
		});
		const endDrag = () => {
			const currentDrag = drag;
			suppressClick = !!currentDrag?.moved;
			drag = null;
			if (currentDrag && nav.hasPointerCapture?.(currentDrag.id)) nav.releasePointerCapture(currentDrag.id);
		};
		disposeNav = () => {
			navController.abort();
			endDrag();
		};
		listenNav('pointerup', endDrag); listenNav('pointercancel', endDrag);
		listenNav('pointerleave', () => {if (drag && !drag.moved)drag = null;});
		listenNav('lostpointercapture', () => {drag = null;});
		listenNav('click', event => {if (suppressClick && event.detail !== 0) {event.preventDefault(); event.stopPropagation(); suppressClick = false;}}, true);
		if (focusSelector)frame.querySelector(focusSelector)?.focus({ preventScroll: true });
	}

	const hints = {
		back: '本体では直前のページへ戻るボタン。ここではガイドを離れずに、チャンネルの例を確認できるよ',
		account: '自分のアカウントのメニューを開く場所。モックではアカウント操作はしないよ',
		create: '自分でチャンネルを作る入口。はじめは既存の場所を読んでみよう。この例ではチャンネルを作成しない',
		join: 'あいことばを知っているプライベートチャンネルへ参加する入口。この例では入力や参加は行わない。実際のあいことばは入力しないでね',
		copy: 'このチャンネルのURLをコピーするボタン。この例のチャンネルは架空なので、クリップボードへのコピーは行わない',
		post: '本体では、このチャンネル宛ての投稿フォームが開く。説明やルールを読んでから、必要なときに使おう。モックから投稿は送信しない',
	};
	listen('input', event => {if (!event.target.matches('[data-hgc-query]')) return; state[state.channel ? 'noteQuery' : 'query'] = event.target.value; frame.querySelector('[data-hgc-clear]').hidden = event.target.value === '';});
	const search = () => {
		if (state.channel) {state.noteSubmitted = state.noteQuery; say('このチャンネルの架空のノートから、入力した言葉を検索した例。チャンネルそのものを探す検索とは別だよ');} else {state.submitted = state.query; say('検索結果のカードを開くと「概要」へ進む。「名前のみ」にすると、説明だけに「本」を含む「きょうのひと息」は検索対象から外れるよ');}
		results();
	};
	listen('submit', event => {if (!event.target.matches('[data-hgc-search-form]')) return; event.preventDefault(); search();});
	listen('change', event => {if (event.target.matches('[data-hgc-type]')) {state.type = event.target.value; search();}});
	listen('click', event => {
		const button = event.target.closest('button'); if (!button || !root.contains(button)) return;
		if (button.hasAttribute('data-hgc-tab')) {
			const tab = button.dataset.hgcTab;
			state[state.channel ? 'detailTab' : 'tab'] = tab;
			render('[data-hgc-tab="' + tab + '"]');
			say(state.channel ? ({ overview: 'まずは説明とピン留めを読もう。フォローはこのチャンネルを「フォロー中」に加える操作で、必ずする必要はないよ', timeline: 'このチャンネルの最近のノートが並ぶ画面。個々のノートのボタンの意味は「ノートのボタンとメニュー」で確認できるよ', featured: 'このチャンネルのハイライトを読む場所。この例には架空のノートを表示しているよ', search: 'このチャンネル内のノートを検索する欄。「本」などの言葉を入力して虫眼鏡を押してみよう' }[tab]) : ({ search: '「本」と入力し、右の虫眼鏡かEnterで検索してみよう。「名前と説明」「名前のみ」で探す範囲を変えられる', featured: '話題のチャンネルを探す「トレンド」。この例の並びや人数は架空のものだよ', favorites: '星でお気に入りにしたチャンネルが並ぶ場所。気になる場所は、概要の右上の星から加えられる', following: 'フォローしたチャンネルを並べる場所。ログイン中はこのタブから開く。まずは「検索」から好きな話題を探してみよう', owned: '自分が管理しているチャンネルを並べる場所。この例では管理中のチャンネルはなく、作成は説明のみだよ' }[tab]));
		} else if (button.hasAttribute('data-hgc-open')) {
			state.channel = button.dataset.hgcOpen; state.detailTab = 'overview'; state.noteQuery = ''; state.noteSubmitted = null;
			render('[data-hgc-tab="overview"]'); say('カードを開くと、まず「概要」が表示される。説明とピン留めを確認してから、上部の「タイムライン」で最近の投稿を読もう');
		} else if (button.hasAttribute('data-hgc-back')) {
			const id = state.channel; state.channel = null; render('[data-hgc-open="' + id + '"]');
			if (!frame.contains(root.ownerDocument.activeElement))frame.querySelector('[data-hgc-tab][aria-pressed="true"]')?.focus({ preventScroll: true });
			say('チャンネル一覧へ戻ったよ。検索した言葉と、開いていたタブはそのまま');
		} else if (button.hasAttribute('data-hgc-clear')) {
			state[state.channel ? 'noteQuery' : 'query'] = ''; const input = frame.querySelector('[data-hgc-query]'); input.value = ''; button.hidden = true; input.focus();
		} else if (button.hasAttribute('data-hgc-follow') || button.hasAttribute('data-hgc-favorite')) {
			const follow = button.hasAttribute('data-hgc-follow'), set = follow ? state.following : state.favorites;
			const added = !set.has(state.channel); if (added)set.add(state.channel); else set.delete(state.channel);
			render(follow ? '[data-hgc-follow]' : '[data-hgc-favorite]');
			say((follow ? 'フォロー' : 'お気に入り') + 'を' + (added ? '追加' : '解除') + 'した例。一覧の「' + (follow ? 'フォロー中' : 'お気に入り') + '」にも反映される。本体の状態は変わらないよ');
		} else if (button.hasAttribute('data-hgc-info'))say(hints[button.dataset.hgcInfo]);
	});
	render();
	return () => {
		controller.abort();
		disposeNav();
		delete root.dataset.hgcReady;
	};
}

export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hgc-scene]') ? [scene] : Array.from(scene.querySelectorAll('[data-hgc-scene]'));
	const cleanups = roots.map(initOne);
	return () => cleanups.forEach(cleanup => cleanup());
}
