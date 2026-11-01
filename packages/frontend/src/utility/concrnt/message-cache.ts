/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 引用・リルート・返信先として埋め込む投稿の、接続世代ごとの読み取りキャッシュ。

import { watch } from 'vue';
import { concrntState, runConcrntAction } from './runtime.js';
import type { ConcrntMessage } from './types.js';

const cache = new Map<string, Promise<ConcrntMessage>>();

export function fetchConcrntMessage(uri: string, fresh = false): Promise<ConcrntMessage> {
	const cached = cache.get(uri);
	if (cached && !fresh) return cached;
	const promise = runConcrntAction(client => client.getMessage(uri));
	cache.set(uri, promise);
	// Failures are retried on the next request instead of being remembered.
	promise.catch(() => { if (cache.get(uri) === promise) cache.delete(uri); });
	if (cache.size > 300) cache.delete(cache.keys().next().value!);
	return promise;
}

export function storeConcrntMessage(message: ConcrntMessage): void {
	cache.set(message.uri, Promise.resolve(message));
}

watch(() => concrntState.revision, () => cache.clear());
