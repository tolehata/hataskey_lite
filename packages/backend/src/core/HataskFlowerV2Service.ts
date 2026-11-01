/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { HATASK_FLOWER_CATALOG, HATASK_FLOWER_SEASONS, type HataskFlowerSeason } from '@/misc/hatask-flower-catalog.js';
import { FLOWER_ARCHIVE_KEY, RECORD_SCOPE } from '@/server/api/endpoints/hatask/records/_shared.js';
import { recordHataskFlowerCollectionCompletion } from '@/core/hatask-flower-completion.js';
import { NotificationService } from './NotificationService.js';
import { DEFAULT_FLOWER_RULES, flowerDay, flowerResetAt, flowerSeason, lockHataskFlowerWallet, normalizeFlowerTodoTitle } from './hatask-flower-v2.js';
import { validTodayJournalRow } from './hatagoes-daily.js';
import type { DataSource, EntityManager } from 'typeorm';

type Flower = { seedKey?: string; id: string; speciesId: string; season: HataskFlowerSeason; emoji: string; name: string; hanakotoba: string; rare: boolean; startedAt: number; lastGrowthAt: number; totalMinutes: number; targetMinutes: number; progress: number; memory: string[] };
type Wallet = { userId: string; drops: number; timezone: string | null; flower: Flower | null; seeds: HataskFlowerSeason[]; rareSeeds: HataskFlowerSeason[] };
export type FlowerReward = { granted: boolean; why?: 'rewarded' | 'short' | 'dup' | 'young' | 'cap' | 'gap' | 'store'; left?: number };
type Rules = typeof DEFAULT_FLOWER_RULES;
/** Keep a whole percentage stable when repeated fractional awards land just below its binary representation. */
function flowerProgress(totalMinutes: number, targetMinutes: number): number {
	return Math.min(100, Math.floor(totalMinutes / targetMinutes * 100 + 1e-9));
}
export const HATAGOES_RITUALS = ['mood', 'meal', 'todo', 'water', 'reading'] as const;
export type HatagoesRitual = typeof HATAGOES_RITUALS[number];
const ritualSource = (ritual: HatagoesRitual) => `hatagoes-${ritual}`;
const previousDay = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

@Injectable()
export class HataskFlowerV2Service {
	constructor(@Inject(DI.db) private db: DataSource, private idService: IdService, private notificationService: NotificationService) {}

