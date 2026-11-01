<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true" :notification="notification">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" :aria-label="t.title" :aria-current="tab === t.key ? 'page' : undefined" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span v-if="tab === t.key">{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div :class="{['_spacer']: !notification }" style="--MI_SPACER-w: 800px;">
		<MkStreamingNotificationsTimeline
			v-if="isNotificationTab"
			:key="notificationBrand"
			:class="[$style.notifications, { [$style.noRadius]: notification }]"
			:brand="notificationBrand"
			:includeBrands="includeBrands"
			:includeHataskApp="includeHataskApp"
			:excludeTypes="excludeTypes"
			:includeHatadySubtypes="includeHatadySubtypes"
			:excludeBots="excludeBots"
			:active="true"
		/>
		<MkNotesTimeline v-else-if="tab === 'mentions'" key="mentions" :paginator="mentionsPaginator" :notification="notification"/>
		<MkNotesTimeline v-else-if="tab === 'directNotes'" key="directNotes" :paginator="directNotesPaginator" :notification="true"/>
		<!-- 旗鯖fork: コンカレントの通知を外部の通知として同じページに並べる -->
		<ConcrntNotificationList v-else-if="tab === 'concrnt'" ref="concrntList" key="concrnt"/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, markRaw, onMounted, provide, ref, useTemplateRef, watch } from 'vue';
