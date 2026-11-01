/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { LtlEmojiVoteError, LtlEmojiVoteService } from '@/core/LtlEmojiVoteService.js';
import { emojiVoteResponse } from './_schema.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:votes',
	limit: { duration: 60_000, max: 30 },
	res: emojiVoteResponse,
	errors: {
		NO_SUCH_ROUND: { message: 'No such emoji vote round.', code: 'NO_SUCH_ROUND', id: 'd2af6f48-12f7-4fbd-a21a-ae08a33841ad' },
		VOTING_CLOSED: { message: 'Voting has closed.', code: 'VOTING_CLOSED', id: '06010cf1-a75f-4cd4-82c3-0e213e95260b' },
		ALREADY_VOTED: { message: 'You have already voted.', code: 'ALREADY_VOTED', id: 'eb296a5f-c0f0-49ae-9573-99e9721d7fdd' },
		INVALID_EMOJI: { message: 'This emoji is not a candidate.', code: 'INVALID_EMOJI', id: 'c3a6d9aa-fc59-4e57-884b-878fc75b4771' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		roundId: { type: 'string', format: 'misskey:id', minLength: 1, maxLength: 32 },
		emojiId: { type: 'string', format: 'misskey:id', minLength: 1, maxLength: 32 },
	},
	required: ['roundId', 'emojiId'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private ltlEmojiVoteService: LtlEmojiVoteService) {
		super(meta, paramDef, async (ps, me) => {
			try {
				return await this.ltlEmojiVoteService.vote(me, ps.roundId, ps.emojiId);
			} catch (error) {
				if (error instanceof LtlEmojiVoteError) throw new ApiError(meta.errors[error.code]);
				throw error;
			}
		});
	}
}
