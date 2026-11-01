<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: タイムライン。タブ・表示フィルタ・LIVE切替・新着バナーを持ち、新しい順に並べる。
-->
<template>
<div :class="$style.root" :style="compact ? { '--hk3-mobile-dock-height': `${mobileDockHeight}px` } : undefined" :data-mobile-docked="compact && mobileComposerTarget ? true : undefined" :data-compact="compact ? 'true' : undefined" :data-desktop-rail="desktopRailActive ? true : undefined" :data-composer-position="composerPosition" :data-motion="motionEnabled">
	<header ref="punchNavbarFrame" :inert="confirmationActive" :data-hata-collapse-part="punchBusy ? undefined : true" :class="$style.navbar" :data-at-top="showTopGlow ? true : undefined" :data-pulling="navbarPullActive ? true : undefined" :data-pull-phase="navbarPullActive ? pullRefresh.state.value.phase : undefined" :style="navbarPullActive ? pullNavbarStyle : undefined">
		<div :class="$style.navbarContents" :inert="pullRefresh.active.value">
			<div v-if="compact" :class="$style.mobileNavbar" data-mobile-navbar>
				<nav ref="mobileCapsuleEl" :class="$style.mobileCapsule" :aria-label="i18n.ts.timeline" data-mobile-capsule>
					<button v-for="choice in mobileCapsuleChoices" :key="choice.id" type="button" :class="$style.mobileTab" :data-mobile-choice="choice.id" :data-active="tab === choice.id ? 'true' : undefined" :aria-pressed="tab === choice.id" :aria-label="choice.id === tab ? timelineTitle : choice.label" :title="choice.id === tab ? timelineTitle : choice.label" :disabled="!mobileNavEnabled" @click.stop="selectMobileChoice(choice.id, $event)">
						<i :class="choice.icon" aria-hidden="true"></i><span :class="$style.mobileTabLabel" @transitionend="onMobileLabelTransition(choice.id, $event)">{{ choice.id === tab ? timelineTitle : choice.label }}</span>
					</button>
					<button v-if="isCollectionTab" type="button" :class="$style.mobileAction" :aria-label="tab === 'list' ? collectionCopy.switchList : collectionCopy.switchAntenna" :title="tab === 'list' ? collectionCopy.switchList : collectionCopy.switchAntenna" :disabled="!mobileNavEnabled" @click.stop="switchMobileCollection(tab as CollectionKind, $event)"><i class="ti ti-selector" aria-hidden="true"></i></button>
					<button v-if="isCollectionTab" type="button" :class="$style.mobileAction" :aria-label="tab === 'list' ? collectionCopy.configureList : collectionCopy.configureAntenna" :title="tab === 'list' ? collectionCopy.configureList : collectionCopy.configureAntenna" :disabled="!mobileNavEnabled" @click.stop="openCollectionSettings(tab as CollectionKind)"><i class="ti ti-settings" aria-hidden="true"></i></button>
					<div ref="optionsWrapEl" :class="$style.mobileOptionsWrap">
						<button type="button" :class="$style.mobileAction" :aria-label="i18n.ts.options" :title="i18n.ts.options" :aria-expanded="optionsOpen" aria-haspopup="menu" :disabled="!mobileNavEnabled" @click.stop="optionsOpen = !optionsOpen"><Ellipsis :size="20"/></button>
					</div>
				</nav>
				<Transition v-if="active" :css="motion()" :name="motion() ? 'hk3-options' : ''">
					<div v-if="optionsOpen && active" ref="optionsEl" :class="[$style.options, $style.mobileOptions]" role="menu" @click.stop>
						<button v-for="option in mobileNavigation.options" :key="option.id" type="button" :class="$style.option" :role="option.id === 'rss' ? 'menuitem' : 'menuitemcheckbox'" :aria-checked="option.id === 'rss' ? undefined : option.checked" :disabled="option.disabled" @click="option.action()"><i :class="option.icon" aria-hidden="true"></i><span>{{ option.label }}</span><Check v-if="option.checked" :size="16"/></button>
					</div>
				</Transition>
			</div>
			<Teleport :to="desktopRailEl ?? 'body'" :disabled="!desktopRailActive">
				<div v-if="!compact" ref="navEl" :class="$style.nav" role="navigation" :aria-label="i18n.ts.timeline" @click="onNavClick">
					<div v-if="!compact" :class="$style.navSpacer"></div>
					<div :class="$style.tabs">
						<button
							v-for="t in tabs"
							:key="t.id"
							type="button"
							:class="$style.tab"
							:data-active="t.id === tab ? 'true' : undefined"
							:aria-pressed="t.id === tab"
							:title="t.label"
							:data-external="t.external ? 'true' : undefined"
							@click.stop="onTabClick(t.id)"
						>
							<i :class="[t.icon, $style.tabIcon]" aria-hidden="true"></i>
							<span v-if="!compact || t.id === tab" :class="$style.railLabel">{{ t.label }}</span>
						</button>

						<template v-if="$i">
							<template v-for="item in collectionNav" :key="item.id">
								<button v-if="item.id === 'channel'" type="button" :class="$style.tab" data-collection-nav="channel" :title="collectionCopy.channel" :aria-label="collectionCopy.channel" @click.stop="goToChannels"><i class="ti ti-device-tv" :class="$style.tabIcon" aria-hidden="true"></i><span v-if="!compact" :class="$style.railLabel">{{ collectionCopy.channel }}</span></button>
								<div v-else :class="$style.collectionTab" :data-active="tab === item.id ? 'true' : undefined">
									<button type="button" :class="$style.tab" :data-collection-nav="item.id" :data-active="tab === item.id ? 'true' : undefined" :aria-pressed="tab === item.id" :title="item.label" :aria-label="item.label" :aria-expanded="pickerKind === item.id" :aria-controls="pickerKind === item.id ? pickerId : undefined" aria-haspopup="dialog" @click.stop="openCollection(item.id, $event)">
										<i :class="[item.icon, $style.tabIcon]" aria-hidden="true"></i>
										<span v-if="!compact || tab === item.id" :class="[$style.collectionCopy, $style.railLabel]"><span>{{ item.label }}</span><span v-if="tab === item.id" :class="$style.collectionName">{{ activeCollection?.name }}</span></span>
									</button>
									<button v-if="tab === item.id" type="button" :class="$style.collectionAction" :data-collection-switch="item.id" :title="item.switchLabel" :aria-label="item.switchLabel" :aria-expanded="pickerKind === item.id" :aria-controls="pickerKind === item.id ? pickerId : undefined" aria-haspopup="dialog" @click.stop="toggleCollectionPicker(item.id, $event)"><i class="ti ti-selector" aria-hidden="true"></i><span v-if="!compact" :class="$style.railLabel">{{ item.switchLabel }}</span></button>
									<button v-if="tab === item.id" type="button" :class="$style.collectionAction" :data-collection-settings="item.id" :title="item.settingsLabel" :aria-label="item.settingsLabel" @click.stop="openCollectionSettings(item.id)"><i class="ti ti-settings" aria-hidden="true"></i><span v-if="!compact" :class="$style.railLabel">{{ item.settingsLabel }}</span></button>
								</div>
							</template>
						</template>
					</div>
					<div :class="$style.navEnd">
						<!-- 表示の切り替え(リノート・ファイル・センシティブ・LIVE)を「…」の一覧にまとめる。 -->
						<div ref="optionsWrapEl" :class="$style.optionsWrap">
							<div :class="$style.optionsButton">
								<button type="button" :class="$style.live" :data-on="optionsOpen || live ? 'true' : undefined" :aria-expanded="optionsOpen" aria-haspopup="menu" :aria-label="i18n.ts.options" :title="i18n.ts.options" @click.stop="optionsOpen = !optionsOpen">
									<Ellipsis :size="20"/>
									<span v-if="!compact" :class="$style.railLabel">{{ i18n.ts.options }}</span>
								</button>
							</div>
							<Transition v-if="active" :name="motion() ? 'hk3-options' : ''">
								<div v-if="optionsOpen" ref="optionsEl" :class="$style.options" :style="desktopPopupStyle" role="menu" @click.stop>
									<button v-for="f in filters" :key="f.key" type="button" role="menuitemcheckbox" :aria-checked="f.on" :class="$style.option" :data-on="f.on ? 'true' : undefined" @click="toggleFilter(f.key)">
										<component :is="f.icon" :size="18"/><span>{{ f.label }}</span><span :class="$style.optionCheck"><Check v-if="f.on" :size="16"/></span>
									</button>
								<button type="button" role="menuitemcheckbox" :aria-checked="live" :class="$style.option" :data-on="live ? 'true' : undefined" :disabled="tab === 'trending' || isExternalTab || isHatadyTab || isConcrntTab" @click="toggleLive">
										<component :is="live ? Zap : ZapOff" :size="18"/><span>{{ copy.realtime }}</span><span :class="$style.optionCheck"><Check v-if="live" :size="16"/></span>
									</button>
									<button type="button" role="menuitem" :class="$style.option" @click="openRssSettings"><Rss :size="18"/><span>{{ copy._rss.settings }}</span></button>
								</div>
							</Transition>
						</div>
					</div>
				</div>
				<div v-if="pickerKind" :id="pickerId" ref="pickerEl" :class="$style.collectionPicker" :style="desktopPopupStyle" :data-collection-picker="pickerKind" :data-state="pickerState" role="dialog" :aria-label="pickerKind === 'list' ? collectionCopy.selectList : collectionCopy.selectAntenna" :aria-busy="pickerState === 'loading'" tabindex="-1" @click.stop @keydown="onPickerKeydown">
					<div v-if="pickerState === 'loading'" :class="$style.collectionPickerState" role="status"><MkLoading/></div>
					<div v-else-if="pickerState === 'error'" :class="$style.collectionPickerState" role="status"><span>{{ copy.loadFailed }}</span><button type="button" :class="$style.retry" data-collection-retry @click="retryCollection">{{ copy.retry }}</button></div>
					<div v-else-if="pickerState === 'empty'" :class="$style.collectionPickerState" role="status"><span>{{ pickerKind === 'list' ? collectionCopy.noLists : collectionCopy.noAntennas }}</span></div>
					<button v-for="item in pickerState === 'ready' ? pickerItems : []" :key="item.id" type="button" :class="$style.collectionPickerItem" :data-collection-id="item.id" :data-active="item.id === selectedCollections[pickerKind] ? 'true' : undefined" :aria-pressed="item.id === selectedCollections[pickerKind]" @click="selectCollection(pickerKind, item.id)"><i :class="pickerKind === 'list' ? 'ti ti-list' : 'ti ti-antenna'" aria-hidden="true"></i><span>{{ item.name }}</span><Check v-if="item.id === selectedCollections[pickerKind]" :size="16"/></button>
					<a :class="$style.collectionPickerItem" :href="pickerKind === 'list' ? '/my/lists' : '/my/antennas'" data-collection-manage @click.prevent="openCollectionSettings(pickerKind, true)"><i class="ti ti-settings" aria-hidden="true"></i><span>{{ pickerKind === 'list' ? collectionCopy.configureList : collectionCopy.configureAntenna }}</span></a>
				</div>
			</Teleport>
			<div v-if="emojiVoteRound && emojiVoteAnchor" :class="$style.voteNavbar">
				<MkLtlEmojiVote
					:key="`hk3-emoji-vote:${emojiVoteRound.id}`"
					:round="emojiVoteRound"
					:choice="emojiVoteChoice"
					:now="emojiVoteNow"
					:phase="emojiVotePhase"
					:declined="emojiVoteDeclined"
					:active="emojiVoteActive"
					:effectTarget="voteEffectsEl"
					:submitting="emojiVoteSubmitting"
					:voteError="emojiVoteError"
					:canVote="!!$i"
					:claimEffect="claimEmojiVoteEffect"
					navbar
					@vote="voteEmoji"
					@dismiss="dismissEmojiVote"
				/>
			</div>
			<div ref="punchNavbarTarget"></div>
			<div data-hata-collapse-part data-timeline-tab-gesture-ignore :class="$style.bannerStack" :data-rss="rssEnabled ? 'true' : undefined">
				<Hk3RssReader v-if="rssEnabled" :interrupted="bannerOn" :paused="rssEffectPaused" :compact="compact" :motion="motionEnabled" :composerPickerOpen="compact && emojiHostOpen" @settings="openRssSettings" @readerOpen="rssReaderOpen = $event"/>
				<button v-if="bannerShown" ref="bannerEl" type="button" :class="$style.banner" :data-kind="bannerToast ? 'toast' : 'queue'" :tabindex="bannerOn ? undefined : -1" :inert="!bannerOn" :aria-hidden="!bannerOn || undefined" :aria-label="bannerToast ? undefined : bannerQueueLabel" @click="onBannerClick">
					<span ref="flashEl" :class="$style.flash" aria-hidden="true"></span>
					<span ref="flash2El" :class="$style.flash2" aria-hidden="true"></span>
					<span v-if="bannerToast" :key="bannerToast.id" ref="bannerContentEl" :class="$style.bannerContent">
						<Hk3PostSuccess v-if="bannerToast.icon === 'send'" :key="bannerToast.id" :text="bannerToast.text" :motion="motionEnabled"/>
						<template v-else>
							<span :class="$style.bannerLead">
								<MkAvatar v-if="bannerToast.user" :user="bannerToast.user" :class="[$style.bannerFace, bannerToast.welcome && $style.bannerWelcomeFace]" :isToastAvatar="!!bannerToast.welcome"/>
								<img v-if="bannerToast.emojiUrl" :src="bannerToast.emojiUrl" alt="" :class="$style.bannerEmoji" decoding="async"/>
								<MkNoteActionAnimation v-if="bannerNoteAction" :key="bannerToast.id" :action="bannerNoteAction" :motion="motion()" :class="$style.bannerAction"/>
								<component :is="toastIcon(bannerToast.icon)" v-else-if="!bannerToast.user && !bannerToast.emojiUrl" :size="18" :class="$style.bannerIcon"/>
							</span>
							<span :class="$style.bannerText"><Hk3WelcomeText v-if="bannerToast.welcome" :text="bannerToast.text" :motion="motionEnabled" :active="currentToast?.id === bannerToast.id"/><Mfm v-else :text="bannerToast.text" :plain="true" :nowrap="true" :nyaize="false" :author="bannerToastAuthor ?? undefined" :emojiUrls="bannerToastEmojiUrls"/></span>
						</template>
					</span>
					<span v-else key="queue" ref="bannerContentEl" :class="$style.bannerContent">
						<MkTimelineNewNotesContent :avatars="bannerExternalNotice ? bannerExternalAvatars : bannerFaces" :count="bannerExternalNotice ? bannerExternalNotice.count : bannerCount" :text="bannerExternalText ?? undefined" :author="bannerExternalNotice?.author" :emojiUrls="bannerExternalNotice?.emojiUrls" :icon="bannerExternalNotice?.icon" :motion="motionEnabled" :compact="compact"/>
						<span :class="$style.queueStatus" role="status" aria-atomic="true">{{ hasQueued ? bannerQueueLabel : '' }}</span>
					</span>
				</button>
			</div>
		</div>
		<div v-if="navbarPullActive" :class="$style.pullPrompt" role="status" aria-live="polite"><i :class="[pullPromptIcon, $style.pullIcon]" aria-hidden="true"></i><span>{{ pullPromptLabel }}</span></div>
		<div v-if="compact" ref="emojiHostTarget" data-hk3-composer-emoji-host data-hk3-composer-overlay :data-open="emojiHostOpen && !optionsOpen && !pickerKind ? 'true' : undefined" :class="$style.emojiHost"></div>
	</header>
	<aside v-if="!compact" :class="$style.desktopRailSlot">
		<div ref="desktopRailEl" :class="$style.desktopRail" :data-menu-open="optionsOpen || pickerKind ? true : undefined" :inert="pullRefresh.active.value || confirmationActive"></div>
	</aside>
	<MkLtlPunch :active="active && !confirmationActive && tab === 'local' && !!$i" :navbarTarget="punchNavbarTarget" :navbarFrame="punchNavbarFrame" :timelineRoot="listEl" :viewportTarget="scrollEl" :animationEnabled="motionEnabled" @busy="punchBusy = $event"/>

	<div :class="$style.scrollWrap" :inert="confirmationActive">
		<div v-if="emojiVoteActive" ref="voteEffectsEl" :class="$style.voteEffects" aria-hidden="true"></div>
		<div ref="scrollEl" data-timeline-tab-gestures :class="$style.scroll" @touchstart.passive="timelineTabGestures.touchStart" @touchmove="timelineTabGestures.touchMove" @touchend="timelineTabGestures.touchEnd" @touchcancel="timelineTabGestures.touchCancel" @wheel="timelineTabGestures.wheel">
			<!-- 外部アカウントのタイムラインは、Hataskey UI と同じ外部TL部品で表示する。 -->
			<ConcrntTimeline v-if="concrntMounted" v-show="isConcrntTab" ref="concrntTimelineRef" embedded hataskeyUi :active="active && isConcrntTab && !confirmationActive" :class="$style.external"/>
			<MkExternalTimeline v-if="isExternalTab && externalHost && externalToken" :key="tab" ref="externalTimelineRef" :src="tab === 'ohtl' ? 'ohtl' : 'oltl'" :newNotesNavbarKey="`hk3:${tab}`" :host="externalHost" :token="externalToken" :sound="active" :simpleUi="true" :hataskeyUi="true" :class="$style.external"/>

			<MkHatadyTimeline v-else-if="isHatadyTab" ref="hatadyTimelineRef" variant="uis" :active="active && !confirmationActive" newNotesNavbarKey="hk3:hatady"/>
			<component :is="prefer.r.enablePullToRefresh.value ? MkPullToRefresh : 'div'" v-else-if="!isConcrntTab" :refresher="refreshFromPull">
				<div v-if="isCollectionTab && !activeCollection" :class="$style.state">
					<MkLoading v-if="loading || activeCollectionState === 'loading'"/>
					<template v-else><span>{{ activeCollectionState === 'error' ? copy.loadFailed : tab === 'list' ? collectionCopy.noLists : collectionCopy.noAntennas }}</span><button type="button" :class="$style.retry" @click="openCollection(tab as CollectionKind, $event)">{{ activeCollectionState === 'error' ? copy.retry : tab === 'list' ? collectionCopy.selectList : collectionCopy.selectAntenna }}</button></template>
				</div>
				<div v-else-if="loading && notes.length === 0" :class="$style.state"><MkLoading/></div>
				<div v-else-if="error && notes.length === 0" :class="$style.state">
					<span>{{ copy.loadFailed }}</span>
					<button type="button" :class="$style.retry" @click="reload()">{{ copy.retry }}</button>
				</div>
				<div v-else-if="notes.length === 0" :class="$style.state">{{ copy.noNotes }}</div>

				<div ref="listEl" data-hata-collapse-items :class="$style.list">
					<template v-for="note in notes" :key="note.id">
						<Hk3Note
							:data-note-removal-id="note.id"
							:note="note"
							instanceBadgePosition="left"
							:size="compact || narrow ? 'sm' : 'lg'"
							:linked="linkKindFor(note)"
							:inLocal="tab === 'local'"
							:inSocial="tab === 'social'"
							:showAudienceIcons="tab === 'following' || tab === 'social'"
							:showLocalOnlyIcon="tab === 'local' || tab === 'mixed'"
							:hideSensitive="!filterState.withSensitive"
						/>
						<MkAd v-if="note._shouldInsertAd_" :class="$style.ad" :preferForms="['horizontal', 'horizontal-big']"/>
					</template>
				</div>
				<div v-if="notes.length > 0" ref="sentinelEl" :class="$style.sentinel">
					<MkLoading v-if="loadingMore" :em="true"/>
					<button v-else-if="loadMoreFailed" type="button" :class="$style.retry" @click="loadMore">{{ copy.loadOlderFailed }}</button>
					<span v-else-if="!hasMore" :class="$style.end">{{ copy.endOfTimeline }}</span>
				</div>
			</component>
		</div>
	</div>
	<Teleport :to="mobileComposerTarget ?? 'body'" :disabled="!compact || !mobileComposerTarget">
	<div v-show="!isConcrntTab" ref="composerEl" data-hata-collapse-part :class="$style.composer" :data-docked="compact && mobileComposerTarget ? true : undefined" :data-motion="motionEnabled" :data-position="composerPosition" :data-hidden="composerScroll.hidden.value ? true : undefined" :inert="composerScroll.hidden.value || mobileMenuOpen" :aria-hidden="composerScroll.hidden.value || mobileMenuOpen">
		<div :class="$style.composerBody"><slot/></div>
	</div>
	</Teleport>
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, useId, watch } from 'vue';
import MkHatadyTimeline from '@/components/MkHatadyTimeline.vue';
import { AtSign, Ellipsis, Bell, ChartBar, Check, Clock, Paperclip, Pencil, SmilePlus, Star, Trash2, Eye, Filter, Heart, Image, Moon, Quote, Repeat2, Reply, Rss, SendHorizontal, Sun, UserPlus, Zap, ZapOff } from '@lucide/vue';
import * as Misskey from 'cherrypick-js';
import Hk3Note from './Hk3Note.vue';
import Hk3PostSuccess from './Hk3PostSuccess.vue';
import Hk3RssReader from './Hk3RssReader.vue';
import Hk3WelcomeText from './Hk3WelcomeText.vue';
import { hk3PostContextKey } from './hk3-post-context.js';
import { hk3ComposerEmojiHostKey } from './hk3-composer-emoji-host.js';
import { animateHk3PostEntrance } from './hk3-post-entrance.js';
import { createHk3NoteMoving } from './hk3-note-moving.js';
import { createHk3ComposerScroll } from './hk3-composer-scroll.js';
import { reorderHk3TopNav, restoreHk3MobileOrder } from './hk3-mobile-order.js';
import type { Hk3MobileChoice, Hk3MobileNavigation } from './hk3-mobile-navigation.js';
import { dismissHk3Toast, hk3ComposerLink, hk3PostedNote, hk3Toasts, pushHk3Toast, setHk3ToastsPaused } from './hk3-state.js';
import type { Component } from 'vue';
import type { HataskeyTimelineNewNotes } from '@/utility/hataskey-timeline-new-notes.js';
import type { Hk3Toast } from './hk3-state.js';
import type { TimelineAdMarker } from '@/utility/timeline-ad.js';
import MkTimelineNewNotesContent from '@/components/MkTimelineNewNotesContent.vue';
import MkLtlPunch from '@/components/MkLtlPunch.vue';
import MkExternalTimeline from '@/components/MkExternalTimeline.vue';
import { concrntState } from '@/utility/concrnt/runtime.js';
const ConcrntTimeline = defineAsyncComponent(() => import('@/components/concrnt/ConcrntTimeline.vue'));
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { attachNavbarPullGesture, createNavbarPullRefresh, navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import type { NavbarPullState } from '@/utility/navbar-pull-refresh.js';
import MkLtlEmojiVote from '@/components/MkLtlEmojiVote.vue';
import MkNoteActionAnimation from '@/components/MkNoteActionAnimation.vue';
import { useLtlEmojiVote } from '@/utility/ltl-emoji-vote.js';
import { getLtlEmojiVoteAnchor } from '@/utility/ltl-emoji-vote-anchor.js';
import { createHataskeyTimelineNewNotes, hataskeyTimelineNewNotesKey } from '@/utility/hataskey-timeline-new-notes.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import { prefer } from '@/preferences.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { instance } from '@/instance.js';
import { markTimelineAdPage, shouldInsertStreamingAd } from '@/utility/timeline-ad.js';
import { deepMerge } from '@/utility/merge.js';
import { createTimelineTabGestures } from '@/utility/timeline-tab-gestures.js';
import { createHk3HomeScroll } from './hk3-home-scroll.js';
import { tabSwipeEnabled } from '@/utility/hatasaba-device-prefs.js';
import { miLocalStorage } from '@/local-storage.js';
import { getExternalEmojiUrlMapForHost } from '@/utility/external-api.js';
import { useGlobalEvent } from '@/events.js';
import { useNoteRemoval } from '@/composables/use-note-removal.js';
import { isHataskeyTimelineAllowed } from '@/utility/hataskey-timeline-availability.js';
import { mainRouter } from '@/router.js';
import { userListsCache, antennasCache } from '@/cache.js';
import * as sound from '@/utility/sound.js';

const props = withDefaults(defineProps<{
	compact?: boolean;
	active?: boolean;
	narrow?: boolean;
	mobileComposerTarget?: HTMLElement | null;
	mobileDockHeight?: number;
	mobileComposerOpen?: boolean;
	mobileMenuOpen?: boolean;
	confirmationActive?: boolean;
}>(), {
	compact: false,
	active: true,
	narrow: false,
	mobileComposerTarget: null,
	mobileDockHeight: 0,
	mobileComposerOpen: false,
	mobileMenuOpen: false,
	confirmationActive: false,
});

const composerPosition = computed(() => props.compact ? 'bottom' : prefer.r.hataskeyUi3ComposerPosition.value);

type CollectionKind = 'list' | 'antenna';
type TabId = 'following' | 'local' | 'social' | 'mixed' | 'trending' | 'hatady' | 'ohtl' | 'oltl' | 'ctl' | CollectionKind;
type CollectionItem = { id: string; name: string };
type CollectionState = 'loading' | 'error' | 'empty' | 'ready';
type FilterKey = 'withRenotes' | 'onlyFiles' | 'withSensitive';

const copy = i18n.ts._hata._hataskeyUi3;
const collectionCopy = i18n.ts._hata._hatasabaUi._simple;
const PAGE = 20;
const QUEUE_MAX = 99;

// 外部アカウント連携が有効で、外部TLの表示を選んでいるときだけ外部のホーム/ローカルを並べる。
const externalLinked = computed(() => prefer.r['external.enabled'].value && prefer.r['external.token'].value != null);
const externalHost = computed(() => prefer.r['external.host'].value || '');
const externalToken = computed(() => prefer.r['external.token'].value || '');
// 並び順と表示は、設定の「上部ナビバー」(Hataskey UI と共通)に従う。トレンドはその右、外部TLは最後に並べる。
// アイコンも Hataskey UI の上部ナビバーと同じもの(設定に保存されたアイコン)を使い、見慣れた形で見分けられるようにする。
const BASE_TABS: Record<'following' | 'local' | 'social' | 'mixed', { label: string; icon: string }> = {
	following: { label: copy.tabHome, icon: 'ti ti-home' },
	local: { label: copy.tabLocal, icon: 'ti ti-planet' },
	social: { label: copy.tabSocial, icon: 'ti ti-users' },
	mixed: { label: copy.tabGlobal, icon: 'ti ti-universe' },
};
const configuredTabs = computed(() => (prefer.r['simpleUi.topNav'].value as { id: string; icon?: string; visible?: boolean }[])
	.filter((item): item is { id: keyof typeof BASE_TABS; icon?: string; visible?: boolean } => item.visible !== false && item.id in BASE_TABS)
	.map(item => ({ id: item.id as TabId, label: BASE_TABS[item.id].label, icon: item.icon || BASE_TABS[item.id].icon })));
const allTabs = computed<{ id: TabId; label: string; icon: string; external?: boolean }[]>(() => [
	...configuredTabs.value,
	...(prefer.r['simpleUi.showTrendingTab'].value ? [{ id: 'trending' as const, label: copy.tabTrending, icon: 'ti ti-flame' }] : []),
	...(prefer.r['simpleUi.showHatadyTab'].value ? [{ id: 'hatady' as const, label: copy.tabHatady, icon: 'ti ti-book-2' }] : []),
	...(externalLinked.value && prefer.r['external.enableOHTL'].value ? [{ id: 'ohtl' as const, label: copy.tabExternalHome, icon: 'ti ti-home', external: true }] : []),
	...(externalLinked.value && prefer.r['external.enableOLTL'].value ? [{ id: 'oltl' as const, label: copy.tabExternalLocal, icon: 'ti ti-planet', external: true }] : []),
	...(concrntState.connection && concrntState.settings.enabled ? [{ id: 'ctl' as const, label: 'CTL', icon: 'concrnt-icon', external: true }] : []),
]);
const tabs = computed(() => allTabs.value.filter(t => t.external || isHataskeyTimelineAllowed(t.id)));
const storedTab = miLocalStorage.getItem('hataskeyUi3Tab') as TabId | null;
const tab = ref<TabId>(storedTab && (tabs.value.some(t => t.id === storedTab) || ($i && (storedTab === 'list' || storedTab === 'antenna'))) ? storedTab : (tabs.value.some(t => t.id === 'local') ? 'local' : 'following'));
const live = ref(miLocalStorage.getItem('hataskeyUi3Live') === 'true');
const isExternalTab = computed(() => tab.value === 'ohtl' || tab.value === 'oltl');
const isConcrntTab = computed(() => tab.value === 'ctl');
const concrntMounted = ref(isConcrntTab.value);
watch(isConcrntTab, active => { if (active) concrntMounted.value = true; });
const concrntTimelineRef = shallowRef<{ reloadTimeline: () => Promise<void>; focusComposer: () => Promise<void> } | null>(null);
const isHatadyTab = computed(() => tab.value === 'hatady');
// 外部TLの新着はその部品がキューを持つ。ここでは知らせだけ受け取り、上部の新着バナーで出す。
const externalNewNotes = createHataskeyTimelineNewNotes(() => isExternalTab.value || isHatadyTab.value ? `hk3:${tab.value}` : null);
provide(hataskeyTimelineNewNotesKey, externalNewNotes);
const externalNotice = externalNewNotes.notice;
// 連携を解除した・外部TLを非表示にした場合は、残っているタブへ戻す。
watch(tabs, list => {
	if ($i && (tab.value === 'list' || tab.value === 'antenna')) return;
	if (!list.some(t => t.id === tab.value)) void onTabClick(list.some(t => t.id === 'local') ? 'local' : 'following');
});

// リスト・アンテナはこのTLで表示し、選択IDを共有キャッシュの一覧と照合する。
const collectionNav = computed(() => [
	{ id: 'list' as const, label: collectionCopy.list, icon: 'ti ti-list', switchLabel: collectionCopy.switchList, settingsLabel: collectionCopy.configureList },
	{ id: 'channel' as const, label: collectionCopy.channel },
	{ id: 'antenna' as const, label: collectionCopy.antenna, icon: 'ti ti-antenna', switchLabel: collectionCopy.switchAntenna, settingsLabel: collectionCopy.configureAntenna },
]);
const collectionItems = ref<Record<CollectionKind, CollectionItem[]>>({ list: [], antenna: [] });
const collectionStates = ref<Record<CollectionKind, CollectionState>>({ list: 'empty', antenna: 'empty' });
const selectedCollections = ref<Record<CollectionKind, string | null>>({ list: null, antenna: null });
const collectionRequests = { list: 0, antenna: 0 };
const isCollectionTab = computed(() => tab.value === 'list' || tab.value === 'antenna');
const activeCollection = computed(() => isCollectionTab.value ? collectionItems.value[tab.value as CollectionKind].find(item => item.id === selectedCollections.value[tab.value as CollectionKind]) : undefined);
const timelineTitle = computed(() => {
	if (tab.value === 'list' || tab.value === 'antenna') {
		const label = tab.value === 'list' ? collectionCopy.list : collectionCopy.antenna;
		return activeCollection.value?.name ? `${label} · ${activeCollection.value.name}` : label;
	}
	return allTabs.value.find(item => item.id === tab.value)?.label ?? BASE_TABS.following.label;
});
const pickerKind = ref<CollectionKind | null>(null);
const pickerId = useId();
const pickerEl = shallowRef<HTMLElement | null>(null);
const pickerTrigger = shallowRef<HTMLElement | null>(null);
const pickerItems = computed(() => pickerKind.value ? collectionItems.value[pickerKind.value] : []);
const pickerState = computed(() => pickerKind.value ? collectionStates.value[pickerKind.value] : 'empty');
const activeCollectionState = computed(() => isCollectionTab.value ? collectionStates.value[tab.value as CollectionKind] : null);
let collectionIntent = 0;
let preferredPicker = false;

function rememberedCollectionKey(kind: CollectionKind) {
	return kind === 'list' ? 'hatasabaLastListId' : 'hatasabaLastAntennaId';
}

async function fetchCollections(kind: CollectionKind): Promise<CollectionItem[] | null> {
	const request = ++collectionRequests[kind];
	collectionStates.value[kind] = 'loading';
	try {
		const items = await (kind === 'list' ? userListsCache.fetch() : antennasCache.fetch());
		if (request !== collectionRequests[kind]) return null;
		collectionItems.value[kind] = items;
		collectionStates.value[kind] = items.length > 0 ? 'ready' : 'empty';
		return items;
	} catch {
		if (request === collectionRequests[kind]) collectionStates.value[kind] = 'error';
		return null;
	}
}

function closeCollectionPicker(restoreFocus = false) {
	collectionIntent++;
	pickerKind.value = null;
	if (restoreFocus && pickerTrigger.value?.isConnected) pickerTrigger.value.focus();
}

async function showCollectionPicker(kind: CollectionKind, event?: MouseEvent) {
	if (props.compact && props.mobileComposerTarget) return;
	optionsOpen.value = false;
	if (event?.currentTarget instanceof HTMLElement) pickerTrigger.value = event.currentTarget;
	pickerKind.value = kind;
	const intent = collectionIntent;
	await nextTick();
	if (intent === collectionIntent && pickerKind.value === kind) pickerEl.value?.focus();
}

async function openCollection(kind: CollectionKind, event?: MouseEvent) {
	if (!$i) return;
	if (props.compact && props.mobileComposerTarget) {
		emit('mobileCollection', kind);
		return;
	}
	const intent = ++collectionIntent;
	preferredPicker = true;
	void showCollectionPicker(kind, event);
	const items = await fetchCollections(kind);
	if (intent !== collectionIntent || !items) return;
	const remembered = miLocalStorage.getItem(rememberedCollectionKey(kind));
	const item = items.find(item => item.id === remembered) ?? items[0];
	if (item) await selectCollection(kind, item.id);
}

async function toggleCollectionPicker(kind: CollectionKind, event: MouseEvent) {
	if (pickerKind.value === kind) { closeCollectionPicker(true); return; }
	const intent = ++collectionIntent;
	preferredPicker = false;
	void showCollectionPicker(kind, event);
	await fetchCollections(kind);
	if (intent === collectionIntent) focusPickerItem();
}

function focusPickerItem(intent = collectionIntent) {
	void nextTick(() => {
		if (intent !== collectionIntent || !pickerKind.value) return;
		(pickerEl.value?.querySelector<HTMLElement>('[data-collection-id][data-active], [data-collection-id], button, a') ?? pickerEl.value)?.focus();
	});
}

async function retryCollection() {
	const kind = pickerKind.value;
	if (!kind) return;
	if (preferredPicker) await openCollection(kind);
	else {
		const intent = collectionIntent;
		await fetchCollections(kind);
		focusPickerItem(intent);
	}
}

async function selectCollection(kind: CollectionKind, id: string) {
	if (!collectionItems.value[kind].some(item => item.id === id)) return;
	const changed = selectedCollections.value[kind] !== id;
	selectedCollections.value[kind] = id;
	miLocalStorage.setItem(rememberedCollectionKey(kind), id);
	closeCollectionPicker(true);
	await onTabClick(kind, changed, true);
}

function openCollectionSettings(kind: CollectionKind, manage = false) {
	navigationRevision++;
	const id = selectedCollections.value[kind];
	closeCollectionPicker();
	mainRouter.pushByPath(`/my/${kind === 'list' ? 'lists' : 'antennas'}${!manage && id ? `/${encodeURIComponent(id)}` : ''}`);
}

function goToChannels() {
	navigationRevision++;
	closeCollectionPicker();
	mainRouter.pushByPath('/channels');
}

function onPickerPointerDown(event: Event) {
	if (!pickerKind.value || pickerEl.value?.contains(event.target as Node) || pickerTrigger.value?.contains(event.target as Node)) return;
	closeCollectionPicker();
}

function onPickerEscape(event: KeyboardEvent) {
	if (event.key === 'Escape' && pickerKind.value) { event.preventDefault(); closeCollectionPicker(true); }
}

function onPickerKeydown(event: KeyboardEvent) {
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	const items = Array.from(pickerEl.value?.querySelectorAll<HTMLElement>('button:not(:disabled), a') ?? []);
	if (items.length === 0) return;
	event.preventDefault();
	const current = items.indexOf(window.document.activeElement as HTMLElement);
	const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[index].focus();
}

watch(pickerKind, kind => {
	window.document.removeEventListener('pointerdown', onPickerPointerDown, true);
	window.document.removeEventListener('click', onPickerPointerDown, true);
	window.document.removeEventListener('keydown', onPickerEscape);
	if (kind) {
		window.document.addEventListener('pointerdown', onPickerPointerDown, true);
		window.document.addEventListener('click', onPickerPointerDown, true);
		window.document.addEventListener('keydown', onPickerEscape);
	}
});

type TimelineNote = Misskey.entities.Note & TimelineAdMarker;
const notes = ref<TimelineNote[]>([]);
const queue = ref<TimelineNote[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const loadMoreFailed = ref(false);
const error = ref(false);

const navEl = shallowRef<HTMLElement | null>(null);
const desktopRailEl = shallowRef<HTMLElement | null>(null);
const desktopRailActive = computed(() => !props.compact && desktopRailEl.value != null);
const emit = defineEmits<{ punchBusy: [busy: boolean]; mobileCollection: [kind: CollectionKind]; revealComposer: [] }>();
const punchBusy = ref(false);
const punchNavbarFrame = shallowRef<HTMLElement | null>(null);
const punchNavbarTarget = shallowRef<HTMLElement | null>(null);
watch(punchBusy, busy => emit('punchBusy', busy), { flush: 'sync' });
onBeforeUnmount(() => emit('punchBusy', false));
const scrollEl = shallowRef<HTMLElement | null>(null);
const timelineAtTop = ref(false);

function syncTimelineAtTop() {
	timelineAtTop.value = scrollEl.value != null && scrollEl.value.scrollTop <= 2;
}

const externalTimelineRef = shallowRef<InstanceType<typeof MkExternalTimeline> | null>(null);
const hatadyTimelineRef = shallowRef<InstanceType<typeof MkHatadyTimeline> | null>(null);
const listEl = shallowRef<HTMLElement | null>(null);
const removal = useNoteRemoval(() => listEl.value);
const sentinelEl = shallowRef<HTMLElement | null>(null);
const bannerEl = shallowRef<HTMLElement | null>(null);
const bannerContentEl = shallowRef<HTMLElement | null>(null);
const flashEl = shallowRef<HTMLElement | null>(null);
const flash2El = shallowRef<HTMLElement | null>(null);

const filterState = computed(() => store.r.tl.value.filter);

// ===== LTL の絵文字投票 =====
// Hataskey UI と同じ投票ストアを使い、投票・演出の「1回だけ」は UI をまたいで共有される。
const VOTE_TRIGGER = '絵文字を選ぶぞ';
const voteEffectsEl = shallowRef<HTMLElement | null>(null);
const emojiVoteActive = computed(() => props.active && tab.value === 'local' && !punchBusy.value && prefer.r.ltlEmojiVoteEnabled.value);
const {
	round: emojiVoteRound, choice: emojiVoteChoice, now: emojiVoteNow, phase: emojiVotePhase,
	submitting: emojiVoteSubmitting, voteError: emojiVoteError, declined: emojiVoteDeclined,
	refresh: refreshEmojiVote, vote: voteEmoji, dismiss: dismissEmojiVote, claimEffect: claimEmojiVoteEffect,
} = useLtlEmojiVote(emojiVoteActive);
const emojiVoteAnchor = computed(() => emojiVoteActive.value && emojiVotePhase.value !== 'idle' && (!loading.value || pullRefresh.active.value)
	? getLtlEmojiVoteAnchor([...queue.value, ...notes.value], emojiVoteRound.value?.noteId, $i, {
		mutedWords: [...($i?.mutedWords ?? []), ...($i?.hardMutedWords ?? [])],
		withSensitive: filterState.value.withSensitive,
	}) : null);
// 届いた(まだ新着バナーに溜まっている分も含む)開始の合図から、進行中の回を読み込む。
watch(() => emojiVoteActive.value
	? [...queue.value, ...notes.value].filter(note => note.text?.trim() === VOTE_TRIGGER).map(note => note.id).join(',')
	: '', ids => {
	if (ids) void refreshEmojiVote(ids.split(',')[0]);
});
// 「…」一覧。外側を押す・Esc・タブ切り替えで閉じる。
const optionsOpen = ref(false);
const optionsWrapEl = shallowRef<HTMLElement | null>(null);
const optionsEl = shallowRef<HTMLElement | null>(null);
const desktopPopupStyle = shallowRef<Record<string, string>>({});

function positionDesktopPopup() {
	const rail = desktopRailEl.value;
	const popup = pickerKind.value ? pickerEl.value : optionsOpen.value ? optionsEl.value : null;
	if (!desktopRailActive.value || !rail || !popup) {
		desktopPopupStyle.value = {};
		return;
	}
	const viewportWidth = window.document.documentElement.clientWidth || window.innerWidth;
	const viewportHeight = window.innerHeight;
	// Anchor to the expanded rail edge even while its width is animating.
	const railLeft = rail.getBoundingClientRect().right - 208;
	const width = Math.min(pickerKind.value ? 320 : 260, Math.max(0, railLeft - 20), Math.max(0, viewportWidth - 24));
	const maxHeight = Math.max(0, viewportHeight - 24);
	const height = Math.min(popup.scrollHeight + 4, maxHeight);
	const trigger = pickerKind.value ? pickerTrigger.value : optionsWrapEl.value;
	const top = Math.max(12, Math.min(trigger?.getBoundingClientRect().top ?? 12, viewportHeight - height - 12));
	const left = Math.max(12, railLeft - width - 8);
	desktopPopupStyle.value = { width: `${width}px`, left: `${left}px`, top: `${top}px`, maxHeight: `${maxHeight}px` };
}

watch([desktopRailActive, pickerKind, optionsOpen, pickerState, pickerItems], async () => {
	await nextTick();
	positionDesktopPopup();
}, { flush: 'post' });

const timelineTabGestures = createTimelineTabGestures({
	enabled: () => props.active && !props.confirmationActive && tabSwipeEnabled.value && !props.mobileMenuOpen && !pullRefresh.active.value && !punchBusy.value && !pickerKind.value && !optionsOpen.value,
	root: () => scrollEl.value,
	canMove: direction => {
		const index = tabs.value.findIndex(item => item.id === tab.value);
		return index >= 0 && tabs.value[index + direction] != null;
	},
	move: direction => {
		const index = tabs.value.findIndex(item => item.id === tab.value);
		const next = tabs.value[index + direction];
		if (next) void onTabClick(next.id);
	},
});
watch([tabSwipeEnabled, punchBusy, pickerKind, optionsOpen, () => props.active], () => timelineTabGestures.reset(), { flush: 'sync' });
onBeforeUnmount(timelineTabGestures.destroy);

function onOptionsPointerDown(ev: PointerEvent) {
	if (!optionsOpen.value) return;
	if (optionsWrapEl.value?.contains(ev.target as Node | null) || optionsEl.value?.contains(ev.target as Node | null)) return;
	optionsOpen.value = false;
}

function onOptionsKeydown(ev: KeyboardEvent) {
	if (ev.key === 'Escape') optionsOpen.value = false;
}

watch(optionsOpen, open => {
	if (open) {
		closeCollectionPicker();
		window.document.addEventListener('pointerdown', onOptionsPointerDown, true);
		window.document.addEventListener('keydown', onOptionsKeydown);
	} else {
		window.document.removeEventListener('pointerdown', onOptionsPointerDown, true);
		window.document.removeEventListener('keydown', onOptionsKeydown);
	}
});
watch(tab, () => { optionsOpen.value = false; });
onBeforeUnmount(() => {
	window.document.removeEventListener('pointerdown', onOptionsPointerDown, true);
	window.document.removeEventListener('keydown', onOptionsKeydown);
});

const filters = computed(() => ([
	{ key: 'withRenotes' as const, label: i18n.ts.showRenotes, icon: Repeat2 },
	{ key: 'onlyFiles' as const, label: i18n.ts.fileAttachedOnly, icon: Image },
	{ key: 'withSensitive' as const, label: i18n.ts.withSensitive, icon: Eye },
]).map(f => ({ ...f, on: filterState.value[f.key] === true })));

function linkKindFor(note: Misskey.entities.Note): 'reply' | 'quote' | null {
	const link = hk3ComposerLink.value;
	if (link == null) return null;
	const target = Misskey.note.isPureRenote(note) ? note.renoteId : note.id;
	return target === link.noteId ? link.kind : null;
}

const currentToast = shallowRef(hk3Toasts.value[0] ?? null);
const hasQueued = computed(() => queue.value.length > 0 || externalNotice.value != null);
const bannerOn = computed(() => currentToast.value != null || hasQueued.value);
const rssEnabled = computed(() => prefer.r.hataskeyUi3RssEnabled.value);
const timelineCollapsing = ref(false);
const rssReaderOpen = ref(false);
const emojiHostOpen = ref(false);
watch(rssEnabled, enabled => { if (!enabled) rssReaderOpen.value = false; });
const rssEffectPaused = computed(() => !props.active || props.confirmationActive || pullRefresh.active.value || punchBusy.value || timelineCollapsing.value || (!!emojiVoteAnchor.value && ['rain', 'leaving'].includes(emojiVotePhase.value)));

function openRssSettings() {
	optionsOpen.value = false;
	mainRouter.pushByPath('/settings/preferences?destination=hataskey-ui-s#hataskey-ui-s-rss-heading');
}

// 消える演出の間も直前の内容を描き続けるため、表示状態と最後の中身を別に持つ。
const bannerShown = ref(false);
const hasNavbarSurface = computed(() => props.compact || !desktopRailActive.value || bannerShown.value || rssEnabled.value || !!(emojiVoteRound.value && emojiVoteAnchor.value));
const showTopGlow = computed(() => timelineAtTop.value && hasNavbarSurface.value && props.active && !props.confirmationActive && !pullRefresh.active.value && !punchBusy.value && !timelineCollapsing.value);
const lastToast = shallowRef<Hk3Toast | null>(null);
const lastQueue = shallowRef<Misskey.entities.Note[]>([]);
const lastKind = ref<'toast' | 'queue'>('queue');
watch(currentToast, toast => {
	if (toast) {
		lastToast.value = toast;
		lastKind.value = 'toast';
	} else if (hasQueued.value) lastKind.value = 'queue';
}, { immediate: true });
watch(queue, notes => {
	if (notes.length === 0) return;
	lastQueue.value = notes;
	if (currentToast.value == null) lastKind.value = 'queue';
}, { immediate: true });
const bannerToast = computed(() => currentToast.value ?? (bannerOn.value || lastKind.value !== 'toast' ? null : lastToast.value));
const bannerNoteAction = computed<'favorite' | 'clip' | 'edit' | 'delete' | null>(() => {
	switch (bannerToast.value?.icon) {
		case 'star': return 'favorite';
		case 'clip': return 'clip';
		case 'pencil': return 'edit';
		case 'trash': return 'delete';
		default: return null;
	}
});
const bannerToastAuthor = computed(() => {
	const toast = bannerToast.value;
	if (toast?.user) return { ...toast.user, host: toast.user.host ?? toast.emojiHost ?? null };
	// MkMfm は author.host が null の場合 emojiUrls を参照しない。
	if (toast?.emojiUrl) return { host: window.location.host } as Misskey.entities.UserLite;
	return undefined;
});
const bannerToastEmojiUrls = computed(() => {
	const toast = bannerToast.value;
	const host = bannerToastAuthor.value?.host;
	const urls: Record<string, string> = { ...(host ? getExternalEmojiUrlMapForHost(host) : null), ...toast?.user?.emojis };
	// 絵文字追加のお知らせは URL を持つが、文言内の :name: は辞書を持たない。
	const addedName = toast?.emojiUrl ? toast.text.match(/:([^:\s]+):/u)?.[1] : null;
	if (addedName && toast?.emojiUrl) urls[addedName] = toast.emojiUrl;
	return urls;
});
const bannerQueue = computed(() => queue.value.length > 0 ? queue.value : lastQueue.value);
const bannerFaces = computed(() => bannerQueue.value.slice(0, 3).map(note => ({ id: note.id, user: note.user })));
const bannerCount = computed(() => bannerQueue.value.length);
// 外部TLの新着は件数などの文言を外部TL側が作る。消える演出の間も直前の文言を残す。
const lastExternalNotice = shallowRef<HataskeyTimelineNewNotes | null>(null);
watch(externalNotice, notice => {
	if (notice) {
		lastExternalNotice.value = notice;
		if (currentToast.value == null) lastKind.value = 'queue';
	} else if (queue.value.length > 0) lastExternalNotice.value = null;
});
watch(queue, notes => { if (notes.length > 0) lastExternalNotice.value = null; });
const bannerExternalNotice = computed(() => externalNotice.value ?? (queue.value.length > 0 ? null : lastExternalNotice.value));
const bannerExternalText = computed(() => bannerExternalNotice.value?.text ?? null);
const bannerExternalAvatars = computed(() => bannerExternalNotice.value?.avatars ?? []);
const bannerQueueLabel = computed(() => bannerExternalNotice.value?.text ?? i18n.tsx.newNoteRecivedCount({ n: bannerCount.value }));

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const systemReducedMotion = ref(motionQuery.matches);
const motionEnabled = computed(() => props.active && prefer.r.animation.value && !systemReducedMotion.value);
const motion = () => motionEnabled.value;
const homeScroll = createHk3HomeScroll(() => scrollEl.value, motion);
watch(motionEnabled, enabled => {
	if (!enabled) {
		if (props.active) homeScroll.finish();
		else homeScroll.cancel();
	}
}, { flush: 'sync' });
const mobileDocked = computed(() => props.compact && !!props.mobileComposerTarget);
const noteMoving = createHk3NoteMoving();
const movingCleanupFrames = new Set<number>();

function cancelMovingNotes() {
	for (const frame of movingCleanupFrames) window.cancelAnimationFrame(frame);
	movingCleanupFrames.clear();
	noteMoving.cancelAll();
}

watch(motionEnabled, enabled => { if (!enabled) cancelMovingNotes(); }, { flush: 'sync' });
const pullRefresh = createNavbarPullRefresh(computed(() => props.active && !props.confirmationActive && prefer.r.enablePullToRefresh.value && !props.mobileMenuOpen && !punchBusy.value && !pickerKind.value && !optionsOpen.value && !timelineCollapsing.value && !emojiHostOpen.value && !rssReaderOpen.value), motionEnabled, {
	presentation: direction => mobileDocked.value && (direction === 'up' || props.mobileComposerOpen) ? 'dock' : 'navbar',
	feedback: () => mobileDocked.value,
	refresher: refreshFromPull,
});
const mobilePullState = computed<NavbarPullState>(() => pullRefresh.state.value);
const navbarPullActive = computed(() => pullRefresh.active.value && (!mobileDocked.value || pullRefresh.state.value.presentation === 'navbar'));
const pullPromptLabel = computed(() => pullRefresh.state.value.phase === 'success' ? i18n.ts.done : pullRefresh.state.value.phase === 'error' ? copy.loadFailed : pullRefresh.state.value.phase === 'refreshing' ? i18n.ts.refreshing : pullRefresh.state.value.phase === 'ready' ? i18n.ts.releaseToRefresh : i18n.ts.pullDownToRefresh);
const pullPromptIcon = computed(() => pullRefresh.state.value.phase === 'success' ? 'ti ti-check' : pullRefresh.state.value.phase === 'error' ? 'ti ti-exclamation-circle' : pullRefresh.state.value.phase === 'refreshing' ? 'ti ti-refresh' : 'ti ti-arrow-down');
provide(navbarPullRefreshKey, pullRefresh);
watch([() => hk3Toasts.value[0] ?? null, pullRefresh.active], ([toast, pulling]) => {
	// New notices retain their full icon animation until the refresh surface returns.
	if (!pulling) currentToast.value = toast;
}, { immediate: true, flush: 'sync' });
const pullToastOwner = Symbol('timeline-pull');
const pullBaseHeight = ref(0);
const pullTabsHeight = ref(0);
const pullColors = ref<Record<string, string>>({});
const pullNavbarStyle = computed(() => ({
	...pullRefresh.style.value,
	...(pullRefresh.active.value ? {
		height: `${pullBaseHeight.value + pullRefresh.state.value.height}px`,
		'--pull-content-height': `${pullBaseHeight.value}px`,
		'--pull-tabs-height': `${pullTabsHeight.value}px`,
		...pullColors.value,
	} : {}),
}));
watch(pullRefresh.active, active => {
	setHk3ToastsPaused(pullToastOwner, active);
	if (!active) return;
	pullBaseHeight.value = punchNavbarFrame.value?.getBoundingClientRect().height ?? (desktopRailActive.value ? 0 : 58);
	pullTabsHeight.value = props.compact ? mobileCapsuleEl.value?.getBoundingClientRect().height ?? 44 : desktopRailActive.value ? 0 : navEl.value?.getBoundingClientRect().height ?? 58;
	const frame = punchNavbarFrame.value;
	if (frame) {
		const colors = getComputedStyle(frame);
		const hasBanner = bannerOn.value || rssEnabled.value;
		pullColors.value = {
			'--pull-surface': hasBanner ? `color-mix(in srgb, ${colors.getPropertyValue('--hk3-accent')} 10%, ${colors.getPropertyValue('--hk3-bg')})` : colors.getPropertyValue('--hk3-bg'),
			'--pull-ink': colors.getPropertyValue('--hk3-text'),
		};
	}
}, { flush: 'sync' });
watch(tab, () => pullRefresh.reset());
watch(desktopRailActive, () => pullRefresh.reset());
watch([() => props.compact, mobileDocked], () => pullRefresh.reset());
onBeforeUnmount(() => { pullRefresh.dispose(); setHk3ToastsPaused(pullToastOwner, false); });

async function refreshFromPull() {
	if (!props.active || props.confirmationActive) return Promise.resolve();
	homeScroll.cancel();
	if (isConcrntTab.value) await concrntTimelineRef.value?.reloadTimeline();
	else if (isExternalTab.value) await externalTimelineRef.value?.reloadTimeline(true);
	else if (isHatadyTab.value) await hatadyTimelineRef.value?.refreshFromPull();
	else {
		await reload(false, true);
		if (error.value) throw new Error('Timeline refresh failed');
	}
}

function attachMobilePullGesture(root: HTMLElement, onClaim: () => void, canStart: () => boolean) {
	return attachNavbarPullGesture(root, root, pullRefresh, refreshFromPull, {
		direction: 'up',
		onClaim,
		canStart: () => mobileDocked.value && canStart(),
	});
}

function onMotionChange(event: MediaQueryListEvent) { systemReducedMotion.value = event.matches; }

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const TOAST_ICONS: Record<Hk3Toast['icon'], Component> = {
	bell: Bell, heart: Heart, reply: Reply, repeat: Repeat2, quote: Quote, userPlus: UserPlus, mention: AtSign, poll: ChartBar,
	zap: Zap, zapOff: ZapOff, sun: Sun, moon: Moon, send: SendHorizontal, check: Check, filter: Filter,
	star: Star, clip: Paperclip, pencil: Pencil, trash: Trash2, clock: Clock, smile: SmilePlus,
};

function toastIcon(icon: Hk3Toast['icon']): Component {
	return TOAST_ICONS[icon] ?? Bell;
}

// ===== 取得 =====
async function fetchPage(untilId?: string, offset = 0): Promise<Misskey.entities.Note[]> {
	const filter = store.s.tl.filter;
	const params = { limit: PAGE, untilId, withRenotes: filter.withRenotes, withFiles: filter.onlyFiles ? true : undefined };
	switch (tab.value) {
		case 'following': return await misskeyApi('notes/timeline', params);
		case 'local': return await misskeyApi('notes/local-timeline', params);
		case 'social': return await misskeyApi('notes/hybrid-timeline', params);
		case 'mixed': return await misskeyApi('notes/global-timeline', params);
		case 'list': return activeCollection.value ? await misskeyApi('notes/user-list-timeline', { ...params, listId: activeCollection.value.id }) : [];
		case 'antenna': return activeCollection.value ? await misskeyApi('antennas/notes', { limit: PAGE, untilId, antennaId: activeCollection.value.id }) : [];
		case 'trending': return await misskeyApi('notes/trending', { limit: PAGE, offset, seed: trendingSeed });
		default: return [];
	}
}

// トレンドは同じ seed で並び順を固定し、続きの読み込みで重複・抜けが出ないようにする。
let trendingSeed = 1;
let loadSeq = 0;
let adInsertionCounter = 0;
const countedIncomingAds = new Map<string, boolean>();

async function reload(collectionValidated = false, preserveIncoming = false) {
	if (isHatadyTab.value) {
		++loadSeq;
		disconnect();
		notes.value = [];
		queue.value = [];
		loading.value = false;
		await hatadyTimelineRef.value?.reloadTimeline();
		return;
	}
	homeScroll.cancel();
	composerScroll.show();
	cancelPostEntrance();
	discardPendingPost();
	removal.cancelAll();
	const seq = ++loadSeq;
	adInsertionCounter = 0;
	countedIncomingAds.clear();
	const intent = collectionIntent;
	trendingSeed = Math.floor(Math.random() * 2147483646) + 1;
	loading.value = true;
	loadingMore.value = false;
	error.value = false;
	if (!preserveIncoming) queue.value = [];
	loadMoreFailed.value = false;
	if (!preserveIncoming) disconnect();
	if (isExternalTab.value || isConcrntTab.value) {
		notes.value = [];
		loading.value = false;
		return;
	}
	try {
		if (isCollectionTab.value) {
			const kind = tab.value as CollectionKind;
			if (!collectionValidated && !activeCollection.value) {
				preferredPicker = true;
				void showCollectionPicker(kind);
			}
			const items = collectionValidated ? collectionItems.value[kind] : await fetchCollections(kind);
			if (seq !== loadSeq) return;
			const remembered = selectedCollections.value[kind] ?? miLocalStorage.getItem(rememberedCollectionKey(kind));
			const selected = items?.find(item => item.id === remembered) ?? items?.[0];
			selectedCollections.value[kind] = selected?.id ?? null;
			if (!selected) {
				notes.value = [];
				hasMore.value = false;
				if (!pickerKind.value && intent === collectionIntent) {
					preferredPicker = true;
					void showCollectionPicker(kind);
				}
				return;
			}
			miLocalStorage.setItem(rememberedCollectionKey(kind), selected.id);
			if (intent === collectionIntent && preferredPicker && pickerKind.value === kind) closeCollectionPicker();
		}
		const result = await fetchPage();
		if (seq !== loadSeq) return;
		if (preserveIncoming) {
			const known = new Set(result.map(note => note.id));
			queue.value = queue.value.filter(note => !known.has(note.id));
		}
		notes.value = markTimelineAdPage(result, 'initial');
		// タイムラインは件数が上限未満でも続きがあることがある。空になった時だけ終端とする。
		hasMore.value = result.length > 0;
		if (!connection) connect();
	} catch (err) {
		if (seq !== loadSeq) return;
		console.error('Hataskey UI 3 timeline failed', err);
		error.value = true;
		if (!preserveIncoming) notes.value = [];
	} finally {
		if (seq === loadSeq) loading.value = false;
	}
}

async function loadMore() {
	if (!props.active || loadingMore.value || loading.value || !hasMore.value || notes.value.length === 0) return;
	loadingMore.value = true;
	const seq = loadSeq;
	try {
		const oldest = notes.value[notes.value.length - 1];
		const result = await fetchPage(tab.value === 'trending' ? undefined : oldest.id, notes.value.length);
		if (seq !== loadSeq) return;
		const known = new Set(notes.value.map(note => note.id));
		notes.value.push(...markTimelineAdPage(result, 'older').filter(note => !known.has(note.id)));
		// タイムラインは件数が上限未満でも続きがあることがある。空になった時だけ終端とする。
		hasMore.value = result.length > 0;
		loadMoreFailed.value = false;
	} catch {
		if (seq !== loadSeq) return;
		// 一時的な失敗で「これより前は無い」と誤って伝えないよう、再試行を促す。
		loadMoreFailed.value = true;
	} finally {
		if (seq === loadSeq) loadingMore.value = false;
	}
}

// ===== ストリーム =====
const stream = useStream();
let connection: { dispose: () => void } | null = null;

let streamRevision = 0;

function connect() {
	if (tab.value === 'trending' || tab.value === 'hatady' || tab.value === 'ctl' || tab.value === 'ohtl' || tab.value === 'oltl') return;
	const filter = store.s.tl.filter;
	const params = { withRenotes: filter.withRenotes, withFiles: filter.onlyFiles ? true : undefined };
	const revision = streamRevision;
	const receive = (note: Misskey.entities.Note) => { if (revision === streamRevision) onStreamNote(note); };
	if (tab.value === 'list') {
		if (!activeCollection.value) return;
		const channelConnection = stream.useChannel('userList', { ...params, listId: activeCollection.value.id });
		channelConnection.on('note', receive);
		connection = channelConnection;
	} else if (tab.value === 'antenna') {
		if (!activeCollection.value) return;
		const channelConnection = stream.useChannel('antenna', { antennaId: activeCollection.value.id });
		channelConnection.on('note', receive);
		connection = channelConnection;
	} else {
		const channel = ({ following: 'homeTimeline', local: 'localTimeline', social: 'hybridTimeline', mixed: 'globalTimeline' } as const)[tab.value];
		const channelConnection = stream.useChannel(channel, params);
		channelConnection.on('note', receive);
		connection = channelConnection;
	}
}

function disconnect() {
	streamRevision++;
	connection?.dispose();
	connection = null;
}

function isKnown(id: string): boolean {
	return notes.value.some(note => note.id === id) || queue.value.some(note => note.id === id);
}

function markIncomingAd(note: Misskey.entities.Note): TimelineNote {
	let marked = countedIncomingAds.get(note.id);
	if (marked === undefined) {
		adInsertionCounter++;
		marked = shouldInsertStreamingAd(adInsertionCounter, instance.notesPerOneAd);
		countedIncomingAds.set(note.id, marked);
	}
	return marked ? { ...note, _shouldInsertAd_: true } : note;
}

function onStreamNote(note: Misskey.entities.Note) {
	if (isKnown(note.id)) return;
	// Hold this composer's echo until its API result identifies the new note.
	// Other people's posts still arrive normally; a failed send releases the buffer.
	if (pendingPost && pendingPost.seq === loadSeq && note.userId === $i?.id) {
		if (!pendingPost.echoes.some(item => item.id === note.id)) pendingPost.echoes.push(markIncomingAd(note));
		return;
	}
	const receivedNote = markIncomingAd(note);
	// 通常UIと同じサウンド設定を使い、LIVE表示・新着待ちのどちらでも受信時に一度だけ鳴らす。
	if (props.active) sound.playMisskeySfx($i && note.userId === $i.id ? 'noteMy' : 'note');
	// LIVE中でも、読み進めている位置を動かさないよう、スクロール中の新着はバナーへ回す。
	if (props.active && !pullRefresh.active.value && !punchBusy.value && live.value && (scrollEl.value?.scrollTop ?? 0) < 8) {
		notes.value.unshift(receivedNote);
		return;
	}
	queue.value = [receivedNote, ...queue.value].slice(0, QUEUE_MAX);
}

// 削除されたノート(自分の削除・ストリームの削除通知)は、その純リノートも含めて一覧と新着待ちから外す。
useGlobalEvent('noteDeleted', noteId => {
	if (enteringPostId === noteId) cancelPostEntrance();
	const keep = (note: Misskey.entities.Note) => note.id !== noteId && !(note.renoteId === noteId && Misskey.note.isPureRenote(note));
	for (const note of notes.value.filter(note => !keep(note))) {
		removal.remove(note.id, () => { notes.value = notes.value.filter(item => item.id !== note.id); });
	}
	queue.value = queue.value.filter(keep);
});

type PendingPost = { seq: number; echoes: TimelineNote[]; cancel: () => void };
let pendingPost: PendingPost | null = null;
let stopPostEntrance: (() => void) | null = null;
let enteringPostId: string | null = null;
let postEntranceRevision = 0;
const postEntranceActive = ref(false);
let postEntranceTimer: number | undefined;

const composerEl = shallowRef<HTMLElement | null>(null);
const composerScroll = createHk3ComposerScroll({
	viewport: () => scrollEl.value,
	composer: () => composerEl.value,
	blocked: () => mobileDocked.value || !props.active || props.confirmationActive || props.mobileMenuOpen || pullRefresh.active.value || punchBusy.value || timelineCollapsing.value || postEntranceActive.value ||
		!!composerEl.value?.querySelector('[data-busy="true"], [aria-expanded="true"]'),
});
watch([pullRefresh.active, punchBusy, timelineCollapsing, postEntranceActive, composerPosition], () => composerScroll.show());
watch([() => props.mobileMenuOpen, () => props.confirmationActive], () => { composerScroll.show(); timelineTabGestures.reset(); });

function cancelPostEntrance() {
	window.clearTimeout(postEntranceTimer);
	postEntranceActive.value = false;
	postEntranceRevision++;
	stopPostEntrance?.();
	stopPostEntrance = null;
	enteringPostId = null;
}

watch(() => props.active, active => {
	if (active) return;
	homeScroll.cancel();
	// The desktop rail and mobile composer can be teleported outside the hidden parent.
	// Close popups without returning focus to a timeline that is no longer visible.
	closeCollectionPicker();
	optionsOpen.value = false;
	pullRefresh.reset();
	timelineTabGestures.reset();
	cancelPostEntrance();
	cancelMovingNotes();
	bannerRevision++;
	stopBannerAnimations();
	bannerShown.value = bannerOn.value;
}, { flush: 'sync' });

function discardPendingPost() {
	if (pendingPost) pendingPost.echoes = [];
	pendingPost?.cancel();
}

function acceptsPostedNote(note: Misskey.entities.Note): boolean {
	if (isExternalTab.value || isConcrntTab.value || isHatadyTab.value || isCollectionTab.value || tab.value === 'trending' || note.channelId) return false;
	if ((tab.value === 'local' || tab.value === 'mixed') && note.visibility !== 'public') return false;
	return !filterState.value.onlyFiles || (note.files?.length ?? 0) > 0;
}

async function showPostedNote(note: Misskey.entities.Note, source: DOMRectReadOnly | null = null) {
	if (!acceptsPostedNote(note)) return;
	if (notes.value.some(item => item.id === note.id)) return;
	const incomingNote = markIncomingAd(note);
	if (!props.active || punchBusy.value || pullRefresh.active.value || timelineCollapsing.value || loading.value) {
		if (!isKnown(note.id)) queue.value = [incomingNote, ...queue.value].slice(0, QUEUE_MAX);
		return;
	}
	cancelPostEntrance();
	const revision = postEntranceRevision;
	const seq = loadSeq;
	const atTop = (scrollEl.value?.scrollTop ?? 0) < 8;
	queue.value = queue.value.filter(item => item.id !== note.id);
	notes.value.unshift(incomingNote);
	await nextTick();
	if (revision !== postEntranceRevision || seq !== loadSeq) return;
	const viewport = scrollEl.value;
	if (!viewport) return;
	if (!atTop) {
		viewport.scrollTo({ top: 0, behavior: motion() ? 'smooth' : 'auto' });
		return;
	}
	if (!source) return;
	const target = Array.from(listEl.value?.children ?? []).find((el): el is HTMLElement =>
		el instanceof HTMLElement && el.dataset.noteRemovalId === note.id);
	if (!target) return;
	enteringPostId = note.id;
	postEntranceActive.value = true;
	stopPostEntrance = animateHk3PostEntrance({ source, target, viewport, note: incomingNote, motion: motion() });
	postEntranceTimer = window.setTimeout(() => { postEntranceActive.value = false; }, 700);
}

// Only the standard timeline provides this context, including its compact mobile view.
// The deck composer has no provider and keeps its existing posting behavior.
function revealComposer() {
	composerScroll.show();
	if (mobileDocked.value) emit('revealComposer');
}

provide(hk3PostContextKey, {
	reveal: revealComposer,
	begin() {
		revealComposer();
		pendingPost?.cancel();
		const seq = loadSeq;
		let finished = false;
		const release = (createdId?: string) => {
			if (finished) return false;
			finished = true;
			window.clearTimeout(timer);
			if (pendingPost === receipt) pendingPost = null;
			if (seq === loadSeq) {
				for (const echo of receipt.echoes) if (echo.id !== createdId) onStreamNote(echo);
			}
			receipt.echoes = [];
			return seq === loadSeq;
		};
		const receipt: PendingPost = { seq, echoes: [], cancel: () => { release(); } };
		// A stalled request must not indefinitely hold posts from another device.
		const timer = window.setTimeout(() => {
			if (pendingPost === receipt) pendingPost = null;
			if (seq === loadSeq) for (const echo of receipt.echoes) onStreamNote(echo);
			receipt.echoes = [];
		}, 10000);
		pendingPost = receipt;
		return {
			cancel: receipt.cancel,
			complete(note, source) {
				const alreadyKnown = isKnown(note.id);
				const accepted = acceptsPostedNote(note);
				// Collections use the server stream as proof that a note belongs there.
				if (!release(accepted ? note.id : undefined) || !accepted) return;
				if (props.active && !alreadyKnown) sound.playMisskeySfx('noteMy');
				void showPostedNote(note, source);
			},
		};
	},
});

watch([motionEnabled, pullRefresh.active, punchBusy, timelineCollapsing], ([enabled, pulling, punching, collapsing]) => {
	if (!enabled || pulling || punching || collapsing) cancelPostEntrance();
});

watch(hk3PostedNote, note => {
	if (note == null) return;
	hk3PostedNote.value = null;
	void showPostedNote(note);
});

// ===== 操作 =====
function scrollTop() {
	if (!props.active) return;
	homeScroll.cancel();
	scrollEl.value?.scrollTo({ top: 0, behavior: motion() ? 'smooth' : 'auto' });
}

function scrollHomeTop() {
	if (props.active) homeScroll.start();
}

function onNavClick(ev: MouseEvent) {
	if ((ev.target as HTMLElement).closest('button')) return;
	scrollTop();
}

let navigationRevision = 0;
let navigationPending = false;

async function onTabClick(id: TabId, force = false, collectionValidated = false) {
	homeScroll.cancel();
	closeCollectionPicker();
	const revision = ++navigationRevision;
	if (id === tab.value && !force && !navigationPending) {
		scrollTop();
		return;
	}
	navigationPending = true;
	++loadSeq;
	disconnect();
	queue.value = [];
	try {
		await hideList();
		if (revision !== navigationRevision) return;
		notes.value = [];
		tab.value = id;
		miLocalStorage.setItem('hataskeyUi3Tab', id);
		scrollEl.value?.scrollTo({ top: 0 });
		syncTimelineAtTop();
		await nextTick();
		if (revision !== navigationRevision) return;
		syncTimelineAtTop();
		await reload(collectionValidated);
		if (revision !== navigationRevision) return;
		await nextTick();
		if (revision === navigationRevision) revealList(60);
	} finally {
		if (revision === navigationRevision) navigationPending = false;
	}
}

function listChildren(): HTMLElement[] {
	return Array.from(listEl.value?.children ?? []).slice(0, 8) as HTMLElement[];
}

async function hideList(): Promise<void> {
	if (!motion()) return;
	const els = listChildren();
	if (els.length === 0) return;
	const anims = els.map((el, i) => noteMoving.track(el, el.animate([
		{ opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
		{ opacity: 0, transform: 'translateY(-20px)', clipPath: 'inset(0 0 100% 0)' },
	], { duration: 280, delay: (els.length - 1 - i) * 30, easing: 'cubic-bezier(0.64, 0, 0.78, 0)', fill: 'forwards' }), true));
	await Promise.allSettled(anims.map(a => a.finished));
	if (!motion()) return;
	const frame = window.requestAnimationFrame(() => {
		movingCleanupFrames.delete(frame);
		anims.forEach(noteMoving.cancel);
	});
	movingCleanupFrames.add(frame);
}

function revealList(step: number) {
	if (!motion()) return;
	listChildren().forEach((el, i) => noteMoving.track(el, el.animate([
		{ opacity: 0, transform: 'translateY(-24px)', clipPath: 'inset(0 0 100% 0)' },
		{ opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
	], { duration: 560, delay: i * step, easing: EASE_OUT, fill: 'backwards' })));
}

function toggleFilter(key: FilterKey) {
	const next = !store.s.tl.filter[key];
	store.set('tl', deepMerge({ filter: { [key]: next } }, store.s.tl));
	const label = filters.value.find(f => f.key === key)?.label ?? '';
	pushHk3Toast({ icon: 'filter', text: i18n.tsx._hata._hataskeyUi3.filterChanged({ filter: label, state: next ? copy.on : copy.off }) });
	if (key !== 'withSensitive') void reload();
}

function toggleLive() {
	live.value = !live.value;
	miLocalStorage.setItem('hataskeyUi3Live', live.value ? 'true' : 'false');
	if (live.value && queue.value.length > 0) flushQueue();
	pushHk3Toast({ icon: live.value ? 'zap' : 'zapOff', text: live.value ? copy.liveOn : copy.liveOff });
}

function flushQueue() {
	if (!props.active || punchBusy.value) return;
	const known = new Set(notes.value.map(note => note.id));
	const incoming = queue.value.filter(note => !known.has(note.id));
	notes.value = [...incoming, ...notes.value];
	queue.value = [];
	scrollTop();
	if (!motion()) return;
	const seq = loadSeq;
	void nextTick(() => {
		if (!motion() || seq !== loadSeq) return;
		(Array.from(listEl.value?.children ?? []) as HTMLElement[]).filter(el => el.dataset.noteRemovalId).slice(0, incoming.length).forEach((el, i) => noteMoving.track(el, el.animate(
			[{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'translateY(0)' }],
			{ duration: 460, delay: 120 + i * 60, easing: EASE_OUT, fill: 'backwards' },
		)));
	});
}

function onBannerClick() {
	const toast = currentToast.value;
	if (toast) {
		toast.onClick?.();
		dismissHk3Toast(toast.id);
		return;
	}
	const external = externalNotice.value;
	if (external) {
		void external.show();
		scrollTop();
		return;
	}
	flushQueue();
}

// ===== バナー演出 =====
function bannerFlash(delay = 0) {
	if (!motion()) return;
	track(flashEl.value?.animate([
		{ clipPath: 'inset(0 50% 0 50%)', opacity: 0.55 },
		{ clipPath: 'inset(0 0% 0 0%)', opacity: 0.3, offset: 0.55 },
		{ clipPath: 'inset(0 0% 0 0%)', opacity: 0 },
	], { duration: 720, delay, easing: EASE_OUT, fill: 'backwards' }));
	track(flash2El.value?.animate([
		{ clipPath: 'inset(0 50% 0 50%)', opacity: 0 },
		{ clipPath: 'inset(0 50% 0 50%)', opacity: 0.22, offset: 0.2 },
		{ clipPath: 'inset(0 0% 0 0%)', opacity: 0 },
	], { duration: 820, delay: delay + 140, easing: EASE_OUT, fill: 'backwards' }));
}

// 素早い切り替え(テーマの連続変更など)では演出を重ねず、最新の表示へ即座に置き換える。
const QUICK_SWAP_MS = 320;
let lastBannerChangeAt = 0;
let bannerAnimations: Animation[] = [];
let bannerRevision = 0;

function stopBannerAnimations() {
	for (const animation of bannerAnimations) animation.cancel();
	bannerAnimations = [];
}

function track(animation: Animation | undefined): Animation | undefined {
	if (animation) {
		bannerAnimations.push(animation);
		void animation.finished.catch(() => {}).then(() => {
			// Completed forwards effects still affect the element until canceled.
			const fill = animation.effect?.getTiming().fill;
			if (animation.playState === 'finished' && (fill === 'forwards' || fill === 'both')) return;
			bannerAnimations = bannerAnimations.filter(item => item !== animation);
		});
	}
	return animation;
}

function quickChange(): boolean {
	const now = performance.now();
	const quick = now - lastBannerChangeAt < QUICK_SWAP_MS;
	lastBannerChangeAt = now;
	return quick;
}

watch([bannerOn, navbarPullActive], async ([on, pulling]) => {
	// Keep the measured header height until the pull ends, then animate new notices.
	if (pulling) return;

	const revision = ++bannerRevision;
	const quick = quickChange();
	stopBannerAnimations();
	// RSS owns the standing banner height. Notices crossfade over it instead of
	// collapsing the article reader or restarting its reading timer.
	if (rssEnabled.value) {
		if (on) {
			const entering = !bannerShown.value;
			bannerShown.value = true;
			await nextTick();
			if (revision !== bannerRevision || !bannerOn.value || !entering || quick || !motion()) return;
			track(bannerEl.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }));
		} else {
			const el = bannerEl.value;
			if (el && motion()) {
				const welcome = bannerToast.value?.welcome;
				const exit = track(el.animate(welcome ? [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .86 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: welcome ? 580 : 180, easing: 'ease-in', fill: 'forwards' }));
				try { await exit?.finished; } catch { return; }
				if (revision !== bannerRevision || bannerOn.value) return;
				exit?.cancel();
			}
			bannerShown.value = false;
		}
		return;
	}
	if (on) {
		const entering = !bannerShown.value;
		bannerShown.value = true;
		if (!entering || quick || !motion()) return;
		await nextTick();
		if (revision !== bannerRevision || !bannerOn.value || !bannerShown.value) return;
		const el = bannerEl.value;
		if (!el) return;
		track(el.animate([
			{ height: '0px', transform: 'translateY(-100%)', opacity: 0, clipPath: 'inset(100% 0 0 0)' },
			{ height: `${el.offsetHeight}px`, transform: 'translateY(0)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
		], { duration: 460, easing: EASE_OUT }));
		bannerFlash(180);
		return;
	}
	const el = bannerEl.value;
	if (!el || quick || !motion()) {
		bannerShown.value = false;
		return;
	}
	// 高さも畳んで、下のノートが跳ねずに上がってくるようにする。
	const exit = track(el.animate([
		{ height: `${el.offsetHeight}px`, opacity: 1 },
		{ height: '0px', opacity: 0 },
	], { duration: 420, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }));
	track(bannerContentEl.value?.animate([
		{ transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0)' },
		{ transform: 'translateY(-40%) scale(0.92)', opacity: 0, filter: 'blur(2px)' },
	], { duration: 300, easing: 'cubic-bezier(0.55, 0, 0.8, 0.2)', fill: 'forwards' }));
	try {
		await exit?.finished;
	} catch {
		return; // 表示し直しで取り消された
	}
	if (revision !== bannerRevision || bannerOn.value) return;
	bannerShown.value = false;
	stopBannerAnimations();
	navEl.value?.animate([
		{ boxShadow: 'inset 0 -4px 0 var(--hk3-accent)' },
		{ boxShadow: 'inset 0 0 0 transparent' },
	], { duration: 520, easing: 'ease-out' });
}, { immediate: true });

watch([motionEnabled, rssEnabled], () => {
	bannerRevision++;
	stopBannerAnimations();
	bannerShown.value = bannerOn.value;
});

watch(() => currentToast.value?.id ?? (hasQueued.value ? 'queue' : null), async (key, prev) => {
	if (key == null || prev == null || key === prev) return;
	if (quickChange() || !motion()) {
		stopBannerAnimations();
		return;
	}
	await nextTick();
	if (key !== (currentToast.value?.id ?? (hasQueued.value ? 'queue' : null)) || !bannerShown.value) return;
	if (currentToast.value?.icon === 'send') {
		bannerFlash();
		return;
	}
	track(bannerContentEl.value?.animate([
		{ transform: 'translateY(14px)', opacity: 0, filter: 'blur(2px)' },
		{ transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
	], { duration: 420, easing: EASE_OUT }));
	bannerFlash();
});

// ===== 無限スクロール =====
let observer: IntersectionObserver | null = null;
watch(sentinelEl, el => {
	observer?.disconnect();
	if (!el) return;
	observer = new IntersectionObserver(entries => {
		if (entries.some(entry => entry.isIntersecting)) void loadMore();
	}, { root: scrollEl.value, rootMargin: '600px 0px' });
	observer.observe(el);
});

let collapseObserver: MutationObserver | null = null;
watch(() => props.active, active => { if (active) nextTick(syncTimelineAtTop); });
onMounted(() => {
	scrollEl.value?.addEventListener('scroll', syncTimelineAtTop, { passive: true });
	syncTimelineAtTop();
	composerScroll.start();
	motionQuery.addEventListener('change', onMotionChange);
	window.addEventListener('resize', positionDesktopPopup);
	window.addEventListener('scroll', positionDesktopPopup, true);
	const root = scrollEl.value?.closest('[data-hk3-theme]');
	if (root) {
		const update = () => { timelineCollapsing.value = root.hasAttribute('data-hata-timeline-collapse-active'); };
		collapseObserver = new MutationObserver(update);
		collapseObserver.observe(root, { attributes: true, attributeFilter: ['data-hata-timeline-collapse-active'] });
		update();
	}
	void reload();
});

onBeforeUnmount(() => {
	scrollEl.value?.removeEventListener('scroll', syncTimelineAtTop);
	homeScroll.cancel();
	composerScroll.dispose();
	cancelPostEntrance();
	cancelMovingNotes();
	discardPendingPost();
	loadSeq++;
	navigationRevision++;
	collectionIntent++;
	collectionRequests.list++;
	collectionRequests.antenna++;
	window.document.removeEventListener('pointerdown', onPickerPointerDown, true);
	window.document.removeEventListener('click', onPickerPointerDown, true);
	window.document.removeEventListener('keydown', onPickerEscape);
	disconnect();
	observer?.disconnect();
	collapseObserver?.disconnect();
	motionQuery.removeEventListener('change', onMotionChange);
	window.removeEventListener('resize', positionDesktopPopup);
	window.removeEventListener('scroll', positionDesktopPopup, true);
	bannerRevision++;
	stopBannerAnimations();
});

const mobileOrder = ref(miLocalStorage.getItem('hataskeyUi3MobileOrder'));
const mobileChoices = computed<Hk3MobileChoice[]>(() => {
	const choices: Hk3MobileChoice[] = [...tabs.value];
	if ($i) choices.push(
		{ id: 'list', label: collectionCopy.list, icon: 'ti ti-list', branch: 'list' },
		{ id: 'channel', label: collectionCopy.channel, icon: 'ti ti-device-tv' },
		{ id: 'antenna', label: collectionCopy.antenna, icon: 'ti ti-antenna', branch: 'antenna' },
	);
	return restoreHk3MobileOrder(choices.reverse(), mobileOrder.value, JSON.stringify(prefer.r['simpleUi.topNav'].value));
});
const mobileCapsuleChoices = computed(() => [...mobileChoices.value].reverse());
const mobileNavEnabled = computed(() => props.active && !props.confirmationActive && !props.mobileMenuOpen && !pullRefresh.active.value && !punchBusy.value);
const mobileCapsuleEl = shallowRef<HTMLElement | null>(null);

function revealSelectedMobileTab() {
	const nav = mobileCapsuleEl.value;
	const selected = Array.from(nav?.querySelectorAll<HTMLElement>('[data-mobile-choice]') ?? []).find(button => button.dataset.mobileChoice === tab.value);
	if (!nav || !selected) return;
	const viewport = nav.getBoundingClientRect();
	const button = selected.getBoundingClientRect();
	if (!viewport.width || !button.width || (button.left >= viewport.left + 4 && button.right <= viewport.right - 4)) return;
	nav.scrollLeft += button.left - viewport.left - (viewport.width - button.width) / 2;
}

function onMobileLabelTransition(id: string, event: TransitionEvent) {
	if (id === tab.value && event.propertyName === 'max-width') revealSelectedMobileTab();
}

watch([tab, timelineTitle, () => mobileCapsuleChoices.value.map(choice => choice.id).join('\0')], async () => {
	await nextTick();
	revealSelectedMobileTab();
}, { flush: 'post' });

onMounted(() => { void nextTick(revealSelectedMobileTab); });

function selectMobileChoice(id: string, event: MouseEvent) {
	if (!mobileNavEnabled.value || !mobileChoices.value.some(choice => choice.id === id)) return;
	if (id === tab.value) { scrollTop(); return; }
	if (id === 'list' || id === 'antenna') void openCollection(id, event);
	else if (id === 'channel') goToChannels();
	else if (tabs.value.some(choice => choice.id === id)) void onTabClick(id as TabId);
}

function switchMobileCollection(kind: CollectionKind, event: MouseEvent) {
	if (!mobileNavEnabled.value) return;
	if (mobileDocked.value) emit('mobileCollection', kind);
	else void toggleCollectionPicker(kind, event);
}

const mobileNavigation = computed<Hk3MobileNavigation>(() => ({
	choices: mobileChoices.value,
	active: tab.value,
	selected: { ...selectedCollections.value },
	select: id => {
		if (!mobileChoices.value.some(item => item.id === id)) return;
		if (id === 'channel') goToChannels();
		else if (tabs.value.some(item => item.id === id)) void onTabClick(id as TabId);
	},
	load: kind => $i ? fetchCollections(kind) : Promise.resolve([]),
	selectCollection: (kind, id) => { if ($i) void selectCollection(kind, id); },
	settings: kind => openCollectionSettings(kind, true),
	reorder: ids => {
		const allowed = mobileChoices.value.map(item => item.id);
		if (ids.length !== allowed.length || new Set(ids).size !== ids.length || ids.some(id => !allowed.includes(id))) return;
		const nav = reorderHk3TopNav(prefer.r['simpleUi.topNav'].value, ids);
		prefer.commit('simpleUi.topNav', nav);
		mobileOrder.value = JSON.stringify({ base: JSON.stringify(nav), ids });
		miLocalStorage.setItem('hataskeyUi3MobileOrder', mobileOrder.value);
	},
	options: [
		...filters.value.map(f => ({ id: f.key, label: f.label, icon: f.key === 'withRenotes' ? 'ti ti-repeat' : f.key === 'onlyFiles' ? 'ti ti-photo' : 'ti ti-eye', checked: f.on, action: () => toggleFilter(f.key) })),
		{ id: 'live', label: copy.realtime, icon: 'ti ti-bolt', checked: live.value, disabled: tab.value === 'trending' || isExternalTab.value || isHatadyTab.value || isConcrntTab.value, action: toggleLive },
		{ id: 'rss', label: copy._rss.settings, icon: 'ti ti-rss', action: openRssSettings },
	],
}));

const emojiHostTarget = shallowRef<HTMLElement | null>(null);
provide(hk3ComposerEmojiHostKey, {
	target: emojiHostTarget,
	enabled: computed(() => props.compact && props.active && !props.confirmationActive && !props.mobileMenuOpen && !punchBusy.value && !pullRefresh.active.value && !optionsOpen.value && !pickerKind.value),
	open: emojiHostOpen,
});

defineExpose({ focusConcrntComposer: () => concrntTimelineRef.value?.focusComposer(), scrollTop, scrollHomeTop, reload, mobileNavigation, mobilePullState, attachMobilePullGesture });
</script>

<style lang="scss" module>
@use './hk3-glass';
.root {
	@include hk3-glass.banner-fade;
	--hk3-timeline-note-width: 800px;
	--hk3-banner-alpha: clamp(66%, calc(var(--hk3-glass-pane-alpha, 76%) - 10%), 82%);
	--hk3-banner-radius: 16px;
	--hk3-nav-alpha: clamp(80%, var(--hk3-glass-pane-alpha, 80%), 92%);
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	flex: 1;
	// TL とフォームの下地を連続させ、透けた外周に背景色の切れ目を残さない。
	background: var(--hk3-glass-note, var(--hk3-bg));
}

.root[data-desktop-rail] {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 56px;
	grid-template-rows: auto minmax(0, 1fr) auto;
	grid-template-areas: 'header rail' 'scroll rail' 'composer rail';
	&[data-composer-position='top'] {
		grid-template-rows: auto auto minmax(0, 1fr);
		grid-template-areas: 'header rail' 'composer rail' 'scroll rail';
	}
	> .navbar { grid-area: header; min-height: 0; }
	> .scrollWrap {
		grid-area: scroll; min-width: 0;
		border-top: 1px solid transparent;
		border-image: linear-gradient(to right, transparent, var(--hk3-divider), transparent) 1;
	}
	> .composer {
		grid-area: composer;
		margin-left: var(--hk3-composer-left-inset, 0px);
		margin-right: 0;
	}
	&:has(> .desktopRailSlot > .desktopRail:hover),
	&:has(> .desktopRailSlot > .desktopRail :focus-visible),
	&:has(> .desktopRailSlot > .desktopRail[data-menu-open]) {
		> .composer { margin-right: 152px; }
	}
}

.desktopRailSlot {
	grid-area: rail;
	position: relative;
	min-width: 0;
	min-height: 0;
	z-index: 20;
}

// Only this overlay expands. The grid keeps reserving 56px beside the right pane.
.desktopRail {
	--hk3-rail-width: 56px;
	position: absolute;
	inset: 0 0 0 auto;
	width: var(--hk3-rail-width);
	isolation: isolate;
	border: 0;
	box-sizing: border-box;
	transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
	// Keep the blur on a separate layer so fixed menus retain viewport coordinates.
	&::before {
		content: '';
		position: absolute;
		inset: 0 0 0 -24px;
		z-index: -1;
		// 下地は TL と共通。重ねる色を薄くしてガラスが不透明になるのを防ぐ。
		background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-overlay-alpha, 36%), transparent);
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		// 文字はぼかさず、背景の左右と項目のない上端だけを溶かす。
		-webkit-mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 12px), transparent), linear-gradient(to bottom, transparent, #000 clamp(64px, 24%, 240px));
		mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 12px), transparent), linear-gradient(to bottom, transparent, #000 clamp(64px, 24%, 240px));
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
		pointer-events: none;
	}
	&:hover, &:has(:focus-visible), &[data-menu-open] {
		--hk3-rail-width: 208px;
		.railLabel { opacity: 1; }
	}
	.nav {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		border: 0;
	}
	.navSpacer { display: none; }
	.tabs {
		flex: 1 1 0;
		flex-direction: column;
		align-items: flex-end;
		width: 100%;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		// Auto margin becomes zero when the rail needs to scroll, keeping every item reachable.
		> :first-child { margin-top: auto; }
	}
	.tab, .collectionAction, .live {
		position: relative;
		isolation: isolate;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 56px;
		align-items: center;
		gap: 0;
		width: 208px;
		min-height: max(44px, calc(56px * var(--hk3-ui-scale, 1)));
		padding: calc(8px * var(--hk3-ui-scale, 1)) 0;
		border: 0;
		text-align: left;
		transition: color 180ms ease;
		> i { grid-column: 2; grid-row: 1; justify-self: center; }
		&, &:hover, &[data-active] { background: transparent; box-shadow: none; }

		// 文字はぼかさず、見えている幅の内側で背景だけをフェードさせる。
		&::before {
			content: '';
			position: absolute;
			inset: 10px 10px 10px auto;
			width: calc(var(--hk3-rail-width) - 20px);
			z-index: -1;
			border-radius: 10px;
			pointer-events: none;
			background: color-mix(in srgb, var(--hk3-accent) 18%, transparent);
			box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hk3-accent) 28%, transparent);
			filter: blur(6px);
			opacity: 0;
			transform: scale(0.96);
			transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1), width 280ms cubic-bezier(0.22, 1, 0.36, 1);
		}
		&:hover::before, &:focus-visible::before { opacity: 0.65; transform: scale(1); }
		&[data-active]::before, &[aria-expanded='true']::before { opacity: 1; transform: scale(1); }
	}
	.collectionTab {
		width: 208px;
		flex-direction: column;
		align-items: flex-end;
		&[data-active] { background: transparent; box-shadow: none; }
	}
	.collectionAction { min-height: 44px; font-size: calc(13px * var(--hk3-ui-scale, 1)); }
	.collectionName { max-width: 100%; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
	.railLabel {
		grid-column: 1;
		grid-row: 1;
		box-sizing: border-box;
		width: 152px;
		padding: 0 calc(12px * var(--hk3-ui-scale, 1));
		white-space: normal;
		overflow-wrap: anywhere;
		opacity: 0;
		transition: opacity 180ms ease;
	}
	.navEnd { flex: none; min-width: 0; width: 100%; }
	.optionsWrap { width: 100%; }
	.optionsButton { display: flex; justify-content: flex-end; width: 100%; overflow: hidden; }
	.live {
		box-sizing: border-box;
		display: grid;
		grid-template-columns: 152px 56px;
		gap: 0;
		width: 208px;
		min-width: 208px;
		min-height: max(44px, calc(56px * var(--hk3-ui-scale, 1)));
		padding: calc(8px * var(--hk3-ui-scale, 1)) 0;
		border: 0;
		overflow: hidden;
		text-align: left;
		> svg { grid-column: 2; grid-row: 1; justify-self: center; }
		> .railLabel { justify-self: end; }
		&, &[data-on] { background: transparent; color: var(--hk3-neutral-700); }
		&:hover, &:focus-visible { color: var(--hk3-text); }
	}
	.options, .collectionPicker {
		position: fixed;
		right: auto;
		box-sizing: border-box;
		overflow-y: auto;
		overscroll-behavior: contain;
		transform-origin: top right;
	}
}

