<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component :is="prefer.s.enablePullToRefresh ? MkPullToRefresh : 'div'" :refresher="() => reload()">
	<MkLoading v-if="paginator.fetching.value"/>

	<MkError v-else-if="paginator.error.value" @retry="paginator.init()"/>

	<div v-else-if="displayNotifications.length === 0" key="_empty_">
		<slot name="empty"><MkResult type="empty" :text="i18n.ts.noNotifications"/></slot>
	</div>

	<div v-else ref="rootEl">
		<component
			:is="prefer.s.animation ? TransitionGroup : 'div'" :class="[$style.notifications]"
			:enterActiveClass="$style.transition_x_enterActive"
			:leaveActiveClass="$style.transition_x_leaveActive"
			:enterFromClass="$style.transition_x_enterFrom"
			:leaveToClass="$style.transition_x_leaveTo"
			:moveClass="$style.transition_x_move"
			tag="div"
		>
			<div v-for="(notification, i) in displayNotifications" :key="notification.id" :data-scroll-anchor="notification.id" :data-notification-ids="notification.type === 'hataFeed:grouped' ? undefined : JSON.stringify(notificationReadIds(notification))" :class="$style.item">
				<div v-if="i > 0 && isSeparatorNeeded(displayNotifications[i - 1].createdAt, notification.createdAt)" :class="$style.date" data-notification-date-separator>
					<span><i class="ti ti-chevron-up"></i> {{ getSeparatorInfo(displayNotifications[i - 1].createdAt, notification.createdAt)?.prevText }}</span>
					<span style="height: 1em; width: 1px; background: var(--MI_THEME-divider);"></span>
					<span>{{ getSeparatorInfo(displayNotifications[i - 1].createdAt, notification.createdAt)?.nextText }} <i class="ti ti-chevron-down"></i></span>
				</div>
				<MkHataFeedNotificationGroup v-if="notification.type === 'hataFeed:grouped'" :class="$style.content" :group="notification" :withTime="true" @expanded="refreshObservedRows"/>
				<MkNote v-else-if="['reply', 'quote', 'mention'].includes(notification.type) && 'note' in notification" :class="$style.content" :note="notification.note" :withHardMute="true" :notification="true"/>
				<XNotification v-else :class="$style.content" :notification="notification" :withTime="true" :full="true"/>
			</div>
		</component>
		<button v-show="paginator.canFetchOlder.value" key="_more_" v-appear="prefer.s.enableInfiniteScroll ? paginator.fetchOlder : null" :disabled="paginator.fetchingOlder.value" class="_button" :class="$style.more" @click="paginator.fetchOlder">
			<div v-if="!paginator.fetchingOlder.value">{{ i18n.ts.loadMore }}</div>
			<MkLoading v-else/>
		</button>
	</div>
</component>
</template>

