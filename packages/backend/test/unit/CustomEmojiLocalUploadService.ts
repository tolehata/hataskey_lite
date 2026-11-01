/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { FindOperator } from 'typeorm';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import type { EmojiTransaction } from '@/misc/emoji-transaction.js';

const services: CustomEmojiService[] = [];
const originalUrl = 'http://localhost:3000/files/source-key';
const fileSystem = vi.hoisted(() => ({ stat: vi.fn() }));
vi.mock('node:fs/promises', async (importOriginal) => ({
	...await importOriginal<typeof import('node:fs/promises')>(),
	stat: fileSystem.stat,
}));

function fixture(source: Partial<MiDriveFile> | null = {}) {
	fileSystem.stat.mockReset().mockResolvedValue({ size: 8 });
	const original = source == null ? null : {
		id: 'original-file', url: originalUrl, name: 'emoji.png',
		webpublicUrl: 'http://localhost:3000/files/webpublic-source-key',
		storedInternal: true, isLink: false, accessKey: 'source-key', ...source,
	};
	const copied = { id: 'copied-file', url: 'http://localhost:3000/files/copy-key', type: 'image/png', size: 8, webpublicUrl: null, webpublicType: null };
	const files = {
		findOneBy: vi.fn(async ({ url }: { url: string }) => original?.url === url ? original : null),
		count: vi.fn().mockResolvedValue(0),
	};
	const notesQuery = { select: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(false) };
	const notes = { createQueryBuilder: vi.fn(() => notesQuery) };
	const users = { exists: vi.fn().mockResolvedValue(false) };
	const drive = {
		addFile: vi.fn().mockResolvedValue(copied),
		uploadFromUrl: vi.fn().mockRejectedValue(new Error('cacheableLookup ENOTFOUND localhost')),
		deleteFile: vi.fn().mockResolvedValue(undefined),
	};
	const storage = { resolvePath: vi.fn((key: string) => `/internal-files/${key}`) };
	const emojiReferences: { originalUrl: string; publicUrl: string }[] = [];
	const emojis = {
		insertOne: vi.fn(async (emoji: object) => emoji), find: vi.fn().mockResolvedValue([]),
		findOneBy: vi.fn(async () => ({ id: 'emoji-id', name: 'test_emoji', originalUrl: '/previous.png', publicUrl: '/previous.png', host: null })),
		findOneByOrFail: vi.fn(async () => ({ id: 'emoji-id', name: 'test_emoji', originalUrl: '/previous.png', publicUrl: '/previous.png', host: null })),
		update: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn(async ({ where }: { where: { originalUrl?: FindOperator<string>; publicUrl?: FindOperator<string> }[] }) => {
			return emojiReferences.some(emoji => where.some(condition => {
				return condition.originalUrl?.value.includes(emoji.originalUrl) || condition.publicUrl?.value.includes(emoji.publicUrl);
			}));
		}),
	};
	const packed = { id: 'emoji-id', name: 'test_emoji' };
	const entity = { packDetailed: vi.fn().mockResolvedValue(packed) };
	const events = { publishBroadcastStream: vi.fn() };
	const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
	const service = new CustomEmojiService(
		{} as never, { set: vi.fn().mockResolvedValue('OK') } as never,
		emojis as never, files as never, notes as never, users as never,
		{} as never, { gen: vi.fn(() => 'emoji-id') } as never,
		entity as never, { log: vi.fn() } as never, events as never, drive as never,
		{ getLogger: vi.fn(() => logger) } as never, storage as never,
		{ maxFileSize: 16 } as never,
	);
	services.push(service);
	const add = () => service.add({
		originalUrl: original?.url ?? originalUrl, publicUrl: original?.url ?? originalUrl,
		fileType: 'image/png', name: 'test_emoji', category: null, aliases: [], host: null,
		license: null, isSensitive: false, localOnly: false, roleIdsThatCanBeUsedThisEmojiAsReaction: [],
	});
	return { service, add, original, copied, files, notesQuery, users, drive, storage, emojis, emojiReferences, packed, entity, events };
}

