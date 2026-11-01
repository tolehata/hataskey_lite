/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { HatadyAttachmentService } from '@/core/HatadyAttachmentService.js';
import LogDeleteEndpoint from '@/server/api/endpoints/hata/hatady/logs/delete.js';
import BookDeleteEndpoint from '@/server/api/endpoints/hata/hatady/books/delete.js';
import SessionDeleteEndpoint from '@/server/api/endpoints/hata/hatady/media/sessions/delete.js';
import WorkDeleteEndpoint from '@/server/api/endpoints/hata/hatady/media/works/delete.js';

type Kind = 'log' | 'book' | 'session' | 'work';
type Row = { id: string; userId: string; fileIds?: string[]; bookId?: string; workId?: string; currentPage?: number; workSnapshot?: { title: string } };
type Where = { id: string; userId?: string };

function repository(initial: Row[]) {
	const rows = new Map(initial.map(row => [row.id, row]));
	const matches = (row: Row, where: Where) => row.id === where.id && (where.userId === undefined || row.userId === where.userId);
	return {
		rows,
		findOneBy: vi.fn(async (where: Where) => [...rows.values()].find(row => matches(row, where)) ?? null),
		findOne: vi.fn(async ({ where }: { where: Where }) => [...rows.values()].find(row => matches(row, where)) ?? null),
		findBy: vi.fn(async (where: Partial<Row>) => [...rows.values()].filter(row => Object.entries(where).every(([key, value]) => row[key as keyof Row] === value))),
		delete: vi.fn(async (where: Where | string) => {
			const filter = typeof where === 'string' ? { id: where } : where;
			let affected = 0;
			for (const row of rows.values()) if (matches(row, filter)) { rows.delete(row.id); affected++; }
			return { affected };
		}),
		update: vi.fn(),
		insert: vi.fn(),
	};
}

function fixture(kind: Kind) {
	const records: Record<Kind, ReturnType<typeof repository>> = {
		log: repository([
			{ id: 'logOwn', userId: 'owner', bookId: 'bookOwn', fileIds: ['imageOwn'] },
			{ id: 'logOther', userId: 'other', fileIds: ['imageOther'] },
		]),
		book: repository([{ id: 'bookOwn', userId: 'owner', currentPage: 27 }, { id: 'bookOther', userId: 'other' }]),
		session: repository([
			{ id: 'sessionOwn', userId: 'owner', workId: 'workOwn', fileIds: ['imageOwn'], workSnapshot: { title: '記録時の作品名' } },
			{ id: 'sessionOther', userId: 'other', fileIds: ['imageOther'] },
		]),
		work: repository([{ id: 'workOwn', userId: 'owner' }, { id: 'workOther', userId: 'other' }]),
	};
	const drive = repository([{ id: 'imageOwn', userId: 'owner' }, { id: 'imageOther', userId: 'other' }]);
	const attachments = new HatadyAttachmentService(drive as never, {} as never);
	const notifications = { findBy: vi.fn().mockResolvedValue([]) };
	const manager = { getRepository: (entity: { name: string }) => entity.name === 'MiHatadyLog' ? records.log
		: entity.name === 'MiHatadyMediaWork' ? records.work
			: entity.name === 'MiHatadyMediaSession' ? records.session : notifications };
	const db = { transaction: async (action: (manager: unknown) => Promise<unknown>) => action(manager) };
	Object.assign(records.log, { manager: db });
	const learning = Object.create(HatadyService.prototype) as HatadyService;
	Object.assign(learning, {
		hatadyBooksRepository: records.book,
		hatadyLogsRepository: records.log,
		hatadyMediaSessionsRepository: records.session,
		hatadyAttachmentService: attachments,
		notificationService: { refreshSourceNotifications: vi.fn().mockResolvedValue(undefined) },
	});
	const media = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
	Object.assign(media, {
		worksRepository: records.work,
		sessionsRepository: records.session,
		hatadyService: learning,
		hatadyAttachmentService: attachments,
		db,
	});
	const endpoint = kind === 'log' ? new LogDeleteEndpoint(learning)
		: kind === 'book' ? new BookDeleteEndpoint(learning)
			: kind === 'session' ? new SessionDeleteEndpoint(media) : new WorkDeleteEndpoint(media);
	return {
		records, drive, endpoint,
		execute: (id: string) => endpoint.exec({ [`${kind}Id`]: id }, { id: 'owner' } as never, null, null),
	};
}

// These tests run the real endpoint and service owner checks. Repositories model
// only explicit application mutations, not PostgreSQL CASCADE / SET NULL effects.
describe.each([
	{ kind: 'log', error: 'NO_SUCH_LOG' },
	{ kind: 'book', error: 'NO_SUCH_BOOK' },
	{ kind: 'session', error: 'NO_SUCH_HATADY_MEDIA' },
	{ kind: 'work', error: 'NO_SUCH_HATADY_MEDIA' },
] as const)('Hatady $kind deletion', ({ kind, error }) => {
	test('deletes only the owned target without deleting other records or Drive images', async () => {
		const f = fixture(kind);
		const before = new Map(Object.entries(f.records).map(([key, repo]) => [key, structuredClone([...repo.rows.values()])]));
		const images = structuredClone([...f.drive.rows.values()]);
		await expect(f.execute(`${kind}Own`)).resolves.toBeUndefined();
		expect(f.records[kind].rows.has(`${kind}Own`)).toBe(false);
		expect(f.records[kind].rows.has(`${kind}Other`)).toBe(true);
		expect(f.records[kind].delete).toHaveBeenCalledOnce();
		for (const [key, repo] of Object.entries(f.records)) {
			expect(repo.update).not.toHaveBeenCalled();
			expect(repo.insert).not.toHaveBeenCalled();
			if (key === kind) continue;
			expect(repo.delete).not.toHaveBeenCalled();
			expect([...repo.rows.values()]).toEqual(before.get(key));
		}
		expect(f.drive.delete).not.toHaveBeenCalled();
		expect(f.drive.update).not.toHaveBeenCalled();
		expect(f.drive.insert).not.toHaveBeenCalled();
		expect([...f.drive.rows.values()]).toEqual(images);
	});

	test.each(['Other', 'Missing'])('rejects %s without any repository mutation', async suffix => {
		const f = fixture(kind);
		const repositories = [...Object.values(f.records), f.drive];
		const before = repositories.map(repo => structuredClone([...repo.rows.values()]));
		await expect(f.execute(`${kind}${suffix}`)).rejects.toMatchObject({ code: error });
		for (const [index, repo] of repositories.entries()) {
			expect(repo.delete).not.toHaveBeenCalled();
			expect(repo.update).not.toHaveBeenCalled();
			expect(repo.insert).not.toHaveBeenCalled();
			expect([...repo.rows.values()]).toEqual(before[index]);
		}
	});
});
