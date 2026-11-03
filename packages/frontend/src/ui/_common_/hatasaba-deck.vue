<!--
	SPDX-FileCopyrightText: Tolehata and hatasaba-project
	SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
	旗鯖fork: Hataskey UI デッキモード (D2: 3階層モデル)。
	データ構造: profile → slots[] → frames[] → tabs[](=カラム)
	  - slot  : レイアウトの1マス(row:列 / grid:セル / stack:段)。frames を縦積みできる
	  - frame : スロット内の箱。tabs が複数ならブラウザ風タブで切替表示(=「カラムの中で複数カラムをタブ切替」)
	  - tab   : 表示内容(カラム本体)。type でTL種別を決める
	これにより「縦積み(日の字)」と「タブ束ね」を全レイアウトで両立できる。

	プロファイルは simpleUi.deckProfilesV2 に保存。旧 simpleUi.deckProfiles(columns形式)からは
	初回に一度だけ自動マイグレーション(1カラム=1slot=1frame=1tab)。旧データは温存しロールバック可能。

	【重要】ビルドプラグイン(unwind-css-module-class-name)はCSS Modulesクラスを静的解決するため
	$style[変数] の動的アクセスは解決されない。レイアウトクラスは v-if/v-else-if で分岐し静的参照すること。
	【重要】副作用(prefer.commit)を computed 内で呼ばないこと。マイグレーションは onMounted のみ。
-->

<template>
<div :class="[$style.deckWrap, toolbarPos === 'right' ? $style.deckWrapRight : toolbarPos === 'bottom' ? $style.deckWrapBottom : $style.deckWrapTop]" :data-widget-border="prefer.r['simpleUi.widgetBorder']?.value ? 'on' : 'off'" :data-animation="prefer.s.animation ? 'true' : 'false'">
	<!-- 折り畳み式ツールバー (上部メニューモード時は、開いている時だけ表示) -->
	<div v-if="!topNavMode || toolbarOpen" :class="$style.toolbarBar">
		<button v-if="!topNavMode" :class="[$style.toolbarToggle, { [$style.toolbarToggleOn]: toolbarOpen }]" v-tooltip="toolbarOpen ? copy.hideToolbar : copy.showToolbar" @click="toolbarOpen = !toolbarOpen">
			<i :class="toolbarOpen ? 'ti ti-chevron-up' : 'ti ti-adjustments-horizontal'"></i>
		</button>
		<div v-if="toolbarOpen" :class="$style.toolbarInner">
			<div :class="$style.layoutPill">
				<button v-for="l in LAYOUTS" :key="l.id" :class="[$style.layoutBtn, { [$style.layoutBtnOn]: layout === l.id }]" v-tooltip="l.label" @click="setLayout(l.id)"><i :class="l.icon"></i></button>
			</div>
			<button :class="$style.profileBtn" @click="openProfileMenu($event)">
				<i class="ti ti-layout-board"></i><span v-if="toolbarPos !== 'right'" :class="$style.profileName">{{ activeProfileName }}</span><i v-if="toolbarPos !== 'right'" class="ti ti-chevron-down" :class="$style.profileChevron"></i>
			</button>
			<button :class="$style.iconBtn" v-tooltip="copy.reloadAllColumns" @click="reloadAll"><i class="ti ti-refresh"></i></button>
			<button :class="[$style.iconBtn, { [$style.iconBtnOn]: locked }]" v-tooltip="locked ? copy.unlockColumnEditing : copy.lockColumnEditing" @click="toggleLock"><i :class="locked ? 'ti ti-lock' : 'ti ti-lock-open'"></i></button>
			<button :class="$style.iconBtn" v-tooltip="toolbarPosLabel" @click="cycleToolbarPos"><i :class="toolbarPosIcon"></i></button>
			<!-- 旗鯖fork(タスク5): 上部メニュー(topNav)⇔左サイドメニューの切替 -->
			<button :class="[$style.iconBtn, { [$style.iconBtnOn]: topNavMode }]" v-tooltip="topNavMode ? copy.switchToSideNavigation : copy.switchToTopNavigation" @click="toggleTopNavMode"><i :class="topNavMode ? 'ti ti-layout-navbar' : 'ti ti-layout-sidebar'"></i></button>
			<button v-if="toolbarPos !== 'right'" :class="[$style.iconBtn, { [$style.iconBtnOn]: clockEnabled }]" v-tooltip="copy.showClock" @click="toggleClock"><i class="ti ti-clock"></i></button>
			<HatasabaDeckClock v-if="showClock" :class="$style.clock"/>
			<button v-if="toolbarPos !== 'right'" :class="[$style.iconBtn, { [$style.iconBtnOn]: onlineEnabled }]" v-tooltip="copy.showOnlineUsers" @click="toggleOnline"><i class="ti ti-users"></i></button>
			<div v-if="showOnline && onlineCount != null" :class="$style.online"><span :class="$style.onlineDot"></span>{{ copyx.onlineUsers({ count: numberFormatter.format(onlineCount) }) }}</div>
			<button v-if="toolbarPos !== 'right'" :class="[$style.iconBtn, { [$style.iconBtnOn]: rssEnabled }]" v-tooltip="copy.manageRssFeeds" @click="openRssMenu($event)"><i class="ti ti-rss"></i></button>
			<div v-if="showRssTicker" ref="rssTickerEl" :class="$style.rssTicker">
				<Transition :name="$style.rssFade">
					<div :key="rssOffset" :class="$style.rssItems">
						<!-- 旗鯖fork(セキュリティ): RSSフィードの link は外部由来。javascript:/data: 等の危険プロトコルを除外し http/https のみクリック可能とする。rel も noopener noreferrer に強化。 -->
						<a v-for="item in visibleRssItems" :key="item.link" :class="$style.rssItem" :style="item.color ? { '--rssColor': item.color } : {}" :href="safeLink(item.link)" rel="nofollow noopener noreferrer" target="_blank" :title="(item.feedName ? '[' + item.feedName + '] ' : '') + item.title">
							<span :class="$style.rssDot"></span><span :class="$style.rssItemText">{{ item.title }}</span>
						</a>
					</div>
				</Transition>
			</div>
			<div v-if="toolbarPos === 'right'" :class="$style.toolbarSpacer"></div>
		</div>
	</div>

	<!-- row -->
	<div v-if="layout === 'row'" :class="[$style.deck, $style.layoutRow]" data-deck-row @wheel="onDeckRowWheel">
		<div v-for="slot in visibleSlots" :key="slot.id" :class="[$style.slot, { [$style.slotDragging]: slotDragId === slot.id, [$style.slotDragOver]: slotDragOverId === slot.id }]" :style="slotStyle(slot)" :data-deck-slot="slot.id">
			<div :class="$style.slotStack">
				<template v-for="frame in slot.frames" :key="frame.id">
					<div :class="['frameRoot', $style.frameRoot, { [$style.frameColored]: !!frame.borderColor, [$style.frameDragOver]: dragOverFrame === frame.id }]" :style="frameStyle(frame, slot)" :data-deck-frame="frame.id" :data-deck-frame-slot="slot.id">
						<!-- タブバー(tabs複数 or 常時表示) -->
						<div :class="$style.tabBar">
							<div :class="$style.tabs" @wheel="onTabsWheel">
								<button
									v-for="tab in frame.tabs" :key="tab.id"
									:class="[$style.tab, { [$style.tabActive]: activeTabOf(frame).id === tab.id, [$style.tabDragOver]: tabDragOverId === tab.id }]"
									:style="tabStyle(tab, activeTabOf(frame).id === tab.id)"
									@click="onTabClick(slot, frame, tab, $event)"
									@dblclick="renameTab(slot.id, frame.id, tab.id)"
									@contextmenu.prevent="openTabMenu(slot, frame, tab, $event)"
									:data-deck-tab="tab.id" :data-deck-tab-frame="frame.id" :data-deck-tab-slot="slot.id"
								>
									<span v-if="!locked" :class="$style.tabGrip" v-tooltip="copy.dragTab" @pointerdown="onTabPointerDown(slot.id, frame.id, tab.id, $event)" @click.stop><i class="ti ti-grip-vertical"></i></span>
									<i :class="[tabIcon(tab), $style.tabIcon, { [$style.tabIconActiveColored]: tab.tabColor && activeTabOf(frame).id === tab.id }]"></i>
									<span :class="$style.tabLabel">{{ tabTitle(tab) }}</span>
								</button>
							</div>
							<!-- 旗鯖fork: チャンネル投稿ボタンは `simpleUi.showLegacyChannelPostButton` (default false) 時のみ表示。
	既定ではノートリスト最上部の固定投稿ボタンを主導線とし、ここは非表示。 --><button v-if="showLegacyChannelPostButton && activeTabOf(frame).type === 'channel' && activeTabOf(frame).sourceId" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.postToThisChannel" @click.stop="postToChannel(activeTabOf(frame).sourceId!)"><i class="ti ti-pencil-plus"></i></button><!-- 旗鯖fork: お気に入り/クリップにはリロードボタン。ストリーミングでないため手動更新が要る。 --><button v-if="activeTabOf(frame).type === 'clip' || activeTabOf(frame).type === 'favorites'" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.reload" @click.stop="reloadPaginated(activeTabOf(frame).id)"><i class="ti ti-refresh"></i></button><button v-if="activeTabOf(frame).type === 'favorites'" v-tooltip="i18n.ts._hata._favoriteFolders.folderList" class="_button" :class="$style.frameHeadBtn" :aria-label="i18n.ts._hata._favoriteFolders.folderList" @click.stop="manageFavoriteFolder(activeTabOf(frame).id, $event)"><i class="ti ti-folders"></i></button>
							<button v-if="frame.tabs.length > 1" class="_button" :class="$style.frameTabsBtn" v-tooltip="copy.manageTabs" @click.stop="openTabManageMenu(slot, frame, $event)"><i class="ti ti-layout-navbar"></i></button>
							<button v-if="!locked" class="_button" :class="$style.slotHandle" v-tooltip="copy.moveOrConfigureColumn" @pointerdown="onSlotPointerDown(slot.id, $event)" @click.stop="openSlotMenu(slot, $event)"><i class="ti ti-grip-vertical"></i></button>
							<button class="_button" :class="$style.frameMenuBtn" @click.stop="openFrameMenu(slot, frame, $event)"><i class="ti ti-dots"></i></button>
						</div>
						<!-- 本体(アクティブタブ) -->
						<div :class="['frameBody', $style.frameBody]" @touchstart.passive="onFrameTouchStart(frame, $event)" @touchend="onFrameTouchEnd(slot, frame, $event)">
							<template v-for="tab in frame.tabs" :key="tab.id">
								<div v-show="activeTabOf(frame).id === tab.id" :class="[$style.tabPane, { [$style.tabPanePostForm]: tab.type === 'postForm', [$style.tabPaneWidgets]: tab.type === 'widgets' }]" :data-active="activeTabOf(frame).id === tab.id ? 'true' : 'false'" :ref="el => setPaneRef(tab.id, el)">
									<component :is="resolveColumn(tab)" v-bind="columnProps(tab, frame)" :ref="el => setColRef(tab.id, el)"/>
								</div>
							</template>
						</div>
					</div>
					<!-- 縦積みframe間のリサイズハンドル(横並び&複数frame&最後以外&非ロック) -->
					<div v-if="!locked && layout === 'row' && slot.frames.length > 1 && frame.id !== slot.frames[slot.frames.length - 1].id" :class="$style.frameResizer" v-tooltip="copy.dragToResizeHeight" @pointerdown="onFrameResizeDown(slot.id, frame.id, $event)"><span :class="$style.frameResizerBar"></span></div>
				</template>
				<!-- 縦積みドロップ帯 -->
				<div v-if="dragSrc" :class="[$style.stackDrop, { [$style.stackDropOver]: dragOverSlotStack === slot.id }]" :data-deck-stackdrop="slot.id">{{ copy.stackHere }}</div>
			</div>
		</div>
		<!-- 新規列ドロップ帯 + 追加ボタン -->
		<div v-if="dragSrc" :class="$style.newSlotDrop" data-deck-newslot>{{ copy.newColumn }}</div>
		<button v-if="!locked" :class="$style.addColumn" @click="addColumn($event)"><i class="ti ti-plus"></i><span>{{ copy.addColumn }}</span></button>
	</div>

	<!-- grid2 / grid3 共通(クラスのみ差し替え) -->
	<div v-else-if="layout === 'grid2' || layout === 'grid3'" :class="[$style.deck, layout === 'grid2' ? $style.layoutGrid2 : $style.layoutGrid3]">
		<div v-for="slot in visibleSlots" :key="slot.id" :class="[$style.slot, $style.slotGrid, { [$style.slotFull]: slot.fullWidth, [$style.slotFullV]: slot.fullHeight, [$style.slotDragging]: slotDragId === slot.id, [$style.slotDragOver]: slotDragOverId === slot.id }]" :data-deck-slot="slot.id">
			<div :class="$style.slotStack">
				<template v-for="frame in slot.frames" :key="frame.id">
					<div :class="['frameRoot', $style.frameRoot, { [$style.frameColored]: !!frame.borderColor, [$style.frameDragOver]: dragOverFrame === frame.id }]" :style="frameStyle(frame, slot)" :data-deck-frame="frame.id" :data-deck-frame-slot="slot.id">
						<div :class="$style.tabBar">
							<div :class="$style.tabs" @wheel="onTabsWheel">
								<button v-for="tab in frame.tabs" :key="tab.id" :class="[$style.tab, { [$style.tabActive]: activeTabOf(frame).id === tab.id, [$style.tabDragOver]: tabDragOverId === tab.id }]" :style="tabStyle(tab, activeTabOf(frame).id === tab.id)" @click="onTabClick(slot, frame, tab, $event)" @dblclick="renameTab(slot.id, frame.id, tab.id)" @contextmenu.prevent="openTabMenu(slot, frame, tab, $event)" :data-deck-tab="tab.id" :data-deck-tab-frame="frame.id" :data-deck-tab-slot="slot.id">
									<span v-if="!locked" :class="$style.tabGrip" v-tooltip="copy.dragTab" @pointerdown="onTabPointerDown(slot.id, frame.id, tab.id, $event)" @click.stop><i class="ti ti-grip-vertical"></i></span><i :class="[tabIcon(tab), $style.tabIcon, { [$style.tabIconActiveColored]: tab.tabColor && activeTabOf(frame).id === tab.id }]"></i><span :class="$style.tabLabel">{{ tabTitle(tab) }}</span>
								</button>
							</div>
							<!-- 旗鯖fork: チャンネル投稿ボタンは `simpleUi.showLegacyChannelPostButton` (default false) 時のみ表示。
	既定ではノートリスト最上部の固定投稿ボタンを主導線とし、ここは非表示。 --><button v-if="showLegacyChannelPostButton && activeTabOf(frame).type === 'channel' && activeTabOf(frame).sourceId" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.postToThisChannel" @click.stop="postToChannel(activeTabOf(frame).sourceId!)"><i class="ti ti-pencil-plus"></i></button><!-- 旗鯖fork: お気に入り/クリップにはリロードボタン。ストリーミングでないため手動更新が要る。 --><button v-if="activeTabOf(frame).type === 'clip' || activeTabOf(frame).type === 'favorites'" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.reload" @click.stop="reloadPaginated(activeTabOf(frame).id)"><i class="ti ti-refresh"></i></button><button v-if="activeTabOf(frame).type === 'favorites'" v-tooltip="i18n.ts._hata._favoriteFolders.folderList" class="_button" :class="$style.frameHeadBtn" :aria-label="i18n.ts._hata._favoriteFolders.folderList" @click.stop="manageFavoriteFolder(activeTabOf(frame).id, $event)"><i class="ti ti-folders"></i></button>
							<button v-if="frame.tabs.length > 1" class="_button" :class="$style.frameTabsBtn" v-tooltip="copy.manageTabs" @click.stop="openTabManageMenu(slot, frame, $event)"><i class="ti ti-layout-navbar"></i></button>
							<button v-if="!locked" class="_button" :class="$style.slotHandle" v-tooltip="copy.moveOrConfigureColumn" @pointerdown="onSlotPointerDown(slot.id, $event)" @click.stop="openSlotMenu(slot, $event)"><i class="ti ti-grip-vertical"></i></button>
							<button class="_button" :class="$style.frameMenuBtn" @click.stop="openFrameMenu(slot, frame, $event)"><i class="ti ti-dots"></i></button>
						</div>
						<div :class="['frameBody', $style.frameBody]" @touchstart.passive="onFrameTouchStart(frame, $event)" @touchend="onFrameTouchEnd(slot, frame, $event)">
							<template v-for="tab in frame.tabs" :key="tab.id">
								<div v-show="activeTabOf(frame).id === tab.id" :class="[$style.tabPane, { [$style.tabPanePostForm]: tab.type === 'postForm', [$style.tabPaneWidgets]: tab.type === 'widgets' }]" :data-active="activeTabOf(frame).id === tab.id ? 'true' : 'false'" :ref="el => setPaneRef(tab.id, el)"><component :is="resolveColumn(tab)" v-bind="columnProps(tab, frame)" :ref="el => setColRef(tab.id, el)"/></div>
							</template>
						</div>
					</div>
				</template>
				<div v-if="dragSrc" :class="[$style.stackDrop, { [$style.stackDropOver]: dragOverSlotStack === slot.id }]" :data-deck-stackdrop="slot.id">{{ copy.stackHere }}</div>
			</div>
		</div>
		<button v-if="!locked" :class="[$style.addColumn, $style.addColumnGrid]" @click="addColumn($event)"><i class="ti ti-plus"></i><span>{{ copy.addColumn }}</span></button>
	</div>

	<!-- stack -->
	<div v-else :class="[$style.deck, $style.layoutStack]">
		<div v-for="slot in visibleSlots" :key="slot.id" :class="[$style.slot, { [$style.slotDragging]: slotDragId === slot.id, [$style.slotDragOver]: slotDragOverId === slot.id }]" :style="slotStyle(slot)" :data-deck-slot="slot.id">
			<div :class="$style.slotStack">
				<template v-for="frame in slot.frames" :key="frame.id">
					<div :class="['frameRoot', $style.frameRoot, { [$style.frameColored]: !!frame.borderColor, [$style.frameDragOver]: dragOverFrame === frame.id }]" :style="frameStyle(frame, slot)" :data-deck-frame="frame.id" :data-deck-frame-slot="slot.id">
						<div :class="$style.tabBar">
							<div :class="$style.tabs" @wheel="onTabsWheel">
								<button v-for="tab in frame.tabs" :key="tab.id" :class="[$style.tab, { [$style.tabActive]: activeTabOf(frame).id === tab.id, [$style.tabDragOver]: tabDragOverId === tab.id }]" :style="tabStyle(tab, activeTabOf(frame).id === tab.id)" @click="onTabClick(slot, frame, tab, $event)" @dblclick="renameTab(slot.id, frame.id, tab.id)" @contextmenu.prevent="openTabMenu(slot, frame, tab, $event)" :data-deck-tab="tab.id" :data-deck-tab-frame="frame.id" :data-deck-tab-slot="slot.id">
									<span v-if="!locked" :class="$style.tabGrip" v-tooltip="copy.dragTab" @pointerdown="onTabPointerDown(slot.id, frame.id, tab.id, $event)" @click.stop><i class="ti ti-grip-vertical"></i></span><i :class="[tabIcon(tab), $style.tabIcon, { [$style.tabIconActiveColored]: tab.tabColor && activeTabOf(frame).id === tab.id }]"></i><span :class="$style.tabLabel">{{ tabTitle(tab) }}</span>
								</button>
							</div>
							<!-- 旗鯖fork: チャンネル投稿ボタンは `simpleUi.showLegacyChannelPostButton` (default false) 時のみ表示。
	既定ではノートリスト最上部の固定投稿ボタンを主導線とし、ここは非表示。 --><button v-if="showLegacyChannelPostButton && activeTabOf(frame).type === 'channel' && activeTabOf(frame).sourceId" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.postToThisChannel" @click.stop="postToChannel(activeTabOf(frame).sourceId!)"><i class="ti ti-pencil-plus"></i></button><!-- 旗鯖fork: お気に入り/クリップにはリロードボタン。ストリーミングでないため手動更新が要る。 --><button v-if="activeTabOf(frame).type === 'clip' || activeTabOf(frame).type === 'favorites'" class="_button" :class="$style.frameHeadBtn" v-tooltip="copy.reload" @click.stop="reloadPaginated(activeTabOf(frame).id)"><i class="ti ti-refresh"></i></button><button v-if="activeTabOf(frame).type === 'favorites'" v-tooltip="i18n.ts._hata._favoriteFolders.folderList" class="_button" :class="$style.frameHeadBtn" :aria-label="i18n.ts._hata._favoriteFolders.folderList" @click.stop="manageFavoriteFolder(activeTabOf(frame).id, $event)"><i class="ti ti-folders"></i></button>
							<button v-if="frame.tabs.length > 1" class="_button" :class="$style.frameTabsBtn" v-tooltip="copy.manageTabs" @click.stop="openTabManageMenu(slot, frame, $event)"><i class="ti ti-layout-navbar"></i></button>
							<button v-if="!locked" class="_button" :class="$style.slotHandle" v-tooltip="copy.moveOrConfigureColumn" @pointerdown="onSlotPointerDown(slot.id, $event)" @click.stop="openSlotMenu(slot, $event)"><i class="ti ti-grip-vertical"></i></button>
							<button class="_button" :class="$style.frameMenuBtn" @click.stop="openFrameMenu(slot, frame, $event)"><i class="ti ti-dots"></i></button>
						</div>
						<div :class="['frameBody', $style.frameBody]" @touchstart.passive="onFrameTouchStart(frame, $event)" @touchend="onFrameTouchEnd(slot, frame, $event)">
							<template v-for="tab in frame.tabs" :key="tab.id">
								<div v-show="activeTabOf(frame).id === tab.id" :class="[$style.tabPane, { [$style.tabPanePostForm]: tab.type === 'postForm', [$style.tabPaneWidgets]: tab.type === 'widgets' }]" :data-active="activeTabOf(frame).id === tab.id ? 'true' : 'false'" :ref="el => setPaneRef(tab.id, el)"><component :is="resolveColumn(tab)" v-bind="columnProps(tab, frame)" :ref="el => setColRef(tab.id, el)"/></div>
							</template>
						</div>
					</div>
				</template>
				<div v-if="dragSrc" :class="[$style.stackDrop, { [$style.stackDropOver]: dragOverSlotStack === slot.id }]" :data-deck-stackdrop="slot.id">{{ copy.stackHere }}</div>
			</div>
		</div>
		<button v-if="!locked" :class="[$style.addColumn, $style.addColumnStack]" @click="addColumn($event)"><i class="ti ti-plus"></i><span>{{ copy.addColumn }}</span></button>
	</div>

	<!-- ドラッグゴースト(指/カーソル追従) -->
	<Teleport to="body">
		<div v-if="ghost" :class="$style.dragGhost" :style="{ left: ghost.x + 'px', top: ghost.y + 'px', '--ghostColor': ghost.color || 'var(--MI_THEME-accent)' }">
			<i :class="[ghost.icon, $style.dragGhostIcon]"></i><span>{{ ghost.label }}</span>
		</div>
	</Teleport>
