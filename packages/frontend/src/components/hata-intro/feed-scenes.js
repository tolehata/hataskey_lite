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
	'hg-feed-scene': `
  <section class="hgf4" data-hf-root data-source="packages/frontend/src/pages/hatafeed.vue:38-298; packages/frontend/src/components/HataFeedIssue.vue:13-216; packages/frontend/src/components/HataFeedIssueWizard.vue:12-97" aria-label="HataFeedの操作例">
    <div class="hgf4-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span>HataFeedの画面例 · イシュー、人物、予定、絵文字はすべて架空<br>タブ・検索・絞り込み・イシュー選択・作成の3手順を試せます。<br>API通信・投稿・保存は行いません</span></div>
    <div class="hgf4-body" data-hf-view>
      <div class="hgf4-toolbar"><span class="hgf4-logo">HataFeed</span><span class="hgf4-divider"></span><span class="hgf4-project"><i class="ti ti-flag-2" aria-hidden="true"></i>Hataskey<i class="ti ti-selector" aria-hidden="true"></i></span></div>
      <div class="hgf4-tabs"><span class="hgf4-tab">イシュー</span><span class="hgf4-tab">ロードマップ</span><span class="hgf4-tab">ベータ</span></div>
      <div class="hgf4-top-actions"><span class="hgf4-top-action"><i class="ti ti-mood-plus" aria-hidden="true"></i>絵文字申請</span><span class="hgf4-top-action"><i class="ti ti-pencil-plus" aria-hidden="true"></i>新規イシュー</span></div>
      <div class="hgf4-list"><div class="hgf4-row"><i class="ti ti-circle-dot hgf4-row-icon" aria-hidden="true"></i><div class="hgf4-row-main"><div class="hgf4-row-title">検索欄を閉じると入力が残る<span class="hgf4-pill" data-cat="bug">不具合</span></div><div class="hgf4-meta">#84 · あきが2時間前に作成 · 受付中</div></div><span class="hgf4-meta"><i class="ti ti-message-2" aria-hidden="true"></i> 1</span></div></div>
      <p class="hgf4-caption">架空イシューの一覧です。<br>この図の操作は、実際のイシューに影響しません</p>
    </div>
    <div class="hgf4-window-slot" data-hf-window></div>
    <div class="hgf4-footer">「図」の操作は表示のみです。<br>プロジェクト切替・通知・更新・ベータ・絵文字申請・コメント・賛同は、この例では実行できません<div role="status" aria-live="polite" data-hf-feedback>実際の投稿や申請はHataskey本体で行います</div></div>
  </section>
`,
};

