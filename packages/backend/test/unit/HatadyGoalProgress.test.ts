/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import type { MiHatadyGoal } from '@/models/HatadyGoal.js';

function setup(seconds: number, target = 120) {
	const query = {
		select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
		getRawOne: vi.fn().mockResolvedValue({ sum: String(seconds) }),
	};
	const goal = {
		id: 'goal', userId: 'owner', createdAt: new Date('2026-09-01T00:00:00Z'), targetDate: null,
		termType: 'short', metricType: 'minutes', metricTarget: target, done: false, doneAt: null,
	} as MiHatadyGoal;
	const update = vi.fn().mockResolvedValue({}), notify = vi.fn().mockResolvedValue(undefined);
	const service = Object.create(HatadyService.prototype) as HatadyService;
	Object.assign(service, {
		hatadyLogsRepository: { createQueryBuilder: () => query },
		hatadyGoalsRepository: { findBy: vi.fn().mockResolvedValue([goal]), update },
	});
	Object.defineProperty(service, 'notify', { value: notify });
	return { service, query, goal, update, notify };
}

describe('Hatady exact goal completion', () => {
	test('does not complete a goal when a rounded display percentage reaches 100 early', async () => {
		const { service, update, notify } = setup(7199);
		const [goal] = await service.listGoals('owner');
		expect(goal.progress).toEqual({ current: 7199 / 60, target: 120, percent: 100 });
		expect(goal.done).toBe(false);
		expect(update).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	test.each([0, -1])('does not complete a legacy goal with target %i', async target => {
		const { service, update, notify } = setup(7200, target);
		const [goal] = await service.listGoals('owner');
		expect(goal.progress.percent).toBeNull();
		expect(goal.done).toBe(false);
		expect(update).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
	});

	test.each([7200, 7201])('completes the goal once at %i seconds', async seconds => {
		const { service, query, update, notify } = setup(seconds);
		const [goal] = await service.listGoals('owner');
		expect(query.select).toHaveBeenCalledWith('COALESCE(SUM(log.durationSeconds), 0)', 'sum');
		expect(goal.done).toBe(true);
		expect(update).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith({ notifieeId: 'owner', notifierId: null, type: 'goalDone', value: null });
		await service.listGoals('owner');
		expect(update).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledTimes(1);
	});
});
