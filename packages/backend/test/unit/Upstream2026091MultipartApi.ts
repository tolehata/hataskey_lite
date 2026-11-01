/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import { AuthenticationError } from '@/server/api/AuthenticateService.js';
import { LOCAL_DRIVE_UPLOAD_BUDGET } from '@/misc/resource-budget.js';

const createTemp = vi.hoisted(() => vi.fn());
vi.mock('@/misc/create-temp.js', () => ({ createTemp }));

const temporaryDirectories: string[] = [];
let service: ApiCallService;
let authenticate: ReturnType<typeof vi.fn>;

function reply() {
	return { code: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}

function request(file: Readable & { truncated?: boolean }, fields: Record<string, unknown> = {}) {
	return {
		method: 'POST',
		file: vi.fn().mockResolvedValue({ file, fields, filename: 'upload.txt' }),
		headers: {},
		ip: '127.0.0.1',
	};
}

function endpoint(exec = vi.fn().mockResolvedValue({ ok: true })) {
	return { name: 'drive/files/create', meta: { requireFile: true }, params: { properties: {} }, exec };
}

async function tempPath(destinationIsDirectory = false) {
	const directory = await mkdtemp(join(tmpdir(), 'hataskey-multipart-api-'));
	temporaryDirectories.push(directory);
	const path = join(directory, 'upload');
	if (destinationIsDirectory) {
		const { mkdir } = await import('node:fs/promises');
		await mkdir(path);
	}
	const cleanup = vi.fn(() => rmSync(path, { recursive: true, force: true }));
	createTemp.mockResolvedValueOnce([path, cleanup]);
	return { path, cleanup };
}

beforeEach(() => {
	createTemp.mockReset();
	authenticate = vi.fn().mockResolvedValue([null, null, null]);
	service = new ApiCallService(
		{ rootUserId: 'root', enableIpLogging: false } as never,
		{ maxFileSize: 1024 } as never,
		{} as never,
		{ authenticate } as never,
		{ limit: vi.fn() } as never,
		{ getUserRoles: vi.fn(), getUserPolicies: vi.fn().mockResolvedValue({ maxFileSizeMb: 1, rateLimitFactor: 1 }), isModerator: vi.fn().mockResolvedValue(false) } as never,
		{ logger: { debug: vi.fn(), warn: vi.fn(), write: vi.fn() } } as never,
		{ startSpan: (_name: string, callback: () => unknown) => callback(), captureMessage: vi.fn() } as never,
		{ eval: vi.fn().mockResolvedValue(1) } as never,
	);
});

afterEach(async () => {
	service.dispose();
	await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('multipart API request lifecycle', () => {
	test('maps a client read failure to 400 and never calls the endpoint', async () => {
		const { path, cleanup } = await tempPath();
		const file = new PassThrough();
		file.on('error', () => {});
		file.destroy(new Error('client disconnected'));
		const ep = endpoint();
		const response = reply();

		await service.handleMultipartRequest(ep as never, request(file) as never, response as never);

		expect(response.code).toHaveBeenCalledWith(400);
		expect(response.send).toHaveBeenCalledOnce();
		expect(ep.exec).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(existsSync(path)).toBe(false);
	});

	test('maps a truncated part to 413 after reading and cleans up', async () => {
		const { path, cleanup } = await tempPath();
		const file = Object.assign(Readable.from(['too large']), { truncated: true });
		const ep = endpoint();
		const response = reply();

		await service.handleMultipartRequest(ep as never, request(file) as never, response as never);

		expect(response.code).toHaveBeenCalledWith(413);
		expect(response.send).toHaveBeenCalledOnce();
		expect(ep.exec).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(existsSync(path)).toBe(false);
	});

	test('keeps the upload readable until the endpoint completes, then cleans up', async () => {
		const { path, cleanup } = await tempPath();
		let release!: () => void;
		let reached!: () => void;
		const endpointReached = new Promise<void>(resolve => { reached = resolve; });
		const endpointReleased = new Promise<void>(resolve => { release = resolve; });
		const exec = vi.fn(async (_data, _user, _token, _flashToken, upload) => {
			expect(upload).toEqual({ name: 'upload.txt', path });
			expect(await readFile(upload.path, 'utf8')).toBe('complete upload');
			reached();
			await endpointReleased;
			return { ok: true };
		});
		const response = reply();
		const handling = service.handleMultipartRequest(
			endpoint(exec) as never,
			request(Readable.from(['complete upload']), { title: { value: 'a title' }, i: { value: 'token' } }) as never,
			response as never,
		);

		await endpointReached;
		expect(existsSync(path)).toBe(true);
		expect(cleanup).not.toHaveBeenCalled();
		expect(response.send).not.toHaveBeenCalled();
		release();
		await handling;

		expect(authenticate).toHaveBeenCalledWith('token');
		expect(exec.mock.calls[0][0]).toEqual({ title: 'a title' });
		expect(response.send).toHaveBeenCalledWith({ ok: true });
		expect(cleanup).toHaveBeenCalledOnce();
		expect(existsSync(path)).toBe(false);
	});

	test('propagates a destination write failure without calling the endpoint', async () => {
		const { path, cleanup } = await tempPath(true);
		const ep = endpoint();
		const response = reply();

		await expect(service.handleMultipartRequest(ep as never, request(Readable.from(['upload'])) as never, response as never))
			.rejects.toMatchObject({ code: 'EISDIR' });

		expect(ep.exec).not.toHaveBeenCalled();
		expect(response.send).not.toHaveBeenCalled();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(existsSync(path)).toBe(false);
	});
});

describe('multipart admission precedes persistence', () => {
	test('rejects an invalid bearer before parsing or creating a temporary file', async () => {
		authenticate.mockRejectedValueOnce(new AuthenticationError('Invalid token'));
		const input = { ...request(Readable.from(['attacker bytes'])), headers: { authorization: 'Bearer invalid' } };
		const response = reply();
		await service.handleMultipartRequest(endpoint() as never, input as never, response as never);
		expect(response.code).toHaveBeenCalledWith(401);
		expect(input.file).not.toHaveBeenCalled();
		expect(createTemp).not.toHaveBeenCalled();
	});

	test('rejects a missing pre-file body credential without persisting its file', async () => {
		const ep = { ...endpoint(), meta: { requireFile: true, requireCredential: true } };
		const response = reply();
		await service.handleMultipartRequest(ep as never, request(Readable.from(['large anonymous body'])) as never, response as never);
		expect(response.code).toHaveBeenCalledWith(401);
		expect(createTemp).not.toHaveBeenCalled();
	});

	test('rejects an authenticated token missing the upload scope before persistence', async () => {
		authenticate.mockResolvedValueOnce([{ id: 'user', isSuspended: false }, { permission: [] }, null]);
		const ep = { ...endpoint(), meta: { requireFile: true, requireCredential: true, kind: 'write:drive' } };
		const input = { ...request(Readable.from(['bytes'])), headers: { authorization: 'Bearer valid-but-read-only' } };
		const response = reply();
		await service.handleMultipartRequest(ep as never, input as never, response as never);
		expect(response.code).toHaveBeenCalledWith(403);
		expect(input.file).not.toHaveBeenCalled();
		expect(createTemp).not.toHaveBeenCalled();
	});

	test('an admitted pre-file body token still uploads and releases both reservations', async () => {
		await tempPath();
		authenticate.mockResolvedValueOnce([{ id: 'user', isSuspended: false }, null, null]);
		const ep = { ...endpoint(), meta: { requireFile: true, requireCredential: true, kind: 'write:drive' } };
		const response = reply();
		await service.handleMultipartRequest(ep as never, request(Readable.from(['file']), { i: { value: 'valid' } }) as never, response as never);
		expect(authenticate).toHaveBeenCalledWith('valid');
		expect(ep.exec).toHaveBeenCalledOnce();
		expect(response.send).toHaveBeenCalledWith({ ok: true });
		// The file itself is reserved from the local-user pool, never the federation ingest pool.
		const admissions = (service as unknown as { redisClient: { eval: ReturnType<typeof vi.fn> } }).redisClient.eval.mock.calls.filter(call => call[1] === 4);
		expect(admissions.map(call => call[2])).toEqual(['resource-budget:{multipart-ingress}:active', `resource-budget:{${LOCAL_DRIVE_UPLOAD_BUDGET.name}}:active`]);
		expect(admissions[1][4]).toBe(`resource-budget:{${LOCAL_DRIVE_UPLOAD_BUDGET.name}}:actor:${createHash('sha256').update('user').digest('hex')}`);
		expect(admissions[1].slice(8, 13)).toEqual([LOCAL_DRIVE_UPLOAD_BUDGET.concurrency, LOCAL_DRIVE_UPLOAD_BUDGET.actorConcurrency, 1024, LOCAL_DRIVE_UPLOAD_BUDGET.concurrency * 1024, LOCAL_DRIVE_UPLOAD_BUDGET.requestsPerMinute]);
	});
});
