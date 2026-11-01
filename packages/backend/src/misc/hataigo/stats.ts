/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiHataigoGame } from '@/models/HataigoGame.js';
import type { HataigoPersonalStats } from './types.js';

export type HataigoStatsGame = Pick<MiHataigoGame, 'id' | 'phase' | 'startedAt' | 'endedAt' | 'user1Id' | 'user2Id' | 'black' | 'settings' | 'result'>;

/** Human games only. No-result games do not count or interrupt a winning streak; draws do. */
export function calculatePersonalStats(userId: string, games: readonly HataigoStatsGame[]): HataigoPersonalStats {
	const stats: HataigoPersonalStats = { wins: 0, losses: 0, draws: 0, streak: 0, wins9: 0, wins19: 0, distinctOpponents: 0 };
	const opponents = new Set<string>();
	let consecutive = true;
	const completed = games.filter(game => game.phase === 'ended' && game.startedAt !== null && game.endedAt !== null && game.black !== null && game.result !== null && game.result.reason !== 'noResult' && game.result.winner !== null && (game.user1Id === userId || game.user2Id === userId));
	completed.sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0) || (a.id === b.id ? 0 : a.id > b.id ? -1 : 1));
	for (const game of completed) {
		const color = (game.black === 1 ? game.user1Id : game.user2Id) === userId ? 'black' : 'white';
		if (game.result?.winner === 'draw') { stats.draws++; consecutive = false; } else if (game.result?.winner === color) {
			stats.wins++;
			if (consecutive) stats.streak++;
			if (game.settings.size === 9) stats.wins9++;
			if (game.settings.size === 19) stats.wins19++;
			const opponent = game.user1Id === userId ? game.user2Id : game.user1Id;
			if (opponent !== null) opponents.add(opponent);
		} else { stats.losses++; consecutive = false; }
	}
	stats.distinctOpponents = opponents.size;
	return stats;
}
