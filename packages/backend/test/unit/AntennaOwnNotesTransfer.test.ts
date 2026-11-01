/* SPDX-License-Identifier: AGPL-3.0-only */
import fs from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ExportAntennasProcessorService } from '@/queue/processors/ExportAntennasProcessorService.js';
import { ImportAntennasProcessorService } from '@/queue/processors/ImportAntennasProcessorService.js';

const temporaryFiles: string[] = [];
afterEach(async () => { await Promise.all(temporaryFiles.splice(0).map(path => rm(path, { force: true }))); });

function document() {
	return {
		name: 'Antenna', src: 'all', keywords: [['keyword']], excludeKeywords: [], users: [], userListAccts: null,
		caseSensitive: false, localOnly: false, excludeBots: false, withReplies: true, withFile: false,
		excludeNotesInSensitiveChannel: false,
	};
}

function importer() {
	const saved: Record<string, unknown>[] = [];
	const logger = { succ() {}, warn() {}, error() {} };
	const service = new ImportAntennasProcessorService(
		{ insertOne: async (data: Record<string, unknown>) => { const row = { excludeOwnNotes: false, ...data }; saved.push(row); return row; } } as never,
		{ logger: { createSubLogger: () => logger } } as never,
		{ gen: () => 'imported1' } as never,
		{ publishInternalEvent() {} } as never,
	);
	return {
		saved,
		run: (documents: unknown[]) => service.process({ data: { user: { id: 'newOwner' }, antenna: documents } } as never),
	};
}

describe('antenna own-note export/import', () => {
	test.each([undefined, false, true])('imports the setting %s, treating old files as off', async value => {
		const f = importer();
		await f.run([{ ...document(), ...(value === undefined ? {} : { excludeOwnNotes: value }) }]);
		expect(f.saved).toHaveLength(1);
		expect(f.saved[0]).toMatchObject({ userId: 'newOwner', excludeOwnNotes: value ?? false });
	});

	test('does not import an invalid non-boolean setting', async () => {
		const f = importer();
		await f.run([{ ...document(), excludeOwnNotes: 'true' }]);
		expect(f.saved).toEqual([]);
	});

	test('exports enabled and disabled antennas and preserves both when imported', async () => {
		let stream: fs.WriteStream | undefined;
		const original = fs.createWriteStream;
		vi.spyOn(fs, 'createWriteStream').mockImplementation((...args) => {
			stream = original(...args);
			return stream;
		});
		let exported: unknown[] = [];
		const service = new ExportAntennasProcessorService(
			{ findOneBy: async () => ({ id: 'owner1' }) } as never,
			{ findBy: async () => [true, false].map((excludeOwnNotes, index) => ({ ...document(), id: `antenna${index}`, userListId: null, excludeOwnNotes })) } as never,
			{} as never,
			{ addFile: async ({ path }: { path: string }) => {
				temporaryFiles.push(path);
				if (stream) await finished(stream);
				exported = JSON.parse(await readFile(path, 'utf8'));
				return { id: 'file1' };
			} } as never,
			{} as never, { logger: { createSubLogger: () => ({ succ() {}, error() {} }) } } as never,
			{ createNotification() {} } as never,
		);
		await service.process({ data: { user: { id: 'owner1' } } } as never);
		expect(exported).toEqual([
			expect.objectContaining({ excludeOwnNotes: true }),
			expect.objectContaining({ excludeOwnNotes: false }),
		]);
		const f = importer();
		await f.run(exported);
		expect(f.saved.map(row => row.excludeOwnNotes)).toEqual([true, false]);
	});
});
