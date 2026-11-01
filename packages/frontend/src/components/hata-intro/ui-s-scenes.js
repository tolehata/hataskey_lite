/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 * Isolated UI S teaching scenes. No account, API, storage or router access.
 */

const icon = name => `<i class="ti ti-${name}" aria-hidden="true"></i>`;
const button = (action, label, mark, extra = '') => `<button type="button" class="hguis-button" data-hguis-action="${action}" aria-label="${label}" ${extra}>${mark ? icon(mark) : ''}<span>${label}</span></button>`;
const control = (action, label, mark, extra = '') => `<button type="button" class="hguis-icon" data-hguis-action="${action}" aria-label="${label}" title="${label}" ${extra}>${icon(mark)}</button>`;
const note = (name, message) => `<article class="hguis-note"><span class="hguis-avatar" aria-hidden="true">${name.slice(0, 1)}</span><div><strong>${name}</strong><small>見本のノート</small><p>${message}</p><div class="hguis-note-actions" aria-hidden="true">${icon('message-circle')}${icon('repeat')}${icon('mood-plus')}${icon('dots')}</div></div></article>`;
const notes = note('しおり', '読みかけの本を少し進めました。続きはまた明日。') + note('こはる', '散歩の途中で、小さな花を見つけました。');
const stage = (kind, body) => `<section class="hguis-scene" data-hguis-scene="${kind}" aria-label="Hataskey UI S の操作例">${body}<p class="hguis-status" role="status" aria-live="polite" data-hguis-status>図の中だけで操作を試せます。本体には反映されません。</p></section>`;
const timelines = [['home', 'home', 'ホーム'], ['local', 'planet', 'ローカル'], ['list', 'list', 'リスト'], ['antenna', 'antenna', 'アンテナ']];
const timelineChoices = () => timelines.map(([id, mark, label]) => button('timeline', label, mark, `data-value="${id}" aria-pressed="${id === 'home'}"`)).join('');
const navDefaults = [
	{ id: 'home', label: 'ホーム', icon: 'home', visible: true },
	{ id: 'search', label: '検索', icon: 'search', visible: true },
	{ id: 'notifications', label: '通知', icon: 'bell', visible: true },
	{ id: 'hatagoes', label: 'HataGoes', icon: 'sparkles', visible: true },
	{ id: 'widgets', label: 'ウィジェット', icon: 'layout-grid', visible: true },
	{ id: 'hatafeed', label: 'HataFeed', icon: 'message-circle', visible: false },
];

