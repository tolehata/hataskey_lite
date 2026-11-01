/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: HataFeed 共通のラベル定義とヘルパー(カテゴリ/ステータス/通知アイコン)。
 */

import { ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hataFeedNotificationDisplayBody } from '@/utility/hatafeed-bell-group.js';

// 旗鯖fork: HataFeed通知の未読数。⚠️標準通知の未読数とは別のカウンタ。
//   バッジを出す画面と既読にする画面が別なので、共有の ref を通して同期する。
export const hataFeedUnreadCount = ref(0);

/**
 * 旗鯖fork: HataFeed通知をすべて既読にしてバッジを消す。
 * ⚠️「一覧を表示した時点」で呼ぶ。HataFeedのベルからでも標準通知からでも同じ挙動にするため、
 *   未読数を持っていない画面から呼ばれても動くよう、件数を見ずに必ずAPIを叩く。
 * ⚠️失敗しても画面を止めない(バッジが残るだけ)。
 */
export async function markHataFeedNotificationsRead(): Promise<void> {
	try {
		await misskeyApi('hata/feedback/notifications/read', {});
		hataFeedUnreadCount.value = 0;
	} catch {
		// バッジが消えないだけなので、利用者の操作は妨げない
	}
}

const copy = i18n.ts._hata._hatafeed._shared;
const tx = i18n.tsx._hata._hatafeed._shared;

// 旗鯖fork: 絵文字申請一覧・単件確認・連続確認で共有する表示用の形。
// SDKの独自エンドポイント応答型が空オブジェクト扱いでも、画面内ではこの形を一貫して使う。
export interface HataFeedEmojiRequest {
	id: string;
	createdAt: string;
	requestedBy: Misskey.entities.UserLite | null;
	name: string;
	category: string | null;
	aliases: string[];
	license: string | null;
	localOnly: boolean;
	isSensitive: boolean;
	sourceType: string;
	originalUrl: string | null;
	remoteHost: string | null;
	imageUrl: string | null;
	status: 'pending' | 'held' | 'approved' | 'rejected' | 'cancelled';
	resolvedComment: string | null;
	resolvedById: string | null;
	resolvedAt: string | null;
	resolvedEmojiId: string | null;
	cancelledAt?: string | null;
	cancellationReason?: string | null;
	currentEmoji?: { id: string; name: string; imageUrl: string; license: string | null; category: string | null; aliases: string[] } | null;
	latestChange?: HataFeedEmojiChangeRequest | null;
}

export interface HataFeedEmojiChangeRequest {
	id: string;
	originalRequestId: string;
	targetEmojiId: string;
	createdAt: string;
	updatedAt: string;
	requestedBy: Misskey.entities.UserLite | null;
	kind: 'updateImage' | 'withdraw';
	status: 'pending' | 'held' | 'approved' | 'rejected';
	name: string;
	reason: string;
	previousImageUrl: string;
	imageUrl: string | null;
	license: string | null;
	resolvedAt: string | null;
	resolvedById: string | null;
	resolvedComment: string | null;
	events: { status: HataFeedEmojiChangeRequest['status']; at: string; actorId: string; comment: string | null }[];
}

export const emojiChangeLabel = { updateImage: i18n.ts._hata._hatafeed._emojiChangeCommon.imageUpdate, withdraw: i18n.ts._hata._hatafeed._emojiChangeCommon.withdraw } as const;
export function emojiRequestDisplayStatus(request: HataFeedEmojiRequest): string {
	if (request.status === 'approved' && request.currentEmoji === null) return request.latestChange?.kind === 'withdraw' && request.latestChange.status === 'approved' ? 'removed' : 'missing';
	return request.status;
}
export function activeEmojiChange(request: HataFeedEmojiRequest): HataFeedEmojiChangeRequest | null {
	return request.latestChange && ['pending', 'held'].includes(request.latestChange.status) ? request.latestChange : null;
}
export function emojiChangeError(error: unknown): string {
	const labels = i18n.ts._hata._hatafeed._emojiChangeCommon;
	const messages: Record<string, string> = {
		HATAFEED_EMOJI_REQUEST_CONFLICT: labels.requestConflict,
		HATAFEED_EMOJI_TARGET_CHANGED: labels.targetChanged,
		HATAFEED_EMOJI_CHANGE_PENDING: labels.changePending,
		HATAFEED_EMOJI_INVALID_IMAGE: labels.invalidImage,
		HATAFEED_EMOJI_REASON_REQUIRED: labels.reasonRequired,
		NO_SUCH_EMOJI_REQUEST: labels.requestMissing,
		HATAFEED_ACCESS_DENIED: labels.accessDenied,
	};
	return messages[(error as { code?: string })?.code ?? ''] ?? labels.failed;
}

