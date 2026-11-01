import type { HataskFlowerSeason } from '@/misc/hatask-flower-catalog.js';
import type { EntityManager } from 'typeorm';

/** Acquire before planner/flower row locks or writes that run the moderation trigger. */
export async function lockHataskFlowerWallet(manager: Pick<EntityManager, 'query'>, userId: string): Promise<void> {
	await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-flower:${userId}`]);
}

export const DEFAULT_FLOWER_RULES = { todoMinAgeMinutes: 30, todoMinLength: 3, hatadyGapSeconds: 60, pourMinutes: 120, todoCap: 5, hatadyCap: 10, loginCap: 1, festivalGoal: 1000 };
export function normalizeFlowerTodoTitle(title: string): string { return title.normalize('NFKC').replace(/\s/gu, '').toLowerCase(); }
export function flowerSeason(now: Date): HataskFlowerSeason {
	const month = new Date(now.getTime() + 9 * 3600000).getUTCMonth();
	return month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter';
}
export function flowerDay(now: Date, timezone?: string | null): string {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
	return ['year', 'month', 'day'].map(t => parts.find(p => p.type === t)!.value).join('-');
}
/** Find the next local calendar boundary, including 23/25 hour DST days. */
export function flowerResetAt(now: Date, timezone?: string | null): string {
	const day = flowerDay(now, timezone); let low = now.getTime(), high = low + 27 * 3600000;
	while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (flowerDay(new Date(mid), timezone) === day) low = mid; else high = mid; }
	return new Date(high).toISOString();
}
