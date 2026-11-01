/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Fixtures isolate the tested menu from its child and global UI components. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkMenu from './MkMenu.vue';
import type { App, PropType } from 'vue';
import type { MenuItem } from '@/types/menu.js';

vi.mock('@/preferences.js', () => ({ prefer: { s: { useBlurEffect: false, useBlurEffectForModal: false, removeModalBgColorForBlur: false } } }));
vi.mock('@/utility/touch.js', () => ({ isTouchUsing: true }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { none: 'なし' } } }));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn(async () => undefined) }));
vi.mock('@/components/MkSwitch.button.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ setup: () => () => render('span') }) };
});
vi.mock('./MkMenu.child.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { __esModule: true, default: component({
		props: {
			items: { type: Array as PropType<MenuItem[]>, required: true },
			anchorElement: { type: Object as PropType<HTMLElement>, required: true },
			rootElement: { type: Object as PropType<HTMLElement>, required: true },
		},
		setup: (props, { expose }) => {
			expose({ checkHit: () => false });
			return () => render('div', { 'data-test-nested-menu': '', 'data-anchor-tag': props.anchorElement.tagName, 'data-anchor-id': props.anchorElement.id });
		},
	}) };
});

import { popupMenu } from '@/os.js';

const mounted: Array<{ app: App<Element>; container: HTMLElement }> = [];

async function flush(): Promise<void> {
	for (let index = 0; index < 6; index++) { await Promise.resolve(); await nextTick(); }
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { for (const { app, container } of mounted.splice(0)) { app.unmount(); container.remove(); } });

async function mountMenu(props: { items: MenuItem[]; width?: number; maxWidth?: number; maxHeight?: number; asDrawer?: boolean }) {
	const container = window.document.createElement('div'); window.document.body.append(container);
	const closed = vi.fn(); const hide = vi.fn();
	const app = createApp(defineComponent({ setup: () => () => h(MkMenu, { ...props, onClose: closed, onHide: hide }) }));
	app.provide('isNestingMenu', true);
	app.directive('hotkey', {});
	for (const name of ['MkEllipsis', 'MkAvatar', 'MkA', 'MkUserName']) {
		app.component(name, defineComponent({ setup: (_props, { slots }) => () => h('span', slots.default?.()) }));
	}
	app.mount(container); mounted.push({ app, container });
	await flush();
	return { app, container, closed, hide };
}

