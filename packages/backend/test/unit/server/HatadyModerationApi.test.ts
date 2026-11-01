/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import ListEndpoint, { meta as listMeta, paramDef as listParams } from '@/server/api/endpoints/hata/hatady/admin/moderation/list.js';
import ShowEndpoint, { meta as showMeta, paramDef as showParams } from '@/server/api/endpoints/hata/hatady/admin/moderation/show.js';
import ReviewEndpoint, { meta as reviewMeta, paramDef as reviewParams } from '@/server/api/endpoints/hata/hatady/admin/moderation/review.js';

const target = { targetType: 'book', targetId: 'book1' };
const review = { ...target, state: 'reviewed', note: '確認', expectedRevision: 0, expectedContentVersion: 'a'.repeat(64) };
const endpoints = [
	{ name: 'list', meta: listMeta, params: listParams, ctor: ListEndpoint, payload: {} },
	{ name: 'show', meta: showMeta, params: showParams, ctor: ShowEndpoint, payload: target },
	{ name: 'review', meta: reviewMeta, params: reviewParams, ctor: ReviewEndpoint, payload: review },
];

function harness(kind: 'anonymous' | 'member' | 'moderator' | 'admin' | 'root' | 'app' | 'flash' | 'suspended', exhausted = false) {
	const user = kind === 'anonymous' ? null : { id: kind, isSuspended: kind === 'suspended' };
	const roles = [{ isModerator: ['moderator', 'app', 'flash'].includes(kind), isAdministrator: kind === 'admin' }];
	const token = kind === 'app' ? { id: 'app', permission: ['write:admin:resolve-abuse-user-report'] } : null;
	const flashToken = kind === 'flash' ? { permissions: ['write:admin:resolve-abuse-user-report'] } : null;
	const rate = { limit: vi.fn().mockResolvedValue(exhausted ? { info: { resetMs: Date.now() + 1000 } } : null) };
	const service = new ApiCallService(
		{ enableIpLogging: false, rootUserId: 'root' } as never, {} as never, {} as never,
		{ authenticate: vi.fn().mockResolvedValue([user, token, flashToken]) } as never,
		rate as never,
		{ getUserPolicies: vi.fn().mockResolvedValue({ rateLimitFactor: 1 }), getUserRoles: vi.fn().mockResolvedValue(roles) } as never,
		{ logger: { warn: vi.fn(), write: vi.fn() } } as never,
		{ startSpan: vi.fn((_name: string, callback: () => unknown) => callback()), captureMessage: vi.fn() } as never,
	);
	return { service, rate, reply: { code: vi.fn(), header: vi.fn(), send: vi.fn() } };
}

for (const definition of endpoints) {
	describe(`real API guards: moderation/${definition.name}`, () => {
		const expected = [
			['anonymous', 'ACCESS_DENIED'], ['member', 'ROLE_PERMISSION_DENIED'], ['app', 'ACCESS_DENIED'], ['flash', 'ACCESS_DENIED'], ['suspended', 'YOUR_ACCOUNT_SUSPENDED'],
		] as const;
		test.each(expected)('blocks %s before the endpoint executor', async (kind, error) => {
			const f = harness(kind), exec = vi.fn().mockResolvedValue({});
			try {
				await f.service.handleRequest({ name: `hata/hatady/admin/moderation/${definition.name}`, meta: definition.meta, params: definition.params, exec } as never, { method: 'POST', body: definition.payload, headers: {}, ip: '127.0.0.1' } as never, f.reply as never);
				expect(exec).not.toHaveBeenCalled();
				expect(f.reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: error }) }));
			} finally { f.service.dispose(); }
		});
		test.each(['moderator', 'admin', 'root'] as const)('allows first-party %s and consumes its endpoint rate limit', async kind => {
			const f = harness(kind);
			const method = vi.fn().mockResolvedValue({ ok: true });
			const endpoint = new definition.ctor({ list: method, show: method, review: method } as never);
			try {
				await f.service.handleRequest({ name: `hata/hatady/admin/moderation/${definition.name}`, meta: definition.meta, params: definition.params, exec: endpoint.exec } as never, { method: 'POST', body: { ...definition.payload }, headers: {}, ip: '127.0.0.1' } as never, f.reply as never);
				expect(method).toHaveBeenCalledOnce();
				expect(f.reply.send).toHaveBeenCalledWith({ ok: true });
				expect(f.rate.limit).toHaveBeenCalledWith({ ...definition.meta.limit, key: `hata/hatady/admin/moderation/${definition.name}` }, kind, 1);
			} finally { f.service.dispose(); }
		});
		test('rate-limit exhaustion prevents execution', async () => {
			const f = harness('moderator', true), exec = vi.fn();
			try {
				await f.service.handleRequest({ name: `hata/hatady/admin/moderation/${definition.name}`, meta: definition.meta, params: definition.params, exec } as never, { method: 'POST', body: definition.payload, headers: {}, ip: '127.0.0.1' } as never, f.reply as never);
				expect(exec).not.toHaveBeenCalled();
				expect(f.reply.code).toHaveBeenCalledWith(429);
			} finally { f.service.dispose(); }
		});
	});
}

describe('moderation endpoint validators', () => {
	test('rejects oversized page, invalid type, oversized note and missing optimistic tokens', async () => {
		const service = { list: vi.fn(), show: vi.fn(), review: vi.fn() };
		const user = { id: 'staff' } as never;
		await expect(new ListEndpoint(service as never).exec({ limit: 51 }, user, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(new ShowEndpoint(service as never).exec({ ...target, targetType: 'user' }, user, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(new ReviewEndpoint(service as never).exec({ ...review, note: 'あ'.repeat(1001) }, user, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(new ReviewEndpoint(service as never).exec({ ...target, state: 'reviewed', note: '' }, user, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(service.list).not.toHaveBeenCalled();
		expect(service.show).not.toHaveBeenCalled();
		expect(service.review).not.toHaveBeenCalled();
	});
	test('returns explicit content/review conflicts without discarding the submitted note', async () => {
		const save = vi.fn().mockRejectedValue(new Error('REVIEW_CONFLICT'));
		const endpoint = new ReviewEndpoint({ review: save } as never);
		const payload = { ...review, note: 'keep this input' };
		await expect(endpoint.exec(payload, { id: 'staff' } as never, null, null)).rejects.toMatchObject({ code: 'REVIEW_CONFLICT', httpStatusCode: 409 });
		expect(payload.note).toBe('keep this input');
	});
});
