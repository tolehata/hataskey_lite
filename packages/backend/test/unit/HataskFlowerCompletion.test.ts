/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { hasCompletedHataskFlowerCollection, recordCurrentSeasonHataskFlowerCompletions, recordHataskFlowerCollectionCompletion } from '@/core/hatask-flower-completion.js';
import { flowerSeason } from '@/core/hatask-flower-v2.js';
import { HATASK_FLOWER_CATALOG } from '@/misc/hatask-flower-catalog.js';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import { HataskAvatarDecorationRewards1790380400000 } from '../../migration/1790380400000-hatask-avatar-decoration-rewards.js';

describe('Hatask seasonal collection achievement', () => {
	const now = new Date('2026-10-12T00:00:00Z');
	const autumn = HATASK_FLOWER_CATALOG.filter(flower => flower.season === 'autumn').map(flower => ({ speciesId: flower.id }));

	test('existing users who harvested every current-season species qualify without a new claim', async () => {
		const query = vi.fn().mockResolvedValueOnce([{ flowerCollectionCompletedAt: null }]).mockResolvedValueOnce(autumn);
		expect(await hasCompletedHataskFlowerCollection({ query }, 'alice', now)).toBe(true);
		expect(query).toHaveBeenCalledWith(expect.stringContaining('"userId" = $1 AND season = $2'), ['alice', 'autumn', autumn.map(row => row.speciesId)]);
		expect(query.mock.calls).toHaveLength(2);
		expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
	});

	test('duplicates, limited flowers, and another season do not fill a missing species', async () => {
		const query = vi.fn().mockResolvedValueOnce([{ flowerCollectionCompletedAt: null }]).mockResolvedValueOnce([...autumn.slice(1), autumn[1], { speciesId: 'limited-evening-primrose' }, { speciesId: 'sp1' }]);
		expect(await hasCompletedHataskFlowerCollection({ query }, 'alice', now)).toBe(false);
		query.mockResolvedValue([]);
		expect(await hasCompletedHataskFlowerCollection({ query }, 'alice', now)).toBe(false);
	});

	test('a server-recorded achievement survives the next season without repeating the collection', async () => {
		const query = vi.fn().mockResolvedValue([{ flowerCollectionCompletedAt: now }]);
		expect(await hasCompletedHataskFlowerCollection({ query }, 'alice', new Date('2026-12-01T00:00:00Z'))).toBe(true);
		expect(query).toHaveBeenCalledTimes(1);
	});

	test('authenticated selection and harvesting record completion once without replacing an earlier date', async () => {
		const query = vi.fn().mockResolvedValueOnce([{ flowerCollectionCompletedAt: null }]).mockResolvedValueOnce(autumn).mockResolvedValueOnce([]);
		expect(await recordHataskFlowerCollectionCompletion({ query }, 'alice', now)).toBe(true);
		expect(query).toHaveBeenLastCalledWith('UPDATE hatask_drop_wallet SET "flowerCollectionCompletedAt" = $2 WHERE "userId" = $1 AND "flowerCollectionCompletedAt" IS NULL', ['alice', now]);
		query.mockClear().mockResolvedValue([{ flowerCollectionCompletedAt: now }]);
		expect(await recordHataskFlowerCollectionCompletion({ query }, 'alice', new Date('2026-12-01T00:00:00Z'))).toBe(true);
		expect(query).toHaveBeenCalledTimes(1);
	});

	test('incomplete users do not receive a durable grant', async () => {
		const query = vi.fn().mockResolvedValueOnce([{ flowerCollectionCompletedAt: null }]).mockResolvedValueOnce(autumn.slice(1));
		expect(await recordHataskFlowerCollectionCompletion({ query }, 'alice', now)).toBe(false);
		expect(query).toHaveBeenCalledTimes(2);
		expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
	});

	test('harvesting the final current-season species records the achievement inside the harvest transaction', async () => {
		let completedAt: Date | null = null;
		const currentSeason = flowerSeason(new Date());
		const species = HATASK_FLOWER_CATALOG.filter(flower => flower.season === currentSeason);
		const harvested = species.slice(0, -1).map(flower => ({ speciesId: flower.id }));
		const lastSpecies = species.at(-1);
		if (lastSpecies == null) throw new Error('Missing current-season catalog');
		const finalFlower = { ...lastSpecies, id: 'flowerid', speciesId: lastSpecies.id, progress: 100 };
		const manager = { query: vi.fn(async (sql: string, params: unknown[] = []) => {
			if (sql.startsWith('SELECT * FROM hatask_drop_wallet')) return [{ userId: 'alice', drops: 0, timezone: 'Asia/Tokyo', flower: finalFlower, seeds: [], rareSeeds: [] }];
			if (sql.startsWith('SELECT rank FROM')) return [{ rank: 1 }];
			if (sql.startsWith('SELECT u.id')) return [{ id: 'alice', name: null, username: 'alice' }];
			if (sql.startsWith('INSERT INTO hatask_flower_harvest')) harvested.push({ speciesId: String(params[2]) });
			if (sql.startsWith('SELECT "flowerCollectionCompletedAt"')) return [{ flowerCollectionCompletedAt: completedAt }];
			if (sql.startsWith('SELECT DISTINCT "speciesId"')) return harvested;
			if (sql.startsWith('UPDATE hatask_drop_wallet SET "flowerCollectionCompletedAt"')) completedAt = params[1] as Date;
			return [];
		}) };
		const transaction = vi.fn(async (callback: (m: typeof manager) => Promise<unknown>) => callback(manager));
		const service = new HataskFlowerV2Service({ transaction } as never, { gen: () => 'publicflowerid' } as never, {} as never);
		const internals = service as unknown as { grow: () => Promise<unknown>; newFlower: () => Promise<unknown>; state: () => Promise<unknown> };
		vi.spyOn(internals, 'grow').mockResolvedValue(finalFlower);
		vi.spyOn(internals, 'newFlower').mockResolvedValue(null);
		vi.spyOn(internals, 'state').mockResolvedValue({});
		await service.harvest('alice', 'flowerid', '');
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(completedAt).toBeInstanceOf(Date);
		manager.query.mockClear();
		expect(await hasCompletedHataskFlowerCollection(manager, 'alice', new Date('2027-01-01T00:00:00Z'))).toBe(true);
		expect(manager.query).toHaveBeenCalledTimes(1);
	});

	test('the migration backfill freezes all catalog IDs and uses the same Japan-time season', async () => {
		const query = vi.fn().mockResolvedValue([]);
		await new HataskAvatarDecorationRewards1790380400000().up({ query });
		const backfill = query.mock.calls.map(([sql]) => String(sql)).find(sql => sql.startsWith('WITH current_season'));
		if (backfill == null) throw new Error('Missing seasonal achievement backfill');
		const ids = [...backfill.matchAll(/'(sp|su|au|wi)(\d+)'/g)].map(match => `${match[1]}${match[2]}`);
		expect(ids).toEqual(HATASK_FLOWER_CATALOG.map(flower => flower.id));
		expect(backfill).toContain('now() AT TIME ZONE \'Asia/Tokyo\'');
		expect(backfill).toContain('WHERE NOT EXISTS');
		expect(backfill).toContain('harvest."userId" = wallet."userId"');
	});

	test.each([
		['2027-02-28T15:00:00.000Z', 'spring'],
		['2027-05-31T15:00:00.000Z', 'summer'],
		['2027-08-31T15:00:00.000Z', 'autumn'],
		['2027-11-30T15:00:00.000Z', 'winter'],
	])('binds the same season, catalog and achievement time for the periodic scan at %s', async (date, season) => {
		const completedAt = new Date(date);
		const query = vi.fn().mockResolvedValue([]);
		await recordCurrentSeasonHataskFlowerCompletions({ query }, completedAt);
		expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('WITH completed AS ('), [
			completedAt, season, HATASK_FLOWER_CATALOG.filter(flower => flower.season === season).map(flower => flower.id),
		]);
	});

	test('the periodic update requires every authoritative species and preserves earlier achievements', async () => {
		const query = vi.fn().mockResolvedValue([]);
		await recordCurrentSeasonHataskFlowerCompletions({ query }, now);
		const call = query.mock.calls.at(0);
		if (call == null) throw new Error('Missing periodic achievement update');
		const sql = String(call[0]);
		// The double NOT EXISTS requires all catalog IDs, so duplicates and unrelated
		// species cannot substitute for a missing flower. No client registry is read.
		expect(sql).toContain('SELECT 1 FROM unnest($3::varchar[]) AS species(id) WHERE NOT EXISTS');
		expect(sql).toContain('FROM hatask_flower_harvest harvest');
		expect(sql).toContain('harvest."userId" = wallet."userId" AND harvest.season = $2');
		expect(sql).toContain('harvest."speciesId" = species.id');
		expect(sql).toContain('owner.host IS NULL AND owner."isDeleted" = false');
		expect(sql).toContain('WHERE wallet."flowerCollectionCompletedAt" IS NULL');
		expect(sql).toContain('AND wallet."flowerCollectionCompletedAt" IS NULL');
		expect(sql).toContain('UPDATE hatask_drop_wallet wallet SET "flowerCollectionCompletedAt" = $1');
		expect(sql).not.toMatch(/registry|rareSeeds|\bdrops\b|\bseeds\b/u);
	});

	test('the periodic update skips wallets held by harvesting without taking an advisory lock afterward', async () => {
		const query = vi.fn().mockResolvedValue([]);
		await recordCurrentSeasonHataskFlowerCompletions({ query }, now);
		expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('ORDER BY wallet."userId" ASC FOR UPDATE OF wallet SKIP LOCKED'), expect.any(Array));
		const call = query.mock.calls.at(0);
		if (call == null) throw new Error('Missing periodic achievement update');
		expect(String(call[0])).not.toContain('pg_advisory');
	});

	test.each([
		['2026-02-28T14:59:59.999Z', 'winter'],
		['2026-02-28T15:00:00.000Z', 'spring'],
		['2026-05-31T15:00:00.000Z', 'summer'],
		['2026-08-31T15:00:00.000Z', 'autumn'],
		['2026-11-30T15:00:00.000Z', 'winter'],
	])('uses the existing Japan-time growing season at %s', (date, expected) => {
		expect(flowerSeason(new Date(date))).toBe(expected);
	});
});
