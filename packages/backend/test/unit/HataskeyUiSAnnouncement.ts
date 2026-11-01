/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import Claim, { meta, paramDef } from '@/server/api/endpoints/hata/ui-s-announcement/claim.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import type { MiLocalUser } from '@/models/User.js';

function setup() {
	const rows = new Map<string, Partial<MiRegistryItem>>();
	const pendingLocks = new Map<string, Promise<void>>();
	let failNextInsert = false;
	let nextId = 0;
	const queries: Array<{ sql: string; params: string[] }> = [];
	const transaction = vi.fn(async (callback: (manager: never) => Promise<unknown>) => {
		let releaseLock: (() => void) | undefined;
		const manager = {
			query: async (sql: string, params: string[]) => {
				queries.push({ sql, params });
				const key = params[0];
				const previous = pendingLocks.get(key) ?? Promise.resolve();
				const current = new Promise<void>(resolve => { releaseLock = resolve; });
				pendingLocks.set(key, previous.then(() => current));
				await previous;
			},
			getRepository: (entity: unknown) => {
				expect(entity).toBe(MiRegistryItem);
				const filters: Array<[string, Record<string, unknown> | undefined]> = [];
				const builder = {
					where: (sql: string, params?: Record<string, unknown>) => { filters.push([sql, params]); return builder; },
					andWhere: (sql: string, params?: Record<string, unknown>) => { filters.push([sql, params]); return builder; },
					getOne: async () => {
						expect(filters).toEqual([
							['item.userId = :userId', { userId: expect.any(String) }],
							['item.domain IS NULL', undefined],
							['item.scope = :scope', { scope: ['client', 'uiAnnouncements'] }],
							['item.key = :key', { key: 'hataskeyUiSRelease' }],
						]);
						return rows.get(filters[0][1]!.userId as string) ?? null;
					},
				};
				return {
					createQueryBuilder: (alias: string) => { expect(alias).toBe('item'); return builder; },
					insert: async (row: Partial<MiRegistryItem>) => {
						await new Promise<void>(resolve => setTimeout(resolve, 0));
						if (failNextInsert) { failNextInsert = false; throw new Error('insert failed'); }
						expect(row).toMatchObject({
							userId: expect.any(String), domain: null, scope: ['client', 'uiAnnouncements'],
							key: 'hataskeyUiSRelease', value: true, updatedAt: expect.any(Date),
						});
						rows.set(row.userId!, row);
					},
				};
			},
		};
		try {
			return await callback(manager as never);
		} finally {
			releaseLock?.();
		}
	});
	const idService = { gen: vi.fn(() => `id-${++nextId}`) };
	const endpoint = new Claim({ manager: { transaction } } as never, idService as never);
	const exec = (userId: string, params: Record<string, unknown> = {}) => endpoint.exec(params, { id: userId } as MiLocalUser, null, null);
	return { exec, rows, queries, transaction, idService, failInsertOnce: () => { failNextInsert = true; } };
}

describe('Hataskey UI S announcement claim', () => {
	test('requires a secure signed-in session and accepts only an empty request', async () => {
		expect(meta).toMatchObject({ tags: ['hata'], requireCredential: true, secure: true, kind: 'write:account' });
		expect(meta.res).toMatchObject({ type: 'object', properties: { claimed: { type: 'boolean' } }, required: ['claimed'] });
		expect(paramDef).toMatchObject({ type: 'object', properties: {}, additionalProperties: false });
		const { exec, transaction } = setup();
		await expect(exec('owner', { userId: 'other' })).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		await expect(exec('owner', { key: 'another' })).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(transaction).not.toHaveBeenCalled();
	});

	test('claims once per user, including when an existing marker has a false value', async () => {
		const { exec, rows, queries, idService } = setup();
		expect(await exec('owner')).toEqual({ claimed: true });
		expect(await exec('owner')).toEqual({ claimed: false });
		rows.set('prior', { userId: 'prior', value: false });
		expect(await exec('prior')).toEqual({ claimed: false });
		expect(await exec('other')).toEqual({ claimed: true });
		expect(rows.size).toBe(3);
		expect(idService.gen).toHaveBeenCalledTimes(2);
		expect(queries).toEqual(expect.arrayContaining([
			{ sql: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: ['hata-ui-s-announcement:owner'] },
			{ sql: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: ['hata-ui-s-announcement:other'] },
		]));
	});

	test('serializes concurrent requests and retries after an insert failure', async () => {
		const { exec, rows, failInsertOnce } = setup();
		const results = await Promise.all(Array.from({ length: 8 }, () => exec('owner')));
		expect(results.filter(result => result.claimed)).toHaveLength(1);
		expect(rows.size).toBe(1);
		failInsertOnce();
		await expect(exec('new')).rejects.toThrow('insert failed');
		expect(rows.has('new')).toBe(false);
		expect(await exec('new')).toEqual({ claimed: true });
		expect(rows.size).toBe(2);
	});
});