</div>
</template>

<script lang="ts" setup>
const props = withDefaults(defineProps<{
	active?: boolean;
}>(), {
	active: true,
});

import { computed, ref, shallowReactive, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, type Component } from 'vue';
import * as os from '@/os.js';
import { mainRouter } from '@/router.js';
import { misskeyApi, misskeyApiGet } from '@/utility/misskey-api.js';
import { prefer } from '@/preferences.js';
import { isHataskeyTimelineAllowed } from '@/utility/hataskey-timeline-availability.js';
import { playHataIconMotion } from '@/utility/hata-icon-motion.js';
import { globalEvents } from '@/events.js';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import MkTrendingTimeline from '@/components/MkTrendingTimeline.vue';
import MkPostForm from '@/components/MkPostForm.vue';
import HatasabaDeckClock from '@/ui/_common_/hatasaba-deck-clock.vue';
import { tabSwipeEnabled } from '@/utility/hatasaba-device-prefs.js';
import { hasConfiguredNotificationFilter, migrateNotificationFilterSnapshot, resolveNotificationFilter } from '@/utility/notification-filter.js';
import { deepClone } from '@/utility/clone.js';
import { deepEqual } from '@/utility/deep-equal.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

const copy = i18n.ts._hata._hatasabaUi._deck;
const copyx = i18n.tsx._hata._hatasabaUi._deck;
const numberFormatter = new Intl.NumberFormat(versatileLang);

const XWidgets = defineAsyncComponent(() => import('./widgets.vue'));
// 旗鯖fork(新デッキ): クリップ/お気に入りタブ用の Paginator ラッパー。
const MkDeckPaginatedNotes = defineAsyncComponent(() => import('@/components/MkDeckPaginatedNotes.vue'));

// ===== 型 =====
type DeckLayout = 'row' | 'grid2' | 'grid3' | 'stack';
// 旗鯖fork(新デッキ): 'clip' / 'favorites' を追加。clip は sourceId=clipId を要求、favorites は不要。
type ColumnType = 'home' | 'local' | 'social' | 'global' | 'trending' | 'list' | 'antenna' | 'channel' | 'mentions' | 'directs' | 'notifications' | 'widgets' | 'postForm' | 'clip' | 'favorites';

// tab = カラム本体(表示内容)
type DeckTab = {
	id: string;
	type: ColumnType;
	name?: string;       // list/antenna/channel の元名称
	sourceId?: string;   // list/antenna/channel のID
	withRenotes?: boolean;
	tabName?: string;    // タブ表示名(ユーザー設定可。未設定なら種別名)
	tabColor?: string | null; // タブ(クリックして切り替える部分)の色
	excludeTypes?: string[]; // 通知カラムで除外する通知タイプ(通知フィルタ)
	notificationFilterKnownTypes?: string[]; // 保存時点で存在した通知タイプ。新種別を勝手にONにしないためのスナップショット
	excludeBots?: boolean; // Botフラグ付きアカウントからの通知を除外
};
// frame = スロット内の箱。tabs 複数ならタブ表示
type DeckFrame = {
	id: string;
	activeTab?: string;
	borderColor?: string | null;
	height?: number; // 横並びレイアウトで縦積みした際の、この箱の高さ(px)
	tabs: DeckTab[];
};
// slot = レイアウトの1マス。frames を縦積み
type DeckSlot = {
	id: string;
	width: number;
	height?: number;
	fullWidth?: boolean;
	fullHeight?: boolean;
	frames: DeckFrame[];
};
type DeckProfile = { id: string; name: string; layout: DeckLayout; slots: DeckSlot[]; };

// 旧形式(マイグレーション元)
type LegacyColumn = { id: string; type: ColumnType; width: number; height?: number; name?: string; sourceId?: string; withRenotes?: boolean; borderColor?: string | null; fullWidth?: boolean; fullHeight?: boolean; } & Pick<DeckTab, 'excludeTypes' | 'notificationFilterKnownTypes' | 'excludeBots'>;
type LegacyProfile = { id: string; name: string; layout: DeckLayout; columns: LegacyColumn[]; };

const LAYOUTS: { id: DeckLayout; icon: string; label: string }[] = [
	{ id: 'row', icon: 'ti ti-layout-columns', label: copy.layoutRow },
	{ id: 'grid2', icon: 'ti ti-layout-grid', label: copy.layoutGrid2 },
	{ id: 'grid3', icon: 'ti ti-layout-board-split', label: copy.layoutGrid3 },
	{ id: 'stack', icon: 'ti ti-layout-list', label: copy.layoutStack },
];

const toolbarOpen = ref((prefer.r['simpleUi.topNavMode']?.value as boolean) ?? false);
// 旗鯖fork: 上部メニューモードが有効な時は、デッキのツールバートグルボタンを隠し、
// 上部ナビバーの「デッキ設定」ボタンからの globalEvents で開閉する。
const topNavMode = computed(() => (prefer.r['simpleUi.topNavMode']?.value as boolean) ?? false);
function onToggleDeckToolbar() { toolbarOpen.value = !toolbarOpen.value; }
onMounted(() => { globalEvents.on('toggleDeckToolbar', onToggleDeckToolbar); });
onUnmounted(() => { globalEvents.off('toggleDeckToolbar', onToggleDeckToolbar); });
const toolbarPos = computed<'top' | 'right' | 'bottom'>(() => (prefer.r['simpleUi.deckToolbarPos']?.value as 'top' | 'right' | 'bottom') ?? 'top');
function cycleToolbarPos() {
	const order: ('top' | 'right' | 'bottom')[] = ['top', 'right', 'bottom'];
	const next = order[(order.indexOf(toolbarPos.value) + 1) % order.length];
	prefer.commit('simpleUi.deckToolbarPos', next);
}
const toolbarPosIcon = computed(() => toolbarPos.value === 'top' ? 'ti ti-layout-navbar' : toolbarPos.value === 'bottom' ? 'ti ti-layout-bottombar' : 'ti ti-layout-sidebar-right');
const toolbarPosLabel = computed(() => toolbarPos.value === 'top' ? copy.toolbarTop : toolbarPos.value === 'bottom' ? copy.toolbarBottom : copy.toolbarRight);
// 時計(上下配置 かつ ツールバー表示時のみ)。ON/OFFは simpleUi.deckClock。
const clockEnabled = computed<boolean>(() => prefer.r['simpleUi.deckClock']?.value as boolean ?? false);
function toggleClock() { prefer.commit('simpleUi.deckClock', !clockEnabled.value); }
const showClock = computed(() => clockEnabled.value && (toolbarPos.value === 'top' || toolbarPos.value === 'bottom'));

// 旗鯖fork: デッキ表示中は、各種ページ遷移をモーダルウィンドウで開く(従来のMisskeyデッキと同じ挙動)。
// mainRouter.navHook を設定し、アンマウント時に解除する。
let prevNavHook: typeof mainRouter.navHook = null;
onMounted(() => {
	prevNavHook = mainRouter.navHook;
	mainRouter.navHook = (path, flag): boolean => {
		if (flag === 'forcePage') return false;
		os.pageWindow(path);
		return true;
	};
});
onUnmounted(() => { mainRouter.navHook = prevNavHook; });

// ===== RSS ティッカー(端末ローカル/最大5フィード/優先順位=配列順/フィードごとに色) =====
// 取得は既存の /api/fetch-rss(CORS回避済みプロキシ)。URLは保存せずその場で取得するだけ。
// 保存先 simpleUi.deckRssFeeds は端末ローカル(サーバー同期なし)。
// 表示は画面幅に応じて最大5記事を横並び。各記事はフィードの色を帯びる。
const RSS_MAX_FEEDS = 5;
const RSS_MAX_VISIBLE = 8; // 横並び表示の最大数
const RSS_ITEM_MIN = 100; // 1項目あたりの目安幅(px)。これでticker幅を割って件数を出す。
type RssFeed = { id: string; url: string; name?: string; color?: string };
type RssItem = { title: string; link: string; color?: string; feedName?: string };
const rssFeeds = computed<RssFeed[]>(() => (prefer.r['simpleUi.deckRssFeeds']?.value as RssFeed[]) ?? []);
const rssEnabled = computed<boolean>(() => (prefer.r['simpleUi.deckRssEnabled']?.value as boolean) ?? false);
const rssItems = ref<RssItem[]>([]);
const rssOffset = ref(0); // 横並び表示の開始位置(スライドで進む)
const rssFetching = ref(false);
const rssTickerEl = ref<HTMLElement | null>(null);
const rssTickerWidth = ref(0);
let rssResizeObserver: ResizeObserver | null = null;
let rssTickTimer: ReturnType<typeof setInterval> | null = null;
let rssFetchTimer: ReturnType<typeof setInterval> | null = null;

