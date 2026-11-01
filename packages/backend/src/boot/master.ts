/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as os from 'node:os';
import cluster from 'node:cluster';
import chalk from 'chalk';
import chalkTemplate from 'chalk-template';
import Logger from '@/logger.js';
import { loadConfig } from '@/config.js';
import type { Config } from '@/config.js';
import { configureLogging, shutdownLogging } from '@/logging/logging-runtime.js';
import { initTelemetry, shutdownTelemetry } from '@/core/telemetry/telemetry-registry.js';
import { showMachineInfo } from '@/misc/show-machine-info.js';
import { envOption } from '@/env.js';
import { startLtlEmojiVoteCoordinator, stopLtlEmojiVoteCoordinator } from '@/core/ltl-emoji-vote-ipc.js';
import { initExtraThreadPool, jobQueue, server } from './common.js';
import { installShutdownSignalHandlers, isShutdownInProgress, SHUTDOWN_TIMEOUT_MS } from './shutdown-handler.js';
import { spawnWorker, terminateWorkers } from './worker-lifecycle.js';
import type { INestApplicationContext } from '@nestjs/common';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const meta = JSON.parse(fs.readFileSync(`${_dirname}/../../../../built/meta.json`, 'utf-8'));

const logger = new Logger('core', 'cyan');
const bootLogger = logger.createSubLogger('boot', 'magenta');

const themeColor = chalk.hex('#ffa9c3');

function greet() {
	if (!envOption.quiet) {
		//#region Hataskey logo
		const v = `v${meta.version}`;
		console.log(chalk.hex('#95e3e8').bold(' _    _       _        ') + chalk.hex('#9ec23f').bold('    _              '));
		console.log(chalk.hex('#95e3e8').bold('| |  | |     | |       ') + chalk.hex('#9ec23f').bold('   | |             '));
		console.log(chalk.hex('#95e3e8').bold('| |__| | __ _| |_ __ _ ') + chalk.hex('#9ec23f').bold('___| | _____ _   _ '));
		console.log(chalk.hex('#95e3e8').bold('|  __  |/ _` | __/ _` /') + chalk.hex('#9ec23f').bold(' __| |/ / _ \\ | | |'));
		console.log(chalk.hex('#95e3e8').bold('| |  | | (_| | || (_| \\') + chalk.hex('#9ec23f').bold('__ \\   <  __/ |_| |'));
		console.log(chalk.hex('#95e3e8').bold('|_|  |_|\\__,_|\\__\\__,_|') + chalk.hex('#9ec23f').bold('___/_|\\_\\___|\\__, |'));
		console.log(chalk.hex('#95e3e8').bold('                       ') + chalk.hex('#9ec23f').bold('              __/ |'));
		console.log(chalk.hex('#95e3e8').bold('                       ') + chalk.hex('#9ec23f').bold('             |___/ '));
		//#endregion

		console.log(chalk.hex('#95e3e8').bold(' Hata') + chalk.hex('#9ec23f').bold('skey') + (' is an open-source decentralized microblogging platform based on') + (chalk.hex('#95e3e8').bold(' Cherry') + chalk.hex('#9ec23f').bold('Pick') + (' and') + chalk.hex('#9ec23f').bold(' Misskey') + ('.')));

		console.log('');
		console.log(chalkTemplate`--- ${os.hostname()} {gray (PID: ${process.pid.toString()})} ---`);
	}

	bootLogger.info('Welcome to Hataskey!');
	bootLogger.info(`Hataskey v${meta.version}`, null, true);
	bootLogger.info(`Based on Misskey v${meta.basedMisskeyVersion}`, null, true);
}

/**
 * Init master process
 */
