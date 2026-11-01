<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :data-content-visibility-auto="contentVisibilityAuto" :data-toast="toast" :data-notification-brand="brand">
	<div :class="$style.head">
		<MkAvatar v-if="['pollEnded', 'note'].includes(notification.type) && 'note' in notification" :class="$style.icon" :user="notification.note.user" link preview/>
		<MkAvatar v-else-if="['roleAssigned', 'achievementEarned', 'exportCompleted', 'login', 'createToken', 'scheduledNotePosted', 'scheduledNotePostFailed'].includes(notification.type)" :class="$style.icon" :user="$i" link preview/>
		<div v-else-if="notification.type === 'reaction:grouped' && notification.note.reactionAcceptance === 'likeOnly'" :class="[$style.icon, $style.icon_reactionGroupHeart]"><i class="ti ti-heart" style="line-height: 1;"></i></div>
		<div v-else-if="notification.type === 'reaction:grouped'" :class="[$style.icon, $style.icon_reactionGroup]"><i class="ti ti-plus" style="line-height: 1;"></i></div>
		<!-- 旗鯖fork: reaction:groupedByUser はそのユーザーのアバターを表示 -->
		<MkAvatar v-else-if="notification.type === 'reaction:groupedByUser'" :class="$style.icon" :user="notification.user" link preview/>
		<div v-else-if="notification.type === 'renote:grouped'" :class="[$style.icon, $style.icon_renoteGroup]"><i class="ti ti-repeat" style="line-height: 1;"></i></div>
		<div v-else-if="notification.type === 'note:grouped'" :class="[$style.icon, $style.icon_noteGroup]"><i class="ti ti-pencil" style="line-height: 1;"></i></div>
		<button v-else-if="notification.type === 'hatady' && notification.user" type="button" :class="[$style.icon, $style.hatadyAvatarButton]" :aria-label="`${notification.user.name || notification.user.username} — ${i18n.ts.profile}`" @click="void hatadyActions.openProfile(notification.user.id)"><MkAvatar :class="$style.icon" :user="notification.user"/></button>
		<HataAppLogo v-else-if="notification.type === 'hatady'" app="hatady" :size="toast ? 32 : 42" :monochrome="store.r.darkMode.value" :class="$style.icon"/>
		<MkAvatar v-else-if="'user' in notification" :class="$style.icon" :user="notification.user" link preview/>
		<div v-else-if="notification.type === 'app' && notification.id === NOTIFICATION_FILTER_POLICY_NOTICE_ID" :class="[$style.icon, $style.icon_filterPolicy]"><i class="ti ti-filter-cog"></i></div>
		<div v-else-if="notification.type === 'app' && notification.link === '/admin/registration-applications' && notification.icon == null" :class="[$style.icon, $style.icon_registrationApplication]"><i class="ti ti-user-plus" aria-hidden="true"></i></div>
		<!-- 旗鯖fork: Hatask 通知は言語非依存の link subtype で判別。旧通知向けに日本語 header 判定も残す。 -->
		<div v-else-if="notification.type === 'app' && !notification.icon && ((notification.link?.includes('notice=calendar') ?? false) || (notification.header != null && /カレンダー|イベント|スケジュール|予定/.test(notification.header)))" :class="[$style.icon, $style.icon_hataskCalendar]"><i class="ti ti-calendar-event"></i></div>
		<div v-else-if="notification.type === 'app' && !notification.icon && ((notification.link?.includes('notice=mood') ?? false) || (notification.header != null && /きもち|感情|気分|ムード|記録/.test(notification.header)))" :class="[$style.icon, $style.icon_hataskHeart]"><i class="ti ti-mood-smile"></i></div>
		<HataAppLogo v-else-if="notification.type === 'app' && !notification.icon && notification.header === 'Hatask'" app="hatask" :size="toast ? 32 : 42" :monochrome="store.r.darkMode.value" :class="$style.icon"/>
		<!-- 旗鯖fork: HataFeed 通知のアイコン (header='HataFeed' で判別) -->
		<HataAppLogo v-else-if="notification.type === 'hataFeed' || (notification.type === 'app' && !notification.icon && notification.header === 'HataFeed')" app="hatafeed" :size="toast ? 32 : 42" :monochrome="store.r.darkMode.value" :class="$style.icon"/>
		<!-- 旗鯖fork: 地震・津波情報の通知アイコン -->
		<div v-else-if="notification.type === 'earthquake'" :class="[$style.icon, $style.icon_earthquake]"><i class="ti ti-activity"></i></div>
		<div v-else-if="notification.type === 'hataskFlowerReady'" :class="[$style.icon, $style.icon_hataskFlower]"><i class="ti ti-flower"></i></div>
		<div v-else-if="notification.type === 'hataskFlowerBloomed'" :class="[$style.icon, $style.icon_hataskFlower]"><i class="ti ti-flower"></i></div>
		<div v-else-if="notification.type === 'hataskZukanUpdated'" :class="[$style.icon, $style.icon_hataskFlower]"><i class="ti ti-book"></i></div>
		<div v-else-if="notification.type === 'hataskFestivalBloomed'" :class="[$style.icon, $style.icon_hataskFlower]"><i class="ti ti-confetti"></i></div>
		<div v-else-if="notification.type === 'hataskDecorationUnlocked' && !notification.icon" :class="[$style.icon, $style.icon_hataskFlower]"><i class="ti ti-sparkles" aria-hidden="true"></i></div>
		<!-- 旗鯖fork: プライベートチャンネル メンバー追加/除外の通知アイコン -->
		<div v-else-if="notification.type === 'addedToPrivateChannel'" :class="[$style.icon, $style.icon_channelJoin]"><i class="ti ti-lock-square"></i></div>
		<div v-else-if="notification.type === 'removedFromPrivateChannel'" :class="[$style.icon, $style.icon_channelLeave]"><i class="ti ti-door-exit"></i></div>
		<img v-else-if="'icon' in notification && notification.icon != null" :class="[$style.icon, $style.icon_app]" :src="notification.icon" alt=""/>
		<span v-if="brand !== 'standard'" :class="$style.brandCorner" :data-brand="brand"><i :class="notification.type === 'hatady' ? hatadySubtypeIcon(notification.subtype) : brand === 'hatask' ? 'ti ti-flower' : 'ti ti-message-report'"></i></span>
		<div
			v-if="!toast || notification.type !== 'reaction'"
			:class="[$style.subIcon, {
				[$style.t_follow]: notification.type === 'follow',
				[$style.t_followRequestAccepted]: notification.type === 'followRequestAccepted',
				[$style.t_receiveFollowRequest]: notification.type === 'receiveFollowRequest',
				[$style.t_groupInvited]: notification.type === 'groupInvited',
				[$style.t_renote]: notification.type === 'renote',
				[$style.t_reply]: notification.type === 'reply',
				[$style.t_mention]: notification.type === 'mention',
				[$style.t_quote]: notification.type === 'quote',
				[$style.t_pollEnded]: notification.type === 'pollEnded',
				[$style.t_scheduledNotePosted]: notification.type === 'scheduledNotePosted',
				[$style.t_scheduledNotePostFailed]: notification.type === 'scheduledNotePostFailed',
				[$style.t_achievementEarned]: notification.type === 'achievementEarned',
				[$style.t_exportCompleted]: notification.type === 'exportCompleted',
				[$style.t_login]: notification.type === 'login',
				[$style.t_createToken]: notification.type === 'createToken',
				[$style.t_chatRoomInvitationReceived]: notification.type === 'chatRoomInvitationReceived',
				[$style.t_roleAssigned]: notification.type === 'roleAssigned' && notification.role.iconUrl == null,
				[$style.subIcon_reaction]: notification.type === 'reaction',
			}]"
		>
			<i v-if="notification.type === 'follow'" class="ti ti-plus"></i>
			<i v-else-if="notification.type === 'receiveFollowRequest'" class="ti ti-clock"></i>
			<i v-else-if="notification.type === 'followRequestAccepted'" class="ti ti-check"></i>
			<i v-else-if="notification.type === 'groupInvited'" class="ti ti-users-group"></i>
			<i v-else-if="notification.type === 'renote'" class="ti ti-repeat"></i>
			<i v-else-if="notification.type === 'reply'" class="ti ti-arrow-back-up"></i>
			<i v-else-if="notification.type === 'mention'" class="ti ti-at"></i>
			<i v-else-if="notification.type === 'quote'" class="ti ti-quote"></i>
			<i v-else-if="notification.type === 'pollEnded'" class="ti ti-chart-arrows"></i>
			<i v-else-if="notification.type === 'scheduledNotePosted'" class="ti ti-send"></i>
			<i v-else-if="notification.type === 'scheduledNotePostFailed'" class="ti ti-alert-triangle"></i>
			<i v-else-if="notification.type === 'achievementEarned'" class="ti ti-medal"></i>
			<i v-else-if="notification.type === 'exportCompleted'" class="ti ti-archive"></i>
			<i v-else-if="notification.type === 'login'" class="ti ti-login-2"></i>
			<i v-else-if="notification.type === 'createToken'" class="ti ti-key"></i>
			<i v-else-if="notification.type === 'chatRoomInvitationReceived'" class="ti ti-messages"></i>
			<template v-else-if="notification.type === 'roleAssigned'">
				<img v-if="notification.role.iconUrl" style="height: 1.3em; vertical-align: -22%; border-radius: 0.4em;" :src="notification.role.iconUrl" alt=""/>
				<i v-else class="ti ti-badges"></i>
			</template>
			<MkReactionIcon
				v-else-if="notification.type === 'reaction'"
				:withTooltip="true"
				:reaction="notification.reaction.replace(/^:(\w+):$/, ':$1@.:')"
				:noStyle="true"
				style="width: 100%; height: 100% !important; object-fit: contain;"
			/>
		</div>
	</div>
	<div :class="$style.tail">
		<header :class="$style.header">
			<span :class="$style.brandTag" :data-brand="brand" data-notification-brand-label>{{ i18n.ts._hata._notificationBrands[brand] }}</span>
			<span v-if="notification.type === 'pollEnded'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.pollEnded" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'scheduledNotePosted'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.scheduledNotePosted" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'scheduledNotePostFailed'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.scheduledNotePostFailed" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'note'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.newNote" :wrap="toast"/>: <MkUserName :nowrap="!toast" :user="notification.note.user"/></span>
			<span v-else-if="notification.type === 'roleAssigned'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.roleAssigned" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'chatRoomInvitationReceived'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.chatRoomInvitationReceived" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'achievementEarned'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.achievementEarned" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'login'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.login" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'createToken'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.createToken" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'test'" :class="$style.headerText"><MkNotificationText :text="i18n.ts._notification.testNotification" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'exportCompleted'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.exportOfXCompleted({ x: exportEntityName[notification.exportedEntity] })" :wrap="toast"/></span>
			<MkA v-else-if="notification.type === 'follow' || notification.type === 'mention' || notification.type === 'reply' || notification.type === 'renote' || notification.type === 'quote' || notification.type === 'reaction' || notification.type === 'receiveFollowRequest' || notification.type === 'followRequestAccepted'" v-user-preview="notification.user.id" :class="$style.headerName" :to="userPage(notification.user)"><MkUserName :nowrap="!toast" :user="notification.user"/></MkA>
			<button v-else-if="notification.type === 'hatady' && notification.user" type="button" :class="$style.hatadyUser" @click="void hatadyActions.openProfile(notification.user.id)"><MkUserName :nowrap="!toast" :user="notification.user"/></button>
			<span v-else-if="notification.type === 'hatady'" :class="$style.headerText"><HataAppWordmark app="hatady" inheritColor/></span>
			<I18n v-else-if="notification.type === 'groupInvited'" :class="$style.headerText" :src="i18n.ts._notification.youWereInvitedToGroup" textTag="span"><template #userName><MkUserName :nowrap="!toast" :user="notification.user"/></template></I18n>
			<span v-else-if="notification.type === 'reaction:grouped' && notification.note.reactionAcceptance === 'likeOnly'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.likedBySomeUsers({ n: getActualReactedUsersCount(notification) })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'reaction:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.reactedBySomeUsers({ n: getActualReactedUsersCount(notification) })" :wrap="toast"/></span>
			<!-- 旗鯖fork: 同じユーザーが複数ノートにリアクションしたグループ -->
			<MkA v-else-if="notification.type === 'reaction:groupedByUser'" v-user-preview="notification.user.id" :class="$style.headerName" :to="userPage(notification.user)"><MkUserName :nowrap="!toast" :user="notification.user"/></MkA>
			<span v-if="notification.type === 'reaction:groupedByUser'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.reactedToMultipleNotes({ n: notification.reactions.length })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'renote:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.renotedBySomeUsers({ n: notification.users.length })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'note:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.notedBySomeUsers({ n: notification.noteIds.length })" :wrap="toast"/></span>
			<span v-else-if="isCustomBodyNotification(notification) && (brand !== 'hataFeed' || customNotificationHeader(notification) !== 'HataFeed')" :class="$style.headerText"><HataAppWordmark v-if="customNotificationHeader(notification) === 'HataFeed'" app="hatafeed" inheritColor/><HataAppWordmark v-else-if="customNotificationHeader(notification) === 'Hatask'" app="hatask" inheritColor/><MkNotificationText v-else :text="customNotificationHeader(notification)" :wrap="toast"/></span>
			<MkTime v-if="withTime" :time="notification.createdAt" :class="$style.headerTime" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'"/>
		</header>
		<div :data-reaction-content="toast && notification.type === 'reaction'">
			<span v-if="toast && notification.type === 'reaction'" :class="$style.toastReaction" data-reaction-chip>
				<MkReactionIcon
					:reaction="notification.reaction.replace(/^:(\w+):$/, ':$1@.:')"
					:emojiUrl="notification.note.reactionEmojis?.[notification.reaction.slice(1, -1)]"
					:withTooltip="true"
				/>
			</span>
			<MkA v-if="notification.type === 'reaction' || notification.type === 'reaction:grouped'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<i class="ti ti-quote" :class="$style.quote"></i>
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
				<i class="ti ti-quote" :class="$style.quote"></i>
			</MkA>
			<MkA v-else-if="notification.type === 'renote' || notification.type === 'renote:grouped'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note.renote)">
				<i class="ti ti-quote" :class="$style.quote"></i>
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note.renote)" :plain="true" :nowrap="!toast" :author="notification.note.renote?.user" :emojiUrls="notification.note.renote?.emojis"/>
				<i class="ti ti-quote" :class="$style.quote"></i>
			</MkA>
			<MkA v-else-if="notification.type === 'reply'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
			</MkA>
			<MkA v-else-if="notification.type === 'mention'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
			</MkA>
			<MkA v-else-if="notification.type === 'quote'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
			</MkA>
			<MkA v-else-if="notification.type === 'note'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
			</MkA>
			<MkA v-else-if="notification.type === 'pollEnded'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<i class="ti ti-quote" :class="$style.quote"></i>
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
				<i class="ti ti-quote" :class="$style.quote"></i>
			</MkA>
			<MkA v-else-if="notification.type === 'scheduledNotePosted'" :class="$style.text" :to="notePage(notification.note)" :title="getNoteSummary(notification.note)">
				<i class="ti ti-quote" :class="$style.quote"></i>
				<Mfm :punctuationWrap="toast" :text="getNoteSummary(notification.note)" :plain="true" :nowrap="!toast" :author="notification.note.user" :emojiUrls="notification.note.emojis"/>
				<i class="ti ti-quote" :class="$style.quote"></i>
			</MkA>
			<div v-else-if="notification.type === 'roleAssigned'" :class="$style.text">
				{{ notification.role.name }}
			</div>
			<div v-else-if="notification.type === 'chatRoomInvitationReceived'" :class="$style.text">
				{{ notification.invitation.room.name }}
			</div>
			<MkA v-else-if="notification.type === 'achievementEarned'" :class="$style.text" to="/my/achievements">
				<MkNotificationText :text="i18n.ts._achievements._types['_' + notification.achievement].title" :wrap="toast"/>
			</MkA>
			<MkA v-else-if="notification.type === 'exportCompleted'" :class="$style.text" :to="`/my/drive/file/${notification.fileId}`">
				<MkNotificationText :text="i18n.ts.showFile" :wrap="toast"/>
			</MkA>
			<MkA v-else-if="notification.type === 'login'" :class="$style.text" to="/settings/security">
				<Mfm :punctuationWrap="toast" :text="i18n.tsx._notification.loginDescription({ ip: notification.ip, text: i18n.ts.regenerateLoginToken })"/>
			</MkA>
			<MkA v-else-if="notification.type === 'createToken'" :class="$style.text" to="/settings/apps">
				<Mfm :punctuationWrap="toast" :text="i18n.tsx._notification.createTokenDescription({ text: i18n.ts.manageAccessTokens })"/>
			</MkA>
			<template v-else-if="notification.type === 'follow'">
				<span :class="$style.text" style="opacity: 0.6;"><MkNotificationText :text="i18n.ts.youGotNewFollower" :wrap="toast"/></span>
				<div v-if="full"><MkFollowButton :user="notification.user" :full="true" :notificationInstanceName="instance.name || host" :disableIfFollowing="prefer.r.showFollowingMessageInsteadOfButtonEnabled.value"/></div>
			</template>
			<template v-else-if="notification.type === 'hatady'">
				<button type="button" :class="$style.hatadyContent" :disabled="!hatadyTargetAvailable(notification)" @click="openHatadyTarget(notification)">
					<span>{{ i18n.ts._hata._hatady._notification[notification.subtype] }}</span>
					<strong v-if="notification.title">{{ notification.title }}</strong>
					<MkReactionIcon v-if="notification.reaction" :reaction="notification.reaction"/>
				</button>
				<button v-if="full && notification.subtype === 'follow' && notification.user && notification.user.id !== $i.id" type="button" :class="$style.hatadyFollow" :disabled="hatadyFollowBusy || hatadyFollowing == null" @click="toggleHatadyFollow(notification.user.id)">
					{{ hatadyFollowing == null ? i18n.ts._hata._hatady._notification.unavailable : hatadyFollowing ? i18n.ts._hata._hatady._notification.followingAction : i18n.ts._hata._hatady._notification.followAction }}
				</button>
			</template>
			<template v-else-if="notification.type === 'followRequestAccepted'">
				<div :class="$style.text" style="opacity: 0.6;"><MkNotificationText :text="i18n.ts.followRequestAccepted" :wrap="toast"/></div>
				<div v-if="notification.message" :class="$style.text" style="opacity: 0.6; font-style: oblique;">
					<i class="ti ti-quote" :class="$style.quote"></i>
					<span><MkNotificationText :text="notification.message" :wrap="toast"/></span>
					<i class="ti ti-quote" :class="$style.quote"></i>
				</div>
			</template>
			<template v-else-if="notification.type === 'receiveFollowRequest'">
				<span :class="$style.text" style="opacity: 0.6;"><MkNotificationText :text="i18n.ts.receiveFollowRequest" :wrap="toast"/></span>
				<div v-if="full && !followRequestDone" :class="$style.followRequestCommands">
					<MkButton :class="$style.followRequestCommandButton" rounded primary @click="acceptFollowRequest()"><i class="ti ti-check"/> <MkNotificationText :text="i18n.ts.accept" :wrap="toast"/></MkButton>
					<MkButton :class="$style.followRequestCommandButton" rounded danger @click="rejectFollowRequest()"><i class="ti ti-x"/> <MkNotificationText :text="i18n.ts.reject" :wrap="toast"/></MkButton>
				</div>
			</template>
			<template v-else-if="notification.type === 'groupInvited'">
				<span style="font-weight: bold;">{{ notification.invitation.group.name }}</span>
				<div v-if="full && !groupInviteDone" :class="$style.followRequestCommands">
					<MkButton :class="$style.followRequestCommandButton" rounded primary @click="acceptGroupInvitation()"><i class="ti ti-check"/> <MkNotificationText :text="i18n.ts.accept" :wrap="toast"/></MkButton>
					<MkButton :class="$style.followRequestCommandButton" rounded danger @click="rejectGroupInvitation()"><i class="ti ti-x"/> <MkNotificationText :text="i18n.ts.reject" :wrap="toast"/></MkButton>
				</div>
			</template>
			<template v-else-if="notification.type === 'addedToPrivateChannel' && notification.invitationId">
				<Mfm :punctuationWrap="toast" :text="customNotificationBody(notification)" :nowrap="false"/>
				<div v-if="full && privateChannelInviteResult == null" :class="$style.followRequestCommands">
					<MkButton :class="$style.followRequestCommandButton" rounded primary @click="acceptPrivateChannelInvitation(notification.invitationId)"><i class="ti ti-check"/> <MkNotificationText :text="i18n.ts._hata._privateChannels.join" :wrap="toast"/></MkButton>
					<MkButton :class="$style.followRequestCommandButton" rounded danger @click="rejectPrivateChannelInvitation(notification.invitationId)"><i class="ti ti-x"/> <MkNotificationText :text="i18n.ts._hata._privateChannels.decline" :wrap="toast"/></MkButton>
				</div>
				<div v-else-if="privateChannelInviteResult === 'accepted'" :class="$style.invitationResult">
					<i class="ti ti-circle-check"></i> <MkNotificationText :text="i18n.ts._hata._privateChannels.joinedResult" :wrap="toast"/>
					<MkA v-if="acceptedPrivateChannelId" :to="`/channels/${acceptedPrivateChannelId}`"><MkNotificationText :text="i18n.ts._hata._privateChannels.openChannel" :wrap="toast"/></MkA>
				</div>
				<div v-else-if="privateChannelInviteResult === 'rejected'" :class="$style.invitationResult"><i class="ti ti-circle-x"></i> <MkNotificationText :text="i18n.ts._hata._privateChannels.declinedResult" :wrap="toast"/></div>
			</template>
			<span v-else-if="notification.type === 'test'" :class="$style.text"><MkNotificationText :text="i18n.ts._notification.notificationWillBeDisplayedLikeThis" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'app' || notification.type === 'hataFeed' || notification.type === 'hataskFlowerReady' || notification.type === 'hataskFlowerBloomed' || notification.type === 'hataskZukanUpdated' || notification.type === 'hataskFestivalBloomed' || notification.type === 'hataskDecorationUnlocked' || notification.type === 'earthquake' || notification.type === 'addedToPrivateChannel' || notification.type === 'removedFromPrivateChannel'" :class="$style.text" data-notification-body>
				<!-- 旗鯖fork: notification.link があればクリックで該当画面に遷移 (hatask/HataFeed 等の旗鯖独自機能向け) -->
				<MkA v-if="notification.link" :to="notification.link" :class="$style.appLink" data-notification-body-link>
					<HataFeedNotificationBody v-if="isHataFeedNotification(notification)" :punctuationWrap="toast" :text="customNotificationBody(notification)"/>
					<Mfm v-else :punctuationWrap="toast" :text="customNotificationBody(notification)" :nowrap="false"/>
				</MkA>
				<HataFeedNotificationBody v-else-if="isHataFeedNotification(notification)" :punctuationWrap="toast" :text="customNotificationBody(notification)"/>
				<Mfm v-else :punctuationWrap="toast" :text="customNotificationBody(notification)" :nowrap="false"/>
			</span>

			<div v-if="notification.type === 'reaction:grouped'">
				<div v-for="reaction of notification.reactions" :key="reaction.user.id + reaction.reaction" :class="$style.reactionsItem">
					<MkAvatar :class="$style.reactionsItemAvatar" :user="reaction.user" link preview/>
					<div :class="$style.reactionsItemReaction">
						<MkReactionIcon
							:withTooltip="true"
							:reaction="reaction.reaction.replace(/^:(\w+):$/, ':$1@.:')"
							:noStyle="true"
							style="width: 100%; height: 100% !important; object-fit: contain;"
						/>
					</div>
				</div>
			</div>
			<!-- 旗鯖fork: 同じユーザーから複数ノートへのリアクションをコンパクトに一覧表示 -->
			<div v-else-if="notification.type === 'reaction:groupedByUser'" :class="$style.groupedByUserList">
				<MkA v-for="(reaction, idx) of notification.reactions" :key="reaction.note.id + idx" :class="$style.groupedByUserItem" :to="notePage(reaction.note)" :title="getNoteSummary(reaction.note)">
					<div :class="$style.groupedByUserReactionWrap">
						<MkReactionIcon
							:withTooltip="true"
							:reaction="reaction.reaction.replace(/^:(\w+):$/, ':$1@.:')"
							:noStyle="true"
							style="width: 100%; height: 100% !important; object-fit: contain;"
						/>
					</div>
					<span :class="$style.groupedByUserNoteSummary">
						<Mfm :punctuationWrap="toast" :text="getNoteSummary(reaction.note)" :plain="true" :nowrap="!toast" :author="reaction.note.user" :emojiUrls="reaction.note.emojis"/>
					</span>
				</MkA>
			</div>
			<div v-else-if="notification.type === 'renote:grouped'">
				<div v-for="user of notification.users" :key="user.id" :class="$style.reactionsItem">
					<MkAvatar :class="$style.reactionsItemAvatar" :user="user" link preview/>
				</div>
			</div>
			<div v-else-if="notification.type === 'note:grouped'">
				<div v-for="user of notification.users" :key="user.id" :class="$style.reactionsItem">
					<MkAvatar :class="$style.reactionsItemAvatar" :user="user" link preview/>
				</div>
			</div>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MkNotificationText from '@/components/MkNotificationText.js';
