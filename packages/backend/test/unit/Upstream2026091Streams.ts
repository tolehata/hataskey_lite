/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { writeMultipartFileToTemp } from '@/misc/write-multipart-file-to-temp.js';
import Connection from '@/server/api/stream/Connection.js';

const temporaryDirectories: string[] = [];
afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function destination() {
	const directory = await mkdtemp(join(tmpdir(), 'hataskey-multipart-'));
	temporaryDirectories.push(directory);
	return { directory, path: join(directory, 'upload') };
}

describe('multipart stream completion', () => {
	test('does not persist a chunk that exceeds the admitted byte reservation', async () => {
		const { path } = await destination();
		const result = await writeMultipartFileToTemp(Readable.from([Buffer.from('ok'), Buffer.alloc(64)]), path, 8);
		expect(result).toMatchObject({ statusCode: 413 });
		expect((await readFile(path)).length).toBeLessThanOrEqual(8);
	});

	test('writes the complete file, including an empty part', async () => {
		for (const value of ['', 'uploaded content']) {
			const { path } = await destination();
			await expect(writeMultipartFileToTemp(Readable.from([value]), path)).resolves.toBeNull();
			expect(await readFile(path, 'utf8')).toBe(value);
		}
	});

	test('a part destroyed after EOF but before end does not hang', async () => {
		const { path } = await destination();
		const file = new Readable({ read() {} });
		file.push(null);
		file.destroy();
		await expect(writeMultipartFileToTemp(file, path)).resolves.toBeNull();
		expect(await readFile(path, 'utf8')).toBe('');
	}, 2000);

	test('returns the original client read error and stops writing', async () => {
		const { path } = await destination();
		const file = new PassThrough();
		const error = new Error('client disconnected');
		const writing = writeMultipartFileToTemp(file, path);
		file.write('partial');
		file.destroy(error);
		await expect(writing).resolves.toBe(error);
	}, 2000);

	test('throws a destination error and destroys a still-open input', async () => {
		const { directory } = await destination();
		const file = new PassThrough();
		await expect(writeMultipartFileToTemp(file, directory)).rejects.toMatchObject({ code: 'EISDIR' });
		expect(file.destroyed).toBe(true);
	}, 2000);
});

describe('stream note subscriptions', () => {
	async function setup() {
		const connection = new Connection({} as never, {} as never, {} as never, {} as never, null, null, {} as never);
		const subscriber = new EventEmitter();
		const socket = Object.assign(new EventEmitter(), { readyState: 1 });
		await connection.listen(subscriber, socket as never);
		const send = async (type: string, id: string) => {
			socket.emit('message', Buffer.from(JSON.stringify({ type, body: { id } })));
			await (connection as any).messageQueue(() => Promise.resolve());
		};
		return { connection, subscriber, send };
	}

	test('caps distinct subscriptions and evicts the least recently subscribed note', async () => {
		const { connection, subscriber, send } = await setup();
		try {
			for (let index = 0; index < 1536; index++) await send('subNote', `note-${index}`);
			await send('subNote', 'note-0');
			await send('subNote', 'note-next');
			expect(subscriber.eventNames().filter(name => String(name).startsWith('noteStream:'))).toHaveLength(1536);
			expect(subscriber.listenerCount('noteStream:note-1')).toBe(0);
			expect(subscriber.listenerCount('noteStream:note-0')).toBe(1);
			await send('unsubNote', 'note-0');
			expect(subscriber.listenerCount('noteStream:note-0')).toBe(1);
			await send('unsubNote', 'note-0');
			expect(subscriber.listenerCount('noteStream:note-0')).toBe(0);
		} finally {
			connection.dispose();
		}
	});

	test('handles object property names as note IDs and clears note listeners on disposal', async () => {
		const { connection, subscriber, send } = await setup();
		for (const id of ['__proto__', 'constructor', 'note']) await send('subNote', id);
		expect(subscriber.listenerCount('noteStream:__proto__')).toBe(1);
		const dispose = vi.fn();
		Object.assign(connection, { channels: [{ dispose }] });
		connection.dispose();
		connection.dispose();
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(subscriber.eventNames().filter(name => String(name).startsWith('noteStream:'))).toEqual([]);
	});
});
