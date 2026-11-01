/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { FileServerService } from '@/server/FileServerService.js';
import type { FastifyInstance } from 'fastify';

// Exercise the real route and file stream without a DB, remote fetch or listening socket.
// These bytes test HTTP framing, not video decoding.
const videoBytes = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
const thumbnailBytes = Buffer.from('thumbnail');
let directory: string;
let filePath: string;
let server: FastifyInstance;
let fileRole: 'webpublic' | 'thumbnail';
let thumbnailIsStream: boolean;
let cleanup: ReturnType<typeof vi.fn>;

beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), 'hataskey-file-range-'));
	filePath = join(directory, 'video.mp4');
	await writeFile(filePath, videoBytes);
});

afterAll(async () => {
	await rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
	fileRole = 'webpublic';
	thumbnailIsStream = false;
	cleanup = vi.fn();
	const service = new FileServerService(
		{ url: 'https://example.test', mediaProxy: 'https://example.test/proxy' } as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{
			getExternalVideoThumbnailUrl: () => null,
			generateVideoThumbnail: async () => ({
				data: thumbnailIsStream ? Readable.from(thumbnailBytes) : thumbnailBytes,
				ext: 'webp',
				type: 'image/webp',
			}),
		} as never,
		{} as never,
		{ getLogger: () => ({ error: vi.fn() }) } as never,
		{ eval: vi.fn().mockResolvedValue(1) } as never,
	);
	vi.spyOn(service as unknown as { getFileFromKey(key: string): Promise<unknown> }, 'getFileFromKey').mockImplementation(async () => ({
		state: 'remote', fileRole, file: { size: videoBytes.length },
		filename: 'video.mp4', url: 'https://remote.example.test/video.mp4',
		mime: 'video/mp4', ext: 'mp4', path: filePath, cleanup,
	}));
	server = Fastify();
	await server.register(service.createServer);
});

afterEach(async () => {
	await server.close();
});

describe('remote video response length', () => {
	test('全体取得では全バイトと一致する Content-Length を返す', async () => {
		const response = await server.inject({ method: 'GET', url: '/files/webpublic-test' });
		expect(response.statusCode).toBe(200);
		expect(response.headers['content-type']).toBe('video/mp4');
		expect(response.headers['content-length']).toBe(String(videoBytes.length));
		expect(response.rawPayload).toEqual(videoBytes);
		expect(cleanup).toHaveBeenCalled();
	});

	test.each([
		['bytes=0-1', 0, 1],
		['bytes=5-12', 5, 12],
		['bytes=5-', 5, videoBytes.length - 1],
		['bytes=0-', 0, videoBytes.length - 1],
		[`bytes=0-${videoBytes.length}`, 0, videoBytes.length - 1],
		[`bytes=0-${videoBytes.length + 100}`, 0, videoBytes.length - 1],
	] as const)('%s の本文長と Content-Length が一致する', async (range, start, end) => {
		const response = await server.inject({ method: 'GET', url: '/files/webpublic-test', headers: { range } });
		expect(response.statusCode).toBe(206);
		expect(response.headers['content-range']).toBe(`bytes ${start}-${end}/${videoBytes.length}`);
		expect(response.headers['accept-ranges']).toBe('bytes');
		expect(response.headers['content-length']).toBe(String(end - start + 1));
		expect(response.rawPayload).toEqual(videoBytes.subarray(start, end + 1));
		expect(response.rawPayload.length).toBe(Number(response.headers['content-length']));
		expect(cleanup).toHaveBeenCalled();
	});

	test.each([false, true])('動画サムネイルに元動画の長さを指定しない (stream=%s)', async (stream) => {
		fileRole = 'thumbnail';
		thumbnailIsStream = stream;
		const response = await server.inject({ method: 'GET', url: '/files/thumbnail-test' });
		expect(response.statusCode).toBe(200);
		expect(response.headers['content-type']).toBe('image/webp');
		expect(response.rawPayload).toEqual(thumbnailBytes);
		if (response.headers['content-length'] != null) {
			expect(Number(response.headers['content-length'])).toBe(thumbnailBytes.length);
		}
		expect(cleanup).toHaveBeenCalled();
	});
});
