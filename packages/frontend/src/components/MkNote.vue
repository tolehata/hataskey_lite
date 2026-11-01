<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	v-if="!hardMuted && muted === false && !hideAsBot"
	ref="rootEl"
	v-hotkey="keymap"
	:data-note-charm-layout="charmLayout ? 'on' : null"
	:data-note-charm-host="noteCharm ? 'on' : null"
	:data-note-charm-compact="compactCharm ? 'true' : null"
	:style="noteCharm ? { '--note-charm-size': `${noteCharm.size}px` } : undefined"
	:class="[$style.root, { [$style.showActionsOnlyHover]: prefer.s.showNoteActionsOnlyHover, [$style.skipRender]: prefer.s.skipNoteRender && utageState === 'none' && !noteGlassActive && !noteCharm, [$style.utageActive]: utageState !== 'none' && utageOutsideFrame }]"
	:data-utage-state="utageState !== 'none' ? utageState : null"
	:data-utage-motion="prefer.s.animation ? null : 'reduced'"
	tabindex="0"
>
	<MkNoteCharm v-if="noteCharm && !renoteCollapsed && !replyCollapsed && (!isRenote || note.renote != null)" :charm="noteCharm" :wind="noteCharmDisplay.wind" :motion="!mock && noteCharmDisplay.motion" :interactive="!mock" :compact="compactCharm"/>
	<div v-if="pinned" :class="$style.tip"><i class="ti ti-pin"></i> {{ i18n.ts.pinnedNote }}</div>
	<div v-if="isRenote || (appearNote.reply && prefer.s.collapseReplies)" :class="$style.renote">
		<div v-if="note.channel" :class="$style.colorBar" :style="{ borderLeftColor: note.channel.color }"></div>
		<MkAvatar v-if="!prefer.s.hideAvatarsInNote" :class="$style.renoteAvatar" :user="note.user" link preview/>
		<i :class="isRenote ? 'ti ti-repeat' : appearNote.reply ? 'ti ti-arrow-back-up' : ''" style="margin-right: 4px;"></i>
		<I18n :src="isRenote ? i18n.ts.renotedBy : appearNote.reply ? i18n.ts.repliedBy : ''" tag="span" :class="$style.renoteText">
			<!-- @vue-expect-error 旗鯖fork(G9): I18nはgeneric SFCのためGlobalComponents経由/相互参照時にslot名の型推論が効かない(実行時は問題なし) -->
			<template v-if="'user' in note && note.user" #user>
				<MkA v-user-preview="note.userId" :class="$style.renoteUserName" :to="userPage(note.user)">
					<MkUserName :user="note.user"/>
				</MkA>
			</template>
		</I18n>
		<div :class="$style.renoteInfo">
			<span v-if="note.visibility !== 'public'" style="margin-right: 0.5em;">
				<i v-if="note.visibility === 'home'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-home"></i>
				<i v-else-if="note.visibility === 'followers'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-lock"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-mail"></i>
			</span>
			<span v-if="note.reactionAcceptance != null" style="margin-right: 0.5em;" :class="{ [$style.danger]: ['nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote', 'likeOnly'].includes(<string>note.reactionAcceptance) }" :title="i18n.ts.reactionAcceptance">
				<i v-if="note.reactionAcceptance === 'likeOnlyForRemote'" v-tooltip="i18n.ts.likeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnly'" v-tooltip="i18n.ts.nonSensitiveOnly" class="ti ti-icons"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'" v-tooltip="i18n.ts.nonSensitiveOnlyForLocalLikeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'likeOnly'" v-tooltip="i18n.ts.likeOnly" class="ti ti-heart"></i>
			</span>
			<span v-if="note.localOnly" style="margin-right: 0.5em;"><i v-tooltip="i18n.ts._visibility['disableFederation']" class="ti ti-rocket-off"></i></span>
			<span
				v-if="note.deliveryTargets"
				v-tooltip="deliveryTargetsTooltip(note.deliveryTargets)"
				style="margin-right: 0.5em;"
			>
				<i :class="note.deliveryTargets.mode === 'include' ? 'ti ti-truck' : 'ti ti-truck-filled'"></i>
			</span>
			<span v-if="note.channel" style="margin-right: 0.5em;"><i v-tooltip="note.channel.name" class="ti ti-device-tv"></i></span>
			<span :class="$style.renoteTime">
				<button ref="renoteTime" class="_button">
					<i class="ti ti-dots" :class="$style.renoteMenu" @mousedown.prevent="showRenoteMenu()"></i>
				</button>
				<MkA :to="notePage(note)">
					<MkTime :time="note.createdAt" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'"/>
				</MkA>
			</span>
		</div>
	</div>
	<MkNoteSub v-if="appearNote.replyId && !renoteCollapsed && !replyCollapsed && notification && prefer.s.showReplyInNotification" :note="appearNote?.reply ?? null" :class="$style.replyTo"/>
	<MkNoteSub v-else-if="appearNote.replyId && !renoteCollapsed && !replyCollapsed && !notification && (forceShowReplyTargetNote || prefer.s.showReplyTargetNote)" :note="appearNote?.reply ?? null" :class="[$style.replyTo, { [$style.showReplyTargetNoteInSemiTransparent]: prefer.s.showReplyTargetNoteInSemiTransparent }]"/>
	<div v-if="isRenote && note.renote == null" :class="$style.deleted">
		{{ i18n.ts.deletedNote }}
	</div>
	<div v-else-if="renoteCollapsed || replyCollapsed" :class="$style.collapsedRenoteTarget">
		<MkAvatar v-if="!prefer.s.hideAvatarsInNote" :class="$style.collapsedRenoteTargetAvatar" :user="appearNote.user" link preview/>
		<Mfm :text="getNoteSummary(appearNote)" :plain="true" :nowrap="true" :author="appearNote.user" :nyaize="'respect'" :class="[$style.collapsedRenoteTargetText, { [$style.showReplyTargetNoteInSemiTransparent]: prefer.s.showReplyTargetNoteInSemiTransparent }]" @click="renoteCollapsed ? renoteCollapsed = false : replyCollapsed ? replyCollapsed = false : ''"/>
	</div>
	<article v-else ref="utageArticle" :class="$style.article" :data-utage-square="(!utageOutsideFrame && utageState !== 'none') ? utageState : null" :style="{ cursor: expandOnNoteClick ? 'pointer' : '', paddingTop: prefer.s.showSubNoteFooterButton && appearNote.reply && (!renoteCollapsed && !replyCollapsed && ((!notification && (forceShowReplyTargetNote || prefer.s.showReplyTargetNote)) || (notification && prefer.s.showReplyInNotification))) ? '14px' : '' }" @click.stop="noteClick" @dblclick.stop="noteDblClick" @contextmenu.stop="onContextmenu">
		<Hk3VisibilityRail v-if="ui === 'hataskey3'" :visibility="appearNote.visibility"/>
		<span v-if="!utageOutsideFrame && (utageState === 'flashing' || utageState === 'failed' || utageState === 'success')" :class="$style.utageSurface" :data-utage-surface="utageState" aria-hidden="true"></span>
		<!-- 旗鯖fork: C7 宴チュートリアル (自分の宴ノート初回のみ) -->
		<MkTip v-if="showUtageTip" k="note.utage" style="margin-bottom: 8px;">
			{{ utageCopy.tipBefore }}<b style="color: var(--MI_THEME-success);">{{ utageCopy.tipSuccess }}</b>{{ utageCopy.tipMiddle }}<b style="color: var(--MI_THEME-error);">{{ utageCopy.tipFailure }}</b>{{ utageCopy.tipAfter }}
		</MkTip>
		<div ref="utageBubble" :data-note-charm-frame="noteCharm ? 'on' : null" :data-note-charm-attachment="utageOutsideFrame ? 'frame' : 'root'" :class="[$style.bubbleBody, { [$style.utageFlashing]: utageState === 'flashing' && utageOutsideFrame, [$style.utageReviving]: utageState === 'reviving' && utageOutsideFrame, [$style.utageFailed]: utageState === 'failed' && utageOutsideFrame, [$style.utageSuccess]: utageState === 'success' && utageOutsideFrame }]">
		<span v-if="utageOutsideFrame && (utageState === 'flashing' || utageState === 'failed' || utageState === 'success')" :class="$style.utageSurface" :data-utage-surface="utageState" aria-hidden="true"></span>
		<!-- 旗鯖fork: C7 宴 結果バッジ (吹き出し右下隅) -->
		<div v-if="utageState === 'failed'" :class="[$style.utageBadge, $style.utageBadgeFailed]">{{ utageCopy.failed }}</div>
		<div v-else-if="utageState === 'success'" :class="[$style.utageBadge, $style.utageBadgeSuccess]">{{ utageCopy.success }}</div>
		<!-- 旗鯖fork: チャンネル投稿の colorBar (position:absolute; border-left:5px) がアバターの
		     左辺と重なる問題への対処。channel が付いているときだけ flex コンテナに padding-left を
		     足して、アバター開始位置を colorBar の帯 (5px) の外にずらす。
		     colorBar の位置基準は bubbleBody (常に position: relative) なので、ここでは position は
		     いじらず (以前 position:relative を付けたら、noteContent が短い時に colorBar が
		     avatar+main のみに縮んで「アイコンに密着した小さなタブ」に見える副作用が出た)。
		     Hataskey UI 2 のリアクション貫通問題は、colorBar 自体に mask-image (下部フェード) を
		     かけて対応する (下の .colorBar CSS 参照)。 -->
		<div :style="[prefer.s.showGapBodyOfTheNote ? {} : { paddingBottom: '10px' }, appearNote.channel ? { paddingLeft: '7px' } : {}]" style="display: flex;">
			<div v-if="appearNote.channel" :class="$style.colorBar" :style="{ borderLeftColor: appearNote.channel.color }"></div>
			<MkAvatar v-if="!prefer.s.hideAvatarsInNote" :class="[$style.avatar, prefer.s.useStickyIcons ? $style.useSticky : null, { [$style.avatarReplyTo]: appearNote.reply, [$style.showEl]: !appearNote.reply && (showEl && ['hideHeaderOnly', 'hideHeaderFloatBtn', 'hide'].includes(<string>prefer.s.displayHeaderNavBarWhenScroll)) && mainRouter.currentRoute.value.name === 'index', [$style.showElTab]: !appearNote.reply && (showEl && ['hideHeaderOnly', 'hideHeaderFloatBtn', 'hide'].includes(<string>prefer.s.displayHeaderNavBarWhenScroll)) && mainRouter.currentRoute.value.name !== 'index' }]" :user="appearNote.user" :link="!mock" :preview="!mock" noteClick/>
			<div :class="$style.main">
				<MkNoteHeader :note="appearNote" :mini="true"/>
				<div v-if="prefer.s.showGapBodyOfTheNote" data-note-content :class="$style.noteContent" :style="prefer.s.showGapBodyOfTheNote ? 'margin-top: 4px;' : null" style="container-type: inline-size;">
					<MkInfo v-if="appearNote.deleteAt != null" warn :class="$style.deleteAt">
						<I18n :src="i18n.ts.scheduledToDeleteOnX" tag="span">
							<template #x>
								<MkTime :time="appearNote.deleteAt" :mode="'detail'" style="font-weight: bold;"/>
							</template>
						</I18n>
					</MkInfo>
					<MkEvent v-if="appearNote.event" :note="appearNote"/>
					<div v-if="appearNote.replyId && appearNote.reply && !(forceShowReplyTargetNote || prefer.s.showReplyTargetNote)" style="margin-bottom: 4px;">
						<MkA :class="$style.replyIcon" :to="`/notes/${appearNote.replyId}`" @click.stop><i class="ti ti-arrow-back-up"></i></MkA>
						<MkA v-user-preview="appearNote.reply.userId" :class="$style.replyToText" :to="userPage(appearNote.reply.user)" @click.stop><span v-html="replyTo"></span></MkA>
					</div>
					<p v-if="appearNote.cw != null" :class="$style.cw">
						<Mfm
							v-if="appearNote.cw != ''"
							:text="appearNote.cw"
							:author="appearNote.user"
							:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
							:enableEmojiMenu="!!$i"
							:enableEmojiMenuReaction="!!$i"
						/>
						<MkCwButton v-model="showContent" :text="appearNote.text" :renote="appearNote.renote" :files="appearNote.files" :poll="appearNote.poll" style="margin: 4px 0;" @click.stop/>
					</p>
					<div v-show="appearNote.cw == null || showContent" :class="[{ [$style.contentCollapsed]: collapsed }]">
						<div :class="$style.text">
							<span v-if="appearNote.isHidden" style="opacity: 0.5">({{ i18n.ts._ffVisibility.private }})</span>
							<MkA v-if="appearNote.replyId && (forceShowReplyTargetNote || prefer.s.showReplyTargetNote)" :class="$style.replyIcon" :to="`/notes/${appearNote.replyId}`" @click.stop><i class="ti ti-arrow-back-up"></i></MkA>
							<Mfm
								v-if="appearNote.text"
								:parsedNodes="parsed"
								:text="appearNote.text"
								:author="appearNote.user"
								:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
								:emojiUrls="appearNote.emojis"
								:enableEmojiMenu="!!$i"
								:enableEmojiMenuReaction="!!$i"
								class="_selectable"
							/>
							<div v-if="viewTextSource">
								<hr style="margin: 10px 0;">
								<pre style="margin: initial; white-space: pre-wrap; word-wrap: break-word;"><small>{{ appearNote.text }}</small></pre>
								<button class="_button" style="padding: 5px 0; color: var(--MI_THEME-accent);" @click.stop="viewTextSource = false"><small>{{ i18n.ts.close }}</small></button>
							</div>
						</div>
						<div v-if="appearNote.files && appearNote.files.length > 0" style="margin-top: 8px;">
							<MkMediaList ref="galleryEl" :mediaList="appearNote.files" :user="appearNote.user" :disableRightClick="appearNote.disableRightClick" @click.stop @contextmenu="disableRightClickHandler"/>
						</div>
						<MkPoll
							v-if="appearNote.poll"
							:noteId="appearNote.id"
							:multiple="appearNote.poll.multiple"
							:expiresAt="appearNote.poll.expiresAt"
							:choices="$appearNote.pollChoices"
							:author="appearNote.user"
							:emojiUrls="appearNote.emojis"
							:class="$style.poll"
							@click.stop
						/>
						<div v-if="isEnabledUrlPreview">
							<MkUrlPreview v-for="url in urls" :key="url" :url="url" :compact="true" :detail="false" :class="$style.urlPreview"/>
						</div>
						<button v-if="((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || (appearNote.files && appearNote.files.length > 0 && prefer.s.allMediaNoteCollapse)) && collapsed" :class="$style.collapsed" class="_button" @click.stop="collapsed = false">
							<span :class="$style.collapsedLabel">
								{{ i18n.ts.showMore }}
								<span v-if="appearNote.files && appearNote.files.length > 0" :class="$style.label">({{ collapseLabel }})</span>
							</span>
						</button>
						<button v-else-if="((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || (appearNote.files && appearNote.files.length > 0 && prefer.s.allMediaNoteCollapse)) && !collapsed" :class="$style.showLess" class="_button" @click.stop="collapsed = true">
							<span :class="$style.showLessLabel">{{ i18n.ts.showLess }}</span>
						</button>
					</div>
					<MkA v-if="appearNote.channel && !inChannel" :class="$style.channel" :to="`/channels/${appearNote.channel.id}`"><i class="ti ti-device-tv"></i> {{ appearNote.channel.name }}</MkA>
				</div>
			</div>
		</div>
		<div v-if="!prefer.s.showGapBodyOfTheNote" data-note-content :class="$style.noteContent" style="container-type: inline-size;">
			<MkInfo v-if="appearNote.deleteAt != null" warn :class="$style.deleteAt">
				<I18n :src="i18n.ts.scheduledToDeleteOnX" tag="span">
					<template #x>
						<MkTime :time="appearNote.deleteAt" :mode="'detail'" style="font-weight: bold;"/>
					</template>
				</I18n>
			</MkInfo>
			<MkEvent v-if="appearNote.event" :note="appearNote"/>
			<div v-if="appearNote.replyId && appearNote.reply && !(forceShowReplyTargetNote || prefer.s.showReplyTargetNote)" style="margin-bottom: 4px;">
				<MkA :class="$style.replyIcon" :to="`/notes/${appearNote.replyId}`" @click.stop><i class="ti ti-arrow-back-up"></i></MkA>
				<MkA v-user-preview="appearNote.reply.userId" :class="$style.replyToText" :to="userPage(appearNote.reply.user)" @click.stop><span v-html="replyTo"></span></MkA>
			</div>
			<p v-if="appearNote.cw != null" :class="$style.cw">
				<Mfm
					v-if="appearNote.cw != ''"
					:text="appearNote.cw"
					:author="appearNote.user"
					:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
					:enableEmojiMenu="!!$i"
					:enableEmojiMenuReaction="!!$i"
				/>
				<MkCwButton v-model="showContent" :text="appearNote.text" :renote="appearNote.renote" :files="appearNote.files" :poll="appearNote.poll" style="margin: 4px 0;" @click.stop/>
			</p>
			<div v-show="appearNote.cw == null || showContent" :class="[{ [$style.contentCollapsed]: collapsed }]">
				<div :class="$style.text">
					<span v-if="appearNote.isHidden" style="opacity: 0.5">({{ i18n.ts._ffVisibility.private }})</span>
					<MkA v-if="appearNote.replyId && (forceShowReplyTargetNote || prefer.s.showReplyTargetNote)" :class="$style.replyIcon" :to="`/notes/${appearNote.replyId}`" @click.stop><i class="ti ti-arrow-back-up"></i></MkA>
					<Mfm
						v-if="appearNote.text"
						:parsedNodes="parsed"
						:text="appearNote.text"
						:author="appearNote.user"
						:nyaize="prefer.s.disableNyaize || noNyaize ? false : 'respect'"
						:emojiUrls="appearNote.emojis"
						:enableEmojiMenu="!!$i"
						:enableEmojiMenuReaction="!!$i"
						class="_selectable"
					/>
					<div v-if="viewTextSource">
						<hr style="margin: 10px 0;">
						<pre style="margin: initial; white-space: pre-wrap; word-wrap: break-word;"><small>{{ appearNote.text }}</small></pre>
						<button class="_button" style="padding: 5px 0; color: var(--MI_THEME-accent);" @click.stop="viewTextSource = false"><small>{{ i18n.ts.close }}</small></button>
					</div>
				</div>
				<div v-if="appearNote.files && appearNote.files.length > 0">
					<MkMediaList ref="galleryEl" :mediaList="appearNote.files" :user="appearNote.user" :disableRightClick="appearNote.disableRightClick" @click.stop @contextmenu="disableRightClickHandler"/>
				</div>
				<MkPoll
					v-if="appearNote.poll"
					:noteId="appearNote.id"
					:multiple="appearNote.poll.multiple"
					:expiresAt="appearNote.poll.expiresAt"
					:choices="$appearNote.pollChoices"
					:author="appearNote.user"
					:emojiUrls="appearNote.emojis"
					:class="$style.poll"
					@click.stop
				/>
				<div v-if="isEnabledUrlPreview">
					<MkUrlPreview v-for="url in urls" :key="url" :url="url" :compact="true" :detail="false" :class="$style.urlPreview"/>
				</div>
				<button v-if="((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || (appearNote.files && appearNote.files.length > 0 && prefer.s.allMediaNoteCollapse)) && collapsed" :class="$style.collapsed" class="_button" @click.stop="collapsed = false">
					<span :class="$style.collapsedLabel">
						{{ i18n.ts.showMore }}
						<span v-if="appearNote.files && appearNote.files.length > 0" :class="$style.label">({{ collapseLabel }})</span>
					</span>
				</button>
				<button v-else-if="((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || (appearNote.files && appearNote.files.length > 0 && prefer.s.allMediaNoteCollapse)) && !collapsed" :class="$style.showLess" class="_button" @click.stop="collapsed = true">
					<span :class="$style.showLessLabel">{{ i18n.ts.showLess }}</span>
				</button>
			</div>
			<MkA v-if="appearNote.channel && !inChannel" :class="$style.channel" :to="`/channels/${appearNote.channel.id}`"><i class="ti ti-device-tv"></i> {{ appearNote.channel.name }}</MkA>
		</div>
		<div v-if="appearNote.renoteId" :class="$style.quote"><MkNoteSimple :note="appearNote?.renote ?? null" :class="$style.quoteNote"/></div>
		<div data-reactions-footer>
			<MkReactionsViewer
				v-if="appearNote.reactionAcceptance !== 'likeOnly'"
				style="margin-top: 6px;"
				:reactions="displayedReactions"
				:reactionEmojis="$appearNote.reactionEmojis"
				:myReaction="$appearNote.myReaction"
				:noteId="appearNote.id"
				:note="appearNote"
				:maxNumber="16"
				@click.stop
				@contextmenu.prevent.stop
				@mockUpdateMyReaction="emitUpdReaction"
			>
				<template #more>
					<MkA :to="`/notes/${appearNote.id}/reactions`" :class="[$style.reactionOmitted]">{{ i18n.ts.more }}</MkA>
				</template>
			</MkReactionsViewer>
			<MkUtageStatus v-if="utageState !== 'none' && $appearNote.utageRevival" :note="$appearNote"/>
			<footer :class="$style.footer">
				<template v-if="prefer.s.showReplyButtonInNoteFooter">
					<button v-if="!note.isHidden" v-tooltip="i18n.ts.reply" :class="$style.footerButton" class="_button" @click.stop="reply()">
						<i class="ti ti-arrow-back-up"></i>
						<p v-if="appearNote.repliesCount > 0" :class="$style.footerButtonCount">{{ number(appearNote.repliesCount) }}</p>
					</button>
					<button v-else-if="note.isHidden" :class="$style.footerButton" class="_button" disabled>
						<i class="ti ti-ban"></i>
					</button>
				</template>
				<template v-if="prefer.s.showRenoteButtonInNoteFooter">
					<button
						v-if="canRenote"
						ref="renoteButton"
						v-tooltip="i18n.ts.renote"
						:class="$style.footerButton"
						class="_button"
						@click.stop="prefer.s.renoteQuoteButtonSeparation && ((!prefer.s.renoteVisibilitySelection && !appearNote.channel) || (appearNote.channel && !appearNote.channel.allowRenoteToExternal) || appearNote.visibility === 'followers') ? renoteOnly() : renote()"
					>
						<i class="ti ti-repeat"></i>
						<p v-if="appearNote.renoteCount > 0" :class="$style.footerButtonCount">{{ number(appearNote.renoteCount) }}</p>
					</button>
					<button v-else-if="!canRenote" :class="$style.footerButton" class="_button" disabled>
						<i class="ti ti-ban"></i>
					</button>
				</template>
				<button v-if="appearNote.reactionAcceptance !== 'likeOnly' && $appearNote.myReaction == null && prefer.s.showLikeButtonInNoteFooter" ref="heartReactButton" v-tooltip="i18n.ts.like" :class="$style.footerButton" class="_button" @click.stop="heartReact()">
					<i class="ti ti-heart"></i>
				</button>
				<button v-if="prefer.s.showDoReactionButtonInNoteFooter" ref="reactButton" v-tooltip="appearNote.reactionAcceptance === 'likeOnly' && $appearNote.myReaction != null ? i18n.ts.unlike : $appearNote.myReaction != null ? i18n.ts.editReaction : appearNote.reactionAcceptance === 'likeOnly' ? i18n.ts.like : i18n.ts.doReaction" :class="$style.footerButton" class="_button" @click.stop="toggleReact()">
					<i v-if="appearNote.reactionAcceptance === 'likeOnly' && $appearNote.myReaction != null" class="ti ti-heart-filled" style="color: var(--MI_THEME-love);"></i>
					<i v-else-if="$appearNote.myReaction != null" class="ti ti-mood-edit" style="color: var(--MI_THEME-accent);"></i>
					<i v-else-if="appearNote.reactionAcceptance === 'likeOnly'" class="ti ti-heart"></i>
					<i v-else class="ti ti-mood-plus"></i>
					<p v-if="(appearNote.reactionAcceptance === 'likeOnly' || prefer.s.showReactionsCount) && $appearNote.reactionCount > 0" :class="$style.footerButtonCount">{{ number($appearNote.reactionCount) }}</p>
				</button>
				<button v-if="canRenote && prefer.s.renoteQuoteButtonSeparation && prefer.s.showQuoteButtonInNoteFooter" ref="quoteButton" v-tooltip="i18n.ts.quote" class="_button" :class="$style.footerButton" @click.stop="quote()">
					<i class="ti ti-quote"></i>
				</button>
				<button v-if="prefer.s.showClipButtonInNoteFooter" ref="clipButton" v-tooltip="i18n.ts.clip" :class="$style.footerButton" class="_button" @click.stop="clip()">
					<i class="ti ti-paperclip"></i>
				</button>
				<MkA v-if="prefer.s.infoButtonForNoteActionsEnabled && prefer.s.showNoteActionsOnlyHover" v-tooltip="i18n.ts.details" :to="notePage(note)" :class="$style.footerButton" style="text-decoration: none;" class="_button">
					<i class="ti ti-info-circle"></i>
				</MkA>
				<button v-if="prefer.s.showMoreButtonInNoteFooter" ref="menuButton" v-tooltip="i18n.ts.more" :class="$style.footerButton" class="_button" @click.stop="showMenu()">
					<i class="ti ti-dots"></i>
				</button>
			</footer>
		</div>
		</div>
	</article>
