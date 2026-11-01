/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import { ApiError } from '@/server/api/error.js';
import { registrationReviewErrors } from '@/core/registration-review-policy.js';
import { meta as applyMeta } from '@/server/api/endpoints/registration/apply.js';
import { meta as listMeta } from '@/server/api/endpoints/admin/registration-applications.js';
import { meta as voteMeta } from '@/server/api/endpoints/admin/vote-registration.js';
import { meta as approveMeta } from '@/server/api/endpoints/admin/approve-registration.js';
import { meta as rejectMeta } from '@/server/api/endpoints/admin/reject-registration.js';
import { meta as cleanupMeta } from '@/server/api/endpoints/admin/cleanup-legacy-rejected-registrations.js';
import { meta as hatagoesSearchMeta } from '@/server/api/endpoints/hata/hatagoes/search.js';
import Logger from '@/logger.js';
import { envOption } from '@/env.js';
import { logManager } from '@/logging/logging-runtime.js';
import { PrettyConsoleBackend } from '@/logging/PrettyConsoleBackend.js';
import type { LogBackend } from '@/logging/LogBackend.js';
import type { LogRecord } from '@/logging/types.js';
import type { IEndpointMeta } from '@/server/api/endpoints.js';

const registrationEndpoints: { name: string; meta: IEndpointMeta; allowed: string[] }[] = [
	{ name: 'registration/apply', meta: applyMeta, allowed: ['anonymous', 'app', 'flash', 'ordinary', 'moderator', 'administrator', 'root'] },
	{ name: 'admin/registration-applications', meta: listMeta, allowed: ['moderator', 'administrator', 'root'] },
	{ name: 'admin/vote-registration', meta: voteMeta, allowed: ['moderator', 'administrator', 'root'] },
	{ name: 'admin/approve-registration', meta: approveMeta, allowed: ['administrator', 'root'] },
	{ name: 'admin/reject-registration', meta: rejectMeta, allowed: ['administrator', 'root'] },
	{ name: 'admin/cleanup-legacy-rejected-registrations', meta: cleanupMeta, allowed: ['administrator', 'root'] },
];

/** API失敗ログを確認するための最小Fastify応答を作成します。 */
function createReply() {
	return {
		code: vi.fn(),
		header: vi.fn(),
		send: vi.fn(),
	};
}

/** APIサービスの依存関係を最小限の仮実装へ差し替えます。 */
function createService() {
	const authenticateService = {
		authenticate: vi.fn().mockResolvedValue([null, null]),
	};
	const telemetryService = {
		startSpan: vi.fn((_name: string, callback: () => unknown) => callback()),
		captureMessage: vi.fn(),
	};
	const apiLoggerService = { logger: new Logger('api') };
	const rateLimiterService = { limit: vi.fn().mockResolvedValue(null) };
	const roleService = {
		getUserRoles: vi.fn().mockResolvedValue([]),
		getUserPolicies: vi.fn().mockResolvedValue({ rateLimitFactor: 1 }),
	};

	const service = new ApiCallService(
		{ rootUserId: 'root', enableIpLogging: false } as never,
		{} as never,
		{} as never,
		authenticateService as never,
		rateLimiterService as never,
		roleService as never,
		apiLoggerService as never,
		telemetryService as never,
	);
	return { service, telemetryService, authenticateService, roleService };
}

