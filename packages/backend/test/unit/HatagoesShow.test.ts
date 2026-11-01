/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import ShowEndpoint from '@/server/api/endpoints/hata/hatagoes/show.js';

function fixture() {
	const conditions: string[] = [];
	const qb = {
		innerJoinAndSelect: vi.fn(() => qb), leftJoin: vi.fn(() => qb),
		where: vi.fn((value: unknown) => { capture(value); return qb; }),
		andWhere: vi.fn((value: unknown) => { capture(value); return qb; }),
		orWhere: vi.fn((value: unknown) => { capture(value); return qb; }),
		getOne: vi.fn().mockResolvedValue(null),
	};
	function capture(value: unknown) {
		if (typeof value === 'string') conditions.push(value);
		else if (value != null && typeof value === 'object' && 'whereFactory' in value) (value.whereFactory as (query: typeof qb) => void)(qb);
	}
	const events = { findOneBy: vi.fn().mockResolvedValue(null) };
	const flowers = { createQueryBuilder: vi.fn(() => qb) };
	const rsvps = { find: vi.fn().mockResolvedValue([]) };
	const users = { findOneBy: vi.fn().mockResolvedValue({ username: 'owner', avatarUrl: null }) };
	const blockings = { exists: vi.fn().mockResolvedValue(false) };
	const queryService = { generateMutedUserQueryForUsers: vi.fn(), generateBlockQueryForUsers: vi.fn() };
	const userEntity = { packMany: vi.fn().mockResolvedValue([{ id: 'owner' }]) };
	const recipeService = { showCookingRecord: vi.fn().mockResolvedValue(null) };
	const endpoint = new ShowEndpoint(events as never, flowers as never, rsvps as never, users as never,
		blockings as never, queryService as never, userEntity as never, recipeService as never);
	return { endpoint, events, flowers, rsvps, users, blockings, queryService, userEntity, recipeService, qb, conditions };
}
const viewer = { id: 'viewer' } as never;

describe('HataGoes direct details', () => {
	test('rechecks event audience and blocking before packing a saved event', async () => {
		const f = fixture();
		const event = {
			id: 'event', userId: 'owner', title: '予定', emoji: '📅', date: '2026-10-02', dateEnd: '', timeStart: '12:00', timeEnd: '13:00',
			allDay: false, color: '#123456', rsvp: false, rsvpClosed: false, visibility: 'specified', visibleUserIds: ['member'], createdAt: new Date('2026-10-01'),
		};
		f.events.findOneBy.mockResolvedValue(event);
		await expect(f.endpoint.exec({ kind: 'event', id: 'event' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATAGOES_ITEM' });
		event.visibleUserIds.push('viewer');
		f.blockings.exists.mockResolvedValueOnce(true);
		await expect(f.endpoint.exec({ kind: 'event', id: 'event' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATAGOES_ITEM' });
		await expect(f.endpoint.exec({ kind: 'event', id: 'event' }, viewer, null, null)).resolves.toMatchObject({ kind: 'event', item: { id: 'event', title: '予定', date: '2026-10-02' } });
	});

	test('cooking details are fetched only through the owner-scoped service method', async () => {
		const f = fixture();
		f.recipeService.showCookingRecord.mockResolvedValueOnce({ id: 'record', title: '夕食', memo: '記録' });
		await expect(f.endpoint.exec({ kind: 'cookingRecord', id: 'record' }, viewer, null, null)).resolves.toMatchObject({ kind: 'cookingRecord', item: { memo: '記録' } });
		expect(f.recipeService.showCookingRecord).toHaveBeenCalledWith(viewer, 'record');
		await expect(f.endpoint.exec({ kind: 'cookingRecord', id: 'other' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_HATAGOES_ITEM' });
	});

	test('flower detail uses the community visibility rules and returns list fields', async () => {
		const f = fixture();
		f.qb.getOne.mockResolvedValue({
			id: 'flower', userId: 'owner', user: { id: 'owner' }, clientFlowerId: 'local', emoji: '🌸', name: '花', hanakotoba: '希望', harvestedAt: new Date('2026-10-01'),
		});
		await expect(f.endpoint.exec({ kind: 'flower', id: 'flower' }, viewer, null, null)).resolves.toMatchObject({ kind: 'flower', item: { id: 'flower', clientFlowerId: 'local', emoji: '🌸', user: { id: 'owner' } } });
		expect(f.conditions.join('\n')).toContain('user.host IS NULL');
		expect(f.conditions.join('\n')).toContain('user.isSuspended = FALSE');
		expect(f.conditions.join('\n')).toContain('profile.hataskFlowerVisibility = :publicVisibility');
		expect(f.queryService.generateMutedUserQueryForUsers).toHaveBeenCalledWith(f.qb, viewer);
		expect(f.queryService.generateBlockQueryForUsers).toHaveBeenCalledWith(f.qb, viewer);
	});
});