const cats = {
	bug: ['不具合', 'bug', '動作がおかしい・エラーが出る等の不具合報告'],
	unresolved: ['未解決', 'help-circle', '原因不明・未解決の事象'],
	featureRequest: ['機能要望', 'bulb', 'こんな機能がほしい、という要望'],
	adoptionRequest: ['取入要望', 'download', '本家などの機能をHataskeyにも取り入れてほしい要望'],
	betaFeature: ['ベータ機能', 'flask', 'ベータ機能で起きた不具合・要望'],
	other: ['その他', 'dots', 'どれにも当てはまらないもの'],
	improvement: ['改善予定', 'arrow-up-circle', 'すでに改善が予定されている事柄'],
};
const statuses = { open: ['受付中', 'circle-dot'], planned: ['対応予定', 'calendar-time'], inProgress: ['対応中', 'progress'], resolved: ['解決済み', 'circle-check'], wontfix: ['見送り', 'circle-minus'], unknown: ['用途不明', 'help-circle'], closed: ['受付終了', 'lock'] };
const people = { aki: 'あき', sora: 'そら', rin: 'りん' };
const issues = [
	{ id: 84, title: '検索欄を閉じると入力が残る', cat: 'bug', status: 'open', person: 'aki', time: '2時間前', heart: 3, body: '【操作内容】\n検索欄に文字を入れ、閉じてからもう一度開きました\n\n【発生した事象】\n前に入力した文字が残っていました\n\n【期待する挙動】\n閉じたときに入力が消えると思っていました\n\n端末：スマートフォン / ブラウザ：サンプル環境', reply: '操作手順の共有、ありがとうございます。入力を保持する場面も含めて確認します', assignee: 'rin' },
	{ id: 83, title: 'リストの並び順を選べるようにしたい', cat: 'featureRequest', status: 'planned', person: 'sora', time: '5時間前', heart: 6, body: 'よく使うリストを先に開きたいので、名前順だけでなく自分で並び順を選べると助かります', reply: '使い方を教えていただきありがとうございます。対応予定として整理しました', assignee: 'rin' },
	{ id: 82, title: '画像が一度だけ読み込まれなかった', cat: 'unresolved', status: 'inProgress', person: 'aki', time: '昨日', heart: 2, body: '昨日の夕方、添付画像を開いたときだけ読み込みが止まりました。再読み込み後は表示されています。再現したら時間と操作を追記します', reply: 'こちらでも確認を進めています。再発時の状況が分かったら、この会話へ追記してください', assignee: 'rin' },
	{ id: 81, title: 'ベータの入力欄で折り返しを確認したい', cat: 'betaFeature', status: 'open', person: 'sora', time: '昨日', heart: 1, body: 'ベータ機能を小さなウィンドウで使ったとき、長い入力がどこで折り返されるか確認したいです', reply: '画面幅の情報もあると確認しやすくなります', assignee: null },
	{ id: 78, title: '使い方で気づいた点をまとめました', cat: 'other', status: 'open', person: 'aki', time: '2日前', heart: 1, body: 'はじめて使う人と一緒に試して、入口が見つけにくかったところを記録しています', reply: '気づいた点を一つずつ書いていただけると助かります', assignee: null },
	{ id: 80, title: '本家の表示切替を取り入れてほしい', cat: 'adoptionRequest', status: 'resolved', person: 'sora', time: '3日前', heart: 4, body: '読むときの表示切替を、Hataskeyでも選べると便利だと思います', reply: 'この画面例では、対応が終わったイシューの状態を示しています', assignee: 'rin', closed: true },
	{ id: 85, title: '検索結果の表示を調整', cat: 'improvement', status: 'planned', person: 'rin', time: '1時間前', heart: 2, body: '検索結果の説明文と余白を調整する予定です。\n\nこれはガイド用の架空の予定で、実際の開発予定ではありません', reply: '関連する不具合や要望がある場合は、内容が分かるイシューを添えてください', assignee: 'rin', pinned: true },
	{ id: 79, title: '狭い画面の一覧表示を改善', cat: 'improvement', status: 'inProgress', person: 'rin', time: '2日前', heart: 5, body: 'スマートフォンで長いタイトルを読めるよう、一覧の余白を調整しています。\n\nこれはガイド用の架空の予定です', reply: '小さな画面での読みやすさを確認しています', assignee: 'rin' },
];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const icon = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const tag = '<span class="hgf4-static-tag">図</span>';
const avatar = (id, size = '') => `<span class="hgf4-avatar" data-person="${id}"${size ? ` style="width:${size}px;height:${size}px"` : ''} aria-label="${people[id]}（架空の人物）">${people[id].slice(0, 1)}</span>`;
const cat = id => `<span class="hgf4-pill" data-cat="${id}">${cats[id][0]}</span>`;
const status = (id, filled = false) => `<span class="hgf4-pill" data-status="${id}"${filled ? ' data-filled="true"' : ''}>${icon(statuses[id][1])}${statuses[id][0]}</span>`;
const star = '<svg viewBox="0 0 24 24" role="img" aria-label="架空のきらきら絵文字"><path d="m12 2 2.8 6.2 6.7.8-5 4.6 1.4 6.7L12 17l-5.9 3.3 1.4-6.7-5-4.6 6.7-.8Z" fill="#edb943" stroke="#9a6917" stroke-width="1.1"/><circle cx="9.5" cy="11.7" r=".8" fill="#533b18"/><circle cx="14.5" cy="11.7" r=".8" fill="#533b18"/><path d="M10 14q2 1.7 4 0" fill="none" stroke="#533b18" stroke-width="1.1" stroke-linecap="round"/></svg>';
const emojiRows = () => `<div class="hgf4-side-stack"><div class="hgf4-emoji-row"><span class="hgf4-emoji-tile">${star}</span><span class="hgf4-emoji-code">:sample_kirari:</span><span class="hgf4-pill">${icon('clock-hour-4')}未処理</span></div></div>`;
const activity = () => `<div class="hgf4-side-stack">${issues.slice(0, 3).map(i => `<div class="hgf4-activity">${avatar(i.person)}<div><b>${people[i.person]}</b>がイシューを立てました<small>「${i.title}」</small></div><time>${i.time}</time></div>`).join('')}</div>`;
const row = i => `<button type="button" class="hgf4-row" data-hf-action="issue" data-id="${i.id}" data-pinned="${!!i.pinned}"><span class="hgf4-row-icon" data-status="${i.pinned ? 'pinned' : i.status}">${icon(i.pinned ? 'pin' : statuses[i.status][1])}</span><span class="hgf4-row-main"><span class="hgf4-row-title">${i.title}${cat(i.cat)}</span><span class="hgf4-meta">#${i.id} · <b>${people[i.person]}</b>が${i.time}に作成 · ${statuses[i.status][0]}${i.assignee ? ` · ${icon('shield-check')}${people[i.assignee]}が対処担当` : ''}</span></span><span class="hgf4-row-side"><span>${icon('message-2')}1</span><span>${icon('heart')}${i.heart}</span>${avatar(i.person)}</span></button>`;
const mounts = new WeakMap();
let seq = 0;

