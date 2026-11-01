/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Keep the elapsed-time calculation compatible with frontend/utility/hatask-flower-growth.ts. */
export function getReadyHataskFlower(value: unknown, now: number): { startedAt: number } | null {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
	const raw = value as Record<string, unknown>;
	// A stable planting time is required for deduplication. Do not invent one for malformed data.
	if (typeof raw.startedAt !== 'number' || !Number.isFinite(raw.startedAt) || raw.startedAt < 1 || raw.startedAt > now) return null;
	const number = (input: unknown, fallback: number) => typeof input === 'number' && Number.isFinite(input) ? Math.floor(input) : fallback;
	const startedAt = Math.floor(raw.startedAt);
	const targetMinutes = Math.max(480, Math.min(raw.rare === true ? 5760 : 1920, number(raw.targetMinutes, 1200)));
	const totalMinutes = Math.max(0, Math.min(targetMinutes, number(raw.totalMinutes, 0)));
	const lastGrowthAt = Math.max(startedAt, Math.min(now, number(raw.lastGrowthAt, startedAt + totalMinutes * 60_000)));
	const elapsedMinutes = Math.floor(Math.max(0, now - lastGrowthAt) / 60_000);
	return totalMinutes + elapsedMinutes >= targetMinutes ? { startedAt } : null;
}
