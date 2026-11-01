/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import Fastify from 'fastify';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { ActivityPubServerService } from '@/server/ActivityPubServerService.js';
import { meta as updateRemoteUserMeta } from '@/server/api/endpoints/federation/update-remote-user.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- These stubs exercise isolated service behavior without a database. */

describe('followers 限定ノートの返信先', () => {
	test('返信リレーションと mentions がなくても replyUserId のユーザーは閲覧できる', async () => {
		const followings = { count: vi.fn() };
		const users = { findOneByOrFail: vi.fn(), findOneBy: vi.fn(async () => ({})) };
		const service = Object.create(NoteEntityService.prototype) as any;
		service.meta = { ugcVisibilityForVisitor: 'all' };
		service.roleService = { isAdministrator: vi.fn(async () => false) };
		service.idService = { parse: () => ({ date: new Date() }) };
		service.followingsRepository = followings;
		service.usersRepository = users;
		// The reply target is an ordinary note outside any channel.
		service.notesRepository = { find: vi.fn(async () => [{ id: 'parent', userId: 'recipient', channelId: null, replyId: null, renoteId: null }]) };
		const note = {
			visibility: 'followers', userId: 'author', userHost: null,
			id: 'reply', channelId: null, replyId: 'parent', renoteId: null, replyUserId: 'recipient',
			reply: undefined, mentions: [],
		};

		expect(await service.isVisibleForMe(note, 'recipient')).toBe(true);
		expect(followings.count).not.toHaveBeenCalled();
		expect(users.findOneByOrFail).not.toHaveBeenCalled();
	});

	test('返信先以外でフォローしていないローカルユーザーは閲覧できない', async () => {
		const service = Object.create(NoteEntityService.prototype) as any;
		service.meta = { ugcVisibilityForVisitor: 'all' };
		service.roleService = { isAdministrator: vi.fn(async () => false) };
		service.idService = { parse: () => ({ date: new Date() }) };
		service.followingsRepository = { count: vi.fn(async () => 0) };
		service.usersRepository = { findOneBy: vi.fn(async () => ({})), findOneByOrFail: vi.fn(async () => ({ id: 'stranger', host: null })) };
		service.notesRepository = { find: vi.fn(async () => [{ id: 'parent', userId: 'recipient', channelId: null, replyId: null, renoteId: null }]) };
		const note = {
			visibility: 'followers', userId: 'author', userHost: null,
			id: 'reply', channelId: null, replyId: 'parent', renoteId: null, replyUserId: 'recipient',
			reply: undefined, mentions: [],
		};

		expect(await service.isVisibleForMe(note, 'stranger')).toBe(false);
		expect(service.followingsRepository.count).toHaveBeenCalledOnce();
	});
});

test('リモートユーザー更新には認証・read:account・1時間30回の制限を適用する', () => {
	expect(updateRemoteUserMeta.requireCredential).toBe(true);
	expect(updateRemoteUserMeta.kind).toBe('read:account');
	expect(updateRemoteUserMeta.limit).toEqual({ duration: 60 * 60 * 1000, max: 30 });
});

test('ActivityPub の inbox は JSON parser を scope 内で制限する', async () => {
	const fastify = Fastify();
	const service = Object.create(ActivityPubServerService.prototype) as any;
	Object.defineProperty(service, 'inbox', { value: async (request: any) => request.body });
	fastify.post('/other', async (request) => request.body);
	fastify.register(service.createServer, { prefix: '/ap' });
	try {
		const json = JSON.stringify({ type: 'Follow' });
		const refused = await fastify.inject({ method: 'POST', url: '/ap/inbox', headers: { 'content-type': 'application/json' }, payload: json });
		expect(refused.statusCode).toBe(415);
		const accepted = await fastify.inject({ method: 'POST', url: '/ap/inbox', headers: { 'content-type': 'application/activity+json' }, payload: json });
		expect(accepted.statusCode).toBe(200);
		expect(accepted.json()).toEqual({ type: 'Follow' });
		const outside = await fastify.inject({ method: 'POST', url: '/other', headers: { 'content-type': 'application/json' }, payload: json });
		expect(outside.statusCode).toBe(200);
		expect(outside.json()).toEqual({ type: 'Follow' });
	} finally {
		await fastify.close();
	}
});