// 旗鯖fork: 現在試せるベータ機能の一覧。ベータページのカードと、ベータボタンのバッジ数の両方で使う。
//   ここに追加するだけで「ベータ機能を試す」ボタンのバッジ数とページ内容が同期する。
export interface HataBetaFeature {
	id: string;
	title: string;
	desc: string;
	icon: string;
	route: string;
}
export const hataBetaFeatures: HataBetaFeature[] = [];

// 旗鯖fork: トグル式(ページではなくスイッチで切り替える)のベータ機能。
//   ベータページのスイッチと、ベータボタンのバッジ数の両方で数える。
export const hataBetaToggleFeatures = [
	{ id: 'post-send-delay', title: copy.postCountdown },
];

// 旗鯖fork: 現在試せるベータ機能の総数(カード＋トグル)。ベータボタンのバッジに使う。
export const hataBetaTotal = hataBetaFeatures.length + hataBetaToggleFeatures.length;

// カテゴリ(7種)。
export const categoryLabel: Record<string, string> = {
	bug: copy.categoryBug,
	improvement: copy.categoryImprovement,
	unresolved: copy.categoryUnresolved,
	featureRequest: copy.categoryFeatureRequest,
	adoptionRequest: copy.categoryAdoptionRequest,
	security: copy.categorySecurity,
	betaFeature: copy.categoryBetaFeature,
	other: copy.categoryOther,
};
export const categoryKeys = ['bug', 'improvement', 'unresolved', 'featureRequest', 'adoptionRequest', 'security', 'betaFeature', 'other'] as const;
export type HataFeedCategory = typeof categoryKeys[number];

// ユーザーがイシュー作成時に選べるカテゴリ。
// 「改善予定(improvement)」は管理者が掲示するロードマップ専用なので、作成ウィザードからは除外する。
export const creatableCategoryKeys = ['bug', 'unresolved', 'featureRequest', 'adoptionRequest', 'security', 'betaFeature', 'other'] as const satisfies readonly HataFeedCategory[];

// 旗鯖fork: スタッフ(管理者/モデ)専用カテゴリ。一般ユーザーには作成ウィザード・絞り込みから隠す。
// security はセキュリティ対応の内部限定扱い(閲覧・作成ともスタッフのみ)。
export const staffOnlyCategoryKeys = ['security'] as const satisfies readonly HataFeedCategory[];

// カテゴリの説明(ウィザードで選びやすくするため)。
export const categoryDesc: Record<string, string> = {
	bug: copy.categoryBugDescription,
	improvement: copy.categoryImprovementDescription,
	unresolved: copy.categoryUnresolvedDescription,
	featureRequest: copy.categoryFeatureRequestDescription,
	adoptionRequest: copy.categoryAdoptionRequestDescription,
	security: copy.categorySecurityDescription,
	betaFeature: copy.categoryBetaFeatureDescription,
	other: copy.categoryOtherDescription,
};
export const categoryIcon: Record<string, string> = {
	bug: 'ti ti-bug',
	improvement: 'ti ti-arrow-up-circle',
	unresolved: 'ti ti-help-circle',
	featureRequest: 'ti ti-bulb',
	adoptionRequest: 'ti ti-download',
	security: 'ti ti-shield-lock',
	betaFeature: 'ti ti-flask',
	other: 'ti ti-dots',
};

// ステータス。
export const statusLabel: Record<string, string> = {
	open: copy.statusOpen,
	planned: copy.statusPlanned,
	inProgress: copy.statusInProgress,
	nextFixConfirmed: copy.statusNextFixConfirmed,
	nextFixPlanned: copy.statusNextFixPlanned,
	monitoring: copy.statusMonitoring,
	resolved: copy.statusResolved,
	wontfix: copy.statusWontfix,
	unknown: copy.statusUnknown,
	closed: copy.statusClosed,
};
export const editableStatusKeys = ['open', 'planned', 'inProgress', 'nextFixConfirmed', 'nextFixPlanned', 'monitoring', 'resolved', 'wontfix', 'unknown'] as const;
export type HataFeedEditableStatus = typeof editableStatusKeys[number];
export const statusKeys = [...editableStatusKeys, 'closed'] as const;
export type HataFeedStatus = typeof statusKeys[number];

// 旗鯖fork(デザイン改修 §2.2): ステータスのアイコン(Tabler)。リスト行の先頭ドットアイコン・
// 詳細ヘッダーの塗りピルで共用する。色は HfStatusPill 側で data-status ベースに当てる
// (CSS Module は動的キーを解決できないため、意味色は現行コードの値を data 属性で踏襲)。
export const statusIcon: Record<string, string> = {
	open: 'ti-circle-dot',
	planned: 'ti-calendar-time',
	inProgress: 'ti-progress',
	nextFixConfirmed: 'ti-calendar-check',
	nextFixPlanned: 'ti-calendar-event',
	monitoring: 'ti-activity-heartbeat',
	resolved: 'ti-circle-check',
	wontfix: 'ti-circle-minus',
	unknown: 'ti-help-circle',
	closed: 'ti-lock',
};

