/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { hataskGuideProse } from './prose.js';
import { note } from './note-scenes.js';

export const templates = {
	'hg-collection-scene': `
  <section class="hgcoll" data-hgcoll-root>
    <nav class="hgcoll-tabs" aria-label="アンテナの説明画面を選ぶ">
      <button type="button" data-hgcoll-jump="manage" aria-pressed="false">1 管理一覧</button>
      <button type="button" data-hgcoll-jump="create" aria-pressed="true">2 作成フォーム</button>
      <button type="button" data-hgcoll-jump="timeline" aria-pressed="false">3 ノートを読む</button>
    </nav>
    <div class="hgcoll-instruction"><strong data-hgcoll-heading></strong><p data-hgcoll-guidance></p></div>
    <div class="hgcoll-frame" data-hgcoll-frame tabindex="-1" aria-label="アンテナの操作練習"></div>
    <div class="hgcoll-status" data-hgcoll-status role="status" aria-live="polite" hidden></div>
    <details class="hgcoll-word-guide"><summary>キーワードを二つ以上書くとき</summary><div class="hgcoll-word-examples"><div><code>読書 本</code><p>スペースで区切ると「読書」と「本」の両方を含むノートを集める（AND）</p></div><div><code>読書
映画</code><p>改行で区切ると「読書」か「映画」のどちらかを含むノートを集める（OR）</p></div></div></details>
    <p class="hgcoll-caption"><i class="ti ti-info-circle" aria-hidden="true"></i><span>操作できるモック。<br>本体のデータは読まず、入力や保存もこの画面内だけで試せる。<br>別の項目を開くと入力は消える</span></p>
    <dialog class="hgcoll-dialog" data-hgcoll-user-dialog aria-labelledby="hgcoll-user-title">
      <div class="hgcoll-header"><button type="button" class="hgcoll-icon-button" data-hgcoll-close-user aria-label="ユーザーの選択をキャンセル"><i class="ti ti-x" aria-hidden="true"></i></button><strong id="hgcoll-user-title">ユーザーを選択</strong><button type="button" class="hgcoll-icon-button" data-hgcoll-confirm-user aria-label="選択したユーザーを追加" disabled><i class="ti ti-check" aria-hidden="true"></i></button></div>
      <div class="hgcoll-dialog-body">
        <div class="hgcoll-user-fields"><label class="hgcoll-field"><span class="hgcoll-label">ユーザー名</span><input class="hgcoll-input" data-hgcoll-user-query placeholder="aoi" autocomplete="off"></label><label class="hgcoll-field"><span class="hgcoll-label">ホスト</span><input class="hgcoll-input" data-hgcoll-host-query placeholder="example.invalid" autocomplete="off"></label></div>
        <p class="hgcoll-help">このガイドでは架空の「あおい」を選べる。<br>本体では、ユーザー名やホストを入力して相手を探そう</p>
        <button type="button" class="hgcoll-user-choice" data-hgcoll-user-choice aria-pressed="false"><span class="hgcoll-avatar"><i class="ti ti-user" aria-hidden="true"></i></span><span><strong>あおい</strong><small>@aoi@example.invalid</small></span></button>
        <p class="hgcoll-help" data-hgcoll-no-user hidden>このモックに該当するユーザー例はありません</p>
      </div>
    </dialog>
    <dialog class="hgcoll-dialog" data-hgcoll-delete-dialog aria-labelledby="hgcoll-delete-title"><div class="hgcoll-dialog-body"><strong id="hgcoll-delete-title">このアンテナを削除しますか？</strong><p class="hgcoll-help">消えるのは、このモック内で作成した例だけ。<br>本体のアンテナには影響しない</p><div class="hgcoll-actions"><button type="button" class="hgcoll-button" data-hgcoll-cancel-delete>キャンセル</button><button type="button" class="hgcoll-button" data-hgcoll-confirm-delete>削除</button></div></div></dialog>
  </section>
`,
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const icon = name => '<i class="ti ti-' + name + '" aria-hidden="true"></i>';
const sources = [['all', '全てのノート'], ['users', '指定した一人または複数のユーザーのノート'], ['list', '指定したリストのユーザーのノート'], ['users_blacklist', '指定した一人または複数のユーザーを除いた全てのノート']];
const flags = [['excludeBots', 'Botアカウントを除外'], ['withReplies', '返信を含む'], ['localOnly', 'ローカルのみ'], ['caseSensitive', '大文字小文字を区別する'], ['withFile', 'ファイルが添付されたノートのみ'], ['excludeNotesInSensitiveChannel', 'センシティブなチャンネルのノートを除外']];
const blank = () => ({ name: '', src: 'all', users: '', userListId: 'books', keywords: '', excludeKeywords: '', excludeBots: false, withReplies: false, localOnly: false, caseSensitive: false, withFile: false, excludeNotesInSensitiveChannel: false });
const recipe = () => ({ ...blank(), name: '本の話', keywords: '読書' });
const noteExamples = [
	{ name: 'あおい', user: '@aoi@example.invalid', text: '読書の時間を少しだけ。本の続きをゆっくり読んでいる', time: '3分前', file: false, reply: false, bot: false, local: true, sensitive: false, list: true },
	{ name: 'こはる', user: '@koharu@example.invalid', text: '散歩のあとに読書。次はどんな本を読もうかな', time: '12分前', file: false, reply: false, bot: false, local: true, sensitive: false, list: true },
	{ name: 'みどり', user: '@midori@remote.invalid', text: '昨日の映画、もう一度観たくなった', time: '18分前', file: false, reply: false, bot: false, local: false, sensitive: false, list: false },
];
let instanceSequence = 0;

export function init(scene) {
	if (!scene) return () => {};
	const root = scene.matches?.('[data-hgcoll-root]') ? scene : scene.querySelector('[data-hgcoll-root]');
	if (!root || root.dataset.hgcollReady) return () => {};
	root.dataset.hgcollReady = 'true';
	const controller = new root.ownerDocument.defaultView.AbortController();
	const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: controller.signal });
	// HTML IDs and IDREF attributes belong to this illustration, including dialogs.
	const instanceId = (scene.dataset.hataIntroInstance || 'scene').replace(/[^a-zA-Z0-9_-]/g, '_');
	const prefix = 'hata-intro-collection-' + instanceId + '-' + ++instanceSequence + '-';
	const id = value => value.startsWith('hgcoll-') ? prefix + value : value;
	const scopeIds = markup => markup.replace(/\b(id|for|aria-labelledby|aria-describedby|aria-controls)="([^"]*)"/g,
		(_, attribute, value) => attribute + '="' + value.split(/\s+/).map(id).join(' ') + '"');
	const originalIds = [];
	root.querySelectorAll('[id], [for], [aria-labelledby], [aria-describedby], [aria-controls]').forEach(element => {
		for (const attribute of ['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
			if (!element.hasAttribute(attribute)) continue;
			const value = element.getAttribute(attribute);
			originalIds.push([element, attribute, value]);
			element.setAttribute(attribute, value.split(/\s+/).map(id).join(' '));
		}
	});
	const q = selector => root.querySelector(selector.replace(/^#(hgcoll-[a-z-]+)$/, (_, value) => '#' + id(value)));
	const frame = q('[data-hgcoll-frame]');
	let draft = recipe(), saved = null, entries = [], sequence = 0, editing = false, screen = 'create', selectedUser = false;
	const prose = hataskGuideProse;
	const say = text => { q('[data-hgcoll-status]').hidden = !text; q('[data-hgcoll-status]').innerHTML = prose(text); };
	const title = (heading, guidance) => { q('[data-hgcoll-heading]').textContent = heading; q('[data-hgcoll-guidance]').innerHTML = prose(guidance); };
	const button = (action, symbol, label) => '<button type="button" class="hgcoll-icon-button" data-hgcoll-action="' + action + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (action === 'picker' ? ' aria-expanded="false" aria-controls="hgcoll-picker"' : '') + '>' + icon(symbol) + '</button>';
	const header = (text, actions = '') => '<header class="hgcoll-header">' + button('back', 'chevron-left', '前の説明画面へ戻る') + '<strong>' + esc(text) + '</strong>' + actions + '</header>';
	const textarea = (key, label, help, placeholder = '') => '<label class="hgcoll-field"><span class="hgcoll-label">' + label + '</span><textarea class="hgcoll-input" name="' + key + '" data-hgcoll-field="' + key + '" aria-describedby="hgcoll-help-' + key + '" placeholder="' + esc(placeholder) + '">' + esc(draft[key]) + '</textarea></label><p class="hgcoll-help" id="hgcoll-help-' + key + '">' + esc(help) + '</p>';
	const toggle = ([key, label]) => '<label class="hgcoll-toggle"><input type="checkbox" data-hgcoll-field="' + key + '"' + (draft[key] ? ' checked' : '') + '><span class="hgcoll-track" aria-hidden="true"></span><span>' + label + '</span></label>';
	const readForm = () => {
		frame.querySelectorAll('[data-hgcoll-field]').forEach(el => { draft[el.dataset.hgcollField] = el.type === 'checkbox' ? el.checked : el.value; });
	};

	function scopeMarkup() {
		if (draft.src === 'list') return '<div><span class="hgcoll-label" id="hgcoll-list-label">リスト</span><details class="hgcoll-select" data-hgcoll-list-select><summary aria-labelledby="hgcoll-list-label hgcoll-list-value"><span id="hgcoll-list-value">本の話</span>' + icon('chevron-down') + '</summary><div class="hgcoll-options"><button type="button" data-hgcoll-action="select-list" aria-pressed="true">' + icon('check') + '<span>本の話</span></button></div></details><p class="hgcoll-help">このモックには、あおい・こはるを含むリストを用意している</p></div>';
		if (draft.src === 'users' || draft.src === 'users_blacklist') return '<div>' + textarea('users', 'ユーザー', 'ユーザー名を改行で区切って指定します', '@aoi@example.invalid') + '<button type="button" class="hgcoll-link" data-hgcoll-action="add-user">ユーザーを追加</button></div>';
		return '';
	}

	function createMarkup() {
		const keywordHelp = 'スペースで区切るとAND指定になり、改行で区切るとOR指定になります';
		return header(editing ? 'アンテナを編集' : 'アンテナを作成') + '<div class="hgcoll-scroll" tabindex="0" aria-label="アンテナの入力欄。下へスクロールすると保存ボタン"><div class="hgcoll-body"><form class="hgcoll-form" data-hgcoll-form><label class="hgcoll-field"><span class="hgcoll-label">名前</span><input class="hgcoll-input" name="antenna-name" data-hgcoll-field="name" value="' + esc(draft.name) + '" placeholder="例：本の話" maxlength="100" required autocomplete="off"></label><div><span class="hgcoll-label" id="hgcoll-source-label">受信ソース</span><details class="hgcoll-select" data-hgcoll-source-select><summary aria-labelledby="hgcoll-source-label hgcoll-source-value"><span id="hgcoll-source-value">' + esc(sources.find(s => s[0] === draft.src)[1]) + '</span>' + icon('chevron-down') + '</summary><div class="hgcoll-options">' + sources.map(([key, label]) => '<button type="button" data-hgcoll-source="' + key + '" aria-pressed="' + (draft.src === key) + '">' + icon(draft.src === key ? 'check' : 'point') + '<span>' + label + '</span></button>').join('') + '</div></details></div><div data-hgcoll-scope' + (draft.src === 'all' ? ' hidden' : '') + '>' + scopeMarkup() + '</div>' + flags.slice(0, 2).map(toggle).join('') + '<div>' + textarea('keywords', '受信キーワード', keywordHelp, '例：読書') + '</div><div>' + textarea('excludeKeywords', '除外キーワード', keywordHelp) + '</div>' + flags.slice(2).map(toggle).join('') + '<div class="hgcoll-actions"><button type="submit" class="hgcoll-button" data-primary>' + icon('device-floppy') + ' 保存</button>' + (editing ? '<button type="button" class="hgcoll-button" data-hgcoll-action="delete">' + icon('trash') + ' 削除</button>' : '') + '</div></form></div></div>';
	}

	const matchesWords = (value, text, caseSensitive) => {
		const normalize = s => caseSensitive ? s : s.toLowerCase();
		const lines = value.trim().split(/\r?\n/).map(line => line.trim().split(' ').filter(Boolean)).filter(line => line.length);
		return !lines.length || lines.some(words => words.every(word => normalize(text).includes(normalize(word))));
	};

	function matches(note, antenna) {
		const users = antenna.users.split(/\r?\n/).map(user => user.trim().replace(/^@/, ''));
		const selected = users.includes(note.user.replace(/^@/, ''));
		if (antenna.src === 'users' && !selected || antenna.src === 'users_blacklist' && selected || antenna.src === 'list' && !note.list) return false;
		if (antenna.localOnly && !note.local || antenna.excludeBots && note.bot || !antenna.withReplies && note.reply || antenna.withFile && !note.file || antenna.excludeNotesInSensitiveChannel && note.sensitive) return false;
		return matchesWords(antenna.keywords, note.text, antenna.caseSensitive) && !(antenna.excludeKeywords.trim() && matchesWords(antenna.excludeKeywords, note.text, antenna.caseSensitive));
	}

	function timelineMarkup() {
		const notes = saved ? noteExamples.filter(note => matches(note, saved)) : [];
		const active = saved ? '<div class="hgcoll-pill"><button type="button" class="hgcoll-pill-main" data-hgcoll-action="read" aria-label="選択中のアンテナを読む">' + icon('antenna') + '<span class="hgcoll-pill-copy"><strong>アンテナ</strong><small>' + esc(saved.name) + '</small></span></button>' + button('picker', 'selector', 'アンテナの切り替え') + button('edit-current', 'settings', '選択中のアンテナの設定') + '</div>' : button('picker', 'antenna', 'アンテナを選択');
		const choices = entries.length ? entries.map(item => '<button type="button" data-hgcoll-select-entry="' + item.demoId + '" aria-pressed="' + (item.demoId === saved?.demoId) + '">' + icon('antenna') + '<span>' + esc(item.name) + '</span></button>').join('') : '<p>アンテナがありません</p><button type="button" data-hgcoll-action="manage">' + icon('settings') + '<span>オプション</span></button>';
		const nav = '<div class="hgcoll-topnav" aria-label="上部バー右側の表示例"><span class="hgcoll-nav-static" role="img" aria-label="リストのアイコン">' + icon('list') + '</span><span class="hgcoll-nav-static" role="img" aria-label="チャンネルのアイコン">' + icon('device-tv') + '</span>' + active + '</div><div class="hgcoll-picker" id="hgcoll-picker" data-hgcoll-picker hidden>' + choices + '</div>';
		if (!saved) return nav + '<div class="hgcoll-empty"><span>アンテナはまだ作成していません<br>上のアンテナのアイコンを押してみよう</span></div>';
		const cards = notes.map(item => note(item.text, '', item.name, item.user)).join('');
		return nav + '<p class="hgcoll-read-label">上部バーの右側を抜粋 · ノートとボタンは表示例</p><div class="hgcoll-scroll">' + (cards ? '<div class="hgcoll-notes">' + cards + '</div>' : '<div class="hgcoll-empty">' + icon('search') + '<span>このモックのノート例に<br>今の条件に合うものはありません</span></div>') + '</div>';
	}

	function render(next, focus = false) {
		screen = next;
		root.querySelectorAll('[data-hgcoll-jump]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.hgcollJump === next)));
		if (next === 'create') {
			title('まず名前とキーワードを決め、いちばん下で保存する', '最初の「本の話」「読書」は入力例。受信元や返信などの条件は必要に応じて変えよう。入力欄の中を下へスクロールすると、最後に「保存」がある');
			frame.innerHTML = scopeIds(createMarkup());
		} else if (next === 'manage') {
			title(entries.length ? '保存後は管理一覧へ戻る' : '右上の＋からアンテナを作る', entries.length ? '一覧の名前を押すと条件の編集画面へ進む。集まったノートを読むときは、上の「3 ノートを読む」で上部バーの使い方を確かめよう' : '本体では上部バーのアンテナを押す。まだ作っていなければ「オプション」からこの管理画面へ進める');
			frame.innerHTML = header('アンテナの管理', button('new', 'plus', '追加') + button('reload', 'refresh', 'リロード')) + '<div class="hgcoll-body">' + (entries.length ? '<div class="hgcoll-list">' + entries.map(item => '<button type="button" data-hgcoll-edit-entry="' + item.demoId + '">' + esc(item.name) + '</button>').join('') + '</div>' : '<div class="hgcoll-empty">' + icon('box') + '<span>ありません</span></div>') + '</div>';
		} else {
			title(saved ? 'アンテナ名の横で、切り替えと条件の編集ができる' : 'アンテナがなければ「オプション」から作成する', saved ? '上下の矢印はアンテナの切り替え、歯車は選択中のアンテナの設定。ここでは架空のノートに保存した条件を当てはめている。本体の受信結果を示すものではない' : 'アンテナのアイコンを押すと、まだ作成していないことが分かる。「オプション」で管理一覧へ進み、＋から作ってみよう');
			frame.innerHTML = scopeIds(timelineMarkup());
		}
		if (focus) frame.focus({ preventScroll: true });
	}

	listen(root, 'input', event => {
		if (event.target.matches('[data-hgcoll-field]')) readForm();
		if (event.target.matches('[data-hgcoll-user-query], [data-hgcoll-host-query]')) {
			selectedUser = false;
			q('[data-hgcoll-user-choice]').setAttribute('aria-pressed', 'false');
			q('[data-hgcoll-confirm-user]').disabled = true;
			const username = q('[data-hgcoll-user-query]').value.trim().toLowerCase().replace(/^@/, '');
			const host = q('[data-hgcoll-host-query]').value.trim().toLowerCase();
			const match = 'aoi'.includes(username) && 'example.invalid'.includes(host);
			q('[data-hgcoll-user-choice]').hidden = !match;
			q('[data-hgcoll-no-user]').hidden = match;
		}
	});
	listen(root, 'change', event => { if (event.target.matches('[data-hgcoll-field]')) readForm(); });
	listen(root, 'submit', event => {
		if (!event.target.matches('[data-hgcoll-form]')) return;
		event.preventDefault();
		readForm();
		// The editor owns draft.demoId; changing the reading tab must not retarget it.
		const replacing = editing && entries.some(item => item.demoId === draft.demoId);
		saved = { ...draft, demoId: replacing ? draft.demoId : ++sequence };
		if (replacing) entries = entries.map(item => item.demoId === saved.demoId ? saved : item);
		else entries.push(saved);
		editing = false;
		render('manage', true);
		say('モック内の一覧へ反映したよ。本体でも保存後は「アンテナの管理」へ戻る。次は「3 ノートを読む」で、上部バーから読む流れを見てみよう');
	});
	listen(root, 'keydown', event => {
		if (event.key !== 'Escape') return;
		if (root.querySelector('dialog[open]')) { event.stopPropagation(); return; }
		const select = event.target.closest('details.hgcoll-select[open]');
		if (select) { select.open = false; select.querySelector('summary').focus(); event.preventDefault(); event.stopPropagation(); }
	});
	listen(root, 'click', event => {
		const target = event.target.closest('button');
		if (!target || !root.contains(target)) return;
		if (target.hasAttribute('data-hgcoll-jump')) {
			if (screen === 'create') readForm();
			say(''); render(target.dataset.hgcollJump, true); return;
		}
		if (target.hasAttribute('data-hgcoll-edit-entry')) {
			saved = entries.find(item => item.demoId === Number(target.dataset.hgcollEditEntry));
			draft = { ...saved }; editing = true; say(''); render('create', true); return;
		}
		if (target.hasAttribute('data-hgcoll-select-entry')) {
			saved = entries.find(item => item.demoId === Number(target.dataset.hgcollSelectEntry));
			render('timeline'); q('[data-hgcoll-action="picker"]').focus(); say('選んだアンテナへ切り替えた。名前の右の歯車から、このアンテナの条件を見直せる'); return;
		}
		if (target.hasAttribute('data-hgcoll-source')) {
			readForm(); draft.src = target.dataset.hgcollSource;
			q('[data-hgcoll-source-select]').open = false;
			q('#hgcoll-source-value').textContent = sources.find(s => s[0] === draft.src)[1];
			root.querySelectorAll('[data-hgcoll-source]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.hgcollSource === draft.src)); el.querySelector('i').className = 'ti ti-' + (el.dataset.hgcollSource === draft.src ? 'check' : 'point'); });
			q('[data-hgcoll-scope]').hidden = draft.src === 'all'; q('[data-hgcoll-scope]').innerHTML = scopeIds(scopeMarkup());
			q('[data-hgcoll-source-select] summary').focus(); return;
		}
		const action = target.dataset.hgcollAction;
		if (action === 'new') { draft = blank(); editing = false; say(''); render('create', true); }
		if (action === 'manage') { render('manage', true); say(''); }
		if (action === 'back') { if (screen === 'create') readForm(); render(screen === 'manage' ? 'timeline' : 'manage', true); say(''); }
		if (action === 'reload') say('このモックでは通信しないため、一覧は変わらない。本体のリロードは最新の一覧を読み直す');
		if (action === 'edit-current' && saved) { draft = { ...saved }; editing = true; say(''); render('create', true); }
		if (action === 'picker') { const picker = q('[data-hgcoll-picker]'); picker.hidden = !picker.hidden; target.setAttribute('aria-expanded', String(!picker.hidden)); }
		if (action === 'read') { if (q('[data-hgcoll-picker]')) q('[data-hgcoll-picker]').hidden = true; q('[data-hgcoll-action="picker"]')?.setAttribute('aria-expanded', 'false'); target.focus(); say('選択中のアンテナのノートを表示している。条件を変えるときは、名前の右の歯車を押そう'); }
		if (action === 'select-list') { q('[data-hgcoll-list-select]').open = false; q('[data-hgcoll-list-select] summary').focus(); }
		if (action === 'add-user') { selectedUser = false; q('[data-hgcoll-user-choice]').setAttribute('aria-pressed', 'false'); q('[data-hgcoll-confirm-user]').disabled = true; q('[data-hgcoll-user-dialog]').showModal(); q('[data-hgcoll-user-query]').focus(); }
		if (target.hasAttribute('data-hgcoll-user-choice')) { selectedUser = true; target.setAttribute('aria-pressed', 'true'); q('[data-hgcoll-confirm-user]').disabled = false; }
		if (target.hasAttribute('data-hgcoll-close-user')) q('[data-hgcoll-user-dialog]').close();
		if (target.hasAttribute('data-hgcoll-confirm-user') && selectedUser) { const input = q('[data-hgcoll-field="users"]'); input.value = [input.value.trim(), '@aoi@example.invalid'].filter(Boolean).join('\n'); readForm(); q('[data-hgcoll-user-dialog]').close(); }
		if (action === 'delete') q('[data-hgcoll-delete-dialog]').showModal();
		if (target.hasAttribute('data-hgcoll-cancel-delete')) q('[data-hgcoll-delete-dialog]').close();
		if (target.hasAttribute('data-hgcoll-confirm-delete')) { entries = entries.filter(item => item.demoId !== draft.demoId); if (!entries.some(item => item.demoId === saved?.demoId))saved = entries[0] || null; draft = blank(); editing = false; q('[data-hgcoll-delete-dialog]').close(); render('manage', true); say('モック内のアンテナ例を削除した。本体のデータは変わっていない'); }
	});
	listen(q('[data-hgcoll-user-dialog]'), 'close', () => q('[data-hgcoll-action="add-user"]')?.focus());
	listen(q('[data-hgcoll-delete-dialog]'), 'close', () => q('[data-hgcoll-action="delete"]')?.focus());
	render('create');
	return () => {
		controller.abort();
		root.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
		for (const [element, attribute, value] of originalIds) element.setAttribute(attribute, value);
		delete root.dataset.hgcollReady;
	};
}
