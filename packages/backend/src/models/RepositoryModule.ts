/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Module } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import {
	MiAbuseReportNotificationRecipient,
	MiAbuseReportResolver,
	MiAbuseUserReport,
	MiAccessToken,
	MiAd,
	MiAnnouncement,
	MiAnnouncementRead,
	MiAntenna,
	MiApp,
	MiAuthSession,
	MiAvatarDecoration,
	MiBlocking,
	MiBubbleGameRecord,
	MiChannel,
	MiChannelFavorite,
	MiChannelFollowing,
	MiChannelMember,
	MiChannelInvitation,
	MiClip,
	MiClipFavorite,
	MiClipNote,
	MiDriveFile,
	MiDriveFolder,
	MiEmoji,
	MiEvent,
	MiFlash,
	MiFlashLike,
	MiFollowing,
	MiFollowRequest,
	MiGalleryLike,
	MiGalleryPost,
	MiHashtag,
	MiInstance,
	MiMeta,
	MiModerationLog,
	MiMuting,
	MiNote,
	MiNoteFavorite,
	MiNoteFavoriteFolder,
	MiNoteReaction,
	MiNoteThreadMuting,
	MiNoteDraft,
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
	MiRenoteMuting,
	MiRepository,
	miRepository,
	MiRetentionAggregation,
	MiReversiGame,
	MiHataigoGame,
	MiHataigoChatMessage,
	MiRole,
	MiRoleAssignment,
	MiSignin,
	MiSwSubscription,
	MiSystemAccount,
	MiSystemWebhook,
	MiUsedUsername,
	MiUser,
	MiUserGroup,
	MiUserGroupJoining,
	MiUserGroupInvitation,
	MiUserIp,
	MiUserKeypair,
	MiUserList,
	MiUserListFavorite,
	MiUserListMembership,
	MiUserMemo,
	MiUserNotePining,
	MiUserPending,
	MiUserProfile,
	MiUserPublickey,
	MiUserSecurityKey,
	MiWebhook,
	MiChatMessage,
	MiChatRoom,
	MiChatRoomMembership,
	MiChatRoomInvitation,
	MiChatApproval,
} from './_.js';
import { NoteHistory } from './NoteHistory.js';
import { MiRegistrationApplication } from './RegistrationApplication.js';
import { MiHataskEvent } from './HataskEvent.js';
import { MiHataskRsvp } from './HataskRsvp.js';
import { MiHataskFlower } from './HataskFlower.js';
import { MiHataskRecipe } from './HataskRecipe.js';
import { MiHataskCookingRecord } from './HataskCookingRecord.js';
import { MiUtageSession } from './UtageSession.js';
import { MiFeedbackIssue } from './FeedbackIssue.js';
import { MiFeedbackAgree } from './FeedbackAgree.js';
import { MiFeedbackComment } from './FeedbackComment.js';
import { MiFeedbackCommentReaction } from './FeedbackCommentReaction.js';
import { MiEarthquakeNotification } from './EarthquakeNotification.js';
import { MiHatadyBook } from './HatadyBook.js';
import { MiHatadyLog } from './HatadyLog.js';
import { MiHatadyComment } from './HatadyComment.js';
import { MiHatadyReaction } from './HatadyReaction.js';
import { MiHatadyNotification } from './HatadyNotification.js';
import { MiHatadyFollowing } from './HatadyFollowing.js';
import { MiHatadyUserProfile } from './HatadyUserProfile.js';
import { MiHatadyBookmark } from './HatadyBookmark.js';
import { MiHatadyBookMemo } from './HatadyBookMemo.js';
import { MiHatadySubject } from './HatadySubject.js';
import { MiHatadyGoal } from './HatadyGoal.js';
import { MiHatadyMediaWork } from './HatadyMediaWork.js';
import { MiHatadyMediaSession } from './HatadyMediaSession.js';
import { MiHatadyMediaComment } from './HatadyMediaComment.js';
import { MiHatadyMediaReaction } from './HatadyMediaReaction.js';
import { MiHataskEmotionAnalysis } from './HataskEmotionAnalysis.js';
import { MiFeedbackIssueModerator } from './FeedbackIssueModerator.js';
import { MiFeedbackEmojiRequest } from './FeedbackEmojiRequest.js';
import { MiFeedbackEmojiChangeRequest } from './FeedbackEmojiChangeRequest.js';
import { MiFeedbackNotification } from './FeedbackNotification.js';
import { MiFeedbackProject } from './FeedbackProject.js';
import type { Provider } from '@nestjs/common';
import type { DataSource } from 'typeorm';