import * as Misskey from 'cherrypick-js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import MkButton from '@/components/MkButton.vue';
import HataFeedNotificationBody from '@/components/HataFeedNotificationBody.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { store } from '@/store.js';
import { getNoteSummary } from '@/utility/get-note-summary.js';
import { notePage } from '@@/js/note.js';
import { userPage } from '@/filters/user.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { ensureSignin } from '@/i.js';
import { prefer } from '@/preferences.js';
import { NOTIFICATION_FILTER_POLICY_NOTICE_ID } from '@/utility/notification-filter.js';
import { hataFeedNotificationDisplayBody } from '@/utility/hatafeed-bell-group.js';
import { privateChannelNotificationDisplayBody } from '@/utility/private-channel-notification-copy.js';
import { versatileLang } from '@/utility/intl-const.js';
import { notificationBrand } from '@/utility/notification-brand.js';
import { useHatadyActivityActions } from '@/utility/hatady-activity-actions.js';
import { instance } from '@/instance.js';
import { host } from '@@/js/config.js';
import * as os from '@/os.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { confirmHatadyAction } from '@/utility/hatady-record-delete.js';
import { miLocalStorage } from '@/local-storage.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const $i = ensureSignin();

const props = withDefaults(defineProps<{
	notification: Misskey.entities.Notification;
	withTime?: boolean;
	full?: boolean;
	toast?: boolean;
	contentVisibilityAuto?: boolean;
}>(), {
	withTime: false,
	full: false,
	toast: false,
	contentVisibilityAuto: true,
});

