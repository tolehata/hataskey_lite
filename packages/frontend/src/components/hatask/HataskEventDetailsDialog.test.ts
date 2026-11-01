/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Fixtures exercise dialog lifecycles within theme, KeepAlive, and Teleport parents. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { KeepAlive, Teleport, createApp, defineComponent, h, nextTick, onDeactivated, ref, shallowReactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/components/HataskEmoji.vue', async () => {
	const { defineComponent: defineMockComponent, h: renderNode } = await import('vue');
	return { default: defineMockComponent({ props: { emoji: { type: String, default: '' } }, setup: props => () => renderNode('span', { 'data-test-emoji': '' }, props.emoji) }) };
});
vi.mock('@/os.js', () => ({ claimZIndex: vi.fn(() => 2000) }));

import HataskEventDetailsDialog from './HataskEventDetailsDialog.vue';
import type { App, VNodeChild } from 'vue';
import type { HataskEventDetails, HataskEventDetailsLabels, HataskEventRsvpStatus } from './hatask-event-details-types.js';
import { claimZIndex } from '@/os.js';

type DialogProps = {
	isOpen: boolean;
	event: HataskEventDetails | null;
	labels: HataskEventDetailsLabels;
	readOnly: boolean;
	busy: boolean;
	returnFocusTo?: HTMLElement | null;
	animations?: boolean;
	getAnchor?: () => HTMLElement | null;
	getAnchorRect?: (anchor: HTMLElement) => { left: number; right: number; top: number; bottom: number };
};
type DialogSlots = { body?: () => VNodeChild; footer?: () => VNodeChild };
type Mounted = { app: App<Element>; container: HTMLDivElement; opener: HTMLButtonElement; disposed: boolean };
const mounted: Mounted[] = [];
const geometryCleanups: Array<() => void> = [];
const statuses: HataskEventRsvpStatus[] = ['going', 'maybe', 'declined'];
const labels: HataskEventDetailsLabels = {
	details: '予定の詳細', 'close': '閉じる', dateAndTime: '日時', visibility: '公開範囲', organizer: '主催者',
	recurrence: '繰り返し', notificationTiming: '通知', readOnly: '読み取り専用',
	rsvpDashboard: '出欠の集計', rsvp: '出欠を回答', closed: '受付終了', accepting: '受付中',
	rsvpParticipation: '参加', rsvpGoing: '参加する', rsvpMaybe: '未定', rsvpDeclined: '不参加',
	total: '合計', noResponses: 'まだ回答がありません', closeRsvp: '出欠の受付を終了',
	publicEventWithoutRsvp: 'この公開予定には出欠の受付がありません', edit: '編集', delete: '削除',
};

function eventDetails(overrides: Partial<HataskEventDetails> = {}): HataskEventDetails {
	return {
		id: 'event-1', title: '図書館で資料を受け取る', emoji: '📚', color: '#1677aa',
		dateLabel: '2026年9月6日（日） – 2026年9月8日（火）', timeLabel: '10:00 – 11:30',
		visibilityLabel: '自分のみ', isPublic: false, ownerLabel: '@owner', canEdit: true, isOwner: true,
		...overrides,
	};
}

function publicEvent(overrides: Partial<HataskEventDetails> = {}): HataskEventDetails {
	return eventDetails({
		isPublic: true, visibilityLabel: '公開', isOwner: false, canEdit: false,
		rsvp: {
			closed: false, myStatus: 'maybe', responses: [
				{ userId: 'one', username: 'one', status: 'going' },
				{ userId: 'two', username: 'two', status: 'going' },
				{ userId: 'three', username: 'three', status: 'maybe' },
				{ userId: 'four', username: 'four', status: 'declined' },
			],
		},
		...overrides,
	});
}

async function settle(): Promise<void> { await nextTick(); await nextTick(); await nextTick(); await nextTick(); }

function required<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
	const result = container.querySelector<T>(selector);
	if (!result) throw new Error(`Required dialog element was not rendered: ${selector}`);
	return result;
}

function action(container: ParentNode, name: string): HTMLButtonElement {
	return required<HTMLButtonElement>(container, `[data-hatask-event-detail-action="${name}"]`);
}

async function mountDetails(options: Partial<DialogProps> = {}, slots: DialogSlots = {}) {
	const opener = window.document.createElement('button');
	opener.textContent = '予定ボタン';
	window.document.body.append(opener);
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const desiredOpen = options.isOpen ?? true;
	const state = shallowReactive<DialogProps>({ event: eventDetails(), labels, readOnly: false, busy: false, animations: false, returnFocusTo: opener, ...options, isOpen: false });
	const mode = ref<'light' | 'dark'>('light');
	const handlers = { 'close': vi.fn(), edit: vi.fn(), delete: vi.fn(), rsvp: vi.fn(), closeRsvp: vi.fn(), focusFallback: vi.fn() };
	const app = createApp(defineComponent({
		setup: () => () => h('section', {
			'data-test-theme-root': '', 'data-hatask-theme': 'akatsuki', 'data-hatask-mode': mode.value,
			style: { '--bg': mode.value === 'dark' ? '#15101c' : '#fff3ec', '--fg': mode.value === 'dark' ? '#f9ebf6' : '#342437' },
		}, [
			h('button', { 'data-test-background': '' }, '背景の操作'),
			h(HataskEventDetailsDialog, {
				...state, 'data-hatask-theme': 'akatsuki', 'data-hatask-mode': mode.value,
				onClose: () => { handlers.close(); state.isOpen = false; },
				onEdit: handlers.edit, onDelete: handlers.delete, onRsvp: handlers.rsvp, onCloseRsvp: handlers.closeRsvp, onFocusFallback: handlers.focusFallback,
			}, slots),
		]),
	}));
	app.mount(container);
	const instance = { app, container, opener, disposed: false };
	mounted.push(instance);
	await settle();
	opener.focus();
	state.isOpen = desiredOpen;
	await settle();
	const unmount = async () => { app.unmount(); instance.disposed = true; await settle(); };
	return { container, opener, state, mode, handlers, unmount };
}