const $usersRepository: Provider = {
	provide: DI.usersRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUser).extend(miRepository as MiRepository<MiUser>),
	inject: [DI.db],
};

const $notesRepository: Provider = {
	provide: DI.notesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNote).extend(miRepository as MiRepository<MiNote>),
	inject: [DI.db],
};

const $announcementsRepository: Provider = {
	provide: DI.announcementsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAnnouncement).extend(miRepository as MiRepository<MiAnnouncement>),
	inject: [DI.db],
};

const $announcementReadsRepository: Provider = {
	provide: DI.announcementReadsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAnnouncementRead).extend(miRepository as MiRepository<MiAnnouncementRead>),
	inject: [DI.db],
};

const $appsRepository: Provider = {
	provide: DI.appsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiApp).extend(miRepository as MiRepository<MiApp>),
	inject: [DI.db],
};

const $avatarDecorationsRepository: Provider = {
	provide: DI.avatarDecorationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAvatarDecoration).extend(miRepository as MiRepository<MiAvatarDecoration>),
	inject: [DI.db],
};

const $noteFavoriteFoldersRepository: Provider = {
	provide: DI.noteFavoriteFoldersRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNoteFavoriteFolder).extend(miRepository as MiRepository<MiNoteFavoriteFolder>),
	inject: [DI.db],
};

const $noteFavoritesRepository: Provider = {
	provide: DI.noteFavoritesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNoteFavorite).extend(miRepository as MiRepository<MiNoteFavorite>),
	inject: [DI.db],
};

const $noteThreadMutingsRepository: Provider = {
	provide: DI.noteThreadMutingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNoteThreadMuting).extend(miRepository as MiRepository<MiNoteThreadMuting>),
	inject: [DI.db],
};

const $noteReactionsRepository: Provider = {
	provide: DI.noteReactionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNoteReaction).extend(miRepository as MiRepository<MiNoteReaction>),
	inject: [DI.db],
};

const $noteDraftsRepository: Provider = {
	provide: DI.noteDraftsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiNoteDraft).extend(miRepository as MiRepository<MiNoteDraft>),
	inject: [DI.db],
};

const $pollsRepository: Provider = {
	provide: DI.pollsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPoll).extend(miRepository as MiRepository<MiPoll>),
	inject: [DI.db],
};

const $pollVotesRepository: Provider = {
	provide: DI.pollVotesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPollVote).extend(miRepository as MiRepository<MiPollVote>),
	inject: [DI.db],
};

const $userProfilesRepository: Provider = {
	provide: DI.userProfilesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserProfile).extend(miRepository as MiRepository<MiUserProfile>),
	inject: [DI.db],
};

const $userKeypairsRepository: Provider = {
	provide: DI.userKeypairsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserKeypair).extend(miRepository as MiRepository<MiUserKeypair>),
	inject: [DI.db],
};

const $userPendingsRepository: Provider = {
	provide: DI.userPendingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserPending).extend(miRepository as MiRepository<MiUserPending>),
	inject: [DI.db],
};

const $userSecurityKeysRepository: Provider = {
	provide: DI.userSecurityKeysRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserSecurityKey).extend(miRepository as MiRepository<MiUserSecurityKey>),
	inject: [DI.db],
};

const $userPublickeysRepository: Provider = {
	provide: DI.userPublickeysRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserPublickey).extend(miRepository as MiRepository<MiUserPublickey>),
	inject: [DI.db],
};

const $userListsRepository: Provider = {
	provide: DI.userListsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserList).extend(miRepository as MiRepository<MiUserList>),
	inject: [DI.db],
};

const $userListFavoritesRepository: Provider = {
	provide: DI.userListFavoritesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserListFavorite).extend(miRepository as MiRepository<MiUserListFavorite>),
	inject: [DI.db],
};

const $userListMembershipsRepository: Provider = {
	provide: DI.userListMembershipsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserListMembership).extend(miRepository as MiRepository<MiUserListMembership>),
	inject: [DI.db],
};

const $userGroupsRepository: Provider = {
	provide: DI.userGroupsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserGroup).extend(miRepository as MiRepository<MiUserGroup>),
	inject: [DI.db],
};

const $userGroupJoiningsRepository: Provider = {
	provide: DI.userGroupJoiningsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserGroupJoining).extend(miRepository as MiRepository<MiUserGroupJoining>),
	inject: [DI.db],
};

const $userGroupInvitationsRepository: Provider = {
	provide: DI.userGroupInvitationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserGroupInvitation).extend(miRepository as MiRepository<MiUserGroupInvitation>),
	inject: [DI.db],
};

