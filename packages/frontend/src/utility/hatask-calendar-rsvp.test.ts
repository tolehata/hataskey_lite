/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, ref } from 'vue';
import { describe, expect, test, vi } from 'vitest';
import { isSharedHataskEvent } from './hatask-event-audience.js';
import { expandHataskEventOccurrences } from './hatask-planner-recurrence.js';
import type { HataskCalendarDay, HataskCalendarView, HataskPlannerFilter } from '@/components/hatask/hatask-planner-types.js';
import type { HataskPlannerEvent } from '@/utility/hatask-planner-storage.js';

const parsed = parse(readFileSync(`${process.cwd()}/src/pages/hatask.vue`, 'utf8'));
if (!parsed.descriptor.scriptSetup) throw new Error('Missing Hatask setup script');
const script = ts.createSourceFile('hatask.ts', parsed.descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
type Status = 'going' | 'maybe' | 'declined';
type CalendarSource = HataskPlannerEvent & { userId?: string; rsvpClosed?: boolean; rsvpResponses?: { userId: string; status: Status }[] };

function declaration(name: string): ts.VariableDeclaration {
	for (const statement of script.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const node = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (node) return node;
	}
	throw new Error(`Missing variable ${name}`);
}

function functionSource(name: string): string {
	const node = script.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
	if (!node) throw new Error(`Missing function ${name}`);
	return node.getText(script);
}

function akatsukiEventsBinding(): string {
	const initializer = declaration('akatsukiSnapshot').initializer;
	if (!initializer || !ts.isCallExpression(initializer)) throw new Error('Missing Akatsuki snapshot');
	const callback = initializer.arguments[0];
	if (!ts.isArrowFunction(callback)) throw new Error('Missing Akatsuki callback');
	if (!ts.isCallExpression(callback.body)) throw new Error('Missing Akatsuki model builder');
	const body = callback.body.arguments[0];
	if (!ts.isObjectLiteralExpression(body)) throw new Error('Missing Akatsuki object');
	const property = body.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(script) === 'events');
	if (!property || !ts.isPropertyAssignment(property)) throw new Error('Missing Akatsuki events');
	return property.initializer.getText(script);
}

function event(id: string, overrides: Partial<CalendarSource> = {}): CalendarSource {
	return {
		id, title: id, date: '2026-09-12', dateEnd: '2026-09-12', allDay: true, color: '#1677aa',
		visibility: 'public', rsvp: true, userId: 'organizer', rsvpResponses: [],
		notify: false, notifyTimings: [], recurrence: { frequency: 'none', interval: 1 }, archivedAt: null, ...overrides,
	};
}

function response(status: Status, userId = 'me'): { userId: string; status: Status }[] { return [{ userId, status }]; }

type Runtime = {
	all: CalendarSource[];
	visible: CalendarSource[];
	upcoming: CalendarSource[];
	akatsukiEvents: CalendarSource[];
	days: HataskCalendarDay[];
	filters: HataskPlannerFilter[];
	showDeclined: boolean;
	togglePlannerCalendarFilter: (id: string) => void;
	plannerEventForDate: (date: string) => CalendarSource[];
	findPlannerCalendarSource: (event: { id: string }) => CalendarSource | undefined;
	setRsvp: (id: string, status: Status) => Promise<void>;
};

