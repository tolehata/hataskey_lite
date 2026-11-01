/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init as initFeed, templates as feedTemplates } from './feed-scenes.js';
import { init as initStudio, templates as studioTemplates } from './studio-scenes.js';

type Mounted = { scene: HTMLElement; cleanup: () => void };
const mounted: Mounted[] = [];
const restorers: (() => void)[] = [];
const effects: string[] = [];
const animationCancel = vi.fn();
let hit: Element | null = null;
let captured = new WeakMap<Element, Set<number>>();

function property(target: object, key: string, value: unknown) {
	const previous = Object.getOwnPropertyDescriptor(target, key);
	Object.defineProperty(target, key, { configurable: true, writable: true, value });
	restorers.push(() => {
		if (previous) Object.defineProperty(target, key, previous);
		else Reflect.deleteProperty(target, key);
	});
}

function deny(kind: string): never { effects.push(kind); throw new Error(`Guide attempted ${kind}`); }

function noEffects() { expect(effects).toEqual([]); }

beforeEach(() => {
	effects.length = 0;
	animationCancel.mockClear();
	captured = new WeakMap();
	hit = null;
	vi.stubGlobal('fetch', vi.fn(() => deny('fetch')));
	vi.stubGlobal('XMLHttpRequest', class { constructor() { deny('xhr'); } });
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket'); } });
	vi.spyOn(window, 'open').mockImplementation(() => deny('window.open'));
	// HappyDOM Storage is a Proxy whose method-assignment trap can silently
	// discard vi.spyOn replacements. Replace the exposed storage object itself.
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		const storage: Storage = {
			length: 0,
			key: () => null,
			getItem: () => null,
			setItem: () => deny(`${name}.setItem`),
			removeItem: () => deny(`${name}.removeItem`),
			clear: () => deny(`${name}.clear`),
		};
		vi.stubGlobal(name, storage);
	}
	property(navigator, 'sendBeacon', () => deny('beacon'));
	// These platform doubles exercise DOM transitions and cleanup only. They do
	// not prove physical dragging, animation rendering, or responsive geometry.
	property(Element.prototype, 'scrollIntoView', vi.fn());
	property(Element.prototype, 'getAnimations', () => [{ cancel: animationCancel }]);
	property(Element.prototype, 'setPointerCapture', function (this: Element, id: number) {
		const ids = captured.get(this) ?? new Set<number>(); ids.add(id); captured.set(this, ids);
	});
	property(Element.prototype, 'hasPointerCapture', function (this: Element, id: number) { return captured.get(this)?.has(id) ?? false; });
	property(Element.prototype, 'releasePointerCapture', function (this: Element, id: number) { captured.get(this)?.delete(id); });
	property(window.document, 'elementFromPoint', () => hit);
});

afterEach(() => {
	try {
		for (const item of mounted.splice(0)) { item.cleanup(); item.scene.remove(); }
		noEffects();
	} finally {
		for (const restore of restorers.splice(0).reverse()) restore();
		vi.restoreAllMocks(); vi.unstubAllGlobals();
	}
});

function mount(kind: 'feed' | 'studio', instance = 'guide-test') {
	const scene = window.document.createElement('figure');
	scene.dataset.scene = kind; scene.dataset.hataIntroInstance = instance;
	scene.innerHTML = kind === 'feed' ? feedTemplates['hg-feed-scene'] : studioTemplates['hg-studio-scene'];
	window.document.body.append(scene);
	const cleanup = (kind === 'feed' ? initFeed : initStudio)(scene);
	const item = { scene, cleanup }; mounted.push(item); return item;
}

function get<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const result = root.querySelector<T>(selector);
	if (!result) throw new Error(`Missing scene element: ${selector}`);
	return result;
}

function click(root: ParentNode, selector: string) { get<HTMLElement>(root, selector).click(); }

function input(root: ParentNode, selector: string, value: string, type = 'input') {
	const element = get<HTMLInputElement>(root, selector); element.value = value; element.dispatchEvent(new Event(type, { bubbles: true }));
}

function toggle(root: ParentNode, selector: string, checked: boolean) {
	const element = get<HTMLInputElement>(root, selector); element.checked = checked; element.dispatchEvent(new Event('change', { bubbles: true }));
}

