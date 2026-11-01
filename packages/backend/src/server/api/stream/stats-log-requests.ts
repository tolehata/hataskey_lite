/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import type Xev from 'xev';
import type { JsonValue } from '@/misc/json-value.js';

const MAX_CHANNEL_PENDING = 8;
const MAX_PROCESS_PENDING = 1024;
const REQUEST_TIMEOUT_MS = 5000;

// Shared by both stats channels in this worker.
let processPending = 0;

export class StatsLogRequests {
	private readonly pending = new Set<() => void>();
	private disposed = false;

	constructor(
		private readonly ev: Xev,
		private readonly responsePrefix: string,
		private readonly requestEvent: string,
		private readonly send: (log: JsonValue) => void,
	) {
	}

	public request(length: JsonValue | undefined): void {
		if (this.disposed || this.pending.size >= MAX_CHANNEL_PENDING || processPending >= MAX_PROCESS_PENDING) return;

		// The public request ID is only a client-side token. Never use it as an
		// event name: concurrent channels may otherwise consume one another's reply.
		const id = randomUUID();
		const responseEvent = `${this.responsePrefix}:${id}`;
		let timer: NodeJS.Timeout | undefined;
		let released = false;
		const onResponse = (log: JsonValue) => {
			release();
			if (!this.disposed) this.send(log);
		};
		const release = () => {
			if (released) return;
			released = true;
			this.ev.removeListener(responseEvent, onResponse);
			if (timer != null) clearTimeout(timer);
			this.pending.delete(release);
			processPending--;
		};

		this.pending.add(release);
		processPending++;
		try {
			timer = setTimeout(release, REQUEST_TIMEOUT_MS);
			timer.unref();
			this.ev.on(responseEvent, onResponse);
			this.ev.emit(this.requestEvent, { id, length });
		} catch (error) {
			release();
			throw error;
		}
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const release of this.pending) release();
	}
}
