/* SPDX-License-Identifier: AGPL-3.0-only */
import { mkdtemp, writeFile, rm, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FileServerService } from '@/server/FileServerService.js';
import { StatusError } from '@/misc/status-error.js';
import { MEDIA_DOWNLOAD_BUDGET, MEDIA_PROCESSING_BUDGET } from '@/misc/resource-budget.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

function setup(admit = 1) {
	const redis = { eval: vi.fn().mockResolvedValue(admit) };
	const service = new FileServerService({ maxFileSize: 250 * 1024 * 1024 } as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
		{ getLogger: () => ({ error: vi.fn() }) } as never, redis as never);
	return { service: service as any, redis };
}

function bitmap(width: number, height: number, icon = false): Buffer {
	const data = Buffer.alloc(40 + width * height * 4, 255);
	data.fill(0, 0, 40);
	data.writeUInt32LE(40, 0);
	data.writeInt32LE(width, 4);
	data.writeInt32LE(icon ? height * 2 : height, 8);
	data.writeUInt16LE(1, 12);
	data.writeUInt16LE(32, 14);
	return data;
}

function icon(data: Buffer, width = 16, height = 16, count = 1): Buffer {
	const directory = Buffer.alloc(6 + count * 16);
	directory.writeUInt16LE(1, 2);
	directory.writeUInt16LE(count, 4);
	for (let index = 0; index < count; index++) {
		const entry = 6 + index * 16;
		directory[entry] = width === 256 ? 0 : width;
		directory[entry + 1] = height === 256 ? 0 : height;
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(data.length, entry + 8);
		directory.writeUInt32LE(directory.length, entry + 12);
	}
	return Buffer.concat([directory, data]);
}

async function temporaryImage(data: Buffer): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'hataskey-bitmap-budget-'));
	directories.push(directory);
	const path = join(directory, 'image');
	await writeFile(path, data);
	return path;
}

