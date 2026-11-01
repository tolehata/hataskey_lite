/* SPDX-License-Identifier: AGPL-3.0-only */
import type { entities } from 'cherrypick-js';

export type UtageSnapshot = Pick<entities.Note, 'utageStatus' | 'utageRevision' | 'utageExpiresAt' | 'utageServerNow' | 'utageRevival' | 'utageSuccessMethod' | 'utageMyParticipation'>;
export type UtageEvent = UtageSnapshot & { status?: UtageSnapshot['utageStatus'] };
export function pickUtage(note: UtageSnapshot): UtageSnapshot {
	return { utageStatus: note.utageStatus, utageRevision: note.utageRevision, utageExpiresAt: note.utageExpiresAt, utageServerNow: note.utageServerNow,
										utageRevival: note.utageRevival, utageSuccessMethod: note.utageSuccessMethod, utageMyParticipation: note.utageMyParticipation };
}
export function applyUtage(target: UtageSnapshot, incoming: UtageEvent, personal = false): boolean {
	const status = incoming.utageStatus ?? incoming.status;
	if (!status || !['running', 'reviving', 'succeeded', 'failed'].includes(status)) return false;
	if ((incoming.utageRevision ?? -1) < (target.utageRevision ?? -1)) return false;
	if ((target.utageStatus === 'succeeded' || target.utageStatus === 'failed') && status !== target.utageStatus) return false;
	const data = pickUtage(incoming);
	delete data.utageMyParticipation;
	for (const [key, value] of Object.entries(data)) if (value === undefined) delete data[key as keyof UtageSnapshot];
	Object.assign(target, data, { utageStatus: status });
	if (personal && incoming.utageMyParticipation != null) target.utageMyParticipation = incoming.utageMyParticipation;
	return true;
}
