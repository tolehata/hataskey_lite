/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { FindOperator } from 'typeorm';
import CreateEndpoint from '@/server/api/endpoints/hatask/events/create.js';
import ListEndpoint from '@/server/api/endpoints/hatask/events/list.js';
import RsvpEndpoint from '@/server/api/endpoints/hatask/events/rsvp.js';
import UpdateEndpoint from '@/server/api/endpoints/hatask/events/update.js';
import { canViewHataskEvent, validateHataskEventAudience } from '@/server/api/endpoints/hatask/events/_visibility.js';
import { hashHataskEvent, packHataskEvent } from '@/server/api/endpoints/hatask/events/_shared.js';
import { assertPlannerValue } from '@/server/api/endpoints/hatask/planner/_shared.js';
import type { MiHataskEvent } from '@/models/HataskEvent.js';
import { MiHataskRsvp } from '@/models/HataskRsvp.js';

function event(overrides: Partial<MiHataskEvent> = {}): MiHataskEvent {
	return { id: 'eventa', userId: 'owner', user: null, title: '限定予定', emoji: '📅', date: '2030-09-10', dateEnd: '', timeStart: '', timeEnd: '', allDay: true, color: '#123456', rsvp: true, rsvpClosed: false, visibility: 'specified', visibleUserIds: ['member'], createdAt: new Date('2026-09-10'), ...overrides };
}

const me = (id: string) => ({ id }) as never;

