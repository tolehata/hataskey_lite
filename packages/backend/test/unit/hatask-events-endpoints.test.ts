/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import _Ajv from 'ajv';
import { describe, expect, test, vi } from 'vitest';
import CreateHataskEventEndpoint, { meta as createMeta, paramDef as createParamDef } from '@/server/api/endpoints/hatask/events/create.js';
import CloseHataskEventEndpoint, { meta as closeMeta, paramDef as closeParamDef } from '@/server/api/endpoints/hatask/events/close.js';
import DeleteHataskEventEndpoint, { meta as deleteMeta, paramDef as deleteParamDef } from '@/server/api/endpoints/hatask/events/delete.js';
import ListHataskEventsEndpoint, { meta as listMeta } from '@/server/api/endpoints/hatask/events/list.js';
import OwnedHataskEventsEndpoint, { meta as ownedMeta, paramDef as ownedParamDef } from '@/server/api/endpoints/hatask/events/owned.js';
import RsvpHataskEventEndpoint, { meta as rsvpMeta } from '@/server/api/endpoints/hatask/events/rsvp.js';
import UpdateHataskEventEndpoint, { meta as updateMeta, paramDef as updateParamDef } from '@/server/api/endpoints/hatask/events/update.js';
import { hashHataskEvent, isValidHataskEventSchedule, packHataskEvent } from '@/server/api/endpoints/hatask/events/_shared.js';
import { MiHataskRsvp } from '@/models/HataskRsvp.js';

const Ajv = _Ajv.default;

function compile(schema: unknown) {
	const ajv = new Ajv({ useDefaults: true });
	ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
	return ajv.compile(schema as never);
}

function event(overrides: Record<string, unknown> = {}) {
	return {
		id: 'eventa',
		userId: 'ownera',
		user: null,
		title: '公開予定',
		emoji: '📅',
		date: '2026-08-30',
		dateEnd: '2026-08-31',
		timeStart: '09:30',
		timeEnd: '10:30',
		allDay: false,
		color: '#e27d60',
		rsvp: true,
		visibility: 'public',
		visibleUserIds: [],
		rsvpClosed: false,
		createdAt: new Date('2026-08-20T00:00:00.000Z'),
		...overrides,
	};
}

function database(repository: Record<string, unknown>) {
	return { transaction: async (callback: (manager: { getRepository: () => Record<string, unknown> }) => unknown) => await callback({ getRepository: () => repository }) };
}

function eventDatabase(eventRepository: Record<string, unknown>, rsvpRepository: Record<string, unknown> = {}) {
	return {
		transaction: async (callback: (manager: { getRepository: (entity: unknown) => Record<string, unknown> }) => unknown) => await callback({
			getRepository: entity => entity === MiHataskRsvp ? rsvpRepository : eventRepository,
		}),
	};
}

