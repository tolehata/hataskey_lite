/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { HatadyAttachmentService, HATADY_ATTACHMENT_ERROR } from '@/core/HatadyAttachmentService.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { MiHatadyLog } from '@/models/HatadyLog.js';
import { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import LogCreateEndpoint from '@/server/api/endpoints/hata/hatady/logs/create.js';
import LogUpdateEndpoint from '@/server/api/endpoints/hata/hatady/logs/update.js';
import LogShowEndpoint from '@/server/api/endpoints/hata/hatady/logs/show.js';
import SessionCreateEndpoint from '@/server/api/endpoints/hata/hatady/media/sessions/create.js';
import SessionUpdateEndpoint from '@/server/api/endpoints/hata/hatady/media/sessions/update.js';

function fixture() {
	const stored = [
		{ id: 'a', userId: 'owner', type: 'image/png', isSensitive: true, comment: '説明', thumbnailUrl: '/thumb/a', url: '/file/a' },
		{ id: 'b', userId: 'owner', type: 'image/jpeg', isSensitive: false, comment: null, thumbnailUrl: '/thumb/b', url: '/file/b' },
		{ id: 'foreign', userId: 'other', type: 'image/png' },
		{ id: 'audio', userId: 'owner', type: 'audio/mpeg' },
	];
	const repository = { findBy: vi.fn(async (where: { id: { value: string[] } }) => stored.filter(file => where.id.value.includes(file.id))) };
	const packer = { packMany: vi.fn(async (files: unknown[]) => files) };
	return { stored, repository, packer, service: new HatadyAttachmentService(repository as never, packer as never) };
}

describe('record image ownership and batch packing', () => {
	test.each([['foreign'], ['missing'], ['audio'], ['a', 'a'], Array.from({ length: 17 }, (_, i) => `f${i}`)].map(ids => ({ ids })))('rejects invalid attachment IDs $ids', async ({ ids }) => {
		await expect(fixture().service.validate('owner', ids)).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
	});
	test('preserves chosen order, accepts no attachments, and only retains already attached deleted IDs', async () => {
		const f = fixture();
		expect(await f.service.validate('owner', ['b', 'a'])).toEqual(['b', 'a']);
		expect(await f.service.validate('owner', [])).toEqual([]);
		expect(await f.service.validate('owner', ['gone', 'a'], ['gone'])).toEqual(['gone', 'a']);
		await expect(f.service.validate('owner', ['foreign'], ['foreign'])).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
		await expect(f.service.validate('owner', ['audio'], ['audio'])).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
	});
	test('packs many records once, preserving NSFW/alt/thumbnail and omitting deleted or non-owned files', async () => {
		const f = fixture();
		const packed = await f.service.packRecords([
			{ id: 'log', userId: 'owner', fileIds: ['b', 'gone', 'a', 'foreign', 'audio'] },
			{ id: 'session', userId: 'other', fileIds: ['a', 'foreign'] },
			{ id: 'legacy', userId: 'owner' },
		]);
		expect(packed.get('log')?.map(file => file.id)).toEqual(['b', 'a']);
		expect(packed.get('log')?.[1]).toMatchObject({ isSensitive: true, comment: '説明', thumbnailUrl: '/thumb/a' });
		expect(packed.get('session')?.map(file => file.id)).toEqual(['foreign']);
		expect(packed.get('legacy')).toEqual([]);
		expect(f.repository.findBy).toHaveBeenCalledOnce();
		expect(f.packer.packMany).toHaveBeenCalledExactlyOnceWith(expect.any(Array), { self: false, detail: false });
	});
	test('uses the write transaction repository for owner validation', async () => {
		const f = fixture(), tx = { getRepository: vi.fn().mockReturnValue(f.repository) };
		expect(await f.service.validate('owner', ['a'], [], tx as never)).toEqual(['a']);
		expect(tx.getRepository).toHaveBeenCalledWith(MiDriveFile);
	});
	test.each([MiHatadyLog, MiHatadyMediaSession])('adds an empty default array on %s without making old records nullable', model => {
		const column = getMetadataArgsStorage().columns.find(item => item.target === model && item.propertyName === 'fileIds');
		expect(column?.options).toMatchObject({ array: true, default: '{}', length: 32 });
		expect(column?.options.nullable).not.toBe(true);
	});
});

function logFixture() {
	const f = fixture();
	const stored = { id: 'log', userId: 'owner', title: 'old', kind: 'study', tags: [], durationMinutes: 0, durationSeconds: null, body: 'old', details: { future: 1 }, fileIds: ['a', 'gone'] };
	const repo = { findOneBy: vi.fn().mockResolvedValue(stored), findOneByOrFail: vi.fn().mockResolvedValue(stored), update: vi.fn(async (_id: unknown, patch: object) => Object.assign(stored, patch)) };
	const service = Object.create(HatadyService.prototype) as HatadyService;
	Object.assign(service, { hatadyLogsRepository: repo, hatadyAttachmentService: f.service, hatadyNotificationsRepository: { findBy: vi.fn().mockResolvedValue([]) } });
	return { ...f, stored, repo, logs: service };
}

describe('record update compatibility', () => {
	test.each(['study', 'exercise', 'work'] as const)('creates %s with owned images and rejects invalid attachments before changing linked progress', async kind => {
		const f = fixture();
		let saved: Record<string, unknown> | null = null;
		const books = { findOne: vi.fn().mockResolvedValue({ id: 'book', userId: 'owner', currentPage: 1 }), update: vi.fn() };
		const records = { insert: vi.fn(async (record: Record<string, unknown>) => { saved = record; }), findOneByOrFail: vi.fn(async () => saved) };
		const manager = { getRepository: vi.fn((model: { name: string }) => model === MiDriveFile ? f.repository : model.name === 'MiHatadyBook' ? books : records) };
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyAttachmentService: f.service, hatadyLogsRepository: { manager: { transaction: async (fn: (tx: unknown) => unknown) => fn(manager) } }, idService: { gen: () => 'log' }, flowerService: { onHatadyCreated: vi.fn().mockResolvedValue({}) } });
		Object.defineProperty(service, 'notifyMilestoneIfReached', { value: vi.fn().mockResolvedValue(undefined) });
		const input = { kind, title: 'record', subject: 'subject', durationSeconds: 60, bookId: 'book', pageTo: 5 };
		await expect(service.createLog({ id: 'owner' } as never, { ...input, fileIds: ['foreign'] })).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
		expect(books.update).not.toHaveBeenCalled();
		expect(records.insert).not.toHaveBeenCalled();
		expect(await service.createLog({ id: 'owner' } as never, { ...input, fileIds: ['b', 'a'] })).toMatchObject({ kind, fileIds: ['b', 'a'] });
		expect(await service.createLog({ id: 'owner' } as never, input)).toMatchObject({ fileIds: [] });
	});
	test('log omission retains attachments, explicit empty clears only references, and invalid attachments do not save the body', async () => {
		const f = logFixture();
		await f.logs.updateLog({ id: 'owner' } as never, 'log', { body: 'new' });
		expect(f.stored.fileIds).toEqual(['a', 'gone']);
		expect(f.repository.findBy).not.toHaveBeenCalled();
		await expect(f.logs.updateLog({ id: 'owner' } as never, 'log', { body: 'bad', fileIds: ['foreign'] })).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
		expect(f.stored.body).toBe('new');
		await f.logs.updateLog({ id: 'owner' } as never, 'log', { fileIds: [] });
		expect(f.stored).toMatchObject({ body: 'new', fileIds: [], details: { future: 1 } });
		expect(f.stored).not.toHaveProperty('files');
	});
	test('log ownership is checked before file validation or mutation', async () => {
		const f = logFixture();
		await expect(f.logs.updateLog({ id: 'other' } as never, 'log', { fileIds: ['a'] })).rejects.toThrow('access denied');
		expect(f.repository.findBy).not.toHaveBeenCalled();
		expect(f.repo.update).not.toHaveBeenCalled();
	});
	test.each(['movie_viewing', 'game_play'])('session %s keeps missing references on omission, validates changes, and clears explicitly', async kind => {
		const f = fixture();
		const stored = { id: 'session', userId: 'owner', workId: null, kind, occurredAt: new Date(), tags: [], durationMinutes: null, durationSeconds: null, note: 'old', noteSpoiler: true, visibility: 'private', details: {}, fileIds: ['a', 'gone'] };
		const repo = { findOne: vi.fn().mockResolvedValue(stored), findOneByOrFail: vi.fn().mockResolvedValue(stored), update: vi.fn(async (_id: unknown, patch: object) => Object.assign(stored, patch)) };
		const manager = { getRepository: vi.fn((model: unknown) => model === MiDriveFile ? f.repository : repo) };
		const service = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		Object.assign(service, { sessionsRepository: repo, hatadyAttachmentService: f.service, db: { transaction: async (fn: (tx: unknown) => unknown) => fn(manager), getRepository: () => ({ findBy: vi.fn().mockResolvedValue([]) }) }, hatadyService: { refreshHatadyNotificationRows: vi.fn().mockResolvedValue(undefined) } });
		await service.updateSession('owner', 'session', { note: 'new' });
		expect(stored.fileIds).toEqual(['a', 'gone']);
		await expect(service.updateSession('owner', 'session', { note: 'bad', fileIds: ['foreign'] })).rejects.toThrow(HATADY_ATTACHMENT_ERROR);
		expect(stored.note).toBe('new');
		await service.updateSession('owner', 'session', { fileIds: ['gone', 'b'] });
		expect(stored.fileIds).toEqual(['gone', 'b']);
		await service.updateSession('owner', 'session', { fileIds: [] });
		expect(stored).toMatchObject({ fileIds: [], note: 'new', noteSpoiler: true, visibility: 'private' });
	});
});

