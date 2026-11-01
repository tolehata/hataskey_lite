/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import ReactionsCreate, { meta } from '@/server/api/endpoints/notes/reactions/create.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- The endpoint is exercised with stubbed services. */
describe('notes/reactions/create returns the saved reaction', () => {
	test('the client receives the fallback/normalized value instead of having to refetch the note', async () => {
		const create = vi.fn(async () => '❤');
		const endpoint = new ReactionsCreate({ getNote: vi.fn(async () => ({ id: 'note' })) } as any, { create } as any);
		await expect(endpoint.exec({ noteId: 'note', reaction: ':removed_emoji:' }, { id: 'me' } as any, null, null)).resolves.toEqual({ reaction: '❤' });
		expect(create).toHaveBeenCalledWith({ id: 'me' }, { id: 'note' }, ':removed_emoji:');
	});

	test('the response is declared so the SDK types it', () => {
		expect(meta.res).toMatchObject({ type: 'object', properties: { reaction: { type: 'string', nullable: false } } });
	});
});
