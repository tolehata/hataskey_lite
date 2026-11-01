/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { I18n } from '@@/js/i18n.js';
import type { Locale } from '../../../../locales/index.js';

type HataFeedFixedMessageKey =
	| 'emojiApproved'
	| 'emojiRejected'
	| 'newComment'
	| 'commentReaction'
	| 'issueClosed'
	| 'issueReopened'
	| 'issueStatusChanged'
	| 'newEmojiRequest'
	| 'newIssue'
	| 'moderatorGranted'
	| 'issueResolved';

const HATAFEED_FIXED_MESSAGES = {
	'絵文字の申請が承認されました。': 'emojiApproved',
	'絵文字の申請がリジェクトされました。': 'emojiRejected',
	'新しいコメントが来ています。': 'newComment',
	'あなたのコメントにリアクションが付きました。': 'commentReaction',
	'イシューがクローズされました。': 'issueClosed',
	'イシューが再オープンされました。': 'issueReopened',
	'イシューのステータスが変更されました。': 'issueStatusChanged',
	'新しい絵文字の申請が来ています。': 'newEmojiRequest',
	'新しいイシューが投稿されました。': 'newIssue',
	'このイシューの対処権限が付与されました。': 'moderatorGranted',
	'イシューが解決済みになりました。': 'issueResolved',
} as const satisfies Record<string, HataFeedFixedMessageKey>;

const HATAFEED_STATUS_KEYS = {
	受付中: 'statusOpen',
	対応予定: 'statusPlanned',
	対応中: 'statusInProgress',
	解決済み: 'statusResolved',
	見送り: 'statusWontfix',
	用途不明: 'statusUnknown',
	受付終了: 'statusClosed',
} as const;

type HataI18n = I18n<Locale>;

function localizedStatus(status: string, i18n: HataI18n): string {
	const key = HATAFEED_STATUS_KEYS[status as keyof typeof HATAFEED_STATUS_KEYS];
	return key == null ? status : i18n.ts._hata._hatafeed._notificationGroup[key];
}

// HataFeed の通知本文は既存DB・Push形式との互換のため日本語のまま届く。
// 既知の固定・動的形式だけを現在のSW localeへ変換し、未知本文は原文を保持する。
export function hataFeedNotificationDisplayBody(body: string, i18n: HataI18n): string {
	const copy = i18n.ts._hata._hatafeed._notificationGroup;
	const copyx = i18n.tsx._hata._hatafeed._notificationGroup;
	const fixedKey = HATAFEED_FIXED_MESSAGES[body as keyof typeof HATAFEED_FIXED_MESSAGES];
	if (fixedKey != null) return copy[fixedKey];

	let match = body.match(/^「(.+)」のイシューが投稿されました。$/su);
	if (match) return copyx.issuePosted({ title: match[1] });

	match = body.match(/^イシュー「(.+)」の状態が「(.+)」に変更されました。$/su);
	if (match) return copyx.issueStatusChangedWithTitle({ title: match[1], status: localizedStatus(match[2], i18n) });

	match = body.match(/^「(.+)」のイシューが解決済みになりました。$/su);
	if (match) return copyx.issueResolvedWithTitle({ title: match[1] });

	match = body.match(/^イシュー「(.+)」がクローズされました（受付終了）。$/su);
	if (match) return copyx.issueClosedWithTitle({ title: match[1] });

	match = body.match(/^イシュー「(.+)」が再オープンされました。$/su);
	if (match) return copyx.issueReopenedWithTitle({ title: match[1] });

	match = body.match(/^「(.+)」のイシューであなたのコメントに(.+)が返信しました。$/su);
	if (match) return copyx.commentReplyWithIssue({ title: match[1], name: match[2] });

	match = body.match(/^「(.+)」のイシューに(.+)のコメントが来ています。$/su);
	if (match) return copyx.commentAddedWithIssue({ title: match[1], name: match[2] });

	match = body.match(/^「(.+)」のイシューであなたのコメントに(.+)がリアクションしました。$/su);
	if (match) return copyx.commentReactionWithIssue({ title: match[1], name: match[2] });

	match = body.match(/^イシューであなたのコメントに(.+)がリアクションしました。$/su);
	if (match) return copyx.commentReactionWithoutIssue({ name: match[1] });

	match = body.match(/^「(.+)」のイシューの対処権限が付与されました。$/su);
	if (match) return copyx.moderatorGrantedWithIssue({ title: match[1] });

	match = body.match(/^絵文字「(:[^」]+:)」の申請が承認されました。$/su);
	if (match) return copyx.emojiApprovedWithName({ emoji: match[1] });

	match = body.match(/^(.+)が絵文字「(:[^」]+:)」の申請を承認しました。$/su);
	if (match) return copyx.emojiApprovedByActor({ name: match[1], emoji: match[2] });

	match = body.match(/^絵文字「(:[^」]+:)」の申請がリジェクトされました。（理由: (.+)）$/su);
	if (match) return copyx.emojiRejectedWithReason({ emoji: match[1], reason: match[2] });

	match = body.match(/^絵文字「(:[^」]+:)」の申請がリジェクトされました。$/su);
	if (match) return copyx.emojiRejectedWithName({ emoji: match[1] });

	match = body.match(/^(.+)が絵文字「(:[^」]+:)」の申請をリジェクトしました。$/su);
	if (match) return copyx.emojiRejectedByActor({ name: match[1], emoji: match[2] });

	return body;
}

export type PrivateChannelNotificationType = 'addedToPrivateChannel' | 'removedFromPrivateChannel';

export function privateChannelNotificationDisplayCopy(
	type: PrivateChannelNotificationType,
	header: string,
	body: string,
	i18n: HataI18n,
): { header: string; body: string } {
	const copy = i18n.ts._hata._privateChannels;
	const copyx = i18n.tsx._hata._privateChannels;

	if (type === 'addedToPrivateChannel') {
		let match = body.match(/^プライベートチャンネル「(.+)」への参加招待が届きました。参加するか選んでください。$/su);
		if (match) {
			return {
				header: copy.invitationNotificationHeader,
				body: copyx.invitationNotificationBodyWithName({ name: match[1] }),
			};
		}

		match = body.match(/^プライベートチャンネル「(.+)」の副管理者に追加されました。タップしてチャンネルを開く。$/su);
		if (match) {
			return {
				header: copy.addedNotificationHeader,
				body: copyx.addedManagerNotificationBodyWithName({ name: match[1] }),
			};
		}
	}

	if (type === 'removedFromPrivateChannel') {
		let match = body.match(/^プライベートチャンネル「(.+)」の副管理者から外れました。$/su);
		if (match) {
			return {
				header: copy.removedNotificationHeader,
				body: copyx.removedManagerNotificationBodyWithName({ name: match[1] }),
			};
		}

		match = body.match(/^プライベートチャンネル「(.+)」のメンバーから外れました。$/su);
		if (match) {
			return {
				header: copy.removedNotificationHeader,
				body: copyx.removedMemberNotificationBodyWithName({ name: match[1] }),
			};
		}
	}

	return { header, body };
}
