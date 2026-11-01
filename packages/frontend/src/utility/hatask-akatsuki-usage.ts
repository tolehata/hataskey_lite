/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { miLocalStorage } from '@/local-storage.js';

export type HataskAkatsukiUsage = Record<string, { score: number; lastUsedAt: number }>;
const DAY = 86_400_000;

export function normalizeAkatsukiUsage(value: unknown, now = Date.now()): HataskAkatsukiUsage {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value).slice(0, 64).flatMap(([id, entry]) => {
		if (!/^[a-z]+$/.test(id) || !entry || typeof entry !== 'object') return [];
		const { score, lastUsedAt } = entry as Record<string, unknown>;
		if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0
			|| typeof lastUsedAt !== 'number' || !Number.isFinite(lastUsedAt) || lastUsedAt > now || lastUsedAt < now - 90 * DAY) return [];
		return [[id, { score: Math.min(100, score), lastUsedAt }]];
	}));
}

export function akatsukiUsageScore(usage: HataskAkatsukiUsage, id: string, now: number): number {
	const entry = usage[id];
	return Object.hasOwn(usage, id) ? entry.score * Math.pow(0.5, Math.max(0, now - entry.lastUsedAt) / (14 * DAY)) : 0;
}

export function readAkatsukiUsage(userId: string | undefined): HataskAkatsukiUsage {
	if (!userId) return {};
	try { return normalizeAkatsukiUsage(miLocalStorage.getItemAsJson(`hataskAkatsukiUsage:${userId}`)); } catch { return {}; }
}

/** Only tool identifiers/counts/timestamps stay on this device; no planner or journal data is written. */
export function recordAkatsukiUsage(userId: string, id: string, allowedIds: readonly string[], now = Date.now()): HataskAkatsukiUsage {
	const usage = readAkatsukiUsage(userId);
	if (!allowedIds.includes(id)) return usage;
	// Reopening or navigating within the same tool must not inflate its frequency.
	if (Object.hasOwn(usage, id) && now - usage[id].lastUsedAt < 60_000) return usage;
	const next = { ...usage, [id]: { score: Math.min(100, akatsukiUsageScore(usage, id, now) + 1), lastUsedAt: now } };
	try { miLocalStorage.setItemAsJson(`hataskAkatsukiUsage:${userId}`, next); } catch { /* Storage restrictions must not block opening a tool. */ }
	return next;
}
