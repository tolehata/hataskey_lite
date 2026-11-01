/* SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only */
import { escapeHtml as esc } from './prose.js';

const ti = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const button = (action, label, value = '', extra = '') => `<button type="button" data-hggo-action="${action}" data-value="${esc(value)}" ${extra}>${label}</button>`;
const shell = (kind, title, body) => `<section class="hggo" data-hggo-root="${kind}" aria-label="${title}の操作例"><header class="hggo-header"><strong class="hg-brand">HataGoes</strong><span>操作例</span></header><div class="hggo-body">${body}</div><p class="hggo-feedback" data-hggo-feedback role="status" aria-live="polite">架空の記録を使った操作例です。本体の記録や設定は変わりません。</p></section>`;
const appLabels = { home: 'ホーム', hatask: 'Hatask', hatady: 'Hatady', hatafeed: 'HataFeed' };

export const templates = {
	'hg-goes-home-scene': shell('home', 'HataGoesホーム', `<nav class="hggo-capsule" aria-label="アプリを切り替える">${Object.entries(appLabels).map(([id, label]) => button('app', label, id, `aria-pressed="${id === 'home'}"`)).join('')}</nav><div data-hggo-home></div>`),
	'hg-goes-apps-scene': shell('apps', 'アプリ一覧と＋メニュー', `<div class="hggo-title"><h3>全てのアプリ</h3>${button('plus', `${ti('plus')} ＋メニュー`)}</div><label class="hggo-search">${ti('search')}<input type="search" data-hggo-app-query placeholder="アプリをさがす" aria-label="アプリをさがす"></label><div class="hggo-apps" data-hggo-app-list></div><section class="hggo-panel" data-hggo-plus hidden aria-label="＋メニュー"></section>`),
	'hg-goes-search-scene': shell('search', '横断検索', `<div class="hggo-title"><h3 data-hggo-search-title>横断検索</h3>${button('reopen', `${ti('search')} 検索を開く`, '', 'hidden')}</div><div data-hggo-search-area><form class="hggo-search" data-hggo-search-form><input type="search" data-hggo-query placeholder="記録・作品・イシュー・人を検索" aria-label="検索語">${button('submit-search', ti('arrow-right'), '', 'aria-label="検索"')}</form><div class="hggo-capsule" role="group" aria-label="検索対象">${[['all', 'すべて'], ['hatask', 'Hatask'], ['hatady', 'Hatady'], ['hatafeed', 'HataFeed'], ['users', '人']].map(([id, label]) => button('filter', label, id, `aria-pressed="${id === 'all'}"`)).join('')}</div><div data-hggo-results></div></div><div class="hggo-panel" data-hggo-detail hidden></div>`),
	'hg-goes-settings-scene': shell('settings', 'HataGoesの設定', `<h3>ホーム専用テーマ</h3><div class="hggo-themes" role="group" aria-label="ホームのテーマ">${[['akatsuki', '暁'], ['koke', '苔'], ['kisetsu', '季'], ['kashin', '花信'], ['suri', '刷'], ['hatakyu', 'ハタキュ']].map(([id, label]) => button('theme', label, id, `aria-pressed="${id === 'akatsuki'}"`)).join('')}</div><section class="hggo-preview" data-hggo-preview="akatsuki" aria-label="ホームの見た目の例"><small>ホームのプレビュー</small><strong>きょうの予定と記録</strong><span>選んだテーマがホームに適用されます。</span></section><h3>ホームのカード</h3><p class="hggo-muted">表示するカードと順番を選びます。この図は3枚を抜き出した例です。</p><div data-hggo-card-order></div>`),
};

