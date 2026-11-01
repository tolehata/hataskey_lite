/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * RebuildTrendingProcessorService (旗鯖fork 独自実装)
 *
 * トレンドタイムライン (TTL) の Redis スコアキャッシュを過去 7 日間の DB データから再構築する。
 *
 * ===== 用途 =====
 *
 * - 機能リリース直後 (Redis にスコアデータが何もない状態): 過去 7 日分を一括投入して
 *   「過疎タイムライン」状態を回避する。
 * - 障害復旧時 (Redis が消失した場合): 同じく一括再構築でリカバリ。
 *
 * ===== 実行方法 =====
 *
 * Queue 経由で実行する。手動トリガー用に admin endpoint を別途用意することも可能だが、
 * 今回は QueueProcessorService に登録するのみとし、必要に応じて旗茶くんが手動で
 * Bull のキューに job を入れる想定。
 *
 * ===== 外部影響なし =====
 *
 * - 自鯖の DB を読むだけ、ActivityPub fetch は一切なし
 * - 読み取りクエリは過去 7 日に絞られるため、DB 負荷も限定的 (旗鯖規模なら数分以内)
 */

import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { TrendingService } from '@/core/TrendingService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class RebuildTrendingProcessorService {
	private logger: Logger;

	constructor(
		private trendingService: TrendingService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('rebuild-trending');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Rebuilding trending data from past 7 days...');

		const startedAt = Date.now();
		try {
			await this.trendingService.rebuildFromHistory(this.logger);
			const elapsed = Date.now() - startedAt;
			this.logger.info(`Rebuild complete in ${elapsed}ms`);
		} catch (e) {
			this.logger.error('Rebuild failed', e instanceof Error ? { error: e.message } : { error: String(e) });
			throw e;
		}
	}
}
