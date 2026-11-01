<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: タイムラインのノート。ルーム表示(右端にリアクション列)とスレッド展開を持つ。
-->
<template>
<div
	v-if="!hardMuted"
	ref="rootEl"
	data-scroll-anchor
	:class="$style.root"
	:data-size="size"
	:data-thread-reply="threadReply ? 'true' : undefined"
	:data-note-id="note.id"
	:data-renote="isRenote ? 'true' : undefined"
	:data-linked="linked ?? undefined"
	:data-thread-open="threadOpen ? 'true' : undefined"
	:data-utage="utageActive ? 'true' : undefined"
	@mouseenter="hover = true"
	@mouseleave="hover = false"
	@focusin="hover = true"
	@focusout="onFocusOut"
>
	<svg v-if="utageActive" :class="$style.utageFrame" aria-hidden="true">
		<rect x="0" y="0" width="100%" height="100%" pathLength="100" :class="$style.utageTrack"/>
		<rect x="0" y="0" width="100%" height="100%" pathLength="100" :class="$style.utageBar" :stroke-dasharray="`${utageRemain} 100`"/>
	</svg>
	<span v-if="linked" :class="$style.linkBadge"><component :is="linked === 'quote' ? Quote : Reply" :size="12"/>{{ linked === 'quote' ? copy.quoting : copy.replying }}</span>

	<div v-if="softMuted && !showMuted" :class="$style.muted">
		<span>{{ sensitiveMuted && !wordMuted ? copy.sensitiveNote : copy.mutedNote }}</span>
		<button type="button" :class="$style.mutedButton" @click="showMuted = true">{{ i18n.ts.show }}</button>
	</div>
	<article v-else ref="articleEl" :class="$style.article" :style="articleStyle">
		<Hk3VisibilityRail :visibility="appearNote.visibility"/>
		<span v-if="channelColor != null" :class="$style.channelRail" aria-hidden="true"></span>
		<div v-if="hasTintImages && (appearNote.cw == null || showContent)" :class="$style.imageTint" :style="imageTintStyle" :data-tinted="imageEdgeTint && imageTintGeometry ? 'true' : undefined" aria-hidden="true" data-image-edge-tint>
			<span v-for="side in IMAGE_EDGE_SIDES" :key="side" :class="$style.imageGlow" :data-edge="side" :style="{ backgroundColor: imageTintGeometry?.visibleEdges[side] && imageEdgeTint?.[side] ? `rgb(${imageEdgeTint[side]!.join(',')})` : 'transparent' }"></span>
		</div>
		<div v-if="isRenote" :class="$style.renotedBy">
			<div :class="$style.renotedSummary">
				<Repeat2 :size="16" :class="$style.renotedIcon"/>
				<MkA :to="userPage(note.user)" :class="$style.renotedName"><MkUserName :user="note.user"/></MkA>
				<MkTime :time="note.createdAt" :class="$style.renotedTime"/>
				<button ref="unrenoteButtonEl" type="button" data-renote-menu :class="$style.renoteMenuButton" :title="i18n.ts.more" :aria-label="i18n.ts.more" aria-haspopup="menu" :disabled="unrenoteBusy" @click.stop="showRenoteMenu"><Ellipsis :size="16"/></button>
			</div>
			<div v-if="unrenoteConfirmOpen" :class="$style.unrenoteConfirm" role="group" :aria-label="copy.unrenoteConfirm" :aria-busy="unrenoteBusy" @keydown.esc.stop.prevent="cancelUnrenoteConfirm">
				<span :class="$style.unrenoteQuestion">{{ copy.unrenoteConfirm }}</span>
				<div :class="$style.unrenoteConfirmActions">
					<button ref="unrenoteCancelEl" type="button" :class="$style.unrenoteCancel" :disabled="unrenoteBusy" @click.stop="cancelUnrenoteConfirm">{{ i18n.ts.cancel }}</button>
					<button type="button" :class="$style.unrenoteConfirmButton" :disabled="unrenoteBusy" @click.stop="unrenote">{{ copy.unrenoteConfirmAction }}</button>
				</div>
			</div>
		</div>
		<div v-if="!threadReply" :class="$style.avatarCol">
			<MkAvatar :user="appearNote.user" :class="$style.avatar" link preview/>
			<Hk3AudienceIcons v-if="showAudienceIcons || (showLocalOnlyIcon && appearNote.localOnly)" :visibility="appearNote.visibility" :localOnly="appearNote.localOnly" :showVisibility="showAudienceIcons" :class="$style.audienceIcons"/>
			<span v-if="hasThread" :class="$style.threadLine"></span>
		</div>
		<div :class="$style.body">
			<header :class="$style.header">
				<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)" :class="$style.name"><MkUserName :user="appearNote.user"/></MkA>
				<MkUserRoleBadges :user="appearNote.user" :class="$style.roleBadges" style="margin-right: 0;"/>
				<Bot v-if="appearNote.user.isBot" :size="14" :class="$style.muted700"/>
				<span :class="$style.acct">@{{ appearNote.user.username }}<template v-if="appearNote.user.host">@{{ appearNote.user.host }}</template></span>
				<span :class="$style.meta">
					<template v-if="!showAudienceIcons">
						<component :is="visibilityIcon" v-if="visibilityIcon" :size="13"/>
						<GlobeLock v-if="appearNote.localOnly && !showLocalOnlyIcon" :size="13"/>
					</template>
					<MkA :to="notePage(appearNote)" :class="$style.time"><MkTime :time="appearNote.createdAt"/></MkA>
				</span>
			</header>
			<MkA v-if="!threadReply && (appearNote.reply || appearNote.replyId)" :to="appearNote.reply ? notePage(appearNote.reply) : `/notes/${appearNote.replyId}`" :class="$style.replyTo">
				<span :class="$style.replyToHeader"><Reply :size="14" aria-hidden="true"/><span>{{ i18n.ts.reply }}</span><template v-if="appearNote.reply"><b :class="$style.replyToName"><MkUserName :user="appearNote.reply.user"/></b><small :class="$style.replyToAcct">@{{ appearNote.reply.user.username }}<template v-if="appearNote.reply.user.host">@{{ appearNote.reply.user.host }}</template></small></template></span>
				<span v-if="appearNote.reply" :class="$style.replyToText"><template v-if="appearNote.reply.isHidden">({{ i18n.ts._ffVisibility.private }})</template><Mfm v-else-if="appearNote.reply.cw != null || appearNote.reply.text" :text="appearNote.reply.cw ?? appearNote.reply.text ?? ''" :plain="true" :author="appearNote.reply.user" :emojiUrls="appearNote.reply.emojis"/><template v-else>{{ copy.attachmentsOnly }}</template></span>
			</MkA>
			<div v-if="appearNote.cw != null" :class="$style.cw">
				<EyeOff :size="15" :class="$style.muted700"/>
				<Mfm v-if="appearNote.cw !== ''" :text="appearNote.cw" :author="appearNote.user" :nyaize="prefer.r.disableNyaize.value || noNyaize ? false : 'respect'" :class="$style.cwText"/>
				<button type="button" :class="$style.cwButton" :title="copy.toggleContent" :aria-pressed="showContent" @click="showContent = !showContent"><component :is="showContent ? EyeOff : Eye" :size="16"/></button>
			</div>
			<Hk3NoteContent v-if="(appearNote.cw == null || showContent) && (appearNote.text || appearNote.isHidden || viewTextSource || (appearNote.files?.length ?? 0) > 0 || appearNote.poll || quoted)" :collapsible="autoCollapseContent" :animationEnabled="prefer.r.animation?.value ?? prefer.s.animation">
				<p v-if="appearNote.text || appearNote.isHidden" :class="$style.text">
					<span v-if="appearNote.isHidden" :class="$style.muted700">({{ i18n.ts._ffVisibility.private }})</span>
					<Mfm v-if="appearNote.text" :text="appearNote.text" :author="appearNote.user" :nyaize="prefer.r.disableNyaize.value || noNyaize ? false : 'respect'" :emojiUrls="appearNote.emojis" :enableEmojiMenu="true" :enableEmojiMenuReaction="!!$i" class="_selectable"/>
				</p>
				<div v-if="viewTextSource" :class="$style.textSource" data-note-text-source>
					<hr>
					<pre><small>{{ appearNote.text }}</small></pre>
					<button type="button" class="_button" @click.stop="viewTextSource = false"><small>{{ i18n.ts.close }}</small></button>
				</div>
				<div v-if="appearNote.files && appearNote.files.length > 0" ref="mediaEl" :class="$style.media">
					<MkMediaList :mediaList="appearNote.files" :user="appearNote.user" :disableRightClick="appearNote.disableRightClick" fitSingleImage/>
				</div>
				<MkPoll v-if="appearNote.poll" :noteId="appearNote.id" :multiple="appearNote.poll.multiple" :expiresAt="appearNote.poll.expiresAt" :choices="$appearNote.pollChoices" :author="appearNote.user" :emojiUrls="appearNote.emojis"/>
				<MkA v-if="quoted" :to="notePage(quoted)" :class="$style.quote">
					<MkAvatar :user="quoted.user" :class="$style.quoteAvatar"/>
					<div :class="$style.quoteBody">
						<b :class="$style.quoteName"><MkUserName :user="quoted.user"/></b>
						<span :class="$style.quoteText"><template v-if="quoted.isHidden">({{ i18n.ts._ffVisibility.private }})</template><Mfm v-else-if="quoted.cw != null || quoted.text" :text="quoted.cw ?? quoted.text ?? ''" :plain="true" :author="quoted.user" :emojiUrls="quoted.emojis"/><template v-else>{{ copy.attachmentsOnly }}</template></span>
					</div>
					<Quote :size="14" :class="$style.quoteIcon" aria-hidden="true"/>
				</MkA>
			</Hk3NoteContent>
			<MkA v-if="appearNote.channel" :to="`/channels/${appearNote.channel.id}`" :class="$style.channel"><Tv :size="13"/>{{ appearNote.channel.name }}</MkA>
			<div v-if="utageResult" :class="$style.utageBadge" :data-utage-result="utageResult">
				<component :is="utageResult === 'succeeded' ? Check : X" :size="14" aria-hidden="true"/>
				{{ utageResult === 'succeeded' ? i18n.ts._hata._utage.success : i18n.ts._hata._utage.failed }}
			</div>
			<MkUtageStatus v-if="utageRevivalShown" :note="$appearNote"/>

			<div v-if="!sideReactions && reactions.length > 0" :class="$style.rxInline">
				<div ref="inlineEl" :class="$style.rxInlineList" :style="{ maxHeight: rxOpen && inlineOverflow ? `${inlineOverflow}px` : inlineCollapsedHeight ? `${inlineCollapsedHeight}px` : undefined }">
					<XReaction v-for="r in reactions" :key="r.reaction" custom :noteId="appearNote.id" :note="appearNote" :reaction="r.reaction" :reactionEmojis="$appearNote.reactionEmojis" :myReaction="$appearNote.myReaction" :count="r.count" :isInitial="true" :class="$style.chip" :data-reaction="r.reaction" :data-mine="r.mine ? 'true' : undefined" :aria-label="r.title" @activate="toggleReaction(r.reaction, $event)">
						<span :class="[$style.emojiBox, $style.chipEmoji]"><MkReactionIcon :reaction="r.reaction" :emojiUrl="$appearNote.reactionEmojis[emojiKey(r.reaction)]"/></span>{{ r.count }}
					</XReaction>
					<button v-if="canAddReaction" type="button" :class="$style.chipAdd" :title="copy.addReaction" @click="react($event)"><SmilePlus :size="18"/></button>
				</div>
				<button v-if="inlineOverflow" type="button" :class="$style.chipMore" :data-open="rxOpen ? 'true' : undefined" :title="copy.allReactions" @click="rxOpen = !rxOpen">
					<component :is="rxOpen ? ChevronUp : ChevronDown" :size="16"/>{{ rxOpen || !inlineHidden ? '' : `+${inlineHidden}` }}
				</button>
			</div>

			<div v-if="size === 'sm' || threadReply" :class="$style.smActions">
				<button v-for="a in actions" :key="a.id" type="button" :class="$style.smAction" :data-active="a.active ? 'true' : undefined" :title="a.label" :aria-label="a.label" @click="a.run($event)"><component :is="a.icon" :size="17"/><span v-if="a.count">{{ a.count }}</span></button>
			</div>

			<button v-if="hasThread" type="button" :class="$style.convButton" :data-open="threadOpen ? 'true' : undefined" :aria-expanded="threadOpen" :title="copy.conversation" @click="toggleThread">
				<span :class="$style.convFaces">
					<MkAvatar v-for="u in participants" :key="u.id" :user="u" :class="$style.convFace"/>
				</span>
				<span :class="$style.convCount"><MessageCircle :size="17"/>{{ appearNote.repliesCount }}</span>
				<ChevronDown :size="18" :class="$style.convChevron"/>
			</button>
		</div>

		<div v-if="sideReactions" ref="sideEl" :class="$style.side" :style="{ minHeight: rxOpen && sideOverflow ? `${Math.max(100, sideLayoutRows * 56 - 14)}px` : undefined }">
			<!-- CSS grid だと付与・変更直後の枠が一部しか描かれない環境があるため、位置を明示して並べる。 -->
			<div :class="$style.sideGrid">
				<XReaction v-for="(r, i) in sideList" :key="r.reaction" custom :noteId="appearNote.id" :note="appearNote" :reaction="r.reaction" :reactionEmojis="$appearNote.reactionEmojis" :myReaction="$appearNote.myReaction" :count="r.count" :isInitial="true" :class="$style.sideChip" :style="sideCell(i)" :data-reaction="r.reaction" :data-mine="r.mine ? 'true' : undefined" :aria-label="r.title" @activate="toggleReaction(r.reaction, $event)">
					<span :class="[$style.emojiBox, $style.sideEmoji]"><MkReactionIcon :reaction="r.reaction" :emojiUrl="$appearNote.reactionEmojis[emojiKey(r.reaction)]"/></span>
					<span>{{ r.count }}</span>
				</XReaction>
				<button v-if="canAddReaction" type="button" :class="$style.sideAdd" :style="sideCell(sideList.length)" :title="copy.addReaction" @click="react($event)"><SmilePlus :size="18"/></button>
				<button v-if="sideOverflow" type="button" :class="$style.sideMore" :style="sideCell(sideList.length + (canAddReaction ? 1 : 0))" :data-open="rxOpen ? 'true' : undefined" :aria-expanded="rxOpen" :title="copy.allReactions" @click="rxOpen = !rxOpen">
					<component :is="rxOpen ? ChevronRight : ChevronLeft" :size="15"/>{{ rxOpen ? '' : `+${reactions.length - sideCap}` }}
				</button>
			</div>
		</div>
		<Hk3InstanceBadge v-if="appearNote.user.host" :host="appearNote.user.host" :instance="appearNote.user.instance" :class="$style.host" :data-position="instanceBadgePosition"/>
	</article>

	<div v-if="size === 'lg' && !threadReply && (hover || menuOpen)" :class="$style.hoverBar" :style="{ right: `${sideReactions ? sideWidth + 32 : 12}px` }">
		<button v-for="a in actions" :key="a.id" type="button" :class="$style.hoverAction" :data-active="a.active ? 'true' : undefined" :title="a.label" :aria-label="a.label" @click="a.run($event)"><component :is="a.icon" :size="18"/><span v-if="a.count">{{ a.count }}</span></button>
	</div>

	<div v-if="hasThread" :class="$style.tree" :inert="!threadOpen" :data-open="threadOpen ? 'true' : undefined">
		<div :class="$style.treeInner">
			<div :class="$style.treeList">
				<div v-if="threadLoading" :class="$style.treeLoading"><MkLoading :em="true"/></div>
				<div v-for="(r, i) in replies" :key="r.id" :class="$style.treeRow" :style="{ '--hk3-delay': `${120 + i * 70}ms` }">
					<div :class="$style.treeRail"><span :class="$style.treeRailV"></span><span :class="$style.treeRailH"></span></div>
					<div :class="$style.treeAvatarCol">
						<MkAvatar :user="(getAppearNote(r) ?? r).user" :class="$style.treeAvatar" link preview/>
						<Hk3AudienceIcons v-if="showAudienceIcons || (showLocalOnlyIcon && (getAppearNote(r) ?? r).localOnly)" :visibility="(getAppearNote(r) ?? r).visibility" :localOnly="(getAppearNote(r) ?? r).localOnly" :showVisibility="showAudienceIcons" tiny :class="$style.audienceIcons"/>
					</div>
					<Hk3Note :note="r" :size="size" threadReply :showAudienceIcons="showAudienceIcons" :showLocalOnlyIcon="showLocalOnlyIcon" :hideSensitive="hideSensitive" :inLocal="inLocal" :inSocial="inSocial" :instanceBadgePosition="instanceBadgePosition" :class="$style.treeBubble"/>
				</div>
				<div :class="$style.treeRow" :style="{ '--hk3-delay': `${120 + replies.length * 70}ms` }">
					<div :class="$style.treeRail"><span :class="[$style.treeRailV, $style.treeRailEnd]"></span><span :class="$style.treeRailH"></span></div>
					<MkAvatar v-if="$i" :user="$i" :class="$style.treeAvatar"/>
					<button type="button" :class="$style.treeReply" @click="reply"><Reply :size="16"/><span>{{ copy.reply }}</span><ArrowDown :size="16"/></button>
				</div>
			</div>
		</div>
	</div>
	<Hk3ConfirmBubble v-if="unreactAnchor" :anchor="unreactAnchor" :text="i18n.ts.cancelReactionConfirm" :okLabel="i18n.ts.ok" :cancelLabel="i18n.ts.cancel" @ok="confirmUnreact" @cancel="unreactAnchor = null"/>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import { ArrowDown, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Ellipsis, Eye, EyeOff, House, Lock, Mail, MessageCircle, Quote, Repeat2, Reply, GlobeLock, SmilePlus, Tv, X } from '@lucide/vue';
