/*
 * 旗鯖fork: 宴の通常・復活期限の判定と、欠落ジョブ・未配信状態の回復。
 * 連合先には何も配送しない、サーバー内完結の処理。
 */

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { QueueService } from '@/core/QueueService.js';
import type Logger from '@/logger.js';
import { UtageService } from '@/core/UtageService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { UtageResolveJobData } from '../types.js';

@Injectable()
export class UtageResolveProcessorService implements OnApplicationBootstrap {
	private logger: Logger;

	constructor(
		private utageService: UtageService,
		private queueLoggerService: QueueLoggerService,
		private queueService: QueueService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('utage-resolve');
	}

	public async onApplicationBootstrap(): Promise<void> {
		await this.queueService.utageResolveQueue.upsertJobScheduler('utage-recovery', { every: 10_000 }, {
			name: 'recover', data: { recover: true }, opts: { removeOnComplete: true, removeOnFail: 10 },
		});
	}

	@bindThis
	public async process(job: Bull.Job<UtageResolveJobData>): Promise<void> {
		if (job.data.recover) await this.utageService.recover();
		else if (job.data.noteId) await this.utageService.resolveExpired(job.data.noteId, job.data.phase);
	}
}