const $userNotePiningsRepository: Provider = {
	provide: DI.userNotePiningsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserNotePining).extend(miRepository as MiRepository<MiUserNotePining>),
	inject: [DI.db],
};

const $userIpsRepository: Provider = {
	provide: DI.userIpsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserIp).extend(miRepository as MiRepository<MiUserIp>),
	inject: [DI.db],
};

const $usedUsernamesRepository: Provider = {
	provide: DI.usedUsernamesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUsedUsername).extend(miRepository as MiRepository<MiUsedUsername>),
	inject: [DI.db],
};

const $followingsRepository: Provider = {
	provide: DI.followingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFollowing).extend(miRepository as MiRepository<MiFollowing>),
	inject: [DI.db],
};

const $followRequestsRepository: Provider = {
	provide: DI.followRequestsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFollowRequest).extend(miRepository as MiRepository<MiFollowRequest>),
	inject: [DI.db],
};

const $instancesRepository: Provider = {
	provide: DI.instancesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiInstance).extend(miRepository as MiRepository<MiInstance>),
	inject: [DI.db],
};

const $emojisRepository: Provider = {
	provide: DI.emojisRepository,
	useFactory: (db: DataSource) => db.getRepository(MiEmoji).extend(miRepository as MiRepository<MiEmoji>),
	inject: [DI.db],
};

const $eventsRepository: Provider = {
	provide: DI.eventsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiEvent).extend(miRepository as MiRepository<MiEvent>),
	inject: [DI.db],
};

const $driveFilesRepository: Provider = {
	provide: DI.driveFilesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiDriveFile).extend(miRepository as MiRepository<MiDriveFile>),
	inject: [DI.db],
};

const $driveFoldersRepository: Provider = {
	provide: DI.driveFoldersRepository,
	useFactory: (db: DataSource) => db.getRepository(MiDriveFolder).extend(miRepository as MiRepository<MiDriveFolder>),
	inject: [DI.db],
};

const $metasRepository: Provider = {
	provide: DI.metasRepository,
	useFactory: (db: DataSource) => db.getRepository(MiMeta).extend(miRepository as MiRepository<MiMeta>),
	inject: [DI.db],
};

const $mutingsRepository: Provider = {
	provide: DI.mutingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiMuting).extend(miRepository as MiRepository<MiMuting>),
	inject: [DI.db],
};

const $renoteMutingsRepository: Provider = {
	provide: DI.renoteMutingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRenoteMuting).extend(miRepository as MiRepository<MiRenoteMuting>),
	inject: [DI.db],
};

const $blockingsRepository: Provider = {
	provide: DI.blockingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiBlocking).extend(miRepository as MiRepository<MiBlocking>),
	inject: [DI.db],
};

const $swSubscriptionsRepository: Provider = {
	provide: DI.swSubscriptionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiSwSubscription).extend(miRepository as MiRepository<MiSwSubscription>),
	inject: [DI.db],
};

const $systemAccountsRepository: Provider = {
	provide: DI.systemAccountsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiSystemAccount).extend(miRepository as MiRepository<MiSystemAccount>),
	inject: [DI.db],
};

const $hashtagsRepository: Provider = {
	provide: DI.hashtagsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHashtag).extend(miRepository as MiRepository<MiHashtag>),
	inject: [DI.db],
};

const $abuseUserReportsRepository: Provider = {
	provide: DI.abuseUserReportsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAbuseUserReport).extend(miRepository as MiRepository<MiAbuseUserReport>),
	inject: [DI.db],
};

const $abuseReportNotificationRecipientRepository: Provider = {
	provide: DI.abuseReportNotificationRecipientRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAbuseReportNotificationRecipient).extend(miRepository as MiRepository<MiAbuseReportNotificationRecipient>),
	inject: [DI.db],
};

const $registrationTicketsRepository: Provider = {
	provide: DI.registrationTicketsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRegistrationTicket).extend(miRepository as MiRepository<MiRegistrationTicket>),
	inject: [DI.db],
};

const $authSessionsRepository: Provider = {
	provide: DI.authSessionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAuthSession).extend(miRepository as MiRepository<MiAuthSession>),
	inject: [DI.db],
};

const $accessTokensRepository: Provider = {
	provide: DI.accessTokensRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAccessToken).extend(miRepository as MiRepository<MiAccessToken>),
	inject: [DI.db],
};

const $signinsRepository: Provider = {
	provide: DI.signinsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiSignin).extend(miRepository as MiRepository<MiSignin>),
	inject: [DI.db],
};

const $pagesRepository: Provider = {
	provide: DI.pagesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPage).extend(miRepository as MiRepository<MiPage>),
	inject: [DI.db],
};

