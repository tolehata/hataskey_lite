/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { MiUser } from '@/models/User.js';
import type { MiHataigoGame } from '@/models/HataigoGame.js';
import type { Packed } from '@/misc/json-schema.js';
import { projectClock } from '@/misc/hataigo/clock.js';
import { participantColor, rebuildHataigo } from '@/misc/hataigo/domain.js';
import { isHataigoParticipant } from '@/misc/hataigo/access.js';
import type { GameState } from '@/misc/hataigo/rules/game.js';
import type { Board, Point } from '@/misc/hataigo/rules/board.js';
import { HataigoService } from '@/core/HataigoService.js';
import { UserEntityService } from './UserEntityService.js';

export type HataigoGameDetail = Packed<'HataigoGameDetailed'>;

function packBoard(board: Board) {
	return { size: board.size, cells: [...board.cells], hash: board.hash };
}

function packPoints(points: readonly Point[]) {
	return points.map(({ x, y }) => ({ x, y }));
}

/** Build an independent JSON snapshot; canonical rule snapshots deliberately use readonly arrays. */
function packState(state: GameState): NonNullable<HataigoGameDetail['state']> {
	const score = state.result?.score;
	return {
		board: packBoard(state.board), toPlay: state.toPlay, phase: state.phase, komi: state.komi, handicap: state.handicap,
		prisoners: { ...state.prisoners }, previousBoard: state.previousBoard === null ? null : packBoard(state.previousBoard),
		consecutivePasses: state.consecutivePasses,
		moves: state.moves.map(move => ({ color: move.color, point: move.point === null ? null : { ...move.point }, captured: packPoints(move.captured) })),
		repetitionThreshold: state.repetitionThreshold, occurrences: { ...state.occurrences }, repetition: state.repetition === null ? null : { ...state.repetition },
		scoring: { deadStones: packPoints(state.scoring.deadStones), neutralPoints: packPoints(state.scoring.neutralPoints), acceptedBy: [...state.scoring.acceptedBy], resumeRequestedBy: state.scoring.resumeRequestedBy },
		noResultAcceptedBy: [...state.noResultAcceptedBy],
		result: state.result === null ? null : { reason: state.result.reason, winner: state.result.winner, ...(score ? { score: {
			black: { ...score.black }, white: { ...score.white }, winner: score.winner, margin: score.margin,
			territory: { black: packPoints(score.territory.black), white: packPoints(score.territory.white), neutral: packPoints(score.territory.neutral) },
		} } : {}) },
	};
}

@Injectable()
export class HataigoGameEntityService {
	constructor(private games: HataigoService, private users: UserEntityService) {}

	@bindThis
	public async packDetail(source: string | MiHataigoGame, viewer: MiUser | null): Promise<HataigoGameDetail> {
		// Packing users can await other services; publication and participant identity are checked again below.
		const initial = await this.games.get(typeof source === 'string' ? source : source.id, viewer);
		const [first, second] = await Promise.all([
			this.games.findParticipantUser(initial.user1Id), this.games.findParticipantUser(initial.user2Id),
		]);
		const [packedFirst, packedSecond] = await Promise.all([
			first === null ? null : this.users.pack(first, viewer, { schema: 'UserLite' }),
			second === null ? null : this.users.pack(second, viewer, { schema: 'UserLite' }),
		]);
		const [currentFirst, currentSecond] = await Promise.all([
			this.games.findParticipantUser(initial.user1Id), this.games.findParticipantUser(initial.user2Id),
		]);
		const game = await this.games.get(initial.id, viewer);
		const participant = isHataigoParticipant(game, viewer?.id ?? null);
		const now = Date.now();
		const state = game.startedAt === null ? null : rebuildHataigo(game.settings, game.actions);
		const user1 = currentFirst !== null && game.user1Id === initial.user1Id ? packedFirst : null;
		const user2 = currentSecond !== null && game.user2Id === initial.user2Id ? packedSecond : null;
		return {
			id: game.id, createdAt: game.createdAt.toISOString(), startedAt: game.startedAt?.toISOString() ?? null, endedAt: game.endedAt?.toISOString() ?? null,
			user1Id: game.user1Id, user2Id: game.user2Id, user1, user2, black: game.black, phase: game.phase, settings: structuredClone(game.settings),
			user1Ready: game.user1Ready, user2Ready: game.user2Ready, isInvitation: game.isInvitation, invitationAccepted: game.invitationAccepted,
			revision: game.revision, allowSpectate: game.allowSpectate, allowSpectatorChat: game.allowSpectatorChat, publicAfterEnd: game.publicAfterEnd,
			visibility: participant ? structuredClone(game.visibility) : null, state: state === null ? null : packState(state),
			announcements: participant ? structuredClone(game.announcements) : null, announcementState: participant ? structuredClone(game.announcementState) : null,
			clock: game.clockState === null ? null : projectClock(game.settings.clock, game.clockState, now), serverNowMs: now,
			myColor: participant && viewer && game.black !== null ? participantColor(game, viewer.id) : null, isParticipant: participant,
		};
	}

	@bindThis
	public async packDetailMany(games: (string | MiHataigoGame)[], viewer: MiUser | null): Promise<HataigoGameDetail[]> {
		const packed: HataigoGameDetail[] = [];
		for (const game of games) packed.push(await this.packDetail(game, viewer));
		// A later record's user packing must not hide an earlier record's publication withdrawal.
		await Promise.all(packed.map(game => this.games.get(game.id, viewer)));
		return packed;
	}
}
