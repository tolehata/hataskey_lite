/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import _Ajv from 'ajv';
import CapabilityEndpoint from '@/server/api/endpoints/hataigo/chat-capability.js';
import ChatMessagesEndpoint from '@/server/api/endpoints/hataigo/chat-messages.js';
import ChatPostEndpoint from '@/server/api/endpoints/hataigo/chat-post.js';
import ChatDeleteEndpoint from '@/server/api/endpoints/hataigo/chat-delete.js';
import MyStatsEndpoint, { meta as statsMeta, paramDef as statsParams } from '@/server/api/endpoints/hataigo/my-stats.js';
import ShowEndpoint from '@/server/api/endpoints/hataigo/show-game.js';
import GamesEndpoint from '@/server/api/endpoints/hataigo/games.js';
import InvitationsEndpoint from '@/server/api/endpoints/hataigo/invitations.js';
import VerifyEndpoint from '@/server/api/endpoints/hataigo/verify.js';
import { hataigoReadQuota, hataigoSettingsSchema } from '@/misc/hataigo/api.js';
import { HataigoError } from '@/misc/hataigo/types.js';

const Ajv = _Ajv.default;

vi.mock('@/core/HataigoChatService.js', () => ({ HataigoChatService: class {} }));
vi.mock('@/core/HataigoService.js', () => ({ HataigoService: class {} }));
vi.mock('@/core/entities/HataigoGameEntityService.js', () => ({ HataigoGameEntityService: class {} }));

const stats = { wins: 1, losses: 2, draws: 3, streak: 0, wins9: 1, wins19: 0, distinctOpponents: 1 };
const viewer = { id: 'alice' };

function fixture() {
	const games = { rateLimit: vi.fn(async () => {}), personalStats: vi.fn(async () => stats), list: vi.fn(async () => []), invitations: vi.fn(async () => []) };
	const packer = { packDetail: vi.fn(async () => ({ id: 'game1', revision: 2 })), packDetailMany: vi.fn(async () => []) };
	return { games, packer };
}

describe('HataIgo HTTP privacy and fixed quotas', () => {
	test('personal stats require read credentials, reject another subject and return exactly the seven counters', async () => {
		const f = fixture();
		const endpoint = new MyStatsEndpoint(f.games as never);
		expect(statsMeta.requireCredential).toBe(true); expect(statsMeta.kind).toBe('read:account');
		const validate = new Ajv().compile(statsParams);
		const unsafe = new Ajv().compile({ ...statsParams, additionalProperties: true });
		expect(unsafe({ userId: 'bob' })).toBe(true);
		expect(validate({ userId: 'bob' })).toBe(false);
		await expect(endpoint.exec({ userId: 'bob' }, viewer as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.games.personalStats).not.toHaveBeenCalled();
		expect(await endpoint.exec({}, viewer as never, null, null)).toEqual(stats);
		expect(f.games.personalStats).toHaveBeenCalledWith(viewer);
		expect(Object.keys(statsMeta.res.properties).sort()).toEqual(Object.keys(stats).sort());
		expect(f.games.rateLimit).toHaveBeenCalledWith('alice', 'read', 120, 60000);
	});

	test('all read endpoints consume the shared account quota before reading games', async () => {
		const f = fixture();
		const endpoints = [new ShowEndpoint(f.games as never, f.packer as never), new GamesEndpoint(f.games as never, f.packer as never), new InvitationsEndpoint(f.games as never, f.packer as never), new VerifyEndpoint(f.games as never, f.packer as never)];
		const params = [{ gameId: 'game1' }, {}, {}, { gameId: 'game1', revision: 2 }];
		for (let index = 0; index < endpoints.length; index++) await endpoints[index].exec(params[index], viewer as never, null, null);
		expect(f.games.rateLimit.mock.calls).toEqual(Array.from({ length: 4 }, () => ['alice', 'read', 120, 60000]));
		f.games.rateLimit.mockRejectedValue(new HataigoError('RATE_LIMIT'));
		f.games.list.mockClear();
		await expect(endpoints[1].exec({}, viewer as never, null, null)).rejects.toMatchObject({ code: 'HATAIGO_RATE_LIMIT', httpStatusCode: 429 });
		expect(f.games.list).not.toHaveBeenCalled();
	});

	test('quota never reads role/donation fields and anonymous addresses use a separate fixed IP bucket', async () => {
		const f = fixture();
		const privileged = { id: 'alice', get policies(): never { throw new Error('must not read policies'); }, get isDonor(): never { throw new Error('must not read donations'); } };
		await hataigoReadQuota(f.games, privileged);
		await hataigoReadQuota(f.games, null, '192.0.2.1');
		expect(f.games.rateLimit).toHaveBeenNthCalledWith(1, 'alice', 'read', 120, 60000);
		expect(f.games.rateLimit).toHaveBeenNthCalledWith(2, expect.stringMatching(/^ip:/), 'read', 120, 60000);
	});
});

test('HTTP announcement settings accept only explicit own consent and the three supported visibilities', () => {
	const validate = new Ajv().compile(hataigoSettingsSchema);
	for (const visibility of ['home', 'followers', 'public']) expect(validate({ announcement: { enabled: true, visibility, allowName: false } })).toBe(true);
	for (const announcement of [{ enabled: 'yes' }, { allowName: 1 }, { visibility: 'specified' }, { userId: 'bob' }, { text: 'free message' }, null]) expect(validate({ announcement })).toBe(false);
});

test('injected disabled chat capability and strict endpoints reject hidden subjects/text or unsupported deletion reasons', async () => {
	const f = fixture();
	const chat = { capability: vi.fn(() => ({ enabled: false, retentionDays: null, disclosureVersion: null })), list: vi.fn(async () => { throw new HataigoError('CHAT_DISABLED'); }), post: vi.fn(async () => { throw new HataigoError('CHAT_DISABLED'); }), delete: vi.fn(async () => { throw new HataigoError('CHAT_DISABLED'); }) };
	const capability = new CapabilityEndpoint(f.games as never, chat as never);
	expect(await capability.exec({}, null, null, null)).toEqual({ enabled: false, retentionDays: null, disclosureVersion: null });
	const messages = new ChatMessagesEndpoint(f.games as never, chat as never);
	await expect(messages.exec({ gameId: 'game1' }, viewer as never, null, null)).rejects.toMatchObject({ code: 'HATAIGO_CHAT_DISABLED' });
	const post = new ChatPostEndpoint(f.games as never, chat as never);
	await expect(post.exec({ gameId: 'game1', text: 'hello', userId: 'bob' }, viewer as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	expect(chat.post).not.toHaveBeenCalled();
	const deletion = new ChatDeleteEndpoint(f.games as never, chat as never);
	await expect(deletion.exec({ messageId: 'message1', reason: 'arbitrary hidden text' }, viewer as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	expect(chat.delete).not.toHaveBeenCalled();
});
