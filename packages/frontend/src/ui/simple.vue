<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="timelineCollapseRoot" :class="[$style.root, { [$style.desktopLayout]: isDesktop }]" :style="{ '--simple-announcements-height': `${announcementsHeight}px` }" :data-hata-foldable="isFoldableWide ? 'true' : undefined">
	<!-- PC/タブレット: オリジナル左サイドバー (上部メニューモード時は隠す) -->
	<nav v-if="isDesktop && !topNavActive" :class="[$style.sidebar, { [$style.sidebarSolid]: !glassEffect, [$style.sidebarWide]: !sidebarFolded && studioProfile.expanded.width === 'wide', [$style.sidebarDeckFolded]: deckActive || sidebarCollapsed }]">
		<!-- バナーすりガラス背景 -->
		<div v-if="glassEffect" :class="$style.sidebarBanner">
			<img v-if="$i?.bannerUrl" :src="$i.bannerUrl" :class="$style.sidebarBannerImg"/>
		</div>
		<div :class="$style.sidebarInner">
			<!-- ロゴ & インスタンス名 & TL設定 (上部固定) -->
			<div data-hata-collapse-part :class="$style.sbLogoRow">
				<div :class="$style.sbLogo" @click="openInstanceMenuMobile">
					<img v-if="instanceIconUrl" :src="instanceIconUrl" :class="$style.sbLogoImg"/>
					<div :class="$style.sbLogoWrap">
						<span :class="$style.sbLogoSub">{{ copy.hereIs }}</span>
						<span :class="$style.sbLogoText">{{ instanceNameStr }}</span>
					</div>
				</div>
				<!-- 旗鯖fork(タスク6): 拡大表示時のみ、TL設定ボタンと縮小ボタンを表示。デッキ時(強制縮小)は出さない。 -->
				<button v-if="!sidebarCollapsed && !deckActive" v-tooltip="copy.timelineSettings" :class="$style.sbLogoAction" @click.stop="openTlOptions"><i class="ti ti-adjustments"></i></button>
				<button v-if="!sidebarCollapsed && !deckActive" v-tooltip="copy.collapseMenu" :class="$style.sbLogoAction" @click.stop="toggleSidebarCollapse"><i class="ti ti-chevron-left"></i></button>
			</div>
			<!-- 旗鯖fork(タスク6): 縮小表示時、サーバーアイコンの下に拡大ボタン[＞]を表示。デッキ時は出さない。 -->
			<button v-if="sidebarCollapsed && !deckActive" v-tooltip="copy.expandMenu" data-hata-collapse-part :class="$style.sbExpandBtn" @click.stop="toggleSidebarCollapse"><i class="ti ti-chevron-right"></i></button>

			<!-- 旗鯖fork: メニュー群はこのスクロール領域に閉じ込め、下部の投稿/アカウントは
                 固定する。メニューが増えてもノート/アカウントがスクロールで隠れない。 -->
			<div :class="[$style.sbScrollWrap, { [$style.fadeTop]: sbFadeTop, [$style.fadeBottom]: sbFadeBottom }]">
				<div ref="sbScrollEl" data-hata-collapse-group :class="$style.sbScroll" @scroll="onSbScroll">
					<!-- ナビ項目（prefer同期の並び順） -->
					<div :class="[$style.sbNav, $style.hssRoot]" :data-hss-mode="sidebarFolded ? 'collapsed' : 'expanded'" :style="{ '--hss-normal-columns': String(studioProfile.expanded.columns) }">
						<!-- HataSideStudio: 縮小表示は専用順序のボタンだけを必ず縦一列で描画する。
						     グループ/ウィジェットは縮小側の型に存在しないため、CSS崩れではなく構造上表示されない。 -->
						<template v-if="sidebarFolded">
							<button v-for="item in studioCollapsedButtons" v-show="studioMenuItemAvailable(item.menuId)" :key="item.id" v-tooltip.right="studioButtonLabel(item)" :class="[$style.sbItem, $style.hssCollapsedItem, { [$style.sbActive]: sidebarItemActive(item.menuId) }]" :data-menu-id="item.menuId" :data-hss-shape="item.shape" :style="studioItemStyle(item)" @click="studioItemClick(item, $event)">
								<i :class="[studioIcon(item), $style.sbIcon]"></i>
								<template v-if="item.menuId==='notifications' && hasUnreadNotif">
									<span v-if="showUnreadNotifCount && unreadNotifCount > 0" :class="$style.sbBadge">{{ unreadNotifCount > 99 ? '99+' : unreadNotifCount }}</span>
									<span v-else :class="$style.sbNotifDot"></span>
								</template>
								<span v-if="item.menuId==='announcements' && hasUnreadAnnouncements" :class="$style.sbDot"></span>
								<span v-if="item.menuId==='chat' && hasUnreadChat" :class="$style.sbNotifDot"></span>
								
							</button>
						</template>
						<template v-else>
							<template v-for="node in studioExpandedNodes" :key="node.id">
								<div v-if="node.type === 'group'" :class="$style.hssGroup" :data-hss-masonry="node.masonry ? 'on' : 'off'" :style="studioGroupStyle(node)">
									<div v-if="node.showName" :class="$style.hssGroupTitle">{{ getHataSideStudioGroupDisplayName(node.name) }}</div>
									<div :class="$style.hssGroupGrid" :data-hss-columns="node.columns" :style="{ '--hss-columns': String(node.columns) }">
										<template v-for="child in node.children" :key="child.id">
											<div v-if="child.type === 'button'" v-show="studioMenuItemAvailable(child.menuId)" :class="$style.hssItemSlot" :data-hss-shape="child.shape" :data-hss-size="child.size" :style="studioItemStyle(child)">
												<form v-if="isStudioSearchButton(child)" :class="[$style.sbItem, $style.hssButton, $style.hssSearchButton]" :data-hss-shape="child.shape" :data-hss-size="child.size" role="search" @submit.prevent="submitStudioSearch">
													<i :class="[studioIcon(child), $style.sbIcon]"></i>
													<input name="query" type="search" :placeholder="copy.searchPlaceholder" :aria-label="copy.searchQuery" @click.stop>
													<button type="submit" :aria-label="copy.searchSubmit" @click.stop><i class="ti ti-arrow-right"></i></button>
												</form>
								<button v-else v-tooltip.right="!child.showLabel ? studioButtonLabel(child) : null" :class="[$style.sbItem, $style.hssButton, { [$style.sbActive]: sidebarItemActive(child.menuId) }]" :data-hss-shape="child.shape" :data-hss-size="child.size" :data-menu-id="child.menuId" type="button" @click="studioItemClick(child, $event)">
													<i :class="[studioIcon(child), $style.sbIcon]"></i><span v-if="child.showLabel" :class="$style.sbLabel">{{ studioButtonLabel(child) }}</span><span v-if="child.size === 'large'" :class="$style.hssButtonLines"><span v-for="line in studioButtonLines(child.menuId)" :key="line">{{ line }}</span></span>
													<template v-if="child.menuId==='notifications' && hasUnreadNotif"><span v-if="showUnreadNotifCount && unreadNotifCount > 0" :class="$style.sbBadge">{{ unreadNotifCount > 99 ? '99+' : unreadNotifCount }}</span><span v-else :class="$style.sbNotifDot"></span></template>
													<span v-if="child.menuId==='announcements' && hasUnreadAnnouncements" :class="$style.sbDot"></span><span v-if="child.menuId==='chat' && hasUnreadChat" :class="$style.sbNotifDot"></span>
												</button>
												<div v-if="child.size === 'large' && studioButtonSignals(child.menuId).length" :class="$style.hssButtonSignals"><button v-for="signal in studioButtonSignals(child.menuId)" :key="signal.label" type="button" @click.stop="openStudioButtonSignal(signal)">{{ signal.label }}</button></div>
											</div>
											<div v-else :class="$style.hssWidget" :data-hss-kind="child.kind" :data-hss-content="studioWidgetContent(child)" :data-hss-shape="child.shape" :data-hss-size="child.size" :style="studioItemStyle(child)">
												<div :class="$style.hssWidgetFrame" @wheel="onStudioWidgetWheel(child.kind, $event)">
													<component :is="studioWidgetComponent(child)" v-if="studioWidgetComponent(child)" :key="studioWidgetRenderKey(child)" :widget="studioWidgetModel(child)" @updateProps="updateStudioWidgetProps(child.id, $event)"/>
													<button v-else type="button" :class="$style.hssWidgetFallback" @click="studioWidgetClick(child.kind)"><i :class="studioWidgetIcon(child.kind)"></i><span><b>{{ studioWidgetValue(child.kind) }}</b><small v-if="studioWidgetContent(child) !== 'compact'">{{ studioWidgetLabel(child) }}</small><small v-if="studioWidgetContent(child) === 'detail'">{{ studioWidgetDetail(child.kind) }}</small></span></button>
												</div>
											</div>
										</template>
									</div>
								</div>
								<div v-else-if="node.type === 'button'" v-show="studioMenuItemAvailable(node.menuId)" :class="$style.hssItemSlot" :data-hss-shape="node.shape" :data-hss-size="node.size" :style="studioItemStyle(node)">
									<form v-if="isStudioSearchButton(node)" :class="[$style.sbItem, $style.hssButton, $style.hssSearchButton]" :data-hss-shape="node.shape" :data-hss-size="node.size" role="search" @submit.prevent="submitStudioSearch">
										<i :class="[studioIcon(node), $style.sbIcon]"></i><input name="query" type="search" :placeholder="copy.searchPlaceholder" :aria-label="copy.searchQuery" @click.stop><button type="submit" :aria-label="copy.searchSubmit" @click.stop><i class="ti ti-arrow-right"></i></button>
									</form>
									<template v-else>
										<button v-tooltip.right="!node.showLabel ? studioButtonLabel(node) : null" :class="[$style.sbItem, $style.hssButton, { [$style.sbActive]: sidebarItemActive(node.menuId) }]" :data-hss-shape="node.shape" :data-hss-size="node.size" :data-menu-id="node.menuId" type="button" @click="studioItemClick(node, $event)"><i :class="[studioIcon(node), $style.sbIcon]"></i><span v-if="node.showLabel" :class="$style.sbLabel">{{ studioButtonLabel(node) }}</span><span v-if="node.size === 'large'" :class="$style.hssButtonLines"><span v-for="line in studioButtonLines(node.menuId)" :key="line">{{ line }}</span></span></button>
										<div v-if="node.size === 'large' && studioButtonSignals(node.menuId).length" :class="$style.hssButtonSignals"><button v-for="signal in studioButtonSignals(node.menuId)" :key="signal.label" type="button" @click.stop="openStudioButtonSignal(signal)">{{ signal.label }}</button></div>
									</template>
								</div>
								<div v-else :class="$style.hssWidget" :data-hss-kind="node.kind" :data-hss-content="studioWidgetContent(node)" :data-hss-shape="node.shape" :data-hss-size="node.size" :style="studioItemStyle(node)">
									<div :class="$style.hssWidgetFrame" @wheel="onStudioWidgetWheel(node.kind, $event)">
										<component :is="studioWidgetComponent(node)" v-if="studioWidgetComponent(node)" :key="studioWidgetRenderKey(node)" :widget="studioWidgetModel(node)" @updateProps="updateStudioWidgetProps(node.id, $event)"/>
										<button v-else type="button" :class="$style.hssWidgetFallback" @click="studioWidgetClick(node.kind)"><i :class="studioWidgetIcon(node.kind)"></i><span><b>{{ studioWidgetValue(node.kind) }}</b><small v-if="studioWidgetContent(node) !== 'compact'">{{ studioWidgetLabel(node) }}</small><small v-if="studioWidgetContent(node) === 'detail'">{{ studioWidgetDetail(node.kind) }}</small></span></button>
									</div>
								</div>
							</template>
						</template>
						<!-- 旗鯖fork: かつてここに「リロード」をハードコード表示していたが、
                     ユーザーが設定UIから非表示・並び替えできるよう、通常の sidebar 項目として
                     def.ts と sidebarItemClick map に統合した (v5 マイグレで既存ユーザーにも追加)。 -->
					</div>

					<div :class="$style.sbDivider"></div>

					<!-- 設定 & リアルタイムモード -->
					<div :class="$style.sbNav">
						<button v-tooltip.right="sidebarFolded ? copy.more : null" :class="$style.sbItem" @click="openMore($event)">
							<i class="ti ti-dots" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.more }}</span>
						</button>
						<button v-tooltip.right="sidebarFolded ? copy.settings : null" :class="$style.sbItem" @click="goToSettings">
							<i class="ti ti-settings" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.settings }}</span>
						</button>
						<button v-tooltip.right="sidebarFolded ? copy.realtime : null" :class="[$style.sbItem, { [$style.sbActive]: isRealtimeMode }]" @click="toggleRealtimeMode">
							<i :class="[isRealtimeMode ? 'ti ti-bolt' : 'ti ti-bolt-off', $style.sbIcon]"></i>
							<span :class="$style.sbLabel">{{ copy.realtime }}</span>
							<span :class="[$style.sbOnOff, { [$style.sbOnOffOn]: isRealtimeMode }]">{{ isRealtimeMode ? copy.on : copy.off }}</span>
						</button>
					</div>

					<!-- 管理者/モデレーター用 -->
					<template v-if="$i && ($i.isAdmin || $i.isModerator)">
						<div :class="$style.sbDivider"></div>
						<div :class="$style.sbNav">
							<button v-tooltip.right="sidebarFolded ? copy.controlPanel : null" :class="[$style.sbItem, { [$style.sbActive]: isAdminPage }]" @click="goToAdmin">
								<i class="ti ti-dashboard" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.controlPanel }}</span>
							</button>
						</div>
					</template>
				</div>
			</div>

			<!-- 下部: 投稿 + アカウント (固定) -->
			<div data-hata-collapse-group :class="$style.sbBottom">
				<!-- 旗鯖fork: Hataskey UIデッキUI使用中は、ノートボタンの上にリロードボタンを固定表示 -->
				<button v-if="deckActive" v-tooltip.right="sidebarFolded ? copy.reload : null" :class="$style.sbReloadBtn" @click="reloadPage($event)">
					<i class="ti ti-refresh"></i>
				</button>
				<button v-tooltip.right="sidebarFolded ? composeLabel : null" :aria-label="composeLabel" :class="$style.sbPostBtn" :style="studioPostButtonStyle" data-cy-open-post-form @click="playSimpleNavMotion($event, 'post'); onPostClick()">
					<i :class="composeIcon"></i>
				</button>
				<!-- 旗鯖fork: デッキモード切替トグル (アカウント表示の上) -->
				<div :class="$style.sbModeToggle">
					<button v-tooltip="copy.standardView" :class="[$style.sbModeBtn, { [$style.sbModeActive]: !deckMode }]" @click="setDeckMode(false)">
						<i class="ti ti-device-mobile"></i>
					</button>
					<button v-tooltip="copy.deckView" :class="[$style.sbModeBtn, { [$style.sbModeActive]: deckMode }]" @click="setDeckMode(true)">
						<i class="ti ti-layout-columns"></i>
					</button>
				</div>
				<div :class="$style.sbBottomRow">
					<button v-tooltip.right="sidebarFolded ? copy.account : null" :class="$style.sbAccount" @click="openAccountMenu">
						<img v-if="$i?.avatarUrl" :src="$i.avatarUrl" :class="$style.sbAvatarImg"/>
						<span :class="$style.sbUsername">@{{ $i?.username }}</span>
					</button>
				</div>
			</div>
		</div>
	</nav>

	<div :class="$style.mainColumn">
		<!-- 同じ背景画像で、ノート列と外側のチャーム領域を覆う。スクロール領域の外に置く。 -->
		<div v-if="timelineGlassBg && $i?.bannerUrl" :class="$style.timelineBanner">
			<img :src="$i.bannerUrl" :class="$style.timelineBannerImg"/>
		</div>
		<div :class="$style.mainColumnInner">
			<div v-if="$i" ref="announcementsEl" :class="$style.announcementsBanner">
				<XAnnouncements/>
			</div>
			<!-- 旗鯖fork: 上部メニューモードのナビバー(横並びピル型/常時固定)。デッキ併用時はこの下にデッキツールバーが来る。 -->
			<nav v-if="topNavActive" data-htk-weather-footer data-hata-collapse-group :class="[$style.topNav, { [$style.topNavSolid]: !glassEffect }]">
				<button v-tooltip="instance.name ?? copy.instance" :class="$style.topNavLogo" @click="playSimpleNavMotion($event, 'layout'); openInstanceMenuMobile($event)">
					<img v-if="instance.iconUrl" :src="instance.iconUrl" :class="$style.topNavLogoImg"/>
					<i v-else class="ti ti-server"></i>
				</button>
				<button v-tooltip="isRealtimeMode ? copy.realtimeOn : copy.realtimeOff" :class="[$style.topNavItem, { [$style.topNavItemActive]: isRealtimeMode }]" @click="playSimpleNavMotion($event, 'realtime'); toggleRealtimeMode()">
					<i :class="isRealtimeMode ? 'ti ti-bolt' : 'ti ti-bolt-off'"></i><span>{{ copy.realtime }}</span>
				</button>
				<div :class="$style.topNavDivider"></div>
				<div :class="$style.topNavScroll" @wheel.prevent="onTopNavWheel">
					<template v-for="grp in sidebarGroups" :key="grp.key">
						<button v-for="item in grp.items" :key="item.id" v-tooltip="simpleMenuDisplayLabel(item.id, item.label)" :class="[$style.topNavItem, { [$style.topNavItemActive]: sidebarItemActive(item.id) }]" @click="sidebarItemClick(item.id, $event)">
							<i :class="item.icon"></i><span>{{ simpleMenuDisplayLabel(item.id, item.label) }}</span>
							<span v-if="item.id==='notifications' && hasUnreadNotif" :class="$style.topNavDot"></span>
							<span v-if="item.id==='announcements' && hasUnreadAnnouncements" :class="$style.topNavDot"></span>
							<span v-if="item.id==='chat' && hasUnreadChat" :class="$style.topNavDot"></span>
						</button>
					</template>
					<!-- 旗鯖fork: かつて「もっと」の右にリロードボタンをハードコード表示していたが、
                     sidebar 項目化したため上の v-for に統合済み(reload を非表示にしてれば出ない)。 -->
					<button v-if="$i && ($i.isAdmin || $i.isModerator)" v-tooltip="copy.controlPanel" :class="[$style.topNavItem, { [$style.topNavItemActive]: isAdminPage }]" @click="playSimpleNavMotion($event, 'admin'); goToAdmin()"><i class="ti ti-dashboard"></i><span>{{ copy.adminShort }}</span></button>
				</div>
				<div :class="$style.topNavDivider"></div>
				<button v-if="deckActive" v-tooltip="copy.deckSettings" :class="$style.topNavItem" @click="playSimpleNavMotion($event, 'deck'); globalEvents.emit('toggleDeckToolbar')"><i class="ti ti-layout-board"></i><span>{{ copy.deckShort }}</span></button>
				<button v-tooltip="copy.settings" :class="$style.topNavItem" @click="playSimpleNavMotion($event, 'settings'); goToSettings()"><i class="ti ti-settings"></i><span>{{ copy.settings }}</span></button>
				<button v-tooltip="composeLabel" :aria-label="composeLabel" :class="$style.topNavPost" data-cy-open-post-form @click="playSimpleNavMotion($event, 'post'); onPostClick()"><i :class="composeIcon"></i><span>{{ composeLabel }}</span></button>
				<button :class="$style.topNavAvatar" @click="openAccountMenu"><MkAvatar v-if="$i" :user="$i" :class="$style.topNavAvatarImg"/></button>
			</nav>
			<!-- Top pill navbar (timeline tabs) - scroll reactive -->
			<div
				v-show="nativeNavbarVisible || mobileToastVisible" data-hata-collapse-group
				:inert="navbarSearchOpen" :data-toast-motion="prefer.r.animation.value" :data-hidden="!pullRefresh.active.value && !navbarLoadingShown && !showTopBar && !mobileToastVisible && !navbarNewNotes && !navbarNotificationShowing && !navbarNotificationShrinking"
				:data-notification-only="mobileNotificationOnly"
				:class="[$style.topBar, footerIsDark ? $style.topBarDark : $style.topBarLight]"
			>
				<div ref="topNavStackEl" :class="$style.topNavStack" :data-navbar-notice="navbarNotificationKind" :data-notification-sizing="navbarNotificationSizing" :data-pull-active="pullRefresh.active.value" :data-pull-phase="pullRefresh.state.value.phase" :data-pull-motion="newNotesMotionEnabled" :style="[navbarNotificationWidthStyle, pullRefresh.style.value, navbarPullFrameStyle]">
					<div ref="notificationOutlineEl" :class="$style.topPillFrame" :aria-busy="nativeNavbarVisible && pendingApiRequestsCount > 0">
						<div v-if="navbarNotificationShowing" ref="notificationBloomEl" :class="$style.notificationBloom" :data-leaving="navbarNotificationLeaving" aria-hidden="true">
							<MkNotificationToastRing :target="notificationBloomEl" :elapsed="newNotesMotionEnabled ? navbarNotificationElapsed : navbarNotificationDuration" :duration="navbarNotificationDuration" integrated :motion="newNotesMotionEnabled"/>
						</div>
						<MkNavbarLoadingRing v-if="nativeNavbarVisible" :target="notificationOutlineEl" :active="pendingApiRequestsCount > 0" :motion="newNotesMotionEnabled" @visibleChange="navbarLoadingVisible = $event"/>
						<div ref="navbarPullPillEl" :class="$style.topPill" :data-notification="navbarNotificationShowing" :data-new-notes="!!navbarNewNotesContent">
							<div :class="$style.navbarPullContent" :inert="pullRefresh.state.value.height > 8" :aria-hidden="pullRefresh.state.value.height > 8">
								<div ref="notificationTargetEl" :class="$style.notificationViewport" :data-mobile="!isDesktop" :style="{ height: `${navbarNotificationShowing ? navbarNotificationHeight : 0}px` }"></div>
								<div v-show="!mobileNotificationOnly" :class="$style.topPillNav">
									<div :class="$style.topPillTabs">
										<template v-for="item in visibleTopTabs" :key="item.id">
											<button :class="[$style.topTabBtn, { [$style.topTabActive]: !isCollectionTimelinePage && tab === item.id }]" @click="playSimpleNavMotion($event, item.id); switchTab(item.id as TabType)">
												<i :class="item.icon"></i>
												<span v-if="!isCollectionTimelinePage && tab === item.id" :class="$style.topTabLabel">{{ simpleMenuDisplayLabel(item.id, item.label) }}</span>
											</button>
										</template>
										<div :class="$style.topTabDivider"></div>
										<div :class="[$style.listTabPill, { [$style.listTabPillActive]: isListTimelinePage }]">
											<button :class="[$style.topTabBtn, $style.listTabMain, { [$style.topTabActive]: isListTimelinePage }]" @click="playSimpleNavMotion($event, 'list'); openPreferredList()">
												<i class="ti ti-list"></i>
												<span v-if="isListTimelinePage" :class="$style.topTabCopy"><span :class="$style.topTabLabel">{{ copy.list }}</span><span :class="$style.topTabName">{{ activeListName }}</span></span>
											</button>
											<button v-if="isListTimelinePage" v-tooltip="copy.switchList" :class="$style.listSelectBtn" :aria-label="copy.switchList" @click="playSimpleNavMotion($event, 'list'); toggleTimelinePicker('list')">
												<i class="ti ti-selector"></i>
											</button>
											<button v-if="isListTimelinePage" v-tooltip="copy.configureList" :class="$style.listSelectBtn" :aria-label="copy.configureList" @click="playSimpleNavMotion($event, 'settings'); openActiveCollectionSettings('list')"><i class="ti ti-settings"></i></button>
										</div>
										<button :class="[$style.topTabBtn, { [$style.topTabActive]: isChannelPage }]" @click="playSimpleNavMotion($event, 'channel'); goToChannels()">
											<i class="ti ti-device-tv"></i>
											<span v-if="isChannelPage" :class="$style.topTabLabel">{{ copy.channel }}</span>
										</button>
										<div :class="[$style.listTabPill, { [$style.listTabPillActive]: isAntennaTimelinePage }]">
											<button :class="[$style.topTabBtn, $style.listTabMain, { [$style.topTabActive]: isAntennaTimelinePage }]" @click="playSimpleNavMotion($event, 'antenna'); openPreferredAntenna()">
												<i class="ti ti-antenna"></i>
												<span v-if="isAntennaTimelinePage" :class="$style.topTabCopy"><span :class="$style.topTabLabel">{{ copy.antenna }}</span><span :class="$style.topTabName">{{ activeAntennaName }}</span></span>
											</button>
											<button v-if="isAntennaTimelinePage" v-tooltip="copy.switchAntenna" :class="$style.listSelectBtn" :aria-label="copy.switchAntenna" @click="playSimpleNavMotion($event, 'antenna'); toggleTimelinePicker('antenna')"><i class="ti ti-selector"></i></button>
											<button v-if="isAntennaTimelinePage" v-tooltip="copy.configureAntenna" :class="$style.listSelectBtn" :aria-label="copy.configureAntenna" @click="playSimpleNavMotion($event, 'settings'); openActiveCollectionSettings('antenna')"><i class="ti ti-settings"></i></button>
										</div>
									</div>
								</div>
								<div :class="$style.newNotesViewport" :data-active="!!navbarNewNotes" :aria-hidden="!navbarNewNotes" :inert="!navbarNewNotes">
									<div :class="$style.newNotesContent">
										<button class="_button" :class="$style.newNotesButton" type="button" :disabled="!navbarNewNotes" :aria-label="navbarNewNotesLabel" @click="showNavbarNewNotes">
											<span ref="newNotesFlashEl" :class="$style.newNotesFlash" aria-hidden="true"></span>
											<span ref="newNotesContentEl" :class="$style.newNotesVisual"><MkTimelineNewNotesContent :avatars="navbarNewNotesContent?.avatars ?? []" :count="navbarNewNotesContent?.count" :text="navbarNewNotesContent?.text" :author="navbarNewNotesContent?.author" :emojiUrls="navbarNewNotesContent?.emojiUrls" :icon="navbarNewNotesContent?.icon" :motion="newNotesMotionEnabled" :compact="!isDesktop"/></span>
											<span :class="$style.newNotesStatus" role="status" aria-atomic="true">{{ navbarNewNotes ? navbarNewNotesLabel : '' }}</span>
										</button>
									</div>
								</div>
							</div>
							<div :class="$style.navbarPullPrompt" role="status" aria-atomic="true">
								<i class="ti ti-refresh" :class="$style.navbarPullSymbol" aria-hidden="true"></i>
								<span>{{ navbarPullPrompt }}</span>
							</div>
						</div>
					</div>
					<div v-if="timelinePickerKind && !mobileNotificationOnly" :class="$style.timelinePicker" :aria-label="timelinePickerKind === 'list' ? copy.selectList : copy.selectAntenna">
						<div v-if="timelinePickerItems.length === 0" :class="$style.timelinePickerEmpty">
							<span>{{ timelinePickerKind === 'list' ? copy.noLists : copy.noAntennas }}</span>
							<button :class="$style.timelinePickerOptions" @click="playSimpleNavMotion($event, 'settings'); openEmptyCollectionOptions()">
								<i class="ti ti-settings"></i><span>{{ copy.options }}</span>
							</button>
						</div>
						<button v-for="item in timelinePickerItems" :key="item.id" :class="[$style.timelinePickerItem, { [$style.timelinePickerItemActive]: item.id === activeCollectionId }]" @click="playSimpleNavMotion($event, timelinePickerKind === 'list' ? 'list' : 'antenna'); selectTimelineCollection(item.id)">
							<i :class="timelinePickerKind === 'list' ? 'ti ti-list' : 'ti ti-antenna'"></i><span>{{ item.name }}</span>
						</button>
					</div>
				</div>
			</div>
			<!-- Page view header -->
			<header v-show="isPageView && showPageHeader && !isCollectionTimelinePage && !isSettingsPage" :inert="navbarSearchOpen" data-hata-collapse-group :class="$style.pageHeader">
				<button :class="$style.pageBackBtn" @click="goBack"><i class="ti ti-chevron-left"></i></button>
				<div :class="$style.pageTitle">{{ pageMetadata?.title ?? '' }}</div>
				<div style="width: 38px;"></div>
			</header>

			<div ref="contentEl" :inert="navbarSearchOpen" data-timeline-tab-gestures :class="$style.content" @scroll="onContentScroll" @wheel="onContentWheel">
				<div v-show="!isPageView && !deckActive" style="height: 100%;">
					<div v-if="showFixedPostForm" :class="$style.fixedFormHost"><MkPostForm :class="$style.fixedPostForm" class="_panel" fixed :autofocus="false"/></div>
					<Transition :css="newNotesMotionEnabled" :enterActiveClass="$style.timelineEnterActive" :leaveActiveClass="$style.timelineLeaveActive" :enterFromClass="$style.timelineEnterFrom" :enterToClass="$style.timelineEnterTo" :leaveFromClass="$style.timelineLeaveFrom" :leaveToClass="$style.timelineLeaveTo" :mode="newNotesMotionEnabled ? 'out-in' : undefined" @beforeLeave="prepareTimelineLeave">
						<div :key="tab + String(withRenotes) + String(withSensitive) + String(onlyFiles)" data-hata-collapse-items :class="[$style.timelineContainer, { [$style.timelineContainerWithFixedForm]: showFixedPostForm }]" :style="{ '--timeline-slide-direction': timelineSlideDirection }" :data-timeline-motion="newNotesMotionEnabled" :data-glass-bg="timelineGlassBg ? 'on' : undefined" @touchstart.passive="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
							<KeepAlive>
								<MkStreamingNotesTimeline v-if="tab === 'mixed'" key="mixed" newNotesNavbarKey="main:mixed" src="global" :withRenotes="withRenotes" :withSensitive="withSensitive" :onlyFiles="onlyFiles" :glassBg="timelineGlassBg"/>
								<MkStreamingNotesTimeline v-else-if="tab === 'local'" key="local" newNotesNavbarKey="main:local" src="local" :withRenotes="withRenotes" :withSensitive="withSensitive" :onlyFiles="onlyFiles" :glassBg="timelineGlassBg"/>
								<MkStreamingNotesTimeline v-else-if="tab === 'social'" key="social" newNotesNavbarKey="main:social" src="social" :withRenotes="withRenotes" :withSensitive="withSensitive" :onlyFiles="onlyFiles" :glassBg="timelineGlassBg"/>
								<MkStreamingNotesTimeline v-else-if="tab === 'following'" key="following" newNotesNavbarKey="main:following" src="home" :withRenotes="withRenotes" :withSensitive="withSensitive" :onlyFiles="onlyFiles" :glassBg="timelineGlassBg"/>
								<!-- 旗鯖fork: トレンドタイムライン (TTL) -->
								<MkTrendingTimeline v-else-if="tab === 'trending'" key="trending" newNotesNavbarKey="main:trending" :glassBg="timelineGlassBg"/>
							</KeepAlive>
						</div>
					</Transition>
				</div>
				<!-- 旗鯖fork: デッキモード (デスクトップのみ)。背景にヘッダー画像のぼかしを敷く(無効化可) -->
				<div v-if="deckActive" data-hata-collapse-items :class="$style.deckArea">
					<div v-if="glassEffect && !deckNoBannerBg && $i?.bannerUrl" :class="$style.deckBanner">
						<img :src="$i.bannerUrl" :class="$style.deckBannerImg"/>
					</div>
					<HatasabaDeck :class="$style.deckAreaInner"/>
				</div>
				<div v-show="isPageView" data-hata-collapse-part :class="[$style.pageContainer, { [$style.collectionPageContainer]: isCollectionTimelinePage }]"><RouterView/></div>
			</div>

			<div v-if="navbarSearchOpen" :class="$style.navbarSearchScrim" data-navbar-search-scrim @pointerdown.stop.prevent @click.stop.prevent="closeNavbarSearch()" @touchmove.prevent @wheel.prevent></div>
			<!-- 通常TL: ナビバー（モバイルのみ） -->
			<div v-show="!isDesktop && !isChannelDetailPage && (!isPageView || bottomNavHasPage)" data-htk-weather-footer data-hata-collapse-group :data-search-open="navbarSearchOpen" :data-search-motion="newNotesMotionEnabled" :style="{ '--navbar-search-keyboard-inset': `${navbarSearchOpen ? navbarSearchKeyboardInset : 0}px` }" :class="[$style.bottomBar, $style.bottomSearchBar, footerIsDark ? $style.bottomBarDark : $style.bottomBarLight, { [$style.bottomBarHidden]: !navbarSearchOpen && (!showBottomBar || widgetsShowing) }]">
				<button v-if="!isDesktop" :class="$style.sideBtn" :inert="navbarSearchOpen" @click="playSimpleNavMotion($event, 'layout'); simpleDrawerShowing = true"><i class="ti ti-menu-2"></i></button>
				<div ref="navbarSearchShell" :class="[$style.navPill, $style.searchPill]" :data-search-open="navbarSearchOpen" :role="navbarSearchOpen ? 'dialog' : undefined" :aria-modal="navbarSearchOpen ? true : undefined" :aria-label="navbarSearchOpen ? i18n.ts.search : undefined" @keydown="onNavbarSearchKeydown">
					<div :class="$style.navbarSearchBody" :style="{ height: `${navbarSearchOpen ? Math.min(navbarSearchHeight, navbarSearchMaxHeight) : 0}px` }" :inert="!navbarSearchOpen" :aria-hidden="!navbarSearchOpen">
						<MkMobileNavbarSearch ref="navbarSearchContent" :active="navbarSearchOpen" :maxHeight="navbarSearchMaxHeight" :motion="newNotesMotionEnabled" @height="updateNavbarSearchHeight" @close="closeNavbarSearch()"/>
					</div>
					<div :class="$style.bottomNavRow">
						<template v-for="item in visibleBottomNav" :key="item.id">
							<button v-if="item.id==='search'" :ref="setNavbarSearchTrigger" :class="[$style.navBtn, { [$style.navActive]: navbarSearchOpen || isSearchPage }]" :aria-label="navbarSearchOpen ? i18n.ts.close : i18n.ts.search" :aria-expanded="navbarSearchOpen" aria-haspopup="dialog" data-navbar-search-toggle @click="toggleNavbarSearch"><span :class="$style.navbarSearchIcons" :data-open="navbarSearchOpen"><i class="ti ti-search" :class="$style.navbarSearchIcon" aria-hidden="true"></i><i class="ti ti-x" :class="$style.navbarSearchCloseIcon" aria-hidden="true"></i></span></button>
							<button v-else-if="item.id==='home'" :disabled="navbarSearchOpen" :class="[$style.navBtn, { [$style.navActive]: isHomeTL }]" @click="playSimpleNavMotion($event, 'home'); goHome()"><i class="ti ti-home"></i></button>
							<button v-else-if="item.id==='notifications'" :disabled="navbarSearchOpen" :class="[$style.navBtn, { [$style.navActive]: isNotifPage }]" @click="playSimpleNavMotion($event, 'notifications'); goToNotifications()">
								<i class="ti ti-bell"></i>
								<template v-if="hasUnreadNotif">
									<span v-if="showUnreadNotifCount && unreadNotifCount > 0" :class="$style.badgeCount">{{ unreadNotifCount > 99 ? '99+' : unreadNotifCount }}</span>
									<span v-else :class="$style.badge"></span>
								</template>
							</button>
							<button v-else-if="item.id==='widgets'" :disabled="navbarSearchOpen" :class="$style.navBtn" @click="playSimpleNavMotion($event, 'widgets'); widgetsShowing = true"><i class="ti ti-apps"></i></button>
						</template>
					</div>
				</div>
				<button v-if="!isPageView || isCollectionTimelinePage" :class="$style.sideBtn" :inert="navbarSearchOpen" :aria-label="composeLabel" data-cy-open-post-form @click="playSimpleNavMotion($event, 'post'); onPostClick()"><i :class="composeIcon"></i></button>
				<div v-else :class="$style.bottomSideSpacer"></div>
			</div>

			<!-- 外部TL: 投稿 & 通知ボタン（モバイルのみ） -->
		</div>
	</div>

	<!-- モバイル: オリジナルドロワーメニュー -->
	<Teleport to="body">
		<Transition name="simple-drawer-bg">
			<div v-if="simpleDrawerShowing" :class="$style.drawerBg" @click="simpleDrawerShowing = false"></div>
		</Transition>
		<Transition name="simple-drawer">
			<nav v-if="simpleDrawerShowing" data-hata-collapse-teleport :class="[$style.drawerNav, { [$style.drawerNavSolid]: !glassEffect }]">
				<!-- ヘッダー背景（すりガラス） -->
				<div v-if="glassEffect" :class="$style.drawerBanner">
					<img v-if="$i?.bannerUrl" :src="$i.bannerUrl" :class="$style.drawerBannerImg"/>
				</div>
				<div :class="$style.sidebarInner">
					<div :class="$style.sbLogoRow">
						<div :class="$style.sbLogo" @click="openInstanceMenuMobile">
							<img v-if="instanceIconUrl" :src="instanceIconUrl" :class="$style.sbLogoImg"/>
							<div :class="$style.sbLogoWrap">
								<span :class="$style.sbLogoSub">{{ copy.hereIs }}</span>
								<span :class="$style.sbLogoText">{{ instanceNameStr }}</span>
							</div>
						</div>
						<button :class="$style.sbLogoAction" @click="openTlOptions"><i class="ti ti-adjustments"></i></button>
					</div>
					<!-- 旗鯖fork: メニュー群をスクロール領域に、下部の投稿/アカウントを固定 -->
					<div :class="$style.sbScroll">
						<!-- モバイルもHataSideStudioの拡大プロファイルを正本として描画する。 -->
						<div :class="[$style.sbNav, $style.hssRoot, $style.hssMobileRoot]" data-hss-mode="expanded" :style="{ '--hss-normal-columns': String(studioProfile.expanded.columns) }">
							<template v-for="node in studioExpandedNodes" :key="node.id">
								<div v-if="node.type === 'group'" :class="$style.hssGroup" :data-hss-masonry="node.masonry ? 'on' : 'off'" :style="studioGroupStyle(node)">
									<div v-if="node.showName" :class="$style.hssGroupTitle">{{ getHataSideStudioGroupDisplayName(node.name) }}</div>
									<div :class="$style.hssGroupGrid" :data-hss-columns="node.columns" :style="{ '--hss-columns': String(node.columns) }">
										<template v-for="child in node.children" :key="child.id">
											<div v-if="child.type === 'button'" v-show="studioMenuItemAvailable(child.menuId)" :class="$style.hssItemSlot" :data-hss-shape="child.shape" :data-hss-size="child.size" :style="studioItemStyle(child)">
												<form v-if="isStudioSearchButton(child)" :class="[$style.sbItem, $style.hssButton, $style.hssSearchButton]" :data-hss-shape="child.shape" :data-hss-size="child.size" role="search" @submit.prevent="submitStudioMobileSearch"><i :class="[studioIcon(child), $style.sbIcon]"></i><input name="query" type="search" :placeholder="copy.searchPlaceholder" :aria-label="copy.searchQuery" @click.stop><button type="submit" :aria-label="copy.searchSubmit" @click.stop><i class="ti ti-arrow-right"></i></button></form>
												<button v-else v-tooltip.right="!child.showLabel ? studioButtonLabel(child) : null" :class="[$style.sbItem, $style.hssButton, { [$style.sbActive]: sidebarItemActive(child.menuId) }]" :data-hss-shape="child.shape" :data-hss-size="child.size" :data-menu-id="child.menuId" type="button" @click="studioItemClick(child, $event)"><i :class="[studioIcon(child), $style.sbIcon]"></i><span v-if="child.showLabel" :class="$style.sbLabel">{{ studioButtonLabel(child) }}</span><span v-if="child.size === 'large'" :class="$style.hssButtonLines"><span v-for="line in studioButtonLines(child.menuId)" :key="line">{{ line }}</span></span><template v-if="child.menuId==='notifications' && hasUnreadNotif"><span v-if="showUnreadNotifCount && unreadNotifCount > 0" :class="$style.sbBadge">{{ unreadNotifCount > 99 ? '99+' : unreadNotifCount }}</span><span v-else :class="$style.sbNotifDot"></span></template><span v-if="child.menuId==='announcements' && hasUnreadAnnouncements" :class="$style.sbDot"></span><span v-if="child.menuId==='chat' && hasUnreadChat" :class="$style.sbNotifDot"></span></button>
											</div>
											<div v-else :class="$style.hssWidget" :data-hss-kind="child.kind" :data-hss-content="studioWidgetContent(child)" :data-hss-shape="child.shape" :data-hss-size="child.size" :style="studioItemStyle(child)"><div :class="$style.hssWidgetFrame" @wheel="onStudioWidgetWheel(child.kind, $event)"><component :is="studioWidgetComponent(child)" v-if="studioWidgetComponent(child)" :key="studioWidgetRenderKey(child)" :widget="studioWidgetModel(child)" @updateProps="updateStudioWidgetProps(child.id, $event)"/><button v-else type="button" :class="$style.hssWidgetFallback" @click="studioWidgetClick(child.kind)"><i :class="studioWidgetIcon(child.kind)"></i><span><b>{{ studioWidgetValue(child.kind) }}</b><small>{{ studioWidgetLabel(child) }}</small></span></button></div></div>
										</template>
									</div>
								</div>
								<div v-else-if="node.type === 'button'" v-show="studioMenuItemAvailable(node.menuId)" :class="$style.hssItemSlot" :data-hss-shape="node.shape" :data-hss-size="node.size" :style="studioItemStyle(node)">
									<form v-if="isStudioSearchButton(node)" :class="[$style.sbItem, $style.hssButton, $style.hssSearchButton]" :data-hss-shape="node.shape" :data-hss-size="node.size" role="search" @submit.prevent="submitStudioMobileSearch"><i :class="[studioIcon(node), $style.sbIcon]"></i><input name="query" type="search" :placeholder="copy.searchPlaceholder" :aria-label="copy.searchQuery" @click.stop><button type="submit" :aria-label="copy.searchSubmit" @click.stop><i class="ti ti-arrow-right"></i></button></form>
									<button v-else v-tooltip.right="!node.showLabel ? studioButtonLabel(node) : null" :class="[$style.sbItem, $style.hssButton, { [$style.sbActive]: sidebarItemActive(node.menuId) }]" :data-hss-shape="node.shape" :data-hss-size="node.size" :data-menu-id="node.menuId" type="button" @click="studioItemClick(node, $event)"><i :class="[studioIcon(node), $style.sbIcon]"></i><span v-if="node.showLabel" :class="$style.sbLabel">{{ studioButtonLabel(node) }}</span><span v-if="node.size === 'large'" :class="$style.hssButtonLines"><span v-for="line in studioButtonLines(node.menuId)" :key="line">{{ line }}</span></span></button>
								</div>
								<div v-else :class="$style.hssWidget" :data-hss-kind="node.kind" :data-hss-content="studioWidgetContent(node)" :data-hss-shape="node.shape" :data-hss-size="node.size" :style="studioItemStyle(node)"><div :class="$style.hssWidgetFrame" @wheel="onStudioWidgetWheel(node.kind, $event)"><component :is="studioWidgetComponent(node)" v-if="studioWidgetComponent(node)" :key="studioWidgetRenderKey(node)" :widget="studioWidgetModel(node)" @updateProps="updateStudioWidgetProps(node.id, $event)"/><button v-else type="button" :class="$style.hssWidgetFallback" @click="studioWidgetClick(node.kind)"><i :class="studioWidgetIcon(node.kind)"></i><span><b>{{ studioWidgetValue(node.kind) }}</b><small>{{ studioWidgetLabel(node) }}</small></span></button></div></div>
							</template>
						</div>
						<div :class="$style.sbDivider"></div>
						<div :class="$style.sbNav">
							<button data-hatasaba-mobile-more type="button" :class="$style.sbItem" @click="openMore($event, true)">
								<i class="ti ti-dots" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.more }}</span>
							</button>
							<button :class="$style.sbItem" @click="goToSettings(); simpleDrawerShowing = false">
								<i class="ti ti-settings" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.settings }}</span>
							</button>
							<button :class="[$style.sbItem, { [$style.sbActive]: isRealtimeMode }]" @click="toggleRealtimeMode">
								<i :class="[isRealtimeMode ? 'ti ti-bolt' : 'ti ti-bolt-off', $style.sbIcon]"></i>
								<span :class="$style.sbLabel">{{ copy.realtime }}</span>
								<span :class="[$style.sbToggle, { [$style.sbToggleOn]: isRealtimeMode }]"></span>
							</button>
						</div>
						<template v-if="$i && ($i.isAdmin || $i.isModerator)">
							<div :class="$style.sbDivider"></div>
							<div :class="$style.sbNav">
								<button :class="[$style.sbItem, { [$style.sbActive]: isAdminPage }]" @click="goToAdmin(); simpleDrawerShowing = false">
									<i class="ti ti-dashboard" :class="$style.sbIcon"></i><span :class="$style.sbLabel">{{ copy.controlPanel }}</span>
								</button>
							</div>
						</template>
					</div>
					<div :class="$style.sbBottom">
						<button :class="$style.sbPostBtn" :style="studioPostButtonStyle" :aria-label="composeLabel" @click="playSimpleNavMotion($event, 'post'); onPostClick(); simpleDrawerShowing = false">
							<i :class="composeIcon"></i><span>{{ composeLabel }}</span>
						</button>
						<div :class="$style.sbBottomRow">
							<button :class="$style.sbAccount" @click="openAccountMenu">
								<img v-if="$i?.avatarUrl" :src="$i.avatarUrl" :class="$style.sbAvatarImg"/>
								<span :class="$style.sbUsername">@{{ $i?.username }}</span>
							</button>
						</div>
					</div>
				</div>
			</nav>
		</Transition>
	</Teleport>

	<!-- PC/タブレット: 右ウィジェットバー -->
	<!-- 旗鯖fork: 折りたたみ端末の広い面でも、このバーだけPCと同じ構成・同じ表示で常時出す。
	     ⚠️isDesktop は広げない(下部ナビ等までPC化して「モバイル表示のまま」が崩れるため)。 -->
	<div v-if="(isDesktop || isFoldableWide) && !deckActive" :inert="navbarSearchOpen" data-hata-collapse-part :class="[$style.desktopWidgets, { [$style.desktopWidgetsSolid]: !glassEffect }]" :data-collapsed="rightWidgetsCollapsed" :data-motion="prefer.r.animation.value" :data-widget-border="showWidgetBorder ? 'on' : 'off'">
		<div v-if="glassEffect" :class="$style.desktopWidgetsBanner">
			<img v-if="$i?.bannerUrl" :src="$i.bannerUrl" :class="$style.desktopWidgetsBannerImg"/>
		</div>
		<div :class="$style.desktopWidgetsInner">
			<XWidgets collapsible :collapsed="rightWidgetsCollapsed" @toggleCollapse="rightWidgetsCollapsed = !rightWidgetsCollapsed"/>
		</div>
	</div>

	<XCommon v-model:widgetsShowing="widgetsShowing" :loadingIntegrated="nativeNavbarVisible && !!notificationOutlineEl"/>
