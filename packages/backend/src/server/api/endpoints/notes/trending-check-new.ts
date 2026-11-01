/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * GET /api/notes/trending/check-new
 *
 * 旗鯖fork 独自実装: トレンドタイムライン (TTL) の新規ランクイン検出用ポーリングエンドポイント。
 *
 * クライアントが 30 秒ごとにこの API を呼び、自セッションが知っている noteId の Set と比較して
 * 「現在の Top 100 に、自セッションにない新規ノートが N 件ある」ことを検出する。
 *
 * ===== レスポンス仕様 =====
 *
 * - topNoteIds: 現在の Top 100 のノート ID 一覧 (スコア降順)
 * - newCount: クエリパラメータ knownIds を渡した場合のみ計算、新規件数を返す
 *
 * ===== 軽量化 =====
 *
 * - 基本は Redis から noteIds を取得する。匿名ローカル限定表示では DB で作者ホストを確認する
 * - レスポンス JSON サイズは noteId × 100 件 ≒ 数 KB
 * - 30 秒ポーリングでも負荷は最小
 *
 * ===== 外部影響なし =====
 *
 * - ActivityPub fetch は一切行わない
 * - Redis と必要時の DB 読み取りのみ
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiMeta, NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { TrendingService, TRENDING_TOP_LIMIT } from '@/core/TrendingService.js';
import { QueryService } from '@/core/QueryService.js';

export const meta = {
	tags: ['notes'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 0,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			topNoteIds: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
				description: '現在の Top N のノート ID 一覧 (スコア降順)',
			},
			newCount: {
				type: 'integer',
				optional: false, nullable: false,
				description: 'knownIds を指定した場合、新規ノートの件数。指定しない場合は 0',
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// クライアントが現在保持しているノート ID のリスト (カンマ区切り、最大 100 件)
		// 省略時は newCount = 0 が返る
		knownIds: {
			type: 'array',
			items: { type: 'string' },
			maxItems: 100,
		},
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private trendingService: TrendingService,
		@Inject(DI.meta) private serverSettings: MiMeta,
		@Inject(DI.notesRepository) private notesRepository: NotesRepository,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (me == null && this.serverSettings.ugcVisibilityForVisitor === 'none') return { topNoteIds: [], newCount: 0 };
			let topNoteIds = await this.trendingService.getTopNoteIds(TRENDING_TOP_LIMIT);

			if (topNoteIds.length > 0) {
				const query = this.notesRepository.createQueryBuilder('note')
					.select('note.id')
					.where('note.id IN (:...topNoteIds)', { topNoteIds });
				if (me == null) this.queryService.generateUgcVisibilityQueryForVisitor(query);
				await this.queryService.generateChannelVisibilityQuery(query, me);
				const visibleIds = new Set((await query.getMany()).map(note => note.id));
				topNoteIds = topNoteIds.filter(id => visibleIds.has(id));
			}

			let newCount = 0;
			if (ps.knownIds && ps.knownIds.length > 0) {
				const knownSet = new Set(ps.knownIds);
				newCount = topNoteIds.filter(id => !knownSet.has(id)).length;
			}

			return {
				topNoteIds,
				newCount,
			};
		});
	}
}