</div>
<div v-else-if="!hardMuted && !hideAsBot" :class="$style.muted" @click="muted = false">
	<I18n v-if="muted === 'sensitiveMute'" :src="i18n.ts.userSaysSomethingSensitive" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
	</I18n>
	<I18n v-else-if="showSoftWordMutedWord !== true" :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
	</I18n>
	<I18n v-else :src="i18n.ts.userSaysSomethingAbout" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
		<template #word>
			{{ Array.isArray(muted) ? muted.map(words => Array.isArray(words) ? words.join() : words).slice(0, 3).join(' ') : muted }}
		</template>
	</I18n>
</div>
<div v-else>
	<!--
		MkDateSeparatedList uses TransitionGroup which requires single element in the child elements
		so MkNote create empty div instead of no elements
	-->
</div>
</template>

<script lang="ts">
import { ref as vueRef } from 'vue';

// 旗鯖fork: C7 宴チュートリアル表示制御 (モジュールスコープ = 全MkNoteインスタンスで共有)。
// 複数の宴ノートが同時に表示されても、チュートリアルは画面内で1つだけにするため、
// 最初に表示権を取得したノートのIDをここで保持する。
const utageTipOwnerId = vueRef<string | null>(null);
</script>

<script lang="ts" setup>
import { computed, inject, onMounted, onUnmounted, ref, useTemplateRef, watch, provide } from 'vue';
import * as mfm from 'mfc-js';
import * as Misskey from 'cherrypick-js';
import { isLink } from '@@/js/is-link.js';
import { shouldCollapsed, shouldMfmCollapsed } from '@@/js/collapsed.js';
import { host, ui } from '@@/js/config.js';
import { concat } from '@@/js/array.js';
import { toUnicode } from 'punycode.js';
import type { Ref } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import type { OpenOnRemoteOptions } from '@/utility/please-login.js';
import type { Keymap } from '@/utility/hotkey.js';
import { parseMfmCached } from '@/utility/mfm-cache.js';
import MkNoteSub from '@/components/MkNoteSub.vue';
import MkNoteHeader from '@/components/MkNoteHeader.vue';
import MkNoteSimple from '@/components/MkNoteSimple.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import MkReactionsViewerDetails from '@/components/MkReactionsViewer.details.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkUsersTooltip from '@/components/MkUsersTooltip.vue';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkEvent from '@/components/MkEvent.vue';
import { pleaseLogin } from '@/utility/please-login.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { notePage } from '@@/js/note.js';
import { userPage } from '@/filters/user.js';
import number from '@/filters/number.js';
import * as os from '@/os.js';
import * as sound from '@/utility/sound.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { getAbuseNoteMenu, getCopyNoteLinkMenu, getNoteClipMenu, getNoteMenu, getRenoteMenu, getRenoteOnly, getQuoteMenu } from '@/utility/get-note-menu.js';
import { noteEvents, useNoteCapture } from '@/composables/use-note-capture.js';
import { useUtageFailureMotion } from '@/composables/use-utage-failure-motion.js';
import { useUtageRevivalMotion } from '@/composables/use-utage-revival-motion.js';
import MkUtageStatus from '@/components/MkUtageStatus.vue';
import { deepClone } from '@/utility/clone.js';
import { useTooltip } from '@/composables/use-tooltip.js';
import { claimAchievement } from '@/utility/achievements.js';
import { getNoteSummary } from '@/utility/get-note-summary.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { showMovedDialog } from '@/utility/show-moved-dialog.js';
import { isEnabledUrlPreview } from '@/utility/url-preview.js';
import { focusPrev, focusNext } from '@/utility/focus.js';
import { getAppearNote } from '@/utility/get-appear-note.js';
import { prefer } from '@/preferences.js';
import { glassUiLocal } from '@/utility/hatasaba-device-prefs.js';
import { filterHiddenReactions, hiddenReactionsVersion } from '@/utility/hidden-reactions.js';
import { getPluginHandlers } from '@/plugin.js';
import { DI } from '@/di.js';
import { globalEvents } from '@/events.js';
import { instance } from '@/instance.js';
import { mainRouter, useRouter } from '@/router.js';
import { miLocalStorage } from '@/local-storage.js';
import { haptic, hapticConfirm } from '@/utility/haptic.js';
import { store } from '@/store.js';
import { scrollToVisibility } from '@/utility/scroll-to-visibility.js';
import detectLanguage from '@/utility/detect-language.js';
import MkInfo from '@/components/MkInfo.vue';
import MkNoteCharm from '@/components/MkNoteCharm.vue';
import { useNoteCharmAvailability } from '@/composables/use-note-charm-context.js';
import { useNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';
import { noteCharmDisplay } from '@/utility/hatasaba-device-prefs.js';
import type { NoteCharm } from '@/utility/note-charm-physics.js';
import '@/note-charm.scss';
import Hk3VisibilityRail from '@/components/hataskey3/Hk3VisibilityRail.vue';

const utageCopy = i18n.ts._hata._utage;
const { showEl } = scrollToVisibility();

function deliveryTargetsTooltip(targets: Misskey.entities.Note['deliveryTargets']): string {
	if (!targets) return '';
	const title = i18n.ts._deliveryTargetControl[targets.mode === 'include' ? 'deliveryTargetsInclude' : 'deliveryTargetsExclude'];
	const hosts = targets.hosts ?? [];
	const details = hosts.length > 0
		? hosts.map((hostName, index) => targets.names?.[index] ? `${targets.names[index]} (${hostName})` : hostName).join('\n')
		: i18n.ts.none;
	return `${title}:\n${details}`;
}

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	pinned?: boolean;
	mock?: boolean;
	charmPreview?: NoteCharm | null;
	withHardMute?: boolean;
	notification?: boolean;
	forceShowReplyTargetNote?: boolean;
}>(), {
	mock: false,
});