</div>
</template>

<script lang="ts" setup>
import { ref, computed, provide, onMounted, onUnmounted, nextTick, defineAsyncComponent, watch } from 'vue';
import { instanceName } from '@@/js/config.js';
import XCommon from './_common_/common.vue';
import MkTimelineNewNotesContent from '@/components/MkTimelineNewNotesContent.vue';
import MkNavbarLoadingRing from '@/components/MkNavbarLoadingRing.vue';
import { pendingApiRequestsCount } from '@/utility/misskey-api.js';
import { createHataskeyNotificationToasts, getToastDuration, hataskeyNotificationToastsKey, NOTIFICATION_TOAST_DURATION } from '@/utility/hataskey-notification-toast.js';
import type { HataskeyNavbarNotice } from '@/utility/hataskey-notification-toast.js';
import MkNotificationToastRing from '@/components/MkNotificationToastRing.vue';
import { attachNavbarPullGesture, createNavbarPullRefresh, navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import { useHataskeyNavbarNotices } from '@/composables/use-hataskey-navbar-notices.js';
import { attachIOSViewportRecovery } from '@/utility/ios-viewport-recovery.js';
import MkMobileNavbarSearch from '@/components/MkMobileNavbarSearch.vue';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';
import { createHataskeyTimelineNewNotes, hataskeyTimelineNewNotesKey, useRetainedHataskeyTimelineNewNotes } from '@/utility/hataskey-timeline-new-notes.js';
import type { PageMetadata } from '@/page.js';
import type { TimelineCollectionKind } from '@/utility/hatasaba-navigation.js';
import type { HataSideButton, HataSideGroup, HataSideWidget, HataSideWidgetKind } from '@/utility/hata-side-studio.js';
import { globalEvents } from '@/events.js';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import { SIDEBAR_ICON_OVERRIDES } from '@/utility/sidebar-icon-overrides.js';
import { navbarItemDef } from '@/navbar.js';
import { getHataSideWidgetDisplayLabel, HATA_SIDE_WIDGET_REGISTRY } from '@/utility/hata-side-studio-widgets.js';
import { useFoldableScrollAnchor, useFoldableWide } from '@/utility/hata-foldable.js';
// 旗鯖fork: トレンドタイムライン (TTL)
import MkTrendingTimeline from '@/components/MkTrendingTimeline.vue';
import { acceptNotificationUnreadState } from '@/utility/notification-unread-state.js';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';
import { provideMetadataReceiver, provideReactiveMetadata } from '@/page.js';
import { mainRouter } from '@/router.js';
import { DI } from '@/di.js';
import * as os from '@/os.js';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';
import { isHataskeyTimelineAllowed } from '@/utility/hataskey-timeline-availability.js';
import { antennasCache, userListsCache } from '@/cache.js';
import { createTimelineTabGestures } from '@/utility/timeline-tab-gestures.js';
import { deckIgnoreWidth, glassUiLocal, tabSwipeEnabled, rightWidgetsCollapsed as savedRightWidgetsCollapsed, setRightWidgetsCollapsed } from '@/utility/hatasaba-device-prefs.js';
import { prefer } from '@/preferences.js';
import { cleanupStaleUiElements } from '@/utility/ui-cleanup.js';
import { clearCache } from '@/utility/clear-cache.js';
import { playHataIconMotion, playHataNavigationMotion } from '@/utility/hata-icon-motion.js';
import { createHataTimelineCollapseEffect } from '@/utility/hata-timeline-collapse-effect.js';
import { getAccountMenu, updateCurrentAccount } from '@/accounts.js';
import { instance } from '@/instance.js';
import { store } from '@/store.js';
import { deepMerge } from '@/utility/merge.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { openInstanceMenu } from '@/ui/_common_/common.js';
import { miLocalStorage } from '@/local-storage.js';
import { getPreferredTimelinePath, getVisibleBottomNav, isAntennaTimelinePath, isListTimelinePath } from '@/utility/hatasaba-navigation.js';
import {
	applyHataSideStudioStore, cloneHataSideStudioStore, ensureHataSideStudioInitialized,
	getActiveHataSideProfile, getHataSideStudioGroupDisplayName, getHataSideStudioMenuDisplayLabel, gradientCss, hataSideStudioStore,
} from '@/utility/hata-side-studio.js';

const XWidgets = defineAsyncComponent(() => import('./_common_/widgets.vue'));
const XAnnouncements = defineAsyncComponent(() => import('./_common_/announcements.vue'));
const HatasabaDeck = defineAsyncComponent(() => import('./_common_/hatasaba-deck.vue'));
// 旗鯖fork: 「タイムライン上部に投稿フォームを表示する」設定で使用
const MkPostForm = defineAsyncComponent(() => import('@/components/MkPostForm.vue'));
const copy = i18n.ts._hata._hatasabaUi._simple;
const copyx = i18n.tsx._hata._hatasabaUi._simple;
const simpleNumberFormatter = new Intl.NumberFormat(versatileLang);
const simpleClockFormatter = new Intl.DateTimeFormat(versatileLang, { hour: '2-digit', minute: '2-digit' });
const simpleShortDateFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'short', day: 'numeric', weekday: 'short' });

