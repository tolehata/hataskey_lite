<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_menuDrawerBg_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_menuDrawerBg_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_menuDrawerBg_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_menuDrawerBg_leaveTo : ''"
>
	<div
		v-if="drawerMenuShowing"
		:class="$style.menuDrawerBg"
		class="_modalBg"
		@click="drawerMenuShowing = false"
		@touchstart.passive="drawerMenuShowing = false"
	></div>
</Transition>

<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_menuDrawer_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_menuDrawer_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_menuDrawer_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_menuDrawer_leaveTo : ''"
>
	<div v-if="drawerMenuShowing" :class="$style.menuDrawer">
		<!-- 旗鯖fork: Friendly UI 廃止のため XNavbarFriendly は削除、常に XNavbar を使用 -->
		<XNavbar style="height: 100%;" :asDrawer="true" :showWidgetButton="false"/>
	</div>
</Transition>

<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_widgetsDrawerBg_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_widgetsDrawerBg_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_widgetsDrawerBg_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_widgetsDrawerBg_leaveTo : ''"
>
	<div
		v-if="widgetsShowing"
		:class="$style.widgetsDrawerBg"
		class="_modalBg"
		@click="widgetsShowing = false"
		@touchstart.passive="widgetsShowing = false"
	></div>
</Transition>

<Transition
	:enterActiveClass="prefer.s.animation ? $style.transition_widgetsDrawer_enterActive : ''"
	:leaveActiveClass="prefer.s.animation ? $style.transition_widgetsDrawer_leaveActive : ''"
	:enterFromClass="prefer.s.animation ? $style.transition_widgetsDrawer_enterFrom : ''"
	:leaveToClass="prefer.s.animation ? $style.transition_widgetsDrawer_leaveTo : ''"
>
	<div v-if="widgetsShowing" :class="$style.widgetsDrawer" data-widget-border="on" data-note-charm-exclusion>
		<button class="_button" :class="$style.widgetsCloseButton" @click="widgetsShowing = false"><i class="ti ti-x"></i></button>
		<XWidgets/>
	</div>
</Transition>

<component
	:is="popup.component"
	v-for="popup in popups"
	:key="popup.id"
	v-bind="popup.props"
	v-on="popup.events"
/>

<MkHataskeyNotificationToasts v-if="hataskeyToasts" :context="hataskeyToasts"/>
<template v-else>
	<component
		:is="prefer.s.animation ? TransitionGroup : 'div'"
		v-if="!notificationToastsSuppressed"
		tag="div"
		:class="$style.notifications"
		:data-position="prefer.s.notificationPosition"
		:data-stack-axis="prefer.s.notificationStackAxis"
		:moveClass="$style.transition_notification_move"
		:enterActiveClass="$style.transition_notification_enterActive"
		:leaveActiveClass="$style.transition_notification_leaveActive"
		:enterFromClass="$style.transition_notification_enterFrom"
		:leaveToClass="$style.transition_notification_leaveTo"
	>
		<div v-for="notification in notifications" :key="notification.id" :class="$style.notification">
			<XNotification :notification="notification"/>
		</div>
	</component>
</template>

<XStreamIndicator/>

<div v-if="pendingApiRequestsCount > 0 && !props.loadingIntegrated" id="wait">
	<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
		<circle cx="25" cy="25" r="20" fill="none" stroke-width="6px" style="fill: none; stroke-width: 6px;"></circle>
	</svg>
</div>

<div v-if="dev" id="devTicker"><span style="animation: dev-ticker-blink 2s infinite;">DEV BUILD</span></div>

<div v-if="$i && $i.isBot" id="botWarn"><span style="animation: dev-ticker-blink 2s infinite;">{{ i18n.ts.loggedInAsBot }}</span></div>

<div v-if="isSafeMode" id="safemodeWarn">
	<span style="animation: dev-ticker-blink 2s infinite;">{{ i18n.ts.safeModeEnabled }}</span>&nbsp;
	<button class="_textButton" style="pointer-events: all;" @click="exitSafeMode">{{ i18n.ts.turnItOff }}</button>
</div>

<!-- 旗鯖fork: 外部通知トースト (右下スライドイン、UI被らず) -->
<XExternalNotificationToastContainer v-if="$i && !hataskeyToasts" />
<XConcrntNotificationToasts v-if="$i && !hataskeyToasts" />

