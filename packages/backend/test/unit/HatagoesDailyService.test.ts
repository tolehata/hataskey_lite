/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';

vi.mock('@/core/NotificationService.js', () => ({ NotificationService: class {} }));

const rituals = ['mood', 'meal', 'todo', 'water', 'reading'];
function fixture(nowDay = '2026-10-03') {
	const receipts = new Map<string, { source: string; day: string }>();
	const registry: { key: string; value: unknown }[] = [];
	const readings: { studiedAt: Date }[] = [];
	const flower = { id: 'flower', targetMinutes: 1000, totalMinutes: 0, progress: 0, lastGrowthAt: Date.now(), memory: [] };
	const wallet = { userId: 'owner', drops: 1, timezone: 'UTC', flower, seeds: [], rareSeeds: [] };
	const statements: string[] = [];
	const manager = { query: async (sql: string, args: unknown[] = []) => {
		statements.push(sql);
		if (sql.startsWith('SELECT * FROM hatask_drop_wallet')) return [wallet];
		if (sql.startsWith('INSERT INTO hatask_drop_ledger')) {
			const source = String(args[1]), day = String(args[2]);
			const key = `${source}:${day === 'v3' ? 'v3' : day}`;
			if (receipts.has(key)) return [];
			receipts.set(key, { source, day: source === 'hatagoes-start' ? String(args[3]) : day });
			return [{ source }];
		}
		if (sql.startsWith('SELECT source,day FROM hatask_drop_ledger')) return [...receipts.values()];
		if (sql.startsWith('SELECT key,value FROM registry_item')) return registry;
		if (sql.startsWith('SELECT "studiedAt" FROM hatady_log')) return readings;
		return [];
	} };
	const service = new HataskFlowerV2Service({ transaction: async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager) } as never, {} as never, {} as never);
	return { service, manager, wallet, flower, receipts, registry, readings, statements, nowDay };
}

describe('HataGoes daily ritual receipts', () => {
	test('one action gives two growth points and same-day retries cannot mint another receipt', async () => {
		const f = fixture();
		await f.service.onJournalCommitted(f.manager as never, 'owner', 'mood');
		await f.service.onJournalCommitted(f.manager as never, 'owner', 'mood');
		expect(f.flower.totalMinutes).toBe(20);
		expect([...f.receipts.values()].filter(row => row.source === 'hatagoes-mood')).toHaveLength(1);
		expect(f.statements.some(sql => sql.includes('pg_advisory_xact_lock'))).toBe(true);
	});

	test('a 480-minute flower stays at six percent after three fractional awards and a later growth pass', async () => {
		const f = fixture();
		f.flower.targetMinutes = 480;
		for (const ritual of ['mood', 'meal', 'todo'] as const) await (f.service as never as { awardRitual: (m: unknown, w: unknown, ritual: string, now: Date) => Promise<boolean> }).awardRitual(f.manager, f.wallet, ritual, new Date());
		expect(f.flower.totalMinutes).toBeCloseTo(28.8);
		expect(f.flower.progress).toBe(6);
		await (f.service as never as { grow: (m: unknown, w: unknown, now: Date) => Promise<unknown> }).grow(f.manager, f.wallet, new Date());
		expect(f.flower.progress).toBe(6);
	});

	test('the next calendar day can earn another two points', async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-10-03T23:59:00Z'));
			const f = fixture();
			await f.service.onJournalCommitted(f.manager as never, 'owner', 'meal');
			vi.setSystemTime(new Date('2026-10-04T00:01:00Z'));
			await f.service.onJournalCommitted(f.manager as never, 'owner', 'meal');
			expect(f.flower.totalMinutes).toBe(42);
			expect([...f.receipts.values()].filter(row => row.source === 'hatagoes-meal').map(row => row.day)).toEqual(['2026-10-03', '2026-10-04']);
		} finally { vi.useRealTimers(); }
	});

	test('a journal validated just before midnight keeps that day when the award runs after midnight', async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-10-03T23:59:59Z'));
			const validatedAt = new Date();
			const f = fixture();
			vi.setSystemTime(new Date('2026-10-04T00:00:01Z'));
			await f.service.onJournalCommitted(f.manager as never, 'owner', 'mood', validatedAt);
			expect([...f.receipts.values()].filter(row => row.source === 'hatagoes-mood').map(row => row.day)).toEqual(['2026-10-03']);
			expect([...f.receipts.values()].filter(row => row.source === 'hatagoes-start').map(row => row.day)).toEqual(['2026-10-03']);
			expect(f.receipts.has('hatagoes-mood:2026-10-04')).toBe(false);
		} finally { vi.useRealTimers(); }
	});

	test('syncs saved current-day journal, todo completion and book study once; old and unknown completions do not count', async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
			const f = fixture();
			f.registry.push(
				{ key: 'moods', value: [{ id: 'm', date: '2026-10-03', time: '10:00', level: 3 }] },
				{ key: 'meals', value: [{ id: 'e', date: '2026-10-03', time: '11:00', slot: 'lunch', level: 'ate' }] },
				{ key: 'todos', value: [{ id: 'old', done: true }, { id: 'current', done: true, doneAt: '2026-10-03T10:00:00Z' }] },
			);
			f.readings.push({ studiedAt: new Date('2026-10-03T09:00:00Z') });
			const first = await f.service.daily('owner', 'UTC');
			expect(first.awardedToday).toBe(8);
			expect(first.days.at(-1)?.completed).toEqual(['mood', 'meal', 'todo', 'reading']);
			await f.service.daily('owner', 'UTC');
			expect(f.flower.totalMinutes).toBe(80);
			f.registry[2].value = [{ id: 'old', done: true, doneAt: '2026-10-02T10:00:00Z' }];
			f.readings.splice(0, 1, { studiedAt: new Date('2026-10-02T23:59:00Z') });
			const afterCancellation = await f.service.daily('owner', 'UTC');
			expect(afterCancellation.awardedToday).toBe(8);
		} finally { vi.useRealTimers(); }
	});

	test('five immutable receipts award at most ten points and complete the day', async () => {
		const f = fixture();
		const now = new Date();
		for (const ritual of rituals) await (f.service as never as { awardRitual: (m: unknown, w: unknown, ritual: string, now: Date) => Promise<boolean> }).awardRitual(f.manager, f.wallet, ritual, now);
		for (const ritual of rituals) await (f.service as never as { awardRitual: (m: unknown, w: unknown, ritual: string, now: Date) => Promise<boolean> }).awardRitual(f.manager, f.wallet, ritual, now);
		const result = await f.service.daily('owner', 'UTC');
		expect(f.flower.totalMinutes).toBe(100);
		expect(result.awardedToday).toBe(10);
		expect(result.days.at(-1)?.complete).toBe(true);
	});

	test('14-day view distinguishes unknown days and computes streak beyond the displayed window', async () => {
		const f = fixture();
		const today = new Date().toISOString().slice(0, 10);
		const day = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86400000).toISOString().slice(0, 10);
		f.receipts.set('start', { source: 'hatagoes-start', day: day(20) });
		for (let offset = 1; offset <= 17; offset++) for (const ritual of rituals) f.receipts.set(`${ritual}:${offset}`, { source: `hatagoes-${ritual}`, day: day(offset) });
		const result = await f.service.daily('owner', 'UTC');
		expect(result.days).toHaveLength(14);
		expect(result.days[0].date).toBe(day(13));
		expect(result.days[13]).toMatchObject({ date: today, known: true, count: 0, complete: false });
		expect(result.streakDays).toBe(17);
		expect(result.awardedToday).toBe(0);
	});
});
