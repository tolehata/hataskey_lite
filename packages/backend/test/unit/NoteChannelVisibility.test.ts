/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import NotesCreate, { meta } from '@/server/api/endpoints/notes/create.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';

// Stop at the first content check, before persistence, fanout, or federation.
function setup() {
	const boundaryPassed = new Error('audience validation passed');
	const contentCheck = vi.fn(() => { throw boundaryPassed; });
	const service: NoteCreateService = Object.assign(Object.create(NoteCreateService.prototype), {
		channelsRepository: { findOneBy: vi.fn(async ({ id }: { id: string }) => ({ id })) },
		meta: { sensitiveWords: [], prohibitedWords: [] },
		utilityService: { isKeyWordIncluded: () => false },
		roleService: { getUserPolicies: async () => ({ canPublicNote: true }) },
	});
	Object.defineProperty(service, 'checkProhibitedWordsContain', { value: contentCheck });
	return { service, contentCheck, boundaryPassed };
}

const user = { id: 'owner', username: 'owner', host: null, isBot: false, isCat: false };
type Data = Parameters<NoteCreateService['create']>[1];

describe('channel visibility cannot widen a note', () => {
	test.each(['home', 'followers', 'specified'] as const)('rejects explicit and reply-inherited channels for %s before side effects', async visibility => {
		for (const inherited of [false, true]) {
			const { service, contentCheck } = setup();
			const visibleUsers = [{ id: 'recipient' }];
			const data = { text: 'private', visibility, visibleUsers, ...(inherited ? { reply: { channelId: 'channel' } } : { channel: { id: 'channel' } }) } as Data;
			await expect(service.create(user, data)).rejects.toMatchObject({ id: meta.errors.invalidChannelVisibility.id });
			expect(data.visibility).toBe(visibility);
			expect(data.visibleUsers).toBe(visibleUsers);
			expect(contentCheck).not.toHaveBeenCalled();
		}
	});
	test.each(['public', undefined] as const)('keeps normal public channel behavior with visibility %s', async visibility => {
		const { service, contentCheck, boundaryPassed } = setup();
		const data = { text: 'channel', visibility, channel: { id: 'channel' } } as Data;
		await expect(service.create(user, data)).rejects.toBe(boundaryPassed);
		expect(contentCheck).toHaveBeenCalledOnce();
		expect(data).toMatchObject({ visibility: 'public', localOnly: true, visibleUsers: [] });
	});
	test('preserves a non-channel DM, including a reply that leaves a channel', async () => {
		for (const channel of [undefined, { id: 'old-channel' }]) {
			const { service, boundaryPassed } = setup();
			const data = { text: 'private', visibility: 'specified', visibleUsers: [{ id: 'recipient' }], channel, reply: { channelId: null } } as Data;
			await expect(service.create(user, data)).rejects.toBe(boundaryPassed);
			expect(data).toMatchObject({ visibility: 'specified', visibleUsers: [{ id: 'recipient' }], localOnly: false });
		}
	});
	test('returns a client error through notes/create instead of an internal error', async () => {
		const endpoint = new NotesCreate({} as never, { fetchAndCreate: vi.fn().mockRejectedValue(new IdentifiableError(meta.errors.invalidChannelVisibility.id, 'invalid audience')) } as never);
		await expect(endpoint.exec({ text: 'draft', channelId: 'channel', visibility: 'specified', visibleUserIds: ['recipient'] }, user as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_CHANNEL_VISIBILITY', kind: 'client' });
	});
});
