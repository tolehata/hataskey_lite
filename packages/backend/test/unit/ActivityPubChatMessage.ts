/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as crypto from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, test, vi } from 'vitest';
import { ActivityPubServerService } from '@/server/ActivityPubServerService.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated route fixtures avoid a database. */

const host = 'local.example';
const path = '/ap/chat/messages/message-1';
const accept = 'application/activity+json';
const recipientKeyId = 'https://remote.example/users/recipient#main-key';
const strangerKeyId = 'https://remote.example/users/stranger#main-key';

function signedHeaders(keyId: string, privateKey: crypto.KeyObject, options: {
	path?: string;
	host?: string;
	date?: string;
	xDate?: string;
	signedNames?: string[];
	unsignedXDate?: string;
} = {}) {
	const date = options.date ?? new Date().toUTCString();
	const signedNames = options.signedNames ?? ['(request-target)', 'host', 'date'];
	const values: Record<string, string> = {
		'(request-target)': `get ${options.path ?? path}`,
		host: options.host ?? host,
		date,
		'x-date': options.xDate ?? date,
	};
	const signingString = signedNames.map(name => `${name}: ${values[name]}`).join('\n');
	const signature = crypto.sign('sha256', Buffer.from(signingString), privateKey).toString('base64');
	return {
		host: options.host ?? host,
		date,
		accept,
		...(options.xDate == null && options.unsignedXDate == null ? {} : { 'x-date': options.xDate ?? options.unsignedXDate! }),
		signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="${signedNames.join(' ')}",signature="${signature}"`,
	};
}

async function fixture(options: {
	federation?: string;
	message?: any;
	fromUser?: any;
	toUser?: any;
} = {}) {
	const recipientKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
	const strangerKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
	const message = options.message === undefined ? {
		id: 'message-1', fromUserId: 'sender', toUserId: 'recipient', toRoomId: null,
		text: 'private message', fileId: 'attachment-1',
	} : options.message;
	const fromUser = options.fromUser === undefined ? { id: 'sender', host: null } : options.fromUser;
	const toUser = options.toUser === undefined ? { id: 'recipient', host: 'remote.example' } : options.toUser;
	const renderChatMessage = vi.fn(async () => ({ content: message?.text, attachment: [{ id: message?.fileId }] }));
	const keyLookup = vi.fn(async (keyId: string) => {
		if (keyId === recipientKeyId) return { user: toUser, key: { keyPem: recipientKeys.publicKey.export({ type: 'spki', format: 'pem' }) } };
		if (keyId === strangerKeyId) return { user: { id: 'stranger', host: 'remote.example' }, key: { keyPem: strangerKeys.publicKey.export({ type: 'spki', format: 'pem' }) } };
		return null;
	});
	const service = Object.create(ActivityPubServerService.prototype) as any;
	service.config = { host };
	service.meta = { federation: options.federation ?? 'all' };
	service.chatMessagesRepository = { findOneBy: vi.fn(async () => message) };
	service.usersRepository = { findOneBy: vi.fn(async ({ id }: { id: string }) => id === 'sender' ? fromUser : id === 'recipient' ? toUser : null) };
	service.apDbResolverService = { getAuthUserFromKeyId: keyLookup };
	service.apRendererService = { renderChatMessage, addContext: (value: unknown) => value };
	const fastify = Fastify();
	fastify.register(service.createServer, { prefix: '/ap' });
	return {
		fastify,
		renderChatMessage,
		keyLookup,
		recipientKeys,
		strangerKeys,
		get: (headers: Record<string, string> = { host, accept }) => fastify.inject({ method: 'GET', url: path, headers }),
	};
}

describe('ActivityPub chat message dereference', () => {
	test.each([
		['remote recipient', { id: 'recipient', host: 'remote.example' }],
		['local recipient', { id: 'recipient', host: null }],
	])('anonymous request cannot read %s chat content or attachment', async (_label, toUser) => {
		const f = await fixture({ toUser });
		try {
			const response = await f.get();
			expect(response.statusCode).toBe(404);
			expect(response.body).not.toContain('private message');
			expect(response.body).not.toContain('attachment-1');
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(response.headers.vary).toContain('Accept');
			expect(f.renderChatMessage).not.toHaveBeenCalled();
		} finally {
			await f.fastify.close();
		}
	});

	test('matching remote recipient signature receives content and attachment', async () => {
		const f = await fixture();
		try {
			const response = await f.get(signedHeaders(recipientKeyId, f.recipientKeys.privateKey));
			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({ content: 'private message', attachment: [{ id: 'attachment-1' }] });
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(response.headers.vary).toContain('Accept');
			expect(f.renderChatMessage).toHaveBeenCalledOnce();
		} finally {
			await f.fastify.close();
		}
	});

	test('matching remote recipient may sign x-date', async () => {
		const f = await fixture();
		try {
			const response = await f.get(signedHeaders(recipientKeyId, f.recipientKeys.privateKey, {
				xDate: new Date().toUTCString(), signedNames: ['(request-target)', 'host', 'x-date'],
			}));
			expect(response.statusCode).toBe(200);
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(f.renderChatMessage).toHaveBeenCalledOnce();
		} finally {
			await f.fastify.close();
		}
	});

	test.each([
		['unrelated actor', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(strangerKeyId, f.strangerKeys.privateKey)],
		['forged signature', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.strangerKeys.privateKey)],
		['unknown key', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders('https://unknown.example/key', f.recipientKeys.privateKey)],
		['unsigned host', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { signedNames: ['(request-target)', 'date'] })],
		['unsigned target', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { signedNames: ['host', 'date'] })],
		['unsigned date', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { signedNames: ['(request-target)', 'host'] })],
		['wrong target', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { path: '/ap/chat/messages/another' })],
		['wrong host', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { host: 'other.example' })],
		['stale date', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { date: new Date(Date.now() - 10 * 60_000).toUTCString() })],
		['invalid date', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { date: 'not-a-date' })],
		['invalid x-date', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { xDate: 'not-a-date', signedNames: ['(request-target)', 'host', 'x-date'] })],
		['unsigned x-date override', (f: Awaited<ReturnType<typeof fixture>>) => signedHeaders(recipientKeyId, f.recipientKeys.privateKey, { unsignedXDate: new Date().toUTCString() })],
	] as const)('%s cannot read the chat message', async (_label, headers) => {
		const f = await fixture();
		try {
			const response = await f.get(headers(f));
			expect(response.statusCode).toBe(404);
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(f.renderChatMessage).not.toHaveBeenCalled();
		} finally {
			await f.fastify.close();
		}
	});

	test('a local service actor with the recipient id cannot dereference', async () => {
		const f = await fixture();
		try {
			f.keyLookup.mockResolvedValue({
				user: { id: 'recipient', host: null },
				key: { keyPem: f.recipientKeys.publicKey.export({ type: 'spki', format: 'pem' }) },
			});
			const response = await f.get(signedHeaders(recipientKeyId, f.recipientKeys.privateKey));
			expect(response.statusCode).toBe(404);
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(f.renderChatMessage).not.toHaveBeenCalled();
		} finally {
			await f.fastify.close();
		}
	});

	test.each([
		['local recipient', { toUser: { id: 'recipient', host: null } }],
		['room message', { message: { id: 'message-1', fromUserId: 'sender', toRoomId: 'room-1' } }],
		['mixed recipient and room', { message: { id: 'message-1', fromUserId: 'sender', toUserId: 'recipient', toRoomId: 'room-1' } }],
		['remote sender', { fromUser: { id: 'sender', host: 'remote.example' } }],
		['missing sender', { fromUser: null }],
		['missing recipient', { toUser: null }],
		['missing message', { message: null }],
	] as const)('%s remains unavailable to a signed remote recipient', async (_label, options) => {
		const f = await fixture(options);
		try {
			const response = await f.get(signedHeaders(recipientKeyId, f.recipientKeys.privateKey));
			expect(response.statusCode).toBe(404);
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(f.renderChatMessage).not.toHaveBeenCalled();
		} finally {
			await f.fastify.close();
		}
	});

	test('disabled federation keeps its forbidden response private', async () => {
		const f = await fixture({ federation: 'none' });
		try {
			const response = await f.get(signedHeaders(recipientKeyId, f.recipientKeys.privateKey));
			expect(response.statusCode).toBe(403);
			expect(response.headers['cache-control']).toBe('private, no-store');
			expect(f.renderChatMessage).not.toHaveBeenCalled();
		} finally {
			await f.fastify.close();
		}
	});
});