provide(DI.mock, props.mock);

const emit = defineEmits<{
	(ev: 'reaction', emoji: string): void;
	(ev: 'removeReaction', emoji: string): void;
}>();

const inTimeline = inject<boolean>('inTimeline', false);
const tl_withSensitive = inject<Ref<boolean>>('tl_withSensitive', ref(true));
const inChannel = inject('inChannel', null);
// 旗鯖fork: C7 宴明滅機能。LTL表示中かどうか(MkStreamingNotesTimelineからprovide)。
const inLocalTimeline = inject<Ref<boolean> | null>('inLocalTimeline', null);
// 旗鯖fork(#1): 吹き出し表示が有効か(MkStreamingNotesTimelineからprovide)。
// 宴の着色面と復活枠の描画先を、吹き出しON時はbubbleBody、OFF時はarticleから選ぶ。
// 未提供時(=吹き出し文脈外)はarticleにする。
const noteBubbleEnabled = inject<Ref<boolean> | null>('noteBubbleEnabled', null);
const utageOutsideFrame = computed(() => noteBubbleEnabled?.value ?? false);
// 旗鯖fork: 背景ぼかし(glass)有効時は skipRender(content-visibility:auto)を付けない。
// glass = 背景ぼかし(noteTimelineGlassBg) または グラスUIベータ(glassUiLocal)。
const noteTimelineGlassBg = inject<Ref<boolean> | null>('noteTimelineGlassBg', null);
const noteGlassActive = computed(() => (noteTimelineGlassBg?.value ?? false) || glassUiLocal.value);
const currentClip = inject<Ref<Misskey.entities.Clip> | null>('currentClip', null);
// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
const currentAntenna = inject<Ref<Misskey.entities.Antenna | null> | null>('currentAntenna', null);

