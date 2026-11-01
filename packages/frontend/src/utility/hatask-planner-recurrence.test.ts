/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { HataskPlannerEvent, HataskPlannerTodo } from '@/utility/hatask-planner-storage.js';
import { createNextRecurringTodo, expandHataskEventOccurrences, nextRecurrenceDate } from '@/utility/hatask-planner-recurrence.js';

const baseEvent: HataskPlannerEvent = {
	id: 'event-a', title: '定例', date: '2026-01-31', dateEnd: '2026-02-01', visibility: 'private',
	rsvp: false, notify: false, notifyTimings: [], allDay: true, archivedAt: null,
	recurrence: { frequency: 'monthly', interval: 1 },
};

const baseTodo: HataskPlannerTodo = {
	id: 'todo-a', text: '週次', done: true, due: '2026-08-30', priority: 'medium', subtasks: [{ id: 'sub-a', text: '確認', done: true }],
	recurrence: { frequency: 'weekly', interval: 1 }, position: 2, archivedAt: null,
};

describe('Hatask planner recurrence', () => {
	test('monthly and yearly recurrences clamp end-of-month dates', () => {
		expect(nextRecurrenceDate('2026-01-31', { frequency: 'monthly', interval: 1 })).toBe('2026-02-28');
		expect(nextRecurrenceDate('2024-02-29', { frequency: 'yearly', interval: 1 })).toBe('2025-02-28');
	});

	test('weekly recurrence supports selected weekdays and until', () => {
		expect(nextRecurrenceDate('2026-08-31', { frequency: 'weekly', interval: 1, weekdays: [1, 3] })).toBe('2026-09-02');
		expect(nextRecurrenceDate('2026-08-31', { frequency: 'weekly', interval: 1, until: '2026-09-01' })).toBeNull();
	});

	test('event occurrences retain duration and stable source identity', () => {
		const occurrences = expandHataskEventOccurrences([baseEvent], '2026-01-01', '2026-04-30');
		expect(occurrences.map(event => [event.id, event.date, event.dateEnd])).toEqual([
			['event-a', '2026-01-31', '2026-02-01'],
			['event-a::2026-02-28', '2026-02-28', '2026-03-01'],
			['event-a::2026-03-31', '2026-03-31', '2026-04-01'],
			['event-a::2026-04-30', '2026-04-30', '2026-05-01'],
		]);
		expect(occurrences.every(event => event.sourceEventId === 'event-a')).toBe(true);
	});

	test('old daily recurrence fast-forwards into a distant visible range', () => {
		const event = { ...baseEvent, id: 'daily-old', date: '2020-01-01', dateEnd: '2020-01-01', recurrence: { frequency: 'daily' as const, interval: 1 } };
		const occurrences = expandHataskEventOccurrences([event], '2026-08-30', '2026-09-01', 10);
		expect(occurrences.map(item => item.date)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
	});

	test('old weekly recurrence with weekdays reaches a distant range without scanning from its start', () => {
		const event = { ...baseEvent, id: 'weekly-old', date: '1900-01-01', dateEnd: '1900-01-01', recurrence: { frequency: 'weekly' as const, interval: 2, weekdays: [1, 3] } };
		const occurrences = expandHataskEventOccurrences([event], '2026-08-30', '2026-09-30', 10);
		expect(occurrences.map(item => item.date)).toEqual(['2026-09-07', '2026-09-09', '2026-09-21', '2026-09-23']);
	});

	test('event recurrence count is an absolute limit even when the visible range is distant', () => {
		const event = { ...baseEvent, id: 'counted', date: '2026-01-01', dateEnd: '2026-01-01', recurrence: { frequency: 'daily' as const, interval: 1, count: 3 } };
		expect(expandHataskEventOccurrences([event], '2026-01-01', '2026-01-31').map(item => item.date)).toEqual([
			'2026-01-01',
			'2026-01-02',
			'2026-01-03',
		]);
		expect(expandHataskEventOccurrences([event], '2026-08-30', '2026-09-01')).toEqual([]);
	});

	test('completing a recurring todo creates a linked fresh occurrence', () => {
		const next = createNextRecurringTodo(baseTodo, 'todo-b', new Date('2026-08-30T12:00:00+09:00'));
		expect(next).toMatchObject({ id: 'todo-b', done: false, due: '2026-09-06', recurrenceParentId: 'todo-a', archivedAt: null });
		expect(next?.subtasks).toEqual([{ id: 'sub-a', text: '確認', done: false }]);
	});

	test('recurring todo stops after its count limit', () => {
		const first = createNextRecurringTodo({ ...baseTodo, recurrence: { ...baseTodo.recurrence, count: 2 } }, 'todo-b', new Date('2026-08-30T12:00:00+09:00'));
		expect(first).toMatchObject({ due: '2026-09-06', recurrence: { occurrenceIndex: 1, count: 2 } });
		if (first == null) throw new Error('first recurring Todo was not created');
		expect(createNextRecurringTodo(first, 'todo-c', new Date('2026-09-06T12:00:00+09:00'))).toBeNull();
		expect(createNextRecurringTodo({ ...baseTodo, recurrence: { ...baseTodo.recurrence, count: 1 } }, 'todo-b', new Date('2026-08-30T12:00:00+09:00'))).toBeNull();
	});
});
