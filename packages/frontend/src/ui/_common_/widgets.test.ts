/* SPDX-License-Identifier: AGPL-3.0-only */
/* eslint-disable vue/one-component-per-file -- Each test double isolates a separate widget rendering path. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import WidgetsColumn from '../deck/widgets-column.vue';
import Widgets from './widgets.vue';
import type { App, PropType } from 'vue';
import type { Column } from '@/deck.js';
import { prefer } from '@/preferences.js';
import { updateColumnWidget } from '@/deck.js';

const lifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock('@/preferences.js', async () => {
	const { ref: state } = await import('vue');
	const widgets = state([{ id: 'memo', name: 'memo', data: {}, place: null }]);
	return { prefer: { r: { animation: state(false), widgets }, s: { get widgets() { return widgets.value; } }, commit: vi.fn() } };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { widgets: 'ウィジェット', editWidgets: 'ウィジェットを編集', editWidgetsExit: '編集を終了', show: '表示', hide: '隠す', _deck: { widgetsIntroduction: 'ウィジェットを追加', _columns: { widgets: 'ウィジェット' } } } } }));
vi.mock('@/deck.js', () => ({ addColumnWidget: vi.fn(), removeColumnWidget: vi.fn(), setColumnWidgets: vi.fn(), updateColumnWidget: vi.fn() }));
vi.mock('../deck/column.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { menu: { type: Array as PropType<{ text: string; action: () => void }[]>, required: true } },
		setup: (props, { slots }) => () => render('section', [
			...props.menu.map(item => render('button', { 'data-column-menu-item': true, onClick: item.action }, item.text)),
			...(slots.default?.() ?? []),
		]),
	}) };
});
vi.mock('@/components/MkWidgets.vue', async () => {
	const { defineComponent, h: render, ref: state, onUnmounted } = await import('vue');
	return { default: defineComponent({
		props: { edit: Boolean, widgets: { type: Array, required: true } },
		emits: ['addWidget', 'removeWidget', 'updateWidget', 'updateWidgets', 'exit'],
		setup(props, { emit }) {
			lifecycle.mounts++;
			onUnmounted(() => lifecycle.unmounts++);
			const draft = state('書きかけ');
			return () => render('div', { 'data-widgets': true, 'data-editing': props.edit }, [
				render('textarea', { value: draft.value, onInput: (event: Event) => { draft.value = (event.target as HTMLTextAreaElement).value; } }),
				render('button', { 'data-save': true, onClick: () => emit('updateWidget', { id: 'memo', data: { text: draft.value } }) }, '保存'),
				props.edit ? render('button', { 'data-exit': true, onClick: () => emit('exit') }, '編集を終了') : null,
			]);
		},
	}) };
});

let app: App | undefined;
let host: HTMLDivElement;
let controller: InstanceType<typeof Widgets> | undefined;
const warnings: string[] = [];

function element<T extends Element = HTMLElement>(selector: string): T {
	const found = host.querySelector<T>(selector);
	if (!found) throw new Error(`Missing element: ${selector}`);
	return found;
}

async function mountRightBar(props: Record<string, unknown> = {}) {
	const collapsed = ref(false);
	app = createApp({ render: () => h(Widgets, {
		collapsible: true, collapsed: collapsed.value, ...props,
		onToggleCollapse: () => { collapsed.value = !collapsed.value; },
		ref: value => { controller = value as InstanceType<typeof Widgets>; },
	}) });
	app.directive('tooltip', {});
	app.config.warnHandler = warning => warnings.push(warning);
	app.mount(host);
	controller?.setWidgetEditMode(false);
	await nextTick();
	return collapsed;
}

beforeEach(() => {
	host = window.document.createElement('div'); window.document.body.append(host);
	vi.clearAllMocks(); lifecycle.mounts = 0; lifecycle.unmounts = 0; warnings.length = 0;
	prefer.r.animation.value = false;
});
afterEach(async () => {
	controller?.setWidgetEditMode(false); await nextTick();
	app?.unmount(); app = undefined; controller = undefined; host.remove();
	vi.clearAllTimers(); vi.useRealTimers();
	expect(warnings).toEqual([]);
});

describe('widget controls in sidebars and decks', () => {
	test('collapsing preserves the editor, draft, focus and saved widget settings', async () => {
		const collapsed = await mountRightBar();
		element<HTMLButtonElement>('[data-cy-widget-edit]').click(); await nextTick();
		const input = element<HTMLTextAreaElement>('textarea');
		input.value = 'まだ保存していないメモ'; input.dispatchEvent(new Event('input'));
		const content = element('[data-widgets]');
		const toggle = element<HTMLButtonElement>('[aria-expanded]');
		expect(toggle.getAttribute('aria-controls')).toBe(content.id);
		toggle.focus(); toggle.click(); await nextTick();
		expect(collapsed.value).toBe(true);
		expect(content.style.display).toBe('none');
		expect(element<HTMLButtonElement>('[data-cy-widget-edit]').disabled).toBe(true);
		expect(element('[data-cy-widget-edit]').getAttribute('aria-hidden')).toBe('true');
		expect(content.hasAttribute('inert')).toBe(true);
		expect(toggle.querySelector('.ti-chevron-left')).not.toBeNull();
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(window.document.activeElement).toBe(toggle);
		expect(prefer.commit).not.toHaveBeenCalled();
		toggle.click(); await nextTick();
		expect(element('[data-widgets]')).toBe(content);
		expect(content.style.display).toBe('');
		expect(content.hasAttribute('inert')).toBe(false);
		expect(element<HTMLButtonElement>('[data-cy-widget-edit]').disabled).toBe(false);
		expect(element<HTMLTextAreaElement>('textarea').value).toBe('まだ保存していないメモ');
		expect(content.dataset.editing).toBe('true');
		expect(lifecycle.mounts).toBe(1); expect(lifecycle.unmounts).toBe(0);
		element<HTMLButtonElement>('[data-save]').click();
		expect(prefer.commit).toHaveBeenCalledWith('widgets', [{ id: 'memo', name: 'memo', place: null, data: { text: 'まだ保存していないメモ' } }]);
	});
	test('reversing an in-progress collapse keeps the same content and active toggle', async () => {
		vi.useFakeTimers();
		prefer.r.animation.value = true;
		await mountRightBar();
		const content = element('[data-widgets]');
		// Happy DOM does not load SFC CSS. Supply a duration to exercise Vue's real transition lifecycle.
		content.style.transitionProperty = 'opacity';
		content.style.transitionDuration = '.14s';
		content.style.transitionDelay = '0s';
		const input = element<HTMLTextAreaElement>('textarea');
		input.value = '開閉中の下書き'; input.dispatchEvent(new Event('input'));
		const toggle = element<HTMLButtonElement>('[aria-expanded]');
		toggle.focus(); toggle.click(); await nextTick();
		expect(content.style.display).toBe('');
		expect(content.hasAttribute('inert')).toBe(true);
		expect(content.getAttribute('aria-hidden')).toBe('true');
		await vi.advanceTimersByTimeAsync(50);
		toggle.click(); await nextTick();
		await vi.advanceTimersByTimeAsync(400);
		expect(element('[data-widgets]')).toBe(content);
		expect(content.style.display).toBe('');
		expect(content.hasAttribute('inert')).toBe(false);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(window.document.activeElement).toBe(toggle);
		expect(input.value).toBe('開閉中の下書き');
		expect(lifecycle.mounts).toBe(1); expect(lifecycle.unmounts).toBe(0);
		toggle.click(); await nextTick();
		await vi.advanceTimersByTimeAsync(400);
		expect(content.style.display).toBe('none');
		expect(content.hasAttribute('inert')).toBe(true);
		prefer.r.animation.value = false;
		toggle.click(); await nextTick();
		expect(content.style.display).toBe('');
		toggle.click(); await nextTick();
		expect(content.style.display).toBe('none');
		expect(prefer.commit).not.toHaveBeenCalled();
	});
	test('both toolbar buttons have accessible names without visible text', async () => {
		await mountRightBar();
		const buttons = [...element('[role="group"]').querySelectorAll('button')];
		expect(buttons).toHaveLength(2);
		for (const button of buttons) {
			expect(button.textContent.trim()).toBe('');
			expect(button.getAttribute('aria-label')).toBeTruthy();
			expect(button.querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
		}
	});
	test('Hataskey deck omits the toolbar and edits through its column controller', async () => {
		await mountRightBar({ deckEmbedded: true, collapsed: true });
		expect(host.querySelector('[aria-expanded]')).toBeNull();
		expect(host.querySelector('[data-cy-widget-edit]')).toBeNull();
		const content = element('[data-widgets]');
		expect(content.parentElement?.firstElementChild).toBe(content);
		expect(content.style.display).toBe('');
		controller?.toggleWidgetEditMode(); await nextTick();
		expect(controller?.getWidgetEditMode()).toBe(true);
		expect(content.dataset.editing).toBe('true');
		element<HTMLButtonElement>('[data-exit]').click(); await nextTick();
		expect(controller?.getWidgetEditMode()).toBe(false);
		controller?.setWidgetEditMode(true); await nextTick();
		controller?.toggleWidgetEditMode(); await nextTick();
		expect(content.dataset.editing).toBe('false');
	});
	test('a mobile drawer provides editing without a desktop collapse control', async () => {
		await mountRightBar({ collapsible: false, collapsed: true });
		expect(host.querySelector('[aria-expanded]')).toBeNull();
		expect(element('[data-widgets]').style.display).toBe('');
		expect(element('[data-cy-widget-edit]').getAttribute('aria-label')).toBe('ウィジェットを編集');
	});
	test('the standard deck omits the toolbar and edits its own widgets through the column menu', async () => {
		const column: Column = { id: 'deck-widgets', type: 'widgets', name: null, width: 350, widgets: [{ id: 'memo', name: 'memo', data: {} }] };
		app = createApp(WidgetsColumn, { column, isStacked: false });
		app.directive('tooltip', {}); app.config.warnHandler = warning => warnings.push(warning); app.mount(host); await nextTick();
		expect(host.querySelector('[aria-expanded]')).toBeNull();
		expect(host.querySelector('[data-cy-widget-edit]')).toBeNull();
		const content = element('[data-widgets]');
		expect(content.parentElement?.firstElementChild).toBe(content);
		const editMenuItem = element<HTMLButtonElement>('[data-column-menu-item]');
		expect(editMenuItem.textContent).toBe('ウィジェットを編集');
		editMenuItem.click(); await nextTick();
		expect(element('[data-widgets]').dataset.editing).toBe('true');
		element<HTMLButtonElement>('[data-save]').click();
		expect(updateColumnWidget).toHaveBeenCalledWith('deck-widgets', 'memo', { text: '書きかけ' });
		expect(prefer.commit).not.toHaveBeenCalled();
		element<HTMLButtonElement>('[data-exit]').click(); await nextTick();
		expect(content.dataset.editing).toBe('false');
		editMenuItem.click(); await nextTick();
		expect(content.dataset.editing).toBe('true');
	});
});