.root[data-motion='false'] .desktopRail,
.root[data-motion='false'] .desktopRail .railLabel,
.root[data-motion='false'] .desktopRail .tab,
.root[data-motion='false'] .desktopRail .collectionAction,
.root[data-motion='false'] .desktopRail .live,
.root[data-motion='false'] .desktopRail .tab::before,
.root[data-motion='false'] .desktopRail .collectionAction::before,
.root[data-motion='false'] .desktopRail .live::before { transition: none; }
@media (prefers-reduced-motion: reduce) {
	.desktopRail, .desktopRail .railLabel,
	.desktopRail .tab, .desktopRail .collectionAction, .desktopRail .live,
	.desktopRail .tab::before, .desktopRail .collectionAction::before, .desktopRail .live::before { transition: none; }
}

.navbar {
	// Each nav/banner owns one glass surface, including during departure and pull.
	background: transparent;
	position: relative;
	isolation: isolate;
	z-index: 7;
	flex: none;
	min-width: 0;
	&[data-pulling] { overflow: clip; border-radius: var(--hk3-banner-radius, 16px); }

	&[data-pulling] {
		--hk3-rss-surface-display: none;
		--hk3-rss-banner-background: transparent;
		--hk3-rss-details-background: transparent;
		--hk3-rss-backdrop-filter: none;

		// Keep the stretched header on one background while its content fades.
		&::before {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -1;
			border-radius: inherit;
			background: linear-gradient(to bottom,
				color-mix(in srgb, var(--hk3-bg) var(--hk3-nav-alpha), transparent) 0,
				color-mix(in srgb, var(--pull-surface, var(--hk3-bg)) var(--hk3-banner-alpha), transparent) 100%);
			-webkit-backdrop-filter: blur(24px);
			backdrop-filter: blur(24px);
			@include hk3-glass.banner-mask;
			pointer-events: none;
		}

		.nav, .banner, .voteNavbar, .mobileNavbar {
			background: transparent;
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
		}
		.voteNavbar { --MI_THEME-panel: transparent; --MI_THEME-bg: transparent; }
		.banner::before, .voteNavbar::before, .mobileNavbar::before, .flash, .flash2 { display: none; }
		.navbarContents { height: var(--pull-content-height); overflow: hidden; }
	}
}

