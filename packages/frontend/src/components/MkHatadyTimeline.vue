<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<component :is="prefer.s.enablePullToRefresh ? MkPullToRefresh : 'div'" :refresher="refreshFromPull">
	<section ref="root" :class="$style.timeline" :data-variant="variant">
		<div :class="$style.filters">
			<div :class="$style.scopes" role="group" aria-label="表示範囲">
				<button v-for="option in scopes" :key="option.value" type="button" :aria-pressed="scope === option.value" @click="selectScope(option.value)">{{ option.label }}</button>
			</div>
			<div ref="kindAnchor" :class="$style.kindAnchor">
				<button ref="kindButton" type="button" :class="$style.kind" :aria-expanded="kindMenuOpen" :aria-controls="kindMenuOpen ? kindMenuId : undefined" @click="toggleKindMenu" @keydown.down.prevent="openKindMenu" @keydown.up.prevent="openKindMenu" @keydown.esc.stop.prevent="closeKindMenu(true)"><i :class="selectedKind.icon" aria-hidden="true"></i>{{ selectedKind.label }}<i class="ti ti-chevron-down" aria-hidden="true"></i></button>
			</div>
			<Teleport to="body">
				<div v-if="kindMenuOpen" :id="kindMenuId" ref="kindMenu" :class="$style.kindMenu" :data-variant="variant" :style="[kindMenuTheme, { left: `${kindMenuLeft}px`, top: `${kindMenuTop}px`, maxHeight: `${kindMenuHeight}px`, minWidth: `${Math.min(180, kindMenuMaxWidth)}px`, maxWidth: `${kindMenuMaxWidth}px` }]" role="menu" @keydown="onKindMenuKeydown">
					<button v-for="option in kinds" :key="option.value" type="button" role="menuitemradio" :aria-checked="kind === option.value" @click="selectKind(option.value)"><i :class="option.icon" aria-hidden="true"></i>{{ option.label }}</button>
				</div>
			</Teleport>
		</div>
		<MkLoading v-if="loading && activities.length === 0"/>
		<MkError v-else-if="error && activities.length === 0" @retry="reloadTimeline"/>
		<template v-else>
			<button v-if="queuedCount > 0 && !newNotesInNavbar && ['default', 'count'].includes(prefer.s.newNoteReceivedNotificationBehavior)" type="button" :class="$style.queue" @click="releaseQueue"><i class="ti ti-arrow-up"></i>{{ prefer.s.newNoteReceivedNotificationBehavior === 'count' ? i18n.tsx.newNoteRecivedCount({ n: String(queuedCount) }) : i18n.ts.newNoteRecived }}</button>
			<MkResult v-if="activities.length === 0" type="empty" :text="i18n.ts.noNotes"/>
			<div v-else :class="$style.cards">
				<HatadyActivityCard v-for="activity in activities" :key="hatadyTimelineKey(activity)" :activity="activity" :variant="variant" @openLog="actions.openConversation" @openSession="actions.openSession" @openBook="actions.openBookDetail" @openMedia="actions.openMediaDetailById" @openProfile="actions.openProfile" @edit="actions.editActivity" @deleted="onDeleted(activity)" @menu="actions.openActivityMenu"/>
			</div>
			<button v-if="hasMore" v-appear="prefer.s.enableInfiniteScroll ? loadMore : null" type="button" :class="$style.more" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '読み込み中…' : i18n.ts.loadMore }}</button>
			<button v-if="error" type="button" :class="$style.more" @click="reloadTimeline">{{ i18n.ts.retry }}</button>
		</template>
	</section>
