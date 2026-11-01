/* SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init, templates } from './hatagoes-scenes.js';

type Kind = 'home' | 'apps' | 'search' | 'settings';
const mounted: { scene: HTMLElement; cleanup: () => void }[] = [];
const effects: string[] = [];

function deny(kind: string): never { effects.push(kind); throw new Error(`Guide attempted ${kind}`); }

function noEffects() { expect(effects).toEqual([]); }

beforeEach(() => {
	effects.length = 0;
	vi.stubGlobal('fetch', vi.fn(() => deny('fetch')));
	vi.stubGlobal('XMLHttpRequest', class { constructor() { deny('xhr'); } });
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket'); } });
	vi.spyOn(window, 'open').mockImplementation(() => deny('window.open'));
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		vi.stubGlobal(name, { length: 0, key: () => null, getItem: () => null, setItem: () => deny(`${name}.setItem`), removeItem: () => deny(`${name}.removeItem`), clear: () => deny(`${name}.clear`) });
	}
});

afterEach(() => {
	try { for (const item of mounted.splice(0)) { item.cleanup(); item.scene.remove(); } noEffects(); } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});

function mount(kind: Kind) {
	const scene = window.document.createElement('figure');
	scene.innerHTML = templates[`hg-goes-${kind}-scene`];
	window.document.body.append(scene);
	const item = { scene, cleanup: init(scene) }; mounted.push(item); return item;
}

function get<T extends Element = HTMLElement>(scene: ParentNode, selector: string): T {
	const found = scene.querySelector<T>(selector);
	if (!found) throw new Error(`Missing scene element: ${selector}`);
	return found;
}

function click(scene: ParentNode, action: string, value?: string) {
	get<HTMLElement>(scene, `[data-hggo-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`).click();
}

function keyboardClick(scene: ParentNode, action: string, value?: string) {
	const control = get<HTMLButtonElement>(scene, `[data-hggo-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`);
	expect(control.disabled).toBe(false);
	control.focus(); expect(window.document.activeElement).toBe(control);
	// DOM tests do not perform the browser's native Enter/Space activation.
	// Dispatch its resulting zero-detail click while the button has keyboard focus.
	control.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
}

function focusedButton(scene: ParentNode, action: string, value?: string) {
	const control = get<HTMLButtonElement>(scene, `[data-hggo-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`);
	expect(window.document.activeElement).toBe(control); expect(control.disabled).toBe(false);
	return control;
}

function input(scene: ParentNode, selector: string, value: string) {
	const control = get<HTMLInputElement>(scene, selector); control.value = value; control.dispatchEvent(new Event('input', { bubbles: true }));
}

function pinOrder(scene: ParentNode) { return [...scene.querySelectorAll('.hggo-order li > span')].map(row => row.textContent); }

function cardOrder(scene: ParentNode) { return [...scene.querySelectorAll<HTMLElement>('[data-card]')].map(row => row.dataset.card); }

describe('HataIntro HataGoes effect guards', () => {
	test('positive controls detect communication, external navigation, and storage writes', () => {
		const attempts: [string, () => unknown][] = [
			['fetch', () => window.fetch('/guide-positive-control')],
			['xhr', () => new XMLHttpRequest()],
			['websocket', () => new WebSocket('wss://example.invalid')],
			['window.open', () => window.open('https://example.invalid')],
			...(['localStorage', 'sessionStorage'] as const).flatMap(name => [
				[`${name}.setItem`, () => globalThis[name].setItem('guide-test', '1')],
				[`${name}.removeItem`, () => globalThis[name].removeItem('guide-test')],
				[`${name}.clear`, () => globalThis[name].clear()],
			] as [string, () => unknown][]),
		];
		for (const [kind, attempt] of attempts) {
			expect(attempt).toThrow(`Guide attempted ${kind}`); expect(effects).toEqual([kind]);
			expect(noEffects).toThrow(); effects.length = 0;
		}
	});
	test('unrelated markup is left intact', () => {
		const scene = window.document.createElement('figure'); scene.innerHTML = '<p>別の図</p>';
		init(scene)(); expect(scene.innerHTML).toBe('<p>別の図</p>');
	});
});

describe('HataIntro HataGoes local scenes', () => {
	test('keeps completion state while switching apps and prevents a second watering', () => {
		const { scene } = mount('home');
		click(scene, 'todo'); click(scene, 'water');
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="water"]').disabled).toBe(true);
		expect(get(scene, '.hggo-daily > strong').textContent).toBe('4 / 5');
		click(scene, 'app', 'hatady'); expect(get(scene, '[data-hggo-home]').textContent).toContain('読書や学習');
		click(scene, 'app', 'home'); expect(get(scene, '[data-hggo-action="todo"]').getAttribute('aria-pressed')).toBe('true');
		expect(get(scene, '[data-hggo-action="water"]').textContent).toContain('きょうは水やり済み');
		click(scene, 'todo'); expect(get(scene, '.hggo-daily > strong').textContent).toBe('3 / 5');
	});
	test('moves keyboard focus to the flower heading after watering becomes unavailable', () => {
		const { scene } = mount('home'); keyboardClick(scene, 'water');
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="water"]').disabled).toBe(true);
		const heading = get<HTMLElement>(scene, '[data-hggo-water-title]');
		expect(window.document.activeElement).toBe(heading); expect(heading.tabIndex).toBe(-1);
		expect(heading.textContent).toContain('おはな');
		expect(get(scene, '[data-hggo-feedback]').textContent).toContain('水をあげました');
	});
	test('searches apps by name without changing other examples', () => {
		const one = mount('apps'), two = mount('apps');
		input(one.scene, '[data-hggo-app-query]', 'hatadint');
		expect(one.scene.querySelectorAll('[data-hggo-app-list] button')).toHaveLength(1);
		click(one.scene, 'open-app', 'drawing'); expect(get(one.scene, '[data-hggo-feedback]').textContent).toContain('Hatadintを開く操作');
		input(one.scene, '[data-hggo-app-query]', '存在しない例'); expect(get(one.scene, '[data-hggo-app-list]').textContent).toContain('一致するアプリがありません');
		expect(two.scene.querySelectorAll('[data-hggo-app-list] button')).toHaveLength(9);
	});
	test('adds, reorders, removes and saves plus shortcuts only within the diagram', () => {
		const { scene } = mount('apps'); click(scene, 'plus'); click(scene, 'edit-pins');
		click(scene, 'pin-add', 'intro'); click(scene, 'pin-up', 'intro');
		expect(pinOrder(scene)).toEqual(['カレンダー', 'HataIntro', 'ToDo']);
		click(scene, 'pin-remove', 'calendar'); click(scene, 'save-pins');
		expect(get(scene, '[data-hggo-plus]').textContent).toContain('2/8');
		click(scene, 'edit-pins'); expect(pinOrder(scene)).toEqual(['HataIntro', 'ToDo']);
		click(scene, 'pin-add', 'garden'); click(scene, 'cancel-edit'); click(scene, 'edit-pins');
		expect(pinOrder(scene)).toEqual(['HataIntro', 'ToDo']);
	});
	test('keeps keyboard focus on a usable control when pins are added or removed', () => {
		const { scene } = mount('apps'); keyboardClick(scene, 'plus'); keyboardClick(scene, 'edit-pins');
		keyboardClick(scene, 'pin-add', 'intro'); focusedButton(scene, 'pin-remove', 'intro');
		keyboardClick(scene, 'pin-remove', 'intro'); focusedButton(scene, 'pin-remove', 'todo');
		keyboardClick(scene, 'pin-remove', 'calendar'); focusedButton(scene, 'pin-remove', 'todo');
		keyboardClick(scene, 'pin-remove', 'todo'); focusedButton(scene, 'pin-add', 'todo');
		expect(pinOrder(scene)).toEqual([]);
		keyboardClick(scene, 'pin-add', 'todo'); focusedButton(scene, 'pin-remove', 'todo');
		expect(pinOrder(scene)).toEqual(['ToDo']);
	});
	test('keeps the moved pin focused and switches direction at both ends', () => {
		const { scene } = mount('apps'); click(scene, 'plus'); click(scene, 'edit-pins'); click(scene, 'pin-add', 'intro');
		keyboardClick(scene, 'pin-up', 'intro');
		focusedButton(scene, 'pin-up', 'intro').click();
		expect(pinOrder(scene)).toEqual(['HataIntro', 'カレンダー', 'ToDo']);
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="pin-up"][data-value="intro"]').disabled).toBe(true);
		focusedButton(scene, 'pin-down', 'intro').click();
		focusedButton(scene, 'pin-down', 'intro').click();
		expect(pinOrder(scene)).toEqual(['カレンダー', 'ToDo', 'HataIntro']);
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="pin-down"][data-value="intro"]').disabled).toBe(true);
		focusedButton(scene, 'pin-up', 'intro');
	});
	test('enforces the eight-item limit and confirms discarding unsaved changes', () => {
		const { scene } = mount('apps'); click(scene, 'plus'); click(scene, 'edit-pins');
		for (const id of ['mood', 'meal', 'recipe', 'garden', 'intro', 'card']) click(scene, 'pin-add', id);
		expect(pinOrder(scene)).toHaveLength(8);
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="pin-add"][data-value="drawing"]').disabled).toBe(true);
		click(scene, 'close-plus'); expect(get(scene, '[data-hggo-plus]').textContent).toContain('未保存の変更');
		click(scene, 'keep-editing'); expect(pinOrder(scene)).toHaveLength(8);
		click(scene, 'close-plus'); click(scene, 'discard-pins'); click(scene, 'plus'); click(scene, 'edit-pins');
		expect(pinOrder(scene)).toEqual(['カレンダー', 'ToDo']);
	});
	test('searches and filters sample records, opens detail, and restores results when search reopens', () => {
		const { scene } = mount('search'); input(scene, '[data-hggo-query]', '本');
		get(scene, '[data-hggo-search-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		expect(scene.querySelectorAll('[data-hggo-action="result"]')).toHaveLength(4);
		click(scene, 'filter', 'hatady'); expect(scene.querySelectorAll('[data-hggo-action="result"]')).toHaveLength(1);
		click(scene, 'result', 'book'); expect(get<HTMLElement>(scene, '[data-hggo-search-area]').hidden).toBe(true);
		expect(get(scene, '[data-hggo-detail]').textContent).toContain('42 / 180ページ');
		click(scene, 'close-detail'); expect(get<HTMLElement>(scene, '[data-hggo-search-area]').hidden).toBe(true);
		click(scene, 'reopen'); expect(get<HTMLInputElement>(scene, '[data-hggo-query]').value).toBe('本');
		expect(scene.querySelectorAll('[data-hggo-action="result"]')).toHaveLength(1);
		click(scene, 'result', 'book'); expect(get<HTMLElement>(scene, '[data-hggo-detail]').hidden).toBe(false);
	});
	test('escapes search text and reports an empty result without creating elements', () => {
		const { scene } = mount('search'); const text = '<img data-guide-xss src=x>';
		input(scene, '[data-hggo-query]', text); click(scene, 'submit-search');
		expect(get(scene, '[data-hggo-results]').textContent).toContain(text);
		expect(scene.querySelector('[data-guide-xss]')).toBeNull();
		expect(get(scene, '[data-hggo-results]').textContent).toContain('一致する情報がありません');
	});
	test('previews a home theme and preserves hidden cards while reordering', () => {
		const { scene } = mount('settings'); click(scene, 'theme', 'koke');
		expect(get<HTMLElement>(scene, '[data-hggo-preview]').dataset.hggoPreview).toBe('koke');
		const control = get<HTMLInputElement>(scene, '[data-hggo-card-visible="todo"]'); control.checked = false; control.dispatchEvent(new Event('change', { bubbles: true }));
		click(scene, 'card-up', 'reading'); expect(cardOrder(scene)).toEqual(['daily', 'reading', 'todo']);
		expect(get<HTMLInputElement>(scene, '[data-hggo-card-visible="todo"]').checked).toBe(false);
		expect(get(scene, '[data-hggo-visible-cards]').textContent).not.toContain('ToDo');
	});
	test('keeps the moved card focused and switches direction at both ends', () => {
		const { scene } = mount('settings'); keyboardClick(scene, 'card-up', 'reading');
		focusedButton(scene, 'card-up', 'reading').click();
		expect(cardOrder(scene)).toEqual(['reading', 'daily', 'todo']);
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="card-up"][data-value="reading"]').disabled).toBe(true);
		focusedButton(scene, 'card-down', 'reading').click();
		focusedButton(scene, 'card-down', 'reading').click();
		expect(cardOrder(scene)).toEqual(['daily', 'todo', 'reading']);
		expect(get<HTMLButtonElement>(scene, '[data-hggo-action="card-down"][data-value="reading"]').disabled).toBe(true);
		focusedButton(scene, 'card-up', 'reading');
	});
	test('repeated initialization preserves state and cleanup removes event handlers', () => {
		const one = mount('home'), two = mount('home'); click(one.scene, 'water'); init(one.scene);
		expect(get<HTMLButtonElement>(one.scene, '[data-hggo-action="water"]').disabled).toBe(true);
		one.cleanup(); one.cleanup(); const before = one.scene.innerHTML; click(one.scene, 'todo');
		expect(one.scene.innerHTML).toBe(before); click(two.scene, 'todo');
		expect(get(two.scene, '[data-hggo-action="todo"]').getAttribute('aria-pressed')).toBe('true');
	});
});