const $pageLikesRepository: Provider = {
	provide: DI.pageLikesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPageLike).extend(miRepository as MiRepository<MiPageLike>),
	inject: [DI.db],
};

const $galleryPostsRepository: Provider = {
	provide: DI.galleryPostsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiGalleryPost).extend(miRepository as MiRepository<MiGalleryPost>),
	inject: [DI.db],
};

const $galleryLikesRepository: Provider = {
	provide: DI.galleryLikesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiGalleryLike).extend(miRepository as MiRepository<MiGalleryLike>),
	inject: [DI.db],
};

const $moderationLogsRepository: Provider = {
	provide: DI.moderationLogsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiModerationLog).extend(miRepository as MiRepository<MiModerationLog>),
	inject: [DI.db],
};

const $clipsRepository: Provider = {
	provide: DI.clipsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiClip).extend(miRepository as MiRepository<MiClip>),
	inject: [DI.db],
};

const $clipNotesRepository: Provider = {
	provide: DI.clipNotesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiClipNote).extend(miRepository as MiRepository<MiClipNote>),
	inject: [DI.db],
};

const $clipFavoritesRepository: Provider = {
	provide: DI.clipFavoritesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiClipFavorite).extend(miRepository as MiRepository<MiClipFavorite>),
	inject: [DI.db],
};

const $antennasRepository: Provider = {
	provide: DI.antennasRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAntenna).extend(miRepository as MiRepository<MiAntenna>),
	inject: [DI.db],
};

const $promoNotesRepository: Provider = {
	provide: DI.promoNotesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPromoNote).extend(miRepository as MiRepository<MiPromoNote>),
	inject: [DI.db],
};

const $promoReadsRepository: Provider = {
	provide: DI.promoReadsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPromoRead).extend(miRepository as MiRepository<MiPromoRead>),
	inject: [DI.db],
};

const $relaysRepository: Provider = {
	provide: DI.relaysRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRelay).extend(miRepository as MiRepository<MiRelay>),
	inject: [DI.db],
};

const $channelsRepository: Provider = {
	provide: DI.channelsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChannel).extend(miRepository as MiRepository<MiChannel>),
	inject: [DI.db],
};

const $channelFollowingsRepository: Provider = {
	provide: DI.channelFollowingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChannelFollowing).extend(miRepository as MiRepository<MiChannelFollowing>),
	inject: [DI.db],
};

const $channelMembersRepository: Provider = {
	provide: DI.channelMembersRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChannelMember).extend(miRepository as MiRepository<MiChannelMember>),
	inject: [DI.db],
};

const $channelInvitationsRepository: Provider = {
	provide: DI.channelInvitationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChannelInvitation).extend(miRepository as MiRepository<MiChannelInvitation>),
	inject: [DI.db],
};

const $channelFavoritesRepository: Provider = {
	provide: DI.channelFavoritesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChannelFavorite).extend(miRepository as MiRepository<MiChannelFavorite>),
	inject: [DI.db],
};

const $registryItemsRepository: Provider = {
	provide: DI.registryItemsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRegistryItem).extend(miRepository as MiRepository<MiRegistryItem>),
	inject: [DI.db],
};

const $webhooksRepository: Provider = {
	provide: DI.webhooksRepository,
	useFactory: (db: DataSource) => db.getRepository(MiWebhook).extend(miRepository as MiRepository<MiWebhook>),
	inject: [DI.db],
};

const $systemWebhooksRepository: Provider = {
	provide: DI.systemWebhooksRepository,
	useFactory: (db: DataSource) => db.getRepository(MiSystemWebhook).extend(miRepository as MiRepository<MiSystemWebhook>),
	inject: [DI.db],
};

const $adsRepository: Provider = {
	provide: DI.adsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAd).extend(miRepository as MiRepository<MiAd>),
	inject: [DI.db],
};

const $passwordResetRequestsRepository: Provider = {
	provide: DI.passwordResetRequestsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiPasswordResetRequest).extend(miRepository as MiRepository<MiPasswordResetRequest>),
	inject: [DI.db],
};

const $retentionAggregationsRepository: Provider = {
	provide: DI.retentionAggregationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRetentionAggregation).extend(miRepository as MiRepository<MiRetentionAggregation>),
	inject: [DI.db],
};

const $flashsRepository: Provider = {
	provide: DI.flashsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFlash).extend(miRepository as MiRepository<MiFlash>),
	inject: [DI.db],
};

const $flashLikesRepository: Provider = {
	provide: DI.flashLikesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFlashLike).extend(miRepository as MiRepository<MiFlashLike>),
	inject: [DI.db],
};

