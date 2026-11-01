/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, shallowReactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/components/HataskEmoji.vue', async () => {
	const { defineComponent: defineMockComponent, h: renderNode } = await import('vue');
	return { default: defineMockComponent({ props: { emoji: { type: String, default: '' } }, setup: props => () => renderNode('span', { 'data-test-emoji': '' }, props.emoji) }) };
});
vi.mock('@/os.js', () => ({ claimZIndex: vi.fn(() => 2000) }));

import HataskCalendarBlankDialog from './HataskCalendarBlankDialog.vue';
import type { App } from 'vue';
import type { HataskCalendarBlankEvent, HataskCalendarBlankLabels } from './HataskCalendarBlankDialog.vue';
import type { HataskEventDetailsLabels } from './hatask-event-details-types.js';

type BlankProps = {
	isOpen: boolean;
	active?: boolean;
	targetLabel: string;
	events: HataskCalendarBlankEvent[];
	labels: HataskCalendarBlankLabels;
	detailLabels: HataskEventDetailsLabels;
	readOnly: boolean;
	busy: boolean;
	error: string;
	returnFocusTo?: HTMLElement | null;
	getAnchor?: () => HTMLElement | null;
	getAnchorRect?: (anchor: HTMLElement) => { left: number; right: number; top: number; bottom: number };
	animations?: boolean;
};
type Mounted = { app: App<Element>; container: HTMLDivElement; opener: HTMLButtonElement };
const mounted: Mounted[] = [];
const labels: HataskCalendarBlankLabels = {
	title: 'この日時に予定を追加', question: 'どうやって予定を用意しますか',
	create: '新しい予定', createHint: 'タイトルや時間を入力して予定を作成',
	copy: '予定をコピー', copyHint: '元の予定は残し、選んだ日時に複製',
	move: '予定を移動', moveHint: '元の予定の日時を変更',
	chooseCopy: 'コピーする予定を選ぶ', chooseMove: '移動する予定を選ぶ',
	search: '予定を検索', searchPlaceholder: '予定名や日時で検索',
	noEvents: '対象の予定はありません', noMatches: '検索に一致する予定はありません',
	source: '元の日時', target: '変更先の日時', confirmCopy: 'この日時にコピー', confirmMove: 'この日時へ移動',
	back: '戻る', more: 'さらに表示', cancel: 'キャンセル', scopeHint: '操作できる予定から選べます',
};
const detailLabels: HataskEventDetailsLabels = {
	details: '予定の詳細', 'close': '閉じる', dateAndTime: '日時', visibility: '公開範囲', organizer: '主催者',
	recurrence: '繰り返し', notificationTiming: '通知', readOnly: '読み取り専用',
	rsvpDashboard: '出欠の集計', rsvp: '出欠を回答', closed: '受付終了', accepting: '受付中',
	rsvpParticipation: '参加', rsvpGoing: '参加する', rsvpMaybe: '未定', rsvpDeclined: '不参加',
	total: '合計', noResponses: 'まだ回答がありません', closeRsvp: '出欠の受付を終了',
	publicEventWithoutRsvp: 'この公開予定には出欠の受付がありません', edit: '編集', delete: '削除',
};

function event(id = 'event-1', overrides: Partial<HataskCalendarBlankEvent> = {}): HataskCalendarBlankEvent {
	return { id, title: '図書館で資料を確認', emoji: '📚', dateLabel: '2026年9月6日（日） 10:00 – 11:30', targetLabel: '2026年9月10日（木） 14:00 – 15:30', canCopy: true, canMove: true, ...overrides };
}

async function settle(): Promise<void> {
	for (let tick = 0; tick < 6; tick++) await nextTick();
}

function required<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
	const result = container.querySelector<T>(selector);
	if (!result) throw new Error(`Required blank-calendar control was not rendered: ${selector}`);
	return result;
}

function action(container: ParentNode, name: string): HTMLButtonElement {
	return required<HTMLButtonElement>(container, `[data-hatask-calendar-blank-action="${name}"]`);
}