type HatadyNotification = Extract<Misskey.entities.Notification, { type: 'hatady' }>;
const brand = computed(() => notificationBrand(props.notification));
const currentUi = miLocalStorage.getItem('ui');
const hatadyVariant: HatadySurfaceVariant = currentUi === 'hataskey3' ? 'uis' : currentUi === 'simple' ? 'ui' : 'hatady';
const hatadyActions = useHatadyActivityActions({ variant: hatadyVariant });
const hatadyFollowing = ref<boolean | null>(null);
const hatadyFollowBusy = ref(false);
let followRequest = 0;

async function loadHatadyFollowing() {
	const request = ++followRequest;
	const notification = props.notification;
	if (notification.type !== 'hatady' || notification.subtype !== 'follow' || !props.full || !notification.user) return;
	hatadyFollowing.value = null;
	try {
		const profile = await misskeyApi('hata/hatady/users/show', { userId: notification.user.id }) as { isFollowing?: boolean };
		if (request === followRequest) hatadyFollowing.value = typeof profile.isFollowing === 'boolean' ? profile.isFollowing : null;
	} catch {
		if (request === followRequest) hatadyFollowing.value = null;
	}
}

onMounted(() => { void loadHatadyFollowing(); });
watch(() => [props.notification.id, props.full, props.notification.type === 'hatady' ? props.notification.user?.id : null], () => {
	hatadyFollowBusy.value = false;
	void loadHatadyFollowing();
});

