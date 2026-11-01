/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * TrendingService (旗鯖fork 独自実装)
 *
 * 過去 7 日間の人気ノート (リアクション/リノートが多いノート) を Redis sorted set + 日次バケット方式で集計し、
 * トレンドタイムライン (TTL) として表示するためのサービス。
 *
 * ===== 設計方針 =====
 *
 * ## スコア計算
 * - リアクション付与: +1 点 (元ノートに積む)
 * - リノート作成: +2 点 (元ノートに積む)
 * - 引用リノート作成: +3 点 (元ノートに積む)
 * - リアクション削除/リノート取消/ノート削除時はそれぞれ減算 (悪用防止)
 *
 * ## 集計対象 (積む側で除外)
 * - 公開ノート (visibility === 'public') のみ
 * - リプライ (replyId !== null) は除外
 * - リノート/引用リノートのスコアは「元ノート」(renoteId が指す先) に積む
 *
 * ## 期間管理 (Redis 日次バケット)
 * - キー命名: `trending:notes:YYYY-MM-DD`
 * - 各キーは ZINCRBY で加算、TTL = 8 日 (= 7 日保持 + 1 日のバッファ)
 * - 過去 7 日分の sorted set を ZUNIONSTORE で合算して Top 100 を抽出
 *
 * ===== 外部サーバーへの影響対策 (CRITICAL) =====
 *
 * このサービスは ActivityPub fetch を絶対に行わない。
 * 表示時の DB 取得は notesRepository.findBy({ id: In(...) }) のみで、自鯖が既に持っているノートだけを返す。
 *
 * - TTL の表示は自鯖の Redis と DB のみで完結する (連合 fetch なし)
 * - 引っ張って更新も Redis 再集計のみで、外部サーバーへの追加リクエストは発生しない
 * - 削除済み連合ノートは findBy の結果に含まれず、自然に除外される
 * - TTL の閲覧自体は ActivityPub の任意のイベントを発生させない (連合伝搬不増加)
 * - 連合ノートのスコアは「自鯖が ActivityPub で観測したリアクション/リノートの範囲」のみ集計される
 *   (これは既存の Misskey/CherryPick の GTL と同じ仕様)
 *
 * ===== セキュリティ・プライバシー対策 =====
 *
 * - スコア集計時に visibility === 'public' を厳密フィルタ (フォロワー限定/ダイレクトは積まない)
 * - 表示時にも visibility === 'public' を二重チェック (深層防御)
 * - 凍結ユーザー (isSuspended) のノートは表示時に除外
 * - ミュート/ブロック対象は API エンドポイント側で除外
 *
 * ===== Redis キー設計 =====
 *
 * - `trending:notes:YYYY-MM-DD` (sorted set, TTL 8日)
 *   メンバー = noteId, スコア = 累積点数
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { MiNote } from '@/models/Note.js';
import type { NotesRepository } from '@/models/_.js';

// 1日 = 86400 秒
const ONE_DAY_SEC = 60 * 60 * 24;
// 保持期間: 7日 + 1日バッファ
const RETENTION_DAYS = 7;
const KEY_TTL_SEC = ONE_DAY_SEC * (RETENTION_DAYS + 1);
// 取得対象期間 (日数)
const AGGREGATE_DAYS = 7;
// 取得する上位件数
export const TRENDING_TOP_LIMIT = 100;
// Redis キーのプレフィックス
const REDIS_KEY_PREFIX = 'trending:notes';

// スコア計算定数
export const SCORE_REACTION = 1;
export const SCORE_RENOTE = 2;
export const SCORE_QUOTE_RENOTE = 3;

