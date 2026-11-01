/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { userExportableEntities, type HatadyNotificationSubtype } from '@/types.js';
import { MiUser } from './User.js';
import { MiNote } from './Note.js';
import { MiUserGroupInvitation } from './UserGroupInvitation.js';
import { MiAccessToken } from './AccessToken.js';
import { MiRole } from './Role.js';
import { MiDriveFile } from './DriveFile.js';
import { MiNoteDraft } from './NoteDraft.js';
import { MiChannelInvitation } from './ChannelInvitation.js';

// cherrypick-js の notificationTypes と同期すべし
export type MiNotification = {
	type: 'note';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
} | {
	type: 'follow';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
} | {
	type: 'mention';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
} | {
	type: 'reply';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
} | {
	type: 'renote';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
	targetNoteId: MiNote['id'];
} | {
	type: 'quote';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
} | {
	type: 'reaction';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
	reaction: string;
} | {
	type: 'pollEnded';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	noteId: MiNote['id'];
} | {
	type: 'scheduledNotePosted';
	id: string;
	createdAt: string;
	noteId: MiNote['id'];
} | {
	type: 'scheduledNotePostFailed';
	id: string;
	createdAt: string;
	noteDraftId: MiNoteDraft['id'];
} | {
	type: 'receiveFollowRequest';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
} | {
	type: 'followRequestAccepted';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	message: string | null;
} | {
	type: 'groupInvited';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	userGroupInvitationId: MiUserGroupInvitation['id'];
} | {
	type: 'roleAssigned';
	id: string;
	createdAt: string;
	roleId: MiRole['id'];
} | {
	type: 'chatRoomInvitationReceived';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	invitationId: string;
} | {
	type: 'achievementEarned';
	id: string;
	createdAt: string;
	achievement: string;
} | {
	type: 'exportCompleted';
	id: string;
	createdAt: string;
	exportedEntity: typeof userExportableEntities[number];
	fileId: MiDriveFile['id'];
} | {
	type: 'login';
	id: string;
	createdAt: string;
	userIp: string;
} | {
	type: 'createToken';
	id: string;
	createdAt: string;
} | {
	type: 'app';
	id: string;
	createdAt: string;

	/**
	 * アプリ通知のbody
	 */
	customBody: string;

	/**
	 * アプリ通知のheader
	 * (省略時はアプリ名で表示されることを期待)
	 */
	customHeader: string | null;

	/**
	 * アプリ通知のicon(URL)
	 * (省略時はアプリアイコンで表示されることを期待)
	 */
	customIcon: string | null;

	/**
	 * アプリ通知のクリック時の遷移先パス
	 * 旗鯖fork: hatask等の旗鯖独自機能の通知をクリックすると該当画面に遷移できるようにするため。
	 * セキュリティ上 '/' で始まる相対パスのみ許可される (絶対URLや javascript: は拒否)。
	 */
	customLink: string | null;

	/**
	 * アプリ通知のアプリ(のトークン)
	 */
	appAccessTokenId: MiAccessToken['id'] | null;
} | {
	// 旗鯖fork: HataFeed(フィードバックセンター)の通知。app通知と同形だが、通知フィルタで
	//   個別にON/OFFできるよう専用タイプにしている。
	type: 'hataFeed';
	id: string;
	createdAt: string;
	/** Older HataFeed entries have no source ID and keep their existing read state. */
	sourceNotificationId?: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	type: 'hatady';
	id: string;
	createdAt: string;
	sourceNotificationId: string;
	subtype: HatadyNotificationSubtype;
	/** Immutable primary target, retained even when a source FK uses SET NULL. */
	targetType: 'none' | 'log' | 'comment' | 'work' | 'session' | 'mediaComment';
	targetId: string | null;
	notifierId?: MiUser['id'];
} | {
	// Hataskの花が収穫できるようになった通知。
	type: 'hataskFlowerReady';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	type: 'hataskFlowerBloomed';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	type: 'hataskZukanUpdated';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	type: 'hataskFestivalBloomed';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	// Hataskのアイコンデコ獲得通知。送信者を持たず、受信・種類フィルタの対象外。ブランド選択には従う。
	type: 'hataskDecorationUnlocked';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	// 旗鯖fork: 地震・津波情報の通知。app通知と同形だが、通知フィルタで個別ON/OFFできるよう専用タイプ。
	type: 'earthquake';
	id: string;
	createdAt: string;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	// 旗鯖fork: プライベートチャンネルのメンバーに追加された通知 (app通知と同形)。
	type: 'addedToPrivateChannel';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'] | null;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
	/** 通常メンバーへの参加招待だけに付く。副管理者への即時追加通知では未指定。 */
	channelInvitationId?: MiChannelInvitation['id'];
} | {
	// 旗鯖fork: プライベートチャンネルのメンバーから外された通知 (app通知と同形)。
	type: 'removedFromPrivateChannel';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'] | null;
	customBody: string;
	customHeader: string | null;
	customIcon: string | null;
	customLink: string | null;
} | {
	type: 'test';
	id: string;
	createdAt: string;
};

export type MiGroupedNotification = MiNotification | {
	type: 'reaction:grouped';
	id: string;
	createdAt: string;
	noteId: MiNote['id'];
	reactions: {
		userId: string;
		reaction: string;
	}[];
} | {
	type: 'renote:grouped';
	id: string;
	createdAt: string;
	noteId: MiNote['id'];
	userIds: string[];
} | {
	type: 'note:grouped';
	id: string;
	createdAt: string;
	notifierIds: MiUser['id'][];
	noteIds: string[];
} | {
	/**
	 * 旗鯖fork: 同じユーザーから複数ノートへのリアクションをグルーピング
	 * (本家の 'reaction:grouped' が "1ノートに複数ユーザー" を集約するのに対し、
	 *  こちらは "1ユーザーから複数ノート" を集約する)
	 */
	type: 'reaction:groupedByUser';
	id: string;
	createdAt: string;
	notifierId: MiUser['id'];
	reactions: {
		noteId: MiNote['id'];
		reaction: string;
		createdAt: string;
	}[];
};