let note = deepClone(props.note);

// plugin
const noteViewInterruptors = getPluginHandlers('note_view_interruptor');
if (noteViewInterruptors.length > 0) {
	let result: Misskey.entities.Note | null = deepClone(note);
	for (const interruptor of noteViewInterruptors) {
		try {
			result = interruptor.handler(result!) as Misskey.entities.Note | null;
			if (result == null) break;
		} catch (err) {
			console.error(err);
		}
	}
	if (result == null) {
		// hideByPlugin removed
	} else {
		note = result as Misskey.entities.Note;
	}
}

const isRenote = Misskey.note.isPureRenote(note);
const appearNote = getAppearNote(note) ?? note;
const charmUiAvailable = useNoteCharmAvailability();
const charmMobileDisplay = useNoteCharmMobileDisplay();
const charmLayout = computed(() => !charmMobileDisplay.value && (props.mock ? props.charmPreview !== undefined : charmUiAvailable.value));
const compactCharm = computed(() => props.notification || (ui === 'simple' && prefer.r['simpleUi.noteSpacing'].value === 'compact'));
const noteCharm = computed<NoteCharm | null>(() => {
	if (charmMobileDisplay.value) return null;
	if (props.mock && props.charmPreview !== undefined) return props.charmPreview;
	if (!charmUiAvailable.value || !noteCharmDisplay.value.show) return null;
	if ($i && appearNote.user.id === $i.id) return $i.policies.canUseNoteCharm ? $i.noteCharm ?? null : null;
	if (!noteCharmDisplay.value.showOthers) return null;
	return appearNote.user.noteCharm ?? null;
});
const { $note: $appearNote, subscribe: subscribeManuallyToNoteCapture } = useNoteCapture({
	note: appearNote,
	parentNote: note,
	mock: props.mock,
});

const rootEl = useTemplateRef('rootEl');
const menuButton = useTemplateRef('menuButton');

// =========================================================================
// 旗鯖fork: C7 宴(うたげ)明滅機能
// 本文に「宴」「うたげ」「utage」を含むローカルノートをLTLに投稿すると、
// 投稿から15分間ノート全体が明滅する。15分逃げ切れば「成功」、
// 途中で他者の反応が来たら失敗し、抽選で復活チャンスが始まる。
// 判定はサーバー(utage_session)が行い、フロントは $appearNote.utageStatus を購読して
// 描画するだけ。これによりリロード・別端末でも状態が一貫する(従来のフロント完結実装で
// 起きていた「成功後の反応をリロードで失敗扱いしてしまう」現象を解消)。
// なお演出(明滅・バッジ)はLTL表示中のみ。これはLTL限定のゲームであるため。
// =========================================================================
const UTAGE_EXPIRE_MS = 6 * 60 * 60 * 1000; // 6時間 (これを過ぎたら演出を出さない)
// 参加可否もサーバーの判定に合わせ、不可視の語だけの投稿へ案内を出さない。
const isUtageTarget = computed(() => {
	if ($appearNote.utageStatus == null) return false;
	if (appearNote.user.host != null) return false; // ローカルノートのみ
	if (inLocalTimeline == null || !inLocalTimeline.value) return false; // LTL表示中のみ
	return true;
});

