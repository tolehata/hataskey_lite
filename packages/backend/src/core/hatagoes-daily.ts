/* SPDX-License-Identifier: AGPL-3.0-only */
export function validTodayJournalRow(row: unknown, kind: 'mood' | 'meal', today: string): row is { id: string } {
	if (row == null || typeof row !== 'object' || Array.isArray(row)) return false;
	const entry = row as Record<string, unknown>;
	if (entry.imported === true || typeof entry.id !== 'string' || !entry.id || entry.date !== today || typeof entry.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(entry.time)) return false;
	if (entry.note != null && typeof entry.note !== 'string') return false;
	if (entry.emoji != null && typeof entry.emoji !== 'string') return false;
	if (entry.reasons != null && (!Array.isArray(entry.reasons) || !entry.reasons.every(reason => typeof reason === 'string'))) return false;
	return kind === 'mood' ? typeof entry.level === 'number' && Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= 5
		: typeof entry.slot === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(entry.slot) && ['ate', 'little', 'none'].includes(String(entry.level));
}
