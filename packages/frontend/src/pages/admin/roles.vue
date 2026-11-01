<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px;">
		<div class="_gaps">
			<MkFolder>
				<template #label>{{ i18n.ts._role.baseRole }}</template>
				<template #footer>
					<MkButton primary rounded @click="updateBaseRole">{{ i18n.ts.save }}</MkButton>
				</template>
				<div class="_gaps_s">
					<MkInput ref="baseRoleQEl" v-model="baseRoleQ" type="search">
						<template #prefix><i class="ti ti-search"></i></template>
						<template v-if="baseRoleQ != ''" #suffix>
							<button type="button" :class="$style.deleteBtn" tabindex="-1" @click="baseRoleQ = ''; baseRoleQEl?.focus();">
								<i class="ti ti-x"></i>
							</button>
						</template>
					</MkInput>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.rateLimitFactor, 'rateLimitFactor'])">
						<template #label>{{ i18n.ts._role._options.rateLimitFactor }}</template>
						<template #suffix>{{ Math.floor(policies.rateLimitFactor * 100) }}%</template>
						<MkRange :modelValue="policies.rateLimitFactor * 100" :min="30" :max="300" :step="10" :textConverter="(v) => `${v}%`" @update:modelValue="v => policies.rateLimitFactor = (v / 100)">
							<template #caption>{{ i18n.ts._role._options.descriptionOfRateLimitFactor }}</template>
						</MkRange>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.gtlAvailable, 'gtlAvailable'])">
						<template #label>{{ i18n.ts._role._options.gtlAvailable }}</template>
						<template #suffix>{{ policies.gtlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.gtlAvailable">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.ltlAvailable, 'ltlAvailable'])">
						<template #label>{{ i18n.ts._role._options.ltlAvailable }}</template>
						<template #suffix>{{ policies.ltlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.ltlAvailable">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.btlAvailable, 'btlAvailable'])">
						<template #label>{{ i18n.ts._role._options.btlAvailable }}</template>
						<template #suffix>{{ policies.btlAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
						<div class="_gaps_s">
							<MkInfo :warn="true">{{ i18n.ts.bubbleTimelineDescription }}</MkInfo>
							<MkSwitch v-model="policies.btlAvailable">
								<template #label>{{ i18n.ts.enable }}</template>
							</MkSwitch>
						</div>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canPublicNote, 'canPublicNote'])">
						<template #label>{{ i18n.ts._role._options.canPublicNote }}</template>
						<template #suffix>{{ policies.canPublicNote ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canPublicNote">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canEditNote, 'canEditNote'])">
						<template #label>{{ i18n.ts._role._options.canEditNote }}</template>
						<template #suffix>{{ policies.canEditNote ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canEditNote">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.chatAvailability, 'chatAvailability'])">
						<template #label>{{ i18n.ts._role._options.chatAvailability }}</template>
						<template #suffix>{{ policies.chatAvailability === 'available' ? i18n.ts.yes : policies.chatAvailability === 'readonly' ? i18n.ts.readonly : i18n.ts.no }}</template>
						<MkSelect
							v-model="policies.chatAvailability"
							:items="[
								{ label: i18n.ts.enabled, value: 'available' },
								{ label: i18n.ts.readonly, value: 'readonly' },
								{ label: i18n.ts.disabled, value: 'unavailable' },
							]"
						>
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSelect>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.mentionMax, 'mentionLimit'])">
						<template #label>{{ i18n.ts._role._options.mentionMax }}</template>
						<template #suffix>{{ policies.mentionLimit }}</template>
						<MkInput v-model="policies.mentionLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canInvite, 'canInvite'])">
						<template #label>{{ i18n.ts._role._options.canInvite }}</template>
						<template #suffix>{{ policies.canInvite ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canInvite">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteLimit, 'inviteLimit'])">
						<template #label>{{ i18n.ts._role._options.inviteLimit }}</template>
						<template #suffix>{{ policies.inviteLimit }}</template>
						<MkInput v-model="policies.inviteLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteLimitCycle, 'inviteLimitCycle'])">
						<template #label>{{ i18n.ts._role._options.inviteLimitCycle }}</template>
						<template #suffix>{{ policies.inviteLimitCycle + i18n.ts._time.minute }}</template>
						<MkInput v-model="policies.inviteLimitCycle" type="number">
							<template #suffix>{{ i18n.ts._time.minute }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.inviteExpirationTime, 'inviteExpirationTime'])">
						<template #label>{{ i18n.ts._role._options.inviteExpirationTime }}</template>
						<template #suffix>{{ policies.inviteExpirationTime + i18n.ts._time.minute }}</template>
						<MkInput v-model="policies.inviteExpirationTime" type="number">
							<template #suffix>{{ i18n.ts._time.minute }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canManageAvatarDecorations, 'canManageAvatarDecorations'])">
						<template #label>{{ i18n.ts._role._options.canManageAvatarDecorations }}</template>
						<template #suffix>{{ policies.canManageAvatarDecorations ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canManageAvatarDecorations">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canManageCustomEmojis, 'canManageCustomEmojis'])">
						<template #label>{{ i18n.ts._role._options.canManageCustomEmojis }}</template>
						<template #suffix>{{ policies.canManageCustomEmojis ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canManageCustomEmojis">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canSearchNotes, 'canSearchNotes'])">
						<template #label>{{ i18n.ts._role._options.canSearchNotes }}</template>
						<template #suffix>{{ policies.canSearchNotes ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canSearchNotes">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canSearchUsers, 'canSearchUsers'])">
						<template #label>{{ i18n.ts._role._options.canSearchUsers }}</template>
						<template #suffix>{{ policies.canSearchUsers ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canSearchUsers">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.driveCapacity, 'driveCapacityMb'])">
						<template #label>{{ i18n.ts._role._options.driveCapacity }}</template>
						<template #suffix>{{ policies.driveCapacityMb }}MB</template>
						<MkInput v-model="policies.driveCapacityMb" type="number">
							<template #suffix>MB</template>
						</MkInput>
					</MkFolder>

					<!-- 旗鯖fork: マスコット機能の利用可否(デフォルト不許可) -->
					<MkFolder v-if="matchQuery([roleCopy.noteCharmAccessName, 'canUseNoteCharm'])">
						<template #label>{{ roleCopy.noteCharmAccessName }}</template>
						<template #suffix>{{ policies.canUseNoteCharm ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canUseNoteCharm">
							<template #label>{{ roleCopy.noteCharmAccessToggle }}</template>
							<template #caption>{{ roleCopy.noteCharmAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.mascotAccessName, 'canUseMascot'])">
						<template #label>{{ roleCopy.mascotAccessName }}</template>
						<template #suffix>{{ policies.canUseMascot ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canUseMascot">
							<template #label>{{ roleCopy.mascotAccessToggle }}</template>
							<template #caption>{{ roleCopy.mascotAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork: HataFeed(フィードバックセンター)の利用可否ポリシー -->
					<MkFolder v-if="matchQuery([roleCopy.hatafeedAccessName, 'canAccessHataFeed'])">
						<template #label>{{ roleCopy.hatafeedAccessName }}</template>
						<template #suffix>{{ policies.canAccessHataFeed ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canAccessHataFeed">
							<template #label>{{ roleCopy.hatafeedAccessToggle }}</template>
							<template #caption>{{ roleCopy.hatafeedAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork: 感情分析の利用可否 -->
					<MkFolder v-if="matchQuery([roleCopy.emotionAnalysisAccessName, 'canUseHatalyze'])">
						<template #label>{{ roleCopy.emotionAnalysisAccessName }}</template>
						<template #suffix>{{ policies.canUseHatalyze ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canUseHatalyze">
							<template #label>{{ roleCopy.emotionAnalysisAccessToggle }}</template>
							<template #caption>{{ roleCopy.emotionAnalysisAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork(Hatady): 端末間データ共有(同期)の可否。既定は有効。 -->
					<MkFolder v-if="matchQuery([roleCopy.hatadySyncName, 'canUseHatadySync'])">
						<template #label>{{ roleCopy.hatadySyncName }}</template>
						<template #suffix>{{ policies.canUseHatadySync ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canUseHatadySync">
							<template #label>{{ roleCopy.hatadySyncToggle }}</template>
							<template #caption>{{ roleCopy.hatadySyncBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork(Hatady): 追加できる本の最大数 -->
					<MkFolder v-if="matchQuery([roleCopy.hatadyBookLimitName, 'hatadyBookLimit'])">
						<template #label>{{ roleCopy.hatadyBookLimitName }}</template>
						<template #suffix>{{ policies.hatadyBookLimit }}</template>
						<MkInput v-model="policies.hatadyBookLimit" type="number">
							<template #caption>{{ roleCopy.hatadyBookLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<!-- 旗鯖fork(Hatady): 記録できる異なるゲーム作品数。対戦/プレイ件数は制限しない。 -->
					<MkFolder v-if="matchQuery([roleCopy.hatadyGameTitleLimitName, 'hatadyGameTitleLimit'])">
						<template #label>{{ roleCopy.hatadyGameTitleLimitName }}</template>
						<template #suffix>{{ policies.hatadyGameTitleLimit }}</template>
						<MkInput v-model="policies.hatadyGameTitleLimit" type="number" :min="0" :max="1000" :step="1">
							<template #caption>{{ roleCopy.hatadyGameTitleLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<!-- 旗鯖fork(Hatady): 本1冊あたりのしおりの最大数 -->
					<MkFolder v-if="matchQuery([roleCopy.hatadyBookmarkLimitName, 'hatadyBookmarkLimit'])">
						<template #label>{{ roleCopy.hatadyBookmarkLimitName }}</template>
						<template #suffix>{{ policies.hatadyBookmarkLimit }}</template>
						<MkInput v-model="policies.hatadyBookmarkLimit" type="number">
							<template #caption>{{ roleCopy.hatadyBookmarkLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<!-- 旗鯖fork: プライベートチャンネルの作成可否 -->
					<MkFolder v-if="matchQuery([roleCopy.privateChannelAccessName, 'canMakePrivateChannel'])">
						<template #label>{{ roleCopy.privateChannelAccessName }}</template>
						<template #suffix>{{ policies.canMakePrivateChannel ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canMakePrivateChannel">
							<template #label>{{ roleCopy.privateChannelAccessToggle }}</template>
							<template #caption>{{ roleCopy.privateChannelAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork: HataFeed リモート絵文字の申請可否 -->
					<MkFolder v-if="matchQuery([roleCopy.remoteEmojiAccessName, 'canRequestRemoteEmoji'])">
						<template #label>{{ roleCopy.remoteEmojiAccessName }}</template>
						<template #suffix>{{ policies.canRequestRemoteEmoji ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canRequestRemoteEmoji">
							<template #label>{{ roleCopy.remoteEmojiAccessToggle }}</template>
							<template #caption>{{ roleCopy.remoteEmojiAccessBaseCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<!-- 旗鯖fork: HataFeed 絵文字申請の週あたり上限 -->
					<MkFolder v-if="matchQuery([roleCopy.emojiRequestLimitName, 'emojiRequestLimit'])">
						<template #label>{{ roleCopy.emojiRequestLimitName }}</template>
						<template #suffix>{{ policies.emojiRequestLimit }}</template>
						<MkInput v-model="policies.emojiRequestLimit" type="number">
							<template #caption>{{ roleCopy.emojiRequestLimitCaption }}</template>
						</MkInput>
					</MkFolder>

					<!-- 旗鯖fork: マスコット機能の上限ポリシー -->
					<MkFolder v-if="matchQuery([roleCopy.mascotExpressionsLimitName, 'mascotMaxExpressions'])">
						<template #label>{{ roleCopy.mascotExpressionsLimitName }}</template>
						<template #suffix>{{ policies.mascotMaxExpressions }}</template>
						<MkInput v-model="policies.mascotMaxExpressions" type="number">
							<template #caption>{{ roleCopy.mascotExpressionsLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.mascotPhrasesLimitName, 'mascotMaxPhrases'])">
						<template #label>{{ roleCopy.mascotPhrasesLimitName }}</template>
						<template #suffix>{{ policies.mascotMaxPhrases }}</template>
						<MkInput v-model="policies.mascotMaxPhrases" type="number">
							<template #caption>{{ roleCopy.mascotPhrasesLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.mascotCharactersLimitName, 'mascotMaxCharacters'])">
						<template #label>{{ roleCopy.mascotCharactersLimitName }}</template>
						<template #suffix>{{ policies.mascotMaxCharacters }}</template>
						<MkInput v-model="policies.mascotMaxCharacters" type="number">
							<template #caption>{{ roleCopy.mascotCharactersLimitBaseCaption }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.sideStudioProfileLimitName, 'hataSideStudioProfileLimit'])">
						<template #label>{{ roleCopy.sideStudioProfileLimitName }}</template>
						<template #suffix>{{ policies.hataSideStudioProfileLimit }}</template>
						<MkInput v-model="policies.hataSideStudioProfileLimit" type="number" :min="1" :max="20"><template #caption>{{ roleCopy.sideStudioProfileLimitBaseCaption }}</template></MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.maxFileSize, 'maxFileSizeMb'])">
						<template #label>{{ i18n.ts._role._options.maxFileSize }}</template>
						<template #suffix>{{ policies.maxFileSizeMb }}MB</template>
						<MkInput v-model="policies.maxFileSizeMb" type="number">
							<template #suffix>MB</template>
							<template #caption>
								<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> {{ i18n.ts._role._options.maxFileSize_caption }}</div>
							</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.uploadableFileTypes, 'uploadableFileTypes'])">
						<template #label>{{ i18n.ts._role._options.uploadableFileTypes }}</template>
						<template #suffix>...</template>
						<MkTextarea :modelValue="policies.uploadableFileTypes.join('\n')" @update:modelValue="v => policies.uploadableFileTypes = v.split('\n')">
							<template #caption>
								<div>{{ i18n.ts._role._options.uploadableFileTypes_caption }}</div>
								<div><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i> {{ i18n.tsx._role._options.uploadableFileTypes_caption2({ x: 'application/octet-stream' }) }}</div>
							</template>
						</MkTextarea>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.alwaysMarkNsfw, 'alwaysMarkNsfw'])">
						<template #label>{{ i18n.ts._role._options.alwaysMarkNsfw }}</template>
						<template #suffix>{{ policies.alwaysMarkNsfw ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.alwaysMarkNsfw">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canUpdateBioMedia, 'canUpdateBioMedia'])">
						<template #label>{{ i18n.ts._role._options.canUpdateBioMedia }}</template>
						<template #suffix>{{ policies.canUpdateBioMedia ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canUpdateBioMedia">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.pinMax, 'pinLimit'])">
						<template #label>{{ i18n.ts._role._options.pinMax }}</template>
						<template #suffix>{{ policies.pinLimit }}</template>
						<MkInput v-model="policies.pinLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.antennaMax, 'antennaLimit'])">
						<template #label>{{ i18n.ts._role._options.antennaMax }}</template>
						<template #suffix>{{ policies.antennaLimit }}</template>
						<MkInput v-model="policies.antennaLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.wordMuteMax, 'wordMuteLimit'])">
						<template #label>{{ i18n.ts._role._options.wordMuteMax }}</template>
						<template #suffix>{{ policies.wordMuteLimit }}</template>
						<MkInput v-model="policies.wordMuteLimit" type="number">
							<template #suffix>chars</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.webhookMax, 'webhookLimit'])">
						<template #label>{{ i18n.ts._role._options.webhookMax }}</template>
						<template #suffix>{{ policies.webhookLimit }}</template>
						<MkInput v-model="policies.webhookLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.favoriteFolderLimitName, 'favoriteFolderLimit'])">
						<template #label>{{ roleCopy.favoriteFolderLimitName }}</template>
						<template #suffix>{{ policies.favoriteFolderLimit }}</template>
						<MkInput v-model="policies.favoriteFolderLimit" type="number" :min="0" :max="5" :step="1">
							<template #caption>{{ roleCopy.favoriteFolderLimitCaption }}</template>
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([roleCopy.favoriteSubfoldersName, 'canCreateFavoriteSubfolders'])">
						<template #label>{{ roleCopy.favoriteSubfoldersName }}</template>
						<template #suffix>{{ policies.canCreateFavoriteSubfolders ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canCreateFavoriteSubfolders">
							<template #label>{{ i18n.ts.enable }}</template>
							<template #caption>{{ roleCopy.favoriteSubfoldersCaption }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.clipMax, 'clipLimit'])">
						<template #label>{{ i18n.ts._role._options.clipMax }}</template>
						<template #suffix>{{ policies.clipLimit }}</template>
						<MkInput v-model="policies.clipLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.noteEachClipsMax, 'noteEachClipsLimit'])">
						<template #label>{{ i18n.ts._role._options.noteEachClipsMax }}</template>
						<template #suffix>{{ policies.noteEachClipsLimit }}</template>
						<MkInput v-model="policies.noteEachClipsLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.userListMax, 'userListLimit'])">
						<template #label>{{ i18n.ts._role._options.userListMax }}</template>
						<template #suffix>{{ policies.userListLimit }}</template>
						<MkInput v-model="policies.userListLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.userEachUserListsMax, 'userEachUserListsLimit'])">
						<template #label>{{ i18n.ts._role._options.userEachUserListsMax }}</template>
						<template #suffix>{{ policies.userEachUserListsLimit }}</template>
						<MkInput v-model="policies.userEachUserListsLimit" type="number">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canHideAds, 'canHideAds'])">
						<template #label>{{ i18n.ts._role._options.canHideAds }}</template>
						<template #suffix>{{ policies.canHideAds ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canHideAds">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.avatarDecorationLimit, 'avatarDecorationLimit'])">
						<template #label>{{ i18n.ts._role._options.avatarDecorationLimit }}</template>
						<template #suffix>{{ policies.avatarDecorationLimit }}</template>
						<MkInput v-model="avatarDecorationLimit" type="number" :min="0" :max="16" @update:modelValue="updateAvatarDecorationLimit">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canImportAntennas, 'canImportAntennas'])">
						<template #label>{{ i18n.ts._role._options.canImportAntennas }}</template>
						<template #suffix>{{ policies.canImportAntennas ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canImportAntennas">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canImportBlocking, 'canImportBlocking'])">
						<template #label>{{ i18n.ts._role._options.canImportBlocking }}</template>
						<template #suffix>{{ policies.canImportBlocking ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canImportBlocking">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canImportFollowing, 'canImportFollowing'])">
						<template #label>{{ i18n.ts._role._options.canImportFollowing }}</template>
						<template #suffix>{{ policies.canImportFollowing ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canImportFollowing">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canImportMuting, 'canImportMuting'])">
						<template #label>{{ i18n.ts._role._options.canImportMuting }}</template>
						<template #suffix>{{ policies.canImportMuting ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canImportMuting">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canImportUserLists, 'canImportUserList'])">
						<template #label>{{ i18n.ts._role._options.canImportUserLists }}</template>
						<template #suffix>{{ policies.canImportUserLists ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canImportUserLists">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.noteDraftLimit, 'noteDraftLimit'])">
						<template #label>{{ i18n.ts._role._options.noteDraftLimit }}</template>
						<template #suffix>{{ policies.noteDraftLimit }}</template>
						<MkInput v-model="policies.noteDraftLimit" type="number" :min="0">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.scheduledNoteLimit, 'scheduledNoteLimit'])">
						<template #label>{{ i18n.ts._role._options.scheduledNoteLimit }}</template>
						<template #suffix>{{ policies.scheduledNoteLimit }}</template>
						<MkInput v-model="policies.scheduledNoteLimit" type="number" :min="0">
						</MkInput>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.watermarkAvailable, 'watermarkAvailable'])">
						<template #label>{{ i18n.ts._role._options.watermarkAvailable }}</template>
						<template #suffix>{{ policies.watermarkAvailable ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.watermarkAvailable">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>

					<MkFolder v-if="matchQuery([i18n.ts._role._options.canSetFederationAvatarShape, 'canSetFederationAvatarShape'])">
						<template #label>{{ i18n.ts._role._options.canSetFederationAvatarShape }}</template>
						<template #suffix>{{ policies.canSetFederationAvatarShape ? i18n.ts.yes : i18n.ts.no }}</template>
						<MkSwitch v-model="policies.canSetFederationAvatarShape">
							<template #label>{{ i18n.ts.enable }}</template>
						</MkSwitch>
					</MkFolder>
				</div>
			</MkFolder>
			<div class="_gaps_s">
				<MkFoldableSection>
					<template #header>{{ i18n.ts._role.manualRoles }}</template>
					<div class="_gaps_s">
						<MkRolePreview v-for="role in roles.filter(x => x.target === 'manual')" :key="role.id" :role="role" :forModeration="true"/>
					</div>
				</MkFoldableSection>
				<MkFoldableSection>
					<template #header>{{ i18n.ts._role.conditionalRoles }}</template>
					<div class="_gaps_s">
						<MkRolePreview v-for="role in roles.filter(x => x.target === 'conditional')" :key="role.id" :role="role" :forModeration="true"/>
					</div>
				</MkFoldableSection>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkInput from '@/components/MkInput.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkButton from '@/components/MkButton.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkRange from '@/components/MkRange.vue';