describe('Hatask selected member access', () => {
	test.each(['owner', 'member', 'outsider'])('%s has only the granted view and RSVP rights', async id => {
		const allowed = id !== 'outsider';
		const stored = event();
		expect(canViewHataskEvent(stored, id)).toBe(allowed);
		const writes = vi.fn();
		const rsvps = { findOneBy: vi.fn().mockResolvedValue(null), insert: writes };
		const db = { transaction: async (fn: (manager: unknown) => unknown) => fn({ getRepository: (entity: unknown) => entity === MiHataskRsvp ? rsvps : { findOne: vi.fn().mockResolvedValue(stored) } }) };
		const endpoint = new RsvpEndpoint(db as never, { gen: () => 'rsvpa' } as never);
		const action = endpoint.exec({ eventId: 'eventa', status: 'going' }, me(id), null, null);
		if (allowed) { await action; expect(writes).toHaveBeenCalledOnce(); } else { await expect(action).rejects.toMatchObject({ code: 'NO_SUCH_EVENT' }); expect(rsvps.findOneBy).not.toHaveBeenCalled(); expect(writes).not.toHaveBeenCalled(); }
	});
	test('packing rejects outsiders before reading response or profile data', async () => {
		const read = vi.fn();
		await expect(packHataskEvent(event(), 'outsider', { find: read } as never, { findOneBy: read } as never)).rejects.toThrow();
		expect(read).not.toHaveBeenCalled();
	});
	test('a removed member loses RSVP access even when they responded previously', async () => {
		const stored = event({ visibleUserIds: ['replacement'] });
		const find = vi.fn().mockResolvedValue([{ userId: 'member', status: 'going', respondedAt: new Date() }, { userId: 'replacement', status: 'maybe', respondedAt: new Date() }]);
		const packed = await packHataskEvent(stored, 'replacement', { find } as never, { findOneBy: vi.fn().mockResolvedValue({ username: 'user' }) } as never);
		expect(packed.rsvpResponses.map(row => row.userId)).toEqual(['replacement']);
		expect(packed.visibleUserIds).toEqual(['replacement']);
		expect(canViewHataskEvent(stored, 'member')).toBe(false);
	});
	test('audience changes participate in revision conflicts', () => {
		const before = event();
		expect(hashHataskEvent(event({ visibleUserIds: ['replacement'] }))).not.toBe(hashHataskEvent(before));
		expect(hashHataskEvent(event({ visibility: 'public' }))).not.toBe(hashHataskEvent(before));
	});
	test('empty, deleted, suspended and remote members cannot silently become public', async () => {
		for (const ids of [[], ['owner'], ['remote'], ['deleted'], ['suspended']]) {
			await expect(validateHataskEventAudience(event({ visibleUserIds: ids }), { countBy: vi.fn().mockResolvedValue(0) } as never)).rejects.toMatchObject({ code: 'INVALID_HATASK_EVENT_AUDIENCE' });
		}
		const users = { countBy: vi.fn().mockResolvedValue(1) };
		expect(await validateHataskEventAudience(event(), users as never)).toEqual(['member']);
		expect(users.countBy).toHaveBeenCalledWith(expect.objectContaining({ host: expect.any(FindOperator), isSuspended: false, isDeleted: false }));
	});
	test('creation stores the specified audience and rejects an empty audience before insert', async () => {
		const insert = vi.fn();
		const endpoint = new CreateEndpoint({ insert } as never, { gen: () => 'new' } as never, { countBy: vi.fn().mockResolvedValue(1) } as never);
		const input = { title: '限定予定', date: '2030-09-10', allDay: true, visibility: 'specified' as const, visibleUserIds: ['member'] };
		const result = await endpoint.exec(input, me('owner'), null, null);
		expect(result).toMatchObject({ visibility: 'specified', visibleUserIds: ['member'] });
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'specified', visibleUserIds: ['member'] }));
		insert.mockClear();
		await expect(endpoint.exec({ ...input, visibleUserIds: [] }, me('owner'), null, null)).rejects.toMatchObject({ code: 'INVALID_HATASK_EVENT_AUDIENCE' });
		expect(insert).not.toHaveBeenCalled();
	});
	test.each([true, false])('visibility filtering happens before the list limit, including expired=%s', async includeExpired => {
		const records = [event(), event({ id: 'other', visibleUserIds: ['other'] }), event({ id: 'public', visibility: 'public' })];
		const matches = (row: MiHataskEvent, conditions: Record<string, unknown>) => Object.entries(conditions).every(([key, filter]) => {
			const value = row[key as keyof MiHataskEvent];
			if (filter instanceof FindOperator) return filter.type === 'arrayContains' ? (filter.value as string[]).every(id => (value as string[]).includes(id)) : String(value) >= String(filter.value);
			return value === filter;
		});
		const find = vi.fn(async ({ where, take }: { where: Record<string, unknown>[]; take: number }) => records.filter(row => where.some(filter => matches(row, filter))).slice(0, take));
		const endpoint = new ListEndpoint({ find } as never, { find: vi.fn().mockResolvedValue([]) } as never, { findOneBy: vi.fn().mockResolvedValue({ username: 'user' }) } as never);
		const outsider = await endpoint.exec({ includeExpired, limit: 1 }, me('outsider'), null, null);
		expect(outsider.map(row => row.id)).toEqual(['public']);
		const member = await endpoint.exec({ includeExpired, limit: 1 }, me('member'), null, null);
		expect(member.map(row => row.id)).toEqual(['eventa']);
	});
	test('only the owner can change an audience, and ordinary edits preserve it', async () => {
		const stored = event();
		const update = vi.fn();
		const db = { transaction: async (fn: (manager: unknown) => unknown) => fn({ getRepository: () => ({ findOne: vi.fn().mockResolvedValue(stored), update }) }) };
		const endpoint = new UpdateEndpoint(db as never, { find: vi.fn().mockResolvedValue([]) } as never, { findOneBy: vi.fn().mockResolvedValue({ username: 'owner' }), countBy: vi.fn().mockResolvedValue(1) } as never);
		await expect(endpoint.exec({ eventId: stored.id, expectedRevision: hashHataskEvent(stored), visibleUserIds: ['replacement'] }, me('member'), null, null)).rejects.toMatchObject({ code: 'NOT_OWNER' });
		await expect(endpoint.exec({ eventId: stored.id, expectedRevision: hashHataskEvent(stored), visibleUserIds: ['outsider'] }, me('outsider'), null, null)).rejects.toMatchObject({ code: 'NO_SUCH_EVENT' });
		expect(update).not.toHaveBeenCalled();
		const result = await endpoint.exec({ eventId: stored.id, expectedRevision: hashHataskEvent(stored), title: '変更後' }, me('owner'), null, null);
		expect(result).toMatchObject({ visibility: 'specified', visibleUserIds: ['member'], title: '変更後' });
		const changed = await endpoint.exec({ eventId: stored.id, expectedRevision: hashHataskEvent(stored), visibleUserIds: ['replacement'] }, me('owner'), null, null);
		expect(changed.visibleUserIds).toEqual(['replacement']);
	});
	test('member templates validate separately without replacing event or todo payloads', () => {
		const member = { id: 'template', kind: 'members', name: 'いつものメンバー', payload: { visibleUserIds: ['member'] } };
		expect(() => assertPlannerValue([member, { id: 'old', kind: 'event', name: '以前の予定', payload: { title: '残す' } }], 'templates')).not.toThrow();
		expect(() => assertPlannerValue([{ ...member, payload: { visibleUserIds: [] } }], 'templates')).toThrow();
	});
});
