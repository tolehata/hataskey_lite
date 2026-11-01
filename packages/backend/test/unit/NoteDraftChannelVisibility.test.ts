/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NoteDraftService } from '@/core/NoteDraftService.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- The draft service is exercised without a database. */
const CHANNEL_VISIBILITY_ERROR = 'b7fc0efe-8a94-4cbb-bf2e-9b34fdfc4e30';

function setup(saved: Record<string, unknown> = {}) {
	const notes = new Map<string, { id: string; channelId: string | null }>([
		['channel-reply-target', { id: 'channel-reply-target', channelId: 'channel' }],
		['plain-reply-target', { id: 'plain-reply-target', channelId: null }],
	]);
	const insertOne = vi.fn(async (draft: unknown) => draft);
	const execute = vi.fn(async () => ({ raw: [{ id: 'draft', ...saved }] }));
	const service = Object.assign(Object.create(NoteDraftService.prototype), {
		roleService: { getUserPolicies: async () => ({ noteDraftLimit: 10, scheduledNoteLimit: 10 }) },
		idService: { gen: () => 'draft' },
		notesRepository: { findOne: vi.fn(async ({ where }: { where: { id: string } }) => notes.get(where.id) ?? null) },
		noteDraftsRepository: {
			countBy: async () => 0,
			insertOne,
			findOneBy: async () => ({ id: 'draft', userId: 'me', isActuallyScheduled: false, channelId: null, replyId: null, visibility: 'public', ...saved }),
			createQueryBuilder: () => ({ update: () => ({ set: () => ({ where: () => ({ returning: () => ({ execute }) }) }) }) }),
		},
	}) as NoteDraftService;
	// @bindThis methods are prototype getters, so stubs are defined on the instance.
	// Reply/renote/file/channel existence checks are covered elsewhere; only the audience rule is under test.
	for (const [name, value] of Object.entries({ validate: async () => {}, clearSchedule: async () => {}, schedule: vi.fn() })) {
		Object.defineProperty(service, name, { value, configurable: true });
	}
	return { service, insertOne, execute };
}

const me = { id: 'me' } as any;

describe('a draft is rejected when it could only fail at posting time', () => {
	test.each(['home', 'followers', 'specified'] as const)('a %s draft in a channel', async visibility => {
		const { service, insertOne } = setup();
		await expect(service.create(me, { channelId: 'channel', visibility } as any)).rejects.toMatchObject({ id: CHANNEL_VISIBILITY_ERROR });
		expect(insertOne).not.toHaveBeenCalled();
	});

	test('a private reply to a channel note, which posting would move into that channel', async () => {
		const { service, insertOne } = setup();
		await expect(service.create(me, { replyId: 'channel-reply-target', visibility: 'followers' } as any)).rejects.toMatchObject({ id: CHANNEL_VISIBILITY_ERROR });
		expect(insertOne).not.toHaveBeenCalled();
	});

	test('a partial update that makes a saved channel draft private', async () => {
		const { service, execute } = setup({ channelId: 'channel', visibility: 'public' });
		await expect(service.update(me, 'draft', { visibility: 'home' } as any)).rejects.toMatchObject({ id: CHANNEL_VISIBILITY_ERROR });
		expect(execute).not.toHaveBeenCalled();
	});
});

describe('ordinary drafts are unaffected', () => {
	test.each([['public', 'public'], ['omitted visibility (public)', undefined]] as const)('a channel draft with %s', async (_label, visibility) => {
		const { service, insertOne } = setup();
		await service.create(me, { channelId: 'channel', visibility } as any);
		expect(insertOne).toHaveBeenCalledOnce();
	});

	test('a private reply outside any channel, even if a stale channel was attached', async () => {
		const { service, insertOne } = setup();
		await service.create(me, { channelId: 'old-channel', replyId: 'plain-reply-target', visibility: 'specified' } as any);
		expect(insertOne).toHaveBeenCalledOnce();
	});

	test('a partial update that leaves a channel draft public, and one that removes the channel', async () => {
		const { service, execute } = setup({ channelId: 'channel', visibility: 'public' });
		await service.update(me, 'draft', { text: 'edited' } as any);
		await service.update(me, 'draft', { channelId: null, visibility: 'followers' } as any);
		expect(execute).toHaveBeenCalledTimes(2);
	});
});