.navbarContents {
	position: relative;
	z-index: 1;
	opacity: var(--navbar-pull-nav-opacity, 1);
	transform: translateY(var(--navbar-pull-shift, 0));
}

.mobileNavbar {
	@include hk3-glass.banner-fade;
	--hk3-banner-edge: 14px;
	position: relative;
	isolation: isolate;
	display: flex;
	align-items: center;
	min-width: 0;
	height: 44px;
	padding: 0 calc(var(--hk3-banner-edge) + 4px);
	color: var(--hk3-text);
	&::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 22px;
		background: color-mix(in srgb, var(--hk3-surface) var(--hk3-nav-alpha), transparent);
		-webkit-backdrop-filter: blur(24px);
		backdrop-filter: blur(24px);
		@include hk3-glass.banner-mask;
		pointer-events: none;
	}
}
.mobileCapsule {
	display: flex;
	align-items: center;
	flex: 1;
	min-width: 0;
	height: 100%;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
	&::-webkit-scrollbar { display: none; }
	> :first-child { margin-inline-start: auto; }
	> :last-child { margin-inline-end: auto; }
}
.mobileTab, .mobileAction {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: none;
	gap: 0;
	min-width: 34px;
	height: 40px;
	padding: 0 7px;
	border: 0;
	border-radius: 18px;
	background: transparent;
	color: var(--hk3-neutral-700);
	font: inherit;
	cursor: pointer;
	white-space: nowrap;
	&:hover, &:focus-visible, &[data-active], &[aria-expanded='true'] { background: var(--hk3-accent-100); color: var(--hk3-accent-800); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); }
	&:disabled { opacity: 0.5; cursor: default; }
	> i { font-size: 18px; }
}
.mobileTabLabel {
	display: block;
	max-width: 0;
	opacity: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	transition: max-width 270ms ease, opacity 200ms ease, margin 270ms ease;
}
.mobileTab[data-active] .mobileTabLabel { max-width: min(130px, 34vw); opacity: 1; margin-inline-start: 5px; }
.mobileOptionsWrap { position: relative; flex: none; }
.mobileOptions { top: calc(100% + 2px); right: 0; }
.root[data-motion='false'] .mobileTabLabel { transition: none; }
@media (prefers-reduced-motion: reduce) { .mobileTabLabel { transition: none; } }
.emojiHost {
	@include hk3-glass.banner-fade;
	--hk3-banner-edge: 12px;
	--hk3-banner-alpha: clamp(76%, var(--hk3-glass-pane-alpha, 80%), 88%);
	position: absolute;
	display: flow-root;
	top: 100%;
	left: max(12px, env(safe-area-inset-left, 0px));
	right: max(12px, env(safe-area-inset-right, 0px));
	z-index: 40;
	min-height: 1px;
	isolation: isolate;
	border-radius: 0 0 var(--hk3-banner-radius, 16px) var(--hk3-banner-radius, 16px);
	&[data-open]::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		background: color-mix(in srgb, var(--hk3-surface) var(--hk3-banner-alpha), transparent);
		-webkit-backdrop-filter: blur(24px);
		backdrop-filter: blur(24px);
		box-shadow: 0 12px 30px color-mix(in srgb, var(--hk3-text) 10%, transparent);
		@include hk3-glass.banner-mask;
		pointer-events: none;
	}
}