export const templates = {
	'hg-ui-s-overview-scene': stage('overview', `
		<div class="hguis-toolbar"><strong class="hg-brand">Hataskey UI S</strong><div class="hguis-choice" aria-label="図の画面サイズ">${button('device', 'PC', 'device-desktop', 'data-value="desktop" aria-pressed="true"')}${button('device', 'スマホ', 'device-mobile', 'data-value="mobile" aria-pressed="false"')}</div></div>
		<div class="hguis-overview" data-hguis-device="desktop">
			<aside class="hguis-side"><b class="hg-brand">Hataskey</b>${button('menu', 'UI切り替え', 'devices', 'aria-expanded="false"')}<div class="hguis-switcher" data-hguis-switcher hidden><strong>UIを切り替える</strong>${button('ui', 'Hataskey UI', 'layout', 'data-value="standard"')}${button('ui', 'Hataskey UI S', 'layout-dashboard', 'data-value="s" aria-pressed="true"')}</div><span class="hguis-muted">サイドメニュー</span></aside>
			<div class="hguis-reading"><header><span class="hguis-kicker">タイムライン</span><h3 data-hguis-timeline-title>ホーム</h3></header><div data-hguis-timeline-description class="hguis-muted">自分とフォロー中の人のノートが並びます。</div><div class="hguis-notes">${notes}</div></div>
			<nav class="hguis-timeline-nav" aria-label="図のタイムライン">${timelineChoices()}</nav>
			<div class="hguis-mobile-dock"><div class="hguis-dock-icons">${control('mobile-menu', 'メニュー', 'menu-2')}${control('home', 'ホーム。長押しでタイムライン一覧', 'home', 'aria-expanded="false"')}${control('search', '検索', 'search')}${control('notifications', '通知', 'bell')}</div>${button('open-list', '一覧を開く', 'chevron-up', 'aria-expanded="false"')}</div>
			<div class="hguis-picker" data-hguis-picker hidden><strong>タイムライン一覧</strong>${timelineChoices()}${button('close-list', '閉じる', 'x')}</div>
		</div>
		<p class="hguis-caption" data-hguis-device-caption>PCでは右端の縦メニューを使います。マウスを重ねると項目名が表示されます。</p>
	`),
	'hg-ui-s-post-scene': stage('post', `
		<div class="hguis-toolbar"><strong>投稿の練習</strong><span class="hguis-badge">送信しない見本</span></div>
		<div class="hguis-post-backdrop">${note('まどか', '今日の出来事を、ひとこと残してみませんか。')}</div>
		<div class="hguis-composer"><label class="hguis-compose-label">ノートの本文<textarea data-hguis-text rows="3" maxlength="300" placeholder="いまどうしてる？"></textarea></label><label class="hguis-recipient" data-hguis-recipient-row hidden>宛先の例<input data-hguis-recipient type="text" placeholder="例：しおり" maxlength="40" autocomplete="off"></label><div class="hguis-compose-actions">
			${control('post-tools', '投稿機能', 'layout-grid', 'aria-expanded="false"')}${control('attach', '添付', 'paperclip')}${control('annotation', '注釈', 'eye-off')}${control('emoji', '絵文字', 'mood-smile')}
			<span class="hguis-space"></span>${button('visibility-menu', 'パブリック', 'world', 'data-hguis-visibility-label aria-expanded="false"')}${control('federation', '連合あり', 'rocket', 'aria-pressed="true"')}${control('send', 'ノートを投稿する練習', 'send', 'disabled')}
		</div><div class="hguis-menu" data-hguis-post-tools hidden><strong>投稿機能</strong>${button('tool', '投票', 'chart-bar', 'data-value="poll"')}${button('tool', 'MFM', 'typography', 'data-value="mfm"')}${button('tool', 'お絵描き', 'brush', 'data-value="drawing"')}${button('tool', 'フォームを広げる', 'arrows-maximize', 'data-value="full"')}</div><div class="hguis-menu" data-hguis-visibility hidden><strong>公開範囲</strong>${[['public', 'world', 'パブリック'], ['home', 'home', 'ホーム'], ['followers', 'lock', 'フォロワー'], ['specified', 'mail', 'ダイレクト']].map(([id, mark, label]) => button('visibility', label, mark, `data-value="${id}" aria-pressed="${id === 'public'}"`)).join('')}</div><div class="hguis-info" data-hguis-tool-help hidden></div></div>
		<section class="hguis-sent" data-hguis-sent hidden><strong>${icon('check')}投稿の練習ができました</strong><p data-hguis-sent-text></p><small data-hguis-sent-scope></small></section>
	`),
	'hg-ui-s-workspace-scene': stage('workspace', `
		<div class="hguis-toolbar"><strong>PCの画面の使い方</strong><div class="hguis-choice">${button('workspace-mode', '標準', 'rectangle', 'data-value="standard" aria-pressed="true"')}${button('workspace-mode', 'デッキ', 'columns', 'data-value="deck" aria-pressed="false"')}</div></div>
		<div class="hguis-workspace" data-hguis-workspace="home"><aside class="hguis-workspace-nav">${button('page-open', '通知', 'bell')}${button('pane', 'ウィジェット', 'layout-grid', 'data-value="widgets"')}${button('pane', 'Hatask', 'calendar', 'data-value="hatask"')}</aside><div class="hguis-split">
			<section class="hguis-page" data-hguis-page hidden><header><h3>通知</h3><div>${control('page-toggle', '全画面で表示', 'arrows-maximize')}${control('page-close', '閉じてタイムラインに戻る', 'x')}</div></header><p class="hguis-notice">${icon('mood-plus')}こはるさんがリアクションしました。</p><p class="hguis-notice">${icon('user-plus')}しおりさんにフォローされました。</p></section>
			<div class="hguis-workspace-timeline" data-hguis-workspace-timeline><h3>ホーム</h3>${notes}</div>
		</div><aside class="hguis-side-pane" data-hguis-pane hidden><h3 data-hguis-pane-title>Hatask</h3><div data-hguis-pane-content></div></aside></div>
		<div class="hguis-deck" data-hguis-deck hidden><section><h3>${icon('home')}ホーム</h3>${note('しおり', '読書の続きを楽しんでいます。')}</section><section><h3>${icon('planet')}ローカル</h3>${note('なぎ', '今日は夕焼けがきれいでした。')}</section><section><h3>${icon('bell')}通知</h3><p class="hguis-notice">リアクションが届きました。</p></section></div>
		<p class="hguis-caption">図はPC表示の抜粋です。スマホは1画面ずつ表示し、デッキへは切り替わりません。</p>
	`),
	'hg-ui-s-settings-scene': stage('settings', `
		<div class="hguis-toolbar"><div><span class="hguis-kicker">設定</span><strong class="hg-brand">Hataskey UI S</strong></div><span class="hguis-badge">本体ではすぐ保存</span></div>
		<div class="hguis-settings-layout"><div class="hguis-settings-controls"><label class="hguis-setting"><span>表示サイズ</span><select data-hguis-setting="size"><option value="standard">標準（既定）</option><option value="small">小さめ</option></select></label><label class="hguis-setting"><span>タイムライン背景</span><input type="checkbox" data-hguis-setting="glass" checked></label><label class="hguis-setting"><span>投稿フォームの位置<small>PC・タブレットに適用します。</small></span><select data-hguis-setting="position"><option value="bottom">タイムラインの下</option><option value="top">タイムラインの上</option></select></label><section class="hguis-bottom-settings"><h3>下部ナビバー (モバイル)</h3><p class="hguis-muted">ホームを含む5項目まで。図では上下ボタンで並び替えを試せます。</p><div data-hguis-nav-items></div></section></div>
		<aside class="hguis-settings-preview" aria-label="設定を変えた画面の見本"><span class="hguis-kicker">見本</span><div class="hguis-setting-timeline" data-hguis-settings-preview data-size="standard" data-glass="true" data-position="bottom"><h3>ホーム</h3><p>読んでいた本を、最後まで読み終えました。</p><div class="hguis-mini-compose">いまどうしてる？ ${icon('send')}</div></div><span class="hguis-kicker">スマホの下部ナビ</span><div class="hguis-nav-preview" data-hguis-nav-preview></div><p class="hguis-muted">左端のメニューは固定です。スマホの投稿欄は常に下に表示されます。</p></aside></div>
	`),
};