async function toggleHatadyFollow(userId: string) {
	if (hatadyFollowing.value == null || hatadyFollowBusy.value) return;
	const notification = props.notification;
	if (notification.type !== 'hatady' || !notification.user || notification.user.id !== userId) return;
	const notificationId = notification.id;
	const request = followRequest;
	const wasFollowing = hatadyFollowing.value;
	hatadyFollowBusy.value = true;
	const name = notification.user.name || notification.user.username;
	const copy = i18n.tsx._hata._hatady._notifications;
	try {
		const confirmed = await confirmHatadyAction(hatadyVariant, wasFollowing ? copy.unfollowConfirm({ name }) : copy.followConfirm({ name }), wasFollowing ? 'warning' : 'question');
		if (!confirmed || request !== followRequest || props.notification.id !== notificationId || props.notification.type !== 'hatady' || props.notification.user?.id !== userId) return;
		const next = !wasFollowing;
		await misskeyApi(next ? 'hata/hatady/following/create' : 'hata/hatady/following/delete', { userId });
		if (request === followRequest && props.notification.id === notificationId && props.notification.type === 'hatady' && props.notification.user?.id === userId) hatadyFollowing.value = next;
	} catch {
		hatadyNotify(i18n.ts._hata._hatady._profileView.followFailed);
	} finally {
		if (request === followRequest && props.notification.id === notificationId) hatadyFollowBusy.value = false;
	}
}

