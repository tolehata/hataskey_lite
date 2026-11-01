/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { UserWebhookService } from '@/core/UserWebhookService.js';
import { WebhookTestService } from '@/core/WebhookTestService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { UserWebhookDeliverProcessorService } from '@/queue/processors/UserWebhookDeliverProcessorService.js';
import type { UserWebhookDeliverJobData } from '@/queue/types.js';

const noteEvents = ['note', 'reply', 'renote', 'mention'] as const;

function fixture() {
	const state = { isPrivate: true, members: [] as string[] };
	const privateNote = { id: 'private', userId: 'author', channelId: 'channel', replyId: null, renoteId: null, text: 'private body' };
	const publicNote = { id: 'public', userId: 'other-author', channelId: null, replyId: null, renoteId: null, text: 'public body' };
	const quote = { ...publicNote, id: 'quote', renoteId: privateNote.id, renote: privateNote };
	const notesRepository = { find: vi.fn(async () => []) };
	const noteEntity = Object.assign(Object.create(NoteEntityService.prototype), {
		notesRepository,
		channelsRepository: { findBy: async () => [{ id: 'channel', userId: 'owner', moderatorUserIds: [], isPrivate: state.isPrivate }] },
		channelMembersRepository: { findBy: async ({ userId }: { userId: string }) => state.members.includes(userId) ? [{ channelId: 'channel', userId }] : [] },
		roleService: { isModerator: async () => false, isAdministrator: async () => false },
	}) as NoteEntityService;
	const webhook = { id: 'hook', userId: 'viewer', on: [...noteEvents, 'follow'], active: true, url: 'https://hook.invalid', secret: 'test-secret' };
	const enqueue = vi.fn().mockResolvedValue(undefined);
	const service = new UserWebhookService({ on: vi.fn() } as never, { findBy: async () => [webhook] } as never, { userWebhookDeliver: enqueue } as never, noteEntity);
	const send = vi.fn().mockResolvedValue({ status: 200 });
	const update = vi.fn().mockResolvedValue(undefined);
	const delivery = new UserWebhookDeliverProcessorService(
		{ host: 'local.test', url: 'https://local.test' } as never,
		{ update, findOneBy: async ({ userId }: { userId: string }) => userId === webhook.userId ? webhook : null } as never,
		{ send } as never, { logger: { createSubLogger: () => ({ debug: vi.fn() }) } } as never, noteEntity,
	);
	const job = (content: object, userId = 'viewer', type = 'reply') => ({ data: {
		webhookId: webhook.id, userId, type, content: structuredClone(content),
		to: 'https://hook.invalid', secret: 'test-secret', eventId: 'event', createdAt: 1,
	} }) as Parameters<UserWebhookDeliverProcessorService['process']>[0];
	return { state, privateNote, publicNote, quote, notesRepository, webhook, enqueue, service, send, update, delivery, job };
}

describe('private channel user webhooks', () => {
	test.each(noteEvents)('%s never enters the queue with an inaccessible nested note', async type => {
		const f = fixture();
		await f.service.enqueueUserWebhook('viewer', type, { note: f.quote } as never);
		expect(f.enqueue).not.toHaveBeenCalled();
	});

	test('allows a member payload and an ordinary follow event', async () => {
		const f = fixture();
		f.state.members.push('viewer');
		await f.service.enqueueUserWebhook('viewer', 'reply', { note: f.quote } as never);
		await f.service.enqueueUserWebhook('viewer', 'follow', { user: { id: 'followed' } } as never);
		expect(f.enqueue).toHaveBeenCalledTimes(2);
		expect(f.enqueue).toHaveBeenNthCalledWith(1, f.webhook, 'reply', { note: f.quote });
		expect(f.enqueue).toHaveBeenNthCalledWith(2, f.webhook, 'follow', { user: { id: 'followed' } });
	});

	test('rejects queued content after membership is revoked', async () => {
		const f = fixture();
		f.state.members.push('viewer');
		await f.service.enqueueUserWebhook('viewer', 'reply', { note: f.quote } as never);
		expect(f.enqueue).toHaveBeenCalledOnce();
		const queued = f.job(f.enqueue.mock.calls[0][2] as UserWebhookDeliverJobData['content']);
		f.state.members = [];
		await expect(f.delivery.process(queued)).resolves.toBe('Skipped: note is no longer visible');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.update).not.toHaveBeenCalled();
	});

	test('rejects queued content after its nested channel becomes private', async () => {
		const f = fixture();
		f.state.isPrivate = false;
		await f.service.enqueueUserWebhook('viewer', 'renote', { note: f.quote } as never);
		expect(f.enqueue).toHaveBeenCalledOnce();
		const queued = f.job(f.enqueue.mock.calls[0][2] as UserWebhookDeliverJobData['content'], 'viewer', 'renote');
		f.state.isPrivate = true;
		await f.delivery.process(queued);
		expect(f.send).not.toHaveBeenCalled();
	});

	test('delivers allowed public and author payloads through the mocked transport', async () => {
		const f = fixture();
		await expect(f.delivery.process(f.job({ note: f.publicNote }))).resolves.toBe('Success');
		f.webhook.userId = 'author';
		await expect(f.delivery.process(f.job({ note: f.privateNote }, 'author', 'note'))).resolves.toBe('Success');
		expect(f.send).toHaveBeenCalledTimes(2);
		expect(JSON.parse(f.send.mock.calls[1][1].body)).toMatchObject({ body: { note: f.privateNote }, userId: 'author' });
	});

	test('delivers non-note events without a note lookup', async () => {
		const f = fixture();
		await expect(f.delivery.process(f.job({ user: { id: 'followed' } }, 'viewer', 'follow'))).resolves.toBe('Success');
		expect(f.send).toHaveBeenCalledOnce();
		expect(f.notesRepository.find).not.toHaveBeenCalled();
	});

	test.each(noteEvents)('keeps synthetic %s test deliveries working without a stored note', async type => {
		const f = fixture();
		const testService = new WebhookTestService(
			{ populateEmojis: async () => ({}) } as never,
			{ fetchWebhooks: async () => [f.webhook] } as never, {} as never,
			{ userWebhookDeliver: f.enqueue } as never,
		);
		await testService.testUserWebhook({ webhookId: f.webhook.id, type }, { id: 'viewer' } as never);
		expect(f.enqueue).toHaveBeenCalledOnce();
		await expect(f.delivery.process(f.job(f.enqueue.mock.calls[0][2], 'viewer', type))).resolves.toBe('Success');
		expect(f.send).toHaveBeenCalledOnce();
		expect(f.notesRepository.find).not.toHaveBeenCalled();
	});

	test('retries visibility lookup failures without sending or recording a delivery', async () => {
		const f = fixture();
		f.notesRepository.find.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(f.delivery.process(f.job({ note: { id: 'partial-note', userId: 'author' } }))).rejects.toThrow('database unavailable');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.update).not.toHaveBeenCalled();
	});
});
