/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { groupHataFeedBellNotifications, hataFeedNotificationDisplayBody } from './hatafeed-bell-group.js';
import type * as Misskey from 'cherrypick-js';

vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));

vi.mock('@/i18n.js', () => {
	const replace = (source: string, values: Record<string, string>) => source.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
	const notificationGroup = {
		emojiApproved: 'Emoji request approved.',
		emojiRejected: 'Emoji request rejected.',
		newComment: 'New comment.',
		commentReaction: 'Comment reaction.',
		issueClosed: 'Issue closed.',
		issueReopened: 'Issue reopened.',
		issueStatusChanged: 'Issue status changed.',
		newEmojiRequest: 'New emoji request.',
		newIssue: 'New issue.',
		moderatorGranted: 'Issue permission granted.',
		issueResolved: 'Issue resolved.',
		statusOpen: 'Open',
		statusPlanned: 'Planned',
		statusInProgress: 'In progress',
		statusNextFixConfirmed: 'Fix confirmed for next release',
		statusNextFixPlanned: 'Fix planned for next release',
		statusMonitoring: 'Monitoring fix',
		statusResolved: 'Resolved',
		statusWontfix: 'Declined',
		statusUnknown: 'Unclear',
		statusClosed: 'Closed',
		emojiImageUpdate: 'image update',
		emojiWithdraw: 'withdrawal',
		emojiDecisionApproved: 'approved',
		emojiDecisionHeld: 'put on hold',
		emojiDecisionRejected: 'rejected',
	};
	const templates = {
		issuePosted: 'Issue "{title}" was posted.',
		issueStatusChangedWithTitle: 'Issue "{title}" changed to "{status}".',
		issueResolvedWithTitle: 'Issue "{title}" was resolved.',
		issueClosedWithTitle: 'Issue "{title}" was closed.',
		issueReopenedWithTitle: 'Issue "{title}" was reopened.',
		commentReplyWithIssue: '{name} replied to your comment on "{title}".',
		commentAddedWithIssue: '{name} commented on "{title}".',
		commentReactionWithIssue: '{name} reacted to your comment on "{title}".',
		commentReactionWithoutIssue: '{name} reacted to your comment.',
		moderatorGrantedWithIssue: 'Permission for "{title}" was granted.',
		emojiApprovedWithName: 'Emoji {emoji} was approved.',
		emojiApprovedByActor: '{name} approved emoji {emoji}.',
		emojiRejectedWithReason: 'Emoji {emoji} was rejected: {reason}',
		emojiRejectedWithName: 'Emoji {emoji} was rejected.',
		emojiRejectedByActor: '{name} rejected emoji {emoji}.',
		emojiChangeReceived: 'Received an emoji {kind} request for {emoji}.',
		emojiChangeDecided: 'The {kind} request for emoji {emoji} was {status}.',
		emojiChangeDecidedWithReason: 'The {kind} request for emoji {emoji} was {status}. Reason: {reason}',
		emojiChangeStaffDecided: 'The {kind} request for emoji {emoji} was {status}.',
	};
	return {
		i18n: {
			ts: { _hata: { _hatafeed: { _notificationGroup: notificationGroup } } },
			tsx: { _hata: { _hatafeed: { _notificationGroup: Object.fromEntries(Object.entries(templates).map(([key, value]) => [key, (params: Record<string, string>) => replace(value, params)])) } } },
		},
	};
});

const hataFeed = (id: string, body: string) => ({
	id,
	createdAt: `2026-08-04T10:00:0${id}.000Z`,
	type: 'hataFeed',
	body,
	header: 'HataFeed',
	icon: null,
	link: `/hatafeed/${id}`,
}) as Extract<Misskey.entities.Notification, { type: 'hataFeed' }>;

describe('groupHataFeedBellNotifications', () => {
	test('複数の HataFeed 通知を最新の位置に1グループとしてまとめる', () => {
		const normal = { id: 'normal', createdAt: '2026-08-04T09:59:59.000Z', type: 'test' } as Misskey.entities.Notification;
		const result = groupHataFeedBellNotifications([hataFeed('2', '二件目'), normal, hataFeed('1', '一件目')]);

		expect(result.map(item => item.type)).toEqual(['hataFeed:grouped', 'test']);
		expect(result[0]).toMatchObject({
			id: 'hatafeed-group:2',
			createdAt: '2026-08-04T10:00:02.000Z',
			items: [{ id: '2' }, { id: '1' }],
		});
	});

	test('同じ本文とリンクの別申請も失わず1グループにまとめる', () => {
		const first = { ...hataFeed('1', '新しい絵文字の申請が来ています。'), link: '/hatafeed' };
		const second = { ...hataFeed('2', '新しい絵文字の申請が来ています。'), link: '/hatafeed' };
		const result = groupHataFeedBellNotifications([second, first]);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			type: 'hataFeed:grouped',
			items: [{ id: '2' }, { id: '1' }],
		});
	});

	test('HataFeed 通知が1件だけなら元の行を変えない', () => {
		const only = hataFeed('1', '一件だけ');
		const result = groupHataFeedBellNotifications([only]);

		expect(result).toEqual([only]);
	});
});