.pullPrompt {
	position: absolute;
	inset: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(9px * var(--hk3-ui-scale, 1));
	color: var(--pull-ink, var(--hk3-text));
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	opacity: var(--navbar-pull-prompt-opacity, 0);
	pointer-events: none;
}
.pullIcon { transform: rotate(var(--navbar-pull-turn, 0deg)); }
.navbar[data-pull-phase='success'] .pullIcon,
.navbar[data-pull-phase='error'] .pullIcon { transform: none; }
.root[data-motion='true'] .navbar[data-pull-phase='refreshing'] .pullIcon { animation: hk3PullSpin .9s linear infinite; }
@keyframes hk3PullSpin { to { transform: rotate(360deg); } }

.nav {
	background: color-mix(in srgb, var(--hk3-bg) var(--hk3-nav-alpha), transparent);
	-webkit-backdrop-filter: blur(20px);
	backdrop-filter: blur(20px);
	display: flex;
	align-items: stretch;
	height: 58px;
	flex: none;
	border-bottom: 1px solid transparent;
	border-image: linear-gradient(to right, transparent, var(--hk3-divider), transparent) 1;

	.root[data-compact] & { height: 54px; border-top: 1px solid transparent; }
}

.navSpacer {
	flex: 1 1 0;
	min-width: 0;
	border-right: 1px solid var(--hk3-divider);
}