const SIMPLE_MENU_STORAGE_LABELS: Readonly<Record<string, string>> = {
	following: 'ホーム',
	home: 'ホーム',
	local: 'ローカル',
	social: 'ソーシャル',
	mixed: 'グローバル',
	trending: 'トレンド',
	timeline: 'タイムライン',
	search: '検索',
	notifications: '通知',
	chat: 'メッセージ',
	announcements: 'お知らせ',
	drive: 'ドライブ',
	favorites: 'お気に入り',
	uiSetup: 'UI切り替え',
	explore: 'みつける',
	followRequests: 'フォロー申請',
	channels: 'チャンネル',
	more: 'もっと',
	reload: 'リロード',
	cacheClear: 'キャッシュをクリア',
};

function simpleMenuDisplayLabel(id: string, storedLabel?: string): string {
	const canonical = SIMPLE_MENU_STORAGE_LABELS[id];
	const fallback = typeof storedLabel === 'string' && storedLabel.length > 0 ? storedLabel : canonical ?? id;
	if (canonical == null) return fallback;
	if (typeof storedLabel === 'string' && storedLabel.length > 0 && storedLabel !== canonical) return storedLabel;
	return (copy.menuLabels as Record<string, string>)[id] ?? getHataSideStudioMenuDisplayLabel(id, fallback);
}

function studioButtonLabel(item: HataSideButton): string {
	return simpleMenuDisplayLabel(item.menuId, getHataSideStudioMenuDisplayLabel(item.menuId, item.label));
}

function studioWidgetLabel(item: HataSideWidget): string {
	return getHataSideWidgetDisplayLabel(item.kind, item.label);
}

provide(DI.router, mainRouter);

const pageMetadata = ref<null | PageMetadata>(null);
provideMetadataReceiver((metadataGetter) => {
	const info = metadataGetter();
	pageMetadata.value = info;
	if (pageMetadata.value) {
		const isRoot = mainRouter.currentRoute.value.name === 'index';
		if (isRoot && pageMetadata.value.title === instanceName) {
			window.document.title = pageMetadata.value.title;
		} else {
			window.document.title = `${pageMetadata.value.title} | ${instanceName}`;
		}
	}
});
provideReactiveMetadata(pageMetadata);

const navbarSearchOpen = ref(false);
const navbarSearchShell = ref<HTMLElement | null>(null);
const navbarSearchTrigger = ref<HTMLButtonElement | null>(null);
const navbarSearchContent = ref<InstanceType<typeof MkMobileNavbarSearch> | null>(null);
const navbarSearchHeight = ref(59);
const navbarSearchViewportHeight = ref(window.visualViewport?.height ?? window.innerHeight);
const navbarSearchKeyboardInset = ref(0);
const navbarSearchMaxHeight = computed(() => Math.max(0, navbarSearchViewportHeight.value - 150));
let navbarSearchFocusVersion = 0;
const simpleDrawerShowing = ref(false);
const widgetsShowing = ref(false);

// 旗鯖fork: デッキモード (デスクトップのみ)。サイドメニュー下部のトグルで切替。
const deckMode = prefer.r['simpleUi.deckMode'];
const deckActive = computed(() => isDesktop.value && deckMode.value && !isPageView.value);
// 旗鯖fork: デッキを初めて開いた時、チュートリアル(ウィザード)を表示する。
// watch の登録は isDesktop/isPageView 定義後に行う(下方の onMounted 付近)。
let deckTutorialShown = false;

function maybeShowDeckTutorial() {
	if (deckTutorialShown) return;
	if (prefer.r['simpleUi.deckTutorialDone']?.value) return;
	deckTutorialShown = true;
	const { dispose } = os.popup(defineAsyncComponent(() => import('./_common_/HatasabaDeckTutorial.vue')), {}, { closed: () => dispose() });
}

// 旗鯖fork: 上部メニューモード(デスクトップのみ)。ONで左サイドバーを隠し上部ナビバーを出す。
const topNavMode = prefer.r['simpleUi.topNavMode'];
const topNavActive = computed(() => isDesktop.value && topNavMode.value && !isPageView.value);
// 旗鯖fork: デッキ背景のヘッダー画像ぼかしを使わないオプション
const deckNoBannerBg = computed(() => prefer.r['simpleUi.deckNoBannerBg'].value);
// 旗鯖fork: 通常表示(デッキUIではない)タイムライン背景のヘッダー画像ぼかしを使わないオプション
const normalNoBannerBg = computed(() => prefer.r['simpleUi.normalNoBannerBg'].value);
// 旗鯖fork: .timelineBanner(背景ぼかし)が実際に表示されているかどうか。
// 表示されている時だけノートカードを半透明化するため、同じ条件を MkStreamingNotesTimeline へ渡す。
// 旗鯖fork(ベータ): 通常表示タイムラインの背景ぼかしは Hataskey UI 2(glassUiLocal)有効時のみ適用する。
// Hataskey UI 2 は「背景ぼかし + ノート透過」のセット機能で、それ以外の状況(単なる glassEffect ON
// 等)では通常表示のタイムライン背景にぼかしを敷かない = 従来のノート表示を維持する。
const timelineGlassBg = computed(() => !isPageView.value && !deckActive.value && glassUiLocal.value && !normalNoBannerBg.value && !!$i?.bannerUrl);

function setDeckMode(v: boolean) {
	prefer.commit('simpleUi.deckMode', v);
}

// 旗鯖fork: 左サイドメニューの手動縮小(折りたたみ)。
// deckActive(デッキ時の自動折りたたみ)とは独立。どちらかが真なら畳む。
const sidebarCollapsed = computed({ get: () => prefer.r['simpleUi.sidebarCollapsed'].value, set: value => prefer.commit('simpleUi.sidebarCollapsed', value) });
const rightWidgetsCollapsed = computed({ get: () => savedRightWidgetsCollapsed.value, set: setRightWidgetsCollapsed });
// 旗鯖fork(#12): サイドメニューがアイコンのみ(折りたたみ/デッキ)のとき、ホバーでラベルチップを出すための判定。
const sidebarFolded = computed(() => deckActive.value || sidebarCollapsed.value);

function toggleSidebarCollapse() {
	sidebarCollapsed.value = !sidebarCollapsed.value;
}

// 横ホイールも幅にかかわらず、表示中のタイムラインへ渡す。
function onContentWheel(event: WheelEvent) { timelineTabGestures.wheel(event); }

// ===== デスクトップ判定 =====
const DESKTOP_THRESHOLD = 1100;
// 旗鯖fork: 横開きの折りたたみ端末(メインディスプレイ)向け。PC幅未満でもウィジェットを常時出す。
const isFoldableWide = useFoldableWide(DESKTOP_THRESHOLD);
// 折りたたむ/開くでレイアウトが切り替わっても、読んでいた位置を保つ。
useFoldableScrollAnchor(isFoldableWide, () => contentEl.value);
const windowWidth = ref(window.innerWidth);
// 旗鯖fork(#6): 「画面幅に関係なくデッキ表示」設定がON かつ デッキモードONのときは、
// 狭幅でもデスクトップ相当のレイアウト(=デッキが使える)として扱う。
// これは端末ローカル設定(hatasaba-device-prefs)なので、スマホ等にプロファイル共有されない。
const isDesktop = computed(() => (deckIgnoreWidth.value && deckMode.value) ? true : windowWidth.value >= DESKTOP_THRESHOLD);

function onResize() {
	updateNavbarSearchViewport();
	windowWidth.value = window.innerWidth;
	nextTick(() => { updateSbFade(); });
}

window.addEventListener('resize', onResize);

// ===== テーマ判定 =====
const footerIsDark = ref(true);

function detectThemeBrightness() {
	let r = 0, g = 0, b = 0;
	let found = false;

	// Strategy 1: CSS custom property
	const cs = window.getComputedStyle(window.document.documentElement);
	for (const prop of ['--MI_THEME-bg', '--MI_THEME-panel', '--bg', '--panel']) {
		const val = cs.getPropertyValue(prop).trim();
		if (val) {
			const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
			if (m) { r = +m[1]; g = +m[2]; b = +m[3]; found = true; break; }
			if (val.startsWith('#')) {
				const h = val.replace('#', '');
				if (h.length >= 6) { r = parseInt(h.substring(0, 2), 16); g = parseInt(h.substring(2, 4), 16); b = parseInt(h.substring(4, 6), 16); found = true; break; }
				if (h.length === 3) { r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16); found = true; break; }
			}
		}
	}

	// Strategy 2: Computed background-color of root element or body
	if (!found) {
		for (const el of [window.document.documentElement, window.document.body, window.document.querySelector('.root') as HTMLElement | null]) {
			if (!el) continue;
			const bgc = window.getComputedStyle(el).backgroundColor;
			const m = bgc?.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
			if (m && bgc !== 'rgba(0, 0, 0, 0)') { r = +m[1]; g = +m[2]; b = +m[3]; found = true; break; }
		}
	}

	// Strategy 3: Misskey data-color-mode attribute
	if (!found) {
		const mode = window.document.documentElement.getAttribute('data-color-mode');
		if (mode === 'light') { footerIsDark.value = false; return; }
		if (mode === 'dark') { footerIsDark.value = true; return; }
	}

	footerIsDark.value = !found || (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

let themeObs: MutationObserver | null = null;
let darkMql: MediaQueryList | null = null;
let darkMqlH: ((e:MediaQueryListEvent)=>void) | null = null;

function startThemeWatch() {
	detectThemeBrightness();
	themeObs = new MutationObserver(() => {
		window.setTimeout(detectThemeBrightness, 50);
		window.setTimeout(detectThemeBrightness, 300);
	});
	themeObs.observe(window.document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'class', 'style'] });
	darkMql = window.matchMedia('(prefers-color-scheme:dark)');
	darkMqlH = () => { window.setTimeout(detectThemeBrightness, 50); };
	darkMql.addEventListener('change', darkMqlH);
}

function stopThemeWatch() {
	themeObs?.disconnect(); themeObs = null;
	if (darkMql && darkMqlH) darkMql.removeEventListener('change', darkMqlH);
	darkMql = null; darkMqlH = null;
}

// ===== スクロール検知 =====
const announcementsEl = ref<HTMLElement | null>(null);
const announcementsHeight = ref(0);
let announcementsObserver: ResizeObserver | null = null;

function updateAnnouncementsHeight() {
	announcementsHeight.value = announcementsEl.value?.offsetHeight ?? 0;
}

function startAnnouncementsObserver() {
	if (!announcementsEl.value || announcementsObserver) return;
	updateAnnouncementsHeight();
	announcementsObserver = new ResizeObserver(updateAnnouncementsHeight);
	announcementsObserver.observe(announcementsEl.value);
}

function stopAnnouncementsObserver() {
	announcementsObserver?.disconnect();
	announcementsObserver = null;
}

const contentEl = ref<HTMLElement | null>(null);
const timelineCollapseRoot = ref<HTMLElement | null>(null);
const timelineCollapseEffect = createHataTimelineCollapseEffect({
	root: () => timelineCollapseRoot.value,
	animationEnabled: () => prefer.r.animation.value,
});

// 設定同期などで演出が途中から無効になった場合も、その場で元の表示へ戻す。
watch(prefer.r.animation, (enabled) => {
	if (!enabled) timelineCollapseEffect.cancel();
});

// 旗鯖fork: サイドメニューのスクロールバーを隠し、続きがある時だけ上下にフェードを出す
const sbScrollEl = ref<HTMLElement | null>(null);
const sbFadeTop = ref(false);
const sbFadeBottom = ref(false);

function updateSbFade() {
	const el = sbScrollEl.value;
	if (!el) { sbFadeTop.value = false; sbFadeBottom.value = false; return; }
	const top = el.scrollTop;
	const max = el.scrollHeight - el.clientHeight;
	sbFadeTop.value = top > 1;
	sbFadeBottom.value = top < max - 1;
}

function onSbScroll() {
	updateSbFade();
	const el = sbScrollEl.value;
	if (el) el.style.setProperty('--hss-parallax', studioProfile.value.expanded.parallax && !sidebarFolded.value ? `${Math.round(el.scrollTop * -0.035)}px` : '0px');
}

const showBottomBar = ref(true);
const showTopBar = ref(true);
let lastScrollY = 0;
let scrollTimer: number | null = null;

function onContentScroll() {
	if (!contentEl.value) return;
	const sy = contentEl.value.scrollTop;
	const diff = sy - lastScrollY;
	if (diff > 35 && !navbarSearchOpen.value) { showBottomBar.value = false; showTopBar.value = false; }
	if (diff < -25) { showBottomBar.value = true; showTopBar.value = true; }
	lastScrollY = sy;
	if (scrollTimer) window.clearTimeout(scrollTimer);
	scrollTimer = window.setTimeout(() => { showBottomBar.value = true; showTopBar.value = true; }, 400);
}

// ===== ページ判定 =====
const HOME_ROUTES = new Set(['index', 'timeline']);
const isPageView = ref(false);
const isSearchPage = computed(() => { const r = mainRouter.currentRoute.value; return r.name === 'search' || r.path === '/search'; });
const isNotifPage = computed(() => mainRouter.currentRoute.value.path === '/my/notifications');
const isListTimelinePage = computed(() => isListTimelinePath(mainRouter.currentRoute.value.path));
const isListPage = computed(() => mainRouter.currentRoute.value.path.startsWith('/my/lists') || isListTimelinePage.value);
const isChannelPage = computed(() => mainRouter.currentRoute.value.path.startsWith('/channels'));
// 旗鯖fork: チャンネル個別ページ (/channels/:id) の判定。一覧 (/channels) は除外。
// 個別ページはページ下部に「チャンネルへ投稿」ボタンがあり、下部ナビバーが被さって
// タップできなくなるため、個別ページでは下部ナビバーを隠す。
const isChannelDetailPage = computed(() => {
	const p = mainRouter.currentRoute.value.path;
	return /^\/channels\/[^/]+/.test(p);
});
const isAntennaTimelinePage = computed(() => isAntennaTimelinePath(mainRouter.currentRoute.value.path));
const isAntennaPage = computed(() => mainRouter.currentRoute.value.path.startsWith('/my/antennas') || isAntennaTimelinePage.value);
const isCollectionTimelinePage = computed(() => isListTimelinePage.value || isAntennaTimelinePage.value);
/**
 * 旗鯖fork: 設定画面かどうか。
 * ⚠️再設計の設定画面は自前で見出しと戻る操作を持つので、本体のページヘッダーを
 *   重ねて出すと帯が2本並んでしまう。設定の下位ページも含めて対象にする。
 */
const isSettingsPage = computed(() => {
	// ⚠️まず currentRoute（ref）を読んで依存を作る。これが無いと computed が
	//   一度計算したきり更新されず、画面を移っても帯が消えない。
	//   ⚠️getCurrentFullPath() はただのプロパティでリアクティブではない。
	const route = mainRouter.currentRoute.value;
	// ⚠️設定の下位ルートは router.definition.ts で '/profile' のように
	//   親を含まない形で定義されている。route.path だけでは取りこぼすので実URLを見る。
	const path = (route == null ? '' : mainRouter.getCurrentFullPath()).split('?')[0].split('#')[0];
	return path === '/settings' || path.startsWith('/settings/');
});
// currentRoute.path は実URLではなく `/timeline/list/:listId` のようなルート定義。
// ここからIDを切り出すと文字列 `:listId` を管理画面へ渡してしまうため、
// 解決済みルートの props から実際のIDを読む。
const activeListId = computed(() => {
	if (!isListTimelinePage.value) return null;
	const id = mainRouter.currentRef.value.props.get('listId');
	return typeof id === 'string' && id.length > 0 ? id : null;
});
const activeAntennaId = computed(() => {
	if (!isAntennaTimelinePage.value) return null;
	const id = mainRouter.currentRef.value.props.get('antennaId');
	return typeof id === 'string' && id.length > 0 ? id : null;
});
const timelinePickerKind = ref<TimelineCollectionKind | null>(null);
const activeCollectionId = computed(() => timelinePickerKind.value === 'list' ? activeListId.value : activeAntennaId.value);
const activeListName = computed(() => userListsCache.value.value?.find(item => item.id === activeListId.value)?.name ?? String(pageMetadata.value?.title ?? ''));
const activeAntennaName = computed(() => antennasCache.value.value?.find(item => item.id === activeAntennaId.value)?.name ?? String(pageMetadata.value?.title ?? ''));
const timelinePickerItems = computed(() => timelinePickerKind.value === 'list' ? (userListsCache.value.value ?? []) : (antennasCache.value.value ?? []));
const isHomeTL = computed(() => !isPageView.value && !isSearchPage.value && !isNotifPage.value);

const checkIsPageView = () => { isPageView.value = !HOME_ROUTES.has(mainRouter.currentRoute.value.name as string); };

mainRouter.on('change', () => {
	closeNavbarSearch(false);
	checkIsPageView();
	rememberCurrentCollection();
	timelinePickerKind.value = null;
	simpleDrawerShowing.value = false;
	showBottomBar.value = true;
	showTopBar.value = true;
	// テーマ再検出（ページ遷移でテーマが変わる場合）
	window.setTimeout(detectThemeBrightness, 100);
});

// ===== タブ =====
// 旗鯖fork: 'trending' を追加 (トレンドタイムライン (TTL))
type TabType = 'following' | 'mixed' | 'local' | 'social' | 'trending';

// 旗鯖fork: 再読み込み時に最後のタブを復元する。
// 復元できない場合は 'following' にフォールバックする。
function getInitialTab(): TabType {
	const saved = miLocalStorage.getItem('hatasabaUiLastTab') as TabType | null;
	const restorable: TabType[] = ['following', 'mixed', 'local', 'social', 'trending'];
	if (saved != null && restorable.includes(saved) && isHataskeyTimelineAllowed(saved)) return saved;
	return 'following';
}

const tab = ref<TabType>(getInitialTab());
const timelineSlideDirection = ref<1 | -1>(1);

// Role changes also retire the active stream; saved tab preferences are retained.
watch(() => isHataskeyTimelineAllowed(tab.value), allowed => {
	if (!allowed) tab.value = 'following';
}, { flush: 'sync' });

// ===== prefer連動: 上部タブ =====
// 旗鯖fork: トレンドタブ (TTL) は専用トグル simpleUi.showTrendingTab で制御し、
// 有効時は topNav 設定とは独立して最左に差し込む (既存ユーザーの topNav 設定を変更しないため)
const visibleTopTabs = computed(() => {
	const saved = (prefer.r['simpleUi.topNav'].value as any[]).filter((t: any) => t.visible && t.id !== 'trending' && t.id !== 'hatady' && isHataskeyTimelineAllowed(t.id));
	const tabs = [...saved];
	if (prefer.r['simpleUi.showTrendingTab'].value) tabs.push({ id: 'trending', icon: 'ti ti-flame', label: i18n.ts._timelines.trending, visible: true });
	return tabs;
});
const tabOrder = computed<TabType[]>(() => {
	const tabs: TabType[] = visibleTopTabs.value.map((t: any) => t.id as TabType);
	return tabs;
});

watch(tab, (next, previous) => {
	const order = tabOrder.value;
	const from = order.indexOf(previous);
	const to = order.indexOf(next);
	if (from >= 0 && to >= 0 && from !== to) timelineSlideDirection.value = to > from ? 1 : -1;
}, { flush: 'sync' });

// ===== prefer連動: 下部ナビ =====
const visibleBottomNav = computed(() => getVisibleBottomNav(prefer.r['simpleUi.bottomNav'].value));
const bottomNavHasPage = computed(() => {
	const ids = visibleBottomNav.value.map((t: any) => t.id);
	return (ids.includes('search') && isSearchPage.value)
        || (ids.includes('notifications') && isNotifPage.value)
        || isListPage.value || isChannelPage.value || isAntennaPage.value;
});

// ===== prefer連動: ウィジェット縁色 =====
const showWidgetBorder = computed(() => prefer.r['simpleUi.widgetBorder'].value);

// ===== prefer連動: すりガラス効果 =====
const glassEffect = computed(() => prefer.r['simpleUi.glassEffect'].value);
// 旗鯖fork: Hataskey UI のページヘッダー(タイトル+戻るボタン)の表示制御。
// デフォルト false: ページ自身の MkPageHeader と二重表示になるため非表示。
// アクセシビリティ設定からON切替可能。
const showPageHeader = computed(() => prefer.r['simpleUi.showPageHeader'].value);

// ===== prefer連動: サイドバー =====
const sidebarOrder = computed(() => prefer.r['simpleUi.sidebar'].value as any[]);
// HataSideStudio は端末ローカル。初回だけ、既存の prefer 側サイドバー順を材料にして
// 拡大/縮小の両レイアウトを作るため、これまでの利用者の並びを失わない。
ensureHataSideStudioInitialized(sidebarOrder.value);
const studioProfile = computed(() => getActiveHataSideProfile(hataSideStudioStore.value));
const studioPostButtonIcon = computed(() => studioProfile.value.postButton.icon === 'paw' ? 'ti ti-paw' : 'ti ti-pencil');
const composeLabel = computed(() => copy.note);
const composeIcon = computed(() => studioPostButtonIcon.value);
const studioPostButtonStyle = computed(() => ({
	background: gradientCss(studioProfile.value.postButton),
	color: studioProfile.value.postButton.foreground,
}));
const studioExpandedNodes = computed(() => studioProfile.value.expanded.nodes);
const studioCollapsedButtons = computed(() => studioProfile.value.collapsed.buttons);
const studioLargeMenuKey = computed(() => {
	const ids = new Set<string>();
	for (const node of studioExpandedNodes.value) {
		if (node.type === 'button' && node.size === 'large' && node.shape !== 'circle' && studioMenuItemAvailable(node.menuId)) ids.add(node.menuId);
		if (node.type === 'group') {
			for (const child of node.children) {
				if (child.type === 'button' && child.size === 'large' && child.shape !== 'circle' && studioMenuItemAvailable(child.menuId)) ids.add(child.menuId);
			}
		}
	}
	return [...ids].sort().join('|');
});
type StudioLargePreview = {
	lines: string[];
	signals?: string[];
	targetPath?: string;
};
type StudioButtonSignal = {
	label: string;
	targetPath: string;
};
const studioLargePreviews = ref<Record<string, StudioLargePreview>>({});
const studioLargeLoadedAt = new Map<string, number>();
const studioLargeInFlight = new Map<string, Promise<void>>();
const studioNow = ref(new Date());
let studioClockTimer: number | null = null;
onMounted(() => { studioClockTimer = window.setInterval(() => { studioNow.value = new Date(); }, 30_000); });
onUnmounted(() => { if (studioClockTimer) window.clearInterval(studioClockTimer); });

watch(studioLargeMenuKey, (key) => {
	for (const menuId of key.split('|').filter(Boolean)) void loadStudioLargePreview(menuId);
}, { immediate: true });

function studioIcon(item: HataSideButton): string {
	return SIDEBAR_ICON_OVERRIDES[item.menuId] ?? item.icon;
}

function studioMenuItemAvailable(menuId: string): boolean {
	const definition = (navbarItemDef as unknown as Record<string, { show?: boolean } | undefined>)[menuId];
	return definition?.show !== false;
}

