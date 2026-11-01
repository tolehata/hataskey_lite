/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import { HATADY_MAX_DURATION_SECONDS } from '@/core/HatadyRecordData.js';
import type { MiHatadyLog } from '@/models/HatadyLog.js';

function fixture(durationSeconds: number | null = 61) {
	let stored = {
		id: 'log', userId: 'owner', kind: 'exercise', title: 'Walking', subject: 'exercise',
		durationSeconds, durationMinutes: Math.floor((durationSeconds ?? 0) / 60), tags: [], details: {},
	} as MiHatadyLog;
	const repository = {
		findOneBy: vi.fn(async () => stored),
		findOneByOrFail: vi.fn(async () => stored),
		insert: vi.fn(async (row: MiHatadyLog) => { stored = row; }),
		update: vi.fn(async (_id: string, patch: Partial<MiHatadyLog>) => { Object.assign(stored, patch); }),
	};
	const manager = { getRepository: vi.fn(() => repository) };
	const transaction = vi.fn(async (callback: (manager: unknown) => unknown) => callback(manager));
	const service = Object.create(HatadyService.prototype) as HatadyService;
	Object.assign(service, {
		hatadyLogsRepository: { ...repository, manager: { transaction } },
		hatadyNotificationsRepository: { findBy: vi.fn().mockResolvedValue([]) },
		hatadyAttachmentService: { validate: vi.fn().mockResolvedValue([]) },
		idService: { gen: vi.fn().mockReturnValue('log') },
		flowerService: { onHatadyCreated: vi.fn().mockResolvedValue({}) },
	});
	Object.defineProperty(service, 'notifyMilestoneIfReached', { value: vi.fn().mockResolvedValue(undefined) });
	const user = { id: 'owner' } as never;
	return {
		repository, transaction,
		create: (duration: { durationSeconds?: number | null } = {}) => service.createLog(user, { kind: 'exercise', title: 'Walking', subject: 'exercise', ...duration }),
		update: (patch: Parameters<HatadyService['updateLog']>[2]) => service.updateLog(user, 'log', patch),
	};
}

describe('Hatady exercise duration', () => {
	test.each([{}, { durationSeconds: null }])('creates exercise records without a duration: %j', async duration => {
		const f = fixture();
		await expect(f.create(duration)).resolves.toMatchObject({ kind: 'exercise', durationSeconds: null, durationMinutes: 0 });
		expect(f.repository.insert).toHaveBeenCalledOnce();
	});

	test('clears a saved duration and keeps it empty on an unrelated edit', async () => {
		const f = fixture();
		await expect(f.update({ durationSeconds: null })).resolves.toMatchObject({ durationSeconds: null, durationMinutes: 0 });
		await expect(f.update({ title: 'Running' })).resolves.toMatchObject({ title: 'Running', durationSeconds: null, durationMinutes: 0 });
	});

	test('preserves saved duration precision when the duration is omitted', async () => {
		const f = fixture();
		await expect(f.update({ title: 'Running' })).resolves.toMatchObject({ title: 'Running', durationSeconds: 61, durationMinutes: 1 });
	});

	test.each([0, 61, HATADY_MAX_DURATION_SECONDS])('accepts valid duration %s on creation and editing', async durationSeconds => {
		const f = fixture();
		const expected = { durationSeconds, durationMinutes: Math.floor(durationSeconds / 60) };
		await expect(f.create({ durationSeconds })).resolves.toMatchObject(expected);
		await expect(f.update({ durationSeconds })).resolves.toMatchObject(expected);
	});

	test.each([-1, 0.5, NaN, Infinity, HATADY_MAX_DURATION_SECONDS + 1])('rejects invalid duration %s before saving', async durationSeconds => {
		const f = fixture();
		await expect(f.create({ durationSeconds })).rejects.toThrow('invalid durationSeconds');
		await expect(f.update({ durationSeconds })).rejects.toThrow('invalid durationSeconds');
		expect(f.transaction).not.toHaveBeenCalled();
		expect(f.repository.insert).not.toHaveBeenCalled();
		expect(f.repository.update).not.toHaveBeenCalled();
	});
});