	private async notice(m: EntityManager, userId: string, type: string, sourceId: string): Promise<void> {
		await m.query('INSERT INTO hatask_flower_notice("userId",type,"sourceId") VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [userId, type, sourceId]);
	}
	/** Durable outbox also finds time-grown flowers while their owners are offline. */
	public async checkNotifications(): Promise<void> {
		const ready = await this.db.query(`SELECT "userId" FROM hatask_drop_wallet WHERE flower IS NOT NULL AND (flower->>'totalMinutes')::numeric + GREATEST(0,(extract(epoch FROM now())*1000-(flower->>'lastGrowthAt')::numeric)/60000) >= (flower->>'targetMinutes')::numeric AND NOT EXISTS (SELECT 1 FROM hatask_flower_notice n WHERE n."userId"=hatask_drop_wallet."userId" AND n.type='hataskFlowerBloomed' AND n."sourceId"=flower->>'id') LIMIT 1000`);
		for (const { userId } of ready) await this.db.transaction(async m => { const w = await this.wallet(m, userId); await this.grow(m, w, new Date()); await this.save(m, w); });
		const pending = await this.db.query('SELECT * FROM hatask_flower_notice WHERE "sentAt" IS NULL AND type = ANY($1::varchar[]) LIMIT 1000', [['hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed']]);
		for (const notice of pending) await this.db.transaction(async m => {
			const [n] = await m.query('SELECT * FROM hatask_flower_notice WHERE "userId"=$1 AND type=$2 AND "sourceId"=$3 AND "sentAt" IS NULL FOR UPDATE SKIP LOCKED', [notice.userId, notice.type, notice.sourceId]);
			if (!n) return;
			const type = n.type as 'hataskFlowerBloomed' | 'hataskZukanUpdated' | 'hataskFestivalBloomed';
			const body = { hataskFlowerBloomed: 'お花が咲きました。収穫できます。', hataskZukanUpdated: 'お花の図鑑が増えました。', hataskFestivalBloomed: '花まつりが満開になりました。限定の種が届きました。' }[type];
			await this.notificationService.createNotificationAsync(n.userId, type, { customHeader: 'Hataskのお花', customBody: body, customIcon: null, customLink: '/hatask?tab=garden' }, null, `flower-v2:${type}:${n.sourceId}`);
			await m.query('UPDATE hatask_flower_notice SET "sentAt"=now() WHERE "userId"=$1 AND type=$2 AND "sourceId"=$3', [n.userId, type, n.sourceId]);
		});
	}
	private async rules(m: EntityManager): Promise<Rules> {
		const rows = await m.query('SELECT "hataskFlowerRules" AS rules FROM meta LIMIT 1');
		const value = { ...DEFAULT_FLOWER_RULES };
		for (const key of Object.keys(value) as (keyof Rules)[]) {
			const n = rows[0]?.rules?.[key];
			if (Number.isInteger(n) && n >= 1 && n <= 100000) value[key] = n;
		}
		return value;
	}

	private async wallet(m: EntityManager, userId: string, timezone?: string): Promise<Wallet> {
		// Every balance, reward, growth and seed mutation takes this same lock.
		await lockHataskFlowerWallet(m, userId);
		await m.query('INSERT INTO hatask_drop_wallet("userId") VALUES($1) ON CONFLICT DO NOTHING', [userId]);
		const [w] = await m.query('SELECT * FROM hatask_drop_wallet WHERE "userId"=$1 FOR UPDATE', [userId]) as Wallet[];
		if (w.timezone == null && timezone) {
			try { flowerDay(new Date(), timezone); w.timezone = timezone; } catch { /* Invalid client timezone uses server timezone. */ }
		}
		return w;
	}
	private async save(m: EntityManager, w: Wallet): Promise<void> {
		await m.query('UPDATE hatask_drop_wallet SET drops=$2, timezone=$3, flower=$4, seeds=$5, "rareSeeds"=$6 WHERE "userId"=$1', [w.userId, w.drops, w.timezone, w.flower == null ? null : JSON.stringify(w.flower), JSON.stringify(w.seeds), JSON.stringify(w.rareSeeds)]);
	}
	private season(now: Date): HataskFlowerSeason {
		return flowerSeason(now);
	}
	private async festivalSeeds(m: EntityManager, userId: string): Promise<{ id: string; season: HataskFlowerSeason }[]> {
		return m.query('SELECT f.id,f.season FROM hatask_flower_participant p JOIN hatask_flower_festival f ON f.id=p."festivalId" WHERE p."userId"=$1 AND f."bloomedAt" IS NOT NULL ORDER BY f."startsAt"', [userId]);
	}
	private catalogSpecies(w: Wallet, discovered: { speciesId: string }[], now: Date) {
		let season = this.season(now);
		if (season === 'winter' && !w.seeds.includes('winter')) season = 'autumn';
		const all = HATASK_FLOWER_CATALOG.filter(f => f.season === season);
		const missing = all.filter(f => !discovered.some(e => e.speciesId === f.id));
		const choices = missing.length ? missing : all;
		return choices[randomInt(choices.length)];
	}
	private async newFlower(m: EntityManager, w: Wallet, now: Date): Promise<Flower> {
		const discovered: { speciesId: string; season: HataskFlowerSeason; entry: { seedKey?: string } }[] = await m.query('SELECT "speciesId",season,entry FROM hatask_flower_harvest WHERE "userId"=$1', [w.userId]);
		for (const s of HATASK_FLOWER_SEASONS) {
			const count = new Set(discovered.filter(e => e.season === s && HATASK_FLOWER_CATALOG.some(f => f.id === e.speciesId)).map(e => e.speciesId)).size;
			if (count >= 12 && !w.rareSeeds.includes(s)) w.rareSeeds.push(s);
		}
		const festivals = await this.festivalSeeds(m, w.userId);
		// 月見草 is a festival reward: collection completion alone does not grant its seed.
		const seeds = festivals.map(f => ({ key: `festival:${f.id}`, season: f.season }));
		const seed = seeds.find(s => !discovered.some(e => e.speciesId === 'limited-evening-primrose' && e.entry.seedKey === s.key));
		if (seed) {
			// The supplied design names only 月見草 as a limited seed. Keep that
			// cultivar for all seasons instead of inventing additional artwork/species.
			return { id: this.idService.gen(), speciesId: 'limited-evening-primrose', seedKey: seed.key, season: seed.season, emoji: '🌼', name: '月見草', hanakotoba: '', rare: true, startedAt: now.getTime(), lastGrowthAt: now.getTime(), totalMinutes: 0, targetMinutes: randomInt(2880, 5761), progress: 0, memory: [] };
		}
		const species = this.catalogSpecies(w, discovered, now);
		return { ...species, id: this.idService.gen(), speciesId: species.id, startedAt: now.getTime(), lastGrowthAt: now.getTime(), totalMinutes: 0, targetMinutes: species.rare ? randomInt(2880, 5761) : randomInt(480, 1921), progress: 0, memory: [] };
	}
	private async grow(m: EntityManager, w: Wallet, now: Date): Promise<Flower> {
		if (!w.flower) {
			const rows = await m.query('SELECT value FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=$2 AND key=$3 ORDER BY "updatedAt" DESC LIMIT 1', [w.userId, ['client', 'hatask'], 'flower']);
			const old = rows[0]?.value;
			w.flower = await this.newFlower(m, w, now);
			if (old && typeof old === 'object') {
				const f = w.flower;
				// Importing a legacy flower must not consume the newly selected festival seed.
				delete f.seedKey;
				const species = HATASK_FLOWER_CATALOG.find(s => s.id === old.speciesId || (typeof old.name === 'string' && old.name.endsWith(s.name) && old.emoji === s.emoji));
				if (species) { Object.assign(f, species); f.speciesId = species.id; f.id = this.idService.gen(); if (typeof old.name === 'string' && old.name.trim()) f.name = old.name.slice(0, 80); }
				// Preserve legacy flowers even when they are outside the new seasonal catalog.
				else { f.speciesId = 'legacy'; f.name = String(old.name || f.name).slice(0, 80); f.emoji = String(old.emoji || f.emoji).slice(0, 32); f.rare = old.rare === true; }
				const number = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
				f.targetMinutes = Math.max(480, Math.min(f.rare ? 5760 : 1920, number(old.targetMinutes, 1200)));
				f.totalMinutes = Math.max(0, Math.min(f.targetMinutes, number(old.totalMinutes, 0)));
				f.startedAt = Math.max(1, Math.min(now.getTime(), number(old.startedAt, now.getTime())));
				f.lastGrowthAt = Math.max(f.startedAt, Math.min(now.getTime(), number(old.lastGrowthAt, f.startedAt + f.totalMinutes * 60000)));
			}
		}
		const f = w.flower;
		if (f.speciesId === 'limited-evening-primrose') {
			const seeds = f.seedKey?.startsWith('festival:') ? await this.festivalSeeds(m, w.userId) : [];
			if (!seeds.some(seed => f.seedKey === `festival:${seed.id}` && f.season === seed.season)) {
				const discovered: { speciesId: string }[] = await m.query('SELECT "speciesId",season,entry FROM hatask_flower_harvest WHERE "userId"=$1', [w.userId]);
				const species = this.catalogSpecies(w, discovered, now);
				// Repair unearned limited flowers without resetting growth, identity or memories.
				Object.assign(f, species, { id: f.id, speciesId: species.id });
				delete f.seedKey;
			}
		}
		const elapsed = Math.max(0, Math.floor((now.getTime() - f.lastGrowthAt) / 60000));
		f.totalMinutes = Math.min(f.targetMinutes, f.totalMinutes + elapsed);
		f.lastGrowthAt += elapsed * 60000;
		f.progress = flowerProgress(f.totalMinutes, f.targetMinutes);
		if (f.progress >= 100) await this.notice(m, w.userId, 'hataskFlowerBloomed', f.id);
		return f;
	}
	private async grant(m: EntityManager, w: Wallet, source: 'todo' | 'hatady' | 'login', sourceId: string, now: Date, rules: Rules, title?: string, createdAt?: Date): Promise<FlowerReward> {
		const day = flowerDay(now, w.timezone);
		const existing = await m.query('SELECT 1 FROM hatask_drop_ledger WHERE "userId"=$1 AND source=$2 AND "sourceId"=$3', [w.userId, source, sourceId]);
		if (existing.length) return { granted: false, why: 'rewarded' };
		if (source === 'todo') {
			if ([...(title ?? '')].length < rules.todoMinLength) return { granted: false, why: 'short' };
			const dup = await m.query('SELECT 1 FROM hatask_drop_ledger WHERE "userId"=$1 AND day=$2 AND source=$3 AND title=$4', [w.userId, day, source, title]);
			if (dup.length) return { granted: false, why: 'dup' };
			const age = (now.getTime() - (createdAt?.getTime() ?? now.getTime())) / 60000;
			if (age < rules.todoMinAgeMinutes) return { granted: false, why: 'young', left: Math.ceil(rules.todoMinAgeMinutes - age) };
		}
		if (source === 'hatady') {
			const [last] = await m.query('SELECT "createdAt" FROM hatask_drop_ledger WHERE "userId"=$1 AND source=$2 ORDER BY "createdAt" DESC LIMIT 1', [w.userId, source]);
			if (last && now.getTime() - new Date(last.createdAt).getTime() < rules.hatadyGapSeconds * 1000) return { granted: false, why: 'gap' };
		}
		const [count] = await m.query('SELECT count(*)::int AS count FROM hatask_drop_ledger WHERE "userId"=$1 AND source=$2 AND day=$3', [w.userId, source, day]);
		if (count.count >= rules[`${source}Cap`]) return { granted: false, why: 'cap' };
		await m.query('INSERT INTO hatask_drop_ledger("userId",source,"sourceId",day,title,"createdAt") VALUES($1,$2,$3,$4,$5,$6)', [w.userId, source, sourceId, day, title ?? null, now]);
		if (w.drops >= 20) return { granted: false, why: 'store' };
		w.drops++;
		return { granted: true };
	}
	private async markObserved(m: EntityManager, w: Wallet, now: Date): Promise<void> {
		const day = flowerDay(now, w.timezone);
		await m.query('INSERT INTO hatask_drop_ledger("userId",source,"sourceId",day,title,"createdAt") VALUES($1,$2,$3,$4,NULL,$5) ON CONFLICT DO NOTHING', [w.userId, 'hatagoes-start', 'v3', day, now]);
	}
	private async awardRitual(m: EntityManager, w: Wallet, ritual: HatagoesRitual, now: Date): Promise<boolean> {
		await this.markObserved(m, w, now);
		const day = flowerDay(now, w.timezone);
		const inserted = await m.query('INSERT INTO hatask_drop_ledger("userId",source,"sourceId",day,title,"createdAt") VALUES($1,$2,$3,$3,NULL,$4) ON CONFLICT DO NOTHING RETURNING source', [w.userId, ritualSource(ritual), day, now]);
		if (!inserted.length) return false;
		const flower = await this.grow(m, w, now);
		flower.totalMinutes = Math.min(flower.targetMinutes, flower.totalMinutes + flower.targetMinutes * 0.02);
		flower.progress = flowerProgress(flower.totalMinutes, flower.targetMinutes);
		if (flower.progress >= 100) await this.notice(m, w.userId, 'hataskFlowerBloomed', flower.id);
		return true;
	}
	/** Call only from an already validated, persisted action in the same transaction. */
	public async onJournalCommitted(m: EntityManager, userId: string, ritual: 'mood' | 'meal', now: Date = new Date()): Promise<void> {
		const w = await this.wallet(m, userId);
		await this.awardRitual(m, w, ritual, now);
		await this.save(m, w);
	}
	public async daily(userId: string, timezone?: string) {
		return this.db.transaction(async m => {
			const w = await this.wallet(m, userId, timezone), now = new Date();
			await this.markObserved(m, w, now);
			const today = flowerDay(now, w.timezone);
			const registry: { key: string; value: unknown }[] = await m.query('SELECT key,value FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=$2 AND key=ANY($3::varchar[]) ORDER BY "updatedAt" DESC,id DESC', [userId, ['client', 'hatask'], ['moods', 'meals', 'todos']]);
			const latest = new Map<string, unknown>();
			for (const row of registry) if (!latest.has(row.key)) latest.set(row.key, row.value);
			for (const [key, ritual] of [['moods', 'mood'], ['meals', 'meal']] as const) {
				const value = latest.get(key);
				if (Array.isArray(value) && value.some(row => validTodayJournalRow(row, ritual, today))) await this.awardRitual(m, w, ritual, now);
			}
			const todos = latest.get('todos');
			if (Array.isArray(todos) && todos.some(row => row != null && typeof row === 'object' && !Array.isArray(row) && typeof row.id === 'string' && row.done === true && typeof row.doneAt === 'string' && !Number.isNaN(Date.parse(row.doneAt)) && flowerDay(new Date(row.doneAt), w.timezone) === today)) await this.awardRitual(m, w, 'todo', now);
			const readings: { studiedAt: Date }[] = await m.query('SELECT "studiedAt" FROM hatady_log WHERE "userId"=$1 AND "bookId" IS NOT NULL AND kind=$2 AND "studiedAt">=$3 AND "studiedAt"<$4', [userId, 'study', new Date(now.getTime() - 48 * 3600000), new Date(now.getTime() + 24 * 3600000)]);
			if (readings.some(row => flowerDay(new Date(row.studiedAt), w.timezone) === today)) await this.awardRitual(m, w, 'reading', now);
			await this.save(m, w);
			const rows: { source: string; day: string }[] = await m.query('SELECT source,day FROM hatask_drop_ledger WHERE "userId"=$1 AND (source=$2 OR source=ANY($3::varchar[]))', [userId, 'hatagoes-start', HATAGOES_RITUALS.map(ritualSource)]);
			const trackedSince = rows.find(row => row.source === 'hatagoes-start')?.day ?? null;
			const byDay = new Map<string, Set<HatagoesRitual>>();
			for (const row of rows) {
				const ritual = row.source.replace(/^hatagoes-/, '') as HatagoesRitual;
				if (!HATAGOES_RITUALS.includes(ritual)) continue;
				const completed = byDay.get(row.day) ?? new Set<HatagoesRitual>();
				completed.add(ritual); byDay.set(row.day, completed);
			}
			const days = Array.from({ length: 14 }, (_, index) => {
				let date = today;
				for (let offset = 0; offset < 13 - index; offset++) date = previousDay(date);
				const completed = HATAGOES_RITUALS.filter(ritual => byDay.get(date)?.has(ritual));
				return { date, known: trackedSince != null && date >= trackedSince, completed, count: completed.length, complete: completed.length === HATAGOES_RITUALS.length };
			});
			let cursor = byDay.get(today)?.size === HATAGOES_RITUALS.length ? today : previousDay(today);
			let streakDays = 0;
			while (trackedSince != null && cursor >= trackedSince && byDay.get(cursor)?.size === HATAGOES_RITUALS.length) { streakDays++; cursor = previousDay(cursor); }
			return { today, timezone: w.timezone, trackedSince, days, streakDays, awardedToday: (byDay.get(today)?.size ?? 0) * 2 };
		});
	}
	public async onHatadyCreated(m: EntityManager, userId: string, id: string): Promise<FlowerReward> {
		const w = await this.wallet(m, userId); const now = new Date();
		const [reading] = await m.query('SELECT "studiedAt" FROM hatady_log WHERE id=$1 AND "userId"=$2 AND "bookId" IS NOT NULL AND kind=$3', [id, userId, 'study']);
		if (reading && flowerDay(new Date(reading.studiedAt), w.timezone) === flowerDay(now, w.timezone)) await this.awardRitual(m, w, 'reading', now);
		const result = await this.grant(m, w, 'hatady', id, now, await this.rules(m)); await this.save(m, w); return result;
	}
	public async onTodosCommitted(m: EntityManager, userId: string, previous: Record<string, unknown>[], next: Record<string, unknown>[]): Promise<Record<string, FlowerReward>> {
		const w = await this.wallet(m, userId), now = new Date(), rules = await this.rules(m), result: Record<string, FlowerReward> = {};
		const prior = new Map(previous.map(t => [t.id, t]));
		// Server first-seen timestamps cannot be backdated through a client-created todo.
		const trackedIds = next.map(t => String(t.id)).filter(id => id.length <= 128);
		await m.query('INSERT INTO hatask_flower_todo("userId",id,"createdAt") SELECT $1,unnest($2::varchar[]),$3 ON CONFLICT DO NOTHING', [userId, trackedIds, now]);
		const trackedRows: { id: string; createdAt: Date }[] = await m.query('SELECT id,"createdAt" FROM hatask_flower_todo WHERE "userId"=$1', [userId]);
		const trackedById = new Map(trackedRows.map(t => [t.id, t.createdAt]));
		for (const todo of next) {
			const id = String(todo.id); const old = prior.get(id);
			const createdAt = trackedById.get(id);
			if (!createdAt) continue;
			if (todo.done !== true || old?.done === true || !old) continue;
			await this.awardRitual(m, w, 'todo', now);
			const f = await this.grow(m, w, now);
			if (f.progress < 100 && f.memory.length < 6 && typeof todo.text === 'string' && !f.memory.includes(todo.text.slice(0, 512))) f.memory.push(todo.text.slice(0, 512));
			result[id] = await this.grant(m, w, 'todo', id, now, rules, normalizeFlowerTodoTitle(String(todo.text)), new Date(createdAt));
		}
		await this.save(m, w); return result;
	}
	private async festival(m: EntityManager, w: Wallet, now: Date, rules: Rules) {
		const season = this.season(now), year = new Date(now.getTime() + 9 * 3600000).getUTCFullYear();
		const startYear = season === 'winter' && new Date(now.getTime() + 9 * 3600000).getUTCMonth() < 2 ? year - 1 : year;
		const month = { spring: 2, summer: 5, autumn: 8, winter: 11 }[season];
		const startsAt = new Date(Date.UTC(startYear, month, 1) - 9 * 3600000), endsAt = new Date(Date.UTC(startYear, month + 3, 1) - 9 * 3600000), id = `${startYear}-${season}`;
		await m.query('INSERT INTO hatask_flower_festival(id,season,goal,"startsAt","endsAt") VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [id, season, rules.festivalGoal, startsAt, endsAt]);
		const [f] = await m.query('SELECT * FROM hatask_flower_festival WHERE id=$1', [id]);
		const recentParticipants = await m.query('SELECT u.id,u.name,u.username FROM hatask_flower_participant p JOIN "user" u ON u.id=p."userId" WHERE p."festivalId"=$1 ORDER BY p."updatedAt" DESC LIMIT 5', [id]);
		const participated = (await m.query('SELECT 1 FROM hatask_flower_participant WHERE "festivalId"=$1 AND "userId"=$2', [id, w.userId])).length > 0;
		return { ...f, startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString(), bloomedAt: f.bloomedAt ? new Date(f.bloomedAt).toISOString() : null, participated, recentParticipants, seedReceived: participated && f.bloomedAt != null };
	}
	private async state(m: EntityManager, w: Wallet, now: Date, rules: Rules) {
		const flower = await this.grow(m, w, now);
		const rows = await m.query('SELECT source,count(*)::int AS count FROM hatask_drop_ledger WHERE "userId"=$1 AND day=$2 GROUP BY source', [w.userId, flowerDay(now, w.timezone)]);
		const today = { todo: 0, hatady: 0, login: 0 };
		for (const row of rows) if (row.source in today) today[row.source as keyof typeof today] = row.count;
		const entries = (await m.query('SELECT entry FROM hatask_flower_harvest WHERE "userId"=$1 ORDER BY id DESC', [w.userId])).map((r: { entry: Record<string, unknown> }) => r.entry);
		const archiveRows: { value: unknown }[] = await m.query('SELECT value FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=$2 AND key=$3 ORDER BY "updatedAt" ASC,id ASC', [w.userId, [...RECORD_SCOPE], FLOWER_ARCHIVE_KEY]);
		const archivedEntries = archiveRows.flatMap(row => Array.isArray(row.value) ? row.value : []);
		const seedAvailable: HataskFlowerSeason[] = [];
		for (const [i, season] of HATASK_FLOWER_SEASONS.entries()) {
			const count = new Set(entries.filter((e: { season: string }) => e.season === season).map((e: { speciesId: string }) => e.speciesId).filter((id: string) => HATASK_FLOWER_CATALOG.some(f => f.id === id))).size;
			const next = HATASK_FLOWER_SEASONS[(i + 1) % 4];
			if (count >= 8 && !w.seeds.includes(next)) seedAvailable.push(next);
			if (count >= 12 && !w.rareSeeds.includes(season)) w.rareSeeds.push(season);
		}
		const festival = await this.festival(m, w, now, rules);
		const festivalSeeds = await this.festivalSeeds(m, w.userId);
		const ledger = await m.query('SELECT "sourceId",day,title FROM hatask_drop_ledger WHERE "userId"=$1 AND source=$2', [w.userId, 'todo']);
		const tracked = await m.query('SELECT id,"createdAt" FROM hatask_flower_todo WHERE "userId"=$1', [w.userId]);
		const registry = await m.query('SELECT value FROM registry_item WHERE "userId"=$1 AND domain IS NULL AND scope=$2 AND key=$3 ORDER BY "updatedAt" DESC LIMIT 1', [w.userId, ['client','hatask'], 'todos']);
		const todoRewards: Record<string, FlowerReward> = {};
		for (const todo of Array.isArray(registry[0]?.value) ? registry[0].value : []) {
			const title = normalizeFlowerTodoTitle(String(todo.text ?? ''));
			const age = (now.getTime() - new Date(tracked.find((t: { id: string }) => t.id === todo.id)?.createdAt ?? now).getTime()) / 60000;
			todoRewards[todo.id] = ledger.some((l: { sourceId: string }) => l.sourceId === todo.id) ? { granted: true, why: 'rewarded' }
				: [...title].length < rules.todoMinLength ? { granted: false, why: 'short' }
					: ledger.some((l: { day: string; title: string }) => l.day === flowerDay(now, w.timezone) && l.title === title) ? { granted: false, why: 'dup' }
						: age < rules.todoMinAgeMinutes ? { granted: false, why: 'young', left: Math.ceil(rules.todoMinAgeMinutes - age) }
							: today.todo >= rules.todoCap ? { granted: false, why: 'cap' } : { granted: false };
		}
		await this.save(m, w);
		return { todoRewards, drops: w.drops, store: 20, today, caps: { todo: rules.todoCap, hatady: rules.hatadyCap, login: rules.loginCap }, resetAt: flowerResetAt(now, w.timezone), rules, flower, zukan: { catalog: HATASK_FLOWER_CATALOG, entries, archivedEntries, unlockedSeasons: HATASK_FLOWER_SEASONS.filter(s => s !== 'winter' || w.seeds.includes(s)), seedAvailable, seedClaimed: w.seeds, rareSeeds: w.rareSeeds, festivalSeeds }, festival };
	}
	public async show(userId: string, timezone?: string) {
		return this.db.transaction(async m => { const w = await this.wallet(m, userId, timezone), now = new Date(), rules = await this.rules(m); const reward = await this.grant(m, w, 'login', flowerDay(now, w.timezone), now, rules); return { ...await this.state(m, w, now, rules), reward }; });
	}
	public async pour(userId: string, target: 'self' | 'festival', requestId: string, timezone?: string) {
		return this.db.transaction(async m => {
			const w = await this.wallet(m, userId, timezone), now = new Date(), rules = await this.rules(m);
			const [existing] = await m.query('SELECT target FROM hatask_flower_request WHERE "userId"=$1 AND id=$2', [userId, requestId]);
			if (existing) { if (existing.target !== target) throw new Error('HATASK_FLOWER_REQUEST_CONFLICT'); return this.state(m, w, now, rules); }
			if (w.drops < 1) throw new Error('HATASK_FLOWER_NO_DROPS');
			if (target === 'self') {
				const f = await this.grow(m, w, now); if (f.progress >= 100) throw new Error('HATASK_FLOWER_BLOOMED');
				f.totalMinutes = Math.min(f.targetMinutes, f.totalMinutes + rules.pourMinutes); f.progress = flowerProgress(f.totalMinutes, f.targetMinutes);
				await this.awardRitual(m, w, 'water', now);
			} else {
				const f = await this.festival(m, w, now, rules);
				const changed = await m.query('UPDATE hatask_flower_festival SET total=total+1,"bloomedAt"=CASE WHEN total+1>=goal THEN $2 ELSE NULL END WHERE id=$1 AND "bloomedAt" IS NULL AND "startsAt"<=$2 AND "endsAt">$2 RETURNING id,"bloomedAt"', [f.id, now]);
				if (!changed.length) throw new Error('HATASK_FLOWER_FESTIVAL_CLOSED');
				await m.query('INSERT INTO hatask_flower_participant("festivalId","userId","updatedAt") VALUES($1,$2,$3) ON CONFLICT("festivalId","userId") DO UPDATE SET count=hatask_flower_participant.count+1,"updatedAt"=$3', [f.id, userId, now]);
				if (changed[0].bloomedAt) await m.query(`INSERT INTO hatask_flower_notice("userId",type,"sourceId") SELECT "userId",'hataskFestivalBloomed',"festivalId" FROM hatask_flower_participant WHERE "festivalId"=$1 ON CONFLICT DO NOTHING`, [f.id]);
			}
			w.drops--; await m.query('INSERT INTO hatask_flower_request("userId",id,target) VALUES($1,$2,$3)', [userId, requestId, target]);
			return this.state(m, w, now, rules);
		});
	}
	public async harvest(userId: string, flowerId: string, nickname: string, timezone?: string) {
		return this.db.transaction(async m => {
			const w = await this.wallet(m, userId, timezone), now = new Date(), rules = await this.rules(m);
			const [existing] = await m.query('SELECT entry FROM hatask_flower_harvest WHERE id=$1 AND "userId"=$2', [flowerId, userId]);
			if (existing) return { ...await this.state(m, w, now, rules), entry: existing.entry };
			const f = await this.grow(m, w, now);
			if (f.id !== flowerId || f.progress < 100) throw new Error('HATASK_FLOWER_NOT_READY');
			let rank: number | null = null;
			let firstUser: { id: string; name: string | null; username: string } | null = null;
			if (f.speciesId !== 'legacy') {
				await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-species:${f.speciesId}`]);
				await m.query('INSERT INTO hatask_flower_discovery("speciesId","userId",rank) SELECT $1::varchar,$2::varchar,COALESCE(MAX(rank),0)+1 FROM hatask_flower_discovery WHERE "speciesId"=$1 ON CONFLICT("speciesId","userId") DO NOTHING', [f.speciesId, userId]);
				const [discovery] = await m.query('SELECT rank FROM hatask_flower_discovery WHERE "speciesId"=$1 AND "userId"=$2', [f.speciesId, userId]);
				const [first] = await m.query('SELECT u.id,u.name,u.username FROM hatask_flower_discovery d JOIN "user" u ON u.id=d."userId" WHERE d."speciesId"=$1 ORDER BY d.rank LIMIT 1', [f.speciesId]);
				rank = discovery.rank; firstUser = first;
			}
			const entry = { ...f, nickname: [...nickname.trim()].slice(0, 80).join(''), harvestedAt: now.toISOString(), rank, first: rank === 1, firstUser };
			await m.query('INSERT INTO hatask_flower_harvest(id,"userId","speciesId",season,entry) VALUES($1,$2,$3,$4,$5)', [f.id, userId, f.speciesId, f.season, JSON.stringify(entry)]);
			await recordHataskFlowerCollectionCompletion(m, userId, now);
			await m.query('INSERT INTO hatask_flower(id,"userId","clientFlowerId",emoji,name,hanakotoba,"harvestedAt") VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT("userId","clientFlowerId") DO UPDATE SET emoji=EXCLUDED.emoji,name=EXCLUDED.name,hanakotoba=EXCLUDED.hanakotoba,"harvestedAt"=EXCLUDED."harvestedAt"', [this.idService.gen(), userId, f.id, f.emoji, entry.nickname || f.name, f.hanakotoba, now]);
			await this.notice(m, userId, 'hataskZukanUpdated', f.speciesId);
			w.flower = await this.newFlower(m, w, now);
			return { ...await this.state(m, w, now, rules), entry };
		});
	}
	public async rename(userId: string, flowerId: string, nickname: string, timezone?: string) {
		return this.db.transaction(async m => {
			const w = await this.wallet(m, userId, timezone), now = new Date(), rules = await this.rules(m);
			const [record] = await m.query('SELECT entry FROM hatask_flower_harvest WHERE id=$1 AND "userId"=$2 FOR UPDATE', [flowerId, userId]);
			if (!record) throw new Error('HATASK_FLOWER_NOT_FOUND');
			record.entry.nickname = [...nickname.trim()].slice(0, 80).join('');
			await m.query('UPDATE hatask_flower_harvest SET entry=$3 WHERE id=$1 AND "userId"=$2', [flowerId, userId, JSON.stringify(record.entry)]);
			await m.query('UPDATE hatask_flower SET name=$3 WHERE "clientFlowerId"=$1 AND "userId"=$2', [flowerId, userId, record.entry.nickname || record.entry.name]);
			return this.state(m, w, now, rules);
		});
	}
	public async claimSeed(userId: string, season: HataskFlowerSeason, timezone?: string) {
		return this.db.transaction(async m => {
			const w = await this.wallet(m, userId, timezone), now = new Date(), rules = await this.rules(m);
			const state = await this.state(m, w, now, rules);
			if (!w.seeds.includes(season)) { if (!state.zukan.seedAvailable.includes(season)) throw new Error('HATASK_FLOWER_SEED_LOCKED'); w.seeds.push(season); }
			return this.state(m, w, now, rules);
		});
	}
}
