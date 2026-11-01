/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init as initNotes, note, templates as noteTemplates } from './note-scenes.js';
import { init as initPlanner, templates as plannerTemplates } from './planner-scenes.js';

type SceneModule = { templates: Record<string, string>; init: (scene: HTMLElement) => () => void };
const notes: SceneModule = { templates: noteTemplates, init: initNotes };
const planner: SceneModule = { templates: plannerTemplates, init: initPlanner };
const mounted: { root: HTMLElement; cleanup: () => void }[] = [];
const attempts: string[] = [];
const storageDescriptors: { name: 'localStorage' | 'sessionStorage'; descriptor?: PropertyDescriptor }[] = [];
let originalScrollIntoView: PropertyDescriptor | undefined;

function deny(kind: string): (...args: unknown[]) => never {
	return () => { attempts.push(kind); throw new Error(`blocked ${kind}`); };
}

beforeEach(() => {
	attempts.splice(0);
	vi.stubGlobal('fetch', vi.fn(deny('fetch')));
	vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(deny('xhr'));
	vi.spyOn(window, 'open').mockImplementation(deny('window.open'));
	vi.spyOn(navigator, 'sendBeacon').mockImplementation(deny('beacon'));
	vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(deny('clipboard'));
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket')(); } });
	vi.stubGlobal('indexedDB', { open: vi.fn(deny('indexedDB')) });
	const probes: Array<[string, () => unknown]> = [
		['fetch', () => window.fetch('/hata-intro-positive-control')],
		['xhr', () => new XMLHttpRequest().open('GET', '/hata-intro-positive-control')],
		['window.open', () => window.open('/hata-intro-positive-control')],
		['beacon', () => navigator.sendBeacon('/hata-intro-positive-control')],
		['clipboard', () => navigator.clipboard.writeText('hata-intro-positive-control')],
		['websocket', () => new WebSocket('wss://example.invalid')],
		['indexedDB', () => indexedDB.open('hata-intro-positive-control')],
	];
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		// Happy DOM's Storage Proxy silently ignores assignments to existing methods.
		// Install ordinary guard objects on both realms instead of spying on that Proxy.
		storageDescriptors.push({ name, descriptor: Object.getOwnPropertyDescriptor(window, name) });
		const guardedStorage: Storage = {
			get length() { return deny(`${name}.length`)(); },
			key: deny(`${name}.key`),
			getItem: deny(`${name}.getItem`),
			setItem: deny(`${name}.setItem`),
			removeItem: deny(`${name}.removeItem`),
			clear: deny(`${name}.clear`),
		};
		vi.stubGlobal(name, guardedStorage);
		Object.defineProperty(window, name, { configurable: true, writable: true, value: guardedStorage });
		expect(globalThis[name]).toBe(guardedStorage);
		expect(window[name]).toBe(guardedStorage);
		for (const owner of [globalThis, window]) {
			for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
				probes.push([`${name}.${method}`, () => {
					const storage = owner[name];
					if (method === 'setItem') storage.setItem('hata-intro-positive-control', 'example');
					else if (method === 'clear') storage.clear();
					else if (method === 'key') storage.key(0);
					else storage[method]('hata-intro-positive-control');
				}]);
			}
			probes.push([`${name}.length`, () => owner[name].length]);
		}
	}
	// Positive controls run before every scene: these calls are intercepted, never sent or saved.
	for (const [kind, probe] of probes) expect(probe, kind).toThrow(`blocked ${kind}`);
	expect(attempts).toEqual(probes.map(([kind]) => kind));
	attempts.splice(0);
	originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});

afterEach(() => {
	try {
		for (const item of mounted.splice(0)) { item.cleanup(); item.root.remove(); }
		expect(attempts).toEqual([]);
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		for (const { name, descriptor } of storageDescriptors.splice(0)) {
			if (descriptor) Object.defineProperty(window, name, descriptor);
			else Reflect.deleteProperty(window, name);
		}
		if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
		else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
	}
});

function mountScene(module: SceneModule, template: string, instance = 'test-scene') {
	const root = window.document.createElement('figure');
	root.dataset.scene = template;
	root.dataset.hataIntroInstance = instance;
	root.innerHTML = module.templates[template];
	window.document.body.append(root);
	const item = { root, cleanup: module.init(root) };
	mounted.push(item);
	return item;
}

