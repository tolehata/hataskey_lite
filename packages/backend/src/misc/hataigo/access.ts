/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiHataigoGame } from '@/models/HataigoGame.js';

export function isHataigoParticipant(game: Pick<MiHataigoGame, 'user1Id' | 'user2Id'>, viewerId: string | null): boolean {
	return viewerId !== null && (viewerId === game.user1Id || viewerId === game.user2Id);
}

/** No moderator bypass. Unresolved participant withdrawal closes public reads. */
export function canViewHataigo(game: Pick<MiHataigoGame, 'user1Id' | 'user2Id' | 'phase' | 'allowSpectate' | 'publicAfterEnd'>, viewerId: string | null): boolean {
	if (isHataigoParticipant(game, viewerId)) return true;
	if (game.user1Id === null || game.user2Id === null) return false;
	return game.phase === 'ended' ? game.publicAfterEnd : game.phase === 'playing' || game.phase === 'scoring' ? game.allowSpectate : false;
}