.tabs {
	display: flex;
	align-items: stretch;
	flex: 0 1 auto;
	min-width: 0;
	overflow-x: auto;
	scrollbar-width: none;
	.root[data-compact] & { flex: 1; justify-content: safe center; }
}

.tabIcon {
	font-size: calc(20px * var(--hk3-ui-scale, 1));
	line-height: 20px;
}

.tab {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	min-width: 56px;
	padding: 0 calc(18px * var(--hk3-ui-scale, 1));
	border: 0;
	border-right: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	white-space: nowrap;
	position: relative;

	&[data-active] { background: var(--hk3-accent-100); color: var(--hk3-accent-800); box-shadow: inset 0 -3px 0 var(--hk3-accent); }
	&:hover { background: var(--hk3-accent-100); }

	.root[data-compact] & { flex: none; gap: calc(6px * var(--hk3-ui-scale, 1)); min-width: 50px; padding: 0 calc(14px * var(--hk3-ui-scale, 1)); font-size: calc(13px * var(--hk3-ui-scale, 1)); }
}

.collectionTab {
	display: flex;
	flex: none;
	align-items: stretch;
	&[data-active] { background: var(--hk3-accent-100); color: var(--hk3-accent-800); box-shadow: inset 0 -3px 0 var(--hk3-accent); }
}

