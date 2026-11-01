/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomInt } from 'node:crypto';
import type { MiUtageSession } from '@/models/UtageSession.js';

export const UTAGE_REVIVAL_RULES = Object.freeze({ version: 1, probability: 2000, minSeconds: 30, maxSeconds: 120, maxPeople: 20 });
export type UtageStatus = 'running' | 'reviving' | 'succeeded' | 'failed';
export type UtageParticipation = 'eligible' | 'accepted' | 'existing' | 'author' | 'ineligible';
export function revivalTargetRange(online: number): [number, number] | null {
	if (!Number.isSafeInteger(online) || online < 2) return null;
	const low = Math.min(online, UTAGE_REVIVAL_RULES.maxPeople, Math.max(2, Math.ceil(online * .1)));
	return [low, Math.min(online, UTAGE_REVIVAL_RULES.maxPeople, Math.max(low, Math.ceil(online * .3)))];
}
export function drawRevival(online: number, random: typeof randomInt = randomInt) {
	const range = revivalTargetRange(online);
	return range ? { seconds: random(UTAGE_REVIVAL_RULES.minSeconds, UTAGE_REVIVAL_RULES.maxSeconds + 1), target: random(range[0], range[1] + 1) } : null;
}
export function utageSnapshot(session: MiUtageSession) {
	return {
		utageStatus: session.status as UtageStatus,
		utageRevision: session.revision,
		utageExpiresAt: session.expiresAt.toISOString(),
		utageServerNow: new Date().toISOString(),
		utageSuccessMethod: session.successMethod,
		utageRevival: session.revivalStartedAt && session.revivalExpiresAt ? {
			startedAt: session.revivalStartedAt.toISOString(), expiresAt: session.revivalExpiresAt.toISOString(),
			targetCount: session.revivalTargetCount!, reactionCount: session.revivalSupporterIds.length,
		} : null,
	};
}