const apps = [
	['calendar', 'カレンダー', 'calendar'], ['todo', 'ToDo', 'checkbox'], ['mood', 'きもち', 'mood-smile'],
	['meal', 'ごはん', 'bowl'], ['recipe', 'レシピ', 'chef-hat'], ['garden', 'おはな', 'flower'],
	['intro', 'HataIntro', 'book'], ['card', 'HataCardMaker', 'id'], ['drawing', 'Hatadint', 'brush'],
];
const searchSamples = [
	{ id: 'event', app: 'hatask', kind: '予定', title: '図書館へ本を返す', text: '土曜日の午後に返却します。' },
	{ id: 'book', app: 'hatady', kind: '本', title: '庭の植物の本', text: '読みかけ · 42 / 180ページ' },
	{ id: 'issue', app: 'hatafeed', kind: 'イシュー', title: '本の一覧を見やすく', text: '操作を説明するための架空の要望です。' },
	{ id: 'person', app: 'users', kind: 'ユーザー', title: '本好きのはる', text: '@haru@example.invalid' },
];
const mounts = new WeakMap();

function initOne(root) {
	if (mounts.has(root)) return mounts.get(root);
	const q = selector => root.querySelector(selector);
	const say = message => { q('[data-hggo-feedback]').textContent = message; };
	const focus = (...selectors) => selectors.map(q).find(control => control && !control.matches(':disabled') && !control.closest('[hidden]'))?.focus({ preventScroll: true });
	const name = id => apps.find(app => app[0] === id)?.[1] ?? '';
	let currentApp = 'home';
	let watered = false;
	let todoDone = false;
	let savedPins = ['calendar', 'todo'];
	let draftPins = null;
	let discardPending = false;
	let searchFilter = 'all';
	let searched = false;
	let selectedResult = null;
	let cards = [{ id: 'daily', label: 'きょうの記録', visible: true }, { id: 'todo', label: 'ToDo', visible: true }, { id: 'reading', label: '読みかけ', visible: true }];

	function renderHome() {
		root.querySelectorAll('[data-hggo-action="app"]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.value === currentApp)));
		q('[data-hggo-home]').innerHTML = currentApp === 'home'
			? `<div class="hggo-home-grid"><section class="hggo-card hggo-daily"><small>きょうの記録</small><strong>${2 + Number(watered) + Number(todoDone)}<small> / 5</small></strong><p>きもち・ごはんは記録済みです。</p></section><section class="hggo-card"><h3>${ti('checkbox')} ToDo</h3>${button('todo', `${ti(todoDone ? 'square-check' : 'square')} 本を返す`, '', `aria-pressed="${todoDone}"`)}</section><section class="hggo-card"><h3 data-hggo-water-title tabindex="-1">${ti('flower')} おはな</h3><p>小さな芽を育てています。</p>${button('water', `${ti('droplet')} ${watered ? 'きょうは水やり済み' : '水をあげる'}`, '', watered ? 'disabled' : '')}</section><section class="hggo-card"><h3>${ti('book')} 読みかけ</h3><strong>庭の植物の本</strong><p>42 / 180ページ</p></section></div>`
			: `<section class="hggo-panel"><h3 class="hg-brand">${appLabels[currentApp]}</h3><p>${{ hatask: '予定やToDo、きもちなどを記録するアプリです。', hatady: '読書や学習、映像作品などの記録を残すアプリです。', hatafeed: '不具合や要望、絵文字申請を届けるアプリです。' }[currentApp]}</p>${button('app', `${ti('home')} HataGoesのホームへ`, 'home')}</section>`;
	}

	function renderApps() {
		const query = q('[data-hggo-app-query]').value.trim().normalize('NFKC').toLowerCase();
		const matches = apps.filter(app => app[1].normalize('NFKC').toLowerCase().includes(query));
		q('[data-hggo-app-list]').innerHTML = matches.length ? matches.map(([id, label, icon]) => button('open-app', `${ti(icon)}<span class="hg-brand">${label}</span>`, id)).join('') : '<p>一致するアプリがありません。</p>';
	}

	function renderPlus() {
		const pins = draftPins ?? savedPins;
		const slot = q('[data-hggo-plus]');
		if (discardPending) {
			slot.innerHTML = `<h3>未保存の変更があります</h3><p>保存せずに閉じると、変更した内容は失われます。</p><div class="hggo-buttons">${button('keep-editing', '編集を続ける')}${button('discard-pins', '保存せず閉じる')}</div>`;
			return;
		}
		slot.innerHTML = `<div class="hggo-title"><h3>＋メニュー${draftPins ? 'の編集' : ''} <small>${pins.length}/8</small></h3>${button('close-plus', ti('x'), '', 'aria-label="＋メニューを閉じる"')}</div>` + (draftPins
			? `<ol class="hggo-order">${pins.map((id, index) => `<li><span>${name(id)}</span>${button('pin-up', ti('chevron-up'), id, `aria-label="${name(id)}を上へ" ${index === 0 ? 'disabled' : ''}`)}${button('pin-down', ti('chevron-down'), id, `aria-label="${name(id)}を下へ" ${index === pins.length - 1 ? 'disabled' : ''}`)}${button('pin-remove', ti('x'), id, `aria-label="${name(id)}を外す"`)}</li>`).join('')}</ol><div class="hggo-additions">${apps.filter(app => !pins.includes(app[0])).map(([id, label]) => button('pin-add', `${ti('plus')} ${label}`, id, pins.length >= 8 ? 'disabled' : '')).join('')}</div><div class="hggo-buttons">${button('cancel-edit', 'キャンセル')}${button('save-pins', '保存', '', 'class="hggo-primary"')}</div>`
			: `<div class="hggo-apps">${pins.map(id => button('open-app', name(id), id)).join('') || '<p>表示する項目を選んでください。</p>'}</div>${button('edit-pins', `${ti('pencil')} 編集`)}`);
	}

	function renderSearch() {
		root.querySelectorAll('[data-hggo-action="filter"]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.value === searchFilter)));
		const query = q('[data-hggo-query]').value.trim().normalize('NFKC').toLowerCase();
		if (!searched || !query) { q('[data-hggo-results]').innerHTML = '<p class="hggo-muted">「本」と入力し、矢印で検索を試してください。</p>'; return; }
		const matches = searchSamples.filter(item => (searchFilter === 'all' || item.app === searchFilter) && `${item.title} ${item.text}`.normalize('NFKC').toLowerCase().includes(query));
		q('[data-hggo-results]').innerHTML = `<p class="hggo-muted">「${esc(query)}」の検索結果 · ${matches.length}件</p><div class="hggo-results">${matches.map(item => button('result', `<small>${item.kind}</small><strong>${item.title}</strong><span>${item.text}</span>`, item.id)).join('') || '<p>一致する情報がありません。別の言葉で検索してください。</p>'}</div>`;
	}

	function openSearchResult(id) {
		const item = searchSamples.find(sample => sample.id === id);
		if (!item) return;
		selectedResult = item;
		q('[data-hggo-search-area]').hidden = true;
		q('[data-hggo-action="reopen"]').hidden = false;
		q('[data-hggo-search-title]').textContent = appLabels[item.app] ?? 'プロフィール';
		q('[data-hggo-detail]').hidden = false;
		q('[data-hggo-detail]').innerHTML = `<small>${item.kind}の詳細</small><h3>${item.title}</h3><p>${item.text}</p>${button('close-detail', '詳細を閉じる')}`;
		focus('[data-hggo-action="close-detail"]');
		say('検索結果の詳細を開きました。別の結果は「検索を開く」から確認できます。');
	}

	function renderCards() {
		q('[data-hggo-card-order]').innerHTML = `<ol class="hggo-order">${cards.map((card, index) => `<li data-card="${card.id}"><label><input type="checkbox" data-hggo-card-visible="${card.id}" ${card.visible ? 'checked' : ''}>${card.label}</label>${button('card-up', ti('chevron-up'), card.id, `aria-label="${card.label}を上へ" ${index === 0 ? 'disabled' : ''}`)}${button('card-down', ti('chevron-down'), card.id, `aria-label="${card.label}を下へ" ${index === cards.length - 1 ? 'disabled' : ''}`)}</li>`).join('')}</ol><div class="hggo-card-samples" data-hggo-visible-cards>${cards.filter(card => card.visible).map(card => `<span>${card.label}</span>`).join('')}</div>`;
	}

	function onClick(event) {
		const control = event.target.closest('button[data-hggo-action]');
		if (!control || !root.contains(control) || control.disabled) return;
		const action = control.dataset.hggoAction;
		const value = control.dataset.value;
		if (action === 'app' && Object.hasOwn(appLabels, value)) { currentApp = value; renderHome(); say(`${appLabels[value]}の表示例へ切り替えました。`); }
		else if (action === 'todo') { todoDone = !todoDone; renderHome(); focus('[data-hggo-action="todo"]'); say(todoDone ? '例のToDoを完了にしました。本体のToDoは変わりません。' : '例のToDoを未完了に戻しました。'); }
		else if (action === 'water' && !watered) { watered = true; renderHome(); focus('[data-hggo-water-title]'); say('例のおはなに水をあげました。本体の花しずくは使いません。'); }
		else if (action === 'open-app' && name(value)) say(`${name(value)}を開く操作です。この例では画面を移動しません。`);
		else if (action === 'plus') { q('[data-hggo-plus]').hidden = false; renderPlus(); focus('[data-hggo-action="edit-pins"]'); }
		else if (action === 'close-plus') { if (draftPins && draftPins.join(',') !== savedPins.join(',')) { discardPending = true; renderPlus(); focus('[data-hggo-action="keep-editing"]'); } else { draftPins = null; q('[data-hggo-plus]').hidden = true; focus('[data-hggo-action="plus"]'); } }
		else if (action === 'keep-editing') { discardPending = false; renderPlus(); focus('[data-hggo-action="save-pins"]'); }
		else if (action === 'discard-pins') { discardPending = false; draftPins = null; q('[data-hggo-plus]').hidden = true; focus('[data-hggo-action="plus"]'); say('例の編集を保存せず閉じました。'); }
		else if (action === 'edit-pins') { draftPins = [...savedPins]; renderPlus(); focus('[data-hggo-action="save-pins"]'); }
		else if (action === 'cancel-edit') { draftPins = null; renderPlus(); focus('[data-hggo-action="edit-pins"]'); say('編集前の例に戻しました。'); }
		else if (action === 'save-pins' && draftPins) { savedPins = [...draftPins]; draftPins = null; renderPlus(); focus('[data-hggo-action="edit-pins"]'); say('この図の＋メニューに反映しました。本体の設定には保存していません。'); }
		else if (action === 'pin-add' && draftPins && name(value) && !draftPins.includes(value) && draftPins.length < 8) { draftPins.push(value); renderPlus(); focus(`[data-hggo-action="pin-remove"][data-value="${value}"]`); say(`${name(value)}を例の＋メニューに追加しました。「保存」で確定します。`); }
		else if (action === 'pin-remove' && draftPins) { const index = draftPins.indexOf(value); draftPins = draftPins.filter(id => id !== value); const adjacent = draftPins[Math.min(index, draftPins.length - 1)]; renderPlus(); focus(`[data-hggo-action="pin-remove"][data-value="${adjacent}"]`, `[data-hggo-action="pin-add"][data-value="${value}"]`); say('例の＋メニューから外しました。記録の削除ではありません。'); }
		else if ((action === 'pin-up' || action === 'pin-down') && draftPins) { const index = draftPins.indexOf(value); const target = index + (action === 'pin-up' ? -1 : 1); if (index >= 0 && target >= 0 && target < draftPins.length) { [draftPins[index], draftPins[target]] = [draftPins[target], draftPins[index]]; renderPlus(); focus(`[data-hggo-action="${action}"][data-value="${value}"]`, `[data-hggo-action="${action === 'pin-up' ? 'pin-down' : 'pin-up'}"][data-value="${value}"]`, `[data-hggo-action="pin-remove"][data-value="${value}"]`); } }
		else if (action === 'submit-search') { searched = true; renderSearch(); }
		else if (action === 'filter' && ['all', 'hatask', 'hatady', 'hatafeed', 'users'].includes(value)) { searchFilter = value; renderSearch(); }
		else if (action === 'result') openSearchResult(value);
		else if (action === 'close-detail') { q('[data-hggo-detail]').innerHTML = `<h3>${appLabels[selectedResult?.app] ?? 'プロフィール'}</h3><p>詳細を閉じました。「検索を開く」から結果を確認できます。</p>`; focus('[data-hggo-action="reopen"]'); say('詳細を閉じ、元のアプリの画面に戻りました。'); }
		else if (action === 'reopen') { q('[data-hggo-search-area]').hidden = false; q('[data-hggo-detail]').hidden = true; control.hidden = true; q('[data-hggo-search-title]').textContent = '横断検索'; renderSearch(); focus('[data-hggo-query]'); }
		else if (action === 'theme' && ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'].includes(value)) { root.querySelectorAll('[data-hggo-action="theme"]').forEach(item => item.setAttribute('aria-pressed', String(item === control))); q('[data-hggo-preview]').dataset.hggoPreview = value; say(`「${control.textContent}」の表示例です。本体のホームのテーマは変わりません。`); }
		else if (action === 'card-up' || action === 'card-down') { const index = cards.findIndex(card => card.id === value); const target = index + (action === 'card-up' ? -1 : 1); if (index >= 0 && target >= 0 && target < cards.length) { [cards[index], cards[target]] = [cards[target], cards[index]]; renderCards(); focus(`[data-hggo-action="${action}"][data-value="${value}"]`, `[data-hggo-action="${action === 'card-up' ? 'card-down' : 'card-up'}"][data-value="${value}"]`, `[data-hggo-card-visible="${value}"]`); say('例のカードの順番を変更しました。'); } }
	}
	function onInput(event) {
		if (event.target.matches('[data-hggo-app-query]')) renderApps();
		if (event.target.matches('[data-hggo-query]')) { searched = false; renderSearch(); }
	}
	function onChange(event) {
		const id = event.target.dataset.hggoCardVisible;
		const card = cards.find(item => item.id === id);
		if (card) { card.visible = event.target.checked; renderCards(); focus(`[data-hggo-card-visible="${id}"]`); say(`例の「${card.label}」を${card.visible ? '表示' : '非表示'}にしました。`); }
	}
	function onSubmit(event) { if (!event.target.matches('[data-hggo-search-form]')) return; event.preventDefault(); searched = true; renderSearch(); }
	const listeners = [['click', onClick], ['input', onInput], ['change', onChange], ['submit', onSubmit]];
	for (const [event, handler] of listeners) root.addEventListener(event, handler);
	if (root.dataset.hggoRoot === 'home') renderHome();
	else if (root.dataset.hggoRoot === 'apps') renderApps();
	else if (root.dataset.hggoRoot === 'search') renderSearch();
	else if (root.dataset.hggoRoot === 'settings') renderCards();
	let disposed = false;
	const cleanup = () => { if (disposed) return; disposed = true; for (const [event, handler] of listeners) root.removeEventListener(event, handler); draftPins = null; mounts.delete(root); };
	mounts.set(root, cleanup);
	return cleanup;
}

export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hggo-root]') ? [scene] : [...scene.querySelectorAll('[data-hggo-root]')];
	const cleanups = roots.map(initOne);
	return () => { for (const cleanup of cleanups) cleanup(); };
}