describe('HataGoes native Registry search authorization', () => {
	test.each(['native', 'app', 'flash', 'anonymous'])('%s credentials cannot escape their Registry domain', async actor => {
		const { service, authenticateService } = createService();
		try {
			const user = actor === 'anonymous' ? null : { id: 'owner', isSuspended: false };
			authenticateService.authenticate.mockResolvedValue([user,
				actor === 'app' ? { permission: ['read:account'] } : null,
				actor === 'flash' ? { permissions: ['read:account'] } : null,
			]);
			const endpoint = { name: 'hata/hatagoes/search', meta: hatagoesSearchMeta, params: {}, exec: vi.fn().mockResolvedValue({ items: ['private-record'] }) };
			const reply = createReply();
			await service.handleRequest(endpoint as never, { method: 'POST', body: { i: 'credential', query: 'memo' }, query: {}, headers: {}, ip: '127.0.0.1' } as never, reply as never);
			if (actor === 'native') {
				expect(endpoint.exec).toHaveBeenCalledOnce();
				expect(reply.send).toHaveBeenCalledWith({ items: ['private-record'] });
			} else {
				expect(endpoint.exec).not.toHaveBeenCalled();
				expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'ACCESS_DENIED' }) }));
			}
		} finally { service.dispose(); }
	});
});

describe('ApiCallService structured error logging', () => {
	test.each(['hata/emoji-vote/show', 'hata/emoji-vote/vote'])('keeps diagnostics but no vote content for %s', async name => {
		const write = vi.fn<LogBackend['write']>();
		logManager.setBackend({ write });
		const previousQuiet = envOption.quiet;
		envOption.quiet = false;
		const { service, telemetryService } = createService();
		try {
			const secret = 'private-vote-sentinel';
			const error = Object.assign(new Error(secret), { name: secret, parameters: [secret], query: secret });
			const endpoint = { name, meta: {}, params: {}, exec: vi.fn().mockRejectedValue(error) };
			const request = { method: 'POST', body: { roundId: secret, emojiId: secret }, query: {}, headers: {}, ip: '127.0.0.1' };
			await service.handleRequest(endpoint as never, request as never, createReply() as never);
			const record = write.mock.calls[0][0] as LogRecord;
			expect(record).toMatchObject({ eventName: 'api.endpoint.failed', attributes: { 'api.endpoint': name }, error: { type: 'Error', message: 'Ephemeral emoji vote operation failed' } });
			expect(record.attributes).not.toHaveProperty('api.params');
			expect(JSON.stringify(write.mock.calls)).not.toContain(secret);
			expect(JSON.stringify(telemetryService.captureMessage.mock.calls)).not.toContain(secret);
			expect(telemetryService.captureMessage.mock.calls[0][1]).not.toHaveProperty('userId');
		} finally {
			service.dispose();
			envOption.quiet = previousQuiet;
			logManager.setBackend(new PrettyConsoleBackend({ output: () => undefined }));
		}
	});

	test('removes API credentials and serializes the endpoint error', async () => {
		const write = vi.fn<LogBackend['write']>();
		logManager.setBackend({ write });
		const previousQuiet = envOption.quiet;
		envOption.quiet = false;
		const { service, telemetryService } = createService();
		try {
			const reply = createReply();
			const endpoint = {
				name: 'notes/show',
				meta: {},
				params: {},
				exec: vi.fn().mockRejectedValue(new TypeError('broken endpoint')),
			};
			const request = {
				method: 'POST',
				body: {
					i: 'native-token',
					password: 'password',
					options: { visible: true },
				},
				query: {},
				headers: {},
				ip: '127.0.0.1',
			};

			await service.handleRequest(endpoint as never, request as never, reply as never);

			const record = write.mock.calls[0][0] as LogRecord;
			expect(record).toMatchObject({
				eventName: 'api.endpoint.failed',
				attributes: {
					'api.endpoint': 'notes/show',
					'api.params': {
						password: '[REDACTED]',
						options: { visible: true },
					},
				},
				error: { type: 'TypeError', message: 'broken endpoint' },
			});
			expect(record.attributes?.['api.params']).not.toHaveProperty('i');
			expect(record.attributes?.['error.id']).toEqual(expect.any(String));
			expect(telemetryService.captureMessage.mock.calls[0][1].extra).not.toHaveProperty('ps');
		} finally {
			service.dispose();
			envOption.quiet = previousQuiet;
			logManager.setBackend(new PrettyConsoleBackend({ output: () => undefined }));
		}
	});

	test('uses i only for authentication and excludes it from endpoint params', async () => {
		const { service } = createService();
		try {
			const endpoint = {
				name: 'hata/hatask/emotion-analysis/create',
				meta: {},
				params: {},
				exec: vi.fn().mockResolvedValue({ ok: true }),
			};
			const body = { i: 'native-token', analysisVersion: '1.1.0' };
			const request = { method: 'POST', body, query: {}, headers: {}, ip: '127.0.0.1' };

			await service.handleRequest(endpoint as never, request as never, createReply() as never);

			expect(endpoint.exec).toHaveBeenCalledWith(
				{ analysisVersion: '1.1.0' },
				null,
				null,
				undefined,
				null,
				'127.0.0.1',
				{},
			);
			expect(body).toEqual({ i: 'native-token', analysisVersion: '1.1.0' });
		} finally {
			service.dispose();
		}
	});
});

