/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/components/HataskEmoji.vue', async () => {
	const { defineComponent: defineMockComponent, h: renderNode } = await import('vue');
	return { default: defineMockComponent({ props: { emoji: { type: String, default: '' } }, setup: props => () => renderNode('span', { 'data-test-emoji': '' }, props.emoji) }) };
});

import HataskCalendarPlanner from './HataskCalendarPlanner.vue';
import type { App } from 'vue';
import type { HataskCalendarBlankTarget, HataskCalendarDay, HataskCalendarLabels, HataskCalendarWeekday } from './hatask-planner-types.js';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

const labels: HataskCalendarLabels = {
	calendar: '予定表',
	viewSelector: '表示',
	views: { month: '月', week: '週', day: '日', agenda: '予定一覧' },
	previousPeriod: '前へ',
	nextPeriod: '次へ',
	today: '今日',
	filters: '絞り込み',
	allDay: '終日',
	loading: '読み込み中',
	empty: '予定はありません',
	readOnly: '読み取り専用',
	selectedDay: '選択した日の予定',
	dragHint: '日付や時刻へ移動',
	trashHint: 'ここへ運んで削除',
	selectDate: date => `${date}を選択`,
	openEvent: title => `${title}を開く`,
	editEvent: title => `${title}を編集`,
	moveEvent: title => `${title}を移動または複製`,
	showMore: count => `ほか${count}件`,
};

const weekdays: HataskCalendarWeekday[] = [
	{ id: 'mon', label: '月' },
	{ id: 'tue', label: '火' },
	{ id: 'wed', label: '水' },
	{ id: 'thu', label: '木' },
	{ id: 'fri', label: '金' },
	{ id: 'sat', label: '土', isWeekend: true },
	{ id: 'sun', label: '日', isWeekend: true },
];

const days: HataskCalendarDay[] = Array.from({ length: 7 }, (_, index) => ({
	key: `2026-08-${24 + index}`,
	date: `2026-08-${24 + index}`,
	label: `8月${24 + index}日`,
	dayNumber: 24 + index,
	weekdayLabel: weekdays[index].label,
	isToday: index === 1,
	isSelected: index === 2,
	events: index === 2 ? [{ id: 'event-1', title: '打ち合わせ', emoji: '📅', date: '2026-08-26', dateEnd: '2026-08-26', timeStart: '10:00', timeEnd: '11:00', timeLabel: '10:00', color: '#1677aa' }] : [],
}));

