/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { EmojisRepository, MiEmoji, MiNote, NotesRepository } from '@/models/_.js';
import type { MiLocalUser, MiUser } from '@/models/User.js';
import { bindThis } from '@/decorators.js';
import { QueryService } from '@/core/QueryService.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import { ltlEmojiVoteStore } from '@/core/ltl-emoji-vote-ipc.js';
import {
	LTL_EMOJI_VOTE_FRESH_MS, LTL_EMOJI_VOTE_START_DELAY_MS, LTL_EMOJI_VOTE_TRIGGER, rankLtlEmojiVotes,
} from '@/core/ltl-emoji-vote.js';
import type { LtlVoteEmoji, LtlVoteMetadata, LtlVoteResponse } from '@/core/ltl-emoji-vote.js';

export class LtlEmojiVoteError extends Error {
	constructor(public readonly code: 'NO_SUCH_ROUND' | 'VOTING_CLOSED' | 'ALREADY_VOTED' | 'INVALID_EMOJI') {
		super(code);
	}
}

@Injectable()
export class LtlEmojiVoteService {
	constructor(
		@Inject(DI.notesRepository) private notesRepository: NotesRepository,
		@Inject(DI.emojisRepository) private emojisRepository: EmojisRepository,
		private queryService: QueryService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private idService: IdService,
	) {
	}

	private usableEmoji(emoji: MiEmoji): boolean {
		// 全員共通の候補を自動で大量表示するため、閲覧注意・ロール限定の絵文字は抽選しない。
		return emoji.host === null && !emoji.isSensitive && emoji.roleIdsThatCanBeUsedThisEmojiAsReaction.length === 0;
	}

	private packEmoji(emoji: MiEmoji): LtlVoteEmoji {
		return { id: emoji.id, name: emoji.name, url: emoji.publicUrl || emoji.originalUrl, isSensitive: emoji.isSensitive };
	}

	private isLocalAccount(user: Pick<MiUser, 'host'>): boolean {
		return user.host === null;
	}