// チュートリアル表示条件: 自分が投稿した宴ノートが対象。
// 複数の宴ノートが同時表示されても画面内で1つだけ出すため、表示権(utageTipOwnerId)を持つ
// インスタンスのみ表示する。表示済み(閉じた)管理は MkTip の k='note.utage' で行う。
const isUtageTipCandidate = computed(() => {
	return isUtageTarget.value && $i != null && appearNote.user.id === $i.id;
});
const showUtageTip = computed(() => {
	return isUtageTipCandidate.value && utageTipOwnerId.value === appearNote.id;
});

// 投稿からの経過ms (6時間制約の判定用)
const utageCreatedAt = new Date(appearNote.createdAt).getTime();

// サーバーの判定結果($appearNote.utageStatus)をそのまま反映する。
// running=明滅, reviving=復活挑戦, succeeded=成功, failed=失敗。セッションが無ければnone。
const utageState = computed<'none' | 'flashing' | 'reviving' | 'failed' | 'success'>(() => {
	if (!isUtageTarget.value) return 'none';
	if ((Date.now() - utageCreatedAt) >= UTAGE_EXPIRE_MS) return 'none'; // 6時間超 → 平常
	switch ($appearNote.utageStatus) {
		case 'succeeded': return 'success';
		case 'failed': return 'failed';
		case 'running': return 'flashing';
		case 'reviving': return 'reviving';
		default: return 'none';
	}
});

const utageBubble = useTemplateRef('utageBubble');
const utageArticle = useTemplateRef('utageArticle');
useUtageFailureMotion({
	root: rootEl,
	article: utageArticle,
	state: utageState,
	animationEnabled: prefer.r.animation,
	failedText: utageCopy.failed,
});

useUtageRevivalMotion({
	root: rootEl,
	frame: computed(() => utageOutsideFrame.value ? utageBubble.value : utageArticle.value),
	state: utageState,
	animationEnabled: prefer.r.animation,
});

onMounted(() => {
	// チュートリアル表示権の取得: まだ誰も持っていなければ自分が取得 (画面内で1つだけ表示)
	if (isUtageTipCandidate.value && utageTipOwnerId.value == null) {
		utageTipOwnerId.value = appearNote.id;
	}
});

onUnmounted(() => {
	// 自分が表示権を持っていたら解放 (他の宴ノートが表示できるように)
	if (utageTipOwnerId.value === appearNote.id) {
		utageTipOwnerId.value = null;
	}
});
// =========================================================================
// C7 宴明滅機能ここまで
// =========================================================================

const renoteButton = useTemplateRef('renoteButton');
const renoteTime = useTemplateRef('renoteTime');
const reactButton = useTemplateRef('reactButton');
const heartReactButton = useTemplateRef('heartReactButton');
const quoteButton = useTemplateRef('quoteButton');
const clipButton = useTemplateRef('clipButton');
const galleryEl = useTemplateRef('galleryEl');
const isMyRenote = $i && ($i.id === note.userId);
const showContent = ref(false);
const parsed = computed(() => appearNote.text ? parseMfmCached(appearNote.text) : null);
const urls = computed(() => parsed.value ? extractUrlFromMfm(parsed.value).filter((url) => appearNote.renote?.url !== url && appearNote.renote?.uri !== url) : null);
const isLong = shouldCollapsed(appearNote, urls.value ?? []);
const isMFM = shouldMfmCollapsed(appearNote);
const collapsed = ref(appearNote.cw == null && ((isLong && prefer.s.collapseLongNoteContent) || (isMFM && prefer.s.collapseDefault) || ((appearNote.files?.length ?? 0) > 0 && prefer.s.allMediaNoteCollapse)));
const muted = ref(checkMute(appearNote, $i?.mutedWords));
const hardMuted = ref(props.withHardMute && checkMute(appearNote, $i?.hardMutedWords, true));
// 旗鯖fork: bot ユーザーの投稿をタイムラインから非表示 (許可リストで例外指定可能)。
//   isBot=true かつ botAllowlist に userId が無い かつ hideBotsInTimeline=true → 非表示。
//   通知/通知ページや個別ノート表示など、通知系のコンテキストでは非表示にしないよう
//   props.notification を除外する (bot がリアクション/フォロー通知を送るケースがある)。
const hideAsBot = computed<boolean>(() => {
    if (props.notification) return false;
    if (!prefer.r['simpleUi.hideBotsInTimeline']?.value) return false;
    const user = appearNote.user;
    if (!user?.isBot) return false;
    const allowlist = (prefer.r['simpleUi.botAllowlist']?.value as string[] | undefined) ?? [];
    if (allowlist.includes(user.id)) return false;
    return true;
});
const showSoftWordMutedWord = computed(() => prefer.s.showSoftWordMutedWord);
const canRenote = computed(() => ['public', 'home'].includes(appearNote.visibility) || (appearNote.visibility === 'followers' && appearNote.userId === $i?.id));
const renoteCollapsed = ref(
	isRenote && (
		prefer.s.forceCollapseAllRenotes || (
			prefer.s.collapseRenotes && (
				($i && ($i.id === note.userId || $i.id === appearNote.userId)) || // `||` must be `||`! See https://github.com/misskey-dev/misskey/issues/13131
				($appearNote.myReaction != null)
			)
		)
	),
);
const viewTextSource = ref(false);
const noNyaize = ref(false);
const expandOnNoteClick = prefer.s.expandOnNoteClick;
const router = useRouter();
const replyCollapsed = ref(
	prefer.s.collapseReplies && appearNote.reply && $appearNote.myReaction == null,
);

const pleaseLoginContext = computed<OpenOnRemoteOptions>(() => ({
	type: 'lookup',
	url: `https://${host}/notes/${appearNote.id}`,
}));

const collapseLabel = computed(() => {
	return concat([
		appearNote.files && appearNote.files.length !== 0 ? [i18n.tsx._cw.files({ count: appearNote.files.length })] : [],
	] as string[][]).join(' / ');
});

const disableRightClickHandler = (event: Event) => {
	if (appearNote.disableRightClick) event.preventDefault();
};

/* eslint-disable no-redeclare */
/** checkOnlyでは純粋なワードミュート結果をbooleanで返却する */
function checkMute(noteToCheck: Misskey.entities.Note, mutedWords: Array<string | string[]> | undefined | null, checkOnly: true): boolean;
function checkMute(noteToCheck: Misskey.entities.Note, mutedWords: Array<string | string[]> | undefined | null, checkOnly?: false): Array<string | string[]> | false | 'sensitiveMute';

function checkMute(noteToCheck: Misskey.entities.Note, mutedWords: Array<string | string[]> | undefined | null, checkOnly = false): Array<string | string[]> | boolean | 'sensitiveMute' {
	if (mutedWords != null) {
		const result = checkWordMute(noteToCheck, $i, mutedWords);
		if (Array.isArray(result)) {
			return checkOnly ? (result.length > 0) : result;
		}

		const replyResult = noteToCheck.reply && checkWordMute(noteToCheck.reply, $i, mutedWords);
		if (Array.isArray(replyResult)) {
			return checkOnly ? (replyResult.length > 0) : replyResult;
		}

		const renoteResult = noteToCheck.renote && checkWordMute(noteToCheck.renote, $i, mutedWords);
		if (Array.isArray(renoteResult)) {
			return checkOnly ? (renoteResult.length > 0) : renoteResult;
		}
	}

	if (checkOnly) return false;

	if (inTimeline && tl_withSensitive.value === false && noteToCheck.files?.some((v) => v.isSensitive)) {
		return 'sensitiveMute';
	}

	return false;
}
/* eslint-enable no-redeclare */

const keymap = {
	'r': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		reply();
	},
	'e|a|plus': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		react();
	},
	'q': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		renote();
	},
	'm': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		showMenu();
	},
	'c': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		if (!prefer.s.showClipButtonInNoteFooter) return;
		clip();
	},
	'o': () => {
		if (renoteCollapsed.value) return;
		if (replyCollapsed.value) return;
		galleryEl.value?.openGallery();
	},
	'v|enter': () => {
		if (renoteCollapsed.value) {
			renoteCollapsed.value = false;
		} else if (replyCollapsed.value) {
			replyCollapsed.value = false;
		} else if (appearNote.cw != null) {
			showContent.value = !showContent.value;
		} else if (isLong || isMFM) {
			collapsed.value = !collapsed.value;
		}
	},
	'esc': {
		allowRepeat: true,
		callback: () => blur(),
	},
	'up|k|shift+tab': {
		allowRepeat: true,
		callback: () => focusBefore(),
	},
	'down|j|tab': {
		allowRepeat: true,
		callback: () => focusAfter(),
	},
} as const satisfies Keymap;

const replyTo = computed(() => {
	const username = appearNote.reply?.user.host == null ? `@${appearNote.reply?.user.username}` : `@${appearNote.reply?.user.username}@${toUnicode(appearNote.reply?.user.host)}`;
	const text = i18n.tsx.replyTo({ user: username });
	const user = `<span style="color: var(--MI_THEME-accent); margin-right: 0.25em;">${username}</span>`;

	return text.replace(username, user);
});

provide(DI.mfmEmojiReactCallback, (reaction) => {
	sound.playMisskeySfx('reaction');
	misskeyApi('notes/reactions/create', {
		noteId: appearNote.id,
		reaction: reaction,
	}).then(() => {
		noteEvents.emit(`reacted:${appearNote.id}`, {
			userId: $i!.id,
			reaction: reaction,
		});
	});
});