import type { Component } from 'vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkUserRoleBadges from '@/components/MkUserRoleBadges.vue';
import XReaction from '@/components/MkReactionsViewer.reaction.vue';
import { useHk3Reactions } from './use-hk3-reactions.js';
import Hk3ConfirmBubble from './Hk3ConfirmBubble.vue';
import Hk3InstanceBadge from './Hk3InstanceBadge.vue';
import Hk3AudienceIcons from './Hk3AudienceIcons.vue';
import Hk3NoteContent from './Hk3NoteContent.vue';
import Hk3VisibilityRail from './Hk3VisibilityRail.vue';
import { IMAGE_EDGE_SIDES, observeImageEdgeTint } from './hk3-image-edge-tint.js';
import type { ImageEdgeTint, ImageEdgeTintGeometry } from './hk3-image-edge-tint.js';
import MkUtageStatus from '@/components/MkUtageStatus.vue';
import * as os from '@/os.js';
import * as sound from '@/utility/sound.js';
import { $i } from '@/i.js';
import { DI } from '@/di.js';
import { customEmojisMap } from '@/custom-emojis.js';
import { globalEvents } from '@/events.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { getAbuseNoteMenu, getCopyNoteLinkMenu, getNoteMenu, getRenoteMenu } from '@/utility/get-note-menu.js';
import { requestNoteActionConfirmation } from '@/utility/note-action-confirmation.js';
import { noteEvents, useNoteCapture } from '@/composables/use-note-capture.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { getAppearNote } from '@/utility/get-appear-note.js';
import { pleaseLogin } from '@/utility/please-login.js';
import { notePage } from '@@/js/note.js';
import type { MenuItem } from '@/types/menu.js';
import { userPage } from '@/filters/user.js';
import { shouldCollapsed, shouldMfmCollapsed } from '@@/js/collapsed.js';
import { parseMfmCached } from '@/utility/mfm-cache.js';
import { extractUrlFromMfm } from '@/utility/extract-url-from-mfm.js';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	size?: 'lg' | 'sm';
	linked?: 'reply' | 'quote' | null;
	inLocal?: boolean;
	inSocial?: boolean;
	hideSensitive?: boolean;
	threadReply?: boolean;
	showAudienceIcons?: boolean;
	showLocalOnlyIcon?: boolean;
	instanceBadgePosition?: 'left' | 'right';
}>(), {
	size: 'lg',
	linked: null,
	inLocal: false,
	inSocial: false,
	hideSensitive: false,
	threadReply: false,
	showAudienceIcons: false,
	showLocalOnlyIcon: false,
	instanceBadgePosition: 'right',
});

