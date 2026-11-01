/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type HatadyReactionTarget = {
	logId?: string | null;
	commentId?: string | null;
	sessionId?: string | null;
	mediaCommentId?: string | null;
	workId?: string | null;
};

export type HatadyReactionRow = { id: string; createdAt: string; reaction: string; user: Misskey.entities.UserLite };
type ReactionRow = { user: Misskey.entities.UserLite };

const CACHE_MS = 30_000;
const CACHE_LIMIT = 256;
const cache = new Map<string, { expires: number; users: Misskey.entities.UserLite[] }>();
const pending = new Map<string, Promise<Misskey.entities.UserLite[]>>();

function requestFor(target: HatadyReactionTarget) {
	if (target.mediaCommentId) return { endpoint: 'hata/hatady/media/reactions/list', payload: { targetType: 'comment', targetId: target.mediaCommentId } };
	if (target.sessionId) return { endpoint: 'hata/hatady/media/reactions/list', payload: { targetType: 'session', targetId: target.sessionId } };
	if (target.workId) return { endpoint: 'hata/hatady/media/reactions/list', payload: { targetType: 'work', targetId: target.workId } };
	if (target.commentId) return { endpoint: 'hata/hatady/reactions/list', payload: { commentId: target.commentId } };
	if (target.logId) return { endpoint: 'hata/hatady/reactions/list', payload: { logId: target.logId } };
	return null;
}

function targetKey(target: HatadyReactionTarget): string | null {
	const request = requestFor(target);
	return request == null ? null : `${request.endpoint}:${JSON.stringify(request.payload)}`;
}

/** Read a full page for the details sheet; the ten-user tooltip cache is deliberately separate. */
export async function listHatadyReactionPage(target: HatadyReactionTarget, reaction?: string, untilId?: string): Promise<HatadyReactionRow[]> {
	const request = requestFor(target);
	if (request == null) return [];
	return (misskeyApi as unknown as (endpoint: string, payload: Record<string, unknown>) => Promise<HatadyReactionRow[]>)(request.endpoint, {
		...request.payload,
		...(reaction ? { reaction } : {}),
		...(untilId ? { untilId } : {}),
		limit: 100,
	});
}

export async function getHatadyReactionUsers(target: HatadyReactionTarget, reaction: string): Promise<Misskey.entities.UserLite[]> {
	const request = requestFor(target);
	const targetId = targetKey(target);
	if (request == null || targetId == null) return [];
	const key = `${targetId}:${reaction}`;
	for (const [storedKey, entry] of cache) if (entry.expires <= Date.now()) cache.delete(storedKey);
	const hit = cache.get(key);
	if (hit != null && hit.expires > Date.now()) return hit.users;
	const inflight = pending.get(key);
	if (inflight != null) return inflight;
	const fetch = (misskeyApi as unknown as (endpoint: string, payload: Record<string, unknown>) => Promise<ReactionRow[]>)(request.endpoint, {
		...request.payload,
		reaction,
		limit: 10,
	}).then(rows => {
		const users = rows.map(row => row.user);
		// A reaction made while the request was in flight invalidates this result.
		if (pending.get(key) === fetch) {
			cache.set(key, { expires: Date.now() + CACHE_MS, users });
			while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
		}
		return users;
	}).finally(() => {
		if (pending.get(key) === fetch) pending.delete(key);
	});
	pending.set(key, fetch);
	return fetch;
}

export function invalidateHatadyReactionUsers(target: HatadyReactionTarget): void {
	const prefix = targetKey(target);
	if (prefix == null) return;
	for (const key of cache.keys()) if (key.startsWith(`${prefix}:`)) cache.delete(key);
	for (const key of pending.keys()) if (key.startsWith(`${prefix}:`)) pending.delete(key);
}
