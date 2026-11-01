/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

export type HataFeedBellNotification = Extract<Misskey.entities.Notification, { type: 'hataFeed' }>;

export type HataFeedBellGroup = {
	type: 'hataFeed:grouped';
	id: string;
	createdAt: string;
	items: HataFeedBellNotification[];
};

export type BellNotificationForDisplay = Misskey.entities.Notification | HataFeedBellGroup;

type HataFeedFixedMessageKey =
	| 'emojiApproved'
	| 'emojiRejected'
	| 'emojiHeld'
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
	'絵文字の申請が保留になりました。': 'emojiHeld',
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
	次回修正確定: 'statusNextFixConfirmed',
	次回修正予定: 'statusNextFixPlanned',
	修正監視中: 'statusMonitoring',
	解決済み: 'statusResolved',
	見送り: 'statusWontfix',
	用途不明: 'statusUnknown',
	受付終了: 'statusClosed',
} as const;

function localizedStatus(status: string): string {
	const key = HATAFEED_STATUS_KEYS[status as keyof typeof HATAFEED_STATUS_KEYS];
	return key == null ? status : i18n.ts._hata._hatafeed._notificationGroup[key];
}

// 旗鯖fork(i18n): HataFeed のベル通知本文は作成時点の日本語として保存される。
// API/DB形状を変えず、既知の固定・動的パターンだけを表示時に分解して翻訳する。
// 未知の本文は情報を失わないよう、汎用文へ潰さず原文をそのまま返す。
export function hataFeedNotificationDisplayBody(body: string, lang = versatileLang): string {
	if (lang.toLowerCase().startsWith('ja')) return body;

	const copy = i18n.ts._hata._hatafeed._notificationGroup;
	const copyx = i18n.tsx._hata._hatafeed._notificationGroup;
	const fixedKey = HATAFEED_FIXED_MESSAGES[body as keyof typeof HATAFEED_FIXED_MESSAGES];
	if (fixedKey != null) return copy[fixedKey];

	let match = body.match(/^「(.+)」のイシューが投稿されました。$/su);
	if (match) return copyx.issuePosted({ title: match[1] });

	match = body.match(/^イシュー「(.+)」の状態が「(.+)」に変更されました。$/su);
	if (match) return copyx.issueStatusChangedWithTitle({ title: match[1], status: localizedStatus(match[2]) });

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

	match = body.match(/^絵文字「(:[^」]+:)」の(画像更新|取り下げ)申請が届きました。$/su);
	if (match) return copyx.emojiChangeReceived({ emoji: match[1], kind: localizedEmojiChangeKind(match[2]) });

	match = body.match(/^絵文字「(:[^」]+:)」の(画像更新|取り下げ)申請が(承認|保留|却下)されました。（理由: ([\s\S]+)）$/u);
	if (match) return copyx.emojiChangeDecidedWithReason({ emoji: match[1], kind: localizedEmojiChangeKind(match[2]), status: localizedEmojiChangeStatus(match[3]), reason: match[4] });

	match = body.match(/^絵文字「(:[^」]+:)」の(画像更新|取り下げ)申請が(承認|保留|却下)されました。$/u);
	if (match) return copyx.emojiChangeDecided({ emoji: match[1], kind: localizedEmojiChangeKind(match[2]), status: localizedEmojiChangeStatus(match[3]) });

	match = body.match(/^絵文字「(:[^」]+:)」の(画像更新|取り下げ)申請を(承認|保留|却下)しました。$/u);
	if (match) return copyx.emojiChangeStaffDecided({ emoji: match[1], kind: localizedEmojiChangeKind(match[2]), status: localizedEmojiChangeStatus(match[3]) });

	return body;
}

function localizedEmojiChangeKind(kind: string): string {
	const copy = i18n.ts._hata._hatafeed._notificationGroup;
	return kind === '画像更新' ? copy.emojiImageUpdate : copy.emojiWithdraw;
}

function localizedEmojiChangeStatus(status: string): string {
	const copy = i18n.ts._hata._hatafeed._notificationGroup;
	return status === '承認' ? copy.emojiDecisionApproved : status === '保留' ? copy.emojiDecisionHeld : copy.emojiDecisionRejected;
}

/**
 * 本体の通知一覧にある HataFeed 通知を、時系列上の最初の位置へ1つにまとめる。
 * 単独の場合は従来の通知行をそのまま返す。
 */
export function groupHataFeedBellNotifications(
	notifications: Misskey.entities.Notification[],
): BellNotificationForDisplay[] {
	const hataFeedItems = notifications.filter((notification): notification is HataFeedBellNotification => notification.type === 'hataFeed');
	if (hataFeedItems.length < 2) return notifications;

	const group: HataFeedBellGroup = {
		type: 'hataFeed:grouped',
		id: `hatafeed-group:${hataFeedItems[0].id}`,
		createdAt: hataFeedItems[0].createdAt,
		items: hataFeedItems,
	};
	const result: BellNotificationForDisplay[] = [];
	let emitted = false;
	for (const notification of notifications) {
		if (notification.type === 'hataFeed') {
			if (!emitted) {
				result.push(group);
				emitted = true;
			}
			continue;
		}
		result.push(notification);
	}
	return result;
}