@Injectable()
export class TrendingService {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
	) {
	}

	/**
	 * 現在の日付に対応する Redis キーを生成する。
	 * 形式: trending:notes:YYYY-MM-DD (UTC ベース)
	 */
	@bindThis
	private getKeyForDate(date: Date): string {
		const y = date.getUTCFullYear();
		const m = String(date.getUTCMonth() + 1).padStart(2, '0');
		const d = String(date.getUTCDate()).padStart(2, '0');
		return `${REDIS_KEY_PREFIX}:${y}-${m}-${d}`;
	}

	/**
	 * 過去 AGGREGATE_DAYS 日分のキーを返す (今日を含む)
	 */
	@bindThis
	private getRecentKeys(): string[] {
		const keys: string[] = [];
		const now = new Date();
		for (let i = 0; i < AGGREGATE_DAYS; i++) {
			const d = new Date(now);
			d.setUTCDate(d.getUTCDate() - i);
			keys.push(this.getKeyForDate(d));
		}
		return keys;
	}

	/**
	 * ノートにスコアを積む。
	 *
	 * このメソッドは ReactionService / NoteCreateService から呼ばれる。
	 * 集計対象判定 (公開ノート、リプライ除外) は呼び出し側で実施済みである前提。
	 *
	 * @param noteId スコアを積む対象のノート ID
	 * @param score 加算する点数 (負の値も可、リアクション削除等の減算用)
	 */
	@bindThis
	public async addToRanking(noteId: string, score: number): Promise<void> {
		const key = this.getKeyForDate(new Date());
		const tx = this.redisClient.multi();
		tx.zincrby(key, score, noteId);
		// TTL は最初に作る時のみ設定 (NX オプションで既存 TTL を上書きしない)
		tx.expire(key, KEY_TTL_SEC, 'NX');
		await tx.exec();
	}

	/**
	 * ノートに積まれた全スコアをクリアする。
	 * ノート削除時に呼ばれる (Redis に削除済みノートの ID が残らないようにする)
	 *
	 * 過去 AGGREGATE_DAYS 日分の全バケットから当該ノート ID を削除する。
	 */
	@bindThis
	public async clearNoteScore(noteId: string): Promise<void> {
		const keys = this.getRecentKeys();
		const tx = this.redisClient.multi();
		for (const key of keys) {
			tx.zrem(key, noteId);
		}
		await tx.exec();
	}

	/**
	 * Top N のノート ID リストを取得する (スコア降順)。
	 *
	 * 過去 7 日分の sorted set を ZUNIONSTORE で合算し、上位を返す。
	 *
	 * @param limit 取得する最大件数 (デフォルト 100)
	 * @returns ノート ID の配列 (スコア降順)
	 */
	@bindThis
	public async getTopNoteIds(limit = TRENDING_TOP_LIMIT): Promise<string[]> {
		const keys = this.getRecentKeys();
		// テンポラリキー (合算結果を一時的に保存)
		// プロセス間の競合を避けるため、毎回ユニークなキー名を使う
		const tempKey = `trending:notes:tmp:${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
		try {
			// ZUNIONSTORE: 複数の sorted set を合算
			// 引数: dest, numkeys, key1, key2, ..., keyN
			await this.redisClient.zunionstore(tempKey, keys.length, ...keys);
			// 短い TTL を設定 (万が一の漏れ防止)
			await this.redisClient.expire(tempKey, 60);
			// スコア降順で取得 (ZREVRANGE)
			// スコア 0 以下は実用上トレンドではないので除外する
			const ids = await this.redisClient.zrevrangebyscore(
				tempKey,
				'+inf',
				'(0', // 0 より大 (0 を含まない)
				'LIMIT',
				0,
				limit,
			);
			return ids;
		} finally {
			// テンポラリキーは必ず削除 (finally で確実に)
			try {
				await this.redisClient.del(tempKey);
			} catch {
				// 削除失敗しても TTL で消えるので無視
			}
		}
	}

	/**
	 * Top N のノート ID リストを取得し、DB から実体ノートを取得して返す。
	 *
	 * セキュリティ対策:
	 * - visibility === 'public' を再チェック (二重防御)
	 * - 削除済みノートは自然に除外 (findBy がヒットしない)
	 * - 凍結ユーザー (isSuspended) のノートは除外
	 *
	 * 外部影響なし:
	 * - notesRepository.findBy のみ使用、ActivityPub fetch は発生しない
	 *
	 * @param limit 取得する最大件数 (デフォルト 100)
	 * @returns ノートの配列 (Redis のスコア降順、ただし表示時に呼び出し側でシャッフル想定)
	 */
	@bindThis
	public async getTopNotes(limit = TRENDING_TOP_LIMIT): Promise<MiNote[]> {
		const ids = await this.getTopNoteIds(limit);
		if (ids.length === 0) return [];

		// DB から実体取得 (公開ノートのみ、リプライ除外、凍結ユーザー除外)
		const notes = await this.notesRepository.createQueryBuilder('note')
			.leftJoin('note.user', 'user')
			.where('note.id IN (:...ids)', { ids })
			.andWhere('note.visibility = :visibility', { visibility: 'public' })
			.andWhere('note.replyId IS NULL')
			.andWhere('user.isSuspended = false')
			.getMany();

		// Redis のスコア順序を保持する形で返す
		// (findBy/createQueryBuilder の結果順は不定なため、ID 順を再構築)
		const noteMap = new Map(notes.map(n => [n.id, n]));
		const ordered: MiNote[] = [];
		for (const id of ids) {
			const n = noteMap.get(id);
			if (n) ordered.push(n);
		}

		// 削除済み (DB にヒットしなかった) ノート ID を Redis からクリーンアップ
		// 次回以降の表示時に無駄な lookup を減らす
		const foundIds = new Set(noteMap.keys());
		const missingIds = ids.filter(id => !foundIds.has(id));
		if (missingIds.length > 0) {
			// 非同期で実行、表示には影響させない
			this.cleanupDeletedNotes(missingIds).catch(() => { /* ignore */ });
		}

		return ordered;
	}

	/**
	 * 削除済み (DB に存在しない) ノート ID を Redis から削除する。
	 * getTopNotes 内部から非同期に呼ばれる。
	 */
	@bindThis
	private async cleanupDeletedNotes(noteIds: string[]): Promise<void> {
		const keys = this.getRecentKeys();
		const tx = this.redisClient.multi();
		for (const key of keys) {
			for (const id of noteIds) {
				tx.zrem(key, id);
			}
		}
		await tx.exec();
	}

	/**
	 * ヘルパー: ノートが集計対象かどうか判定する。
	 *
	 * - visibility === 'public' (公開ノートのみ)
	 * - replyId === null (リプライ除外)
	 *
	 * 呼び出し側 (ReactionService / NoteCreateService) で使用。
	 */
	@bindThis
	public isEligibleForTrending(note: { visibility: string; replyId: string | null }): boolean {
		return note.visibility === 'public' && note.replyId === null;
	}

	/**
	 * 初期化バッチ用: 過去 AGGREGATE_DAYS 日分のリアクション/リノート/引用リノートを DB から取得して
	 * Redis に再構築する。
	 *
	 * リリース直後の「過疎タイムライン」状態を回避するため、RebuildTrendingProcessor から呼ばれる。
	 *
	 * @param logger オプションのロガー (進捗報告用)
	 */
	@bindThis
	public async rebuildFromHistory(logger?: { info: (msg: string) => void }): Promise<void> {
		logger?.info('TrendingService: Starting rebuild from past 7 days history...');

		const since = new Date();
		since.setUTCDate(since.getUTCDate() - AGGREGATE_DAYS);

		// === 1. 過去 7 日間のリアクションを集計 ===
		// 注: noteReaction には createdAt が記録されているが、対応する note を join して
		// visibility === 'public' && replyId IS NULL のみを対象にする
		const reactionRows = await this.notesRepository.manager.query(`
			SELECT nr."noteId" AS note_id, COUNT(*) AS cnt
			FROM note_reaction nr
			INNER JOIN note n ON n.id = nr."noteId"
			LEFT JOIN "user" u ON u.id = n."userId"
			WHERE nr."createdAt" > $1
			  AND n.visibility = 'public'
			  AND n."replyId" IS NULL
			  AND u."isSuspended" = false
			GROUP BY nr."noteId"
		`, [since]);

		logger?.info(`  Reactions: ${reactionRows.length} notes`);

		// === 2. 過去 7 日間のリノート/引用リノートを集計 ===
		// リノート (renoteId IS NOT NULL AND text IS NULL) → 元ノートに +2
		// 引用リノート (renoteId IS NOT NULL AND text IS NOT NULL) → 元ノートに +3
		// 元ノートが公開かつリプライでないこと
		const renoteRows = await this.notesRepository.manager.query(`
			SELECT
				r."renoteId" AS original_id,
				SUM(CASE WHEN r.text IS NULL THEN ${SCORE_RENOTE} ELSE ${SCORE_QUOTE_RENOTE} END) AS score
			FROM note r
			INNER JOIN note original ON original.id = r."renoteId"
			LEFT JOIN "user" original_user ON original_user.id = original."userId"
			WHERE r."createdAt" > $1
			  AND r."renoteId" IS NOT NULL
			  AND original.visibility = 'public'
			  AND original."replyId" IS NULL
			  AND original_user."isSuspended" = false
			GROUP BY r."renoteId"
		`, [since]);

		logger?.info(`  Renotes/quotes: ${renoteRows.length} original notes`);

		// === 3. 集計したスコアをマージして Redis に反映 ===
		// 注: 初期化時のバケットは「今日のキー」に一括投入する (過去日付に散らすことも可能だが、
		//      シンプルさ優先。バッチ後 7 日経過すれば自動的に消える)
		const todayKey = this.getKeyForDate(new Date());

		const scoreMap = new Map<string, number>();
		for (const row of reactionRows) {
			scoreMap.set(row.note_id, Number(row.cnt) * SCORE_REACTION);
		}
		for (const row of renoteRows) {
			const cur = scoreMap.get(row.original_id) ?? 0;
			scoreMap.set(row.original_id, cur + Number(row.score));
		}

		if (scoreMap.size === 0) {
			logger?.info('TrendingService: No data to rebuild (no eligible notes in past 7 days)');
			return;
		}

		// ZADD で一括投入 (パイプライン)
		const tx = this.redisClient.multi();
		const args: (string | number)[] = [];
		for (const [noteId, score] of scoreMap.entries()) {
			args.push(score, noteId);
		}
		// ZADD は引数を (score1, member1, score2, member2, ...) の順で渡す
		// ioredis の zadd 関数で可変長引数として渡せる
		tx.zadd(todayKey, ...(args as [number | string, ...(number | string)[]]));
		tx.expire(todayKey, KEY_TTL_SEC, 'NX');
		await tx.exec();

		logger?.info(`TrendingService: Rebuild complete (${scoreMap.size} notes scored)`);
	}
}