describe('hataFeedNotificationDisplayBody', () => {
	test.each([
		['絵文字の申請が承認されました。', 'Emoji request approved.'],
		['絵文字の申請がリジェクトされました。', 'Emoji request rejected.'],
		['新しいコメントが来ています。', 'New comment.'],
		['あなたのコメントにリアクションが付きました。', 'Comment reaction.'],
		['イシューがクローズされました。', 'Issue closed.'],
		['イシューが再オープンされました。', 'Issue reopened.'],
		['イシューのステータスが変更されました。', 'Issue status changed.'],
		['新しい絵文字の申請が来ています。', 'New emoji request.'],
		['新しいイシューが投稿されました。', 'New issue.'],
		['このイシューの対処権限が付与されました。', 'Issue permission granted.'],
		['イシューが解決済みになりました。', 'Issue resolved.'],
	])('固定本文を通知種別ごとの文言へ変換する: %s', (source, expected) => {
		expect(hataFeedNotificationDisplayBody(source)).toBe(expected);
	});

	test.each([
		['「画面が白い」のイシューが投稿されました。', 'Issue "画面が白い" was posted.'],
		['イシュー「画面が白い」の状態が「対応中」に変更されました。', 'Issue "画面が白い" changed to "In progress".'],
		['イシュー「画面が白い」の状態が「次回修正確定」に変更されました。', 'Issue "画面が白い" changed to "Fix confirmed for next release".'],
		['イシュー「画面が白い」の状態が「次回修正予定」に変更されました。', 'Issue "画面が白い" changed to "Fix planned for next release".'],
		['イシュー「画面が白い」の状態が「修正監視中」に変更されました。', 'Issue "画面が白い" changed to "Monitoring fix".'],
		['イシュー「独自状態」の状態が「確認待ち」に変更されました。', 'Issue "独自状態" changed to "確認待ち".'],
		['「画面が白い」のイシューが解決済みになりました。', 'Issue "画面が白い" was resolved.'],
		['イシュー「画面が白い」がクローズされました（受付終了）。', 'Issue "画面が白い" was closed.'],
		['イシュー「画面が白い」が再オープンされました。', 'Issue "画面が白い" was reopened.'],
		['「画面が白い」のイシューであなたのコメントにアザラシが返信しました。', 'アザラシ replied to your comment on "画面が白い".'],
		['「画面が白い」のイシューにアザラシのコメントが来ています。', 'アザラシ commented on "画面が白い".'],
		['「画面が白い」のイシューであなたのコメントにアザラシがリアクションしました。', 'アザラシ reacted to your comment on "画面が白い".'],
		['イシューであなたのコメントにアザラシがリアクションしました。', 'アザラシ reacted to your comment.'],
		['「画面が白い」のイシューの対処権限が付与されました。', 'Permission for "画面が白い" was granted.'],
		['絵文字「:seal:」の申請が承認されました。', 'Emoji :seal: was approved.'],
		['管理者が絵文字「:seal:」の申請を承認しました。', '管理者 approved emoji :seal:.'],
		['絵文字「:seal:」の申請がリジェクトされました。（理由: 透過してください）', 'Emoji :seal: was rejected: 透過してください'],
		['絵文字「:seal:」の申請がリジェクトされました。', 'Emoji :seal: was rejected.'],
		['管理者が絵文字「:seal:」の申請をリジェクトしました。', '管理者 rejected emoji :seal:.'],
	])('動的本文のタイトル・状態・名前・理由を保持する: %s', (source, expected) => {
		expect(hataFeedNotificationDisplayBody(source)).toBe(expected);
	});

	test('日本語表示と未知本文は情報を失わず原文を維持する', () => {
		const unknown = '将来追加された本文「詳細」';
		expect(hataFeedNotificationDisplayBody(unknown)).toBe(unknown);
		expect(hataFeedNotificationDisplayBody('「題名」のイシューが投稿されました。', 'ja-JP')).toBe('「題名」のイシューが投稿されました。');
	});

	test.each([
		['絵文字「:seal:」の画像更新申請が届きました。', 'Received an emoji image update request for :seal:.'],
		['絵文字「:seal:」の取り下げ申請が届きました。', 'Received an emoji withdrawal request for :seal:.'],
		['絵文字「:seal:」の画像更新申請が承認されました。', 'The image update request for emoji :seal: was approved.'],
		['絵文字「:seal:」の取り下げ申請が保留されました。', 'The withdrawal request for emoji :seal: was put on hold.'],
		['絵文字「:seal:」の画像更新申請を却下しました。', 'The image update request for emoji :seal: was rejected.'],
		['絵文字「:seal:」の取り下げ申請が却下されました。（理由: 一行目\n二行目）', 'The withdrawal request for emoji :seal: was rejected. Reason: 一行目\n二行目'],
	])('変更申請の定型部分だけ翻訳し、絵文字名と理由を保持する: %s', (source, expected) => {
		expect(hataFeedNotificationDisplayBody(source)).toBe(expected);
	});
});
