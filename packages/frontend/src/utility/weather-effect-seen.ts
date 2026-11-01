/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクトを「一度でも発火したノート」を記録する永続ストア。
 *
 * 同じノートに対してエフェクトが何度も再生されるのを防ぐため、
 * 一度エフェクトを出したノートIDを localStorage に記録し、
 * 以降(リロードをまたいでも)そのノートでは発火しないようにする。
 *
 * - ノートID単位で記録
 * - 上限 MAX 件。超えたら古いものから捨てる(FIFO)
 * - localStorage が使えない環境ではメモリ上のみで動作(セッション内のみ有効)
 */

const STORAGE_KEY = 'hataWeatherEffect:seenNoteIds';
const MAX = 500;

// メモリ上のキャッシュ(localStorage と同期)。配列で挿入順=古い順を保つ。
let seen: string[] | null = null;
// 高速な存在判定用。
let seenSet: Set<string> | null = null;

function load(): void {
	if (seen != null) return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const arr = raw != null ? JSON.parse(raw) as unknown : null;
		seen = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		seen = [];
	}
	seenSet = new Set(seen);
}

function persist(): void {
	if (seen == null) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
	} catch {
		// 容量超過やプライベートモード等で失敗してもメモリ上は維持する。
	}
}

/**
 * このノートIDが既にエフェクト発火済みか。
 */
export function hasSeenWeather(noteId: string | null | undefined): boolean {
	if (noteId == null || noteId.length === 0) return false;
	load();
	return seenSet!.has(noteId);
}

/**
 * このノートIDを発火済みとして記録する。
 * 上限を超えたら古いものから削除する(FIFO)。
 */
export function markSeenWeather(noteId: string | null | undefined): void {
	if (noteId == null || noteId.length === 0) return;
	load();
	if (seenSet!.has(noteId)) return; // 既に記録済み
	seen!.push(noteId);
	seenSet!.add(noteId);
	// 上限超過分を古い順に捨てる
	while (seen!.length > MAX) {
		const removed = seen!.shift();
		if (removed != null) seenSet!.delete(removed);
	}
	persist();
}