function hatadySubtypeIcon(subtype: HatadyNotification['subtype']): string {
	if (subtype === 'follow') return 'ti ti-user-plus';
	if (subtype === 'reaction' || subtype === 'mediaReaction') return 'ti ti-heart';
	if (subtype === 'milestone') return 'ti ti-flame';
	if (subtype === 'goalDone') return 'ti ti-target-arrow';
	return 'ti ti-message-circle-2';
}

function hatadyTargetAvailable(notification: HatadyNotification): boolean {
	return Boolean(notification.logId || notification.mediaSessionId || notification.mediaWorkId
		|| (notification.targetType === 'log' || notification.targetType === 'session' || notification.targetType === 'work') && notification.targetId
		|| notification.subtype === 'follow' && notification.user);
}

function openHatadyTarget(notification: HatadyNotification) {
	if (notification.logId) void hatadyActions.openConversation(notification.logId);
	else if (notification.mediaSessionId) void hatadyActions.openSession(notification.mediaSessionId, notification.mediaWorkId);
	else if (notification.mediaWorkId) void hatadyActions.openMediaDetailById(notification.mediaWorkId);
	else if (notification.subtype === 'follow' && notification.user) void hatadyActions.openProfile(notification.user.id);
	else if (notification.targetType === 'log' && notification.targetId) void hatadyActions.openConversation(notification.targetId);
	else if (notification.targetType === 'session' && notification.targetId) void hatadyActions.openSession(notification.targetId);
	else if (notification.targetType === 'work' && notification.targetId) void hatadyActions.openMediaDetailById(notification.targetId);
}

type ExportCompletedNotification = Misskey.entities.Notification & { type: 'exportCompleted' };

const exportEntityName = {
	antenna: i18n.ts.antennas,
	blocking: i18n.ts.blockedUsers,
	clip: i18n.ts.clips,
	customEmoji: i18n.ts.customEmojis,
	favorite: i18n.ts.favorites,
	following: i18n.ts.following,
	muting: i18n.ts.mutedUsers,
	note: i18n.ts.notes,
	userList: i18n.ts.lists,
} as const satisfies Record<ExportCompletedNotification['exportedEntity'], string>;