function studioItemStyle(item: HataSideButton | HataSideWidget) {
	const rotation = 'rotation' in item ? item.rotation : 0;
	const borderVisible = item.type !== 'button' || item.borderVisible !== false;
	const savedWidgetMinHeight = item.type === 'widget' ? item.sizeSettings[item.size].minHeight : 0;
	const registryWidgetMinHeight = item.type === 'widget' ? HATA_SIDE_WIDGET_REGISTRY[item.kind].sizes[item.size].minHeight : 0;
	const widgetMinHeight = item.type === 'widget' && item.kind === 'aichan'
		? Math.max(savedWidgetMinHeight, registryWidgetMinHeight)
		: savedWidgetMinHeight;
	return {
		'--hss-bg': gradientCss(item),
		'--hss-border': item.border,
		'--hss-border-width': `${borderVisible ? (item.borderWidth ?? 1) : 0}px`,
		'--hss-border-style': item.borderStyle ?? 'solid',
		'--hss-fg': item.foreground,
		'--hss-rotation': `${rotation}deg`,
		// 横幅220pxの一列ボタンを最大12度回しても、前後の項目や枠線を侵食しない予約領域。
		// 回転しない大多数の項目は従来同等の2pxだけなので、一覧が間延びしない。
		'--hss-rotation-space': `${rotation === 0 ? 1 : Math.ceil(Math.abs(rotation) * 1.6 + 1)}px`,
		...(item.type === 'widget' ? {
			'--hss-widget-min-height': `${widgetMinHeight}px`,
			...(item.kind === 'aichan' ? { '--hss-aichan-scale': String(Math.min(1, widgetMinHeight / 350)) } : {}),
		} : {}),
	};
}

function studioGroupStyle(group: HataSideGroup) {
	return {
		'--hss-bg': gradientCss(group),
		'--hss-border': group.border,
		'--hss-border-width': `${group.borderWidth ?? 1}px`,
		'--hss-border-style': group.borderStyle ?? 'solid',
		'--hss-fg': group.foreground,
	};
}

function studioItemClick(item: HataSideButton, ev: MouseEvent) {
	if (item.targetId && item.menuId === 'lists') {
		playHataNavigationMotion(ev, `list:${item.targetId}`, 620);
		miLocalStorage.setItem('hatasabaLastListId', item.targetId);
		mainRouter.pushByPath(`/timeline/list/${item.targetId}`);
		return;
	}
	if (item.targetId && item.menuId === 'antennas') {
		playHataNavigationMotion(ev, `antenna:${item.targetId}`, 620);
		miLocalStorage.setItem('hatasabaLastAntennaId', item.targetId);
		mainRouter.pushByPath(`/timeline/antenna/${item.targetId}`);
		return;
	}
	const previewTarget = item.size === 'large' ? studioLargePreviews.value[item.menuId]?.targetPath : null;
	if (previewTarget) {
		playHataNavigationMotion(ev, item.menuId, 620);
		mainRouter.pushByPath(previewTarget as never);
		return;
	}
	sidebarItemClick(item.menuId, ev);
}

