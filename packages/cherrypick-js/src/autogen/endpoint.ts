import type {
	EmptyRequest,
	EmptyResponse,
	AdminAbuseReportResolverCreateRequest,
	AdminAbuseReportResolverCreateResponse,
	AdminAbuseReportResolverDeleteRequest,
	AdminAbuseReportResolverListRequest,
	AdminAbuseReportResolverListResponse,
	AdminAbuseReportResolverUpdateRequest,
	AdminAbuseReportNotificationRecipientCreateRequest,
	AdminAbuseReportNotificationRecipientCreateResponse,
	AdminAbuseReportNotificationRecipientDeleteRequest,
	AdminAbuseReportNotificationRecipientListRequest,
	AdminAbuseReportNotificationRecipientListResponse,
	AdminAbuseReportNotificationRecipientShowRequest,
	AdminAbuseReportNotificationRecipientShowResponse,
	AdminAbuseReportNotificationRecipientUpdateRequest,
	AdminAbuseReportNotificationRecipientUpdateResponse,
	AdminAbuseUserReportsRequest,
	AdminAbuseUserReportsResponse,
	AdminAccountsCreateRequest,
	AdminAccountsCreateResponse,
	AdminAccountsDeleteRequest,
	AdminAccountsFindByEmailRequest,
	AdminAccountsFindByEmailResponse,
	AdminAdCreateRequest,
	AdminAdCreateResponse,
	AdminAdDeleteRequest,
	AdminAdListRequest,
	AdminAdListResponse,
	AdminAdUpdateRequest,
	AdminAnnouncementsCreateRequest,
	AdminAnnouncementsCreateResponse,
	AdminAnnouncementsDeleteRequest,
	AdminAnnouncementsListRequest,
	AdminAnnouncementsListResponse,
	AdminAnnouncementsUpdateRequest,
	AdminApproveRegistrationRequest,
	AdminApproveRegistrationResponse,
	AdminAvatarDecorationsCopyRequest,
	AdminAvatarDecorationsCopyResponse,
	AdminAvatarDecorationsCreateRequest,
	AdminAvatarDecorationsCreateResponse,
	AdminAvatarDecorationsDeleteRequest,
	AdminAvatarDecorationsListRequest,
	AdminAvatarDecorationsListResponse,
	AdminAvatarDecorationsListRemoteRequest,
	AdminAvatarDecorationsListRemoteResponse,
	AdminAvatarDecorationsUpdateRequest,
	AdminCaptchaCurrentResponse,
	AdminCaptchaSaveRequest,
	AdminChannelsListRequest,
	AdminChannelsListResponse,
	AdminCleanupLegacyRejectedRegistrationsRequest,
	AdminCleanupLegacyRejectedRegistrationsResponse,
	AdminDeleteAccountRequest,
	AdminDeleteAllFilesOfAUserRequest,
	AdminDriveFilesRequest,
	AdminDriveFilesResponse,
	AdminDriveShowFileRequest,
	AdminDriveShowFileResponse,
	AdminEmojiAddRequest,
	AdminEmojiAddResponse,
	AdminEmojiAddAliasesBulkRequest,
	AdminEmojiCopyRequest,
	AdminEmojiCopyResponse,
	AdminEmojiDeleteRequest,
	AdminEmojiDeleteBulkRequest,
	AdminEmojiImportZipRequest,
	AdminEmojiListRequest,
	AdminEmojiListResponse,
	AdminEmojiListRemoteRequest,
	AdminEmojiListRemoteResponse,
	AdminEmojiRemoveAliasesBulkRequest,
	AdminEmojiSetAliasesBulkRequest,
	AdminEmojiSetCategoryBulkRequest,
	AdminEmojiSetLicenseBulkRequest,
	AdminEmojiStealRequest,
	AdminEmojiStealResponse,
	AdminEmojiUpdateRequest,
	AdminFederationDeleteAllFilesRequest,
	AdminFederationRefreshRemoteInstanceMetadataRequest,
	AdminFederationRemoveAllFollowingRequest,
	AdminFederationUpdateInstanceRequest,
	AdminForwardAbuseUserReportRequest,
	AdminGetIndexStatsResponse,
	AdminGetTableStatsResponse,
	AdminGetUserIpsRequest,
	AdminGetUserIpsResponse,
	AdminHataConsentListRequest,
	AdminHataConsentListResponse,
	AdminHataskRecordsListRequest,
	AdminHataskRecordsListResponse,
	AdminHataskRecordsReviewRequest,
	AdminHataskRecordsReviewResponse,
	AdminHataskRecordsShowRequest,
	AdminHataskRecordsShowResponse,
	AdminHataskSupportRegisterRequest,
	AdminHataskSupportRegisterResponse,
	AdminHataskSupportShowRequest,
	AdminHataskSupportShowResponse,
	AdminHataskSupportSupportersRequest,
	AdminHataskSupportSupportersResponse,
	AdminHataskSupportUnregisterRequest,
	AdminHataskSupportUnregisterResponse,
	AdminHataskSupportUpdateRequest,
	AdminHataskSupportUpdateResponse,
	AdminHataskUpdateDecorationRequest,
	AdminInviteCreateRequest,
	AdminInviteCreateResponse,
	AdminInviteListRequest,
	AdminInviteListResponse,
	AdminMetaResponse,
	AdminPromoCreateRequest,
	AdminQueueClearRequest,
	AdminQueueDeliverDelayedResponse,
	AdminQueueInboxDelayedResponse,
	AdminQueueJobsRequest,
	AdminQueueJobsResponse,
	AdminQueuePauseRequest,
	AdminQueuePromoteJobsRequest,
	AdminQueueQueueStatsRequest,
	AdminQueueQueueStatsResponse,
	AdminQueueQueuesResponse,
	AdminQueueRemoveJobRequest,
	AdminQueueResumeRequest,
	AdminQueueRetryJobRequest,
	AdminQueueShowJobRequest,
	AdminQueueShowJobResponse,
	AdminQueueShowJobLogsRequest,
	AdminQueueShowJobLogsResponse,
	AdminQueueStatsResponse,
	AdminRecordModerationExecuteRequest,
	AdminRecordModerationExecuteResponse,
	AdminRecordModerationHistoryRequest,
	AdminRecordModerationHistoryResponse,
	AdminRecordModerationPreviewRequest,
	AdminRecordModerationPreviewResponse,
	AdminRegistrationApplicationsRequest,
	AdminRegistrationApplicationsResponse,
	AdminRejectRegistrationRequest,
	AdminRejectRegistrationResponse,
	AdminRelaysAddRequest,
	AdminRelaysAddResponse,
	AdminRelaysListResponse,
	AdminRelaysRemoveRequest,
	AdminResendRegistrationRejectionRequest,
	AdminResendRegistrationRejectionResponse,
	AdminResetPasswordRequest,
	AdminResetPasswordResponse,
	AdminResolveAbuseUserReportRequest,
	AdminRolesAssignRequest,
	AdminRolesCreateRequest,
	AdminRolesCreateResponse,
	AdminRolesDeleteRequest,
	AdminRolesListResponse,
	AdminRolesShowRequest,
	AdminRolesShowResponse,
	AdminRolesUnassignRequest,
	AdminRolesUpdateRequest,
	AdminRolesUpdateDefaultPoliciesRequest,
	AdminRolesUsersRequest,
	AdminRolesUsersResponse,
	AdminSendEmailRequest,
	AdminServerInfoResponse,
	AdminShowModerationLogsRequest,
	AdminShowModerationLogsResponse,
	AdminShowUserRequest,
	AdminShowUserResponse,
	AdminShowUsersRequest,
	AdminShowUsersResponse,
	AdminSuspendUserRequest,
	AdminSystemWebhookCreateRequest,
	AdminSystemWebhookCreateResponse,
	AdminSystemWebhookDeleteRequest,
	AdminSystemWebhookListRequest,
	AdminSystemWebhookListResponse,
	AdminSystemWebhookShowRequest,
	AdminSystemWebhookShowResponse,
	AdminSystemWebhookTestRequest,
	AdminSystemWebhookUpdateRequest,
	AdminSystemWebhookUpdateResponse,
	AdminUnsetMfaRequest,
	AdminUnsetUserAvatarRequest,
	AdminUnsetUserBannerRequest,
	AdminUnsuspendUserRequest,
	AdminUpdateAbuseUserReportRequest,
	AdminUpdateMetaRequest,
	AdminUpdateProxyAccountRequest,
	AdminUpdateProxyAccountResponse,
	AdminUpdateUserNoteRequest,
	AdminVoteRegistrationRequest,
	AdminVoteRegistrationResponse,
	AnnouncementsRequest,
	AnnouncementsResponse,
	AnnouncementsShowRequest,
	AnnouncementsShowResponse,
	AntennasCreateRequest,
	AntennasCreateResponse,
	AntennasDeleteRequest,
	AntennasListResponse,
	AntennasNotesRequest,
	AntennasNotesResponse,
	AntennasRemoveNoteRequest,
	AntennasShowRequest,
	AntennasShowResponse,
	AntennasUpdateRequest,
	AntennasUpdateResponse,
	ApGetRequest,
	ApGetResponse,
	ApShowRequest,
	ApShowResponse,
	AppCreateRequest,
	AppCreateResponse,
	AppShowRequest,
	AppShowResponse,
	AuthAcceptRequest,
	AuthSessionGenerateRequest,
	AuthSessionGenerateResponse,
	AuthSessionShowRequest,
	AuthSessionShowResponse,
	AuthSessionUserkeyRequest,
	AuthSessionUserkeyResponse,
	BlockingCreateRequest,
	BlockingCreateResponse,
	BlockingDeleteRequest,
	BlockingDeleteResponse,
	BlockingListRequest,
	BlockingListResponse,
	BubbleGameRankingRequest,
	BubbleGameRankingResponse,
	BubbleGameRegisterRequest,
	ChannelsAddMemberRequest,
	ChannelsCreateRequest,
	ChannelsCreateResponse,
	ChannelsFavoriteRequest,
	ChannelsFeaturedResponse,
	ChannelsFollowRequest,
	ChannelsFollowedRequest,
	ChannelsFollowedResponse,
	ChannelsInvitationsRequest,
	ChannelsInvitationsResponse,
	ChannelsInvitationsAcceptRequest,
	ChannelsInvitationsAcceptResponse,
	ChannelsInvitationsRejectRequest,
	ChannelsJoinRequest,
	ChannelsJoinResponse,
	ChannelsMembersRequest,
	ChannelsMembersResponse,
	ChannelsMyFavoritesResponse,
	ChannelsOwnedRequest,
	ChannelsOwnedResponse,
	ChannelsRemoveMemberRequest,
	ChannelsSearchRequest,
	ChannelsSearchResponse,
	ChannelsShowRequest,
	ChannelsShowResponse,
	ChannelsShowPasswordRequest,
	ChannelsShowPasswordResponse,
	ChannelsTimelineRequest,
	ChannelsTimelineResponse,
	ChannelsUnfavoriteRequest,
	ChannelsUnfollowRequest,
	ChannelsUpdateRequest,
	ChannelsUpdateResponse,
	ChartsActiveUsersRequest,
	ChartsActiveUsersResponse,
	ChartsApRequestRequest,
	ChartsApRequestResponse,
	ChartsDriveRequest,
	ChartsDriveResponse,
	ChartsFederationRequest,
	ChartsFederationResponse,
	ChartsInstanceRequest,
	ChartsInstanceResponse,
	ChartsNotesRequest,
	ChartsNotesResponse,
	ChartsUserDriveRequest,
	ChartsUserDriveResponse,
	ChartsUserFollowingRequest,
	ChartsUserFollowingResponse,
	ChartsUserNotesRequest,
	ChartsUserNotesResponse,
	ChartsUserPvRequest,
	ChartsUserPvResponse,
	ChartsUserReactionsRequest,
	ChartsUserReactionsResponse,
	ChartsUsersRequest,
	ChartsUsersResponse,
	ChatHistoryRequest,
	ChatHistoryResponse,
	ChatMessagesCreateToRoomRequest,
	ChatMessagesCreateToRoomResponse,
	ChatMessagesCreateToUserRequest,
	ChatMessagesCreateToUserResponse,
	ChatMessagesDeleteRequest,
	ChatMessagesReactRequest,
	ChatMessagesRoomTimelineRequest,
	ChatMessagesRoomTimelineResponse,
	ChatMessagesSearchRequest,
	ChatMessagesSearchResponse,
	ChatMessagesShowRequest,
	ChatMessagesShowResponse,
	ChatMessagesUnreactRequest,
	ChatMessagesUserTimelineRequest,
	ChatMessagesUserTimelineResponse,
	ChatRoomsCreateRequest,
	ChatRoomsCreateResponse,
	ChatRoomsDeleteRequest,
	ChatRoomsInvitationsCancelRequest,
	ChatRoomsInvitationsCreateRequest,
	ChatRoomsInvitationsCreateResponse,
	ChatRoomsInvitationsIgnoreRequest,
	ChatRoomsInvitationsInboxRequest,
	ChatRoomsInvitationsInboxResponse,
	ChatRoomsInvitationsOutboxRequest,
	ChatRoomsInvitationsOutboxResponse,
	ChatRoomsInvitationsRejectRequest,
	ChatRoomsJoinRequest,
	ChatRoomsJoiningRequest,
	ChatRoomsJoiningResponse,
	ChatRoomsLeaveRequest,
	ChatRoomsMembersRequest,
	ChatRoomsMembersResponse,
	ChatRoomsMuteRequest,
	ChatRoomsOwnedRequest,
	ChatRoomsOwnedResponse,
	ChatRoomsShowRequest,
	ChatRoomsShowResponse,
	ChatRoomsUpdateRequest,
	ChatRoomsUpdateResponse,
	ClipsAddNoteRequest,
	ClipsCreateRequest,
	ClipsCreateResponse,
	ClipsDeleteRequest,
	ClipsFavoriteRequest,
	ClipsListRequest,
	ClipsListResponse,
	ClipsMyFavoritesResponse,
	ClipsNotesRequest,
	ClipsNotesResponse,
	ClipsRemoveNoteRequest,
	ClipsShowRequest,
	ClipsShowResponse,
	ClipsUnfavoriteRequest,
	ClipsUpdateRequest,
	ClipsUpdateResponse,
	DriveResponse,
	DriveFilesRequest,
	DriveFilesResponse,
	DriveFilesAttachedChatMessagesRequest,
	DriveFilesAttachedChatMessagesResponse,
	DriveFilesAttachedNotesRequest,
	DriveFilesAttachedNotesResponse,
	DriveFilesCheckExistenceRequest,
	DriveFilesCheckExistenceResponse,
	DriveFilesCreateRequest,
	DriveFilesCreateResponse,
	DriveFilesDeleteRequest,
	DriveFilesFindRequest,
	DriveFilesFindResponse,
	DriveFilesFindByHashRequest,
	DriveFilesFindByHashResponse,
	DriveFilesMoveBulkRequest,
	DriveFilesShowRequest,
	DriveFilesShowResponse,
	DriveFilesUpdateRequest,
	DriveFilesUpdateResponse,
	DriveFilesUploadFromUrlRequest,
	DriveFoldersRequest,
	DriveFoldersResponse,
	DriveFoldersCreateRequest,
	DriveFoldersCreateResponse,
	DriveFoldersDeleteRequest,
	DriveFoldersFindRequest,
	DriveFoldersFindResponse,
	DriveFoldersShowRequest,
	DriveFoldersShowResponse,
	DriveFoldersUpdateRequest,
	DriveFoldersUpdateResponse,
	DriveStreamRequest,
	DriveStreamResponse,
	EmailAddressAvailableRequest,
	EmailAddressAvailableResponse,
	EmojiRequest,
	EmojiResponse,
	EmojisResponse,
	EndpointRequest,
	EndpointResponse,
	EndpointsResponse,
	FederationFollowersRequest,
	FederationFollowersResponse,
	FederationFollowingRequest,
	FederationFollowingResponse,
	FederationInstancesRequest,
	FederationInstancesResponse,
	FederationRemoteSoftwareRequest,
	FederationRemoteSoftwareResponse,
	FederationShowInstanceRequest,
	FederationShowInstanceResponse,
	FederationStatsRequest,
	FederationStatsResponse,
	FederationUpdateRemoteUserRequest,
	FederationUsersRequest,
	FederationUsersResponse,
	FetchExternalResourcesRequest,
	FetchExternalResourcesResponse,
	FetchRssRequest,
	FetchRssResponse,
	FlashCreateRequest,
	FlashCreateResponse,
	FlashDeleteRequest,
	FlashFeaturedRequest,
	FlashFeaturedResponse,
	FlashGenTokenRequest,
	FlashGenTokenResponse,
	FlashLikeRequest,
	FlashMyRequest,
	FlashMyResponse,
	FlashMyLikesRequest,
	FlashMyLikesResponse,
	FlashSearchRequest,
	FlashSearchResponse,
	FlashShowRequest,
	FlashShowResponse,
	FlashUnlikeRequest,
	FlashUpdateRequest,
	FollowingCreateRequest,
	FollowingCreateResponse,
	FollowingDeleteRequest,
	FollowingDeleteResponse,
	FollowingInvalidateRequest,
	FollowingInvalidateResponse,
	FollowingRequestsAcceptRequest,
	FollowingRequestsCancelRequest,
	FollowingRequestsCancelResponse,
	FollowingRequestsListRequest,
	FollowingRequestsListResponse,
	FollowingRequestsRejectRequest,
	FollowingRequestsSentRequest,
	FollowingRequestsSentResponse,
	FollowingUpdateRequest,
	FollowingUpdateResponse,
	FollowingUpdateAllRequest,
	GalleryFeaturedRequest,
	GalleryFeaturedResponse,
	GalleryPopularResponse,
	GalleryPostsRequest,
	GalleryPostsResponse,
	GalleryPostsCreateRequest,
	GalleryPostsCreateResponse,
	GalleryPostsDeleteRequest,
	GalleryPostsLikeRequest,
	GalleryPostsShowRequest,
	GalleryPostsShowResponse,
	GalleryPostsUnlikeRequest,
	GalleryPostsUpdateRequest,
	GalleryPostsUpdateResponse,
	GetAvatarDecorationsResponse,
	GetOnlineUsersCountResponse,
	HashtagsListRequest,
	HashtagsListResponse,
	HashtagsSearchRequest,
	HashtagsSearchResponse,
	HashtagsShowRequest,
	HashtagsShowResponse,
	HashtagsTrendResponse,
	HashtagsUsersRequest,
	HashtagsUsersResponse,
	HataConsentGetRequest,
	HataConsentGetResponse,
	HataConsentUpdateRequest,
	HataConsentUpdateResponse,
	HataEarthquakeHistoryRequest,
	HataEarthquakeHistoryResponse,
	HataEarthquakeNotificationSettingsResponse,
	HataEarthquakeNotificationSettingsUpdateRequest,
	HataEarthquakeNotificationSettingsUpdateResponse,
	HataEarthquakeTsunamiRequest,
	HataEarthquakeTsunamiResponse,
	HataEmojiVoteShowRequest,
	HataEmojiVoteShowResponse,
	HataEmojiVoteVoteRequest,
	HataEmojiVoteVoteResponse,
	HataFeedbackAgreeRequest,
	HataFeedbackAgreeResponse,
	HataFeedbackAvailableResponse,
	HataFeedbackCommentsRequest,
	HataFeedbackCommentsResponse,
	HataFeedbackCommentsCreateRequest,
	HataFeedbackCommentsCreateResponse,
	HataFeedbackCommentsDeleteRequest,
	HataFeedbackCommentsMarkRequest,
	HataFeedbackCommentsMarkResponse,
	HataFeedbackCommentsReactRequest,
	HataFeedbackCommentsReactResponse,
	HataFeedbackEmojiCategoriesResponse,
	HataFeedbackEmojiChangeRequestsRequest,
	HataFeedbackEmojiChangeRequestsResponse,
	HataFeedbackEmojiChangeRequestsApproveRequest,
	HataFeedbackEmojiChangeRequestsCreateRequest,
	HataFeedbackEmojiChangeRequestsCreateResponse,
	HataFeedbackEmojiChangeRequestsHoldRequest,
	HataFeedbackEmojiChangeRequestsRejectRequest,
	HataFeedbackEmojiQuotaResponse,
	HataFeedbackEmojiRequestsRequest,
	HataFeedbackEmojiRequestsResponse,
	HataFeedbackEmojiRequestsApproveRequest,
	HataFeedbackEmojiRequestsCancelRequest,
	HataFeedbackEmojiRequestsCreateRequest,
	HataFeedbackEmojiRequestsCreateResponse,
	HataFeedbackEmojiRequestsHoldRequest,
	HataFeedbackEmojiRequestsRejectRequest,
	HataFeedbackIssuesRequest,
	HataFeedbackIssuesResponse,
	HataFeedbackIssuesCloseRequest,
	HataFeedbackIssuesCreateRequest,
	HataFeedbackIssuesCreateResponse,
	HataFeedbackIssuesDeleteRequest,
	HataFeedbackIssuesExportRequest,
	HataFeedbackIssuesExportResponse,
	HataFeedbackIssuesShowRequest,
	HataFeedbackIssuesShowResponse,
	HataFeedbackIssuesStatusCountsRequest,
	HataFeedbackIssuesStatusCountsResponse,
	HataFeedbackIssuesUpdateRequest,
	HataFeedbackIssuesUpdateResponse,
	HataFeedbackModeratorsGrantRequest,
	HataFeedbackModeratorsRevokeRequest,
	HataFeedbackNotificationsRequest,
	HataFeedbackNotificationsResponse,
	HataFeedbackNotificationsReadRequest,
	HataFeedbackProjectsRequest,
	HataFeedbackProjectsResponse,
	HataFeedbackProjectsCreateRequest,
	HataFeedbackProjectsCreateResponse,
	HataFeedbackProjectsDeleteRequest,
	HataFeedbackProjectsUpdateRequest,
	HataFeedbackProjectsUpdateResponse,
	HataFeedbackRemoteEmojisRequest,
	HataFeedbackRemoteEmojisResponse,
	HataHatadyActivitiesRequest,
	HataHatadyActivitiesResponse,
	HataHatadyAdminBooksRequest,
	HataHatadyAdminBooksResponse,
	HataHatadyAdminDeleteBookRequest,
	HataHatadyAdminModerationListRequest,
	HataHatadyAdminModerationListResponse,
	HataHatadyAdminModerationReviewRequest,
	HataHatadyAdminModerationReviewResponse,
	HataHatadyAdminModerationShowRequest,
	HataHatadyAdminModerationShowResponse,
	HataHatadyBookmarksCreateRequest,
	HataHatadyBookmarksCreateResponse,
	HataHatadyBookmarksDeleteRequest,
	HataHatadyBookmarksUpdateRequest,
	HataHatadyBookmarksUpdateResponse,
	HataHatadyBooksRequest,
	HataHatadyBooksResponse,
	HataHatadyBooksCreateRequest,
	HataHatadyBooksCreateResponse,
	HataHatadyBooksDeleteRequest,
	HataHatadyBooksShowRequest,
	HataHatadyBooksShowResponse,
	HataHatadyBooksUpdateRequest,
	HataHatadyBooksUpdateResponse,
	HataHatadyCommentsRequest,
	HataHatadyCommentsResponse,
	HataHatadyCommentsCreateRequest,
	HataHatadyCommentsCreateResponse,
	HataHatadyCommentsDeleteRequest,
	HataHatadyCommentsDeleteResponse,
	HataHatadyCommentsUpdateRequest,
	HataHatadyCommentsUpdateResponse,
	HataHatadyFollowersRemoveRequest,
	HataHatadyFollowingCreateRequest,
	HataHatadyFollowingDeleteRequest,
	HataHatadyFollowingListRequest,
	HataHatadyFollowingListResponse,
	HataHatadyGoalsResponse,
	HataHatadyGoalsCreateRequest,
	HataHatadyGoalsCreateResponse,
	HataHatadyGoalsDeleteRequest,
	HataHatadyGoalsUpdateRequest,
	HataHatadyLogsRequest,
	HataHatadyLogsResponse,
	HataHatadyLogsCreateRequest,
	HataHatadyLogsCreateResponse,
	HataHatadyLogsDeleteRequest,
	HataHatadyLogsShowRequest,
	HataHatadyLogsShowResponse,
	HataHatadyLogsUpdateRequest,
	HataHatadyLogsUpdateResponse,
	HataHatadyMediaCommentsCreateRequest,
	HataHatadyMediaCommentsCreateResponse,
	HataHatadyMediaCommentsDeleteRequest,
	HataHatadyMediaCommentsListRequest,
	HataHatadyMediaCommentsListResponse,
	HataHatadyMediaCommentsUpdateRequest,
	HataHatadyMediaCommentsUpdateResponse,
	HataHatadyMediaReactionsCreateRequest,
	HataHatadyMediaReactionsDeleteRequest,
	HataHatadyMediaReactionsListRequest,
	HataHatadyMediaReactionsListResponse,
	HataHatadyMediaSessionsCreateRequest,
	HataHatadyMediaSessionsCreateResponse,
	HataHatadyMediaSessionsDeleteRequest,
	HataHatadyMediaSessionsListRequest,
	HataHatadyMediaSessionsListResponse,
	HataHatadyMediaSessionsShowRequest,
	HataHatadyMediaSessionsShowResponse,
	HataHatadyMediaSessionsUpdateRequest,
	HataHatadyMediaSessionsUpdateResponse,
	HataHatadyMediaWorksCreateRequest,
	HataHatadyMediaWorksCreateResponse,
	HataHatadyMediaWorksDeleteRequest,
	HataHatadyMediaWorksListRequest,
	HataHatadyMediaWorksListResponse,
	HataHatadyMediaWorksShowRequest,
	HataHatadyMediaWorksShowResponse,
	HataHatadyMediaWorksUpdateRequest,
	HataHatadyMediaWorksUpdateResponse,
	HataHatadyMemosCreateRequest,
	HataHatadyMemosCreateResponse,
	HataHatadyMemosDeleteRequest,
	HataHatadyMemosUpdateRequest,
	HataHatadyMemosUpdateResponse,
	HataHatadyNotificationsRequest,
	HataHatadyNotificationsResponse,
	HataHatadyNotificationsDeleteRequest,
	HataHatadyNotificationsMarkAsReadRequest,
	HataHatadyNotificationsRestoreRequest,
	HataHatadyNotificationsUnreadCountResponse,
	HataHatadyProfileUpdateRequest,
	HataHatadyReactionsCreateRequest,
	HataHatadyReactionsDeleteRequest,
	HataHatadyReactionsListRequest,
	HataHatadyReactionsListResponse,
	HataHatadySearchRequest,
	HataHatadySearchResponse,
	HataHatadyStatsRequest,
	HataHatadyStatsResponse,
	HataHatadyStatsDetailRequest,
	HataHatadyStatsDetailResponse,
	HataHatadyStreaksRequest,
	HataHatadyStreaksResponse,
	HataHatadySubjectsResponse,
	HataHatadySubjectsDeleteRequest,
	HataHatadySubjectsDeleteResponse,
	HataHatadySubjectsSaveRequest,
	HataHatadySubjectsSaveResponse,
	HataHatadyTimelineRequest,
	HataHatadyTimelineResponse,
	HataHatadyUsersShowRequest,
	HataHatadyUsersShowResponse,
	HataHatagoesHomeDailyRequest,
	HataHatagoesHomeDailyResponse,
	HataHatagoesHomeIssuesResponse,
	HataHatagoesNotificationsUnreadCountResponse,
	HataHatagoesSearchRequest,
	HataHatagoesSearchResponse,
	HataHatagoesShowRequest,
	HataHatagoesShowResponse,
	HataHataskEmotionAnalysisCreateRequest,
	HataHataskEmotionAnalysisCreateResponse,
	HataHataskEmotionAnalysisDeleteRequest,
	HataHataskEmotionAnalysisDeleteResponse,
	HataHataskEmotionAnalysisListRequest,
	HataHataskEmotionAnalysisListResponse,
	HataHataskEmotionAnalysisShowRequest,
	HataHataskEmotionAnalysisShowResponse,
	HataLoginRankingResponse,
	HataMascotGetResponse,
	HataMascotUpdateRequest,
	HataMascotUpdateResponse,
	HataUiSAnnouncementClaimResponse,
	HataigoActionRequest,
	HataigoActionResponse,
	HataigoCancelGameRequest,
	HataigoCancelGameResponse,
	HataigoChatCapabilityResponse,
	HataigoChatDeleteRequest,
	HataigoChatMessagesRequest,
	HataigoChatMessagesResponse,
	HataigoChatPostRequest,
	HataigoChatPostResponse,
	HataigoClaimTimeoutRequest,
	HataigoClaimTimeoutResponse,
	HataigoGamesRequest,
	HataigoGamesResponse,
	HataigoInvitationsResponse,
	HataigoMatchRequest,
	HataigoMatchResponse,
	HataigoMyStatsResponse,
	HataigoReadyRequest,
	HataigoReadyResponse,
	HataigoRespondInviteRequest,
	HataigoRespondInviteResponse,
	HataigoSettingsRequest,
	HataigoSettingsResponse,
	HataigoShowGameRequest,
	HataigoShowGameResponse,
	HataigoSurrenderRequest,
	HataigoSurrenderResponse,
	HataigoVerifyRequest,
	HataigoVerifyResponse,
	HataskEventsCloseRequest,
	HataskEventsCreateRequest,
	HataskEventsCreateResponse,
	HataskEventsDeleteRequest,
	HataskEventsListRequest,
	HataskEventsListResponse,
	HataskEventsOwnedRequest,
	HataskEventsOwnedResponse,
	HataskEventsRsvpRequest,
	HataskEventsUpdateRequest,
	HataskEventsUpdateResponse,
	HataskFlowersDropsPourRequest,
	HataskFlowersDropsPourResponse,
	HataskFlowersDropsShowRequest,
	HataskFlowersDropsShowResponse,
	HataskFlowersFestivalShowRequest,
	HataskFlowersFestivalShowResponse,
	HataskFlowersHarvestRequest,
	HataskFlowersHarvestResponse,
	HataskFlowersListRequest,
	HataskFlowersListResponse,
	HataskFlowersRenameRequest,
	HataskFlowersRenameResponse,
	HataskFlowersStateRequest,
	HataskFlowersStateResponse,
	HataskFlowersSyncRequest,
	HataskFlowersSyncResponse,
	HataskFlowersVisibilityUpdateRequest,
	HataskFlowersVisibilityUpdateResponse,
	HataskFlowersZukanClaimSeedRequest,
	HataskFlowersZukanClaimSeedResponse,
	HataskFlowersZukanShowRequest,
	HataskFlowersZukanShowResponse,
	HataskPlannerCommitRequest,
	HataskPlannerCommitResponse,
	HataskPlannerCommitBatchRequest,
	HataskPlannerCommitBatchResponse,
	HataskPlannerCreateShadowRequest,
	HataskPlannerCreateShadowResponse,
	HataskPlannerGetResponse,
	HataskRankingListRequest,
	HataskRankingListResponse,
	HataskRankingParticipationRequest,
	HataskRankingParticipationResponse,
	HataskRecipesCookedCreateRequest,
	HataskRecipesCookedCreateResponse,
	HataskRecipesCookedDeleteRequest,
	HataskRecipesCookedListRequest,
	HataskRecipesCookedListResponse,
	HataskRecipesCreateRequest,
	HataskRecipesCreateResponse,
	HataskRecipesDeleteRequest,
	HataskRecipesListRequest,
	HataskRecipesListResponse,
	HataskRecipesShowRequest,
	HataskRecipesShowResponse,
	HataskRecipesUpdateRequest,
	HataskRecipesUpdateResponse,
	HataskRecordsExportResponse,
	HataskRecordsImportRequest,
	HataskRecordsImportResponse,
	HataskSupportShowResponse,
	HataskSupportSupportersRequest,
	HataskSupportSupportersResponse,
	IResponse,
	I2faDoneRequest,
	I2faDoneResponse,
	I2faKeyDoneRequest,
	I2faKeyDoneResponse,
	I2faPasswordLessRequest,
	I2faRegisterRequest,
	I2faRegisterResponse,
	I2faRegisterKeyRequest,
	I2faRegisterKeyResponse,
	I2faRemoveKeyRequest,
	I2faUnregisterRequest,
	I2faUpdateKeyRequest,
	IAppsRequest,
	IAppsResponse,
	IAuthorizedAppsRequest,
	IAuthorizedAppsResponse,
	IAutoDeleteSettingsResponse,
	IChangePasswordRequest,
	IClaimAchievementRequest,
	IDeleteAccountRequest,
	IExportFollowingRequest,
	IFavoritesRequest,
	IFavoritesResponse,
	IFollowersServersResponse,
	IGalleryLikesRequest,
	IGalleryLikesResponse,
	IGalleryPostsRequest,
	IGalleryPostsResponse,
	IImportAntennasRequest,
	IImportBlockingRequest,
	IImportFollowingRequest,
	IImportMutingRequest,
	IImportUserListsRequest,
	IMoveRequest,
	IMoveResponse,
	INotificationsRequest,
	INotificationsResponse,
	INotificationsGroupedRequest,
	INotificationsGroupedResponse,
	IPageLikesRequest,
	IPageLikesResponse,
	IPagesRequest,
	IPagesResponse,
	IPinRequest,
	IPinResponse,
	IReadAnnouncementRequest,
	IRegenerateTokenRequest,
	IRegistryGetRequest,
	IRegistryGetResponse,
	IRegistryGetAllRequest,
	IRegistryGetAllResponse,
	IRegistryGetDetailRequest,
	IRegistryGetDetailResponse,
	IRegistryKeysRequest,
	IRegistryKeysResponse,
	IRegistryKeysWithTypeRequest,
	IRegistryKeysWithTypeResponse,
	IRegistryRemoveRequest,
	IRegistryScopesWithDomainResponse,
	IRegistrySetRequest,
	IRevokeTokenRequest,
	ISigninHistoryRequest,
	ISigninHistoryResponse,
	ITruncateAccountRequest,
	IUnpinRequest,
	IUnpinResponse,
	IUpdateRequest,
	IUpdateResponse,
	IUpdateAutoDeleteSettingsRequest,
	IUpdateEmailRequest,
	IUpdateEmailResponse,
	IUserGroupInvitesRequest,
	IUserGroupInvitesResponse,
	IWebhooksCreateRequest,
	IWebhooksCreateResponse,
	IWebhooksDeleteRequest,
	IWebhooksListResponse,
	IWebhooksShowRequest,
	IWebhooksShowResponse,
	IWebhooksTestRequest,
	IWebhooksUpdateRequest,
	InviteCreateResponse,
	InviteDeleteRequest,
	InviteLimitResponse,
	InviteListRequest,
	InviteListResponse,
	MetaRequest,
	MetaResponse,
	MiauthGenTokenRequest,
	MiauthGenTokenResponse,
	MuteCreateRequest,
	MuteDeleteRequest,
	MuteListRequest,
	MuteListResponse,
	MyAppsRequest,
	MyAppsResponse,
	NotesRequest,
	NotesResponse,
	NotesBubbleTimelineRequest,
	NotesBubbleTimelineResponse,
	NotesChildrenRequest,
	NotesChildrenResponse,
	NotesClipsRequest,
	NotesClipsResponse,
	NotesConversationRequest,
	NotesConversationResponse,
	NotesCreateRequest,
	NotesCreateResponse,
	NotesDeleteRequest,
	NotesDraftsCountResponse,
	NotesDraftsCreateRequest,
	NotesDraftsCreateResponse,
	NotesDraftsDeleteRequest,
	NotesDraftsListRequest,
	NotesDraftsListResponse,
	NotesDraftsUpdateRequest,
	NotesDraftsUpdateResponse,
	NotesEventsSearchRequest,
	NotesEventsSearchResponse,
	NotesFavoritesCreateRequest,
	NotesFavoritesDeleteRequest,
	NotesFavoritesFoldersCreateRequest,
	NotesFavoritesFoldersCreateResponse,
	NotesFavoritesFoldersDeleteRequest,
	NotesFavoritesFoldersDeleteResponse,
	NotesFavoritesFoldersListResponse,
	NotesFavoritesFoldersUpdateRequest,
	NotesFavoritesFoldersUpdateResponse,
	NotesFavoritesMoveRequest,
	NotesFeaturedRequest,
	NotesFeaturedResponse,
	NotesGlobalTimelineRequest,
	NotesGlobalTimelineResponse,
	NotesHistoryRequest,
	NotesHistoryResponse,
	NotesHybridTimelineRequest,
	NotesHybridTimelineResponse,
	NotesLocalTimelineRequest,
	NotesLocalTimelineResponse,
	NotesMentionsRequest,
	NotesMentionsResponse,
	NotesPollsRecommendationRequest,
	NotesPollsRecommendationResponse,
	NotesPollsVoteRequest,
	NotesReactionsRequest,
	NotesReactionsResponse,
	NotesReactionsCreateRequest,
	NotesReactionsCreateResponse,
	NotesReactionsDeleteRequest,
	NotesRenotesRequest,
	NotesRenotesResponse,
	NotesRepliesRequest,
	NotesRepliesResponse,
	NotesSearchRequest,
	NotesSearchResponse,
	NotesSearchByTagRequest,
	NotesSearchByTagResponse,
	NotesShowRequest,
	NotesShowResponse,
	NotesShowPartialBulkRequest,
	NotesShowPartialBulkResponse,
	NotesStateRequest,
	NotesStateResponse,
	NotesThreadMutingCreateRequest,
	NotesThreadMutingDeleteRequest,
	NotesTimelineRequest,
	NotesTimelineResponse,
	NotesTrendingRequest,
	NotesTrendingResponse,
	NotesTrendingCheckNewRequest,
	NotesTrendingCheckNewResponse,
	NotesUnrenoteRequest,
	NotesUpdateRequest,
	NotesUserListTimelineRequest,
	NotesUserListTimelineResponse,
	NotificationsCreateRequest,
	NotificationsMarkAsReadRequest,
	NotificationsShowRequest,
	NotificationsShowResponse,
	NotificationsUnreadCountResponse,
	PagePushRequest,
	PagesCreateRequest,
	PagesCreateResponse,
	PagesDeleteRequest,
	PagesFeaturedResponse,
	PagesLikeRequest,
	PagesShowRequest,
	PagesShowResponse,
	PagesUnlikeRequest,
	PagesUpdateRequest,
	PingResponse,
	PinnedUsersResponse,
	PromoReadRequest,
	RegistrationApplyRequest,
	RegistrationApplyResponse,
	RenoteMuteCreateRequest,
	RenoteMuteDeleteRequest,
	RenoteMuteListRequest,
	RenoteMuteListResponse,
	RequestResetPasswordRequest,
	ResetPasswordRequest,
	RetentionResponse,
	ReversiCancelMatchRequest,
	ReversiGamesRequest,
	ReversiGamesResponse,
	ReversiInvitationsResponse,
	ReversiMatchRequest,
	ReversiMatchResponse,
	ReversiShowGameRequest,
	ReversiShowGameResponse,
	ReversiSurrenderRequest,
	ReversiVerifyRequest,
	ReversiVerifyResponse,
	RolesListResponse,
	RolesNotesRequest,
	RolesNotesResponse,
	RolesShowRequest,
	RolesShowResponse,
	RolesUsersRequest,
	RolesUsersResponse,
	ServerInfoResponse,
	StatsResponse,
	SwRegisterRequest,
	SwRegisterResponse,
	SwShowRegistrationRequest,
	SwShowRegistrationResponse,
	SwUnregisterRequest,
	SwUpdateRegistrationRequest,
	SwUpdateRegistrationResponse,
	TestRequest,
	TestResponse,
	UsernameAvailableRequest,
	UsernameAvailableResponse,
	UsersRequest,
	UsersResponse,
	UsersAchievementsRequest,
	UsersAchievementsResponse,
	UsersClipsRequest,
	UsersClipsResponse,
	UsersFeaturedNotesRequest,
	UsersFeaturedNotesResponse,
	UsersFlashsRequest,
	UsersFlashsResponse,
	UsersFollowersRequest,
	UsersFollowersResponse,
	UsersFollowingRequest,
	UsersFollowingResponse,
	UsersGalleryPostsRequest,
	UsersGalleryPostsResponse,
	UsersGetFrequentlyRepliedUsersRequest,
	UsersGetFrequentlyRepliedUsersResponse,
	UsersGroupsCreateRequest,
	UsersGroupsCreateResponse,
	UsersGroupsDeleteRequest,
	UsersGroupsInvitationsAcceptRequest,
	UsersGroupsInvitationsRejectRequest,
	UsersGroupsInviteRequest,
	UsersGroupsJoinedResponse,
	UsersGroupsLeaveRequest,
	UsersGroupsOwnedResponse,
	UsersGroupsPullRequest,
	UsersGroupsShowRequest,
	UsersGroupsShowResponse,
	UsersGroupsTransferRequest,
	UsersGroupsTransferResponse,
	UsersGroupsUpdateRequest,
	UsersGroupsUpdateResponse,
	UsersListsCreateRequest,
	UsersListsCreateResponse,
	UsersListsCreateFromPublicRequest,
	UsersListsCreateFromPublicResponse,
	UsersListsDeleteRequest,
	UsersListsFavoriteRequest,
	UsersListsGetMembershipsRequest,
	UsersListsGetMembershipsResponse,
	UsersListsListRequest,
	UsersListsListResponse,
	UsersListsPullRequest,
	UsersListsPushRequest,
	UsersListsShowRequest,
	UsersListsShowResponse,
	UsersListsUnfavoriteRequest,
	UsersListsUpdateRequest,
	UsersListsUpdateResponse,
	UsersListsUpdateMembershipRequest,
	UsersNotesRequest,
	UsersNotesResponse,
	UsersPagesRequest,
	UsersPagesResponse,
	UsersReactionsRequest,
	UsersReactionsResponse,
	UsersRecommendationRequest,
	UsersRecommendationResponse,
	UsersRelationRequest,
	UsersRelationResponse,
	UsersReportAbuseRequest,
	UsersSearchRequest,
	UsersSearchResponse,
	UsersSearchByUsernameAndHostRequest,
	UsersSearchByUsernameAndHostResponse,
	UsersShowRequest,
	UsersShowResponse,
	UsersStatsRequest,
	UsersStatsResponse,
	UsersUpdateMemoRequest,
	V2AdminEmojiListRequest,
	V2AdminEmojiListResponse,
	VerifyEmailRequest,
} from './entities.js';

