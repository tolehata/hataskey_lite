/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * GET /api/notes/trending
 *
 * 旗鯖fork 独自実装: トレンドタイムライン (TTL) の表示用エンドポイント。
 *
 * 過去 7 日間のリアクション/リノートが多いノート Top 100 を取得し、
 * クライアントから受け取った seed でランダムシャッフルし、offset/limit でページングして
 * Note[] の配列を返す (フロントの Paginator と互換)。
 *
 * ===== ページング仕様 =====
 *
 * - seed: クライアントが生成・保持する。同じ seed なら同じシャッフル順序が再現される。
 *         引っ張って更新時はクライアントが新しい seed を生成して reload する。
 * - offset: Paginator が自動送信する (offsetMode)。これまで取得済みの件数。
 * - limit: 1 ページあたりの件数。
 *
 * ===== 外部影響なし =====
 *
 * - TrendingService 経由でのみ Redis アクセス + DB 読み取り。ActivityPub fetch は一切行わない。
 * - 削除済みノートは findBy で自然に除外される。
 * - 引っ張って更新で seed を再生成しても、追加の外部リクエストは発生しない。
 *
 * ===== セキュリティ =====
 *
 * - 凍結ユーザー、ミュート/ブロック対象を除外
 * - 公開ノート (visibility === 'public') のみ
 * - リプライ除外 (TrendingService 側で実施済み)
 */

import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { TrendingService, TRENDING_TOP_LIMIT } from '@/core/TrendingService.js';
import { isUserRelated } from '@/misc/is-user-related.js';
import { CacheService } from '@/core/CacheService.js';
import { QueryService } from '@/core/QueryService.js';
import { shuffleWithSeed } from '@/misc/shuffle-with-seed.js';

export const meta = {
	tags: ['notes'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 0,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
		offset: { type: 'integer', minimum: 0, default: 0 },
		// クライアントが生成・保持する seed。同じ seed で同じシャッフル順を再現
		seed: { type: 'integer', minimum: 1, maximum: 2147483647 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private cacheService: CacheService,
		private noteEntityService: NoteEntityService,
		private trendingService: TrendingService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// seed が無い場合は固定 seed (1) を使う (Paginator が seed を保持しない初回フォールバック)
			const seed = ps.seed ?? 1;

			// 1. Top 100 のノート ID を Redis から取得 (ActivityPub fetch 一切なし)
			const topIds = await this.trendingService.getTopNoteIds(TRENDING_TOP_LIMIT);
			if (topIds.length === 0) {
				return [];
			}

			// 2. seed でシャッフル
			const shuffledIds = shuffleWithSeed(topIds, seed);

			if (ps.offset >= shuffledIds.length) {
				return [];
			}

			// 4. ミュート/ブロックの取得
			const [
				userIdsWhoMeMuting,
				userIdsWhoBlockingMe,
			] = me ? await Promise.all([
				this.cacheService.userMutingsCache.fetch(me.id),
				this.cacheService.userBlockedCache.fetch(me.id),
			]) : [new Set<string>(), new Set<string>()];

			// 5. DB から実体ノートを取得 (公開ノート + 非凍結ユーザー + リプライ除外)
			//    ActivityPub fetch は一切発生しない (createQueryBuilder のみ)
			const query = this.notesRepository.createQueryBuilder('note')
				.where('note.id IN (:...noteIds)', { noteIds: shuffledIds })
				.andWhere('note.visibility = :visibility', { visibility: 'public' })
				.andWhere('note.replyId IS NULL')
				.innerJoinAndSelect('note.user', 'user')
				.leftJoinAndSelect('note.reply', 'reply')
				.leftJoinAndSelect('note.renote', 'renote')
				.leftJoinAndSelect('reply.user', 'replyUser')
				.leftJoinAndSelect('renote.user', 'renoteUser')
				.leftJoinAndSelect('note.channel', 'channel');

			this.queryService.generateBlockedHostQueryForNote(query);
			this.queryService.generateSuspendedUserQueryForNote(query);
			await this.queryService.generateChannelVisibilityQuery(query, me);
			if (me == null) this.queryService.generateUgcVisibilityQueryForVisitor(query);

			const notes = (await query.getMany()).filter(note => {
				if (me && isUserRelated(note, userIdsWhoBlockingMe)) return false;
				if (me && isUserRelated(note, userIdsWhoMeMuting)) return false;
				return true;
			});

			// 閲覧できるノートを確定してから offset/limit を適用し、非公開投稿でページを埋めない。
			const noteMap = new Map(notes.map(n => [n.id, n]));
			const ordered = shuffledIds.map(id => noteMap.get(id)).filter((n): n is NonNullable<typeof n> => n != null).slice(ps.offset, ps.offset + ps.limit);

			return await this.noteEntityService.packMany(ordered, me);
		});
	}
}
