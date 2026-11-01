/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init as initCollection, templates as collectionTemplates } from './collection-scenes.js';
import { init as initChannels, templates as channelTemplates } from './channel-scenes.js';

type SceneModule = { templates: Record<string, string>; init: (scene: HTMLElement) => () => void };
const collection: SceneModule = { templates: collectionTemplates, init: initCollection };
const channels: SceneModule = { templates: channelTemplates, init: initChannels };
const mounted: { root: HTMLElement; cleanup: () => void }[] = [];
const attempts: string[] = [];
const storageDescriptors: { name: 'localStorage' | 'sessionStorage'; descriptor?: PropertyDescriptor }[] = [];

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
	// Positive controls prove the guards work without making a real request or storage write.
	for (const [kind, probe] of probes) expect(probe, kind).toThrow(`blocked ${kind}`);
	expect(attempts).toEqual(probes.map(([kind]) => kind));
	attempts.splice(0);
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

function submit(root: ParentNode, selector: string): void {
	get(root, selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function jump(root: ParentNode, page: string): void { click(root, `[data-hgcoll-jump="${page}"]`); }

function field(root: ParentNode, key: string, value: string): void { input(root, `[data-hgcoll-field="${key}"]`, value); }

function save(root: ParentNode): void { submit(root, '[data-hgcoll-form]'); }

function tab(root: ParentNode, name: string): void { click(root, `[data-hgc-tab="${name}"]`); }

function assertScopedIds(roots: HTMLElement[]): void {
	const ids = roots.flatMap(root => [...root.querySelectorAll('[id]')].map(element => element.id));
	expect(new Set(ids).size).toBe(ids.length);
	for (const root of roots) {
		const ownIds = new Set([...root.querySelectorAll('[id]')].map(element => element.id));
		for (const element of root.querySelectorAll('[for], [aria-controls], [aria-labelledby], [aria-describedby]')) {
			for (const attribute of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
				for (const id of element.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? []) expect(ownIds.has(id)).toBe(true);
			}
		}
	}
}

describe('HataIntro: アンテナ', () => {
	test('保存前は未作成、保存後は管理一覧と読み取り専用ノートを表示する', () => {
		const { root } = mountScene(collection, 'hg-collection-scene');
		expect(get<HTMLInputElement>(root, '[data-hgcoll-field="name"]').value).toBe('本の話');
		expect(root.querySelectorAll('[data-hgcoll-field][type="checkbox"]')).toHaveLength(6);
		expect(root.querySelectorAll('[data-hgcoll-source]')).toHaveLength(4);
		jump(root, 'timeline');
		expect(root.querySelector('.hgcoll-pill')).toBeNull();
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(0);
		click(root, '[data-hgcoll-action="picker"]');
		expect(get(root, '[data-hgcoll-action="picker"]').getAttribute('aria-expanded')).toBe('true');
		click(root, '[data-hgcoll-action="manage"]');
		expect(root.querySelectorAll('[data-hgcoll-edit-entry]')).toHaveLength(0);
		jump(root, 'create'); save(root);
		expect(root.querySelectorAll('[data-hgcoll-edit-entry]')).toHaveLength(1);
		jump(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(2);
		expect(root.querySelectorAll('.hgn-note-action[role="img"]')).toHaveLength(10);
		expect(root.querySelectorAll('.hgn-note button')).toHaveLength(0);
		expect(get(root, '.hgcoll-notes').textContent).toContain('@aoi@example.invalid');
		const picker = get(root, '[data-hgcoll-action="picker"]');
		expect(picker.getAttribute('aria-controls')).toBe(get(root, '[data-hgcoll-picker]').id);
		click(root, '[data-hgcoll-action="picker"]');
		click(root, '[data-hgcoll-select-entry="1"]');
		expect(get<HTMLElement>(root, '[data-hgcoll-picker]').hidden).toBe(true);
		expect(get(root, '[data-hgcoll-action="picker"]').getAttribute('aria-expanded')).toBe('false');
		expect(window.document.activeElement).toBe(get(root, '[data-hgcoll-action="picker"]'));
	});

	test('AND・OR・除外・ユーザー条件を入力例へ適用し、選択ダイアログから戻れる', () => {
		const { root } = mountScene(collection, 'hg-collection-scene');
		field(root, 'keywords', '読書 散歩'); save(root); jump(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(1);
		expect(get(root, '.hgcoll-notes').textContent).toContain('こはる');
		click(root, '[data-hgcoll-action="edit-current"]');
		field(root, 'keywords', '読書\n映画'); save(root); jump(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(3);
		click(root, '[data-hgcoll-action="edit-current"]');
		field(root, 'excludeKeywords', '映画'); save(root); jump(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(2);
		click(root, '[data-hgcoll-action="edit-current"]');
		get<HTMLDetailsElement>(root, '[data-hgcoll-source-select]').open = true;
		click(root, '[data-hgcoll-source="users"]');
		click(root, '[data-hgcoll-action="add-user"]');
		expect(get<HTMLDialogElement>(root, '[data-hgcoll-user-dialog]').open).toBe(true);
		input(root, '[data-hgcoll-user-query]', 'no-such-example');
		expect(get<HTMLElement>(root, '[data-hgcoll-user-choice]').hidden).toBe(true);
		input(root, '[data-hgcoll-user-query]', 'aoi');
		click(root, '[data-hgcoll-user-choice]');
		click(root, '[data-hgcoll-confirm-user]');
		expect(get<HTMLDialogElement>(root, '[data-hgcoll-user-dialog]').open).toBe(false);
		expect(window.document.activeElement).toBe(get(root, '[data-hgcoll-action="add-user"]'));
		expect(get<HTMLTextAreaElement>(root, '[data-hgcoll-field="users"]').value).toBe('@aoi@example.invalid');
		save(root); jump(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(1);
		expect(get(root, '.hgcoll-notes').textContent).toContain('@aoi@example.invalid');
	});

	test('閲覧中のアンテナを切り替えても編集中の保存・削除対象を取り違えない', () => {
		const { root } = mountScene(collection, 'hg-collection-scene');
		save(root);
		click(root, '[data-hgcoll-action="new"]'); field(root, 'name', 'Bの映画'); field(root, 'keywords', '映画'); save(root);
		click(root, '[data-hgcoll-edit-entry="1"]'); field(root, 'name', 'Aの本・更新');
		jump(root, 'timeline'); click(root, '[data-hgcoll-action="picker"]'); click(root, '[data-hgcoll-select-entry="2"]');
		jump(root, 'create');
		expect(get<HTMLInputElement>(root, '[data-hgcoll-field="name"]').value).toBe('Aの本・更新');
		save(root);
		expect(get(root, '[data-hgcoll-edit-entry="1"]').textContent).toBe('Aの本・更新');
		expect(get(root, '[data-hgcoll-edit-entry="2"]').textContent).toBe('Bの映画');
		click(root, '[data-hgcoll-edit-entry="1"]'); jump(root, 'timeline');
		click(root, '[data-hgcoll-action="picker"]'); click(root, '[data-hgcoll-select-entry="2"]'); jump(root, 'create');
		click(root, '[data-hgcoll-action="delete"]'); click(root, '[data-hgcoll-cancel-delete]');
		expect(get<HTMLDialogElement>(root, '[data-hgcoll-delete-dialog]').open).toBe(false);
		click(root, '[data-hgcoll-action="delete"]'); click(root, '[data-hgcoll-confirm-delete]');
		expect(root.querySelector('[data-hgcoll-edit-entry="1"]')).toBeNull();
		expect(get(root, '[data-hgcoll-edit-entry="2"]').textContent).toBe('Bの映画');
		click(root, '[data-hgcoll-edit-entry="2"]'); click(root, '[data-hgcoll-action="delete"]'); click(root, '[data-hgcoll-confirm-delete]');
		jump(root, 'timeline');
		expect(root.querySelectorAll('.hgcoll-pill, .hgcoll-notes .hgn-note')).toHaveLength(0);
	});

	test('2窓の入力・保存・ID参照を分離し、重複ID検出にも陽性対照を入れる', () => {
		const first = mountScene(collection, 'hg-collection-scene', 'vue:test-a').root;
		const second = mountScene(collection, 'hg-collection-scene', 'vue:test-b').root;
		assertScopedIds([first, second]);
		const duplicate = get(second, '[id]');
		const originalId = duplicate.id;
		duplicate.id = get(first, '[id]').id;
		expect(() => assertScopedIds([first, second])).toThrow();
		duplicate.id = originalId;
		assertScopedIds([first, second]);
		field(first, 'name', '1番目だけの例'); save(first); jump(first, 'timeline');
		expect(get<HTMLInputElement>(second, '[data-hgcoll-field="name"]').value).toBe('本の話');
		jump(second, 'timeline');
		expect(second.querySelector('.hgcoll-pill')).toBeNull();
		assertScopedIds([first, second]);
		click(first, '[data-hgcoll-action="edit-current"]');
		click(first, '[data-hgcoll-source="list"]');
		assertScopedIds([first, second]);
		click(first, '[data-hgcoll-source="users"]');
		assertScopedIds([first, second]);
	});

	test('入力値をHTMLにせず保持し、cleanup はダイアログと全イベントを停止する', () => {
		const item = mountScene(collection, 'hg-collection-scene');
		const hostile = '<img src=x onerror="bad()">';
		field(item.root, 'name', hostile); save(item.root);
		expect(get(item.root, '[data-hgcoll-edit-entry="1"]').textContent).toBe(hostile);
		expect(item.root.querySelector('img')).toBeNull();
		click(item.root, '[data-hgcoll-edit-entry="1"]');
		click(item.root, '[data-hgcoll-source="users"]');
		click(item.root, '[data-hgcoll-action="add-user"]');
		const dialog = get<HTMLDialogElement>(item.root, '[data-hgcoll-user-dialog]');
		expect(dialog.open).toBe(true);
		item.cleanup();
		expect(dialog.open).toBe(false);
		const before = get(item.root, '[data-hgcoll-frame]').innerHTML;
		save(item.root); jump(item.root, 'manage'); click(item.root, '[data-hgcoll-action="add-user"]');
		expect(get(item.root, '[data-hgcoll-frame]').innerHTML).toBe(before);
		expect(dialog.open).toBe(false);
		item.cleanup = initCollection(item.root);
		assertScopedIds([item.root]);
		expect(get<HTMLInputElement>(item.root, '[data-hgcoll-field="name"]').value).toBe('本の話');
		save(item.root);
		expect(item.root.querySelectorAll('[data-hgcoll-edit-entry]')).toHaveLength(1);
	});
});

describe('HataIntro: チャンネル', () => {
	test('一覧の5タブと検索範囲を保ち、検索結果から概要・投稿・ハイライトを読める', () => {
		const { root } = mountScene(channels, 'hg-channel-scene');
		expect([...root.querySelectorAll('[data-hgc-tab]')].map(button => button.textContent)).toEqual(['検索', 'トレンド', 'お気に入り', 'フォロー中', '管理中']);
		expect(get(root, '[data-hgc-tab][aria-pressed="true"]').dataset.hgcTab).toBe('following');
		expect(get(root, '[data-hgc-open]').dataset.hgcOpen).toBe('daily');
		tab(root, 'search'); input(root, '[data-hgc-query]', '本');
		expect(root.querySelectorAll('.hgc-card')).toHaveLength(0);
		get<HTMLInputElement>(root, '[data-hgc-query]').focus(); submit(root, '[data-hgc-search-form]');
		expect(root.querySelectorAll('.hgc-card')).toHaveLength(2);
		expect(window.document.activeElement).toBe(get(root, '[data-hgc-query]'));
		const type = get<HTMLInputElement>(root, '[data-hgc-type][value="nameOnly"]');
		type.checked = true; type.dispatchEvent(new Event('change', { bubbles: true }));
		expect([...root.querySelectorAll<HTMLElement>('[data-hgc-open]')].map(button => button.dataset.hgcOpen)).toEqual(['books']);
		click(root, '[data-hgc-open="books"]');
		expect([...root.querySelectorAll('[data-hgc-tab]')].map(button => button.textContent)).toEqual(['概要', 'タイムライン', 'ハイライト', '検索']);
		expect(get(root, '.hgc-description').textContent).toContain('CW');
		expect(get(root, '.hgc-pinned .hgn-note')).toBeTruthy();
		expect(window.document.activeElement).toBe(get(root, '[data-hgc-tab="overview"]'));
		tab(root, 'timeline');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(2);
		expect(root.querySelectorAll('.hgn-note-action[role="img"]')).toHaveLength(10);
		expect(root.querySelectorAll('.hgn-note button')).toHaveLength(0);
		tab(root, 'featured'); expect(root.querySelectorAll('.hgn-note')).toHaveLength(1);
		tab(root, 'search'); input(root, '[data-hgc-query]', '図書館'); submit(root, '[data-hgc-search-form]');
		expect(root.querySelectorAll('.hgn-note')).toHaveLength(1);
		expect(get(root, '.hgn-note').textContent).toContain('図書館');
		expect(root.querySelector('[data-hgc-type]')).toBeNull();
		click(root, '[data-hgc-back]');
		expect(get<HTMLInputElement>(root, '[data-hgc-query]').value).toBe('本');
		expect(get<HTMLInputElement>(root, '[data-hgc-type][value="nameOnly"]').checked).toBe(true);
		expect(window.document.activeElement).toBe(get(root, '[data-hgc-open="books"]'));
	});

	test('フォローとお気に入りはその図だけで変わり、別窓のラジオも混ざらない', () => {
		const first = mountScene(channels, 'hg-channel-scene', 'channel-a').root;
		const second = mountScene(channels, 'hg-channel-scene', 'channel-b').root;
		tab(first, 'search'); tab(second, 'search');
		expect(get<HTMLInputElement>(first, '[data-hgc-type]').name).not.toBe(get<HTMLInputElement>(second, '[data-hgc-type]').name);
		const radio = get<HTMLInputElement>(first, '[data-hgc-type][value="nameOnly"]');
		radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
		expect(get<HTMLInputElement>(second, '[data-hgc-type][value="nameAndDescription"]').checked).toBe(true);
		tab(first, 'featured'); click(first, '[data-hgc-open="books"]');
		click(first, '[data-hgc-follow]'); click(first, '[data-hgc-favorite]');
		click(first, '[data-hgc-back]'); tab(first, 'following');
		expect(first.querySelectorAll('.hgc-card')).toHaveLength(2);
		tab(second, 'following'); expect(second.querySelectorAll('.hgc-card')).toHaveLength(1);
		tab(second, 'favorites'); expect(get(second, '.hgc-empty').textContent).toContain('ありません');
		tab(first, 'favorites'); click(first, '[data-hgc-open="books"]'); click(first, '[data-hgc-favorite]'); click(first, '[data-hgc-back]');
		expect(first.querySelectorAll('.hgc-card')).toHaveLength(0);
		expect(window.document.activeElement).toBe(get(first, '[data-hgc-tab="favorites"]'));
	});

	test('説明だけの操作では外部へ進まず、検索入力をクリアしても直前の結果を残す', () => {
		const { root } = mountScene(channels, 'hg-channel-scene');
		for (const name of ['create', 'join', 'account', 'back']) {
			click(root, `[data-hgc-info="${name}"]`);
			expect(get(root, '[data-hgc-feedback]').textContent?.length).toBeGreaterThan(20);
		}
		tab(root, 'featured'); click(root, '[data-hgc-open="books"]');
		click(root, '[data-hgc-info="copy"]');
		expect(get(root, '[data-hgc-feedback]').textContent).toContain('コピーは行わない');
		click(root, '[data-hgc-info="post"]');
		expect(get(root, '[data-hgc-feedback]').textContent).toContain('投稿は送信しない');
		click(root, '[data-hgc-back]'); tab(root, 'search'); input(root, '[data-hgc-query]', '本'); submit(root, '[data-hgc-search-form]');
		click(root, '[data-hgc-clear]');
		expect(get<HTMLInputElement>(root, '[data-hgc-query]').value).toBe('');
		expect(root.querySelectorAll('.hgc-card')).toHaveLength(2);
		expect(window.document.activeElement).toBe(get(root, '[data-hgc-query]'));
		const hostile = '<img src=x onerror="bad()">';
		input(root, '[data-hgc-query]', hostile); submit(root, '[data-hgc-search-form]');
		tab(root, 'following'); tab(root, 'search');
		expect(get<HTMLInputElement>(root, '[data-hgc-query]').value).toBe(hostile);
		expect(root.querySelector('img')).toBeNull();
		expect(get(root, '.hgc-empty').textContent).toContain('ありません');
	});

	test('タブバーは横スクロールし、再描画・cleanup 後は古いバーへ反応しない', () => {
		const item = mountScene(channels, 'hg-channel-scene');
		const nav = get<HTMLElement>(item.root, '.hgc-tabs');
		Object.defineProperties(nav, { scrollWidth: { configurable: true, value: 1000 }, clientWidth: { configurable: true, value: 300 } });
		nav.scrollLeft = 100;
		const scroll = () => nav.dispatchEvent(new WheelEvent('wheel', { deltaY: 25, bubbles: true, cancelable: true }));
		scroll(); expect(nav.scrollLeft).toBe(125);
		tab(item.root, 'search');
		scroll(); expect(nav.scrollLeft).toBe(125);
		const current = get<HTMLElement>(item.root, '.hgc-tabs');
		Object.defineProperties(current, { scrollWidth: { configurable: true, value: 1000 }, clientWidth: { configurable: true, value: 300 } });
		current.scrollLeft = 50;
		item.cleanup();
		current.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));
		expect(current.scrollLeft).toBe(50);
		const body = get(item.root, '[data-hgc-frame]').innerHTML;
		tab(item.root, 'featured'); submit(item.root, '[data-hgc-search-form]');
		expect(get(item.root, '[data-hgc-frame]').innerHTML).toBe(body);
	});

	test('ドラッグ後のクリックを抑え、cleanup は保有中の pointer capture を解放する', () => {
		const item = mountScene(channels, 'hg-channel-scene');
		const nav = get<HTMLElement>(item.root, '.hgc-tabs');
		const captured = new Set<number>();
		const release = vi.fn((id: number) => { captured.delete(id); });
		Object.defineProperties(nav, {
			scrollWidth: { configurable: true, value: 1000 },
			clientWidth: { configurable: true, value: 300 },
			setPointerCapture: { configurable: true, value: (id: number) => captured.add(id) },
			hasPointerCapture: { configurable: true, value: (id: number) => captured.has(id) },
			releasePointerCapture: { configurable: true, value: release },
		});
		const pointer = (type: string, clientX: number, buttons = 1) => nav.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, buttons, clientX, bubbles: true }));
		nav.scrollLeft = 100;
		pointer('pointerdown', 100); pointer('pointermove', 125); pointer('pointerup', 125, 0);
		expect(nav.scrollLeft).toBe(75);
		expect(release).toHaveBeenCalledWith(7);
		get(item.root, '[data-hgc-tab="search"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		expect(get(item.root, '[data-hgc-tab][aria-pressed="true"]').dataset.hgcTab).toBe('following');
		pointer('pointerdown', 100); pointer('pointermove', 130);
		expect(captured.has(7)).toBe(true);
		item.cleanup();
		expect(captured.has(7)).toBe(false);
		expect(release).toHaveBeenCalledTimes(2);
		const left = nav.scrollLeft;
		pointer('pointerdown', 100); pointer('pointermove', 150);
		expect(nav.scrollLeft).toBe(left);
	});
});