function initOne(root, instance) {
	const existing = mounts.get(root);
	if (existing) return existing;
	const listeners = [];
	const on = (target, type, handler) => {
		target.addEventListener(type, handler);
		listeners.push(() => target.removeEventListener(type, handler));
	};
	root.dataset.hfReady = 'true';
	const uid = 'hata-intro-feed-' + instance.replace(/[^a-zA-Z0-9_-]/g, '-') + '-' + (++seq);
	const view = root.querySelector('[data-hf-view]'), slot = root.querySelector('[data-hf-window]'), feedback = root.querySelector('[data-hf-feedback]');
	let state = { tab: 'issues', category: '', status: '', person: '', includeClosed: false, query: '', detail: null };
	let draft = null;
	const say = text => { feedback.innerHTML = hataskGuideProse(text); };
	const focus = selector => root.querySelector(selector)?.focus({ preventScroll: true });
	const visible = () => issues.filter(i => (state.includeClosed || !i.closed) && (state.category ? i.cat === state.category : i.cat !== 'improvement') && (!state.status || i.status === state.status) && (!state.person || i.person === state.person) && (!state.query || `${i.title} ${i.body} ${i.reply}`.includes(state.query)));
	const menu = (field, label, entries) => `<details class="hgf4-menu"><summary>${esc(label)}${icon('chevron-down')}</summary><div class="hgf4-menu-items">${entries.map(([id, name]) => `<button type="button" data-hf-action="filter" data-field="${field}" data-value="${id}" aria-pressed="${state[field] === id}">${esc(name)}</button>`).join('')}</div></details>`;

	function renderList() {
		const current = visible();
		view.querySelector('[data-hf-list]').innerHTML = current.length ? current.map(row).join('') : '<div class="hgf4-empty">該当するイシューはありません<br><span class="hgf4-caption">検索や絞り込みを解除してみてください</span></div>';
		view.querySelector('[data-hf-count]').textContent = `この画面例では ${current.length} 件・1ページのみ`;
		for (const node of view.querySelectorAll('[data-hf-count-status]')) node.textContent = current.filter(i => i.status === node.dataset.hfCountStatus).length;
	}

	function renderOverview() {
		const roads = issues.filter(i => i.cat === 'improvement');
		view.innerHTML = `<div class="hgf4-toolbar"><span class="hgf4-logo">HataFeed</span><span class="hgf4-divider"></span><span class="hgf4-project" title="プロジェクト切替は静的図">${icon('flag-2')}Hataskey${icon('selector')}${tag}</span><label class="hgf4-search">${icon('search')}<input type="search" data-hf-search value="${esc(state.query)}" placeholder="イシュー・会話を検索" aria-label="架空イシューを検索"></label><span class="hgf4-icon-static" title="通知は静的図" aria-label="通知（図）">${icon('bell')}</span><span class="hgf4-icon-static" title="更新は静的図" aria-label="更新（図）">${icon('refresh')}</span></div>
        <nav class="hgf4-tabs" aria-label="HataFeedの表示"><button type="button" class="hgf4-tab" data-hf-action="tab" data-tab="issues" aria-pressed="${state.tab === 'issues'}">${icon('clipboard-list')}イシュー</button><button type="button" class="hgf4-tab" data-hf-action="tab" data-tab="roadmap" aria-pressed="${state.tab === 'roadmap'}">${icon('route')}ロードマップ</button><span class="hgf4-tab" aria-label="ベータ、実際は別画面への入口。この例では静的図">${icon('flask')}ベータ${tag}</span></nav>
        ${state.tab === 'issues' ? `<div class="hgf4-top-actions"><span class="hgf4-top-action">${icon('mood-plus')}絵文字申請${tag}</span><button type="button" class="hgf4-top-action" data-hf-action="new">${icon('pencil-plus')}新規イシュー</button></div>` : ''}
        <div class="hgf4-mobile"><div class="hgf4-ticker"><span class="hgf4-dot" data-live></span><span><b>あき</b>がイシューを立てました</span><span class="hgf4-static-tag">架空の動き</span></div><div class="hgf4-stats">${['open', 'inProgress', 'resolved'].map(s => `<button type="button" class="hgf4-stat" data-hf-action="stat" data-value="${s}" aria-pressed="${state.status === s}"><strong data-hf-count-status="${s}">0</strong>${statuses[s][0]}</button>`).join('')}<span class="hgf4-stat"><strong>1</strong>絵文字申請${tag}</span></div><section class="hgf4-mobile-emoji"><div class="hgf4-side-head"><span>${icon('mood-smile')} 絵文字申請 1</span><span class="hgf4-static-tag">申請する · 図</span></div><p class="hgf4-caption">使いたい絵文字を画像またはリモート絵文字から申請できます</p>${emojiRows()}</section><div class="hgf4-caption">${icon('route')} 近々の修正・改善予定 · 架空例、横に送れます</div><div class="hgf4-road-scroll">${roads.map(i => `<button type="button" class="hgf4-road-card" data-hf-action="issue" data-id="${i.id}">${i.title}${status(i.status)}</button>`).join('')}</div></div>
        <div class="hgf4-grid"><section><div class="hgf4-filter"><button type="button" class="hgf4-toggle" data-hf-action="closed" data-value="false" aria-pressed="${!state.includeClosed}">${icon('circle-dot')}受付中</button><button type="button" class="hgf4-toggle" data-hf-action="closed" data-value="true" aria-pressed="${state.includeClosed}">${icon('circle-check')}解決済み</button><div class="hgf4-filters">${menu('category', state.category ? cats[state.category][0] : 'カテゴリ', [['', 'すべてのカテゴリ'], ...Object.entries(cats).map(([k, v]) => [k, v[0]])])}${menu('status', state.status ? statuses[state.status][0] : 'ステータス', [['', 'すべてのステータス'], ...Object.entries(statuses).map(([k, v]) => [k, v[0]])])}${menu('person', state.person ? people[state.person] : '作成者', [['', 'すべて'], ...Object.entries(people)])}</div></div><div class="hgf4-list" data-hf-list></div><div class="hgf4-pager"><span>${icon('chevron-left')}前へ</span><span class="hgf4-page">1</span><span>次へ${icon('chevron-right')}</span><span class="hgf4-project">10件${icon('chevron-down')}${tag}</span></div><p class="hgf4-caption" data-hf-count></p></section><aside class="hgf4-side"><section class="hgf4-side-card"><div class="hgf4-side-head"><span>${icon('route')} 近々の修正・改善予定</span></div><div class="hgf4-side-stack">${roads.map(i => `<button type="button" class="hgf4-road" data-hf-action="issue" data-id="${i.id}"><span class="hgf4-dot" data-status="${i.status}"></span><span class="hgf4-road-title">${i.title}</span>${status(i.status)}</button>`).join('')}</div><p class="hgf4-caption">ガイド用の架空の予定</p></section><section class="hgf4-side-card"><div class="hgf4-side-head"><span>${icon('mood-smile')} 絵文字申請 1</span><span class="hgf4-static-tag">申請する · 図</span></div>${emojiRows()}<p class="hgf4-caption">自分の申請と審査状況を見る場所<br>画像・申請状況は架空例</p></section><section class="hgf4-side-card"><div class="hgf4-side-head"><span><span class="hgf4-dot" data-live></span> みんなの動き</span>${tag}</div>${activity()}</section></aside></div>`;
		renderList();
	}

	function renderDetail() {
		const i = issues.find(item => item.id === state.detail), participants = [...new Set([i.person, 'rin'])];
		view.innerHTML = `<div class="hgf4-crumbs"><button type="button" class="hgf4-link" data-hf-action="back">イシュー</button><span>/</span><span>#${i.id}</span></div><div class="hgf4-title"><h3>${i.title} <span class="hgf4-title-no">#${i.id}</span></h3><span class="hgf4-icon-static" aria-label="タイトルコピー（図）">${icon('copy')}</span></div><div class="hgf4-detail-meta">${status(i.status, true)}${cat(i.cat)}<span class="hgf4-meta">${people[i.person]}が${i.time}に作成 · コメント1件 · 参加者${participants.length}人</span></div><div class="hgf4-detail-grid"><div class="hgf4-timeline"><div class="hgf4-tl-row">${avatar(i.person)}<article class="hgf4-conversation"><div class="hgf4-conversation-head" data-author><b>${people[i.person]}</b><time>${i.time}</time><span class="hgf4-role">作成者</span></div><div class="hgf4-conversation-text">${esc(i.body)}</div></article></div><div class="hgf4-tl-row">${avatar('rin')}<article class="hgf4-conversation"><div class="hgf4-conversation-head"><b>りん</b><time>30分前</time>${i.assignee === 'rin' ? `<span class="hgf4-role" data-staff>${icon('shield-check')} 対処担当</span>` : ''}</div><div class="hgf4-conversation-text">${esc(i.reply)}</div><span class="hgf4-reaction">${icon('thumb-up')} 1 ${tag}</span></article></div>${i.closed ? `<div class="hgf4-confirm-note">${icon('lock')} このイシューはクローズ（受付終了）されています。コメントはできません</div>` : `<div class="hgf4-tl-row">${avatar('sora')}<div class="hgf4-conversation hgf4-composer"><div class="hgf4-composer-row"><div class="hgf4-input-pill"><span>コメントを書く… :emoji: も使えます</span>${icon('mood-happy')}${icon('photo-plus')}</div><span class="hgf4-btn" data-primary>送信 ${tag}</span></div><p class="hgf4-caption">コメント入力欄は静的図です。<br>コメントは送信できません</p></div></div>`}</div><aside class="hgf4-detail-side"><div class="hgf4-side-sec"><span class="hgf4-side-label">ステータス</span><div class="hgf4-status-static">${status(i.status)}</div></div><div class="hgf4-side-sec"><span class="hgf4-side-label">カテゴリ / 優先度</span><div class="hgf4-side-badges">${cat(i.cat)}<span class="hgf4-pill" data-status="open">優先度: 通常</span></div></div><div class="hgf4-side-sec"><span class="hgf4-side-label">${icon('shield-check')} 対処担当</span>${i.assignee ? `<div class="hgf4-side-badges">${avatar(i.assignee)}${people[i.assignee]} ${icon('shield-check')}</div>` : '<span class="hgf4-caption">未割り当て</span>'}</div><div class="hgf4-side-sec"><span class="hgf4-side-label">参加者 ${participants.length}人</span><div class="hgf4-side-badges">${participants.map(p => avatar(p, 26)).join('')}</div></div><div class="hgf4-side-sec"><div class="hgf4-agree">${icon('heart')}賛同する ・ ${i.heart} ${tag}</div></div></aside></div><p class="hgf4-caption">会話・リアクション・賛同は静的図です。<br>ステータスや担当の操作は、本体の権限によって表示が変わります</p>`;
	}

	function renderWizard() {
		if (!draft) {slot.replaceChildren(); return;}
		const d = draft;
		let content = '';
		if (d.step === 1) content = `<p>イシューの種類を選択してください</p>${Object.entries(cats).filter(([k]) => k !== 'improvement').map(([k, c]) => `<button type="button" class="hgf4-cat-card" data-hf-action="choose" data-category="${k}">${icon(c[1])}<span><b>${c[0]}</b><small>${c[2]}</small></span>${icon('chevron-right')}</button>`).join('')}`;
		if (d.step === 2) {
			const titleHint = { bug: '例: ○○すると画面が表示されなくなる', featureRequest: '例: ○○できる機能を追加してほしい', adoptionRequest: '例: 本家の○○を取り入れてほしい' }[d.category] || '要点を簡潔にご記入ください';
			const descHint = d.category === 'bug' ? '【操作内容】【発生した事象】【期待する挙動】をご記入ください。\nご利用の端末・ブラウザも記載いただけると助かります。' : d.category === 'featureRequest' ? 'どのような場面で、どのように役立つかをご記入ください。' : 'できるだけ具体的にご記入ください。';
			content = `<p>${cat(d.category)} の内容をご記入ください</p><label class="hgf4-field"><span>タイトル <span class="hgf4-required">必須</span></span><input data-hf-draft="title" value="${esc(d.title)}" placeholder="${titleHint}" autocomplete="off"></label><label class="hgf4-field"><span>詳しい説明</span><textarea data-hf-draft="description" placeholder="${esc(descHint)}">${esc(d.description)}</textarea></label><div class="hgf4-field"><span>スクリーンショット等（任意）</span><div class="hgf4-file-static"><span class="hgf4-file-plus" aria-label="画像を追加する場所（図）">${icon('plus')}</span><span>${tag} 本体ではドライブの画像を選びます<br>この例ではファイルを読み込みません</span></div></div><label class="hgf4-check"><input type="checkbox" data-hf-code-toggle ${d.codeEnabled ? 'checked' : ''}>${icon('code')} コードを提出する（任意）</label><p class="hgf4-caption">再現コードやパッチ案などを添付できます</p><label class="hgf4-field" data-hf-code-field ${d.codeEnabled ? '' : 'hidden'}><span>コード</span><textarea data-hf-draft="code" placeholder="// コードをここに貼り付け">${esc(d.code)}</textarea></label><div class="hgf4-nav"><button type="button" class="hgf4-btn" data-hf-action="prev">${icon('arrow-left')}戻る</button><button type="button" class="hgf4-btn" data-primary data-hf-action="next" ${d.title.trim() ? '' : 'disabled'}>次へ${icon('arrow-right')}</button></div>`;
		}
		if (d.step === 3) content = `<p>優先度を選んで送信してください</p><label class="hgf4-field"><span>優先度</span><select data-hf-draft="priority">${[['low', '低'], ['normal', '通常'], ['high', '高']].map(([id, label]) => `<option value="${id}" ${id === d.priority ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="hgf4-summary"><div><b>カテゴリ:</b> ${cats[d.category][0]}</div><div><b>タイトル:</b> ${esc(d.title)}</div></div><p class="hgf4-caption">この例の「送信」は、送信しないことを確認するための操作です。<br>入力内容は画面を離れると消えます</p><div class="hgf4-nav"><button type="button" class="hgf4-btn" data-hf-action="prev">${icon('arrow-left')}戻る</button><button type="button" class="hgf4-btn" data-primary data-hf-action="send" aria-label="送信ボタンの説明を確認（実際には送信しません）">${icon('send')}送信</button></div><div class="hgf4-confirm-note" role="status" data-hf-send-note ${d.reviewed ? '' : 'hidden'}>送信はしていません。イシューも作成していません<br>本体では、内容と優先度を確認してから送信します</div>`;
		slot.innerHTML = `<div class="hgf4-window" role="dialog" aria-modal="false" aria-labelledby="${uid}-wizard-title" data-source="packages/frontend/src/components/HataFeedIssueWizard.vue:12-97"><div class="hgf4-window-head"><span id="${uid}-wizard-title" tabindex="-1">イシューを立てる（${d.step}/3）</span><button type="button" class="hgf4-window-close" data-hf-action="close" aria-label="作成の操作例を閉じる">${icon('x')}</button></div><p class="hgf4-window-note">ガイド内の操作例・送信なし。<br>本体は背後の画面も操作できる、移動・サイズ変更可能なウィンドウです。<br>この図では移動・サイズ変更はできません</p><div class="hgf4-window-content">${content}</div></div>`;
		const priorityControl = slot.querySelector('[data-hf-draft=priority]');
		if (priorityControl) priorityControl.value = d.priority;
	}

	on(root, 'input', event => {
		const t = event.target;
		if (t.matches('[data-hf-search]')) {state.query = t.value; renderList(); return;}
		if (draft && t.matches('[data-hf-draft]')) {draft[t.dataset.hfDraft] = t.value; if (t.dataset.hfDraft === 'title') slot.querySelector('[data-hf-action=next]').disabled = !t.value.trim();}
	});
	on(root, 'change', event => {
		const t = event.target;
		if (draft && t.matches('[data-hf-code-toggle]')) {draft.codeEnabled = t.checked; slot.querySelector('[data-hf-code-field]').hidden = !t.checked;}
		if (draft && t.matches('[data-hf-draft=priority]')) draft.priority = t.value;
	});
	on(root, 'click', event => {
		const t = event.target.closest('[data-hf-action]');
		if (!t || !root.contains(t) || t.disabled) return;
		const a = t.dataset.hfAction;
		if (a === 'tab') {state.tab = t.dataset.tab; state.category = state.tab === 'roadmap' ? 'improvement' : ''; state.detail = null; renderOverview(); focus(`[data-hf-action=tab][data-tab=${state.tab}]`); say(state.tab === 'roadmap' ? '改善予定のイシューを表示しています。ここにある予定は架空例です' : '改善予定を除いたイシューの一覧です');} else if (a === 'filter') {state[t.dataset.field] = t.dataset.value; renderOverview(); focus('.hgf4-menu summary'); say('架空イシューの一覧を絞り込みました');} else if (a === 'closed') {state.includeClosed = t.dataset.value === 'true'; renderOverview(); focus(`[data-hf-action=closed][data-value=${state.includeClosed}]`); say(state.includeClosed ? '本体と同じく、受付終了のイシューも含めた一覧です。解決済みだけに絞るにはステータスを選びます' : '受付終了のイシューを除いた一覧です');} else if (a === 'stat') {state.status = state.status === t.dataset.value ? '' : t.dataset.value; if (t.dataset.value === 'resolved')state.includeClosed = true; renderOverview(); focus(`[data-hf-action=stat][data-value=${t.dataset.value}]`); say('チップの数字は総件数ではなく、現在表示しているページ内の件数です');} else if (a === 'issue') {state.detail = Number(t.dataset.id); renderDetail(); focus('[data-hf-action=back]'); say(`架空のイシュー #${state.detail} を表示しました。会話・賛同などは図です`);} else if (a === 'back') {const previous = state.detail; state.detail = null; renderOverview(); focus(`[data-hf-action=issue][data-id="${previous}"]`); say('イシューの一覧へ戻りました');} else if (a === 'new') {if (!draft)draft = { step: 1, category: 'bug', title: '', description: '', priority: 'normal', codeEnabled: false, code: '', reviewed: false }; renderWizard(); focus(`#${uid}-wizard-title`); slot.scrollIntoView({ block: 'nearest', behavior: 'instant' }); say('新規イシューの3手順を試せます。入力内容は送信・保存されません');} else if (a === 'choose' && draft) {draft.category = t.dataset.category; draft.step = 2; draft.reviewed = false; renderWizard(); focus('[data-hf-draft=title]');} else if (a === 'next' && draft && draft.title.trim()) {draft.step = 3; renderWizard(); focus(`#${uid}-wizard-title`);} else if (a === 'prev' && draft) {draft.step = Math.max(1, draft.step - 1); draft.reviewed = false; renderWizard(); focus(`#${uid}-wizard-title`);} else if (a === 'close') {draft = null; renderWizard(); focus('[data-hf-action=new]'); say('作成の操作例を閉じ、入力内容を破棄しました。送信・保存はしていません');} else if (a === 'send' && draft?.step === 3) {draft.reviewed = true; slot.querySelector('[data-hf-send-note]').hidden = false; say('送信も保存もしていません。イシューの作成手順を確認しただけです');}
	});
	on(root, 'keydown', event => {
		if (event.key === 'Escape' && draft && slot.contains(event.target)) {event.preventDefault(); event.stopPropagation(); draft = null; renderWizard(); focus('[data-hf-action=new]'); say('操作例を閉じました。入力内容は保存していません');}
	});
	renderOverview();
	let disposed = false;
	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		for (const remove of listeners.splice(0)) remove();
		draft = null;
		slot.replaceChildren();
		delete root.dataset.hfReady;
		root.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
		mounts.delete(root);
	};
	mounts.set(root, cleanup);
	return cleanup;
}

/** Mount only this diagram and release all scene-owned work on disposal. */
export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hf-root]') ? [scene] : [...scene.querySelectorAll('[data-hf-root]')];
	const cleanups = roots.map(root => initOne(root, scene.dataset.hataIntroInstance || 'guide'));
	return () => { for (const cleanup of cleanups) cleanup(); };
}
