/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';

const STORAGE_KEY = 'hiddenReactions';
const MAX_ENTRIES = 5000; // localStorage 暴走防止

interface HiddenReaction {
	noteId: string;
	reaction: string;
	timestamp: number;
}

/** noteId / reaction 文字列の妥当性チェック */
function isValidNoteId(s: unknown): s is string {
	return typeof s === 'string' && s.length > 0 && s.length <= 64 && /^[A-Za-z0-9]+$/.test(s);
}
function isValidReaction(s: unknown): s is string {
	if (typeof s !== 'string') return false;
	if (s.length === 0 || s.length > 100) return false;
	if (/[\u0000-\u001F<>"'`\\]/.test(s)) return false;
	return true;
}
function isValidEntry(o: any): o is HiddenReaction {
	return o && typeof o === 'object'
		&& isValidNoteId(o.noteId)
		&& isValidReaction(o.reaction)
		&& typeof o.timestamp === 'number' && Number.isFinite(o.timestamp);
}

/**
 * リアクティブな変更通知用カウンター
 * hide/unhide操作のたびにインクリメントされ、computedの再評価をトリガーする
 */
export const hiddenReactionsVersion = ref(0);

/**
 * 非表示リアクションを取得
 */
export function getHiddenReactions(): HiddenReaction[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isValidEntry);
	} catch {
		return [];
	}
}

/**
 * リアクションを非表示に追加
 */
export function hideReaction(noteId: string, reaction: string): void {
	if (!isValidNoteId(noteId) || !isValidReaction(reaction)) return;
	const hidden = getHiddenReactions();

	// 既に存在する場合は追加しない
	if (hidden.some(h => h.noteId === noteId && h.reaction === reaction)) {
		return;
	}

	hidden.push({
		noteId,
		reaction,
		timestamp: Date.now(),
	});

	// 古いデータを削除（30日以上前）
	const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
	let filtered = hidden.filter(h => h.timestamp > thirtyDaysAgo);
	// 上限超過時は古いものから捨てる
	if (filtered.length > MAX_ENTRIES) {
		filtered.sort((a, b) => b.timestamp - a.timestamp);
		filtered = filtered.slice(0, MAX_ENTRIES);
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
	} catch { /* quota error 無視 */ }
	hiddenReactionsVersion.value++;
}

/**
 * リアクションが非表示かチェック
 */
export function isReactionHidden(noteId: string, reaction: string): boolean {
	const hidden = getHiddenReactions();
	return hidden.some(h => h.noteId === noteId && h.reaction === reaction);
}

/**
 * 特定のノートの非表示リアクションを削除
 */
export function unhideReaction(noteId: string, reaction: string): void {
	if (!isValidNoteId(noteId) || !isValidReaction(reaction)) return;
	const hidden = getHiddenReactions();
	const filtered = hidden.filter(h => !(h.noteId === noteId && h.reaction === reaction));
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
	} catch { /* ignore */ }
	hiddenReactionsVersion.value++;
}

/**
 * ノートのリアクションオブジェクトから非表示のものを除外
 */
export function filterHiddenReactions(noteId: string, reactions: Record<string, number>): Record<string, number> {
	const filtered: Record<string, number> = {};

	for (const [reaction, count] of Object.entries(reactions)) {
		if (!isReactionHidden(noteId, reaction)) {
			filtered[reaction] = count;
		}
	}

	return filtered;
}
