/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import CreateLogEndpoint from '@/server/api/endpoints/hata/hatady/logs/create.js';
import UpdateLogEndpoint from '@/server/api/endpoints/hata/hatady/logs/update.js';
import { HatadyService } from '@/core/HatadyService.js';
import { ExpandHatadyLogSubject1790380200000 } from '../../migration/1790380200000-expand-hatady-log-subject.js';

describe('Hatady subject length', () => {
	test.each(['create', 'update'] as const)('%s accepts 64, 65, and 128 characters but rejects 129', async mode => {
		const createLog = vi.fn(async (_user: unknown, params: Record<string, unknown>) => params);
		const updateLog = vi.fn(async (_user: unknown, _id: string, params: Record<string, unknown>) => params);
		const packLog = vi.fn(async (log: Record<string, unknown>) => log);
		const service = { createLog, updateLog };
		const endpoint = mode === 'create'
			? new CreateLogEndpoint(service as never, { packLog } as never)
			: new UpdateLogEndpoint(service as never, { packLog } as never);
		for (const length of [64, 65, 128]) {
			const subject = 'あ'.repeat(length);
			await expect(endpoint.exec({ ...(mode === 'create' ? { title: '学習' } : { logId: 'log1' }), subject }, { id: 'owner' } as never, null, null)).resolves.toMatchObject({ subject });
		}
		await expect(endpoint.exec({ ...(mode === 'create' ? { title: '学習' } : { logId: 'log1' }), subject: 'あ'.repeat(129) }, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(mode === 'create' ? createLog : updateLog).toHaveBeenCalledTimes(3);
	});

	test('rename and reassignment keep a 128-character name', async () => {
		const longName = 'あ'.repeat(128);
		const row = { id: 'subject1', userId: 'owner', name: '旧科目', color: '#abc' };
		const updateSubject = vi.fn(async (_where: unknown, patch: Partial<typeof row>) => Object.assign(row, patch));
		const updateLog = vi.fn().mockResolvedValue({ affected: 1 });
		const subjects = { findOne: vi.fn().mockResolvedValue(row), existsBy: vi.fn().mockResolvedValue(false), update: updateSubject };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadySubject' ? subjects : { update: updateLog }) };
		const service = Object.create(HatadyService.prototype) as HatadyService;
		const deleteSubject = vi.fn();
		Object.assign(service, {
			hatadySubjectsRepository: { manager: { transaction: async (callback: (manager: unknown) => unknown) => callback(manager) }, findOneBy: vi.fn(async () => row), delete: deleteSubject },
			hatadyLogsRepository: { update: updateLog },
		});
		await expect(service.saveSubject('owner', longName, undefined, '旧科目')).resolves.toEqual({ name: longName, color: '#abc' });
		expect(updateLog).toHaveBeenCalledWith({ userId: 'owner', subject: '旧科目' }, { subject: longName });
		await service.deleteSubject('owner', '移動元', longName);
		expect(updateLog).toHaveBeenCalledWith({ userId: 'owner', subject: '移動元' }, { subject: longName });
		expect(deleteSubject).toHaveBeenCalledWith({ userId: 'owner', name: '移動元' });
		await expect(service.saveSubject('owner', 'あ'.repeat(129), undefined, '旧科目')).rejects.toThrow('invalid subject name');
	});

	test('migration widens the column and refuses to truncate long values on rollback', async () => {
		const migration = new ExpandHatadyLogSubject1790380200000();
		const query = vi.fn().mockResolvedValue([]);
		await migration.up({ query });
		expect(query).toHaveBeenCalledWith('ALTER TABLE "hatady_log" ALTER COLUMN "subject" TYPE character varying(128)');
		query.mockClear();
		query.mockResolvedValueOnce([{}]);
		await expect(migration.down({ query })).rejects.toThrow('Cannot reduce hatady_log.subject');
		expect(query).toHaveBeenCalledTimes(1);
		query.mockClear();
		await migration.down({ query });
		expect(query).toHaveBeenLastCalledWith('ALTER TABLE "hatady_log" ALTER COLUMN "subject" TYPE character varying(64)');
	});
});