export const priorityLabel = {
	low: copy.priorityLow,
	normal: copy.priorityNormal,
	high: copy.priorityHigh,
} as const;
export type HataFeedPriority = keyof typeof priorityLabel;

export const emojiStatusLabel: Record<string, string> = {
	pending: copy.emojiPending,
	held: copy.emojiHeld,
	approved: copy.emojiApproved,
	rejected: copy.emojiRejected,
	cancelled: i18n.ts._hata._hatafeed._emojiChangeCommon.cancelled,
	removed: i18n.ts._hata._hatafeed._emojiChangeCommon.removed,
	missing: i18n.ts._hata._hatafeed._emojiChangeCommon.missing,
};

// 絵文字申請の状態アイコン(承認=✓ / 審査中=時計 / 却下=🚫)。
export const emojiStatusIcon: Record<string, string> = {
	pending: 'ti-clock-hour-4',
	held: 'ti-player-pause',
	approved: 'ti-circle-check',
	rejected: 'ti-ban',
	cancelled: 'ti-circle-minus',
	removed: 'ti-circle-minus',
	missing: 'ti-alert-circle',
};

// 通知タイプ → 日本語ラベル(ホーム通知フィルタ用)。
export const notifTypeLabel: Record<string, string> = {
	newComment: copy.notificationComment,
	commentReaction: copy.notificationCommentReaction,
	issueStatusChanged: copy.notificationStatusChanged,
	issueClosed: copy.notificationClosed,
	issueReopened: copy.notificationReopened,
	issueResolved: copy.notificationResolved,
	newIssue: copy.notificationNewIssue,
	moderatorGranted: copy.notificationModeratorGranted,
	newEmojiRequest: copy.notificationNewEmojiRequest,
	emojiApproved: copy.notificationEmojiApproved,
	emojiRejected: copy.notificationEmojiRejected,
	emojiHeld: copy.notificationEmojiHeld,
};

// 旗鯖fork(デザイン改修 §2.4): アバターのフォールバック色。既存アバター画像が無いときだけ
// 頭文字1字 + この淡色をユーザー毎に安定して割り当てる(HfAvatar で使用)。
export const HF_AVATAR_COLORS = ['#a9c4e8', '#f2b3c6', '#a8d8b9', '#c9b8e8', '#f5d491'];

// 旗鯖fork: seed 文字列(userId 等)から HF_AVATAR_COLORS のインデックスを安定的に導く。
//   同じユーザーには常に同じ色が付くよう、単純な文字コード総和のハッシュを使う。
export function hfAvatarColor(seed: string | null | undefined): string {
	if (!seed) return HF_AVATAR_COLORS[0];
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % HF_AVATAR_COLORS.length;
	return HF_AVATAR_COLORS[h];
}

// 旗鯖fork: 表示名/ユーザー名の先頭1字(頭文字アバター用)。無ければ「?」。
export function hfInitial(user: { name?: string | null; username?: string | null } | null | undefined): string {
	const s = (user?.name ?? user?.username ?? '').trim();
	return s.length > 0 ? [...s][0] : '?';
}

// 旗鯖fork(通知グルーピング): HataFeed 通知1件の最小形。バックエンド packNotifications の返却に対応。
export interface HataFeedNotifActor {
	id: string;
	name?: string | null;
	username?: string | null;
	avatarUrl?: string | null;
	[k: string]: unknown;
}
export interface HataFeedNotif {
	id: string;
	createdAt: string;
	type: string;
	message: string;
	isRead: boolean;
	actor: HataFeedNotifActor | null;
	feedbackId: string | null;
	emojiRequestId: string | null;
	emojiChangeRequestId?: string | null;
	commentId?: string | null;
	[k: string]: unknown;
}

// 旗鯖fork(通知グルーピング): まとめ後の1行分。
//   count===1 のグループは実質「単一通知」で、items[0] をそのまま表示する。
export interface HataFeedNotifGroup {
	key: string;
	type: string;
	items: HataFeedNotif[]; // 新しい順(APIの id DESC を踏襲)
	count: number; // items.length
	actors: HataFeedNotifActor[]; // 重複除去した actor(新しい順)
	isRead: boolean; // 全件既読なら true
	createdAt: string; // 代表(最新)の createdAt
	feedbackId: string | null;
	emojiRequestId: string | null;
}