const $rolesRepository: Provider = {
	provide: DI.rolesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRole).extend(miRepository as MiRepository<MiRole>),
	inject: [DI.db],
};

const $roleAssignmentsRepository: Provider = {
	provide: DI.roleAssignmentsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRoleAssignment).extend(miRepository as MiRepository<MiRoleAssignment>),
	inject: [DI.db],
};

const $userMemosRepository: Provider = {
	provide: DI.userMemosRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUserMemo).extend(miRepository as MiRepository<MiUserMemo>),
	inject: [DI.db],
};

const $chatMessagesRepository: Provider = {
	provide: DI.chatMessagesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChatMessage).extend(miRepository as MiRepository<MiChatMessage>),
	inject: [DI.db],
};

const $chatRoomsRepository: Provider = {
	provide: DI.chatRoomsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChatRoom).extend(miRepository as MiRepository<MiChatRoom>),
	inject: [DI.db],
};

const $chatRoomMembershipsRepository: Provider = {
	provide: DI.chatRoomMembershipsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChatRoomMembership).extend(miRepository as MiRepository<MiChatRoomMembership>),
	inject: [DI.db],
};

const $chatRoomInvitationsRepository: Provider = {
	provide: DI.chatRoomInvitationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChatRoomInvitation).extend(miRepository as MiRepository<MiChatRoomInvitation>),
	inject: [DI.db],
};

const $chatApprovalsRepository: Provider = {
	provide: DI.chatApprovalsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiChatApproval).extend(miRepository as MiRepository<MiChatApproval>),
	inject: [DI.db],
};

const $bubbleGameRecordsRepository: Provider = {
	provide: DI.bubbleGameRecordsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiBubbleGameRecord).extend(miRepository as MiRepository<MiBubbleGameRecord>),
	inject: [DI.db],
};

const $reversiGamesRepository: Provider = {
	provide: DI.reversiGamesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiReversiGame).extend(miRepository as MiRepository<MiReversiGame>),
	inject: [DI.db],
};

const $hataigoChatMessagesRepository: Provider = {
	provide: DI.hataigoChatMessagesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataigoChatMessage).extend(miRepository as MiRepository<MiHataigoChatMessage>),
	inject: [DI.db],
};

const $hataigoGamesRepository: Provider = {
	provide: DI.hataigoGamesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataigoGame).extend(miRepository as MiRepository<MiHataigoGame>),
	inject: [DI.db],
};

const $abuseReportResolversRepository: Provider = {
	provide: DI.abuseReportResolversRepository,
	useFactory: (db: DataSource) => db.getRepository(MiAbuseReportResolver).extend(miRepository as MiRepository<MiAbuseReportResolver>),
	inject: [DI.db],
};

const $noteHistoryRepository: Provider = {
	provide: DI.noteHistoryRepository,
	useFactory: (db: DataSource) => db.getRepository(NoteHistory).extend(miRepository as MiRepository<NoteHistory>),
	inject: [DI.db],
};

const $registrationApplicationsRepository: Provider = {
	provide: DI.registrationApplicationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiRegistrationApplication).extend(miRepository as MiRepository<MiRegistrationApplication>),
	inject: [DI.db],
};

const $hataskRecipesRepository: Provider = {
	provide: DI.hataskRecipesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskRecipe).extend(miRepository as MiRepository<MiHataskRecipe>),
	inject: [DI.db],
};

const $hataskCookingRecordsRepository: Provider = {
	provide: DI.hataskCookingRecordsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskCookingRecord).extend(miRepository as MiRepository<MiHataskCookingRecord>),
	inject: [DI.db],
};

const $hataskEventsRepository: Provider = {
	provide: DI.hataskEventsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskEvent).extend(miRepository as MiRepository<MiHataskEvent>),
	inject: [DI.db],
};

const $hataskRsvpsRepository: Provider = {
	provide: DI.hataskRsvpsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskRsvp).extend(miRepository as MiRepository<MiHataskRsvp>),
	inject: [DI.db],
};

const $hataskFlowersRepository: Provider = {
	provide: DI.hataskFlowersRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskFlower).extend(miRepository as MiRepository<MiHataskFlower>),
	inject: [DI.db],
};

const $utageSessionsRepository: Provider = {
	provide: DI.utageSessionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiUtageSession).extend(miRepository as MiRepository<MiUtageSession>),
	inject: [DI.db],
};

const $feedbackIssuesRepository: Provider = {
	provide: DI.feedbackIssuesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackIssue).extend(miRepository as MiRepository<MiFeedbackIssue>),
	inject: [DI.db],
};