describe('media parser and response admission', () => {
	test('rejects an oversized BMP before the JavaScript bitmap decoder allocates pixels', async () => {
		const { service } = setup();
		const directory = await mkdtemp(join(tmpdir(), 'hataskey-media-budget-'));
		directories.push(directory);
		const bmp = Buffer.alloc(54);
		bmp.write('BM'); bmp.writeUInt32LE(54, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
		bmp.writeInt32LE(100000, 18); bmp.writeInt32LE(100000, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
		const path = join(directory, 'large.bmp');
		await writeFile(path, bmp);
		await expect(service.openProxyImage(path, 'image/bmp')).rejects.toMatchObject({ statusCode: 413 });
	});

	test('rejects ICO inner bitmap dimensions hidden behind a small directory entry', async () => {
		const { service } = setup();
		const data = bitmap(16, 16, true);
		data.writeInt32LE(100000, 4);
		data.writeInt32LE(200000, 8);
		const path = await temporaryImage(icon(data));
		await expect(service.openProxyImage(path, 'image/x-icon')).rejects.toMatchObject({ statusCode: 413 });
	});

	test('rejects duplicate ICO entries before their shared bitmap is decoded repeatedly', async () => {
		const { service } = setup();
		const path = await temporaryImage(icon(bitmap(16, 16, true), 16, 16, 65));
		await expect(service.openProxyImage(path, 'image/vnd.microsoft.icon')).rejects.toMatchObject({ statusCode: 413 });
	});

	test.each(['bmp', 'ico-bitmap', 'ico-png'])('ordinary %s still decodes and transforms', async (format) => {
		const { service } = setup();
		let data: Buffer;
		if (format === 'bmp') {
			const header = Buffer.alloc(14);
			header.write('BM');
			header.writeUInt32LE(54 + 16 * 16 * 4, 2);
			header.writeUInt32LE(54, 10);
			data = Buffer.concat([header, bitmap(16, 16)]);
		} else if (format === 'ico-bitmap') {
			data = icon(bitmap(16, 16, true));
		} else {
			data = icon(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#ff0000' } }).png().toBuffer());
		}
		const image = await service.openProxyImage(await temporaryImage(data), format === 'bmp' ? 'image/bmp' : 'image/x-icon');
		expect((await image.webp().toBuffer()).length).toBeGreaterThan(0);
	});

	// A 32bpp BI_BITFIELDS bitmap with its masks inside a V5 header, as Windows writes it.
	function bitfieldsBmp(options: { headerSize?: number; redMask?: number; height?: number } = {}): Buffer {
		const headerSize = options.headerSize ?? 124;
		const width = 4, height = options.height ?? 4;
		const pixels = Buffer.alloc(width * Math.abs(height) * 4);
		for (let i = 0; i < pixels.length; i += 4) pixels.set([0x00, 0x00, 0xFF, 0xFF], i); // B,G,R,A = opaque red
		const dib = Buffer.alloc(headerSize);
		dib.writeUInt32LE(headerSize, 0);
		dib.writeInt32LE(width, 4);
		dib.writeInt32LE(height, 8);
		dib.writeUInt16LE(1, 12);
		dib.writeUInt16LE(32, 14);
		dib.writeUInt32LE(3, 16);
		dib.writeUInt32LE(pixels.length, 20);
		if (headerSize >= 56) {
			dib.writeUInt32LE(options.redMask ?? 0x00FF0000, 40);
			dib.writeUInt32LE(0x0000FF00, 44);
			dib.writeUInt32LE(0x000000FF, 48);
			dib.writeUInt32LE(0xFF000000, 52);
		}
		const file = Buffer.alloc(14);
		file.write('BM');
		file.writeUInt32LE(14 + headerSize + pixels.length, 2);
		file.writeUInt32LE(14 + headerSize, 10);
		return Buffer.concat([file, dib, pixels]);
	}

	test('a Windows-style 32bpp BI_BITFIELDS bitmap decodes with its real colors', async () => {
		const { service } = setup();
		const image = await service.openProxyImage(await temporaryImage(bitfieldsBmp()), 'image/bmp');
		const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
		expect([info.width, info.height, info.channels]).toEqual([4, 4, 4]);
		expect([...data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
	});

	test.each([
		['non-standard masks', { redMask: 0x0000FF00 }],
		['masks appended after a 40-byte header', { headerSize: 40 }],
		['a top-down (negative) height the decoder reads as billions of rows', { height: -4 }],
	] as const)('still rejects %s', async (_label, options) => {
		const { service } = setup();
		await expect(service.openProxyImage(await temporaryImage(bitfieldsBmp(options)), 'image/bmp')).rejects.toMatchObject({ statusCode: 413 });
	});

	test('rejects an ICO PNG whose dimensions disagree with its directory', async () => {
		const { service } = setup();
		const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#ff0000' } }).png().toBuffer();
		const path = await temporaryImage(icon(png, 1, 1));
		await expect(service.openProxyImage(path, 'image/x-icon')).rejects.toMatchObject({ statusCode: 413 });
	});

	test('ordinary image transformation remains available', async () => {
		const { service } = setup();
		const directory = await mkdtemp(join(tmpdir(), 'hataskey-media-normal-'));
		directories.push(directory);
		const path = join(directory, 'small.png');
		await sharp({ create: { width: 8, height: 8, channels: 4, background: '#ff0000' } }).png().toFile(path);
		const image = await service.openProxyImage(path, 'image/png');
		expect((await image.webp().toBuffer()).length).toBeGreaterThan(0);
	});

	test('linked originals retain the configured cap while both proxy URL forms use the image cap', async () => {
		const maxFileSize = 250 * 1024 * 1024;
		const remoteSize = 40 * 1024 * 1024;
		const redis = { eval: vi.fn().mockResolvedValue(1) };
		const query = { where: vi.fn().mockReturnThis(), orWhere: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({
			storedInternal: false, isLink: true, uri: 'https://remote.test/original', name: 'original.mp4',
		}) };
		const downloadUrl = vi.fn(async (_url: string, path: string, options: { maxBytes: number }) => {
			if (remoteSize > options.maxBytes) throw new StatusError('Download exceeds limit', 413);
			await truncate(path, remoteSize);
			return { filename: 'original.mp4' };
		});
		const service = new FileServerService(
			{ maxFileSize, url: 'https://local.test' } as never,
			{ createQueryBuilder: () => query } as never,
			{ detectType: async () => ({ mime: 'video/mp4', ext: 'mp4' }) } as never,
			{ downloadUrl } as never, {} as never, {} as never, {} as never,
			{ getLogger: () => ({ error: vi.fn() }) } as never, redis as never,
		) as any;
		const signal = new AbortController().signal;
		const original = await service.getFileFromKey('original-key', '203.0.113.1', signal);
		try {
			expect(original.file.size).toBe(remoteSize);
			expect(downloadUrl.mock.calls[0][2].maxBytes).toBe(maxFileSize);
		} finally { original.cleanup(); }
		await expect(service.getStreamAndTypeFromUrl('https://remote.test/original', '203.0.113.1', signal)).rejects.toMatchObject({ statusCode: 413 });
		await expect(service.getStreamAndTypeFromUrl('https://local.test/files/original-key', '203.0.113.1', signal)).rejects.toMatchObject({ statusCode: 413 });
		expect(downloadUrl.mock.calls.slice(1).map(call => call[2].maxBytes)).toEqual([32 * 1024 * 1024, 32 * 1024 * 1024]);
		const admissions = redis.eval.mock.calls.filter(call => call[1] === 4);
		expect(admissions).toHaveLength(3);
		for (const admission of admissions) {
			expect(admission[2]).toBe(`resource-budget:{${MEDIA_DOWNLOAD_BUDGET.name}}:active`);
			expect(admission.slice(8, 13)).toEqual([MEDIA_DOWNLOAD_BUDGET.concurrency, MEDIA_DOWNLOAD_BUDGET.actorConcurrency, admission[10], MEDIA_DOWNLOAD_BUDGET.concurrency * maxFileSize, MEDIA_DOWNLOAD_BUDGET.requestsPerMinute]);
		}
	});

	test('a timeline burst of avatars and emojis from one viewer fits the per-IP proxy share', async () => {
		const { service, redis } = setup();
		await service.withMediaBudget({ ip: '203.0.113.1' }, {}, async () => 'done');
		const [admission] = redis.eval.mock.calls.filter(call => call[1] === 4);
		expect(admission[2]).toBe(`resource-budget:{${MEDIA_PROCESSING_BUDGET.name}}:active`);
		expect(admission.slice(8, 13)).toEqual([64, 32, 0, 0, 2400]);
		expect(MEDIA_DOWNLOAD_BUDGET).toMatchObject({ concurrency: 16, actorConcurrency: 8 });
	});

	test('a denied request never starts its download or parser', async () => {
		const { service } = setup(0);
		const work = vi.fn();
		await expect(service.withMediaBudget({ ip: '203.0.113.1' }, {}, work)).rejects.toMatchObject({ statusCode: 429 });
		expect(work).not.toHaveBeenCalled();
	});

	test('keeps admission until response completion and destroys output on disconnect', async () => {
		const { service, redis } = setup();
		const raw = new EventEmitter();
		const output = new PassThrough();
		await service.withMediaBudget({ ip: '203.0.113.1', raw: new EventEmitter() }, { raw }, async () => output);
		expect(redis.eval).toHaveBeenCalledOnce();
		raw.emit('close');
		await vi.waitFor(() => expect(redis.eval).toHaveBeenCalledTimes(2));
		expect(output.destroyed).toBe(true);
	});
});
