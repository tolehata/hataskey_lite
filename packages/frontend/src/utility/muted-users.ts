/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';

const mutedUserIds = ref<Set<string>>(new Set());
/** ミュート一覧の取得完了・無効化を表示側へ通知する世代番号。 */
export const mutedUsersRevision = ref(0);
let fetched = false;
let fetchedAt = 0;
let generation = 0;
let fetchTask: { generation: number; promise: Promise<void> } | null = null;
let retryTimer: number | null = null;
let expiryTimer: number | null = null;
const refreshTimers = new Set<number>();
let consecutiveFailures = 0;
const mutedUserExpiresAt = new Map<string, number | null>();

const CACHE_TTL_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [1500, 5000] as const;

function clearRetryTimer(): void {
	if (retryTimer == null) return;
	window.clearTimeout(retryTimer);
	retryTimer = null;
}

function clearExpiryTimer(): void {
	if (expiryTimer == null) return;
	window.clearTimeout(expiryTimer);
	expiryTimer = null;
}

function clearRefreshTimers(): void {
	for (const timer of refreshTimers) window.clearTimeout(timer);
	refreshTimers.clear();
}

function scheduleExpiry(): void {
	clearExpiryTimer();
	const now = Date.now();
	let nextExpiry = Infinity;
	for (const expiresAt of mutedUserExpiresAt.values()) {
		if (expiresAt != null && expiresAt > now) nextExpiry = Math.min(nextExpiry, expiresAt);
	}
	if (!Number.isFinite(nextExpiry)) return;
	expiryTimer = window.setTimeout(() => {
		expiryTimer = null;
		const current = Date.now();
		const nextIds = new Set(mutedUserIds.value);
		let changed = false;
		for (const [userId, expiresAt] of mutedUserExpiresAt) {
			if (expiresAt != null && expiresAt <= current) {
				mutedUserExpiresAt.delete(userId);
				nextIds.delete(userId);
				changed = true;
			}
		}
		if (changed) {
			mutedUserIds.value = nextIds;
			mutedUsersRevision.value++;
		}
		scheduleExpiry();
	}, Math.max(0, nextExpiry - now) + 50);
}

function scheduleRetry(requestGeneration: number): void {
	clearRetryTimer();
	if (consecutiveFailures > RETRY_DELAYS_MS.length) return;
	const delay = RETRY_DELAYS_MS[consecutiveFailures - 1];
	retryTimer = window.setTimeout(() => {
		retryTimer = null;
		if (generation !== requestGeneration) return;
		void fetchMutedUsers(true);
	}, delay);
}

export async function fetchMutedUsers(force = false): Promise<void> {
	if (!$i) {
		if (!fetched) {
			mutedUserIds.value = new Set();
			mutedUserExpiresAt.clear();
			fetched = true;
			fetchedAt = Date.now();
			mutedUsersRevision.value++;
		}
		return;
	}
	if (!force && fetched && Date.now() - fetchedAt < CACHE_TTL_MS) return;
	if (fetchTask?.generation === generation) return fetchTask.promise;

	const requestGeneration = generation;
	const promise = (async () => {
		try {
			const ids = new Set<string>();
			const expiries = new Map<string, number | null>();
			let untilId: string | undefined;
			// ページネーションで全件取得（最大500件）
			for (let i = 0; i < 5; i++) {
				const res = await misskeyApi('mute/list', {
					limit: 100,
					...(untilId ? { untilId } : {}),
				});
				if (res.length === 0) break;
				for (const m of res) {
					// サーバー管理者はモデレーションのためミュート対象から除外
					if (m.mutee.roles.some(role => role.isAdministrator)) continue;
					const expiresAt = m.expiresAt == null ? null : new Date(m.expiresAt).getTime();
					if (expiresAt != null && expiresAt <= Date.now()) continue;
					if (m.muteeId) {
						ids.add(m.muteeId);
						expiries.set(m.muteeId, expiresAt);
					}
				}
				if (res.length < 100) break;
				untilId = res[res.length - 1].id;
			}
			if (generation !== requestGeneration) return;
			mutedUserIds.value = ids;
			mutedUserExpiresAt.clear();
			for (const [userId, expiresAt] of expiries) mutedUserExpiresAt.set(userId, expiresAt);
			fetched = true;
			fetchedAt = Date.now();
			consecutiveFailures = 0;
			clearRetryTimer();
			scheduleExpiry();
			mutedUsersRevision.value++;
		} catch {
			if (generation !== requestGeneration) return;
			// 一時的な通信失敗で既知のミュート一覧を捨てない。初回だけは空集合で
			// fail-openしつつ、上限付き再試行でセッション中ずっと空になることを防ぐ。
			fetched = true;
			fetchedAt = Date.now();
			consecutiveFailures++;
			mutedUsersRevision.value++;
			scheduleRetry(requestGeneration);
		} finally {
			if (fetchTask?.generation === requestGeneration) fetchTask = null;
		}
	})();
	fetchTask = { generation: requestGeneration, promise };

	return promise;
}

export function isMutedUser(userId: string): boolean {
	return mutedUserIds.value.has(userId);
}

/**
 * ミュートリスト未取得時は「判定不能=trueにせず、falseを返す」運用だと取りこぼしが発生するため、
 * 「未取得時かつmuteリスト取得中」であることを呼び出し側が判別できるようにする。
 */
export function isMutedUsersReady(): boolean {
	return fetched;
}

export function hasMutedUsers(): boolean {
	return mutedUserIds.value.size > 0;
}

export function invalidateMutedUsers(): void {
	generation++;
	fetched = false;
	fetchedAt = 0;
	fetchTask = null;
	consecutiveFailures = 0;
	clearRetryTimer();
	clearExpiryTimer();
	clearRefreshTimers();
	mutedUsersRevision.value++;
}

/** mute/create・mute/delete成功直後に共有表示へ反映する。 */
export function updateMutedUserState(
	userId: string,
	muted: boolean,
	expiresAt: number | null = null,
	excludedFromReactionHiding = false,
): void {
	const wasFetched = fetched;
	const hadActiveFetch = fetchTask != null;
	generation++;
	fetchTask = null;
	clearRetryTimer();
	consecutiveFailures = 0;
	const nextIds = new Set(mutedUserIds.value);
	if (muted && !excludedFromReactionHiding && (expiresAt == null || expiresAt > Date.now())) {
		nextIds.add(userId);
		mutedUserExpiresAt.set(userId, expiresAt);
	} else {
		nextIds.delete(userId);
		mutedUserExpiresAt.delete(userId);
	}
	mutedUserIds.value = nextIds;
	fetched = wasFetched;
	fetchedAt = wasFetched ? Date.now() : 0;
	scheduleExpiry();
	mutedUsersRevision.value++;
	if (!wasFetched || hadActiveFetch) void fetchMutedUsers(true);
}

/** インポートなど、外部で一覧全体が変わり得る操作後に再取得する。 */
export function refreshMutedUsers(delaysMs: number | readonly number[] = 0): void {
	invalidateMutedUsers();
	const delays = Array.isArray(delaysMs) ? delaysMs : [delaysMs];
	const refreshGeneration = generation;
	for (const delayMs of [...new Set(delays)].sort((a, b) => a - b)) {
		if (delayMs <= 0) {
			void fetchMutedUsers(true);
			continue;
		}
		const timer = window.setTimeout(() => {
			refreshTimers.delete(timer);
			if (generation !== refreshGeneration) return;
			void fetchMutedUsers(true);
		}, delayMs);
		refreshTimers.add(timer);
	}
}

export { mutedUserIds };