function pointer(element: Element, type: string, values: PointerEventInit = {}) {
	element.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, buttons: 1, bubbles: true, cancelable: true, ...values }));
}

function feed(root: ParentNode, action: string, suffix = '') { click(root, `[data-hf-action="${action}"]${suffix}`); }

function studio(root: ParentNode, action: string, value?: string) { click(root, `[data-hgs4-action="${action}"]${value === undefined ? '' : `[data-hgs4-value="${value}"]`}`); }

function rowIds(root: ParentNode) { return [...root.querySelectorAll<HTMLElement>('[data-hf-list] [data-id]')].map(item => Number(item.dataset.id)); }

function topOrder(root: ParentNode) { return [...get(root, '.hgs4-nodes').children].map(item => (item as HTMLElement).dataset.hgs4Node); }

describe('HataIntro Feed and Studio effect guards', () => {
	test('positive controls detect transport, navigation, and storage writes before claiming none', () => {
		const attempts: [string, () => unknown][] = [
			['fetch', () => window.fetch('https://guide.example.invalid/positive-control')],
			['xhr', () => new XMLHttpRequest()],
			['websocket', () => new WebSocket('wss://guide.example.invalid/positive-control')],
			['window.open', () => window.open('https://guide.example.invalid/positive-control')],
			['beacon', () => navigator.sendBeacon('/positive-control')],
			['localStorage.setItem', () => localStorage.setItem('guide-positive', '1')],
			['localStorage.removeItem', () => localStorage.removeItem('guide-positive')],
			['localStorage.clear', () => localStorage.clear()],
			['sessionStorage.setItem', () => sessionStorage.setItem('guide-positive', '1')],
			['sessionStorage.removeItem', () => sessionStorage.removeItem('guide-positive')],
			['sessionStorage.clear', () => sessionStorage.clear()],
		];
		for (const [kind, attempt] of attempts) {
			expect(attempt, kind).toThrow(`Guide attempted ${kind}`);
			expect(effects, kind).toEqual([kind]);
			expect(noEffects).toThrow();
			effects.length = 0;
		}
	});
	test('unrelated scenes have no matching side effects and provide safe cleanup', () => {
		const scene = window.document.createElement('figure');
		expect(() => { initFeed(scene)(); initStudio(scene)(); }).not.toThrow();
	});
});