/** Real component DOM with only layout measurements supplied by the fixture. */
function mockPopoverGeometry(options: { width?: number; height?: number; anchor?: { left: number; top: number; width: number; height: number }; contentHeight?: number } = {}) {
	const viewport = { width: options.width ?? 1000, height: options.height ?? 800, offsetLeft: 0, offsetTop: 0 };
	const layoutViewport = { width: viewport.width, height: viewport.height };
	const anchorBox = { left: 240, top: 20, width: 120, height: 40, ...options.anchor };
	const content = { height: options.contentHeight ?? 260 };
	const naturalMeasureWidths: string[] = [];
	const anchor = window.document.createElement('button');
	anchor.dataset.testCalendarAnchor = ''; anchor.textContent = '9月6日の予定'; window.document.body.append(anchor);
	const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({ left, top, width, height }) });
	const realRect = HTMLElement.prototype.getBoundingClientRect;
	const measurements = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
		if (this === anchor) return rect(anchorBox.left, anchorBox.top, anchorBox.width, anchorBox.height);
		if (this.dataset.hataskEventDetail === 'overlay') return rect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, viewport.width, viewport.height);
		if (this.dataset.hataskEventDetail === 'bubble' || this.dataset.hataskEventDetail === 'dialog') return rect(0, 0, 460, content.height + 130);
		if (this.dataset.hataskEventDetail === 'body') return rect(0, 0, 460, content.height);
		return realRect.call(this);
	});
	const realComputedStyle = window.getComputedStyle;
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
		const style = realComputedStyle.call(window, element, pseudo);
		if (!(element instanceof HTMLElement) || element.dataset.hataskEventDetail !== 'overlay') return style;
		// jsdom does not resolve max(12px, env(...)); expose the actual desktop gutter.
		return new Proxy(style, { get(target, key) {
			if (['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'].includes(String(key))) return '12px';
			const value: unknown = Reflect.get(target, key, target);
			return typeof value === 'function' ? value.bind(target) : value;
		} });
	});
	const restoreProperty = (target: object, key: PropertyKey, get: () => unknown) => {
		const previous = Object.getOwnPropertyDescriptor(target, key);
		Object.defineProperty(target, key, { configurable: true, get });
		geometryCleanups.push(() => { if (previous) Object.defineProperty(target, key, previous); else Reflect.deleteProperty(target, key); });
	};
	restoreProperty(window, 'innerWidth', () => layoutViewport.width);
	restoreProperty(window, 'innerHeight', () => layoutViewport.height);
	restoreProperty(window.document.documentElement, 'clientWidth', () => layoutViewport.width);
	restoreProperty(window.document.documentElement, 'clientHeight', () => layoutViewport.height);
	for (const property of ['offsetWidth', 'clientWidth'] as const) {
		const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get;
		const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
		Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get(this: HTMLElement) {
			if (this.dataset.hataskEventDetail === 'overlay') return viewport.width;
			if (['bubble', 'dialog', 'body'].includes(this.dataset.hataskEventDetail ?? '')) return 460;
			if (this === anchor) return anchorBox.width;
			return previous?.call(this) ?? 0;
		} });
		geometryCleanups.push(() => { if (descriptor) Object.defineProperty(HTMLElement.prototype, property, descriptor); else Reflect.deleteProperty(HTMLElement.prototype, property); });
	}
	for (const property of ['offsetHeight', 'clientHeight', 'scrollHeight'] as const) {
		const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)?.get;
		const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
		Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get(this: HTMLElement) {
			if (this.dataset.hataskEventDetail === 'overlay') return viewport.height;
			if (this.dataset.hataskEventDetail === 'body') {
				if (property === 'scrollHeight') naturalMeasureWidths.push(this.closest<HTMLElement>('[data-hatask-event-detail="bubble"]')?.style.width ?? '');
				return content.height;
			}
			if (this.matches('[data-hatask-event-detail="dialog"] > header, [data-hatask-event-detail="dialog"] > footer')) return 64;
			if (['bubble', 'dialog'].includes(this.dataset.hataskEventDetail ?? '')) return content.height + 130;
			if (this === anchor) return anchorBox.height;
			return previous?.call(this) ?? 0;
		} });
		geometryCleanups.push(() => { if (descriptor) Object.defineProperty(HTMLElement.prototype, property, descriptor); else Reflect.deleteProperty(HTMLElement.prototype, property); });
	}
	const visualViewport = new EventTarget();
	for (const key of ['width', 'height', 'offsetLeft', 'offsetTop'] as const) Object.defineProperty(visualViewport, key, { get: () => viewport[key] });
	restoreProperty(window, 'visualViewport', () => visualViewport);
	const observerRecords: Array<{ targets: Set<Element>; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; notify: () => void }> = [];
	class GeometryResizeObserver {
		private readonly targets = new Set<Element>();
		readonly observe = vi.fn((target: Element) => { this.targets.add(target); });
		readonly unobserve = vi.fn((target: Element) => { this.targets.delete(target); });
		readonly disconnect = vi.fn(() => { this.targets.clear(); });
		constructor(callback: ResizeObserverCallback) {
			observerRecords.push({ targets: this.targets, observe: this.observe, disconnect: this.disconnect, notify: () => {
				if (this.targets.size) callback([...this.targets].map(target => ({ target, contentRect: target.getBoundingClientRect() }) as ResizeObserverEntry), this as unknown as ResizeObserver);
			} });
		}
	}
	const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
	Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, writable: true, value: GeometryResizeObserver });
	geometryCleanups.push(() => { if (originalResizeObserver) Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserver); else Reflect.deleteProperty(globalThis, 'ResizeObserver'); });
	const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { const id = ++nextFrame; frames.set(id, callback); return id; });
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
	const flush = async () => {
		await settle();
		for (let step = 0; step < 6 && frames.size > 0; step++) {
			const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(performance.now());
			await settle();
		}
	};
	geometryCleanups.push(() => { anchor.remove(); });
	return { viewport, layoutViewport, anchorBox, content, anchor, measurements, naturalMeasureWidths, observerRecords, visualViewport, frames, flush };
}

