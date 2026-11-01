/* SPDX-License-Identifier: AGPL-3.0-only */
import { createHash } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';
import { DriveService } from '@/core/DriveService.js';
import { LOCAL_DRIVE_UPLOAD_BUDGET, REMOTE_DRIVE_INGEST_BUDGET } from '@/misc/resource-budget.js';

function setup(options: { usage?: number; moderator?: boolean; admitted?: number } = {}) {
	const perform = vi.fn().mockResolvedValue({ id: 'file' });
	const service = Object.assign(Object.create(DriveService.prototype), {
		config: { maxFileSize: 1024 * 1024 },
		redisClient: { eval: vi.fn().mockResolvedValue(options.admitted ?? 1) },
		roleService: { isModerator: vi.fn().mockResolvedValue(options.moderator ?? false), getUserPolicies: vi.fn().mockResolvedValue({ maxFileSizeMb: 0.5, driveCapacityMb: 1 }) },
		driveFileEntityService: { calcDriveUsageOf: vi.fn().mockResolvedValue(options.usage ?? 0) },
		performUploadFromUrl: perform,
	}) as DriveService;
	return { service, perform };
}

describe('URL upload admission', () => {
	test('denied capacity and a full local drive start no download', async () => {
		for (const options of [{ admitted: 0 }, { usage: 1024 * 1024 }]) {
			const { service, perform } = setup(options);
			await expect(service.startUploadFromUrl({ url: 'https://example.test/image', user: { id: 'u', host: null } })).rejects.toBeDefined();
			expect(perform).not.toHaveBeenCalled();
		}
	});

	test('remaining space and role file size constrain the transfer before it starts', async () => {
		const { service, perform } = setup({ usage: 900 * 1024 });
		await (await service.startUploadFromUrl({ url: 'https://example.test/image', user: { id: 'u', host: null } })).completion;
		expect(perform.mock.calls[0][1]).toBe(124 * 1024);
	});

	test.each([
		['local', { id: 'u', host: null }, LOCAL_DRIVE_UPLOAD_BUDGET, 'u'],
		['remote', { id: 'r', host: 'remote.test' }, REMOTE_DRIVE_INGEST_BUDGET, 'remote.test'],
		['instance', null, REMOTE_DRIVE_INGEST_BUDGET, 'instance'],
	] as const)('%s imports are admitted from their own pool so federation cannot block local uploads', async (_kind, user, budget, actor) => {
		const { service } = setup();
		await (await service.startUploadFromUrl({ url: 'https://example.test/image', user })).completion;
		const redis = (service as unknown as { redisClient: { eval: ReturnType<typeof vi.fn> } }).redisClient;
		const admission = redis.eval.mock.calls[0];
		expect(admission.slice(2, 6)).toEqual([
			`resource-budget:{${budget.name}}:active`, `resource-budget:{${budget.name}}:bytes`,
			`resource-budget:{${budget.name}}:actor:${createHash('sha256').update(actor).digest('hex')}`,
			`resource-budget:{${budget.name}}:rate:${createHash('sha256').update(actor).digest('hex')}`,
		]);
		expect(admission.slice(8, 13)).toEqual([budget.concurrency, budget.actorConcurrency, 1024 * 1024, budget.concurrency * 1024 * 1024, budget.requestsPerMinute]);
	});

	test('the two pools never share a name, and a local user may run an upload alongside a URL import', () => {
		expect(LOCAL_DRIVE_UPLOAD_BUDGET.name).not.toBe(REMOTE_DRIVE_INGEST_BUDGET.name);
		expect(LOCAL_DRIVE_UPLOAD_BUDGET.actorConcurrency).toBe(2);
	});

	test.each(['remote', 'instance', 'moderator'])('%s imports retain the server transfer maximum', async actor => {
		const { service, perform } = setup({ usage: 1024 * 1024, moderator: actor === 'moderator' });
		await service.uploadFromUrl({ url: 'https://example.test/image', user: actor === 'instance' ? null : { id: 'u', host: actor === 'remote' ? 'remote.test' : null } });
		expect(perform.mock.calls[0][1]).toBe(1024 * 1024);
	});
});