function studioPlainText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function studioRecord(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function studioRecords(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value) ? value.filter(item => item != null && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>> : [];
}

function studioCountLabel(count: number, limit = 100): string {
	return count >= limit
		? copyx.countAtLeast({ count: simpleNumberFormatter.format(limit) })
		: copyx.count({ count: simpleNumberFormatter.format(count) });
}

function studioDateKey(date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function studioMinutesLabel(minutes: number): string {
	const safe = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
	if (safe < 60) return copyx.minutes({ count: simpleNumberFormatter.format(safe) });
	const hours = Math.floor(safe / 60);
	const rest = safe % 60;
	return rest === 0
		? copyx.hours({ count: simpleNumberFormatter.format(hours) })
		: copyx.hoursMinutes({ hours: simpleNumberFormatter.format(hours), minutes: simpleNumberFormatter.format(rest) });
}

function setStudioLargePreview(menuId: string, preview: StudioLargePreview): void {
	studioLargePreviews.value = { ...studioLargePreviews.value, [menuId]: preview };
}

function studioNotificationLines(notification: Record<string, unknown>): string[] {
	const user = studioRecord(notification.user);
	const note = studioRecord(notification.note);
	const actor = studioPlainText(user.name) || (user.username ? `@${user.username}` : copy.notificationSource);
	const typeLabels: Record<string, string> = {
		reaction: copy.notificationReaction, reply: copy.notificationReply, mention: copy.notificationMention,
		quote: copy.notificationQuote, renote: copy.notificationRenote, follow: copy.notificationFollow,
		receiveFollowRequest: copy.notificationFollowRequest, followRequestAccepted: copy.notificationFollowAccepted,
		pollEnded: copy.notificationPollEnded, achievementEarned: copy.notificationAchievement,
		chatRoomInvitationReceived: copy.notificationChatInvite, channelInvitationReceived: copy.notificationChannelInvite,
	};
	const heading = notification.header ? studioPlainText(notification.header) : `${actor}${typeLabels[String(notification.type)] ?? copy.notificationFallback}`;
	const body = studioPlainText(notification.body) || studioPlainText(note.cw) || studioPlainText(note.text);
	return [heading, body].filter(Boolean);
}

async function loadStudioLargePreview(menuId: string, force = false): Promise<void> {
	const supported = new Set(['notifications', 'announcements', 'chat', 'channels']);
	if (!supported.has(menuId)) return;
	// 公開APIのお知らせ以外は認証必須。保存済みprofileをログアウト状態で復元してもAPIを空打ちしない。
	if ($i == null && menuId !== 'announcements') return;
	if (!force && Date.now() - (studioLargeLoadedAt.get(menuId) ?? 0) < 5 * 60_000) return;
	const active = studioLargeInFlight.get(menuId);
	if (active) return active;

	const task = (async() => {
		try {
			const { misskeyApi } = await import('@/utility/misskey-api.js');
			const api = misskeyApi as unknown as (endpoint: string, params: Record<string, unknown>) => Promise<unknown>;

			if (menuId === 'notifications') {
				const rows = studioRecords(await api('i/notifications', { limit: 1, markAsRead: false }));
				if (rows[0]) {
					setStudioLargePreview(menuId, { lines: studioNotificationLines(rows[0]) });
				} else {
					setStudioLargePreview(menuId, { lines: [copy.noNewNotifications] });
				}
			} else if (menuId === 'announcements') {
				const items = studioRecords(await api('announcements', { limit: 5, isActive: true }));
				const maintenance = items.filter(item => item?.icon === 'maintenance');
				const latest = items.find(item => item?.icon !== 'maintenance');
				const lines = [
					...maintenance.slice(0, 3).map(item => copyx.maintenanceTitle({ title: studioPlainText(item.title) })),
					...(latest ? [copyx.latestTitle({ title: studioPlainText(latest.title) })] : []),
				].filter(line => !line.endsWith(': '));
				setStudioLargePreview(menuId, {
					lines: lines.length > 0 ? lines : [copy.noAnnouncements],
					signals: [copyx.maintenanceCount({ count: studioCountLabel(maintenance.length) }), copyx.announcementCount({ count: studioCountLabel(items.length - maintenance.length) })],
				});
			} else if (menuId === 'chat') {
				const [userRows, roomRows] = await Promise.all([
					api('chat/history', { room: false }),
					api('chat/history', { room: true }),
				]);
				const latest = [...studioRecords(userRows), ...studioRecords(roomRows)]
					.toSorted((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())[0];
				if (latest) {
					const isRoom = latest.toRoomId != null;
					const other = studioRecord(latest.fromUserId === $i?.id ? latest.toUser : latest.fromUser);
					const room = studioRecord(latest.toRoom);
					const name = isRoom ? (studioPlainText(room.name) || copy.groupChat) : (studioPlainText(other.name) || (other.username ? `@${other.username}` : copy.directChat));
					const targetId = isRoom ? latest.toRoomId : other?.id;
					setStudioLargePreview(menuId, {
						lines: [copyx.lastRoom({ name }), studioPlainText(latest.text) || copy.chatAttachment],
						targetPath: targetId ? (isRoom ? `/chat/room/${targetId}` : `/chat/user/${targetId}`) : '/chat',
					});
				} else {
					setStudioLargePreview(menuId, { lines: [copy.noChatHistory], targetPath: '/chat' });
				}
			} else if (menuId === 'channels') {
				const followed = studioRecords(await api('channels/followed', { limit: 100 }));
				const channel = followed.toSorted((a, b) => new Date(String(b.lastNotedAt ?? 0)).getTime() - new Date(String(a.lastNotedAt ?? 0)).getTime())[0];
				if (channel) {
					const notes = await api('channels/timeline', { channelId: channel.id, limit: 1 });
					const note = studioRecords(notes)[0];
					const noteUser = studioRecord(note?.user);
					const author = studioPlainText(noteUser.name) || (noteUser.username ? `@${noteUser.username}` : copy.newPostAuthor);
					const body = studioPlainText(note?.cw) || studioPlainText(note?.text) || (note ? copy.attachmentPost : copy.noNewPosts);
					setStudioLargePreview(menuId, {
						lines: [studioPlainText(channel.name) || copy.followedChannel, copyx.authorContent({ author, content: body })],
						targetPath: `/channels/${channel.id}`,
					});
				} else {
					setStudioLargePreview(menuId, { lines: [copy.noFollowedChannels], targetPath: '/channels' });
				}
			}
			studioLargeLoadedAt.set(menuId, Date.now());
		} catch {
			// サイドメニューの補助表示なので、取得失敗時は既存の汎用文言をそのまま使う。
		}
	})();
	studioLargeInFlight.set(menuId, task);
	try {
		await task;
	} finally {
		studioLargeInFlight.delete(menuId);
	}
}

function studioButtonDetail(menuId: string): string {
	if (menuId === 'notifications') return unreadNotifCount.value > 0 ? copyx.unreadCount({ count: simpleNumberFormatter.format(unreadNotifCount.value) }) : copy.noUnread;
	if (menuId === 'announcements') return copy.announcementsDetail;
	if (menuId === 'chat') return copy.chatDetail;
	if (menuId === 'channels') return copy.channelsDetail;
	return copy.open;
}

function studioButtonLines(menuId: string): string[] {
	return studioLargePreviews.value[menuId]?.lines ?? [studioButtonDetail(menuId)];
}

function studioButtonSignals(menuId: string): StudioButtonSignal[] {
	const loaded = studioLargePreviews.value[menuId]?.signals;
	const targetPath = studioLargePreviews.value[menuId]?.targetPath ?? ({
		notifications: '/my/notifications',
		announcements: '/announcements',
		chat: '/chat',
		channels: '/channels',
	} as Record<string, string>)[menuId];
	if (!targetPath) return [];
	if (loaded) return loaded.map(label => ({ label, targetPath }));
	if (menuId === 'notifications') return [{ label: unreadNotifCount.value > 0 ? copyx.unreadCount({ count: simpleNumberFormatter.format(unreadNotifCount.value) }) : copy.noUnreadShort, targetPath }];
	if (menuId === 'announcements') return [{ label: copy.latestAnnouncement, targetPath }];
	if (menuId === 'chat') return [{ label: copy.recentChat, targetPath }];
	if (menuId === 'channels') return [{ label: copy.followedUpdates, targetPath }];
	return [];
}

function openStudioButtonSignal(signal: StudioButtonSignal): void {
	mainRouter.pushByPath(signal.targetPath as never);
}

function isStudioSearchButton(item: HataSideButton): boolean {
	return item.menuId === 'search' && item.size === 'large' && item.shape !== 'circle';
}

function submitStudioSearch(event: Event): void {
	const form = event.currentTarget as HTMLFormElement | null;
	const query = form == null ? '' : String(new FormData(form).get('query') ?? '').trim();
	mainRouter.pushByPath(query === '' ? '/search' : `/search?q=${encodeURIComponent(query)}`);
}

function submitStudioMobileSearch(event: Event): void {
	simpleDrawerShowing.value = false;
	submitStudioSearch(event);
}

function studioWidgetIcon(kind: HataSideWidgetKind): string {
	return kind === 'clock' ? 'ti ti-clock' : kind === 'notifications' ? 'ti ti-bell' : 'ti ti-speakerphone';
}

function studioWidgetNativeName(widget: HataSideWidget): string | null {
	// お知らせには対応するnative widgetがまだ無いため、無関係なRSS等へすり替えず従来の要約表示を維持する。
	if (widget.kind === 'announcements') return null;
	return widget.kind;
}

function studioWidgetContent(widget: HataSideWidget): 'compact' | 'normal' | 'detail' {
	return widget.sizeSettings[widget.size].content ?? widget.content[widget.size] ?? 'normal';
}

function studioWidgetData(widget: HataSideWidget): Record<string, unknown> {
	const data: Record<string, unknown> = {
		...(widget.data ?? {}),
		...(widget.sizeSettings[widget.size].data ?? {}),
	};
	// 旧プロファイルが4円グラフ表示(view:2)を保持していても、狭い小サイズでは
	// CPU/RAMの2枚表示へ正規化し、数値と円グラフの重なりを防ぐ。
	if (widget.kind === 'serverMetric' && widget.size === 'small') data.view = 3;
	return data;
}

function studioWidgetComponent(widget: HataSideWidget): string | null {
	const name = studioWidgetNativeName(widget);
	return name == null ? null : `widget-${name}`;
}

function studioWidgetModel(widget: HataSideWidget) {
	return {
		id: widget.id,
		name: studioWidgetNativeName(widget) ?? widget.kind,
		data: studioWidgetData(widget),
	};
}

function studioWidgetRenderKey(widget: HataSideWidget): string {
	return `${widget.id}:${widget.size}:${JSON.stringify(studioWidgetData(widget))}`;
}

function updateStudioWidgetProps(widgetId: string, data: Record<string, unknown>): void {
	const next = cloneHataSideStudioStore(hataSideStudioStore.value);
	const profile = getActiveHataSideProfile(next);
	let updated = false;
	for (const node of profile.expanded.nodes) {
		if (node.type === 'widget' && node.id === widgetId) {
			node.data = { ...(node.data ?? {}), ...data };
			updated = true;
			break;
		}
		if (node.type !== 'group') continue;
		const child = node.children.find(item => item.type === 'widget' && item.id === widgetId);
		if (child?.type === 'widget') {
			child.data = { ...(child.data ?? {}), ...data };
			updated = true;
			break;
		}
	}
	if (!updated) return;
	profile.updatedAt = new Date().toISOString();
	applyHataSideStudioStore(next);
}

function onStudioWidgetWheel(kind: HataSideWidgetKind, event: WheelEvent): void {
	if (kind !== 'postForm') return;
	const frame = event.currentTarget as HTMLElement | null;
	const footer = (event.target as HTMLElement | null)?.closest?.('.mkw-post-form footer') as HTMLElement | null;
	// 下部ツール列には独立した実幅を持たせている。ポインタがツール列上なら
	// 外側のフォームではなくツール列自身を動かし、末尾のボタンまで必ず到達させる。
	const target = footer && footer.scrollWidth > footer.clientWidth + 1 ? footer : frame;
	if (!target || target.scrollWidth <= target.clientWidth + 1) return;
	const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
	if (delta === 0) return;
	const before = target.scrollLeft;
	target.scrollLeft += delta;
	if (target.scrollLeft !== before) event.preventDefault();
}

function studioWidgetValue(kind: HataSideWidgetKind): string {
	if (kind === 'clock') return simpleClockFormatter.format(studioNow.value);
	if (kind === 'notifications') return unreadNotifCount.value > 0 ? studioCountLabel(unreadNotifCount.value) : copy.none;
	return hasUnreadAnnouncements.value ? copy.updated : copy.checked;
}

function studioWidgetDetail(kind: HataSideWidgetKind): string {
	if (kind === 'clock') return simpleShortDateFormatter.format(studioNow.value);
	if (kind === 'notifications') return copy.notificationsDetail;
	return copy.announcementsDetail;
}

function studioWidgetClick(kind: HataSideWidgetKind) {
	if (kind === 'notifications') goToNotifications();
	else if (kind === 'announcements') goToAnnouncements();
}

// 旗鯖fork: グループ見出しラベル
const sidebarGroupLabels: Record<string, string> = {
	basic: copy.groupBasic,
	hata: copy.groupHata,
	discover: copy.groupDiscover,
	more: '',
};
// 旗鯖fork: サイドバー項目をグループ単位にまとめる (group未指定の項目は 'basic' 扱いで後方互換)
// 旗鯖fork: visible === false の項目はサイドバーに表示しない。ただし必須項目
// (timeline / notifications / announcements / followRequests / more) は強制表示。
const REQUIRED_SIDEBAR_IDS = ['timeline', 'notifications', 'announcements', 'followRequests', 'more'];
// 旗鯖fork: 過去に削除された(=コード側に対応する遷移処理が無い)サイドバー項目ID。
// 既存ユーザーの simpleUi.sidebar 保存値に残っている場合、サイドメニュー/Hataskey UI上部ナビバー
// の両方で描画されないよう除外する。将来別の項目が削除された場合はここに追記する。
const DEAD_SIDEBAR_IDS = ['whatsNew', 'portal', 'hatask', 'hatafeed', 'hatady', 'hatagoes', 'earthquake', 'externalNotifications', 'mascot'];
// 旗鯖fork: アイコン override は utility/sidebar-icon-overrides.ts に集約。
// サイドバー本体と設定UI(settings/hata-custom.vue)で同じマップを参照することで、
// 「サイドバー側だけ新アイコン・設定UI側は旧アイコンのまま」という不整合を防ぐ。
// SIDEBAR_ICON_OVERRIDES は ファイル上部の import で読み込み済み (utility/sidebar-icon-overrides.ts)。
const sidebarGroups = computed(() => {
	const order = ['basic', 'hata', 'discover', 'more'];
	const groups: { key: string; label: string; items: any[] }[] = [];
	for (const item of sidebarOrder.value) {
		// 旗鯖fork: 削除済み項目(whatsNew等)は保存値に残っていても無視する
		if (DEAD_SIDEBAR_IDS.includes(item.id)) continue;
		// 旗鯖fork: visible:false は除外、ただし必須項目は強制的に表示
		if (item.visible === false && !REQUIRED_SIDEBAR_IDS.includes(item.id)) continue;
		const g = item.group ?? 'basic';
		let grp = groups.find(x => x.key === g);
		if (!grp) { grp = { key: g, label: sidebarGroupLabels[g] ?? '', items: [] }; groups.push(grp); }
		grp.items.push(SIDEBAR_ICON_OVERRIDES[item.id] ? { ...item, icon: SIDEBAR_ICON_OVERRIDES[item.id] } : item);
	}
	// 旗鯖fork: chat (メッセージ) は v5 マイグレ (boot/common.ts) で既存ユーザーの sidebar に
	// insertAfter で追加するため、動的注入は不要 (撤去)。これによりユーザーが設定 UI から
	// メッセージ項目の非表示・並び替えを通常の sidebar 項目として行えるようになる。
	// グループの表示順を固定 (定義順に依存しないように)
	return groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
});

function prepareTimelineLeave(element: Element) {
	if (element instanceof HTMLElement) element.style.setProperty('--timeline-slide-direction', String(timelineSlideDirection.value));
}

const switchTab = (t:TabType) => {
	if (!isHataskeyTimelineAllowed(t)) return;
	pullRefresh.reset();
	if (isCollectionTimelinePage.value) mainRouter.push('/');
	timelinePickerKind.value = null;
	if (tab.value === t) { if (contentEl.value) contentEl.value.scrollTo({ top: 0, behavior: newNotesMotionEnabled.value ? 'smooth' : 'auto' }); } else { tab.value = t; }
	miLocalStorage.setItem('hatasabaUiLastTab', t);
};

// ===== アカウント切り替えメニュー =====
async function openAccountMenu(ev: MouseEvent) {
	const menuItems = await getAccountMenu({ withExtraOperation: true });
	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

// ===== スワイプ =====
const timelineTabGestures = createTimelineTabGestures({
	enabled: () => !navbarSearchOpen.value && tabSwipeEnabled.value && !isPageView.value && !deckActive.value,
	root: () => contentEl.value,
	canMove: (direction, source) => {
		const index = tabOrder.value.indexOf(tab.value);
		return index >= 0 && (tabOrder.value[index + direction] != null || (source === 'touch' && direction === -1 && index === 0));
	},
	move: (direction, source) => {
		const index = tabOrder.value.indexOf(tab.value);
		const next = tabOrder.value[index + direction];
		if (next) switchTab(next);
		else if (source === 'touch' && direction === -1 && index === 0) simpleDrawerShowing.value = true;
	},
});
const onTouchStart = timelineTabGestures.touchStart;
const onTouchMove = timelineTabGestures.touchMove;
const onTouchEnd = timelineTabGestures.touchEnd;
const onTouchCancel = timelineTabGestures.touchCancel;
watch([navbarSearchOpen, tabSwipeEnabled, isPageView, deckActive], () => timelineTabGestures.reset());
onUnmounted(timelineTabGestures.destroy);

// ===== ナビゲーション =====
// 旗鯖fork: 上部ナビバーの横スクロール(縦ホイール→横)
const onTopNavWheel = (ev: WheelEvent) => { const el = ev.currentTarget as HTMLElement; el.scrollLeft += (Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX); };
const onPostClick = () => {
	os.post({});
};
const scrollToTop = () => { if (contentEl.value) contentEl.value.scrollTo({ top: 0, behavior: 'smooth' }); };
// 旗鯖fork: ホームボタンは「HTLへ強制的に切り替える」ボタンではなく、今見ているTLタブを
// 一番上(最新)まで戻すボタンとして扱う。以前は following(HTL)以外のタブを見ている時に
// switchTab('following') を呼んでいたため、どのタブを見ていても強制的にHTLへ切り替わってしまい、
// 元のタブへ戻す手間が発生していた。
const goHome = () => {
	if (isPageView.value) { mainRouter.pushByPath('/', 'forcePage'); } else { scrollToTop(); }
};
const goBack = () => {
	if (window.history.length > 1) { window.history.back(); } else { goHome(); }
};
const openSearch = () => { mainRouter.push('/search'); };

function setNavbarSearchTrigger(element: unknown) {
	navbarSearchTrigger.value = element instanceof HTMLButtonElement ? element : null;
}

function updateNavbarSearchHeight(height: number) {
	if (Number.isFinite(height) && height > 0) navbarSearchHeight.value = height;
}

function updateNavbarSearchViewport() {
	const viewport = window.visualViewport;
	navbarSearchViewportHeight.value = viewport?.height ?? window.innerHeight;
	navbarSearchKeyboardInset.value = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
}

function toggleNavbarSearch() {
	if (navbarSearchOpen.value) { closeNavbarSearch(); return; }
	if (isDesktop.value || deckActive.value) { openSearch(); return; }
	navbarSearchFocusVersion++;
	const focusOrigin = window.document.activeElement;
	simpleDrawerShowing.value = false;
	widgetsShowing.value = false;
	timelinePickerKind.value = null;
	pullRefresh.reset();
	showBottomBar.value = true;
	showTopBar.value = true;
	navbarSearchOpen.value = true;
	updateNavbarSearchViewport();
	void nextTick(() => {
		const active = window.document.activeElement;
		if (navbarSearchOpen.value && !navbarSearchShell.value?.closest('[inert]') && (active === focusOrigin || active === window.document.body || active instanceof Node && navbarSearchShell.value?.contains(active))) navbarSearchContent.value?.focus();
	});
}

function closeNavbarSearch(restoreFocus = true) {
	const version = ++navbarSearchFocusVersion;
	if (!navbarSearchOpen.value) return;
	navbarSearchOpen.value = false;
	if (restoreFocus) void nextTick(() => {
		const active = window.document.activeElement;
		if (version === navbarSearchFocusVersion && !navbarSearchOpen.value && navbarSearchTrigger.value?.isConnected && (active === window.document.body || active instanceof Node && navbarSearchShell.value?.contains(active))) navbarSearchTrigger.value.focus({ preventScroll: true });
	});
}

function searchFocusTargets(root: HTMLElement | null): HTMLElement[] {
	return Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []).filter(element => {
		if (element.closest('[inert], [aria-hidden="true"], [hidden]')) return false;
		for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
			const style = window.getComputedStyle(ancestor);
			if (style.display === 'none' || style.visibility === 'hidden') return false;
		}
		return true;
	});
}

function onNavbarSearchKeydown(event: KeyboardEvent) {
	if (!navbarSearchOpen.value || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeNavbarSearch(); return; }
	if (event.key !== 'Tab') return;
	const elements = searchFocusTargets(navbarSearchShell.value);
	const index = elements.indexOf(window.document.activeElement as HTMLElement);
	if (elements.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === elements.length - 1)) {
		event.preventDefault();
		elements[event.shiftKey ? elements.length - 1 : 0]?.focus({ preventScroll: true });
	}
}

const goToNotifications = () => { mainRouter.push('/my/notifications'); };
const goToLists = () => { mainRouter.push('/my/lists'); };
const goToChannels = () => { mainRouter.push('/channels'); };
const goToAntennas = () => { mainRouter.push('/my/antennas'); };

function rememberCurrentCollection() {
	const listId = activeListId.value;
	const antennaId = activeAntennaId.value;
	if (listId) miLocalStorage.setItem('hatasabaLastListId', listId);
	if (antennaId) miLocalStorage.setItem('hatasabaLastAntennaId', antennaId);
}

async function openPreferredList() {
	const lists = await userListsCache.fetch().catch(() => []);
	const path = getPreferredTimelinePath(lists, miLocalStorage.getItem('hatasabaLastListId'), 'list');
	if (path != null) mainRouter.pushByPath(path);
	else timelinePickerKind.value = 'list';
}

async function openPreferredAntenna() {
	const antennas = await antennasCache.fetch().catch(() => []);
	const path = getPreferredTimelinePath(antennas, miLocalStorage.getItem('hatasabaLastAntennaId'), 'antenna');
	if (path != null) mainRouter.pushByPath(path);
	else timelinePickerKind.value = 'antenna';
}

async function toggleTimelinePicker(kind: TimelineCollectionKind) {
	if (timelinePickerKind.value === kind) { timelinePickerKind.value = null; return; }
	if (kind === 'list') await userListsCache.fetch().catch(() => []);
	else await antennasCache.fetch().catch(() => []);
	timelinePickerKind.value = kind;
}

function selectTimelineCollection(id: string) {
	const kind = timelinePickerKind.value;
	if (!kind) return;
	miLocalStorage.setItem(kind === 'list' ? 'hatasabaLastListId' : 'hatasabaLastAntennaId', id);
	timelinePickerKind.value = null;
	mainRouter.pushByPath(`/timeline/${kind}/${id}`);
}

function openEmptyCollectionOptions() {
	const kind = timelinePickerKind.value;
	timelinePickerKind.value = null;
	if (kind === 'list') goToLists();
	else if (kind === 'antenna') goToAntennas();
}

function openActiveCollectionSettings(kind: TimelineCollectionKind) {
	const id = kind === 'list' ? activeListId.value : activeAntennaId.value;
	if (!id) return;
	timelinePickerKind.value = null;
	if (kind === 'list') {
		mainRouter.push('/my/lists/:listId', { params: { listId: id } });
	} else {
		mainRouter.push('/my/antennas/:antennaId', { params: { antennaId: id } });
	}
}

const topNavStackEl = ref<HTMLElement | null>(null);
const nativeNavbarVisible = computed(() => (!isPageView.value || isCollectionTimelinePage.value) && !deckActive.value);
const mobileNotificationOnly = computed(() => !isDesktop.value && !nativeNavbarVisible.value);
const timelineNewNotes = createHataskeyTimelineNewNotes(() => {
	if (!nativeNavbarVisible.value) return null;
	if (isListTimelinePage.value) return activeListId.value ? `list:${activeListId.value}` : null;
	if (isAntennaTimelinePage.value) return activeAntennaId.value ? `antenna:${activeAntennaId.value}` : null;
	return !isPageView.value ? `main:${tab.value}` : null;
});
provide(hataskeyTimelineNewNotesKey, timelineNewNotes);
const navbarNewNotes = timelineNewNotes.notice;
const newNotesMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const newNotesReducedMotion = ref(newNotesMotionQuery.matches);
const newNotesMotionEnabled = computed(() => prefer.r.animation.value && !newNotesReducedMotion.value);
const navbarPullEnabled = computed(() => prefer.r.enablePullToRefresh.value && nativeNavbarVisible.value && !navbarSearchOpen.value && !timelinePickerKind.value);
const pullRefresh = createNavbarPullRefresh(navbarPullEnabled, newNotesMotionEnabled);
provide(navbarPullRefreshKey, pullRefresh);
watch([mainRouter.currentRef, tab], () => pullRefresh.reset(), { flush: 'sync' });
// The shared controller also resets immediately when navbarPullEnabled becomes false.
const navbarPullPrompt = computed(() => {
	if (!pullRefresh.active.value) return '';
	if (pullRefresh.state.value.phase === 'refreshing') return i18n.ts.refreshing;
	return pullRefresh.state.value.phase === 'ready' ? i18n.ts.releaseToRefresh : i18n.ts.pullDownToRefresh;
});
const navbarNewNotesContent = useRetainedHataskeyTimelineNewNotes(navbarNewNotes, newNotesMotionEnabled);
const navbarNewNotesLabel = computed(() => {
	const notice = navbarNewNotesContent.value;
	return notice?.count == null ? notice?.text : i18n.tsx.newNoteRecivedCount({ n: notice.count });
});
const newNotesFlashEl = ref<HTMLElement | null>(null);
const newNotesContentEl = ref<HTMLElement | null>(null);
const newNotesAnimations = new Set<Animation>();
let newNotesAnimationRevision = 0;

function stopNewNotesAnimations() {
	newNotesAnimationRevision++;
	for (const animation of newNotesAnimations) animation.cancel();
	newNotesAnimations.clear();
}

function animateNewNotes(el: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
	if (!el?.animate) return;
	const animation = el.animate(frames, options);
	newNotesAnimations.add(animation);
	void animation.finished.catch(() => {}).then(() => {
		const fill = animation.effect?.getTiming().fill;
		if (animation.playState === 'finished' && (fill === 'forwards' || fill === 'both')) return;
		animation.cancel();
		newNotesAnimations.delete(animation);
	});
}

watch([() => navbarNewNotes.value != null, newNotesMotionEnabled], async ([active, animate]) => {
	stopNewNotesAnimations();
	if (!animate) return;
	const revision = newNotesAnimationRevision;
	await nextTick();
	if (revision !== newNotesAnimationRevision) return;
	if (active) {
		animateNewNotes(newNotesContentEl.value, [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.22,1,.36,1)' });
		animateNewNotes(newNotesFlashEl.value, [{ clipPath: 'inset(0 50% 0 50%)', opacity: .55 }, { clipPath: 'inset(0 0% 0 0%)', opacity: .3, offset: .55 }, { clipPath: 'inset(0 0% 0 0%)', opacity: 0 }], { duration: 720, easing: 'cubic-bezier(.22,1,.36,1)' });
	} else {
		animateNewNotes(newNotesContentEl.value, [{ transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'translateY(-40%) scale(.92)', opacity: 0, filter: 'blur(2px)' }], { duration: 300, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' });
	}
});
watch(navbarNewNotesContent, content => { if (content == null) stopNewNotesAnimations(); });
onUnmounted(stopNewNotesAnimations);

function onNewNotesMotionChange(event: MediaQueryListEvent) { newNotesReducedMotion.value = event.matches; }

newNotesMotionQuery.addEventListener('change', onNewNotesMotionChange);
onUnmounted(() => newNotesMotionQuery.removeEventListener('change', onNewNotesMotionChange));

function showNavbarNewNotes() {
	showTopBar.value = true;
	return navbarNewNotes.value?.show();
}

const navbarLoadingVisible = ref(false);
const navbarLoadingShown = computed(() => nativeNavbarVisible.value && navbarLoadingVisible.value);
const notificationToasts = createHataskeyNotificationToasts(
	computed(() => !isDesktop.value),
	computed(() => nativeNavbarVisible.value && (pullRefresh.active.value || showTopBar.value || navbarNewNotes.value != null || navbarLoadingShown.value)),
	nativeNavbarVisible,
);
const notificationTargetEl = notificationToasts.target;
const notificationOutlineEl = notificationToasts.outline;
const navbarPullPillEl = ref<HTMLElement | null>(null);
const navbarPullFrameStyle = ref<Record<string, string>>({});
const notificationPauseBeforePull = notificationToasts.paused.value;
const stopNavbarPullWatch = watch(pullRefresh.active, active => {
	notificationToasts.paused.value = active || notificationPauseBeforePull;
	if (!active) {
		navbarPullFrameStyle.value = {};
		return;
	}
	const pill = navbarPullPillEl.value;
	if (!pill) return;
	// Read before Vue patches the first pull frame. Receipt and vote expiry keep
	// running underneath; only the measured shell and its surface are held.
	const bounds = pill.getBoundingClientRect();
	const pillStyle = window.getComputedStyle(pill);
	const style: Record<string, string> = {
		width: `${bounds.width}px`,
		'--navbar-pull-base-height': `${pill.offsetHeight}px`,
		'--navbar-pull-base-color': pillStyle.backgroundColor,
	};
	const candidates = [
		notificationToasts.integrated.value && !notificationToasts.surface.value ? notificationTargetEl.value?.querySelector<HTMLElement>('[data-integrated="true"][data-toast-id]') : null,
		navbarNewNotes.value ? newNotesContentEl.value?.parentElement : null,
	];
	for (const candidate of candidates) {
		if (!candidate || candidate.offsetHeight === 0) continue;
		const surfaceStyle = window.getComputedStyle(candidate);
		const color = surfaceStyle.backgroundColor;
		if (color === 'transparent' || color.endsWith(', 0)') || color.endsWith('/ 0)')) continue;
		style['--navbar-pull-surface-color'] = color;
		style['--navbar-pull-surface-top'] = `${Math.max(0, candidate.getBoundingClientRect().top - bounds.top)}px`;
		style['--navbar-pull-prompt-color'] = surfaceStyle.color;
		break;
	}
	navbarPullFrameStyle.value = style;
}, { flush: 'sync' });
onUnmounted(() => {
	stopNavbarPullWatch();
	pullRefresh.dispose();
	notificationToasts.paused.value = notificationPauseBeforePull;
});
useHataskeyNavbarNotices(notificationToasts, computed(() => !!$i && nativeNavbarVisible.value
	&& !!notificationTargetEl.value && !notificationToasts.surface.value && !notificationToastsSuppressed.value));
const mobileToastVisible = ref(false);
const notificationBloomEl = ref<HTMLElement | null>(null);
const navbarNotificationShowing = ref(false);
const navbarNotificationLeaving = ref(false);
const navbarNotificationShrinking = ref(false);
const navbarNotificationSizing = ref(false);
const navbarNotificationHeight = ref(64);
const navbarNotificationElapsed = ref(0);
const navbarNotificationDuration = ref(NOTIFICATION_TOAST_DURATION);
const navbarNotificationKind = ref<HataskeyNavbarNotice['kind']>();
const navbarNotificationHeldWidth = ref(0);
const navbarNotificationWidthStyle = computed(() => navbarNotificationHeldWidth.value > 0 ? { width: `${navbarNotificationHeldWidth.value}px` } : {});
const navbarNotification = computed(() => !notificationToasts.surface.value && notificationToasts.integrated.value ? notificationToasts.items.value[0] : undefined);
let navbarNotificationExitTimer: number | undefined;
let navbarNotificationShrinkTimer: number | undefined;
let navbarNotificationWidthAnimation: Animation | undefined;
let navbarNotificationRevision = 0;

function cancelNavbarNotificationWidth() {
	navbarNotificationRevision++;
	navbarNotificationWidthAnimation?.cancel();
	navbarNotificationWidthAnimation = undefined;
	navbarNotificationHeldWidth.value = 0;
	navbarNotificationSizing.value = false;
}

function resetNavbarNotification() {
	window.clearTimeout(navbarNotificationExitTimer);
	window.clearTimeout(navbarNotificationShrinkTimer);
	cancelNavbarNotificationWidth();
	navbarNotificationShowing.value = false;
	navbarNotificationLeaving.value = false;
	navbarNotificationShrinking.value = false;
	navbarNotificationKind.value = undefined;
	mobileToastVisible.value = false;
}

function finishNavbarNotificationExit() {
	const element = topNavStackEl.value;
	const from = element?.getBoundingClientRect().width;
	resetNavbarNotification();
	if (!newNotesMotionEnabled.value) return;

	// HyNav keeps its glow for 550ms, then closes the empty host over 350ms.
	// Keep mobile-only hosts mounted for that height transition as well.
	navbarNotificationShrinking.value = true;
	mobileToastVisible.value = !isDesktop.value;
	const revision = navbarNotificationRevision;
	navbarNotificationShrinkTimer = window.setTimeout(() => {
		navbarNotificationShrinking.value = false;
		mobileToastVisible.value = false;
		cancelNavbarNotificationWidth();
	}, 350);
	nextTick(() => {
		if (!element?.isConnected || !from || revision !== navbarNotificationRevision || !newNotesMotionEnabled.value || pullRefresh.active.value) return;
		const to = element.getBoundingClientRect().width;
		if (from <= to + 0.5 || !element.animate) return;

		// Measure intrinsic layout first; stretch the existing pill only while
		// its enclosing stack is held or animated. No fixed width survives.
		navbarNotificationSizing.value = true;
		const animation = element.animate([{ width: `${from}px` }, { width: `${to}px` }], {
			duration: 350,
			easing: 'cubic-bezier(.22,1,.36,1)',
		});
		navbarNotificationWidthAnimation = animation;
		animation.onfinish = () => {
			if (navbarNotificationWidthAnimation === animation) {
				navbarNotificationWidthAnimation = undefined;
				navbarNotificationSizing.value = false;
			}
		};
	});
}

watch([navbarNotification, newNotesMotionEnabled, notificationToasts.surface, nativeNavbarVisible, isDesktop], ([notice, motion, surface, native, desktop]) => {
	if (surface || (desktop && !native) || (!notice && notificationToasts.items.value.length > 0)) {
		resetNavbarNotification();
	} else if (notice) {
		resetNavbarNotification();
		navbarNotificationShowing.value = true;
		navbarNotificationHeight.value = notificationToasts.height.value || navbarNotificationHeight.value;
		navbarNotificationElapsed.value = notice.elapsed;
		navbarNotificationDuration.value = getToastDuration(notice);
		navbarNotificationKind.value = notice.source === 'status' ? notice.navbarNotice?.kind : undefined;
		mobileToastVisible.value = !desktop;
	} else if (!motion) {
		resetNavbarNotification();
	} else if (navbarNotificationShowing.value && !navbarNotificationLeaving.value) {
		navbarNotificationLeaving.value = true;
		if (!pullRefresh.active.value) {
			navbarNotificationHeldWidth.value = topNavStackEl.value?.getBoundingClientRect().width ?? 0;
			navbarNotificationSizing.value = navbarNotificationHeldWidth.value > 0;
		}
		navbarNotificationExitTimer = window.setTimeout(finishNavbarNotificationExit, 550);
	}
}, { immediate: true });
watch([() => navbarNotification.value?.elapsed, notificationToasts.height], ([elapsed, height]) => {
	if (!navbarNotification.value) return;
	if (elapsed != null) navbarNotificationElapsed.value = elapsed;
	if (height > 0) navbarNotificationHeight.value = height;
}, { immediate: true });
watch(pullRefresh.active, pulling => {
	if (pulling) cancelNavbarNotificationWidth();
});
window.addEventListener('resize', cancelNavbarNotificationWidth);
onUnmounted(() => {
	resetNavbarNotification();
	window.removeEventListener('resize', cancelNavbarNotificationWidth);
});
provide(hataskeyNotificationToastsKey, notificationToasts);

function closeTimelinePickerOnOutsidePointer(ev: PointerEvent) {
	if (timelinePickerKind.value == null) return;
	const target = ev.target;
	if (target instanceof Node && topNavStackEl.value?.contains(target)) return;
	timelinePickerKind.value = null;
}

function openAntennaList(ev?: MouseEvent) {
	if (isAntennaTimelinePage.value && ev) toggleTimelinePicker('antenna');
	else openPreferredAntenna();
}

const goToDrive = () => { mainRouter.push('/my/drive'); };
// 旗鯖fork: メッセージ (チャット) へ遷移
const goToChat = () => { mainRouter.push('/chat'); };
const goToAnnouncements = () => { mainRouter.push('/announcements'); };
const openUiSetup = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/components/MkUISetup.vue')), {}, { closed: () => dispose() });
};
const goToSettings = () => { mainRouter.push('/settings'); };
const goToAdmin = () => { mainRouter.push('/admin'); };

// 旗鯖fork: ページ全体をリロードする。
async function reloadPage(ev?: Event) {
	if (ev) {
		playHataIconMotion(ev, 'reload-spin', 540);
		if (prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(resolve => window.setTimeout(resolve, 540));
	}
	window.location.reload();
}

async function clearCacheWithMotion(ev?: Event) {
	if (ev) {
		playHataIconMotion(ev, 'cache-clear', 720);
		if (prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(resolve => window.setTimeout(resolve, 720));
	}
	await clearCache();
}

// ===== サイドバー項目ヘルパー =====
function sidebarItemClick(id: string, ev?: MouseEvent) {
	if (ev && id !== 'reload' && id !== 'cacheClear' && id !== 'more') {
		playHataNavigationMotion(ev, id, 620);
	}
	// モバイルドロワーのボタンを先に消すと、遅延読込中にLaunchPadのアンカーを失う。
	// LaunchPadが閉じるまでドロワーを残し、狭幅PCのpopup配置も壊さない。
	if (id === 'more' && ev && simpleDrawerShowing.value) {
		void openMore(ev, true);
		return;
	}
	simpleDrawerShowing.value = false;
	// 旗鯖fork: 外部リンク項目は新しいタブで開く
	const item = sidebarOrder.value.find((x: any) => x.id === id);
	if (item?.external && item.url) {
		window.open(item.url, '_blank', 'noopener');
		return;
	}
	const map: Record<string, ()=>void> = {
		timeline: goHome, notifications: () => goToNotifications(), search: () => openSearch(),
		chat: () => goToChat(),
		lists: () => goToLists(), channels: () => goToChannels(),
		antennas: () => { if (ev) openAntennaList(ev); else goToAntennas(); }, drive: () => goToDrive(),
		announcements: () => goToAnnouncements(), uiSetup: () => openUiSetup(),
		// 旗鯖fork: 新規追加項目
		favorites: () => mainRouter.push('/my/favorites'),
		explore: () => mainRouter.push('/explore'),
		followRequests: () => mainRouter.push('/my/follow-requests'),
		more: () => { if (ev) openMore(ev); },
		// 旗鯖fork: reload はクリックでページ全体をリロード (旧来は独立ボタンだったが sidebar 項目化)
		reload: () => reloadPage(ev),
		// 既存のクライアントキャッシュ削除処理を使い、取得し直したあと全タブを再読み込みする。
		cacheClear: () => { void clearCacheWithMotion(ev); },
	};
	if (map[id]) {
		map[id]();
		return;
	}

	// HataSideStudioは「もっと！」(navbarItemDef)の項目も直接配置できる。
	// 既存の専用mapと外部リンクを優先したうえで、未知IDだけ本家定義へ安全に委譲する。
	type StudioNavbarFallback = {
		show?: boolean;
		to?: string;
		action?: (event?: MouseEvent) => void;
	};
	const fallback = (navbarItemDef as unknown as Record<string, StudioNavbarFallback | undefined>)[id];
	if (fallback == null || fallback.show === false) return;
	if (typeof fallback.to === 'string') {
		mainRouter.pushByPath(fallback.to as never);
		return;
	}
	fallback.action?.(ev);
}

function playSimpleNavMotion(ev: Event, id: string): void {
	playHataNavigationMotion(ev, id, 620);
}

function sidebarItemActive(id: string): boolean {
	const known = ({
		timeline: isHomeTL.value && !isPageView.value,
		notifications: isNotifPage.value, search: isSearchPage.value,
		chat: isChatPage.value,
		lists: isListPage.value,
		channels: isChannelPage.value, antennas: isAntennaPage.value,
		drive: isDrivePage.value,
		announcements: mainRouter.currentRoute.value.path.startsWith('/announcements'),
		// 旗鯖fork: 新規追加項目のアクティブ判定
		favorites: mainRouter.currentRoute.value.path.startsWith('/my/favorites'),
		explore: mainRouter.currentRoute.value.path.startsWith('/explore'),
		followRequests: mainRouter.currentRoute.value.path.startsWith('/my/follow-requests'),
	} as Record<string, boolean | undefined>)[id];
	if (known != null) return known;
	const fallback = (navbarItemDef as unknown as Record<string, { show?: boolean; to?: string } | undefined>)[id];
	return fallback?.show !== false && typeof fallback?.to === 'string' && mainRouter.currentRoute.value.path.startsWith(fallback.to);
}

// ===== インスタンス情報 =====
const instanceNameStr = computed(() => instance.name || instanceName);
const instanceIconUrl = computed(() => instance.iconUrl || '/favicon.ico');

// ===== ドライブページ判定 =====
const isDrivePage = computed(() => mainRouter.currentRoute.value.path.startsWith('/my/drive'));
// 旗鯖fork: メッセージ (チャット) ページ判定
const isChatPage = computed(() => mainRouter.currentRoute.value.path.startsWith('/chat'));
const isAdminPage = computed(() => mainRouter.currentRoute.value.path.startsWith('/admin'));

// ===== もっとメニュー（ランチパッド） =====
async function openMore(ev: MouseEvent | PointerEvent, closeMobileDrawerAfter = false) {
	const target = (ev.currentTarget ?? ev.target) as HTMLElement;
	if (!target) return;
	playHataIconMotion(ev, 'more-dots', 520);
	const { dispose } = await os.popupAsyncWithDialog(
		import('@/components/MkLaunchPad.vue').then(component => component.default),
		{ anchorElement: target },
		{
			closed: () => {
				if (closeMobileDrawerAfter) simpleDrawerShowing.value = false;
				dispose();
			},
		},
	);
}

// ===== サーバーメニュー =====
function openInstanceMenuMobile(ev: MouseEvent | PointerEvent) {
	openInstanceMenu(ev as PointerEvent);
}

// ===== TL設定ポップアップ =====
const withRenotes = computed<boolean>({
	get: () => store.r.tl.value.filter.withRenotes,
	set: (x) => saveTlFilter('withRenotes', x),
});
const withSensitive = computed<boolean>({
	get: () => store.r.tl.value.filter.withSensitive,
	set: (x) => saveTlFilter('withSensitive', x),
});
const onlyFiles = computed<boolean>({
	get: () => store.r.tl.value.filter.onlyFiles,
	set: (x) => saveTlFilter('onlyFiles', x),
});
const showFixedPostForm = prefer.model('showFixedPostForm');

function saveTlFilter(key: string, newValue: boolean) {
	const out = deepMerge({ filter: { [key]: newValue } }, store.s.tl);
	store.set('tl', out);
}

function openTlOptions(ev: MouseEvent | PointerEvent) {
	os.popupMenu([{
		type: 'switch',
		icon: 'ti ti-repeat',
		text: i18n.ts.showRenotes,
		ref: withRenotes,
	}, {
		type: 'switch',
		icon: 'ti ti-eye-exclamation',
		text: i18n.ts.withSensitive,
		ref: withSensitive,
	}, {
		type: 'switch',
		icon: 'ti ti-photo',
		text: i18n.ts.fileAttachedOnly,
		ref: onlyFiles,
	}, {
		type: 'divider',
	}, {
		type: 'switch',
		text: i18n.ts.showFixedPostForm,
		ref: showFixedPostForm,
	}, {
		type: 'divider',
	}, {
		icon: 'ti ti-layout-sidebar-left-expand',
		text: copy.openHataSideStudio,
		action: () => mainRouter.push('/hata-side-studio'),
	}], ev.currentTarget ?? ev.target);
}

// ===== リアルタイムモード =====
const isRealtimeMode = computed(() => store.r.realtimeMode.value);

async function toggleRealtimeMode() {
	await store.set('realtimeMode', !store.s.realtimeMode);
	window.location.reload();
}

// ===== 通知バッジ / お知らせ未読 =====
// hasUnreadNotif: 未読通知の有無 (boolean)
// unreadNotifCount: 未読通知の件数 (number) - 表示用
// hasUnreadAnnouncements: 未読お知らせの有無 (computed) - 本家準拠で $i.hasUnreadAnnouncement を直接参照
const hasUnreadNotif = ref(false);
const unreadNotifCount = ref(0);
const hasUnreadAnnouncements = computed(() => $i != null && $i.hasUnreadAnnouncement === true);
// 旗鯖fork: 未読メッセージ (チャット) の有無
const hasUnreadChat = computed(() => $i != null && $i.hasUnreadChatMessages === true);
// 通知バッジに件数を表示するかどうかの preference 参照（既存設定との統合）
// true: 件数バッジ表示 / false: ドットのみ表示
const showUnreadNotifCount = computed(() => prefer.s.showUnreadNotificationsCount === true);
let mainCh:any = null;
let broadcastStream: ReturnType<typeof useStream> | null = null;
let unreadPollTimer: number | null = null;
let streamRetryTimer: number | null = null;
let streamUnmounted = false;

function onHataTimelineCollapse() {
	timelineCollapseEffect.play();
}

// 通知の現在値を $i から同期（reactivity 補強）
const syncUnreadFromI = () => {
	if (!$i) return;
	// 本家準拠: hasUnreadNotification (boolean) を最優先
	if (typeof $i.hasUnreadNotification === 'boolean') {
		hasUnreadNotif.value = $i.hasUnreadNotification;
	}
	if (typeof $i.unreadNotificationsCount === 'number') {
		unreadNotifCount.value = $i.unreadNotificationsCount;
		// hasUnreadNotification が無い古い環境のフォールバック
		if (typeof $i.hasUnreadNotification !== 'boolean') {
			hasUnreadNotif.value = $i.unreadNotificationsCount > 0;
		}
	}
};
watch(() => [$i?.unreadNotificationsCount, $i?.hasUnreadNotification], syncUnreadFromI);

// 起動時と定期確認では、イベントを取り逃した未読件数もサーバーから同期する。
const checkUnread = async() => {
	syncUnreadFromI();
	await refreshNotificationUnreadState($i?.id);
	syncUnreadFromI();
};

// useStream() でストリームのシングルトンを取得し、main チャンネルを購読
// 接続未完了でも先にリスナーを登録しておけば、接続成立後に正しく発火する
const initStream = () => {
	if (streamUnmounted || mainCh) return; // 破棄後の再試行と二重初期化を防止
	try {
		const stream = useStream();
		if (!stream) {
			console.warn('[hatasaba] useStream() returned null, scheduling retry');
			scheduleStreamRetry();
			return;
		}
		mainCh = stream.useChannel('main');
		broadcastStream = stream;
		stream.on('hataTimelineCollapse', onHataTimelineCollapse);

		const ownerId = $i?.id;
		const updateUnread = (state: { unreadNotificationsCount: number; revision: string }) => {
			if ($i?.id !== ownerId) return;
			const count = acceptNotificationUnreadState(ownerId, state);
			if (count === null) return;
			updateCurrentAccount({ hasUnreadNotification: count > 0, unreadNotificationsCount: count });
			syncUnreadFromI();
		};
		mainCh.on('unreadNotification', updateUnread);
		mainCh.on('readNotification', updateUnread);
		mainCh.on('notificationChanged', updateUnread);
		mainCh.on('notificationFlushed', updateUnread);
		mainCh.on('readAllNotifications', updateUnread);

		// 接続切断時のログのみ（ハンドラ自体は残る、再接続時に発火継続）
		stream.on('_disconnected_', () => {
			console.info('[hatasaba] stream disconnected (will auto-reconnect)');
		});

		// 接続成立後に1度同期しておく（$i に最新値があるはず）
		syncUnreadFromI();
	} catch (e) {
		console.warn('[hatasaba] Stream init failed, retrying:', e);
		broadcastStream?.off('hataTimelineCollapse', onHataTimelineCollapse);
		broadcastStream = null;
		mainCh?.dispose();
		mainCh = null;
		scheduleStreamRetry();
	}
};

function scheduleStreamRetry() {
	if (streamUnmounted || streamRetryTimer !== null) return;
	streamRetryTimer = window.setTimeout(() => {
		streamRetryTimer = null;
		initStream();
	}, 2000);
}

// サーバーの未読件数を定期的に再取得（ストリーム不調時の保険）
const startUnreadPoll = () => {
	if (unreadPollTimer) return;
	unreadPollTimer = window.setInterval(checkUnread, 60000);
};
const stopUnreadPoll = () => {
	if (unreadPollTimer) { window.clearInterval(unreadPollTimer); unreadPollTimer = null; }
};

// 旗鯖fork: デッキ初表示時にチュートリアルを出す監視(全変数定義後に登録)
watch(deckActive, (v) => { if (v) maybeShowDeckTutorial(); }, { immediate: true });

watch([mainRouter.currentRef, tab], () => closeNavbarSearch(false));
watch([isDesktop, deckActive, simpleDrawerShowing, widgetsShowing, timelinePickerKind], ([desktop, deck, drawer, widgets, picker]) => {
	if (desktop || deck || drawer || widgets || picker) closeNavbarSearch(false);
});
watch(visibleBottomNav, items => { if (!items.some(item => item.id === 'search')) closeNavbarSearch(false); });

let stopViewportRecovery: (() => void) | undefined;
onMounted(() => {
	stopViewportRecovery = attachIOSViewportRecovery(mainRouter);
	updateNavbarSearchViewport();
	window.visualViewport?.addEventListener('resize', updateNavbarSearchViewport);
	window.visualViewport?.addEventListener('scroll', updateNavbarSearchViewport);
	window.addEventListener('pageshow', updateNavbarSearchViewport);
	startAnnouncementsObserver();
	cleanupStaleUiElements();
	checkIsPageView();
	rememberCurrentCollection();
	if (isListTimelinePage.value) userListsCache.fetch().catch(() => []);
	if (isAntennaTimelinePage.value) antennasCache.fetch().catch(() => []);
	// 旗鯖fork: 復元したタブが現在の設定で表示可能か検証し、非表示なら先頭タブにフォールバック
	if (!tabOrder.value.includes(tab.value)) {
		tab.value = tabOrder.value[0] ?? 'following';
	}
	// ストリームを先に初期化してから初期同期（接続未完了でもリスナー登録は有効）
	initStream();
	checkUnread();
	startUnreadPoll();
	nextTick(() => { startThemeWatch(); });
	nextTick(() => { updateSbFade(); });
	window.document.addEventListener('pointerdown', closeTimelinePickerOnOutsidePointer, true);
});
onUnmounted(() => {
	stopViewportRecovery?.();
	navbarSearchFocusVersion++;
	window.visualViewport?.removeEventListener('resize', updateNavbarSearchViewport);
	window.visualViewport?.removeEventListener('scroll', updateNavbarSearchViewport);
	window.removeEventListener('pageshow', updateNavbarSearchViewport);
	stopAnnouncementsObserver();
	streamUnmounted = true;
	if (streamRetryTimer !== null) {
		window.clearTimeout(streamRetryTimer);
		streamRetryTimer = null;
	}
	mainCh?.dispose();
	mainCh = null;
	broadcastStream?.off('hataTimelineCollapse', onHataTimelineCollapse);
	broadcastStream = null;
	timelineCollapseEffect.destroy();
	stopUnreadPoll();
	stopThemeWatch();
	if (scrollTimer) window.clearTimeout(scrollTimer);
	window.document.removeEventListener('pointerdown', closeTimelinePickerOnOutsidePointer, true);
	window.removeEventListener('resize', onResize);
});
</script>

<style lang="scss" module>
.root { display:flex; flex-direction:column; height:var(--MI-viewport-height, 100dvh); background:var(--MI_THEME-bg); overflow:hidden; user-select:none; -webkit-tap-highlight-color:transparent; }

// ===== デスクトップレイアウト =====
.desktopLayout {
    flex-direction:row;
}

// ===== オリジナルサイドバー =====
.sidebar {
    width:220px;
    flex-shrink:0;
    height:var(--MI-viewport-height, 100dvh);
    background:var(--MI_THEME-navBg);
    display:flex;
    flex-direction:column;
    border-right:solid 0.5px var(--MI_THEME-divider);
    position:relative;
    overflow:hidden;
}
.sidebarWide {
	width:280px;
}
/* 旗鯖fork: デッキモード時はサイドバーをアイコンのみの細表示に折り畳む(横幅を最大化) */
.sidebarDeckFolded {
    width:64px;
    transition:width .2s ease;
}
.sidebarDeckFolded .sbLabel,
.sidebarDeckFolded .sbGroupLabel,
.sidebarDeckFolded .sbBadge,
.sidebarDeckFolded .sbUsername,
.sidebarDeckFolded .sbLogoWrap,
.sidebarDeckFolded .sbLogoSub,
.sidebarDeckFolded .sbLogoText,
.sidebarDeckFolded .sidebarBanner {
    display:none;
}
.sidebarDeckFolded .sbItem,
.sidebarDeckFolded .sbPostBtn,
.sidebarDeckFolded .sbAccount {
    justify-content:center;
    padding-left:0;
    padding-right:0;
    gap:0;
}
.sidebarDeckFolded .sidebarInner {
    padding-left:8px;
    padding-right:8px;
}
.sidebarDeckFolded .sbModeToggle {
    flex-direction:column;
    gap:4px;
}
/* 応急処置: 折り畳み時にメニューが縦に収まらず切れる問題を緩和。
   下部(投稿/モード/アカウント)をコンパクトにし、メニュー領域(sbScroll)の可視範囲を確保。
   本格対応(ペンのみ表示・リアルタイムのボタン化等)はサイドメニュー刷新(S1)で行う。 */
.sidebarDeckFolded .sbBottom {
    gap:4px;
    padding-top:8px;
    margin-top:4px;
}
.sidebarDeckFolded .sbPostBtn {
    height:44px;
}
.sidebarDeckFolded .sbScroll {
    overflow-y:auto;
}
.sidebarBanner {
    position:absolute;
    inset:0;
    z-index:0;
    overflow:hidden;
    &::after {
        content:'';
        position:absolute;
        inset:0;
        background:var(--MI_THEME-navBg);
        opacity:.75;
        backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);
    }
}
.sidebarBannerImg {
    width:100%;
    height:100%;
    object-fit:cover;
    filter:blur(16px) saturate(1.2);
    transform:scale(1.1);
}
.sidebarInner {
    display:flex;
    flex-direction:column;
    height:100%;
    padding:16px 12px;
    box-sizing:border-box;
    overflow:hidden;
    position:relative;
    z-index:1;
}
.sbScrollWrap {
    /* 旗鯖fork: スクロール領域を内包し、上下のフェードを重ねる枠 */
    position:relative;
    flex:1;
    min-height:0;
    display:flex;
    flex-direction:column;
}
.sbScroll {
    /* 旗鯖fork: メニュー群だけをスクロールさせる領域。下部の投稿/アカウントは外側で固定。 */
    flex:1;
    min-height:0;
    overflow-y:auto;
    overflow-x:hidden;
    /* スクロールバーは非表示にし、代わりにフェードで続きを示す */
    scrollbar-width:none;
    -ms-overflow-style:none;
    display:flex;
    flex-direction:column;
	justify-content:flex-start;
	padding-bottom:2px;
	box-sizing:border-box;
}
.sbScroll::-webkit-scrollbar { width:0; height:0; display:none; }
/* 旗鯖fork: 続きがある方向をフェードで示す。以前は navBg 色のグラデーションを重ねていたが、
   サイドバーがすりガラス背景(バナーぼかし)の時に不透明な帯が浮いて目立っていた。
   代わりに mask-image でスクロール内容そのものを端で徐々に透明にする。背景色に依存せず、
   メニュー項目が端で自然に薄くなって「続きがある」と伝わる。 */
.sbScroll {
    transition: mask-image .2s, -webkit-mask-image .2s;
}
.fadeTop .sbScroll {
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px);
    mask-image: linear-gradient(to bottom, transparent 0, #000 12px);
}
.fadeBottom .sbScroll {
    -webkit-mask-image: linear-gradient(to top, transparent 0, #000 12px);
    mask-image: linear-gradient(to top, transparent 0, #000 12px);
}
.fadeTop.fadeBottom .sbScroll {
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
}
.sbLogoRow {
    position:relative;
    display:flex;
    align-items:center;
    gap:4px;
    margin-bottom:20px;
}
.sbLogo {
    display:flex;
    align-items:center;
    gap:10px;
    padding:8px 10px;
    cursor:pointer;
    border-radius:12px;
    transition:background .2s;
    flex:1;
    min-width:0;
    &:hover { background:var(--MI_THEME-accentedBg); }
}
.sbLogoAction {
    width:34px;
    height:34px;
    border-radius:8px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:transparent;
    border:none;
    color:var(--MI_THEME-navFg);
    opacity:.5;
    cursor:pointer;
    font-size:1.05rem;
    transition:all .2s;
    flex-shrink:0;
    &:hover { opacity:1; background:color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent); }
}
.sbLogoImg {
    width:28px;
    height:28px;
    border-radius:8px;
    object-fit:cover;
    flex-shrink:0;
}
.sbLogoText {
    font-size:.88rem;
    font-weight:700;
    color:var(--MI_THEME-navFg);
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.sbLogoWrap {
    display:flex;
    flex-direction:column;
    min-width:0;
}
.sbLogoSub {
    font-size:.58rem;
    font-weight:400;
    opacity:.5;
    color:var(--MI_THEME-navFg);
    line-height:1;
    margin-bottom:1px;
}
.sbNav {
    display:flex;
    flex-direction:column;
    gap:2px;
}
.sbScroll > .sbNav:first-child {
    transform:translateY(var(--hss-parallax, 0));
    transition:transform 80ms linear;
}
.sbItem {
    display:flex;
    align-items:center;
    gap:12px;
    padding:10px 12px;
    border-radius:10px;
    border:none;
    background:transparent;
    cursor:pointer;
    font-family:inherit;
    font-size:.9rem;
    color:var(--MI_THEME-navFg);
    opacity:.7;
    transition:all .2s ease;
    position:relative;
    &:hover {
        background:color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent);
        opacity:1;
    }
}
.sbActive {
    background:var(--MI_THEME-accentedBg) !important;
    color:var(--MI_THEME-accent) !important;
    opacity:1 !important;
    font-weight:600;
}
.sbIcon {
    font-size:1.15rem;
    width:22px;
    text-align:center;
    flex-shrink:0;
}
.sbLabel {
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.sbBadge {
    position:absolute;
    top:50%;
    right:10px;
    transform:translateY(-50%);
    min-width:18px;
    height:18px;
    padding:0 5px;
    border-radius:9px;
    background:var(--MI_THEME-indicator, #f44);
    color:#fff;
    font-size:10px;
    font-weight:700;
    line-height:18px;
    text-align:center;
    box-sizing:border-box;
}
.sbDot {
    position:absolute;
    top:50%;
    right:14px;
    transform:translateY(-50%);
    width:8px;
    height:8px;
    border-radius:50%;
    background:var(--MI_THEME-accent, #4c93e2);
    box-shadow:0 0 0 2px var(--MI_THEME-panel, #fff);
}
.sbNotifDot {
    position:absolute;
    top:50%;
    right:14px;
    transform:translateY(-50%);
    width:8px;
    height:8px;
    border-radius:50%;
    background:var(--MI_THEME-indicator, #f44);
    box-shadow:0 0 0 2px var(--MI_THEME-panel, #fff);
}
.sbGroupLabel {
    font-size:11px;
    font-weight:600;
    opacity:0.5;
    padding:4px 12px 2px;
    margin-top:8px;
    letter-spacing:0.04em;
    user-select:none;
}
.sbGroupLabel:first-child {
    margin-top:0;
}
/* HataSideStudio: 拡大時の自由配置。グループ内のウィジェットは必ず全幅を占有し、
   回転したボタンは上下の予約領域内で描画して隣の項目へ重ならない。 */
.hssGroup {
    min-width:0;
    padding:8px;
    margin:3px 0;
    border:var(--hss-border-width, 1px) var(--hss-border-style, solid) var(--hss-border, var(--MI_THEME-divider));
    border-radius:14px;
    background:var(--hss-bg, transparent);
	overflow:visible;
}
.hssRoot[data-hss-mode="expanded"] {
    display:grid;
    grid-template-columns:repeat(var(--hss-normal-columns, 1), minmax(0, 1fr));
    align-items:start;
	gap:4px;
	align-content:start;
}
.hssRoot[data-hss-mode="expanded"] .hssGroup,
.hssRoot[data-hss-mode="expanded"] .hssWidget {
    grid-column:1 / -1;
}
.hssMobileRoot {
	width:100%;
	min-width:0;
	padding:0 8px 8px;
	box-sizing:border-box;
}
.hssRoot[data-hss-mode="collapsed"] {
    display:flex;
    flex-direction:column;
    align-items:center;
}
.hssGroupTitle {
    padding:1px 5px 7px;
    color:var(--hss-fg, var(--MI_THEME-navFg));
    font-size:11px;
    font-weight:700;
    opacity:.62;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.hssGroupGrid {
    display:grid;
    grid-template-columns:repeat(var(--hss-columns, 1), minmax(0, 1fr));
	gap:4px;
    min-width:0;
}
.hssGroup[data-hss-masonry="on"] .hssGroupGrid {
    display:block;
    column-count:var(--hss-columns, 1);
	column-gap:4px;
}
.hssGroup[data-hss-masonry="on"] .hssItemSlot,
.hssGroup[data-hss-masonry="on"] .hssWidget {
	display:grid;
	width:100%;
	margin:0 0 4px;
	break-inside:avoid;
}
.hssGroup[data-hss-masonry="on"] .hssWidget {
	column-span:all;
}
.hssItemSlot {
	min-width:0;
	box-sizing:border-box;
	display:grid;
	align-items:stretch;
	padding:var(--hss-rotation-space, 1px) 1px;
	overflow:visible;
}
.hssItemSlot[data-hss-shape="circle"] { place-items:center; }
.hssButton {
	width:100%;
	min-width:0;
	min-height:40px;
	box-sizing:border-box;
    color:var(--hss-fg, var(--MI_THEME-navFg));
    border:var(--hss-border-width, 1px) var(--hss-border-style, solid) var(--hss-border, transparent);
	background:var(--hss-bg, transparent);
	transform:rotate(var(--hss-rotation, 0deg));
	transform-origin:center;
	margin:0;
	overflow:visible;
	font-size:.9rem;
}
.hssGroupGrid[data-hss-columns="2"] .hssButton,
.hssGroupGrid[data-hss-columns="3"] .hssButton {
    flex-direction:column;
    justify-content:center;
    gap:4px;
    padding:8px 4px;
    text-align:center;
}
.hssGroupGrid[data-hss-columns="2"] .sbLabel,
.hssGroupGrid[data-hss-columns="3"] .sbLabel {
    width:100%;
	justify-content:center;
	font-size:12px;
	line-height:1.25;
}
.hssButton[data-hss-shape="circle"] {
	justify-self:center;
	width:44px;
	min-width:44px;
	height:44px;
	min-height:44px;
	margin-inline:auto;
	padding:7px;
	border-radius:50%;
	aspect-ratio:auto;
	justify-content:center;
}
.hssButton[data-hss-shape="circle"] .sbLabel,
.hssButton[data-hss-shape="circle"] .hssButtonLines { display:none; }
.hssButton[data-hss-shape="circle"][data-hss-size="small"] { width:36px;min-width:36px;height:36px;min-height:36px; }
.hssButton[data-hss-shape="circle"][data-hss-size="large"] { display:flex;width:54px;min-width:54px;height:54px;min-height:54px; }
.hssButton[data-hss-shape="pill"] { width:calc(100% - 4px);margin-inline:2px;border-radius:999px; }
.hssButton[data-hss-size="small"] { min-height:34px; padding-block:6px; font-size:.78rem; }
.hssButton[data-hss-size="large"] {
	display:grid;
	grid-template-columns:minmax(0, 1fr);
	grid-auto-rows:auto;
	align-items:start;
	justify-items:stretch;
	gap:4px;
	min-height:98px;
	padding:11px 12px;
	font-size:.95rem;
	line-height:1.35;
	text-align:left;
}
.hssButton[data-hss-shape="circle"][data-hss-size="large"] {
	display:flex;
	grid-template-columns:none;
	grid-template-rows:none;
	min-height:54px;
	padding:7px;
}
.hssButton[data-hss-size="large"] .sbIcon { grid-column:1;grid-row:auto;width:auto;text-align:left;font-size:1.25rem; }
.hssButton[data-hss-size="large"] .sbLabel { grid-column:1;display:block;width:100%;min-width:0;font-size:.95rem;font-weight:700;line-height:1.3;text-align:left;white-space:normal;overflow-wrap:anywhere; }
.hssButtonLines {
	grid-column:1;
	display:grid;
	gap:2px;
    min-width:0;
	max-height:none;
	overflow:visible;
    line-height:1.35;
	font-size:12.5px;
    font-weight:400;
	opacity:.72;
	text-align:left;
	writing-mode:horizontal-tb;
}
.hssButtonLines > span {
	min-width:0;
	white-space:normal;
	word-break:normal;
	overflow-wrap:break-word;
}
.hssButtonSignals {
	grid-column:1 / -1;
	display:flex;
	flex-wrap:wrap;
	gap:3px;
	min-width:0;
	margin-top:6px;
}
.hssButtonSignals > button {
	min-width:0;
	padding:2px 6px;
	border:0;
	border-radius:999px;
	background:color-mix(in srgb, currentColor 10%, transparent);
	color:inherit;
	cursor:pointer;
	font:inherit;
	font-size:9px;
	font-weight:650;
	line-height:1.35;
	overflow:hidden;
	text-overflow:ellipsis;
	white-space:nowrap;
}
.hssButtonSignals > button:hover,.hssButtonSignals > button:focus-visible { background:color-mix(in srgb, currentColor 20%, transparent);outline:1px solid currentColor; }
.hssSearchButton {
	display:grid !important;
	grid-template-columns:20px minmax(0, 1fr) 28px !important;
	grid-template-rows:1fr !important;
	gap:6px !important;
	min-height:52px !important;
	padding:7px 7px 7px 10px !important;
	border-radius:14px;
	opacity:1;
}
.hssSearchButton > input {
	min-width:0;
	width:100%;
	padding:7px 8px;
	border:0;
	outline:0;
	border-radius:9px;
	background:color-mix(in srgb, var(--MI_THEME-panel) 78%, transparent);
	color:var(--hss-fg, var(--MI_THEME-navFg));
	font:inherit;
	font-size:11px;
}
.hssSearchButton > input::placeholder { color:currentColor; opacity:.52; }
.hssSearchButton > button {
	display:grid;
	place-items:center;
	width:28px;
	height:28px;
	padding:0;
	border:0;
	border-radius:9px;
	background:var(--MI_THEME-accent);
	color:var(--MI_THEME-fgOnAccent);
	cursor:pointer;
}
.hssWidget {
	grid-column:1 / -1;
	display:block;
	width:100%;
	min-width:0;
	height:auto;
	/* minHeight は native widget の内容領域に対する保証値。外枠の
	   padding と border を加え、内容がそれ以上なら自然に伸ばす。 */
	min-height:calc(var(--hss-widget-min-height, 72px) + 10px);
	box-sizing:border-box;
	padding:4px;
	color:var(--hss-fg, var(--MI_THEME-navFg));
    border:var(--hss-border-width, 1px) var(--hss-border-style, solid) var(--hss-border, var(--MI_THEME-divider));
    border-radius:13px;
	background:var(--hss-bg, var(--MI_THEME-panel));
	overflow:clip;
	text-align:left;
}
.hssWidget > * { width:100%; min-width:0; }
.hssWidgetFrame { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-min-height,72px);box-sizing:border-box;overflow:visible;overscroll-behavior:auto;touch-action:auto; }
.hssWidgetFrame > * { width:100%;min-width:0;box-sizing:border-box; }
.hssWidget[data-hss-kind="announcements"] .hssWidgetFrame { display:grid;place-items:center;text-align:center;overflow:clip; }
.hssWidget[data-hss-kind="announcements"] .hssWidgetFallback { justify-content:center;text-align:center; }
.hssWidget[data-hss-kind="postForm"] .hssWidgetFrame { overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;touch-action:pan-x;scroll-behavior:smooth;scrollbar-width:thin; }
.hssWidget[data-hss-kind="postForm"] :global(.mkw-post-form) { width:max(100%,260px)!important;min-width:260px!important;box-sizing:border-box; }
.hssWidget[data-hss-kind="postForm"] :global(.mkw-post-form footer) { display:block!important;width:100%!important;max-width:none!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;touch-action:pan-x;padding-inline:8px!important;box-sizing:border-box;scrollbar-width:thin; }
.hssWidget[data-hss-kind="postForm"] :global(.mkw-post-form footer > div) { display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;max-width:none!important;overflow:visible!important; }
.hssWidget[data-hss-kind="postForm"] :global(.mkw-post-form footer > div > button) { flex:0 0 38px!important;width:38px!important;min-width:38px!important;height:40px!important; }
.hssWidget[data-hss-kind="digitalClock"] .hssWidgetFrame,
.hssWidget[data-hss-kind="clock"] .hssWidgetFrame,
.hssWidget[data-hss-kind="rssTicker"] .hssWidgetFrame,
.hssWidget[data-hss-kind="onlineUsers"] .hssWidgetFrame { display:grid;place-items:center;overflow:clip; }
.hssWidget[data-hss-kind="digitalClock"] :global([data-testid="mkw-digitalClock"]),
.hssWidget[data-hss-kind="clock"] :global([data-testid="mkw-clock"]),
.hssWidget[data-hss-kind="onlineUsers"] :global([data-testid="mkw-onlineUsers"]) { display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-height:0!important;padding-block:0!important;box-sizing:border-box; }
.hssWidget[data-hss-kind="digitalClock"] :global([data-testid="mkw-digitalClock"]) { padding-block:0!important; }
.hssWidget[data-hss-kind="clock"] :global([data-testid="mkw-clock"]) { opacity:1!important;filter:none!important; }
.hssWidget[data-hss-kind="rssTicker"] :global(.mkw-rss-ticker) { width:100%!important;min-height:0!important;margin:auto 0; }
.hssWidget[data-hss-kind="rss"] :global(.mkw-rss),
.hssWidget[data-hss-kind="trends"] :global(.mkw-trends) { width:100%!important;min-height:0!important; }
.hssWidget[data-hss-kind="rss"] :global(.mkw-rss a) { padding:5px 9px!important;font-size:.8rem; }
.hssWidget[data-hss-kind="trends"] :global(.wbrkwala),
.hssWidget[data-hss-kind="federation"] :global(.wbrkwalb) { height:auto!important;max-height:none!important;overflow:visible!important; }
.hssWidget[data-hss-kind="trends"] :global(.tags > div) { min-height:0!important;padding:7px 9px!important; }
.hssWidget[data-hss-kind="federation"] :global(.instances > .instance) { min-height:0!important;padding:7px 9px!important; }
.hssWidget[data-hss-kind="trends"][data-hss-size="small"] :global(.tags > div:nth-child(n+2)),
.hssWidget[data-hss-kind="federation"][data-hss-size="small"] :global(.instances > .instance:nth-child(n+2)),
.hssWidget[data-hss-kind="trends"][data-hss-size="normal"] :global(.tags > div:nth-child(n+3)),
.hssWidget[data-hss-kind="federation"][data-hss-size="normal"] :global(.instances > .instance:nth-child(n+3)),
.hssWidget[data-hss-kind="trends"][data-hss-size="large"] :global(.tags > div:nth-child(n+4)),
.hssWidget[data-hss-kind="federation"][data-hss-size="large"] :global(.instances > .instance:nth-child(n+4)) { display:none!important; }
.hssWidget[data-hss-kind="notifications"] :global(.mkw-notifications),
.hssWidget[data-hss-kind="timeline"] :global(.mkw-timeline) { width:100%!important;height:auto!important;min-height:var(--hss-widget-min-height,112px)!important;box-sizing:border-box;overflow:clip!important; }
.hssWidget[data-hss-kind="notifications"] :global(.mkw-notifications > div:last-child),
.hssWidget[data-hss-kind="timeline"] :global(.mkw-timeline > div:last-child) { overflow:visible!important; }
.hssWidget[data-hss-kind="notifications"] :global(.mkw-notifications > div:last-child > div > div > div > button),
.hssWidget[data-hss-kind="timeline"] :global(.mkw-timeline > div:last-child > div > div > div > button) { display:none!important; }
.hssWidget[data-hss-kind="notifications"][data-hss-size="small"] :global([data-scroll-anchor]:nth-child(n+2)),
.hssWidget[data-hss-kind="timeline"][data-hss-size="small"] :global([data-scroll-anchor]:nth-child(n+2)),
.hssWidget[data-hss-kind="notifications"][data-hss-size="normal"] :global([data-scroll-anchor]:nth-child(n+3)),
.hssWidget[data-hss-kind="timeline"][data-hss-size="normal"] :global([data-scroll-anchor]:nth-child(n+3)),
.hssWidget[data-hss-kind="notifications"][data-hss-size="large"] :global([data-scroll-anchor]:nth-child(n+4)),
.hssWidget[data-hss-kind="timeline"][data-hss-size="large"] :global([data-scroll-anchor]:nth-child(n+4)) { display:none!important; }
.hssWidget[data-hss-kind="notifications"] :global(.mkw-notifications) { width:100%!important; }
.hssWidget[data-hss-kind="photos"][data-hss-size="small"] :global(.mkw-photos [style*="background-image"]:nth-child(n+4)),
.hssWidget[data-hss-kind="photos"][data-hss-size="normal"] :global(.mkw-photos [style*="background-image"]:nth-child(n+7)) { display:none!important; }
.hssWidget[data-hss-kind="userList"][data-hss-size="small"] :global(.mkw-userList .users > .user:nth-child(n+5)),
.hssWidget[data-hss-kind="userList"][data-hss-size="normal"] :global(.mkw-userList .users > .user:nth-child(n+9)),
.hssWidget[data-hss-kind="userList"][data-hss-size="large"] :global(.mkw-userList .users > .user:nth-child(n+13)) { display:none!important; }
.hssWidget[data-hss-kind="chat"][data-hss-size="small"] :global(.mkw-chat ._gaps_s > a:nth-child(n+2)),
.hssWidget[data-hss-kind="chat"][data-hss-size="normal"] :global(.mkw-chat ._gaps_s > a:nth-child(n+3)),
.hssWidget[data-hss-kind="chat"][data-hss-size="large"] :global(.mkw-chat ._gaps_s > a:nth-child(n+4)) { display:none!important; }
.hssWidget[data-hss-kind="birthdayFollowings"][data-hss-size="small"] :global(.mkw-bdayfollowings a:nth-child(n+7)),
.hssWidget[data-hss-kind="birthdayFollowings"][data-hss-size="normal"] :global(.mkw-bdayfollowings a:nth-child(n+13)) { display:none!important; }
.hssWidget[data-hss-kind="instanceCloud"] :global(.mkw-instance-cloud canvas) { width:100%!important;height:var(--hss-widget-min-height,128px)!important;max-height:var(--hss-widget-min-height,128px)!important; }
.hssWidget[data-hss-kind="profile"] .hssWidgetFrame,
.hssWidget[data-hss-kind="profile"] .hssWidgetFrame > *,
.hssWidget[data-hss-kind="profile"] .hssWidgetFrame > * > * { width:100%!important;max-width:none!important;box-sizing:border-box; }
.hssWidget[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"]) { width:100%!important;min-width:0!important;contain:layout paint;font-variant-numeric:tabular-nums; }
.hssWidget[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"]) * { min-width:0!important;max-width:100%;box-sizing:border-box;font-variant-numeric:tabular-nums; }
.hssWidget[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"] > div) { width:100%!important;overflow:hidden; }
.hssWidget[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"] svg) { max-width:100%!important;height:auto!important; }
.hssWidget[data-hss-kind="aichan"] .hssWidgetFrame { position:relative;height:var(--hss-widget-min-height,168px);min-height:var(--hss-widget-min-height,168px);overflow:hidden; }
.hssWidget[data-hss-kind="aichan"] .hssWidgetFrame > * { position:relative;height:var(--hss-widget-min-height,168px)!important;overflow:hidden!important; }
.hssWidget[data-hss-kind="aichan"] .hssWidgetFrame iframe { position:absolute;top:0;left:50%;width:300px!important;height:350px!important;max-width:none!important;transform:translateX(-50%) scale(var(--hss-aichan-scale,1));transform-origin:top center; }
.hssWidget[data-hss-kind="dice"][data-hss-size="small"] .hssWidgetFrame > * { width:125%!important;transform:scale(.8);transform-origin:top left; }
.hssWidget[data-hss-kind="dice"][data-hss-size="normal"] .hssWidgetFrame > * { width:111.12%!important;transform:scale(.9);transform-origin:top left; }
.hssWidget[data-hss-shape="circle"] { justify-self:center;width:100%;min-width:0;height:var(--hss-widget-min-height, 72px);min-height:0;margin-inline:auto;border-radius:50%;aspect-ratio:1; }
.hssWidget[data-hss-shape="circle"] > * { height:100%; overflow:hidden; border-radius:50%; }
.hssWidget[data-hss-shape="pill"] { width:calc(100% - 4px);max-width:calc(100% - 4px);margin-inline:2px;border-radius:999px; }
.hssWidgetFallback {
	display:flex;
	align-items:center;
	gap:9px;
	width:100%;
	min-width:0;
	min-height:54px;
	padding:7px 8px;
	border:0;
	border-radius:inherit;
	background:transparent;
	color:inherit;
	text-align:left;
	cursor:pointer;
}
.hssWidgetFallback > i { flex:0 0 auto; font-size:22px; }
.hssWidgetFallback > span { display:grid; min-width:0; }
.hssWidgetFallback b,
.hssWidgetFallback small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hssWidgetFallback small { font-size:9px; opacity:.62; }
/* 縮小時専用: 内幅48pxへ左右2pxずつ余白を残し、太い枠線も切らずに縦一列へ収める。 */
.hssCollapsedItem {
    flex:0 0 44px;
    // Let v-show's inline display:none hide unavailable items without losing their saved position.
    display:flex;
    align-items:center;
    justify-content:center;
    width:calc(100% - 4px);
    max-width:44px;
    height:44px;
    min-width:0;
    min-height:44px;
    margin:0 2px;
    padding:0 !important;
    gap:0 !important;
    box-sizing:border-box;
    color:var(--hss-fg, var(--MI_THEME-navFg));
    border:var(--hss-border-width, 1px) var(--hss-border-style, solid) var(--hss-border, transparent);
    background:var(--hss-bg, transparent);
    background-clip:padding-box;
    transform:none !important;
    overflow:visible;
}
.hssCollapsedItem[data-hss-shape="circle"] { border-radius:50%; }
.hssCollapsedItem[data-hss-shape="pill"] { border-radius:999px; height:40px; min-height:40px; flex-basis:40px; }
.sbDivider {
    height:1px;
    background:var(--MI_THEME-divider);
    margin:10px 8px;
}
.sbSpacer {
    flex:1;
}
.sbBottom {
    display:flex;
    flex-direction:column;
    gap:8px;
    padding-top:12px;
    border-top:1px solid var(--MI_THEME-divider);
    margin-top:8px;
    flex-shrink:0;
}
.sbPostBtn {
    display:flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    padding:11px 0;
    border:none;
    border-radius:999px;
    background:linear-gradient(135deg, var(--MI_THEME-accent), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
    color:var(--MI_THEME-fgOnAccent, #fff);
    font-family:inherit;
    font-size:.88rem;
    font-weight:700;
    cursor:pointer;
    transition:all .2s;
    &:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,.15); }
    &:active { transform:scale(.97); }
}
/* 旗鯖fork: デッキUI時のリロードボタン(ノートボタンの上に固定) */
.sbReloadBtn {
    display:flex;
    align-items:center;
    justify-content:center;
    padding:9px 0;
    margin-bottom:8px;
    border:1px solid var(--MI_THEME-divider);
    border-radius:999px;
    background:var(--MI_THEME-panel);
    color:var(--MI_THEME-fg);
    font-size:1.05rem;
    cursor:pointer;
    transition:all .2s;
    &:hover { background:var(--MI_THEME-buttonHoverBg); transform:translateY(-1px); }
    &:active { transform:scale(.97); }
}
.sbBottomRow {
    display:flex;
    align-items:center;
    gap:6px;
}
.sbBottomIcon {
    width:36px;
    height:36px;
    border-radius:8px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:transparent;
    border:none;
    color:var(--MI_THEME-navFg);
    opacity:.5;
    cursor:pointer;
    font-size:1.05rem;
    transition:all .2s;
    flex-shrink:0;
    &:hover { opacity:1; background:color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent); }
}
/* 旗鯖fork: デッキモード切替トグル */
/* 旗鯖fork(タスク6): 縮小表示時にサーバーアイコン下に出す拡大ボタン[＞] */
.sbExpandBtn {
    display:flex;
    align-items:center;
    justify-content:center;
    width:40px;
    height:32px;
    margin:0 auto 12px;
    border-radius:8px;
    border:none;
    background:color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent);
    color: var(--MI_THEME-navFg);
    cursor:pointer;
    opacity:.7;
    transition:all .2s;
}
.sbExpandBtn:hover { opacity:1; background:color-mix(in srgb, var(--MI_THEME-navFg) 16%, transparent); }
.sbModeToggle {
    position: relative;
    display:flex;
    gap:2px;
    padding:3px;
    margin-bottom:8px;
    border-radius:999px;
    background:color-mix(in srgb, var(--MI_THEME-accent) 8%, transparent);
}
.sbModeBtn {
    flex:1;
    padding:6px 0;
    border:none;
    border-radius:999px;
    background:none;
    color:var(--MI_THEME-fg);
    opacity:.55;
    cursor:pointer;
    font-size:1em;
    transition:background .15s, opacity .15s;
    &:hover { opacity:.85; }
}
.sbModeActive {
    background:var(--MI_THEME-accent);
    color:var(--MI_THEME-fgOnAccent);
    opacity:1;
    &:hover { opacity:1; }
}
/* 旗鯖fork: デッキモード表示領域 */
.deckArea {
    height:100%;
    position:relative;
}
/* 旗鯖fork: デッキ背景のヘッダー画像ぼかし */
.deckBanner {
    position:absolute;
    inset:0;
    z-index:0;
    overflow:hidden;
    &::after {
        content:'';
        position:absolute;
        inset:0;
        background:color-mix(in srgb, var(--MI_THEME-bg) 78%, transparent);
    }
}
.deckBannerImg {
    width:100%;
    height:100%;
    object-fit:cover;
    filter:blur(20px) saturate(1.2);
    transform:scale(1.1);
}
/* 背景はmainColumn全体に敷き、チャーム領域まで途切れず覆う。
   後続のmainColumnInnerより奥で、スクロールには追従させない。 */
.timelineBanner {
    position:absolute;
    inset:0;
    z-index:0;
    overflow:hidden;
    &::after {
        content:'';
        position:absolute;
        inset:0;
        background:color-mix(in srgb, var(--MI_THEME-bg) 78%, transparent);
    }
}
.timelineBannerImg {
    width:100%;
    height:100%;
    object-fit:cover;
    filter:blur(20px) saturate(1.2);
    transform:scale(1.1);
}
.deckAreaInner {
    position:relative;
    z-index:1;
    height:100%;
}
/* 旗鯖fork: macの履歴スワイプ(横オーバースクロール)による「戻る」誤発火を抑止 */
/* .root/.content だけでは Mac PWA のトラックパッド横スワイプ(履歴ナビ)が止まらないため、
   html/body にもグローバルに overscroll-behavior-x:none を効かせる。 */
:global(html), :global(body) {
    overscroll-behavior-x: none;
}
.root {
    overscroll-behavior-x:none;
}
.content {
    overscroll-behavior-x:none;
}

.sbAccount {
    flex:1;
    min-width:0;
    display:flex;
    align-items:center;
    gap:8px;
    padding:6px 8px;
    border-radius:8px;
    border:none;
    background:transparent;
    cursor:pointer;
    font-family:inherit;
    transition:background .2s;
    &:hover { background:color-mix(in srgb, var(--MI_THEME-navFg) 8%, transparent); }
}
.sbAvatarImg {
    width:28px;
    height:28px;
    border-radius:999px;
    object-fit:cover;
    flex-shrink:0;
}
.sbUsername {
    font-size:.78rem;
    color:var(--MI_THEME-navFg);
    opacity:.6;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
// リアルタイムモード用インラインスイッチ
.sbOnOff {
    margin-left:auto;
    flex-shrink:0;
    padding:2px 9px;
    border-radius:999px;
    font-size:.72em;
    font-weight:700;
    background:color-mix(in srgb, var(--MI_THEME-navFg) 14%, transparent);
    color:var(--MI_THEME-navFg);
    opacity:.6;
    transition:background .2s, color .2s, opacity .2s;
}
.sbOnOffOn {
    background:var(--MI_THEME-accent);
    color:var(--MI_THEME-fgOnAccent);
    opacity:1;
}
.sbToggle {
    margin-left:auto;
    width:32px;
    height:18px;
    border-radius:9px;
    background:color-mix(in srgb, var(--MI_THEME-navFg) 15%, transparent);
    position:relative;
    flex-shrink:0;
    transition:background .25s;
    &::after {
        content:'';
        position:absolute;
        top:2px;
        left:2px;
        width:14px;
        height:14px;
        border-radius:50%;
        background:color-mix(in srgb, var(--MI_THEME-navFg) 50%, transparent);
        transition:all .25s cubic-bezier(.34,1.56,.64,1);
    }
}
.sbToggleOn {
    background:color-mix(in srgb, var(--MI_THEME-accent) 40%, transparent);
    &::after {
        left:16px;
        background:var(--MI_THEME-accent);
    }
}
.mainColumn {
    flex:1;
    min-width:0;
    display:flex;
    flex-direction:column;
    height:var(--MI-viewport-height, 100dvh);
    position:relative;
    overflow:hidden;
}
/* 旗鯖fork: 上部メニューモードのナビバー */
.topNav {
    flex-shrink: 0; display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; position: sticky; top: 0; z-index: 50;
    background: color-mix(in srgb, var(--MI_THEME-bg) 72%, transparent);
    backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
    border-bottom: 1px solid var(--MI_THEME-divider);
}
.topNavSolid { background: var(--MI_THEME-bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
.topNavScroll {
    flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px;
    overflow-x: auto; scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
}
.topNavItem {
    flex-shrink: 0; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    min-width: 56px; padding: 5px 10px; border: none; background: transparent; cursor: pointer;
    border-radius: 12px; color: var(--MI_THEME-fg); opacity: .7; transition: background .12s, opacity .12s;
    font-size: .68em; font-weight: 600; white-space: nowrap;
    > i { font-size: 1.5em; }
    &:hover { opacity: 1; background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent); }
}
.topNavItemActive { opacity: 1; color: var(--MI_THEME-accent); background: color-mix(in srgb, var(--MI_THEME-accent) 14%, transparent); }
.topNavLogo {
    flex-shrink: 0; width: 40px; height: 40px; padding: 0; border-radius: 12px; border: none; cursor: pointer; overflow: hidden;
    display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
    > i { font-size: 1.3em; color: var(--MI_THEME-accent); }
}
.topNavLogoImg { width: 100%; height: 100%; object-fit: cover; }
.topNavDivider { flex-shrink: 0; width: 1px; height: 28px; background: var(--MI_THEME-divider); margin: 0 2px; }
.topNavPost {
    flex-shrink: 0; display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; cursor: pointer;
    border-radius: 999px; background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); font-weight: 700; font-size: .85em;
    &:hover { opacity: .9; }
}
.topNavAvatar { flex-shrink: 0; width: 38px; height: 38px; padding: 0; border: none; background: transparent; cursor: pointer; border-radius: 999px; }
.topNavAvatarImg { width: 38px; height: 38px; }
.topNavDot { position: absolute; top: 4px; right: 10px; width: 7px; height: 7px; border-radius: 999px; background: var(--MI_THEME-accent); }
.topNavDotBlue { position: absolute; top: 4px; right: 10px; width: 7px; height: 7px; border-radius: 999px; background: #4a9eff; }
.mainColumnInner {
    flex:1;
    min-width:0;
    display:flex;
    flex-direction:column;
    height:var(--MI-viewport-height, 100dvh);
    position:relative;
    overflow:hidden;
}
.announcementsBanner {
    flex-shrink:0;
    min-width:0;
    position:relative;
    z-index:201;
}
.desktopWidgets {
    // タイムラインの切替演出とウィジェットバーの重なり順を分離する。
    isolation:isolate;
    --widget-bar-width:350px;
    width:var(--widget-bar-width);
    flex-shrink:0;
    height:var(--MI-viewport-height, 100dvh);
    box-sizing:border-box;
    overflow:hidden;
    border-left:none;
    background:var(--MI_THEME-bg);
    position:relative;
    transition:width .28s cubic-bezier(.22,1,.36,1);
}
.desktopWidgetsBanner {
    position:absolute;
    inset:0;
    z-index:0;
    overflow:hidden;
    transition:opacity .18s ease;
    &::after {
        content:'';
        position:absolute;
        inset:0;
        background:var(--MI_THEME-bg);
        opacity:.75;
        backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);
    }
}
.desktopWidgetsBannerImg {
    width:100%;
    height:100%;
    object-fit:cover;
    filter:blur(16px) saturate(1.2);
    transform:scale(1.1);
}
.desktopWidgetsInner {
    // 内容は元の幅を保ち、バーの右端から開閉する。カードや文字を押し潰さない。
    position:absolute;
    top:0;
    right:0;
    width:var(--widget-bar-width);
    z-index:1;
    height:100%;
    box-sizing:border-box;
    overflow-y:auto;
    padding:16px 12px 0;
    transition:padding .28s cubic-bezier(.22,1,.36,1);
    scrollbar-width:thin;
    scrollbar-color:color-mix(in srgb, var(--MI_THEME-fg) 12%, transparent) transparent;

    /* スクロール末尾の余白を、実体のあるウィジェット領域の margin で確保する。 */
    > div {
        margin-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    }

    /* 旗鯖fork: サーバーメトリクス等のウィジェットでヘッダが sticky 設定されているため、
       スクロール時にタイトルバーだけが分離して動いて見える問題があった。
       ウィジェット領域内では sticky を打ち消して、コンテンツと一緒にスクロールするようにする。 */
    :deep(.mkw-container > header) {
        position: relative !important;
        top: auto !important;
    }

    // ウィジェットカード間のスタイル
    :deep(.mkw-container) {
        border-radius:14px !important;
        border:none !important;
        background:var(--MI_THEME-panel) !important;
        box-shadow:0 2px 12px rgba(0,0,0,.06);
        margin-bottom:12px !important;
        overflow:hidden;
        transition:box-shadow .3s ease;
    }
    :deep(.mkw-container > header) { border-radius:14px 14px 0 0; }
    :deep(.mkw-container > div) { border-top:none !important; }
    :deep(._panel) {
        border-radius:14px !important;
        border:none !important;
        background:var(--MI_THEME-panel) !important;
        box-shadow:0 2px 12px rgba(0,0,0,.06);
        transition:box-shadow .3s ease;
    }
}

// ===== トップバー（ピル型、スクロール連動） =====
.topBar {
    container:hataskey-navbar / inline-size;
    position:fixed; top:calc(var(--simple-announcements-height, 0px) + var(--MI-fixed-top-inset, 0px)); left:0; right:0; z-index:200;
    display:flex; justify-content:center; align-items:flex-start; gap:6px;
    padding:calc(10px + env(safe-area-inset-top,0px)) 16px 8px;
	box-sizing:border-box; min-width:0;
    pointer-events:none;
    transition: transform .35s cubic-bezier(.22,1,.36,1), opacity .3s ease;
    transform: translateY(0); opacity: 1;
}
.desktopLayout .topBar {
    position:absolute;
    top:var(--simple-announcements-height, 0px);
    left:0; right:0;
}
.topBar[data-hidden='true'] {
    transform: translateY(calc(-100% - 20px));
    opacity: 0;
    transition: transform .25s cubic-bezier(.55,.06,.68,.19), opacity .2s ease;
}
.topNavStack {
    position:relative; display:flex; flex-direction:column; align-items:center; gap:7px;
	width:max-content; min-width:0; max-width:min(680px,100%); flex:0 1 auto; pointer-events:none;
}
.topNavStack[data-navbar-notice='emojiAdded'] { width:min(640px,100%); }
.topNavStack[data-navbar-notice='emojiAdded'] .topPillFrame,
.topNavStack[data-navbar-notice='emojiAdded'] .topPill { width:100%; }
.topNavStack[data-navbar-notice='noteAction'] { width:min(510px,100%); }
.topNavStack[data-navbar-notice='noteAction'] .topPillFrame,
.topNavStack[data-navbar-notice='noteAction'] .topPill { width:100%; }

// ナビの内容のクリップを保ち、通知のぼかした縁取りだけを背面へ広げる。
.topPillFrame {
    --hata-toast-leave-offset:-10px;
    position:relative; isolation:isolate; border-radius:24px;
    width:max-content; max-width:100%; min-width:0;
}
.topPillFrame > svg[data-integrated='true'] {
    overflow:visible; z-index:-1;
    stroke-width:40; stroke-linecap:round;
    filter:blur(14px); opacity:.55;
}
// Like HyNav, keep the native glow alive after the shared card has left.
.topPillFrame > svg[data-integrated='true'] { display:none; }
.notificationBloom {
    position:absolute; inset:0; border-radius:inherit; z-index:-1; pointer-events:none;
    opacity:1; transition:opacity .55s cubic-bezier(.4,0,.2,1);
}
.notificationBloom > svg {
    overflow:visible; stroke-width:40; stroke-linecap:round;
    filter:blur(14px); opacity:.55; transition:filter .55s ease;
}
.notificationBloom path { transition:stroke-dashoffset .1s linear; }
.notificationBloom[data-leaving='true'] { opacity:0; }
.notificationBloom[data-leaving='true'] > svg { filter:blur(20px); }
.topNavStack[data-notification-sizing='true'] .topPillFrame,
.topNavStack[data-notification-sizing='true'] .topPill { width:100%; }
.topPill {
    position:relative; display:flex; flex-direction:column; align-items:center;
    border-radius:24px; width:max-content; max-width:100%; min-width:0; box-sizing:border-box;
    pointer-events:auto; transition:background .3s,box-shadow .3s; overflow:hidden;
}
.topPill[data-notification='true'], .topPill[data-new-notes='true'] { min-width:min(360px,100%); }
.navbarPullContent {
    display:contents;
}
.navbarPullContent[inert] { pointer-events:none; user-select:none; }
.topNavStack[data-pull-active='true'] { transition:none; }
.topNavStack[data-pull-active='true'] .topPillFrame { width:100%; }
.topNavStack[data-pull-active='true'] .topPill {
    width:100%; min-width:0;
    height:calc(var(--navbar-pull-base-height) + var(--navbar-pull-height,0px));
    background:var(--navbar-pull-base-color); transition:none;
}
.topNavStack[data-pull-active='true'] .topPill::before {
    content:''; position:absolute;
    inset:calc(var(--navbar-pull-surface-top,0px) * var(--navbar-pull-nav-opacity,1)) 0 0;
    background:var(--navbar-pull-surface-color,transparent); pointer-events:none;
}
.topNavStack[data-pull-active='true'] .navbarPullContent {
    position:relative; display:flex; flex-direction:column; align-items:center; flex:none;
    width:100%; max-width:100%; min-width:0; height:var(--navbar-pull-base-height); overflow:hidden;
    opacity:var(--navbar-pull-nav-opacity,1);
    transform:translateY(var(--navbar-pull-shift,0px));
}
.navbarPullPrompt {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px;
    padding:0 16px; color:var(--navbar-pull-prompt-color,var(--MI_THEME-accent));
    font-size:13px; font-weight:700; line-height:1.5;
    opacity:var(--navbar-pull-prompt-opacity,0); pointer-events:none;
}
.navbarPullSymbol { font-size:19px; transform:rotate(var(--navbar-pull-turn,0deg)); }
.topNavStack[data-pull-phase='refreshing'][data-pull-motion='true'] .navbarPullSymbol { animation:navbarPullSpin 1.6s linear infinite; }
@keyframes navbarPullSpin {
    from { transform:rotate(var(--navbar-pull-turn,0deg)); }
    to { transform:rotate(calc(var(--navbar-pull-turn,0deg) + 360deg)); }
}
@media (prefers-reduced-motion:reduce) {
    .topNavStack[data-pull-phase='refreshing'] .navbarPullSymbol { animation:none; }
}
.topPillNav {
    order:1; display:flex; align-items:center; gap:2px; padding:4px 6px;
    width:max-content; max-width:100%; min-width:0; box-sizing:border-box;
}
.topPillTabs {
    display:flex; align-items:center; gap:2px;
    width:max-content; max-width:100%; min-width:0; box-sizing:border-box;
    overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none;
    &::-webkit-scrollbar { display:none; }
}
.notificationViewport {
	order:3; position:relative; width:100%; min-width:0; overflow:hidden;
    transition:height .35s ease;
}
.notificationViewport[data-mobile='true'] { order:0; }
.newNotesViewport {
    order:2; display:grid; grid-template-rows:0fr; width:100%; min-width:0; opacity:0;
    transition:grid-template-rows .35s cubic-bezier(.22,1,.36,1),opacity .2s ease;
}
.newNotesViewport[data-active='true'] { grid-template-rows:1fr; opacity:1; }
.newNotesContent { min-height:0; overflow:hidden; }
.newNotesButton {
    --hata-new-notes-accent:var(--MI_THEME-accent);
    --hata-new-notes-fg:var(--MI_THEME-fgOnAccent);
    position:relative; display:flex; align-items:center; justify-content:center;
    width:100%; height:48px; box-sizing:border-box; padding:0 20px;
    background:var(--hata-new-notes-accent); color:var(--hata-new-notes-fg);
    font:inherit; font-size:15px; font-weight:800; line-height:1.5;
    overflow:hidden; transition:background .15s ease;
    &:hover:not(:disabled) { background:color-mix(in srgb,var(--MI_THEME-accent) 90%,var(--MI_THEME-fg)); }
    &:active:not(:disabled) { background:color-mix(in srgb,var(--MI_THEME-accent) 80%,var(--MI_THEME-fg)); }
    &:focus-visible { outline:2px solid var(--MI_THEME-fgOnAccent); outline-offset:-3px; border-radius:0; }
}
.newNotesVisual { position:relative; display:inline-flex; min-width:0; max-width:100%; }
.newNotesFlash { position:absolute; inset:0; background:var(--MI_THEME-fgOnAccent); opacity:0; pointer-events:none; }
.newNotesStatus { position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
@media(max-width:1099px) {
    .newNotesButton { height:44px; padding:0 16px; font-size:14px; }
}

.topBar[data-toast-motion='false'] .notificationViewport,
.topBar[data-toast-motion='false'] .notificationBloom,
.topBar[data-toast-motion='false'] .notificationBloom > svg,
.topBar[data-toast-motion='false'] .notificationBloom path,
.topBar[data-toast-motion='false'] .newNotesViewport,
.topBar[data-toast-motion='false'] .newNotesButton { transition:none; }
@media (prefers-reduced-motion:reduce) {
    .notificationViewport, .notificationBloom, .notificationBloom > svg, .notificationBloom path, .newNotesViewport, .newNotesButton { transition:none; }
}

.timelinePicker {
    position:absolute; top:calc(100% + 7px); left:0; z-index:2;
    display:flex; align-items:center; gap:7px; width:100%; max-width:100%; box-sizing:border-box;
    padding:6px; overflow-x:auto; scrollbar-width:none; pointer-events:auto;
    border-radius:9999px; animation:timelinePickerIn .18s ease-out;
    background:color-mix(in srgb,var(--MI_THEME-panel) 88%,transparent);
    box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px color-mix(in srgb,var(--MI_THEME-fg) 9%,transparent) inset;
    backdrop-filter:blur(24px) saturate(1.35); -webkit-backdrop-filter:blur(24px) saturate(1.35);
    &::-webkit-scrollbar { display:none; }
}
.timelinePickerItem {
    display:flex; align-items:center; gap:6px; flex:0 0 auto; max-width:220px;
    height:34px; padding:0 14px; border:0; border-radius:9999px; cursor:pointer;
    color:var(--MI_THEME-fg); background:color-mix(in srgb,var(--MI_THEME-fg) 6%,transparent);
    font:inherit; font-size:.84em; white-space:nowrap;
    span { overflow:hidden; text-overflow:ellipsis; }
    &:hover { background:color-mix(in srgb,var(--MI_THEME-accent) 14%,transparent); }
}
.timelinePickerItemActive { color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); font-weight:700; }
.timelinePickerEmpty { display:flex; align-items:center; gap:8px; padding:0 4px 0 12px; font-size:.82em; white-space:nowrap; }
.timelinePickerOptions {
    display:flex; align-items:center; gap:5px; height:34px; padding:0 12px; border:0; border-radius:9999px;
    color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); cursor:pointer; font:inherit; font-weight:700;
    &:hover { filter:brightness(1.05); }
    &:focus-visible { outline:2px solid var(--MI_THEME-accent); outline-offset:1px; }
}
@keyframes timelinePickerIn { from { opacity:0; transform:translateY(-5px) scale(.98); } to { opacity:1; transform:none; } }
.topBarDark .topPill {
    --hata-toast-fg:rgba(255,255,255,.9); --hata-toast-muted:rgba(255,255,255,.65);
    background:rgba(30,30,30,.78); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 4px 24px rgba(0,0,0,.15),0 0 0 .5px rgba(255,255,255,.08) inset;
}
.topBarLight .topPill {
    --hata-toast-fg:rgba(0,0,0,.85); --hata-toast-muted:rgba(0,0,0,.6);
    background:rgba(245,245,245,.78); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 4px 24px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.06) inset;
}
.topBar[data-toast-motion='false'] .topNavStack { transition:none; }
.topBar[data-notification-only='true'] .topNavStack { width:min(360px,100%); max-width:100%; }
.topBar[data-notification-only='true'] .topPillFrame { width:100%; }
.topBar[data-notification-only='true'] .topPill {
    width:100%; backdrop-filter:none; -webkit-backdrop-filter:none;
}
.topBarDark[data-notification-only='true'] .topPill { background:rgb(30,30,30); }
.topBarLight[data-notification-only='true'] .topPill { background:rgb(245,245,245); }
.topTabBtn {
    min-width:40px; height:40px; border-radius:9999px; background:transparent; border:none;
    font-size:1.1em; cursor:pointer; display:flex; align-items:center; justify-content:center;
    gap:6px; padding:0 12px;
    transition:all .25s ease; font-family:inherit; flex-shrink:0;
    box-sizing:border-box;
}
.topBarDark .topTabBtn { color:rgba(255,255,255,.4); }
.topBarLight .topTabBtn { color:rgba(0,0,0,.38); }
.topTabActive { color:var(--MI_THEME-accent) !important; }
.topBarDark .topTabActive { background:rgba(255,255,255,.1); }
.topBarLight .topTabActive { background:rgba(0,0,0,.06); }
.listTabPill {
    display:flex; align-items:center; flex-shrink:0; border-radius:9999px;
    transition:background .25s ease,box-shadow .25s ease;
}
.listTabPillActive { padding-right:4px; }
.topBarDark .listTabPillActive { background:rgba(255,255,255,.1); box-shadow:0 0 0 1px rgba(255,255,255,.08) inset; }
.topBarLight .listTabPillActive { background:rgba(0,0,0,.06); box-shadow:0 0 0 1px rgba(0,0,0,.06) inset; }
.listTabMain.topTabActive { background:transparent; }
.listSelectBtn {
    width:32px; height:32px; padding:0; border:0; border-radius:9999px;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    background:transparent; color:var(--MI_THEME-accent); cursor:pointer;
    transition:background .15s ease,transform .15s ease;
    &:hover { background:color-mix(in srgb,var(--MI_THEME-accent) 14%,transparent); }
    &:active { transform:scale(.92); }
    &:focus-visible { outline:2px solid var(--MI_THEME-accent); outline-offset:1px; }
}
// アクティブタブのテキストラベル
.topTabLabel {
    font-size:.78em; font-weight:600; line-height:1;
    white-space:nowrap; max-width:100px;
    overflow:hidden; text-overflow:ellipsis;
}
.topTabCopy { display:flex; min-width:0; flex-direction:column; align-items:flex-start; gap:2px; }
.topTabName { max-width:112px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.62em; line-height:1; opacity:.72; }
// 外部TL (OH/OL) のアイコン色を変えて区別
.topTabExt { color:var(--MI_THEME-accent) !important; opacity:.45; }
.topTabExt.topTabActive { opacity:1; }
// ピル内のディバイダー（TLタブとページ遷移タブの区切り）
.topTabDivider {
    width:1px; height:20px; flex-shrink:0; margin:0 4px;
}
.topBarDark .topTabDivider { background:rgba(255,255,255,.15); }
.topBarLight .topTabDivider { background:rgba(0,0,0,.1); }

// ===== ページビューヘッダ =====
.pageHeader {
    flex-shrink:0; height:50px; background:var(--MI_THEME-panel); border-bottom:solid 1px var(--MI_THEME-divider);
    display:flex; align-items:center; padding:0 12px; z-index:100;
}
.pageBackBtn {
    background:transparent; border:none; font-size:1.2em; padding:8px;
    color:var(--MI_THEME-fg); cursor:pointer; flex-shrink:0;
}
.pageTitle {
    flex:1; text-align:center; font-weight:bold; font-size:.95em;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}

// ===== コンテンツ =====
.content { flex:1; overflow-y:auto; position:relative; min-height:0; }
.timelineContainer {
    max-width:800px; margin:0 auto; min-height:100%;
    /* 旗鯖fork: 従来はタイムライン列の左右に divider の縦線を出していたが、
       ノートを一体化した太い帯として見せる方針 (連なるノート群が途切れない見た目) と
       ヘッダー画像ぼかし背景 (Hataskey UI 2) の上で縦線が浮く問題の両方に対処するため撤去。 */
    padding-top:calc(56px + env(safe-area-inset-top,0px));
    padding-bottom:calc(80px + env(safe-area-inset-bottom,0px));
    touch-action:pan-y;
}
.desktopLayout .timelineContainer {
    padding-top:calc(56px);
}
.timelineContainerWithFixedForm { padding-top:0; }
.fixedFormHost { max-width:800px; margin:0 auto; padding-top:calc(56px + env(safe-area-inset-top,0px)); }
.desktopLayout .fixedFormHost { padding-top:56px; }
/* 旗鯖fork: タイムライン上部固定投稿フォーム */
.fixedPostForm {
    margin: 0 auto var(--MI-margin) auto;
    max-width: 800px;
}
.pageContainer { height:100%; overflow-y:auto; }
.collectionPageContainer {
    box-sizing:border-box;
    padding-top:calc(68px + env(safe-area-inset-top,0px));
}

// ===== タブの方向に沿ったスライドとフェード（合計約300ms） =====
.timelineEnterActive { transition:opacity .18s ease, transform .18s cubic-bezier(.22,1,.36,1); }
.timelineLeaveActive { transition:opacity .12s ease, transform .12s cubic-bezier(.22,1,.36,1); }
.timelineEnterFrom { opacity:0; transform:translateX(calc(var(--timeline-slide-direction,1) * 24px)); }
.timelineLeaveTo { opacity:0; transform:translateX(calc(var(--timeline-slide-direction,1) * -24px)); }
.timelineEnterTo, .timelineLeaveFrom { opacity:1; transform:translateX(0); }
.timelineContainer[data-timeline-motion='false'] { transition:none!important; }
@media(prefers-reduced-motion:reduce) {
    .timelineEnterActive, .timelineLeaveActive { transition:none!important; }
}

// ===== ボトムバー =====
.navbarSearchScrim { position:fixed; inset:0; z-index:199; background:#0002; touch-action:none; }
.bottomBar.bottomSearchBar { bottom:var(--navbar-search-keyboard-inset,0px); align-items:flex-end; }
.bottomSideSpacer { width:48px; flex:none; }
.bottomSearchBar > .sideBtn, .bottomSideSpacer { transition:width .38s ease,opacity .2s ease,transform .38s ease; }
.bottomSearchBar[data-search-open='true'] > .sideBtn, .bottomSearchBar[data-search-open='true'] > .bottomSideSpacer { width:0; min-width:0; padding:0; opacity:0; transform:scale(.55); pointer-events:none; }
.bottomSearchBar .searchPill { position:relative; isolation:isolate; display:flex; flex-direction:column; gap:0; padding:0; min-width:0; border-radius:30px; overflow:hidden; transition:flex-grow .42s ease,border-radius .42s ease; }
.bottomSearchBar[data-search-open='true'] .searchPill { flex:1; border-radius:26px; }
.searchPill::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; box-shadow: inset 0 0 0 2px var(--MI_THEME-accent), 0 0 14px color-mix(in srgb, var(--MI_THEME-accent) 18%, transparent); transition: opacity .2s ease; }
.searchPill:has(:global([data-embedded-search] input[type='search']:focus))::after { opacity: 1; }
.searchPill[data-search-open='false'] .navbarSearchBody { width:0; }
.bottomNavRow { display:flex; justify-content:center; align-items:center; gap:4px; padding:6px 8px; flex:none; }
.bottomNavRow > button:disabled { opacity:.38; cursor:default; }
.navbarSearchBody { width:100%; min-height:0; overflow:hidden; transition:height .46s cubic-bezier(.22,1,.36,1),opacity .2s ease; }
.navbarSearchBody[aria-hidden='true'] { opacity:0; pointer-events:none; }
.searchPill[data-search-open='true'] .bottomNavRow { position:relative; }
.searchPill[data-search-open='true'] .bottomNavRow::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:var(--MI_THEME-divider); }
.navbarSearchIcons { display:grid; place-items:center; }
.navbarSearchIcon, .navbarSearchCloseIcon { grid-area:1/1; transition:opacity .2s ease,transform .25s ease; }
.navbarSearchCloseIcon { opacity:0; transform:scale(.55) rotate(-35deg); }
.navbarSearchIcons[data-open='true'] .navbarSearchIcon { opacity:0; transform:scale(.55) rotate(35deg); }
.navbarSearchIcons[data-open='true'] .navbarSearchCloseIcon { opacity:1; transform:scale(1); }
.bottomSearchBar[data-search-motion='false'], .bottomSearchBar[data-search-motion='false'] * { transition:none!important; }
@media(prefers-reduced-motion:reduce) { .bottomSearchBar, .bottomSearchBar * { transition:none!important; } }

.bottomBar {
    position:fixed; bottom:0; left:0; right:0; z-index:200;
    display:flex; justify-content:center; align-items:center; gap:8px;
    padding:0 16px calc(12px + env(safe-area-inset-bottom,0px));
    pointer-events:none;
    transition: transform .35s cubic-bezier(.22,1,.36,1), opacity .3s ease;
    transform: translateY(0); opacity: 1;
}
.desktopLayout .bottomBar {
    position:absolute;
    left:0; right:0;
}
.bottomBarHidden {
    transform: translateY(calc(100% + 20px));
    opacity: 0;
    transition: transform .25s cubic-bezier(.55,.06,.68,.19), opacity .2s ease;
}

.navPill {
    display:flex; align-items:center; gap:4px; padding:6px 8px; border-radius:9999px;
    pointer-events:auto; transition:background .3s,box-shadow .3s;
}

.bottomBarDark .navPill {
    background:color-mix(in srgb,var(--MI_THEME-panel) 92%,transparent); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 5px 26px rgba(0,0,0,.24),0 0 0 1px color-mix(in srgb,var(--MI_THEME-fg) 13%,transparent) inset;
}
.bottomBarLight .navPill {
    background:color-mix(in srgb,var(--MI_THEME-panel) 92%,transparent); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 5px 26px rgba(0,0,0,.16),0 0 0 1px color-mix(in srgb,var(--MI_THEME-fg) 13%,transparent) inset;
}
.navBtn {
    width:44px; height:44px; border-radius:50%; background:transparent; border:none; cursor:pointer;
    position:relative; display:flex; align-items:center; justify-content:center;
    font-size:1.15em; transition:all .25s cubic-bezier(.34,1.56,.64,1); font-family:inherit; padding:0;
}
.bottomBarDark .navBtn,
.bottomBarLight .navBtn { color:color-mix(in srgb,var(--MI_THEME-fg) 76%,transparent); }
.navActive { color:var(--MI_THEME-accent) !important; }
.bottomBarDark .navActive { background:rgba(255,255,255,.1); }
.bottomBarLight .navActive { background:rgba(0,0,0,.06); }

// サイドバー & 投稿ボタン（ピルの外側、同じグラスデザイン）
.sideBtn {
    width:48px; height:48px; border-radius:9999px; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center; font-size:1.15em;
    pointer-events:auto; transition:all .25s cubic-bezier(.34,1.56,.64,1); flex-shrink:0;
}
.bottomBarDark .sideBtn {
    background:color-mix(in srgb,var(--MI_THEME-panel) 92%,transparent); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 5px 26px rgba(0,0,0,.24),0 0 0 1px color-mix(in srgb,var(--MI_THEME-fg) 13%,transparent) inset; color:color-mix(in srgb,var(--MI_THEME-fg) 76%,transparent);
}
.bottomBarLight .sideBtn {
    background:color-mix(in srgb,var(--MI_THEME-panel) 92%,transparent); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4);
    box-shadow:0 5px 26px rgba(0,0,0,.16),0 0 0 1px color-mix(in srgb,var(--MI_THEME-fg) 13%,transparent) inset; color:color-mix(in srgb,var(--MI_THEME-fg) 76%,transparent);
}
.sideBtn:active { transform:scale(.9); }

/* 旗鯖fork(Hataskey UI 2): 上部/下部ナビバーもノートと同じガラス面デザインで統一する。
   透過率は `--htk-glass-card-opacity` (simpleUi.glassUiCardOpacity から boot 経由で注入、
   default 55%) で連動。ダーク/ライトはテーマ変数 (--MI_THEME-panel/accent) 経由。
   デザインの骨格 (ピル/ボタンの形状・レイアウト) は保持し、色/背景のみ差し替える。 */
:global(html.hataGlassUi) .topNav {
    background: color-mix(in srgb,
        color-mix(in srgb, var(--MI_THEME-accent) 12%, var(--MI_THEME-panel))
        var(--htk-glass-card-opacity, 55%),
        transparent) !important;
    backdrop-filter: blur(18px) saturate(1.5);
    -webkit-backdrop-filter: blur(18px) saturate(1.5);
    border-bottom-color: color-mix(in srgb, var(--MI_THEME-divider) 50%, transparent);
}
/* topNavSolid の背景単色化は glass モードでは無効化 (glass 有効時は常にガラス面) */
:global(html.hataGlassUi) .topNavSolid { background: color-mix(in srgb,
    color-mix(in srgb, var(--MI_THEME-accent) 12%, var(--MI_THEME-panel))
    var(--htk-glass-card-opacity, 55%),
    transparent) !important; backdrop-filter: blur(18px) saturate(1.5) !important; -webkit-backdrop-filter: blur(18px) saturate(1.5) !important; }

:global(html.hataGlassUi) .bottomBarDark .navPill,
:global(html.hataGlassUi) .bottomBarDark .sideBtn,
:global(html.hataGlassUi) .bottomBarLight .navPill,
:global(html.hataGlassUi) .bottomBarLight .sideBtn {
    background: color-mix(in srgb,
        color-mix(in srgb, var(--MI_THEME-accent) 12%, var(--MI_THEME-panel))
        90%,
        transparent) !important;
    backdrop-filter: blur(22px) saturate(1.5) !important;
    -webkit-backdrop-filter: blur(22px) saturate(1.5) !important;
}

.badge { position:absolute; top:8px; right:8px; width:8px; height:8px; background:var(--MI_THEME-indicator); border-radius:50%; }
.badgeCount {
    position:absolute; top:2px; right:0; min-width:16px; height:16px; padding:0 4px; border-radius:8px;
    background:var(--MI_THEME-indicator, #f44); color:#fff; font-size:.6em; font-weight:700;
    display:flex; align-items:center; justify-content:center; line-height:1;
}
.extBadge {
    position:absolute; top:2px; right:0; min-width:16px; height:16px; padding:0 4px; border-radius:8px;
    background:#e74040; color:#fff; font-size:.6em; font-weight:700;
    display:flex; align-items:center; justify-content:center; line-height:1;
}

// デスクトップではウィジェットバーを非表示にする閾値
@media (max-width: 1100px) {
    .desktopWidgets { display:none; }
}

// ===== 旗鯖fork: 横開き折りたたみ端末(メインディスプレイ) =====
// 中央はモバイル表示のまま、右にウィジェットを常時出して少しPCライクにする。
// ⚠️PC用の .desktopLayout / .desktopWidgets の指定は一切変更せず、
//   data-hata-foldable が付いたときだけ上書きする(PC表示を巻き込まないため)。
// ⚠️上の @media(max-width:1100px) が .desktopWidgets を display:none にしているので、
//   ここで戻す。詳細度で勝つ形にしてあり、記述順には依存しない。
// ⚠️この2規則は必ず module ブロック(この <style module> の中)に置くこと。
//   末尾の global ブロックへ書くと .root / .desktopWidgets がハッシュ名に解決されず、
//   セレクタがどこにも当たらないまま「書いたのに効かない」状態になる。
// ⚠️.root の直下の子は サイドバー(PC時のみ) / .mainColumn / .desktopWidgets だけ。
//   上下のバーは .mainColumn の中にあるので、row にしてもモバイル表示は崩れない。
.root[data-hata-foldable='true'] {
    flex-direction: row;
}

.root[data-hata-foldable='true'] .desktopWidgets {
    display: block;
    // PCの350pxは折りたたみ端末には広すぎるので詰める。⚠️実測後に見直すこと。
    --widget-bar-width: 300px;
}

// 折りたたみ端末では画面全幅ではなく、タイムライン列を基準にピルを中央へ置く。
.root[data-hata-foldable='true'] .topBar {
    position: absolute;
    top: var(--simple-announcements-height, 0px);
}

// 右ウィジェット列の先頭を、バナー下にある左のノート列と同じ高さへ揃える。
.root[data-hata-foldable='true'] .desktopWidgetsInner {
    padding-top: calc(56px + env(safe-area-inset-top, 0px) + var(--simple-announcements-height, 0px));
}

/* 再展開ボタンの列を本文・上部ナビと別に確保する。fixed で重ねない。 */
.root .desktopWidgets[data-collapsed='true'] { width: 64px; }
.desktopWidgets[data-collapsed='true'] .desktopWidgetsBanner { opacity: 0; }
.desktopWidgets[data-collapsed='true'] .desktopWidgetsInner {
    padding: calc(10px + env(safe-area-inset-top, 0px)) 8px 0;
    overflow: hidden;
}
.desktopWidgets[data-motion='false'],
.desktopWidgets[data-motion='false'] .desktopWidgetsInner,
.desktopWidgets[data-motion='false'] .desktopWidgetsBanner { transition: none; }
@media (prefers-reduced-motion: reduce) {
    .desktopWidgets, .desktopWidgetsInner, .desktopWidgetsBanner { transition: none; }
}

.bottomBarDark {}
.bottomBarLight {}
.topBarDark {}
.topBarLight {}

// ===== モバイルドロワーメニュー =====
.drawerBg {
    position:fixed;
    inset:0;
    z-index:900000;
    background:rgba(0,0,0,.5);
    backdrop-filter:blur(4px);
    -webkit-backdrop-filter:blur(4px);
}
.drawerNav {
    position:fixed;
    top:var(--MI-fixed-top-inset, 0px);
    left:0;
    bottom:0;
    z-index:900001;
    width:250px;
    max-width:72vw;
    background:var(--MI_THEME-navBg);
    overflow:hidden;
    box-shadow:4px 0 24px rgba(0,0,0,.25);
}
.drawerBanner {
    position:absolute;
    inset:0;
    z-index:0;
    overflow:hidden;
    &::after {
        content:'';
        position:absolute;
        inset:0;
        background:var(--MI_THEME-navBg);
        opacity:.75;
        backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);
    }
}
.drawerBannerImg {
    width:100%;
    height:100%;
    object-fit:cover;
    filter:blur(16px) saturate(1.2);
    transform:scale(1.1);
}

// ===== すりガラスOFF時の単色表示 =====
.sidebarSolid { background:var(--MI_THEME-navBg) !important; }
.desktopWidgetsSolid { background:var(--MI_THEME-bg) !important; }
.drawerNavSolid { background:var(--MI_THEME-navBg) !important; }
</style>

<!-- グローバルスタイル: ドロワートランジション + ウィジェット縁色 -->
<style lang="scss">
.simple-drawer-bg-enter-active, .simple-drawer-bg-leave-active { transition:opacity .3s ease; }
.simple-drawer-bg-enter-from, .simple-drawer-bg-leave-to { opacity:0; }
.simple-drawer-enter-active { transition:transform .3s cubic-bezier(.22,1,.36,1); }
.simple-drawer-leave-active { transition:transform .25s cubic-bezier(.55,.06,.68,.19); }
.simple-drawer-enter-from, .simple-drawer-leave-to { transform:translateX(-100%); }
</style>
