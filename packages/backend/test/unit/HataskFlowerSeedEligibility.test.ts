/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import { HATASK_FLOWER_CATALOG, type HataskFlowerSeason } from '@/misc/hatask-flower-catalog.js';

vi.mock('@/core/NotificationService.js', () => ({ NotificationService: class {} }));

type Flower = Awaited<ReturnType<HataskFlowerV2Service['show']>>['flower'];
type Harvest = { speciesId: string; season: HataskFlowerSeason; entry: Partial<Flower> };
type Festival = { id: string; season: HataskFlowerSeason; startsAt: Date; endsAt: Date; bloomedAt: Date | null };
const seasons = [
	{ season: 'spring', date: '2026-04-01T00:00:00Z' },
	{ season: 'summer', date: '2026-07-01T00:00:00Z' },
	{ season: 'autumn', date: '2026-10-01T00:00:00Z' },
	{ season: 'winter', date: '2026-12-15T00:00:00Z' },
] satisfies { season: HataskFlowerSeason; date: string }[];

// Exercise the real generation, growth and public service methods with SQL rows.
// This fixture does not model PostgreSQL locking or transaction isolation.
function fixture(now: Date) {
	const harvested: Harvest[] = [];
	const festivals: Festival[] = [];
	const participants = new Set<string>();
	const legacy: Record<string, unknown>[] = [];
	const wallet = { userId: 'owner', drops: 0, timezone: 'Asia/Tokyo', flower: null as Flower | null, seeds: ['winter'] as HataskFlowerSeason[], rareSeeds: [] as HataskFlowerSeason[] };
	let generatedIds = 0;
	const manager = { query: vi.fn(async (sql: string, args: unknown[] = []) => {
		if (sql.startsWith('SELECT * FROM hatask_drop_wallet')) return [wallet];
		if (sql.startsWith('SELECT "hataskFlowerRules"')) return [];
		if (sql.startsWith('SELECT "speciesId",season,entry FROM hatask_flower_harvest')) return harvested;
		if (sql.startsWith('SELECT entry FROM hatask_flower_harvest WHERE id=')) return harvested.filter(row => row.entry.id === args[0]);
		if (sql.startsWith('SELECT entry FROM hatask_flower_harvest WHERE "userId"=')) return harvested;
		if (sql.startsWith('SELECT f.id,f.season FROM hatask_flower_participant')) {
			expect(args).toEqual(['owner']);
			expect(sql).toContain('f.id=p."festivalId" WHERE p."userId"=$1 AND f."bloomedAt" IS NOT NULL');
			return festivals.filter(row => participants.has(row.id) && row.bloomedAt != null).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map(({ id, season }) => ({ id, season }));
		}
		if (sql.startsWith('INSERT INTO hatask_flower_festival')) {
			if (!festivals.some(row => row.id === args[0])) festivals.push({ id: String(args[0]), season: args[1] as HataskFlowerSeason, startsAt: args[3] as Date, endsAt: args[4] as Date, bloomedAt: null });
			return [];
		}
		if (sql.startsWith('SELECT * FROM hatask_flower_festival')) return festivals.filter(row => row.id === args[0]);
		if (sql.startsWith('SELECT 1 FROM hatask_flower_participant')) return participants.has(String(args[0])) ? [{}] : [];
		if (sql.startsWith('SELECT value FROM registry_item')) return args[2] === 'flower' ? legacy.map(value => ({ value })) : [];
		if (sql.startsWith('SELECT count(*)::int AS count FROM hatask_drop_ledger')) return [{ count: 0 }];
		if (sql.startsWith('SELECT "flowerCollectionCompletedAt"')) return [{ flowerCollectionCompletedAt: now }];
		if (sql.startsWith('SELECT rank FROM hatask_flower_discovery')) return [{ rank: 1 }];
		if (sql.startsWith('SELECT u.id,u.name,u.username FROM hatask_flower_discovery')) return [{ id: 'owner', name: null, username: 'owner' }];
		if (sql.startsWith('INSERT INTO hatask_flower_harvest')) {
			harvested.push({ speciesId: String(args[2]), season: args[3] as HataskFlowerSeason, entry: JSON.parse(String(args[4])) as Flower });
			return [];
		}
		if (sql.startsWith('SELECT pg_advisory') || sql.startsWith('INSERT ') || sql.startsWith('UPDATE ')) return [];
		if (sql.startsWith('SELECT 1 FROM hatask_drop_ledger') || sql.startsWith('SELECT source,count(*)') || sql.startsWith('SELECT "sourceId",day,title') || sql.startsWith('SELECT id,"createdAt" FROM hatask_flower_todo') || sql.startsWith('SELECT u.id,u.name,u.username FROM hatask_flower_participant') || sql.startsWith('SELECT target FROM hatask_flower_request')) return [];
		throw new Error(`Unexpected flower query: ${sql}`);
	}) };
	const service = new HataskFlowerV2Service({ transaction: async (callback: (m: typeof manager) => Promise<unknown>) => callback(manager) } as never, { gen: () => `flower-${++generatedIds}` } as never, {} as never);
	const internals = service as unknown as { newFlower: (m: typeof manager, w: typeof wallet, now: Date) => Promise<Flower> };
	const addFestival = (season: HataskFlowerSeason, id = `2026-${season}`, bloomed = true, participated = true) => {
		festivals.push({ id, season, startsAt: new Date(now.getTime() - 86400000), endsAt: new Date(now.getTime() + 86400000), bloomedAt: bloomed ? now : null });
		if (participated) participants.add(id);
		return `festival:${id}`;
	};
	const completeCollection = (season: HataskFlowerSeason) => harvested.push(...HATASK_FLOWER_CATALOG.filter(flower => flower.season === season).map(flower => ({ speciesId: flower.id, season, entry: { speciesId: flower.id, season } })));
	return { service, wallet, harvested, festivals, legacy, addFestival, completeCollection, newFlower: () => internals.newFlower(manager, wallet, now) };
}

