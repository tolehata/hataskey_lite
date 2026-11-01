/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ChatService, ChatMessageAccessError } from '@/core/ChatService.js';
import { PushNotificationService } from '@/core/PushNotificationService.js';
import { QueueService } from '@/core/QueueService.js';
import { RelayService } from '@/core/RelayService.js';
import { SigninWithPasskeyApiService } from '@/server/api/SigninWithPasskeyApiService.js';
import ReactEndpoint from '@/server/api/endpoints/chat/messages/react.js';
import UnreactEndpoint from '@/server/api/endpoints/chat/messages/unreact.js';
import RegisterEndpoint from '@/server/api/endpoints/sw/register.js';
import UnregisterEndpoint from '@/server/api/endpoints/sw/unregister.js';

const webPush = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => undefined) }));
vi.mock('web-push', () => ({ default: webPush }));
afterEach(() => vi.clearAllMocks());

function subject(prototype: object, fields: Record<string, unknown>): any {
	return Object.create(prototype, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, writable: true, configurable: true }])));
}

describe('chat reaction access boundaries', () => {
	function setup(message: Record<string, unknown> | null, member = false) {
		const query: any = { update: vi.fn(() => query), set: vi.fn(() => query), where: vi.fn(() => query), setParameter: vi.fn(() => query), execute: vi.fn() };
		const events = { publishChatRoomStream: vi.fn(), publishChatUserStream: vi.fn() };
		const service = subject(ChatService.prototype, {
			chatMessagesRepository: { findOneBy: vi.fn(async () => message), createQueryBuilder: () => query },
			chatRoomsRepository: { findOneByOrFail: vi.fn(async () => ({ id: 'room' })) },
			isRoomMember: vi.fn(async () => member),
			checkChatAvailability: vi.fn(),
			globalEventService: events,
			userEntityService: { pack: vi.fn(async () => ({ id: 'viewer' })) },
		});
		return { service, query, events };
	}
	const direct = { id: 'message', fromUserId: 'sender', toUserId: 'recipient', toRoomId: null, reactions: [] };

	test.each(['react', 'unreact'] as const)('%s hides missing, private, and non-member room messages behind the same API error', async method => {
		for (const message of [null, direct, { ...direct, toRoomId: 'room', reactions: Array(100).fill('sender/👍') }]) {
			const f = setup(message);
			const endpoint = method === 'react' ? new ReactEndpoint(f.service) : new UnreactEndpoint(f.service);
			await expect(endpoint.exec({ messageId: 'message', reaction: '👍' }, { id: 'viewer' } as never, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_MESSAGE' });
			expect(f.query.execute).not.toHaveBeenCalled();
			expect(f.events.publishChatRoomStream).not.toHaveBeenCalled();
			expect(f.events.publishChatUserStream).not.toHaveBeenCalled();
		}
	});

	test('own-message reaction is inaccessible', async () => {
		const f = setup(direct);
		await expect(f.service.react('message', 'sender', '👍')).rejects.toBeInstanceOf(ChatMessageAccessError);
	});

	test.each(['react', 'unreact'] as const)('%s remains available to a recipient and a room member', async method => {
		for (const [message, userId] of [[direct, 'recipient'], [{ ...direct, toRoomId: 'room' }, 'viewer']] as const) {
			const f = setup(message, true);
			await f.service[method]('message', userId, '👍');
			expect(f.query.execute).toHaveBeenCalledOnce();
			expect(f.query.setParameter).toHaveBeenCalledWith('pair', `${userId}/👍`);
		}
	});
});

describe('push endpoint and shared browser subscription', () => {
	const keys = { endpoint: 'https://push.example/endpoint', auth: 'auth', publickey: 'key' };
	function setup(subscriptions = [{ ...keys, id: 'one', userId: 'owner', sendReadMessage: true }]) {
		const agent = {};
		const repository = { delete: vi.fn(async () => undefined) };
		const service = subject(PushNotificationService.prototype, {
			config: { url: 'https://example.invalid' },
			meta: { enableServiceWorker: true, swPublicKey: 'public', swPrivateKey: 'private' },
			subscriptionsCache: { fetch: vi.fn(async () => subscriptions), refresh: vi.fn() },
			swSubscriptionsRepository: repository,
			httpRequestService: { getAgentForHttps: vi.fn(() => agent) },
		});
		return { service, repository, agent };
	}

	test.each(['http://push.example/a', 'ftp://push.example/a', 'https://user:password@push.example/a', 'https://user@push.example/a', 'not a url'])('registration and delivery reject %s', async endpoint => {
		const f = setup([{ ...keys, endpoint, id: 'one', userId: 'owner', sendReadMessage: true }]);
		const repository = { findOneBy: vi.fn(), insert: vi.fn() };
		const api = new RegisterEndpoint({} as never, repository as never, {} as never, f.service);
		await expect(api.exec({ ...keys, endpoint }, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_ENDPOINT' });
		await f.service.pushNotification('owner', 'hatadyNotification', { id: 'source', notificationType: 'comment' });
		expect(repository.findOneBy).not.toHaveBeenCalled();
		expect(webPush.sendNotification).not.toHaveBeenCalled();
	});

	test('delivery uses the checked HTTPS agent and preserves the private Hatady payload', async () => {
		const f = setup();
		const body = { id: 'source', notificationType: 'comment' };
		await f.service.pushNotification('owner', 'hatadyNotification', body);
		expect(f.service.httpRequestService.getAgentForHttps).toHaveBeenCalledWith(new URL(keys.endpoint));
		expect(webPush.sendNotification).toHaveBeenCalledWith(expect.anything(), expect.any(String), { agent: f.agent });
		const payload = JSON.parse((webPush.sendNotification.mock.calls as unknown[][])[0][1] as string);
		expect(payload.body).toEqual(body);
	});

	test.each(['readAllNotifications', 'readNotification', 'notificationChanged'])('%s honors sendReadMessage', async type => {
		const f = setup([{ ...keys, id: 'one', userId: 'owner', sendReadMessage: false }]);
		await f.service.pushNotification('owner', type, { ids: ['notification'] });
		expect(webPush.sendNotification).not.toHaveBeenCalled();
	});

	test('410 only removes the expired account/key tuple and refreshes its cache', async () => {
		const f = setup();
		webPush.sendNotification.mockRejectedValueOnce({ statusCode: 410 });
		await f.service.pushNotification('owner', 'hatadyNotification', { id: 'source', notificationType: 'comment' });
		await Promise.resolve();
		expect(f.repository.delete).toHaveBeenCalledWith({ ...keys, userId: 'owner' });
		expect(f.service.subscriptionsCache.refresh).toHaveBeenCalledWith('owner');
	});

	test.each([null, { id: 'owner' }])('unregister removes precisely the proven subscription, account=%j', async user => {
		const subscriptions = [{ ...keys, id: 'one', userId: 'owner' }, { ...keys, id: 'two', userId: 'other' }, { ...keys, id: 'wrong', userId: 'third', auth: 'different' }];
		const repository = {
			findBy: vi.fn(async (where: Record<string, string>) => subscriptions.filter(s => Object.entries(where).every(([key, value]) => s[key as keyof typeof s] === value))),
			delete: vi.fn(async () => undefined),
		};
		const cache = { refreshCache: vi.fn() };
		const endpoint = new UnregisterEndpoint(repository as never, cache as never);
		await endpoint.exec(keys, user as never, null, null);
		expect(repository.delete).toHaveBeenCalledWith(user ? ['one'] : ['one', 'two']);
		expect(cache.refreshCache.mock.calls.map(([id]) => id)).toEqual(user ? ['owner'] : ['owner', 'other']);
	});

	test('missing or incorrect ownership keys cannot unregister an endpoint', async () => {
		const repository = { findBy: vi.fn(async () => []), delete: vi.fn() };
		const endpoint = new UnregisterEndpoint(repository as never, { refreshCache: vi.fn() } as never);
		await expect(endpoint.exec({ endpoint: keys.endpoint }, null, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await endpoint.exec({ ...keys, auth: 'wrong' }, null, null, null);
		expect(repository.delete).not.toHaveBeenCalled();
	});
});

describe('queue inspection does not disclose webhook secrets', () => {
	test.each(['userWebhookDeliver', 'systemWebhookDeliver'] as const)('%s redacts both detail and search without mutating the delivery data', async queueType => {
		const job = { id: 'job', name: 'deliver', data: { secret: 'unpredictable-secret', url: 'https://example.invalid/hook' }, opts: {}, timestamp: 0, stacktrace: [] };
		const queue = { getJob: vi.fn(async () => job), getJobs: vi.fn(async () => [job]) };
		const service = subject(QueueService.prototype, { getQueue: () => queue });
		expect((await service.queueGetJob(queueType, 'job')).data.secret).toBe('(redacted)');
		expect(await service.queueGetJobs(queueType, ['waiting'], 'unpredictable')).toEqual([]);
		expect(await service.queueGetJobs(queueType, ['waiting'], 'example.invalid')).toHaveLength(1);
		expect((await service.queueGetJobs(queueType, ['waiting']))[0].data.secret).toBe('(redacted)');
		expect(job.data.secret).toBe('unpredictable-secret');
	});
});

describe('relay replies belong to the requesting relay', () => {
	test.each(['relayAccepted', 'relayRejected'] as const)('%s rejects unrelated actors and stale replies', async method => {
		const row = { id: 'relay', inbox: 'https://relay.example/inbox', status: 'requesting' };
		const repository = {
			findOneBy: vi.fn(async () => ({ ...row })),
			update: vi.fn(async (where: { status: string }, values: { status: string }) => {
				if (row.status !== where.status) return { affected: 0 };
				row.status = values.status;
				return { affected: 1 };
			}),
		};
		const service = subject(RelayService.prototype, { relaysRepository: repository });
		expect(JSON.parse(await service[method]('relay', { inbox: 'https://unrelated.example/inbox', sharedInbox: null })).affected).toBe(0);
		expect(repository.update).not.toHaveBeenCalled();
		expect(JSON.parse(await service[method]('relay', { inbox: null, sharedInbox: row.inbox })).affected).toBe(1);
		expect(JSON.parse(await service[method]('relay', { inbox: row.inbox, sharedInbox: null })).affected).toBe(0);
	});
});

test('a returned passkey rate limit blocks challenge generation and credential verification', async () => {
	const webauthn = { initiateSignInWithPasskeyAuthentication: vi.fn(), verifySignInWithPasskeyAuthentication: vi.fn() };
	const service = subject(SigninWithPasskeyApiService.prototype, {
		config: { url: 'https://example.invalid' }, rateLimiterService: { limit: vi.fn(async () => ({ retryAfter: 250 })) }, webAuthnService: webauthn,
	});
	for (const body of [{}, { credential: { id: 'credential' }, context: '882042b6-bb28-4d79-8d63-f869488ef4ef' }]) {
		const reply = { code: vi.fn(), header: vi.fn() };
		expect(await service.signin({ body, ip: '192.0.2.1' }, reply)).toMatchObject({ error: { code: 'TOO_MANY_AUTHENTICATION_FAILURES' } });
		expect(reply.code).toHaveBeenCalledWith(429);
	}
	expect(webauthn.initiateSignInWithPasskeyAuthentication).not.toHaveBeenCalled();
	expect(webauthn.verifySignInWithPasskeyAuthentication).not.toHaveBeenCalled();
});