const showRssTicker = computed(() => rssEnabled.value && rssFeeds.value.length > 0 && rssItems.value.length > 0 && (toolbarPos.value === 'top' || toolbarPos.value === 'bottom'));
// ticker の実幅から、収まる項目数を動的に算出する。全項目が均一幅で伸びるため、
// 「1項目あたりの最小読める幅(RSS_ITEM_MIN)」で素直に割る。
const rssVisibleCount = computed(() => {
	const w = rssTickerWidth.value;
	if (w <= 0) return Math.min(3, rssItems.value.length); // 初期描画時の暫定値
	const n = Math.max(1, Math.floor(w / RSS_ITEM_MIN));
	return Math.min(RSS_MAX_VISIBLE, n, rssItems.value.length);
});
// 横並びで見せる記事。offsetから巡回で切り出す。
const visibleRssItems = computed<RssItem[]>(() => {
	const all = rssItems.value;
	if (all.length === 0) return [];
	const n = rssVisibleCount.value;
	const out: RssItem[] = [];
	for (let i = 0; i < n; i++) out.push(all[(rssOffset.value + i) % all.length]);
	return out;
});

// 旗鯖fork(セキュリティ修正): RSS フィードの item.link は外部のフィード提供者由来であり、
//   悪意あるフィードが javascript:/data: 等の危険プロトコルを混ぜてくる可能性がある。
//   http:/https: のみ通し、それ以外は undefined を返して :href 属性自体を出さない(クリック不能化)。
//   HataFeedEmojiApprove.vue の safeOriginalUrl と同じパターン。
function safeLink(url: string | undefined | null): string | undefined {
	if (typeof url !== 'string' || !url) return undefined;
	try {
		const p = new URL(url);
		return (p.protocol === 'http:' || p.protocol === 'https:') ? url : undefined;
	} catch { return undefined; }
}

async function fetchOneFeed(feed: RssFeed): Promise<RssItem[]> {
	try {
		const ep = new URL('/api/fetch-rss', location.origin);
		ep.searchParams.set('url', feed.url);
		const res = await window.fetch(ep, {});
		if (!res.ok) return [];
		const data = await res.json();
		const items = Array.isArray(data?.items) ? data.items : [];
		return items.map((it: any) => ({ title: it.title ?? copy.untitled, link: it.link ?? '#', color: feed.color, feedName: feed.name })).filter((it: RssItem) => it.link !== '#');
	} catch { return []; }
}
async function fetchAllRss() {
	if (rssFetching.value || rssFeeds.value.length === 0) return;
	rssFetching.value = true;
	try {
		// フィードごとに取得し、優先順位順(配列順)にラウンドロビンで混ぜる
		// 旗鯖fork: 各フィードは独立したRSSサーバ(自分で登録)なので並列fetchで問題なし。
		//   直列だと10件で数秒待たされるため並列化する。順序は配列順に固定したいので
		//   Promise.all で配列の位置を保ったまま結果を受け取る。
		const feeds = rssFeeds.value.slice(0, RSS_MAX_FEEDS);
		const perFeed: RssItem[][] = await Promise.all(
			feeds.map(async feed => (await fetchOneFeed(feed)).slice(0, 10)),
		);
		const merged: RssItem[] = [];
		const maxLen = Math.max(0, ...perFeed.map(a => a.length));
		for (let i = 0; i < maxLen; i++) {
			for (const arr of perFeed) { if (i < arr.length) merged.push(arr[i]); }
		}
		rssItems.value = merged;
		if (rssOffset.value >= merged.length) rssOffset.value = 0;
	} finally {
		rssFetching.value = false;
	}
}
function startRss() {
	stopRss();
	// RSSボタンが無効、フィード無し、または右配置(=RSS非表示)の間は受信を停止する。
	if (!rssEnabled.value || rssFeeds.value.length === 0 || toolbarPos.value === 'right') return;
	fetchAllRss();
	// 横並び表示を一定間隔で1つずつスライド(縦スライドフェード)。表示数より項目が多い時のみ。
	rssTickTimer = setInterval(() => {
		if (rssItems.value.length > rssVisibleCount.value) rssOffset.value = (rssOffset.value + 1) % rssItems.value.length;
	}, 6000);
	rssFetchTimer = setInterval(() => { fetchAllRss(); }, 10 * 60 * 1000);
}
function stopRss() {
	if (rssTickTimer) { clearInterval(rssTickTimer); rssTickTimer = null; }
	if (rssFetchTimer) { clearInterval(rssFetchTimer); rssFetchTimer = null; }
}
// ticker の幅を監視して、表示数を動的に決める(途切れ防止)。
function measureRssTicker() {
	const el = rssTickerEl.value;
	if (!el) return;
	const w = el.clientWidth;
	if (w > 0) rssTickerWidth.value = w;
}
function observeRssTicker() {
	if (rssResizeObserver) { rssResizeObserver.disconnect(); rssResizeObserver = null; }
	const el = rssTickerEl.value;
	if (!el) return;
	// 描画直後はレイアウト未確定で clientWidth が 0 のことがあるため、RAFで実測する。
	window.requestAnimationFrame(() => { measureRssTicker(); window.requestAnimationFrame(measureRssTicker); });
	rssResizeObserver = new ResizeObserver(() => { measureRssTicker(); });
	rssResizeObserver.observe(el);
}
// tickerの出現/消滅に合わせてobserverを張り直す(DOM更新後に実行)
watch(rssTickerEl, () => { observeRssTicker(); }, { flush: 'post' });
// 項目が更新された時もDOM確定後に再実測(初期描画でwidth=0だった場合の保険)
watch(rssItems, () => { window.requestAnimationFrame(measureRssTicker); }, { flush: 'post' });
onMounted(() => { startRss(); });
onUnmounted(() => { stopRss(); if (rssResizeObserver) { rssResizeObserver.disconnect(); rssResizeObserver = null; } });
watch([rssEnabled, rssFeeds, toolbarPos], () => { startRss(); });

// RSS管理
const RSS_PALETTE: { name: string; value: string }[] = [
	{ name: copy.colorRed, value: '#e0566f' }, { name: copy.colorOrange, value: '#e08a3c' }, { name: copy.colorYellow, value: '#d8b13a' },
	{ name: copy.colorGreen, value: '#4caf7d' }, { name: copy.colorBlue, value: '#4a9eff' }, { name: copy.colorPurple, value: '#9b6dde' }, { name: copy.colorPink, value: '#e06699' },
];
function commitRssFeeds(list: RssFeed[]) { prefer.commit('simpleUi.deckRssFeeds', list); }
async function addRssFeed() {
	if (rssFeeds.value.length >= RSS_MAX_FEEDS) { os.alert({ type: 'warning', text: copyx.maxRssFeeds({ max: RSS_MAX_FEEDS.toString() }) }); return; }
	const { canceled: c1, result: url } = await os.inputText({ title: copy.rssFeedUrl, placeholder: 'https://example.com/feed.xml' });
	if (c1 || !url || url.trim() === '') return;
	const { canceled: c2, result: name } = await os.inputText({ title: copy.optionalDisplayName, placeholder: copy.mayBeBlank });
	const feed: RssFeed = { id: genId('rss'), url: url.trim(), name: (!c2 && name && name.trim() !== '') ? name.trim() : undefined, color: RSS_PALETTE[rssFeeds.value.length % RSS_PALETTE.length].value };
	commitRssFeeds([...rssFeeds.value, feed]);
	if (!rssEnabled.value) prefer.commit('simpleUi.deckRssEnabled', true);
}
function removeRssFeed(id: string) { commitRssFeeds(rssFeeds.value.filter(f => f.id !== id)); }
function moveRssFeed(id: string, step: number) {
	const idx = rssFeeds.value.findIndex(f => f.id === id);
	const to = idx + step;
	if (idx < 0 || to < 0 || to >= rssFeeds.value.length) return;
	const next = [...rssFeeds.value];
	const [m] = next.splice(idx, 1);
	next.splice(to, 0, m);
	commitRssFeeds(next);
}
function setRssColor(id: string, color: string) { commitRssFeeds(rssFeeds.value.map(f => f.id !== id ? f : { ...f, color })); }
function toggleRss() {
	const next = !rssEnabled.value;
	prefer.commit('simpleUi.deckRssEnabled', next);
	if (next && rssFeeds.value.length === 0) { addRssFeed(); }
}
function openRssMenu(ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	const feedItems = rssFeeds.value.map((f) => ({
		type: 'parent' as const,
		text: f.name ?? f.url,
		icon: 'ti ti-rss',
		children: [
			{ type: 'parent' as const, text: copy.feedColor, icon: 'ti ti-palette', children: RSS_PALETTE.map(c => ({ text: c.name, icon: f.color === c.value ? 'ti ti-check' : 'ti ti-circle-filled', action: () => setRssColor(f.id, c.value) })) },
			{ text: copy.moveUpIncreasePriority, icon: 'ti ti-arrow-up', action: () => moveRssFeed(f.id, -1) },
			{ text: copy.moveDownDecreasePriority, icon: 'ti ti-arrow-down', action: () => moveRssFeed(f.id, 1) },
			{ type: 'divider' as const },
			{ text: copy.delete, icon: 'ti ti-trash', danger: true, action: () => removeRssFeed(f.id) },
		],
	}));
	os.popupMenu([
		{ type: 'label' as const, text: copyx.rssFeedCount({ count: rssFeeds.value.length.toString(), max: RSS_MAX_FEEDS.toString() }) },
		{ type: 'switch' as const, text: copy.showRss, ref: computed({ get: () => rssEnabled.value, set: () => toggleRss() }) },
		{ type: 'divider' as const },
		...feedItems,
		{ type: 'divider' as const },
		...(rssFeeds.value.length < RSS_MAX_FEEDS ? [{ text: copy.addFeed, icon: 'ti ti-plus', action: () => addRssFeed() }] : []),
		{ text: copy.updateNow, icon: 'ti ti-refresh', action: () => fetchAllRss() },
	], anchor);
}

// ===== オンラインユーザー数(ON/OFFボタン + 「○人がオンラインです」表示) =====
const onlineEnabled = computed<boolean>(() => (prefer.r['simpleUi.deckOnlineUsers']?.value as boolean) ?? false);
const onlineCount = ref<number | null>(null);
let onlineTimer: ReturnType<typeof setInterval> | null = null;
const showOnline = computed(() => onlineEnabled.value && (toolbarPos.value === 'top' || toolbarPos.value === 'bottom'));
async function fetchOnline() {
	try { const res: any = await misskeyApiGet('get-online-users-count'); onlineCount.value = res?.count ?? null; }
	catch { onlineCount.value = null; }
}
function startOnline() {
	stopOnline();
	if (!showOnline.value) return;
	fetchOnline();
	onlineTimer = setInterval(() => { fetchOnline(); }, 60 * 1000);
}
function stopOnline() { if (onlineTimer) { clearInterval(onlineTimer); onlineTimer = null; } }
function toggleOnline() { prefer.commit('simpleUi.deckOnlineUsers', !onlineEnabled.value); }
onMounted(() => { startOnline(); });
onUnmounted(() => { stopOnline(); });
watch([onlineEnabled, toolbarPos], () => { startOnline(); });
const locked = computed<boolean>(() => prefer.r['simpleUi.deckLocked'].value as boolean);
function toggleLock() { prefer.commit('simpleUi.deckLocked', !locked.value); }
// 旗鯖fork(タスク5): 上部メニュー(topNav)⇔左サイドメニューの切替をデッキUIメニューからも行えるようにする。
function toggleTopNavMode() { prefer.commit('simpleUi.topNavMode', !topNavMode.value); }

