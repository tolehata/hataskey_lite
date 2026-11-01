/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { toLocalDateKey } from './hatask-planner-recurrence.js';
import { getHataskFlowerState } from './hatask-flower-v2.js';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/utility/hatask-flower-v2.js', () => ({ getHataskFlowerState: vi.fn() }));

import { buildHatagoesPlannerHome, loadHatagoesPlanner, loadHatagoesJournal, loadHatagoesIssues, loadHatagoesCommunity, loadHatagoesRoadmap, loadHatagoesFlower } from './hatagoes-home.js';

beforeEach(() => { api.mockReset(); });

describe('HataGoes home reads', () => {
	test('uses the harvested zukan entries count for the flower card', async () => {
		vi.mocked(getHataskFlowerState).mockResolvedValue({ drops: 2, flower: { emoji: '🌼', name: 'ヒナギク', progress: 72 }, rules: { pourMinutes: 15 }, zukan: { entries: [{ id: 'one' }, { id: 'two' }] } } as never);
		const result = await loadHatagoesFlower();
		expect(result.flower).toMatchObject({ name: 'ヒナギク', pourMinutes: 15, harvestedCount: 2 });
	});
	test('reads legacy planner rows without starting migration or writing data', async () => {
		const today = toLocalDateKey();
		api.mockImplementation(async (endpoint: string, params: { key?: string }) => {
			if (endpoint === 'hatask/planner/get') return { collections: {
				events: { exists: false }, todos: { exists: false }, folders: { exists: false },
			} };
			if (endpoint === 'i/registry/get' && params.key === 'events') return [{ id: 'event', title: '予定', date: today }];
			if (endpoint === 'i/registry/get' && params.key === 'todos') return [
				{ id: 'low', text: 'あとで', done: false, priority: 'low' },
				{ id: 'high', text: '先に', done: false, priority: 'high' },
			];
			throw new Error(endpoint);
		});
		const result = await loadHatagoesPlanner();
		expect(result.schedule.rows[0].title).toBe('予定');
		expect(result.todo.rows.map(row => row.id)).toEqual(['high', 'low']);
		expect(api.mock.calls.map(call => call[0])).toEqual(['hatask/planner/get', 'i/registry/get', 'i/registry/get']);
	});

	test('keeps meal records neutral and displays the server-selected recent issue', async () => {
		api.mockImplementation(async (endpoint: string) => {
			if (endpoint === 'i/registry/get') return [{ id: 'meal', date: '2026-10-02', time: '12:00', slot: 'lunch', level: 'none' }];
			if (endpoint === 'hata/hatagoes/home/issues') return { source: 'recent', issues: [{ id: 'issue', title: '確認事項' }] };
			throw new Error(endpoint);
		});
		const meal = await loadHatagoesJournal('meal');
		expect(meal.rows[0].title).toContain('食事の記録');
		const issues = await loadHatagoesIssues();
		expect(issues).toMatchObject({ summary: '新しいイシュー', rows: [{ path: '/hatafeed/issue' }] });
	});

	test('shows an ongoing event, its next event and only active priority todos', () => {
		const now = new Date(2026, 9, 2, 13, 5);
		const today = toLocalDateKey(now);
		const result = buildHatagoesPlannerHome([
			{ id: 'past', title: '終了', date: today, timeStart: '09:00', timeEnd: '10:00' },
			{ id: 'current', title: '作業中', date: today, timeStart: '13:00', timeEnd: '14:00' },
			{ id: 'next', title: 'つぎ', date: today, timeStart: '16:30', timeEnd: '17:00' },
		], [
			{ id: 'low', text: '低', done: false, priority: 'low' },
			{ id: 'high', text: '高', done: false, priority: 'high', due: today },
			{ id: 'done', text: '完了', done: true, priority: 'high' },
		], now);
		expect(result.schedule.currentEvent?.title).toBe('作業中');
		expect(result.schedule.nextEvent?.title).toBe('つぎ');
		expect(result.schedule.rows.map(row => row.id)).toEqual(['next']);
		expect(result.todo.rows.map(row => row.id)).toEqual(['high', 'low']);
		expect(result.todo.rows[0].detail).toBe('今日まで');
	});

	test('uses only today’s meal slots for the today tile', async () => {
		api.mockResolvedValueOnce([
			{ id: 'old', date: '2026-10-01', time: '08:00', slot: 'breakfast', level: 'ate' },
			{ id: 'breakfast', date: '2026-10-02', time: '08:00', slot: 'breakfast', level: 'ate' },
			{ id: 'lunch', date: '2026-10-02', time: '12:00', slot: 'lunch', level: 'none' },
			{ id: 'snack', date: '2026-10-02', time: '15:00', slot: 'snack', level: 'ate' },
		]);
		const result = await loadHatagoesJournal('meal', new Date(2026, 9, 2, 16, 0));
		expect(result.journal).toMatchObject({ todayCount: 3, mealSlots: 1 });
		expect(result.journal?.latestToday?.id).toBe('snack');
	});

	test('uses the existing scoped community and roadmap reads, with complete rows only', async () => {
		api.mockImplementation(async (endpoint: string, params: Record<string, unknown>) => {
			if (endpoint === 'hata/hatady/activities') {
				expect(params).toMatchObject({ scope: 'recent', limit: 4 });
				return { items: [{ id: 'activity', occurredAt: '2026-10-02T12:00:00Z', study: { id: 'log', title: '共有した記録' }, user: { name: '花子' } }], hasMore: false, nextCursor: null };
			}
			expect(params).toMatchObject({ category: 'improvement', includeClosed: false });
			return [{ id: 'plan', title: '改善予定', status: 'planned', number: 43 }];
		});
		const community = await loadHatagoesCommunity();
		const roadmap = await loadHatagoesRoadmap();
		expect(community.rows[0].path).toBe('/hatady?tab=records&hgKind=log&hgId=log');
		expect(roadmap.rows[0].detail).toContain('対応予定');
		expect(api.mock.calls.map(call => call[0])).toEqual(['hata/hatady/activities', 'hata/feedback/issues']);
	});

	test('keeps partial community and roadmap responses as errors, while treating denied roadmap access as unavailable', async () => {
		api.mockResolvedValueOnce({ items: [{ id: 'broken', occurredAt: '2026-10-02T12:00:00Z' }], hasMore: false, nextCursor: null })
			.mockResolvedValueOnce([{ id: 'broken' }])
			.mockRejectedValueOnce({ code: 'HATAFEED_ACCESS_DENIED' });
		await expect(loadHatagoesCommunity()).rejects.toThrow('コミュニティ');
		await expect(loadHatagoesRoadmap()).rejects.toThrow('イシュー');
		expect(await loadHatagoesRoadmap()).toMatchObject({ rows: [], unavailable: true });
	});

	test.each([
		['nextFixConfirmed', '次回修正確定'],
		['nextFixPlanned', '次回修正予定'],
		['monitoring', '修正監視中'],
	])('labels the repair status on issue and roadmap rows: %s', async (status, label) => {
		const issue = { id: 'issue', title: '修正', number: 43, status };
		api.mockResolvedValueOnce({ source: 'mine', issues: [issue] }).mockResolvedValueOnce([issue]);
		expect((await loadHatagoesIssues()).rows[0]).toMatchObject({ status, detail: `#43 · ${label}` });
		expect((await loadHatagoesRoadmap()).rows[0]).toMatchObject({ status, detail: `#43 · ${label}` });
	});
});
