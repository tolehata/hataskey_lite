/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	FindOneOptions,
	InsertQueryBuilder,
	ObjectLiteral,
	QueryRunner,
	Repository,
	SelectQueryBuilder,
} from 'typeorm';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions.js';
import { RelationIdLoader } from 'typeorm/query-builder/relation-id/RelationIdLoader.js';
import {
	RawSqlResultsToEntityTransformer,
} from 'typeorm/query-builder/transformer/RawSqlResultsToEntityTransformer.js';
import { MiAbuseReportResolver } from '@/models/AbuseReportResolver.js';
import { MiAbuseReportNotificationRecipient } from '@/models/AbuseReportNotificationRecipient.js';
import { MiAbuseUserReport } from '@/models/AbuseUserReport.js';
import { MiAccessToken } from '@/models/AccessToken.js';
import { MiAd } from '@/models/Ad.js';
import { MiAnnouncement } from '@/models/Announcement.js';
import { MiAnnouncementRead } from '@/models/AnnouncementRead.js';
import { MiAntenna } from '@/models/Antenna.js';
import { MiApp } from '@/models/App.js';
import { MiAuthSession } from '@/models/AuthSession.js';
import { MiAvatarDecoration } from '@/models/AvatarDecoration.js';
import { MiBlocking } from '@/models/Blocking.js';
import { MiBubbleGameRecord } from '@/models/BubbleGameRecord.js';
import { MiChannel } from '@/models/Channel.js';
import { MiChannelFavorite } from '@/models/ChannelFavorite.js';
import { MiChannelFollowing } from '@/models/ChannelFollowing.js';
import { MiChannelMember } from '@/models/ChannelMember.js';
import { MiChannelInvitation } from '@/models/ChannelInvitation.js';
import { MiChatApproval } from '@/models/ChatApproval.js';
import { MiChatMessage } from '@/models/ChatMessage.js';
import { MiChatRoom } from '@/models/ChatRoom.js';
import { MiChatRoomInvitation } from '@/models/ChatRoomInvitation.js';
import { MiChatRoomMembership } from '@/models/ChatRoomMembership.js';
import { MiClip } from '@/models/Clip.js';
import { MiClipFavorite } from '@/models/ClipFavorite.js';
import { MiClipNote } from '@/models/ClipNote.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import { MiDriveFolder } from '@/models/DriveFolder.js';
import { MiEmoji } from '@/models/Emoji.js';
import { MiEvent } from '@/models/Event.js';
import { MiFlash } from '@/models/Flash.js';
import { MiFlashLike } from '@/models/FlashLike.js';
import { MiFollowing } from '@/models/Following.js';
import { MiFollowRequest } from '@/models/FollowRequest.js';
import { MiGalleryLike } from '@/models/GalleryLike.js';
import { MiGalleryPost } from '@/models/GalleryPost.js';
import { MiHashtag } from '@/models/Hashtag.js';
import { MiInstance } from '@/models/Instance.js';
import { MiMeta } from '@/models/Meta.js';
import { MiModerationLog } from '@/models/ModerationLog.js';
import { MiMuting } from '@/models/Muting.js';
import { MiNote } from '@/models/Note.js';
import { MiNoteDraft } from '@/models/NoteDraft.js';
import { MiNoteFavorite } from '@/models/NoteFavorite.js';
import { MiNoteFavoriteFolder } from '@/models/NoteFavoriteFolder.js';
import { MiNoteReaction } from '@/models/NoteReaction.js';
import { MiNoteThreadMuting } from '@/models/NoteThreadMuting.js';
import { MiPage } from '@/models/Page.js';
import { MiPageLike } from '@/models/PageLike.js';
import { MiPasswordResetRequest } from '@/models/PasswordResetRequest.js';
import { MiPoll } from '@/models/Poll.js';
import { MiPollVote } from '@/models/PollVote.js';
import { MiPromoNote } from '@/models/PromoNote.js';
import { MiPromoRead } from '@/models/PromoRead.js';
import { MiRegistrationTicket } from '@/models/RegistrationTicket.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { MiRelay } from '@/models/Relay.js';
import { MiRenoteMuting } from '@/models/RenoteMuting.js';
import { MiRetentionAggregation } from '@/models/RetentionAggregation.js';
import { MiReversiGame } from '@/models/ReversiGame.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { MiHataigoChatMessage } from '@/models/HataigoChatMessage.js';
import { MiRole } from '@/models/Role.js';
import { MiRoleAssignment } from '@/models/RoleAssignment.js';
import { MiSignin } from '@/models/Signin.js';
import { MiSwSubscription } from '@/models/SwSubscription.js';
import { MiSystemAccount } from '@/models/SystemAccount.js';
import { MiSystemWebhook } from '@/models/SystemWebhook.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import { MiUser } from '@/models/User.js';
import { MiUserGroup } from '@/models/UserGroup.js';
import { MiUserGroupInvitation } from '@/models/UserGroupInvitation.js';
import { MiUserGroupJoining } from '@/models/UserGroupJoining.js';
import { MiUserIp } from '@/models/UserIp.js';
import { MiUserKeypair } from '@/models/UserKeypair.js';
import { MiUserList } from '@/models/UserList.js';
import { MiUserListFavorite } from '@/models/UserListFavorite.js';
import { MiUserListMembership } from '@/models/UserListMembership.js';
import { MiUserMemo } from '@/models/UserMemo.js';
import { MiUserNotePining } from '@/models/UserNotePining.js';
import { MiUserPending } from '@/models/UserPending.js';
import { MiUserProfile } from '@/models/UserProfile.js';
import { MiUserPublickey } from '@/models/UserPublickey.js';
import { MiUserSecurityKey } from '@/models/UserSecurityKey.js';
import { MiWebhook } from '@/models/Webhook.js';
import { NoteHistory } from '@/models/NoteHistory.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';
import { MiHataskEvent } from '@/models/HataskEvent.js';
import { MiHataskRsvp } from '@/models/HataskRsvp.js';
import { MiHataskFlower } from '@/models/HataskFlower.js';
import { MiHataskRecipe } from '@/models/HataskRecipe.js';
import { MiHataskCookingRecord } from '@/models/HataskCookingRecord.js';
import { MiUtageSession } from '@/models/UtageSession.js';
import { MiFeedbackIssue } from '@/models/FeedbackIssue.js';
import { MiFeedbackAgree } from '@/models/FeedbackAgree.js';
import { MiFeedbackComment } from '@/models/FeedbackComment.js';
import { MiFeedbackCommentReaction } from '@/models/FeedbackCommentReaction.js';
import { MiFeedbackIssueModerator } from '@/models/FeedbackIssueModerator.js';
import { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';
import { MiFeedbackEmojiChangeRequest } from '@/models/FeedbackEmojiChangeRequest.js';
import { MiFeedbackNotification } from '@/models/FeedbackNotification.js';
import { MiFeedbackProject } from '@/models/FeedbackProject.js';
import { MiEarthquakeNotification } from '@/models/EarthquakeNotification.js';
import { MiHatadyBook } from '@/models/HatadyBook.js';
import { MiHatadyLog } from '@/models/HatadyLog.js';
import { MiHatadyComment } from '@/models/HatadyComment.js';
import { MiHatadyReaction } from '@/models/HatadyReaction.js';
import { MiHatadyNotification } from '@/models/HatadyNotification.js';
import { MiHatadyFollowing } from '@/models/HatadyFollowing.js';
import { MiHatadyUserProfile } from '@/models/HatadyUserProfile.js';
import { MiHatadyBookmark } from '@/models/HatadyBookmark.js';
import { MiHatadyBookMemo } from '@/models/HatadyBookMemo.js';
import { MiHatadySubject } from '@/models/HatadySubject.js';
import { MiHatadyGoal } from '@/models/HatadyGoal.js';
import { MiHatadyMediaWork } from '@/models/HatadyMediaWork.js';
import { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import { MiHatadyMediaComment } from '@/models/HatadyMediaComment.js';
import { MiHatadyMediaReaction } from '@/models/HatadyMediaReaction.js';
import { MiHatadyModerationReview } from '@/models/HatadyModerationReview.js';
import { MiHataskEmotionAnalysis } from '@/models/HataskEmotionAnalysis.js';
import type { QueryDeepPartialEntity } from 'typeorm';

export interface MiRepository<T extends ObjectLiteral> {
	createTableColumnNames(this: Repository<T> & MiRepository<T>): string[];

	insertOne(this: Repository<T> & MiRepository<T>, entity: QueryDeepPartialEntity<T>, findOptions?: Pick<FindOneOptions<T>, 'relations'>): Promise<T>;

	insertOneImpl(this: Repository<T> & MiRepository<T>, entity: QueryDeepPartialEntity<T>, findOptions?: Pick<FindOneOptions<T>, 'relations'>, queryRunner?: QueryRunner): Promise<T>;

	selectAliasColumnNames(this: Repository<T> & MiRepository<T>, queryBuilder: InsertQueryBuilder<T>, builder: SelectQueryBuilder<T>): void;
}

export const miRepository = {
	createTableColumnNames() {
		return this.metadata.columns.filter(column => column.isSelect && !column.isVirtual).map(column => column.databaseName);
	},
	async insertOne(entity, findOptions?) {
		const opt = this.manager.connection.options as PostgresDataSourceOptions;
		if (opt.replication) {
			const queryRunner = this.manager.connection.createQueryRunner('master');
			try {
				return this.insertOneImpl(entity, findOptions, queryRunner);
			} finally {
				await queryRunner.release();
			}
		} else {
			return this.insertOneImpl(entity, findOptions);
		}
	},
	async insertOneImpl(entity, findOptions?, queryRunner?) {
		// ---- insert + returningの結果を共通テーブル式(CTE)に保持するクエリを生成 ----

		const queryBuilder = this.createQueryBuilder().insert().values(entity);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const mainAlias = queryBuilder.expressionMap.mainAlias!;
		const name = mainAlias.name;
		mainAlias.name = 't';
		const columnNames = this.createTableColumnNames();
		queryBuilder.returning(columnNames.reduce((a, c) => `${a}, ${queryBuilder.escape(c)}`, '').slice(2));

		// ---- 共通テーブル式(CTE)から結果を取得 ----
		const builder = this.createQueryBuilder(undefined, queryRunner).addCommonTableExpression(queryBuilder, 'cte', { columnNames });
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		builder.expressionMap.mainAlias!.tablePath = 'cte';
		this.selectAliasColumnNames(queryBuilder, builder);
		if (findOptions) {
			builder.setFindOptions(findOptions);
		}
		const raw = await builder.execute();
		mainAlias.name = name;
		// 旗鯖fork: TypeORM v1 で RelationCountLoader/relationCountAttributes は削除済み。
		// RawSqlResultsToEntityTransformer の ctor も 5→4 引数に縮小されたため、
		// relationCount を扱わない簡素な呼び出しに変更。@RelationCount デコレータ未使用のため機能影響なし。
		const relationId = await new RelationIdLoader(builder.connection, this.queryRunner, builder.expressionMap.relationIdAttributes).load(raw);
		const result = new RawSqlResultsToEntityTransformer(builder.expressionMap, builder.connection.driver, relationId, this.queryRunner).transform(raw, mainAlias);
		return result[0];
	},
	selectAliasColumnNames(queryBuilder, builder) {
		let selectOrAddSelect = (selection: string, selectionAliasName?: string) => {
			selectOrAddSelect = (selection, selectionAliasName) => builder.addSelect(selection, selectionAliasName);
			return builder.select(selection, selectionAliasName);
		};
		for (const columnName of this.createTableColumnNames()) {
			selectOrAddSelect(`${builder.alias}.${columnName}`, `${builder.alias}_${columnName}`);
		}
	},
} satisfies MiRepository<ObjectLiteral>;

export {
	MiAbuseReportResolver,
	MiAbuseUserReport,
	MiAbuseReportNotificationRecipient,
	MiAccessToken,
	MiAd,
	MiAnnouncement,
	MiAnnouncementRead,
	MiAntenna,
	MiApp,
	MiAvatarDecoration,
	MiAuthSession,
	MiBlocking,
	MiChannelFollowing,
	MiChannelMember,
	MiChannelInvitation,
	MiChannelFavorite,
	MiClip,
	MiClipNote,
	MiClipFavorite,
	MiDriveFile,
	MiDriveFolder,
	MiEmoji,
	MiEvent,
	MiFollowing,
	MiFollowRequest,
	MiGalleryLike,
	MiGalleryPost,
	MiHashtag,
	MiInstance,
	MiMeta,
	MiModerationLog,
	MiMuting,
	MiRenoteMuting,
	MiNote,
	MiNoteDraft,
	MiNoteFavorite,
	MiNoteFavoriteFolder,
	MiNoteReaction,
	MiNoteThreadMuting,
	MiPage,
	MiPageLike,
	MiPasswordResetRequest,
	MiPoll,
	MiPollVote,
	MiPromoNote,
	MiPromoRead,
	MiRegistrationTicket,
	MiRegistryItem,
	MiRelay,
	MiSignin,
	MiSwSubscription,
	MiSystemAccount,
	MiUsedUsername,
	MiUser,
	MiUserGroup,
	MiUserGroupInvitation,
	MiUserGroupJoining,
	MiUserIp,
	MiUserKeypair,
	MiUserList,
	MiUserListFavorite,
	MiUserListMembership,
	MiUserNotePining,
	MiUserPending,
	MiUserProfile,
	MiUserPublickey,
	MiUserSecurityKey,
	MiWebhook,
	MiSystemWebhook,
	MiChannel,
	MiRetentionAggregation,
	MiRole,
	MiRoleAssignment,
	MiFlash,
	MiFlashLike,
	MiUserMemo,
	MiChatMessage,
	MiChatRoom,
	MiChatRoomMembership,
	MiChatRoomInvitation,
	MiChatApproval,
	MiBubbleGameRecord,
	MiReversiGame,
	MiHataigoGame,
	MiHataigoChatMessage,
	MiRegistrationApplication,
	MiHataskEvent,
	MiHataskRsvp,
	MiHataskFlower,
	MiHataskRecipe,
	MiHataskCookingRecord,
	MiUtageSession,
	MiFeedbackIssue,
	MiFeedbackAgree,
	MiFeedbackComment,
	MiFeedbackCommentReaction,
	MiFeedbackIssueModerator,
	MiFeedbackEmojiRequest,
	MiFeedbackEmojiChangeRequest,
	MiFeedbackNotification,
	MiFeedbackProject,
	MiEarthquakeNotification,
	MiHatadyBook,
	MiHatadyLog,
	MiHatadyComment,
	MiHatadyReaction,
	MiHatadyNotification,
	MiHatadyFollowing,
	MiHatadyUserProfile,
	MiHatadyBookmark,
	MiHatadyBookMemo,
	MiHatadySubject,
	MiHatadyGoal,
	MiHatadyMediaWork,
	MiHatadyMediaSession,
	MiHatadyMediaComment,
	MiHatadyMediaReaction,
	MiHatadyModerationReview,
	MiHataskEmotionAnalysis,
};

export type AbuseReportResolversRepository = Repository<MiAbuseReportResolver> & MiRepository<MiAbuseReportResolver>;
export type AbuseUserReportsRepository = Repository<MiAbuseUserReport> & MiRepository<MiAbuseUserReport>;
export type AbuseReportNotificationRecipientRepository =
	Repository<MiAbuseReportNotificationRecipient>
	& MiRepository<MiAbuseReportNotificationRecipient>;
export type AccessTokensRepository = Repository<MiAccessToken> & MiRepository<MiAccessToken>;
export type AdsRepository = Repository<MiAd> & MiRepository<MiAd>;
export type AnnouncementsRepository = Repository<MiAnnouncement> & MiRepository<MiAnnouncement>;
export type AnnouncementReadsRepository = Repository<MiAnnouncementRead> & MiRepository<MiAnnouncementRead>;
export type AntennasRepository = Repository<MiAntenna> & MiRepository<MiAntenna>;
export type AppsRepository = Repository<MiApp> & MiRepository<MiApp>;
export type AvatarDecorationsRepository = Repository<MiAvatarDecoration> & MiRepository<MiAvatarDecoration>;
export type AuthSessionsRepository = Repository<MiAuthSession> & MiRepository<MiAuthSession>;
export type BlockingsRepository = Repository<MiBlocking> & MiRepository<MiBlocking>;
export type ChannelFollowingsRepository = Repository<MiChannelFollowing> & MiRepository<MiChannelFollowing>;
export type ChannelMembersRepository = Repository<MiChannelMember> & MiRepository<MiChannelMember>;
export type ChannelInvitationsRepository = Repository<MiChannelInvitation> & MiRepository<MiChannelInvitation>;
export type ChannelFavoritesRepository = Repository<MiChannelFavorite> & MiRepository<MiChannelFavorite>;
export type ClipsRepository = Repository<MiClip> & MiRepository<MiClip>;
export type ClipNotesRepository = Repository<MiClipNote> & MiRepository<MiClipNote>;
export type ClipFavoritesRepository = Repository<MiClipFavorite> & MiRepository<MiClipFavorite>;
export type DriveFilesRepository = Repository<MiDriveFile> & MiRepository<MiDriveFile>;
export type DriveFoldersRepository = Repository<MiDriveFolder> & MiRepository<MiDriveFolder>;
export type EmojisRepository = Repository<MiEmoji> & MiRepository<MiEmoji>;
export type EventsRepository = Repository<MiEvent> & MiRepository<MiEvent>;
export type FollowingsRepository = Repository<MiFollowing> & MiRepository<MiFollowing>;
export type FollowRequestsRepository = Repository<MiFollowRequest> & MiRepository<MiFollowRequest>;
export type GalleryLikesRepository = Repository<MiGalleryLike> & MiRepository<MiGalleryLike>;
export type GalleryPostsRepository = Repository<MiGalleryPost> & MiRepository<MiGalleryPost>;
export type HashtagsRepository = Repository<MiHashtag> & MiRepository<MiHashtag>;
export type InstancesRepository = Repository<MiInstance> & MiRepository<MiInstance>;
export type MetasRepository = Repository<MiMeta> & MiRepository<MiMeta>;
export type ModerationLogsRepository = Repository<MiModerationLog> & MiRepository<MiModerationLog>;
export type MutingsRepository = Repository<MiMuting> & MiRepository<MiMuting>;
export type RenoteMutingsRepository = Repository<MiRenoteMuting> & MiRepository<MiRenoteMuting>;
export type NotesRepository = Repository<MiNote> & MiRepository<MiNote>;
export type NoteDraftsRepository = Repository<MiNoteDraft> & MiRepository<MiNoteDraft>;
export type NoteFavoriteFoldersRepository = Repository<MiNoteFavoriteFolder> & MiRepository<MiNoteFavoriteFolder>;
export type NoteFavoritesRepository = Repository<MiNoteFavorite> & MiRepository<MiNoteFavorite>;
export type NoteReactionsRepository = Repository<MiNoteReaction> & MiRepository<MiNoteReaction>;
export type NoteThreadMutingsRepository = Repository<MiNoteThreadMuting> & MiRepository<MiNoteThreadMuting>;
export type PagesRepository = Repository<MiPage> & MiRepository<MiPage>;
export type PageLikesRepository = Repository<MiPageLike> & MiRepository<MiPageLike>;
export type PasswordResetRequestsRepository = Repository<MiPasswordResetRequest> & MiRepository<MiPasswordResetRequest>;
export type PollsRepository = Repository<MiPoll> & MiRepository<MiPoll>;
export type PollVotesRepository = Repository<MiPollVote> & MiRepository<MiPollVote>;
export type PromoNotesRepository = Repository<MiPromoNote> & MiRepository<MiPromoNote>;
export type PromoReadsRepository = Repository<MiPromoRead> & MiRepository<MiPromoRead>;
export type RegistrationTicketsRepository = Repository<MiRegistrationTicket> & MiRepository<MiRegistrationTicket>;
export type RegistryItemsRepository = Repository<MiRegistryItem> & MiRepository<MiRegistryItem>;
export type RelaysRepository = Repository<MiRelay> & MiRepository<MiRelay>;
export type SigninsRepository = Repository<MiSignin> & MiRepository<MiSignin>;
export type SwSubscriptionsRepository = Repository<MiSwSubscription> & MiRepository<MiSwSubscription>;
export type SystemAccountsRepository = Repository<MiSystemAccount> & MiRepository<MiSystemAccount>;
export type UsedUsernamesRepository = Repository<MiUsedUsername> & MiRepository<MiUsedUsername>;
export type UsersRepository = Repository<MiUser> & MiRepository<MiUser>;
export type UserGroupsRepository = Repository<MiUserGroup> & MiRepository<MiUserGroup>;
export type UserGroupInvitationsRepository = Repository<MiUserGroupInvitation> & MiRepository<MiUserGroupInvitation>;
export type UserGroupJoiningsRepository = Repository<MiUserGroupJoining> & MiRepository<MiUserGroupJoining>;
export type UserIpsRepository = Repository<MiUserIp> & MiRepository<MiUserIp>;
export type UserKeypairsRepository = Repository<MiUserKeypair> & MiRepository<MiUserKeypair>;
export type UserListsRepository = Repository<MiUserList> & MiRepository<MiUserList>;
export type UserListFavoritesRepository = Repository<MiUserListFavorite> & MiRepository<MiUserListFavorite>;
export type UserListMembershipsRepository = Repository<MiUserListMembership> & MiRepository<MiUserListMembership>;
export type UserNotePiningsRepository = Repository<MiUserNotePining> & MiRepository<MiUserNotePining>;
export type UserPendingsRepository = Repository<MiUserPending> & MiRepository<MiUserPending>;
export type UserProfilesRepository = Repository<MiUserProfile> & MiRepository<MiUserProfile>;
export type UserPublickeysRepository = Repository<MiUserPublickey> & MiRepository<MiUserPublickey>;
export type UserSecurityKeysRepository = Repository<MiUserSecurityKey> & MiRepository<MiUserSecurityKey>;
export type WebhooksRepository = Repository<MiWebhook> & MiRepository<MiWebhook>;
export type SystemWebhooksRepository = Repository<MiSystemWebhook> & MiRepository<MiWebhook>;
export type ChannelsRepository = Repository<MiChannel> & MiRepository<MiChannel>;
export type RetentionAggregationsRepository = Repository<MiRetentionAggregation> & MiRepository<MiRetentionAggregation>;
export type RolesRepository = Repository<MiRole> & MiRepository<MiRole>;
export type RoleAssignmentsRepository = Repository<MiRoleAssignment> & MiRepository<MiRoleAssignment>;
export type FlashsRepository = Repository<MiFlash> & MiRepository<MiFlash>;
export type FlashLikesRepository = Repository<MiFlashLike> & MiRepository<MiFlashLike>;
export type UserMemoRepository = Repository<MiUserMemo> & MiRepository<MiUserMemo>;
export type ChatMessagesRepository = Repository<MiChatMessage> & MiRepository<MiChatMessage>;
export type ChatRoomsRepository = Repository<MiChatRoom> & MiRepository<MiChatRoom>;
export type ChatRoomMembershipsRepository = Repository<MiChatRoomMembership> & MiRepository<MiChatRoomMembership>;
export type ChatRoomInvitationsRepository = Repository<MiChatRoomInvitation> & MiRepository<MiChatRoomInvitation>;
export type ChatApprovalsRepository = Repository<MiChatApproval> & MiRepository<MiChatApproval>;
export type BubbleGameRecordsRepository = Repository<MiBubbleGameRecord> & MiRepository<MiBubbleGameRecord>;
export type ReversiGamesRepository = Repository<MiReversiGame> & MiRepository<MiReversiGame>;
export type HataigoChatMessagesRepository = Repository<MiHataigoChatMessage> & MiRepository<MiHataigoChatMessage>;
export type HataigoGamesRepository = Repository<MiHataigoGame> & MiRepository<MiHataigoGame>;
export type NoteHistoryRepository = Repository<NoteHistory> & MiRepository<NoteHistory>;
export type RegistrationApplicationsRepository = Repository<MiRegistrationApplication> & MiRepository<MiRegistrationApplication>;
export type HataskEventsRepository = Repository<MiHataskEvent> & MiRepository<MiHataskEvent>;
export type HataskRsvpsRepository = Repository<MiHataskRsvp> & MiRepository<MiHataskRsvp>;
export type HataskFlowersRepository = Repository<MiHataskFlower> & MiRepository<MiHataskFlower>;
export type HataskRecipesRepository = Repository<MiHataskRecipe> & MiRepository<MiHataskRecipe>;
export type HataskCookingRecordsRepository = Repository<MiHataskCookingRecord> & MiRepository<MiHataskCookingRecord>;
export type UtageSessionsRepository = Repository<MiUtageSession> & MiRepository<MiUtageSession>;
export type FeedbackIssuesRepository = Repository<MiFeedbackIssue> & MiRepository<MiFeedbackIssue>;
export type FeedbackAgreesRepository = Repository<MiFeedbackAgree> & MiRepository<MiFeedbackAgree>;
export type EarthquakeNotificationsRepository = Repository<MiEarthquakeNotification> & MiRepository<MiEarthquakeNotification>;
export type FeedbackCommentsRepository = Repository<MiFeedbackComment> & MiRepository<MiFeedbackComment>;
export type FeedbackCommentReactionsRepository = Repository<MiFeedbackCommentReaction> & MiRepository<MiFeedbackCommentReaction>;
export type FeedbackIssueModeratorsRepository = Repository<MiFeedbackIssueModerator> & MiRepository<MiFeedbackIssueModerator>;
export type FeedbackEmojiRequestsRepository = Repository<MiFeedbackEmojiRequest> & MiRepository<MiFeedbackEmojiRequest>;
export type FeedbackEmojiChangeRequestsRepository = Repository<MiFeedbackEmojiChangeRequest> & MiRepository<MiFeedbackEmojiChangeRequest>;
export type FeedbackNotificationsRepository = Repository<MiFeedbackNotification> & MiRepository<MiFeedbackNotification>;
export type FeedbackProjectsRepository = Repository<MiFeedbackProject> & MiRepository<MiFeedbackProject>;
export type HatadyBooksRepository = Repository<MiHatadyBook> & MiRepository<MiHatadyBook>;
export type HatadyLogsRepository = Repository<MiHatadyLog> & MiRepository<MiHatadyLog>;
export type HatadyCommentsRepository = Repository<MiHatadyComment> & MiRepository<MiHatadyComment>;
export type HatadyReactionsRepository = Repository<MiHatadyReaction> & MiRepository<MiHatadyReaction>;
export type HatadyNotificationsRepository = Repository<MiHatadyNotification> & MiRepository<MiHatadyNotification>;
export type HatadyFollowingsRepository = Repository<MiHatadyFollowing> & MiRepository<MiHatadyFollowing>;
export type HatadyUserProfilesRepository = Repository<MiHatadyUserProfile> & MiRepository<MiHatadyUserProfile>;
export type HatadyBookmarksRepository = Repository<MiHatadyBookmark> & MiRepository<MiHatadyBookmark>;
export type HatadyBookMemosRepository = Repository<MiHatadyBookMemo> & MiRepository<MiHatadyBookMemo>;
export type HatadySubjectsRepository = Repository<MiHatadySubject> & MiRepository<MiHatadySubject>;
export type HatadyGoalsRepository = Repository<MiHatadyGoal> & MiRepository<MiHatadyGoal>;
export type HatadyMediaWorksRepository = Repository<MiHatadyMediaWork> & MiRepository<MiHatadyMediaWork>;
export type HatadyMediaSessionsRepository = Repository<MiHatadyMediaSession> & MiRepository<MiHatadyMediaSession>;
export type HatadyMediaCommentsRepository = Repository<MiHatadyMediaComment> & MiRepository<MiHatadyMediaComment>;
export type HatadyMediaReactionsRepository = Repository<MiHatadyMediaReaction> & MiRepository<MiHatadyMediaReaction>;
export type HataskEmotionAnalysesRepository = Repository<MiHataskEmotionAnalysis> & MiRepository<MiHataskEmotionAnalysis>;