function fixture(shared: CalendarSource[], options: { local?: CalendarSource[]; signedIn?: boolean; view?: HataskCalendarView } = {}) {
	const sharedEvents = ref(shared);
	const events = ref(options.local ?? []);
	const api = vi.fn().mockResolvedValue({});
	const reload = vi.fn(async () => {});
	const functions = [
		'isDeclinedCalendarInvitation', 'plannerEventForDate', 'plannerEventSource', 'togglePlannerCalendarFilter',
		'findPlannerCalendarSource', 'eDateTimeKey', 'localDateKey',
		'plannerAnchorDate', 'addCalendarDays', 'startOfPlannerWeek',
		'plannerEventServerId', 'sharedEventData', 'sharedRsvpResponses', 'sharedRsvpMyStatus', 'isRsvpSaving', 'setRsvp',
	];
	const variables = ['showDeclinedInvitations', 'plannerCalendarFilterIds', 'allCalendarEvents', 'visibleCalendarEvents', 'upcomingEvents', 'plannerCalendarDates', 'plannerCalendarDays', 'plannerCalendarFilters'];
	const code = `${functions.map(functionSource).join('\n')}
		${variables.map(name => `const ${declaration(name).getText(script)};`).join('\n')}
		({ ${functions.join(', ')},
			get all() { return allCalendarEvents.value; }, get visible() { return visibleCalendarEvents.value; },
			get upcoming() { return upcomingEvents.value; },
			get akatsukiEvents() { return ${akatsukiEventsBinding()}; },
			get days() { return plannerCalendarDays.value; }, get filters() { return plannerCalendarFilters.value; },
			get showDeclined() { return showDeclinedInvitations.value; }
		});`;
	const runtime = runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
		computed, ref, events, sharedEvents, isSharedHataskEvent, expandHataskEventOccurrences,
		$i: options.signedIn === false ? null : { id: 'me' },
		calYear: ref(2026), calMonth: ref(8), selectedDay: ref(12), selectedDateStr: ref('2026-09-12'),
		plannerCalendarView: ref(options.view ?? 'month'), settings: ref({ weekStart: 'mon' }),
		plannerCalendarEvent: (source: CalendarSource) => ({ id: source.id, title: source.title, isAllDay: source.allDay }),
		longDateFormatter: new Intl.DateTimeFormat('ja-JP'), weekdayShortFormatter: new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }),
		td: () => '2026-09-12', copy: { private: '非公開', public: '公開', organizer: '主催者' }, plannerCopy: { showDeclinedInvitations: '辞退した招待も表示' },
		plannerReadOnly: ref(false), rsvpSavingIds: ref([]), misskeyApi: api, loadSharedEvents: reload, os: { toast: vi.fn() }, console: { error: vi.fn() },
	}, { timeout: 1000 }) as Runtime;
	return { runtime, sharedEvents, events, api, reload };
}

const ids = (items: { id: string }[]) => items.map(item => item.id);

