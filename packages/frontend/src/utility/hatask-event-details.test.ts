/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isSharedHataskEvent, hataskEventVisibilityLabel } from './hatask-event-audience.js';
import type { HataskCalendarDay, HataskCalendarEvent } from '@/components/hatask/hatask-planner-types.js';
import type { HataskEventDetails, HataskEventRsvpStatus } from '@/components/hatask/hatask-event-details-types.js';
import type { HataskPlannerEvent, HataskRecurrence } from '@/utility/hatask-planner-storage.js';

// Exercise the real parent callbacks without mounting the page or starting its
// Registry/API lifecycle. This is a mechanical contract, not browser layout QA.
const filename = resolve(process.cwd(), 'src/pages/hatask.vue');
const source = readFileSync(filename, 'utf8');
const parsed = parse(source, { filename });
if (!parsed.descriptor.scriptSetup) throw new Error('Missing Hatask setup script');
const script = ts.createSourceFile('hatask.vue.ts', parsed.descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function variable(name: string): ts.VariableDeclaration {
	for (const statement of script.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const found = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (found) return found;
	}
	throw new Error(`Missing variable: ${name}`);
}

function functionNode(name: string): ts.FunctionDeclaration {
	const node = script.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
	if (!node || !ts.isFunctionDeclaration(node) || !node.body) throw new Error(`Missing function: ${name}`);
	return node;
}

function functionSource(name: string): string { return functionNode(name).getText(script); }

function computedInitializer(name: string): string {
	const initializer = variable(name).initializer;
	if (!initializer || !ts.isCallExpression(initializer) || initializer.expression.getText(script) !== 'computed') throw new Error(`Missing computed: ${name}`);
	const callback = initializer.arguments.at(0);
	if (!callback || !ts.isArrowFunction(callback)) throw new Error(`Missing computed callback: ${name}`);
	return initializer.getText(script);
}

type CalendarSource = HataskPlannerEvent & { sourceEventId?: string; userId?: string; username?: string; isShared?: boolean; readOnly?: boolean; isRecurrenceOccurrence?: boolean };
type Response = { userId: string; username: string; status: HataskEventRsvpStatus; profile?: string };
type SharedEvent = { id: string; userId: string; username: string; rsvp: boolean; rsvpClosed?: boolean; rsvpResponses: Response[] };

function event(overrides: Partial<CalendarSource> = {}): CalendarSource {
	return { id: 'local-1', title: '予定', emoji: '⭐', color: '#e27d60', date: '2026-09-01', dateEnd: '2026-09-02', timeStart: '10:00', timeEnd: '11:00', allDay: false, visibility: 'private', rsvp: false, notify: true, notifyTimings: ['15分前'], recurrence: { frequency: 'none', interval: 1 }, archivedAt: null, ...overrides };
}

function shared(overrides: Partial<SharedEvent> = {}): SharedEvent {
	return { id: 'server-1', userId: 'me', username: 'organizer', rsvp: true, rsvpResponses: [], ...overrides };
}

function iso(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

type Runtime = {
	details: HataskEventDetails | null;
	openEventDetail: (event: CalendarSource, trigger?: HTMLElement | null) => void;
	closeEventDetail: () => void;
	getEventDetailAnchor: () => HTMLElement | null;
	activatePlannerEvent: (event: HataskCalendarEvent, day: HataskCalendarDay, trigger?: HTMLElement | null) => void;
	goToEvent: (event: CalendarSource, openDetails?: boolean) => void;
	eventViewRecurrenceLabel: (recurrence: HataskRecurrence | undefined) => string | undefined;
	editViewedEvent: () => Promise<void>;
	deleteViewedEvent: () => Promise<void>;
	respondToViewedEvent: (status: HataskEventRsvpStatus) => Promise<void>;
	closeViewedEventRsvp: () => Promise<void>;
};

function fixture(options: { local?: CalendarSource[]; calendar?: CalendarSource[]; shared?: SharedEvent[]; selected?: CalendarSource | null; signedIn?: boolean; legacyToggle?: boolean; baseDateControl?: boolean } = {}) {
	const events = { value: options.local ?? [] };
	const allCalendarEvents = { value: options.calendar ?? [] };
	const sharedEvents = { value: options.shared ?? [] };
	const viewingEvent = { value: options.selected ?? null };
	const eventViewReturnFocus = { value: null as HTMLElement | null };
	const eventViewBusy = { value: false };
	const plannerReadOnly = { value: false };
	const activeTab = { value: 'home' };
	const calYear = { value: 2026 }; const calMonth = { value: 8 }; const selectedDay = { value: 1 };
	const rootEl = { value: null as HTMLElement | null };
	const selectedDateStr = { get value() { return `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`; } };
	const newEvent = { value: { date: '2026-01-01', dateEnd: '2026-01-01', title: '未保存の入力' } };
	const operations: string[] = [];
	const startEditEvent = vi.fn((_event: CalendarSource) => { operations.push('edit'); });
	const deleteEventById = vi.fn(async (_id: string) => { operations.push('delete'); });
	const setRsvp = vi.fn(async (_id: string, _status: HataskEventRsvpStatus) => {});
	const closeRsvp = vi.fn(async (_id: string) => {});
	const functions = ['openEventDetail', 'closeEventDetail', 'getEventDetailAnchor', 'editViewedEvent', 'deleteViewedEvent', 'respondToViewedEvent', 'closeViewedEventRsvp', 'activatePlannerEvent', 'findPlannerCalendarSource', 'selectPlannerDate', 'setPlannerAnchor', 'goToEvent', 'parseIsoDate', 'eventDateRangeLabel', 'eventTimeLabel', 'eventViewRecurrenceLabel', 'recurrenceLabel', 'notifyTimingLabel', 'plannerEventServerId', 'sharedEventData', 'plannerCalendarEvent', 'plannerEventSource'];
	let code = functions.map(functionSource).join('\n');
	if (options.legacyToggle) {
		const original = 'viewingEvent.value = event;';
		if (!code.includes(original)) throw new Error('Missing open assignment for positive control');
		code = code.replace(original, 'viewingEvent.value = viewingEvent.value?.id === event.id ? null : event;');
	}
	let projection = computedInitializer('viewingEventDetails');
	if (options.baseDateControl) {
		const original = 'dateLabel: eventDateRangeLabel(event)';
		if (!projection.includes(original)) throw new Error('Missing occurrence date projection for positive control');
		projection = projection.replace(original, 'dateLabel: eventDateRangeLabel(local ?? event)');
	}
	code += `\nconst ${variable('notifyTimingLabels').getText(script)};\nconst viewingEventDetails = ${projection};\n({ get details() { return viewingEventDetails.value; }, ${functions.join(', ')} });`;
	const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	const runtime = runInNewContext(compiled.outputText, {
		isSharedHataskEvent, hataskEventVisibilityLabel,
		events, allCalendarEvents, sharedEvents, viewingEvent, eventViewReturnFocus, eventViewBusy, plannerReadOnly,
		activeTab, calYear, calMonth, selectedDay, selectedDateStr, rootEl, newEvent, 'window': window, HTMLElement, HTMLButtonElement,
		$i: options.signedIn === false ? null : { id: 'me', username: 'my-name' },
		computed: <T>(callback: () => T) => ({ get value() { return callback(); } }),
		nextTick: async () => { operations.push('tick'); }, startEditEvent, deleteEventById, setRsvp, closeRsvp,
		copy: { public: '公開', private: '非公開', allDay: '終日', closed: '締切', notify15MinutesBefore: '15分前', notify30MinutesBefore: '30分前', notify1HourBefore: '1時間前', notify1DayBefore: '1日前' },
		copyx: { dateRange: ({ start, end }: { start: string; end: string }) => `${start}〜${end}` },
		i18n: { ts: { enabled: '有効', disabled: '無効' } },
		plannerCopy: { recurrenceDaily: '毎日', recurrenceWeekly: '毎週', recurrenceMonthly: '毎月', recurrenceYearly: '毎年', recurrenceNone: 'なし', recurrenceActionsHint: '編集・削除は繰返し全体', conflict: '競合', syncFailed: '同期失敗', syncUnlinked: '未連携', syncPending: '同期待ち' },
		plannerCopyx: {
			recurrenceDailyInterval: ({ interval }: { interval: string }) => `${interval}日ごと`, recurrenceWeeklyInterval: ({ interval }: { interval: string }) => `${interval}週ごと`,
			recurrenceMonthlyInterval: ({ interval }: { interval: string }) => `${interval}か月ごと`, recurrenceYearlyInterval: ({ interval }: { interval: string }) => `${interval}年ごと`,
			recurrenceUntil: ({ date }: { date: string }) => `${date}まで`, recurrenceCount: ({ count }: { count: string }) => `${count}回`,
		},
		longDateFormatter: { format: iso }, weekdayShortFormatter: { format: (date: Date) => ['日', '月', '火', '水', '木', '金', '土'][date.getDay()] },
	}, { timeout: 1000 }) as Runtime;
	return { runtime, events, allCalendarEvents, sharedEvents, viewingEvent, eventViewReturnFocus, eventViewBusy, plannerReadOnly, activeTab, calYear, calMonth, selectedDay, rootEl, newEvent, operations, startEditEvent, deleteEventById, setRsvp, closeRsvp };
}

const mounted: HTMLElement[] = [];

function button(): HTMLButtonElement { const element = window.document.createElement('button'); window.document.body.append(element); mounted.push(element); return element; }

afterEach(() => { for (const element of mounted.splice(0)) element.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function measureAnchor(element: HTMLElement, x: number, y: number, width: number, height: number): void {
	const rect = new DOMRect(x, y, width, height);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
	vi.spyOn(element, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
}

function calendarAnchorDom(view: 'month' | 'all-day' | 'timed' | 'agenda' | 'pane', date = '2026-09-01') {
	const root = window.document.createElement('div');
	const calendar = window.document.createElement('section');
	calendar.dataset.hataskComponent = 'calendar'; root.append(calendar);
	const day = window.document.createElement(view === 'month' ? 'div' : view === 'all-day' || view === 'timed' ? 'article' : 'section');
	day.dataset.date = date; calendar.append(day);
	let heading: HTMLElement;
	if (view === 'month') {
		day.setAttribute('role', 'gridcell');
		heading = window.document.createElement('button'); heading.dataset.calendarDayButton = ''; day.append(heading);
	} else {
		const header = window.document.createElement('header'); day.append(header);
		if (view === 'pane') {
			day.dataset.calendarDayPane = ''; header.append(window.document.createElement('strong')); heading = header;
		} else {
			heading = window.document.createElement('button'); header.append(heading);
		}
	}
	const trigger = window.document.createElement('button');
	const row = view === 'month' ? trigger : window.document.createElement('div');
	if (view !== 'all-day') row.dataset.calendarEvent = 'local-1';
	if (row !== trigger) row.append(trigger);
	day.append(row); window.document.body.append(root); mounted.push(root);
	measureAnchor(root, 20, 20, 800, 650); measureAnchor(calendar, 40, 40, 760, 600);
	measureAnchor(day, 60, 90, 400, 500); measureAnchor(heading, 80, 110, 240, 44); measureAnchor(trigger, 80, 240, 260, 55);
	return { root, calendar, day, heading, trigger, row };
}

describe('予定詳細の吹き出しは自分のカレンダー内の日付へ配置する', () => {
	test.each(['month', 'all-day', 'timed', 'agenda', 'pane'] as const)('%s入口は実クリック先の日付見出しを最優先し、focus起点とdraftを変更しない', view => {
		const dom = calendarAnchorDom(view); const current = fixture({ selected: event() });
		current.rootEl.value = dom.root; current.activeTab.value = 'cal'; current.eventViewReturnFocus.value = dom.trigger;
		const before = JSON.stringify([current.viewingEvent.value, current.newEvent.value]);
		expect(current.runtime.getEventDetailAnchor()).toBe(dom.heading);
		expect(current.eventViewReturnFocus.value).toBe(dom.trigger);
		expect(JSON.stringify([current.viewingEvent.value, current.newEvent.value])).toBe(before);
	});

	test.each(['x', 'y'] as const)('viewport内でも%s方向のscroll祖先から隠れた日付見出しは実triggerへ切り替える', axis => {
		const dom = calendarAnchorDom('timed'); const current = fixture({ selected: event() });
		current.rootEl.value = dom.root; current.activeTab.value = 'cal'; current.eventViewReturnFocus.value = dom.trigger;
		expect(current.runtime.getEventDetailAnchor()).toBe(dom.heading);
		if (axis === 'y') {
			dom.day.style.overflowY = 'auto'; measureAnchor(dom.day, 60, 200, 400, 350);
		} else {
			dom.day.style.overflowX = 'hidden'; measureAnchor(dom.day, 350, 90, 350, 500); measureAnchor(dom.trigger, 370, 240, 200, 55);
		}
		expect(current.runtime.getEventDetailAnchor()).toBe(dom.trigger);
	});

	test('inertな背景でも配置を再解決でき、日付見出しがviewport外なら見えるtriggerを使う', () => {
		const dom = calendarAnchorDom('month'); const current = fixture({ selected: event() });
		current.rootEl.value = dom.root; current.activeTab.value = 'cal'; current.eventViewReturnFocus.value = dom.trigger;
		dom.root.inert = true; expect(current.runtime.getEventDetailAnchor()).toBe(dom.heading);
		measureAnchor(dom.heading, 80, -60, 240, 44); expect(current.runtime.getEventDetailAnchor()).toBe(dom.trigger);
		measureAnchor(dom.heading, 80, 110, 240, 44); expect(current.runtime.getEventDetailAnchor()).toBe(dom.heading);
	});

	test('home/search・別windowの起点は無視し、同日の同予定から日付見出しへfallbackする', () => {
		const dom = calendarAnchorDom('month'); const other = calendarAnchorDom('pane');
		const current = fixture({ selected: event() }); current.rootEl.value = dom.root; current.activeTab.value = 'cal';
		for (const external of [button(), other.trigger]) {
			current.eventViewReturnFocus.value = external;
			expect(current.runtime.getEventDetailAnchor()).toBe(dom.trigger);
			expect(current.eventViewReturnFocus.value).toBe(external);
		}
		// Month limits and filters can omit the selected event while its day remains.
		dom.row.remove(); expect(current.runtime.getEventDetailAnchor()).toBe(dom.heading);
		measureAnchor(dom.heading, 80, -60, 240, 44); expect(current.runtime.getEventDetailAnchor()).toBeNull();
	});

	test('同じ日付が月本体と選択日paneに重複しても、元triggerのpane見出しを優先する', () => {
		const month = calendarAnchorDom('month'); const pane = calendarAnchorDom('pane');
		month.calendar.append(pane.day);
		const current = fixture({ selected: event() }); current.rootEl.value = month.root; current.activeTab.value = 'cal'; current.eventViewReturnFocus.value = pane.trigger;
		expect(current.runtime.getEventDetailAnchor()).toBe(pane.heading);
		pane.day.remove(); expect(current.runtime.getEventDetailAnchor()).toBe(month.trigger);
		expect(current.eventViewReturnFocus.value).toBe(pane.trigger);
	});

	test('複数日予定は開始日でなく選択日へ限定し、別日の同じidへ誤接続しない', () => {
		const first = calendarAnchorDom('month'); const second = calendarAnchorDom('agenda', '2026-09-02');
		first.calendar.append(second.day);
		const item = event(); const current = fixture({ selected: item }); current.rootEl.value = first.root; current.activeTab.value = 'cal'; current.selectedDay.value = 2;
		current.eventViewReturnFocus.value = first.trigger;
		expect(current.runtime.getEventDetailAnchor()).toBe(second.trigger);
		second.row.remove(); expect(current.runtime.getEventDetailAnchor()).toBe(second.heading);
		second.day.remove(); expect(current.runtime.getEventDetailAnchor()).toBeNull();
	});

	test('visualViewportと祖先の非表示を反映し、未選択・別タブ・切断済みcalendarには配置しない', () => {
		const dom = calendarAnchorDom('month'); const current = fixture({ selected: event() });
		current.rootEl.value = dom.root; current.activeTab.value = 'cal'; current.eventViewReturnFocus.value = dom.trigger;
		vi.stubGlobal('visualViewport', { offsetLeft: 40, offsetTop: 200, width: 700, height: 400 });
		expect(current.runtime.getEventDetailAnchor()).toBe(dom.trigger);
		dom.day.style.display = 'none'; expect(current.runtime.getEventDetailAnchor()).toBeNull();
		dom.day.style.display = ''; dom.day.style.visibility = 'hidden'; expect(current.runtime.getEventDetailAnchor()).toBeNull();
		dom.day.style.visibility = ''; expect(current.runtime.getEventDetailAnchor()).toBe(dom.trigger);
		current.activeTab.value = 'home'; expect(current.runtime.getEventDetailAnchor()).toBeNull();
		current.activeTab.value = 'cal'; current.runtime.closeEventDetail(); expect(current.runtime.getEventDetailAnchor()).toBeNull();
		current.runtime.openEventDetail(event(), dom.trigger); dom.root.remove(); expect(current.runtime.getEventDetailAnchor()).toBeNull();
	});
});

describe('Hataskの予定詳細はクリックした予定を非破壊で開く', () => {
	test('同じ予定の再クリックでも開いたままで、明示した起点を保持する（旧toggle陽性対照）', () => {
		const item = event(); const trigger = button();
		const remainsOpen = (current: ReturnType<typeof fixture>) => { current.runtime.openEventDetail(item, trigger); current.runtime.openEventDetail(item, trigger); return current.viewingEvent.value?.id === item.id; };
		expect(remainsOpen(fixture({ legacyToggle: true }))).toBe(false);
		const current = fixture(); expect(remainsOpen(current)).toBe(true);
		expect(current.eventViewReturnFocus.value).toBe(trigger);
		current.runtime.closeEventDetail(); expect(current.viewingEvent.value).toBeNull();
		expect(current.eventViewReturnFocus.value).toBe(trigger);
	});

	test('起点未指定では現在のfocusを保持し、全入口の親handlerが元occurrenceと実日付を選ぶ', () => {
		const local = event(); const occurrence = event({ id: 'local-1::2026-10-01', sourceEventId: local.id, date: '2026-10-01', dateEnd: '2026-10-02' });
		const current = fixture({ local: [local], calendar: [occurrence] }); const trigger = button(); trigger.focus();
		current.runtime.openEventDetail(occurrence); expect(current.eventViewReturnFocus.value).toBe(trigger);
		const before = JSON.stringify([current.events.value, current.allCalendarEvents.value]);
		const draftBefore = JSON.stringify(current.newEvent.value);
		const day: HataskCalendarDay = { key: '2026-10-02', date: '2026-10-02', label: '10月2日', dayNumber: 2, events: [] };
		current.runtime.activatePlannerEvent({ id: occurrence.id, title: '表示用' }, day, trigger);
		expect(current.viewingEvent.value).toBe(occurrence);
		expect([current.calYear.value, current.calMonth.value, current.selectedDay.value]).toEqual([2026, 9, 2]);
		expect(JSON.stringify(current.newEvent.value)).toBe(draftBefore);
		expect(current.runtime.details?.dateLabel).toBe('2026-10-01〜2026-10-02');
		expect(JSON.stringify([current.events.value, current.allCalendarEvents.value])).toBe(before);
		current.runtime.activatePlannerEvent({ id: 'missing', title: '消えた予定' }, day, trigger);
		expect(current.viewingEvent.value).toBeNull();
	});

	test('ホーム等からのgoToEventも既存のcal移動後に詳細を開き、日付文字列を保持する', () => {
		const item = event({ date: '2026-12-31', dateEnd: '2027-01-01' }); const current = fixture();
		const before = JSON.stringify(item); current.runtime.goToEvent(item);
		expect(current.activeTab.value).toBe('cal'); expect(current.viewingEvent.value).toBe(item);
		expect([current.calYear.value, current.calMonth.value, current.selectedDay.value]).toEqual([2026, 11, 31]);
		expect(JSON.stringify(item)).toBe(before);
	});

	test('移動用のgoToEvent(false)は日付を選び、既存詳細を閉じて移動dialogとの重なりを防ぐ', () => {
		const item = event({ date: '2026-12-31', dateEnd: '2027-01-01' });
		const current = fixture({ local: [item], calendar: [item] });
		const before = JSON.stringify([current.events.value, current.allCalendarEvents.value, current.newEvent.value]);
		current.runtime.goToEvent(item, true); expect(current.viewingEvent.value).toBe(item);
		current.activeTab.value = 'home'; current.selectedDay.value = 1;
		current.runtime.goToEvent(item, false);
		expect(current.activeTab.value).toBe('cal');
		expect([current.calYear.value, current.calMonth.value, current.selectedDay.value]).toEqual([2026, 11, 31]);
		expect(current.viewingEvent.value).toBeNull(); expect(current.runtime.details).toBeNull();
		expect(JSON.stringify([current.events.value, current.allCalendarEvents.value, current.newEvent.value])).toBe(before);
	});

	test('暁snooze-eventは詳細なしで予定を選んだ後、既存移動handlerへ投影を渡す', () => {
		const node = functionNode('handleAkatsukiAction');
		const branch = node.body?.statements.find(ts.isSwitchStatement);
		if (!branch) throw new Error('Missing Akatsuki action switch');
		const clause = branch.caseBlock.clauses.find(item => ts.isCaseClause(item) && ts.isStringLiteral(item.expression) && item.expression.text === 'snooze-event');
		if (!clause) throw new Error('Missing snooze-event case');
		const calls: ts.CallExpression[] = [];
		const visit = (child: ts.Node): void => { if (ts.isCallExpression(child)) calls.push(child); ts.forEachChild(child, visit); };
		visit(clause);
		const navigation = calls.find(call => call.expression.getText(script) === 'goToEvent');
		const move = calls.find(call => call.expression.getText(script) === 'handleCalendarMoveRequest');
		if (!navigation || !move) throw new Error('Missing snooze navigation or move delegation');
		expect(navigation.arguments.map(argument => argument.getText(script))).toEqual(['event', 'false']);
		expect(move.arguments.map(argument => argument.getText(script))).toEqual(['plannerCalendarEvent(event)']);
		expect(navigation.pos).toBeLessThan(move.pos);
	});

	test('KeepAlive離脱は既存cleanupへ委譲し、非同期処理より前に詳細を閉じる', () => {
		const body = functionNode('cleanupHataskState').body;
		if (!body) throw new Error('Missing cleanup body');
		const statements = body.statements;
		const preserveGuard = statements.find(statement => ts.isIfStatement(statement) && statement.expression.getText(script) === '!preserveInput');
		const closing = preserveGuard && ts.isIfStatement(preserveGuard) && ts.isBlock(preserveGuard.thenStatement)
			? preserveGuard.thenStatement.statements.find(statement => statement.getText(script) === 'closeEventDetail();') : undefined;
		const deferred = statements.find(statement => ts.isIfStatement(statement) && statement.expression.getText(script) === '!props.embedded');
		if (!closing || !deferred) throw new Error('Missing cleanup sequence');
		expect(closing.pos).toBeLessThan(deferred.pos);
		const hook = script.statements.find(statement => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(script) === 'onDeactivated');
		if (!hook) throw new Error('Missing deactivation lifecycle hook');
		const cleanupHataskState = vi.fn();
		const callbacks: Array<() => void> = [];
		const compiled = ts.transpileModule(hook.getText(script), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
		runInNewContext(compiled.outputText, { cleanupHataskState, closeGoesCapture: vi.fn(), props: { embedded: false }, invalidateCommunityFlowers: vi.fn(), sharedEventRequest: 0, sharedEvents: { value: [] }, $i: { id: 'me' }, checkClosedRsvps: vi.fn(), onDeactivated: (callback: () => void) => callbacks.push(callback) }, { timeout: 1000 });
		expect(callbacks).toHaveLength(1); callbacks[0](); expect(cleanupHataskState).toHaveBeenCalledTimes(1);
	});
});

describe('予定詳細の実computed projection', () => {
	test('未選択はnull、取得一覧から消えた予定は選択時snapshotを使う', () => {
		const current = fixture(); expect(current.runtime.details).toBeNull();
		current.runtime.openEventDetail(event({ title: 'snapshot', allDay: true }));
		expect(current.runtime.details).toMatchObject({ title: 'snapshot', timeLabel: '終日', canEdit: false, rsvp: null });
	});

	test('繰返しの開催日を基底日へ戻す誤実装を同じ日付検査で検出する', () => {
		const local = event({ recurrence: { frequency: 'weekly', interval: 2 } });
		const occurrence = event({ id: `${local.id}::2026-09-15`, sourceEventId: local.id, date: '2026-09-15', dateEnd: '2026-09-16' });
		const options = { local: [local], calendar: [occurrence], selected: occurrence };
		const hasOccurrenceDate = (current: ReturnType<typeof fixture>) => current.runtime.details?.dateLabel === '2026-09-15〜2026-09-16';
		expect(hasOccurrenceDate(fixture({ ...options, baseDateControl: true }))).toBe(false);
		const current = fixture(options); const before = JSON.stringify(options);
		expect(hasOccurrenceDate(current)).toBe(true);
		expect(current.runtime.details).toMatchObject({ canEdit: true, isOwner: true, ownerLabel: '@my-name', recurrenceLabel: '2週ごと', recurrenceHint: '編集・削除は繰返し全体', notificationLabel: '15分前' });
		expect(JSON.stringify(options)).toBe(before);
	});

	test.each([
		{ name: 'local私有', local: true, owner: undefined, readOnly: false, canEdit: true, isOwner: true },
		{ name: '公開主催者', local: false, owner: 'me', readOnly: false, canEdit: true, isOwner: true },
		{ name: '他人共有', local: false, owner: 'other', readOnly: true, canEdit: false, isOwner: false },
		{ name: 'ownerでもreadOnly', local: true, owner: 'me', readOnly: true, canEdit: false, isOwner: true },
		{ name: 'local対応があっても別owner', local: true, owner: 'other', readOnly: false, canEdit: false, isOwner: false },
	])('$nameの所有権と編集可否をserver情報から判断する', ({ local, owner, readOnly, canEdit, isOwner }) => {
		const item = event({ id: 'server-1', readOnly, userId: owner, visibility: owner ? 'public' : 'private', isShared: !!owner });
		const current = fixture({ selected: item, local: local ? [event({ serverEventId: item.id })] : [], shared: owner ? [shared({ userId: owner })] : [] });
		expect(current.runtime.details).toMatchObject({ canEdit, isOwner, isPublic: !!owner, visibilityLabel: owner ? '公開' : '非公開' });
	});

	test('サインアウト状態では未知の公開予定を主催者扱いしない', () => {
		const current = fixture({ signedIn: false, selected: event({ visibility: 'public' }) });
		expect(current.runtime.details).toMatchObject({ canEdit: false, isOwner: false });
	});

	test('同じIDの最新予定と新しいRSVPを再取得し、local/server IDを分離して回答の余分な情報を投影しない', () => {
		const local = event({ serverEventId: 'server-1', visibility: 'public', userId: 'me', username: 'stale' });
		const server = shared({ rsvpResponses: [{ userId: 'me', username: 'my-name', status: 'maybe', profile: 'not-for-projection' }] });
		const current = fixture({ selected: local, local: [local], calendar: [{ ...local, title: '最新の題名' }], shared: [server] });
		const before = JSON.stringify([local, server]);
		expect(current.runtime.details).toMatchObject({ id: local.id, title: '最新の題名', ownerLabel: '@organizer', rsvp: { myStatus: 'maybe', closed: false, responses: [{ userId: 'me', username: 'my-name', status: 'maybe' }] } });
		expect(current.runtime.details?.rsvp?.responses[0]).not.toHaveProperty('profile');
		expect(current.runtime.details?.rsvp?.responses).not.toBe(server.rsvpResponses);
		expect(JSON.stringify([local, server])).toBe(before);
		current.sharedEvents.value = [shared({ rsvpClosed: true, rsvpResponses: [{ userId: 'me', username: 'my-name', status: 'going' }] })];
		expect(current.runtime.details?.rsvp).toMatchObject({ closed: true, myStatus: 'going' });
		current.sharedEvents.value = [shared({ rsvp: false })]; expect(current.runtime.details?.rsvp).toBeNull();
	});

	test.each([
		{ notify: false, timings: ['15分前'], label: '無効' }, { notify: true, timings: [], label: '有効' },
		{ notify: true, timings: ['15分前', '1日前', '独自通知'], label: '15分前 / 1日前 / 独自通知' },
	])('通知設定はlocalのnotify=$notifyを尊重する', ({ notify, timings, label }) => {
		const local = event({ notify, notifyTimings: timings }); const current = fixture({ selected: local, local: [local] });
		expect(current.runtime.details?.notificationLabel).toBe(label);
		current.events.value = []; expect(current.runtime.details?.notificationLabel).toBeUndefined();
	});

	test.each([
		['conflict', '競合'], ['sync-error', '同期失敗'], ['unlinked', '未連携'], ['pending', '同期待ち'],
		['creating', '同期待ち'], ['updating', '同期待ち'], ['deleting', '同期待ち'], ['deleting-local', '同期待ち'],
	] as const)('同期状態%sは既存calendar projectionと同じ文言になる', (state, label) => {
		const current = fixture({ selected: event({ publicSyncState: state }) }); expect(current.runtime.details?.syncLabel).toBe(label);
	});
});

describe('繰返しの説明', () => {
	test.each([
		['daily', '毎日', '3日ごと'], ['weekly', '毎週', '3週ごと'], ['monthly', '毎月', '3か月ごと'], ['yearly', '毎年', '3年ごと'],
	] as const)('%sの単位と間隔を正しい既存翻訳へ渡す', (frequency, single, interval) => {
		const current = fixture(); expect(current.runtime.eventViewRecurrenceLabel({ frequency, interval: 1 })).toBe(single);
		expect(current.runtime.eventViewRecurrenceLabel({ frequency, interval: 3 })).toBe(interval);
	});
	test('曜日を重複除去・順序化し、終期と回数も説明する（入力は変更しない）', () => {
		const current = fixture(); const recurrence: HataskRecurrence = { frequency: 'weekly', interval: 2, weekdays: [5, 1, 5, 0], until: '2026-12-31T23:59:00.000Z', count: 8 };
		const before = JSON.stringify(recurrence);
		expect(current.runtime.eventViewRecurrenceLabel(recurrence)).toBe('2週ごと · 日 / 月 / 金 · 2026-12-31まで · 8回');
		expect(JSON.stringify(recurrence)).toBe(before);
		expect(current.runtime.eventViewRecurrenceLabel(undefined)).toBeUndefined();
		expect(current.runtime.eventViewRecurrenceLabel({ frequency: 'none', interval: 1 })).toBeUndefined();
	});
});

describe('既存編集・削除・RSVPへの委譲と操作ガード', () => {
	test.each(['editViewedEvent', 'deleteViewedEvent'] as const)('%sは先に詳細を閉じ、nextTick後に元の確認・保存handlerへ渡す', async action => {
		const item = event(); const current = fixture({ local: [item], selected: item });
		const before = JSON.stringify(item); const pending = current.runtime[action]();
		expect(current.viewingEvent.value).toBeNull(); expect(current.operations).toEqual(['tick']);
		await pending; expect(current.operations).toEqual(['tick', action === 'editViewedEvent' ? 'edit' : 'delete']);
		if (action === 'editViewedEvent') expect(current.startEditEvent).toHaveBeenCalledWith(item);
		else expect(current.deleteEventById).toHaveBeenCalledWith(item.id);
		expect(JSON.stringify(item)).toBe(before);
	});
	test.each(['editViewedEvent', 'deleteViewedEvent'] as const)('%sは非owner・readOnly・処理中・未選択では起動しない', async action => {
		// The permitted branch above supplies the positive control for these guards.
		for (const blocked of ['other', 'readOnly', 'busy', 'missing'] as const) {
			const item = event(); const current = fixture({ selected: blocked === 'missing' ? null : item, local: blocked === 'other' ? [] : [item] });
			current.plannerReadOnly.value = blocked === 'readOnly'; current.eventViewBusy.value = blocked === 'busy';
			await current.runtime[action](); expect(current.operations, blocked).toEqual([]);
			expect(current.startEditEvent).not.toHaveBeenCalled(); expect(current.deleteEventById).not.toHaveBeenCalled();
		}
	});
	test.each(['respondToViewedEvent', 'closeViewedEventRsvp'] as const)('%sは既存handlerを1回だけ呼び、処理中の再操作を抑止する', async action => {
		const item = event({ id: 'server-1', isShared: true, visibility: 'public' });
		const current = fixture({ selected: item, shared: [shared({ userId: action === 'closeViewedEventRsvp' ? 'me' : 'other' })] });
		let finish: (() => void) | undefined;
		const blocker = () => new Promise<void>(resolvePromise => { finish = resolvePromise; });
		current.setRsvp.mockImplementation(blocker); current.closeRsvp.mockImplementation(blocker);
		const pending = action === 'respondToViewedEvent' ? current.runtime.respondToViewedEvent('going') : current.runtime.closeViewedEventRsvp();
		expect(current.eventViewBusy.value).toBe(true);
		if (action === 'respondToViewedEvent') {
			await current.runtime.respondToViewedEvent('declined'); expect(current.setRsvp).toHaveBeenCalledTimes(1); expect(current.setRsvp).toHaveBeenCalledWith(item.id, 'going');
		} else {
			await current.runtime.closeViewedEventRsvp(); expect(current.closeRsvp).toHaveBeenCalledTimes(1); expect(current.closeRsvp).toHaveBeenCalledWith(item.id);
		}
		if (!finish) throw new Error('Expected delegated async handler to be running'); finish(); await pending;
		expect(current.eventViewBusy.value).toBe(false); expect(current.viewingEvent.value).toBe(item);
	});
	test.each(['respondToViewedEvent', 'closeViewedEventRsvp'] as const)('%sは不適切な権限・締切・readOnly・処理中・RSVP無しを拒む', async action => {
		for (const blocked of ['wrong-owner', 'closed', 'readOnly', 'busy', 'no-rsvp', 'no-selection'] as const) {
			const owns = action === 'closeViewedEventRsvp';
			const owner = (blocked === 'wrong-owner' ? !owns : owns) ? 'me' : 'other';
			const current = fixture({ selected: blocked === 'no-selection' ? null : event({ id: 'server-1' }), shared: [shared({ userId: owner, rsvp: blocked !== 'no-rsvp', rsvpClosed: blocked === 'closed' })] });
			current.plannerReadOnly.value = blocked === 'readOnly'; current.eventViewBusy.value = blocked === 'busy';
			if (action === 'respondToViewedEvent') await current.runtime.respondToViewedEvent('maybe'); else await current.runtime.closeViewedEventRsvp();
			expect(current.setRsvp, blocked).not.toHaveBeenCalled(); expect(current.closeRsvp, blocked).not.toHaveBeenCalled();
		}
	});
	test.each(['respondToViewedEvent', 'closeViewedEventRsvp'] as const)('%sの委譲が失敗してもbusyは必ず解除する', async action => {
		const current = fixture({ selected: event({ id: 'server-1' }), shared: [shared({ userId: action === 'closeViewedEventRsvp' ? 'me' : 'other' })] });
		current.setRsvp.mockRejectedValue(new Error('offline')); current.closeRsvp.mockRejectedValue(new Error('offline'));
		await expect(action === 'respondToViewedEvent' ? current.runtime.respondToViewedEvent('maybe') : current.runtime.closeViewedEventRsvp()).rejects.toThrow('offline');
		expect(current.eventViewBusy.value).toBe(false);
	});
});

describe('予定詳細ポップアップの親テンプレート・テーマ契約', () => {
	test('bodyへのTeleportでprojectionと既存handlerを結線し、旧pagedEvents詳細を使わない', () => {
		const markup = parsed.descriptor.template?.content;
		if (!markup) throw new Error('Missing Hatask template');
		const fragment = window.document.createElement('template'); fragment.innerHTML = markup;
		const dialog = fragment.content.querySelector('HataskEventDetailsDialog');
		expect(dialog?.parentElement?.tagName.toLowerCase()).toBe('teleport'); expect(dialog?.parentElement?.getAttribute('to')).toBe('body');
		for (const [attribute, value] of Object.entries({ ':isopen': 'viewingEvent !== null', ':event': 'viewingEventDetails', ':labels': 'eventViewLabels', ':data-theme': 'plannerTheme', ':data-mode': 'themeMode', ':readonly': 'plannerReadOnly', ':busy': 'eventViewBusy || (viewingEventDetails !== null && isRsvpSaving(viewingEventDetails.id))', ':returnfocusto': 'eventViewReturnFocus', ':getanchor': 'getEventDetailAnchor', ':animations': 'settings.animations !== false', '@close': 'closeEventDetail', '@edit': 'editViewedEvent', '@delete': 'deleteViewedEvent', '@rsvp': 'respondToViewedEvent', '@closersvp': 'closeViewedEventRsvp' })) expect(dialog?.getAttribute(attribute), attribute).toBe(value);
		expect(dialog?.classList.contains('htk-event-details-theme')).toBe(true);
		const hasInlineDetail = (text: string) => /class=["'][^"']*\bhtk-evdet\b/u.test(text) || /v-for=["']ev in pagedEvents["']/u.test(text);
		expect(hasInlineDetail(`${markup}<div class="htk-evdet" v-for="ev in pagedEvents"/>`)).toBe(true);
		expect(hasInlineDetail(markup)).toBe(false);
	});

	test('全5テーマlight/darkの既存rootと同一のtoken宣言をTeleport先にも共有する', async () => {
		const style = parsed.descriptor.styles.find(item => item.scoped && item.lang === 'scss');
		if (!style) throw new Error('Missing parent scoped SCSS');
		const scope = 'data-v-hatask-event-details';
		const compiled = await compileStyleAsync({ source: style.content + '\n' + readFileSync(resolve(process.cwd(), 'src/components/hatask/hatask-themes.scss'), 'utf8'), filename, id: scope, scoped: true, preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const root = compiled.rawResult?.root; if (!root) throw new Error('Missing compiled stylesheet');
		// Compare the dialog's palette/font/card contract, not page-only sizing.
		const themeTokens = new Set<string>(['--bg', '--surface', '--fg', '--fg-2', '--fg-3', '--rule', '--accent', '--accent-ink', '--on-accent', '--htk-fallback', '--htk-font-body', '--htk-font-head', '--card', '--card-border', '--card-radius', '--card-shadow', '--radius-lg']);
		const tokens = new Map<string, Record<string, string>>();
		root.walkRules(rule => {
			const declarations: Record<string, string> = {};
			rule.walkDecls(declaration => {
				if (themeTokens.has(declaration.prop)) declarations[declaration.prop] = declaration.value;
			});
			for (const selector of rule.selectors) {
				const normalized = selector.replaceAll(`[${scope}]`, '').replace('[data-mode]', '').replace(/\[([\w-]+)=(["']?)([\w-]+)\2\]/gu, '[$1=$3]').trim();
				if (!/^\.(htk-root|htk-event-details-theme)\[data-theme(?:=[\w-]+)?\](?:\[data-mode=dark\])?(?::not\(\[data-theme=akatsuki\]\))?$/u.test(normalized)) continue;
				tokens.set(normalized, { ...tokens.get(normalized), ...declarations });
			}
		});
		const suffixes = ['[data-theme]', '[data-theme]:not([data-theme=akatsuki])', ...['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'].flatMap(theme => [`[data-theme=${theme}]`, `[data-theme=${theme}][data-mode=dark]`])];
		const mismatches = (collection: typeof tokens) => suffixes.filter(suffix => !collection.has(`.htk-event-details-theme${suffix}`) || JSON.stringify(collection.get(`.htk-root${suffix}`)) !== JSON.stringify(collection.get(`.htk-event-details-theme${suffix}`)));
		const broken = new Map(tokens); broken.delete('.htk-event-details-theme[data-theme=akatsuki][data-mode=dark]');
		expect(mismatches(broken)).toContain('[data-theme=akatsuki][data-mode=dark]');
		expect(mismatches(tokens)).toEqual([]);
		for (const theme of ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu']) {
			for (const dark of [false, true]) {
				const base = `[data-theme=${theme}]`;
				const inherited = { ...tokens.get('.htk-event-details-theme[data-theme]'), ...(theme !== 'akatsuki' ? tokens.get('.htk-event-details-theme[data-theme]:not([data-theme=akatsuki])') : {}), ...tokens.get(`.htk-event-details-theme${base}`), ...(dark ? tokens.get(`.htk-event-details-theme${base}[data-mode=dark]`) : {}) };
				for (const token of ['--bg', '--surface', '--fg', '--fg-2', '--rule', '--accent', '--on-accent', '--htk-font-body', '--htk-font-head', '--card', '--card-border', '--card-radius', '--card-shadow']) expect(inherited[token], `${theme} dark=${dark} ${token}`).toBeTruthy();
			}
		}
	});
});