describe('MkMenuの子メニュー用制約と非同期anchor保持', () => {
	test('指定した通常ボタンのタイトルだけRighteousにし、Hatask設定のApp候補が指定する', async () => {
		const { container } = await mountMenu({ items: [
			{ text: 'Hataskey App', textFont: 'righteous', action: vi.fn() },
			{ text: '普通の項目', action: vi.fn() },
		] });
		const titles = [...container.querySelectorAll<HTMLElement>('button[role="menuitem"]')].map(button => button.querySelector<HTMLElement>('div[class*="item_content_text_title"]'));
		expect(titles[0]?.className).toMatch(/wordmark/u);
		expect(titles[1]?.className).not.toMatch(/wordmark/u);
		const settings = readFileSync(resolve(process.cwd(), 'src/pages/HataskSettings.vue'), 'utf8');
		expect(settings).toContain("textFont: choice.id === 'apps' || choice.id === 'hataskapps' ? 'righteous' : undefined");
	});
	test('maxWidthを渡した子だけタッチ時の最小幅を縮め、長文を含めて画面内へ制約する', async () => {
		const { container } = await mountMenu({
			items: [{ text: '日本語の長い項目名と分割できない識別子abcdefghijk'.repeat(4), action: vi.fn() }],
			width: 500, maxWidth: 180, maxHeight: 280,
		});
		const root = container.querySelector('[role="menu"]');
		const surface = root?.querySelector<HTMLElement>('._shadow');
		if (!surface) throw new Error('Menu surface did not mount');
		expect(root?.getAttribute('data-viewport-constrained')).toBe('true');
		expect(surface.style.width).toBe('500px');
		expect(surface.style.maxWidth).toBe('min(180px, 500px)');
		expect(surface.style.minWidth).toBe('min(180px, 230px)');
		expect(surface.style.maxHeight).toBe('min(280px, calc(100dvh - 32px))');
		expect(root?.querySelector('button')?.textContent).toContain('日本語の長い項目名');
	});

	test.each([false, true])('上位メニューとdrawer(%s)には子専用の幅・折返し制約を適用しない', async asDrawer => {
		const { container } = await mountMenu({ items: [{ text: '通常のメニュー', action: vi.fn() }], width: 320, asDrawer });
		const root = container.querySelector('[role="menu"]');
		const surface = root?.querySelector<HTMLElement>('._shadow');
		if (!surface) throw new Error('Menu surface did not mount');
		expect(root?.getAttribute('data-viewport-constrained')).toBe('false');
		expect(surface.style.maxWidth).toBe('');
		expect(surface.style.minWidth).toBe('');
		expect(surface.style.width).toBe(asDrawer ? '' : '320px');
	});

	test('長い項目名の折返しと縮小可能な内容は子専用属性の中だけに置く', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/MkMenu.vue'), 'utf8');
		const start = source.indexOf('.root[data-viewport-constrained=\'true\'] {');
		if (start < 0) throw new Error('Missing constrained child stylesheet');
		const block = source.slice(start, source.indexOf('\n.menuItems {', start));
		const wraps = (css: string): boolean => /\.item_content_text_title,\s*\.label\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/.test(css);
		expect(wraps('.item_content_text_title, .label { white-space: nowrap; }')).toBe(false);
		expect(wraps(block)).toBe(true);
		expect(block).toMatch(/\.item_content,\s*\.item_content_text\s*\{[^}]*min-width:\s*0;/);
		expect(block).toMatch(/\.icon,\s*\.avatar,\s*\.caret\s*\{[^}]*flex-shrink:\s*0;/);
	});

	test('非同期childrenを内部要素からクリックしても、項目buttonを子メニューanchorとして保つ', async () => {
		let finishChildren: (items: MenuItem[]) => void = () => { throw new Error('Child load did not start'); };
		const children = vi.fn(() => new Promise<MenuItem[]>(resolveChildren => { finishChildren = resolveChildren; }));
		const { container } = await mountMenu({ items: [{ type: 'parent', text: '位置を変更', children }] });
		const button = container.querySelector<HTMLButtonElement>('button[role="menuitem"]');
		if (!button) throw new Error('Parent button did not mount');
		button.id = 'actual-parent-button';
		const inner = button.querySelector('div');
		if (!inner) throw new Error('Parent label did not mount');
		inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(children).toHaveBeenCalledTimes(1);
		expect(container.querySelector('[data-test-nested-menu]')).toBeNull();
		finishChildren([{ text: '1番目', action: vi.fn() }]);
		await flush();
		// Child data resolution starts a separate defineAsyncComponent import.
		// Wait for that loader, not an assumed number of microtasks.
		await vi.dynamicImportSettled();
		await nextTick();
		const child = container.querySelector<HTMLElement>('[data-test-nested-menu]');
		expect(child?.dataset.anchorTag).toBe('BUTTON');
		expect(child?.dataset.anchorId).toBe(button.id);
	});

	test('drawerでも非同期読み込み前のbuttonを次のpopupへ渡す', async () => {
		let finishChildren: (items: MenuItem[]) => void = () => { throw new Error('Child load did not start'); };
		const children = () => new Promise<MenuItem[]>(resolveChildren => { finishChildren = resolveChildren; });
		const { container, hide } = await mountMenu({ asDrawer: true, items: [{ type: 'parent', text: '位置を変更', children }] });
		const button = container.querySelector<HTMLButtonElement>('button[role="menuitem"]');
		if (!button) throw new Error('Parent button did not mount');
		const inner = button.querySelector('div');
		if (!inner) throw new Error('Parent label did not mount');
		inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const items: MenuItem[] = [{ text: '1番目', action: vi.fn() }];
		finishChildren(items);
		await flush();
		expect(popupMenu).toHaveBeenCalledWith(items, button);
		expect(hide).toHaveBeenCalledTimes(1);
	});

	test('読み込み中にメニューが閉じられたら、遅れて届いた子を開かない', async () => {
		let finishChildren: (items: MenuItem[]) => void = () => { throw new Error('Child load did not start'); };
		const children = () => new Promise<MenuItem[]>(resolveChildren => { finishChildren = resolveChildren; });
		const { app, container, hide } = await mountMenu({ asDrawer: true, items: [{ type: 'parent', text: '位置を変更', children }] });
		const button = container.querySelector<HTMLButtonElement>('button[role="menuitem"]');
		if (!button) throw new Error('Parent button did not mount');
		button.click();
		app.unmount();
		finishChildren([{ text: '1番目', action: vi.fn() }]);
		await flush();
		expect(popupMenu).not.toHaveBeenCalled();
		expect(hide).not.toHaveBeenCalled();
		mounted.pop(); container.remove();
	});
});
