/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { LtlEmojiVoteService } from '@/core/LtlEmojiVoteService.js';
import { emojiVoteResponse } from './_schema.js';

export const meta = {
	tags: ['hata'],
	requireCredential: false,
	// 自分の選択も含むので、認証した外部アプリにはアカウント読み取り権限を求める。
	kind: 'read:account',
	limit: { duration: 60_000, max: 180 },
	res: emojiVoteResponse,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id', minLength: 1, maxLength: 32 },
	},
	required: [],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private ltlEmojiVoteService: LtlEmojiVoteService) {
		super(meta, paramDef, async (ps, me) => this.ltlEmojiVoteService.show(me, ps.noteId));
	}
}