afterEach(async () => {
	for (const item of mounted.splice(0)) {
		if (!item.disposed) item.app.unmount();
		await settle();
		item.container.remove();
		item.opener.remove();
	}
	for (const cleanup of geometryCleanups.splice(0).reverse()) cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

describe('HataskEventDetailsDialog', () => {
	test('一度も開いていない初期状態ではフォーカスの代替移動を要求しない', async () => {
		const { container, handlers } = await mountDetails({ isOpen: false });
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(handlers.focusFallback).not.toHaveBeenCalled();
	});

	test('表示条件、初期フォーカス、背景inertと実起点への復帰を再オープンまで保つ', async () => {
		const { container, opener, state, handlers } = await mountDetails({ isOpen: false });
		const background = required<HTMLElement>(container, '[data-test-background]');
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		state.isOpen = true;
		await settle();
		const dialog = required(container, '[role="dialog"]');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		const labelIds = dialog.getAttribute('aria-labelledby')?.split(/\s+/u) ?? [];
		expect(labelIds).toHaveLength(2);
		const labelElements = labelIds.map(id => window.document.getElementById(id));
		for (const element of labelElements) expect(element).not.toBeNull();
		expect(labelElements.map(element => element?.textContent)).toEqual([labels.details, state.event?.title]);
		expect(window.document.activeElement).toBe(action(container, 'close'));
		expect(background.inert).toBe(true);
		expect(opener.inert).toBe(true);
		expect(claimZIndex).toHaveBeenCalledWith('middle');
		action(container, 'close').click();
		await settle();
		expect(handlers.close).toHaveBeenCalledTimes(1);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(background.inert).toBe(false);
		expect(opener.inert).toBe(false);
		expect(window.document.activeElement).toBe(opener);
		state.isOpen = true;
		await settle();
		expect(window.document.activeElement).toBe(action(container, 'close'));
		expect(background.inert).toBe(true);
		expect(claimZIndex).toHaveBeenCalledTimes(2);
		state.event = null;
		await settle();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(background.inert).toBe(false);
		expect(window.document.activeElement).toBe(opener);
	});

	test('Escapeは外側へ伝播せず詳細だけを閉じる', async () => {
		const outerKeydown = vi.fn();
		window.addEventListener('keydown', outerKeydown);
		try {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			expect(outerKeydown).toHaveBeenCalledOnce();
			outerKeydown.mockClear();
			const { container, opener, handlers } = await mountDetails();
			const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
			action(container, 'close').dispatchEvent(escape);
			await settle();
			expect(escape.defaultPrevented).toBe(true);
			expect(outerKeydown).not.toHaveBeenCalled();
			expect(handlers.close).toHaveBeenCalledOnce();
			expect(window.document.activeElement).toBe(opener);
		} finally { window.removeEventListener('keydown', outerKeydown); }
	});

	test('TabとShift+Tabはダイアログの端で循環し、途中のTabは既定動作を保つ', async () => {
		const { container } = await mountDetails();
		const first = action(container, 'close');
		const last = action(container, 'close-footer');
		last.focus();
		const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		last.dispatchEvent(forward);
		expect(forward.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(first);
		const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
		first.dispatchEvent(backward);
		expect(backward.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(last);
		const middle = action(container, 'edit');
		middle.focus();
		const normal = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		middle.dispatchEvent(normal);
		expect(normal.defaultPrevented).toBe(false);
	});

	test('背景だけを押した場合に閉じ、本文クリックでは閉じない', async () => {
		const { container, handlers } = await mountDetails();
		required<HTMLElement>(container, '[data-hatask-event-detail="title"]').click();
		expect(handlers.close).not.toHaveBeenCalled();
		required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]').click();
		await settle();
		expect(handlers.close).toHaveBeenCalledOnce();
	});

	test('開いたままのunmountでも背景を戻し起点へフォーカスを返す', async () => {
		const { container, opener, unmount } = await mountDetails();
		const background = required<HTMLElement>(container, '[data-test-background]');
		expect(background.inert).toBe(true);
		await unmount();
		expect(background.inert).toBe(false);
		expect(opener.inert).toBe(false);
		expect(window.document.activeElement).toBe(opener);
	});

	test('KeepAlive内のページ離脱でbodyへのTeleportを閉じ、実focusTrapの背景inertを解除する', async () => {
		const opener = window.document.createElement('button');
		opener.textContent = 'カレンダーの予定';
		const container = window.document.createElement('div');
		window.document.body.append(opener, container);
		const active = ref(true);
		const isOpen = ref(false);
		const deactivated = vi.fn();
		const Page = defineComponent({
			setup() {
				onDeactivated(() => { deactivated(); isOpen.value = false; });
				return () => h('section', { 'data-test-cached-page': '' }, [
					h(Teleport, { to: 'body' }, h(HataskEventDetailsDialog, {
						isOpen: isOpen.value, event: eventDetails(), labels, readOnly: false, busy: false,
						returnFocusTo: opener, animations: false, onClose: () => { isOpen.value = false; },
					})),
				]);
			},
		});
		const OtherPage = defineComponent({ setup: () => () => h('div', { 'data-test-other-page': '' }, '別のページ') });
		const app = createApp({ render: () => h(KeepAlive, null, { default: () => active.value ? h(Page) : h(OtherPage) }) });
		app.mount(container);
		mounted.push({ app, container, opener, disposed: false });
		await settle();
		opener.focus();
		isOpen.value = true;
		await settle();
		const overlay = required<HTMLElement>(window.document.body, '[data-hatask-event-detail="overlay"]');
		expect(overlay.parentElement).toBe(window.document.body);
		expect(container.inert).toBe(true);
		expect(opener.inert).toBe(true);
		expect(window.document.activeElement).toBe(action(overlay, 'close'));
		active.value = false;
		await settle();
		expect(deactivated).toHaveBeenCalledOnce();
		expect(isOpen.value).toBe(false);
		expect(window.document.querySelector('[data-hatask-event-detail="overlay"]')).toBeNull();
		expect(container.inert).toBe(false);
		expect(opener.inert).toBe(false);
		expect(container.querySelector('[data-test-other-page]')).not.toBeNull();
		active.value = true;
		await settle();
		expect(container.querySelector('[data-test-cached-page]')).not.toBeNull();
		expect(window.document.querySelector('[data-hatask-event-detail="overlay"]')).toBeNull();
		expect(container.inert).toBe(false);
	});

	test('閉じた直後の再オープンで古い復帰処理が新しいフォーカスを奪わない', async () => {
		const { container, state } = await mountDetails();
		state.isOpen = false;
		await nextTick();
		state.isOpen = true;
		await settle();
		expect(window.document.activeElement).toBe(action(container, 'close'));
		expect(required<HTMLElement>(container, '[data-test-background]').inert).toBe(true);
	});

	test('既に別の操作へ移ったフォーカスや撤去済み起点を追いかけない', async () => {
		const { container, opener, state, handlers } = await mountDetails();
		const nextControl = window.document.createElement('button');
		nextControl.textContent = '次に開いた編集画面';
		window.document.body.append(nextControl);
		try {
			nextControl.focus();
			state.isOpen = false;
			await settle();
			expect(window.document.activeElement).toBe(nextControl);
			expect(handlers.focusFallback).not.toHaveBeenCalled();
			state.isOpen = true;
			await settle();
			opener.remove();
			action(container, 'close').click();
			await settle();
			expect(window.document.activeElement).not.toBe(opener);
			expect(nextControl.inert).toBe(false);
			expect(handlers.focusFallback).toHaveBeenCalledOnce();
		} finally { nextControl.remove(); }
	});

	test.each(['display-none', 'hidden'] as const)('起点の祖先が%sになった場合は隠れたボタンでなく親へ代替フォーカスを要求する', async hiddenMode => {
		const { container, opener, state, handlers } = await mountDetails({ isOpen: false });
		const originPanel = window.document.createElement('section');
		window.document.body.append(originPanel);
		originPanel.append(opener);
		try {
			opener.focus();
			state.isOpen = true;
			await settle();
			expect(originPanel.inert).toBe(true);
			expect(window.document.activeElement).toBe(action(container, 'close'));
			if (hiddenMode === 'hidden') originPanel.hidden = true;
			else originPanel.style.display = 'none';
			action(container, 'close').click();
			await settle();
			expect(originPanel.inert).toBe(false);
			expect(opener.inert).not.toBe(true);
			expect(window.document.activeElement).not.toBe(opener);
			expect(handlers.focusFallback).toHaveBeenCalledOnce();
		} finally {
			window.document.body.append(opener);
			originPanel.remove();
		}
	});

	test('長い予定名、日付範囲、時刻、繰り返し説明を全文表示する', async () => {
		const event = eventDetails({ title: '資料の整理と次の打ち合わせに向けた準備'.repeat(8), recurrenceLabel: '毎週日曜日', recurrenceHint: 'この予定を変更すると今後の繰り返しにも反映されます', notificationLabel: '開始の30分前', syncLabel: '外部カレンダーと同期中' });
		const original = JSON.stringify(event);
		const { container } = await mountDetails({ event });
		expect(required(container, '[data-hatask-event-detail="title"]').textContent).toBe(event.title);
		expect(required(container, '[data-hatask-event-detail="date"] strong').textContent).toBe(event.dateLabel);
		expect(required(container, '[data-hatask-event-detail="date"]').textContent).toContain(event.timeLabel);
		expect(required(container, '[data-hatask-event-detail="recurrence-hint"]').textContent).toBe(event.recurrenceHint);
		expect(container.textContent).toContain(event.notificationLabel);
		expect(required(container, '[data-hatask-event-detail="sync"]').textContent).toContain(event.syncLabel);
		expect(container.querySelector('[data-test-emoji]')?.textContent).toBe('📚');
		expect(JSON.stringify(event)).toBe(original);
	});

	test('編集可能な予定だけ編集と削除を通知し、他者の予定に操作を出さない', async () => {
		const { container, state, handlers } = await mountDetails();
		const editButton = action(container, 'edit');
		const deleteButton = action(container, 'delete');
		editButton.click();
		deleteButton.click();
		expect(handlers.edit).toHaveBeenCalledOnce();
		expect(handlers.delete).toHaveBeenCalledOnce();
		state.event = eventDetails({ isOwner: false, canEdit: false });
		await settle();
		expect(container.querySelector('[data-hatask-event-detail-action="edit"]')).toBeNull();
		expect(container.querySelector('[data-hatask-event-detail-action="delete"]')).toBeNull();
		editButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(handlers.edit).toHaveBeenCalledOnce();
		expect(handlers.delete).toHaveBeenCalledOnce();
		expect(handlers.close).not.toHaveBeenCalled();
	});

	test.each([{ readOnly: true, busy: false }, { readOnly: false, busy: true }])('readOnly=$readOnly / busy=$busy では主催者操作を無効化し閉じる操作を保つ', async flags => {
		const { container, handlers } = await mountDetails({ ...flags, event: publicEvent({ isOwner: true, canEdit: true }) });
		for (const name of ['edit', 'delete', 'close-rsvp']) {
			expect(action(container, name).disabled).toBe(true);
			action(container, name).click();
			action(container, name).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		expect(handlers.edit).not.toHaveBeenCalled();
		expect(handlers.delete).not.toHaveBeenCalled();
		expect(handlers.closeRsvp).not.toHaveBeenCalled();
		expect(required(container, '[role="dialog"]').getAttribute('aria-busy')).toBe(String(flags.busy));
		expect(action(container, 'close').disabled).toBe(false);
		action(container, 'close').click();
		await settle();
		expect(handlers.close).toHaveBeenCalledOnce();
	});

	test.each(statuses)('RSVPの%sを表示・通知し入力された回答一覧を変更しない', async status => {
		const event = publicEvent();
		if (!event.rsvp) throw new Error('RSVP fixture is required');
		event.rsvp.myStatus = status;
		const original = JSON.stringify(event);
		const { container, handlers } = await mountDetails({ event });
		for (const option of statuses) expect(action(container, option).getAttribute('aria-pressed')).toBe(String(status === option));
		expect(required(container, '[data-hatask-event-detail="answers"]').querySelectorAll('button')).toHaveLength(3);
		action(container, status).click();
		expect(handlers.rsvp).toHaveBeenCalledWith(status);
		expect(handlers.rsvp).toHaveBeenCalledTimes(1);
		expect(container.querySelector('[data-hatask-event-detail-action="close-rsvp"]')).toBeNull();
		expect(JSON.stringify(event)).toBe(original);
	});

	test.each([
		{ readOnly: true, busy: false, closed: false },
		{ readOnly: false, busy: true, closed: false },
		{ readOnly: false, busy: false, closed: true },
	])('回答不可の状態では出欠を通知しない ($readOnly/$busy/$closed)', async ({ readOnly, busy, closed }) => {
		const event = publicEvent();
		if (!event.rsvp) throw new Error('RSVP fixture is required');
		event.rsvp.closed = closed;
		const { container, handlers } = await mountDetails({ readOnly, busy, event });
		for (const status of statuses) {
			expect(action(container, status).disabled).toBe(true);
			action(container, status).click();
			action(container, status).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		expect(handlers.rsvp).not.toHaveBeenCalled();
		expect(required(container, '[data-hatask-event-detail="current-response"]').textContent).toContain(labels.rsvpMaybe);
		if (closed) expect(container.textContent).toContain(labels.closed);
	});

	test('主催者に状態別集計と回答者を表示し、締切後は受付終了を実行できない', async () => {
		const event = publicEvent({ isOwner: true, canEdit: true });
		const { container, state, handlers } = await mountDetails({ event });
		expect(container.textContent).toContain(labels.rsvpDashboard);
		expect(container.querySelector('[data-hatask-event-detail="answers"]')).toBeNull();
		for (const [status, count] of [['going', '2'], ['maybe', '1'], ['declined', '1'], ['total', '4']]) expect(required(container, `[data-hatask-event-detail="counts"] [data-status="${status}"] strong`).textContent).toBe(count);
		for (const name of ['one', 'two', 'three', 'four']) expect(container.textContent).toContain(`@${name}`);
		action(container, 'close-rsvp').click();
		expect(handlers.closeRsvp).toHaveBeenCalledOnce();
		if (!event.rsvp) throw new Error('RSVP fixture is required');
		state.event = { ...event, rsvp: { ...event.rsvp, closed: true } };
		await settle();
		expect(container.querySelector('[data-hatask-event-detail-action="close-rsvp"]')).toBeNull();
		expect(container.textContent).toContain(labels.closed);
	});

	test('回答なしとRSVPを持たない公開予定を区別して表示する', async () => {
		const { container, state } = await mountDetails({ event: publicEvent({ rsvp: { closed: false, myStatus: null, responses: [] } }) });
		expect(container.textContent).toContain(labels.noResponses);
		expect(required(container, '[data-hatask-event-detail="counts"] [data-status="total"] strong').textContent).toBe('0');
		state.event = publicEvent({ rsvp: null });
		await settle();
		expect(container.querySelector('[data-hatask-event-detail="rsvp"]')).toBeNull();
		expect(required(container, '[data-hatask-event-detail="without-rsvp"]').textContent).toContain(labels.publicEventWithoutRsvp);
	});

	test('明暗テーマの属性と継承経路を保ち、切替時にダイアログを作り直さない', async () => {
		const { container, mode } = await mountDetails();
		const themeRoot = required<HTMLElement>(container, '[data-test-theme-root]');
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		const dialog = required(container, '[role="dialog"]');
		for (const value of ['light', 'dark'] as const) {
			mode.value = value;
			await settle();
			expect(overlay.getAttribute('data-hatask-theme')).toBe('akatsuki');
			expect(overlay.getAttribute('data-hatask-mode')).toBe(value);
			expect(overlay.closest('[data-test-theme-root]')).toBe(themeRoot);
			expect(themeRoot.style.getPropertyValue('--bg')).toBe(value === 'dark' ? '#15101c' : '#fff3ec');
			expect(required(container, '[role="dialog"]')).toBe(dialog);
		}
		expect(overlay.getAttribute('data-motion')).toBe('false');
	});

	test('CSSはコンテナ幅・dvh・safe area・縮む本文・縮小モーションを備える', () => {
		// Source contracts only: this does not claim real-browser layout or contrast QA.
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskEventDetailsDialog.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const css = parsed.descriptor.styles[0]?.content;
		if (!css) throw new Error('The actual dialog stylesheet is required');
		expect(css).toContain('container: hatask-event-details / inline-size');
		expect(css).toContain('@container hatask-event-details (max-width: 560px)');
		expect(css).toContain('100dvh');
		for (const side of ['top', 'right', 'bottom', 'left']) expect(css).toContain(`env(safe-area-inset-${side})`);
		expect(css).toContain('grid-template-rows: auto minmax(0, 1fr) auto');
		expect(css).toMatch(/\.body\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/u);
		expect(css).toMatch(/\.eventHeading h3\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/u);
		expect(css).toContain('@media (prefers-reduced-motion: reduce)');
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none;/u);
		expect(css).toMatch(/button:focus-visible\s*\{[^}]*outline:/u);
		expect(css).toContain('color: var(--fg)');
		expect(css).toContain('background: var(--surface)');
	});
});

describe('予定のないカレンダー操作でも既存の吹き出し枠を再利用する', () => {
	test('body slotがあれば予定なしでも名前・初期focus・背景inert・閉鎖後の復帰を保つ', async () => {
		const slotLabels = { ...labels, details: '9月6日の操作' };
		const { container, opener, state, handlers } = await mountDetails({ event: null, labels: slotLabels }, {
			body: () => h('button', { 'data-test-slot-action': '' }, '新しい予定を追加'),
		});
		const dialog = required(container, '[role="dialog"]');
		const labelIds = dialog.getAttribute('aria-labelledby')?.split(/\s+/u) ?? [];
		expect(labelIds).toHaveLength(1);
		expect(window.document.getElementById(labelIds[0])?.textContent).toBe(slotLabels.details);
		expect(required(container, '[data-test-slot-action]').textContent).toBe('新しい予定を追加');
		expect(container.querySelector('[data-hatask-event-detail="title"]')).toBeNull();
		for (const name of ['edit', 'delete']) expect(container.querySelector(`[data-hatask-event-detail-action="${name}"]`)).toBeNull();
		expect(action(container, 'close-footer').disabled).toBe(false);
		expect(window.document.activeElement).toBe(action(container, 'close'));
		expect(required<HTMLElement>(container, '[data-test-background]').inert).toBe(true);
		expect(opener.inert).toBe(true);
		const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		required(container, '[data-test-slot-action]').dispatchEvent(escape);
		await settle();
		expect(escape.defaultPrevented).toBe(true);
		expect(handlers.close).toHaveBeenCalledOnce();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(required<HTMLElement>(container, '[data-test-background]').inert).toBe(false);
		expect(opener.inert).toBe(false);
		expect(window.document.activeElement).toBe(opener);
		state.isOpen = true;
		await settle();
		expect(window.document.activeElement).toBe(action(container, 'close'));
		action(container, 'close-footer').click();
		await settle();
		expect(handlers.close).toHaveBeenCalledTimes(2);
		expect(window.document.activeElement).toBe(opener);
	});

	test('footer slotだけでは予定なしの空枠を開かず、focusも移さない', async () => {
		const { container, opener, handlers } = await mountDetails({ event: null }, {
			footer: () => h('button', {}, '候補を選ぶ'),
		});
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(window.document.activeElement).toBe(opener);
		expect(opener.inert).not.toBe(true);
		expect(handlers.focusFallback).not.toHaveBeenCalled();
		expect(claimZIndex).not.toHaveBeenCalled();
	});

	test('本文とfooterは既存の詳細・操作を置換し、slot操作を含めてTabが循環する', async () => {
		const choose = vi.fn();
		const original = eventDetails();
		const snapshot = JSON.stringify(original);
		const { container, state, handlers } = await mountDetails({ event: original }, {
			body: () => h('input', { 'data-test-slot-input': '', 'aria-label': '予定を検索' }),
			footer: () => h('button', { 'data-test-slot-submit': '', onClick: choose }, 'この候補を選ぶ'),
		});
		for (const name of ['title', 'date', 'rsvp']) expect(container.querySelector(`[data-hatask-event-detail="${name}"]`)).toBeNull();
		for (const name of ['edit', 'delete', 'close-footer']) expect(container.querySelector(`[data-hatask-event-detail-action="${name}"]`)).toBeNull();
		const first = action(container, 'close');
		const last = required<HTMLButtonElement>(container, '[data-test-slot-submit]');
		last.click();
		expect(choose).toHaveBeenCalledOnce();
		for (const handler of [handlers.edit, handlers.delete, handlers.close]) expect(handler).not.toHaveBeenCalled();
		last.focus();
		const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		last.dispatchEvent(forward);
		expect(forward.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(first);
		const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
		first.dispatchEvent(backward);
		expect(backward.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(last);
		const dialog = required(container, '[role="dialog"]');
		state.event = null;
		await settle();
		expect(required(container, '[role="dialog"]')).toBe(dialog);
		expect(dialog.getAttribute('aria-labelledby')?.split(/\s+/u)).toHaveLength(1);
		expect(window.document.activeElement).toBe(last);
		expect(JSON.stringify(original)).toBe(snapshot);
	});

	test('slot内のstep切替と検索結果の増減だけでも自然高を再計測し、同じ枠を上下に移す', async () => {
		const geometry = mockPopoverGeometry({ contentHeight: 100, anchor: { left: 240, top: 450, width: 120, height: 40 } });
		const step = ref<'choose' | 'search'>('choose');
		const results = ref(['最初の候補']);
		const { container, state } = await mountDetails({ event: null, getAnchor: () => geometry.anchor }, {
			body: () => step.value === 'choose'
				? h('button', { 'data-test-step': 'choose' }, '予定を探す')
				: h('section', { 'data-test-step': 'search' }, results.value.map(value => h('p', { key: value }, value))),
			footer: () => h('button', {}, step.value === 'choose' ? '閉じる' : '選択に戻る'),
		});
		await geometry.flush();
		const dialog = required(container, '[role="dialog"]');
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(bubble.dataset.placement).toBe('below');
		step.value = 'search';
		results.value = ['最初の候補', '映画', 'ゲーム', '学び'];
		geometry.content.height = 900;
		await settle();
		expect(geometry.frames.size).toBe(1);
		await geometry.flush();
		expect(required(container, '[data-test-step="search"]').querySelectorAll('p')).toHaveLength(4);
		expect(bubble.dataset.placement).toBe('above');
		expect(bubble.style.top).toBe('12px');
		results.value = ['最初の候補'];
		geometry.content.height = 100;
		await geometry.flush();
		expect(bubble.dataset.placement).toBe('below');
		expect(required(container, '[role="dialog"]')).toBe(dialog);
		expect(state.event).toBeNull();
		expect(geometry.frames.size).toBe(0);
	});

	test('slot内の文字変更も検出するが、位置styleや属性の変更を再計測ループにしない', async () => {
		const geometry = mockPopoverGeometry({ contentHeight: 100, anchor: { left: 240, top: 450, width: 120, height: 40 } });
		const { container } = await mountDetails({ event: null, getAnchor: () => geometry.anchor }, {
			body: () => h('p', { 'data-test-slot-copy': '' }, '候補を検索'),
		});
		await geometry.flush();
		const copy = required<HTMLElement>(container, '[data-test-slot-copy]');
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		const initial = geometry.measurements.mock.calls.length;
		copy.style.color = 'red';
		copy.dataset.testChanged = 'true';
		await settle();
		expect(geometry.frames.size).toBe(0);
		expect(geometry.measurements.mock.calls).toHaveLength(initial);
		const textNode = copy.firstChild;
		if (!(textNode instanceof Text)) throw new Error('The rendered slot text is required');
		geometry.content.height = 900;
		textNode.data = '条件に一致する予定が見つかりました';
		await settle();
		expect(geometry.frames.size).toBe(1);
		await geometry.flush();
		expect(geometry.measurements.mock.calls.length).toBeGreaterThan(initial);
		expect(bubble.dataset.placement).toBe('above');
		expect(geometry.frames.size).toBe(0);
	});

	test('custom anchor矩形を位置に使い、実HTMLElementの監視と切替・切断時の退避を保つ', async () => {
		const geometry = mockPopoverGeometry();
		const customRect = { left: 600, right: 640, top: 700, bottom: 730 };
		const getAnchorRect = vi.fn((_anchor: HTMLElement) => customRect);
		const { container, state } = await mountDetails({ event: null, getAnchor: () => geometry.anchor, getAnchorRect }, {
			body: () => h('button', {}, '予定を追加'),
		});
		await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(getAnchorRect).toHaveBeenCalledWith(geometry.anchor);
		expect(bubble.dataset.placement).toBe('above');
		expect(bubble.style.left).toBe('390px');
		expect(geometry.observerRecords.flatMap(record => [...record.targets])).toContain(geometry.anchor);
		customRect.left = 400; customRect.right = 440;
		geometry.anchor.dispatchEvent(new Event('scroll', { bubbles: false }));
		await geometry.flush();
		expect(bubble.style.left).toBe('190px');
		state.getAnchorRect = () => ({ left: 200, right: 240, top: 20, bottom: 60 });
		await geometry.flush();
		expect(bubble.dataset.placement).toBe('below');
		expect(bubble.style.left).toBe('12px');
		state.getAnchorRect = undefined;
		await geometry.flush();
		expect(bubble.style.left).toBe('70px');
		state.getAnchorRect = getAnchorRect;
		await geometry.flush();
		const callsBeforeDisconnect = getAnchorRect.mock.calls.length;
		geometry.anchor.remove();
		window.dispatchEvent(new Event('resize'));
		await geometry.flush();
		expect(getAnchorRect.mock.calls).toHaveLength(callsBeforeDisconnect);
		expect(bubble.dataset.placement).toBe('center');
		expect(bubble.style.left).toBe('270px');
	});

	test('mobileのslot表示でも下寄せとfocusを維持し、custom矩形を参照しない', async () => {
		const geometry = mockPopoverGeometry({ width: 400 });
		const getAnchorRect = vi.fn((_anchor: HTMLElement) => ({ left: 0, right: 10, top: 20, bottom: 40 }));
		const { container } = await mountDetails({ event: null, getAnchor: () => geometry.anchor, getAnchorRect }, {
			body: () => h('button', {}, '予定を追加'),
		});
		await geometry.flush();
		expect(required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]').dataset.presentation).toBe('sheet');
		expect(required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]').style.cssText).toBe('');
		expect(window.document.activeElement).toBe(action(container, 'close'));
		expect(getAnchorRect).not.toHaveBeenCalled();
	});

	test.each(['close', 'unmount'] as const)('%sでslot内容の監視も解除し、待機中の再計測を残さない', async ending => {
		const geometry = mockPopoverGeometry();
		const observe = vi.spyOn(MutationObserver.prototype, 'observe');
		const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
		const { container, unmount } = await mountDetails({ event: null, getAnchor: () => geometry.anchor }, {
			body: () => h('p', { 'data-test-slot-copy': '' }, '予定を検索'),
		});
		await geometry.flush();
		const dialog = required(container, '[role="dialog"]');
		const index = observe.mock.calls.findIndex(([target, options]) => target === dialog && options?.childList === true);
		expect(index).toBeGreaterThanOrEqual(0);
		const registration = observe.mock.calls.at(index);
		const observer = observe.mock.contexts.at(index);
		if (!registration || !observer) throw new Error('The live content observer is required');
		expect(registration[1]).toEqual({ childList: true, subtree: true, characterData: true });
		const copy = required(container, '[data-test-slot-copy]');
		copy.append(window.document.createTextNode('候補が増えました'));
		await settle();
		expect(geometry.frames.size).toBe(1);
		if (ending === 'close') { action(container, 'close').click(); await settle(); } else await unmount();
		expect(disconnect.mock.contexts).toContain(observer);
		expect(geometry.frames.size).toBe(0);
		const lastMeasurement = geometry.measurements.mock.calls.length;
		copy.append(window.document.createTextNode('閉じた後の変更'));
		await geometry.flush();
		expect(geometry.measurements.mock.calls).toHaveLength(lastMeasurement);
		expect(geometry.frames.size).toBe(0);
	});
});

describe('予定詳細のPC吹き出しとモバイル下寄せの位置契約', () => {
	test.each([
		{ edge: '上端', top: 20, placement: 'below' },
		{ edge: '下端', top: 730, placement: 'above' },
	])('$edgeの予定は画面内の$placementへ表示し、実anchorを指す', async ({ top, placement }) => {
		const geometry = mockPopoverGeometry({ anchor: { left: 240, top, width: 120, height: 40 } });
		const getAnchor = vi.fn(() => geometry.anchor);
		const { container } = await mountDetails({ getAnchor }); await geometry.flush();
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(overlay.dataset.presentation).toBe('popover'); expect(bubble.dataset.placement).toBe(placement);
		expect(getAnchor).toHaveBeenCalled(); expect(bubble.style.width).toBe('460px'); expect(bubble.style.left).toBe('70px');
		expect(parseFloat(bubble.style.getPropertyValue('--arrow-left'))).toBe(230);
		if (placement === 'below') expect(parseFloat(bubble.style.top)).toBe(top + 40 + 12);
		else { expect(parseFloat(bubble.style.top)).toBeGreaterThanOrEqual(12); expect(parseFloat(bubble.style.top)).toBeLessThan(top - 12); }
		expect(parseFloat(bubble.style.maxHeight)).toBeGreaterThan(0);
		expect(geometry.naturalMeasureWidths.length).toBeGreaterThan(0);
		expect([...new Set(geometry.naturalMeasureWidths)]).toEqual(['460px']);
	});

	test.each([{ side: '左', left: 0, expectedLeft: 12 }, { side: '右', left: 980, expectedLeft: 528 }])('$side端でもカードと矢印を枠内へ収める', async ({ left, expectedLeft }) => {
		const geometry = mockPopoverGeometry({ anchor: { left, top: 120, width: 20, height: 40 } });
		const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(parseFloat(bubble.style.left)).toBe(expectedLeft);
		expect(parseFloat(bubble.style.left) + parseFloat(bubble.style.width)).toBeLessThanOrEqual(geometry.viewport.width - 12);
		expect(parseFloat(bubble.style.getPropertyValue('--arrow-left'))).toBeGreaterThanOrEqual(24);
		expect(parseFloat(bubble.style.getPropertyValue('--arrow-left'))).toBeLessThanOrEqual(460 - 24);
	});

	test('長い本文はscrollHeightから自然高を測り、画面下端の手前で高さを制限する', async () => {
		const geometry = mockPopoverGeometry({ contentHeight: 2800 });
		const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(bubble.dataset.placement).toBe('below');
		expect(parseFloat(bubble.style.top)).toBe(72);
		expect(parseFloat(bubble.style.maxHeight)).toBe(716);
		expect(parseFloat(bubble.style.top) + parseFloat(bubble.style.maxHeight)).toBe(geometry.viewport.height - 12);
		expect(required<HTMLElement>(container, '[data-hatask-event-detail="body"]').scrollHeight).toBe(2800);
		expect(action(container, 'close-footer')).toBeTruthy();
	});

	test.each([320, 560, 584])('有効幅560以下（画面%s）は下寄せで始まり、PCとの往復でinline位置を残さない', async width => {
		const geometry = mockPopoverGeometry({ width }); const getAnchor = vi.fn(() => geometry.anchor);
		const { container } = await mountDetails({ getAnchor }); await geometry.flush();
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(overlay.dataset.presentation).toBe('sheet'); expect(getAnchor).not.toHaveBeenCalled();
		geometry.viewport.width = 1000; geometry.layoutViewport.width = 1000; window.dispatchEvent(new Event('resize')); await geometry.flush();
		expect(overlay.dataset.presentation).toBe('popover'); expect(bubble.style.left).not.toBe('');
		expect(getAnchor).toHaveBeenCalled(); const anchorCalls = getAnchor.mock.calls.length;
		geometry.viewport.width = width; geometry.layoutViewport.width = width; window.dispatchEvent(new Event('resize')); await geometry.flush();
		expect(overlay.dataset.presentation).toBe('sheet'); expect(bubble.dataset.placement).toBeUndefined();
		for (const key of ['left', 'top', 'width', 'max-height', '--arrow-left']) expect(bubble.style.getPropertyValue(key), key).toBe('');
		expect(getAnchor.mock.calls).toHaveLength(anchorCalls);
	});

	test.each(['resize', 'scroll'] as const)('表示中の%sで同じdialogが日付の移動に追随する', async eventType => {
		const geometry = mockPopoverGeometry(); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		const dialog = required(container, '[role="dialog"]'); const previous = bubble.style.cssText;
		geometry.anchorBox.top = 680; geometry.anchorBox.left = 640;
		if (eventType === 'resize') window.dispatchEvent(new Event('resize'));
		else geometry.anchor.dispatchEvent(new Event('scroll', { bubbles: false }));
		await geometry.flush();
		expect(bubble.style.cssText).not.toBe(previous); expect(bubble.dataset.placement).toBe('above');
		expect(required(container, '[role="dialog"]')).toBe(dialog); expect(bubble.style.left).toBe('470px');
	});

	test.each(['resize', 'scroll'] as const)('visualViewportの%sに合わせて可視領域の原点と大きさを取り直す', async eventType => {
		const geometry = mockPopoverGeometry(); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]'); const previous = bubble.style.cssText;
		Object.assign(geometry.viewport, { offsetLeft: 70, offsetTop: 40, width: 800, height: 400 });
		Object.assign(geometry.anchorBox, { left: 600, top: 300 });
		geometry.visualViewport.dispatchEvent(new Event(eventType)); await geometry.flush();
		expect(bubble.style.cssText).not.toBe(previous); expect(bubble.dataset.placement).toBe('above');
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		expect(parseFloat(bubble.style.left) + parseFloat(overlay.style.left)).toBeGreaterThanOrEqual(82);
		expect(parseFloat(bubble.style.top) + parseFloat(overlay.style.top)).toBeGreaterThanOrEqual(52);
		expect(parseFloat(bubble.style.left) + parseFloat(overlay.style.left) + parseFloat(bubble.style.width)).toBeLessThanOrEqual(858);
	});

	test('layout幅1000でもvisual幅400へのズームでは可視領域にoverlayを合わせ下寄せにする', async () => {
		const geometry = mockPopoverGeometry(); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(overlay.dataset.presentation).toBe('popover'); expect(bubble.style.width).toBe('460px');
		Object.assign(geometry.viewport, { width: 400, height: 500, offsetLeft: 48, offsetTop: 120 });
		geometry.visualViewport.dispatchEvent(new Event('resize')); await geometry.flush();
		expect(window.innerWidth).toBe(1000); expect(window.document.documentElement.clientWidth).toBe(1000);
		expect(overlay.dataset.presentation).toBe('sheet');
		expect([overlay.style.left, overlay.style.top, overlay.style.width, overlay.style.height]).toEqual(['48px', '120px', '400px', '500px']);
		expect(overlay.style.getPropertyValue('--detail-available-height')).toBe('476px');
		for (const key of ['left', 'top', 'width', 'max-height', '--arrow-left']) expect(bubble.style.getPropertyValue(key), key).toBe('');
	});

	test.each([1000, 400])('高さ160pxではカード全体をscrollできる状態に切り替え、復元する（幅%s）', async width => {
		const geometry = mockPopoverGeometry({ width }); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const dialog = required<HTMLElement>(container, '[role="dialog"]');
		expect(dialog.dataset.compactHeight).toBe('false');
		geometry.viewport.height = 160; geometry.visualViewport.dispatchEvent(new Event('resize')); await geometry.flush();
		expect(dialog.dataset.compactHeight).toBe('true');
		expect(action(container, 'close-footer').disabled).toBe(false);
		geometry.viewport.height = 800; geometry.visualViewport.dispatchEvent(new Event('resize')); await geometry.flush();
		expect(dialog.dataset.compactHeight).toBe('false');
	});

	test('ResizeObserverで本文拡大を再計測し、下側が狭くなれば上側へ移る', async () => {
		const geometry = mockPopoverGeometry({ contentHeight: 100, anchor: { left: 240, top: 450, width: 120, height: 40 } });
		const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]');
		expect(bubble.dataset.placement).toBe('below');
		const observed = geometry.observerRecords.flatMap(record => [...record.targets]);
		expect(observed).toContain(geometry.anchor); expect(observed).toContain(required(container, '[role="dialog"]'));
		geometry.content.height = 900; for (const observer of geometry.observerRecords) observer.notify(); await geometry.flush();
		expect(bubble.dataset.placement).toBe('above'); expect(parseFloat(bubble.style.top)).toBe(12);
	});

	test('内部本文のscrollはカードを動かさず、anchor祖先のstyle変更は再計測する', async () => {
		const geometry = mockPopoverGeometry(); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]'); const initial = bubble.style.cssText;
		geometry.anchorBox.left = 400;
		required<HTMLElement>(container, '[data-hatask-event-detail="body"]').dispatchEvent(new Event('scroll', { bubbles: false }));
		await geometry.flush(); expect(bubble.style.cssText).toBe(initial);
		geometry.anchor.style.transform = 'translateX(160px)'; await geometry.flush();
		expect(bubble.style.left).toBe('230px');
	});

	test('祖先のanimationendで移動後の予定位置へ追随し、無関係な要素の終了通知は無視する', async () => {
		const geometry = mockPopoverGeometry(); const { container } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]'); const initial = bubble.style.cssText;
		geometry.anchorBox.left = 400;
		required<HTMLElement>(container, '[data-test-background]').dispatchEvent(new Event('animationend', { bubbles: true }));
		await geometry.flush(); expect(bubble.style.cssText).toBe(initial);
		window.document.body.dispatchEvent(new Event('animationend', { bubbles: true })); await geometry.flush();
		expect(bubble.style.left).toBe('230px');
	});

	test('起点が失われたときは中央へ退避し、別の起点指定へ切り替えられる', async () => {
		const geometry = mockPopoverGeometry(); const { container, state } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const bubble = required<HTMLElement>(container, '[data-hatask-event-detail="bubble"]'); expect(bubble.dataset.placement).toBe('below');
		state.getAnchor = () => null; await geometry.flush();
		expect(bubble.dataset.placement).toBe('center'); expect(bubble.style.left).toBe('270px');
		state.getAnchor = () => geometry.anchor; await geometry.flush(); expect(bubble.dataset.placement).toBe('below');
		geometry.anchor.remove(); window.dispatchEvent(new Event('resize')); await geometry.flush(); expect(bubble.dataset.placement).toBe('center');
	});

	test.each(['close', 'unmount'] as const)('%sで追随listeners・observer・待機frameを止める', async ending => {
		const geometry = mockPopoverGeometry();
		const windowAdd = vi.spyOn(window, 'addEventListener'); const windowRemove = vi.spyOn(window, 'removeEventListener');
		const documentAdd = vi.spyOn(window.document, 'addEventListener'); const documentRemove = vi.spyOn(window.document, 'removeEventListener');
		const viewportAdd = vi.spyOn(geometry.visualViewport, 'addEventListener'); const viewportRemove = vi.spyOn(geometry.visualViewport, 'removeEventListener');
		const { container, unmount } = await mountDetails({ getAnchor: () => geometry.anchor }); await geometry.flush();
		const initialMeasurements = geometry.measurements.mock.calls.length;
		window.dispatchEvent(new Event('resize')); await geometry.flush(); expect(geometry.measurements.mock.calls.length).toBeGreaterThan(initialMeasurements);
		window.dispatchEvent(new Event('resize')); expect(geometry.frames.size).toBeGreaterThan(0);
		if (ending === 'close') { action(container, 'close').click(); await settle(); } else await unmount();
		expect(geometry.frames.size).toBe(0); expect(geometry.observerRecords.length).toBeGreaterThan(0);
		for (const record of geometry.observerRecords) { expect(record.disconnect).toHaveBeenCalled(); expect(record.targets.size).toBe(0); }
		const onResize = windowAdd.mock.calls.find(([type]) => type === 'resize'); if (!onResize) throw new Error('Missing live window resize listener');
		expect(windowRemove).toHaveBeenCalledWith('resize', onResize[1]);
		const onScroll = documentAdd.mock.calls.find(([type]) => type === 'scroll'); if (!onScroll) throw new Error('Missing capture scroll listener');
		expect(documentRemove).toHaveBeenCalledWith('scroll', onScroll[1], true);
		for (const type of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) { const registration = documentAdd.mock.calls.find(([name]) => name === type); if (!registration) throw new Error(`Missing anchor ${type} listener`); expect(documentRemove).toHaveBeenCalledWith(type, registration[1], true); }
		for (const type of ['resize', 'scroll']) { const registration = viewportAdd.mock.calls.find(([name]) => name === type); if (!registration) throw new Error(`Missing viewport ${type} listener`); expect(viewportRemove).toHaveBeenCalledWith(type, registration[1]); }
		const lastMeasurement = geometry.measurements.mock.calls.length;
		window.dispatchEvent(new Event('resize')); window.document.dispatchEvent(new Event('scroll'));
		geometry.visualViewport.dispatchEvent(new Event('resize')); geometry.visualViewport.dispatchEvent(new Event('scroll'));
		geometry.anchor.style.marginLeft = '1px'; window.document.body.dispatchEvent(new Event('animationend', { bubbles: true }));
		for (const record of geometry.observerRecords) record.notify(); await geometry.flush();
		expect(geometry.measurements.mock.calls.length).toBe(lastMeasurement); expect(geometry.frames.size).toBe(0);
	});

	test('PCは背景をぼかさず矢印つき、狭幅では既存下寄せと縮小motionを維持する', () => {
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskEventDetailsDialog.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename }); const css = parsed.descriptor.styles[0]?.content;
		if (!css) throw new Error('Missing dialog styles');
		expect(css).toMatch(/\.overlay\[data-presentation=['"]popover['"]\]\s*\{[^}]*background:\s*transparent;[^}]*backdrop-filter:\s*none;/u);
		expect(css).toMatch(/\.overlay\[data-presentation=['"]popover['"]\]\s+\.bubble\s*\{[^}]*position:\s*absolute;/u);
		expect(css).toContain('left: var(--arrow-left)'); expect(css).toContain('.bubble[data-placement=\'above\']'); expect(css).toContain('.bubble[data-placement=\'below\']');
		expect(css).toMatch(/@container hatask-event-details \(max-width: 560px\)\s*\{\s*\.bubble\s*\{[^}]*align-self:\s*end;/u);
		expect(css).toMatch(/\.dialog\[data-compact-height=['"]true['"]\]\s*\{[^}]*display:\s*block;[^}]*overflow-y:\s*auto;/u);
		expect(css).toMatch(/\.dialog\[data-compact-height=['"]true['"]\]\s+\.body\s*\{[^}]*overflow-y:\s*visible;/u);
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bubble[^}]*transition:\s*none;/u);
	});
});