function pick(container: ParentNode, id = 'event-1'): HTMLButtonElement {
	return required<HTMLButtonElement>(container, `[data-hatask-calendar-blank-event="${id}"]`);
}

function search(container: ParentNode): HTMLInputElement {
	return required<HTMLInputElement>(container, '[data-hatask-calendar-blank="search"]');
}

async function enterQuery(container: ParentNode, value: string): Promise<void> {
	search(container).value = value;
	search(container).dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}

async function mountDialog(options: Partial<BlankProps> = {}) {
	const opener = window.document.createElement('button');
	opener.textContent = 'カレンダーの空白';
	const container = window.document.createElement('div');
	window.document.body.append(opener, container);
	const desiredOpen = options.isOpen ?? true;
	const state = shallowReactive<BlankProps>({
		targetLabel: '2026年9月10日（木） 14:00', events: [event()], labels, detailLabels,
		readOnly: false, busy: false, error: '', returnFocusTo: opener, animations: false,
		...options, isOpen: false,
	});
	const handlers = { create: vi.fn(), confirm: vi.fn(), 'close': vi.fn(), focusFallback: vi.fn() };
	const theme = shallowReactive({ mode: 'light', name: 'akatsuki' });
	const app = createApp(defineComponent({
		setup: () => () => h(HataskCalendarBlankDialog, {
			...state, class: 'test-inherited-theme', 'data-theme': theme.name, 'data-mode': theme.mode,
			onCreate: handlers.create, onConfirm: handlers.confirm, onFocusFallback: handlers.focusFallback,
			onClose: () => { handlers.close(); state.isOpen = false; },
		}),
	}));
	app.mount(container);
	mounted.push({ app, container, opener });
	await settle();
	opener.focus();
	state.isOpen = desiredOpen;
	await settle();
	return { container, opener, state, handlers, theme };
}

afterEach(async () => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		await settle();
		item.container.remove();
		item.opener.remove();
	}
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

