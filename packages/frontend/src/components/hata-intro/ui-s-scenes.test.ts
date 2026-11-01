/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init, templates } from './ui-s-scenes.js';

const releases: (() => void)[] = [];
const effects: string[] = [];

function deny(effect: string): never {
	effects.push(effect);
	throw new Error(`Scene attempted ${effect}`);
}

function mount(kind: 'overview' | 'post' | 'workspace' | 'settings') {
	const root = window.document.createElement('div');
	root.className = 'hata-intro';
	root.innerHTML = templates[`hg-ui-s-${kind}-scene`];
	window.document.body.append(root);
	releases.push(init(root), () => root.remove());
	return root;
}

function get<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const result = root.querySelector<T>(selector);
	if (!result) throw new Error(`Missing scene element: ${selector}`);
	return result;
}

function click(root: ParentNode, action: string, value?: string) {
	get<HTMLElement>(root, `[data-hguis-action="${action}"]${value == null ? '' : `[data-value="${value}"]`}`).click();
}

function write(root: ParentNode, selector: string, value: string) {
	const input = get<HTMLInputElement | HTMLTextAreaElement>(root, selector);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function change(root: ParentNode, selector: string, value: string | boolean) {
	const input = get<HTMLInputElement | HTMLSelectElement>(root, selector);
	if (typeof value === 'boolean') (input as HTMLInputElement).checked = value;
	else input.value = value;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

function status(root: ParentNode) { return get(root, '[data-hguis-status]').textContent; }

beforeEach(() => {
	vi.useFakeTimers();
	effects.length = 0;
	vi.stubGlobal('fetch', vi.fn(() => deny('fetch')));
	vi.stubGlobal('XMLHttpRequest', class { constructor() { deny('xhr'); } });
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket'); } });
	vi.spyOn(window, 'open').mockImplementation(() => deny('window.open'));
	for (const kind of ['localStorage', 'sessionStorage']) {
		vi.stubGlobal(kind, {
			getItem: () => deny(`${kind}.getItem`),
			setItem: () => deny(`${kind}.setItem`),
			removeItem: () => deny(`${kind}.removeItem`),
			clear: () => deny(`${kind}.clear`),
		});
	}
});

afterEach(() => {
	for (const release of releases.splice(0)) release();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('HataIntro UI S scenes', () => {
	test('effect guards catch network, navigation and persistence attempts', () => {
		expect(() => window.fetch('/api/test')).toThrow('fetch');
		expect(() => new XMLHttpRequest()).toThrow('xhr');
		expect(() => new WebSocket('wss://example.invalid')).toThrow('websocket');
		expect(() => window.open('/')).toThrow('window.open');
		expect(() => localStorage.getItem('account')).toThrow('localStorage.getItem');
		expect(() => localStorage.setItem('ui', 'other')).toThrow('localStorage.setItem');
		expect(() => sessionStorage.setItem('guide', 'other')).toThrow('sessionStorage.setItem');
		expect(effects).toHaveLength(7);
	});

	test('desktop and mobile timeline controls share their selection inside one scene only', () => {
		const root = mount('overview');
		const other = mount('overview');
		click(root, 'timeline', 'local');
		expect(get(root, '[data-hguis-timeline-title]').textContent).toBe('ローカル');
		click(root, 'device', 'mobile');
		expect(get<HTMLElement>(root, '[data-hguis-device]').dataset.hguisDevice).toBe('mobile');
		click(root, 'open-list');
		expect(get<HTMLElement>(root, '[data-hguis-picker]').hidden).toBe(false);
		get<HTMLElement>(root, '[data-hguis-picker] [data-value="antenna"]').click();
		expect(get(root, '[data-hguis-timeline-title]').textContent).toBe('アンテナ');
		expect(get<HTMLElement>(root, '[data-hguis-picker]').hidden).toBe(true);
		expect(get(other, '[data-hguis-timeline-title]').textContent).toBe('ホーム');
		click(root, 'mobile-menu');
		click(root, 'ui', 's');
		expect(status(root)).toContain('本体では画面が読み込み直されます');
		expect(effects).toEqual([]);
	});

	test('opening the mobile menu focuses its first choice and Escape returns to the trigger', () => {
		const root = mount('overview');
		click(root, 'device', 'mobile');
		const trigger = get(root, '[data-hguis-action="mobile-menu"]');
		trigger.focus();
		trigger.click();
		const choice = get(root, '[data-hguis-switcher] button');
		expect(window.document.activeElement).toBe(choice);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(get<HTMLElement>(root, '[data-hguis-switcher]').hidden).toBe(true);
		expect(window.document.activeElement).toBe(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(effects).toEqual([]);
	});

	test('long press opens the list and disposal cancels pending work and event handlers', () => {
		const root = mount('overview');
		click(root, 'device', 'mobile');
		const home = get(root, '[data-hguis-action="home"]');
		home.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
		vi.advanceTimersByTime(500);
		expect(get<HTMLElement>(root, '[data-hguis-picker]').hidden).toBe(false);
		click(root, 'close-list');
		home.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
		init(root)();
		const before = status(root);
		vi.advanceTimersByTime(1000);
		expect(get<HTMLElement>(root, '[data-hguis-picker]').hidden).toBe(true);
		click(root, 'timeline', 'local');
		expect(get(root, '[data-hguis-timeline-title]').textContent).toBe('ホーム');
		expect(status(root)).toBe(before);
		expect(effects).toEqual([]);
	});

	test('posting practice requires text and a direct recipient and displays input as text', () => {
		const root = mount('post');
		const send = get<HTMLButtonElement>(root, '[data-hguis-action="send"]');
		expect(send.disabled).toBe(true);
		const draft = '<img src=x onerror="window.fetch(\'/api/test\')">';
		write(root, '[data-hguis-text]', draft);
		expect(send.disabled).toBe(false);
		click(root, 'visibility-menu');
		click(root, 'visibility', 'specified');
		expect(send.disabled).toBe(true);
		write(root, '[data-hguis-recipient]', 'しおり');
		click(root, 'federation');
		click(root, 'send');
		expect(get<HTMLElement>(root, '[data-hguis-sent]').hidden).toBe(false);
		expect(get(root, '[data-hguis-sent-text]').textContent).toBe(draft);
		expect(root.querySelector('[data-hguis-sent] img')).toBeNull();
		expect(get(root, '[data-hguis-sent-scope]').textContent).toContain('ダイレクト：しおり');
		expect(get(root, '[data-hguis-sent-scope]').textContent).toContain('連合なし');
		expect(get<HTMLTextAreaElement>(root, '[data-hguis-text]').value).toBe(draft);
		expect(effects).toEqual([]);
	});

	test('post tool explanations remain local and Escape closes open menus', () => {
		const root = mount('post');
		click(root, 'post-tools');
		click(root, 'tool', 'drawing');
		expect(get(root, '[data-hguis-tool-help]').textContent).toContain('Hatadint');
		click(root, 'attach');
		expect(status(root)).toContain('図ではファイルを開きません');
		click(root, 'visibility-menu');
		get(root, '[data-hguis-scene]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(get<HTMLElement>(root, '[data-hguis-visibility]').hidden).toBe(true);
		expect(get<HTMLElement>(root, '[data-hguis-post-tools]').hidden).toBe(true);
		expect(get(root, '[data-hguis-action="visibility-menu"]').getAttribute('aria-expanded')).toBe('false');
		expect(effects).toEqual([]);
	});

	test('side pages can expand, restore and close before switching to deck and back', () => {
		const root = mount('workspace');
		click(root, 'page-open');
		expect(get<HTMLElement>(root, '[data-hguis-workspace]').dataset.hguisWorkspace).toBe('split');
		click(root, 'page-toggle');
		expect(get<HTMLElement>(root, '[data-hguis-workspace-timeline]').hidden).toBe(true);
		expect(get(root, '[data-hguis-action="page-toggle"]').getAttribute('aria-label')).toBe('左右表示に戻す');
		click(root, 'page-toggle');
		expect(get<HTMLElement>(root, '[data-hguis-workspace-timeline]').hidden).toBe(false);
		click(root, 'page-close');
		expect(get<HTMLElement>(root, '[data-hguis-page]').hidden).toBe(true);
		expect(window.document.activeElement).toBe(get(root, '[data-hguis-action="page-open"]'));
		click(root, 'workspace-mode', 'deck');
		expect(get<HTMLElement>(root, '[data-hguis-deck]').hidden).toBe(false);
		click(root, 'workspace-mode', 'standard');
		expect(get<HTMLElement>(root, '[data-hguis-deck]').hidden).toBe(true);
		expect(get<HTMLElement>(root, '[data-hguis-workspace]').hidden).toBe(false);
		click(root, 'pane', 'hatask');
		expect(get(root, '[data-hguis-pane-title]').textContent).toBe('Hatask');
		expect(status(root)).toContain('図の表示を切り替えました');
		expect(status(root)).toContain('本体では幅の広い画面の右側に表示されます');
		expect(effects).toEqual([]);
	});

	test('settings update the preview without persistence and enforce five navigation items', () => {
		const root = mount('settings');
		change(root, '[data-hguis-setting="size"]', 'small');
		change(root, '[data-hguis-setting="position"]', 'top');
		change(root, '[data-hguis-setting="glass"]', false);
		const preview = get<HTMLElement>(root, '[data-hguis-settings-preview]');
		expect(preview.dataset).toMatchObject({ size: 'small', position: 'top', glass: 'false' });
		change(root, '[data-hguis-nav-visible="hatafeed"]', true);
		expect(get<HTMLInputElement>(root, '[data-hguis-nav-visible="hatafeed"]').checked).toBe(false);
		expect(status(root)).toContain('5項目まで');
		expect(get<HTMLInputElement>(root, '[data-hguis-nav-visible="home"]').disabled).toBe(true);
		change(root, '[data-hguis-nav-visible="search"]', false);
		change(root, '[data-hguis-nav-visible="hatafeed"]', true);
		expect(get<HTMLInputElement>(root, '[data-hguis-nav-visible="hatafeed"]').checked).toBe(true);
		click(root, 'nav-up', 'hatafeed');
		expect([...root.querySelectorAll<HTMLElement>('[data-nav-id]')].map(item => item.dataset.navId)).toEqual(['home', 'search', 'notifications', 'hatagoes', 'hatafeed', 'widgets']);
		expect(root.querySelectorAll('[data-hguis-nav-preview] > span')).toHaveLength(6);
		expect(effects).toEqual([]);
	});

	test('mounting twice does not duplicate actions', () => {
		const root = mount('post');
		releases.push(init(root));
		click(root, 'federation');
		expect(get(root, '[data-hguis-action="federation"]').getAttribute('aria-pressed')).toBe('false');
		expect(effects).toEqual([]);
	});
});