describe('Hatask event safety endpoints', () => {
	test('requires account credentials and rate limits for every new read/write path', () => {
		expect(createMeta).toMatchObject({ requireCredential: true, kind: 'write:account' });
		expect(updateMeta).toMatchObject({ requireCredential: true, kind: 'write:account' });
		expect(ownedMeta).toMatchObject({ requireCredential: true, kind: 'read:account' });
		expect(deleteMeta).toMatchObject({ requireCredential: true, kind: 'write:account' });
		expect(closeMeta).toMatchObject({ requireCredential: true, kind: 'write:account' });
		expect(rsvpMeta).toMatchObject({ requireCredential: true, kind: 'write:account' });
		expect(listMeta).toMatchObject({ requireCredential: true, kind: 'read:account' });
		for (const endpointMeta of [createMeta, updateMeta, ownedMeta, deleteMeta, closeMeta, rsvpMeta, listMeta]) {
			expect(endpointMeta.limit).toBeDefined();
		}
		expect(updateMeta).not.toHaveProperty('secure');
		expect(ownedMeta).not.toHaveProperty('secure');
	});

	test('create and update schemas consistently reject malformed schedule fields', () => {
		const validateCreate = compile(createParamDef);
		const validateUpdate = compile(updateParamDef);
		const valid = {
			title: '予定',
			date: '2026-08-30',
			dateEnd: '2026-08-31',
			timeStart: '09:30',
			timeEnd: '10:30',
			color: '#e27d60',
		};

		expect(validateCreate({ ...valid }), JSON.stringify(validateCreate.errors)).toBe(true);
		expect(validateUpdate({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), ...valid }), JSON.stringify(validateUpdate.errors)).toBe(true);
		for (const invalid of [
			{ date: '2026-8-30' },
			{ dateEnd: '2026/08/31' },
			{ timeStart: '24:00' },
			{ timeEnd: '9:30' },
			{ color: 'red' },
		]) {
			expect(validateCreate({ ...valid, ...invalid })).toBe(false);
			expect(validateUpdate({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), ...valid, ...invalid })).toBe(false);
		}
		expect(validateUpdate({ eventId: 'eventa', expectedRevision: 'a'.repeat(64) })).toBe(false);
		expect(validateUpdate({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), title: '予定', userId: 'intruder' })).toBe(false);
	});

	test('runtime validation rejects impossible dates and reversed date ranges before writes', async () => {
		expect(isValidHataskEventSchedule({
			date: '2026-02-30', dateEnd: '', timeStart: '', timeEnd: '', allDay: true, color: '#e27d60',
		})).toBe(false);
		expect(isValidHataskEventSchedule({
			date: '2026-08-31', dateEnd: '2026-08-30', timeStart: '09:30', timeEnd: '10:30', allDay: false, color: '#e27d60',
		})).toBe(false);
		expect(isValidHataskEventSchedule({
			date: '2026-08-30', dateEnd: '2026-08-30', timeStart: '18:00', timeEnd: '09:00', allDay: false, color: '#e27d60',
		})).toBe(false);

		const insert = vi.fn();
		const endpoint = new CreateHataskEventEndpoint({ insert } as never, { gen: () => 'eventa' } as never, {} as never);
		await expect(endpoint.exec({ title: '予定', date: '2026-02-30' }, { id: 'ownera' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_HATASK_EVENT_SCHEDULE' });
		expect(insert).not.toHaveBeenCalled();

		const update = vi.fn();
		const storedEvent = event();
		const updateEndpoint = new UpdateHataskEventEndpoint(
			database({ findOne: vi.fn().mockResolvedValue(storedEvent), update }) as never,
			{ find: vi.fn() } as never,
			{ findOneBy: vi.fn() } as never,
		);
		await expect(updateEndpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never), date: '2026-09-01' }, { id: 'ownera' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_HATASK_EVENT_SCHEDULE' });
		expect(update).not.toHaveBeenCalled();
	});

	test('update rejects non-owners before any write or RSVP read', async () => {
		const update = vi.fn();
		const findRsvps = vi.fn();
		const storedEvent = event();
		const endpoint = new UpdateHataskEventEndpoint(
			database({ findOne: vi.fn().mockResolvedValue(storedEvent), update }) as never,
			{ find: findRsvps } as never,
			{ findOneBy: vi.fn() } as never,
		);

		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never), title: '改ざん' }, { id: 'intruder' } as never, null, null))
			.rejects.toMatchObject({ code: 'NOT_OWNER' });
		expect(update).not.toHaveBeenCalled();
		expect(findRsvps).not.toHaveBeenCalled();
	});

	test('update rejects a stale revision while holding a pessimistic row lock', async () => {
		const update = vi.fn();
		const findOne = vi.fn().mockResolvedValue(event());
		const endpoint = new UpdateHataskEventEndpoint(
			database({ findOne, update }) as never,
			{ find: vi.fn() } as never,
			{ findOneBy: vi.fn() } as never,
		);

		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: '0'.repeat(64), title: 'stale' }, { id: 'ownera' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATASK_EVENT_CONFLICT' });
		expect(findOne).toHaveBeenCalledWith({ where: { id: 'eventa' }, lock: { mode: 'pessimistic_write' } });
		expect(update).not.toHaveBeenCalled();
	});

	test('owner updates only event fields and existing RSVP responses remain visible', async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const findRsvps = vi.fn().mockResolvedValue([{
			id: 'rsvpa', eventId: 'eventa', userId: 'guesta', status: 'going', respondedAt: new Date('2026-08-21T00:00:00.000Z'),
		}]);
		const storedEvent = event();
		const endpoint = new UpdateHataskEventEndpoint(
			database({ findOne: vi.fn().mockResolvedValue(storedEvent), update }) as never,
			{ find: findRsvps } as never,
			{ findOneBy: vi.fn(async ({ id }) => ({ id, username: id === 'ownera' ? 'owner' : 'guest', avatarUrl: null })) } as never,
		);

		const result = await endpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never), title: '更新済み', color: '#123456' }, { id: 'ownera' } as never, null, null);

		expect(update).toHaveBeenCalledWith('eventa', { title: '更新済み', color: '#123456' });
		expect(findRsvps).toHaveBeenCalledWith({ where: { eventId: 'eventa' } });
		expect(result).toMatchObject({
			id: 'eventa', title: '更新済み', color: '#123456', isOwner: true,
			rsvpResponses: [{ userId: 'guesta', status: 'going' }],
		});
	});

	test('destructive event schemas require a revision and reject extra ownership fields', () => {
		const validateDelete = compile(deleteParamDef);
		const validateClose = compile(closeParamDef);
		expect(validateDelete({ eventId: 'eventa', expectedRevision: 'a'.repeat(64) })).toBe(true);
		expect(validateDelete({ eventId: 'eventa' })).toBe(false);
		expect(validateDelete({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), userId: 'intruder' })).toBe(false);
		expect(validateClose({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), closed: true })).toBe(true);
		expect(validateClose({ eventId: 'eventa', closed: true })).toBe(false);
		expect(validateClose({ eventId: 'eventa', expectedRevision: 'a'.repeat(64), closed: true, userId: 'intruder' })).toBe(false);
	});

	test('delete enforces owner and revision under a row lock before its positive path', async () => {
		const storedEvent = event();
		const findOne = vi.fn().mockResolvedValue(storedEvent);
		const remove = vi.fn().mockResolvedValue(undefined);
		const endpoint = new DeleteHataskEventEndpoint(eventDatabase({ findOne, delete: remove }) as never);

		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never) }, { id: 'intruder' } as never, null, null))
			.rejects.toMatchObject({ code: 'NOT_OWNER' });
		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: '0'.repeat(64) }, { id: 'ownera' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATASK_EVENT_CONFLICT' });
		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never) }, { id: 'ownera' } as never, null, null))
			.resolves.toBeUndefined();
		expect(findOne).toHaveBeenLastCalledWith({ where: { id: 'eventa' }, lock: { mode: 'pessimistic_write' } });
		expect(remove).toHaveBeenCalledOnce();
		expect(remove).toHaveBeenCalledWith('eventa');
	});

	test('closing RSVP is revision-safe and returns the next revision', async () => {
		const storedEvent = event({ rsvpClosed: false });
		const findOne = vi.fn().mockResolvedValue(storedEvent);
		const update = vi.fn().mockResolvedValue(undefined);
		const endpoint = new CloseHataskEventEndpoint(eventDatabase({ findOne, update }) as never);

		await expect(endpoint.exec({ eventId: 'eventa', expectedRevision: '0'.repeat(64), closed: true }, { id: 'ownera' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATASK_EVENT_CONFLICT' });
		const result = await endpoint.exec({ eventId: 'eventa', expectedRevision: hashHataskEvent(storedEvent as never), closed: true }, { id: 'ownera' } as never, null, null);
		expect(findOne).toHaveBeenLastCalledWith({ where: { id: 'eventa' }, lock: { mode: 'pessimistic_write' } });
		expect(update).toHaveBeenCalledWith('eventa', { rsvpClosed: true });
		expect(result).toEqual({ id: 'eventa', rsvpClosed: true, revision: hashHataskEvent({ ...storedEvent, rsvpClosed: true } as never) });
	});

	test('RSVP rejects disabled or closed events before writes and locks the positive path', async () => {
		const findEvent = vi.fn()
			.mockResolvedValueOnce(event({ rsvp: false }))
			.mockResolvedValueOnce(event({ rsvpClosed: true }))
			.mockResolvedValue(event({ rsvp: true, rsvpClosed: false }));
		const findExisting = vi.fn().mockResolvedValue(null);
		const insert = vi.fn().mockResolvedValue(undefined);
		const endpoint = new RsvpHataskEventEndpoint(
			eventDatabase({ findOne: findEvent }, { findOneBy: findExisting, insert, update: vi.fn() }) as never,
			{ gen: () => 'rsvpa' } as never,
		);

		await expect(endpoint.exec({ eventId: 'eventa', status: 'going' }, { id: 'guesta' } as never, null, null))
			.rejects.toMatchObject({ code: 'RSVP_DISABLED' });
		await expect(endpoint.exec({ eventId: 'eventa', status: 'going' }, { id: 'guesta' } as never, null, null))
			.rejects.toMatchObject({ code: 'EVENT_CLOSED' });
		expect(findExisting).not.toHaveBeenCalled();

		await expect(endpoint.exec({ eventId: 'eventa', status: 'going' }, { id: 'guesta' } as never, null, null))
			.resolves.toEqual({ id: 'rsvpa', status: 'going' });
		expect(findEvent).toHaveBeenLastCalledWith({ where: { id: 'eventa' }, lock: { mode: 'pessimistic_write' } });
		expect(insert).toHaveBeenCalledOnce();
	});

	test('repeated RSVP choices keep one response per user and only move that user between totals', async () => {
		const storedEvent = event();
		const rows: MiHataskRsvp[] = [];
		const repository = {
			findOneBy: vi.fn(async ({ eventId, userId }: { eventId: string; userId: string }) => rows.find(row => row.eventId === eventId && row.userId === userId) ?? null),
			insert: vi.fn(async (row: MiHataskRsvp) => { rows.push({ ...row }); }),
			update: vi.fn(async (id: string, changes: Partial<MiHataskRsvp>) => {
				const row = rows.find(row => row.id === id);
				if (!row) throw new Error('Missing RSVP row');
				Object.assign(row, changes);
			}),
			find: vi.fn(async () => rows),
		};
		let id = 0;
		const endpoint = new RsvpHataskEventEndpoint(
			eventDatabase({ findOne: vi.fn().mockResolvedValue(storedEvent) }, repository) as never,
			{ gen: () => `response${++id}` } as never,
		);
		await endpoint.exec({ eventId: 'eventa', status: 'going' }, { id: 'other' } as never, null, null);
		for (const status of ['going', 'going', 'maybe', 'maybe', 'declined', 'declined', 'going'] as const) {
			await endpoint.exec({ eventId: 'eventa', status }, { id: 'guesta' } as never, null, null);
			const packed = await packHataskEvent(storedEvent as never, 'ownera', repository as never, {
				findOneBy: async ({ id: userId }: { id: string }) => ({ username: userId, name: userId }),
			} as never);
			expect(packed.rsvpResponses).toHaveLength(2);
			expect(packed.rsvpResponses.filter(row => row.userId === 'guesta')).toMatchObject([{ status }]);
			for (const choice of ['going', 'maybe', 'declined']) {
				expect(packed.rsvpResponses.filter(row => row.status === choice)).toHaveLength(Number(choice === 'going') + Number(choice === status));
			}
		}
		expect(repository.insert).toHaveBeenCalledTimes(2);
	});

	test('public list exposes the same revision contract used by update and close', async () => {
		const storedEvent = event();
		const find = vi.fn().mockResolvedValue([storedEvent]);
		const endpoint = new ListHataskEventsEndpoint(
			{ find } as never,
			{ find: vi.fn().mockResolvedValue([]) } as never,
			{ findOneBy: vi.fn().mockResolvedValue({ username: 'owner', avatarUrl: null }) } as never,
		);

		const result = await endpoint.exec({ limit: 10, includeExpired: false }, { id: 'ownera' } as never, null, null);
		expect(result).toMatchObject([{ id: 'eventa', revision: hashHataskEvent(storedEvent as never), isOwner: true }]);
		expect(find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.arrayContaining([
				{ visibility: 'public', date: expect.anything() },
				{ visibility: 'public', dateEnd: expect.anything() },
				{ userId: 'ownera', date: expect.anything() },
			]),
		}));
	});

	test('owned pagination fixes the owner filter server-side and exposes no user selector', async () => {
		const find = vi.fn().mockResolvedValue([event()]);
		const endpoint = new OwnedHataskEventsEndpoint(
			{ find } as never,
			{ find: vi.fn().mockResolvedValue([]) } as never,
			{ findOneBy: vi.fn().mockResolvedValue({ username: 'owner', avatarUrl: null }) } as never,
		);

		const result = await endpoint.exec({ limit: 25, untilId: 'zzzz' }, { id: 'ownera' } as never, null, null);
		const query = find.mock.calls[0][0];
		expect(query.where.userId).toBe('ownera');
		expect(query.where.id).toBeDefined();
		expect(query.where).not.toHaveProperty('date');
		expect(query.order).toEqual({ id: 'DESC' });
		expect(query.take).toBe(25);
		expect(result).toMatchObject([{ id: 'eventa', userId: 'ownera', isOwner: true }]);

		const validateOwned = compile(ownedParamDef);
		expect(validateOwned({ limit: 100 }), JSON.stringify(validateOwned.errors)).toBe(true);
		expect(validateOwned({ limit: 101 })).toBe(false);
		expect(validateOwned({ userId: 'intruder' })).toBe(false);
	});

	test('registers the owned and update endpoints', () => {
		const source = readFileSync(resolve(import.meta.dirname, '../../src/server/api/endpoint-list.ts'), 'utf8');
		expect(source).toMatch(/'hatask\/events\/owned'/u);
		expect(source).toMatch(/'hatask\/events\/update'/u);
	});
});
