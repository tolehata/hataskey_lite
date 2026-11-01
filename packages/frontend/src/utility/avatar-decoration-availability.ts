/* SPDX-License-Identifier: AGPL-3.0-only */

export type DecorationAvailability = {
	roleIdsThatCanBeUsedThisDecoration: string[];
	requiresHataskFlowerCompletion?: boolean;
	availableFrom?: string | null;
	availableUntil?: string | null;
	canUse?: boolean;
	unavailableReason?: 'role' | 'achievement' | 'notStarted' | 'expired' | null;
};

/** Time is checked again locally so an open picker cannot outlive its deadline. */
export function decorationUnavailableReason(decoration: DecorationAvailability, roleIds: string[], now: number): DecorationAvailability['unavailableReason'] {
	if (decoration.availableUntil != null && Date.parse(decoration.availableUntil) <= now) return 'expired';
	if (decoration.availableFrom != null && Date.parse(decoration.availableFrom) > now) return 'notStarted';
	if (decoration.roleIdsThatCanBeUsedThisDecoration.length > 0 && !roleIds.some(id => decoration.roleIdsThatCanBeUsedThisDecoration.includes(id))) return 'role';
	if (decoration.unavailableReason === 'achievement') return 'achievement';
	// Missing authorization information must not unlock a restricted decoration.
	if (decoration.canUse === false) return decoration.unavailableReason ?? 'role';
	if (decoration.requiresHataskFlowerCompletion && decoration.canUse !== true) return 'achievement';
	return null;
}

export function isDecorationWithinPeriod(decoration: { availableFrom?: string | null; availableUntil?: string | null }, now: number): boolean {
	return (decoration.availableFrom == null || Date.parse(decoration.availableFrom) <= now)
		&& (decoration.availableUntil == null || now < Date.parse(decoration.availableUntil));
}
