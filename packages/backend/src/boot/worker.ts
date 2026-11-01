/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import Logger from '@/logger.js';
import { envOption } from '@/env.js';
import { loadConfig } from '@/config.js';
import { configureLogging, shutdownLogging } from '@/logging/logging-runtime.js';
import { initTelemetry, shutdownTelemetry } from '@/core/telemetry/telemetry-registry.js';
import { initExtraThreadPool, jobQueue, server } from './common.js';
import { installShutdownSignalHandlers } from './shutdown-handler.js';
import type { INestApplicationContext } from '@nestjs/common';

const logger = new Logger('core', 'cyan');
const bootLogger = logger.createSubLogger('boot', 'magenta');

/**
 * Init worker process
 */
export async function workerMain() {
	const config = loadConfig();
	configureLogging(config.logging);

	initExtraThreadPool(config);

	try {
		await initTelemetry(config);
	} catch (e) {
		bootLogger.error(e instanceof Error ? e : new Error(String(e)), null, true);
		process.exit(1);
	}

	// server()/jobQueue()で作られたNestアプリケーションコンテキストを保持し、
	// シャットダウン時に明示的にclose()してOnApplicationShutdown(DB/Redis切断・queue drain)を発火させる。
	let app: INestApplicationContext | undefined;

	if (envOption.onlyServer) {
		app = await server();
	} else if (envOption.onlyQueue) {
		app = await jobQueue();
	} else {
		app = await jobQueue();
	}

	installShutdownSignalHandlers({
		shutdownTasks: [
			async () => { if (app) await app.close(); },
			shutdownTelemetry,
			shutdownLogging,
		],
		onRegistered: message => bootLogger.info(message),
	});

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!('ready');
	}
}
