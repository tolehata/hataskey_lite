<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :data-content-visibility-auto="contentVisibilityAuto" :data-toast="toast">
	<div :class="$style.head">
		<MkAvatar v-if="['pollEnded', 'note'].includes(notification.type) && 'note' in notification" :class="$style.icon" :user="notification.note.user" link preview/>
		<MkAvatar v-else-if="['roleAssigned', 'achievementEarned', 'exportCompleted', 'login', 'createToken', 'scheduledNotePosted', 'scheduledNotePostFailed'].includes(notification.type)" :class="$style.icon" :user="$i" link preview/>
		<div v-else-if="notification.type === 'reaction:grouped' && notification.note.reactionAcceptance === 'likeOnly'" :class="[$style.icon, $style.icon_reactionGroupHeart]"><i class="ti ti-heart" style="line-height: 1;"></i></div>
		<div v-else-if="notification.type === 'reaction:grouped'" :class="[$style.icon, $style.icon_reactionGroup]"><i class="ti ti-plus" style="line-height: 1;"></i></div>
		<!-- 旗鯖fork: reaction:groupedByUser はそのユーザーのアバターを表示 -->
		<MkAvatar v-else-if="notification.type === 'reaction:groupedByUser'" :class="$style.icon" :user="notification.user" link preview/>
		<div v-else-if="notification.type === 'renote:grouped'" :class="[$style.icon, $style.icon_renoteGroup]"><i class="ti ti-repeat" style="line-height: 1;"></i></div>
		<div v-else-if="notification.type === 'note:grouped'" :class="[$style.icon, $style.icon_noteGroup]"><i class="ti ti-pencil" style="line-height: 1;"></i></div>
		<MkAvatar v-else-if="'user' in notification" :class="$style.icon" :user="notification.user" link preview/>
		<div v-else-if="notification.type === 'app' && notification.id === NOTIFICATION_FILTER_POLICY_NOTICE_ID" :class="[$style.icon, $style.icon_filterPolicy]"><i class="ti ti-filter-cog"></i></div>
		<div v-else-if="notification.type === 'app' && notification.link === '/admin/registration-applications' && notification.icon == null" :class="[$style.icon, $style.icon_registrationApplication]"><i class="ti ti-user-plus" aria-hidden="true"></i></div>
		<img v-else-if="'icon' in notification && notification.icon != null" :class="[$style.icon, $style.icon_app]" :src="notification.icon" alt=""/>
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
			<I18n v-else-if="notification.type === 'groupInvited'" :class="$style.headerText" :src="i18n.ts._notification.youWereInvitedToGroup" textTag="span"><template #userName><MkUserName :nowrap="!toast" :user="notification.user"/></template></I18n>
			<span v-else-if="notification.type === 'reaction:grouped' && notification.note.reactionAcceptance === 'likeOnly'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.likedBySomeUsers({ n: getActualReactedUsersCount(notification) })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'reaction:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.reactedBySomeUsers({ n: getActualReactedUsersCount(notification) })" :wrap="toast"/></span>
			<!-- 旗鯖fork: 同じユーザーが複数ノートにリアクションしたグループ -->
			<MkA v-else-if="notification.type === 'reaction:groupedByUser'" v-user-preview="notification.user.id" :class="$style.headerName" :to="userPage(notification.user)"><MkUserName :nowrap="!toast" :user="notification.user"/></MkA>
			<span v-if="notification.type === 'reaction:groupedByUser'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.reactedToMultipleNotes({ n: notification.reactions.length })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'renote:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.renotedBySomeUsers({ n: notification.users.length })" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'note:grouped'" :class="$style.headerText"><MkNotificationText :text="i18n.tsx._notification.notedBySomeUsers({ n: notification.noteIds.length })" :wrap="toast"/></span>
			<span v-else-if="isCustomBodyNotification(notification)" :class="$style.headerText"><MkNotificationText :text="customNotificationHeader(notification)" :wrap="toast"/></span>
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
			<span v-else-if="notification.type === 'test'" :class="$style.text"><MkNotificationText :text="i18n.ts._notification.notificationWillBeDisplayedLikeThis" :wrap="toast"/></span>
			<span v-else-if="notification.type === 'app'" :class="$style.text" data-notification-body>
				<!-- 旗鯖fork: notification.link があればクリックで該当画面に遷移 -->
				<MkA v-if="notification.link" :to="notification.link" :class="$style.appLink" data-notification-body-link>
					<Mfm :punctuationWrap="toast" :text="customNotificationBody(notification)" :nowrap="false"/>
				</MkA>
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
import { getNoteSummary } from '@/utility/get-note-summary.js';
import { notePage } from '@@/js/note.js';
import { userPage } from '@/filters/user.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { ensureSignin } from '@/i.js';
import { prefer } from '@/preferences.js';
import { NOTIFICATION_FILTER_POLICY_NOTICE_ID } from '@/utility/notification-filter.js';
import { instance } from '@/instance.js';
import { host } from '@@/js/config.js';
import * as os from '@/os.js';

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

type CustomBodyNotification = Extract<Misskey.entities.Notification, { type: 'app' }>;

function isCustomBodyNotification(notification: Misskey.entities.Notification): notification is CustomBodyNotification {
	return notification.type === 'app';
}

function customNotificationHeader(notification: Misskey.entities.Notification): string {
	return isCustomBodyNotification(notification) ? notification.header ?? '' : '';
}

function customNotificationBody(notification: Misskey.entities.Notification): string {
	return isCustomBodyNotification(notification) ? notification.body : '';
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
.icon_noteGroup {
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

/* 旗鯖fork: 通知でクリック可能リンク (notification.link あり) のスタイル */
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