const copy = i18n.ts._hata._hataskeyUi3;
const note = props.note;
const isRenote = Misskey.note.isPureRenote(note);
const isMyRenote = isRenote && $i?.id === note.userId;
const appearNote = getAppearNote(note) ?? note;
const { $note: $appearNote, subscribe: subscribeNoteCapture } = useNoteCapture({ note: appearNote, parentNote: note });
// MkNote と同じ、本文側のチャンネルに設定されたCSS色をそのまま使う。
const channelColor = computed(() => appearNote.channel?.color?.trim() || null);

const rootEl = shallowRef<HTMLElement | null>(null);
const sideEl = shallowRef<HTMLElement | null>(null);
const inlineEl = shallowRef<HTMLElement | null>(null);
const hover = ref(false);
const menuOpen = ref(false);
const viewTextSource = ref(false);
const noNyaize = ref(false);
const unrenoteBusy = ref(false);
let ownUnrenoteInFlight: Promise<void> | undefined;
const unrenoteConfirmOpen = ref(false);
let unrenoteConfirmAccountId: string | null = null;
const unrenoteButtonEl = shallowRef<HTMLButtonElement | null>(null);
const unrenoteCancelEl = shallowRef<HTMLButtonElement | null>(null);
const showContent = ref(false);
const showMuted = ref(false);
const rxOpen = ref(false);
const sideRows = ref(2);
const sideMaxCols = ref(2);
const inlineOverflow = ref(0);
const inlineHidden = ref(0);
const inlineCollapsedHeight = ref(0);
const threadOpen = ref(false);
const threadLoading = ref(false);
const replies = ref<Misskey.entities.Note[]>([]);
const now = ref(Date.now());

const hardMuted = computed(() => $i != null && checkWordMute(note, $i, $i.hardMutedWords ?? []) !== false);
const wordMuted = computed(() => $i != null && checkWordMute(note, $i, $i.mutedWords ?? []) !== false);
// 「センシティブを表示」が無効のときも一覧からは消さず、通常UIと同じく畳んで見せる。
const sensitiveMuted = computed(() => props.hideSensitive && (appearNote.files ?? []).some(file => file.isSensitive));
const softMuted = computed(() => wordMuted.value || sensitiveMuted.value);
const hasTintImages = computed(() => appearNote.files?.some(file => file.type.startsWith('image/')));
const articleEl = shallowRef<HTMLElement | null>(null);
const mediaEl = shallowRef<HTMLElement | null>(null);
const imageEdgeTint = shallowRef<ImageEdgeTint | null>(null);
const imageTintGeometry = shallowRef<ImageEdgeTintGeometry | null>(null);
const imageTintStyle = computed(() => {
	const rect = imageTintGeometry.value;
	if (!rect) return {};
	return {
		'--image-left': `${rect.left}px`,
		'--image-top': `${rect.top}px`,
		'--image-width': `${rect.width}px`,
		'--image-height': `${rect.height}px`,
		'--image-mid-x': `${rect.centerX}px`,
		'--image-mid-y': `${rect.centerY}px`,
		'--image-reach-x': `${Math.min(140, Math.max(56, rect.width * 0.2))}px`,
		'--image-reach-y': `${Math.min(140, Math.max(56, rect.height * 0.2))}px`,
	};
});
let stopImageTint: (() => void) | undefined;
watch(mediaEl, element => {
	stopImageTint?.();
	imageEdgeTint.value = null;
	imageTintGeometry.value = null;
	stopImageTint = element && articleEl.value ? observeImageEdgeTint(element, tint => {
		imageEdgeTint.value = tint;
		if (!tint) imageTintGeometry.value = null;
	}, { geometry: { relativeTo: articleEl.value, apply: geometry => { imageTintGeometry.value = geometry; } } }) : undefined;
}, { flush: 'post' });
const quoted = computed(() => (!isRenote && appearNote.renote) ? appearNote.renote : null);
const noteUrls = appearNote.text ? extractUrlFromMfm(parseMfmCached(appearNote.text))
	.filter(url => appearNote.renote?.url !== url && appearNote.renote?.uri !== url) : [];
const longContent = shouldCollapsed(appearNote, noteUrls);
const mfmContent = shouldMfmCollapsed(appearNote);
const autoCollapseContent = computed(() => !!(appearNote.cw == null && (
	(longContent && (prefer.r.collapseLongNoteContent?.value ?? prefer.s.collapseLongNoteContent)) ||
	(mfmContent && (prefer.r.collapseDefault?.value ?? prefer.s.collapseDefault)) ||
	((appearNote.files?.length ?? 0) > 0 && (prefer.r.allMediaNoteCollapse?.value ?? prefer.s.allMediaNoteCollapse))
)));
const hasThread = computed(() => !props.threadReply && (appearNote.repliesCount ?? 0) > 0);
const sideReactions = computed(() => props.size === 'lg' && !props.threadReply);

function emojiKey(reaction: string): string {
	return reaction.replace(/:/g, '').replace(/@\.$/, '');
}

const visibilityIcon = computed<Component | null>(() => ({ public: null, home: House, followers: Lock, specified: Mail } as Record<string, Component | null>)[appearNote.visibility] ?? null);

type ReactionEntry = { reaction: string; count: number; mine: boolean; title: string };
const visibleReactionCounts = useHk3Reactions(appearNote.id, () => $appearNote.reactions, () => $appearNote.myReaction);
const reactions = computed<ReactionEntry[]>(() => Object.entries(visibleReactionCounts.value)
	.filter(([, count]) => count > 0)
	.sort((a, b) => b[1] - a[1])
	.map(([reaction, count]) => ({ reaction, count, mine: $appearNote.myReaction === reaction, title: `${reaction.replace(/^:(.+?)(@\.)?:$/, ':$1:')} ${count}` })));