describe('辞退した参加招待のカレンダー表示', () => {
	test.each(['public', 'specified'] as const)('%s の自分の辞退だけを除外し、主催予定・他の回答・参加確認なしを残す', visibility => {
		const f = fixture([
			event('declined', { visibility, rsvpResponses: response('declined') }),
			event('closed-declined', { visibility, rsvpClosed: true, rsvpResponses: response('declined') }),
			event('going', { visibility, rsvpResponses: response('going') }),
			event('maybe', { visibility, rsvpResponses: response('maybe') }),
			event('unanswered', { visibility }),
			event('someone-else', { visibility, rsvpResponses: response('declined', 'someone') }),
			event('owner', { visibility, userId: 'me', rsvpResponses: response('declined') }),
			event('without-rsvp', { visibility, rsvp: false, rsvpResponses: response('declined') }),
		], { local: [event('private', { visibility: 'private', rsvp: false })] });
		expect(ids(f.runtime.visible)).toEqual(['private', 'going', 'maybe', 'unanswered', 'someone-else', 'owner', 'without-rsvp']);
		expect(ids(f.runtime.all)).toContain('declined');
		expect(f.runtime.filters.find(filter => filter.id === 'declined')).toMatchObject({ active: false, count: 2, label: '辞退した招待も表示' });
	});

	test.each<HataskCalendarView>(['month', 'week', 'day', 'agenda'])('%s の予定と追加件数に反映し、複数日の招待も再表示できる', view => {
		const f = fixture([
			event('declined', { date: '2026-09-11', dateEnd: '2026-09-13', rsvpResponses: response('declined') }),
			...['one', 'two', 'three'].map(id => event(id)),
		], { view });
		const day = () => {
			const found = f.runtime.days.find(item => item.date === '2026-09-12');
			if (!found) throw new Error('Missing selected calendar day');
			return found;
		};
		expect(ids(day().events)).toEqual(['one', 'two', 'three']);
		expect(day().hiddenEventCount).toBe(0);
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(ids(day().events)).toEqual(['declined', 'one', 'two', 'three']);
		expect(day().hiddenEventCount).toBe(1);
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(ids(f.runtime.plannerEventForDate('2026-09-13'))).toEqual([]);
	});

	test('絞り込みとホーム・カレンダーの予定を揃え、元の予定と回答は変更しない', () => {
		const f = fixture([event('declined', { rsvpResponses: response('declined') })]);
		const original = JSON.stringify(f.sharedEvents.value);
		expect(f.runtime.upcoming).toEqual([]);
		expect(f.runtime.akatsukiEvents).toEqual([]);
		expect(f.runtime.plannerEventForDate('2026-09-12')).toEqual([]);
		expect(f.runtime.findPlannerCalendarSource({ id: 'declined' })?.id).toBe('declined');
		f.runtime.togglePlannerCalendarFilter('declined');
		for (const items of [f.runtime.upcoming, f.runtime.akatsukiEvents, f.runtime.plannerEventForDate('2026-09-12')]) expect(ids(items)).toEqual(['declined']);
		expect(JSON.stringify(f.sharedEvents.value)).toBe(original);
		expect(f.api).not.toHaveBeenCalled();
	});

	test('予定の公開範囲の絞り込みを保ち、辞退の切替で最後の表示区分を解除しない', () => {
		const f = fixture([event('declined', { rsvpResponses: response('declined') })]);
		f.runtime.togglePlannerCalendarFilter('declined');
		f.runtime.togglePlannerCalendarFilter('shared');
		expect(f.runtime.plannerEventForDate('2026-09-12')).toEqual([]);
		f.runtime.togglePlannerCalendarFilter('private');
		f.runtime.togglePlannerCalendarFilter('public');
		f.runtime.togglePlannerCalendarFilter('invalid');
		expect(f.runtime.filters.filter(filter => filter.active).map(filter => filter.id)).toEqual(['public', 'declined']);
		f.runtime.togglePlannerCalendarFilter('shared');
		expect(ids(f.runtime.plannerEventForDate('2026-09-12'))).toEqual(['declined']);
		expect(f.runtime.filters.find(filter => filter.id === 'shared')?.count).toBe(1);
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(f.runtime.filters.find(filter => filter.id === 'shared')?.count).toBe(0);
	});

	test('辞退の送信失敗時は残し、成功後に除外し、再表示して参加へ変更できる', async () => {
		const f = fixture([event('invited')]);
		f.api.mockRejectedValueOnce(new Error('offline'));
		await f.runtime.setRsvp('invited', 'declined');
		expect(ids(f.runtime.visible)).toEqual(['invited']);
		f.reload.mockImplementation(async () => {
			const status = f.api.mock.lastCall?.[1].status as Status;
			f.sharedEvents.value = [event('invited', { rsvpResponses: response(status) })];
		});
		await f.runtime.setRsvp('invited', 'declined');
		expect(f.runtime.visible).toEqual([]);
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(ids(f.runtime.visible)).toEqual(['invited']);
		await f.runtime.setRsvp('invited', 'going');
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(ids(f.runtime.visible)).toEqual(['invited']);
		expect(f.api).toHaveBeenLastCalledWith('hatask/events/rsvp', { eventId: 'invited', status: 'going' });
		expect(f.sharedEvents.value[0].rsvpResponses).toEqual(response('going'));
	});

	test('再取得とリロード後も保存済み回答で除外し、別の回答へ更新されたら表示する', () => {
		const f = fixture([]);
		const saved = [event('declined', { rsvpResponses: response('declined') })];
		f.sharedEvents.value = saved;
		expect(f.runtime.visible).toEqual([]);
		f.runtime.togglePlannerCalendarFilter('declined');
		expect(ids(f.runtime.visible)).toEqual(['declined']);
		expect(fixture(saved).runtime.visible).toEqual([]);
		f.runtime.togglePlannerCalendarFilter('declined');
		f.sharedEvents.value = [event('declined', { rsvpResponses: response('maybe') })];
		expect(ids(f.runtime.visible)).toEqual(['declined']);
	});

	test('未ログイン時は他人の辞退を自分の回答として扱わない', () => {
		const f = fixture([event('invited', { rsvpResponses: response('declined') })], { signedIn: false });
		expect(ids(f.runtime.visible)).toEqual(['invited']);
	});
});