const $feedbackAgreesRepository: Provider = {
	provide: DI.feedbackAgreesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackAgree).extend(miRepository as MiRepository<MiFeedbackAgree>),
	inject: [DI.db],
};

const $earthquakeNotificationsRepository: Provider = {
	provide: DI.earthquakeNotificationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiEarthquakeNotification).extend(miRepository as MiRepository<MiEarthquakeNotification>),
	inject: [DI.db],
};

const $hatadyBooksRepository: Provider = {
	provide: DI.hatadyBooksRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyBook).extend(miRepository as MiRepository<MiHatadyBook>),
	inject: [DI.db],
};

const $hatadyLogsRepository: Provider = {
	provide: DI.hatadyLogsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyLog).extend(miRepository as MiRepository<MiHatadyLog>),
	inject: [DI.db],
};

const $hatadyCommentsRepository: Provider = {
	provide: DI.hatadyCommentsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyComment).extend(miRepository as MiRepository<MiHatadyComment>),
	inject: [DI.db],
};

const $hatadyReactionsRepository: Provider = {
	provide: DI.hatadyReactionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyReaction).extend(miRepository as MiRepository<MiHatadyReaction>),
	inject: [DI.db],
};

const $hatadyNotificationsRepository: Provider = {
	provide: DI.hatadyNotificationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyNotification).extend(miRepository as MiRepository<MiHatadyNotification>),
	inject: [DI.db],
};

const $hatadyFollowingsRepository: Provider = {
	provide: DI.hatadyFollowingsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyFollowing).extend(miRepository as MiRepository<MiHatadyFollowing>),
	inject: [DI.db],
};

const $hatadyUserProfilesRepository: Provider = {
	provide: DI.hatadyUserProfilesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyUserProfile).extend(miRepository as MiRepository<MiHatadyUserProfile>),
	inject: [DI.db],
};

const $hatadyBookmarksRepository: Provider = {
	provide: DI.hatadyBookmarksRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyBookmark).extend(miRepository as MiRepository<MiHatadyBookmark>),
	inject: [DI.db],
};

const $hatadyBookMemosRepository: Provider = {
	provide: DI.hatadyBookMemosRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyBookMemo).extend(miRepository as MiRepository<MiHatadyBookMemo>),
	inject: [DI.db],
};

const $hatadySubjectsRepository: Provider = {
	provide: DI.hatadySubjectsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadySubject).extend(miRepository as MiRepository<MiHatadySubject>),
	inject: [DI.db],
};

const $hatadyGoalsRepository: Provider = {
	provide: DI.hatadyGoalsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyGoal).extend(miRepository as MiRepository<MiHatadyGoal>),
	inject: [DI.db],
};

const $hatadyMediaWorksRepository: Provider = {
	provide: DI.hatadyMediaWorksRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyMediaWork).extend(miRepository as MiRepository<MiHatadyMediaWork>),
	inject: [DI.db],
};

const $hatadyMediaSessionsRepository: Provider = {
	provide: DI.hatadyMediaSessionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyMediaSession).extend(miRepository as MiRepository<MiHatadyMediaSession>),
	inject: [DI.db],
};

const $hatadyMediaCommentsRepository: Provider = {
	provide: DI.hatadyMediaCommentsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyMediaComment).extend(miRepository as MiRepository<MiHatadyMediaComment>),
	inject: [DI.db],
};

const $hatadyMediaReactionsRepository: Provider = {
	provide: DI.hatadyMediaReactionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHatadyMediaReaction).extend(miRepository as MiRepository<MiHatadyMediaReaction>),
	inject: [DI.db],
};

const $hataskEmotionAnalysesRepository: Provider = {
	provide: DI.hataskEmotionAnalysesRepository,
	useFactory: (db: DataSource) => db.getRepository(MiHataskEmotionAnalysis).extend(miRepository as MiRepository<MiHataskEmotionAnalysis>),
	inject: [DI.db],
};

const $feedbackCommentsRepository: Provider = {
	provide: DI.feedbackCommentsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackComment).extend(miRepository as MiRepository<MiFeedbackComment>),
	inject: [DI.db],
};

const $feedbackCommentReactionsRepository: Provider = {
	provide: DI.feedbackCommentReactionsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackCommentReaction).extend(miRepository as MiRepository<MiFeedbackCommentReaction>),
	inject: [DI.db],
};

const $feedbackIssueModeratorsRepository: Provider = {
	provide: DI.feedbackIssueModeratorsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackIssueModerator).extend(miRepository as MiRepository<MiFeedbackIssueModerator>),
	inject: [DI.db],
};