// リアクションが付いた・増えた・自分のものに変わったときは、その絵文字をふんわり膨らませて知らせる。
const reactionMotion = () => prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
watch(() => reactions.value.map(r => `${r.reaction}\u0000${r.count}\u0000${r.mine ? 1 : 0}`).join('\u0001'), (_now, before) => {
	if (!reactionMotion()) return;
	const previous = new Map((before ?? '').split('\u0001').filter(Boolean).map(entry => {
		const [reaction, count, mine] = entry.split('\u0000');
		return [reaction, { count: Number(count), mine: mine === '1' }] as const;
	}));
	const grown = reactions.value.filter(r => {
		const old = previous.get(r.reaction);
		return old == null || r.count > old.count || (r.mine && !old.mine);
	}).map(r => r.reaction);
	if (grown.length === 0) return;
	void nextTick(() => {
		for (const button of rootEl.value?.querySelector(':scope > article')?.querySelectorAll<HTMLElement>('[data-reaction]') ?? []) {
			if (!grown.includes(button.dataset.reaction ?? '')) continue;
			button.animate([
				{ opacity: 0.4, transform: 'scale(0.86)' },
				{ opacity: 1, transform: 'scale(1.04)', offset: 0.6 },
				{ opacity: 1, transform: 'scale(1)' },
			], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
			button.firstElementChild?.animate([
				{ transform: 'translateY(4px) scale(0.5)', opacity: 0 },
				{ transform: 'translateY(-2px) scale(1.18)', opacity: 1, offset: 0.55 },
				{ transform: 'translateY(0) scale(1)', opacity: 1 },
			], { duration: 520, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
		}
	});
});

// 右端のリアクション列: 通常は本文の高さに収まる2列。展開時も本文の幅を残す。
const SIDE_COLS = 2;
const sideCapacity = computed(() => sideRows.value * SIDE_COLS);
// 自分のリアクションが付いている間は、絵文字の横の追加ボタンを出さない(変更は他の絵文字を押す)。
const canAddReaction = computed(() => !$appearNote.myReaction);
const sideFitsAll = computed(() => reactions.value.length + (canAddReaction.value ? 1 : 0) <= sideCapacity.value);
const sideCap = computed(() => sideFitsAll.value ? reactions.value.length : Math.max(0, sideCapacity.value - (canAddReaction.value ? 2 : 1)));
const sideOverflow = computed(() => !sideFitsAll.value);
const sideList = computed(() => rxOpen.value ? reactions.value : reactions.value.slice(0, sideCap.value));
const sideCols = computed(() => {
	if (!rxOpen.value || !sideOverflow.value) return SIDE_COLS;
	return Math.min(sideMaxCols.value, Math.max(SIDE_COLS, Math.ceil((reactions.value.length + (canAddReaction.value ? 2 : 1)) / sideRows.value)));
});
const sideLayoutRows = computed(() => rxOpen.value && sideOverflow.value
	? Math.max(sideRows.value, Math.ceil((reactions.value.length + (canAddReaction.value ? 2 : 1)) / sideCols.value))
	: sideRows.value);
const sideWidth = computed(() => sideCols.value * 58 + 10);

watch(sideOverflow, overflow => { if (sideReactions.value && !overflow) rxOpen.value = false; });

// 幅の上限を超えた分は下へ並べ、すべてのリアクションと閉じるボタンを枠内に収める。
function sideCell(index: number) {
	return { left: `${Math.floor(index / sideLayoutRows.value) * 58}px`, top: `${(index % sideLayoutRows.value) * 56}px` };
}

const articleStyle = computed(() => ({
	gridTemplateColumns: props.threadReply ? 'minmax(0, 1fr)' : `var(--hk3-note-avatar-size) minmax(0, 1fr)${sideReactions.value ? ` ${sideWidth.value}px` : ''}`,
	'--hk3-channel-color': channelColor.value ?? undefined,
}));

// 宴(うたげ): ローカル/ソーシャルTLにあるローカル投稿の残り時間を枠のゲージとして描く。
const UTAGE_WINDOW_MS = 15 * 60 * 1000;
const UTAGE_EXPIRE_MS = 6 * 60 * 60 * 1000;
const utageDisplayUntil = new Date(appearNote.createdAt).getTime() + UTAGE_EXPIRE_MS;
const utageTarget = computed(() => (props.inLocal || props.inSocial) && appearNote.user.host === null && $appearNote.utageStatus != null);
const utageShown = computed(() => utageTarget.value && now.value < utageDisplayUntil);
// 確定結果にはintervalを増やさず、6時間の表示境界だけで再評価する。
watch(utageTarget, (target, _, cleanup) => {
	now.value = Date.now();
	const remaining = utageDisplayUntil - now.value;
	if (!target || !Number.isFinite(remaining) || remaining <= 0) return;
	const timer = window.setTimeout(() => { now.value = Date.now(); }, remaining);
	cleanup(() => window.clearTimeout(timer));
}, { immediate: true });
const utageActive = computed(() => utageShown.value && ($appearNote.utageStatus === 'running' || $appearNote.utageStatus === 'reviving'));
const utageRemain = computed(() => {
	const reviving = $appearNote.utageStatus === 'reviving';
	const expiresAt = Date.parse((reviving ? $appearNote.utageRevival?.expiresAt : $appearNote.utageExpiresAt) ?? '');
	const duration = reviving ? expiresAt - Date.parse($appearNote.utageRevival?.startedAt ?? '') : UTAGE_WINDOW_MS;
	if (!Number.isFinite(expiresAt) || !Number.isFinite(duration) || duration <= 0) return 100;
	return Math.max(0, Math.min(100, (expiresAt - now.value) / duration * 100));
});
// 復活の記録がある結果は共有表示に任せ、通常結果を重ねない。
const utageResult = computed(() => utageShown.value && $appearNote.utageRevival == null
	&& ($appearNote.utageStatus === 'succeeded' || $appearNote.utageStatus === 'failed')
	? $appearNote.utageStatus : null);
const utageRevivalShown = computed(() => utageShown.value && $appearNote.utageRevival != null
	&& ($appearNote.utageStatus === 'reviving' || $appearNote.utageStatus === 'succeeded' || $appearNote.utageStatus === 'failed'));
watch(utageActive, (active, _, cleanup) => {
	if (!active) return;
	now.value = Date.now();
	const timer = window.setInterval(() => { now.value = Date.now(); }, 1000);
	cleanup(() => window.clearInterval(timer));
}, { immediate: true });

const participants = computed(() => {
	const seen = new Set<string>();
	const users: Misskey.entities.UserLite[] = [];
	for (const user of [appearNote.user, ...replies.value.map(r => r.user)]) {
		if (seen.has(user.id)) continue;
		seen.add(user.id);
		users.push(user);
	}
	return users.slice(0, 4);
});

type Action = { id: string; label: string; icon: Component; count?: number | string; active?: boolean; run: (ev: MouseEvent) => void };
const actions = computed<Action[]>(() => {
	const list: Action[] = [
		{ id: 'reply', label: copy.reply, icon: Reply, count: appearNote.repliesCount || '', active: props.linked === 'reply', run: () => reply() },
		{ id: 'renote', label: i18n.ts.renote, icon: Repeat2, count: appearNote.renoteCount || '', run: ev => renote(ev) },
		{ id: 'quote', label: i18n.ts.quote, icon: Quote, active: props.linked === 'quote', run: () => quote() },
	];
	// 標準表示(lg)では右のリアクション列に追加ボタンを置く。列に収まりきらず展開が要るほど多いときだけ、操作バーにも出す。
	const reactInBar = sideReactions.value ? sideOverflow.value && canAddReaction.value : reactions.value.length === 0;
	if (reactInBar) list.push({ id: 'react', label: copy.addReaction, icon: SmilePlus, run: ev => react(ev) });
	list.push({ id: 'more', label: i18n.ts.more, icon: Ellipsis, run: ev => showMenu(ev) });
	return list;
});

function onFocusOut(ev: FocusEvent) {
	if (!rootEl.value?.contains(ev.relatedTarget as Node | null)) hover.value = false;
}

function reply() {
	pleaseLogin();
	if (!$i) return;
	void os.post({ reply: appearNote, channel: appearNote.channel });
}

function quote() {
	pleaseLogin();
	if (!$i) return;
	void os.post({ renote: appearNote, channel: appearNote.channel?.isPrivate ? appearNote.channel : undefined });
}

async function renote(ev: MouseEvent) {
	pleaseLogin();
	if (!$i) return;
	const anchor = ev.currentTarget as HTMLElement;
	const { menu } = await getRenoteMenu({ note, renoteButton: shallowRef<HTMLElement | null>(anchor) });
	menuOpen.value = true;
	os.popupMenu(menu, anchor).finally(() => { menuOpen.value = false; });
	subscribeNoteCapture();
}

function showMenu(ev: MouseEvent) {
	const anchor = ev.currentTarget as HTMLElement;
	const { menu, cleanup } = getNoteMenu({ note, viewTextSource, noNyaize });
	menuOpen.value = true;
	os.popupMenu(menu, anchor).finally(() => {
		menuOpen.value = false;
		cleanup();
	});
}

function showRenoteMenu(ev: MouseEvent) {
	if (!Misskey.note.isPureRenote(note) || unrenoteBusy.value) return;
	let confirmUnrenote = false;
	const menu: MenuItem[] = [
		{ type: 'link', text: i18n.ts.renoteDetails, icon: 'ti ti-info-circle', to: notePage(note) },
		getCopyNoteLinkMenu(note, i18n.ts.copyLinkRenote),
	];
	menu.push({ type: 'divider' });
	if (isMyRenote) {
		menu.push({ text: i18n.ts.unrenote, icon: 'ti ti-trash', danger: true, action: () => { confirmUnrenote = true; } });
	} else {
		menu.push(getAbuseNoteMenu(note, i18n.ts.reportAbuseRenote));
		if ($i?.isAdmin || $i?.isModerator) {
			menu.push({ text: i18n.ts.unrenote, icon: 'ti ti-trash', danger: true, action: moderateUnrenote });
		}
	}
	menuOpen.value = true;
	os.popupMenu(menu, ev.currentTarget as HTMLElement).finally(() => {
		menuOpen.value = false;
		// メニューのフォーカス復帰後に帯内の確認へ移す。
		if (confirmUnrenote) void openUnrenoteConfirm();
	});
}

async function moderateUnrenote() {
	if (unrenoteBusy.value || !Misskey.note.isPureRenote(note) || !($i?.isAdmin || $i?.isModerator)) return;
	unrenoteBusy.value = true;
	try {
		await os.apiWithDialog('notes/delete', { noteId: note.id });
		globalEvents.emit('noteDeleted', note.id);
	} catch {
		// apiWithDialog displays the error; retain the wrapper and allow retry.
		unrenoteBusy.value = false;
	}
}

async function openUnrenoteConfirm() {
	if (unrenoteBusy.value || unrenoteConfirmOpen.value || !$i || $i.id !== note.userId || !Misskey.note.isPureRenote(note)) return;
	const accountId = $i.id;
	if (requestNoteActionConfirmation({ kind: 'unrenote', note, run: () => runOwnUnrenote(accountId) })) return;
	unrenoteConfirmAccountId = accountId;
	unrenoteConfirmOpen.value = true;
	await nextTick();
	unrenoteCancelEl.value?.focus();
}

function cancelUnrenoteConfirm() {
	if (unrenoteBusy.value || !unrenoteConfirmOpen.value) return;
	unrenoteConfirmOpen.value = false;
	unrenoteConfirmAccountId = null;
	void nextTick(() => unrenoteButtonEl.value?.focus());
}

function runOwnUnrenote(accountId: string): Promise<void> {
	if (ownUnrenoteInFlight) return ownUnrenoteInFlight;
	if (unrenoteBusy.value || !$i || $i.id !== accountId || accountId !== note.userId || !Misskey.note.isPureRenote(note)) return Promise.reject(new Error(i18n.ts.error));
	unrenoteBusy.value = true;
	ownUnrenoteInFlight = (async () => {
		await misskeyApi('notes/delete', { noteId: note.id });
		globalEvents.emit('noteDeleted', note.id);
	})().catch(error => {
		unrenoteBusy.value = false;
		throw error;
	}).finally(() => { ownUnrenoteInFlight = undefined; });
	return ownUnrenoteInFlight;
}

async function unrenote() {
	if (!unrenoteConfirmOpen.value || !unrenoteConfirmAccountId) return;
	try {
		await runOwnUnrenote(unrenoteConfirmAccountId);
	} catch (error) {
		await os.alert({ type: 'error', text: error instanceof Error ? error.message : i18n.ts.error });
	}
}

provide(DI.mfmEmojiReactCallback, reaction => {
	if (!$i) return;
	void createReaction(reaction).catch(() => { /* apiWithDialog がエラーを表示する。 */ });
});

async function createReaction(reaction: string) {
	const me = $i;
	if (!me) return;
	await os.apiWithDialog('notes/reactions/create', { noteId: appearNote.id, reaction }, undefined, undefined, { showSuccess: false });
	sound.playMisskeySfx('reaction');
	noteEvents.emit(`reacted:${appearNote.id}`, { userId: me.id, reaction });
}

async function changeReaction(reaction: string, confirmed = false) {
	const me = $i;
	if (!me) return;
	try {
		const oldReaction = $appearNote.myReaction;
		if (oldReaction) {
			if (!confirmed) {
				const confirm = await os.confirm({ type: 'warning', text: oldReaction !== reaction ? i18n.ts.changeReactionConfirm : i18n.ts.cancelReactionConfirm });
				if (confirm.canceled) return;
			}
			await os.apiWithDialog('notes/reactions/delete', { noteId: appearNote.id }, undefined, undefined, { showSuccess: false });
			noteEvents.emit(`unreacted:${appearNote.id}`, { userId: me.id, reaction: oldReaction });
			if (oldReaction !== reaction) await createReaction(reaction);
			return;
		}
		await createReaction(reaction);
	} catch {
		// apiWithDialog がエラーを表示する。失敗した操作の成功イベントは送らない。
	}
}

function react(ev: MouseEvent) {
	pleaseLogin();
	if (!$i) return;
	if (appearNote.reactionAcceptance === 'likeOnly') {
		void changeReaction('❤️');
		return;
	}
	const anchor = ev.currentTarget as HTMLElement;
	reactionPicker.show(anchor, note, async reaction => {
		if (prefer.s.confirmOnReact) {
			const confirm = await os.confirm({ type: 'question', text: i18n.tsx.reactAreYouSure({ emoji: reaction.replace('@.', '') }) });
			if (confirm.canceled) return;
		}
		await changeReaction(reaction);
	});
}

function toggleReaction(reaction: string, ev: MouseEvent) {
	pleaseLogin();
	if (!$i) return;
	// 自分のリアクションを外す確認は、外部絵文字の代替選択より先に行う。
	if ($appearNote.myReaction === reaction) {
		unreactAnchor.value = ev.currentTarget as HTMLElement;
		return;
	}
	const remote = reaction.match(/^:([^:@]+)@([^:]+):$/);
	if (remote && remote[2] !== '.') {
		const localName = remote[1];
		if (!prefer.s.reactableRemoteReactionEnabled || !customEmojisMap.has(localName)) {
			react(ev);
			return;
		}
		void createReaction(`:${localName}:`).catch(() => { /* apiWithDialog がエラーを表示する。 */ });
		return;
	}

	void changeReaction(reaction);
}

const unreactAnchor = shallowRef<HTMLElement | null>(null);

function confirmUnreact() {
	const reaction = $appearNote.myReaction;
	unreactAnchor.value = null;
	if (reaction) void changeReaction(reaction, true);
}

async function toggleThread() {
	threadOpen.value = !threadOpen.value;
	if (!threadOpen.value || replies.value.length > 0 || threadLoading.value) return;
	threadLoading.value = true;
	try {
		replies.value = (await misskeyApi('notes/replies', { noteId: appearNote.id, limit: 10 })).slice().reverse();
	} catch {
		threadOpen.value = false;
	} finally {
		threadLoading.value = false;
	}
}

function measure() {
	const side = sideEl.value;
	if (side) {
		const article = articleEl.value;
		if (article) {
			const style = window.getComputedStyle(article);
			const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
			const avatar = Number.parseFloat(style.getPropertyValue('--hk3-note-avatar-size')) || 44;
			const gap = Number.parseFloat(style.columnGap) || 0;
			const available = Math.max(0, article.clientWidth - padding - avatar - gap * 2);
			// Gridの列幅に依存しない外枠から上限を決め、本文に少なくとも半分を残す。
			sideMaxCols.value = Math.max(SIDE_COLS, Math.floor((available / 2 - 10) / 58));
		}
		// 展開した幅で本文が折り返すと高さも変わる。展開中に行数へ戻すと幅と高さが振動する。
		if (!rxOpen.value) {
			const rows = Math.max(1, Math.floor((side.clientHeight + 14) / 56));
			if (rows !== sideRows.value) sideRows.value = rows;
		}
	}
	const inline = inlineEl.value;
	if (inline && inline.children.length > 0) {
		const children = Array.from(inline.children) as HTMLElement[];
		const firstTop = children[0].offsetTop;
		const visibleRows = props.size === 'sm' && rootEl.value?.closest('[data-mobile="true"]') ? 3 : 1;
		let row = 1;
		let rowTop = firstTop;
		let collapsedHeight = 0;
		let fullHeight = 0;
		let hidden = 0;
		let hiddenReactions = 0;
		for (const child of children) {
			if (child.offsetTop > rowTop + 2) {
				row++;
				rowTop = child.offsetTop;
			}
			const bottom = child.offsetTop - firstTop + child.offsetHeight;
			fullHeight = Math.max(fullHeight, bottom);
			if (row <= visibleRows) collapsedHeight = Math.max(collapsedHeight, bottom);
			else {
				hidden++;
				if (child.hasAttribute('data-reaction')) hiddenReactions++;
			}
		}
		inlineCollapsedHeight.value = collapsedHeight;
		inlineOverflow.value = hidden ? Math.max(inline.scrollHeight, fullHeight) : 0;
		inlineHidden.value = hiddenReactions;
		if (!hidden) rxOpen.value = false;
	}
}

let resizeObserver: ResizeObserver | null = null;
let measureFrame = 0;

function scheduleMeasure() {
	window.cancelAnimationFrame(measureFrame);
	measureFrame = window.requestAnimationFrame(measure);
}

onMounted(() => {
	resizeObserver = new ResizeObserver(scheduleMeasure);
	if (rootEl.value) resizeObserver.observe(rootEl.value);
	scheduleMeasure();
});
watch(reactions, () => nextTick(scheduleMeasure));
// The overflow control takes width from the list without resizing the note itself.
watch([inlineOverflow, inlineHidden], () => nextTick(scheduleMeasure));

onBeforeUnmount(() => {
	stopImageTint?.();
	resizeObserver?.disconnect();
	window.cancelAnimationFrame(measureFrame);
});
</script>

<style lang="scss" module>
.root {
	--hk3-note-avatar-size: 44px;
	position: relative;
	border-bottom: 1px solid var(--hk3-divider);
	background: transparent;
	transition: background 380ms ease, box-shadow 380ms ease;

	&[data-linked] {
		background: radial-gradient(ellipse 90% 120% at 0 0, color-mix(in srgb, var(--hk3-accent) 10%, transparent), transparent 82%), color-mix(in srgb, var(--hk3-accent-100) 24%, transparent);
		box-shadow: inset 0 0 32px color-mix(in srgb, var(--hk3-accent) 6%, transparent);
	}
	&[data-utage] { background: var(--hk3-accent-100); }
	&[data-size="sm"] { --hk3-note-avatar-size: 36px; }
}

:global([data-mobile="true"]) .root[data-size="sm"]:not([data-thread-reply]) {
	--hk3-note-avatar-size: 40px;
}

.root[data-linked] > .article {
	padding-top: calc(38px * var(--hk3-ui-scale, 1));
}

.root[data-linked][data-size="sm"] > .article { padding-top: calc(34px * var(--hk3-ui-scale, 1)); }

.root[data-linked] > .muted { padding-top: calc(38px * var(--hk3-ui-scale, 1)); }

// 移動中の隣接ノートにも操作バーが覆われないよう、表示中のノートを前面に置く。
.root:has(> .hoverBar) {
	z-index: 2;
}

.utageFrame {
	// 線は矩形の辺を中心に描かれるため、線幅の半分だけ内側に置き、4辺とも同じ太さで要素内に収める。
	position: absolute;
	inset: 2px;
	width: calc(100% - 4px);
	height: calc(100% - 4px);
	overflow: visible;
	pointer-events: none;
	z-index: 2;
}

.utageTrack, .utageBar {
	fill: none;
	stroke-width: 4;
}

.utageTrack { stroke: var(--hk3-accent-200); }
.utageBar { stroke: var(--hk3-accent); transition: stroke-dasharray 1s linear; }

.utageBadge {
	display: flex;
	align-items: center;
	gap: 4px;
	width: fit-content;
	margin-top: 8px;
	padding: 2px 6px;
	border: 1px solid currentColor;
	border-radius: 0;
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	line-height: 1.4;

	&[data-utage-result='succeeded'] { color: var(--MI_THEME-success); }
	&[data-utage-result='failed'] { color: var(--MI_THEME-error); }
}

.linkBadge {
	position: absolute;
	top: 8px;
	left: 12px;
	z-index: 2;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 3px 9px;
	border: 1px solid color-mix(in srgb, var(--hk3-accent) 24%, transparent);
	border-radius: 999px;
	background: color-mix(in srgb, var(--hk3-accent-100) 62%, transparent);
	-webkit-backdrop-filter: blur(10px);
	backdrop-filter: blur(10px);
	box-shadow: 0 2px 10px color-mix(in srgb, var(--hk3-accent) 10%, transparent);
	color: var(--hk3-accent-700);
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	white-space: nowrap;
	pointer-events: none;
}

.muted {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: calc(14px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
	font-size: calc(13px * var(--hk3-ui-scale, 1));
}

.mutedButton {
	height: 30px;
	padding: 0 12px;
	border: 1px solid var(--hk3-divider);
	border-radius: 12px;
	background: transparent;
	color: var(--hk3-text);
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	cursor: pointer;

	&:hover { border-color: var(--hk3-accent); }
}

.article {
	position: relative;
	isolation: isolate;
	display: grid;
	column-gap: calc(12px * var(--hk3-ui-scale, 1));
	row-gap: calc(8px * var(--hk3-ui-scale, 1));
	padding: calc(18px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1));
	transition: grid-template-columns 480ms cubic-bezier(0.22, 1, 0.36, 1);

	.root[data-size="sm"] & { padding: calc(12px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1)); }
}

.channelRail {
	position: absolute;
	top: 10px;
	bottom: 10px;
	left: 3px;
	width: 4px;
	border-radius: 999px;
	background: linear-gradient(to bottom, color-mix(in srgb, var(--hk3-channel-color) 36%, transparent), var(--hk3-channel-color) 28%, var(--hk3-channel-color) 66%, color-mix(in srgb, var(--hk3-channel-color) 16%, transparent));
	box-shadow: 4px 0 12px color-mix(in srgb, var(--hk3-channel-color) 18%, transparent);
	pointer-events: none;

	.root[data-size="sm"] & { top: 8px; bottom: 8px; left: 2px; width: 3px; }
}

.article:has(> [data-hk3-visibility-rail]) > .channelRail {
	left: 8px;
}

.imageTint {
	position: absolute;
	inset: 0;
	z-index: -1;
	overflow: hidden;
	pointer-events: none;
	opacity: 0.4;
	&[data-tinted] { animation: imageTintEnter 320ms ease-out; }
}

@keyframes imageTintEnter {
	from { opacity: 0; }
	to { opacity: 0.4; }
}

.imageGlow {
	position: absolute;
	mask-image: radial-gradient(ellipse closest-side at center, #000 0%, #000 8%, transparent 100%);
	filter: blur(6px);
	transform: translate(-50%, -50%);
	transition: background-color 320ms cubic-bezier(0.22, 1, 0.36, 1);
	&[data-edge="left"], &[data-edge="right"] {
		width: calc(var(--image-reach-x) + var(--image-reach-x));
		height: calc(var(--image-height) + var(--image-reach-y) + var(--image-reach-y));
		top: var(--image-mid-y);
	}
	&[data-edge="top"], &[data-edge="bottom"] {
		width: calc(var(--image-width) + var(--image-reach-x) + var(--image-reach-x));
		height: calc(var(--image-reach-y) + var(--image-reach-y));
		left: var(--image-mid-x);
	}
	&[data-edge="left"] { left: var(--image-left); }
	&[data-edge="right"] { left: calc(var(--image-left) + var(--image-width)); }
	&[data-edge="top"] { top: var(--image-top); }
	&[data-edge="bottom"] { top: calc(var(--image-top) + var(--image-height)); }
	// Removing permission or a stale palette must clear immediately, without a fade-out.
	.imageTint:not([data-tinted]) & { transition: none; }
}

.renotedBy {
	grid-column: 1 / -1;
	min-width: 0;
	box-sizing: border-box;
	margin: 0;
	padding: 0;
	border: 0;
	background: transparent;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: color-mix(in srgb, var(--hk3-renote-fg) 65%, var(--hk3-text));
}

.renotedSummary {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	min-height: 34px;
}

.renotedIcon {
	width: 18px;
	flex: none;
	color: color-mix(in srgb, var(--hk3-renote-accent) 65%, currentColor);
}

.renotedName {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: inherit;
	font-weight: 500;
}

.renotedTime { margin-left: auto; flex: none; white-space: nowrap; }

.renoteMenuButton {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: none;
	width: 34px;
	height: 34px;
	padding: 0;
	border: 0;
	border-radius: 12px;
	background: transparent;
	color: inherit;
	cursor: pointer;
	&:hover, &:focus-visible { background: var(--hk3-bg); }
	&:focus-visible { outline: 2px solid var(--hk3-renote-accent); outline-offset: -2px; }
	&:disabled { opacity: 0.5; cursor: wait; }
}

.unrenoteConfirm {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px 12px;
	min-width: 0;
	padding: 8px 0;
	border-top: 1px solid var(--hk3-renote-border);
}

.unrenoteQuestion {
	flex: 1 1 180px;
	min-width: 0;
	font-weight: 600;
}

.unrenoteConfirmActions {
	display: flex;
	flex: 1 1 180px;
	justify-content: flex-end;
	gap: 8px;
	min-width: 0;
}

.unrenoteCancel, .unrenoteConfirmButton {
	min-height: 32px;
	padding: 5px 12px;
	border: 1px solid var(--hk3-renote-border);
	border-radius: 12px;
	cursor: pointer;
	font: inherit;
	font-weight: 600;
	white-space: normal;

	&:disabled { opacity: 0.5; cursor: wait; }
	&:focus-visible { outline: 2px solid var(--hk3-renote-accent); outline-offset: 2px; }
}

.unrenoteCancel {
	background: var(--hk3-bg);
	color: var(--hk3-renote-fg);
}

.unrenoteConfirmButton {
	background: var(--hk3-renote-fg);
	color: var(--hk3-bg);
}

.avatarCol {
	display: flex;
	flex-direction: column;
	align-items: center;
	align-self: stretch;
}

.audienceIcons {
	margin-top: 8px;
}

.avatar {
	width: var(--hk3-note-avatar-size);
	height: var(--hk3-note-avatar-size);
	flex: none;
	border-radius: 0 !important;

	:global(img), :global(.indicator) { border-radius: 0 !important; }
}

.threadLine {
	flex: 1;
	width: 1px;
	margin-top: 6px;
	margin-bottom: -18px;
	border-radius: 999px;
	background: linear-gradient(to bottom, color-mix(in srgb, var(--hk3-text) 16%, transparent) 75%, color-mix(in srgb, var(--hk3-text) 10%, transparent));
	opacity: 0;
	transform: scaleY(0);
	transform-origin: top;
	transition: opacity 260ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1);

	.root[data-thread-open] & { opacity: 1; transform: scaleY(1); }
	.root[data-size="sm"] & { margin-bottom: -12px; }
}

.body {
	display: flex;
	flex-direction: column;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	min-width: 0;
}

.header {
	display: flex;
	align-items: baseline;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	min-width: 0;
}

.name {
	flex: 0 1 auto;
	min-width: 0;
	max-width: 60%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--hk3-text);
	font-weight: 700;
	font-size: calc(15px * var(--hk3-ui-scale, 1));

	.root[data-size="sm"] & { font-size: calc(14px * var(--hk3-ui-scale, 1)); }
}

.roleBadges {
	flex: 0 1 auto;
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
}

.acct {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
}

.meta {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 6px;
	flex: none;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
	white-space: nowrap;
}

.time {
	color: inherit;
	font-variant-numeric: tabular-nums;
}

.muted700 { color: var(--hk3-neutral-700); flex: none; }

.replyTo {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
	padding: 9px 12px;
	border: 1px solid color-mix(in srgb, var(--hk3-divider) 40%, transparent);
	border-radius: 18px;
	background: color-mix(in srgb, color-mix(in srgb, var(--hk3-surface) 88%, var(--hk3-accent-100)) 62%, transparent);
	-webkit-backdrop-filter: blur(12px);
	backdrop-filter: blur(12px);
	box-shadow: 0 4px 16px color-mix(in srgb, var(--hk3-text) 7%, transparent), inset 0 1px color-mix(in srgb, var(--hk3-bg) 42%, transparent);
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-text);
	&:hover { border-color: color-mix(in srgb, var(--hk3-accent) 45%, transparent); text-decoration: none; }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

.replyToHeader {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	:global(svg) { flex: none; color: var(--hk3-accent-700); }
}

.replyToName { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.replyToAcct {
	min-width: 0;
	max-width: 45%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--hk3-neutral-700);
}

.replyToText {
	min-width: 0;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow-wrap: anywhere;
	color: var(--hk3-neutral-800);
}

.textSource {
	min-width: 0;
	hr { margin: 10px 0; }
	pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
	button { padding: 5px 0; border-radius: 12px; color: var(--MI_THEME-accent); }
}

.cw {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}

.cwText {
	font-size: calc(15px * var(--hk3-ui-scale, 1));
	.root[data-size="sm"] & { font-size: calc(14px * var(--hk3-ui-scale, 1)); }
}

.cwButton {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 28px;
	border: 1px solid var(--hk3-divider);
	border-radius: 12px;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;

	&:hover { border-color: var(--hk3-accent); color: var(--hk3-accent-700); }
}

.text {
	margin: 0;
	font-size: calc(15px * var(--hk3-ui-scale, 1));
	line-height: 1.7;
	text-wrap: pretty;
	white-space: pre-wrap;
	overflow-wrap: anywhere;

	.root[data-size="sm"] & { font-size: calc(14px * var(--hk3-ui-scale, 1)); }
}

.media {
	max-width: 480px;
	--MI-media-image-background: transparent;
	--MI-media-image-pattern: none;
}

.quote {
	display: grid;
	grid-template-columns: 26px minmax(0, 1fr) 14px;
	gap: 10px;
	min-width: 0;
	padding: 10px 12px;
	border: 1px solid color-mix(in srgb, var(--hk3-divider) 40%, transparent);
	border-radius: 18px;
	background: color-mix(in srgb, color-mix(in srgb, var(--hk3-surface) 88%, var(--hk3-accent-100)) 62%, transparent);
	-webkit-backdrop-filter: blur(12px);
	backdrop-filter: blur(12px);
	box-shadow: 0 4px 16px color-mix(in srgb, var(--hk3-text) 7%, transparent), inset 0 1px color-mix(in srgb, var(--hk3-bg) 42%, transparent);
	color: var(--hk3-text);

	&:hover { border-color: color-mix(in srgb, var(--hk3-accent) 45%, transparent); text-decoration: none; }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

.quoteAvatar {
	width: 26px;
	height: 26px;
}

.quoteBody {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.quoteName { min-width: 0; font-size: calc(13px * var(--hk3-ui-scale, 1)); overflow-wrap: anywhere; }

.quoteText {
	min-width: 0;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	line-height: 1.55;
	color: var(--hk3-neutral-800);
	overflow-wrap: anywhere;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.quoteIcon {
	align-self: start;
	color: var(--hk3-accent-700);
	opacity: 0.7;
}

.channel {
	align-self: flex-start;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-accent-700);
}

.rxInline {
	display: flex;
	align-items: flex-start;
	gap: 6px;
	min-width: 0;
}

.rxInlineList {
	max-height: 38px;
	flex: 0 1 auto;
	min-width: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	overflow: hidden;
	transition: max-height 520ms cubic-bezier(0.22, 1, 0.36, 1);
	.root[data-size="sm"] & { max-height: 34px; }
	:global([data-mobile="true"]) .root[data-size="sm"] & { max-height: 114px; }
}

.chip, .chipAdd, .chipMore {
	flex: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 38px;
	border: 1px solid var(--hk3-divider);
	border-radius: 13px;
	background: var(--hk3-surface);
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	font-variant-numeric: tabular-nums;

	.root[data-size="sm"] & { height: 34px; }
	&:hover { border-color: var(--hk3-accent); }
}

.chip {
	position: relative;
	gap: 8px;
	padding: 0 12px;
}

.chipEmoji {
	--hk3-emoji: 20px;
	--hk3-emoji-width: 40px;
	.root[data-size="sm"] & { --hk3-emoji: 16px; --hk3-emoji-width: 32px; }
}

.chipAdd {
	width: 38px;
	padding: 0;
	border-style: dashed;
	background: transparent;
	color: var(--hk3-accent-700);
	transition: border-color 160ms ease, background 160ms ease;

	.root[data-size="sm"] & { width: 34px; }
	&:hover { border-style: solid; background: var(--hk3-accent-100); }
	&:active { background: var(--hk3-accent-200); }
}

.chipMore {
	gap: 4px;
	padding: 0 10px;
	border-color: var(--hk3-text);
	background: var(--hk3-bg);
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 800;

	&[data-open] { background: var(--hk3-text); color: var(--hk3-bg); }
}

.smActions {
	position: relative;
	display: flex;
	gap: 2px;
	margin-left: -10px;
}

.smAction, .hoverAction {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 44px;
	height: 40px;
	border: 0;
	border-radius: 12px;
	background: transparent;
	color: var(--hk3-neutral-800);
	cursor: pointer;
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-variant-numeric: tabular-nums;

	&[data-active] { color: var(--hk3-accent-700); }
	&:hover { background: var(--hk3-accent-100); color: var(--hk3-accent-700); }
}

.smAction {
	gap: 5px;
	padding: 0 10px;
}

.convButton {
	align-self: flex-start;
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 44px;
	padding: 6px 12px 6px 6px;
	border: 1px solid color-mix(in srgb, var(--hk3-text) 10%, transparent);
	border-radius: 18px;
	background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), transparent);
	-webkit-backdrop-filter: blur(16px) saturate(1.1);
	backdrop-filter: blur(16px) saturate(1.1);
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	text-align: left;
	transition: background 260ms ease, border-color 260ms ease;

	&[data-open] { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 12%, transparent)); }
	&:hover { border-color: color-mix(in srgb, var(--hk3-text) 18%, transparent); background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 8%, transparent)); }
	&[data-open]:hover { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 15%, transparent)); }
	&:active { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 16%, transparent)); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

