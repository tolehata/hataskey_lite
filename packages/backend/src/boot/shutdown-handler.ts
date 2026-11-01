/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type ShutdownSignalProcess = {
	once(event: 'SIGTERM' | 'SIGINT', listener: () => Promise<void>): unknown;
};

export const SHUTDOWN_TIMEOUT_MS = 10_000;

export type ShutdownTask = () => Promise<void>;

export type ShutdownHandlerOptions = {
	/** The process-like object that receives the signal handlers. */
	process?: ShutdownSignalProcess;
	/** Shutdown tasks, executed in array order. */
	shutdownTasks: readonly ShutdownTask[];
	/** Process termination function. */
	exit?: (code: number) => void;
	/** Total deadline, including any child-worker drain awaited by the primary. */
	timeoutMs?: number;
	/** Optional boot logger hook used after signal handlers are registered. */
	onRegistered?: (message: string) => void;
};

let shuttingDown = false;

/**
 * Register the process-level shutdown signals.
 *
 * Boot owns signal coordination and receives shutdown tasks through callbacks
 * so individual domains do not depend on each other.
 *
 * 注意(2026-07 G7): このプロジェクトでは app.enableShutdownHooks() を使わない。
 * NestJSのOnApplicationShutdown経由のgraceful shutdown(GlobalModule.dispose()によるDB/Redis切断、
 * QueueProcessorService.stop()によるqueue drain、ServerService.dispose()によるfastify/WebSocket close)は、
 * boot/master.ts・boot/worker.tsがshutdownTasksの中で明示的に app.close() / jobQueue.close() を呼ぶことで発火させる
 * (＝enableShutdownHooks()の自動signal登録は使わず、SIGTERM/SIGINTの登録窓口をこのhandlerに一本化する)。
 * これにより、このhandler側のSHUTDOWN_TIMEOUT_MSによる打ち切りがNestJS側のgraceful shutdownにもそのまま及ぶ。
 * enableShutdownHooks()を別途呼び出すコードを追加してはならない(signal handlerの二重登録・shutdown経路の競合を招く)。
 */
export function installShutdownSignalHandlers(options: ShutdownHandlerOptions): void {
	// テストではprocess/exitを差し替え、本番では実processにSIGTERM/SIGINT handlerを登録する。
	const processLike = options.process ?? process;
	const exit = options.exit ?? ((code: number) => process.exit(code));
	const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;

	const handleSignal = async () => {
		// 同時に複数signalが来てもflushを二重実行せず、cluster refork抑止用の状態もここで立てる。
		if (shuttingDown) return;
		shuttingDown = true;

		let timedOut = false;
		let timeout: NodeJS.Timeout | undefined;
		try {
			// 処理時間上限つきのシャットダウンプロセス
			await Promise.race([
				(async () => {
					for (const shutdownTask of options.shutdownTasks) {
						if (timedOut) return;
						try {
							await shutdownTask();
						} catch (error) {
							// 1つの終了処理の失敗で後続タスクを妨げないよう、stderrへフォールバックする。
							try {
								console.error('Shutdown task failed:', error);
							} catch {
								// stderrの出力自体が失敗しても、残りの終了処理とexitは継続する。
							}
						}
					}
				})(),
				new Promise<void>(resolve => {
					timeout = setTimeout(() => {
						timedOut = true;
						try {
							console.error(`Shutdown tasks timed out after ${timeoutMs}ms.`);
						} catch {
							// stderrの出力自体が失敗してもexitは継続する。
						}
						resolve();
					}, timeoutMs);
				}),
			]);
		} finally {
			if (timeout != null) clearTimeout(timeout);
		}

		// 既存挙動と同じく、終了処理後はプロセスを終了する。
		exit(0);
	};

	// onceにして、同じsignalでhandlerが再入しないようにする。
	processLike.once('SIGTERM', handleSignal);
	processLike.once('SIGINT', handleSignal);

	options.onRegistered?.('Registered SIGTERM/SIGINT shutdown handler.');
}

export function isShutdownInProgress(): boolean {
	// masterのcluster exit handlerが、意図したshutdown中のworker終了を再forkしないために参照する。
	return shuttingDown;
}