const $feedbackEmojiRequestsRepository: Provider = {
	provide: DI.feedbackEmojiRequestsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackEmojiRequest).extend(miRepository as MiRepository<MiFeedbackEmojiRequest>),
	inject: [DI.db],
};

const $feedbackEmojiChangeRequestsRepository: Provider = {
	provide: DI.feedbackEmojiChangeRequestsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackEmojiChangeRequest).extend(miRepository as MiRepository<MiFeedbackEmojiChangeRequest>),
	inject: [DI.db],
};

const $feedbackNotificationsRepository: Provider = {
	provide: DI.feedbackNotificationsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackNotification).extend(miRepository as MiRepository<MiFeedbackNotification>),
	inject: [DI.db],
};

const $feedbackProjectsRepository: Provider = {
	provide: DI.feedbackProjectsRepository,
	useFactory: (db: DataSource) => db.getRepository(MiFeedbackProject).extend(miRepository as MiRepository<MiFeedbackProject>),
	inject: [DI.db],
};

@Module({
	imports: [],
	providers: [
		$usersRepository,
		$notesRepository,
		$announcementsRepository,
		$announcementReadsRepository,
		$appsRepository,
		$avatarDecorationsRepository,
		$noteFavoritesRepository,
		$noteFavoriteFoldersRepository,
		$noteThreadMutingsRepository,
		$noteReactionsRepository,
		$noteDraftsRepository,
		$pollsRepository,
		$pollVotesRepository,
		$userProfilesRepository,
		$userKeypairsRepository,
		$userPendingsRepository,
		$userSecurityKeysRepository,
		$userPublickeysRepository,
		$userListsRepository,
		$userListFavoritesRepository,
		$userListMembershipsRepository,
		$userGroupsRepository,
		$userGroupJoiningsRepository,
		$userGroupInvitationsRepository,
		$userNotePiningsRepository,
		$userIpsRepository,
		$usedUsernamesRepository,
		$followingsRepository,
		$followRequestsRepository,
		$instancesRepository,
		$emojisRepository,
		$eventsRepository,
		$driveFilesRepository,
		$driveFoldersRepository,
		$metasRepository,
		$mutingsRepository,
		$renoteMutingsRepository,
		$blockingsRepository,
		$swSubscriptionsRepository,
		$systemAccountsRepository,
		$hashtagsRepository,
		$abuseUserReportsRepository,
		$abuseReportNotificationRecipientRepository,
		$registrationTicketsRepository,
		$authSessionsRepository,
		$accessTokensRepository,
		$signinsRepository,
		$pagesRepository,
		$pageLikesRepository,
		$galleryPostsRepository,
		$galleryLikesRepository,
		$moderationLogsRepository,
		$clipsRepository,
		$clipNotesRepository,
		$clipFavoritesRepository,
		$antennasRepository,
		$promoNotesRepository,
		$promoReadsRepository,
		$relaysRepository,
		$channelsRepository,
		$channelFollowingsRepository,
		$channelMembersRepository,
		$channelInvitationsRepository,
		$channelFavoritesRepository,
		$registryItemsRepository,
		$webhooksRepository,
		$systemWebhooksRepository,
		$adsRepository,
		$passwordResetRequestsRepository,
		$retentionAggregationsRepository,
		$rolesRepository,
		$roleAssignmentsRepository,
		$flashsRepository,
		$flashLikesRepository,
		$userMemosRepository,
		$chatMessagesRepository,
		$chatRoomsRepository,
		$chatRoomMembershipsRepository,
		$chatRoomInvitationsRepository,
		$chatApprovalsRepository,
		$bubbleGameRecordsRepository,
		$reversiGamesRepository,
		$hataigoGamesRepository,
		$hataigoChatMessagesRepository,
		$abuseReportResolversRepository,
		$noteHistoryRepository,
		$registrationApplicationsRepository,
		$hataskEventsRepository,
		$hataskRsvpsRepository,
		$hataskFlowersRepository,
		$hataskRecipesRepository,
		$hataskCookingRecordsRepository,
		$utageSessionsRepository,
		$feedbackIssuesRepository,
		$feedbackAgreesRepository,
		$earthquakeNotificationsRepository,
		$hatadyBooksRepository,
		$hatadyLogsRepository,
		$hatadyCommentsRepository,
		$hatadyReactionsRepository,
		$hatadyNotificationsRepository,
		$hatadyFollowingsRepository,
		$hatadyUserProfilesRepository,
		$hatadyBookmarksRepository,
		$hatadyBookMemosRepository,
		$hatadySubjectsRepository,
		$hatadyGoalsRepository,
		$hatadyMediaWorksRepository,
		$hatadyMediaSessionsRepository,
		$hatadyMediaCommentsRepository,
		$hatadyMediaReactionsRepository,
		$hataskEmotionAnalysesRepository,
		$feedbackCommentsRepository,
		$feedbackCommentReactionsRepository,
		$feedbackIssueModeratorsRepository,
		$feedbackEmojiRequestsRepository,
		$feedbackEmojiChangeRequestsRepository,
		$feedbackNotificationsRepository,
		$feedbackProjectsRepository,
	],
	exports: [
		$usersRepository,
		$notesRepository,
		$announcementsRepository,
		$announcementReadsRepository,
		$appsRepository,
		$avatarDecorationsRepository,
		$noteFavoritesRepository,
		$noteFavoriteFoldersRepository,
		$noteThreadMutingsRepository,
		$noteReactionsRepository,
		$noteDraftsRepository,
		$pollsRepository,
		$pollVotesRepository,
		$userProfilesRepository,
		$userKeypairsRepository,
		$userPendingsRepository,
		$userSecurityKeysRepository,
		$userPublickeysRepository,
		$userListsRepository,
		$userListFavoritesRepository,
		$userListMembershipsRepository,
		$userGroupsRepository,
		$userGroupJoiningsRepository,
		$userGroupInvitationsRepository,
		$userNotePiningsRepository,
		$userIpsRepository,
		$usedUsernamesRepository,
		$followingsRepository,
		$followRequestsRepository,
		$instancesRepository,
		$emojisRepository,
		$eventsRepository,
		$driveFilesRepository,
		$driveFoldersRepository,
		$metasRepository,
		$mutingsRepository,
		$renoteMutingsRepository,
		$blockingsRepository,
		$swSubscriptionsRepository,
		$systemAccountsRepository,
		$hashtagsRepository,
		$abuseUserReportsRepository,
		$abuseReportNotificationRecipientRepository,
		$registrationTicketsRepository,
		$authSessionsRepository,
		$accessTokensRepository,
		$signinsRepository,
		$pagesRepository,
		$pageLikesRepository,
		$galleryPostsRepository,
		$galleryLikesRepository,
		$moderationLogsRepository,
		$clipsRepository,
		$clipNotesRepository,
		$clipFavoritesRepository,
		$antennasRepository,
		$promoNotesRepository,
		$promoReadsRepository,
		$relaysRepository,
		$channelsRepository,
		$channelFollowingsRepository,
		$channelMembersRepository,
		$channelInvitationsRepository,
		$channelFavoritesRepository,
		$registryItemsRepository,
		$webhooksRepository,
		$systemWebhooksRepository,
		$adsRepository,
		$passwordResetRequestsRepository,
		$retentionAggregationsRepository,
		$rolesRepository,
		$roleAssignmentsRepository,
		$flashsRepository,
		$flashLikesRepository,
		$userMemosRepository,
		$chatMessagesRepository,
		$chatRoomsRepository,
		$chatRoomMembershipsRepository,
		$chatRoomInvitationsRepository,
		$chatApprovalsRepository,
		$bubbleGameRecordsRepository,
		$reversiGamesRepository,
		$hataigoGamesRepository,
		$hataigoChatMessagesRepository,
		$abuseReportResolversRepository,
		$noteHistoryRepository,
		$registrationApplicationsRepository,
		$hataskEventsRepository,
		$hataskRsvpsRepository,
		$hataskFlowersRepository,
		$hataskRecipesRepository,
		$hataskCookingRecordsRepository,
		$utageSessionsRepository,
		$feedbackIssuesRepository,
		$feedbackAgreesRepository,
		$earthquakeNotificationsRepository,
		$hatadyBooksRepository,
		$hatadyLogsRepository,
		$hatadyCommentsRepository,
		$hatadyReactionsRepository,
		$hatadyNotificationsRepository,
		$hatadyFollowingsRepository,
		$hatadyUserProfilesRepository,
		$hatadyBookmarksRepository,
		$hatadyBookMemosRepository,
		$hatadySubjectsRepository,
		$hatadyGoalsRepository,
		$hatadyMediaWorksRepository,
		$hatadyMediaSessionsRepository,
		$hatadyMediaCommentsRepository,
		$hatadyMediaReactionsRepository,
		$hataskEmotionAnalysesRepository,
		$feedbackCommentsRepository,
		$feedbackCommentReactionsRepository,
		$feedbackIssueModeratorsRepository,
		$feedbackEmojiRequestsRepository,
		$feedbackEmojiChangeRequestsRepository,
		$feedbackNotificationsRepository,
		$feedbackProjectsRepository,
	],
})
export class RepositoryModule {
}
