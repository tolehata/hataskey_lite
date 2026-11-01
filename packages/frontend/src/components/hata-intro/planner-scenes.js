/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { hataskGuideProse } from './prose.js';

export const templates = {
	'hg-todo-scene': `
  <section class="hgp-scene" data-hgp-kind="todo">
    <div class="hgp-fixture"><span>Hatask · 架空のタスクで見る画面例</span><span>基準日：2026年9月5日</span></div>
    <div class="hgp-frame">
      <div class="hgp-app-heading"><i class="ti ti-list-check" aria-hidden="true"></i><span class="hgp-brand">ToDo</span></div>
      <div class="hgp-capture" aria-label="新しいタスクの入力欄・配置見本">
        <div class="hgp-input-line"><i class="ti ti-square-rounded-plus" aria-hidden="true"></i><span class="hgp-input-text">新しいタスクを入力</span><span class="hgp-static-icon" role="img" aria-label="テンプレート・配置見本"><i class="ti ti-template" aria-hidden="true"></i></span><span class="hgp-static-icon hgp-submit-sample" role="img" aria-label="追加・配置見本"><i class="ti ti-plus" aria-hidden="true"></i></span></div>
        <div class="hgp-chips"><span class="hgp-chip"><i class="ti ti-calendar-event" aria-hidden="true"></i>今日<i class="ti ti-chevron-down" aria-hidden="true"></i></span><span class="hgp-chip"><i class="ti ti-folder" aria-hidden="true"></i>暮らし<i class="ti ti-chevron-down" aria-hidden="true"></i></span></div>
        <div class="hgp-capture-tools" aria-label="入力の道具・配置見本"><span class="hgp-static-icon" role="img" aria-label="期限"><i class="ti ti-calendar-event" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="フォルダ"><i class="ti ti-folder" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="優先度"><i class="ti ti-flag" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="繰り返し"><i class="ti ti-repeat" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="詳細"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i></span><span class="hgp-static-label">入力・追加は配置見本</span></div>
      </div>
      <div class="hgp-command"><label class="hgp-search"><i class="ti ti-search" aria-hidden="true"></i><input type="search" placeholder="タスクを検索" aria-label="架空のタスクを検索" data-hgp-search></label><span class="hgp-static-icon" role="img" aria-label="並び替え・配置見本"><i class="ti ti-grip-vertical" aria-hidden="true"></i></span></div>
      <div class="hgp-todo-work"><aside class="hgp-organizer" aria-label="タスクの表示切り替え"><div class="hgp-organizer-nav" data-hgp-views></div><div class="hgp-folder-heading"><span>フォルダ</span><i class="ti ti-folder-plus" role="img" aria-label="フォルダ管理・配置見本"></i></div><button type="button" data-hgp-view="folder" aria-pressed="false"><i class="ti ti-folder" aria-hidden="true"></i>暮らし<span class="hgp-count" data-hgp-folder-count></span></button></aside><div class="hgp-content"><header class="hgp-content-head"><div><span class="hgp-eyebrow hgp-brand">ToDo</span><h4 data-hgp-view-title>すべて</h4></div><span class="hgp-count" data-hgp-total></span></header><ul class="hgp-task-list" data-hgp-tasks></ul></div></div>
    </div>
    <p class="hgp-feedback" data-hgp-feedback role="status">左の分類・検索・丸いチェックを試せるよ。チェックはこの図の中だけで変わる</p>
    <p class="hgp-caption">期日・フォルダ・繰り返しはタスクの下に表示。<br>右の鉛筆・アーカイブ・「…」は配置見本で、編集や削除は行わない。<br>狭い図では分類を上に並べている</p>
  </section>
`,
	'hg-calendar-scene': `
  <section class="hgp-scene" data-hgp-kind="calendar">
    <div class="hgp-fixture"><span>Hatask · 架空の予定で見る画面例</span><span>基準日：2026年9月5日</span></div>
    <div class="hgp-frame">
      <div class="hgp-app-heading"><i class="ti ti-calendar" aria-hidden="true"></i>カレンダー</div>
      <div class="hgp-capture" aria-label="予定入力の配置見本"><div class="hgp-input-line"><i class="ti ti-calendar-plus" aria-hidden="true"></i><span class="hgp-input-text">予定のタイトル</span><span class="hgp-static-icon" role="img" aria-label="テンプレート・配置見本"><i class="ti ti-template" aria-hidden="true"></i></span><span class="hgp-static-icon hgp-submit-sample" role="img" aria-label="追加・配置見本"><i class="ti ti-plus" aria-hidden="true"></i></span></div><div class="hgp-chips"><span class="hgp-chip"><i class="ti ti-calendar-event" aria-hidden="true"></i>9月5日</span><span class="hgp-chip"><i class="ti ti-clock" aria-hidden="true"></i>18:00 – 20:00</span><span class="hgp-chip"><i class="ti ti-lock" aria-hidden="true"></i>非公開</span></div><div class="hgp-capture-tools"><span class="hgp-static-icon" role="img" aria-label="日時・配置見本"><i class="ti ti-calendar-event" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="終日・配置見本"><i class="ti ti-sun" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="公開範囲・配置見本"><i class="ti ti-lock" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="繰り返し・配置見本"><i class="ti ti-repeat" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="詳細・配置見本"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i></span><span class="hgp-static-label">入力・追加は配置見本</span></div></div>
      <header class="hgp-calendar-head"><div class="hgp-period"><span class="hgp-static-icon" role="img" aria-label="前の期間・配置見本"><i class="ti ti-chevron-left" aria-hidden="true"></i></span><strong>2026年9月</strong><span class="hgp-static-icon" role="img" aria-label="次の期間・配置見本"><i class="ti ti-chevron-right" aria-hidden="true"></i></span><button class="hgp-pill-button" type="button" data-hgp-calendar-today><i class="ti ti-calendar-dot" aria-hidden="true"></i>今日</button><div class="hgp-view-switch" role="group" aria-label="カレンダーの表示"><button class="hgp-pill-button" type="button" data-hgp-calendar-view="month" aria-pressed="true"><i class="ti ti-calendar" aria-hidden="true"></i>月</button><span class="hgp-pill-button hgp-view-static" role="img" aria-label="週表示・配置見本">週</span><span class="hgp-pill-button hgp-view-static" role="img" aria-label="日表示・配置見本">日</span><button class="hgp-pill-button" type="button" data-hgp-calendar-view="agenda" aria-pressed="false"><i class="ti ti-list" aria-hidden="true"></i>一覧</button></div></div><div class="hgp-filters" role="group" aria-label="予定の表示対象"><span class="hgp-filter-label"><i class="ti ti-filter" aria-hidden="true"></i>表示する予定</span><button class="hgp-pill-button" type="button" data-hgp-filter="private" aria-pressed="true"><i class="ti ti-lock" aria-hidden="true"></i>非公開<span class="hgp-count">2</span></button><button class="hgp-pill-button" type="button" data-hgp-filter="public" aria-pressed="true"><i class="ti ti-world" aria-hidden="true"></i>公開<span class="hgp-count">1</span></button><button class="hgp-pill-button" type="button" data-hgp-filter="shared" aria-pressed="true"><i class="ti ti-users" aria-hidden="true"></i>主催者<span class="hgp-count">1</span></button></div></header>
      <div class="hgp-calendar-work"><div class="hgp-calendar-board" data-hgp-month><div class="hgp-weekdays" aria-hidden="true"><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span></div><div class="hgp-month-grid" data-hgp-days aria-label="2026年9月の日付"></div></div><div class="hgp-day-detail" data-hgp-day-detail></div><div class="hgp-agenda" data-hgp-agenda hidden></div></div>
    </div>
    <p class="hgp-feedback" data-hgp-feedback role="status">日付を選ぶと、その日の予定が下に出るよ。「一覧」と表示対象の切り替えも試せる</p>
    <p class="hgp-caption">月送り・週/日・予定の追加や編集は配置見本。<br>図は月曜始まり。<br>実画面は幅に応じて日付の詳細を右側に出し、週・日表示では時刻の目盛りに沿って予定を並べる</p>
  </section>
`,
	'hg-mood-scene': `
  <section class="hgp-scene" data-hgp-kind="mood">
    <div class="hgp-fixture"><span>Hatask · 架空の記録で見る画面例</span><span>基準日：2026年9月5日</span></div>
    <div class="hgp-frame">
      <div class="hgp-app-heading"><i class="ti ti-mood-smile" aria-hidden="true"></i>きもち<small>ひとことは任意</small></div><p class="hgp-mood-intro">いまのきもちを、ひと息で残そう</p>
      <div class="hgp-capture"><div class="hgp-input-line"><i class="ti ti-mood-smile" aria-hidden="true"></i><textarea class="hgp-mood-input" rows="1" placeholder="ひとこと（任意）" aria-label="ひとことの入力例・保存されません"></textarea><span class="hgp-static-icon hgp-submit-sample" role="img" aria-label="記録・配置見本"><i class="ti ti-check" aria-hidden="true"></i></span></div><div class="hgp-levels" role="group" aria-label="記録するきもちの例" data-hgp-levels></div><div class="hgp-chips"><span class="hgp-chip"><i class="ti ti-calendar" aria-hidden="true"></i>今日<i class="ti ti-chevron-down" aria-hidden="true"></i></span><span class="hgp-chip"><i class="ti ti-clock" aria-hidden="true"></i>20:30<i class="ti ti-chevron-down" aria-hidden="true"></i></span></div><div class="hgp-capture-tools"><span class="hgp-static-icon" role="img" aria-label="絵文字・配置見本"><i class="ti ti-mood-smile" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="通知・配置見本"><i class="ti ti-bell" aria-hidden="true"></i></span><span class="hgp-static-label">日付・時刻・記録は配置見本</span></div></div>
      <section class="hgp-journal-board"><div class="hgp-journal-toolbar"><div class="hgp-journal-tabs" role="group" aria-label="記録の表示"><button class="hgp-pill-button" type="button" data-hgp-journal-view="today" aria-pressed="true"><i class="ti ti-calendar-event" aria-hidden="true"></i>今日</button><button class="hgp-pill-button" type="button" data-hgp-journal-view="history" aria-pressed="false"><i class="ti ti-history" aria-hidden="true"></i>履歴</button><button class="hgp-pill-button" type="button" data-hgp-journal-view="review" aria-pressed="false"><i class="ti ti-chart-line" aria-hidden="true"></i>振り返り</button></div><div class="hgp-row-actions" aria-label="記録検索と並び順・配置見本"><span class="hgp-static-icon" role="img" aria-label="検索"><i class="ti ti-search" aria-hidden="true"></i></span><span class="hgp-static-icon" role="img" aria-label="新しい順"><i class="ti ti-sort-descending" aria-hidden="true"></i></span></div></div><div data-hgp-journal-panel></div></section>
    </div>
    <p class="hgp-feedback" data-hgp-feedback role="status">5段階の選択と、今日・履歴・振り返りを試せるよ。入力や選択は本体に記録しない</p>
    <p class="hgp-caption">同じ日に複数のきもちを残せる。<br>週の並びと時刻付きの記録で見返せるよ。<br>「振り返り」の数値もこの図の架空4記録から計算したもの。<br>医療的な診断ではない</p>
  </section>
`,
};