<!-- 旗鯖fork: フローティングマスコット(段階C) -->
<MkMascotFloating v-if="$i" />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, inject, ref, TransitionGroup, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import { isSafeMode } from '@@/js/config.js';
import { swInject } from './sw-inject.js';
import XNotification from './notification.vue';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import { getNotificationPageContext, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';
import { popups } from '@/os.js';
import { unisonReload } from '@/utility/unison-reload.js';
import { miLocalStorage } from '@/local-storage.js';
import { misskeyApi, pendingApiRequestsCount } from '@/utility/misskey-api.js';
import * as sound from '@/utility/sound.js';
import { $i } from '@/i.js';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { globalEvents } from '@/events.js';
import { store } from '@/store.js';
import XNavbar from '@/ui/_common_/navbar.vue';
import { haptic } from '@/utility/haptic.js';
import { announceNotification, shouldSuppressStandardToast, loadMascot, loadDisplaySettings } from '@/utility/mascot-store.js';
import { notificationToastsSuppressed, shouldSuppressNotificationToasts } from '@/utility/notification-toast-suppression.js';

const XStreamIndicator = defineAsyncComponent(() => import('./stream-indicator.vue'));
const XWidgets = defineAsyncComponent(() => import('./widgets.vue'));
// 旗鯖fork: 外部通知トーストコンテナ (右下表示)
const XExternalNotificationToastContainer = defineAsyncComponent(() => import('@/components/MkExternalNotificationToastContainer.vue'));
const XConcrntNotificationToasts = defineAsyncComponent(() => import('@/components/concrnt/ConcrntNotificationToasts.vue'));
const MkMascotFloating = defineAsyncComponent(() => import('@/components/MkMascotFloating.vue'));

const props = withDefaults(defineProps<{ loadingIntegrated?: boolean }>(), { loadingIntegrated: false });

const drawerMenuShowing = defineModel<boolean>('drawerMenuShowing');
const widgetsShowing = defineModel<boolean>('widgetsShowing');

const dev = _DEV_;

const hataskeyToasts = inject(hataskeyNotificationToastsKey, null);
const notifications = ref<Misskey.entities.Notification[]>([]);

// Hataskey UI 3 のタイムライン表示に切り替えた時点で既に出ている通知も残さない。
// 解除後は新しく届いた通知だけが従来どおり表示される。
watch(notificationToastsSuppressed, (suppressed) => {
	if (suppressed) notifications.value = [];
});

function onNotification(notification: Misskey.entities.Notification) {
	// 旗鯖fork: マスコットに通知を伝える(設定ON時)
	announceNotification(notification);

	if (window.document.visibilityState === 'visible') {
		// 旗鯖fork: マスコットが通知を伝える設定のときは標準トーストを出さない
		if (!shouldSuppressStandardToast() && !shouldSuppressNotificationToasts()) {
			const toastContext = getNotificationPageContext() ?? hataskeyToasts;
			if (toastContext) {
				toastContext.enqueue(notification, 'local');
			} else {
				notifications.value.unshift(notification);
				window.setTimeout(() => {
					if (notifications.value.length > 3) notifications.value.pop();
				}, 500);

				window.setTimeout(() => {
					notifications.value = notifications.value.filter(x => x.id !== notification.id);
				}, 6000);
			}
		}
	}

	sound.playMisskeySfx('notification');
	haptic();
}

function dismissNotificationToasts(ids: readonly string[]): void {
	if (ids.length === 0) return;
	const dismissed = new Set(ids);
	notifications.value = notifications.value.filter(notification => !dismissed.has(notification.id));
	for (const context of [hataskeyToasts, getNotificationPageContext()]) {
		if (!context) continue;
		for (const item of context.items.value) {
			if (item.source === 'local' && dismissed.has(item.notification.id)) context.dismiss(item.id);
		}
	}
}

async function flushNotificationToasts(): Promise<void> {
	const ownerId = $i?.id;
	if (!ownerId) return;
	const ids = [...new Set([
		...notifications.value.map(notification => notification.id),
		...[hataskeyToasts, getNotificationPageContext()].flatMap(context => context?.items.value.flatMap(item => item.source === 'local' ? [item.notification.id] : []) ?? []),
	])];
	if (ids.length === 0) return;
	for (let offset = 0; offset < ids.length; offset += 100) {
		const batch = ids.slice(offset, offset + 100);
		try {
			const retained = await misskeyApi('notifications/show', { notificationIds: batch });
			if ($i?.id !== ownerId) return;
			const retainedIds = new Set(retained.map(notification => notification.id));
			dismissNotificationToasts(batch.filter(id => !retainedIds.has(id)));
		} catch { /* Keep this batch visible when reconciliation fails. */ }
	}
}

function exitSafeMode() {
	miLocalStorage.removeItem('isSafeMode');
	const url = new URL(window.location.href);
	url.searchParams.delete('safemode');
	unisonReload(url.toString());
}

if ($i) {
	// 旗鯖fork: マスコットが通知を伝えられるよう、データと表示設定を先読みする
	loadMascot();
	loadDisplaySettings();

	if (store.s.realtimeMode) {
		const connection = useStream().useChannel('main');
		connection.on('notification', onNotification);
		connection.on('readNotification', event => dismissNotificationToasts([event.id]));
		connection.on('notificationChanged', event => dismissNotificationToasts(event.ids));
		connection.on('readAllNotifications', event => dismissNotificationToasts(event.ids));
		connection.on('notificationFlushed', () => { void flushNotificationToasts(); });
	}
	globalEvents.on('clientNotification', onNotification);

	if ('serviceWorker' in navigator) {
		swInject();
	}
}
</script>

<style lang="scss" module>
.transition_menuDrawerBg_enterActive,
.transition_menuDrawerBg_leaveActive {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.transition_menuDrawerBg_enterFrom,
.transition_menuDrawerBg_leaveTo {
	opacity: 0;
}

.transition_menuDrawer_enterActive,
.transition_menuDrawer_leaveActive {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1), opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.transition_menuDrawer_enterFrom,
.transition_menuDrawer_leaveTo {
	opacity: 0;
	transform: translateX(-240px);
}

.transition_widgetsDrawerBg_enterActive,
.transition_widgetsDrawerBg_leaveActive {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.transition_widgetsDrawerBg_enterFrom,
.transition_widgetsDrawerBg_leaveTo {
	opacity: 0;
}

.transition_widgetsDrawer_enterActive,
.transition_widgetsDrawer_leaveActive {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1), opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.transition_widgetsDrawer_enterFrom,
.transition_widgetsDrawer_leaveTo {
	opacity: 0;
	transform: translateX(240px);
}

.transition_notification_move,
.transition_notification_enterActive,
.transition_notification_leaveActive {
	transition: opacity 0.3s, transform 0.3s !important;
}
.transition_notification_enterFrom {
	opacity: 0;
	transform: translateX(var(--notificationSlideOffset, 250px));
}
.transition_notification_leaveTo {
	opacity: 0;
	transform: translateX(calc(-1 * var(--notificationSlideOffset, 250px)));
}

.menuDrawerBg {
	z-index: 1001;
}

.menuDrawer {
	position: fixed;
	top: var(--MI-fixed-top-inset, 0px);
	left: 0;
	z-index: 1001;
	height: var(--MI-viewport-height, 100dvh);
}

.widgetsDrawerBg {
	z-index: 1001;
}

.widgetsDrawer {
	position: fixed;
	top: var(--MI-fixed-top-inset, 0px);
	right: 0;
	z-index: 1001;
	width: 310px;
	height: var(--MI-viewport-height, 100dvh);
	padding: var(--MI-margin) var(--MI-margin) calc(var(--MI-margin) + env(safe-area-inset-bottom, 0px)) !important;
	box-sizing: border-box;
	overflow: auto;
	overscroll-behavior: contain;
	background: var(--MI_THEME-bg);
}

.widgetsCloseButton {
	padding: 8px;
	display: block;
	margin: 0 auto;
}

@media (min-width: 370px) {
	.widgetsCloseButton {
		display: none;
	}
}

.notifications {
	position: fixed;
	z-index: 3900000;
	padding: 0 var(--MI-margin);
	pointer-events: none;
	display: flex;

	&[data-position='rightTop'],
	&[data-position='rightBottom'] {
		--notificationSlideOffset: 250px;
	}

	&[data-position='leftTop'],
	&[data-position='leftBottom'] {
		--notificationSlideOffset: -250px;
	}

	&[data-position='leftTop'] {
		top: calc(var(--MI-margin) + var(--MI-fixed-top-inset, 0px));
		left: 0;
	}

	&[data-position='rightTop'] {
		top: calc(var(--MI-margin) + var(--MI-fixed-top-inset, 0px));
		right: 0;
	}

	&[data-position='leftBottom'] {
		bottom: calc(var(--MI-minBottomSpacing) + var(--MI-margin));
		left: 0;
	}

	&[data-position='rightBottom'] {
		bottom: calc(var(--MI-minBottomSpacing) + var(--MI-margin));
		right: 0;
	}

	&[data-stack-axis='vertical'] {
		width: 250px;

		&[data-position='leftTop'],
		&[data-position='rightTop'] {
			flex-direction: column;

			.notification {
				& + .notification {
					margin-top: 8px;
				}
			}
		}

		&[data-position='leftBottom'],
		&[data-position='rightBottom'] {
			flex-direction: column-reverse;

			.notification {
				& + .notification {
					margin-bottom: 8px;
				}
			}
		}
	}

	&[data-stack-axis='horizontal'] {
		width: 100%;

		&[data-position='leftTop'],
		&[data-position='leftBottom'] {
			flex-direction: row;

			.notification {
				& + .notification {
					margin-left: 8px;
				}
			}
		}

		&[data-position='rightTop'],
		&[data-position='rightBottom'] {
			flex-direction: row-reverse;

			.notification {
				& + .notification {
					margin-right: 8px;
				}
			}
		}

		.notification {
			width: 250px;
			flex-shrink: 0;
		}
	}
}

.notification {
	container-type: inline-size;
}
</style>

<style lang="scss">
@keyframes dev-ticker-blink {
	0% { opacity: 1; }
	50% { opacity: 0; }
	100% { opacity: 1; }
}

@keyframes progress-spinner {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

#wait {
	display: block;
	position: fixed;
	z-index: 4000000;
	top: calc(15px + var(--MI-fixed-top-inset, 0px));
	right: 15px;
	pointer-events: none;

  > svg {
    display: block;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    animation: progress-spinner 2s linear infinite;
  }

  > svg > circle {
    stroke: var(--MI_THEME-accent);
    stroke-linecap: round;
    animation: dash 1.2s ease-in-out infinite;
  }
}

#botWarn {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	margin: auto;
	width: 100%;
	height: max-content;
	text-align: center;
	z-index: 2147483646;
	color: #ff0;
	background: rgba(0, 0, 0, 0.5);
	padding: 4px 7px;
	font-size: 14px;
	pointer-events: none;
	user-select: none;
}

#safemodeWarn {
	@extend #botWarn;
	z-index: 2147483647;
}

#devTicker {
	position: fixed;
	bottom: 0;
	left: 0;
	z-index: 2147483647;
	color: #ff0;
	background: rgba(0, 0, 0, 0.5);
	padding: 4px 5px;
	font-size: 14px;
	pointer-events: none;
	user-select: none;
}