function genId(prefix: string): string { return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`; }

// ===== マイグレーション(onMountedのみ。副作用) =====
// 旧 deckProfiles(columns[]) → V2(slots[].frames[].tabs[]) に 1カラム=1slot=1frame=1tab で変換。
// 旧 deckColumns/deckLayout(さらに古い単一構成)も拾う。V2が既にあれば絶対に触らない。
function legacyColumnToSlot(col: LegacyColumn): DeckSlot {
	return {
		id: genId('slot'),
		width: col.width ?? 380,
		height: col.height ?? 460,
		fullWidth: col.fullWidth,
		fullHeight: col.fullHeight,
		frames: [{
			id: genId('frame'),
			borderColor: col.borderColor ?? null,
			tabs: [{
				id: col.id ?? genId('tab'),
				type: col.type,
				name: col.name,
				sourceId: col.sourceId,
				withRenotes: col.withRenotes,
				excludeTypes: col.excludeTypes,
				notificationFilterKnownTypes: col.notificationFilterKnownTypes,
				excludeBots: col.excludeBots,
			}],
		}],
	};
}

function migrateV2IfNeeded() {
	const v2 = prefer.r['simpleUi.deckProfilesV2'].value as DeckProfile[];
	if (v2 != null && v2.length > 0) return; // 既にV2があるなら触らない

	// 1) 旧 deckProfiles(複数プロファイル, columns形式)から変換
	const legacy = prefer.r['simpleUi.deckProfiles'].value as LegacyProfile[];
	let migrated: DeckProfile[] = [];
	if (legacy != null && legacy.length > 0) {
		migrated = legacy.map(lp => ({
			id: lp.id,
			name: lp.name,
			layout: lp.layout ?? 'row',
			slots: (lp.columns ?? []).map(legacyColumnToSlot),
		}));
	} else {
		// 2) さらに古い単一構成(deckColumns/deckLayout)から
		const cols = prefer.r['simpleUi.deckColumns'].value as LegacyColumn[];
		const lay = (prefer.r['simpleUi.deckLayout'].value as DeckLayout) ?? 'row';
		migrated = [{
			id: 'default',
			name: 'デフォルト',
			layout: lay,
			slots: (cols ?? []).map(legacyColumnToSlot),
		}];
	}
	if (migrated.length === 0) {
		migrated = [{ id: 'default', name: 'デフォルト', layout: 'row', slots: [] }];
	}
	prefer.commit('simpleUi.deckProfilesV2', migrated);
	if (!(prefer.r['simpleUi.deckActiveProfileV2'].value as string)) {
		prefer.commit('simpleUi.deckActiveProfileV2', migrated[0].id);
	}
}

function migrateNotificationFilterSnapshots() {
	const currentProfiles = prefer.r['simpleUi.deckProfilesV2'].value as DeckProfile[] | null | undefined;
	if (currentProfiles == null || currentProfiles.length === 0) return;
	const hasLegacyFilter = currentProfiles.some(profile => profile.slots.some(slot => slot.frames.some(frame => frame.tabs.some(tab => (
		tab.type === 'notifications' && migrateNotificationFilterSnapshot(tab.excludeTypes, tab.notificationFilterKnownTypes) != null
	)))));
	if (!hasLegacyFilter) return;
	const migratedProfiles = currentProfiles.map(profile => ({
		...profile,
		slots: profile.slots.map(slot => ({
			...slot,
			frames: slot.frames.map(frame => ({
				...frame,
				tabs: frame.tabs.map(tab => {
					if (tab.type !== 'notifications') return tab;
					const migrated = migrateNotificationFilterSnapshot(tab.excludeTypes, tab.notificationFilterKnownTypes);
					if (migrated == null) return tab;
					return { ...tab, notificationFilterKnownTypes: migrated.knownTypes };
				}),
			})),
		})),
	}));
	commitProfiles(migratedProfiles);
}

onMounted(async () => {
	migrateV2IfNeeded();
	await nextTick();
	migrateNotificationFilterSnapshots();
});

// ===== プロファイル/slots アクセサ(副作用なし・読むだけ) =====
const FALLBACK_PROFILE: DeckProfile = { id: 'default', name: 'デフォルト', layout: 'row', slots: [] };
const LEGACY_DEFAULT_PROFILE_NAME = 'デフォルト';

// 既存・移行済みの保存名は変更せず、既定プロファイルだけ表示時に解決する。
function displayProfileName(profile: DeckProfile): string {
	return profile.id === 'default' && profile.name === LEGACY_DEFAULT_PROFILE_NAME ? copy.defaultProfile : profile.name;
}

const profiles = computed<DeckProfile[]>(() => {
	const p = prefer.r['simpleUi.deckProfilesV2'].value as DeckProfile[];
	return (p != null && p.length > 0) ? p : [FALLBACK_PROFILE];
});
const activeProfileId = computed<string>(() => {
	const id = prefer.r['simpleUi.deckActiveProfileV2'].value as string;
	const list = profiles.value;
	if (id && list.some(p => p.id === id)) return id;
	return list[0]?.id ?? 'default';
});
const activeProfile = computed<DeckProfile>(() => {
	const list = profiles.value;
	return list.find(p => p.id === activeProfileId.value) ?? list[0];
});
const activeProfileName = computed<string>(() => activeProfile.value ? displayProfileName(activeProfile.value) : copy.defaultProfile);
const slots = computed<DeckSlot[]>(() => activeProfile.value?.slots ?? []);
// Filter only the rendered view. Editing still uses slots so hidden saved tabs survive.
const visibleSlots = computed<DeckSlot[]>(() => slots.value.map(slot => ({
	...slot,
	frames: slot.frames.map(frame => ({
		...frame,
		tabs: frame.tabs.filter(tab => isHataskeyTimelineAllowed(tab.type)),
	})).filter(frame => frame.tabs.length > 0),
})).filter(slot => slot.frames.length > 0));
const layout = computed<DeckLayout>(() => activeProfile.value?.layout ?? 'row');

// ===== commit系 =====
function commitProfiles(list: DeckProfile[]) { prefer.commit('simpleUi.deckProfilesV2', list); }
function commitActiveProfile(mutator: (p: DeckProfile) => DeckProfile) {
	commitProfiles(profiles.value.map(p => p.id === activeProfileId.value ? mutator({ ...p }) : p));
}
function commitSlots(next: DeckSlot[]) { commitActiveProfile(p => ({ ...p, slots: next })); }
function setLayout(l: DeckLayout) { commitActiveProfile(p => ({ ...p, layout: l })); }

// ===== カラム(tab)描画ロジック =====
const COLUMN_META: Record<ColumnType, { title: string; icon: string }> = {
	home: { title: copy.columnHome, icon: 'ti ti-home' },
	local: { title: copy.columnLocal, icon: 'ti ti-planet' },
	social: { title: copy.columnSocial, icon: 'ti ti-universe' },
	global: { title: copy.columnGlobal, icon: 'ti ti-world' },
	trending: { title: copy.columnTrending, icon: 'ti ti-chart-line' },
	list: { title: copy.columnList, icon: 'ti ti-list' },
	antenna: { title: copy.columnAntenna, icon: 'ti ti-antenna' },
	channel: { title: copy.columnChannel, icon: 'ti ti-device-tv' },
	mentions: { title: copy.columnMentions, icon: 'ti ti-at' },
	directs: { title: copy.columnDirects, icon: 'ti ti-mail' },
	notifications: { title: copy.columnNotifications, icon: 'ti ti-bell' },
	widgets: { title: copy.columnWidgets, icon: 'ti ti-apps' },
	postForm: { title: copy.columnPostForm, icon: 'ti ti-pencil-plus' },
	// 旗鯖fork(新デッキ): クリップ/お気に入り
	clip: { title: copy.columnClip, icon: 'ti ti-paperclip' },
	favorites: { title: copy.columnFavorites, icon: 'ti ti-star' },
};
function tabTitle(tab: DeckTab): string {
	if (tab.tabName && tab.tabName.trim() !== '') return tab.tabName;
	// 旗鯖fork(新デッキ): クリップも sourceId 経由で個別を指すので、name があればそれをタイトルに。
	// 利用者が「リスト」等の既定名と同じ名前を付けた場合も、その入力値を翻訳しない。
	if ((tab.type === 'list' || tab.type === 'antenna' || tab.type === 'channel' || tab.type === 'clip') && tab.name) return tab.name;
	return COLUMN_META[tab.type]?.title ?? tab.type;
}
function tabIcon(tab: DeckTab): string { return COLUMN_META[tab.type]?.icon ?? 'ti ti-square'; }

const NOTE_SRC: Partial<Record<ColumnType, string>> = {
	home: 'home', local: 'local', social: 'social', global: 'global', mentions: 'mentions', directs: 'directs',
};
function resolveColumn(tab: DeckTab): Component {
	const notesTimeline = MkStreamingNotesTimeline;
	if (tab.type in NOTE_SRC) return notesTimeline;
	if (tab.type === 'list' && tab.sourceId) return notesTimeline;
	if (tab.type === 'antenna' && tab.sourceId) return notesTimeline;
	if (tab.type === 'channel' && tab.sourceId) return notesTimeline;
	if (tab.type === 'trending') return MkTrendingTimeline;
	if (tab.type === 'notifications') return MkStreamingNotificationsTimeline;
	if (tab.type === 'postForm') return MkPostForm;
	if (tab.type === 'widgets') return XWidgets;
	// 旗鯖fork(新デッキ): クリップ (sourceId=clipId 必須) / お気に入り
	if (tab.type === 'clip' && tab.sourceId) return MkDeckPaginatedNotes;
	if (tab.type === 'favorites') return MkDeckPaginatedNotes;
	return ColumnError;
}

function buildColumnProps(tab: DeckTab): Record<string, unknown> {
	const wr = tab.withRenotes !== false;
	if (tab.type in NOTE_SRC) return { src: NOTE_SRC[tab.type], withRenotes: wr };
	if (tab.type === 'list' && tab.sourceId) return { src: 'list', list: tab.sourceId, withRenotes: wr };
	if (tab.type === 'antenna' && tab.sourceId) return { src: 'antenna', antenna: tab.sourceId, withRenotes: wr };
	if (tab.type === 'channel' && tab.sourceId) return { src: 'channel', channel: tab.sourceId, withRenotes: wr };
	if (tab.type === 'trending') return {};
	if (tab.type === 'notifications') {
		const excludeTypes = resolveNotificationFilter(tab.excludeTypes, tab.notificationFilterKnownTypes).excludeTypes;
		return {
			excludeTypes,
			excludeBots: tab.excludeBots === true,
			showFilterPolicyNotice: hasConfiguredNotificationFilter(tab.excludeTypes, tab.notificationFilterKnownTypes),
		};
	}
	if (tab.type === 'postForm') return { fixed: true, autofocus: false };
	// デッキのウィジェットは操作ボタン行を省き、三点メニュー / タブ右クリックから編集する。
	if (tab.type === 'widgets') return { deckEmbedded: true };
	// 旗鯖fork(新デッキ): クリップ/お気に入り。favorites は endpoint のみで clipId 不要。
	if (tab.type === 'clip' && tab.sourceId) return { endpoint: 'clips/notes', clipId: tab.sourceId };
	if (tab.type === 'favorites') return { endpoint: 'i/favorites' };
	if (tab.type === 'clip' && !tab.sourceId) return { message: copy.clipNotSelected };
	return { message: copy.cannotDisplayColumn };
}

// 時計・オンライン人数・RSSティッカーなど、ツールバーだけの更新で親が再描画されても
// 各カラムへ新しい配列/オブジェクト参照を渡さない。通知カラムはexcludeTypesの参照変更を
// 設定変更と見なしてreloadするため、毎秒の点滅を防ぐにはpropsの安定化も必要になる。
const columnPropsCache = new Map<string, { signature: string; value: Record<string, unknown> }>();

function columnProps(tab: DeckTab, frame: DeckFrame): Record<string, unknown> {
	const signature = JSON.stringify({
		type: tab.type,
		sourceId: tab.sourceId,
		withRenotes: tab.withRenotes,
		excludeTypes: tab.excludeTypes,
		notificationFilterKnownTypes: tab.notificationFilterKnownTypes,
		excludeBots: tab.excludeBots,
	});
	const cached = columnPropsCache.get(tab.id);
	const value = cached?.signature === signature ? cached.value : buildColumnProps(tab);
	if (cached?.signature !== signature) columnPropsCache.set(tab.id, { signature, value });
	return value;
}
const ColumnError = defineAsyncComponent(() => Promise.resolve({
	props: { message: { type: String, default: '' } },
	template: '<div class="_deckColError"><i class="ti ti-alert-circle"></i><div>{{ message }}</div></div>',
}));

const RENOTE_TOGGLE_TYPES: ColumnType[] = ['home', 'local', 'social', 'global', 'list', 'antenna', 'channel'];
function supportsRenoteToggle(tab: DeckTab): boolean { return RENOTE_TOGGLE_TYPES.includes(tab.type); }

// ===== カラム本体ref(外部通知の更新/既読・一括更新用) =====
const colRefs = new Map<string, any>();
function setColRef(id: string, el: any) { if (el) colRefs.set(id, el); else colRefs.delete(id); }

// 旗鯖fork(#9): タブペイン(スクロール領域)の要素参照。タブクリックで最上部へ戻すのに使う。
const paneRefs = new Map<string, HTMLElement>();
function setPaneRef(id: string, el: any) { if (el) paneRefs.set(id, el as HTMLElement); else paneRefs.delete(id); }

// 旗鯖fork(#9): スクロールして最上部へ戻せるタブ種別か(投稿フォーム・ウィジェットは対象外)。
function isScrollableTab(tab: DeckTab): boolean {
	return tab.type !== 'postForm' && tab.type !== 'widgets';
}
// 旗鯖fork(#9): タブクリック。既にアクティブかつタイムライン系なら、そのペインを最上部へスクロール。
// 非アクティブなら通常どおりタブを切り替える。
function onTabClick(slot: DeckSlot, frame: DeckFrame, tab: DeckTab, event: MouseEvent) {
	playHataIconMotion(event, 'press', 420);
	if (activeTabOf(frame).id === tab.id) {
		if (isScrollableTab(tab)) paneRefs.get(tab.id)?.scrollTo({ top: 0, behavior: 'smooth' });
		return;
	}
	setActiveTab(slot.id, frame.id, tab.id);
}

// 旗鯖fork(#9): カラム本体の左右スワイプでタブ切替。横方向が縦方向より十分大きいスワイプのみ反応する
// (縦スクロールを妨げない)。端では切り替えない。
let frameSwipe: { x: number; y: number; frameId: string } | null = null;
function onFrameTouchStart(frame: DeckFrame, ev: TouchEvent) {
	if (!tabSwipeEnabled.value) { frameSwipe = null; return; }
	if (frame.tabs.length < 2 || ev.touches.length !== 1) { frameSwipe = null; return; }
	const t = ev.touches[0];
	frameSwipe = { x: t.clientX, y: t.clientY, frameId: frame.id };
}
function onFrameTouchEnd(slot: DeckSlot, frame: DeckFrame, ev: TouchEvent) {
	if (!tabSwipeEnabled.value) { frameSwipe = null; return; }
	const s = frameSwipe;
	frameSwipe = null;
	if (!s || s.frameId !== frame.id) return;
	const t = ev.changedTouches[0];
	const dx = t.clientX - s.x;
	const dy = t.clientY - s.y;
	if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // 横スワイプ判定
	const tabs = frame.tabs;
	const cur = tabs.findIndex(t2 => t2.id === activeTabOf(frame).id);
	if (cur < 0) return;
	const next = dx < 0 ? cur + 1 : cur - 1; // 左スワイプ→次のタブ / 右スワイプ→前のタブ
	if (next < 0 || next >= tabs.length) return;
	setActiveTab(slot.id, frame.id, tabs[next].id);
}
function reloadAll() {
	globalEvents.emit('reloadTimeline');
	globalEvents.emit('reloadNotification');
}
// 旗鯖fork(新デッキ): お気に入り/クリップカラム (MkDeckPaginatedNotes) のリロード。
//   ストリーミングではない paginator ベースの表示なので、カラムヘッダの refresh ボタンと
//   三点メニューの「再読み込み」から呼ぶ。
function reloadPaginated(tabId: string) { colRefs.get(tabId)?.reload?.(); }

function manageFavoriteFolder(tabId: string, event: MouseEvent) { colRefs.get(tabId)?.manageFolder?.(event.currentTarget); }
// 旗鯖fork: 従来のチャンネル投稿ボタン (カラムヘッダ右のペン+ボタン / 三点メニュー内「このチャンネルへ投稿」) の表示可否。
//   default false で、新設のノートリスト最上部固定ボタンに導線を統一する。
const showLegacyChannelPostButton = computed(() => (prefer.r['simpleUi.showLegacyChannelPostButton']?.value as boolean | undefined) === true);

// 旗鯖fork(新デッキ): チャンネルカラムから該当チャンネルへ投稿する。
// os.post は channel オブジェクト全体を要求するため、channelId から channels/show で取得して渡す。
async function postToChannel(channelId: string) {
	try {
		const channel = await misskeyApi('channels/show', { channelId });
		os.post({
			channel: {
				id: channel.id,
				name: channel.name,
				color: channel.color,
				isSensitive: channel.isSensitive,
				allowRenoteToExternal: channel.allowRenoteToExternal,
				userId: channel.userId,
			},
		});
	} catch (err) {
		os.alert({ type: 'error', text: copy.failedToLoadChannel });
	}
}

// ===== slot/frame/tab を辿るユーティリティ =====
function mapSlots(mut: (slots: DeckSlot[]) => DeckSlot[]) { commitSlots(mut(slots.value.map(s => ({ ...s, frames: s.frames.map(f => ({ ...f, tabs: [...f.tabs] })) })))); }
function findFrame(slotId: string, frameId: string): { s: number; f: number } | null {
	for (let si = 0; si < slots.value.length; si++) {
		const fi = slots.value[si].frames.findIndex(f => f.id === frameId);
		if (slots.value[si].id === slotId && fi >= 0) return { s: si, f: fi };
	}
	return null;
}

// ===== レイアウト別サイズ =====
function slotStyle(slot: DeckSlot): Record<string, string> {
	const st: Record<string, string> = {};
	if (layout.value === 'row') {
		st.width = `${slot.width}px`;
		// 旗鯖fork(#10): px数値指定でCSSの min-width(280px) を下回る幅も指定どおりに反映できるよう、
		// インラインで minWidth も合わせる。
		st.minWidth = `${slot.width}px`;
	} else if (layout.value === 'stack') st.height = `${slot.height ?? 460}px`;
	return st;
}
function frameStyle(frame: DeckFrame, slot: DeckSlot): Record<string, string> {
	const st: Record<string, string> = {};
	if (frame.borderColor) { st.borderColor = frame.borderColor; st['--deckColBorder'] = frame.borderColor; }
	// 横並びレイアウトで縦積み(frame複数)のとき、height指定があれば固定高にする。
	// 未指定のframeは flex:1 で残りを分け合う(CSS側のデフォルト)。
	if (layout.value === 'row' && slot.frames.length > 1 && frame.height) {
		st.flex = `0 0 ${frame.height}px`;
		st.height = `${frame.height}px`;
	}
	return st;
}
function setFrameHeight(slotId: string, frameId: string, height: number | null) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, height: height ?? undefined }) }));
}
// カラム(列)のサイズをリセット: 幅を既定(380)に、列内の全frameの高さを自動(均等)に戻す。
function resetSlotSize(slotId: string) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, width: 380, height: 460, frames: s.frames.map(f => ({ ...f, height: undefined })) }));
}

// ===== 縦積みframe間のドラッグリサイズ(横並びレイアウト限定) =====
// frame間のハンドルを掴んで上下にドラッグ → 上のframeの高さを増減する。
const FRAME_MIN_H = 120;
let resizeState: { slotId: string; frameId: string; startY: number; startH: number; pointerId: number } | null = null;
function onFrameResizeDown(slotId: string, frameId: string, ev: PointerEvent) {
	if (locked.value || ev.button !== 0) return;
	ev.preventDefault();
	ev.stopPropagation();
	const loc = findFrame(slotId, frameId);
	if (!loc) return;
	// 現在の実高さを取得(height未設定=均等分配中でも、実DOM高さを基準にする)
	const handleEl = ev.currentTarget as HTMLElement;
	const frameEl = handleEl?.previousElementSibling as HTMLElement | null;
	const measured = frameEl?.getBoundingClientRect().height;
	const cur = slots.value[loc.s].frames[loc.f].height ?? (measured ? Math.round(measured) : 300);
	resizeState = { slotId, frameId, startY: ev.clientY, startH: cur, pointerId: ev.pointerId };
	window.addEventListener('pointermove', onFrameResizeMove);
	window.addEventListener('pointerup', onFrameResizeUp);
}
function onFrameResizeMove(ev: PointerEvent) {
	if (!resizeState) return;
	const dy = ev.clientY - resizeState.startY;
	const next = Math.max(FRAME_MIN_H, Math.round(resizeState.startH + dy));
	setFrameHeight(resizeState.slotId, resizeState.frameId, next);
}
function onFrameResizeUp() {
	window.removeEventListener('pointermove', onFrameResizeMove);
	window.removeEventListener('pointerup', onFrameResizeUp);
	resizeState = null;
}

// ===== タブ操作 =====
function setActiveTab(slotId: string, frameId: string, tabId: string) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, activeTab: tabId }) }));
}
function activeTabOf(frame: DeckFrame): DeckTab {
	return frame.tabs.find(t => t.id === frame.activeTab) ?? frame.tabs[0];
}
async function renameTab(slotId: string, frameId: string, tabId: string) {
	const loc = findFrame(slotId, frameId); if (!loc) return;
	const tab = slots.value[loc.s].frames[loc.f].tabs.find(t => t.id === tabId); if (!tab) return;
	const defaultTitle = tabTitle(tab);
	const { canceled, result } = await os.inputText({ title: copy.renameTab, default: defaultTitle, placeholder: copy.emptyRestoresTypeName });
	if (canceled) return;
	const trimmed = result?.trim() ?? '';
	// 翻訳された既定名を保存値へ書き込まず、未設定の意味を維持する。
	const nextTabName = trimmed === '' || (tab.tabName == null && trimmed === defaultTitle) ? undefined : trimmed;
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, tabs: f.tabs.map(t => t.id !== tabId ? t : { ...t, tabName: nextTabName }) }) }));
}
function removeTab(slotId: string, frameId: string, tabId: string) {
	mapSlots(ss => {
		return ss.map(s => {
			if (s.id !== slotId) return s;
			const frames = s.frames.map(f => {
				if (f.id !== frameId) return f;
				const tabs = f.tabs.filter(t => t.id !== tabId);
				const activeTab = f.activeTab === tabId ? tabs[0]?.id : f.activeTab;
				return { ...f, tabs, activeTab };
			}).filter(f => f.tabs.length > 0); // タブが空になったframeは消す
			return { ...s, frames };
		}).filter(s => s.frames.length > 0); // frameが空のslotも消す
	});
}

// ===== frame(縦積み段)操作 =====
function removeFrame(slotId: string, frameId: string) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.filter(f => f.id !== frameId) }).filter(s => s.frames.length > 0));
}
function setFrameBorderColor(slotId: string, frameId: string, color: string | null) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, borderColor: color }) }));
}

// ===== slot(列/セル/段)操作 =====
function setSlotWidth(slotId: string, width: number) { mapSlots(ss => ss.map(s => s.id !== slotId ? { ...s } : { ...s, width })); }
function setSlotHeight(slotId: string, height: number) { mapSlots(ss => ss.map(s => s.id !== slotId ? { ...s } : { ...s, height })); }
function setSlotFullSpan(slotId: string, span: 'none' | 'col' | 'row') {
	mapSlots(ss => ss.map(s => s.id !== slotId ? { ...s } : { ...s, fullWidth: span === 'col', fullHeight: span === 'row' }));
}
function currentFullSpan(slot: DeckSlot): 'none' | 'col' | 'row' { if (slot.fullWidth) return 'col'; if (slot.fullHeight) return 'row'; return 'none'; }
function removeSlot(slotId: string) { commitSlots(slots.value.filter(s => s.id !== slotId)); }
function moveSlot(slotId: string, step: number) {
	const idx = slots.value.findIndex(s => s.id === slotId);
	const to = idx + step;
	if (idx < 0 || to < 0 || to >= slots.value.length) return;
	const next = [...slots.value];
	const [m] = next.splice(idx, 1);
	next.splice(to, 0, m);
	commitSlots(next);
}

// 新規slot/frame/tab 生成
function newTab(partial: Partial<DeckTab> & { type: ColumnType }): DeckTab {
	return { id: genId('tab'), withRenotes: true, ...partial };
}
function newFrameFromTab(tab: DeckTab): DeckFrame { return { id: genId('frame'), borderColor: null, tabs: [tab], activeTab: tab.id }; }
function newSlotFromTab(tab: DeckTab): DeckSlot { return { id: genId('slot'), width: 380, height: 460, frames: [newFrameFromTab(tab)] }; }

// スロットを新規追加(末尾)
function addSlotWithTab(partial: Partial<DeckTab> & { type: ColumnType }) {
	if (!isHataskeyTimelineAllowed(partial.type)) return;
	commitSlots([...slots.value, newSlotFromTab(newTab(partial))]);
}
// 既存frameにタブとして束ねる
function addTabToFrame(slotId: string, frameId: string, partial: Partial<DeckTab> & { type: ColumnType }) {
	if (!isHataskeyTimelineAllowed(partial.type)) return;
	const tab = newTab(partial);
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, tabs: [...f.tabs, tab], activeTab: tab.id }) }));
}
// 既存slotにframeとして縦積み追加
function addFrameToSlot(slotId: string, partial: Partial<DeckTab> & { type: ColumnType }) {
	if (!isHataskeyTimelineAllowed(partial.type)) return;
	const frame = newFrameFromTab(newTab(partial));
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: [...s.frames, frame] }));
}

// ===== ドラッグ束ね =====
// ドラッグ対象 = タブ(どのslot/frameのどのtabか)。
// ドロップ先 = (a)別frameのヘッダ → そのframeにタブとして移動(束ねる)
//             (b)slotの縦積みドロップ帯 → そのslotに新frameとして縦積み
//             (c)レイアウト端のドロップ帯 → 新slotとして追加
type DragSrc = { slotId: string; frameId: string; tabId: string };

// ===== ポインターベースのドラッグエンジン =====
// HTML5 Drag&Drop(draggable属性)は、入れ子のスクロール/絶対配置コンテナや
// 縦積み下段のframeで dragstart が安定して発火しない問題があった。そこで
// pointerdown/move/up による自前ドラッグに切り替える。DOM位置に依存せず、
// elementFromPoint でドロップ先(data-deck-* 属性)を判定するため、どの段でも確実に動く。
const dragSrc = ref<DragSrc | null>(null);
const dragOverFrame = ref<string | null>(null);
const dragOverSlotStack = ref<string | null>(null);
const slotDragId = ref<string | null>(null);
const slotDragOverId = ref<string | null>(null);
const tabDragOverId = ref<string | null>(null);

// ドラッグゴースト(指/カーソル追従の見た目)
const ghost = ref<{ x: number; y: number; label: string; icon: string; color?: string | null } | null>(null);

type PointerDragState = {
	kind: 'tab' | 'slot';
	src?: DragSrc;        // tab用
	slotId?: string;      // slot用
	startX: number; startY: number;
	started: boolean;     // 閾値を超えてドラッグ開始したか
	pointerId: number;
};
let pds: PointerDragState | null = null;
const DRAG_THRESHOLD = 5;

function deckDataAt(x: number, y: number): { slotId?: string; frameId?: string; tabId?: string; stackSlotId?: string; newSlot?: boolean } {
	const els = window.document.elementsFromPoint(x, y) as HTMLElement[];
	const out: { slotId?: string; frameId?: string; tabId?: string; stackSlotId?: string; newSlot?: boolean } = {};
	for (const el of els) {
		if (out.tabId == null && el.dataset?.deckTab) { out.tabId = el.dataset.deckTab; out.frameId = el.dataset.deckTabFrame; out.slotId = el.dataset.deckTabSlot; }
		if (out.frameId == null && el.dataset?.deckFrame) { out.frameId = el.dataset.deckFrame; out.slotId = el.dataset.deckFrameSlot; }
		if (out.stackSlotId == null && el.dataset?.deckStackdrop) { out.stackSlotId = el.dataset.deckStackdrop; }
		if (out.slotId == null && el.dataset?.deckSlot) { out.slotId = el.dataset.deckSlot; }
		if (!out.newSlot && el.dataset?.deckNewslot != null) { out.newSlot = true; }
	}
	return out;
}

function clearDragState() {
	dragSrc.value = null; dragOverFrame.value = null; dragOverSlotStack.value = null;
	slotDragId.value = null; slotDragOverId.value = null; tabDragOverId.value = null;
	ghost.value = null;
}

// --- タブのドラッグ開始(grip の pointerdown) ---
function onTabPointerDown(slotId: string, frameId: string, tabId: string, ev: PointerEvent) {
	if (locked.value || ev.button !== 0) return;
	ev.preventDefault();
	pds = { kind: 'tab', src: { slotId, frameId, tabId }, startX: ev.clientX, startY: ev.clientY, started: false, pointerId: ev.pointerId };
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
}
// --- slotのドラッグ開始(slotHandle の pointerdown) ---
function onSlotPointerDown(slotId: string, ev: PointerEvent) {
	if (locked.value || ev.button !== 0) return;
	pds = { kind: 'slot', slotId, startX: ev.clientX, startY: ev.clientY, started: false, pointerId: ev.pointerId };
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(ev: PointerEvent) {
	if (!pds) return;
	const dragState = pds;
	const dx = ev.clientX - dragState.startX, dy = ev.clientY - dragState.startY;
	if (!dragState.started) {
		if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		dragState.started = true;
		// ドラッグ開始
		if (dragState.kind === 'tab' && dragState.src) {
			dragSrc.value = dragState.src;
			const loc = findFrame(dragState.src.slotId, dragState.src.frameId);
			const tab = loc ? slots.value[loc.s].frames[loc.f].tabs.find(t => t.id === dragState.src!.tabId) : null;
			if (tab) ghost.value = { x: ev.clientX, y: ev.clientY, label: tabTitle(tab), icon: tabIcon(tab), color: tab.tabColor };
		} else if (dragState.kind === 'slot' && dragState.slotId) {
			slotDragId.value = dragState.slotId;
			ghost.value = { x: ev.clientX, y: ev.clientY, label: copy.moveColumn, icon: 'ti ti-grip-vertical' };
		}
	}
	if (ghost.value) { ghost.value.x = ev.clientX; ghost.value.y = ev.clientY; }
	const hit = deckDataAt(ev.clientX, ev.clientY);
	if (dragState.kind === 'tab') {
		tabDragOverId.value = hit.tabId ?? null;
		dragOverFrame.value = (hit.frameId && !hit.tabId) ? hit.frameId : null;
		dragOverSlotStack.value = hit.stackSlotId ?? null;
	} else {
		slotDragOverId.value = (hit.slotId && hit.slotId !== dragState.slotId) ? hit.slotId : null;
	}
}

function onPointerUp(ev: PointerEvent) {
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('pointerup', onPointerUp);
	if (!pds) { clearDragState(); return; }
	const state = pds; pds = null;
	if (!state.started) { clearDragState(); return; } // 閾値未満=クリック扱い、何もしない
	const hit = deckDataAt(ev.clientX, ev.clientY);
	if (state.kind === 'tab' && state.src) {
		const src = state.src;
		if (hit.tabId) {
			// タブの上 → 同frameなら並び替え、別frameなら束ね
			// ドロップ先タブのframe/slotを特定
			const destSlotId = hit.slotId!, destFrameId = hit.frameId!;
			if (src.slotId === destSlotId && src.frameId === destFrameId) {
				reorderTab(src.slotId, src.frameId, src.tabId, hit.tabId);
			} else {
				moveTab(src, { kind: 'frame', slotId: destSlotId, frameId: destFrameId });
			}
		} else if (hit.stackSlotId) {
			moveTab(src, { kind: 'newFrameInSlot', slotId: hit.stackSlotId });
		} else if (hit.newSlot) {
			moveTab(src, { kind: 'newSlot' });
		} else if (hit.frameId) {
			moveTab(src, { kind: 'frame', slotId: hit.slotId!, frameId: hit.frameId });
		}
	} else if (state.kind === 'slot' && state.slotId) {
		if (hit.slotId && hit.slotId !== state.slotId) {
			const from = slots.value.findIndex(s => s.id === state.slotId);
			const to = slots.value.findIndex(s => s.id === hit.slotId);
			if (from >= 0 && to >= 0 && from !== to) {
				const next = [...slots.value];
				const [m] = next.splice(from, 1);
				next.splice(to, 0, m);
				commitSlots(next);
			}
		}
	}
	clearDragState();
}

// タブバーの横スクロール: 縦ホイールを横スクロールに変換し、隠れたタブを出せるように。
// 旗鯖fork(#21): タブバー上のホイール。
//   - タブが横スクロール可能で、その方向にまだ動かせる → タブを横スクロール。
//   - タブが収まりきっている、またはタブを端までスクロールし切った → デッキ(ページ)全体を左右スクロール。
function onTabsWheel(ev: WheelEvent) {
	const el = ev.currentTarget as HTMLElement;
	const delta = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
	if (delta === 0) return;

	// まずタブ自身を横スクロールできるか試す。
	const canScrollTabs = el.scrollWidth > el.clientWidth + 1;
	if (canScrollTabs) {
		const atStart = el.scrollLeft <= 0;
		const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
		const overscroll = (delta < 0 && atStart) || (delta > 0 && atEnd);
		if (!overscroll) {
			ev.preventDefault();
			ev.stopPropagation();
			el.scrollLeft += delta;
			return;
		}
		// 端まで来ている → 下のデッキ横スクロールへ委譲する(フォールスルー)。
	}

	// タブが収まりきっている or タブを端までスクロールし切った → デッキ全体を左右スクロール。
	const row = el.closest('[data-deck-row]') as HTMLElement | null;
	if (row && row.scrollWidth > row.clientWidth + 1) {
		ev.preventDefault();
		ev.stopPropagation();
		row.scrollLeft += delta;
	}
}

// 旗鯖fork(#3): 横並びデッキで、カラム本体(縦スクロール可能領域)の外=カラム間の余白や
// チャンネル(タブバー等)上で縦ホイールしたとき、ページ全体が縦スクロールしてしまうのを防ぐ。
// カラム内の縦スクロールは温存し、それ以外では縦ホイールをデッキの横スクロールに変換する。
function onDeckRowWheel(ev: WheelEvent) {
	if (ev.deltaY === 0) return;
	const row = ev.currentTarget as HTMLElement;
	// ホイール位置の直下から row までの間に縦スクロール可能な領域(=カラム本体)があるか調べる。
	let el = ev.target as HTMLElement | null;
	while (el && el !== row) {
		const oy = window.getComputedStyle(el).overflowY;
		// カラム本体(縦スクロールコンテナ)に入っているかを判定する。
		// スクロールバーが出ていない(scrollHeight <= clientHeight)カラムでも、ここで止めないと
		// 縦ホイールが横スクロール変換に落ちてページが横に動いてしまうため、スクロール可否に関わらず捕捉する。
		if (oy === 'auto' || oy === 'scroll') {
			if (el.scrollHeight > el.clientHeight) {
				const atTop = el.scrollTop <= 0;
				const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
				// カラムがホイール方向へまだスクロールできる → ネイティブの縦スクロールに任せる。
				if (!((ev.deltaY < 0 && atTop) || (ev.deltaY > 0 && atBottom))) return;
			}
			// スクロールできない or 端まで来ている → ページ(横含む)へ伝播させないようにだけ止める。
			// 横スクロールには変換しない(カラム内の縦ホイールで横に動かさない)。
			ev.preventDefault();
			return;
		}
		el = el.parentElement;
	}
	// カラム外(カラム間の余白など)で縦ホイール → ページ伝播を止め、横スクロールに変換する。
	ev.preventDefault();
	if (row.scrollWidth > row.clientWidth) row.scrollLeft += ev.deltaY;
}

function reorderTab(slotId: string, frameId: string, srcTabId: string, targetTabId: string) {
	if (srcTabId === targetTabId) return;
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => {
		if (f.id !== frameId) return f;
		const tabs = [...f.tabs];
		const fromIdx = tabs.findIndex(t => t.id === srcTabId);
		const toIdx = tabs.findIndex(t => t.id === targetTabId);
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return f;
		const [m] = tabs.splice(fromIdx, 1);
		tabs.splice(toIdx, 0, m);
		return { ...f, tabs };
	}) }));
}

// ===== タブの色 =====
function setTabColor(slotId: string, frameId: string, tabId: string, color: string | null) {
	mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, tabs: f.tabs.map(t => t.id !== tabId ? t : { ...t, tabColor: color }) }) }));
}
async function setTabColorCustom(slotId: string, frameId: string, tabId: string) {
	const loc = findFrame(slotId, frameId); if (!loc) return;
	const tab = slots.value[loc.s].frames[loc.f].tabs.find(t => t.id === tabId);
	const { canceled, result } = await os.inputText({ title: copy.tabColorCode, placeholder: '#ff6699', default: tab?.tabColor ?? '' });
	if (canceled) return;
	setTabColor(slotId, frameId, tabId, (result && result.trim() !== '') ? result.trim() : null);
}
function tabStyle(tab: DeckTab, active: boolean): Record<string, string> {
	if (!tab.tabColor) return {};
	// タブ部分の色: アクティブ時は背景、非アクティブ時は下線アクセント
	return active
		? { background: tab.tabColor, color: '#fff', borderColor: tab.tabColor }
		: { boxShadow: `inset 0 -3px 0 ${tab.tabColor}` };
}

// タブ管理メニュー(タブが複数ある時、frameごとに出す)
function openTabManageMenu(slot: DeckSlot, frame: DeckFrame, ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	const items: any[] = [{ type: 'label' as const, text: copy.manageTabs }];
	for (const tab of frame.tabs) {
		items.push({
			type: 'parent' as const,
			text: tabTitle(tab),
			icon: tabIcon(tab),
			children: [
				{ text: copy.rename, icon: 'ti ti-forms', action: () => renameTab(slot.id, frame.id, tab.id) },
				{
					type: 'parent' as const, text: copy.tabColor, icon: 'ti ti-palette',
					children: [
						...BORDER_PALETTE.map(c => ({ text: c.name, icon: 'ti ti-circle-filled', action: () => setTabColor(slot.id, frame.id, tab.id, c.value) })),
						{ type: 'divider' as const },
						{ text: copy.customColor, icon: 'ti ti-pencil', action: () => setTabColorCustom(slot.id, frame.id, tab.id) },
						{ text: copy.clearColor, icon: 'ti ti-circle-off', action: () => setTabColor(slot.id, frame.id, tab.id, null) },
					],
				},
				...(frame.tabs.length > 1 ? [{ text: copy.deleteThisTab, icon: 'ti ti-trash', danger: true, action: () => removeTab(slot.id, frame.id, tab.id) }] : []),
			],
		});
	}
	os.popupMenu(items, anchor);
}


function moveTab(src: DragSrc, dest: { kind: 'frame'; slotId: string; frameId: string } | { kind: 'newFrameInSlot'; slotId: string } | { kind: 'newSlot' }) {
	mapSlots(ss => {
		// 1) src tab を取り出す
		let moved: DeckTab | null = null;
		let work = ss.map(s => ({
			...s,
			frames: s.frames.map(f => {
				if (s.id === src.slotId && f.id === src.frameId) {
					const t = f.tabs.find(t => t.id === src.tabId) ?? null;
					if (t) moved = t;
					const tabs = f.tabs.filter(t => t.id !== src.tabId);
					const activeTab = f.activeTab === src.tabId ? tabs[0]?.id : f.activeTab;
					return { ...f, tabs, activeTab };
				}
				return f;
			}),
		}));
		if (!moved) return ss;
		// 2) dest へ挿入
		if (dest.kind === 'frame') {
			work = work.map(s => s.id !== dest.slotId ? s : { ...s, frames: s.frames.map(f => f.id !== dest.frameId ? f : { ...f, tabs: [...f.tabs, moved!], activeTab: moved!.id }) });
		} else if (dest.kind === 'newFrameInSlot') {
			work = work.map(s => s.id !== dest.slotId ? s : { ...s, frames: [...s.frames, newFrameFromTab(moved!)] });
		} else {
			work = [...work, newSlotFromTab(moved!)];
		}
		// 3) 空frame/空slotを掃除
		return work.map(s => ({ ...s, frames: s.frames.filter(f => f.tabs.length > 0) })).filter(s => s.frames.length > 0);
	});
}



// ===== カラム追加メニュー(末尾に新slot) =====
async function pickListId(anchor: HTMLElement, then: (id: string, name: string) => void) {
	const lists = await misskeyApi('users/lists/list', {});
	if (!Array.isArray(lists) || lists.length === 0) { os.alert({ type: 'info', text: copy.noLists }); return; }
	const { canceled, result } = await os.select({ title: copy.selectList, items: lists.map((l: any) => ({ value: l.id, label: l.name })) });
	if (canceled || result == null) return;
	const picked = lists.find((l: any) => l.id === result);
	then(result as string, picked?.name ?? copy.fallbackListName);
}
async function pickAntennaId(anchor: HTMLElement, then: (id: string, name: string) => void) {
	const antennas = await misskeyApi('antennas/list', {});
	if (!Array.isArray(antennas) || antennas.length === 0) { os.alert({ type: 'info', text: copy.noAntennas }); return; }
	const { canceled, result } = await os.select({ title: copy.selectAntenna, items: antennas.map((a: any) => ({ value: a.id, label: a.name })) });
	if (canceled || result == null) return;
	const picked = antennas.find((a: any) => a.id === result);
	then(result as string, picked?.name ?? copy.fallbackAntennaName);
}
async function pickChannelId(anchor: HTMLElement, then: (id: string, name: string) => void) {
	const channels = await misskeyApi('channels/followed', { limit: 100 });
	if (!Array.isArray(channels) || channels.length === 0) { os.alert({ type: 'info', text: copy.noFollowedChannels }); return; }
	const { canceled, result } = await os.select({ title: copy.selectChannel, items: channels.map((c: any) => ({ value: c.id, label: c.name })) });
	if (canceled || result == null) return;
	const picked = channels.find((c: any) => c.id === result);
	then(result as string, picked?.name ?? copy.fallbackChannelName);
}
// 旗鯖fork(新デッキ): クリップ選択。自分のクリップ一覧 (clips/list) から選ばせる。
async function pickClipId(anchor: HTMLElement, then: (id: string, name: string) => void) {
	const clips = await misskeyApi('clips/list', {});
	if (!Array.isArray(clips) || clips.length === 0) { os.alert({ type: 'info', text: copy.noClips }); return; }
	const { canceled, result } = await os.select({ title: copy.selectClip, items: clips.map((c: any) => ({ value: c.id, label: c.name })) });
	if (canceled || result == null) return;
	const picked = clips.find((c: any) => c.id === result);
	then(result as string, picked?.name ?? copy.fallbackClipName);
}

// 種別選択メニューを作る共通関数。onPick(partial) でカラムを確定。
function columnTypeMenu(anchor: HTMLElement, onPick: (partial: Partial<DeckTab> & { type: ColumnType }) => void) {
	return [
		{ text: COLUMN_META.home.title, icon: 'ti ti-home', action: () => onPick({ type: 'home' }) },
		...(isHataskeyTimelineAllowed('local') ? [{ text: COLUMN_META.local.title, icon: 'ti ti-planet', action: () => onPick({ type: 'local' as const }) }] : []),
		...(isHataskeyTimelineAllowed('social') ? [{ text: COLUMN_META.social.title, icon: 'ti ti-universe', action: () => onPick({ type: 'social' as const }) }] : []),
		...(isHataskeyTimelineAllowed('global') ? [{ text: COLUMN_META.global.title, icon: 'ti ti-world', action: () => onPick({ type: 'global' as const }) }] : []),
		{ text: COLUMN_META.trending.title, icon: 'ti ti-chart-line', action: () => onPick({ type: 'trending' }) },
		{ type: 'divider' as const },
		{ text: COLUMN_META.mentions.title, icon: 'ti ti-at', action: () => onPick({ type: 'mentions' }) },
		{ text: COLUMN_META.directs.title, icon: 'ti ti-mail', action: () => onPick({ type: 'directs' }) },
		{ type: 'divider' as const },
		{ text: COLUMN_META.list.title, icon: 'ti ti-list', action: () => pickListId(anchor, (id, name) => onPick({ type: 'list', sourceId: id, name })) },
		{ text: COLUMN_META.antenna.title, icon: 'ti ti-antenna', action: () => pickAntennaId(anchor, (id, name) => onPick({ type: 'antenna', sourceId: id, name })) },
		{ text: COLUMN_META.channel.title, icon: 'ti ti-device-tv', action: () => pickChannelId(anchor, (id, name) => onPick({ type: 'channel', sourceId: id, name })) },
		{ text: COLUMN_META.clip.title, icon: 'ti ti-paperclip', action: () => pickClipId(anchor, (id, name) => onPick({ type: 'clip', sourceId: id, name })) },
		{ text: COLUMN_META.favorites.title, icon: 'ti ti-star', action: () => onPick({ type: 'favorites' }) },
		{ type: 'divider' as const },
		{ text: COLUMN_META.notifications.title, icon: 'ti ti-bell', action: () => onPick({ type: 'notifications' }) },
		{ text: COLUMN_META.widgets.title, icon: 'ti ti-apps', action: () => onPick({ type: 'widgets' }) },
		{ text: COLUMN_META.postForm.title, icon: 'ti ti-pencil-plus', action: () => onPick({ type: 'postForm' }) },
	];
}
async function addColumn(ev: MouseEvent) {
	// os.popupMenu はアンカー基準で、横スクロールコンテナ内の右端ボタンだと
	// 位置計算が崩れてメニューが見切れる(1行しか出ない)。標準deckと同じく
	// os.select(中央ダイアログ)で種別を選ばせる。見切れず項目も多くても安全。
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	const items = [
		{ value: 'home', label: COLUMN_META.home.title },
		{ value: 'local', label: COLUMN_META.local.title },
		{ value: 'social', label: COLUMN_META.social.title },
		{ value: 'global', label: COLUMN_META.global.title },
		{ value: 'trending', label: COLUMN_META.trending.title },
		{ value: 'mentions', label: COLUMN_META.mentions.title },
		{ value: 'directs', label: COLUMN_META.directs.title },
		{ value: 'list', label: COLUMN_META.list.title },
		{ value: 'antenna', label: COLUMN_META.antenna.title },
		{ value: 'channel', label: COLUMN_META.channel.title },
		{ value: 'clip', label: COLUMN_META.clip.title },
		{ value: 'favorites', label: COLUMN_META.favorites.title },
		{ value: 'notifications', label: COLUMN_META.notifications.title },
		{ value: 'widgets', label: COLUMN_META.widgets.title },
		{ value: 'postForm', label: COLUMN_META.postForm.title },
	];
	const { canceled, result } = await os.select({ title: copy.addColumn, items: items.filter(item => isHataskeyTimelineAllowed(item.value)) });
	if (canceled || result == null) return;
	const type = result as ColumnType;
	// ID選択が要る種別は二段で選ぶ
	if (type === 'list') { pickListId(anchor, (id, name) => addSlotWithTab({ type: 'list', sourceId: id, name })); return; }
	if (type === 'antenna') { pickAntennaId(anchor, (id, name) => addSlotWithTab({ type: 'antenna', sourceId: id, name })); return; }
	if (type === 'channel') { pickChannelId(anchor, (id, name) => addSlotWithTab({ type: 'channel', sourceId: id, name })); return; }
	// 旗鯖fork(新デッキ): クリップは clip 選択が要る (二段)。お気に入りは一発追加。
	if (type === 'clip') { pickClipId(anchor, (id, name) => addSlotWithTab({ type: 'clip', sourceId: id, name })); return; }
	addSlotWithTab({ type });
}

const BORDER_PALETTE: { name: string; value: string }[] = [
	{ name: copy.colorRed, value: '#e0566f' }, { name: copy.colorOrange, value: '#e08a3c' }, { name: copy.colorYellow, value: '#d8b13a' },
	{ name: copy.colorGreen, value: '#4caf7d' }, { name: copy.colorBlue, value: '#4a9eff' }, { name: copy.colorPurple, value: '#9b6dde' }, { name: copy.colorPink, value: '#e06699' },
];
async function setFrameBorderCustom(slotId: string, frameId: string) {
	const loc = findFrame(slotId, frameId); if (!loc) return;
	const cur = slots.value[loc.s].frames[loc.f].borderColor ?? '';
	const { canceled, result } = await os.inputText({ title: copy.borderColorCode, placeholder: '#ff6699', default: cur });
	if (canceled) return;
	setFrameBorderColor(slotId, frameId, (result && result.trim() !== '') ? result.trim() : null);
}

// 旗鯖fork(#8): 通知カラムの通知フィルタ。通知ページと同じ MkNotificationSelectWindow で
// タイプ別の表示/非表示(excludeTypes)を選び、そのタブに保存して即時反映する。
async function openNotificationFilter(slotId: string, frameId: string, tab: DeckTab) {
	const initialFilter = deepClone({
		excludeTypes: tab.excludeTypes,
		knownTypes: tab.notificationFilterKnownTypes,
		excludeBots: tab.excludeBots,
	});
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkNotificationSelectWindow.vue').then(x => x.default), initialFilter, {
		done: (res: { excludeTypes: string[]; knownTypes: string[]; excludeBots: boolean }) => {
			// excludeTypes を更新すると columnProps 経由でプロップが変わり、
			// MkStreamingNotificationsTimeline 側の computedParams ウォッチャが自動で再読み込みする。
			mapSlots(ss => ss.map(s => s.id !== slotId ? s : { ...s, frames: s.frames.map(f => f.id !== frameId ? f : { ...f, tabs: f.tabs.map(t => {
				if (t.id !== tab.id) return t;
				return {
					...t,
					...(!deepEqual(res.excludeTypes, initialFilter.excludeTypes) ? { excludeTypes: res.excludeTypes } : {}),
					...(!deepEqual(res.knownTypes, initialFilter.knownTypes) ? { notificationFilterKnownTypes: res.knownTypes } : {}),
					...(res.excludeBots !== initialFilter.excludeBots ? { excludeBots: res.excludeBots } : {}),
				};
			}) }) }));
		},
		closed: () => dispose(),
	});
}

// ===== frame メニュー(箱単位の操作) =====
function openFrameMenu(slot: DeckSlot, frame: DeckFrame, ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	const active = activeTabOf(frame);
	const renoteItem = supportsRenoteToggle(active) ? [
		{ type: 'switch' as const, text: copy.showRenotes, ref: computed({ get: () => active.withRenotes !== false, set: (v: boolean) => {
			mapSlots(ss => ss.map(s => s.id !== slot.id ? s : { ...s, frames: s.frames.map(f => f.id !== frame.id ? f : { ...f, tabs: f.tabs.map(t => t.id !== active.id ? t : { ...t, withRenotes: v }) }) }));
		} }) },
		{ type: 'divider' as const },
	] : [];
	// 通知タブのときは再読み込み項目を出す
	const reloadItem = (active.type === 'notifications') ? [
		{ text: copy.reload, icon: 'ti ti-refresh', action: () => { globalEvents.emit('reloadNotification'); } },
		{ type: 'divider' as const },
	] : [];
	// 通知タブのときは、通知ページと同様の通知フィルタ(タイプ別の表示/非表示)を出す
	const notifFilterItem = (active.type === 'notifications') ? [
		{ text: copy.notificationFilter, icon: 'ti ti-filter', action: () => openNotificationFilter(slot.id, frame.id, active) },
		{ type: 'divider' as const },
	] : [];
	// 旗鯖fork(新デッキ): ウィジェットタブのときは「ウィジェットを編集」をこのメニューに出す。
	// 常時表示ボタンを廃止して表示領域を最大化した代わりの編集導線 (通知フィルタと同パターン)。
	const widgetEditItem = (active.type === 'widgets') ? [
		{
			text: (colRefs.get(active.id)?.getWidgetEditMode?.() ? copy.finishEditingWidgets : copy.editWidgets),
			icon: (colRefs.get(active.id)?.getWidgetEditMode?.() ? 'ti ti-check' : 'ti ti-pencil'),
			action: () => { colRefs.get(active.id)?.toggleWidgetEditMode?.(); },
		},
		{ type: 'divider' as const },
	] : [];
	// 旗鯖fork(新デッキ): チャンネルカラムの「このチャンネルへ投稿」メニュー項目。
	//   default では「新設のノートリスト最上部固定ボタン」に導線を統一するため非表示。
	//   従来 UI を望むユーザーは hata-custom.vue → ビジュアル → 従来のチャンネル投稿ボタンを表示する ON で復活。
	const channelPostItem = (showLegacyChannelPostButton.value && active.type === 'channel' && active.sourceId) ? [
		{ text: copy.postToThisChannel, icon: 'ti ti-pencil-plus', action: () => postToChannel(active.sourceId!) },
		{ type: 'divider' as const },
	] : [];
	// 旗鯖fork(新デッキ): お気に入り/クリップカラムのリロードメニュー項目。
	const paginatedReloadItem = (active.type === 'clip' || active.type === 'favorites') ? [
		{ text: copy.reload, icon: 'ti ti-refresh', action: () => reloadPaginated(active.id) },
		{ type: 'divider' as const },
	] : [];
	const colorItem = {
		type: 'parent' as const, text: copy.borderColor, icon: 'ti ti-palette',
		children: [
			...BORDER_PALETTE.map(c => ({ text: c.name, icon: 'ti ti-circle-filled', action: () => setFrameBorderColor(slot.id, frame.id, c.value) })),
			{ type: 'divider' as const },
			{ text: copy.customColor, icon: 'ti ti-pencil', action: () => setFrameBorderCustom(slot.id, frame.id) },
			{ text: copy.clearBorderColor, icon: 'ti ti-circle-off', action: () => setFrameBorderColor(slot.id, frame.id, null) },
		],
	};
	// タブの色(タブが1つでも変えられるよう、フレームメニューからアクティブタブの色を設定可能にする)
	const tabColorItem = {
		type: 'parent' as const, text: copy.tabColor, icon: 'ti ti-color-swatch',
		children: [
			...BORDER_PALETTE.map(c => ({ text: c.name, icon: active.tabColor === c.value ? 'ti ti-check' : 'ti ti-circle-filled', action: () => setTabColor(slot.id, frame.id, active.id, c.value) })),
			{ type: 'divider' as const },
			{ text: copy.customColor, icon: 'ti ti-pencil', action: () => setTabColorCustom(slot.id, frame.id, active.id) },
			{ text: copy.clearColor, icon: 'ti ti-circle-off', action: () => setTabColor(slot.id, frame.id, active.id, null) },
		],
	};
	// 横並びレイアウトで縦積み(この列にframeが2つ以上)のとき、箱の高さを設定できる
	const heightItem = (layout.value === 'row' && slot.frames.length > 1) ? [{
		type: 'parent' as const, text: copy.height, icon: 'ti ti-arrows-vertical',
		children: [
			{ text: copy.heightAuto, icon: !frame.height ? 'ti ti-check' : 'ti ti-arrows-vertical', action: () => setFrameHeight(slot.id, frame.id, null) },
			{ text: copy.heightCompact260, icon: frame.height === 260 ? 'ti ti-check' : 'ti ti-fold', action: () => setFrameHeight(slot.id, frame.id, 260) },
			{ text: copy.heightStandard360, icon: frame.height === 360 ? 'ti ti-check' : 'ti ti-arrows-vertical', action: () => setFrameHeight(slot.id, frame.id, 360) },
			{ text: copy.heightRoomy500, icon: frame.height === 500 ? 'ti ti-check' : 'ti ti-arrows-maximize', action: () => setFrameHeight(slot.id, frame.id, 500) },
		],
	}] : [];
	os.popupMenu([
		{ type: 'label' as const, text: tabTitle(active) },
		...channelPostItem,
		...paginatedReloadItem,
		...reloadItem,
		...notifFilterItem,
		...widgetEditItem,
		...renoteItem,
		{ text: copy.renameTab, icon: 'ti ti-forms', action: () => renameTab(slot.id, frame.id, active.id) },
		{ text: copy.addColumnAsTab, icon: 'ti ti-plus', action: () => os.popupMenu(columnTypeMenu(anchor, p => addTabToFrame(slot.id, frame.id, p)), anchor) },
		...heightItem,
		colorItem,
		...(frame.tabs.length === 1 ? [tabColorItem] : []),
		{ type: 'divider' as const },
		{ text: copy.resetColumnSize, icon: 'ti ti-arrow-back-up', action: () => resetSlotSize(slot.id) },
		{ text: copy.deleteThisFrame, icon: 'ti ti-trash', danger: true, action: () => removeFrame(slot.id, frame.id) },
	], anchor);
}
// タブ自体の右クリック/長押し相当(タブ単体メニュー)
function openTabMenu(slot: DeckSlot, frame: DeckFrame, tab: DeckTab, ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	// 旗鯖fork(新デッキ): ウィジェットタブを右クリックした時は先頭に「ウィジェットを編集」を出す。
	const widgetEditTabItem = (tab.type === 'widgets') ? [
		{
			text: (colRefs.get(tab.id)?.getWidgetEditMode?.() ? copy.finishEditingWidgets : copy.editWidgets),
			icon: (colRefs.get(tab.id)?.getWidgetEditMode?.() ? 'ti ti-check' : 'ti ti-pencil'),
			action: () => { colRefs.get(tab.id)?.toggleWidgetEditMode?.(); },
		},
		{ type: 'divider' as const },
	] : [];
	os.popupMenu([
		...widgetEditTabItem,
		{ text: copy.renameTab, icon: 'ti ti-forms', action: () => renameTab(slot.id, frame.id, tab.id) },
		...(frame.tabs.length === 1 ? [{
			type: 'parent' as const, text: copy.tabColor, icon: 'ti ti-palette',
			children: [
				...BORDER_PALETTE.map(c => ({ text: c.name, icon: tab.tabColor === c.value ? 'ti ti-check' : 'ti ti-circle-filled', action: () => setTabColor(slot.id, frame.id, tab.id, c.value) })),
				{ type: 'divider' as const },
				{ text: copy.customColor, icon: 'ti ti-pencil', action: () => setTabColorCustom(slot.id, frame.id, tab.id) },
				{ text: copy.clearColor, icon: 'ti ti-circle-off', action: () => setTabColor(slot.id, frame.id, tab.id, null) },
			],
		}] : []),
		...(frame.tabs.length > 1 ? [{ text: copy.detachThisTab, icon: 'ti ti-trash', danger: true, action: () => removeTab(slot.id, frame.id, tab.id) }] : []),
	], anchor);
}

// ===== slot メニュー(列/セル/段の操作) =====
function openSlotMenu(slot: DeckSlot, ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	const l = layout.value;
	const sizeItems = l === 'row' ? [
		{ text: copy.widthNarrow, icon: 'ti ti-arrows-diff', action: () => setSlotWidth(slot.id, 300) },
		{ text: copy.widthStandard, icon: 'ti ti-arrows-horizontal', action: () => setSlotWidth(slot.id, 380) },
		{ text: copy.widthWide, icon: 'ti ti-arrows-maximize', action: () => setSlotWidth(slot.id, 460) },
		// 旗鯖fork(#10): カラム幅(横幅)をpxで数値指定する。
		{ text: copyx.widthCustomCurrent({ width: slot.width.toString() }), icon: 'ti ti-ruler-measure', action: async () => {
			const { canceled, result } = await os.inputNumber({ title: copy.columnWidthPx, text: copy.columnWidthRange, default: slot.width });
			if (canceled || result == null) return;
			setSlotWidth(slot.id, Math.round(Math.max(200, Math.min(1200, result))));
		} },
		{ type: 'divider' as const },
	] : l === 'stack' ? [
		{ text: copy.slotHeightCompact, icon: 'ti ti-fold', action: () => setSlotHeight(slot.id, 340) },
		{ text: copy.slotHeightStandard, icon: 'ti ti-arrows-vertical', action: () => setSlotHeight(slot.id, 460) },
		{ text: copy.slotHeightRoomy, icon: 'ti ti-arrows-maximize', action: () => setSlotHeight(slot.id, 640) },
		{ type: 'divider' as const },
	] : [];
	const span = currentFullSpan(slot);
	const fullItem = (l === 'grid2' || l === 'grid3') ? [{
		type: 'parent' as const, text: copy.fullSpan,
		icon: span === 'col' ? 'ti ti-arrows-horizontal' : span === 'row' ? 'ti ti-arrows-vertical' : 'ti ti-square',
		children: [
			{ text: copy.none, icon: span === 'none' ? 'ti ti-check' : 'ti ti-square', action: () => setSlotFullSpan(slot.id, 'none') },
			{ text: copy.spanAcrossColumns, icon: span === 'col' ? 'ti ti-check' : 'ti ti-arrows-horizontal', action: () => setSlotFullSpan(slot.id, 'col') },
			{ text: copy.spanAcrossRows, icon: span === 'row' ? 'ti ti-check' : 'ti ti-arrows-vertical', action: () => setSlotFullSpan(slot.id, 'row') },
		],
	}] : [];
	const backLabel = l === 'stack' ? copy.moveUp : (l === 'row' ? copy.moveLeft : copy.moveEarlier);
	const fwdLabel = l === 'stack' ? copy.moveDown : (l === 'row' ? copy.moveRight : copy.moveLater);
	os.popupMenu([
		...sizeItems,
		...fullItem,
		{ text: copy.addStackedToColumn, icon: 'ti ti-rows', action: () => os.popupMenu(columnTypeMenu(anchor, p => addFrameToSlot(slot.id, p)), anchor) },
		{ type: 'divider' as const },
		{ text: backLabel, icon: l === 'stack' ? 'ti ti-arrow-up' : 'ti ti-arrow-left', action: () => moveSlot(slot.id, -1) },
		{ text: fwdLabel, icon: l === 'stack' ? 'ti ti-arrow-down' : 'ti ti-arrow-right', action: () => moveSlot(slot.id, 1) },
		{ type: 'divider' as const },
		{ text: copy.deleteThisColumn, icon: 'ti ti-trash', danger: true, action: () => removeSlot(slot.id) },
	], anchor);
}

// ===== プロファイル =====
function switchProfile(id: string) { prefer.commit('simpleUi.deckActiveProfileV2', id); }
function defaultSlots(): DeckSlot[] {
	return [
		newSlotFromTab(newTab({ type: 'local' })),
		newSlotFromTab(newTab({ type: 'home' })),
		newSlotFromTab(newTab({ type: 'notifications' })),
	];
}
async function createProfile() {
	const { canceled, result } = await os.inputText({ title: copy.profileName, placeholder: copy.profileNameExample });
	if (canceled || !result) return;
	const id = genId('prof');
	commitProfiles([...profiles.value, { id, name: result, layout: 'row', slots: defaultSlots() }]);
	prefer.commit('simpleUi.deckActiveProfileV2', id);
}
async function duplicateProfile() {
	const src = activeProfile.value;
	const id = genId('prof');
	const clonedSlots: DeckSlot[] = src.slots.map(s => ({ ...s, id: genId('slot'), frames: s.frames.map(f => ({ ...f, id: genId('frame'), tabs: f.tabs.map(t => ({ ...t, id: genId('tab') })) })) }));
	commitProfiles([...profiles.value, { id, name: copy.copiedProfileName.replace('{name}', src.name), layout: src.layout, slots: clonedSlots }]);
	prefer.commit('simpleUi.deckActiveProfileV2', id);
}
async function renameProfile() {
	const currentDisplayName = displayProfileName(activeProfile.value);
	const { canceled, result } = await os.inputText({ title: copy.renameProfile, default: currentDisplayName });
	if (canceled || !result) return;
	const nextName = activeProfile.value.id === 'default' && activeProfile.value.name === LEGACY_DEFAULT_PROFILE_NAME && result === currentDisplayName
		? LEGACY_DEFAULT_PROFILE_NAME
		: result;
	commitActiveProfile(p => ({ ...p, name: nextName }));
}
async function resetProfile() {
	const { canceled } = await os.confirm({ type: 'warning', text: copyx.resetProfileConfirm({ name: displayProfileName(activeProfile.value) }) });
	if (canceled) return;
	commitActiveProfile(p => ({ ...p, layout: 'row', slots: defaultSlots() }));
}
async function deleteProfile() {
	if (profiles.value.length <= 1) { os.alert({ type: 'warning', text: copy.cannotDeleteLastProfile }); return; }
	const { canceled } = await os.confirm({ type: 'warning', text: copyx.deleteProfileConfirm({ name: displayProfileName(activeProfile.value) }) });
	if (canceled) return;
	const remaining = profiles.value.filter(p => p.id !== activeProfileId.value);
	commitProfiles(remaining);
	prefer.commit('simpleUi.deckActiveProfileV2', remaining[0].id);
}
function openProfileMenu(ev: MouseEvent) {
	const anchor = (ev.currentTarget ?? ev.target) as HTMLElement;
	os.popupMenu([
		{ type: 'label' as const, text: copy.switchProfile },
		...profiles.value.map(p => ({ text: displayProfileName(p), icon: p.id === activeProfileId.value ? 'ti ti-check' : 'ti ti-layout-board', action: () => switchProfile(p.id) })),
		{ type: 'divider' as const },
		{ text: copy.newProfile, icon: 'ti ti-plus', action: () => createProfile() },
		{ text: copy.duplicate, icon: 'ti ti-copy', action: () => duplicateProfile() },
		{ text: copy.rename, icon: 'ti ti-pencil', action: () => renameProfile() },
		{ type: 'divider' as const },
		{ text: copy.resetLayout, icon: 'ti ti-refresh-dot', action: () => resetProfile() },
		{ text: copy.delete, icon: 'ti ti-trash', danger: true, action: () => deleteProfile() },
	], anchor);
}

// チャンク3: template / チャンク4: style + 検証
</script>

<style lang="scss" module>
.deckWrap { display: flex; height: 100%; }
/* ツールバー位置: 上(デフォルト)/下/右。レイアウト方向で配置を変える */
.deckWrapTop { flex-direction: column; }
.deckWrapBottom { flex-direction: column-reverse; }
.deckWrapRight { flex-direction: row-reverse; }
/* 右配置時はツールバーを縦長の細い帯にする */
.deckWrapRight .toolbarBar { flex-direction: column; width: auto; height: 100%; padding: 6px 6px 6px 0; align-items: stretch; }
.deckWrapRight .toolbarInner { flex-direction: column; align-items: stretch; }
.deckWrapRight .layoutPill { flex-direction: column; }
.deckWrapRight .toolbarSpacer { flex: 1; }
/* 右配置時: 各ボタンをアイコンサイズの正方形に揃える(横長ピルが縦に並ぶ不格好を解消) */
.deckWrapRight .profileBtn { justify-content: center; width: 30px; height: 30px; padding: 0; gap: 0; align-self: center; }
.deckWrapRight .iconBtn,
.deckWrapRight .toolbarToggle { align-self: center; }
.deckWrapRight .layoutPill { align-self: center; }
.deckWrapBottom .toolbarBar { padding: 0 14px 8px; }

/* 折り畳みツールバー */
.toolbarBar { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 5px 12px 0; }
.toolbarToggle {
	flex-shrink: 0; width: 30px; height: 26px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px;
	background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; transition: background .15s, color .15s;
	&:hover { background: color-mix(in srgb, var(--MI_THEME-accent) 10%, var(--MI_THEME-panel)); }
}
.toolbarToggleOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); border-color: transparent; }
.toolbarInner { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
/* 旗鯖fork: 上部ナビバーモード&上部ツールバーの時は中央揃え。
   RSSティッカー等のflex:1要素が余白を食うと中央揃えが効かないため、
   中央揃え時は伸長を止めて自然幅にし、全体を中央に寄せる。 */
.layoutPill { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: color-mix(in srgb, var(--MI_THEME-accent) 8%, transparent); }
.layoutBtn { width: 32px; height: 24px; border: none; border-radius: 999px; background: none; color: var(--MI_THEME-fg); opacity: .55; cursor: pointer; transition: background .15s, opacity .15s; &:hover { opacity: .85; } }
.layoutBtnOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); opacity: 1; &:hover { opacity: 1; } }
.profileBtn { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); font-weight: 700; font-size: .82em; cursor: pointer; transition: background .15s; &:hover { background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)); } }
.profileName { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profileChevron { font-size: .85em; opacity: .6; }
.toolbarSpacer { flex: 1; }
.iconBtn { flex-shrink: 0; width: 30px; height: 26px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; transition: background .15s, color .15s; &:hover { background: color-mix(in srgb, var(--MI_THEME-accent) 10%, var(--MI_THEME-panel)); } }
.iconBtnOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); border-color: transparent; }
.clock { flex-shrink: 0; align-self: center; box-sizing: border-box; min-width: 15em; text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; font-size: .95em; color: var(--MI_THEME-accent); padding: 0 8px; letter-spacing: .02em; white-space: nowrap; }
.online { flex-shrink: 0; align-self: center; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: .82em; color: var(--MI_THEME-fg); padding: 0 8px; white-space: nowrap; }
.onlineDot { width: 8px; height: 8px; border-radius: 999px; background: #41b781; box-shadow: 0 0 6px #41b781; }

/* RSSティッカー: 画面幅に応じて最大5記事を横並び。各記事はフィード色のドット付き。 */
.rssTicker {
	flex: 1; min-width: 0; height: 30px; align-self: center; overflow: hidden;
	display: flex; align-items: center; position: relative;
}
.rssItems { position: absolute; inset: 0; display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; overflow: hidden; padding-right: 4px; }
.rssItem {
	display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 0;
	padding: 4px 10px; border-radius: 999px; text-decoration: none;
	background: color-mix(in srgb, var(--rssColor, var(--MI_THEME-accent)) 12%, transparent);
	color: var(--MI_THEME-fg); font-size: .8em; font-weight: 600; transition: background .15s;
	&:hover { background: color-mix(in srgb, var(--rssColor, var(--MI_THEME-accent)) 22%, transparent); }
}
/* 旗鯖fork: 先頭フィードだけ広め(flex-grow比のみで広げる。min-widthは増やさないので
   合計幅は変わらず、項目が途切れない)。 */
.rssItem:first-child { flex-grow: 4; }
/* 最初の項目は横広にして、見出し(ヘッド)が最低限読める長さを確保する */
/* 最後尾の項目は残り幅に合わせて縮める(min-widthを解除)。固定min-widthのままだと
   枠からはみ出して途中でちぎれて見えるため。残り幅で省略表示にする。 */
.rssItem:last-child { min-width: 0; }
/* 画面が狭い時は表示数を絞る(2番目以降を隠す) */
/* 画面が本当に狭い時だけ末尾項目を隠す(通常は flex で画面幅いっぱいまで伸ばす) */
@media (max-width: 700px) { .rssItem:nth-child(n+4) { display: none; } }
@media (max-width: 520px) { .rssItem:nth-child(n+3) { display: none; } }
.rssDot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 999px; background: var(--rssColor, var(--MI_THEME-accent)); }
.rssItemText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* RSSは個々の要素を動かさず、ティッカー全体(rssItemsグループ)をクロスフェードで差し替える。
   要素の出入りが無いので横並びでも周りが一切動かず、ガクつかない。 */
.rssFade {
	&:global(-enter-active), &:global(-leave-active) { transition: opacity .5s ease, transform .5s ease; }
	&:global(-enter-from) { opacity: 0; transform: translateY(40%); }
	&:global(-leave-to) { opacity: 0; transform: translateY(-40%); }
}

.deck { flex: 1; min-height: 0; padding: 14px; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent) transparent; }

/* レイアウト */
.layoutRow { display: flex; align-items: stretch; gap: 14px; overflow-x: auto; overflow-y: hidden; }
.layoutRow .slot { flex-shrink: 0; min-width: 280px; }
.layoutGrid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: calc(50% - 7px); grid-auto-flow: row dense; gap: 14px; overflow-y: auto; overflow-x: hidden; }
.layoutGrid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: calc(50% - 7px); grid-auto-flow: row dense; gap: 14px; overflow-y: auto; overflow-x: hidden; }
.slotGrid { min-height: 0; }
.slotFull { grid-column: 1 / -1; }
.slotFullV { grid-row: span 2; }
.layoutStack { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; overflow-x: hidden; }
.layoutStack .slot { width: 100%; flex-shrink: 0; }

/* slot = レイアウトの1マス。中に frames を縦積み */
.slot { position: relative; display: flex; flex-direction: column; min-height: 0; }
.slotStack { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
/* 縦積みframe間のリサイズハンドル。gap(10px)の領域に重ね、掴むと上下リサイズ。 */
.frameResizer {
	flex-shrink: 0; height: 10px; margin: -10px 0 0; position: relative; z-index: 3;
	cursor: ns-resize; touch-action: none; display: flex; align-items: center; justify-content: center;
}
.frameResizerBar {
	width: 48px; height: 4px; border-radius: 999px; background: var(--MI_THEME-divider); transition: background .12s, width .12s;
}
.frameResizer:hover .frameResizerBar { background: var(--MI_THEME-accent); width: 72px; }
/* 列設定FAB(右上に小さく) */
/* slotハンドル(タブバー左端。ドラッグで列移動 / クリックで列設定) */
.slotHandle {
	flex-shrink: 0; align-self: center; width: 24px; height: 28px; border: none; border-radius: 8px;
	background: transparent; color: var(--MI_THEME-fg); opacity: .4; cursor: grab; transition: opacity .15s, background .15s;
	&:hover { opacity: .9; background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent); 	touch-action: none;
}
	&:active { cursor: grabbing; }
}
/* slotドラッグ中の視覚 */
.slotDragging { opacity: .4; }
.slotDragOver { box-shadow: 0 0 0 2px var(--MI_THEME-accent); }

/* frame = 箱。tabsが複数ならタブ表示 */
.frameRoot {
	flex: 1; min-height: 0; display: flex; flex-direction: column;
	background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 14px;
	box-shadow: 0 2px 12px rgba(0, 0, 0, .06); overflow: hidden; transition: box-shadow .15s;
}
.frameColored { border-width: 2px; border-color: var(--deckColBorder, var(--MI_THEME-divider)); }
.frameDragOver { box-shadow: 0 0 0 2px var(--MI_THEME-accent); }

/* タブバー(ブラウザ風) */
.tabBar {
	flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 4px 8px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel));
	border-bottom: 1px solid var(--deckColBorder, var(--MI_THEME-divider));
	/* frameBody(position:relative)より手前に置く。これがないとDOM順で後の本体が
	   スタッキング上手前になり、タブの下部が本体に覆われて「上端の細い帯」しか掴めない。 */
	position: relative; z-index: 2;
}
.tabs { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
.tab {
	display: flex; align-items: center; gap: 6px; max-width: 180px; min-height: 32px; padding: 7px 12px; border: none; cursor: grab;
	background: transparent; color: var(--MI_THEME-fg); opacity: .6; font-size: .82em; font-weight: 700;
	border-radius: 10px 10px 0 0; border: 1px solid transparent; border-bottom: none; transition: background .2s, opacity .2s, max-width .3s cubic-bezier(.2,.8,.2,1), flex-grow .3s cubic-bezier(.2,.8,.2,1);
	user-select: none; -webkit-user-select: none;
	&:active { cursor: grabbing; }
	&:hover { opacity: .85; background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent); }
}
/* タブ内の子(アイコン/ラベル)もタブ本体と同様に掴める必要がある。
   pointer-events:none にすると、子の上でドラッグ開始できなくなる(下段ほど顕著)。
   テキスト選択がドラッグを阻害しないよう user-select:none だけ継承させる。 */
.tab > * { user-select: none; -webkit-user-select: none; }
/* タブのドラッグ専用ハンドル(::)。draggableはこのハンドルだけに付与し、
   タブ本体はクリック(切替)専任にする。これでドラッグとクリック/ドロップの競合が消え、
   縦積み下段でも確実に掴める。 */
.tabGrip {
	flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
	width: 16px; margin-right: 2px; cursor: grab; opacity: .5; font-size: .95em; touch-action: none;
	&:hover { opacity: 1; }
	&:active { cursor: grabbing; }
}
.tabActive {
	flex-grow: 1;
	max-width: 240px;
	opacity: 1; background: var(--MI_THEME-panel);
	border-color: var(--deckColBorder, var(--MI_THEME-divider));
	box-shadow: 0 -2px 6px rgba(0, 0, 0, .04);
}
.tabDragOver { box-shadow: inset 2px 0 0 var(--MI_THEME-accent); }
.tabIcon { flex-shrink: 0; color: var(--MI_THEME-accent); font-size: 1.05em; transition: transform .28s cubic-bezier(.2,.8,.2,1); }
.tabActive .tabIcon { transform: translateY(-1px) scale(1.08); }
.tabIconActiveColored { color: #fff !important; }
.tabLabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.frameHeadBtn, .frameMenuBtn, .frameTabsBtn {
	flex-shrink: 0; align-self: center; width: 28px; height: 28px; border-radius: 999px; color: var(--MI_THEME-fg); opacity: .7;
	&:hover { opacity: 1; background: color-mix(in srgb, var(--MI_THEME-accent) 14%, transparent); }
}

/* frame本体 */
.frameBody { flex: 1; min-height: 0; position: relative; z-index: 1; }
.tabPane { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent) transparent; }
.deckWrap[data-animation='true'] .tabPane[data-active='true'] { animation: deckPaneIn .3s cubic-bezier(.2,.8,.2,1) both; }

@keyframes deckPaneIn {
	from { opacity: 0; transform: translateX(8px) scale(.995); }
	to { opacity: 1; transform: translateX(0) scale(1); }
}

.deckWrap[data-animation='false'] :is(.tab, .tabIcon) { transition: none; }

@media (prefers-reduced-motion: reduce) {
	.tab,
	.tabIcon { transition: none; }
	.tabPane[data-active='true'] { animation: none !important; }
}
/* 投稿フォームカラムは、フォーム本体をカラムの高さいっぱいに広げ、
   テキスト入力欄が伸びて下部のボタン類が常にカラム最下部に来るようにする。 */
.tabPanePostForm {
	overflow: hidden;
	> :global(div) { height: 100%; display: flex; flex-direction: column; }
	:global(textarea) { flex: 1; }
}
/* デッキのウィジェットカラムは、各ウィジェット(._panel)に余白・角丸・影を付けて
   通常のウィジェットビューと同じく境界が分かるようにする。 */
.tabPaneWidgets {
	padding: 8px;
	/* 各ウィジェットの最上位(.widget)だけに余白・角丸・影を付ける。
	   :global(._panel) だと子孫すべての ._panel に当たり、ウィジェット内部の
	   ボタンや行レイアウトを巻き込んで崩すため、.widget に限定する。 */
	:global(.widget) {
		border-radius: 12px !important;
		border: 1px solid var(--MI_THEME-divider) !important;
		background: var(--MI_THEME-panel) !important;
		box-shadow: 0 2px 10px rgba(0,0,0,.05);
		margin-bottom: 10px !important;
		overflow: hidden;
	}
	:global(.widget > .mkw-container > header) { border-radius: 12px 12px 0 0; }
}
.tabPane :global(._deckColError) { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 16px; color: var(--MI_THEME-fg); opacity: .6; font-size: .9em; text-align: center; }
.tabPane :global(._deckColError i) { font-size: 1.8em; }

/* 縦積みドロップ帯(ドラッグ中のみ表示) */
.stackDrop {
	flex-shrink: 0; height: 44px; display: flex; align-items: center; justify-content: center;
	border: 2px dashed color-mix(in srgb, var(--MI_THEME-accent) 35%, transparent); border-radius: 12px;
	color: var(--MI_THEME-accent); font-size: .8em; font-weight: 700; opacity: .7; transition: background .12s, opacity .12s;
}
.stackDropOver { background: color-mix(in srgb, var(--MI_THEME-accent) 14%, transparent); opacity: 1; }
.newSlotDrop {
	flex-shrink: 0; width: 120px; display: flex; align-items: center; justify-content: center; align-self: stretch;
	border: 2px dashed color-mix(in srgb, var(--MI_THEME-accent) 35%, transparent); border-radius: 14px;
	color: var(--MI_THEME-accent); font-size: .8em; font-weight: 700;
}

/* 追加ボタン */
.addColumn {
	display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
	border: 2px dashed color-mix(in srgb, var(--MI_THEME-accent) 40%, transparent); border-radius: 14px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 4%, transparent); color: var(--MI_THEME-accent); font-weight: 700; cursor: pointer;
	transition: background .15s, border-color .15s;
	i { font-size: 1.6em; }
	&:hover { background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent); border-color: color-mix(in srgb, var(--MI_THEME-accent) 70%, transparent); }
}
.layoutRow .addColumn { width: 180px; flex-shrink: 0; }
.addColumnGrid { min-height: 120px; }
.addColumnStack { width: 100%; height: 96px; flex-direction: row; }

/* ポインタードラッグのゴースト(指/カーソル追従の見た目)。アニメ感を出し操作しやすくする。 */
.dragGhost {
	position: fixed; z-index: 100000; pointer-events: none; transform: translate(8px, 8px);
	display: flex; align-items: center; gap: 6px; max-width: 220px;
	padding: 6px 12px; border-radius: 10px; font-size: .82em; font-weight: 700; white-space: nowrap;
	background: var(--MI_THEME-panel); color: var(--MI_THEME-fg);
	border: 2px solid var(--ghostColor, var(--MI_THEME-accent));
	box-shadow: 0 6px 24px rgba(0,0,0,.25); opacity: .95;
}
.dragGhostIcon { color: var(--ghostColor, var(--MI_THEME-accent)); }

</style>