.convFaces {
	display: flex;
	flex: none;
}

.convFace {
	width: 28px;
	height: 28px;
	margin-right: -5px;
}

.convCount {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-left: 6px;
	flex: none;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	color: var(--hk3-accent-700);
}

.convChevron {
	flex: none;
	color: var(--hk3-neutral-700);
	transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);

	.convButton[data-open] & { transform: rotate(180deg); }
}

.side {
	position: relative;
	align-self: stretch;
	min-height: 100px;
	border-left: 1px solid var(--hk3-divider);
}

.sideGrid {
	position: absolute;
	top: -4px;
	bottom: -4px;
	left: 8px;
	right: 0;
	overflow: hidden;
}

.sideChip, .sideAdd, .sideMore {
	position: absolute;
	// 並び順が変わったときは、跳ばずに新しい位置へ滑らかに移る。
	transition: left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms ease, border-color 200ms ease, color 200ms ease;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 50px;
	padding: 0 4px;
	border: 1px solid var(--hk3-divider);
	border-radius: 13px;
	background: var(--hk3-surface);
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	font-variant-numeric: tabular-nums;

	&:hover { border-color: var(--hk3-accent); }
}

.sideChip {
	flex-direction: column;
	gap: 2px;
}

.chip, .sideChip {
	&[data-mine] {
		// 一色の背景を縁から外へ薄くぼかし、絵文字・件数は鮮明に保つ。
		isolation: isolate;
		background: transparent;
		border-color: transparent;
		color: var(--hk3-text);

		&:hover {
			background: transparent;
			border-color: transparent;
		}

		&::before {
			content: '';
			position: absolute;
			inset: 3px;
			z-index: -1;
			border-radius: inherit;
			background: color-mix(in srgb, var(--hk3-accent) 22%, var(--hk3-surface));
			filter: blur(3px);
			pointer-events: none;
		}

		&:hover::before {
			background: color-mix(in srgb, var(--hk3-accent) 26%, var(--hk3-surface));
		}
	}

	// 親の overflow: hidden に切られない内側のフォーカス輪郭。
	&:focus-visible {
		outline: 2px solid var(--hk3-text);
		outline-offset: -3px;
	}
}