function mountCalendar(options: Record<string, unknown> = {}) {
	const handlers = {
		view: vi.fn(),
		navigate: vi.fn(),
		selectDate: vi.fn(),
		filter: vi.fn(),
		activate: vi.fn(),
		blank: vi.fn<(target: HataskCalendarBlankTarget) => void>(),
		edit: vi.fn(),
		move: vi.fn(),
		showMore: vi.fn(),
		drop: vi.fn(),
		trash: vi.fn(),
	};
	const app = createApp(defineComponent({
		setup() {
			return () => h(HataskCalendarPlanner, {
				theme: 'kashin',
				view: 'month',
				title: '2026年8月',
				weekdays,
				days,
				filters: [{ id: 'mine', icon: 'ti ti-lock', label: '自分の予定', active: true }, { id: 'public', icon: 'ti ti-world', label: '公開', active: false }],
				labels,
				'onUpdate:view': handlers.view,
				onNavigate: handlers.navigate,
				onSelectDate: handlers.selectDate,
				onToggleFilter: handlers.filter,
				onActivateEvent: handlers.activate,
				onActivateBlank: handlers.blank,
				onEditEvent: handlers.edit,
				onMoveRequest: handlers.move,
				onShowMore: handlers.showMore,
				onDropEvent: handlers.drop,
				onTrashEvent: handlers.trash,
				...options,
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, handlers };
}

function mockCalendarWidth(initialWidth: number) {
	const observers = new Set<{ callback: ResizeObserverCallback; observer: ResizeObserver }>();
	let width = initialWidth;
	class CalendarResizeObserver {
		private readonly entry: { callback: ResizeObserverCallback; observer: ResizeObserver };

		constructor(callback: ResizeObserverCallback) {
			this.entry = { callback, observer: this as unknown as ResizeObserver };
		}

		observe(): void {
			observers.add(this.entry);
			this.entry.callback([{ contentRect: { width } } as ResizeObserverEntry], this.entry.observer);
		}

		disconnect(): void { observers.delete(this.entry); }
	}
	vi.stubGlobal('ResizeObserver', CalendarResizeObserver);
	return (nextWidth: number) => {
		width = nextWidth;
		for (const entry of observers) entry.callback([{ contentRect: { width } } as ResizeObserverEntry], entry.observer);
	};
}

function dispatchTouchPointer(target: EventTarget, type: string): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		pointerType: { value: 'touch' }, pointerId: { value: 1 },
		clientX: { value: 10 }, clientY: { value: 10 },
	});
	target.dispatchEvent(event);
}

afterEach(async () => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
	// Teleported leave transitions must finish before the next fixture starts.
	await vi.waitFor(() => expect(window.document.querySelector('[data-calendar-trash]')).toBeNull());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('HataskCalendarPlanner', () => {
	test('埋め込み時は操作列と予定本体の間に入力フォームの移動先を渡す', async () => {
		const captureTarget = vi.fn();
		const { container } = mountCalendar({ embedded: true, onCaptureTarget: captureTarget });
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="calendar"]');
		const target = root?.querySelector<HTMLElement>('[data-hatagoes-inline-capture="calendar"]');
		expect(target).toBeInstanceOf(HTMLElement);
		expect(captureTarget).toHaveBeenCalledWith(target);
		const header = root?.querySelector('header');
		if (!root || !header || !target) throw new Error('Missing inline capture layout');
		expect(header.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(target.compareDocumentPosition(root.querySelector('[role="grid"]') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const legacy = mountCalendar();
		expect(legacy.container.querySelector('[data-hatagoes-inline-capture]')).toBeNull();
	});

	test('テーマと月グリッドの意味を公開し、操作をデータ変更なしで通知する', async () => {
		const { container, handlers } = mountCalendar();
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="calendar"]');
		expect(root?.dataset.hataskTheme).toBe('kashin');
		expect(root?.dataset.view).toBe('month');
		expect(container.querySelector('[role="grid"]')).not.toBeNull();
		expect(container.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
		expect(container.querySelectorAll('[data-calendar-week][role="row"]')).toHaveLength(1);
		expect(container.querySelectorAll('[role="rowgroup"] > [role="row"] > [role="gridcell"]')).toHaveLength(7);
		expect(container.querySelectorAll('[data-calendar-day-button][tabindex="0"]')).toHaveLength(1);
		expect(container.querySelector<HTMLButtonElement>('[aria-label="8月26日を選択"]')?.tabIndex).toBe(0);
		expect(container.querySelector('[data-calendar-event="event-1"]')?.textContent).toContain('10:00');

		(container.querySelector('[aria-label="次へ"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="週"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="8月26日を選択"]') as HTMLButtonElement).click();
		(container.querySelector('[aria-label="自分の予定"]') as HTMLButtonElement).click();
		const eventButton = container.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを開く"]');
		if (!eventButton) throw new Error('calendar event button was not rendered');
		eventButton.click();

		expect(handlers.navigate).toHaveBeenCalledWith('next');
		expect(container.querySelector('[aria-label="予定を追加"]')).toBeNull();
		expect(handlers.view).toHaveBeenCalledWith('week');
		expect(handlers.selectDate).toHaveBeenCalledWith(days[2]);
		expect(handlers.filter).toHaveBeenCalledWith('mine');
		expect(container.querySelector('[aria-label="自分の予定"] i')?.className).toContain('ti-lock');
		const publicFilter = container.querySelector<HTMLButtonElement>('[aria-label="公開"]');
		expect(publicFilter?.querySelector('i')?.className).toContain('ti-world');
		expect(publicFilter?.getAttribute('aria-pressed')).toBe('false');
		publicFilter?.click();
		expect(handlers.filter).toHaveBeenCalledWith('public');
		expect(handlers.activate).toHaveBeenCalledWith(days[2].events[0], days[2], eventButton);
	});

	test.each([
		{ entry: '月', view: 'month', allDay: false, selector: '[role="gridcell"] button[data-calendar-event="event-1"]' },
		{ entry: '終日', view: 'day', allDay: true, selector: 'article[data-date="2026-08-26"] > div > div > button:not([data-calendar-no-drag])' },
		{ entry: '時間帯', view: 'day', allDay: false, selector: '[data-calendar-time-canvas] [data-calendar-event="event-1"] > button:not([data-calendar-no-drag])' },
		{ entry: '予定一覧', view: 'agenda', allDay: false, selector: '[data-view="agenda"] [data-calendar-event="event-1"] > button' },
		{ entry: '選択日', view: 'month', allDay: false, selector: '[data-calendar-day-pane] [data-calendar-event="event-1"] > button' },
	])('$entry入口は内側の文字を押しても実際の予定ボタンを第3引数に渡す', async ({ view, allDay, selector }) => {
		mockCalendarWidth(1100);
		const calendarDays = days.map(day => ({ ...day, events: day.events.map(event => ({ ...event, isAllDay: allDay })) }));
		const original = JSON.stringify(calendarDays);
		const { container, handlers } = mountCalendar({ view, days: calendarDays });
		await nextTick();
		const matches = container.querySelectorAll<HTMLButtonElement>(selector);
		expect(matches).toHaveLength(1);
		const button = matches[0];
		const child = button.querySelector<HTMLElement>('span, strong');
		if (!child) throw new Error('event label must have an inner click target');
		child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(handlers.activate).toHaveBeenCalledTimes(1);
		expect(handlers.activate).toHaveBeenCalledWith(calendarDays[2].events[0], calendarDays[2], button);
		expect(handlers.activate.mock.calls[0][2]).toBe(button);
		expect(handlers.activate.mock.calls[0][2]).not.toBe(child);
		expect(handlers.blank).not.toHaveBeenCalled();
		expect(handlers.edit).not.toHaveBeenCalled();
		expect(handlers.move).not.toHaveBeenCalled();
		expect(JSON.stringify(calendarDays)).toBe(original);
	});

	test('長押し直後のクリックはanchor付きでも抑止し、抑止期間後は同じボタンを渡す', async () => {
		vi.useFakeTimers();
		try {
			mockCalendarWidth(1100);
			const { container, handlers } = mountCalendar();
			await nextTick();
			const button = container.querySelector<HTMLButtonElement>('[data-calendar-day-pane] [aria-label="打ち合わせを開く"]');
			if (!button) throw new Error('day pane event button was not rendered');
			// Positive control: this mounted button emits before suppression starts.
			button.click();
			expect(handlers.activate).toHaveBeenCalledWith(days[2].events[0], days[2], button);
			handlers.activate.mockClear();
			dispatchTouchPointer(button, 'pointerdown');
			vi.advanceTimersByTime(380);
			await nextTick();
			expect(window.document.querySelector('[data-calendar-trash]')).not.toBeNull();
			dispatchTouchPointer(window, 'pointerup');
			button.click();
			vi.advanceTimersByTime(359);
			button.click();
			expect(handlers.activate).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1);
			button.click();
			expect(handlers.activate).toHaveBeenCalledTimes(1);
			expect(handlers.activate).toHaveBeenCalledWith(days[2].events[0], days[2], button);
		} finally {
			await nextTick();
			await vi.advanceTimersByTimeAsync(500);
			vi.useRealTimers();
		}
	});

	test('月グリッドは矢印キーで隣の日付へフォーカスを移せる', async () => {
		const { container } = mountCalendar();
		await nextTick();
		const first = container.querySelector<HTMLButtonElement>('[aria-label="8月24日を選択"]');
		const second = container.querySelector<HTMLButtonElement>('[aria-label="8月25日を選択"]');
		first?.focus();
		first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();
		expect(window.document.activeElement).toBe(second);
		expect(first?.tabIndex).toBe(-1);
		expect(second?.tabIndex).toBe(0);
	});

	test('週表示では移動と編集の代替操作があり、読み取り専用時は無効になる', async () => {
		const { container, handlers } = mountCalendar({ view: 'week', readOnly: true });
		await nextTick();
		expect(container.textContent).toContain(labels.readOnly);
		expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
		expect(container.querySelector('[aria-label="予定を追加"]')).toBeNull();
		const move = container.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを移動または複製"]');
		expect(move?.disabled).toBe(true);
		const edit = container.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを編集"]');
		expect(edit?.disabled).toBe(true);
		edit?.click();
		expect(handlers.edit).not.toHaveBeenCalled();
		move?.click();
		expect(handlers.move).not.toHaveBeenCalled();
	});

	test('重なる予定を同じ時間軸の別レーンに配置する', async () => {
		const overlapping = [{
			...days[2],
			events: [
				...days[2].events,
				{ id: 'event-2', title: 'レビュー', date: '2026-08-26', dateEnd: '2026-08-26', timeStart: '10:30', timeEnd: '11:30', timeLabel: '10:30', color: '#aa5516' },
			],
		}];
		const { container } = mountCalendar({ view: 'day', days: overlapping });
		await nextTick();
		const first = container.querySelector<HTMLElement>('[data-calendar-event="event-1"]');
		const second = container.querySelector<HTMLElement>('[data-calendar-event="event-2"]');
		expect(first?.style.left).toBe('0%');
		expect(second?.style.left).toBe('50%');
		expect(first?.style.width).toContain('50%');
	});

	test.each(['day', 'trash'] as const)('予定を%sへドラッグしてもpointercancelでは確定せず、次のドラッグは使える', async targetKind => {
		vi.useFakeTimers();
		try {
			mockCalendarWidth(1100);
			const original = JSON.stringify(days);
			const { container, handlers } = mountCalendar();
			await nextTick();
			const source = container.querySelector<HTMLButtonElement>('[data-calendar-day-pane] [aria-label="打ち合わせを開く"]');
			if (!source) throw new Error('day pane event drag source was not rendered');
			const hitTest = vi.spyOn(window.document, 'elementFromPoint');
			const beginDrag = async () => {
				dispatchTouchPointer(source, 'pointerdown');
				vi.advanceTimersByTime(380);
				await nextTick();
				const target = targetKind === 'trash'
					? window.document.querySelector('[data-calendar-trash]')
					: container.querySelector(`[data-calendar-drop-date="${days[3].date}"]`);
				if (!target) throw new Error(`required ${targetKind} drop target was not rendered`);
				hitTest.mockReturnValue(target);
				dispatchTouchPointer(window, 'pointermove');
			};
			const expectNormalDrop = () => {
				if (targetKind === 'trash') expect(handlers.trash).toHaveBeenCalledWith(days[2].events[0]);
				else expect(handlers.drop).toHaveBeenCalledWith(days[2].events[0], days[3], undefined);
			};

			// Positive control: the same source and target can produce a normal drop.
			await beginDrag();
			dispatchTouchPointer(window, 'pointerup');
			expectNormalDrop();
			handlers.drop.mockClear();
			handlers.trash.mockClear();

			await beginDrag();
			dispatchTouchPointer(window, 'pointercancel');
			dispatchTouchPointer(window, 'pointerup');
			expect(handlers.drop).not.toHaveBeenCalled();
			expect(handlers.trash).not.toHaveBeenCalled();

			await beginDrag();
			dispatchTouchPointer(window, 'pointerup');
			expectNormalDrop();
			expect(JSON.stringify(days)).toBe(original);
		} finally {
			await nextTick();
			await vi.advanceTimersByTimeAsync(500);
			vi.useRealTimers();
		}
	});

	test('長押し成立前のpointercancelでも開始待ちを解除する', async () => {
		vi.useFakeTimers();
		try {
			const { container, handlers } = mountCalendar();
			await nextTick();
			const source = container.querySelector('[aria-label="打ち合わせを開く"]');
			if (!source) throw new Error('calendar event drag source was not rendered');
			expect(window.document.querySelector('[data-calendar-trash]')).toBeNull();
			dispatchTouchPointer(source, 'pointerdown');
			vi.advanceTimersByTime(100);
			dispatchTouchPointer(window, 'pointercancel');
			vi.advanceTimersByTime(1000);
			await nextTick();
			expect(window.document.querySelector('[data-calendar-trash]')).toBeNull();
			dispatchTouchPointer(window, 'pointerup');
			expect(handlers.drop).not.toHaveBeenCalled();
			expect(handlers.trash).not.toHaveBeenCalled();
			// Positive control: without cancellation the same long press starts.
			dispatchTouchPointer(source, 'pointerdown');
			vi.advanceTimersByTime(380);
			await nextTick();
			expect(window.document.querySelector('[data-calendar-trash]')).not.toBeNull();
			dispatchTouchPointer(window, 'pointercancel');
		} finally {
			await nextTick();
			await vi.advanceTimersByTimeAsync(500);
			vi.useRealTimers();
		}
	});

	test('読み込み表示は親のライブリージョンと重複せず、busy状態だけを公開する', async () => {
		const { container } = mountCalendar({ loading: true });
		await nextTick();
		const root = container.querySelector<HTMLElement>('[data-hatask-component="calendar"]');
		expect(root?.getAttribute('aria-busy')).toBe('true');
		expect(container.textContent).toContain(labels.loading);
		expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
	});

	test('デッキの細い列ではブラウザ幅ではなく実際の表示幅でコンパクト化する', async () => {
		class CompactResizeObserver {
			private readonly callback: ResizeObserverCallback;

			constructor(callback: ResizeObserverCallback) {
				this.callback = callback;
			}

			observe(): void {
				this.callback([{ contentRect: { width: 480 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
			}

			disconnect(): void {}
		}

		vi.stubGlobal('ResizeObserver', CompactResizeObserver);
		const { container } = mountCalendar();
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.compact).toBe('true');
	});

	test.each(['kisetsu', 'kashin', 'suri', 'hatakyu'])('PCの%sテーマは選択日の全予定を右ペインへ併置する', async theme => {
		mockCalendarWidth(1100);
		const selected = {
			...days[2],
			events: Array.from({ length: 5 }, (_, index) => ({ ...days[2].events[0], id: `event-${index + 1}`, title: `予定${index + 1}` })),
		};
		const calendarDays = days.map(day => day.isSelected ? selected : day);
		const original = JSON.stringify(calendarDays);
		const { container, handlers } = mountCalendar({ theme, days: calendarDays });
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.layout).toBe('split');
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.hataskTheme).toBe(theme);
		expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(7);
		const pane = container.querySelector<HTMLElement>('[data-calendar-day-pane]');
		expect(pane?.dataset.desktopPane).toBe('true');
		expect(pane?.dataset.date).toBe(selected.date);
		expect(pane?.getAttribute('aria-label')).toBe(`${labels.selectedDay}: ${selected.label}`);
		expect(pane?.querySelectorAll('[data-calendar-event]')).toHaveLength(5);
		expect(pane?.textContent).toContain('予定5');
		expect(JSON.stringify(calendarDays)).toBe(original);
		expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test('右ペインの詳細・編集・移動・日表示は既存の親イベントへ通知する', async () => {
		mockCalendarWidth(1100);
		const { container, handlers } = mountCalendar();
		await nextTick();
		const pane = container.querySelector('[data-calendar-day-pane]');
		const eventButton = pane?.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを開く"]');
		if (!eventButton) throw new Error('day pane event button was not rendered');
		eventButton.click();
		pane?.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを編集"]')?.click();
		pane?.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを移動または複製"]')?.click();
		pane?.querySelector<HTMLButtonElement>('[data-calendar-pane-open-day]')?.click();
		expect(handlers.activate).toHaveBeenCalledWith(days[2].events[0], days[2], eventButton);
		expect(handlers.edit).toHaveBeenCalledWith(days[2].events[0], days[2]);
		expect(handlers.move).toHaveBeenCalledWith(days[2].events[0], days[2]);
		expect(handlers.showMore).toHaveBeenCalledWith(days[2]);
		expect(handlers.view).not.toHaveBeenCalled();
	});

	test('右ペインの日付送りは無効日を飛ばし、親の選択更新へ追従する', async () => {
		mockCalendarWidth(1100);
		const state = reactive({ days: days.map((day, index) => ({ ...day, isDisabled: index === 3 })) });
		const { container, handlers } = mountCalendar(state);
		await nextTick();
		container.querySelector<HTMLButtonElement>('[data-calendar-pane-previous]')?.click();
		expect(handlers.selectDate).toHaveBeenLastCalledWith(state.days[1]);
		container.querySelector<HTMLButtonElement>('[data-calendar-pane-next]')?.click();
		expect(handlers.selectDate).toHaveBeenLastCalledWith(state.days[4]);
		state.days = state.days.map((day, index) => ({ ...day, isSelected: index === 4 }));
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-calendar-day-pane]')?.dataset.date).toBe(state.days[4].date);
		expect(container.querySelector('[data-calendar-day-pane]')?.textContent).toContain(labels.empty);
		state.days = state.days.map((day, index) => ({ ...day, isSelected: index === 0 }));
		await nextTick();
		expect(container.querySelector<HTMLButtonElement>('[data-calendar-pane-previous]')?.disabled).toBe(true);
	});

	test('ウィンドウ幅の往復では月の選択日と予定を保持し、モバイルへPC操作を持ち込まない', async () => {
		const resize = mockCalendarWidth(1100);
		const original = JSON.stringify(days);
		const { container, handlers } = mountCalendar();
		await nextTick();
		const pane = container.querySelector('[data-calendar-day-pane]');
		resize(480);
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.layout).toBe('single');
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.compact).toBe('true');
		expect(container.querySelector('[data-calendar-day-pane]')).toBe(pane);
		expect(container.querySelector<HTMLElement>('[data-calendar-day-pane]')?.dataset.desktopPane).toBe('false');
		expect(container.querySelector('[data-calendar-pane-open-day]')).toBeNull();
		resize(1100);
		await nextTick();
		expect(container.querySelector('[data-calendar-day-pane]')).toBe(pane);
		expect(container.querySelector<HTMLElement>('[data-calendar-day-pane]')?.dataset.date).toBe(days[2].date);
		expect(JSON.stringify(days)).toBe(original);
		expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test('週表示は充分な幅があるときだけ右ペインを開いて七日分の時間軸を保つ', async () => {
		const resize = mockCalendarWidth(1100);
		const { container } = mountCalendar({ view: 'week' });
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.layout).toBe('single');
		expect(container.querySelector('[data-calendar-day-pane]')).toBeNull();
		resize(1140);
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.layout).toBe('split');
		expect(container.querySelectorAll('[data-calendar-time-canvas]')).toHaveLength(7);
		expect(container.querySelector('[data-calendar-day-pane]')).not.toBeNull();
		resize(640);
		await nextTick();
		expect(container.querySelector('[data-calendar-day-pane]')).toBeNull();
		expect(container.querySelectorAll('[data-calendar-time-canvas]')).toHaveLength(7);
	});

	test.each([
		{ view: 'month', layout: 'split', pane: true, eventCopies: 2 },
		{ view: 'week', layout: 'split', pane: true, eventCopies: 2 },
		{ view: 'day', layout: 'single', pane: false, eventCopies: 1 },
		{ view: 'agenda', layout: 'single', pane: false, eventCopies: 1 },
	] as const)('PC幅の$view表示は$layoutレイアウトとなり右ペイン=$paneで予定を描画する', async ({ view, layout, pane, eventCopies }) => {
		mockCalendarWidth(1200);
		const { container } = mountCalendar({ view });
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-hatask-component="calendar"]')?.dataset.layout).toBe(layout);
		expect(container.querySelector('[data-calendar-day-pane]') != null).toBe(pane);
		expect(container.querySelectorAll('[data-calendar-event="event-1"]')).toHaveLength(eventCopies);
	});

	test('PCで選択が未指定なら今日の予定を参照し、選択や元データを書き換えない', async () => {
		mockCalendarWidth(1100);
		const calendarDays = days.map(day => ({ ...day, isSelected: false }));
		const original = JSON.stringify(calendarDays);
		const { container, handlers } = mountCalendar({ days: calendarDays });
		await nextTick();
		expect(container.querySelector<HTMLElement>('[data-calendar-day-pane]')?.dataset.date).toBe(days[1].date);
		expect(JSON.stringify(calendarDays)).toBe(original);
		expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test('読み取り専用でも右ペインは読めるが、編集や移動は無効のままにする', async () => {
		mockCalendarWidth(1100);
		const { container, handlers } = mountCalendar({ readOnly: true });
		await nextTick();
		const pane = container.querySelector('[data-calendar-day-pane]');
		const edit = pane?.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを編集"]');
		const move = pane?.querySelector<HTMLButtonElement>('[aria-label="打ち合わせを移動または複製"]');
		expect(pane?.textContent).toContain('打ち合わせ');
		expect(edit?.disabled).toBe(true);
		expect(move?.disabled).toBe(true);
		edit?.click();
		move?.click();
		expect(handlers.edit).not.toHaveBeenCalled();
		expect(handlers.move).not.toHaveBeenCalled();
	});

	test('PC月表示は日付セルを一件と続きの導線へ圧縮し、小窓では従来の件数を保つ', async () => {
		const resize = mockCalendarWidth(1100);
		const selected = {
			...days[2],
			events: Array.from({ length: 4 }, (_, index) => ({ ...days[2].events[0], id: `dense-event-${index + 1}`, title: `予定${index + 1}` })),
		};
		const calendarDays = days.map(day => day.isSelected ? selected : day);
		const { container } = mountCalendar({ days: calendarDays });
		await nextTick();
		const selectedCell = container.querySelector('[role="gridcell"][aria-selected="true"]');
		expect(selectedCell?.querySelectorAll('[data-calendar-event]')).toHaveLength(1);
		expect(selectedCell?.textContent).toContain('ほか3件');
		resize(480);
		await nextTick();
		expect(selectedCell?.querySelectorAll('[data-calendar-event]')).toHaveLength(3);
		expect(selectedCell?.textContent).toContain('ほか1件');
	});

	test('二ペインは名前付きコンテナと縮められる列を使い、小窓と縮小モーションを保持する', () => {
		// Source contract only; Happy DOM does not verify rendered container layout.
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskCalendarPlanner.vue');
		const parsed = parse(readFileSync(filename, 'utf8'), { filename });
		expect(parsed.errors).toEqual([]);
		const stylesheet = parsed.descriptor.styles[0].content;
		expect(stylesheet).toContain('container-name: hatask-calendar;');
		expect(stylesheet).toContain('@container hatask-calendar (min-width: 960px)');
		expect(stylesheet).toContain('@container hatask-calendar (min-width: 900px)');
		expect(stylesheet).toContain('@container hatask-calendar (min-width: 1120px)');
		expect(stylesheet).toContain('height: 600px;');
		expect(stylesheet).toContain('grid-template-columns: minmax(0, 1fr) minmax(280px, .43fr)');
		expect(stylesheet).toContain('grid-template-columns: minmax(0, 1fr) 280px');
		expect(stylesheet).toContain('grid-template-columns: minmax(0, 1.35fr) repeat(6, minmax(0, 1fr))');
		expect(stylesheet).toContain('@container (max-width: 720px)');
		expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
	});
});

describe('HataskCalendarPlannerの空白予定操作', () => {
	test.each([
		{ view: 'month', selector: '[role="gridcell"][data-date="2026-08-26"]' },
		{ view: 'week', selector: 'article[data-date="2026-08-26"]' },
		{ view: 'day', selector: 'article[data-date="2026-08-26"]' },
		{ view: 'agenda', selector: 'section[data-date="2026-08-26"]' },
		{ view: 'month', selector: '[data-calendar-day-pane]' },
	])('$viewの$selector空白を1回通知し、日付選択や予定データを書き換えない', async ({ view, selector }) => {
		mockCalendarWidth(1100);
		const before = JSON.stringify(days); const { container, handlers } = mountCalendar({ view });
		await nextTick();
		const holder = container.querySelector<HTMLElement>(selector);
		if (!holder) throw new Error('Expected day surface');
		vi.spyOn(holder, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 400, 200));
		holder.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 200, clientY: 350 }));
		expect(handlers.blank).toHaveBeenCalledTimes(1);
		expect(handlers.blank).toHaveBeenCalledWith({ day: days[2], anchor: holder, point: { x: .25, y: .75 } });
		expect(handlers.selectDate).not.toHaveBeenCalled(); expect(handlers.activate).not.toHaveBeenCalled();
		expect(JSON.stringify(days)).toBe(before);
	});

	test.each(['week', 'day'])('%sの空白時刻はcanvas基準の相対座標と15分刻みの時刻を渡す', async view => {
		const { container, handlers } = mountCalendar({ view }); await nextTick();
		const canvas = container.querySelector<HTMLElement>('article[data-date="2026-08-26"] [data-calendar-time-canvas]');
		if (!canvas) throw new Error('Expected time canvas');
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 960));
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 510 }));
		expect(handlers.blank).toHaveBeenCalledTimes(1);
		expect(handlers.blank.mock.calls[0][0]).toMatchObject({ day: days[2], anchor: canvas, time: '10:15', point: { x: .25, y: 410 / 960 } });
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 90 }));
		expect(handlers.blank.mock.calls[1][0]).toMatchObject({ time: '00:00', point: { x: 0, y: 0 } });
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 350, clientY: 1100 }));
		expect(handlers.blank.mock.calls[2][0]).toMatchObject({ time: '23:45', point: { x: 1, y: 1 } });
		expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test.each(['month', 'week', 'day', 'agenda'])('%sの予定なし日付buttonは点指定なしのpopupを開き、予定あり日は選択のまま', async view => {
		const actionLabels = { ...labels, openDayActions: (date: string) => `${date}の予定操作を開く` };
		const { container, handlers } = mountCalendar({ view, labels: actionLabels }); await nextTick();
		const empty = container.querySelector<HTMLButtonElement>('[aria-label="8月24日の予定操作を開く"]');
		const occupied = container.querySelector<HTMLButtonElement>('[aria-label="8月26日を選択"]');
		if (!empty || !occupied) throw new Error('Expected empty and occupied date buttons');
		expect(empty.tagName).toBe('BUTTON'); expect(empty.getAttribute('aria-haspopup')).toBe('dialog');
		// Native keyboard activation produces the same click with detail=0.
		empty.focus(); empty.click();
		expect(handlers.blank).toHaveBeenCalledTimes(1);
		expect(handlers.blank.mock.calls[0][0]).toEqual({ day: days[0], anchor: empty });
		expect(handlers.selectDate).not.toHaveBeenCalled();
		occupied.click(); expect(handlers.selectDate).toHaveBeenCalledWith(days[2]);
		expect(occupied.hasAttribute('aria-haspopup')).toBe(false); expect(handlers.blank).toHaveBeenCalledTimes(1);
	});

	test('選択日paneの空状態もnative buttonで開き、外側への伝播で重複しない', async () => {
		mockCalendarWidth(1100);
		const calendarDays = days.map((day, index) => ({ ...day, isSelected: index === 0 }));
		const { container, handlers } = mountCalendar({ days: calendarDays }); await nextTick();
		const control = container.querySelector<HTMLButtonElement>('[data-calendar-day-pane] > button[aria-haspopup="dialog"]');
		if (!control) throw new Error('Expected empty-day action button');
		expect(control.textContent).toBe(labels.empty); control.click();
		expect(handlers.blank).toHaveBeenCalledTimes(1);
		expect(handlers.blank.mock.calls[0][0]).toEqual({ day: calendarDays[0], anchor: control });
		expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test('週日の描画済み予定矩形やdraggable余白は空き時間として扱わない', async () => {
		const { container, handlers } = mountCalendar({ view: 'day' }); await nextTick();
		const canvas = container.querySelector<HTMLElement>('article[data-date="2026-08-26"] [data-calendar-time-canvas]');
		const row = canvas?.querySelector<HTMLElement>('[data-calendar-event="event-1"]');
		if (!canvas || !row) throw new Error('Expected time canvas and event box');
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 400, 960));
		vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(120, 480, 200, 70));
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 400, clientY: 510 }));
		expect(handlers.blank).toHaveBeenCalledTimes(1); handlers.blank.mockClear();
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 510 }));
		row.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 510 }));
		row.querySelector<HTMLElement>('[data-calendar-no-drag]')?.click();
		expect(handlers.blank).not.toHaveBeenCalled();
	});

	test('data-calendar-eventのない終日予定もdraggable=falseの枠まで空白から除外する', async () => {
		const calendarDays = days.map(day => ({ ...day, events: day.events.map(event => ({ ...event, isAllDay: true, readOnly: true })) }));
		const { container, handlers } = mountCalendar({ view: 'day', days: calendarDays }); await nextTick();
		const holder = container.querySelector<HTMLElement>('article[data-date="2026-08-26"]');
		const row = holder?.querySelector<HTMLElement>('[draggable="false"]');
		if (!holder || !row) throw new Error('Expected all-day event wrapper');
		expect(row.hasAttribute('data-calendar-event')).toBe(false);
		row.click(); expect(handlers.blank).not.toHaveBeenCalled();
		holder.click(); expect(handlers.blank).toHaveBeenCalledTimes(1);
	});

	test.each(['readOnly', 'disabled'])('%sでは空白を開かず、readOnlyの日付選択は維持する', async state => {
		const calendarDays = days.map(day => ({ ...day, isDisabled: state === 'disabled' }));
		const { container, handlers } = mountCalendar({ readOnly: state === 'readOnly', days: calendarDays }); await nextTick();
		const holder = container.querySelector<HTMLElement>('[role="gridcell"]');
		const control = holder?.querySelector<HTMLButtonElement>('[data-calendar-day-button]');
		if (!holder || !control) throw new Error('Expected guarded day');
		expect(holder.dataset.blankAction).toBe('false');
		holder.click(); control.click(); expect(handlers.blank).not.toHaveBeenCalled();
		if (state === 'readOnly') expect(handlers.selectDate).toHaveBeenCalledWith(calendarDays[0]);
		else expect(handlers.selectDate).not.toHaveBeenCalled();
	});

	test('defaultPreventedな空白クリックは尊重し、通常クリックだけを開く', async () => {
		const { container, handlers } = mountCalendar(); await nextTick();
		const holder = container.querySelector<HTMLElement>('[role="gridcell"]');
		if (!holder) throw new Error('Expected day cell');
		const prevented = new MouseEvent('click', { bubbles: true, cancelable: true }); prevented.preventDefault(); holder.dispatchEvent(prevented);
		expect(handlers.blank).not.toHaveBeenCalled(); holder.click(); expect(handlers.blank).toHaveBeenCalledTimes(1);
	});

	test.each(['native', 'touch', 'cancel'] as const)('%s drag成立後の空白と日付buttonを360ms抑止し、その後は再び開ける', async mode => {
		vi.useFakeTimers();
		try {
			const { container, handlers } = mountCalendar(); await nextTick();
			const source = container.querySelector<HTMLButtonElement>('[data-calendar-event="event-1"]');
			const holder = container.querySelector<HTMLElement>('[role="gridcell"][data-date="2026-08-24"]');
			const control = holder?.querySelector<HTMLButtonElement>('[data-calendar-day-button]');
			if (!source || !holder || !control) throw new Error('Expected drag source and blank target');
			holder.click(); expect(handlers.blank).toHaveBeenCalledTimes(1); handlers.blank.mockClear();
			if (mode === 'native') source.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
			else { dispatchTouchPointer(source, 'pointerdown'); vi.advanceTimersByTime(380); }
			await nextTick(); holder.click(); expect(handlers.blank).not.toHaveBeenCalled();
			if (mode === 'native') {
				holder.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
				expect(handlers.drop).toHaveBeenCalledWith(days[2].events[0], days[0], undefined);
				source.dispatchEvent(new Event('dragend', { bubbles: true }));
			} else dispatchTouchPointer(window, mode === 'cancel' ? 'pointercancel' : 'pointerup');
			holder.click(); control.click(); vi.advanceTimersByTime(359); holder.click();
			expect(handlers.blank).not.toHaveBeenCalled(); expect(handlers.selectDate).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1); holder.click(); expect(handlers.blank).toHaveBeenCalledTimes(1);
		} finally {
			await nextTick(); await vi.advanceTimersByTimeAsync(500); vi.useRealTimers();
		}
	});

	test('長押し成立前のcancelでは、空白タップを後から抑止しない', async () => {
		vi.useFakeTimers();
		try {
			const { container, handlers } = mountCalendar(); await nextTick();
			const source = container.querySelector('[data-calendar-event="event-1"]');
			const holder = container.querySelector<HTMLElement>('[role="gridcell"]');
			if (!source || !holder) throw new Error('Expected source and day');
			dispatchTouchPointer(source, 'pointerdown'); vi.advanceTimersByTime(100); dispatchTouchPointer(window, 'pointercancel');
			holder.click(); expect(handlers.blank).toHaveBeenCalledTimes(1);
		} finally { vi.useRealTimers(); }
	});
});