describe('HataIntro HataFeed teaching scene', () => {
	test('renders the original list, mobile overview, side cards, and fictional content notices', () => {
		const { scene } = mount('feed');
		expect(rowIds(scene)).toEqual([84, 83, 82, 81, 78]);
		expect(get(scene, '[data-hf-count]').textContent).toContain('5 件');
		expect(scene.querySelectorAll('.hgf4-mobile-emoji')).toHaveLength(1);
		expect(scene.querySelectorAll('.hgf4-side-card')).toHaveLength(3);
		expect(scene.textContent).toContain('すべて架空');
		expect(scene.querySelectorAll('.hgf4-tabs [data-hf-action="tab"]')).toHaveLength(2);
	});
	test('searches list and conversations and shows an actionable empty state', () => {
		const { scene } = mount('feed');
		input(scene, '[data-hf-search]', '入力を保持する場面'); expect(rowIds(scene)).toEqual([84]);
		input(scene, '[data-hf-search]', '見つからない固有の語句'); expect(rowIds(scene)).toEqual([]);
		expect(get(scene, '.hgf4-empty').textContent).toContain('検索や絞り込みを解除');
		input(scene, '[data-hf-search]', ''); expect(rowIds(scene)).toHaveLength(5);
	});
	test('combines category and status filters and uses closed-state and status controls distinctly', () => {
		const { scene } = mount('feed');
		feed(scene, 'filter', '[data-field="category"][data-value="bug"]'); expect(rowIds(scene)).toEqual([84]);
		feed(scene, 'filter', '[data-field="status"][data-value="planned"]'); expect(rowIds(scene)).toEqual([]);
		feed(scene, 'filter', '[data-field="category"][data-value=""]'); expect(rowIds(scene)).toEqual([83]);
		feed(scene, 'filter', '[data-field="status"][data-value=""]');
		feed(scene, 'closed', '[data-value="true"]'); expect(rowIds(scene)).toEqual([84, 83, 82, 81, 78, 80]);
		feed(scene, 'stat', '[data-value="resolved"]'); expect(rowIds(scene)).toEqual([80]);
		expect(get(scene, '[data-hf-feedback]').textContent).toContain('現在表示しているページ内');
	});
	test('roadmap opens full issue detail and returns to the same roadmap list', () => {
		const { scene } = mount('feed');
		feed(scene, 'tab', '[data-tab="roadmap"]'); expect(rowIds(scene)).toEqual([85, 79]);
		feed(scene, 'issue', '[data-id="85"]');
		expect(get(scene, '.hgf4-conversation-text').textContent).toContain('実際の開発予定ではありません');
		expect(scene.querySelectorAll('.hgf4-conversation')).toHaveLength(3);
		feed(scene, 'back'); expect(rowIds(scene)).toEqual([85, 79]);
		expect(get(scene, '[data-hf-action="tab"][data-tab="roadmap"]').getAttribute('aria-pressed')).toBe('true');
	});
	test('returning from detail retains search and creator filter', () => {
		const { scene } = mount('feed');
		input(scene, '[data-hf-search]', 'リスト'); feed(scene, 'filter', '[data-field="person"][data-value="sora"]');
		feed(scene, 'issue', '[data-id="83"]'); expect(get(scene, '.hgf4-title').textContent).toContain('リストの並び順');
		feed(scene, 'back'); expect(rowIds(scene)).toEqual([83]);
		expect(get<HTMLInputElement>(scene, '[data-hf-search]').value).toBe('リスト');
		expect(get(scene, '[data-hf-action="filter"][data-field="person"][data-value="sora"]').getAttribute('aria-pressed')).toBe('true');
	});
	test('closed issue details explain why a comment cannot be sent', () => {
		const { scene } = mount('feed'); feed(scene, 'closed', '[data-value="true"]'); feed(scene, 'issue', '[data-id="80"]');
		expect(get(scene, '.hgf4-confirm-note').textContent).toContain('コメントはできません');
		expect(scene.querySelector('.hgf4-composer')).toBeNull();
	});
	test('the three-step wizard retains text, optional code, and priority without submitting', () => {
		const { scene } = mount('feed'); feed(scene, 'new');
		expect(scene.querySelectorAll('[data-hf-action="choose"]')).toHaveLength(6);
		feed(scene, 'choose', '[data-category="bug"]');
		expect(get<HTMLButtonElement>(scene, '[data-hf-action="next"]').disabled).toBe(true);
		input(scene, '[data-hf-draft="title"]', 'テスト用の報告');
		input(scene, '[data-hf-draft="description"]', '操作と期待する結果');
		toggle(scene, '[data-hf-code-toggle]', true); input(scene, '[data-hf-draft="code"]', 'const example = 1;');
		feed(scene, 'next'); input(scene, '[data-hf-draft="priority"]', 'high', 'change');
		feed(scene, 'prev'); expect(get<HTMLInputElement>(scene, '[data-hf-draft="title"]').value).toBe('テスト用の報告');
		expect(get<HTMLTextAreaElement>(scene, '[data-hf-draft="code"]').value).toBe('const example = 1;');
		expect(get(scene, '[data-hf-code-field]').hidden).toBe(false);
		feed(scene, 'next'); expect(get<HTMLSelectElement>(scene, '[data-hf-draft="priority"]').value).toBe('high');
		feed(scene, 'send'); expect(get(scene, '[data-hf-send-note]').hidden).toBe(false);
		expect(get(scene, '[data-hf-send-note]').textContent).toContain('イシューも作成していません');
		expect(rowIds(scene)).toEqual([84, 83, 82, 81, 78]); noEffects();
	});
	test('escapes search and wizard title instead of inserting user-authored markup', () => {
		const { scene } = mount('feed'); const payload = '<img data-guide-xss src=x onerror="throw 1">';
		input(scene, '[data-hf-search]', payload); feed(scene, 'closed', '[data-value="true"]');
		expect(get<HTMLInputElement>(scene, '[data-hf-search]').value).toBe(payload); expect(scene.querySelector('[data-guide-xss]')).toBeNull();
		feed(scene, 'new'); feed(scene, 'choose', '[data-category="other"]'); input(scene, '[data-hf-draft="title"]', payload); feed(scene, 'next');
		expect(get(scene, '.hgf4-summary').textContent).toContain(payload); expect(scene.querySelector('[data-guide-xss]')).toBeNull();
	});
	test('separate windows retain independent queries, wizard labels, drafts, and close state', () => {
		const one = mount('feed', 'v:one'), two = mount('feed', 'v:two');
		input(one.scene, '[data-hf-search]', 'リスト'); expect(rowIds(two.scene)).toHaveLength(5);
		for (const item of [one, two]) { feed(item.scene, 'new'); feed(item.scene, 'choose', '[data-category="bug"]'); }
		input(one.scene, '[data-hf-draft="title"]', '一つめ'); input(two.scene, '[data-hf-draft="title"]', '二つめ');
		const first = get(one.scene, '[role="dialog"]'), second = get(two.scene, '[role="dialog"]');
		expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
		for (const item of [one, two]) expect(item.scene.contains(window.document.getElementById(get(item.scene, '[role="dialog"]').getAttribute('aria-labelledby') ?? ''))).toBe(true);
		feed(one.scene, 'close'); expect(one.scene.querySelector('[role="dialog"]')).toBeNull();
		expect(get<HTMLInputElement>(two.scene, '[data-hf-draft="title"]').value).toBe('二つめ');
		const title = get(two.scene, '[data-hf-draft="title"]'); title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(two.scene.querySelector('[role="dialog"]')).toBeNull();
	});
	test('repeat init keeps the draft; cleanup disables retained controls while another scene remains live', () => {
		const one = mount('feed'), two = mount('feed');
		feed(one.scene, 'new'); feed(one.scene, 'choose', '[data-category="bug"]'); input(one.scene, '[data-hf-draft="title"]', '保持する');
		initFeed(one.scene); expect(get<HTMLInputElement>(one.scene, '[data-hf-draft="title"]').value).toBe('保持する');
		one.cleanup(); one.cleanup(); const text = get(one.scene, '[data-hf-feedback]').textContent;
		feed(one.scene, 'new'); input(one.scene, '[data-hf-search]', 'リスト');
		expect(one.scene.querySelector('[role="dialog"]')).toBeNull(); expect(rowIds(one.scene)).toHaveLength(5);
		expect(get(one.scene, '[data-hf-feedback]').textContent).toBe(text);
		feed(two.scene, 'new'); expect(two.scene.querySelector('[role="dialog"]')).not.toBeNull(); expect(animationCancel).toHaveBeenCalledTimes(1);
	});
});