	@bindThis
	public async onNoteCreated(note: MiNote, user: Pick<MiUser, 'id' | 'host'>): Promise<boolean> {
		if (user.host !== null || note.userHost !== null || note.userId !== user.id ||
			note.visibility !== 'public' || note.channelId !== null || note.text?.trim() !== LTL_EMOJI_VOTE_TRIGGER) return false;
		const createdAt = this.idService.parse(note.id).date.getTime();
		if (Date.now() - createdAt > LTL_EMOJI_VOTE_FRESH_MS || createdAt > Date.now() + 1000) return false;
		const requestedAt = Date.now();
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				this.startRound(note.id, createdAt, requestedAt),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(() => reject(new Error('Emoji vote start timed out')), LTL_EMOJI_VOTE_START_DELAY_MS + 100);
				}),
			]);
		} finally {
			clearTimeout(timeout);
		}
	}

	private async startRound(noteId: string, createdAt: number, requestedAt: number): Promise<boolean> {
		const pool = (await this.emojisRepository.find({ where: { host: IsNull(), isSensitive: false } })).filter(emoji => this.usableEmoji(emoji));
		// DB 待機を打ち切った呼び出しが後から継続しても、開始時刻を更新して復活させない。
		if (Date.now() - requestedAt > LTL_EMOJI_VOTE_START_DELAY_MS || pool.length === 0) return false;
		const count = Math.min(pool.length, 5);
		for (let index = 0; index < count; index++) {
			const swap = randomInt(index, pool.length);
			[pool[index], pool[swap]] = [pool[swap], pool[index]];
		}
		return ltlEmojiVoteStore.start({ noteId, createdAt, requestedAt, candidates: pool.slice(0, count).map(emoji => this.packEmoji(emoji)) });
	}

	private async canView(noteId: string, me: MiLocalUser | null): Promise<boolean> {
		if (me && (!this.isLocalAccount(me) || me.isSuspended)) return false;
		if (!(await this.roleService.getUserPolicies(me?.id ?? null)).ltlAvailable) return false;
		const query = this.notesRepository.createQueryBuilder('note')
			.where('note.id = :noteId', { noteId })
			.andWhere('note.visibility = \'public\' AND note.userHost IS NULL AND note.channelId IS NULL')
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('renote.user', 'renoteUser');
		this.queryService.generateVisibilityQuery(query, me);
		await this.queryService.generateChannelVisibilityQuery(query, me);
		this.queryService.generateBaseNoteFilteringQuery(query, me);
		const note = await query.getOne();
		if (!note || note.text?.trim() !== LTL_EMOJI_VOTE_TRIGGER) return false;
		// SQL の visibility 条件だけでは、サインイン必須・過去ノート非表示は判定されない。
		const packed = await this.noteEntityService.pack(note, me, { detail: true, skipHide: false }).catch(err => {
			if (err instanceof PrivateChannelNoteVisibilityError) return null;
			throw err;
		});
		return packed != null && packed.visibility === 'public' && !packed.isHidden && !packed.reply?.isHidden && !packed.renote?.isHidden;
	}

	private async candidatesStillAvailable(metadata: LtlVoteMetadata): Promise<boolean> {
		const emojis = await this.emojisRepository.findBy({ id: In(metadata.candidates.map(emoji => emoji.id)), host: IsNull() });
		const available = new Map(emojis.filter(emoji => this.usableEmoji(emoji)).map(emoji => [emoji.id, emoji]));
		// 削除・再登録・画像差し替えの後に古い画像や別の絵文字を投票対象として残さない。
		return metadata.candidates.every(candidate => {
			const emoji = available.get(candidate.id);
			return emoji && emoji.name === candidate.name && (emoji.publicUrl || emoji.originalUrl) === candidate.url;
		});
	}

	private async read(me: MiLocalUser | null) {
		return ltlEmojiVoteStore.read(me?.id ?? null);
	}

	@bindThis
	public async show(me: MiLocalUser | null, noteId?: string): Promise<LtlVoteResponse> {
		const initial = await this.read(me);
		const empty = { serverNow: initial.serverNow, round: null };
		const metadata = initial.metadata;
		if (!metadata || (noteId !== undefined && metadata.noteId !== noteId)) return empty;
		if (!await this.canView(metadata.noteId, me) || !await this.candidatesStillAvailable(metadata)) return empty;
		// 認可の問い合わせ中に期限やラウンドが変わった場合、古い認可を次のラウンドへ使わない。
		const current = await this.read(me);
		if (!current.metadata || current.metadata.id !== metadata.id) return { serverNow: current.serverNow, round: null };
		const phase = current.serverNow < metadata.closesAt ? 'voting' : current.serverNow < metadata.resolvedAt ? 'tallying' : 'result';
		return {
			serverNow: current.serverNow,
			round: {
				...metadata, phase, choice: current.choice,
				rankings: phase === 'result' ? rankLtlEmojiVotes(metadata.candidates, current.counts) : [],
				total: phase === 'result' ? current.counts.reduce((sum, count) => sum + count, 0) : 0,
			},
		};
	}

	@bindThis
	public async vote(me: MiLocalUser, roundId: string, emojiId: string): Promise<LtlVoteResponse> {
		if (!this.isLocalAccount(me) || me.isSuspended || me.movedToUri) throw new LtlEmojiVoteError('NO_SUCH_ROUND');
		const { metadata } = await this.read(me);
		if (!metadata || metadata.id !== roundId || !await this.canView(metadata.noteId, me) || !await this.candidatesStillAvailable(metadata)) throw new LtlEmojiVoteError('NO_SUCH_ROUND');
		if (!metadata.candidates.some(emoji => emoji.id === emojiId)) throw new LtlEmojiVoteError('INVALID_EMOJI');
		const result = await ltlEmojiVoteStore.vote(roundId, me.id, emojiId);
		if (result !== 'OK') throw new LtlEmojiVoteError(result);
		return this.show(me, metadata.noteId);
	}
}
