<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true" :notification="notification">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div :class="{['_spacer']: !notification }" style="--MI_SPACER-w: 800px;">
		<div v-if="tab === 'all'">
			<MkStreamingNotificationsTimeline :class="[$style.notifications, { [$style.noRadius]: notification }]" :excludeTypes="excludeTypes" :excludeBots="excludeBots"/>
		</div>
		<div v-else-if="tab === 'mentions'">
			<MkNotesTimeline :paginator="mentionsPaginator" :notification="notification"/>
		</div>
		<div v-else-if="tab === 'directNotes'">
			<MkNotesTimeline :paginator="directNotesPaginator" :notification="true"/>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, provide, ref } from 'vue';
import { notificationTypes } from 'cherrypick-js';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { hataNotificationView, setHataNotificationView } from '@/utility/hatasaba-device-prefs.js';
import { Paginator } from '@/utility/paginator.js';
import { deviceKind } from '@/utility/device-kind.js';
import { globalEvents } from '@/events.js';
import { navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import { $i } from '@/i.js';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';

// This page has no visible navbar pull indicator; its timelines own pull refresh.
provide(navbarPullRefreshKey, null);

const tab = ref('all');
// 旗鯖fork: 通知の種類フィルタとBot除外は端末ごとに保存する。初回だけ同期設定のBot除外を引き継ぐ。
if (miLocalStorage.getItem('hataNotificationView') == null) {
	setHataNotificationView({ excludeBots: prefer.r.notificationExcludeBots.value });
}
const includeTypes = computed(() => hataNotificationView.value.includeTypes);
const excludeBots = computed(() => hataNotificationView.value.excludeBots);
const excludeTypes = computed(() => includeTypes.value ? notificationTypes.filter(t => !includeTypes.value!.includes(t)) : null);
const showBots = computed({
	get: () => !excludeBots.value,
	set: value => setHataNotificationView({ excludeBots: !value }),
});

const props = defineProps<{
	disableRefreshButton?: boolean;
	notification?: boolean;
}>();

const mentionsPaginator = markRaw(new Paginator('notes/mentions', {
	limit: 10,
}));

const directNotesPaginator = markRaw(new Paginator('notes/mentions', {
	limit: 10,
	params: {
		visibility: 'specified',
	},
}));

function setFilter(ev) {
	const typeItems = notificationTypes.map(t => ({
		text: i18n.ts._notification._types[t],
		active: (includeTypes.value && includeTypes.value.includes(t)) ?? false,
		action: () => {
			setHataNotificationView({ includeTypes: [t] });
		},
	}));
	const filterItems = [{
		type: 'switch' as const,
		text: i18n.ts._hata._notificationFilter.botNotifications,
		ref: showBots,
	}, {
		type: 'divider' as const,
	}, ...typeItems];
	const items = includeTypes.value != null || excludeBots.value ? [{
		icon: 'ti ti-x',
		text: i18n.ts.clear,
		action: () => {
			setHataNotificationView({ includeTypes: null, excludeBots: false });
		},
	}, { type: 'divider' as const }, ...filterItems] : filterItems;
	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

const headerActions = computed(() => [deviceKind === 'desktop' && !props.disableRefreshButton ? {
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: (ev: Event) => {
		globalEvents.emit('reloadNotification');
	},
} : undefined, tab.value === 'all' ? {
	text: i18n.ts.filter,
	icon: 'ti ti-filter',
	highlighted: includeTypes.value != null || excludeBots.value,
	handler: setFilter,
} : undefined, tab.value === 'all' ? {
	text: i18n.ts.markAllAsRead,
	icon: 'ti ti-check',
	handler: async () => {
		const ownerId = $i?.id;
		try {
			await os.apiWithDialog('notifications/mark-all-as-read', {});
			await refreshNotificationUnreadState(ownerId);
		} catch {
			// apiWithDialog reports the failed read request.
		}
	},
} : undefined].filter(x => x !== undefined));

const headerTabs = computed(() => [{
	key: 'all',
	title: i18n.ts.all,
	icon: 'ti ti-point',
}, {
	key: 'mentions',
	title: i18n.ts.mentions,
	icon: 'ti ti-at',
}, {
	key: 'directNotes',
	title: i18n.ts.directNotes,
	icon: 'ti ti-mail',
}]);

definePage(() => !props.notification ? {
	title: i18n.ts.notifications,
	icon: 'ti ti-bell',
} : {
	title: '',
	icon: 'ti ti-bell',
});

</script>

<style lang="scss" module>
.notifications {
	border-radius: var(--MI-radius);
	overflow: clip;

	&.noRadius {
		border-radius: 0;
	}
}

/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
.htkPillTabs {
	position: sticky;
	top: 0;
	z-index: 50;
	display: flex;
	justify-content: center;
	padding: 12px 16px;
	background: var(--MI-page-controls-background, color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent));
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	margin-bottom: 8px;
}

.htkPillTabsInner {
	display: inline-flex;
	gap: 4px;
	padding: 4px;
	background: var(--MI-page-tabs-background, var(--MI_THEME-panel));
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	max-width: 100%;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
}

.htkPillTab {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	font-weight: 500;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}

	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}
</style>