import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { deviceKind } from '@/utility/device-kind.js';
import { globalEvents } from '@/events.js';
import { hataNotificationView, setHataNotificationView } from '@/utility/hatasaba-device-prefs.js';
import { NOTIFICATION_FILTER_CATEGORIES, HATASK_NOTIFICATION_TYPES, STANDARD_NOTIFICATION_TYPES } from '@/utility/notification-filter.js';
import type { HataNotificationBrand, HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { Paginator } from '@/utility/paginator.js';
import { navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import { $i } from '@/i.js';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';
import { concrntState } from '@/utility/concrnt/runtime.js';

const ConcrntNotificationList = defineAsyncComponent(() => import('@/components/concrnt/ConcrntNotificationList.vue'));

// This page has no visible navbar pull indicator; its timelines own pull refresh.
provide(navbarPullRefreshKey, null);

onMounted(() => {
	if (miLocalStorage.getItem('hataNotificationView') == null) {
		setHataNotificationView({ excludeBots: prefer.r.notificationExcludeBots.value });
	}
});

type NoteTab = 'mentions' | 'directNotes' | 'concrnt';
const noteTab = ref<NoteTab | null>(null);
const concrntList = useTemplateRef<{ reload: () => Promise<void>; markAllRead: () => Promise<void> }>('concrntList');
const showConcrnt = computed(() => concrntState.connection != null && concrntState.settings.enabled);
const notificationBrand = computed(() => hataNotificationView.value.brand);
const tab = computed<HataNotificationBrand | NoteTab>({
	get: () => noteTab.value ?? notificationBrand.value,
	set: value => {
		if (value === 'mentions' || value === 'directNotes' || value === 'concrnt') {
			noteTab.value = value;
		} else {
			noteTab.value = null;
			setHataNotificationView({ brand: value });
		}
	},
});
const isNotificationTab = computed(() => noteTab.value === null);
const mentionsPaginator = markRaw(new Paginator('notes/mentions', { limit: 10 }));
const directNotesPaginator = markRaw(new Paginator('notes/mentions', { limit: 10, params: { visibility: 'specified' } }));
const includeTypes = computed(() => hataNotificationView.value.includeTypes);
const excludeTypes = computed(() => includeTypes.value == null ? null : notificationTypes.filter(t => t !== 'hatady' && !includeTypes.value!.includes(t)));
const includeBrands = computed(() => hataNotificationView.value.includeBrands);
const includeHataskApp = computed(() => hataNotificationView.value.includeHataskApp);
const includeHatadySubtypes = computed(() => hataNotificationView.value.includeHatadySubtypes == null ? null : hatadyNotificationSubtypes.filter(t => hataNotificationView.value.includeHatadySubtypes!.includes(t)));
const excludeBots = computed(() => hataNotificationView.value.excludeBots);
const showBots = computed({
	get: () => !excludeBots.value,
	set: value => setHataNotificationView({ excludeBots: !value }),
});

const props = defineProps<{
	disableRefreshButton?: boolean;
	notification?: boolean;
	initialTab?: string;
}>();

// 旗鯖fork: /my/notifications?tab=concrnt から開いたときはコンカレントのタブを選ぶ。
watch(() => [props.initialTab, showConcrnt.value] as const, ([initial, available]) => {
	if (initial === 'concrnt' && available) noteTab.value = 'concrnt';
}, { immediate: true });
watch(showConcrnt, available => { if (!available && noteTab.value === 'concrnt') noteTab.value = null; });

function typeSwitch(type: string, choices: readonly string[], key: 'includeTypes' | 'includeHatadySubtypes') {
	return computed({
		get: () => hataNotificationView.value[key]?.includes(type) ?? true,
		set: enabled => {
			const selected = new Set(hataNotificationView.value[key] ?? choices);
			if (enabled) selected.add(type);
			else selected.delete(type);
			if (key === 'includeTypes') setHataNotificationView({ includeTypes: [...selected] });
			else setHataNotificationView({ includeHatadySubtypes: [...selected] });
		},
	});
}

function categorySwitch(category: HataNotificationCategory) {
	return computed({
		get: () => includeBrands.value?.includes(category) ?? true,
		set: enabled => {
			const selected = new Set(includeBrands.value ?? NOTIFICATION_FILTER_CATEGORIES);
			if (enabled) selected.add(category);
			else selected.delete(category);
			setHataNotificationView({ includeBrands: NOTIFICATION_FILTER_CATEGORIES.filter(value => selected.has(value)) });
		},
	});
}

const categoryIcons: Record<HataNotificationCategory, string> = { standard: 'ti ti-message', hatady: 'ti ti-book-2', hatask: 'ti ti-flower', hataFeed: 'ti ti-message-report' };
const hataskAppSwitch = computed({
	get: () => includeHataskApp.value,
	set: enabled => setHataNotificationView({ includeHataskApp: enabled }),
});

function setFilter(ev: Event) {
	const notificationTypeSwitch = (type: typeof notificationTypes[number]) => ({
		type: 'switch' as const,
		text: i18n.ts._notification._types[type],
		ref: typeSwitch(type, notificationTypes, 'includeTypes'),
	});
	const filterItems = [{
		type: 'switch' as const,
		text: i18n.ts._hata._notificationFilter.botNotifications,
		ref: showBots,
	}, ...NOTIFICATION_FILTER_CATEGORIES.flatMap(category => [{ type: 'divider' as const }, {
		type: 'switch' as const,
		icon: categoryIcons[category],
		text: i18n.ts._hata._notificationBrands[category],
		ref: categorySwitch(category),
	}, ...category === 'standard'
		? STANDARD_NOTIFICATION_TYPES.map(notificationTypeSwitch)
		: category === 'hatady'
			? hatadyNotificationSubtypes.map(subtype => ({
				type: 'switch' as const,
				text: i18n.ts._hata._hatady._notification[subtype],
				ref: typeSwitch(subtype, hatadyNotificationSubtypes, 'includeHatadySubtypes'),
			}))
			: category === 'hatask'
				? [...HATASK_NOTIFICATION_TYPES.map(notificationTypeSwitch), { type: 'switch' as const, text: i18n.ts._hata._notificationFilter.otherHatask, ref: hataskAppSwitch }]
				: [notificationTypeSwitch('hataFeed')]])];
	const resetItems = [{
		icon: 'ti ti-x',
		text: i18n.ts._hata._notificationFilter.selectAll,
		action: () => {
			setHataNotificationView({ includeBrands: null, includeTypes: null, includeHatadySubtypes: null, includeHataskApp: true, excludeBots: false });
		},
	}, {
		icon: 'ti ti-square',
		text: i18n.ts._hata._notificationFilter.clearSelection,
		action: () => setHataNotificationView({ includeBrands: [], includeTypes: [], includeHatadySubtypes: [], includeHataskApp: false }),
	}, { type: 'divider' as const }];
	const items = [...resetItems, ...filterItems];
	const appearance = miLocalStorage.getItem('ui') === 'hataskey3' ? { appearance: 'uiS-composer' as const, motionPreset: 'postform' as const } : undefined;
	os.popupMenu(items, (ev.currentTarget ?? ev.target) as HTMLElement, appearance);
}

const headerActions = computed(() => noteTab.value === 'concrnt' ? [{
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: () => { void concrntList.value?.reload(); },
}, {
	text: i18n.ts.markAllAsRead,
	icon: 'ti ti-check',
	handler: () => { void concrntList.value?.markAllRead(); },
}] : [deviceKind === 'desktop' && !props.disableRefreshButton ? {
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: (ev: Event) => {
		globalEvents.emit('reloadNotification');
	},
} : undefined, isNotificationTab.value ? {
	text: i18n.ts.filter,
	icon: 'ti ti-filter',
	highlighted: includeBrands.value != null || includeTypes.value != null || includeHatadySubtypes.value != null || !includeHataskApp.value || excludeBots.value,
	handler: setFilter,
} : undefined, isNotificationTab.value ? {
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

const headerTabs = computed(() => ([
	{ key: 'all', icon: 'ti ti-bell' },
	{ key: 'mentions', icon: 'ti ti-at' },
	{ key: 'directNotes', icon: 'ti ti-mail' },
	{ key: 'standard', icon: 'ti ti-message' },
	{ key: 'hatady', icon: 'ti ti-book-2' },
	{ key: 'hatask', icon: 'ti ti-flower' },
	{ key: 'hataFeed', icon: 'ti ti-message-report' },
] as const).map((item): { key: HataNotificationBrand | NoteTab; icon: string; title: string } => ({ ...item, title: item.key === 'mentions' ? i18n.ts.mentions : item.key === 'directNotes' ? i18n.ts.directNotes : i18n.ts._hata._notificationBrands[item.key] }))
	.concat(showConcrnt.value ? [{ key: 'concrnt', icon: 'concrnt-icon', title: 'コンカレント（外部）' }] : []));

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
	min-width: 38px;
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