import MkRolePreview from '@/components/MkRolePreview.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { instance, fetchInstance } from '@/instance.js';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import { useRouter } from '@/router.js';
import { deepClone } from '@/utility/clone.js';
import MkTextarea from '@/components/MkTextarea.vue';

const roleCopy = i18n.ts._hata._adminRoles;
const router = useRouter();
const baseRoleQ = ref('');
const baseRoleQEl = useTemplateRef('baseRoleQEl');

const roles = await misskeyApi('admin/roles/list');

const policies = reactive({
	...deepClone(instance.policies),
	canUseNoteCharm: instance.policies.canUseNoteCharm ?? false,
	favoriteFolderLimit: instance.policies.favoriteFolderLimit ?? 2,
	canCreateFavoriteSubfolders: instance.policies.canCreateFavoriteSubfolders ?? false,
});

const avatarDecorationLimit = computed({
	get: () => Math.min(16, Math.max(0, policies.avatarDecorationLimit)),
	set: (value) => {
		policies.avatarDecorationLimit = Math.min(Number(value), 16);
	},
});

function updateAvatarDecorationLimit(value: string | number) {
	avatarDecorationLimit.value = Number(value);
}

function matchQuery(keywords: string[]): boolean {
	if (baseRoleQ.value.trim().length === 0) return true;
	return keywords.some(keyword => keyword.toLowerCase().includes(baseRoleQ.value.toLowerCase()));
}

async function updateBaseRole() {
	await os.apiWithDialog('admin/roles/update-default-policies', {
		policies,
	});
	fetchInstance(true);
}

function create() {
	router.push('/admin/roles/new');
}

const headerActions = computed(() => [{
	icon: 'ti ti-plus',
	text: i18n.ts._role.new,
	handler: create,
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.roles,
	icon: 'ti ti-badges',
}));
</script>

<style lang="scss" module>
.deleteBtn {
	position: relative;
	z-index: 2;
	margin: 0 auto;
	border: none;
	background: none;
	color: inherit;
	font-size: 0.8em;
	cursor: pointer;
	pointer-events: auto;
	-webkit-tap-highlight-color: transparent;
}
</style>