const mounts = new WeakMap();
const visibilityLabels = { public: 'パブリック', home: 'ホーム', followers: 'フォロワー', specified: 'ダイレクト' };
const timelineDescriptions = {
	home: '自分とフォロー中の人のノートが並びます。',
	local: '同じサーバーの公開ノートを読みます。',
	list: '作成したリストを選び、登録した人のノートを読みます。',
	antenna: '作成したアンテナを選び、条件に合うノートを読みます。',
};
const toolHelp = {
	poll: '「投票」では選択肢と期限を設定できます。',
	mfm: '「MFM」では文字の装飾を選べます。',
	drawing: '「お絵描き」でHatadintを開けます。描いた画像は投稿に添付できます。',
	full: '「フォームを広げる」で通常の投稿画面へ移れます。図では画面を開きません。',
};

function mount(root) {
	if (mounts.has(root)) return mounts.get(root);
	const q = selector => root.querySelector(selector);
	const all = selector => [...root.querySelectorAll(selector)];
	const status = message => { q('[data-hguis-status]').textContent = message; };
	let disposed = false, holdTimer = null, longPressed = false, visibility = 'public', federated = true, pageMode = 'home';
	const navItems = navDefaults.map(item => ({ ...item }));
	const pressed = (action, value) => all(`[data-hguis-action="${action}"]`).forEach(item => item.setAttribute('aria-pressed', String(item.dataset.value === value)));
	function picker(open) {
		const panel = q('[data-hguis-picker]');
		const restoreFocus = !open && panel.contains(root.ownerDocument.activeElement);
		panel.hidden = !open;
		all('[data-hguis-action="home"], [data-hguis-action="open-list"]').forEach(item => item.setAttribute('aria-expanded', String(open)));
		if (restoreFocus) q('.hguis-timeline-nav [aria-pressed="true"]')?.focus();
	}
	function canSend() {
		return !!q('[data-hguis-text]').value.trim() && (visibility !== 'specified' || !!q('[data-hguis-recipient]').value.trim());
	}
	function updateSend() { q('[data-hguis-action="send"]').disabled = !canSend(); }
	function setPage(mode) {
		pageMode = mode;
		q('[data-hguis-workspace]').dataset.hguisWorkspace = mode;
		q('[data-hguis-page]').hidden = mode === 'home';
		q('[data-hguis-workspace-timeline]').hidden = mode === 'full';
		const toggle = q('[data-hguis-action="page-toggle"]');
		toggle.setAttribute('aria-label', mode === 'full' ? '左右表示に戻す' : '全画面で表示');
		toggle.title = toggle.getAttribute('aria-label');
	}
	function renderNav() {
		const items = q('[data-hguis-nav-items]');
		items.innerHTML = navItems.map((item, index) => `<div class="hguis-nav-setting" data-nav-id="${item.id}"><span>${icon(item.icon)}${item.label}</span><div>${control('nav-up', `${item.label}を上へ`, 'chevron-up', `data-value="${item.id}" ${index === 0 ? 'disabled' : ''}`)}${control('nav-down', `${item.label}を下へ`, 'chevron-down', `data-value="${item.id}" ${index === navItems.length - 1 ? 'disabled' : ''}`)}<label><span class="hguis-sr-only">${item.label}を表示</span><input type="checkbox" data-hguis-nav-visible="${item.id}" ${item.visible ? 'checked' : ''} ${item.id === 'home' ? 'disabled' : ''}></label></div></div>`).join('');
		q('[data-hguis-nav-preview]').innerHTML = `<span title="メニュー">${icon('menu-2')}</span>` + navItems.filter(item => item.visible).map(item => `<span title="${item.label}">${icon(item.icon)}<span class="hguis-sr-only">${item.label}</span></span>`).join('');
	}
	function click(event) {
		const target = event.target.closest?.('[data-hguis-action]');
		if (!target || !root.contains(target) || target.disabled) return;
		const action = target.dataset.hguisAction, value = target.dataset.value;
		if (action === 'device') {
			pressed(action, value); q('[data-hguis-device]').dataset.hguisDevice = value; picker(false);
			q('[data-hguis-switcher]').hidden = true; root.removeAttribute('data-hguis-menu-open');
			all('[data-hguis-action="menu"], [data-hguis-action="mobile-menu"]').forEach(item => item.setAttribute('aria-expanded', 'false'));
			q('[data-hguis-device-caption]').textContent = value === 'mobile' ? 'スマホでは上部のタブを使います。下部のホームを長押しすると一覧を開けます。' : 'PCでは右端の縦メニューを使います。マウスを重ねると項目名が表示されます。';
			status(`${value === 'mobile' ? 'スマホ' : 'PC'}の配置に切り替えました。`);
		} else if (action === 'timeline' && Object.hasOwn(timelineDescriptions, value)) {
			pressed(action, value); q('[data-hguis-timeline-title]').textContent = timelines.find(item => item[0] === value)[2];
			q('[data-hguis-timeline-description]').textContent = timelineDescriptions[value]; picker(false); status(timelineDescriptions[value]);
		} else if (action === 'menu' || action === 'mobile-menu') {
			const switcher = q('[data-hguis-switcher]'); switcher.hidden = !switcher.hidden;
			all('[data-hguis-action="menu"], [data-hguis-action="mobile-menu"]').forEach(item => item.setAttribute('aria-expanded', String(!switcher.hidden)));
			root.toggleAttribute('data-hguis-menu-open', !switcher.hidden);
			if (action === 'mobile-menu' && !switcher.hidden) switcher.querySelector('button')?.focus();
			status('メニューの「UI切り替え」からUIを選べます。ここでは画面の切り替えは行いません。');
		} else if (action === 'ui') {
			pressed(action, value); status(`${value === 's' ? 'Hataskey UI S' : 'Hataskey UI'}を選ぶ練習ができました。本体では画面が読み込み直されます。`);
		} else if (action === 'home') {
			if (!longPressed) status('本体ではタイムラインの先頭へ戻ります。長押しすると一覧が開きます。');
			longPressed = false;
		} else if (action === 'open-list' || action === 'close-list') {
			picker(action === 'open-list'); status(action === 'open-list' ? '読みたいタイムラインを選んでください。' : '一覧を閉じました。');
		} else if (action === 'search' || action === 'notifications') {
			status(action === 'search' ? '虫眼鏡を押すと下部に検索欄が開きます。図では検索を行いません。' : 'ベルから通知を開きます。図では通知を取得しません。');
		} else if (action === 'post-tools' || action === 'visibility-menu') {
			const panel = q(action === 'post-tools' ? '[data-hguis-post-tools]' : '[data-hguis-visibility]');
			panel.hidden = !panel.hidden; target.setAttribute('aria-expanded', String(!panel.hidden));
		} else if (action === 'visibility' && Object.hasOwn(visibilityLabels, value)) {
			visibility = value; pressed(action, value);
			q('[data-hguis-visibility-label] span').textContent = visibilityLabels[value]; q('[data-hguis-visibility]').hidden = true;
			q('[data-hguis-visibility-label] i').className = `ti ti-${{ public: 'world', home: 'home', followers: 'lock', specified: 'mail' }[value]}`;
			q('[data-hguis-visibility-label]').setAttribute('aria-label', visibilityLabels[value]);
			q('[data-hguis-visibility-label]').setAttribute('aria-expanded', 'false'); q('[data-hguis-recipient-row]').hidden = value !== 'specified';
			q('[data-hguis-visibility-label]').focus();
			updateSend(); status(value === 'specified' ? 'ダイレクトの練習では宛先の例を入力してください。' : `${visibilityLabels[value]}を選びました。本文と公開範囲を確かめてください。`);
		} else if (action === 'federation') {
			federated = !federated; target.setAttribute('aria-pressed', String(federated)); target.setAttribute('aria-label', federated ? '連合あり' : '連合なし'); target.title = target.getAttribute('aria-label');
			target.innerHTML = icon(federated ? 'rocket' : 'world-off'); status(`${federated ? '連合あり' : '連合なし'}を選びました。誰が読めるかは公開範囲で確認します。`);
		} else if (action === 'tool' && Object.hasOwn(toolHelp, value)) {
			q('[data-hguis-tool-help]').hidden = false; q('[data-hguis-tool-help]').textContent = toolHelp[value]; status(toolHelp[value]);
		} else if (['attach', 'annotation', 'emoji'].includes(action)) {
			const help = { attach: '「添付」からアップロード・ドライブ・URLを選べます。図ではファイルを開きません。', annotation: '「注釈」で本文の前に注意書きを付け、本文を折りたためます。', emoji: '顔のボタンから本文に絵文字を入れられます。ノートへのリアクションとは別の操作です。' };
			q('[data-hguis-tool-help]').hidden = false; q('[data-hguis-tool-help]').textContent = help[action]; status(help[action]);
		} else if (action === 'send' && canSend()) {
			q('[data-hguis-sent]').hidden = false; q('[data-hguis-sent-text]').textContent = q('[data-hguis-text]').value;
			q('[data-hguis-sent-scope]').textContent = `${visibilityLabels[visibility]}${visibility === 'specified' ? `：${q('[data-hguis-recipient]').value}` : ''} · ${federated ? '連合あり' : '連合なし'} · 図の中だけに表示しています。`;
			status('投稿の練習ができました。サーバーには送信していません。');
		} else if (action === 'workspace-mode') {
			pressed(action, value); q('[data-hguis-workspace]').hidden = value === 'deck'; q('[data-hguis-deck]').hidden = value !== 'deck';
			status(value === 'deck' ? 'ホーム・ローカル・通知を別々の列に並べました。' : '標準表示に戻しました。');
		} else if (action === 'page-open') {
			setPage('split'); status('通知をタイムラインの左側に開きました。');
		} else if (action === 'page-toggle') {
			setPage(pageMode === 'full' ? 'split' : 'full'); status(pageMode === 'full' ? '通知を全画面に広げました。' : '通知とタイムラインの左右表示に戻しました。');
		} else if (action === 'page-close') {
			setPage('home'); q('[data-hguis-action="page-open"]').focus(); status('通知を閉じてタイムラインに戻りました。');
		} else if (action === 'pane') {
			q('[data-hguis-pane]').hidden = false; q('[data-hguis-pane-title]').textContent = value === 'hatask' ? 'Hatask' : 'ウィジェット';
			q('[data-hguis-pane-content]').textContent = value === 'hatask' ? 'きょうの予定：15:00 図書館へ。ToDo：借りた本を返す。' : '時計やカレンダーなどのウィジェットを並べられます。';
			status('図の表示を切り替えました。本体では幅の広い画面の右側に表示されます。');
		} else if (action === 'nav-up' || action === 'nav-down') {
			const from = navItems.findIndex(item => item.id === value), to = from + (action === 'nav-up' ? -1 : 1);
			if (from < 0 || to < 0 || to >= navItems.length) return;
			[navItems[from], navItems[to]] = [navItems[to], navItems[from]]; renderNav();
			const moved = q(`[data-nav-id="${value}"] [data-hguis-action="${action}"]`);
			(moved.disabled ? q(`[data-nav-id="${value}"] button:not(:disabled)`) : moved)?.focus();
			status('見本の下部ナビを並び替えました。本体の設定ではすぐに保存されます。');
		}
	}
	function change(event) {
		const input = event.target;
		if (input.matches('[data-hguis-nav-visible]')) {
			const item = navItems.find(row => row.id === input.dataset.hguisNavVisible);
			if (!item || item.id === 'home') return;
			if (input.checked && navItems.filter(row => row.visible).length >= 5) { input.checked = false; status('ホームを含む5項目までです。先に別の項目を非表示にしてください。'); return; }
			item.visible = input.checked; renderNav(); q(`[data-hguis-nav-visible="${item.id}"]`)?.focus(); status('見本の下部ナビを更新しました。本体ではすぐに保存されます。');
		} else if (input.matches('[data-hguis-setting]')) {
			q('[data-hguis-settings-preview]').dataset[input.dataset.hguisSetting] = input.type === 'checkbox' ? String(input.checked) : input.value;
			status('見本に反映しました。本体のUI S設定では、変更はすぐに保存されます。');
		}
	}
	function input() { if (root.dataset.hguisScene === 'post') updateSend(); }
	function clearHold() { if (holdTimer != null) clearTimeout(holdTimer); holdTimer = null; }
	function pointerdown(event) {
		if (!event.target.closest?.('[data-hguis-action="home"]') || event.button !== 0) return;
		clearHold(); longPressed = false;
		holdTimer = setTimeout(() => { holdTimer = null; if (disposed) return; longPressed = true; picker(true); status('長押しで一覧を開きました。読みたいタイムラインを選んでください。'); }, 450);
	}
	function keydown(event) {
		if (event.key !== 'Escape') return;
		if (root.dataset.hguisScene === 'overview') {
			picker(false);
			if (q('[data-hguis-switcher]').contains(root.ownerDocument.activeElement)) q(q('[data-hguis-device]').dataset.hguisDevice === 'mobile' ? '[data-hguis-action="mobile-menu"]' : '[data-hguis-action="menu"]')?.focus();
			q('[data-hguis-switcher]').hidden = true; root.removeAttribute('data-hguis-menu-open');
		}
		if (root.dataset.hguisScene === 'post') {
			const active = root.ownerDocument.activeElement;
			if (q('[data-hguis-post-tools]').contains(active)) q('[data-hguis-action="post-tools"]').focus();
			else if (q('[data-hguis-visibility]').contains(active)) q('[data-hguis-action="visibility-menu"]').focus();
			q('[data-hguis-post-tools]').hidden = true; q('[data-hguis-visibility]').hidden = true;
		}
		all('[aria-expanded="true"]').forEach(element => element.setAttribute('aria-expanded', 'false'));
	}
	const listeners = [['click', click], ['change', change], ['input', input], ['pointerdown', pointerdown], ['pointerup', clearHold], ['pointercancel', clearHold], ['pointerleave', clearHold], ['keydown', keydown]];
	for (const [name, handler] of listeners) root.addEventListener(name, handler);
	if (root.dataset.hguisScene === 'settings') renderNav();
	root.dataset.hguisReady = 'true';
	const cleanup = () => {
		if (disposed) return;
		disposed = true; clearHold();
		for (const [name, handler] of listeners) root.removeEventListener(name, handler);
		delete root.dataset.hguisReady; mounts.delete(root);
	};
	mounts.set(root, cleanup);
	return cleanup;
}

export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hguis-scene]') ? [scene] : [...scene.querySelectorAll('[data-hguis-scene]')];
	const cleanups = roots.map(mount);
	return () => { for (const cleanup of cleanups) cleanup(); };
}