describe('attachments follow the existing record read boundary', () => {
	test.each(['private', 'followers', 'blocked'])('does not pack log images for a denied %s read', async visibility => {
		const f = logFixture();
		Object.assign(f.logs, { roleService: { isModerator: vi.fn().mockResolvedValue(false) } });
		Object.defineProperty(f.logs, 'isBlockedEitherDirection', { value: vi.fn().mockResolvedValue(visibility === 'blocked') });
		Object.defineProperty(f.logs, 'isFollowing', { value: vi.fn().mockResolvedValue(false) });
		const log = { ...f.stored, visibility: visibility === 'blocked' ? 'public' : visibility };
		const packer = { packLog: vi.fn() };
		const endpoint = new LogShowEndpoint({ findOneBy: vi.fn().mockResolvedValue(log) } as never, f.logs, packer as never);
		await expect(endpoint.exec({ logId: 'log' }, { id: 'viewer' } as never, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_LOG' });
		expect(packer.packLog).not.toHaveBeenCalled();
	});
	test.each(['private', 'followers', 'blocked'])('does not pack session images for a denied %s read', async visibility => {
		const f = fixture();
		const service = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		Object.assign(service, {
			sessionsRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 'session', userId: 'owner', visibility: visibility === 'blocked' ? 'public' : visibility, fileIds: ['a'] }) },
			hatadyAttachmentService: f.service,
			hatadyFollowingsRepository: { existsBy: vi.fn().mockResolvedValue(false) },
			hatadyService: { isBlockedEitherDirection: vi.fn().mockResolvedValue(visibility === 'blocked'), canModerate: vi.fn().mockResolvedValue(false) },
		});
		await expect(service.showSession('session', 'viewer')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		expect(f.repository.findBy).not.toHaveBeenCalled();
	});
	test('the shared log and session packers preserve ordered files and old empty records', async () => {
		const f = fixture(), now = new Date();
		const logs = Object.create(HatadyEntityService.prototype) as HatadyEntityService;
		Object.assign(logs, { userEntityService: { packMany: vi.fn().mockResolvedValue([]) }, hatadyAttachmentService: f.service });
		Object.defineProperty(logs, 'aggregateReactions', { value: vi.fn().mockResolvedValue(new Map()) });
		const record = { id: 'log', userId: 'owner', fileIds: ['b', 'a'], createdAt: now, studiedAt: now, bookId: null };
		const packed = await logs.packLogs([record as never, { ...record, id: 'legacy', fileIds: undefined } as never], { id: 'owner' });
		expect(packed[0]).toMatchObject({ fileIds: ['b', 'a'], files: [{ id: 'b' }, { id: 'a' }] });
		expect(packed[1]).toMatchObject({ fileIds: [], files: [] });
		const media = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		Object.assign(media, { hatadyAttachmentService: f.service });
		expect(await media.packSession({ ...record, updatedAt: now, occurredAt: now } as never)).toMatchObject({ fileIds: ['b', 'a'], files: [{ id: 'b' }, { id: 'a' }] });
	});
});

