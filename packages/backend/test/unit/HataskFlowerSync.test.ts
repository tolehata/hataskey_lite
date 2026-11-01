/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import SyncEndpoint from '@/server/api/endpoints/hatask/flowers/sync.js';

const owner = { id: 'owner' } as never;
const legacy = { clientFlowerId: 'flower', emoji: '🌷', name: 'Old client', hanakotoba: '', harvestedAt: '2026-09-20T00:00:00.000Z' };

function fixture(options: { alreadyHarvested?: boolean; concurrentHarvest?: boolean } = {}) {
	let locked = false, pendingHarvest = false;
	let authoritative = options.alreadyHarvested ?? false;
	let publicName = authoritative ? 'Server harvest' : '';
	const steps: string[] = [];
	let values: { name: string }[] = [];
	const qb = {
		insert: () => qb, into: () => qb, orUpdate: () => qb,
		values: (rows: typeof values) => { values = rows; return qb; },
		execute: vi.fn(async () => { steps.push('legacy-write'); publicName = values[0].name; }),
	};
	const manager = {
		query: vi.fn(async (sql: string, params: unknown[]) => {
			if (sql.startsWith('SELECT pg_advisory')) {
				expect(params).toEqual(['hatask-flower:owner']);
				steps.push('wallet-lock'); locked = true; return [];
			}
			steps.push('authoritative-read');
			const rows = authoritative ? [{ id: 'flower' }] : [];
			// A V2 harvest reaches its wallet lock immediately after this SELECT.
			if (options.concurrentHarvest) {
				if (locked) pendingHarvest = true;
				else { authoritative = true; publicName = 'Server harvest'; }
			}
			return rows;
		}),
		getRepository: () => ({ createQueryBuilder: () => qb }),
		transaction: async (callback: (m: unknown) => Promise<unknown>) => {
			try { return await callback(manager); } finally {
				locked = false;
				if (pendingHarvest) { authoritative = true; publicName = 'Server harvest'; }
			}
		},
	};
	const endpoint = new SyncEndpoint({ manager, createQueryBuilder: () => qb } as never, { gen: () => 'generated' } as never);
	return { endpoint, steps, qb, name: () => publicName };
}

describe('legacy flower sync and server harvest', () => {
	test('cannot overwrite a V2 harvest committed between the legacy read and write', async () => {
		const f = fixture({ concurrentHarvest: true });
		await f.endpoint.exec({ flowers: [legacy] }, owner, null, null);
		expect(f.name()).toBe('Server harvest');
		expect(f.steps).toEqual(['wallet-lock', 'authoritative-read', 'legacy-write']);
	});

	test('skips already-authoritative IDs without rewriting their public projection', async () => {
		const f = fixture({ alreadyHarvested: true });
		expect(await f.endpoint.exec({ flowers: [legacy] }, owner, null, null)).toEqual({ synced: 0 });
		expect(f.qb.execute).not.toHaveBeenCalled();
		expect(f.name()).toBe('Server harvest');
	});

	test('still imports legacy records, retaining the last duplicate payload', async () => {
		const f = fixture();
		expect(await f.endpoint.exec({ flowers: [legacy, { ...legacy, name: 'Newest legacy' }] }, owner, null, null)).toEqual({ synced: 1 });
		expect(f.name()).toBe('Newest legacy');
	});
});