.sideEmoji {
	--hk3-emoji: 20px;
	--hk3-emoji-width: 40px;
}

// 横長画像の表示幅を実際の枠にも確保し、件数との重なりを防ぐ。
// 付与・変更で描き直された直後も、画像の元の大きさで枠からはみ出して一部だけ見えることがないようにする。
.emojiBox {
	flex: none;
	pointer-events: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: var(--hk3-emoji-width);
	height: var(--hk3-emoji);
	overflow: hidden;
	font-size: calc(var(--hk3-emoji) * 0.9);
	line-height: 1;

	> :global(*) {
		display: block;
		max-width: 100% !important;
		max-height: 100% !important;
		width: auto !important;
		height: auto !important;
		object-fit: contain;
		vertical-align: middle;
		transform: none !important;
		margin: 0;
	}
}

.sideAdd {
	padding: 0;
	border-style: dashed;
	background: transparent;
	color: var(--hk3-accent-700);
	transition: border-color 160ms ease, background 160ms ease;

	&:hover { border-style: solid; background: var(--hk3-accent-100); }
	&:active { background: var(--hk3-accent-200); }
}

.sideMore {
	gap: 3px;
	padding: 0;
	border-color: var(--hk3-text);
	background: var(--hk3-bg);
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 800;

	&[data-open] { background: var(--hk3-text); color: var(--hk3-bg); }
}

