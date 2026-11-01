/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { PostFormProps } from '@/types/post-form.js';

// Hataskey UI 3 の画面内で共有する状態。UI3 は同時に1つしか表示されないため、
// コンポーネント間の受け渡しをモジュール単位の ref にまとめる。

/** 投稿欄が返信・引用の対象にしているノート。タイムライン側で対象ノートを強調する。 */
export const hk3ComposerLink = ref<{ kind: 'reply' | 'quote'; noteId: string } | null>(null);

/** 投稿直後に、ストリームを待たずタイムラインの先頭へ出すための通知。 */
export const hk3PostedNote = ref<Misskey.entities.Note | null>(null);

export type Hk3Toast = {
	id: string;
	icon: 'bell' | 'heart' | 'reply' | 'repeat' | 'quote' | 'userPlus' | 'mention' | 'poll' | 'zap' | 'zapOff' | 'sun' | 'moon' | 'send' | 'check' | 'filter' | 'star' | 'clip' | 'pencil' | 'trash' | 'clock' | 'smile';
	text: string;
	/** Standard notification ID, used to dismiss only the matching banner. */
	notificationId?: string;
	user?: Misskey.entities.UserLite | null;
	/** 歓迎通知のアバターだけ丸く表示する。 */
	welcome?: boolean;
	/** 外部通知の発信元。user.host が null の場合の絵文字解決に使う。 */
	emojiHost?: string;
	/** 絵文字追加のお知らせで、先頭に出す絵文字画像。 */
	emojiUrl?: string;
	onClick?: () => void;
};

/**
 * 新着バナーに流すトースト。待ち行列にせず、新しいものが届いたら即座に置き換える。
 * (テーマの連続切替などで表示が後ろへずれ込み、操作から遅れて見えるのを防ぐ)
 */
export const hk3Toasts = ref<Hk3Toast[]>([]);

let toastSeq = 0;
let toastTimer: number | undefined;
let toastRemaining = 0;
let toastDeadline = 0;
const toastPauses = new Set<symbol>();

function scheduleToast() {
	window.clearTimeout(toastTimer);
	toastTimer = undefined;
	const id = hk3Toasts.value[0]?.id;
	if (!id || toastPauses.size) return;
	toastDeadline = performance.now() + toastRemaining;
	toastTimer = window.setTimeout(() => dismissHk3Toast(id), toastRemaining);
}

/** Pull feedback temporarily borrows the banner without consuming notice time. */
export function setHk3ToastsPaused(owner: symbol, paused: boolean): void {
	const wasPaused = toastPauses.size > 0;
	if (paused) toastPauses.add(owner);
	else toastPauses.delete(owner);
	if (!wasPaused && toastPauses.size) {
		if (toastTimer !== undefined) toastRemaining = Math.max(0, toastDeadline - performance.now());
		window.clearTimeout(toastTimer);
		toastTimer = undefined;
	} else if (wasPaused && !toastPauses.size) scheduleToast();
}

export function pushHk3Toast(toast: Omit<Hk3Toast, 'id'>, duration = 2800): void {
	const id = `hk3-toast-${Date.now()}-${toastSeq++}`;
	hk3Toasts.value = [{ ...toast, id }];
	toastRemaining = duration;
	scheduleToast();
}

export function dismissHk3Toast(id: string): void {
	if (hk3Toasts.value[0]?.id === id) { window.clearTimeout(toastTimer); toastTimer = undefined; }
	hk3Toasts.value = hk3Toasts.value.filter(toast => toast.id !== id);
}

/** UI3の投稿欄で受け取れる投稿要求か。外部アカウント・文脈なしの新規投稿は通常の投稿フォームへ回す。 */
export function hk3CanAdoptPostForm(request: PostFormProps): boolean {
	if (request.externalReply || request.externalRenote || request.initialUseExternalAccount) return false;
	// The standard form inherits direct-reply recipients, including asynchronous
	// user lookup. Do not accept the request here with an incomplete audience.
	if (request.reply?.visibility === 'specified') return false;
	// Explicit editor inputs are handled by the standard form without losing fields.
	if (request.initialPoll !== undefined || request.initialEvent !== undefined || request.initialReactionAcceptance !== undefined || request.restoreDraft !== undefined) return false;
	// 「削除して編集」「編集」も UI3 の投稿欄で受け取る(元ノートの内容を戻して開く)。
	if (request.initialNote) return true;
	if (request.updateMode) return false;
	return request.reply != null || request.renote != null || request.mention != null || request.specified != null || request.channel !== undefined;
}