if (!props.mock) {
	useTooltip(renoteButton, async (showing) => {
		const renotes = await misskeyApi('notes/renotes', {
			noteId: appearNote.id,
			limit: 11,
		});

		const users = renotes.map(x => x.user);

		if (users.length < 1 || renoteButton.value == null) return;

		const { dispose } = os.popup(MkUsersTooltip, {
			showing,
			users,
			count: appearNote.renoteCount,
			anchorElement: renoteButton.value,
		}, {
			closed: () => dispose(),
		});
	});

	if (appearNote.reactionAcceptance === 'likeOnly') {
		useTooltip(reactButton, async (showing) => {
			const reactions = await misskeyApi('notes/reactions', {
				noteId: appearNote.id,
				limit: 10,
			});

			const users = reactions.map(x => x.user);

			if (users.length < 1) return;

			const { dispose } = os.popup(MkReactionsViewerDetails, {
				showing,
				reaction: '❤️',
				users,
				count: $appearNote.reactionCount,
				anchorElement: reactButton.value!,
			}, {
				closed: () => dispose(),
			});
		});
	}
}

if (prefer.s.alwaysShowCw) showContent.value = true;

watch(() => viewTextSource.value, () => {
	collapsed.value = false;
});

const displayedReactions = computed(() => {
	hiddenReactionsVersion.value;
	if (!$appearNote.reactions) return {};
	return filterHiddenReactions(appearNote.id, $appearNote.reactions);
});

function noteClick(ev: MouseEvent) {
	if (!expandOnNoteClick || window.getSelection()?.toString() !== '' || prefer.s.expandOnNoteClickBehavior === 'doubleClick') ev.stopPropagation();
	else router.pushByPath(notePage(appearNote));
}

function noteDblClick(ev: MouseEvent) {
	if (!expandOnNoteClick || window.getSelection()?.toString() !== '' || prefer.s.expandOnNoteClickBehavior === 'click') ev.stopPropagation();
	else router.pushByPath(notePage(appearNote));
}

async function renote() {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	showMovedDialog();

	const { menu } = await getRenoteMenu({ note: note, renoteButton, mock: props.mock });
	os.popupMenu(menu, renoteButton.value);

	subscribeManuallyToNoteCapture();
}

async function renoteOnly() {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	showMovedDialog();

	await getRenoteOnly({ note: note, renoteButton, mock: props.mock });
}

function quote(): void {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	if (!$i) return;
	if (props.mock) {
		return;
	}
	if (appearNote.channel) {
		// 旗鯖fork: プライベートチャンネルのノートはチャンネル外へ引用させない
		if (appearNote.channel.allowRenoteToExternal && !appearNote.channel.isPrivate) {
			const { menu } = getQuoteMenu({ note: note, mock: props.mock });
			os.popupMenu(menu, quoteButton.value);
		} else {
			os.post({
				renote: appearNote,
				channel: appearNote.channel,
			}).then(() => {
				focus();
			});
		}
	} else {
		os.post({
			renote: appearNote,
		}).then(() => {
			focus();
		});
	}
}

function reply(): void {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	if (!$i) return;
	if (props.mock) {
		return;
	}
	os.post({
		reply: appearNote,
		channel: appearNote.channel,
	}).then(() => {
		focus();
	});
}

function react(): void {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	showMovedDialog();
	if (appearNote.reactionAcceptance === 'likeOnly') {
		sound.playMisskeySfx('reaction');

		if (props.mock) {
			return;
		}

		misskeyApi('notes/reactions/create', {
			noteId: appearNote.id,
			reaction: '❤️',
		}).then(() => {
			noteEvents.emit(`reacted:${appearNote.id}`, {
				userId: $i!.id,
				reaction: '❤️',
			});
		});
		const el = reactButton.value;
		if (el && prefer.s.animation) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			const { dispose } = os.popup(MkRippleEffect, { x, y }, {
				end: () => dispose(),
			});
		}
	} else {
		blur();
		reactionPicker.show(reactButton.value ?? null, appearNote, async (reaction) => {
			if (prefer.s.confirmOnReact) {
				const confirm = await os.confirm({
					type: 'question',
					text: i18n.tsx.reactAreYouSure({ emoji: reaction.replace('@.', '') }),
				});

				if (confirm.canceled) return;
			}

			if (props.mock) {
				emit('reaction', reaction);
				$appearNote.reactions[reaction] = 1;
				$appearNote.reactionCount++;
				$appearNote.myReaction = reaction;
				return;
			}

			await toggleReaction(reaction);
		}, () => {
			focus();
		});
	}
}

async function toggleReaction(reaction: string) {
	const me = $i;
	if (me == null) return;
	const oldReaction = $appearNote.myReaction;
	if (oldReaction) {
		const confirm = await os.confirm({
			type: 'warning',
			text: oldReaction !== reaction ? i18n.ts.changeReactionConfirm : i18n.ts.cancelReactionConfirm,
		});
		if (confirm.canceled) return;
	}

	sound.playMisskeySfx('reaction');

	if (oldReaction) {
		await misskeyApi('notes/reactions/delete', { noteId: appearNote.id });
		noteEvents.emit(`unreacted:${appearNote.id}`, { userId: me.id, reaction: oldReaction });
	}
	if (oldReaction !== reaction) {
		const created = await misskeyApi('notes/reactions/create', { noteId: appearNote.id, reaction });
		noteEvents.emit(`reacted:${appearNote.id}`, { userId: me.id, reaction: created.reaction });
	}

	if (appearNote.text && appearNote.text.length > 100 && (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 3)) {
		claimAchievement('reactWithoutRead');
	}
}

function heartReact(): void {
	haptic();

	pleaseLogin({ openOnRemote: pleaseLoginContext.value });
	showMovedDialog();

	sound.playMisskeySfx('reaction');

	if (props.mock) {
		return;
	}

	const me = $i;
	if (me == null) return;
	const reaction = prefer.s.selectReaction;
	misskeyApi('notes/reactions/create', {
		noteId: appearNote.id,
		reaction,
	}).then(created => {
		noteEvents.emit(`reacted:${appearNote.id}`, { userId: me.id, reaction: created.reaction });
	});

	if (appearNote.text && appearNote.text.length > 100 && (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 3)) {
		claimAchievement('reactWithoutRead');
	}

	const el = heartReactButton.value;
	if (el && prefer.s.animation) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + (el.offsetWidth / 2);
		const y = rect.top + (el.offsetHeight / 2);
		const { dispose } = os.popup(MkRippleEffect, { x, y }, {
			end: () => dispose(),
		});
	}
}

function undoReact(): void {
	const oldReaction = $appearNote.myReaction;
	if (!oldReaction) return;

	if (props.mock) {
		emit('removeReaction', oldReaction);
		return;
	}

	misskeyApi('notes/reactions/delete', {
		noteId: appearNote.id,
	}).then(() => {
		noteEvents.emit(`unreacted:${appearNote.id}`, {
			userId: $i!.id,
			reaction: oldReaction,
		});
	});
}

function toggleReact() {
	haptic();

	if ($appearNote.myReaction != null && appearNote.reactionAcceptance === 'likeOnly') {
		undoReact();
	} else {
		react();
	}
}

function onContextmenu(ev: MouseEvent): void {
	if (props.mock) {
		return;
	}

	if (ev.target && isLink(ev.target as HTMLElement)) return;
	if (window.getSelection()?.toString() !== '') return;

	if (prefer.s.useReactionPickerForContextMenu) {
		ev.preventDefault();
		react();
	} else {
		const { menu, cleanup } = getNoteMenu({ note: note, collapsed, viewTextSource, noNyaize, currentClip: currentClip?.value, currentAntenna: currentAntenna?.value ?? undefined });
		os.contextMenu(menu, ev).then(focus).finally(cleanup);
	}
}

function showMenu(): void {
	if (props.mock) {
		return;
	}

	haptic();

	const { menu, cleanup } = getNoteMenu({ note: note, collapsed, viewTextSource, noNyaize, currentClip: currentClip?.value, currentAntenna: currentAntenna?.value ?? undefined });
	os.popupMenu(menu, menuButton.value).then(focus).finally(cleanup);
}

async function clip(): Promise<void> {
	haptic();

	if (props.mock) {
		return;
	}

	os.popupMenu(await getNoteClipMenu({ note: note, currentClip: currentClip?.value }), clipButton.value).then(focus);
}

function showRenoteMenu(): void {
	if (props.mock) {
		return;
	}

	function getUnrenote(): MenuItem {
		return {
			text: i18n.ts.unrenote,
			icon: 'ti ti-trash',
			danger: true,
			action: () => {
				misskeyApi('notes/delete', {
					noteId: note.id,
				}).then(() => {
					globalEvents.emit('noteDeleted', note.id);
				});
			},
		};
	}

	const renoteDetailsMenu: MenuItem = {
		type: 'link',
		text: i18n.ts.renoteDetails,
		icon: 'ti ti-info-circle',
		to: notePage(note),
	};

	if (isMyRenote) {
		pleaseLogin({ openOnRemote: pleaseLoginContext.value });
		os.popupMenu([
			renoteDetailsMenu,
			getCopyNoteLinkMenu(note, i18n.ts.copyLinkRenote),
			{ type: 'divider' },
			getUnrenote(),
		], renoteTime.value);
	} else {
		os.popupMenu([
			renoteDetailsMenu,
			getCopyNoteLinkMenu(note, i18n.ts.copyLinkRenote),
			{ type: 'divider' },
			getAbuseNoteMenu(note, i18n.ts.reportAbuseRenote),
			...(($i?.isModerator || $i?.isAdmin) ? [getUnrenote()] : []),
		], renoteTime.value);
	}
}