function get<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing scene element: ${selector}`);
	return element;
}

function click(root: ParentNode, selector: string): void { get<HTMLElement>(root, selector).click(); }

function input(root: ParentNode, selector: string, value: string): void {
	const field = get<HTMLInputElement | HTMLTextAreaElement>(root, selector);
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('HataIntro: タイムライン・ノート・リアクション', () => {
	test('上部タブの名前・入口を保ち、別の図のタイムラインを変更しない', () => {
		const { root } = mountScene(notes, 'hg-timeline-scene', 'timeline-a');
		const other = mountScene(notes, 'hg-timeline-scene', 'timeline-b').root;
		expect(get(root, '[data-hgn-navbar] [aria-pressed="true"]').textContent).toBe('ホーム');
		expect(root.querySelectorAll('[data-hgn-nav-legend] [data-hgn-timeline]')).toHaveLength(10);
		click(root, '[data-hgn-nav-legend] [data-hgn-timeline="social"]');
		expect(get(root, '[data-hgn-navbar] [aria-pressed="true"]').textContent).toBe('ソーシャル');
		expect(get(other, '[data-hgn-navbar] [aria-pressed="true"]').textContent).toBe('ホーム');
		click(root, '[data-hgn-navbar] [data-hgn-timeline="list"]');
		expect(root.querySelectorAll('[data-hgn-collection]')).toHaveLength(2);
		click(root, '[data-hgn-collection="settings"]');
		expect(get(root, '[data-hgn-meaning]').textContent).toContain('リストの設定');
		click(root, '[data-hgn-navbar] [data-hgn-timeline="channel"]');
		expect(get(root, '[data-hgn-note-slot]').textContent).toContain('チャンネル一覧へ');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(0);
		expect(window.document.activeElement).toBe(get(root, '[data-hgn-navbar] [data-hgn-timeline="channel"]'));
	});

	test('既定の5ボタンと各メニューの説明を保ち、実際には返信・共有・保存しない', () => {
		const { root } = mountScene(notes, 'hg-note-scene');
		expect([...root.querySelectorAll('.hgn-note-action')].map(button => button.getAttribute('aria-label')))
			.toEqual(['返信', 'リノート', 'リアクションする', '引用', 'もっと！']);
		click(root, '.hgn-note-action[data-hgn-action="reply"]');
		expect(get(root, '[data-hgn-meaning]').textContent).toContain('返信を書く投稿フォーム');
		click(root, '.hgn-note-action[data-hgn-action="quote"]');
		expect(get(root, '[data-hgn-meaning]').textContent).toContain('自分のコメント');
		click(root, '.hgn-note-action[data-hgn-action="renote"]');
		expect(root.querySelectorAll('[data-hgn-renote-info]')).toHaveLength(4);
		click(root, '[data-hgn-renote-info="リノート（ホーム）"]');
		expect(get(root, '[data-hgn-meaning]').textContent).toContain('本体へのリノートは行っていない');
		click(root, '.hgn-note-action[data-hgn-action="more"]');
		click(root, '[data-hgn-menu="favorite"]');
		expect(get(root, '[data-hgn-menu="favorite"]').textContent).toContain('お気に入り解除');
		click(root, '[data-hgn-menu="favorite"]');
		expect(get(root, '[data-hgn-menu="favorite"]').textContent).not.toContain('解除');
		for (const action of ['share', 'link', 'copy', 'open', 'clip', 'user', 'report']) {
			click(root, `[data-hgn-menu="${action}"]`);
			expect(get(root, '[data-hgn-meaning]').textContent).toContain('コピー・移動・送信は行わない');
		}
	});

	test('カスタム絵文字の検索・変更・取り消しを図の中だけに反映する', () => {
		const { root } = mountScene(notes, 'hg-reaction-scene', 'reaction-a');
		const other = mountScene(notes, 'hg-reaction-scene', 'reaction-b').root;
		click(root, '[data-hgn-action="reaction"]');
		expect(window.document.activeElement).toBe(get(root, '[data-hgn-search]'));
		click(root, '[data-hgn-picker-tab="custom"]');
		expect(root.querySelectorAll('.hgn-emoji-button')).toHaveLength(6);
		input(root, '[data-hgn-search]', 'ありがとう');
		expect(root.querySelectorAll('.hgn-emoji-button')).toHaveLength(1);
		click(root, '.hgn-emoji-button[data-hgn-choose="thanks"]');
		expect(get(root, '.hgn-chip[data-hgn-choose="thanks"]').getAttribute('aria-pressed')).toBe('true');
		expect(get(root, '[data-hgn-action="reaction"]').getAttribute('aria-label')).toBe('リアクションを編集');
		expect(other.querySelector('.hgn-chip[data-hgn-choose="thanks"]')).toBeNull();
		click(root, '.hgn-chip[data-hgn-choose="agree"]');
		click(root, '[data-hgn-confirm-cancel]');
		expect(get(root, '.hgn-chip[data-hgn-choose="thanks"]').getAttribute('aria-pressed')).toBe('true');
		click(root, '.hgn-chip[data-hgn-choose="agree"]');
		click(root, '[data-hgn-confirm-reaction="agree"]');
		expect(get(root, '.hgn-chip[data-hgn-choose="agree"] span').textContent).toBe('3');
		click(root, '.hgn-chip[data-hgn-choose="agree"]');
		click(root, '[data-hgn-confirm-reaction=""]');
		expect(get(root, '.hgn-chip[data-hgn-choose="agree"] span').textContent).toBe('2');
		expect(get(root, '[data-hgn-action="reaction"]').getAttribute('aria-label')).toBe('リアクションする');
		expect(get(other, '.hgn-chip[data-hgn-choose="agree"] span').textContent).toBe('2');
	});

	test('Unicode・検索タグも選べ、Escape は選択欄を閉じて外側へ伝播しない', () => {
		const { root } = mountScene(notes, 'hg-reaction-scene');
		click(root, '[data-hgn-action="reaction"]');
		click(root, '[data-hgn-picker-tab="unicode"]');
		expect(root.querySelectorAll('.hgn-emoji-button')).toHaveLength(3);
		click(root, '[data-hgn-picker-tab="tags"]');
		click(root, '[data-hgn-search-term="感謝"]');
		expect(get<HTMLInputElement>(root, '[data-hgn-search]').value).toBe('感謝');
		expect(root.querySelectorAll('.hgn-emoji-button')).toHaveLength(1);
		const outside = vi.fn();
		root.addEventListener('keydown', outside);
		get(root, '[data-hgn-search]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		expect(root.querySelector('.hgn-picker')).toBeNull();
		expect(window.document.activeElement).toBe(get(root, '[data-hgn-action="reaction"]'));
		expect(outside).not.toHaveBeenCalled();
		root.removeEventListener('keydown', outside);
	});

	test('表示専用ノートはボタンを持たず、本文・名前・アカウントをエスケープする', () => {
		const root = window.document.createElement('div');
		const text = '<img src=x onerror="bad()">。次の文';
		root.innerHTML = note(text, '', '<script>name</script>', '@<account>');
		expect(get(root, '.hgn-note-text').textContent).toBe(text);
		expect(get(root, '.hgn-note-header strong').textContent).toBe('<script>name</script>');
		expect(get(root, '.hgn-note-header small').textContent).toBe('@<account>');
		expect(root.querySelectorAll('button, script, img, .hgn-note-text br')).toHaveLength(0);
		expect(root.querySelectorAll('.hgn-note-action[role="img"]')).toHaveLength(5);
	});

	test('cleanup 後はクリック・入力に反応せず、再初期化で重複なく操作できる', () => {
		const item = mountScene(notes, 'hg-reaction-scene');
		click(item.root, '[data-hgn-action="reaction"]');
		click(item.root, '[data-hgn-picker-tab="custom"]');
		item.cleanup();
		const before = item.root.innerHTML;
		input(item.root, '[data-hgn-search]', 'ありがとう');
		click(item.root, '[data-hgn-close]');
		expect(item.root.innerHTML).toBe(before);
		item.cleanup = initNotes(item.root);
		click(item.root, '[data-hgn-action="reaction"]');
		click(item.root, '.hgn-chip[data-hgn-choose="agree"]');
		expect(get(item.root, '.hgn-chip[data-hgn-choose="agree"] span').textContent).toBe('3');
		expect(item.root.querySelector('[data-hgn-confirm-reaction]')).toBeNull();
	});
});

describe('HataIntro: ToDo・カレンダー・きもち', () => {
	test('ToDo の分類・検索・完了を切り替え、もう一方の図と元データを変えない', () => {
		const { root } = mountScene(planner, 'hg-todo-scene', 'todo-a');
		const other = mountScene(planner, 'hg-todo-scene', 'todo-b').root;
		expect(root.querySelectorAll('.hgp-task')).toHaveLength(3);
		const checkbox = get<HTMLInputElement>(root, '[data-hgp-done="book"]');
		checkbox.focus(); checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
		expect(root.querySelectorAll('.hgp-task')).toHaveLength(2);
		expect(window.document.activeElement).toBe(get(root, '[data-hgp-view="all"]'));
		expect(other.querySelectorAll('.hgp-task')).toHaveLength(3);
		click(root, '[data-hgp-view="completed"]');
		expect(root.querySelectorAll('.hgp-task')).toHaveLength(2);
		click(root, '[data-hgp-view="upcoming"]');
		expect(get(root, '.hgp-task-title').textContent).toBe('週末の映画を予約する');
		input(root, '[data-hgp-search]', '見つからない');
		expect(get(root, '.hgp-empty').textContent).toContain('一致するタスクはありません');
		input(root, '[data-hgp-search]', '映画');
		expect(root.querySelectorAll('.hgp-task')).toHaveLength(1);
		expect(get(root, '[data-hgp-feedback]').textContent).toContain('架空タスク');
	});

	test('カレンダーの日付・公開範囲・一覧・今日を切り替えても予定を変更しない', () => {
		const { root } = mountScene(planner, 'hg-calendar-scene', 'calendar-a');
		const other = mountScene(planner, 'hg-calendar-scene', 'calendar-b').root;
		expect(root.querySelectorAll('[data-hgp-day]')).toHaveLength(42);
		expect(root.querySelectorAll('[data-hgp-day-detail] .hgp-event-row')).toHaveLength(2);
		click(root, '[data-hgp-day="12"]');
		expect(get(root, '[data-hgp-day-detail]').textContent).toContain('読書会');
		click(root, '[data-hgp-filter="public"]');
		expect(get(root, '[data-hgp-day-detail]').textContent).toContain('表示する予定はありません');
		click(root, '[data-hgp-calendar-view="agenda"]');
		expect(get<HTMLElement>(root, '[data-hgp-agenda]').hidden).toBe(false);
		expect(root.querySelectorAll('[data-hgp-agenda] .hgp-event-row')).toHaveLength(3);
		click(root, '[data-hgp-calendar-today]');
		expect(get<HTMLElement>(root, '[data-hgp-month]').hidden).toBe(false);
		expect(get(root, '[data-hgp-day="5"]').getAttribute('aria-pressed')).toBe('true');
		expect(root.querySelectorAll('[data-hgp-day-detail] .hgp-event-row')).toHaveLength(2);
		expect(get(other, '[data-hgp-filter="public"]').getAttribute('aria-pressed')).toBe('true');
	});

	test('きもちの選択・入力は履歴へ保存せず、架空4記録の振り返りを表示する', () => {
		const { root } = mountScene(planner, 'hg-mood-scene', 'mood-a');
		const other = mountScene(planner, 'hg-mood-scene', 'mood-b').root;
		expect(root.querySelectorAll('.hgp-record')).toHaveLength(2);
		input(root, '.hgp-mood-input', '入力しても保存しない例');
		click(root, '[data-hgp-level="5"]');
		expect(get(root, '[data-hgp-level="5"]').getAttribute('aria-pressed')).toBe('true');
		expect(get(other, '[data-hgp-level="4"]').getAttribute('aria-pressed')).toBe('true');
		click(root, '[data-hgp-journal-view="history"]');
		expect(root.querySelectorAll('.hgp-record')).toHaveLength(4);
		expect(get(root, '[data-hgp-journal-panel]').textContent).not.toContain('入力しても保存しない例');
		click(root, '[data-hgp-journal-view="review"]');
		expect(get(root, '.hgp-review-score').textContent).toContain('3.0');
		// This Happy DOM version clamps meter.value/max getters to 1 regardless of max="5".
		// Assert the emitted values and range, together with the visible numeric labels.
		expect([...root.querySelectorAll('meter')].map(meter => ({
			value: meter.getAttribute('value'), min: meter.getAttribute('min'), max: meter.getAttribute('max'),
		}))).toEqual([{ value: '2.5', min: '1', max: '5' }, { value: '3.5', min: '1', max: '5' }]);
		expect([...root.querySelectorAll('.hgp-meter-row strong')].map(label => label.textContent)).toEqual(['2.5', '3.5']);
		click(root, '[data-hgp-journal-view="today"]');
		click(root, '[data-hgp-journal-day="4"]');
		expect(root.querySelectorAll('.hgp-record')).toHaveLength(1);
		expect(get(root, '.hgp-record').textContent).toContain('気になっていた本を読めた');
	});

	test.each([
		['hg-todo-scene', '[data-hgp-view="completed"]'],
		['hg-calendar-scene', '[data-hgp-day="12"]'],
		['hg-mood-scene', '[data-hgp-journal-view="history"]'],
	])('%s の cleanup 後は操作で再描画しない', (template, selector) => {
		const item = mountScene(planner, template);
		// Positive control: the same event changes a mounted diagram first.
		const initial = item.root.innerHTML;
		click(item.root, selector);
		expect(item.root.innerHTML).not.toBe(initial);
		item.cleanup();
		const stopped = item.root.innerHTML;
		const controls = item.root.querySelectorAll<HTMLButtonElement>('button');
		for (const control of controls) control.click();
		expect(item.root.innerHTML).toBe(stopped);
	});
});