function expectCatalogFlower(flower: Flower, season: HataskFlowerSeason) {
	expect(HATASK_FLOWER_CATALOG.filter(species => species.season === season).map(species => species.id)).toContain(flower.speciesId);
	expect(flower.seedKey).toBeUndefined();
}

function existingLimitedFlower(now: Date, season: HataskFlowerSeason, seedKey?: string): Flower {
	return { id: 'existing-flower', speciesId: 'limited-evening-primrose', season, seedKey, name: '月見草', emoji: '🌼', hanakotoba: '', rare: true, startedAt: now.getTime() - 2 * 86400000, lastGrowthAt: now.getTime() - 48 * 60000, totalMinutes: 1200, targetMinutes: 4800, progress: 25, memory: ['昔の思い出', '大切に育てた日'] };
}

afterEach(() => vi.useRealTimers());

describe.each(seasons)('Hatask limited seeds in $season', ({ season, date }) => {
	test('completing all twelve catalog species cannot supply the festival flower', async () => {
		const f = fixture(new Date(date));
		f.completeCollection(season);
		expectCatalogFlower(await f.newFlower(), season);
	});

	test('previously stored collection rareSeeds cannot supply the festival flower', async () => {
		const f = fixture(new Date(date));
		f.wallet.rareSeeds.push(season);
		expectCatalogFlower(await f.newFlower(), season);
		expect(f.wallet.rareSeeds).toEqual([season]);
	});

	test('participation before bloom and another participant’s bloomed festival do not grant a seed', async () => {
		const f = fixture(new Date(date));
		f.addFestival(season, `pending-${season}`, false, true);
		f.addFestival(season, `other-${season}`, true, false);
		expectCatalogFlower(await f.newFlower(), season);
	});

	test('a bloomed festival supplies the participating owner’s limited seed', async () => {
		const f = fixture(new Date(date));
		const seedKey = f.addFestival(season);
		expect(await f.newFlower()).toMatchObject({ speciesId: 'limited-evening-primrose', name: '月見草', season, seedKey, progress: 0 });
	});

	test('a harvested limited flower consumes only its matching festival seed', async () => {
		const f = fixture(new Date(date));
		const seedKey = f.addFestival(season);
		f.harvested.push({ speciesId: 'limited-evening-primrose', season, entry: { seedKey } });
		expectCatalogFlower(await f.newFlower(), season);
	});

	test('show and harvesting a full collection stay in the normal catalog before seed delivery', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(date));
		const f = fixture(new Date(date));
		f.completeCollection(season);
		const shown = await f.service.show('owner');
		expectCatalogFlower(shown.flower, season);
		expect(shown.festival.seedReceived).toBe(false);
		shown.flower.totalMinutes = shown.flower.targetMinutes;
		const result = await f.service.harvest('owner', shown.flower.id, '');
		expectCatalogFlower(result.flower, season);
		expect(result.entry.speciesId).toBe(shown.flower.speciesId);
		expect(f.harvested).toHaveLength(13);
	});

	test('show and harvest deliver a festival flower once while preserving its receipt', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(date));
		const f = fixture(new Date(date));
		const seedKey = f.addFestival(season);
		const shown = await f.service.show('owner');
		expect(shown.flower).toMatchObject({ speciesId: 'limited-evening-primrose', seedKey, season });
		expect(shown.festival.seedReceived).toBe(true);
		shown.flower.totalMinutes = shown.flower.targetMinutes;
		const result = await f.service.harvest('owner', shown.flower.id, '');
		expect(result.entry).toMatchObject({ speciesId: 'limited-evening-primrose', seedKey, season });
		expectCatalogFlower(result.flower, season);
		expect(result.zukan.festivalSeeds).toEqual([{ id: `2026-${season}`, season }]);
	});

	test('an already growing collection reward becomes a catalog flower while keeping its growth and memories', async () => {
		const now = new Date(date);
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const f = fixture(now);
		f.wallet.rareSeeds.push(season);
		f.wallet.flower = existingLimitedFlower(now, season, `zukan:${season}`);
		const shown = await f.service.show('owner');
		expectCatalogFlower(shown.flower, season);
		expect(shown.flower).toMatchObject({ id: 'existing-flower', startedAt: now.getTime() - 2 * 86400000, lastGrowthAt: now.getTime(), totalMinutes: 1248, targetMinutes: 4800, progress: 26, memory: ['昔の思い出', '大切に育てた日'] });
	});
});