.collectionCopy { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.collectionName { max-width: 140px; overflow: hidden; text-overflow: ellipsis; font-size: calc(11px * var(--hk3-ui-scale, 1)); font-weight: 500; }
.collectionAction {
	flex: none;
	width: 36px;
	padding: 0;
	border: 0;
	border-right: 1px solid var(--hk3-divider);
	border-radius: 0;
	font: inherit;
	font-size: calc(18px * var(--hk3-ui-scale, 1));
	background: transparent;
	color: inherit;
	cursor: pointer;
	&:hover { background: var(--hk3-accent-200); }
}

.collectionPicker, .options {
	@include hk3-glass.menu;
	box-sizing: border-box;
	padding: calc(8px * var(--hk3-ui-scale, 1));
	color: var(--hk3-text);
	transform-origin: top right;
}

.collectionPicker {
	position: absolute;
	top: 100%;
	right: 0;
	z-index: 30;
	box-sizing: border-box;
	width: min(320px, 100%);
	max-height: min(420px, 60dvh);
	overflow-y: auto;
	overscroll-behavior: contain;
}
.collectionPickerState { display: flex; flex-direction: column; align-items: center; gap: calc(12px * var(--hk3-ui-scale, 1)); padding: calc(20px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1)); }
.collectionPickerItem {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	box-sizing: border-box;
	width: 100%;
	min-height: 44px;
	padding: calc(10px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	text-align: left;
	text-decoration: none;
	cursor: pointer;
	transition: background-color 180ms ease, color 180ms ease;
	> span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
	&[data-active], &:hover, &:focus-visible { background: color-mix(in srgb, var(--hk3-accent) 14%, transparent); color: var(--hk3-accent-800); }
	&[data-collection-manage] { margin-top: 4px; border-top: 1px solid var(--hk3-divider); }
}
.collectionAction, .collectionPickerItem, .tab, .live, .option { &:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -3px; } }