function focus() {
	rootEl.value?.focus();
}

function blur() {
	rootEl.value?.blur();
}

function focusBefore() {
	focusPrev(rootEl.value);
}

function focusAfter() {
	focusNext(rootEl.value);
}

function readPromo() {
	misskeyApi('promo/read', {
		noteId: appearNote.id,
	});
}

function emitUpdReaction(emoji: string, delta: number) {
	if (delta < 0) {
		emit('removeReaction', emoji);
	} else if (delta > 0) {
		emit('reaction', emoji);
	}
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	font-size: 1.05em;
	overflow: clip;
	margin-bottom: 12px;
	&::after {
		content: "";
		pointer-events: none;
		display: block;
		position: absolute;
		z-index: -1;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		margin: auto;
		//width: calc(100% - 8px);
		//height: calc(100% - 8px);
		background: var(--MI_THEME-panelHighlight);
		//border: dashed 2px var(--MI_THEME-focus);
		border-radius: var(--MI-radius);
		box-sizing: border-box;
		opacity: 0;
		transition: opacity .2s, background .2s;
	}

	&:focus-visible {
		outline: none;
		text-decoration: none;
	}

	@media (hover: hover) {
		&:hover {
			outline: none;
			text-decoration: none;
			cursor: pointer;
		}

		&:hover::after {
			opacity: 1;
		}
	}

	.footer {
		position: relative;
		z-index: 1;
	}

	&:hover .footer > .footerButton {
		color: var(--MI_THEME-fg);
	}

	&.showActionsOnlyHover {
		.footer {
			visibility: hidden;
			position: absolute;
			top: 12px;
			right: 12px;
			padding: 0 4px;
			margin-bottom: 0 !important;
			background: var(--MI_THEME-popup);
			border-radius: 8px;
			box-shadow: 0 4px 32px var(--MI_THEME-shadow);
		}

		.footerButton {
			font-size: 90%;

			&:not(:last-child) {
				margin-right: 0;
			}
		}
	}

	&.showActionsOnlyHover:hover {
		.footer {
			visibility: visible;
		}
	}
}

/* 復活枠と失敗/復活の一時演出がノートの外へ出るため、
   宴状態では .root の overflow:clip に切られないようにする。 */
.utageActive {
	overflow: visible;
}

.skipRender {
	// TODO: これが有効だとTransitionGroupでnoteを追加するときに一瞬がくっとなってしまうのをどうにかしたい
	// Transitionが完了するのを待ってからskipRenderを付与すれば解決しそうだけどパフォーマンス的な影響が不明
	content-visibility: auto;
	contain-intrinsic-size: 0 150px;
}

.tip {
	display: flex;
	align-items: center;
	padding: 24px 38px 16px;
	line-height: 24px;
	font-size: 90%;
	white-space: pre;
	color: #d28a3f;
}

.tip + .article {
	padding-top: 8px;
}

.replyTo {
	padding-bottom: 0;

	&.showReplyTargetNoteInSemiTransparent {
		opacity: 0.7;
	}
}

.renote {
	position: relative;
	display: flex;
	align-items: center;
	padding: 24px 38px 16px;
	line-height: 28px;
	white-space: pre;
	color: var(--MI_THEME-renote);

	& + .article {
		padding-top: 8px;
	}
}

.renoteAvatar {
	flex-shrink: 0;
	display: inline-block;
	width: 28px;
	height: 28px;
	margin: 0 8px 0 0;
	background: color-mix(in srgb, var(--MI_THEME-accent) 5%, var(--MI_THEME-panel));
}

.renoteText {
	overflow: hidden;
	flex-shrink: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.renoteUserName {
	font-weight: bold;
	text-decoration: none;

	&:hover {
		color: var(--MI_THEME-renoteHover);
		text-decoration: none;
	}
}

.renoteInfo {
	margin-left: auto;
	font-size: 0.9em;
}

.renoteTime {
	flex-shrink: 0;
	color: inherit;
}

.renoteMenu {
	margin-right: 4px;
}

.collapsedRenoteTarget {
	display: flex;
	align-items: center;
	line-height: 28px;
	white-space: pre;
	padding: 8px 38px 24px;
}

.collapsedRenoteTargetAvatar {
	flex-shrink: 0;
	display: inline-block;
	width: 28px;
	height: 28px;
	margin: 0 8px 0 0;
	background: color-mix(in srgb, var(--MI_THEME-accent) 5%, var(--MI_THEME-panel));
}

.collapsedRenoteTargetText {
	overflow: hidden;
	flex-shrink: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 90%;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}

	&.showReplyTargetNoteInSemiTransparent {
		opacity: 0.7;
	}
}

.article {
	position: relative;
	padding: 10px 10px 6px;
	-webkit-tap-highlight-color: transparent;
}

/* =======================================================================
   旗鯖fork: C7 宴(うたげ)明滅機能のスタイル
   ======================================================================= */
/* 面だけを着色し、文字・アバターの不透明度は変えない。
   実要素なので失敗/復活演出の computed style snapshot にも反映できる。 */
.utageFlashing, .utageFailed, .utageSuccess,
.article[data-utage-square='flashing'],
.article[data-utage-square='failed'],
.article[data-utage-square='success'] {
	isolation: isolate;
}

.utageFlashing, .utageFailed, .utageSuccess {
	border-radius: 16px;
}

.utageSurface {
	position: absolute;
	inset: 0;
	border-radius: inherit;
	z-index: -1;
	pointer-events: none;
}

.utageSurface[data-utage-surface='flashing'] {
	background: var(--MI_THEME-accent);
	opacity: 0.07;
	animation: utageSurfacePulse 2.8s ease-in-out infinite;
}

@keyframes utageSurfacePulse {
	0%, 100% { opacity: 0.07; }
	50% { opacity: 0.21; }
}

.utageSurface[data-utage-surface='failed'] {
	background: var(--MI_THEME-error);
	opacity: 0.15;
}

.utageSurface[data-utage-surface='success'] {
	background: var(--MI_THEME-success);
	opacity: 0.15;
}

.root[data-utage-motion='reduced'] .utageSurface[data-utage-surface='flashing'] {
	animation: none;
	opacity: 0.14;
}

@media (prefers-reduced-motion: reduce) {
	.utageSurface[data-utage-surface='flashing'] {
		animation: none;
		opacity: 0.14;
	}
}

.utageReviving {
	border-radius: 16px;
	outline: 2px solid color-mix(in srgb, var(--MI_THEME-warn) 60%, transparent);
	outline-offset: 2px;
}

/* 吹き出しOFFでは article の四角い面へ着色する。復活枠は従来どおり残す。 */
.article[data-utage-square] {
	position: relative;
}
.article[data-utage-square='reviving'] {
	box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--MI_THEME-warn) 60%, transparent);
}

/* 結果バッジ (右下隅)。背景に関わらず読めるよう、太字+縁取り(text-shadow)で表現。 */
.utageBadge {
	position: absolute;
	right: 12px;
	bottom: 8px;
	z-index: 3;
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 0.82em;
	font-weight: 900;
	pointer-events: none;
	user-select: none;
	/* 明暗どちらの背景でも文字が浮くよう、白縁取りと暗縁取りを重ねる */
	text-shadow:
		0 0 2px var(--MI_THEME-bg),
		0 0 3px var(--MI_THEME-bg),
		0 1px 2px rgba(0, 0, 0, 0.5),
		0 0 4px rgba(255, 255, 255, 0.4);
}

/* 失敗: 赤文字 */
.utageBadgeFailed {
	color: var(--MI_THEME-error);
}

/* 成功: 緑文字 */
.utageBadgeSuccess {
	color: var(--MI_THEME-success);
}
/* C7 宴明滅機能ここまで */

.colorBar {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	border-left: 5px solid transparent;
	border-radius: var(--MI-radius);
	pointer-events: none;
	box-sizing: border-box;
}
/* 旗鯖fork(Hataskey UI 2): article が半透明ガラス面のとき、colorBar は 2 点調整する:
   ① 左オフセット (left: -10px): colorBar の containing block は bubbleBody (article の padding
      10px 内側)。base の `left: 0` だとアバターの左辺と近すぎて重なって見える。article の外側
      左端に揃えるため、article padding-left 相当 (10px) を負の左オフセットで打ち消す。
   ② border-radius を 20px: article の Hataskey UI 2 モードの border-radius と揃え、
      角の丸みが自然に見えるようにする。
   ③ mask-image で下部フェード: リアクション/フッター領域を colorBar が貫通しないよう、
      下部を自然にフェードアウト (DOM 変更なしで視覚的解決)。 */
