/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

// 旗鯖fork(i18n): private channel の customBody は既存DBとの互換のため日本語のまま保存する。
// 既知の4形式だけを表示時に分解し、チャンネル名を保ったまま現在のlocaleへ変換する。
// 未知の本文は情報を落とさず原文を維持する。
export function privateChannelNotificationDisplayBody(body: string, lang = versatileLang): string {
	if (lang.toLowerCase().startsWith('ja')) return body;

	const copyx = i18n.tsx._hata._privateChannels;
	let match = body.match(/^プライベートチャンネル「(.+)」への参加招待が届きました。参加するか選んでください。$/su);
	if (match) return copyx.invitationNotificationBodyWithName({ name: match[1] });

	match = body.match(/^プライベートチャンネル「(.+)」の副管理者に追加されました。タップしてチャンネルを開く。$/su);
	if (match) return copyx.addedManagerNotificationBodyWithName({ name: match[1] });

	match = body.match(/^プライベートチャンネル「(.+)」の副管理者から外れました。$/su);
	if (match) return copyx.removedManagerNotificationBodyWithName({ name: match[1] });

	match = body.match(/^プライベートチャンネル「(.+)」のメンバーから外れました。$/su);
	if (match) return copyx.removedMemberNotificationBodyWithName({ name: match[1] });

	return body;
}