describe('ApiCallService registration application privacy', () => {
	test.each(registrationEndpoints.flatMap(endpoint => ['QueryFailedError', 'private-registration-sentinel'].map(errorName => ({ ...endpoint, errorName }))))(
		'hides application data from logs, telemetry and responses for $name ($errorName)', async ({ name, meta, errorName }) => {
			const write = vi.fn<LogBackend['write']>();
			logManager.setBackend({ write });
			const previousQuiet = envOption.quiet;
			envOption.quiet = false;
			const { service, telemetryService, authenticateService, roleService } = createService();
			try {
				const secret = 'private-registration-sentinel';
				const error = Object.assign(new Error(secret), {
					name: errorName,
					query: `SELECT '${secret}'`,
					parameters: [secret],
					detail: secret,
					cause: new Error(secret),
					stack: `${errorName}: ${secret}\n    at ${secret} (${secret}:1:1)`,
				});
				const reply = createReply();
				const endpoint = { name, meta, params: {}, exec: vi.fn().mockRejectedValue(error) };
				const request = { method: 'POST', body: { i: secret, reason: secret, email: secret, additionalContacts: secret }, query: {}, headers: {}, ip: '127.0.0.1' };
				authenticateService.authenticate.mockResolvedValue([{ id: secret, isSuspended: false }, null, null]);
				roleService.getUserRoles.mockResolvedValue([{ isAdministrator: true }]);

				// The positive control includes both raw request data and a stack frame that the LTL filter would retain.
				expect(JSON.stringify({ error, request })).toContain(secret);
				expect(error.stack).toContain(`    at ${secret}`);
				await service.handleRequest(endpoint as never, request as never, reply as never);

				expect(endpoint.exec).toHaveBeenCalledOnce();
				expect(write).toHaveBeenCalledOnce();
				expect(telemetryService.captureMessage).toHaveBeenCalledOnce();
				expect(reply.send).toHaveBeenCalledOnce();
				const record = write.mock.calls[0][0] as LogRecord;
				const diagnosticType = errorName === 'QueryFailedError' ? errorName : 'Error';
				expect(record).toMatchObject({
					eventName: 'api.endpoint.failed',
					attributes: { 'api.endpoint': name, 'error.id': expect.any(String) },
					error: { type: diagnosticType, message: 'Registration application operation failed' },
				});
				expect(record.attributes).not.toHaveProperty('api.params');
				expect(telemetryService.captureMessage.mock.calls[0][1]).not.toHaveProperty('userId');
				expect(reply.code).toHaveBeenCalledWith(500);
				expect(reply.send.mock.calls[0][0]).toMatchObject({ error: {
					code: 'INTERNAL_ERROR',
					info: { e: { code: diagnosticType, message: 'Registration application operation failed', id: record.attributes?.['error.id'] } },
				} });
				expect(JSON.stringify(write.mock.calls)).not.toContain(secret);
				expect(JSON.stringify(telemetryService.captureMessage.mock.calls)).not.toContain(secret);
				expect(JSON.stringify(reply.send.mock.calls)).not.toContain(secret);
			} finally {
				service.dispose();
				envOption.quiet = previousQuiet;
				logManager.setBackend(new PrettyConsoleBackend({ output: () => undefined }));
			}
		},
	);

	test.each(Object.values(registrationReviewErrors))('preserves the actionable $code API error', async error => {
		const { service, telemetryService, authenticateService, roleService } = createService();
		try {
			authenticateService.authenticate.mockResolvedValue([{ id: 'moderator', isSuspended: false }, null, null]);
			roleService.getUserRoles.mockResolvedValue([{ isModerator: true }]);
			const endpoint = { name: 'admin/vote-registration', meta: voteMeta, params: {}, exec: vi.fn().mockRejectedValue(new ApiError(error)) };
			const reply = createReply();
			await service.handleRequest(endpoint as never, { method: 'POST', body: {}, query: {}, headers: {}, ip: '127.0.0.1' } as never, reply as never);
			expect(endpoint.exec).toHaveBeenCalledOnce();
			expect(reply.send.mock.calls[0][0]).toMatchObject({ error });
			expect(telemetryService.captureMessage).not.toHaveBeenCalled();
		} finally {
			service.dispose();
		}
	});
});

