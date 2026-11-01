/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * CherryPick Entry Point!
 */

import cluster from 'node:cluster';
import { EventEmitter } from 'node:events';
import process from 'node:process';
import { writeHeapSnapshot } from 'node:v8';
import chalk from 'chalk';
import Xev from 'xev';
import Logger from '@/logger.js';
import { envOption } from '../env.js';
import { installProcessErrorHandlers } from './process-error-handler.js';
import { isShutdownInProgress } from './shutdown-handler.js';
import { masterMain } from './master.js';
import { workerMain } from './worker.js';
import { readyRef } from './ready.js';

import 'reflect-metadata';

process.title = `CherryPick (${cluster.isPrimary ? 'master' : 'worker'})`;

Error.stackTraceLimit = Infinity;
EventEmitter.defaultMaxListeners = 128;

const logger = new Logger('core', 'cyan');
const clusterLogger = logger.createSubLogger('cluster', 'orange');
const ev = new Xev();

//#region Events

// SIGINT/SIGTERM受信とグレースフルシャットダウンはboot/master.ts・boot/worker.tsの
// installShutdownSignalHandlers(shutdown-handler.ts)に一本化した。ここでは登録しない
// (二重登録によるレースを避けるため)。isShutdownInProgress()でその進行状況だけ参照する。
installProcessErrorHandlers({ logger, quiet: envOption.quiet });

if (cluster.isPrimary && !envOption.disableClustering) {
	// Listen new workers
	cluster.on('fork', worker => {
		clusterLogger.debug(`Process forked: [${worker.id}]`);
	});

	// Listen online workers
	cluster.on('online', worker => {
		clusterLogger.debug(`Process is now online: [${worker.id}]`);
	});

	// Listen for dying workers
	cluster.on('exit', (worker, code, signal) => {
		if (isShutdownInProgress()) {
			clusterLogger.info(chalk.yellow(`Worker respawn disabled because of shutdown: [${worker.id}]`));
			return;
		}

		// worker-lifecycle.ts replaces the worker and tracks its readiness.
		clusterLogger.error(chalk.red(`[${worker.id}] died (${signal || code})`));
	});
}

// Dying away...
process.on('exit', code => {
	if (isShutdownInProgress()) return;
	logger.warn(chalk.yellow(`The process is going to exit with code ${code}`));
});

//#endregion

if (!envOption.disableClustering) {
	if (cluster.isPrimary) {
		logger.info(`Start main process... pid: ${process.pid}`);
		await masterMain();
		if (!isShutdownInProgress()) ev.mount();
	} else if (cluster.isWorker) {
		logger.info(`Start worker process... pid: ${process.pid}`);
		await workerMain();
	} else {
		throw new Error('Unknown process type');
	}
} else {
	// 非clusterの場合はMasterのみが起動するため、Workerの処理は行わない(cluster.isWorker === trueの状態でこのブロックに来ることはない)
	logger.info(`Start main process... pid: ${process.pid}`);
	await masterMain();
	if (!isShutdownInProgress()) ev.mount();
}

process.on('message', msg => {
	if (msg === 'gc') {
		if (global.gc != null) {
			logger.info('Manual GC triggered');
			for (let i = 0; i < 3; i++) {
				global.gc();
			}
			if (process.send != null) process.send('gc ok');
		} else {
			logger.warn('Manual GC requested but gc is not available. Start the process with --expose-gc to enable this feature.');
			if (process.send != null) process.send('gc unavailable');
		}
	} else if (msg === 'memory usage') {
		if (process.send != null) {
			process.send({
				type: 'memory usage',
				value: process.memoryUsage(),
			});
		}
	} else if (msg != null && typeof msg === 'object' && 'type' in msg && msg.type === 'heap snapshot' && 'path' in msg && typeof msg.path === 'string') {
		if (process.send != null) {
			try {
				const path = writeHeapSnapshot(msg.path);
				process.send({
					type: 'heap snapshot',
					path,
				});
			} catch (err) {
				process.send({
					type: 'heap snapshot error',
					message: err instanceof Error ? err.message : String(err),
				});
			}
		}
	}
});

if (!isShutdownInProgress()) readyRef.value = true;

// ユニットテスト時にMisskeyが子プロセスで起動された時のため
// それ以外のときは process.send は使えないので弾く
if (process.send && !isShutdownInProgress()) {
	process.send('ok');
}