</component>
</template>
<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, useId, watch } from 'vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import { requireHatadyActivityPage } from '@/utility/hatady-media.js';
import { HatadyTimelineGeneration, hatadyTimelineAutoRefreshAllowed, hatadyTimelineKey, hatadyTimelineShouldLoadOnActivate, hatadyTimelineTrackedKeys, removeHatadyTimelineActivity, sortHatadyTimelineActivities, upsertHatadyTimelineActivity } from '@/utility/hatady-timeline.js';
import type { HatadyTimelineKind, HatadyTimelineScope } from '@/utility/hatady-timeline.js';
import { useHatadyActivityActions } from '@/utility/hatady-activity-actions.js';
import { useHataskeyTimelineNewNotes } from '@/utility/hataskey-timeline-new-notes.js';
import { HK3_THEME_CONTEXT } from '@/components/hataskey3/hk3-theme.js';
import { navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import { HATADY_ACTIVITY_CHOICES } from '@/utility/hatady-ui.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import '@/components/hatady-ui.css';

const props = withDefaults(defineProps<{ variant: 'ui' | 'uis'; active?: boolean; live?: boolean; newNotesNavbarKey?: string }>(), { active: true, live: true });
const root = ref<HTMLElement | null>(null);
const hk3ThemeContext = inject(HK3_THEME_CONTEXT, null);
const kindMenuTheme = computed(() => props.variant === 'uis' ? hk3ThemeContext?.value ?? {} : {});
const navbarPull = inject(navbarPullRefreshKey, null);
const scope = ref<HatadyTimelineScope>('recent');
const kind = ref<HatadyTimelineKind>('all');
const kindMenuOpen = ref(false);
const kindMenuId = useId();
const kindAnchor = ref<HTMLElement | null>(null);
const kindButton = ref<HTMLButtonElement | null>(null);
const kindMenu = ref<HTMLElement | null>(null);
const kindMenuLeft = ref(0);
const kindMenuTop = ref(0);
const kindMenuHeight = ref(0);
const kindMenuMaxWidth = ref(180);
const activities = shallowRef<HatadyActivity[]>([]);
const queued = shallowRef<HatadyActivity[]>([]);
const loading = ref(false), loadingMore = ref(false), error = ref(false), hasMore = ref(false);
const cursor = ref<string | null>(null);
const active = ref(false);
const atTop = ref(true);
const queuedCount = computed(() => queued.value.length);
const scopes = computed(() => [
	{ value: 'mine' as const, label: i18n.ts._hata._hatady._page.myRecords },
	{ value: 'recent' as const, label: i18n.ts._hata._hatady._page.everyone },
	{ value: 'following' as const, label: i18n.ts._hata._hatady._home.tabFollowing },
]);
const kinds = computed(() => [{ value: 'all' as const, label: i18n.ts._hata._hatady._home.filterAll, icon: 'ti ti-notebook' }, ...HATADY_ACTIVITY_CHOICES]);
const selectedKind = computed(() => kinds.value.find(option => option.value === kind.value)!);
const requestGeneration = new HatadyTimelineGeneration();
const actions = useHatadyActivityActions({
	variant: props.variant,
	onChanged: () => reloadTimeline(),
	onDeleted: onDeleted,
});

const newNotesInNavbar = useHataskeyTimelineNewNotes(() => props.newNotesNavbarKey, () => {
	if (!active.value || queuedCount.value === 0 || !['default', 'count'].includes(prefer.r.newNoteReceivedNotificationBehavior.value)) return null;
	const count = queuedCount.value;
	return {
		text: prefer.r.newNoteReceivedNotificationBehavior.value === 'count' ? i18n.tsx.newNoteRecivedCount({ n: String(count) }) : i18n.ts.newNoteRecived,
		icon: 'ti ti-arrow-up', count, show: releaseQueue,
		avatars: queued.value.slice(0, 3).flatMap(activity => {
			const url = activity.user?.avatarUrl;
			return url && /^https?:\/\//i.test(url) ? [{ id: hatadyTimelineKey(activity), url, user: activity.user! }] : [];
		}),
		author: queued.value[0]?.user ?? null,
	};
});

let connection: any = null;
let stream: ReturnType<typeof useStream> | null = null;
let serverSeq = 0;
let syncRequestId = 0;
let connectedOnce = false;
let snapshotReady = false;
let initialLoadSettled = false;
let loadingSnapshot = false;
type PendingEvent = { seq: number; kind: 'activity' | 'removed'; key: string; activity?: HatadyActivity };
let pendingEvents = new Map<string, PendingEvent>();
let resyncTimer: number | null = null;

function onDeleted(activity: HatadyActivity): void {
	const key = hatadyTimelineKey(activity);
	activities.value = removeHatadyTimelineActivity(activities.value, key);
	queued.value = removeHatadyTimelineActivity(queued.value, key);
}

function readSeq(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function applyEvent(event: { seq: number; kind: 'activity' | 'removed'; key: string; activity?: HatadyActivity }): void {
	if (event.kind === 'removed') {
		activities.value = removeHatadyTimelineActivity(activities.value, event.key);
		queued.value = removeHatadyTimelineActivity(queued.value, event.key);
		return;
	}
	const activity = event.activity;
	if (!activity || hatadyTimelineKey(activity) !== event.key) return;
	const displayed = activities.value.some(item => hatadyTimelineKey(item) === event.key);
	const waiting = queued.value.some(item => hatadyTimelineKey(item) === event.key);
	if (displayed) activities.value = upsertHatadyTimelineActivity(activities.value, activity);
	else if (waiting || !props.live || !atTop.value || window.document.hidden || navbarPull?.active.value) queued.value = upsertHatadyTimelineActivity(queued.value, activity);
	else activities.value = upsertHatadyTimelineActivity(activities.value, activity);
	if (hatadyTimelineTrackedKeys(activities.value, queued.value).length > 500) { trimTracking(); scheduleResync(); }
}

function trimTracking(): void {
	// Keep the visible list and the watched set identical when the server's 500-key limit is reached.
	queued.value = queued.value.slice(0, 200);
	activities.value = activities.value.slice(0, 500 - queued.value.length);
	hasMore.value = false;
}

function receive(sourceConnection: unknown, kind: 'activity' | 'removed', payload: any): void {
	if (!active.value || connection !== sourceConnection) return;
	const seq = readSeq(payload?.seq);
	if (seq === null || typeof payload?.key !== 'string') return;
	if (seq <= serverSeq) return;
	if (seq > serverSeq + 1) { scheduleResync(); return; }
	serverSeq = seq;
	const event = { seq, kind, key: payload.key, activity: payload.activity as HatadyActivity | undefined };
	if (loadingSnapshot) {
		pendingEvents.set(event.key, event);
		if (pendingEvents.size > 500) {
			pendingEvents.delete(pendingEvents.keys().next().value!);
			scheduleResync();
		}
	} else applyEvent(event);
}

function sync(): void {
	if (!active.value || !connection || stream?.state !== 'connected' || !store.s.realtimeMode || loadingSnapshot || !snapshotReady) return;
	const ids = hatadyTimelineTrackedKeys(activities.value, queued.value);
	if (ids.length > 500) { scheduleResync(); return; }
	connection.send('sync', { ids, seenThrough: serverSeq, requestId: ++syncRequestId });
}

function connected(): void {
	if (!active.value || !props.active || window.document.hidden) return;
	if (connectedOnce) {
		serverSeq = 0;
		snapshotReady = false;
		syncRequestId = 0;
		void reloadTimeline();
	} else {
		connectedOnce = true;
		if (!loadingSnapshot && !loading.value) sync();
	}
}

function disconnected(): void {
	if (!active.value) return;
	requestGeneration.invalidate();
	loadingSnapshot = false;
	pendingEvents.clear();
}

function connect(): void {
	if (!hatadyTimelineAutoRefreshAllowed(active.value, store.s.realtimeMode, !window.document.hidden) || connection) return;
	stream = useStream();
	connection = stream.useChannel('hatadyTimeline', { scope: scope.value, ...(kind.value === 'all' ? {} : { kind: kind.value }) });
	const thisConnection = connection;
	connection.on('activity', (payload: any) => receive(thisConnection, 'activity', payload));
	connection.on('removed', (payload: any) => receive(thisConnection, 'removed', payload));
	connection.on('synced', (payload: any) => {
		if (connection !== thisConnection) return;
		const seq = readSeq(payload?.seq);
		if (seq === null || seq <= serverSeq) return;
		if (seq !== serverSeq + 1) { scheduleResync(); return; }
		serverSeq = seq;
	});
	connection.on('resyncRequired', () => { if (connection === thisConnection) scheduleResync(); });
	stream.on('_connected_', connected);
	stream.on('_disconnected_', disconnected);
	connectedOnce = false; serverSeq = 0; snapshotReady = false; syncRequestId = 0;
	if (stream.state === 'connected') connected();
}

function disconnect(): void {
	requestGeneration.invalidate();
	if (resyncTimer) window.clearTimeout(resyncTimer);
	resyncTimer = null;
	connection?.dispose(); connection = null;
	if (stream) { stream.off('_connected_', connected); stream.off('_disconnected_', disconnected); }
	stream = null; connectedOnce = false; loadingSnapshot = false; pendingEvents.clear();
	snapshotReady = false;
	loading.value = false; loadingMore.value = false;
}

function scheduleResync(): void {
	if (resyncTimer || !hatadyTimelineAutoRefreshAllowed(active.value, store.s.realtimeMode, !window.document.hidden)) return;
	resyncTimer = window.setTimeout(() => { resyncTimer = null; trimTracking(); disconnect(); connect(); void reloadTimeline(); }, 150);
}

async function loadPage(append = false): Promise<void> {
	if (!active.value || (append && (loading.value || loadingMore.value || !cursor.value))) return;
	const generation = requestGeneration.next();
	const requestCursor = append ? cursor.value : null;
	const seenThrough = serverSeq;
	let committed = false;
	loadingSnapshot = true;
	pendingEvents.clear();
	if (append) loadingMore.value = true;
	else { loading.value = true; loadingMore.value = false; }
	error.value = false;
	try {
		const page = requireHatadyActivityPage(await misskeyApi('hata/hatady/activities' as never, {
			scope: scope.value, limit: 50,
			...(kind.value === 'all' ? {} : { kinds: [kind.value] }),
			...(requestCursor ? { cursor: requestCursor } : {}),
		} as never));
		if (!active.value || !requestGeneration.current(generation)) return;
		if (append) activities.value = sortHatadyTimelineActivities([...activities.value, ...page.items]);
		else {
			activities.value = sortHatadyTimelineActivities(page.items);
			queued.value = queued.value.filter(item => !activities.value.some(row => hatadyTimelineKey(row) === hatadyTimelineKey(item)));
		}
		for (const event of [...pendingEvents.values()].filter(event => event.seq > seenThrough).sort((a, b) => a.seq - b.seq)) applyEvent(event);
		cursor.value = page.nextCursor;
		hasMore.value = page.hasMore && !!page.nextCursor;
		if (hatadyTimelineTrackedKeys(activities.value, queued.value).length > 500) {
			trimTracking();
			scheduleResync();
		}
		snapshotReady = true;
		committed = true;
	} catch {
		if (active.value && requestGeneration.current(generation)) {
			for (const event of [...pendingEvents.values()].filter(event => event.seq > seenThrough).sort((a, b) => a.seq - b.seq)) applyEvent(event);
			// Retained rows still need access checks on the new channel even if REST failed.
			snapshotReady = snapshotReady || activities.value.length > 0 || queued.value.length > 0;
			committed = snapshotReady;
			error.value = true;
		}
	} finally {
		if (requestGeneration.current(generation)) {
			// An invalidated first request still needs a replacement in manual mode.
			if (!append) initialLoadSettled = true;
			if (append) loadingMore.value = false;
			else loading.value = false;
			loadingSnapshot = false;
			pendingEvents.clear();
			if (committed) sync();
		}
	}
}

async function reloadTimeline(): Promise<void> { await loadPage(false); }

async function refreshFromPull(): Promise<void> { await reloadTimeline(); }

async function loadMore(): Promise<void> { await loadPage(true); }

function releaseQueue(): void {
	activities.value = sortHatadyTimelineActivities([...activities.value, ...queued.value]);
	queued.value = [];
	root.value?.scrollIntoView({ block: 'start', behavior: prefer.s.animation ? 'smooth' : 'instant' });
}

function selectScope(value: HatadyTimelineScope): void { if (scope.value === value) return; scope.value = value; resetFilter(); }

function kindMenuVisibleBounds(): { top: number; bottom: number; left: number; right: number } {
	const bounds = { top: 8, bottom: window.innerHeight - 8, left: 8, right: window.innerWidth - 8 };
	for (let parent = kindAnchor.value?.parentElement; parent; parent = parent.parentElement) {
		const style = window.getComputedStyle(parent);
		if (!/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
		const rect = parent.getBoundingClientRect();
		bounds.top = Math.max(bounds.top, rect.top + 8);
		bounds.bottom = Math.min(bounds.bottom, rect.bottom - 8);
		bounds.left = Math.max(bounds.left, rect.left + 8);
		bounds.right = Math.min(bounds.right, rect.right - 8);
	}
	return bounds;
}

function positionKindMenu(): boolean {
	if (!kindMenuOpen.value || !kindButton.value || !kindMenu.value) return false;
	const buttonRect = kindButton.value.getBoundingClientRect();
	const bounds = kindMenuVisibleBounds();
	if (buttonRect.top < bounds.top || buttonRect.bottom > bounds.bottom || buttonRect.left < bounds.left || buttonRect.right > bounds.right) {
		closeKindMenu();
		return false;
	}
	const top = buttonRect.bottom + 4;
	const availableHeight = Math.floor(bounds.bottom - top);
	const availableWidth = Math.floor(bounds.right - bounds.left);
	if (availableHeight < 44 || availableWidth < 44) {
		closeKindMenu();
		return false;
	}
	const menuWidth = Math.min(kindMenu.value.getBoundingClientRect().width || 180, availableWidth);
	kindMenuLeft.value = Math.min(Math.max(buttonRect.left, bounds.left), Math.max(bounds.left, bounds.right - menuWidth));
	kindMenuTop.value = top;
	kindMenuHeight.value = availableHeight;
	kindMenuMaxWidth.value = availableWidth;
	return true;
}

async function openKindMenu(): Promise<void> {
	if (kindMenuOpen.value) return;
	kindMenuOpen.value = true;
	await nextTick();
	if (!kindMenuOpen.value || !kindButton.value) return;
	const buttonRect = kindButton.value.getBoundingClientRect();
	const bounds = kindMenuVisibleBounds();
	if (buttonRect.top < bounds.top || buttonRect.bottom > bounds.bottom || buttonRect.left < bounds.left || buttonRect.right > bounds.right || bounds.bottom - buttonRect.bottom < 160) {
		kindButton.value.scrollIntoView?.({ block: 'center', behavior: 'instant' });
		await nextTick();
	}
	if (!positionKindMenu()) return;
	kindMenu.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
}

function toggleKindMenu(): void {
	if (kindMenuOpen.value) closeKindMenu(true);
	else void openKindMenu();
}

function closeKindMenu(restoreFocus = false): void {
	kindMenuOpen.value = false;
	if (restoreFocus) kindButton.value?.focus();
}

function onKindMenuOutside(event: Event): void {
	if (kindMenuOpen.value && !kindAnchor.value?.contains(event.target as Node) && !kindMenu.value?.contains(event.target as Node)) closeKindMenu();
}

function onKindMenuKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeKindMenu(true); return; }
	const buttons = [...(kindMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
	if (!buttons.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault();
	const current = Math.max(0, buttons.indexOf(event.target as HTMLButtonElement));
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
	buttons[next]?.focus();
}

function selectKind(value: HatadyTimelineKind): void { closeKindMenu(true); if (kind.value === value) return; kind.value = value; resetFilter(); }

function resetFilter(): void {
	disconnect(); activities.value = []; queued.value = []; cursor.value = null; hasMore.value = false;
	initialLoadSettled = false;
	connect(); void reloadTimeline();
}

function measureTop(): void { atTop.value = (root.value?.getBoundingClientRect().top ?? 0) >= -50; }

function visibility(): void {
	if (window.document.hidden) disconnect();
	else if (active.value && hatadyTimelineShouldLoadOnActivate(store.s.realtimeMode, initialLoadSettled)) { connect(); void reloadTimeline(); }
}

function activate(): void { if (active.value || !props.active) return; active.value = true; connect(); if (hatadyTimelineShouldLoadOnActivate(store.s.realtimeMode, initialLoadSettled)) void reloadTimeline(); }

function deactivate(): void { if (!active.value) return; active.value = false; closeKindMenu(); disconnect(); }

watch(() => props.active, value => { if (value) activate(); else deactivate(); });
watch(() => store.r.realtimeMode.value, enabled => {
	if (enabled && active.value) {
		connect(); void reloadTimeline();
	} else {
		disconnect();
		if (active.value && !initialLoadSettled && !window.document.hidden) void reloadTimeline();
	}
});
onMounted(() => { window.addEventListener('scroll', measureTop, true); window.addEventListener('scroll', positionKindMenu, true); window.addEventListener('resize', positionKindMenu); window.document.addEventListener('visibilitychange', visibility); window.document.addEventListener('pointerdown', onKindMenuOutside); window.document.addEventListener('focusin', onKindMenuOutside); activate(); });
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(() => { deactivate(); window.removeEventListener('scroll', measureTop, true); window.removeEventListener('scroll', positionKindMenu, true); window.removeEventListener('resize', positionKindMenu); window.document.removeEventListener('visibilitychange', visibility); window.document.removeEventListener('pointerdown', onKindMenuOutside); window.document.removeEventListener('focusin', onKindMenuOutside); });
defineExpose({ reloadTimeline, refreshFromPull, loadMore, releaseQueue, queuedCount });
</script>
<style lang="scss" module>
.timeline { --timeline-ink: var(--MI_THEME-fg); --timeline-panel: var(--MI_THEME-panel); --timeline-border: var(--MI_THEME-divider); --timeline-accent: var(--MI_THEME-accent); color: var(--timeline-ink); }
.timeline[data-variant='uis'] { --timeline-ink: var(--hk3-text, var(--MI_THEME-fg)); --timeline-panel: var(--hk3-surface, var(--MI_THEME-panel)); --timeline-border: color-mix(in srgb, var(--timeline-ink) 15%, transparent); --timeline-accent: var(--hk3-accent, var(--MI_THEME-accent)); }
.filters { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 9px; padding: 14px; }
.kindAnchor { position: relative; }
.scopes { display: flex; padding: 3px; border-radius: 999px; border: 1px solid var(--timeline-border); background: var(--timeline-panel); }
.scopes button, .kind { border: 0; background: none; color: inherit; padding: 8px 13px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
.scopes button[aria-pressed='true'] { background: var(--timeline-accent); color: var(--MI_THEME-fgOnAccent, white); }
.kind { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--timeline-border); background: var(--timeline-panel); }
.kindMenu { --timeline-ink: var(--MI_THEME-fg); --timeline-panel: var(--MI_THEME-panel); --timeline-border: var(--MI_THEME-divider); --timeline-accent: var(--MI_THEME-accent); position: fixed; z-index: 1000; box-sizing: border-box; display: grid; min-width: 180px; max-width: calc(100vw - 16px); overflow-y: auto; padding: 5px; border: 1px solid var(--timeline-border); border-radius: 14px; background: var(--timeline-panel); color: var(--timeline-ink); box-shadow: 0 14px 32px #0003; }
.kindMenu[data-variant='uis'] { --timeline-ink: var(--hk3-text, var(--MI_THEME-fg)); --timeline-panel: var(--hk3-surface, var(--MI_THEME-panel)); --timeline-border: color-mix(in srgb, var(--timeline-ink) 15%, transparent); --timeline-accent: var(--hk3-accent, var(--MI_THEME-accent)); }
.kindMenu button { display: flex; align-items: center; gap: 9px; border: 0; background: transparent; color: inherit; text-align: left; padding: 9px 12px; border-radius: 9px; cursor: pointer; }
.kindMenu button:hover, .kindMenu button[aria-checked='true'] { background: color-mix(in srgb, var(--timeline-accent) 14%, transparent); }
.cards { display: grid; gap: 10px; padding: 0 10px; }
.queue { display: flex; align-items: center; justify-content: center; gap: 8px; width: max-content; margin: 8px auto 14px; border: 0; border-radius: 999px; padding: 9px 17px; background: var(--timeline-accent); color: var(--MI_THEME-fgOnAccent, white); cursor: pointer; }
.more { display: block; width: 100%; padding: 18px; border: 0; background: transparent; color: var(--timeline-accent); cursor: pointer; }
.timeline[data-variant='uis'] .cards { gap: 14px; padding: 0 15px; }
@media (max-width: 600px) { .filters { gap: 7px; padding: 9px 5px; } .scopes button, .kind { padding: 7px 10px; font-size: 12px; } .cards { padding: 0 5px; } }
</style>