describe('record attachment API schemas and error mapping', () => {
	test.each([
		['log/create', LogCreateEndpoint, { title: 'title', subject: 'subject' }, 'createLog'],
		['log/update', LogUpdateEndpoint, { logId: 'log' }, 'updateLog'],
		['session/create', SessionCreateEndpoint, { workId: 'work', kind: 'movie_viewing', occurredAt: '2026-09-18T00:00:00Z' }, 'createSession'],
		['session/update', SessionUpdateEndpoint, { sessionId: 'session' }, 'updateSession'],
	] as const)('%s accepts old omitted input/empty clearing and rejects duplicates or >16', async (_name, Ctor, payload, method) => {
		const write = vi.fn().mockRejectedValue(new Error(HATADY_ATTACHMENT_ERROR));
		const service = { [method]: write };
		const endpoint = new Ctor(service as never, {} as never);
		for (const fileIds of [undefined, [], ['a']]) {
			await expect(endpoint.exec({ ...payload, ...(fileIds === undefined ? {} : { fileIds }) } as never, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: HATADY_ATTACHMENT_ERROR });
		}
		expect(write).toHaveBeenCalledTimes(3);
		for (const fileIds of [['a', 'a'], Array.from({ length: 17 }, (_, i) => `f${i}`), null]) {
			await expect(endpoint.exec({ ...payload, fileIds } as never, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		expect(write).toHaveBeenCalledTimes(3);
	});
});
