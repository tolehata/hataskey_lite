/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HataskJournalEntry } from '@/utility/hatask-journal.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { journalLocalDateTime, selectJournalEntries } from '@/utility/hatask-journal.js';

export type HatagoesRitual = 'mood' | 'meal' | 'todo' | 'water' | 'reading';
export type HatagoesDailyDay = { date: string; known: boolean; completed: HatagoesRitual[]; count: number; complete: boolean };
export type HatagoesDailySummary = { today: string; timezone: string | null; trackedSince: string | null; days: HatagoesDailyDay[]; streakDays: number; awardedToday: number };
export type HatagoesMealSlot = 'breakfast' | 'lunch' | 'dinner';
export type HatagoesJournalV3 = {
	today: string;
	mood?: HataskJournalEntry;
	week: { date: string; label: string; mood?: HataskJournalEntry }[];
	meals: { slot: HatagoesMealSlot; entry?: HataskJournalEntry }[];
};

export async function loadHatagoesDaily(): Promise<HatagoesDailySummary> {
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return await misskeyApi('hata/hatagoes/home/daily', { timezone });
}

/** A read-only projection: invalid legacy rows remain in storage, never rewritten. */
export function buildHatagoesJournalV3(moodRows: readonly unknown[], mealRows: readonly unknown[], now = new Date()): HatagoesJournalV3 {
	const moods = selectJournalEntries(moodRows, 'mood');
	const meals = selectJournalEntries(mealRows, 'meal');
	const today = journalLocalDateTime(now).date;
	const dayAgo = (offset: number) => { const day = new Date(now); day.setDate(day.getDate() - offset); return day; };
	return {
		today,
		mood: moods.find(entry => entry.date === today),
		week: Array.from({ length: 7 }, (_, index) => {
			const day = dayAgo(6 - index), date = journalLocalDateTime(day).date;
			return { date, label: day.toLocaleDateString('ja-JP', { weekday: 'short' }), mood: moods.find(entry => entry.date === date) };
		}),
		meals: (['breakfast', 'lunch', 'dinner'] as const).map(slot => ({ slot, entry: meals.find(entry => entry.date === today && entry.slot === slot) })),
	};
}

export async function loadHatagoesJournalV3(now = new Date()): Promise<HatagoesJournalV3> {
	const read = async (key: string): Promise<unknown[]> => {
		try {
			const value = await misskeyApi('i/registry/get', { key, scope: ['client', 'hatask'] });
			if (!Array.isArray(value)) throw new TypeError('記録の保存形式を読み取れませんでした');
			return value;
		} catch (error) {
			if ((error as { code?: string } | null)?.code === 'NO_SUCH_KEY') return [];
			throw error;
		}
	};
	const [moods, meals] = await Promise.all([read('moods'), read('meals')]);
	return buildHatagoesJournalV3(moods, meals, now);
}