function listen(root, signal, type, handler) {
	root.addEventListener(type, handler, { signal });
}

const icon = name => '<i class="ti ti-' + name + '" aria-hidden="true"></i>';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const staticIcon = (name, label) => '<span class="hgp-static-icon" role="img" aria-label="' + esc(label) + '・配置見本">' + icon(name) + '</span>';
const chip = (name, text) => '<span class="hgp-chip">' + icon(name) + esc(text) + '</span>';
const feedback = (root, text) => { root.querySelector('[data-hgp-feedback]').innerHTML = hataskGuideProse(text); };
const levels = [['mood-cry', 'つらい'], ['mood-sad', 'もやもや'], ['mood-neutral', 'ふつう'], ['mood-smile', 'いい感じ'], ['mood-heart', '最高！']];

function initTodo(root, signal) {
	const tasks = [
		{ id: 'book', text: '図書館に本を返す', due: '9/5 18:00', date: 5, folder: '暮らし', priority: true, done: false, comment: '借りた2冊を忘れずに', subtasks: [1, 2] },
		{ id: 'plant', text: '植物に水をやる', due: '9/5', date: 5, folder: '暮らし', repeat: '毎日', done: false },
		{ id: 'movie', text: '週末の映画を予約する', due: '9/6', date: 6, folder: '', done: false },
		{ id: 'bag', text: '持ち物をそろえる', due: '9/5', date: 5, folder: '暮らし', done: true },
	];
	const views = [['today', 'calendar-event', '今日'], ['upcoming', 'calendar-time', 'これから'], ['overdue', 'clock-exclamation', '期限切れ'], ['priority', 'flag', '優先'], ['all', 'list-check', 'すべて'], ['completed', 'circle-check', '完了済み'], ['templates', 'template', 'テンプレート']];
	let view = 'all', query = '';
	const inView = (task, kind) => kind === 'completed' ? task.done : kind === 'templates' ? false : !task.done && (kind === 'all' ? true : kind === 'today' ? task.date === 5 : kind === 'upcoming' ? task.date > 5 : kind === 'overdue' ? task.date < 5 : kind === 'priority' ? !!task.priority : task.folder === '暮らし');
	root.querySelector('[data-hgp-views]').innerHTML = views.map(([id, mark, label]) => '<button type="button" data-hgp-view="' + id + '" aria-pressed="' + (id === view) + '">' + icon(mark) + label + '<span class="hgp-count" data-hgp-count="' + id + '"></span></button>').join('');

	function render() {
		root.querySelectorAll('[data-hgp-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.hgpView === view)));
		for (const [id] of views) root.querySelector('[data-hgp-count="' + id + '"]').textContent = String(tasks.filter(task => inView(task, id)).length);
		root.querySelector('[data-hgp-folder-count]').textContent = String(tasks.filter(task => inView(task, 'folder')).length);
		const chosen = views.find(option => option[0] === view) || ['folder', 'folder', '暮らし'];
		root.querySelector('[data-hgp-view-title]').innerHTML = icon(chosen[1]) + chosen[2];
		const shown = tasks.filter(task => inView(task, view) && (task.text + ' ' + task.folder + ' ' + (task.comment || '')).includes(query));
		root.querySelector('[data-hgp-total]').textContent = String(shown.length);
		root.querySelector('[data-hgp-tasks]').innerHTML = shown.length ? shown.map(task => '<li class="hgp-task" data-done="' + task.done + '"><label class="hgp-check"><input type="checkbox" data-hgp-done="' + task.id + '"' + (task.done ? ' checked' : '') + ' aria-label="' + esc(task.text) + (task.done ? 'を未完了に戻す' : 'を完了する') + '・例"></label><div class="hgp-task-copy"><strong class="hgp-task-title">' + esc(task.text) + (task.priority ? icon('flag-filled') : '') + '</strong><div class="hgp-chips">' + chip('calendar-event', task.due) + (task.folder ? chip('folder', task.folder) : '') + (task.repeat ? chip('repeat', task.repeat) : '') + '</div>' + (task.comment ? '<p>' + esc(task.comment) + '</p>' : '') + (task.subtasks ? '<div class="hgp-subtasks"><span>サブタスク ' + task.subtasks[0] + ' / ' + task.subtasks[1] + '</span><progress value="' + task.subtasks[0] + '" max="' + task.subtasks[1] + '" aria-label="サブタスクの進捗"></progress></div>' : '') + '</div><div class="hgp-row-actions">' + staticIcon('pencil', '編集') + staticIcon('archive', 'アーカイブ') + staticIcon('dots', 'その他') + '</div></li>').join('') : '<li class="hgp-empty">' + icon(view === 'templates' ? 'template' : 'circle-check') + '<p>' + (view === 'templates' ? 'この図にはテンプレートを登録していないよ' : query ? '一致するタスクはありません' : 'この分類のタスクはありません') + '</p></li>';
	}

	listen(root, signal, 'click', event => {const button = event.target.closest('[data-hgp-view]'); if (!button || !root.contains(button)) return; view = button.dataset.hgpView; render(); feedback(root, '「' + (views.find(option => option[0] === view)?.[2] || '暮らし') + '」の架空タスクを表示したよ');});
	listen(root, signal, 'input', event => {if (!event.target.matches('[data-hgp-search]')) return; query = event.target.value.trim(); render();});
	listen(root, signal, 'change', event => {const input = event.target.closest('[data-hgp-done]'); if (!input) return; const task = tasks.find(item => item.id === input.dataset.hgpDone); if (!task) return; const restoreFocus = root.ownerDocument.activeElement === input; task.done = input.checked; render(); if (restoreFocus)(root.querySelector('[data-hgp-done="' + task.id + '"]') || root.querySelector('[data-hgp-view="' + view + '"]'))?.focus({ preventScroll: true }); feedback(root, '例の「' + task.text + '」を' + (task.done ? '完了' : '未完了') + 'にしたよ。本体のタスクは変わらない');});
	render();
}

function initCalendar(root, signal) {
	const events = [{ day: 5, time: '10:00', end: '11:00', title: '図書館へ行く', source: 'private', place: '中央図書館' }, { day: 5, time: '18:00', end: '20:00', title: '友だちと映画', source: 'private', place: '駅前の映画館' }, { day: 12, time: '14:00', end: '15:00', title: '読書会', source: 'public', place: '会場は詳細に記載' }, { day: 19, time: '13:00', end: '14:00', title: '交流会', source: 'shared', place: '主催者からの案内' }];
	const sourceLabels = { private: '非公開', public: '公開', shared: '主催者' };
	const sourceIcons = { private: 'lock', public: 'world', shared: 'users' };
	const active = new Set(['private', 'public', 'shared']); let view = 'month', selected = 5;
	const filtered = () => events.filter(event => active.has(event.source));
	const rows = items => items.map(event => '<article class="hgp-event-row"><time>' + event.time + '<br>' + event.end + '</time><div><strong>' + esc(event.title) + '</strong><p>' + icon('map-pin') + ' ' + esc(event.place) + '</p><div class="hgp-chips">' + chip(sourceIcons[event.source], sourceLabels[event.source]) + '</div></div><div class="hgp-row-actions">' + staticIcon('arrows-move', '移動') + staticIcon('pencil', '編集') + '</div></article>').join('');

	function render() {
		root.querySelectorAll('[data-hgp-calendar-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.hgpCalendarView === view)));
		root.querySelectorAll('[data-hgp-filter]').forEach(button => button.setAttribute('aria-pressed', String(active.has(button.dataset.hgpFilter))));
		const available = filtered();
		root.querySelector('[data-hgp-month]').hidden = view !== 'month'; root.querySelector('[data-hgp-day-detail]').hidden = view !== 'month'; root.querySelector('[data-hgp-agenda]').hidden = view !== 'agenda';
		root.querySelector('[data-hgp-days]').innerHTML = Array.from({ length: 42 }, (_, index) => {const day = index, inside = day >= 1 && day <= 30, dayNumber = day === 0 ? 31 : day > 30 ? day - 30 : day; const items = inside ? available.filter(event => event.day === day) : []; return '<button type="button" class="hgp-date" data-hgp-day="' + day + '" data-outside="' + !inside + '" data-today="' + (day === 5) + '" aria-pressed="' + (day === selected) + '" aria-label="' + (day === 0 ? '8月31日' : day > 30 ? '10月' + dayNumber + '日' : '9月' + day + '日') + '・' + items.length + '件の予定"><strong>' + dayNumber + '</strong>' + items.map(event => '<span class="hgp-event-tag" data-source="' + event.source + '"><time>' + event.time + '</time><span>' + esc(event.title) + '</span></span>').join('') + '</button>';}).join('');
		const chosen = available.filter(event => event.day === selected), label = selected === 0 ? '8月31日' : selected > 30 ? '10月' + (selected - 30) + '日' : '9月' + selected + '日';
		root.querySelector('[data-hgp-day-detail]').innerHTML = '<h4>' + label + 'の予定 <span class="hgp-count">' + chosen.length + '</span></h4>' + (chosen.length ? rows(chosen) : '<p class="hgp-empty">表示する予定はありません</p>');
		root.querySelector('[data-hgp-agenda]').innerHTML = available.length ? [...new Set(available.map(event => event.day))].map(day => '<section class="hgp-day-detail"><h4>9月' + day + '日</h4>' + rows(available.filter(event => event.day === day)) + '</section>').join('') : '<div class="hgp-day-detail hgp-empty">表示する予定はありません</div>';
	}

	listen(root, signal, 'click', event => {const button = event.target.closest('button'); if (!button || !root.contains(button)) return; let dayFocus = null; if (button.hasAttribute('data-hgp-day')) {selected = Number(button.dataset.hgpDay); dayFocus = selected;} else if (button.hasAttribute('data-hgp-calendar-view'))view = button.dataset.hgpCalendarView; else if (button.hasAttribute('data-hgp-filter')) {const key = button.dataset.hgpFilter; if (active.has(key)) {active.delete(key);} else {active.add(key);}} else if (button.hasAttribute('data-hgp-calendar-today')) {selected = 5; view = 'month';} else return; render(); if (dayFocus !== null && event.detail === 0)root.querySelector('[data-hgp-day="' + dayFocus + '"]').focus({ preventScroll: true }); feedback(root, view === 'agenda' ? '表示対象に含まれる架空の予定を、日付順に並べたよ' : '選んだ日付の予定を下に表示したよ。予定そのものは移動・変更していない');});
	render();
}

function initMood(root, signal) {
	const records = [{ date: 5, time: '20:30', level: 4, note: '散歩して、少しすっきり' }, { date: 5, time: '08:10', level: 3, note: 'ゆっくり朝の支度' }, { date: 4, time: '19:20', level: 3, note: '気になっていた本を読めた' }, { date: 3, time: '09:00', level: 2, note: '予定が重なって、ちょっと落ち着かない' }];
	let view = 'today', day = 5, level = 4;
	root.querySelector('[data-hgp-levels]').innerHTML = levels.map(([mark, label], index) => '<button type="button" data-hgp-level="' + (index + 1) + '" aria-pressed="' + (index + 1 === level) + '">' + icon(mark) + '<span>' + label + '</span></button>').join('');
	const recordMarkup = items => items.map(item => '<article class="hgp-record"><span class="hgp-record-icon">' + icon(levels[item.level - 1][0]) + '</span><div><div class="hgp-record-title"><strong>' + levels[item.level - 1][1] + '</strong><time>' + item.time + '</time></div><p>' + esc(item.note) + '</p></div>' + staticIcon('dots', '記録の操作') + '</article>').join('');

	function render() {
		root.querySelectorAll('[data-hgp-journal-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.hgpJournalView === view)));
		const panel = root.querySelector('[data-hgp-journal-panel]');
		if (view === 'review') {const mean = items => (items.reduce((sum, item) => sum + item.level, 0) / items.length).toFixed(1); panel.innerHTML = '<h4>最近の傾向</h4><p class="hgp-caption">変化に気づくためのメモとして、気軽に見返せます</p><div class="hgp-review"><div><span>直近7日間の平均</span><strong class="hgp-review-score">' + mean(records) + '<small> / 5</small></strong><p>架空の4記録を集計</p></div><div><strong>時間帯ごとの傾向</strong>' + [['朝', records.filter(item => item.time < '12:00')], ['夜', records.filter(item => item.time > '18:00')]].map(([label, items]) => '<div class="hgp-meter-row"><span>' + label + '</span><meter min="1" max="5" value="' + mean(items) + '" aria-label="' + label + 'の架空記録の平均"></meter><strong>' + mean(items) + '</strong></div>').join('') + '</div></div><p class="hgp-caption">直近7日間に記録したきもちだけを表示する構成。<br>医療的な診断や評価のための数値ではない</p>'; return;}
		const visible = records.filter(item => day === null || item.date === day);
		panel.innerHTML = '<div class="hgp-week-heading">' + staticIcon('chevron-left', '前の週') + '<span>8月31日 – 9月6日</span>' + staticIcon('chevron-right', '次の週') + '</div><div class="hgp-week" aria-label="1週間の記録">' + ['月', '火', '水', '木', '金', '土', '日'].map((weekday, index) => {const date = index, items = records.filter(item => item.date === date); return '<button type="button" data-hgp-journal-day="' + date + '" aria-pressed="' + (date === day) + '" aria-label="' + (date === 0 ? '8月31日' : '9月' + date + '日') + '・' + items.length + '件の記録"><span>' + weekday + '</span><strong>' + (date === 0 ? 31 : date) + '</strong>' + icon(items.length ? levels[items[0].level - 1][0] : 'minus') + '</button>';}).join('') + '</div>' + (visible.length ? [...new Set(visible.map(item => item.date))].map(date => '<h4 class="hgp-journal-day">9月' + date + '日<span class="hgp-count">' + visible.filter(item => item.date === date).length + '件</span></h4>' + recordMarkup(visible.filter(item => item.date === date))).join('') : '<p class="hgp-empty">この日の記録はありません</p>');
	}

	listen(root, signal, 'click', event => {const button = event.target.closest('button'); if (!button || !root.contains(button)) return; if (button.hasAttribute('data-hgp-level')) {level = Number(button.dataset.hgpLevel); root.querySelectorAll('[data-hgp-level]').forEach(node => node.setAttribute('aria-pressed', String(Number(node.dataset.hgpLevel) === level))); feedback(root, '「' + levels[level - 1][1] + '」を選んだ例だよ。下の履歴は変えず、記録もしていない'); return;} if (button.hasAttribute('data-hgp-journal-view')) {view = button.dataset.hgpJournalView; day = view === 'today' ? 5 : null;} else if (button.hasAttribute('data-hgp-journal-day')) {day = Number(button.dataset.hgpJournalDay); view = day === 5 ? 'today' : 'history';} else return; render(); if (button.hasAttribute('data-hgp-journal-day') && event.detail === 0)root.querySelector('[data-hgp-journal-day="' + day + '"]')?.focus({ preventScroll: true }); feedback(root, view === 'review' ? 'この図の架空4記録から、平均と時間帯ごとの傾向を計算しているよ' : view === 'today' ? '今日の架空記録を表示したよ' : '架空の過去の記録を表示したよ');});
	render();
}

/** Each guide illustration owns its fixtures and its delegated listeners. */
export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hgp-kind]') ? [scene] : Array.from(scene.querySelectorAll('[data-hgp-kind]'));
	const mounted = [];
	const controller = new scene.ownerDocument.defaultView.AbortController();
	for (const root of roots) {
		if (root.dataset.hgpReady) continue;
		const initialize = { todo: initTodo, calendar: initCalendar, mood: initMood }[root.dataset.hgpKind];
		if (!initialize) continue;
		root.dataset.hgpReady = 'true';
		mounted.push(root);
		initialize(root, controller.signal);
	}
	return () => {
		controller.abort();
		for (const root of mounted) delete root.dataset.hgpReady;
	};
}