export type Endpoints = {
	'admin/abuse-report-resolver/create': { req: AdminAbuseReportResolverCreateRequest; res: AdminAbuseReportResolverCreateResponse };
	'admin/abuse-report-resolver/delete': { req: AdminAbuseReportResolverDeleteRequest; res: EmptyResponse };
	'admin/abuse-report-resolver/list': { req: AdminAbuseReportResolverListRequest; res: AdminAbuseReportResolverListResponse };
	'admin/abuse-report-resolver/update': { req: AdminAbuseReportResolverUpdateRequest; res: EmptyResponse };
	'admin/abuse-report/notification-recipient/create': { req: AdminAbuseReportNotificationRecipientCreateRequest; res: AdminAbuseReportNotificationRecipientCreateResponse };
	'admin/abuse-report/notification-recipient/delete': { req: AdminAbuseReportNotificationRecipientDeleteRequest; res: EmptyResponse };
	'admin/abuse-report/notification-recipient/list': { req: AdminAbuseReportNotificationRecipientListRequest; res: AdminAbuseReportNotificationRecipientListResponse };
	'admin/abuse-report/notification-recipient/show': { req: AdminAbuseReportNotificationRecipientShowRequest; res: AdminAbuseReportNotificationRecipientShowResponse };
	'admin/abuse-report/notification-recipient/update': { req: AdminAbuseReportNotificationRecipientUpdateRequest; res: AdminAbuseReportNotificationRecipientUpdateResponse };
	'admin/abuse-user-reports': { req: AdminAbuseUserReportsRequest; res: AdminAbuseUserReportsResponse };
	'admin/accounts/create': { req: AdminAccountsCreateRequest; res: AdminAccountsCreateResponse };
	'admin/accounts/delete': { req: AdminAccountsDeleteRequest; res: EmptyResponse };
	'admin/accounts/find-by-email': { req: AdminAccountsFindByEmailRequest; res: AdminAccountsFindByEmailResponse };
	'admin/ad/create': { req: AdminAdCreateRequest; res: AdminAdCreateResponse };
	'admin/ad/delete': { req: AdminAdDeleteRequest; res: EmptyResponse };
	'admin/ad/list': { req: AdminAdListRequest; res: AdminAdListResponse };
	'admin/ad/update': { req: AdminAdUpdateRequest; res: EmptyResponse };
	'admin/announcements/create': { req: AdminAnnouncementsCreateRequest; res: AdminAnnouncementsCreateResponse };
	'admin/announcements/delete': { req: AdminAnnouncementsDeleteRequest; res: EmptyResponse };
	'admin/announcements/list': { req: AdminAnnouncementsListRequest; res: AdminAnnouncementsListResponse };
	'admin/announcements/update': { req: AdminAnnouncementsUpdateRequest; res: EmptyResponse };
	'admin/approve-registration': { req: AdminApproveRegistrationRequest; res: AdminApproveRegistrationResponse };
	'admin/avatar-decorations/copy': { req: AdminAvatarDecorationsCopyRequest; res: AdminAvatarDecorationsCopyResponse };
	'admin/avatar-decorations/create': { req: AdminAvatarDecorationsCreateRequest; res: AdminAvatarDecorationsCreateResponse };
	'admin/avatar-decorations/delete': { req: AdminAvatarDecorationsDeleteRequest; res: EmptyResponse };
	'admin/avatar-decorations/list': { req: AdminAvatarDecorationsListRequest; res: AdminAvatarDecorationsListResponse };
	'admin/avatar-decorations/list-remote': { req: AdminAvatarDecorationsListRemoteRequest; res: AdminAvatarDecorationsListRemoteResponse };
	'admin/avatar-decorations/update': { req: AdminAvatarDecorationsUpdateRequest; res: EmptyResponse };
	'admin/captcha/current': { req: EmptyRequest; res: AdminCaptchaCurrentResponse };
	'admin/captcha/save': { req: AdminCaptchaSaveRequest; res: EmptyResponse };
	'admin/channels/list': { req: AdminChannelsListRequest; res: AdminChannelsListResponse };
	'admin/cleanup-legacy-rejected-registrations': { req: AdminCleanupLegacyRejectedRegistrationsRequest; res: AdminCleanupLegacyRejectedRegistrationsResponse };
	'admin/delete-account': { req: AdminDeleteAccountRequest; res: EmptyResponse };
	'admin/delete-all-files-of-a-user': { req: AdminDeleteAllFilesOfAUserRequest; res: EmptyResponse };
	'admin/drive/clean-remote-files': { req: EmptyRequest; res: EmptyResponse };
	'admin/drive/cleanup': { req: EmptyRequest; res: EmptyResponse };
	'admin/drive/files': { req: AdminDriveFilesRequest; res: AdminDriveFilesResponse };
	'admin/drive/show-file': { req: AdminDriveShowFileRequest; res: AdminDriveShowFileResponse };
	'admin/emoji/add': { req: AdminEmojiAddRequest; res: AdminEmojiAddResponse };
	'admin/emoji/add-aliases-bulk': { req: AdminEmojiAddAliasesBulkRequest; res: EmptyResponse };
	'admin/emoji/copy': { req: AdminEmojiCopyRequest; res: AdminEmojiCopyResponse };
	'admin/emoji/delete': { req: AdminEmojiDeleteRequest; res: EmptyResponse };
	'admin/emoji/delete-bulk': { req: AdminEmojiDeleteBulkRequest; res: EmptyResponse };
	'admin/emoji/import-zip': { req: AdminEmojiImportZipRequest; res: EmptyResponse };
	'admin/emoji/list': { req: AdminEmojiListRequest; res: AdminEmojiListResponse };
	'admin/emoji/list-remote': { req: AdminEmojiListRemoteRequest; res: AdminEmojiListRemoteResponse };
	'admin/emoji/remove-aliases-bulk': { req: AdminEmojiRemoveAliasesBulkRequest; res: EmptyResponse };
	'admin/emoji/set-aliases-bulk': { req: AdminEmojiSetAliasesBulkRequest; res: EmptyResponse };
	'admin/emoji/set-category-bulk': { req: AdminEmojiSetCategoryBulkRequest; res: EmptyResponse };
	'admin/emoji/set-license-bulk': { req: AdminEmojiSetLicenseBulkRequest; res: EmptyResponse };
	'admin/emoji/steal': { req: AdminEmojiStealRequest; res: AdminEmojiStealResponse };
	'admin/emoji/update': { req: AdminEmojiUpdateRequest; res: EmptyResponse };
	'admin/federation/delete-all-files': { req: AdminFederationDeleteAllFilesRequest; res: EmptyResponse };
	'admin/federation/refresh-remote-instance-metadata': { req: AdminFederationRefreshRemoteInstanceMetadataRequest; res: EmptyResponse };
	'admin/federation/remove-all-following': { req: AdminFederationRemoveAllFollowingRequest; res: EmptyResponse };
	'admin/federation/update-instance': { req: AdminFederationUpdateInstanceRequest; res: EmptyResponse };
	'admin/forward-abuse-user-report': { req: AdminForwardAbuseUserReportRequest; res: EmptyResponse };
	'admin/get-index-stats': { req: EmptyRequest; res: AdminGetIndexStatsResponse };
	'admin/get-table-stats': { req: EmptyRequest; res: AdminGetTableStatsResponse };
	'admin/get-user-ips': { req: AdminGetUserIpsRequest; res: AdminGetUserIpsResponse };
	'admin/hata/consent-list': { req: AdminHataConsentListRequest; res: AdminHataConsentListResponse };
	'admin/hatask/records/list': { req: AdminHataskRecordsListRequest; res: AdminHataskRecordsListResponse };
	'admin/hatask/records/review': { req: AdminHataskRecordsReviewRequest; res: AdminHataskRecordsReviewResponse };
	'admin/hatask/records/show': { req: AdminHataskRecordsShowRequest; res: AdminHataskRecordsShowResponse };
	'admin/hatask/support/register': { req: AdminHataskSupportRegisterRequest; res: AdminHataskSupportRegisterResponse };
	'admin/hatask/support/show': { req: AdminHataskSupportShowRequest; res: AdminHataskSupportShowResponse };
	'admin/hatask/support/supporters': { req: AdminHataskSupportSupportersRequest; res: AdminHataskSupportSupportersResponse };
	'admin/hatask/support/unregister': { req: AdminHataskSupportUnregisterRequest; res: AdminHataskSupportUnregisterResponse };
	'admin/hatask/support/update': { req: AdminHataskSupportUpdateRequest; res: AdminHataskSupportUpdateResponse };
	'admin/hatask/update-decoration': { req: AdminHataskUpdateDecorationRequest; res: EmptyResponse };
	'admin/invite/create': { req: AdminInviteCreateRequest; res: AdminInviteCreateResponse };
	'admin/invite/list': { req: AdminInviteListRequest; res: AdminInviteListResponse };
	'admin/invite/revoke': { req: EmptyRequest; res: EmptyResponse };
	'admin/meta': { req: EmptyRequest; res: AdminMetaResponse };
	'admin/promo/create': { req: AdminPromoCreateRequest; res: EmptyResponse };
	'admin/queue/clear': { req: AdminQueueClearRequest; res: EmptyResponse };
	'admin/queue/deliver-delayed': { req: EmptyRequest; res: AdminQueueDeliverDelayedResponse };
	'admin/queue/inbox-delayed': { req: EmptyRequest; res: AdminQueueInboxDelayedResponse };
	'admin/queue/jobs': { req: AdminQueueJobsRequest; res: AdminQueueJobsResponse };
	'admin/queue/pause': { req: AdminQueuePauseRequest; res: EmptyResponse };
	'admin/queue/promote-jobs': { req: AdminQueuePromoteJobsRequest; res: EmptyResponse };
	'admin/queue/queue-stats': { req: AdminQueueQueueStatsRequest; res: AdminQueueQueueStatsResponse };
	'admin/queue/queues': { req: EmptyRequest; res: AdminQueueQueuesResponse };
	'admin/queue/remove-job': { req: AdminQueueRemoveJobRequest; res: EmptyResponse };
	'admin/queue/resume': { req: AdminQueueResumeRequest; res: EmptyResponse };
	'admin/queue/retry-job': { req: AdminQueueRetryJobRequest; res: EmptyResponse };
	'admin/queue/show-job': { req: AdminQueueShowJobRequest; res: AdminQueueShowJobResponse };
	'admin/queue/show-job-logs': { req: AdminQueueShowJobLogsRequest; res: AdminQueueShowJobLogsResponse };
	'admin/queue/stats': { req: EmptyRequest; res: AdminQueueStatsResponse };
	'admin/record-moderation/execute': { req: AdminRecordModerationExecuteRequest; res: AdminRecordModerationExecuteResponse };
	'admin/record-moderation/history': { req: AdminRecordModerationHistoryRequest; res: AdminRecordModerationHistoryResponse };
	'admin/record-moderation/preview': { req: AdminRecordModerationPreviewRequest; res: AdminRecordModerationPreviewResponse };
	'admin/registration-applications': { req: AdminRegistrationApplicationsRequest; res: AdminRegistrationApplicationsResponse };
	'admin/reject-registration': { req: AdminRejectRegistrationRequest; res: AdminRejectRegistrationResponse };
	'admin/relays/add': { req: AdminRelaysAddRequest; res: AdminRelaysAddResponse };
	'admin/relays/list': { req: EmptyRequest; res: AdminRelaysListResponse };
	'admin/relays/remove': { req: AdminRelaysRemoveRequest; res: EmptyResponse };
	'admin/resend-registration-rejection': { req: AdminResendRegistrationRejectionRequest; res: AdminResendRegistrationRejectionResponse };
	'admin/reset-password': { req: AdminResetPasswordRequest; res: AdminResetPasswordResponse };
	'admin/resolve-abuse-user-report': { req: AdminResolveAbuseUserReportRequest; res: EmptyResponse };
	'admin/roles/assign': { req: AdminRolesAssignRequest; res: EmptyResponse };
	'admin/roles/create': { req: AdminRolesCreateRequest; res: AdminRolesCreateResponse };
	'admin/roles/delete': { req: AdminRolesDeleteRequest; res: EmptyResponse };
	'admin/roles/list': { req: EmptyRequest; res: AdminRolesListResponse };
	'admin/roles/show': { req: AdminRolesShowRequest; res: AdminRolesShowResponse };
	'admin/roles/unassign': { req: AdminRolesUnassignRequest; res: EmptyResponse };
	'admin/roles/update': { req: AdminRolesUpdateRequest; res: EmptyResponse };
	'admin/roles/update-default-policies': { req: AdminRolesUpdateDefaultPoliciesRequest; res: EmptyResponse };
	'admin/roles/users': { req: AdminRolesUsersRequest; res: AdminRolesUsersResponse };
	'admin/send-email': { req: AdminSendEmailRequest; res: EmptyResponse };
	'admin/server-info': { req: EmptyRequest; res: AdminServerInfoResponse };
	'admin/show-moderation-logs': { req: AdminShowModerationLogsRequest; res: AdminShowModerationLogsResponse };
	'admin/show-user': { req: AdminShowUserRequest; res: AdminShowUserResponse };
	'admin/show-users': { req: AdminShowUsersRequest; res: AdminShowUsersResponse };
	'admin/suspend-user': { req: AdminSuspendUserRequest; res: EmptyResponse };
	'admin/system-webhook/create': { req: AdminSystemWebhookCreateRequest; res: AdminSystemWebhookCreateResponse };
	'admin/system-webhook/delete': { req: AdminSystemWebhookDeleteRequest; res: EmptyResponse };
	'admin/system-webhook/list': { req: AdminSystemWebhookListRequest; res: AdminSystemWebhookListResponse };
	'admin/system-webhook/show': { req: AdminSystemWebhookShowRequest; res: AdminSystemWebhookShowResponse };
	'admin/system-webhook/test': { req: AdminSystemWebhookTestRequest; res: EmptyResponse };
	'admin/system-webhook/update': { req: AdminSystemWebhookUpdateRequest; res: AdminSystemWebhookUpdateResponse };
	'admin/unset-mfa': { req: AdminUnsetMfaRequest; res: EmptyResponse };
	'admin/unset-user-avatar': { req: AdminUnsetUserAvatarRequest; res: EmptyResponse };
	'admin/unset-user-banner': { req: AdminUnsetUserBannerRequest; res: EmptyResponse };
	'admin/unsuspend-user': { req: AdminUnsuspendUserRequest; res: EmptyResponse };
	'admin/update-abuse-user-report': { req: AdminUpdateAbuseUserReportRequest; res: EmptyResponse };
	'admin/update-meta': { req: AdminUpdateMetaRequest; res: EmptyResponse };
	'admin/update-proxy-account': { req: AdminUpdateProxyAccountRequest; res: AdminUpdateProxyAccountResponse };
	'admin/update-user-note': { req: AdminUpdateUserNoteRequest; res: EmptyResponse };
	'admin/vote-registration': { req: AdminVoteRegistrationRequest; res: AdminVoteRegistrationResponse };
	'announcements': { req: AnnouncementsRequest; res: AnnouncementsResponse };
	'announcements/show': { req: AnnouncementsShowRequest; res: AnnouncementsShowResponse };
	'antennas/create': { req: AntennasCreateRequest; res: AntennasCreateResponse };
	'antennas/delete': { req: AntennasDeleteRequest; res: EmptyResponse };
	'antennas/list': { req: EmptyRequest; res: AntennasListResponse };
	'antennas/notes': { req: AntennasNotesRequest; res: AntennasNotesResponse };
	'antennas/remove-note': { req: AntennasRemoveNoteRequest; res: EmptyResponse };
	'antennas/show': { req: AntennasShowRequest; res: AntennasShowResponse };
	'antennas/update': { req: AntennasUpdateRequest; res: AntennasUpdateResponse };
	'ap/get': { req: ApGetRequest; res: ApGetResponse };
	'ap/show': { req: ApShowRequest; res: ApShowResponse };
	'app/create': { req: AppCreateRequest; res: AppCreateResponse };
	'app/show': { req: AppShowRequest; res: AppShowResponse };
	'auth/accept': { req: AuthAcceptRequest; res: EmptyResponse };
	'auth/session/generate': { req: AuthSessionGenerateRequest; res: AuthSessionGenerateResponse };
	'auth/session/show': { req: AuthSessionShowRequest; res: AuthSessionShowResponse };
	'auth/session/userkey': { req: AuthSessionUserkeyRequest; res: AuthSessionUserkeyResponse };
	'blocking/create': { req: BlockingCreateRequest; res: BlockingCreateResponse };
	'blocking/delete': { req: BlockingDeleteRequest; res: BlockingDeleteResponse };
	'blocking/list': { req: BlockingListRequest; res: BlockingListResponse };
	'bubble-game/ranking': { req: BubbleGameRankingRequest; res: BubbleGameRankingResponse };
	'bubble-game/register': { req: BubbleGameRegisterRequest; res: EmptyResponse };
	'channels/add-member': { req: ChannelsAddMemberRequest; res: EmptyResponse };
	'channels/create': { req: ChannelsCreateRequest; res: ChannelsCreateResponse };
	'channels/favorite': { req: ChannelsFavoriteRequest; res: EmptyResponse };
	'channels/featured': { req: EmptyRequest; res: ChannelsFeaturedResponse };
	'channels/follow': { req: ChannelsFollowRequest; res: EmptyResponse };
	'channels/followed': { req: ChannelsFollowedRequest; res: ChannelsFollowedResponse };
	'channels/invitations': { req: ChannelsInvitationsRequest; res: ChannelsInvitationsResponse };
	'channels/invitations/accept': { req: ChannelsInvitationsAcceptRequest; res: ChannelsInvitationsAcceptResponse };
	'channels/invitations/reject': { req: ChannelsInvitationsRejectRequest; res: EmptyResponse };
	'channels/join': { req: ChannelsJoinRequest; res: ChannelsJoinResponse };
	'channels/members': { req: ChannelsMembersRequest; res: ChannelsMembersResponse };
	'channels/my-favorites': { req: EmptyRequest; res: ChannelsMyFavoritesResponse };
	'channels/owned': { req: ChannelsOwnedRequest; res: ChannelsOwnedResponse };
	'channels/remove-member': { req: ChannelsRemoveMemberRequest; res: EmptyResponse };
	'channels/search': { req: ChannelsSearchRequest; res: ChannelsSearchResponse };
	'channels/show': { req: ChannelsShowRequest; res: ChannelsShowResponse };
	'channels/show-password': { req: ChannelsShowPasswordRequest; res: ChannelsShowPasswordResponse };
	'channels/timeline': { req: ChannelsTimelineRequest; res: ChannelsTimelineResponse };
	'channels/unfavorite': { req: ChannelsUnfavoriteRequest; res: EmptyResponse };
	'channels/unfollow': { req: ChannelsUnfollowRequest; res: EmptyResponse };
	'channels/update': { req: ChannelsUpdateRequest; res: ChannelsUpdateResponse };
	'charts/active-users': { req: ChartsActiveUsersRequest; res: ChartsActiveUsersResponse };
	'charts/ap-request': { req: ChartsApRequestRequest; res: ChartsApRequestResponse };
	'charts/drive': { req: ChartsDriveRequest; res: ChartsDriveResponse };
	'charts/federation': { req: ChartsFederationRequest; res: ChartsFederationResponse };
	'charts/instance': { req: ChartsInstanceRequest; res: ChartsInstanceResponse };
	'charts/notes': { req: ChartsNotesRequest; res: ChartsNotesResponse };
	'charts/user/drive': { req: ChartsUserDriveRequest; res: ChartsUserDriveResponse };
	'charts/user/following': { req: ChartsUserFollowingRequest; res: ChartsUserFollowingResponse };
	'charts/user/notes': { req: ChartsUserNotesRequest; res: ChartsUserNotesResponse };
	'charts/user/pv': { req: ChartsUserPvRequest; res: ChartsUserPvResponse };
	'charts/user/reactions': { req: ChartsUserReactionsRequest; res: ChartsUserReactionsResponse };
	'charts/users': { req: ChartsUsersRequest; res: ChartsUsersResponse };
	'chat/history': { req: ChatHistoryRequest; res: ChatHistoryResponse };
	'chat/messages/create-to-room': { req: ChatMessagesCreateToRoomRequest; res: ChatMessagesCreateToRoomResponse };
	'chat/messages/create-to-user': { req: ChatMessagesCreateToUserRequest; res: ChatMessagesCreateToUserResponse };
	'chat/messages/delete': { req: ChatMessagesDeleteRequest; res: EmptyResponse };
	'chat/messages/react': { req: ChatMessagesReactRequest; res: EmptyResponse };
	'chat/messages/room-timeline': { req: ChatMessagesRoomTimelineRequest; res: ChatMessagesRoomTimelineResponse };
	'chat/messages/search': { req: ChatMessagesSearchRequest; res: ChatMessagesSearchResponse };
	'chat/messages/show': { req: ChatMessagesShowRequest; res: ChatMessagesShowResponse };
	'chat/messages/unreact': { req: ChatMessagesUnreactRequest; res: EmptyResponse };
	'chat/messages/user-timeline': { req: ChatMessagesUserTimelineRequest; res: ChatMessagesUserTimelineResponse };
	'chat/read-all': { req: EmptyRequest; res: EmptyResponse };
	'chat/rooms/create': { req: ChatRoomsCreateRequest; res: ChatRoomsCreateResponse };
	'chat/rooms/delete': { req: ChatRoomsDeleteRequest; res: EmptyResponse };
	'chat/rooms/invitations/cancel': { req: ChatRoomsInvitationsCancelRequest; res: EmptyResponse };
	'chat/rooms/invitations/create': { req: ChatRoomsInvitationsCreateRequest; res: ChatRoomsInvitationsCreateResponse };
	'chat/rooms/invitations/ignore': { req: ChatRoomsInvitationsIgnoreRequest; res: EmptyResponse };
	'chat/rooms/invitations/inbox': { req: ChatRoomsInvitationsInboxRequest; res: ChatRoomsInvitationsInboxResponse };
	'chat/rooms/invitations/outbox': { req: ChatRoomsInvitationsOutboxRequest; res: ChatRoomsInvitationsOutboxResponse };
	'chat/rooms/invitations/reject': { req: ChatRoomsInvitationsRejectRequest; res: EmptyResponse };
	'chat/rooms/join': { req: ChatRoomsJoinRequest; res: EmptyResponse };
	'chat/rooms/joining': { req: ChatRoomsJoiningRequest; res: ChatRoomsJoiningResponse };
	'chat/rooms/leave': { req: ChatRoomsLeaveRequest; res: EmptyResponse };
	'chat/rooms/members': { req: ChatRoomsMembersRequest; res: ChatRoomsMembersResponse };
	'chat/rooms/mute': { req: ChatRoomsMuteRequest; res: EmptyResponse };
	'chat/rooms/owned': { req: ChatRoomsOwnedRequest; res: ChatRoomsOwnedResponse };
	'chat/rooms/show': { req: ChatRoomsShowRequest; res: ChatRoomsShowResponse };
	'chat/rooms/update': { req: ChatRoomsUpdateRequest; res: ChatRoomsUpdateResponse };
	'clips/add-note': { req: ClipsAddNoteRequest; res: EmptyResponse };
	'clips/create': { req: ClipsCreateRequest; res: ClipsCreateResponse };
	'clips/delete': { req: ClipsDeleteRequest; res: EmptyResponse };
	'clips/favorite': { req: ClipsFavoriteRequest; res: EmptyResponse };
	'clips/list': { req: ClipsListRequest; res: ClipsListResponse };
	'clips/my-favorites': { req: EmptyRequest; res: ClipsMyFavoritesResponse };
	'clips/notes': { req: ClipsNotesRequest; res: ClipsNotesResponse };
	'clips/remove-note': { req: ClipsRemoveNoteRequest; res: EmptyResponse };
	'clips/show': { req: ClipsShowRequest; res: ClipsShowResponse };
	'clips/unfavorite': { req: ClipsUnfavoriteRequest; res: EmptyResponse };
	'clips/update': { req: ClipsUpdateRequest; res: ClipsUpdateResponse };
	'drive': { req: EmptyRequest; res: DriveResponse };
	'drive/files': { req: DriveFilesRequest; res: DriveFilesResponse };
	'drive/files/attached-chat-messages': { req: DriveFilesAttachedChatMessagesRequest; res: DriveFilesAttachedChatMessagesResponse };
	'drive/files/attached-notes': { req: DriveFilesAttachedNotesRequest; res: DriveFilesAttachedNotesResponse };
	'drive/files/check-existence': { req: DriveFilesCheckExistenceRequest; res: DriveFilesCheckExistenceResponse };
	'drive/files/create': { req: DriveFilesCreateRequest; res: DriveFilesCreateResponse };
	'drive/files/delete': { req: DriveFilesDeleteRequest; res: EmptyResponse };
	'drive/files/find': { req: DriveFilesFindRequest; res: DriveFilesFindResponse };
	'drive/files/find-by-hash': { req: DriveFilesFindByHashRequest; res: DriveFilesFindByHashResponse };
	'drive/files/move-bulk': { req: DriveFilesMoveBulkRequest; res: EmptyResponse };
	'drive/files/show': { req: DriveFilesShowRequest; res: DriveFilesShowResponse };
	'drive/files/update': { req: DriveFilesUpdateRequest; res: DriveFilesUpdateResponse };
	'drive/files/upload-from-url': { req: DriveFilesUploadFromUrlRequest; res: EmptyResponse };
	'drive/folders': { req: DriveFoldersRequest; res: DriveFoldersResponse };
	'drive/folders/create': { req: DriveFoldersCreateRequest; res: DriveFoldersCreateResponse };
	'drive/folders/delete': { req: DriveFoldersDeleteRequest; res: EmptyResponse };
	'drive/folders/find': { req: DriveFoldersFindRequest; res: DriveFoldersFindResponse };
	'drive/folders/show': { req: DriveFoldersShowRequest; res: DriveFoldersShowResponse };
	'drive/folders/update': { req: DriveFoldersUpdateRequest; res: DriveFoldersUpdateResponse };
	'drive/stream': { req: DriveStreamRequest; res: DriveStreamResponse };
	'email-address/available': { req: EmailAddressAvailableRequest; res: EmailAddressAvailableResponse };
	'emoji': { req: EmojiRequest; res: EmojiResponse };
	'emojis': { req: EmptyRequest; res: EmojisResponse };
	'endpoint': { req: EndpointRequest; res: EndpointResponse };
	'endpoints': { req: EmptyRequest; res: EndpointsResponse };
	'export-custom-emojis': { req: EmptyRequest; res: EmptyResponse };
	'federation/followers': { req: FederationFollowersRequest; res: FederationFollowersResponse };
	'federation/following': { req: FederationFollowingRequest; res: FederationFollowingResponse };
	'federation/instances': { req: FederationInstancesRequest; res: FederationInstancesResponse };
	'federation/remote-software': { req: FederationRemoteSoftwareRequest; res: FederationRemoteSoftwareResponse };
	'federation/show-instance': { req: FederationShowInstanceRequest; res: FederationShowInstanceResponse };
	'federation/stats': { req: FederationStatsRequest; res: FederationStatsResponse };
	'federation/update-remote-user': { req: FederationUpdateRemoteUserRequest; res: EmptyResponse };
	'federation/users': { req: FederationUsersRequest; res: FederationUsersResponse };
	'fetch-external-resources': { req: FetchExternalResourcesRequest; res: FetchExternalResourcesResponse };
	'fetch-rss': { req: FetchRssRequest; res: FetchRssResponse };
	'flash/create': { req: FlashCreateRequest; res: FlashCreateResponse };
	'flash/delete': { req: FlashDeleteRequest; res: EmptyResponse };
	'flash/featured': { req: FlashFeaturedRequest; res: FlashFeaturedResponse };
	'flash/gen-token': { req: FlashGenTokenRequest; res: FlashGenTokenResponse };
	'flash/like': { req: FlashLikeRequest; res: EmptyResponse };
	'flash/my': { req: FlashMyRequest; res: FlashMyResponse };
	'flash/my-likes': { req: FlashMyLikesRequest; res: FlashMyLikesResponse };
	'flash/search': { req: FlashSearchRequest; res: FlashSearchResponse };
	'flash/show': { req: FlashShowRequest; res: FlashShowResponse };
	'flash/unlike': { req: FlashUnlikeRequest; res: EmptyResponse };
	'flash/update': { req: FlashUpdateRequest; res: EmptyResponse };
	'following/create': { req: FollowingCreateRequest; res: FollowingCreateResponse };
	'following/delete': { req: FollowingDeleteRequest; res: FollowingDeleteResponse };
	'following/invalidate': { req: FollowingInvalidateRequest; res: FollowingInvalidateResponse };
	'following/requests/accept': { req: FollowingRequestsAcceptRequest; res: EmptyResponse };
	'following/requests/cancel': { req: FollowingRequestsCancelRequest; res: FollowingRequestsCancelResponse };
	'following/requests/list': { req: FollowingRequestsListRequest; res: FollowingRequestsListResponse };
	'following/requests/reject': { req: FollowingRequestsRejectRequest; res: EmptyResponse };
	'following/requests/sent': { req: FollowingRequestsSentRequest; res: FollowingRequestsSentResponse };
	'following/update': { req: FollowingUpdateRequest; res: FollowingUpdateResponse };
	'following/update-all': { req: FollowingUpdateAllRequest; res: EmptyResponse };
	'gallery/featured': { req: GalleryFeaturedRequest; res: GalleryFeaturedResponse };
	'gallery/popular': { req: EmptyRequest; res: GalleryPopularResponse };
	'gallery/posts': { req: GalleryPostsRequest; res: GalleryPostsResponse };
	'gallery/posts/create': { req: GalleryPostsCreateRequest; res: GalleryPostsCreateResponse };
	'gallery/posts/delete': { req: GalleryPostsDeleteRequest; res: EmptyResponse };
	'gallery/posts/like': { req: GalleryPostsLikeRequest; res: EmptyResponse };
	'gallery/posts/show': { req: GalleryPostsShowRequest; res: GalleryPostsShowResponse };
	'gallery/posts/unlike': { req: GalleryPostsUnlikeRequest; res: EmptyResponse };
	'gallery/posts/update': { req: GalleryPostsUpdateRequest; res: GalleryPostsUpdateResponse };
	'get-avatar-decorations': { req: EmptyRequest; res: GetAvatarDecorationsResponse };
	'get-online-users-count': { req: EmptyRequest; res: GetOnlineUsersCountResponse };
	'hashtags/list': { req: HashtagsListRequest; res: HashtagsListResponse };
	'hashtags/search': { req: HashtagsSearchRequest; res: HashtagsSearchResponse };
	'hashtags/show': { req: HashtagsShowRequest; res: HashtagsShowResponse };
	'hashtags/trend': { req: EmptyRequest; res: HashtagsTrendResponse };
	'hashtags/users': { req: HashtagsUsersRequest; res: HashtagsUsersResponse };
	'hata/consent/get': { req: HataConsentGetRequest; res: HataConsentGetResponse };
	'hata/consent/update': { req: HataConsentUpdateRequest; res: HataConsentUpdateResponse };
	'hata/earthquake/history': { req: HataEarthquakeHistoryRequest; res: HataEarthquakeHistoryResponse };
	'hata/earthquake/notification-settings': { req: EmptyRequest; res: HataEarthquakeNotificationSettingsResponse };
	'hata/earthquake/notification-settings-update': { req: HataEarthquakeNotificationSettingsUpdateRequest; res: HataEarthquakeNotificationSettingsUpdateResponse };
	'hata/earthquake/tsunami': { req: HataEarthquakeTsunamiRequest; res: HataEarthquakeTsunamiResponse };
	'hata/emoji-vote/show': { req: HataEmojiVoteShowRequest; res: HataEmojiVoteShowResponse };
	'hata/emoji-vote/vote': { req: HataEmojiVoteVoteRequest; res: HataEmojiVoteVoteResponse };
	'hata/feedback/agree': { req: HataFeedbackAgreeRequest; res: HataFeedbackAgreeResponse };
	'hata/feedback/available': { req: EmptyRequest; res: HataFeedbackAvailableResponse };
	'hata/feedback/comments': { req: HataFeedbackCommentsRequest; res: HataFeedbackCommentsResponse };
	'hata/feedback/comments/create': { req: HataFeedbackCommentsCreateRequest; res: HataFeedbackCommentsCreateResponse };
	'hata/feedback/comments/delete': { req: HataFeedbackCommentsDeleteRequest; res: EmptyResponse };
	'hata/feedback/comments/mark': { req: HataFeedbackCommentsMarkRequest; res: HataFeedbackCommentsMarkResponse };
	'hata/feedback/comments/react': { req: HataFeedbackCommentsReactRequest; res: HataFeedbackCommentsReactResponse };
	'hata/feedback/emoji-categories': { req: EmptyRequest; res: HataFeedbackEmojiCategoriesResponse };
	'hata/feedback/emoji-change-requests': { req: HataFeedbackEmojiChangeRequestsRequest; res: HataFeedbackEmojiChangeRequestsResponse };
	'hata/feedback/emoji-change-requests/approve': { req: HataFeedbackEmojiChangeRequestsApproveRequest; res: EmptyResponse };
	'hata/feedback/emoji-change-requests/create': { req: HataFeedbackEmojiChangeRequestsCreateRequest; res: HataFeedbackEmojiChangeRequestsCreateResponse };
	'hata/feedback/emoji-change-requests/hold': { req: HataFeedbackEmojiChangeRequestsHoldRequest; res: EmptyResponse };
	'hata/feedback/emoji-change-requests/reject': { req: HataFeedbackEmojiChangeRequestsRejectRequest; res: EmptyResponse };
	'hata/feedback/emoji-quota': { req: EmptyRequest; res: HataFeedbackEmojiQuotaResponse };
	'hata/feedback/emoji-requests': { req: HataFeedbackEmojiRequestsRequest; res: HataFeedbackEmojiRequestsResponse };
	'hata/feedback/emoji-requests/approve': { req: HataFeedbackEmojiRequestsApproveRequest; res: EmptyResponse };
	'hata/feedback/emoji-requests/cancel': { req: HataFeedbackEmojiRequestsCancelRequest; res: EmptyResponse };
	'hata/feedback/emoji-requests/create': { req: HataFeedbackEmojiRequestsCreateRequest; res: HataFeedbackEmojiRequestsCreateResponse };
	'hata/feedback/emoji-requests/hold': { req: HataFeedbackEmojiRequestsHoldRequest; res: EmptyResponse };
	'hata/feedback/emoji-requests/reject': { req: HataFeedbackEmojiRequestsRejectRequest; res: EmptyResponse };
	'hata/feedback/issues': { req: HataFeedbackIssuesRequest; res: HataFeedbackIssuesResponse };
	'hata/feedback/issues/close': { req: HataFeedbackIssuesCloseRequest; res: EmptyResponse };
	'hata/feedback/issues/create': { req: HataFeedbackIssuesCreateRequest; res: HataFeedbackIssuesCreateResponse };
	'hata/feedback/issues/delete': { req: HataFeedbackIssuesDeleteRequest; res: EmptyResponse };
	'hata/feedback/issues/export': { req: HataFeedbackIssuesExportRequest; res: HataFeedbackIssuesExportResponse };
	'hata/feedback/issues/show': { req: HataFeedbackIssuesShowRequest; res: HataFeedbackIssuesShowResponse };
	'hata/feedback/issues/status-counts': { req: HataFeedbackIssuesStatusCountsRequest; res: HataFeedbackIssuesStatusCountsResponse };
	'hata/feedback/issues/update': { req: HataFeedbackIssuesUpdateRequest; res: HataFeedbackIssuesUpdateResponse };
	'hata/feedback/moderators/grant': { req: HataFeedbackModeratorsGrantRequest; res: EmptyResponse };
	'hata/feedback/moderators/revoke': { req: HataFeedbackModeratorsRevokeRequest; res: EmptyResponse };
	'hata/feedback/notifications': { req: HataFeedbackNotificationsRequest; res: HataFeedbackNotificationsResponse };
	'hata/feedback/notifications/read': { req: HataFeedbackNotificationsReadRequest; res: EmptyResponse };
	'hata/feedback/projects': { req: HataFeedbackProjectsRequest; res: HataFeedbackProjectsResponse };
	'hata/feedback/projects/create': { req: HataFeedbackProjectsCreateRequest; res: HataFeedbackProjectsCreateResponse };
	'hata/feedback/projects/delete': { req: HataFeedbackProjectsDeleteRequest; res: EmptyResponse };
	'hata/feedback/projects/update': { req: HataFeedbackProjectsUpdateRequest; res: HataFeedbackProjectsUpdateResponse };
	'hata/feedback/remote-emojis': { req: HataFeedbackRemoteEmojisRequest; res: HataFeedbackRemoteEmojisResponse };
	'hata/hatady/activities': { req: HataHatadyActivitiesRequest; res: HataHatadyActivitiesResponse };
	'hata/hatady/admin/books': { req: HataHatadyAdminBooksRequest; res: HataHatadyAdminBooksResponse };
	'hata/hatady/admin/delete-book': { req: HataHatadyAdminDeleteBookRequest; res: EmptyResponse };
	'hata/hatady/admin/moderation/list': { req: HataHatadyAdminModerationListRequest; res: HataHatadyAdminModerationListResponse };
	'hata/hatady/admin/moderation/review': { req: HataHatadyAdminModerationReviewRequest; res: HataHatadyAdminModerationReviewResponse };
	'hata/hatady/admin/moderation/show': { req: HataHatadyAdminModerationShowRequest; res: HataHatadyAdminModerationShowResponse };
	'hata/hatady/bookmarks/create': { req: HataHatadyBookmarksCreateRequest; res: HataHatadyBookmarksCreateResponse };
	'hata/hatady/bookmarks/delete': { req: HataHatadyBookmarksDeleteRequest; res: EmptyResponse };
	'hata/hatady/bookmarks/update': { req: HataHatadyBookmarksUpdateRequest; res: HataHatadyBookmarksUpdateResponse };
	'hata/hatady/books': { req: HataHatadyBooksRequest; res: HataHatadyBooksResponse };
	'hata/hatady/books/create': { req: HataHatadyBooksCreateRequest; res: HataHatadyBooksCreateResponse };
	'hata/hatady/books/delete': { req: HataHatadyBooksDeleteRequest; res: EmptyResponse };
	'hata/hatady/books/show': { req: HataHatadyBooksShowRequest; res: HataHatadyBooksShowResponse };
	'hata/hatady/books/update': { req: HataHatadyBooksUpdateRequest; res: HataHatadyBooksUpdateResponse };
	'hata/hatady/comments': { req: HataHatadyCommentsRequest; res: HataHatadyCommentsResponse };
	'hata/hatady/comments/create': { req: HataHatadyCommentsCreateRequest; res: HataHatadyCommentsCreateResponse };
	'hata/hatady/comments/delete': { req: HataHatadyCommentsDeleteRequest; res: HataHatadyCommentsDeleteResponse };
	'hata/hatady/comments/update': { req: HataHatadyCommentsUpdateRequest; res: HataHatadyCommentsUpdateResponse };
	'hata/hatady/followers/remove': { req: HataHatadyFollowersRemoveRequest; res: EmptyResponse };
	'hata/hatady/following/create': { req: HataHatadyFollowingCreateRequest; res: EmptyResponse };
	'hata/hatady/following/delete': { req: HataHatadyFollowingDeleteRequest; res: EmptyResponse };
	'hata/hatady/following/list': { req: HataHatadyFollowingListRequest; res: HataHatadyFollowingListResponse };
	'hata/hatady/goals': { req: EmptyRequest; res: HataHatadyGoalsResponse };
	'hata/hatady/goals/create': { req: HataHatadyGoalsCreateRequest; res: HataHatadyGoalsCreateResponse };
	'hata/hatady/goals/delete': { req: HataHatadyGoalsDeleteRequest; res: EmptyResponse };
	'hata/hatady/goals/update': { req: HataHatadyGoalsUpdateRequest; res: EmptyResponse };
	'hata/hatady/logs': { req: HataHatadyLogsRequest; res: HataHatadyLogsResponse };
	'hata/hatady/logs/create': { req: HataHatadyLogsCreateRequest; res: HataHatadyLogsCreateResponse };
	'hata/hatady/logs/delete': { req: HataHatadyLogsDeleteRequest; res: EmptyResponse };
	'hata/hatady/logs/show': { req: HataHatadyLogsShowRequest; res: HataHatadyLogsShowResponse };
	'hata/hatady/logs/update': { req: HataHatadyLogsUpdateRequest; res: HataHatadyLogsUpdateResponse };
	'hata/hatady/media/comments/create': { req: HataHatadyMediaCommentsCreateRequest; res: HataHatadyMediaCommentsCreateResponse };
	'hata/hatady/media/comments/delete': { req: HataHatadyMediaCommentsDeleteRequest; res: EmptyResponse };
	'hata/hatady/media/comments/list': { req: HataHatadyMediaCommentsListRequest; res: HataHatadyMediaCommentsListResponse };
	'hata/hatady/media/comments/update': { req: HataHatadyMediaCommentsUpdateRequest; res: HataHatadyMediaCommentsUpdateResponse };
	'hata/hatady/media/reactions/create': { req: HataHatadyMediaReactionsCreateRequest; res: EmptyResponse };
	'hata/hatady/media/reactions/delete': { req: HataHatadyMediaReactionsDeleteRequest; res: EmptyResponse };
	'hata/hatady/media/reactions/list': { req: HataHatadyMediaReactionsListRequest; res: HataHatadyMediaReactionsListResponse };
	'hata/hatady/media/sessions/create': { req: HataHatadyMediaSessionsCreateRequest; res: HataHatadyMediaSessionsCreateResponse };
	'hata/hatady/media/sessions/delete': { req: HataHatadyMediaSessionsDeleteRequest; res: EmptyResponse };
	'hata/hatady/media/sessions/list': { req: HataHatadyMediaSessionsListRequest; res: HataHatadyMediaSessionsListResponse };
	'hata/hatady/media/sessions/show': { req: HataHatadyMediaSessionsShowRequest; res: HataHatadyMediaSessionsShowResponse };
	'hata/hatady/media/sessions/update': { req: HataHatadyMediaSessionsUpdateRequest; res: HataHatadyMediaSessionsUpdateResponse };
	'hata/hatady/media/works/create': { req: HataHatadyMediaWorksCreateRequest; res: HataHatadyMediaWorksCreateResponse };
	'hata/hatady/media/works/delete': { req: HataHatadyMediaWorksDeleteRequest; res: EmptyResponse };
	'hata/hatady/media/works/list': { req: HataHatadyMediaWorksListRequest; res: HataHatadyMediaWorksListResponse };
	'hata/hatady/media/works/show': { req: HataHatadyMediaWorksShowRequest; res: HataHatadyMediaWorksShowResponse };
	'hata/hatady/media/works/update': { req: HataHatadyMediaWorksUpdateRequest; res: HataHatadyMediaWorksUpdateResponse };
	'hata/hatady/memos/create': { req: HataHatadyMemosCreateRequest; res: HataHatadyMemosCreateResponse };
	'hata/hatady/memos/delete': { req: HataHatadyMemosDeleteRequest; res: EmptyResponse };
	'hata/hatady/memos/update': { req: HataHatadyMemosUpdateRequest; res: HataHatadyMemosUpdateResponse };
	'hata/hatady/notifications': { req: HataHatadyNotificationsRequest; res: HataHatadyNotificationsResponse };
	'hata/hatady/notifications/delete': { req: HataHatadyNotificationsDeleteRequest; res: EmptyResponse };
	'hata/hatady/notifications/mark-all-read': { req: EmptyRequest; res: EmptyResponse };
	'hata/hatady/notifications/mark-as-read': { req: HataHatadyNotificationsMarkAsReadRequest; res: EmptyResponse };
	'hata/hatady/notifications/restore': { req: HataHatadyNotificationsRestoreRequest; res: EmptyResponse };
	'hata/hatady/notifications/unread-count': { req: EmptyRequest; res: HataHatadyNotificationsUnreadCountResponse };
	'hata/hatady/profile/update': { req: HataHatadyProfileUpdateRequest; res: EmptyResponse };
	'hata/hatady/reactions/create': { req: HataHatadyReactionsCreateRequest; res: EmptyResponse };
	'hata/hatady/reactions/delete': { req: HataHatadyReactionsDeleteRequest; res: EmptyResponse };
	'hata/hatady/reactions/list': { req: HataHatadyReactionsListRequest; res: HataHatadyReactionsListResponse };
	'hata/hatady/search': { req: HataHatadySearchRequest; res: HataHatadySearchResponse };
	'hata/hatady/stats': { req: HataHatadyStatsRequest; res: HataHatadyStatsResponse };
	'hata/hatady/stats-detail': { req: HataHatadyStatsDetailRequest; res: HataHatadyStatsDetailResponse };
	'hata/hatady/streaks': { req: HataHatadyStreaksRequest; res: HataHatadyStreaksResponse };
	'hata/hatady/subjects': { req: EmptyRequest; res: HataHatadySubjectsResponse };
	'hata/hatady/subjects/delete': { req: HataHatadySubjectsDeleteRequest; res: HataHatadySubjectsDeleteResponse };
	'hata/hatady/subjects/save': { req: HataHatadySubjectsSaveRequest; res: HataHatadySubjectsSaveResponse };
	'hata/hatady/timeline': { req: HataHatadyTimelineRequest; res: HataHatadyTimelineResponse };
	'hata/hatady/users/show': { req: HataHatadyUsersShowRequest; res: HataHatadyUsersShowResponse };
	'hata/hatagoes/home/daily': { req: HataHatagoesHomeDailyRequest; res: HataHatagoesHomeDailyResponse };
	'hata/hatagoes/home/issues': { req: EmptyRequest; res: HataHatagoesHomeIssuesResponse };
	'hata/hatagoes/notifications/unread-count': { req: EmptyRequest; res: HataHatagoesNotificationsUnreadCountResponse };
	'hata/hatagoes/search': { req: HataHatagoesSearchRequest; res: HataHatagoesSearchResponse };
	'hata/hatagoes/show': { req: HataHatagoesShowRequest; res: HataHatagoesShowResponse };
	'hata/hatask/emotion-analysis/create': { req: HataHataskEmotionAnalysisCreateRequest; res: HataHataskEmotionAnalysisCreateResponse };
	'hata/hatask/emotion-analysis/delete': { req: HataHataskEmotionAnalysisDeleteRequest; res: HataHataskEmotionAnalysisDeleteResponse };
	'hata/hatask/emotion-analysis/list': { req: HataHataskEmotionAnalysisListRequest; res: HataHataskEmotionAnalysisListResponse };
	'hata/hatask/emotion-analysis/show': { req: HataHataskEmotionAnalysisShowRequest; res: HataHataskEmotionAnalysisShowResponse };
	'hata/login-ranking': { req: EmptyRequest; res: HataLoginRankingResponse };
	'hata/mascot/get': { req: EmptyRequest; res: HataMascotGetResponse };
	'hata/mascot/update': { req: HataMascotUpdateRequest; res: HataMascotUpdateResponse };
	'hata/ui-s-announcement/claim': { req: EmptyRequest; res: HataUiSAnnouncementClaimResponse };
	'hataigo/action': { req: HataigoActionRequest; res: HataigoActionResponse };
	'hataigo/cancel-game': { req: HataigoCancelGameRequest; res: HataigoCancelGameResponse };
	'hataigo/cancel-match': { req: EmptyRequest; res: EmptyResponse };
	'hataigo/chat-capability': { req: EmptyRequest; res: HataigoChatCapabilityResponse };
	'hataigo/chat-delete': { req: HataigoChatDeleteRequest; res: EmptyResponse };
	'hataigo/chat-messages': { req: HataigoChatMessagesRequest; res: HataigoChatMessagesResponse };
	'hataigo/chat-post': { req: HataigoChatPostRequest; res: HataigoChatPostResponse };
	'hataigo/claim-timeout': { req: HataigoClaimTimeoutRequest; res: HataigoClaimTimeoutResponse };
	'hataigo/games': { req: HataigoGamesRequest; res: HataigoGamesResponse };
	'hataigo/invitations': { req: EmptyRequest; res: HataigoInvitationsResponse };
	'hataigo/match': { req: HataigoMatchRequest; res: HataigoMatchResponse };
	'hataigo/my-stats': { req: EmptyRequest; res: HataigoMyStatsResponse };
	'hataigo/ready': { req: HataigoReadyRequest; res: HataigoReadyResponse };
	'hataigo/respond-invite': { req: HataigoRespondInviteRequest; res: HataigoRespondInviteResponse };
	'hataigo/settings': { req: HataigoSettingsRequest; res: HataigoSettingsResponse };
	'hataigo/show-game': { req: HataigoShowGameRequest; res: HataigoShowGameResponse };
	'hataigo/surrender': { req: HataigoSurrenderRequest; res: HataigoSurrenderResponse };
	'hataigo/verify': { req: HataigoVerifyRequest; res: HataigoVerifyResponse };
	'hatask/events/close': { req: HataskEventsCloseRequest; res: EmptyResponse };
	'hatask/events/create': { req: HataskEventsCreateRequest; res: HataskEventsCreateResponse };
	'hatask/events/delete': { req: HataskEventsDeleteRequest; res: EmptyResponse };
	'hatask/events/list': { req: HataskEventsListRequest; res: HataskEventsListResponse };
	'hatask/events/owned': { req: HataskEventsOwnedRequest; res: HataskEventsOwnedResponse };
	'hatask/events/rsvp': { req: HataskEventsRsvpRequest; res: EmptyResponse };
	'hatask/events/update': { req: HataskEventsUpdateRequest; res: HataskEventsUpdateResponse };
	'hatask/flowers/drops/pour': { req: HataskFlowersDropsPourRequest; res: HataskFlowersDropsPourResponse };
	'hatask/flowers/drops/show': { req: HataskFlowersDropsShowRequest; res: HataskFlowersDropsShowResponse };
	'hatask/flowers/festival/show': { req: HataskFlowersFestivalShowRequest; res: HataskFlowersFestivalShowResponse };
	'hatask/flowers/harvest': { req: HataskFlowersHarvestRequest; res: HataskFlowersHarvestResponse };
	'hatask/flowers/list': { req: HataskFlowersListRequest; res: HataskFlowersListResponse };
	'hatask/flowers/rename': { req: HataskFlowersRenameRequest; res: HataskFlowersRenameResponse };
	'hatask/flowers/state': { req: HataskFlowersStateRequest; res: HataskFlowersStateResponse };
	'hatask/flowers/sync': { req: HataskFlowersSyncRequest; res: HataskFlowersSyncResponse };
	'hatask/flowers/visibility/update': { req: HataskFlowersVisibilityUpdateRequest; res: HataskFlowersVisibilityUpdateResponse };
	'hatask/flowers/zukan/claim-seed': { req: HataskFlowersZukanClaimSeedRequest; res: HataskFlowersZukanClaimSeedResponse };
	'hatask/flowers/zukan/show': { req: HataskFlowersZukanShowRequest; res: HataskFlowersZukanShowResponse };
	'hatask/planner/commit': { req: HataskPlannerCommitRequest; res: HataskPlannerCommitResponse };
	'hatask/planner/commit-batch': { req: HataskPlannerCommitBatchRequest; res: HataskPlannerCommitBatchResponse };
	'hatask/planner/create-shadow': { req: HataskPlannerCreateShadowRequest; res: HataskPlannerCreateShadowResponse };
	'hatask/planner/get': { req: EmptyRequest; res: HataskPlannerGetResponse };
	'hatask/ranking/list': { req: HataskRankingListRequest; res: HataskRankingListResponse };
	'hatask/ranking/participation': { req: HataskRankingParticipationRequest; res: HataskRankingParticipationResponse };
	'hatask/recipes/cooked/create': { req: HataskRecipesCookedCreateRequest; res: HataskRecipesCookedCreateResponse };
	'hatask/recipes/cooked/delete': { req: HataskRecipesCookedDeleteRequest; res: EmptyResponse };
	'hatask/recipes/cooked/list': { req: HataskRecipesCookedListRequest; res: HataskRecipesCookedListResponse };
	'hatask/recipes/create': { req: HataskRecipesCreateRequest; res: HataskRecipesCreateResponse };
	'hatask/recipes/delete': { req: HataskRecipesDeleteRequest; res: EmptyResponse };
	'hatask/recipes/list': { req: HataskRecipesListRequest; res: HataskRecipesListResponse };
	'hatask/recipes/show': { req: HataskRecipesShowRequest; res: HataskRecipesShowResponse };
	'hatask/recipes/update': { req: HataskRecipesUpdateRequest; res: HataskRecipesUpdateResponse };
	'hatask/records/export': { req: EmptyRequest; res: HataskRecordsExportResponse };
	'hatask/records/import': { req: HataskRecordsImportRequest; res: HataskRecordsImportResponse };
	'hatask/support/show': { req: EmptyRequest; res: HataskSupportShowResponse };
	'hatask/support/supporters': { req: HataskSupportSupportersRequest; res: HataskSupportSupportersResponse };
	'i': { req: EmptyRequest; res: IResponse };
	'i/2fa/done': { req: I2faDoneRequest; res: I2faDoneResponse };
	'i/2fa/key-done': { req: I2faKeyDoneRequest; res: I2faKeyDoneResponse };
	'i/2fa/password-less': { req: I2faPasswordLessRequest; res: EmptyResponse };
	'i/2fa/register': { req: I2faRegisterRequest; res: I2faRegisterResponse };
	'i/2fa/register-key': { req: I2faRegisterKeyRequest; res: I2faRegisterKeyResponse };
	'i/2fa/remove-key': { req: I2faRemoveKeyRequest; res: EmptyResponse };
	'i/2fa/unregister': { req: I2faUnregisterRequest; res: EmptyResponse };
	'i/2fa/update-key': { req: I2faUpdateKeyRequest; res: EmptyResponse };
	'i/apps': { req: IAppsRequest; res: IAppsResponse };
	'i/authorized-apps': { req: IAuthorizedAppsRequest; res: IAuthorizedAppsResponse };
	'i/auto-delete-settings': { req: EmptyRequest; res: IAutoDeleteSettingsResponse };
	'i/change-password': { req: IChangePasswordRequest; res: EmptyResponse };
	'i/claim-achievement': { req: IClaimAchievementRequest; res: EmptyResponse };
	'i/delete-account': { req: IDeleteAccountRequest; res: EmptyResponse };
	'i/export-antennas': { req: EmptyRequest; res: EmptyResponse };
	'i/export-blocking': { req: EmptyRequest; res: EmptyResponse };
	'i/export-clips': { req: EmptyRequest; res: EmptyResponse };
	'i/export-favorites': { req: EmptyRequest; res: EmptyResponse };
	'i/export-following': { req: IExportFollowingRequest; res: EmptyResponse };
	'i/export-mute': { req: EmptyRequest; res: EmptyResponse };
	'i/export-notes': { req: EmptyRequest; res: EmptyResponse };
	'i/export-user-lists': { req: EmptyRequest; res: EmptyResponse };
	'i/favorites': { req: IFavoritesRequest; res: IFavoritesResponse };
	'i/followers-servers': { req: EmptyRequest; res: IFollowersServersResponse };
	'i/gallery/likes': { req: IGalleryLikesRequest; res: IGalleryLikesResponse };
	'i/gallery/posts': { req: IGalleryPostsRequest; res: IGalleryPostsResponse };
	'i/import-antennas': { req: IImportAntennasRequest; res: EmptyResponse };
	'i/import-blocking': { req: IImportBlockingRequest; res: EmptyResponse };
	'i/import-following': { req: IImportFollowingRequest; res: EmptyResponse };
	'i/import-muting': { req: IImportMutingRequest; res: EmptyResponse };
	'i/import-user-lists': { req: IImportUserListsRequest; res: EmptyResponse };
	'i/move': { req: IMoveRequest; res: IMoveResponse };
	'i/notifications': { req: INotificationsRequest; res: INotificationsResponse };
	'i/notifications-grouped': { req: INotificationsGroupedRequest; res: INotificationsGroupedResponse };
	'i/page-likes': { req: IPageLikesRequest; res: IPageLikesResponse };
	'i/pages': { req: IPagesRequest; res: IPagesResponse };
	'i/pin': { req: IPinRequest; res: IPinResponse };
	'i/read-announcement': { req: IReadAnnouncementRequest; res: EmptyResponse };
	'i/regenerate-token': { req: IRegenerateTokenRequest; res: EmptyResponse };
	'i/registry/get': { req: IRegistryGetRequest; res: IRegistryGetResponse };
	'i/registry/get-all': { req: IRegistryGetAllRequest; res: IRegistryGetAllResponse };
	'i/registry/get-detail': { req: IRegistryGetDetailRequest; res: IRegistryGetDetailResponse };
	'i/registry/keys': { req: IRegistryKeysRequest; res: IRegistryKeysResponse };
	'i/registry/keys-with-type': { req: IRegistryKeysWithTypeRequest; res: IRegistryKeysWithTypeResponse };
	'i/registry/remove': { req: IRegistryRemoveRequest; res: EmptyResponse };
	'i/registry/scopes-with-domain': { req: EmptyRequest; res: IRegistryScopesWithDomainResponse };
	'i/registry/set': { req: IRegistrySetRequest; res: EmptyResponse };
	'i/revoke-token': { req: IRevokeTokenRequest; res: EmptyResponse };
	'i/signin-history': { req: ISigninHistoryRequest; res: ISigninHistoryResponse };
	'i/truncate-account': { req: ITruncateAccountRequest; res: EmptyResponse };
	'i/unpin': { req: IUnpinRequest; res: IUnpinResponse };
	'i/update': { req: IUpdateRequest; res: IUpdateResponse };
	'i/update-auto-delete-settings': { req: IUpdateAutoDeleteSettingsRequest; res: EmptyResponse };
	'i/update-email': { req: IUpdateEmailRequest; res: IUpdateEmailResponse };
	'i/user-group-invites': { req: IUserGroupInvitesRequest; res: IUserGroupInvitesResponse };
	'i/webhooks/create': { req: IWebhooksCreateRequest; res: IWebhooksCreateResponse };
	'i/webhooks/delete': { req: IWebhooksDeleteRequest; res: EmptyResponse };
	'i/webhooks/list': { req: EmptyRequest; res: IWebhooksListResponse };
	'i/webhooks/show': { req: IWebhooksShowRequest; res: IWebhooksShowResponse };
	'i/webhooks/test': { req: IWebhooksTestRequest; res: EmptyResponse };
	'i/webhooks/update': { req: IWebhooksUpdateRequest; res: EmptyResponse };
	'invite/create': { req: EmptyRequest; res: InviteCreateResponse };
	'invite/delete': { req: InviteDeleteRequest; res: EmptyResponse };
	'invite/limit': { req: EmptyRequest; res: InviteLimitResponse };
	'invite/list': { req: InviteListRequest; res: InviteListResponse };
	'meta': { req: MetaRequest; res: MetaResponse };
	'miauth/gen-token': { req: MiauthGenTokenRequest; res: MiauthGenTokenResponse };
	'mute/create': { req: MuteCreateRequest; res: EmptyResponse };
	'mute/delete': { req: MuteDeleteRequest; res: EmptyResponse };
	'mute/list': { req: MuteListRequest; res: MuteListResponse };
	'my/apps': { req: MyAppsRequest; res: MyAppsResponse };
	'notes': { req: NotesRequest; res: NotesResponse };
	'notes/bubble-timeline': { req: NotesBubbleTimelineRequest; res: NotesBubbleTimelineResponse };
	'notes/children': { req: NotesChildrenRequest; res: NotesChildrenResponse };
	'notes/clips': { req: NotesClipsRequest; res: NotesClipsResponse };
	'notes/conversation': { req: NotesConversationRequest; res: NotesConversationResponse };
	'notes/create': { req: NotesCreateRequest; res: NotesCreateResponse };
	'notes/delete': { req: NotesDeleteRequest; res: EmptyResponse };
	'notes/drafts/count': { req: EmptyRequest; res: NotesDraftsCountResponse };
	'notes/drafts/create': { req: NotesDraftsCreateRequest; res: NotesDraftsCreateResponse };
	'notes/drafts/delete': { req: NotesDraftsDeleteRequest; res: EmptyResponse };
	'notes/drafts/list': { req: NotesDraftsListRequest; res: NotesDraftsListResponse };
	'notes/drafts/update': { req: NotesDraftsUpdateRequest; res: NotesDraftsUpdateResponse };
	'notes/events/search': { req: NotesEventsSearchRequest; res: NotesEventsSearchResponse };
	'notes/favorites/create': { req: NotesFavoritesCreateRequest; res: EmptyResponse };
	'notes/favorites/delete': { req: NotesFavoritesDeleteRequest; res: EmptyResponse };
	'notes/favorites/folders/create': { req: NotesFavoritesFoldersCreateRequest; res: NotesFavoritesFoldersCreateResponse };
	'notes/favorites/folders/delete': { req: NotesFavoritesFoldersDeleteRequest; res: NotesFavoritesFoldersDeleteResponse };
	'notes/favorites/folders/list': { req: EmptyRequest; res: NotesFavoritesFoldersListResponse };
	'notes/favorites/folders/update': { req: NotesFavoritesFoldersUpdateRequest; res: NotesFavoritesFoldersUpdateResponse };
	'notes/favorites/move': { req: NotesFavoritesMoveRequest; res: EmptyResponse };
	'notes/featured': { req: NotesFeaturedRequest; res: NotesFeaturedResponse };
	'notes/global-timeline': { req: NotesGlobalTimelineRequest; res: NotesGlobalTimelineResponse };
	'notes/history': { req: NotesHistoryRequest; res: NotesHistoryResponse };
	'notes/hybrid-timeline': { req: NotesHybridTimelineRequest; res: NotesHybridTimelineResponse };
	'notes/local-timeline': { req: NotesLocalTimelineRequest; res: NotesLocalTimelineResponse };
	'notes/mentions': { req: NotesMentionsRequest; res: NotesMentionsResponse };
	'notes/polls/recommendation': { req: NotesPollsRecommendationRequest; res: NotesPollsRecommendationResponse };
	'notes/polls/vote': { req: NotesPollsVoteRequest; res: EmptyResponse };
	'notes/reactions': { req: NotesReactionsRequest; res: NotesReactionsResponse };
	'notes/reactions/create': { req: NotesReactionsCreateRequest; res: NotesReactionsCreateResponse };
	'notes/reactions/delete': { req: NotesReactionsDeleteRequest; res: EmptyResponse };
	'notes/renotes': { req: NotesRenotesRequest; res: NotesRenotesResponse };
	'notes/replies': { req: NotesRepliesRequest; res: NotesRepliesResponse };
	'notes/search': { req: NotesSearchRequest; res: NotesSearchResponse };
	'notes/search-by-tag': { req: NotesSearchByTagRequest; res: NotesSearchByTagResponse };
	'notes/show': { req: NotesShowRequest; res: NotesShowResponse };
	'notes/show-partial-bulk': { req: NotesShowPartialBulkRequest; res: NotesShowPartialBulkResponse };
	'notes/state': { req: NotesStateRequest; res: NotesStateResponse };
	'notes/thread-muting/create': { req: NotesThreadMutingCreateRequest; res: EmptyResponse };
	'notes/thread-muting/delete': { req: NotesThreadMutingDeleteRequest; res: EmptyResponse };
	'notes/timeline': { req: NotesTimelineRequest; res: NotesTimelineResponse };
	'notes/trending': { req: NotesTrendingRequest; res: NotesTrendingResponse };
	'notes/trending/check-new': { req: NotesTrendingCheckNewRequest; res: NotesTrendingCheckNewResponse };
	'notes/unrenote': { req: NotesUnrenoteRequest; res: EmptyResponse };
	'notes/update': { req: NotesUpdateRequest; res: EmptyResponse };
	'notes/user-list-timeline': { req: NotesUserListTimelineRequest; res: NotesUserListTimelineResponse };
	'notifications/create': { req: NotificationsCreateRequest; res: EmptyResponse };
	'notifications/flush': { req: EmptyRequest; res: EmptyResponse };
	'notifications/mark-all-as-read': { req: EmptyRequest; res: EmptyResponse };
	'notifications/mark-as-read': { req: NotificationsMarkAsReadRequest; res: EmptyResponse };
	'notifications/show': { req: NotificationsShowRequest; res: NotificationsShowResponse };
	'notifications/test-notification': { req: EmptyRequest; res: EmptyResponse };
	'notifications/unread-count': { req: EmptyRequest; res: NotificationsUnreadCountResponse };
	'page-push': { req: PagePushRequest; res: EmptyResponse };
	'pages/create': { req: PagesCreateRequest; res: PagesCreateResponse };
	'pages/delete': { req: PagesDeleteRequest; res: EmptyResponse };
	'pages/featured': { req: EmptyRequest; res: PagesFeaturedResponse };
	'pages/like': { req: PagesLikeRequest; res: EmptyResponse };
	'pages/show': { req: PagesShowRequest; res: PagesShowResponse };
	'pages/unlike': { req: PagesUnlikeRequest; res: EmptyResponse };
	'pages/update': { req: PagesUpdateRequest; res: EmptyResponse };
	'ping': { req: EmptyRequest; res: PingResponse };
	'pinned-users': { req: EmptyRequest; res: PinnedUsersResponse };
	'promo/read': { req: PromoReadRequest; res: EmptyResponse };
	'registration/apply': { req: RegistrationApplyRequest; res: RegistrationApplyResponse };
	'renote-mute/create': { req: RenoteMuteCreateRequest; res: EmptyResponse };
	'renote-mute/delete': { req: RenoteMuteDeleteRequest; res: EmptyResponse };
	'renote-mute/list': { req: RenoteMuteListRequest; res: RenoteMuteListResponse };
	'request-reset-password': { req: RequestResetPasswordRequest; res: EmptyResponse };
	'reset-db': { req: EmptyRequest; res: EmptyResponse };
	'reset-password': { req: ResetPasswordRequest; res: EmptyResponse };
	'retention': { req: EmptyRequest; res: RetentionResponse };
	'reversi/cancel-match': { req: ReversiCancelMatchRequest; res: EmptyResponse };
	'reversi/games': { req: ReversiGamesRequest; res: ReversiGamesResponse };
	'reversi/invitations': { req: EmptyRequest; res: ReversiInvitationsResponse };
	'reversi/match': { req: ReversiMatchRequest; res: ReversiMatchResponse };
	'reversi/show-game': { req: ReversiShowGameRequest; res: ReversiShowGameResponse };
	'reversi/surrender': { req: ReversiSurrenderRequest; res: EmptyResponse };
	'reversi/verify': { req: ReversiVerifyRequest; res: ReversiVerifyResponse };
	'roles/list': { req: EmptyRequest; res: RolesListResponse };
	'roles/notes': { req: RolesNotesRequest; res: RolesNotesResponse };
	'roles/show': { req: RolesShowRequest; res: RolesShowResponse };
	'roles/users': { req: RolesUsersRequest; res: RolesUsersResponse };
	'server-info': { req: EmptyRequest; res: ServerInfoResponse };
	'stats': { req: EmptyRequest; res: StatsResponse };
	'sw/register': { req: SwRegisterRequest; res: SwRegisterResponse };
	'sw/show-registration': { req: SwShowRegistrationRequest; res: SwShowRegistrationResponse };
	'sw/unregister': { req: SwUnregisterRequest; res: EmptyResponse };
	'sw/update-registration': { req: SwUpdateRegistrationRequest; res: SwUpdateRegistrationResponse };
	'test': { req: TestRequest; res: TestResponse };
	'username/available': { req: UsernameAvailableRequest; res: UsernameAvailableResponse };
	'users': { req: UsersRequest; res: UsersResponse };
	'users/achievements': { req: UsersAchievementsRequest; res: UsersAchievementsResponse };
	'users/clips': { req: UsersClipsRequest; res: UsersClipsResponse };
	'users/featured-notes': { req: UsersFeaturedNotesRequest; res: UsersFeaturedNotesResponse };
	'users/flashs': { req: UsersFlashsRequest; res: UsersFlashsResponse };
	'users/followers': { req: UsersFollowersRequest; res: UsersFollowersResponse };
	'users/following': { req: UsersFollowingRequest; res: UsersFollowingResponse };
	'users/gallery/posts': { req: UsersGalleryPostsRequest; res: UsersGalleryPostsResponse };
	'users/get-frequently-replied-users': { req: UsersGetFrequentlyRepliedUsersRequest; res: UsersGetFrequentlyRepliedUsersResponse };
	'users/groups/create': { req: UsersGroupsCreateRequest; res: UsersGroupsCreateResponse };
	'users/groups/delete': { req: UsersGroupsDeleteRequest; res: EmptyResponse };
	'users/groups/invitations/accept': { req: UsersGroupsInvitationsAcceptRequest; res: EmptyResponse };
	'users/groups/invitations/reject': { req: UsersGroupsInvitationsRejectRequest; res: EmptyResponse };
	'users/groups/invite': { req: UsersGroupsInviteRequest; res: EmptyResponse };
	'users/groups/joined': { req: EmptyRequest; res: UsersGroupsJoinedResponse };
	'users/groups/leave': { req: UsersGroupsLeaveRequest; res: EmptyResponse };
	'users/groups/owned': { req: EmptyRequest; res: UsersGroupsOwnedResponse };
	'users/groups/pull': { req: UsersGroupsPullRequest; res: EmptyResponse };
	'users/groups/show': { req: UsersGroupsShowRequest; res: UsersGroupsShowResponse };
	'users/groups/transfer': { req: UsersGroupsTransferRequest; res: UsersGroupsTransferResponse };
	'users/groups/update': { req: UsersGroupsUpdateRequest; res: UsersGroupsUpdateResponse };
	'users/lists/create': { req: UsersListsCreateRequest; res: UsersListsCreateResponse };
	'users/lists/create-from-public': { req: UsersListsCreateFromPublicRequest; res: UsersListsCreateFromPublicResponse };
	'users/lists/delete': { req: UsersListsDeleteRequest; res: EmptyResponse };
	'users/lists/favorite': { req: UsersListsFavoriteRequest; res: EmptyResponse };
	'users/lists/get-memberships': { req: UsersListsGetMembershipsRequest; res: UsersListsGetMembershipsResponse };
	'users/lists/list': { req: UsersListsListRequest; res: UsersListsListResponse };
	'users/lists/pull': { req: UsersListsPullRequest; res: EmptyResponse };
	'users/lists/push': { req: UsersListsPushRequest; res: EmptyResponse };
	'users/lists/show': { req: UsersListsShowRequest; res: UsersListsShowResponse };
	'users/lists/unfavorite': { req: UsersListsUnfavoriteRequest; res: EmptyResponse };
	'users/lists/update': { req: UsersListsUpdateRequest; res: UsersListsUpdateResponse };
	'users/lists/update-membership': { req: UsersListsUpdateMembershipRequest; res: EmptyResponse };
	'users/notes': { req: UsersNotesRequest; res: UsersNotesResponse };
	'users/pages': { req: UsersPagesRequest; res: UsersPagesResponse };
	'users/reactions': { req: UsersReactionsRequest; res: UsersReactionsResponse };
	'users/recommendation': { req: UsersRecommendationRequest; res: UsersRecommendationResponse };
	'users/relation': { req: UsersRelationRequest; res: UsersRelationResponse };
	'users/report-abuse': { req: UsersReportAbuseRequest; res: EmptyResponse };
	'users/search': { req: UsersSearchRequest; res: UsersSearchResponse };
	'users/search-by-username-and-host': { req: UsersSearchByUsernameAndHostRequest; res: UsersSearchByUsernameAndHostResponse };
	'users/show': { req: UsersShowRequest; res: UsersShowResponse };
	'users/stats': { req: UsersStatsRequest; res: UsersStatsResponse };
	'users/update-memo': { req: UsersUpdateMemoRequest; res: EmptyResponse };
	'v2/admin/emoji/list': { req: V2AdminEmojiListRequest; res: V2AdminEmojiListResponse };
	'verify-email': { req: VerifyEmailRequest; res: EmptyResponse };
};

/**
 * NOTE: The content-type for all endpoints not listed here is application/json.
 */
export const endpointReqTypes = {
	'drive/files/create': 'multipart/form-data',
} as const satisfies { [K in keyof Endpoints]?: 'multipart/form-data'; };