const followRequestDone = ref(false);
const groupInviteDone = ref(false);
const privateChannelInviteResult = ref<'accepted' | 'rejected' | null>(null);
const acceptedPrivateChannelId = ref<string | null>(null);
const japaneseCustomNotification = versatileLang.toLowerCase().startsWith('ja');

type CustomBodyNotification = Extract<Misskey.entities.Notification, { type: 'app' | 'hataFeed' | 'hataskFlowerReady' | 'hataskFlowerBloomed' | 'hataskZukanUpdated' | 'hataskFestivalBloomed' | 'hataskDecorationUnlocked' | 'earthquake' | 'addedToPrivateChannel' | 'removedFromPrivateChannel' }>;

function isCustomBodyNotification(notification: Misskey.entities.Notification): notification is CustomBodyNotification {
	return notification.type === 'app'
		|| notification.type === 'hataFeed'
		|| notification.type === 'hataskFlowerReady'
		|| notification.type === 'hataskFlowerBloomed'
		|| notification.type === 'hataskZukanUpdated'
		|| notification.type === 'hataskFestivalBloomed'
		|| notification.type === 'hataskDecorationUnlocked'
		|| notification.type === 'earthquake'
		|| notification.type === 'addedToPrivateChannel'
		|| notification.type === 'removedFromPrivateChannel';
}

function isHataFeedNotification(notification: Misskey.entities.Notification): boolean {
	return notification.type === 'hataFeed' || (notification.type === 'app' && notification.header === 'HataFeed');
}

function customNotificationHeader(notification: Misskey.entities.Notification): string {
	if (notification.type === 'hataskFlowerReady') return i18n.ts._notification._types.hataskFlowerReady;
	if (notification.type === 'hataskFlowerBloomed') return i18n.ts._notification._types.hataskFlowerBloomed;
	if (notification.type === 'hataskZukanUpdated') return i18n.ts._notification._types.hataskZukanUpdated;
	if (notification.type === 'hataskFestivalBloomed') return i18n.ts._notification._types.hataskFestivalBloomed;
	if (!isCustomBodyNotification(notification)) return '';
	if (japaneseCustomNotification || notification.type === 'app' || notification.type === 'hataskDecorationUnlocked' || notification.type === 'earthquake') return notification.header ?? '';
	if (notification.type === 'hataFeed') return 'HataFeed';
	if (notification.type === 'addedToPrivateChannel') {
		return notification.invitationId
			? i18n.ts._hata._privateChannels.invitationNotificationHeader
			: i18n.ts._hata._privateChannels.addedNotificationHeader;
	}
	return i18n.ts._hata._privateChannels.removedNotificationHeader;
}

function customNotificationBody(notification: Misskey.entities.Notification): string {
	if (notification.type === 'hataskFlowerReady') return i18n.ts._hata._customNotifications.flowerReady;
	if (notification.type === 'hataskFlowerBloomed') return i18n.ts._hata._customNotifications.flowerBloomed;
	if (notification.type === 'hataskZukanUpdated') return i18n.ts._hata._customNotifications.zukanUpdated;
	if (notification.type === 'hataskFestivalBloomed') return i18n.ts._hata._customNotifications.festivalBloomed;
	if (!isCustomBodyNotification(notification)) return '';
	if (notification.type === 'hataFeed' || (notification.type === 'app' && notification.header === 'HataFeed')) {
		return hataFeedNotificationDisplayBody(notification.body);
	}
	if (japaneseCustomNotification || notification.type === 'app' || notification.type === 'hataskDecorationUnlocked' || notification.type === 'earthquake') return notification.body;
	return privateChannelNotificationDisplayBody(notification.body);
}

const acceptFollowRequest = () => {
	if (!('user' in props.notification) || !props.notification.user) return;
	followRequestDone.value = true;
	misskeyApi('following/requests/accept', { userId: props.notification.user.id });
};

const rejectFollowRequest = () => {
	if (!('user' in props.notification) || !props.notification.user) return;
	followRequestDone.value = true;
	misskeyApi('following/requests/reject', { userId: props.notification.user.id });
};

function getActualReactedUsersCount(notification: Misskey.entities.Notification) {
	if (notification.type !== 'reaction:grouped') return 0;
	return new Set(notification.reactions.map((reaction) => reaction.user.id)).size;
}

const acceptGroupInvitation = () => {
	if (props.notification.type !== 'groupInvited') return;
	groupInviteDone.value = true;
	misskeyApi('users/groups/invitations/accept', { invitationId: props.notification.invitation.id });
};

const rejectGroupInvitation = () => {
	if (props.notification.type !== 'groupInvited') return;
	groupInviteDone.value = true;
	misskeyApi('users/groups/invitations/reject', { invitationId: props.notification.invitation.id });
};

async function acceptPrivateChannelInvitation(invitationId: string) {
	const result = await misskeyApi('channels/invitations/accept', { invitationId });
	acceptedPrivateChannelId.value = result.channelId;
	privateChannelInviteResult.value = 'accepted';
}

async function rejectPrivateChannelInvitation(invitationId: string) {
	await misskeyApi('channels/invitations/reject', { invitationId });
	privateChannelInviteResult.value = 'rejected';
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	box-sizing: border-box;
	padding: 24px 32px;
	font-size: 0.9em;
	overflow-wrap: break-word;
	display: flex;
	contain: content;

	&[data-content-visibility-auto='true'] {
		content-visibility: auto;
		contain-intrinsic-size: 0 100px;
	}

	--eventFollow: #36aed2;
	--eventRenote: #36d298;
	--eventReply: #007aff;
	--eventReactionHeart: var(--MI_THEME-love);
	--eventReaction: #e99a0b;
	--eventAchievement: #cb9a11;
	--eventLogin: #007aff;
	--eventOther: #88a6b7;
}

