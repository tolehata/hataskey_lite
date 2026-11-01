/* SPDX-License-Identifier: AGPL-3.0-only */
import { i18n } from '@/i18n.js';

/** The preview API supplies fixed Japanese labels, while unknown labels may be user data. */
export function recordModerationImpactLabel(label: string): string {
	switch (label) {
		case '本': return i18n.ts._hata._hatady._composer.bookLabel;
		case '活動記録': return i18n.ts._hata._recordModeration.impactActivity;
		case 'コメント': return i18n.ts._hata._hatady._notifications.filterComment;
		case 'リアクション': return i18n.ts._hata._hatady._notifications.filterReaction;
		case '作品': return i18n.ts._hata._recordModeration.impactWork;
		case 'しおり': return i18n.ts._hata._hatady._bookDetail.bookmarks;
		case '本のメモ': return i18n.ts._hata._recordModeration.impactBookMemo;
		case '関連する通知': return i18n.ts._hata._recordModeration.impactNotifications;
		case '公開・共有された予定': return i18n.ts._hata._recordModeration.impactEvents;
		case '予定の参加回答': return i18n.ts._hata._recordModeration.impactRsvp;
		case '公開用の開花記録': return i18n.ts._hata._recordModeration.impactFlower;
		case '端末と同期する記録（同一記録の保存コピーを含む）': return i18n.ts._hata._recordModeration.impactSynced;
		default: return label;
	}
}

export function recordModerationRetained(text: string): string {
	switch (text) {
		case '関連する活動記録は残り、本・作品との関連だけが解除されます。添付画像のファイル自体は削除しません。': return i18n.ts._hata._recordModeration.retainedCollection;
		case '対象に付随しない記録と、添付画像のファイル自体は削除しません。': return i18n.ts._hata._recordModeration.retainedOther;
		default: return text;
	}
}