test('multiple unused festival seeds survive a season change and are consumed independently', async () => {
	const f = fixture(new Date('2026-12-15T00:00:00Z'));
	f.addFestival('spring');
	f.addFestival('summer');
	f.addFestival('autumn');
	f.festivals[0].startsAt = new Date('2026-03-01T00:00:00Z');
	f.festivals[1].startsAt = new Date('2026-06-01T00:00:00Z');
	f.festivals[2].startsAt = new Date('2026-09-01T00:00:00Z');
	for (const season of ['spring', 'summer', 'autumn'] as const) {
		const flower = await f.newFlower();
		expect(flower).toMatchObject({ speciesId: 'limited-evening-primrose', season, seedKey: `festival:2026-${season}` });
		f.harvested.push({ speciesId: flower.speciesId, season, entry: flower });
	}
	expectCatalogFlower(await f.newFlower(), 'winter');
});

test.each([
	{ speciesId: 'au1', name: 'コスモス', emoji: '🌻' },
	{ speciesId: 'legacy', name: '以前のお花', emoji: '🌺' },
])('migrating $speciesId preserves growth without attaching an unused festival seed', async ({ speciesId, name, emoji }) => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	const seedKey = f.addFestival('autumn');
	f.legacy.push({ speciesId, name, emoji, targetMinutes: 1200, totalMinutes: 600, startedAt: now.getTime() - 600 * 60000, lastGrowthAt: now.getTime() });
	const shown = await f.service.show('owner');
	expect(shown.flower).toMatchObject({ speciesId, name, emoji, targetMinutes: 1200, totalMinutes: 600, progress: 50 });
	expect(shown.flower.seedKey).toBeUndefined();
	shown.flower.totalMinutes = shown.flower.targetMinutes;
	const result = await f.service.harvest('owner', shown.flower.id, '');
	expect(result.entry.seedKey).toBeUndefined();
	expect(result.flower).toMatchObject({ speciesId: 'limited-evening-primrose', seedKey });
});