<script lang="ts" setup>
import { onUnmounted, onMounted, computed, nextTick, ref, useTemplateRef, TransitionGroup, markRaw, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import { useInterval } from '@@/js/use-interval.js';
import { useDocumentVisibility } from '@@/js/use-document-visibility.js';
import { getScrollContainer, scrollToTop } from '@@/js/scroll.js';
import XNotification from '@/components/MkNotification.vue';
import MkHataFeedNotificationGroup from '@/components/MkHataFeedNotificationGroup.vue';
import MkNote from '@/components/MkNote.vue';
import { useStream } from '@/stream.js';
import { i18n } from '@/i18n.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { isSeparatorNeeded, getSeparatorInfo } from '@/utility/timeline-date-separate.js';
import { Paginator } from '@/utility/paginator.js';
import { globalEvents } from '@/events.js';
import { groupHataFeedBellNotifications } from '@/utility/hatafeed-bell-group.js';
import type { BellNotificationForDisplay } from '@/utility/hatafeed-bell-group.js';
import { $i } from '@/i.js';
import { miLocalStorage } from '@/local-storage.js';
import { NOTIFICATION_FILTER_POLICY_NOTICE, NOTIFICATION_FILTER_POLICY_NOTICE_ID } from '@/utility/notification-filter.js';
import { matchesNotificationView } from '@/utility/notification-brand.js';
import type { HataNotificationBrand, HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';

const props = defineProps<{
	excludeTypes?: typeof notificationTypes[number][] | null;
	excludeBots?: boolean;
	brand?: HataNotificationBrand;
	includeBrands?: HataNotificationCategory[] | null;
	includeHataskApp?: boolean;
	includeHatadySubtypes?: (typeof hatadyNotificationSubtypes[number])[] | null;
	excludeHatadySubtypes?: (typeof hatadyNotificationSubtypes[number])[] | null;
	active?: boolean;
	notUseGrouped?: boolean;
	showFilterPolicyNotice?: boolean;
}>();

const rootEl = useTemplateRef('rootEl');
const shouldGroupHataFeed = computed(() => prefer.s.useGroupedNotifications && !props.notUseGrouped);

const paginator = shouldGroupHataFeed.value ? markRaw(new Paginator('i/notifications-grouped', {
	limit: 20,
	computedParams: computed(() => ({
		markAsRead: false,
		brand: props.brand ?? 'all',
		includeBrands: props.includeBrands ?? undefined,
		includeHataskApp: props.includeHataskApp,
		excludeTypes: props.excludeTypes ?? undefined,
		excludeBots: props.excludeBots || undefined,
		includeHatadySubtypes: props.includeHatadySubtypes ?? undefined,
		excludeHatadySubtypes: props.excludeHatadySubtypes ?? undefined,
	})),
})) : markRaw(new Paginator('i/notifications', {
	limit: 20,
	computedParams: computed(() => ({
		markAsRead: false,
		brand: props.brand ?? 'all',
		includeBrands: props.includeBrands ?? undefined,
		includeHataskApp: props.includeHataskApp,
		excludeTypes: props.excludeTypes ?? undefined,
		excludeBots: props.excludeBots || undefined,
		includeHatadySubtypes: props.includeHatadySubtypes ?? undefined,
		excludeHatadySubtypes: props.excludeHatadySubtypes ?? undefined,
	})),
}));

const filterPolicyNotice = ref<Misskey.entities.Notification | null>(null);
const invalidatedIds = ref(new Set<string>());

function invalidated(notification: Misskey.entities.Notification): boolean {
	if (invalidatedIds.value.has(notification.id)) return true;
	return 'notificationIds' in notification && Array.isArray(notification.notificationIds) && notification.notificationIds.some(id => invalidatedIds.value.has(id));
}

const displayNotifications = computed(() => {
	const sourceNotifications = (paginator.items.value as Misskey.entities.Notification[])
		.filter(notification => !invalidated(notification) && matchesNotificationView(notification, props));
	const notifications = shouldGroupHataFeed.value
		? groupHataFeedBellNotifications(sourceNotifications)
		: sourceNotifications;
	return filterPolicyNotice.value == null ? notifications : [filterPolicyNotice.value, ...notifications];
});

function notificationReadIds(notification: BellNotificationForDisplay): string[] {
	if (notification.type === 'hataFeed:grouped' || notification.id === NOTIFICATION_FILTER_POLICY_NOTICE_ID) return [];
	const ids = 'notificationIds' in notification && Array.isArray(notification.notificationIds) && notification.notificationIds.length > 0
		? notification.notificationIds : [notification.id];
	return [...new Set(ids)];
}

const readIds = new Set<string>();
const restoredIds = new Set<string>();
type RemovedPosition = { queue: boolean; index: number; beforeId?: string; afterId?: string };
const removedPositions = new Map<string, RemovedPosition>();
const changeGenerations = new Map<string, number>();
const pendingListReconcileIds = new Set<string>();
let listGeneration = 0;
const pendingReadIds = new Set<string>();
const inflightReadIds = new Set<string>();
const visibleRows = new Set<Element>();
let readTimer: number | undefined;
let rowObserver: IntersectionObserver | null = null;

function rowIds(element: Element): string[] {
	const encoded = (element as HTMLElement).dataset.notificationIds;
	if (encoded == null) return [];
	try {
		const ids: unknown = JSON.parse(encoded);
		return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
	} catch { return []; }
}

function allowedReadIds(): Set<string> {
	const allowed = new Set<string>();
	for (const notification of displayNotifications.value) {
		if (notification.type === 'hataFeed:grouped') {
			for (const item of notification.items) allowed.add(item.id);
		} else for (const id of notificationReadIds(notification)) allowed.add(id);
	}
	return allowed;
}

function currentlyVisibleReadIds(): Set<string> {
	const ids = new Set<string>();
	if (!canReadVisibleRows()) return ids;
	const allowed = allowedReadIds();
	for (const element of visibleRows) {
		if (!element.isConnected || !rootEl.value!.contains(element)) continue;
		for (const id of rowIds(element)) if (allowed.has(id) && !restoredIds.has(id)) ids.add(id);
	}
	return ids;
}

function canReadVisibleRows(): boolean {
	return props.active !== false && window.document.visibilityState === 'visible' && rootEl.value?.isConnected === true;
}

async function flushVisibleReads() {
	if (!canReadVisibleRows()) return;
	const visible = currentlyVisibleReadIds();
	const ids = [...pendingReadIds].filter(id => visible.has(id));
	pendingReadIds.clear();
	for (let index = 0; index < ids.length; index += 100) {
		if (!canReadVisibleRows()) return;
		const stillVisible = currentlyVisibleReadIds();
		const batch = ids.slice(index, index + 100).filter(id => stillVisible.has(id) && !readIds.has(id) && !inflightReadIds.has(id));
		if (batch.length === 0) continue;
		for (const id of batch) inflightReadIds.add(id);
		const ownerId = $i?.id;
		try {
			await misskeyApi('notifications/mark-as-read', { notificationIds: batch });
			for (const id of batch) readIds.add(id);
			await refreshNotificationUnreadState(ownerId);
		} catch {
			// A later intersection can retry. Failed requests never mark IDs locally.
		} finally {
			for (const id of batch) inflightReadIds.delete(id);
		}
	}
}

function queueVisibleRead(element: Element) {
	if (!canReadVisibleRows()) return;
	visibleRows.add(element);
	const allowed = allowedReadIds();
	for (const id of rowIds(element)) {
		if (allowed.has(id) && !readIds.has(id) && !inflightReadIds.has(id) && !restoredIds.has(id)) pendingReadIds.add(id);
	}
	if (pendingReadIds.size === 0) return;
	window.clearTimeout(readTimer);
	readTimer = window.setTimeout(() => { void flushVisibleReads(); }, 80);
}

function refreshObservedRows() {
	void nextTick(() => {
		rowObserver?.disconnect();
		visibleRows.clear();
		pendingReadIds.clear();
		window.clearTimeout(readTimer);
		if (!canReadVisibleRows() || rowObserver == null) return;
		for (const element of rootEl.value!.querySelectorAll('[data-notification-ids]')) rowObserver.observe(element);
	});
}

const MIN_POLLING_INTERVAL = 1000 * 10;
const POLLING_INTERVAL =
	prefer.s.pollingInterval === 1 ? MIN_POLLING_INTERVAL * 1.5 * 1.5 :
	prefer.s.pollingInterval === 2 ? MIN_POLLING_INTERVAL * 1.5 :
	prefer.s.pollingInterval === 3 ? MIN_POLLING_INTERVAL :
	MIN_POLLING_INTERVAL;

if (!store.s.realtimeMode) {
	useInterval(async () => {
		paginator.fetchNewer({
			toQueue: false,
		});
	}, POLLING_INTERVAL, {
		immediate: false,
		afterMounted: true,
	});
}

function isTop() {
	if (scrollContainer == null) return true;
	if (rootEl.value == null) return true;
	const scrollTop = scrollContainer.scrollTop;
	const tlTop = rootEl.value.offsetTop - scrollContainer.offsetTop;
	return scrollTop <= tlTop;
}

function releaseQueue() {
	paginator.releaseQueue();
	if (rootEl.value != null) scrollToTop(rootEl.value);
}

let scrollContainer: HTMLElement | null = null;

function onScrollContainerScroll() {
	if (isTop()) {
		paginator.releaseQueue();
	}
}

watch(rootEl, (el) => {
	if (el && scrollContainer == null) {
		scrollContainer = getScrollContainer(el);
		if (scrollContainer == null) return;
		scrollContainer.addEventListener('scroll', onScrollContainerScroll, { passive: true }); // ほんとはscrollendにしたいけどiosが非対応
	}
}, { immediate: true });

const visibility = useDocumentVisibility();
let isPausingUpdate = false;

watch(visibility, () => {
	if (visibility.value === 'hidden') {
		isPausingUpdate = true;
		rowObserver?.disconnect();
		visibleRows.clear();
		pendingReadIds.clear();
		window.clearTimeout(readTimer);
	} else { // 'visible'
		isPausingUpdate = false;
		if (isTop()) {
			releaseQueue();
		}
		refreshObservedRows();
	}
});

function onNotification(notification: Misskey.entities.Notification) {
	if (matchesNotificationView(notification, props)) {
		if (isTop() && !isPausingUpdate) {
			paginator.prepend(notification);
		} else {
			paginator.enqueue(notification);
		}
	}
}

function onReadNotification(event: { id: string }) {
	readIds.add(event.id);
	pendingReadIds.delete(event.id);
}

function onReadAllNotifications(event: { ids: string[] }) {
	for (const id of event.ids) onReadNotification({ id });
}

function withinLoadedBoundary(notification: Misskey.entities.Notification): boolean {
	const loaded = paginator.items.value as Misskey.entities.Notification[];
	if (loaded.length === 0) return false;
	const times = loaded.map(item => Date.parse(item.createdAt));
	const stamp = Date.parse(notification.createdAt);
	return stamp <= Math.max(...times) && stamp >= Math.min(...times);
}

function rememberRemoval(id: string) {
	const loaded = paginator.items.value as Misskey.entities.Notification[];
	const queued = paginator.queuedAheadItems.value;
	const queueIndex = queued.findIndex(item => item.id === id);
	const queue = queueIndex >= 0;
	const items = queue ? queued : loaded;
	const index = queue ? queueIndex : loaded.findIndex(item => item.id === id);
	if (index < 0) return;
	removedPositions.delete(id);
	removedPositions.set(id, { queue, index, beforeId: items[index - 1]?.id, afterId: items[index + 1]?.id });
	if (removedPositions.size > 256) removedPositions.delete(removedPositions.keys().next().value!);
}

function restorePosition(notification: Misskey.entities.Notification, position: RemovedPosition) {
	const items = position.queue ? paginator.queuedAheadItems.value : paginator.items.value;
	const before = items.findIndex(item => item.id === position.beforeId);
	const after = items.findIndex(item => item.id === position.afterId);
	const index = before >= 0 ? before + 1 : after >= 0 ? after : position.index;
	paginator.insertItemAt(notification as never, index, position.queue);
}

async function onNotificationChanged(event: { ids: string[] }) {
	const ids = [...new Set(event.ids)];
	invalidatedIds.value = new Set([...invalidatedIds.value, ...ids]);
	const generation = listGeneration;
	const versions = new Map(ids.map(id => {
		const next = (changeGenerations.get(id) ?? 0) + 1;
		changeGenerations.set(id, next);
		return [id, next];
	}));
	if (paginator.fetching.value || paginator.fetchingOlder.value || paginator.fetchingNewer.value) {
		for (const id of ids) pendingListReconcileIds.add(id);
	}
	for (let index = 0; index < ids.length; index += 100) {
		const batch = ids.slice(index, index + 100);
		let fetched: Misskey.entities.Notification[];
		try { fetched = await misskeyApi('notifications/show', { notificationIds: batch }); } catch {
			window.setTimeout(() => { if (!disposed) void onNotificationChanged({ ids: batch }); }, 1000);
			continue;
		}
		const byId = new Map(fetched.map(item => [item.id, item]));
		for (const id of batch) {
			if (generation !== listGeneration || versions.get(id) !== changeGenerations.get(id)) continue;
			const current = byId.get(id);
			const wasLoaded = (paginator.items.value as Misskey.entities.Notification[]).some(item => item.id === id)
				|| paginator.queuedAheadItems.value.some(item => item.id === id);
			if (current == null || !matchesNotificationView(current, props)) {
				rememberRemoval(id);
				paginator.removeItem(id);
				if (!pendingListReconcileIds.has(id)) {
					const next = new Set(invalidatedIds.value); next.delete(id); invalidatedIds.value = next;
				}
				continue;
			}
			if (wasLoaded) {
				paginator.updateItem(id, () => current as never);
				if (!pendingListReconcileIds.has(id)) {
					const next = new Set(invalidatedIds.value); next.delete(id); invalidatedIds.value = next;
				}
				continue;
			}
			const removed = removedPositions.get(id);
			if (removed != null) {
				restoredIds.add(id);
				restorePosition(current, removed);
				removedPositions.delete(id);
				if (!pendingListReconcileIds.has(id)) {
					const next = new Set(invalidatedIds.value); next.delete(id); invalidatedIds.value = next;
				}
				continue;
			}
			if (!withinLoadedBoundary(current)) {
				if (!pendingListReconcileIds.has(id)) { const next = new Set(invalidatedIds.value); next.delete(id); invalidatedIds.value = next; }
				continue;
			}
			restoredIds.add(id);
			const loaded = paginator.items.value as Misskey.entities.Notification[];
			const index = loaded.findIndex(item => Date.parse(item.createdAt) < Date.parse(current.createdAt));
			paginator.insertItemAt(current as never, index < 0 ? loaded.length : index);
			if (!pendingListReconcileIds.has(id)) { const next = new Set(invalidatedIds.value); next.delete(id); invalidatedIds.value = next; }
		}
	}
}

function reload() {
	listGeneration++;
	removedPositions.clear();
	pendingListReconcileIds.clear();
	invalidatedIds.value = new Set();
	return paginator.reload();
}

function reconcileAfterListFetch() {
	if (paginator.fetching.value || paginator.fetchingOlder.value || paginator.fetchingNewer.value || pendingListReconcileIds.size === 0) return;
	const ids = [...pendingListReconcileIds];
	pendingListReconcileIds.clear();
	void onNotificationChanged({ ids });
}

let connection: Misskey.IChannelConnection<Misskey.Channels['main']> | null = null;
let stream: ReturnType<typeof useStream> | null = null;
let disposed = false;

function onReconnected() {
	// The connection may have missed edits or deletions while offline. A fresh
	// authorized page also replaces queued rows without turning them into reads.
	void reload();
}

onMounted(() => {
	if (props.showFilterPolicyNotice && $i != null) {
		const noticeKey = `hataNotificationFilterPolicyNoticeShown:${$i.id}` as const;
		if (miLocalStorage.getItem(noticeKey) == null) {
			filterPolicyNotice.value = {
				id: NOTIFICATION_FILTER_POLICY_NOTICE.id,
				createdAt: new Date().toISOString(),
				type: 'app',
				header: NOTIFICATION_FILTER_POLICY_NOTICE.header,
				body: NOTIFICATION_FILTER_POLICY_NOTICE.body,
				icon: null,
				link: null,
			} as Misskey.entities.Notification;
			miLocalStorage.setItem(noticeKey, '1');
		}
	}

	paginator.init();
	if (typeof IntersectionObserver !== 'undefined') {
		rowObserver = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) queueVisibleRead(entry.target);
				else {
					visibleRows.delete(entry.target);
					for (const id of rowIds(entry.target)) pendingReadIds.delete(id);
				}
			}
		}, { threshold: 0.01 });
	}
	watch(displayNotifications, refreshObservedRows, { flush: 'post' });
	watch(() => props.active, refreshObservedRows);
	watch(() => [paginator.fetching.value, paginator.fetchingOlder.value, paginator.fetchingNewer.value], reconcileAfterListFetch, { flush: 'post' });

	if (paginator.computedParams) {
		watch(paginator.computedParams, () => {
			void reload();
		}, { immediate: false, deep: true });
	}

	stream = useStream();
	connection = stream.useChannel('main');
	if (store.s.realtimeMode) {
		connection.on('notification', onNotification);
		stream.on('_connected_', onReconnected);
	}
	connection.on('notificationFlushed', reload);
	connection.on('readNotification', onReadNotification);
	connection.on('readAllNotifications', onReadAllNotifications);
	connection.on('notificationChanged', event => { void onNotificationChanged(event); });
	globalEvents.on('reloadNotification', reload);
});