// 外部TLのタブは印を付けず、アイコンの色で見分ける。
.tab[data-external] > .tabIcon {
	color: var(--hk3-external, #3d8fd1);
}

.list,
.external {
	max-width: var(--hk3-timeline-note-width);
	width: 100%;
	margin-inline: auto;
	box-sizing: border-box;
}

.external {
	min-height: 100%;

	// 外部TLのノートも UI3 のノートと同じく、角のない行を区切り線で並べる。
	:global([data-external-timeline-ui]) {
		gap: 0 !important;
		padding: 0 !important;
		background: transparent;
	}

	:global([data-external-timeline-ui] > *) {
		margin: 0 !important;
		padding: calc(16px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1)) !important;
		border: 0 !important;
		border-bottom: 1px solid var(--hk3-divider) !important;
		border-image: linear-gradient(to right, transparent, var(--hk3-divider) 10%, var(--hk3-divider) 90%, transparent) 1 !important;
		border-radius: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
		backdrop-filter: none !important;
		color: var(--hk3-text);
		transition: background 160ms ease;

		&:hover { background: var(--hk3-surface) !important; }
	}

	:global([data-external-timeline-ui] button) {
		border-radius: 0 !important;
	}
}

.navEnd {
	flex: 1 0 58px;
	min-width: 58px;
	display: flex;
	justify-content: flex-end;
	align-items: stretch;

	.root[data-compact] & { flex: none; }
}