test.each(['au1', 'legacy'])('an old incorrect seed key on harvested %s does not consume the limited reward', async speciesId => {
	const f = fixture(new Date('2026-10-01T00:00:00Z'));
	const seedKey = f.addFestival('autumn');
	f.harvested.push({ speciesId, season: 'autumn', entry: { seedKey } });
	expect(await f.newFlower()).toMatchObject({ speciesId: 'limited-evening-primrose', seedKey });
});

test.each([undefined, 'festival:missing-autumn'])('an existing flower without a granted seed (%s) becomes a catalog flower', async seedKey => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	f.wallet.flower = existingLimitedFlower(now, 'autumn', seedKey);
	const shown = await f.service.show('owner');
	expectCatalogFlower(shown.flower, 'autumn');
	expect(shown.flower).toMatchObject({ id: 'existing-flower', totalMinutes: 1248, targetMinutes: 4800, progress: 26, memory: ['昔の思い出', '大切に育てた日'] });
});

test('a replacement keeps another unused festival seed available for the next flower', async () => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	const seedKey = f.addFestival('autumn');
	f.wallet.flower = existingLimitedFlower(now, 'autumn', 'zukan:autumn');
	const shown = await f.service.show('owner');
	expectCatalogFlower(shown.flower, 'autumn');
	shown.flower.totalMinutes = shown.flower.targetMinutes;
	const result = await f.service.harvest('owner', 'existing-flower', '残しておくお花');
	expectCatalogFlower(result.entry, 'autumn');
	expect(result.entry).toMatchObject({ id: 'existing-flower', nickname: '残しておくお花', memory: ['昔の思い出', '大切に育てた日'] });
	expect(result.flower).toMatchObject({ speciesId: 'limited-evening-primrose', seedKey });
});

test('a valid previous-season festival flower keeps its identity and continues growing', async () => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	const seedKey = f.addFestival('summer');
	f.wallet.flower = existingLimitedFlower(now, 'summer', seedKey);
	const shown = await f.service.show('owner');
	expect(shown.flower).toMatchObject({ id: 'existing-flower', speciesId: 'limited-evening-primrose', seedKey, season: 'summer', totalMinutes: 1248, targetMinutes: 4800, progress: 26, memory: ['昔の思い出', '大切に育てた日'] });
});

test('direct harvest replaces an ungranted bloomed flower and keeps its accumulated memories', async () => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	f.wallet.flower = existingLimitedFlower(now, 'autumn', 'zukan:autumn');
	f.wallet.flower.totalMinutes = f.wallet.flower.targetMinutes;
	const result = await f.service.harvest('owner', 'existing-flower', '');
	expectCatalogFlower(result.entry, 'autumn');
	expect(result.entry).toMatchObject({ id: 'existing-flower', totalMinutes: 4800, targetMinutes: 4800, progress: 100, memory: ['昔の思い出', '大切に育てた日'] });
	expectCatalogFlower(result.flower, 'autumn');
});

test('watering replaces an ungranted flower before applying the usual growth', async () => {
	const now = new Date('2026-10-01T00:00:00Z');
	vi.useFakeTimers();
	vi.setSystemTime(now);
	const f = fixture(now);
	f.wallet.drops = 1;
	f.wallet.flower = existingLimitedFlower(now, 'autumn', 'zukan:autumn');
	const result = await f.service.pour('owner', 'self', 'water-request');
	expectCatalogFlower(result.flower, 'autumn');
	expect(result.flower).toMatchObject({ id: 'existing-flower', totalMinutes: 1368, targetMinutes: 4800, progress: 28, memory: ['昔の思い出', '大切に育てた日'] });
	expect(result.drops).toBe(0);
});