describe('HataskCalendarBlankDialog', () => {
	test('keeps the copy selection while the owning HataGoes pane is hidden', async () => {
		const { container, state, handlers } = await mountDialog({ active: true });
		action(container, 'copy').click();
		await settle();
		await enterQuery(container, '図書館');
		pick(container).click();
		await settle();
		expect(container.textContent).toContain(labels.confirmCopy);
		state.active = false;
		await settle();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(handlers.close).not.toHaveBeenCalled();
		expect(handlers.confirm).not.toHaveBeenCalled();
		state.active = true;
		await settle();
		expect(container.textContent).toContain(labels.confirmCopy);
		action(container, 'confirm').click();
		expect(handlers.confirm).toHaveBeenCalledWith('event-1', 'copy');
	});

	test('予定データなしで共有フレームを一つだけ開き、対象日時と三つの操作を説明する', async () => {
		const { container, state } = await mountDialog();
		expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(required(container, '[role="dialog"]').getAttribute('aria-modal')).toBe('true');
		expect(required(container, 'h2').textContent).toBe(labels.title);
		expect(required(container, '[data-hatask-calendar-blank="destination"] strong').textContent).toBe(state.targetLabel);
		for (const text of [labels.question, labels.createHint, labels.copyHint, labels.moveHint, labels.scopeHint]) expect(container.textContent).toContain(text);
		for (const name of ['create', 'copy', 'move', 'cancel']) expect(action(container, name).disabled).toBe(false);
		expect(container.querySelector('[data-hatask-event-detail="date"]')).toBeNull();
		expect(window.document.activeElement).toBe(required(container, '[data-hatask-event-detail-action="close"]'));
	});

	test('新規作成はcreateだけを通知する', async () => {
		const { container, handlers } = await mountDialog();
		action(container, 'create').click();
		expect(handlers.create).toHaveBeenCalledOnce();
		expect(handlers.confirm).not.toHaveBeenCalled();
		expect(handlers.close).not.toHaveBeenCalled();
	});

	test.each(['copy', 'move'] as const)('%sは対象を選んだだけでは実行せず、元日時と変更先を確認して確定する', async mode => {
		const sourceEvent = event();
		const original = JSON.stringify(sourceEvent);
		const { container, handlers } = await mountDialog({ events: [sourceEvent] });
		const dialog = required(container, '[role="dialog"]');
		action(container, mode).click();
		await settle();
		expect(required(container, 'h2').textContent).toBe(mode === 'copy' ? labels.chooseCopy : labels.chooseMove);
		expect(window.document.activeElement).toBe(search(container));
		expect(handlers.confirm).not.toHaveBeenCalled();
		pick(container).click();
		await settle();
		expect(required(container, '[data-hatask-calendar-blank-step]').getAttribute('data-hatask-calendar-blank-step')).toBe('confirm');
		expect(required(container, '[data-hatask-calendar-blank="source"] dd').textContent).toBe(sourceEvent.dateLabel);
		expect(required(container, '[data-hatask-calendar-blank="target"] dd').textContent).toBe(sourceEvent.targetLabel);
		expect(required(container, '[data-hatask-calendar-blank="selected"] h3').textContent).toBe(sourceEvent.title);
		expect(window.document.activeElement).toBe(action(container, 'confirm'));
		expect(handlers.confirm).not.toHaveBeenCalled();
		expect(required(container, '[role="dialog"]')).toBe(dialog);
		action(container, 'confirm').click();
		expect(handlers.confirm).toHaveBeenCalledWith(sourceEvent.id, mode);
		expect(handlers.confirm).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(sourceEvent)).toBe(original);
	});

	test.each(['copy', 'move'] as const)('%sの戻る操作は検索入力、次に元の操作ボタンへフォーカスを戻す', async mode => {
		const { container, handlers } = await mountDialog();
		action(container, mode).click();
		await settle();
		await enterQuery(container, '図書館');
		pick(container).click();
		await settle();
		action(container, 'back').click();
		await settle();
		expect(search(container).value).toBe('図書館');
		expect(window.document.activeElement).toBe(search(container));
		action(container, 'back').click();
		await settle();
		expect(window.document.activeElement).toBe(action(container, mode));
		expect(handlers.confirm).not.toHaveBeenCalled();
	});

	test('検索は表示済み30件に限定せず全対象へ行い、追加表示は30件ずつ進める', async () => {
		const events = Array.from({ length: 65 }, (_, index) => event(`event-${index}`, { title: `予定 ${index}` }));
		const { container } = await mountDialog({ events });
		action(container, 'copy').click();
		await settle();
		expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(30);
		action(container, 'more').click();
		await settle();
		expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(60);
		expect(window.document.activeElement).toBe(pick(container, 'event-30'));
		action(container, 'more').click();
		await settle();
		expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(65);
		expect(window.document.activeElement).toBe(pick(container, 'event-60'));
		expect(container.querySelector('[data-hatask-calendar-blank-action="more"]')).toBeNull();
		await enterQuery(container, '予定 64');
		expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(1);
		expect(pick(container, 'event-64')).not.toBeNull();
		await enterQuery(container, '');
		expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(30);
	});

	test('検索ラベルを備え、表記幅・大小文字・元日時と変更先日時から検索する', async () => {
		const { container } = await mountDialog({ events: [event('event-1', { title: 'ＡＢＣ 資料' }), event('event-2', { title: '別の予定', dateLabel: '2026年8月1日', targetLabel: '2026年9月1日' })] });
		action(container, 'copy').click();
		await settle();
		expect(required(container, `label[for="${search(container).id}"]`).textContent).toBe(labels.search);
		for (const query of ['abc', '資料 9月6日', 'ABC 9月10日']) {
			await enterQuery(container, query);
			expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(1);
			expect(pick(container).textContent).toContain('ＡＢＣ 資料');
		}
		for (const id of search(container).getAttribute('aria-describedby')?.split(/\s+/u) ?? []) expect(window.document.getElementById(id)).not.toBeNull();
	});

	test('copyとmoveそれぞれの許可された予定だけを表示する', async () => {
		const { container } = await mountDialog({ events: [event('copy-only', { canMove: false }), event('move-only', { canCopy: false }), event('neither', { canCopy: false, canMove: false })] });
		for (const mode of ['copy', 'move'] as const) {
			action(container, mode).click();
			await settle();
			expect(container.querySelectorAll('[data-hatask-calendar-blank-event]')).toHaveLength(1);
			expect(pick(container, `${mode}-only`)).not.toBeNull();
			action(container, 'back').click();
			await settle();
		}
	});

	test('対象なしと検索結果なしを別々の案内で表示する', async () => {
		const { container, state } = await mountDialog({ events: [] });
		action(container, 'move').click();
		await settle();
		expect(required(container, '[role="status"]').textContent).toBe(labels.noEvents);
		state.events = [event()];
		await settle();
		await enterQuery(container, '存在しない予定');
		expect(required(container, '[role="status"]').textContent).toBe(labels.noMatches);
	});

	test.each(['readOnly', 'busy'] as const)('%sでは新規・選択・確定を抑止してキャンセルを保つ', async flag => {
		const { container, state, handlers } = await mountDialog({ [flag]: true });
		for (const name of ['create', 'copy', 'move']) {
			expect(action(container, name).disabled).toBe(true);
			action(container, name).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		expect(handlers.create).not.toHaveBeenCalled();
		expect(container.querySelector('[data-hatask-calendar-blank="search"]')).toBeNull();
		state[flag] = false;
		await settle();
		action(container, 'copy').click();
		await settle();
		state[flag] = true;
		await settle();
		expect(search(container).disabled).toBe(true);
		pick(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(container.querySelector('[data-hatask-calendar-blank-action="confirm"]')).toBeNull();
		state[flag] = false;
		await settle();
		pick(container).click();
		await settle();
		state[flag] = true;
		await settle();
		expect(action(container, 'confirm').disabled).toBe(true);
		action(container, 'confirm').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(handlers.confirm).not.toHaveBeenCalled();
		expect(action(container, 'cancel').disabled).toBe(false);
		action(container, 'cancel').click();
		await settle();
		expect(handlers.close).toHaveBeenCalledOnce();
	});

	test('選択した予定の削除や許可の失効を確認画面へ持ち越さない', async () => {
		const { container, state, handlers } = await mountDialog();
		action(container, 'move').click();
		await settle();
		pick(container).click();
		await settle();
		const oldConfirm = action(container, 'confirm');
		state.events = [event('event-1', { canMove: false })];
		await settle();
		expect(window.document.activeElement).toBe(search(container));
		expect(container.querySelector('[data-hatask-calendar-blank-action="confirm"]')).toBeNull();
		oldConfirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(handlers.confirm).not.toHaveBeenCalled();
		state.events = [event()];
		await settle();
		pick(container).click();
		await settle();
		state.events = [];
		await settle();
		expect(required(container, '[role="status"]').textContent).toBe(labels.noEvents);
	});

	test('対象日時の変更と再オープンで検索・選択を初期化する', async () => {
		const { container, state, handlers } = await mountDialog();
		action(container, 'copy').click();
		await settle();
		await enterQuery(container, '図書館');
		pick(container).click();
		await settle();
		state.targetLabel = '2026年9月11日（金） 09:00';
		await settle();
		expect(required(container, '[data-hatask-calendar-blank-step]').getAttribute('data-hatask-calendar-blank-step')).toBe('choices');
		expect(window.document.activeElement).toBe(action(container, 'create'));
		expect(handlers.confirm).not.toHaveBeenCalled();
		action(container, 'move').click();
		await settle();
		expect(search(container).value).toBe('');
		action(container, 'cancel').click();
		await settle();
		state.isOpen = true;
		await settle();
		expect(required(container, 'h2').textContent).toBe(labels.title);
		expect(container.querySelector('[data-hatask-calendar-blank="search"]')).toBeNull();
	});

	test('長い予定名・複数日の日時・親のエラーを省略せず表示する', async () => {
		const sourceEvent = event('event-1', { title: '長い資料整理の予定'.repeat(30), dateLabel: '2026年9月6日（日） 10:00 – 2026年9月8日（火） 11:30', targetLabel: '2026年9月10日（木） 14:00 – 2026年9月12日（土） 15:30' });
		const { container, state } = await mountDialog({ events: [sourceEvent] });
		action(container, 'copy').click();
		await settle();
		expect(pick(container).textContent).toContain(sourceEvent.title);
		expect(pick(container).textContent).toContain(sourceEvent.dateLabel);
		pick(container).click();
		await settle();
		state.error = '元の予定が変更されています。内容を確認してからやり直してください';
		await settle();
		expect(required(container, '[role="alert"]').textContent).toBe(state.error);
		expect(required(container, '[data-hatask-calendar-blank="selected"] h3').textContent).toBe(sourceEvent.title);
		expect(required(container, '[data-hatask-calendar-blank="source"] dd').textContent).toBe(sourceEvent.dateLabel);
		expect(required(container, '[data-hatask-calendar-blank="target"] dd').textContent).toBe(sourceEvent.targetLabel);
	});

	test('共有フレームのEscape・実起点への復帰を透過する', async () => {
		const { container, opener, handlers } = await mountDialog();
		action(container, 'copy').click();
		await settle();
		expect(opener.inert).toBe(true);
		const key = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		search(container).dispatchEvent(key);
		await settle();
		expect(key.defaultPrevented).toBe(true);
		expect(handlers.close).toHaveBeenCalledOnce();
		expect(opener.inert).toBe(false);
		expect(window.document.activeElement).toBe(opener);
	});

	test('代替フォーカス要求と親テーマ属性をフレームへ透過する', async () => {
		const { container, opener, handlers, theme } = await mountDialog();
		const overlay = required<HTMLElement>(container, '[data-hatask-event-detail="overlay"]');
		for (const mode of ['light', 'dark']) {
			theme.mode = mode;
			await settle();
			expect(overlay.classList.contains('test-inherited-theme')).toBe(true);
			expect(overlay.getAttribute('data-theme')).toBe('akatsuki');
			expect(overlay.getAttribute('data-mode')).toBe(mode);
		}
		expect(overlay.getAttribute('data-motion')).toBe('false');
		opener.remove();
		action(container, 'cancel').click();
		await settle();
		expect(handlers.focusFallback).toHaveBeenCalledOnce();
	});

	test('anchorと補正後の矩形を共有フレームの位置計算へ渡す', async () => {
		const anchor = window.document.createElement('button');
		window.document.body.append(anchor);
		try {
			const getAnchor = vi.fn(() => anchor);
			const getAnchorRect = vi.fn(() => ({ left: 300, right: 420, top: 50, bottom: 90 }));
			const { container } = await mountDialog({ getAnchor, getAnchorRect });
			expect(getAnchor).toHaveBeenCalled();
			expect(getAnchorRect).toHaveBeenCalledWith(anchor);
			expect(required(container, '[data-hatask-event-detail="overlay"]').getAttribute('data-presentation')).toBe('popover');
		} finally { anchor.remove(); }
	});

	test('独自modal基盤を作らずslotsを使い、テーマ色・長文折り返し・縮小モーションを持つ', () => {
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskCalendarBlankDialog.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const template = parsed.descriptor.template?.content ?? '';
		expect(template).toContain('<HataskEventDetailsDialog');
		expect(template).toContain('<template #body>');
		expect(template).toContain('<template #footer>');
		expect(template).not.toContain('role="dialog"');
		const css = parsed.descriptor.styles[0]?.content ?? '';
		expect(css).toContain('color: var(--fg)');
		expect(css).toContain('color: var(--on-accent)');
		expect(css).toContain('overflow-wrap: anywhere');
		expect(css).toContain('min-height: 44px');
		expect(css).toContain('min-width: 0');
		expect(css).toContain('font-size: 16px');
		expect(css).toContain('@container hatask-event-details');
		expect(css).toContain('@media (prefers-reduced-motion: reduce)');
	});
});