.live {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	min-width: 58px;
	padding: 0 calc(18px * var(--hk3-ui-scale, 1));
	border: 0;
	border-left: 2px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-neutral-700);
	cursor: pointer;
	font: inherit;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	letter-spacing: 0.06em;

	&[data-on] { background: var(--hk3-accent); color: var(--hk3-bg); }
	&:disabled { opacity: 0.45; cursor: default; }
	.root[data-compact] & { width: 54px; min-width: 54px; padding: 0; }
}

.optionsWrap {
	position: relative;
	display: flex;
	align-items: stretch;
}

.optionsButton { display: contents; }

.options {
	position: absolute;
	top: calc(100% + 2px);
	right: 0;
	z-index: 30;
	width: min(260px, calc(100vw - 24px));
	max-height: min(420px, 60dvh);
	overflow-y: auto;
	overscroll-behavior: contain;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.option {
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	min-height: 44px;
	flex: none;
	padding: calc(10px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	text-align: left;
	transition: background-color 180ms ease, color 180ms ease;

	> span:first-of-type { flex: 1; min-width: 0; }
	&[data-on] { color: var(--hk3-accent-800); background: color-mix(in srgb, var(--hk3-accent) 14%, transparent); }
	&:hover:not(:disabled), &:focus-visible { background: color-mix(in srgb, var(--hk3-accent) 20%, transparent); }
	&:disabled { opacity: 0.45; cursor: default; }
}

.optionCheck {
	display: grid;
	place-items: center;
	width: 16px;
	flex: none;
	color: var(--hk3-accent);
}

:global(.hk3-options-enter-active), :global(.hk3-options-leave-active) { transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }
:global(.hk3-options-enter-from), :global(.hk3-options-leave-to) { opacity: 0; transform: translateY(-4px) scale(0.985); }
.root[data-motion='true'] .collectionPicker { animation: hk3-picker-appear 220ms cubic-bezier(0.22, 1, 0.36, 1); }
@keyframes hk3-picker-appear {
	from { opacity: 0; transform: translateY(-4px) scale(0.985); }
	to { opacity: 1; transform: translateY(0) scale(1); }
}
.root[data-motion='false'] .collectionPickerItem,
.root[data-motion='false'] .option,
.root[data-motion='false'] :global(.hk3-options-enter-active),
.root[data-motion='false'] :global(.hk3-options-leave-active) { transition: none; }
@media (prefers-reduced-motion: reduce) {
	.root[data-motion] .collectionPicker { animation: none; }
	.collectionPickerItem, .option,
	:global(.hk3-options-enter-active), :global(.hk3-options-leave-active) { transition: none; }
}

.scrollWrap {
	order: 2;
	position: relative;
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: var(--hk3-banner-edge);
		right: var(--hk3-banner-edge);
		z-index: 2;
		height: 22px;
		background: linear-gradient(to bottom, color-mix(in srgb, var(--hk3-accent) 18%, transparent) 0%, color-mix(in srgb, var(--hk3-accent) 8%, transparent) 35%, transparent 100%);
		clip-path: inset(0);
		-webkit-mask-image: linear-gradient(to right, transparent, #000 18%, #000 82%, transparent);
		mask-image: linear-gradient(to right, transparent, #000 18%, #000 82%, transparent);
		opacity: 0;
		transition: opacity 200ms ease;
		pointer-events: none;
	}
}
.navbar[data-at-top] ~ .scrollWrap::before { opacity: 1; }
.root[data-motion='false'] .scrollWrap::before { transition: none; }
@media (prefers-reduced-motion: reduce) { .scrollWrap::before { transition: none; } }

.composer {
	--hk3-composer-reveal-opacity: 1;
	--hk3-composer-reveal-offset: 0px;
	flex: none;
	min-width: 0;
	min-height: 0;
	position: relative;
	z-index: 3;
	display: grid;
	grid-template-rows: 1fr;
	// すりガラスの祖先に opacity を付けると、切り替えの両端でぼかす背景が変わる。
	// 内容と背景を別々にフェードし、この枠は高さと横幅だけを動かす。
	transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1), margin-left 280ms cubic-bezier(0.22, 1, 0.36, 1), margin-right 280ms cubic-bezier(0.22, 1, 0.36, 1);
	order: 3;
	// 背景だけを外周へ溶かす。本文・操作・メニューにはマスクを掛けない。
	// フォームのフェードする要素の外に置き、ぼかす背景が途中で切り替わるのを防ぐ。
	&::before {
		content: '';
		position: absolute;
		inset: -12px;
		z-index: -1;
		pointer-events: none;
		background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-overlay-alpha, 36%), transparent);
		-webkit-backdrop-filter: blur(16px);
		backdrop-filter: blur(16px);
		filter: blur(4px);
		-webkit-mask-image: linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent), linear-gradient(to bottom, transparent, #000 32px, #000 calc(100% - 32px), transparent);
		mask-image: linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent), linear-gradient(to bottom, transparent, #000 32px, #000 calc(100% - 32px), transparent);
		-webkit-mask-composite: source-in;
		mask-composite: intersect;
		opacity: var(--hk3-composer-reveal-opacity);
		transition: opacity 180ms ease;
	}
	&[data-hidden] {
		--hk3-composer-reveal-opacity: 0;
		--hk3-composer-reveal-offset: 14px;
		grid-template-rows: 0fr;
		pointer-events: none;
	}
	&[data-position="top"] {
		order: 1;
		&::before { bottom: -24px; }
		&[data-hidden] { --hk3-composer-reveal-offset: -14px; }
	}
	&[data-position="bottom"]::before { top: -24px; }
	&[data-docked] {
		// The floating dock supplies the shared glass surface for the form and navigation.
		&::before { display: none; }
		.composerBody {
			overflow: clip;
			overflow-clip-margin: 0;
		}
	}
}
.composerBody {
	min-width: 0;
	min-height: 0;
	// 境目の24pxのフェードを常に残し、開閉完了時に切り取り方を変えない。
	overflow: clip;
	overflow-clip-margin: 24px;
}
.root:not([data-compact]) > .composer::before {
	left: 50%;
	right: auto;
	width: min(calc(100% + 24px), calc(var(--hk3-timeline-note-width) + 24px));
	transform: translateX(-50%);
	-webkit-mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 40px), transparent), linear-gradient(to bottom, transparent, #000 32px, #000 calc(100% - 32px), transparent);
	mask-image: linear-gradient(to right, transparent, #000 40px, #000 calc(100% - 40px), transparent), linear-gradient(to bottom, transparent, #000 32px, #000 calc(100% - 32px), transparent);
}
.root[data-motion='false'] .composer,
.root[data-motion='false'] .composer::before,
.composer[data-motion='false'],
.composer[data-motion='false']::before { transition: none; }
@media (prefers-reduced-motion: reduce) { .composer, .composer::before { transition: none; } }

// 投票結果の紙吹雪・絵文字の雨は、スクロールに流されないようタイムラインの表示領域に重ねる。
.voteEffects {
	position: absolute;
	inset: 0;
	z-index: 6;
	overflow: hidden;
	pointer-events: none;
}

.bannerStack {
	position: sticky;
	top: 0;
	z-index: 5;
	// The notice remains mounted throughout its exit animation.
	&:has(> .banner) {
		--hk3-rss-underlayer-visibility: hidden;
		--hk3-rss-underlayer-opacity: 0;
	}
	&[data-rss] > .banner {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1;
	}
}

.voteNavbar {
	// Fade only the wrapper surface; keep shared card content and controls intact.
	--MI_THEME-panel: transparent;
	--MI_THEME-bg: color-mix(in srgb, var(--hk3-bg) var(--hk3-nav-alpha), transparent);
	--MI_THEME-fg: var(--hk3-text);
	position: relative;
	isolation: isolate;
	max-height: min(50dvh, 420px);
	overflow-y: auto;
	overscroll-behavior: contain;
	border-bottom: 1px solid transparent;
	background: transparent;
	border-radius: var(--hk3-banner-radius, 16px);
	color: var(--hk3-text);

	&::before { background: color-mix(in srgb, var(--hk3-surface) var(--hk3-banner-alpha), transparent); border-bottom: 1px solid var(--hk3-divider); box-sizing: border-box; }
}

.scroll {
	touch-action: pan-y;
	position: relative;
	flex: 1;
	min-height: 0;
	overflow: auto;
	// スクロールバーの有無でノートの中心が左へずれないよう、両端を同じ幅にする。
	scrollbar-gutter: stable both-edges;
	overscroll-behavior: contain;
	.root[data-mobile-docked] & {
		padding-bottom: calc(var(--hk3-mobile-dock-height) + env(safe-area-inset-bottom, 0px) + calc(24px * var(--hk3-ui-scale, 1)));
		scroll-padding-bottom: calc(var(--hk3-mobile-dock-height) + 24px);
	}
}

.banner {
	--banner-color: var(--hk3-accent);
	--hata-new-notes-accent: var(--hk3-accent);
	--hata-new-notes-fg: var(--hk3-bg);
	position: relative;
	isolation: isolate;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	height: 48px;
	padding: 0 calc(var(--hk3-banner-edge) + 4px);
	border: 0;
	border-radius: var(--hk3-banner-radius, 16px);
	background: transparent;
	color: var(--hk3-bg);
	cursor: pointer;
	font: inherit;
	font-size: calc(15px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	overflow: hidden;
	&::before {
		background: color-mix(in srgb, var(--banner-color) var(--hk3-banner-alpha), transparent);
		transition: background 260ms ease;
	}

	&[data-kind="toast"] { --banner-color: var(--hk3-text); }
	&:hover { --banner-color: var(--hk3-accent-600); }
	&[data-kind="toast"]:hover { --banner-color: var(--hk3-neutral-800); }
	.root[data-compact] & { height: 44px; padding: 0 calc(var(--hk3-banner-edge) + 4px); gap: calc(8px * var(--hk3-ui-scale, 1)); font-size: calc(14px * var(--hk3-ui-scale, 1)); }
}

.banner::before, .voteNavbar::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: -1;
	border-radius: inherit;
	-webkit-backdrop-filter: blur(24px);
	backdrop-filter: blur(24px);
	@include hk3-glass.banner-mask;
	pointer-events: none;
}

.flash, .flash2 {
	position: absolute;
	inset: 0;
	border-radius: inherit;
	opacity: 0;
	@include hk3-glass.banner-mask;
	pointer-events: none;
}

.flash { background: var(--hk3-bg); }
.flash2 { background: var(--hk3-text); }

.bannerContent {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	min-width: 0;
	[data-kind='toast'] & {
		--banner-lead-width: 26px;
		width: 100%;
		display: grid;
		grid-template-columns: minmax(var(--banner-lead-width), 1fr) minmax(0, max-content) minmax(var(--banner-lead-width), 1fr);
		&:has(.bannerAction), &:has(.bannerEmoji) { --banner-lead-width: 56px; }
		> .bannerText { grid-column: 2; }
		> :only-child { grid-column: 1 / -1; justify-self: center; }
	}
}

.queueStatus { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.bannerLead {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	min-width: 0;
	grid-column: 1;
}

.bannerFace {
	width: 26px;
	height: 26px;
	flex: none;
	border: 0;
	box-sizing: border-box;
	object-fit: cover;
}

.bannerWelcomeFace {
	border-radius: 50% !important;
	overflow: hidden;
	:global(img) { border-radius: 50% !important; }
}

.bannerIcon { flex: none; }

.bannerAction {
	--hata-toast-fg: var(--hk3-bg);
	--MI_THEME-accent: var(--hk3-accent);
	--MI_THEME-accentedBg: var(--hk3-accent-100);
	--MI_THEME-fgOnAccent: var(--hk3-bg);
	flex: none;
	position: relative;
	top: -3px;
}

/* Favorite's visible center (~29px) sits below the 44px frame center (22px). */
.bannerAction[data-action='favorite'] { top: -7px; }

.bannerEmoji {
	height: 26px;
	max-width: 52px;
	flex: none;
	object-fit: contain;
}

.bannerText {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: calc(12px * var(--hk3-ui-scale, 1));
	min-height: 200px;
	padding: calc(32px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
	font-size: calc(14px * var(--hk3-ui-scale, 1));
}

.retry {
	height: 36px;
	padding: 0 calc(16px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-weight: 700;

	&:hover { border-color: var(--hk3-accent); }
}

.list {
	display: flex;
	flex-direction: column;
}

.list > :global([data-note-id]) {
	border-image: linear-gradient(to right, transparent, var(--hk3-divider) 10%, var(--hk3-divider) 90%, transparent) 1;
}

.ad { padding: 12px 20px; }

.sentinel {
	display: grid;
	place-items: center;
	min-height: 64px;
	padding: calc(12px * var(--hk3-ui-scale, 1));
}

.end {
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-600);
}

</style>