afterEach(() => {
	for (const service of services.splice(0)) service.dispose();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('custom emoji local source re-upload', () => {
	test('an image review retains its source and publishes only after commit', async () => {
		const f = fixture();
		const tx: EmojiTransaction = { manager: { getRepository: () => f.emojis } as never, afterCommit: [], afterRollback: [] };
		await f.service.update({ id: 'emoji-id', originalUrl, license: 'own image' }, undefined, tx);
		expect(f.emojis.update).toHaveBeenCalledWith('emoji-id', expect.objectContaining({ originalUrl: f.copied.url }));
		expect(f.drive.deleteFile).not.toHaveBeenCalled(); expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
		for (const publish of tx.afterCommit) await publish();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: [f.packed] });
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
	});
	test('failed reviews clean up only the independent replacement copy', async () => {
		const f = fixture();
		const tx: EmojiTransaction = { manager: { getRepository: () => f.emojis } as never, afterCommit: [], afterRollback: [] };
		f.emojis.update.mockRejectedValueOnce(new Error('database failed'));
		await expect(f.service.update({ id: 'emoji-id', originalUrl }, undefined, tx)).rejects.toThrow('database failed');
		for (const cleanup of tx.afterRollback) await cleanup();
		expect(f.drive.deleteFile.mock.calls).toEqual([[f.copied]]); expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
	});
	test('transactional withdrawal uses the transaction repository and defers deletion broadcast', async () => {
		const f = fixture();
		const tx: EmojiTransaction = { manager: { getRepository: () => f.emojis } as never, afterCommit: [], afterRollback: [] };
		await f.service.delete('emoji-id', undefined, tx);
		expect(f.emojis.delete).toHaveBeenCalledWith('emoji-id'); expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
		for (const publish of tx.afterCommit) await publish();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledWith('emojiDeleted', { emojis: [f.packed] });
	});
	test('uncertain commit cleanup preserves a replacement already referenced by an emoji', async () => {
		const f = fixture();
		const tx: EmojiTransaction = { manager: { getRepository: () => f.emojis } as never, afterCommit: [], afterRollback: [] };
		await f.service.update({ id: 'emoji-id', originalUrl }, undefined, tx);
		f.emojiReferences.push({ originalUrl: f.copied.url, publicUrl: f.copied.url });
		for (const cleanup of tx.afterRollback) await cleanup();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
	});
	test('内部保存の原本をHTTP再取得せず独立した絵文字用ファイルへ複製する', async () => {
		const f = fixture();
		await expect(f.add()).resolves.toMatchObject({ id: 'emoji-id', originalUrl: f.copied.url });
		expect(f.files.findOneBy).toHaveBeenCalledWith({ url: originalUrl });
		expect(f.storage.resolvePath).toHaveBeenCalledWith('source-key');
		expect(fileSystem.stat).toHaveBeenCalledWith('/internal-files/source-key');
		expect(f.drive.addFile).toHaveBeenCalledWith({
			user: null, path: '/internal-files/source-key', name: 'emoji.png', force: true, url: originalUrl,
		});
		expect(f.drive.uploadFromUrl).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledWith('emojiAdded', { emoji: f.packed });
		expect(f.drive.deleteFile).toHaveBeenCalledWith(f.original);
		expect(f.drive.addFile.mock.invocationCallOrder[0]).toBeLessThan(f.drive.deleteFile.mock.invocationCallOrder[0]);
		expect(f.emojis.insertOne.mock.invocationCallOrder[0]).toBeLessThan(f.events.publishBroadcastStream.mock.invocationCallOrder[0]);
	});

	test.each([
		['object storage', { storedInternal: false, url: 'https://storage.example/emoji.png' }],
		['remote link', { storedInternal: true, isLink: true, url: 'https://remote.example/emoji.png' }],
		['unregistered URL', null],
	] as const)('%sは従来のURL取得を使いローカル保存領域を読まない', async (_label, source) => {
		const f = fixture(source);
		f.drive.uploadFromUrl.mockResolvedValue(f.copied);
		await f.add();
		expect(f.drive.uploadFromUrl).toHaveBeenCalledWith({ url: f.original?.url ?? originalUrl, user: null, force: true });
		expect(f.drive.addFile).not.toHaveBeenCalled();
		expect(f.storage.resolvePath).not.toHaveBeenCalled();
		expect(fileSystem.stat).not.toHaveBeenCalled();
	});

	test.each(['note', 'avatar or banner', 'other drive record'])('%sに使用中の原本を削除しない', async (use) => {
		const f = fixture();
		if (use === 'note') f.notesQuery.getExists.mockResolvedValue(true);
		if (use === 'avatar or banner') f.users.exists.mockResolvedValue(true);
		if (use === 'other drive record') f.files.count.mockResolvedValue(1);
		await f.add();
		expect(f.drive.addFile).toHaveBeenCalledOnce();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledOnce();
	});

	test.each([
		[true, 'originalUrl', 'url'], [true, 'publicUrl', 'url'],
		[true, 'originalUrl', 'webpublicUrl'], [true, 'publicUrl', 'webpublicUrl'],
		[false, 'originalUrl', 'url'], [false, 'publicUrl', 'url'],
		[false, 'originalUrl', 'webpublicUrl'], [false, 'publicUrl', 'webpublicUrl'],
	] as const)('既存絵文字が参照する画像を残す: 内部保存=%s, %s → %s', async (storedInternal, emojiField, sourceField) => {
		const f = fixture({ storedInternal });
		f.drive.uploadFromUrl.mockResolvedValue(f.copied);
		const referenceUrl = f.original?.[sourceField];
		if (!referenceUrl) throw new Error('Missing fixture URL');
		f.emojiReferences.push({ originalUrl: 'https://unused.example/original', publicUrl: 'https://unused.example/public', [emojiField]: referenceUrl });
		await f.add();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledWith('emojiAdded', { emoji: f.packed });
	});

	test('複製失敗時は原本・絵文字を変更せず新規追加通知も発行しない', async () => {
		vi.useFakeTimers();
		const f = fixture();
		f.drive.addFile.mockRejectedValue(new Error('source file missing'));
		const rejected = expect(f.add()).rejects.toThrow('source file missing');
		await vi.advanceTimersByTimeAsync(3000);
		await rejected;
		expect(f.drive.addFile).toHaveBeenCalledTimes(3);
		expect(f.drive.uploadFromUrl).not.toHaveBeenCalled();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.emojis.insertOne).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
	});

	test('DBのsizeが小さくても実ファイルが取得上限を超えていれば複製しない', async () => {
		vi.useFakeTimers();
		const f = fixture({ size: 1 });
		fileSystem.stat.mockResolvedValue({ size: 17 });
		const rejected = expect(f.add()).rejects.toThrow('Max file size exceeded.');
		await vi.advanceTimersByTimeAsync(3000);
		await rejected;
		expect(f.drive.addFile).not.toHaveBeenCalled();
		expect(f.drive.uploadFromUrl).not.toHaveBeenCalled();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.emojis.insertOne).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
	});

	test('実ファイルが取得上限ちょうどならDBのsizeにかかわらず複製する', async () => {
		const f = fixture({ size: 99 });
		fileSystem.stat.mockResolvedValue({ size: 16 });
		await f.add();
		expect(f.drive.addFile).toHaveBeenCalledOnce();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledOnce();
	});

	test.each([null, '', '../config', '/etc/passwd', 'folder/key', 'folder\\key'])('不正な内部保存キー %j でローカル領域を読み出さない', async (accessKey) => {
		vi.useFakeTimers();
		const f = fixture({ accessKey });
		const rejected = expect(f.add()).rejects.toThrow('Invalid internal drive file key');
		await vi.advanceTimersByTimeAsync(3000);
		await rejected;
		expect(f.storage.resolvePath).not.toHaveBeenCalled();
		expect(f.drive.addFile).not.toHaveBeenCalled();
		expect(f.drive.uploadFromUrl).not.toHaveBeenCalled();
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.emojis.insertOne).not.toHaveBeenCalled();
	});

	test('再試行で複製できるまでは原本を残す', async () => {
		vi.useFakeTimers();
		const f = fixture();
		f.drive.addFile.mockRejectedValueOnce(new Error('temporary read failure'));
		const result = f.add();
		await vi.advanceTimersByTimeAsync(999);
		expect(f.drive.deleteFile).not.toHaveBeenCalled();
		expect(f.events.publishBroadcastStream).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await result;
		expect(f.drive.addFile).toHaveBeenCalledTimes(2);
		expect(f.drive.deleteFile).toHaveBeenCalledOnce();
		expect(f.events.publishBroadcastStream).toHaveBeenCalledOnce();
	});
});