:global(html.hataGlassUi) .colorBar {
	left: -10px;
	border-radius: 20px;
	-webkit-mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 90%);
	mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 90%);
}

:global(html.hataGlassUi) .article:has(> [data-hk3-visibility-rail]) .bubbleBody .colorBar {
	left: -2px;
}

.avatar {
	flex-shrink: 0;
	display: block !important;
	position: sticky !important;
	margin: 0 14px 0 0;
	width: 58px;
	height: 58px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 5%, var(--MI_THEME-panel));
	transition: top 0.5s;
	cursor: pointer;
	/* 旗鯖fork: 通常表示(非スクロール)時、flexの上端揃えだとアバター中心が
	   吹き出しヘッダー(名前)の高さより上にズレるため、少し下げて中心を合わせる。
	   align-self: flex-start を明示しつつ margin-top で微調整。 */
	align-self: flex-start;
	margin-top: 16px;

	&.useSticky {
		position: sticky !important;
		/* スクロール追従で画面上端に貼り付く位置 */
		top: calc(22px + var(--MI-stickyTop, 0px));
		left: 0;
	}

	&.avatarReplyTo {
		position: relative !important;
		top: 0 !important;
		margin-top: 0;
	}
}

.main {
	flex: 1;
	min-width: 0;
}

.bubbleBody {
	position: relative;
}

.cw {
	cursor: default;
	display: grid;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.showLess {
	width: 100%;
	margin-top: 14px;
	position: sticky;
	bottom: calc(var(--MI-stickyBottom, 0px) + 14px);
}

.showLessLabel {
	display: inline-block;
	background: var(--MI_THEME-popup);
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: 999px;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}

.contentCollapsed {
	position: relative;
	min-height: 4.5em;
	max-height: 9em;
	overflow: clip;
	/* 旗鯖fork: 不透明パネル帯のオーバーレイをやめ、コンテンツ末尾を mask で透過。
	   ノート面が透明/ガラスでも背景に溶けてフェード帯が崩れない。ラベル(.collapsed の
	   上端に来る)は下端36pxのフェード域より上なので鮮明に残る。 */
	-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 36px), transparent 100%);
	mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 36px), transparent 100%);
}

.collapsed {
	display: block;
	position: absolute;
	bottom: 0;
	left: 0;
	z-index: 2;
	width: 100%;
	height: 64px;

	&:hover > .collapsedLabel {
		background: var(--MI_THEME-panelHighlight);
	}
}

.collapsedLabel {
	display: inline-block;
	background: color-mix(in srgb, var(--MI_THEME-accent) 5%, var(--MI_THEME-panel));
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: 999px;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}

.text {
	overflow-wrap: break-word;
}

.replyIcon {
	color: var(--MI_THEME-accent);
	margin-right: 0.5em;

	&:hover {
		text-decoration: none;
	}
}

.replyToText {
	&:hover {
		text-decoration: none;
	}
}

.translation {
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 12px;
	margin-bottom: 12px;
}

.urlPreview {
	margin-top: 8px;
}

.poll {
	font-size: 80%;
}

.quote {
	padding: 8px 0;
}

.quoteNote {
	padding: 24px !important;
	border: dashed 1px var(--MI_THEME-renote);
	border-radius: 8px;
	overflow: clip;
}

.channel {
	opacity: 0.7;
	font-size: 80%;
}

.footer {
	margin: 4px 0 -8px;
}

.footerButton {
	margin: 0;
	padding: 8px;
	touch-action: manipulation;
	color: color-mix(in srgb, var(--MI_THEME-panel), var(--MI_THEME-fg) 70%); // opacityなど不透明度で表現するとレンダリングパフォーマンスに影響するので通常の色の混合で代用

	&:not(:last-child) {
		margin-right: 10px;
	}

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}
}

.footerButtonCount {
	display: inline;
	margin: 0 0 0 8px;
}

.danger {
	color: var(--MI_THEME-accent);
}

.deleteAt {
	margin: 0 0 8px 0;
}

@container (max-width: 580px) {
	.root {
		font-size: 0.95em;
	}

	.renote {
		padding: 24px 28px 16px;
	}

	.collapsedRenoteTarget {
		padding: 8px 28px 24px;
	}

	.article {
		padding: 10px 10px 6px;
	}

	.avatar {
		width: 50px;
		height: 50px;
	}
}

@container (max-width: 500px) {
	.root {
		font-size: 0.9em;
	}

	.article {
		padding: 10px 10px 6px;
	}

	.avatar {
		&.showEl {
			top: 14px;
		}

		&.showElTab {
			top: 54px;
		}
	}

	.footer {
		margin-bottom: -8px;
	}
}

@container (max-width: 480px) {
	.renote {
		padding: 20px 24px 8px;
	}

	.tip {
		padding: 20px 24px 8px;
	}

	.collapsedRenoteTarget {
		padding: 8px 24px 20px;
		margin-top: 4px;
	}

	.article {
		padding: 8px 8px 5px;
	}
}

@container (max-width: 450px) {
	.avatar {
		margin: 0 10px 0 0;
		width: 46px;
		height: 46px;

		&.useSticky {
			top: calc(14px + var(--MI-stickyTop, 0px));
		}
	}
}

@container (max-width: 400px) {
	.root:not(.showActionsOnlyHover) {
		.footerButton {
			&:not(:last-child) {
				margin-right: 2px;
			}
		}
	}
}

@container (max-width: 350px) {
	.root:not(.showActionsOnlyHover) {
		.footerButton {
			&:not(:last-child) {
				margin-right: 2px;
			}
		}
	}

	.colorBar {
		border-left-width: 4px;
	}
}

@container (max-width: 300px) {
	.avatar {
		width: 44px;
		height: 44px;
	}

	.root:not(.showActionsOnlyHover) {
		.footerButton {
			&:not(:last-child) {
				margin-right: 2px;
			}
		}
	}
}

@container (max-width: 250px) {
	.quoteNote {
		padding: 12px;
	}
}

.muted {
	padding: 8px;
	text-align: center;
	opacity: 0.7;
}

.reactionOmitted {
	display: inline-block;
	margin-left: 8px;
	opacity: .8;
	font-size: 95%;
}

.deleted {
	text-align: center;
	padding: 32px;
	margin: 6px 32px 28px;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}

/* =======================================================================
   旗鯖fork(ベータ): グラスUI (html.hataGlassUi の時のみ)
   ・四角ノート(デッキ等・非バブル)は .article をガラス面に。
   ・バブル表示のガラス化は MkStreamingNotesTimeline 側 ([data-bubble] のグローバル)で行う。
   ・ぼかしは --MI-blur (useBlurEffect=false で none にフォールバック)を尊重。
   ======================================================================= */
/* 旗鯖fork(Hataskey UI 2): 従来 `.article` は panel 60% ハードコードだった。
   透過率 CSS 変数の適用先は module CSS の hashed class より、下部の非module `<style>` ブロックで
   tag 要素 `article` を直接ターゲットする方が確実 (module CSS の :global() + module class の
   組合せは Vue SFC の CSS 変換で意図せず動作しないケースがあるため)。詳細は下部 style を参照。 */

/* ラッパの _panel が二重背景にならないよう、ノートroot側の面を消す(グラスは .article が持つ) */
:global(html.hataGlassUi) .root {
	background: transparent;
}

/* アバターを円形に(旗鯖は円形が主流) */
:global(html.hataGlassUi) .avatar {
	border-radius: 50%;
}

/* フッター: ゴーストボタン(hoverでアクセント色+薄背景) */
:global(html.hataGlassUi) .footerButton {
	border-radius: 11px;
	transition: color .15s, background .15s;

	&:hover {
		color: var(--MI_THEME-accent);
		background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
	}
}
</style>

<!-- 旗鯖fork(Hataskey UI 2): 透過率 CSS 変数の適用は非module のグローバル CSS で tag 要素
     `article` を直接ターゲットする。これで MkNote / MkExternalNote / トレンド / クリップ /
     お気に入り / 通知 (reply/quote/mention) など、あらゆる `<article>` 要素を含むノート表示に
     一律で `--htk-glass-card-opacity` が反映される。
     ダーク/ライトで accent tint 濃度を出し分け (18%/8%)。 -->
<style lang="scss">
/* 旗鯖fork: Hatady(.hatady-scope 配下)と Hatask(.htk-root 配下)は独自テーマを持ち、
   <article> を描画する。このグローバルなガラス規則が効くと独自の背景色が崩れるため、
   :not(:where(.hatady-scope *, .htk-root *)) で両者の <article> を除外する
   (:where で詳細度は据え置き、既存の本体ノートのカスケードには影響しない)。 */
html.hataGlassUi article:not(:where(.hatady-scope *, .htk-root *)) {
	border-radius: 20px;
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 18%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
	box-shadow:
		0 2px 10px color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent),
		0 14px 36px color-mix(in srgb, var(--MI_THEME-fg) 8%, transparent);
	-webkit-backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
	backdrop-filter: var(--MI-blur, blur(22px)) saturate(1.6);
}
html[data-color-scheme=light].hataGlassUi article:not(:where(.hatady-scope *, .htk-root *)) {
	background: color-mix(in srgb,
		color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel))
		var(--htk-glass-card-opacity, 55%),
		transparent);
}
</style>