export async function masterMain() {
	let config!: Config;

	// initialize app
	try {
		greet();
		showEnvironment();
		await showMachineInfo(bootLogger);
		showNodejsVersion();
		config = loadConfigBoot();
		//await connectDb();
		if (config.pidFile) fs.writeFileSync(config.pidFile, process.pid.toString());
	} catch (e) {
		bootLogger.error('Fatal error occurred during initialization', null, true);
		process.exit(1);
	}

	bootLogger.succ(chalk.hex('#ffa9c3')('Cherry') + chalk.hex('#95e3e8')('Pick') + (' initialized'));

	initExtraThreadPool(config);

	try {
		await initTelemetry(config);
	} catch (e) {
		bootLogger.error(e instanceof Error ? e : new Error(String(e)), null, true);
		process.exit(1);
	}

	bootLogger.info(
		`mode: [disableClustering: ${envOption.disableClustering}, onlyServer: ${envOption.onlyServer}, onlyQueue: ${envOption.onlyQueue}]`,
	);

	// server()/jobQueue()で作られたNestアプリケーションコンテキストを保持し、
	// シャットダウン時に明示的にclose()してOnApplicationShutdown(DB/Redis切断・queue drain)を発火させる。
	let serverApp: INestApplicationContext | undefined;
	let queueApp: INestApplicationContext | undefined;
	// onlyServerでもprimaryに1つだけ置き、HTTP workerはIPC経由で同じ短命な投票を扱う。
	startLtlEmojiVoteCoordinator();

	if (!envOption.disableClustering) {
		// clusterモジュール有効時

		if (envOption.onlyServer) {
			// onlyServer かつ enableCluster な場合、メインプロセスはforkのみに制限する(listenしない)。
			// ワーカープロセス側でlistenすると、メインプロセスでポートへの着信を受け入れてワーカープロセスへの分配を行う動作をする。
			// そのため、メインプロセスでも直接listenするとポートの競合が発生して起動に失敗してしまう。
			// see: https://nodejs.org/api/cluster.html#cluster
		} else if (envOption.onlyQueue) {
			queueApp = await jobQueue();
		} else {
			serverApp = await server();
		}
	} else {
		// clusterモジュール無効時

		if (envOption.onlyServer) {
			serverApp = await server();
		} else if (envOption.onlyQueue) {
			queueApp = await jobQueue();
		} else {
			serverApp = await server();
			queueApp = await jobQueue();
		}
	}

	installShutdownSignalHandlers({
		// Workers have their own drain deadline; leave a separate budget for primary cleanup.
		timeoutMs: envOption.disableClustering ? undefined : SHUTDOWN_TIMEOUT_MS * 2,
		shutdownTasks: [
			async () => stopLtlEmojiVoteCoordinator(),
			() => terminateWorkers(Object.values(cluster.workers ?? {})),
			async () => { if (serverApp) await serverApp.close(); },
			async () => { if (queueApp) await queueApp.close(); },
			shutdownTelemetry,
			shutdownLogging,
		],
		onRegistered: message => bootLogger.info(message),
	});

	if (!envOption.disableClustering) await spawnWorkers(config.clusterLimit);
	if (isShutdownInProgress()) return;

	if (envOption.onlyQueue) {
		bootLogger.succ('Queue started', null, true);
	} else {
		bootLogger.succ(config.socket ? `Now listening on socket ${config.socket} on ${config.url}` : `Now listening on port ${config.port} on ${config.url}`, null, true);
	}
}

function showEnvironment(): void {
	const env = process.env.NODE_ENV;
	const logger = bootLogger.createSubLogger('env');
	logger.info(typeof env === 'undefined' ? 'NODE_ENV is not set' : `NODE_ENV: ${env}`);

	if (env !== 'production') {
		logger.warn('The environment is not in production mode.');
		logger.warn('DO NOT USE FOR PRODUCTION PURPOSE!', null, true);
	}
}

function showNodejsVersion(): void {
	const nodejsLogger = bootLogger.createSubLogger('nodejs');

	nodejsLogger.info(`Version ${process.version} detected.`);
}

function loadConfigBoot(): Config {
	const configLogger = bootLogger.createSubLogger('config');
	let config;

	try {
		config = loadConfig();
		configureLogging(config.logging);
	} catch (exception) {
		if (typeof exception === 'string') {
			configLogger.error(exception);
			process.exit(1);
		} else if ((exception as any).code === 'ENOENT') {
			configLogger.error('Configuration file not found', null, true);
			process.exit(1);
		}
		throw exception;
	}

	configLogger.succ('Loaded');

	return config;
}

/*
async function connectDb(): Promise<void> {
	const dbLogger = bootLogger.createSubLogger('db');

	// Try to connect to DB
	try {
		dbLogger.info('Connecting...');
		await initDb();
		const v = await db.query('SHOW server_version').then(x => x[0].server_version);
		dbLogger.succ(`Connected: v${v}`);
	} catch (err) {
		dbLogger.error('Cannot connect', null, true);
		dbLogger.error(err);
		process.exit(1);
	}
}
*/

async function spawnWorkers(limit = 1) {
	const workers = Math.min(limit, os.cpus().length);
	bootLogger.info(`Starting ${workers} worker${workers === 1 ? '' : 's'}...`);
	try {
		await Promise.all([...Array(workers)].map(() => spawnWorker({
			fork: () => cluster.fork(),
			isShuttingDown: isShutdownInProgress,
			onFailure: failWorkerStartup,
		})));
	} catch (error) {
		if (isShutdownInProgress()) return;
		failWorkerStartup(error instanceof Error ? error : new Error(String(error)));
	}
	if (isShutdownInProgress()) return;
	bootLogger.succ('All workers started');
}

function failWorkerStartup(error: Error): never {
	bootLogger.error(error, null, true);
	process.exit(1);
}
