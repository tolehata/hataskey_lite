/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NestFactory } from '@nestjs/core';
import { init } from 'slacc';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import { NestLogger } from '@/NestLogger.js';
import { QueueProcessorModule } from '@/queue/QueueProcessorModule.js';
import { QueueStatsService } from '@/daemons/QueueStatsService.js';
import { ServerStatsService } from '@/daemons/ServerStatsService.js';
import { ServerService } from '@/server/ServerService.js';
import { MainModule } from '@/MainModule.js';
import { envOption } from '@/env.js';
import type { Config } from '@/config.js';

let slaccInitialized = false;

export function initExtraThreadPool(config: Config) {
	if (slaccInitialized) return;

	const threadPoolSize = Math.max(config.threadPoolSize ?? 1, 1);

	init(threadPoolSize);

	slaccInitialized = true;
}

export async function server() {
	const app = await NestFactory.createApplicationContext(MainModule, {
		logger: new NestLogger(),
	});
	// enableShutdownHooks()は使わず、boot/master.ts・boot/worker.tsのinstallShutdownSignalHandlers経由で
	// app.close()を明示的に呼び出すことでOnApplicationShutdownを発火させる(シャットダウン経路の一本化)。

	const serverService = app.get(ServerService);
	await serverService.launch();

	if (process.env.NODE_ENV !== 'test' && !envOption.noDaemons) {
		app.get(ChartManagementService).start();
		app.get(QueueStatsService).start();
		app.get(ServerStatsService).start();
	}

	return app;
}

export async function jobQueue() {
	const jobQueue = await NestFactory.createApplicationContext(QueueProcessorModule, {
		logger: new NestLogger(),
	});
	// enableShutdownHooks()は使わず、boot/master.ts・boot/worker.tsのinstallShutdownSignalHandlers経由で
	// jobQueue.close()を明示的に呼び出すことでOnApplicationShutdownを発火させる(シャットダウン経路の一本化)。

	jobQueue.get(QueueProcessorService).start();
	if (!envOption.noDaemons) {
		jobQueue.get(ChartManagementService).start();
	}

	return jobQueue;
}