describe('ApiCallService registration application gateway authorization', () => {
	const actors = ['anonymous', 'app', 'flash', 'ordinary', 'moderator', 'administrator', 'root'];

	// Gateway checks use the production metadata; root-only finalization and root voting restrictions
	// are additionally enforced by RegistrationApplicationReviewService inside the endpoint.
	test.each(registrationEndpoints.flatMap(endpoint => actors.map(actor => ({ ...endpoint, actor }))))(
		'enforces the native credential and staff gate for $actor on $name', async ({ name, meta, allowed, actor }) => {
			const { service, authenticateService, roleService, telemetryService } = createService();
			try {
				const user = actor === 'anonymous' ? null : { id: actor === 'root' ? 'root' : 'staff-or-user', isSuspended: false };
				const permissions = meta.kind == null ? [] : [meta.kind];
				const appToken = actor === 'app' ? { permission: permissions } : null;
				const flashToken = actor === 'flash' ? { permissions } : null;
				authenticateService.authenticate.mockResolvedValue([user, appToken, flashToken]);
				roleService.getUserRoles.mockResolvedValue(actor === 'moderator' ? [{ isModerator: true }]
					: ['administrator', 'app', 'flash'].includes(actor) ? [{ isAdministrator: true }] : []);
				const endpoint = { name, meta, params: {}, exec: vi.fn().mockResolvedValue({ ok: true }) };
				const reply = createReply();
				await service.handleRequest(endpoint as never, {
					method: 'POST', body: { i: 'credential', applicationId: 'application', revision: 'a'.repeat(64) }, query: {}, headers: {}, ip: '127.0.0.1',
				} as never, reply as never);

				expect(authenticateService.authenticate).toHaveBeenCalledWith('credential');
				expect(reply.send).toHaveBeenCalledOnce();
				if (allowed.includes(actor)) {
					expect(endpoint.exec).toHaveBeenCalledOnce();
					expect(endpoint.exec.mock.calls[0][0]).not.toHaveProperty('i');
					expect(endpoint.exec.mock.calls[0][1]).toEqual(user);
					expect(reply.send).toHaveBeenCalledWith({ ok: true });
				} else {
					expect(endpoint.exec).not.toHaveBeenCalled();
					expect(reply.send.mock.calls[0][0]).toMatchObject({ error: {
						code: ['anonymous', 'app', 'flash'].includes(actor) ? 'ACCESS_DENIED' : 'ROLE_PERMISSION_DENIED',
					} });
				}
				expect(telemetryService.captureMessage).not.toHaveBeenCalled();
			} finally {
				service.dispose();
			}
		},
	);
});
