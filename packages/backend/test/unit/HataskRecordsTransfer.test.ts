/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import _Ajv from 'ajv';
import { cleanRecord, mergeRecords, parseImport } from '@/server/api/endpoints/hatask/records/_shared.js';
import { validTodayJournalRow } from '@/core/hatagoes-daily.js';
import ImportHataskRecordsEndpoint, { meta as importMeta, paramDef as importParamDef } from '@/server/api/endpoints/hatask/records/import.js';
import { meta as exportMeta } from '@/server/api/endpoints/hatask/records/export.js';

const mood = { id: 'm1', date: '2026-10-08', time: '12:34', level: 4, note: 'good' };
const flower = { id: 'f1', speciesId: 'daisy', season: 'spring', emoji: '🌼', name: 'Daisy', hanakotoba: 'hope', nickname: '', rare: false, harvestedAt: '2026-10-08T03:34:00.000Z', memory: [] };
const envelope = (data: Record<string, unknown>) => ({ format: 'hatask-records-export', version: 1, exportedAt: '2026-10-08T03:34:00.000Z', data: { moods: [], meals: [], flowers: [], ...data } });

describe('Hatask record transfer', () => {
	test('AJV accepts optional journal fields omitted from import input', () => {
		const Ajv = _Ajv.default;
		const validate = new Ajv({ useDefaults: true }).compile(importParamDef);
		const minimalMood = { id: mood.id, date: mood.date, time: mood.time, level: mood.level };
		expect(validate(envelope({ moods: [minimalMood] })), JSON.stringify(validate.errors)).toBe(true);
	});
	test('exposes native-only account endpoints and validates before opening a transaction', async () => {
		expect(importMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(exportMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'read:account' });
		expect(importParamDef.additionalProperties).toBe(false);
		let transactionCalled = false;
		const endpoint = new ImportHataskRecordsEndpoint({ transaction: () => { transactionCalled = true; } } as never, {} as never, {} as never);
		await expect(endpoint.exec(envelope({ moods: [mood, mood] }), { id: 'owner' } as never, null, null)).rejects.toBeDefined();
		expect(transactionCalled).toBe(false);
	});
	test('does not write any collection when a later stored collection is invalid', async () => {
		const queries: unknown[][] = [];
		const insert = vi.fn();
		const update = vi.fn();
		const rows = [{ id: 'stored', key: 'meals', value: { invalid: true } }];
		const builder: Record<string, (...args: unknown[]) => unknown> = {};
		for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'setLock']) builder[method] = () => builder;
		builder.getMany = async () => rows;
		const manager = { query: async (...args: unknown[]) => { queries.push(args); return []; }, getRepository: () => ({ createQueryBuilder: () => builder, insert, update }) };
		const endpoint = new ImportHataskRecordsEndpoint({ transaction: async (callback: (manager: typeof manager) => Promise<unknown>) => callback(manager) } as never,
			{ gen: () => 'new' } as never, { publishMainStream: vi.fn() } as never);
		await expect(endpoint.exec(envelope({ moods: [mood] }), { id: 'owner' } as never, null, null)).rejects.toBeDefined();
		expect(insert).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(queries.some(args => JSON.stringify(args).includes('hatask-flower:owner'))).toBe(true);
	});
	test('writes only to the authenticated owner scope and reports a replay as duplicate', async () => {
		const inserted: Record<string, unknown>[] = [];
		const stored: Record<string, unknown>[] = [];
		const builder: Record<string, (...args: unknown[]) => unknown> = {};
		for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'setLock']) builder[method] = () => builder;
		builder.getMany = async () => stored;
		const repo = { createQueryBuilder: () => builder, insert: async (row: Record<string, unknown>) => { inserted.push(row); stored.push({ ...row }); }, update: vi.fn() };
		const manager = { query: async () => [], getRepository: () => repo };
		const publishMainStream = vi.fn();
		const endpoint = new ImportHataskRecordsEndpoint({ transaction: async (callback: (manager: typeof manager) => Promise<unknown>) => callback(manager) } as never,
			{ gen: () => 'new' } as never, { publishMainStream } as never);
		const first = await endpoint.exec(envelope({ moods: [mood] }), { id: 'owner' } as never, null, null);
		expect(first?.added.moods).toBe(1);
		expect(inserted[0]).toMatchObject({ userId: 'owner', domain: null, scope: ['client', 'hatask'], key: 'moods', value: [{ ...mood, imported: true }] });
		const replay = await endpoint.exec(envelope({ moods: [mood] }), { id: 'owner' } as never, null, null);
		expect(replay?.added.moods).toBe(0);
		expect(replay?.duplicates.moods).toBe(1);
		expect(inserted).toHaveLength(1);
		expect(publishMainStream).toHaveBeenCalledTimes(1);
	});
	test('refuses a flower ID removed by moderation before writing archive data', async () => {
		const insert = vi.fn();
		const builder: Record<string, (...args: unknown[]) => unknown> = {};
		for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'setLock']) builder[method] = () => builder;
		builder.getMany = async () => [];
		const manager = { query: async (sql: string) => sql.includes('record_moderation_tombstone') ? [{ blocked: true }] : [], getRepository: () => ({ createQueryBuilder: () => builder, insert, update: vi.fn() }) };
		const endpoint = new ImportHataskRecordsEndpoint({ transaction: async (callback: (manager: typeof manager) => Promise<unknown>) => callback(manager) } as never,
			{ gen: () => 'new' } as never, { publishMainStream: vi.fn() } as never);
		await expect(endpoint.exec(envelope({ flowers: [flower] }), { id: 'owner' } as never, null, null)).rejects.toBeDefined();
		expect(insert).not.toHaveBeenCalled();
	});
	test('requires exact version, real dates and unique IDs before merge', () => {
		expect(() => parseImport(envelope({ moods: [mood, mood] }))).toThrow();
		expect(() => parseImport(envelope({ moods: [{ ...mood, date: '2026-02-30' }] }))).toThrow();
		expect(() => parseImport({ ...envelope({}), version: 2 })).toThrow();
		expect(() => parseImport({ ...envelope({}), exportedAt: '2026-02-30T00:00:00Z' })).toThrow();
		expect(() => parseImport(envelope({ flowers: [{ ...flower, harvestedAt: '2026-02-30T00:00:00Z' }] }))).toThrow();
		expect(() => parseImport(envelope({ flowers: [{ ...flower, id: ' ' }] }))).toThrow();
		expect(() => parseImport(envelope({ flowers: [{ ...flower, season: ['spring'] }] }))).toThrow();
		expect(() => parseImport(envelope({ meals: [{ ...mood, slot: 'lunch', level: ['ate'] }] }))).toThrow();
	});
	test('strips foreign user and discovery fields from flowers', () => {
		expect(cleanRecord({ ...flower, user: { id: 'foreign' }, firstUser: { id: 'foreign' }, noteId: 'foreign', rank: 1 }, 'flowers')).toEqual(flower);
	});
	test('appends imported journals without changing existing raw fields or granting daily credit', () => {
		const old = { ...mood, privateLegacyField: 'keep' };
		const merged = mergeRecords([old], [{ ...mood, id: 'm2' }], 'moods');
		expect(merged.value[0]).toEqual(old);
		expect(merged.value[1]).toMatchObject({ id: 'm2', imported: true });
		expect(validTodayJournalRow(merged.value[1], 'mood', '2026-10-08')).toBe(false);
	});
	test('reports duplicates and conflicts without overwriting IDs', () => {
		const merged = mergeRecords([mood], [mood, { ...mood, note: 'other' }], 'moods');
		expect(merged).toMatchObject({ added: 0, duplicates: 1, conflicts: 1, value: [mood] });
		expect(() => mergeRecords([{ ...mood, id: '' }], [mood], 'moods')).toThrow();
		expect(() => mergeRecords([mood, mood], [mood], 'moods')).toThrow();
	});
});
