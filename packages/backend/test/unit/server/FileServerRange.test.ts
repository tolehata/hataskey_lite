/* SPDX-License-Identifier: AGPL-3.0-only */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { handleRangeRequest } from '@/server/file/FileServerUtils.js';

const data = Buffer.from('0123456789');
let directory: string;
const server = Fastify();

beforeAll(async () => {
	directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hataskey-range-'));
	fs.writeFileSync(path.join(directory, 'data'), data);
	fs.writeFileSync(path.join(directory, 'empty'), '');
	server.get('/data', (request, reply) => handleRangeRequest(reply, request.headers.range, data.length, path.join(directory, 'data')));
	server.get('/empty', (request, reply) => handleRangeRequest(reply, request.headers.range, 0, path.join(directory, 'empty')));
	await server.ready();
});

afterAll(async () => {
	await server.close();
	fs.rmSync(directory, { recursive: true, force: true });
});

describe('drive file byte range responses', () => {
	test.each([
		['bytes=0-2', '012', 'bytes 0-2/10'],
		['bytes=7-', '789', 'bytes 7-9/10'],
		['bytes=-3', '789', 'bytes 7-9/10'],
		['bytes=-30', '0123456789', 'bytes 0-9/10'],
		['bytes=7-9999999999999999999999', '789', 'bytes 7-9/10'],
	])('serves %s with matching data and headers', async (range, body, contentRange) => {
		const response = await server.inject({ url: '/data', headers: { range } });
		expect(response.statusCode).toBe(206);
		expect(response.body).toBe(body);
		expect(response.headers['content-range']).toBe(contentRange);
		expect(response.headers['content-length']).toBe(String(body.length));
		expect(response.headers['accept-ranges']).toBe('bytes');
	});

	test.each(['bytes=10-', 'bytes=20-30', 'bytes=-0', 'bytes=3-2', 'bytes=9999999999999999999999-'])('returns an empty 416 for %s without opening an invalid stream', async range => {
		const response = await server.inject({ url: '/data', headers: { range } });
		expect(response.statusCode).toBe(416);
		expect(response.headers['content-range']).toBe('bytes */10');
		expect(response.headers['content-length']).toBe('0');
		expect(response.body).toBe('');
	});

	test.each(['items=0-2', 'bytes=abc-2', 'bytes=', 'bytes=0-1,5-6'])('ignores unsupported or malformed range %s', async range => {
		const response = await server.inject({ url: '/data', headers: { range } });
		expect(response.statusCode).toBe(200);
		expect(response.rawPayload).toEqual(data);
		expect(response.headers['content-length']).toBe('10');
		expect(response.headers['content-range']).toBeUndefined();
	});

	test.each(['bytes=0-', 'bytes=-3'])('ignores %s on an empty file', async range => {
		const response = await server.inject({ url: '/empty', headers: { range } });
		expect(response.statusCode).toBe(200);
		expect(response.headers['content-range']).toBeUndefined();
		expect(response.headers['content-length']).toBe('0');
		expect(response.body).toBe('');
	});

	test('a full empty response remains successful', async () => {
		const response = await server.inject({ url: '/empty' });
		expect(response.statusCode).toBe(200);
		expect(response.headers['content-length']).toBe('0');
		expect(response.body).toBe('');
	});
});