export function notificationDisplayMessage(notification: HataFeedNotif): string {
	return hataFeedNotificationDisplayBody(notification.message);
}

// 旗鯖fork(通知グルーピング): 本体 Misskey の reaction:grouped(同一ノートへの複数リアクション)の流儀に倣い、
//   「同一の対象(イシュー)への同種イベント」を1行にまとめる型。代表例は複数人が同じイシューに付けたコメント。
//   クリック先(feedbackId)が一意に定まるので、まとめても遷移が曖昧にならない。
const TARGET_GROUPED_TYPES = new Set(['newComment', 'issueStatusChanged', 'issueClosed', 'issueReopened', 'issueResolved']);
// 旗鯖fork(通知グルーピング): 対象はばらけるが「種類」でまとめた方が見やすい型(主にスタッフ視点の受信)。
//   例: 複数の新規イシュー/絵文字申請を「新規イシュー N件」に集約する。個別遷移は展開して行う。
const TYPE_GROUPED_TYPES = new Set(['newIssue', 'newEmojiRequest']);

// 旗鯖fork(通知グルーピング): 取得済みの通知配列(新しい順)をグループ配列に変換する。
//   パネルが取得した1ページ分に閉じたクライアント側処理で、バックエンド・本体通知には一切触れない。
export function groupHataFeedNotifications(notifications: HataFeedNotif[]): HataFeedNotifGroup[] {
	const groups: HataFeedNotifGroup[] = [];
	const byKey = new Map<string, HataFeedNotifGroup>();

	for (const n of notifications) {
		let key: string;
		if (TARGET_GROUPED_TYPES.has(n.type) && n.feedbackId) key = `t:${n.type}:${n.feedbackId}`;
		else if (TYPE_GROUPED_TYPES.has(n.type)) key = `y:${n.type}`;
		else key = `s:${n.id}`;

		let g = byKey.get(key);
		if (!g) {
			g = {
				key,
				type: n.type,
				items: [],
				count: 0,
				actors: [],
				isRead: true,
				createdAt: n.createdAt,
				feedbackId: n.feedbackId ?? null,
				emojiRequestId: n.emojiRequestId ?? null,
			};
			byKey.set(key, g);
			groups.push(g);
		}
		g.items.push(n);
	}

	for (const g of groups) {
		g.count = g.items.length;
		// items は新しい順なので先頭が代表。
		g.createdAt = g.items[0].createdAt;
		g.feedbackId = g.items[0].feedbackId ?? null;
		g.emojiRequestId = g.items[0].emojiRequestId ?? null;
		g.isRead = g.items.every(i => i.isRead);
		// actor を重複除去して新しい順に収集(まとめ行のアバター重ね表示用)。
		const seen = new Set<string>();
		for (const i of g.items) {
			const a = i.actor;
			if (a && a.id && !seen.has(a.id)) { seen.add(a.id); g.actors.push(a); }
		}
	}

	return groups;
}

// 旗鯖fork(通知グルーピング): まとめ行の見出し文。単一件は元メッセージをそのまま返す。
//   複数件は本体の「〇〇他N人が〜」/「〜 N件」に倣った短い集約表現にする。
export function groupSummary(g: HataFeedNotifGroup): string {
	if (g.count === 1) return notificationDisplayMessage(g.items[0]);
	const label = notifTypeLabel[g.type] ?? g.type;
	const first = g.actors[0];
	const firstName = first ? (first.name ?? first.username ?? '') : '';

	// 同一対象へ複数アクター(コメント等) → 「〇〇 他N人が{ラベル}」。
	if (TARGET_GROUPED_TYPES.has(g.type)) {
		if (g.actors.length >= 2) return tx.groupActors({ name: firstName, count: g.actors.length - 1, label });
		if (firstName) return tx.groupActor({ name: firstName, label, count: g.count });
		return tx.groupCount({ label, count: g.count });
	}

	// 種類まとめ(新規イシュー/絵文字申請など) → 「{ラベル} N件」。
	return tx.groupCount({ label, count: g.count });
}

// 通知タイプ → アイコン。
export function notifIcon(type: string): string {
	switch (type) {
		case 'emojiApproved': return 'ti-check';
		case 'emojiRejected': return 'ti-x';
		case 'newComment': return 'ti-message-circle';
		case 'commentReaction': return 'ti-mood-plus';
		case 'issueClosed': return 'ti-lock';
		case 'issueReopened': return 'ti-lock-open';
		case 'issueStatusChanged': return 'ti-refresh';
		case 'newEmojiRequest': return 'ti-mood-smile';
		case 'newIssue': return 'ti-pencil-plus';
		case 'moderatorGranted': return 'ti-shield-check';
		default: return 'ti-bell';
	}
}
