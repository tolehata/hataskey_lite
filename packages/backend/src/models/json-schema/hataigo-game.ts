/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const id = { type: 'string', format: 'id', optional: false, nullable: true } as const;
const flag = { type: 'boolean', optional: false, nullable: false } as const;
const number = { type: 'number', optional: false, nullable: false } as const;
const date = { type: 'string', format: 'date-time', optional: false, nullable: true } as const;
const vote = { type: 'object', optional: false, nullable: false, properties: { allowSpectate: flag, allowSpectatorChat: flag, publicAfterEnd: flag } } as const;

const text = { type: 'string', optional: false, nullable: false } as const;
const color = { ...text, enum: ['black', 'white'] } as const;
const point = { type: 'object', optional: false, nullable: false, properties: { x: number, y: number } } as const;
const points = { type: 'array', optional: false, nullable: false, items: point } as const;
const board = { type: 'object', optional: false, nullable: false, properties: {
	size: number, cells: { type: 'array', optional: false, nullable: false, items: { ...color, nullable: true } }, hash: text,
} } as const;
const scoreSide = { type: 'object', optional: false, nullable: false, properties: { territory: number, prisoners: number, deadStones: number, total: number } } as const;
const score = { type: 'object', optional: true, nullable: false, properties: {
	black: scoreSide, white: { ...scoreSide, properties: { ...scoreSide.properties, komi: number } }, winner: { ...text, enum: ['black', 'white', 'draw'] }, margin: number,
	territory: { type: 'object', optional: false, nullable: false, properties: { black: points, white: points, neutral: points } },
} } as const;
const state = { type: 'object', optional: false, nullable: true, properties: {
	board, toPlay: color, phase: { ...text, enum: ['playing', 'scoring', 'finished'] }, komi: number, handicap: number,
	prisoners: { type: 'object', optional: false, nullable: false, properties: { black: number, white: number } },
	previousBoard: { ...board, nullable: true }, consecutivePasses: number,
	moves: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, properties: { color, point: { ...point, nullable: true }, captured: points } } },
	repetitionThreshold: number, occurrences: { type: 'object', optional: false, nullable: false },
	repetition: { type: 'object', optional: false, nullable: true, properties: { type: { ...text, enum: ['repetition'] }, key: text, count: number } },
	scoring: { type: 'object', optional: false, nullable: false, properties: { deadStones: points, neutralPoints: points, acceptedBy: { type: 'array', optional: false, nullable: false, items: color }, resumeRequestedBy: { ...color, nullable: true } } },
	noResultAcceptedBy: { type: 'array', optional: false, nullable: false, items: color },
	result: { type: 'object', optional: false, nullable: true, properties: { reason: { ...text, enum: ['score', 'resign', 'timeout', 'noResult'] }, winner: { ...text, nullable: true, enum: ['black', 'white', 'draw'] }, score } },
} } as const;
const playerClock = { type: 'object', optional: false, nullable: false, properties: { mainRemainingMs: number, periodsRemaining: number } } as const;
const clock = { type: 'object', optional: false, nullable: true, properties: {
	state: { type: 'object', optional: false, nullable: false, properties: { black: playerClock, white: playerClock, runningColor: { ...color, nullable: true }, turnStartedAtMs: { ...number, nullable: true } } },
	expiredColor: { ...color, nullable: true }, remainingTurnMs: { ...number, nullable: true }, deadlineAtMs: { ...number, nullable: true },
} } as const;

const announcement = { type: 'object', optional: false, nullable: false, properties: {
	enabled: flag, visibility: { ...text, enum: ['home', 'followers', 'public'] }, allowName: flag,
} } as const;
const announcementStatus = { type: 'object', optional: false, nullable: false, properties: {
	status: { ...text, enum: ['none', 'pending', 'sent', 'cancelled'] }, text: { ...text, nullable: true }, noteId: id,
	attempts: number, nextAttemptAtMs: number, lastError: { ...text, nullable: true },
} } as const;

export const packedHataigoGameDetailedSchema = {
	type: 'object',
	properties: {
		id: { ...id, nullable: false },
		createdAt: { ...date, nullable: false }, startedAt: date, endedAt: date,
		user1Id: id, user2Id: id,
		user1: { type: 'object', optional: false, nullable: true, ref: 'UserLite' },
		user2: { type: 'object', optional: false, nullable: true, ref: 'UserLite' },
		black: { type: 'number', optional: false, nullable: true },
		phase: { type: 'string', optional: false, nullable: false, enum: ['waiting', 'playing', 'scoring', 'ended'] },
		settings: { type: 'object', optional: false, nullable: false, properties: {
			size: number,
			handicap: number,
			komi: number, rules: { type: 'string', optional: false, nullable: false, enum: ['japanese'] },
			clock: { type: 'object', optional: false, nullable: false, properties: {
				kind: { type: 'string', optional: false, nullable: false, enum: ['byoyomi', 'correspondence'] },
				mainSec: { ...number, optional: true }, periodSec: { ...number, optional: true }, periods: { ...number, optional: true }, perMoveSec: { ...number, optional: true },
			} },
		} },
		user1Ready: flag, user2Ready: flag, isInvitation: flag, invitationAccepted: flag,
		revision: number, allowSpectate: flag, allowSpectatorChat: flag, publicAfterEnd: flag,
		visibility: { type: 'object', optional: false, nullable: true, properties: { user1: vote, user2: vote } },
		announcements: { type: 'object', optional: false, nullable: true, properties: { user1: announcement, user2: announcement } },
		announcementState: { type: 'object', optional: false, nullable: true, properties: { user1: announcementStatus, user2: announcementStatus } },
		state, clock,
		serverNowMs: number,
		myColor: { type: 'string', optional: false, nullable: true, enum: ['black', 'white'] }, isParticipant: flag,
	},
} as const;
export const packedHataigoGameLiteSchema = packedHataigoGameDetailedSchema;