.root > .article > .host {
	position: absolute;
	right: 12px;
	bottom: 8px;
	max-width: calc(100% - 24px);

	&[data-position="left"] {
		left: 12px;
		right: auto;
	}
}

// ノートごとの操作バーは本文に重ねず、ノートの上端の区切り線にまたがせる(下半分は上余白18pxの中に収まる)。
// 一覧の先頭のノートは上が切れるため、下端の区切り線にまたがせる。
.hoverBar {
	// 薄めは62%、濃いめは86%。操作バー内だけで背景の透明度を調整する。
	--hk3-hover-bar-alpha: clamp(62%, calc(var(--hk3-glass-pane-alpha, 76%) * 1.5 - 52%), 86%);
	position: absolute;
	top: -17px;
	z-index: 6;

	.root:first-child > & { top: auto; bottom: -17px; }
	.root[data-renote] > & { top: auto; bottom: -17px; }
	display: flex;
	background: var(--hk3-bg);
	background: color-mix(in srgb, var(--hk3-bg) var(--hk3-hover-bar-alpha), transparent);
	-webkit-backdrop-filter: blur(12px);
	backdrop-filter: blur(12px);
	border: 1px solid var(--hk3-divider);
	border-color: color-mix(in srgb, var(--hk3-divider) 75%, transparent);
	border-radius: 14px;
	box-shadow: var(--hk3-shadow-md);
}

