/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

function isUserCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parseServerMembers(response: unknown): number | null {
	if (response == null || typeof response !== 'object' || Array.isArray(response) || !('originalUsersCount' in response)) return null;
	return isUserCount(response.originalUsersCount) ? response.originalUsersCount : null;
}

export function summarizeServerActivity(response: unknown): { yesterday: number; average: number } | null {
	if (response == null || typeof response !== 'object' || Array.isArray(response) || !('read' in response)) return null;
	if (!Array.isArray(response.read) || response.read.length < 8) return null;
	const yesterday: unknown = response.read[1];
	if (!isUserCount(yesterday)) return null;

	// The chart is newest-first and uses UTC days. Today is incomplete, so use
	// yesterday and the seven completed days only, matching the visitor chart's read metric.
	let total = 0;
	for (let index = 1; index <= 7; index++) {
		const count: unknown = response.read[index];
		if (!isUserCount(count)) return null;
		total += count;
	}
	const average = total / 7;
	if (!Number.isFinite(average)) return null;

	return { yesterday, average };
}