describe('HataIntro HataSideStudio teaching scene', () => {
	test('preserves profiles, grouped buttons, the memo widget, and the full settings tabs', () => {
		const { scene } = mount('studio');
		expect(scene.querySelectorAll('[data-hgs4-action="profile"]')).toHaveLength(2);
		expect(topOrder(scene)).toEqual(['home', 'notice', 'group', 'memo']);
		expect(scene.querySelectorAll('[data-hgs4-node]')).toHaveLength(6);
		expect(get<HTMLTextAreaElement>(scene, '.hgs4-memo textarea').readOnly).toBe(true);
		expect([...scene.querySelectorAll('[data-hgs4-tabs] button')].map(node => node.textContent)).toEqual(['配置', 'ボタン', 'ウィジェット', 'グループ', '上限']);
		expect(scene.textContent).toContain('本体の設定・アカウント・メモには触れず');
	});
	test('selects a button and changes shape, size, label visibility, and sidebar width', () => {
		const { scene } = mount('studio'); studio(scene, 'select', 'notice');
		studio(scene, 'shape', 'circle'); expect(get(scene, '[data-hgs4-node="notice"]').dataset.shape).toBe('circle');
		studio(scene, 'size', 'large'); expect(get(scene, '[data-hgs4-node="notice"]').dataset.size).toBe('large');
		toggle(scene, '[data-hgs4-field="showLabel"]', false); expect(get(scene, '[data-hgs4-node="notice"]').dataset.showLabel).toBe('false');
		studio(scene, 'tab', 'layout'); expect(get<HTMLButtonElement>(scene, '[data-hgs4-action="columns"][data-hgs4-value="2"]').disabled).toBe(true);
		studio(scene, 'width', 'wide'); expect(get(scene, '[data-hgs4-sidebar]').dataset.wide).toBe('true');
	});
	test('edits group name and columns while safely escaping authored text', () => {
		const { scene } = mount('studio'), payload = '<img data-guide-xss src=x>'; studio(scene, 'select', 'group');
		input(scene, '[data-hgs4-field="groupName"]', payload, 'change');
		expect(get(scene, '.hgs4-group-name').textContent).toBe(payload); expect(scene.querySelector('[data-guide-xss]')).toBeNull();
		studio(scene, 'group-columns', '2'); expect(get(scene, '.hgs4-group-grid').style.getPropertyValue('--hgs-group-columns')).toBe('2');
		toggle(scene, '[data-hgs4-field="showName"]', false); expect(get(scene, '.hgs4-group-name').textContent).not.toContain(payload);
	});
	test('keeps expanded and collapsed menus independent and enforces collapsed restrictions', () => {
		const { scene } = mount('studio'); studio(scene, 'select', 'notice'); studio(scene, 'shape', 'pill');
		studio(scene, 'mode', 'collapsed'); expect(get(scene, '[data-hgs4-sidebar]').dataset.mode).toBe('collapsed');
		expect(scene.querySelectorAll('[data-hgs4-node]')).toHaveLength(4); expect(scene.querySelector('.hgs4-group')).toBeNull();
		expect([...scene.querySelectorAll<HTMLButtonElement>('[data-hgs4-expanded-only]')].every(button => button.disabled)).toBe(true);
		studio(scene, 'select', 'c1'); expect(get<HTMLButtonElement>(scene, '[data-hgs4-action="size"][data-hgs4-value="normal"]').disabled).toBe(true);
		studio(scene, 'mode', 'expanded'); expect(get(scene, '[data-hgs4-node="notice"]').dataset.shape).toBe('pill');
	});
	test('adds a shaped example button and exposes it in the original inspector', () => {
		const { scene } = mount('studio'); studio(scene, 'create-button');
		input(scene, '[data-hgs4-dialog-menu]', 'hatady', 'change'); studio(scene, 'create-shape', 'pill'); studio(scene, 'confirm-dialog');
		expect(get(scene, '[data-hgs4-dialog]').hidden).toBe(true);
		const created = get(scene, '[data-hgs4-node="added1"]'); expect(created.dataset.shape).toBe('pill'); expect(created.textContent).toContain('Hatady');
		expect(get(scene, '[data-hgs4-action="tab"][data-hgs4-value="button"]').getAttribute('aria-pressed')).toBe('true');
	});
	test('renames and adds profiles up to the example limit and can undo and redo', () => {
		const { scene } = mount('studio'); studio(scene, 'rename');
		input(scene, '[data-hgs4-dialog-name]', '<b>読書用</b>'); studio(scene, 'confirm-dialog');
		expect(get(scene, '[data-hgs4-action="profile"][data-hgs4-value="default"]').textContent).toBe('<b>読書用</b>');
		expect(get(scene, '[data-hgs4-action="profile"][data-hgs4-value="default"]').querySelector('b')).toBeNull();
		studio(scene, 'add-profile'); expect(scene.querySelectorAll('[data-hgs4-action="profile"]')).toHaveLength(3);
		expect(get<HTMLButtonElement>(scene, '[data-hgs4-action="add-profile"]').disabled).toBe(true);
		studio(scene, 'undo'); expect(scene.querySelectorAll('[data-hgs4-action="profile"]')).toHaveLength(2);
		studio(scene, 'redo'); expect(scene.querySelectorAll('[data-hgs4-action="profile"]')).toHaveLength(3);
	});
	test('profile switches retain their own values and do not change another window', () => {
		const one = mount('studio'), two = mount('studio');
		studio(one.scene, 'profile', 'reading'); expect(topOrder(one.scene)).toEqual(['book', 'saved', 'memo2']);
		studio(one.scene, 'width', 'wide'); studio(one.scene, 'profile', 'default');
		expect(get(one.scene, '[data-hgs4-sidebar]').dataset.wide).toBe('false');
		studio(one.scene, 'profile', 'reading'); expect(get(one.scene, '[data-hgs4-sidebar]').dataset.wide).toBe('true');
		expect(topOrder(two.scene)).toEqual(['home', 'notice', 'group', 'memo']); expect(get(two.scene, '[data-hgs4-sidebar]').dataset.wide).toBe('false');
	});
	test('copy confirmation takes only buttons into collapsed mode and undo restores the prior draft', () => {
		const { scene } = mount('studio'); studio(scene, 'copy-menu'); studio(scene, 'copy', 'collapsed');
		expect(get(scene, '[data-hgs4-dialog]').textContent).toContain('本体には反映しない');
		studio(scene, 'confirm-dialog'); expect(get(scene, '[data-hgs4-sidebar]').dataset.mode).toBe('collapsed');
		expect(scene.querySelectorAll('[data-hgs4-node]')).toHaveLength(4);
		expect(scene.querySelector('.hgs4-memo,.hgs4-group')).toBeNull();
		studio(scene, 'undo'); expect(topOrder(scene)).toEqual(['c0', 'c1', 'c2', 'c3']);
	});
	test('commits a same-container drag and rejects group-crossing or other-window targets', () => {
		const one = mount('studio'), two = mount('studio');
		let grip = get(one.scene, '[data-hgs4-drag="home"]'); hit = get(one.scene, '[data-hgs4-node="notice"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientX: 20, clientY: 100 }); pointer(grip, 'pointerup');
		expect(topOrder(one.scene)).toEqual(['notice', 'home', 'group', 'memo']); expect(grip.hasPointerCapture(1)).toBe(false);
		for (const target of [get(one.scene, '[data-hgs4-node="hatask"]'), get(two.scene, '[data-hgs4-node="notice"]')]) {
			grip = get(one.scene, '[data-hgs4-drag="home"]'); hit = target;
			pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientX: 20, clientY: 100 }); pointer(grip, 'pointerup');
			expect(topOrder(one.scene)).toEqual(['notice', 'home', 'group', 'memo']);
		}
		expect(topOrder(two.scene)).toEqual(['home', 'notice', 'group', 'memo']);
	});
	test.each(['pointercancel', 'lostpointercapture'])('%s cancels Studio drag without changing order', type => {
		const { scene } = mount('studio'); const grip = get(scene, '[data-hgs4-drag="home"]'); hit = get(scene, '[data-hgs4-node="notice"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientX: 20, clientY: 100 }); pointer(grip, type);
		pointer(grip, 'pointermove', { clientX: 50, clientY: 200 }); pointer(grip, 'pointerup');
		expect(topOrder(scene)).toEqual(['home', 'notice', 'group', 'memo']);
		expect(scene.querySelector('[data-dragging],[data-drop]')).toBeNull(); expect(grip.hasPointerCapture(1)).toBe(false);
	});
	test('save only explains the real destination and retains the unsaved indicator', () => {
		const { scene } = mount('studio'); studio(scene, 'width', 'wide');
		expect(scene.querySelector('.hgs4-dirty')).not.toBeNull(); studio(scene, 'explain', 'save');
		expect(get(scene, '[data-hgs4-status]').textContent).toContain('この図では保存せず');
		expect(scene.querySelector('.hgs4-dirty')).not.toBeNull(); noEffects();
	});
	test('cleanup releases drag and closes the teaching dialog, after which handlers stay inactive', () => {
		const one = mount('studio'), two = mount('studio'); studio(one.scene, 'create-button');
		const grip = get(one.scene, '[data-hgs4-drag="home"]'); hit = get(one.scene, '[data-hgs4-node="notice"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientX: 20, clientY: 100 });
		one.cleanup(); one.cleanup();
		expect(grip.hasPointerCapture(1)).toBe(false); expect(get(one.scene, '[data-hgs4-dialog]').hidden).toBe(true);
		expect(one.scene.querySelector('[data-dragging],[data-drop]')).toBeNull();
		const text = get(one.scene, '[data-hgs4-status]').textContent;
		studio(one.scene, 'create-button'); studio(one.scene, 'mode', 'collapsed'); pointer(grip, 'pointerup');
		expect(get(one.scene, '[data-hgs4-dialog]').hidden).toBe(true); expect(get(one.scene, '[data-hgs4-sidebar]').dataset.mode).toBe('expanded');
		expect(get(one.scene, '[data-hgs4-status]').textContent).toBe(text); expect(topOrder(one.scene)).toEqual(['home', 'notice', 'group', 'memo']);
		studio(two.scene, 'mode', 'collapsed'); expect(get(two.scene, '[data-hgs4-sidebar]').dataset.mode).toBe('collapsed');
		expect(animationCancel).toHaveBeenCalledTimes(1);
	});
});