onUnmounted(() => {
	disposed = true;
	if (connection) connection.dispose();
	if (stream && store.s.realtimeMode) stream.off('_connected_', onReconnected);
	globalEvents.off('reloadNotification', reload);
	rowObserver?.disconnect();
	window.clearTimeout(readTimer);
	if (scrollContainer != null) {
		scrollContainer.removeEventListener('scroll', onScrollContainerScroll);
	}
});

defineExpose({
	reload,
});
</script>

<style lang="scss" module>
.transition_x_move {
	transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
}

.transition_x_enterActive {
	transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1);

	&.content,
	.content {
		/* Skip Note Rendering有効時、TransitionGroupで通知を追加するときに一瞬がくっとなる問題を抑制する */
		content-visibility: visible !important;
	}
}

.transition_x_leaveActive {
	transition: height 0.2s cubic-bezier(0,.5,.5,1), opacity 0.2s cubic-bezier(0,.5,.5,1);
}

.transition_x_enterFrom {
	opacity: 0;
	transform: translateY(max(-64px, -100%));
}

@supports (interpolate-size: allow-keywords) {
	.transition_x_enterFrom {
		interpolate-size: allow-keywords; // heightのtransitionを動作させるために必要
		height: 0;
	}
}

.transition_x_leaveTo {
	opacity: 0;
}

.notifications {
	container-type: inline-size;
	background: var(--MI_THEME-panel);
}

.item {
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.date {
	display: flex;
	font-size: 85%;
	align-items: center;
	justify-content: center;
	gap: 1em;
	padding: 8px 8px;
	margin: 0 auto;
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.more {
	display: block;
	width: 100%;
	box-sizing: border-box;
	padding: 16px;
	background: var(--MI_THEME-panel);
	border-top: solid 0.5px var(--MI_THEME-divider);
}

:global(html[data-hk3-ui]) .notifications,
:global(html[data-hk3-ui]) .more {
	background: var(--hk3-notifications-bg, var(--hk3-glass-soft, var(--MI_THEME-panel)));
	-webkit-backdrop-filter: var(--hk3-notifications-blur, var(--MI-blur, blur(16px)));
	backdrop-filter: var(--hk3-notifications-blur, var(--MI-blur, blur(16px)));
}
</style>