// 移動中は親がクリップされるため、はみ出す操作バーを全体ごと隠す。
:global([inert]) .hoverBar,
:global([data-hk3-note-moving]) .hoverBar {
	visibility: hidden;
	pointer-events: none;
}

.hoverAction {
	height: 32px;
	gap: 6px;
	padding: 0 12px;
	border-right: 1px solid var(--hk3-divider);
	border-right-color: color-mix(in srgb, var(--hk3-divider) 75%, transparent);

	&:hover { background: color-mix(in srgb, var(--hk3-accent-100) var(--hk3-hover-bar-alpha), transparent); }
	&:focus-visible { background: var(--hk3-accent-100); color: var(--hk3-accent-700); }

	// バーをクリップせず端の塗りだけを丸め、フォーカスの輪郭を残す。
	&:first-child { border-top-left-radius: 13px; border-bottom-left-radius: 13px; }
	&:last-child { border-right: 0; border-top-right-radius: 13px; border-bottom-right-radius: 13px; }
}

.tree {
	display: grid;
	grid-template-rows: 0fr;
	transition: grid-template-rows 520ms cubic-bezier(0.22, 1, 0.36, 1);

	&[data-open] { grid-template-rows: 1fr; }
}

.treeInner {
	overflow: hidden;
	min-height: 0;
}

.treeList {
	display: flex;
	flex-direction: column;
	padding: 0 20px 16px;

	.root[data-size="sm"] & { padding: 0 14px 12px; }
}

.treeLoading {
	padding: 8px 0 8px 54px;
}

.treeRow {
	display: grid;
	grid-template-columns: var(--hk3-note-avatar-size) 30px minmax(0, 1fr);
	column-gap: 10px;
	opacity: 0;
	transform: translateY(-10px);
	transition: opacity 340ms ease 0ms, transform 460ms cubic-bezier(0.22, 1, 0.36, 1) 0ms;

	.tree[data-open] & {
		opacity: 1;
		transform: translateY(0);
		transition-delay: var(--hk3-delay), var(--hk3-delay);
	}
}

.treeRail { position: relative; }

.treeRailV {
	position: absolute;
	left: calc(50% - 0.5px);
	top: 0;
	bottom: 0;
	width: 1px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--hk3-text) 14%, transparent);
}

.treeRailEnd {
	bottom: auto;
	height: 25px;
	background: linear-gradient(to bottom, color-mix(in srgb, var(--hk3-text) 14%, transparent) 90%, transparent);
}

.treeRailH {
	position: absolute;
	left: 50%;
	top: 23px;
	width: calc(50% + 10px);
	height: 1px;
	border-radius: 999px;
	background: linear-gradient(to right, color-mix(in srgb, var(--hk3-text) 14%, transparent) 75%, color-mix(in srgb, var(--hk3-text) 9%, transparent));
}

.treeAvatarCol {
	display: flex;
	flex-direction: column;
	align-items: center;
	min-width: 0;
}

.treeAvatar {
	margin-top: 9px;
	width: 30px;
	height: 30px;
	flex: none;
}

.treeBubble {
	margin: 5px 0 7px;
	min-width: 0;
	border: 1px solid color-mix(in srgb, var(--hk3-text) 10%, transparent);
	border-radius: 18px;
	background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), transparent);
	-webkit-backdrop-filter: blur(16px) saturate(1.1);
	backdrop-filter: blur(16px) saturate(1.1);
	color: var(--hk3-text);
	transition: background 260ms ease, border-color 260ms ease, box-shadow 260ms ease;

	&:hover { border-color: color-mix(in srgb, var(--hk3-text) 18%, transparent); background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 8%, transparent)); }
	&:active { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 12%, transparent)); }
	&:focus-within { border-color: color-mix(in srgb, var(--hk3-accent) 35%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--hk3-accent) 16%, transparent); }
}

.root[data-thread-reply] {
	> .article { padding: calc(10px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1)); border-radius: inherit; }
	.imageTint { border-radius: inherit; }
	.body { gap: calc(3px * var(--hk3-ui-scale, 1)); }
	.header { gap: calc(6px * var(--hk3-ui-scale, 1)); }
	.name { max-width: 42%; font-size: calc(13px * var(--hk3-ui-scale, 1)); }
	.acct { display: block; }
	.meta { min-width: 0; max-width: 30%; }
	.time { display: block; overflow: hidden; text-overflow: ellipsis; }
	.text { font-size: calc(14px * var(--hk3-ui-scale, 1)); line-height: 1.6; }
	.smActions { flex-wrap: wrap; }
	.smAction { padding: 0 6px; }
}

.root > .article:has(> .host) {
	padding-bottom: 40px;
}

@media (hover: hover) and (pointer: fine) {
	.root[data-thread-reply] {
		.smActions { opacity: 0; }
		&:hover .smActions, &:focus-within .smActions { opacity: 1; }
	}
}

.treeReply {
	margin-top: 6px;
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
	min-height: 44px;
	padding: 0 14px;
	border: 1px solid color-mix(in srgb, var(--hk3-text) 10%, transparent);
	border-radius: 18px;
	background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), transparent);
	-webkit-backdrop-filter: blur(16px) saturate(1.1);
	backdrop-filter: blur(16px) saturate(1.1);
	color: var(--hk3-neutral-700);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	text-align: left;
	transition: background 260ms ease, border-color 260ms ease, color 260ms ease;

	span { flex: 1; }
	&:hover { border-color: color-mix(in srgb, var(--hk3-text) 18%, transparent); background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 8%, transparent)); color: var(--hk3-accent-700); }
	&:active { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), color-mix(in srgb, var(--hk3-accent) 12%, transparent)); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

@media (prefers-reduced-motion: reduce) {
	.imageTint { animation: none !important; }
	.imageGlow { transition: none !important; }
	.root, .article, .threadLine, .tree, .treeRow, .treeBubble, .treeReply, .convButton, .convChevron, .rxInlineList, .sideChip, .sideAdd, .sideMore { transition: none !important; }
}
</style>
