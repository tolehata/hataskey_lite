/* SPDX-License-Identifier: AGPL-3.0-only */
import type { MiAvatarDecoration } from '@/models/AvatarDecoration.js';

export type AvatarDecorationUnavailableReason = 'role' | 'achievement' | 'notStarted' | 'expired';
type DecorationAvailability = Pick<MiAvatarDecoration, 'requiresHataskFlowerCompletion' | 'availableFrom' | 'availableUntil'>;

/** The start is inclusive; the end is exclusive, including already equipped decorations. */
export function avatarDecorationUnavailableReason(
	decoration: DecorationAvailability,
	options: { now: number; hasCompletedHataskFlower: boolean; hasRequiredRole?: boolean },
): AvatarDecorationUnavailableReason | null {
	if (decoration.availableFrom != null && decoration.availableFrom.getTime() > options.now) return 'notStarted';
	if (decoration.availableUntil != null && decoration.availableUntil.getTime() <= options.now) return 'expired';
	if (decoration.requiresHataskFlowerCompletion && !options.hasCompletedHataskFlower) return 'achievement';
	if (options.hasRequiredRole === false) return 'role';
	return null;
}

/** Accept a complete RFC3339 timestamp only; Date.parse alone normalizes nonexistent days. */
export function parseAvatarDecorationDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
	if (!match) return null;
	const [, year, month, day, hour, minute, second, , zone] = match;
	const y = Number(year), m = Number(month), d = Number(day);
	const daysInMonth = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1]) return null;
	if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
	if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return null;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}