/* 旗鯖独自: ウィジェット枠線 */
[data-widget-border="on"] ._panel {
	border: none !important;
	border-radius: 14px !important;
	transition: box-shadow .3s ease;
	margin-bottom: 10px;
}
/* 公開範囲の色枠が有効な投稿フォームでは、フォーム自身の影を優先する。 */
[data-widget-border="on"] ._panel:not([data-post-form-visibility-border="on"]) {
	box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--MI_THEME-accent) 45%, transparent), 0 0 16px color-mix(in srgb, var(--MI_THEME-accent) 20%, transparent), 0 2px 8px rgba(0,0,0,.06) !important;
}
[data-widget-border="on"] ._panel:not([data-post-form-visibility-border="on"]):hover {
	box-shadow: 0 0 0 2.5px var(--MI_THEME-accent), 0 0 24px color-mix(in srgb, var(--MI_THEME-accent) 30%, transparent), 0 4px 16px rgba(0,0,0,.08) !important;
}
/* 旗鯖fork: OFF時は淡い灰色枠で表示（ON時の見た目と統一感を保ちつつ色だけ無彩色に） */
[data-widget-border="off"] ._panel {
	border: none !important;
	border-radius: 14px !important;
	transition: box-shadow .3s ease;
	margin-bottom: 10px;
}
[data-widget-border="off"] ._panel:not([data-post-form-visibility-border="on"]) {
	box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent), 0 2px 8px rgba(0,0,0,.05) !important;
}
[data-widget-border="off"] ._panel:not([data-post-form-visibility-border="on"]):hover {
	box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--MI_THEME-fg) 28%, transparent), 0 4px 12px rgba(0,0,0,.06) !important;
}
</style>