.root[data-notification-brand='hatady']:not([data-toast='true']) {
	background: color-mix(in srgb, #a9d8bd 13%, var(--MI_THEME-panel));
}
.root[data-notification-brand='hataFeed']:not([data-toast='true']) {
	background: color-mix(in srgb, #8fc0ff 13%, var(--MI_THEME-panel));
}
.root[data-notification-brand='hatask']:not([data-toast='true']) {
	background: color-mix(in srgb, #f4c874 12%, var(--MI_THEME-panel));
}
:global(html[data-color-scheme=light]) .root[data-notification-brand='hataFeed']:not([data-toast='true']) {
	background: color-mix(in srgb, #2e62a8 9%, var(--MI_THEME-panel));
}
.brandTag {
	display: inline-flex;
	align-items: center;
	margin-right: 8px;
	padding: 2px 7px;
	border-radius: 999px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-fg);
	font-size: 11px;
	font-weight: 700;
}
.brandTag[data-brand='hatady'] { color: #a9d8bd; }
.brandTag[data-brand='hataFeed'] { color: #8fc0ff; }
.brandTag[data-brand='hatask'] { color: #f4c874; }
:global(html[data-color-scheme=light]) .brandTag[data-brand='hataFeed'] { color: #2e62a8; }
.icon_hatady {
	display: grid;
	place-items: center;
	background: #a9d8bd;
	color: #17302a;
	border-radius: 50%;
}
.brandCorner {
	position: absolute;
	right: -5px;
	bottom: -5px;
	display: grid;
	place-items: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #a9d8bd;
	color: #17302a;
	font-size: 12px;
}
.brandCorner[data-brand='hataFeed'] { background: #8fc0ff; color: #1b2d43; }
.brandCorner[data-brand='hatask'] { background: #f4c874; color: #322713; }
:global(html[data-color-scheme=light]) .brandCorner[data-brand='hataFeed'] { background: #2e62a8; color: #fff; }
.hatadyAvatarButton {
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: transparent;
	cursor: pointer;
}
.hatadyUser {
	padding: 0;
	border: 0;
	background: none;
	color: inherit;
	font-weight: 700;
	cursor: pointer;
}
.hatadyContent {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	padding: 4px 0;
	border: 0;
	background: none;
	color: inherit;
	text-align: left;
	cursor: pointer;
}
.hatadyContent strong { font-weight: 700; }
.hatadyContent:disabled { cursor: default; }
.hatadyFollow {
	margin-top: 8px;
	padding: 6px 12px;
	border: 1px solid currentColor;
	border-radius: 999px;
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.hatadyFollow:disabled { opacity: .5; cursor: default; }

/* 旗鯖fork(Hataskey UI 2): 通知カラム内の XNotification (reply/quote/mention 以外) にも
   --htk-glass-card-opacity を反映してカード面をガラス化。MkNote と同じ計算式。
   ダーク/ライトで accent tint 濃度を出し分け。 */
:global(html.hataGlassUi) .root:not([data-toast='true']) {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 18%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
	-webkit-backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
	backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
}
:global(html[data-color-scheme=light].hataGlassUi) .root:not([data-toast='true']) {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
}

:global(html.hataGlassUi) .root[data-notification-brand='hatady']:not([data-toast='true']) {
	background: color-mix(in srgb, color-mix(in srgb, #a9d8bd 18%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}
:global(html.hataGlassUi) .root[data-notification-brand='hataFeed']:not([data-toast='true']) {
	background: color-mix(in srgb, color-mix(in srgb, #8fc0ff 18%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}
:global(html.hataGlassUi) .root[data-notification-brand='hatask']:not([data-toast='true']) {
	background: color-mix(in srgb, color-mix(in srgb, #f4c874 18%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}
:global(html[data-color-scheme=light].hataGlassUi) .root[data-notification-brand='hataFeed']:not([data-toast='true']) {
	background: color-mix(in srgb, color-mix(in srgb, #2e62a8 8%, var(--MI_THEME-panel)) var(--htk-glass-card-opacity, 55%), transparent);
}

.root[data-toast='true'] {
	padding:0; font-size:12px; line-height:1.5; align-items:center;
	background:transparent; backdrop-filter:none; -webkit-backdrop-filter:none;
	contain:none; overflow:visible; word-break:keep-all; line-break:strict; overflow-wrap:anywhere;
	.head { position:relative; top:auto; width:32px; height:32px; margin:6px 17px 6px 4px; }
	.header, .headerName, .headerText { display:inline; white-space:normal; word-break:keep-all; overflow-wrap:anywhere; }
	.header { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; font-weight:600; }
	.tail > div { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
	.text { display:block; opacity:.76; }
	.appLink { margin:0; padding:0; }
	.quote { display:none; }
	.tail > div[data-reaction-content='true'] {
		display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; margin-top:5px;
		-webkit-line-clamp:unset; overflow:visible;
		> .text {
			flex:1 1 120px; min-width:0; width:auto; padding-left:8px;
			border-left:2px solid var(--MI_THEME-divider);
			display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
		}
	}
}
/* リアクションは本文側に置き、横長の絵文字でもアバターを覆わない。 */
.toastReaction {
	display:inline-flex; align-items:center; justify-content:center; flex:0 1 auto;
	box-sizing:border-box; min-width:36px; max-width:min(108px,100%); min-height:32px; padding:4px 6px;
	border:1px solid color-mix(in srgb,var(--MI_THEME-accent) 22%,transparent); border-radius:8px;
	background:var(--MI_THEME-accentedBg); color:var(--MI_THEME-fg); font-size:22px; line-height:1;
	img { display:block; width:auto; height:24px; max-width:100%; object-fit:contain; }
}
.head {
	position: sticky;
	top: 0;
	flex-shrink: 0;
	width: 42px;
	height: 42px;
	margin-right: 8px;
}

.icon {
	display: block;
	width: 100%;
	height: 100%;
}

.icon_reactionGroup,
.icon_reactionGroupHeart,
.icon_renoteGroup,
.icon_noteGroup,
.icon_hataskFlower,
.icon_hataskCalendar,
.icon_hataskHeart,
.icon_hatafeed {
	display: grid;
	align-items: center;
	justify-items: center;
	width: 80%;
	height: 80%;
	font-size: 15px;
	border-radius: 100%;
	color: #fff;
}

.icon_filterPolicy {
	display: grid;
	align-items: center;
	justify-items: center;
	width: 100%;
	height: 100%;
	border-radius: 100%;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-size: 20px;
}

.icon_registrationApplication {
	display: grid;
	place-items: center;
	width: 100%;
	height: 100%;
	border-radius: 100%;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-size: 22px;
	line-height: 1;
}

.icon_reactionGroup {
	background: var(--eventReaction);
}

.icon_reactionGroupHeart {
	background: var(--eventReactionHeart);
}

.icon_renoteGroup {
	background: var(--eventRenote);
}

.icon_noteGroup {
	background: var(--eventRenote);
}

/* 旗鯖fork: hatask 通知の文字アイコン。
   グループ通知系の共通定義(80%サイズ)を上書きして、アバター付き通知と同じ円サイズ(100%)に揃える。
   背景円が大きくなった分、絵文字/文字も大きめに調整する。 */
.icon_hataskFlower {
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

.icon_hataskCalendar {
	background: var(--MI_THEME-accent);
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

.icon_hataskHeart {
	background: var(--eventReactionHeart);
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

/* 旗鯖fork: HataFeed 通知の文字アイコン。 */
.icon_hatafeed {
	background: var(--MI_THEME-accent);
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

/* 旗鯖fork: 地震・津波情報の通知アイコン。 */
.icon_earthquake {
	display: grid;
	align-items: center;
	justify-items: center;
	border-radius: 100%;
	color: #fff;
	background: #c0392b;
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

/* 旗鯖fork: プライベートチャンネル メンバー追加 (加入) アイコン */
.icon_channelJoin {
	display: grid;
	align-items: center;
	justify-items: center;
	border-radius: 100%;
	color: #fff;
	background: #5a2bc0;
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

/* 旗鯖fork: プライベートチャンネル メンバー除外 (脱退) アイコン */
.icon_channelLeave {
	display: grid;
	align-items: center;
	justify-items: center;
	border-radius: 100%;
	color: #fff;
	background: #7f8c8d;
	width: 100%;
	height: 100%;
	font-size: 22px;
	line-height: 1;
}

.icon_app {
	border-radius: 6px;
}

.subIcon {
	position: absolute;
	z-index: 1;
	bottom: -2px;
	right: -2px;
	width: 20px;
	height: 20px;
	line-height: 20px;
	box-sizing: border-box;
	border-radius: 100%;
	background: var(--MI_THEME-panel);
	box-shadow: 0 0 0 3px var(--MI_THEME-panel);
	font-size: 11px;
	text-align: center;
	color: #fff;

	&:empty {
		display: none;
	}
}

/* 旗鯖fork: リアクション(特に横長カスタム絵文字)を潰さず表示するための専用バリアント */
.subIcon_reaction {
	width: auto;
	min-width: 20px;
	max-width: 60px;
	height: 20px;
	padding: 0 2px;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;

	img, :global(.mfm-emoji) {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
}

.t_follow, .t_followRequestAccepted, .t_receiveFollowRequest, .t_groupInvited {
	background: var(--eventFollow);
	pointer-events: none;
}

.invitationResult {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 8px;
	font-weight: 700;
	color: var(--MI_THEME-accent);
}

.t_renote {
	background: var(--eventRenote);
	pointer-events: none;
}

.t_quote {
	background: var(--eventRenote);
	pointer-events: none;
}

.t_reply {
	background: var(--eventReply);
	pointer-events: none;
}

.t_mention {
	background: var(--eventOther);
	pointer-events: none;
}

.t_pollEnded {
	background: var(--eventOther);
	pointer-events: none;
}

.t_scheduledNotePosted {
	background: var(--eventOther);
	pointer-events: none;
}

.t_scheduledNotePostFailed {
	background: var(--eventOther);
	pointer-events: none;
}

.t_achievementEarned {
	background: var(--eventAchievement);
	pointer-events: none;
}

.t_exportCompleted {
	background: var(--eventOther);
	pointer-events: none;
}

.t_roleAssigned {
	background: var(--eventOther);
	pointer-events: none;
}

.t_login {
	background: var(--eventLogin);
	pointer-events: none;
}

.t_createToken {
	background: var(--eventOther);
	pointer-events: none;
}

.t_chatRoomInvitationReceived {
	background: var(--eventOther);
	pointer-events: none;
}

.tail {
	flex: 1;
	min-width: 0;
}

.header {
	display: flex;
	align-items: baseline;
	white-space: nowrap;
}

.headerName {
	text-overflow: ellipsis;
	white-space: nowrap;
	min-width: 0;
	overflow: hidden;
}

.headerTime {
	margin-left: auto;
	font-size: 0.9em;
}

.headerText {
	display: block;
	white-space: normal;
	word-break: break-word;
	overflow-wrap: break-word;
}

.text {
	display: flex;
	width: 100%;
	overflow: clip;
	opacity: 0.7;
}

/* 旗鯖fork: hatask 等の通知でクリック可能リンク (notification.link あり) のスタイル */
.appLink {
	display: block;
	width: 100%;
	color: inherit;
	text-decoration: none;
	cursor: pointer;
	border-radius: 4px;
	padding: 2px 4px;
	margin: -2px -4px;
	transition: background 0.15s;

	&:hover {
		background: var(--MI_THEME-accentedBg);
		opacity: 1;
	}
}

.quote {
	vertical-align: super;
	font-size: 50%;
	opacity: 0.5;
}

/* 旗鯖fork: 同じユーザーから複数ノートへのリアクション一覧 (reaction:groupedByUser 用) */
.groupedByUserList {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-top: 4px;
}

.groupedByUserItem {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 8px;
	border-radius: 8px;
	color: inherit;
	text-decoration: none;
	transition: background 0.15s;
	min-width: 0;

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}
}

.groupedByUserReactionWrap {
	flex: 0 0 auto;
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.groupedByUserNoteSummary {
	flex: 1 1 auto;
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 0.9em;
	opacity: 0.8;
}

.quote:first-child {
	margin-right: 4px;
	position: relative;

	&::before {
		position: absolute;
		transform: rotate(180deg);
	}
}

.quote:last-child {
	margin-left: 4px;
}

.followRequestCommands {
	display: flex;
	gap: 8px;
	max-width: 300px;
	margin-top: 8px;
}
.followRequestCommandButton {
	flex: 1;
}

.reactionsItem {
	display: inline-block;
	position: relative;
	width: 38px;
	height: 38px;
	margin-top: 8px;
	margin-right: 8px;
}

.reactionsItemAvatar {
	width: 100%;
	height: 100%;
}

.reactionsItemReaction {
	position: absolute;
	z-index: 1;
	bottom: -2px;
	right: -2px;
	/* 旗鯖fork: 横長カスタム絵文字を潰さず表示するため、円形→角丸長方形、width auto */
	width: auto;
	min-width: 20px;
	max-width: 60px;
	height: 20px;
	padding: 0 2px;
	box-sizing: border-box;
	border-radius: 6px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 0 0 3px var(--MI_THEME-panel);
	font-size: 11px;
	text-align: center;
	color: #fff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;

	img, :global(.mfm-emoji) {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
}

@container (max-width: 600px) {
	.root {
		padding: 16px;
		font-size: 0.9em;
	}
}

@container (max-width: 500px) {
	.root {
		padding: 12px;
		font-size: 0.85em;
	}
}
</style>
