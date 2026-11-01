<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
	<section class="hgn" aria-label="HataGoes の通知">
		<header class="hgn-head">
			<h2>通知 <span v-if="counts">{{ counts.count }}</span></h2>
			<button type="button" class="hgn-refresh" :disabled="loading" aria-label="通知を更新" title="通知を更新" @click="refreshAll"><i class="ti ti-refresh" aria-hidden="true"></i></button>
		</header>
		<p v-if="error" role="alert">件数を取得できませんでした。<button type="button" @click="refresh">再試行</button></p>
		<nav class="hgn-tabs" aria-label="通知のアプリ">
			<button v-for="tab in tabs" :key="tab.id" type="button" :aria-label="tab.label" :title="tab.label" :aria-pressed="selected === tab.id" @click="selected = tab.id">
				<i :class="tab.icon" aria-hidden="true"></i><span v-if="selected === tab.id">{{ tab.label }}</span><span v-if="counts"> {{ tab.id === 'all' ? counts.count : counts[tab.id] }}</span>
			</button>
		</nav>
		<div ref="timelineSurface" class="hgn-timeline"><MkStreamingNotificationsTimeline :key="selected" ref="timeline" :includeBrands="brands" :includeHataskApp="true" :active="active" :notUseGrouped="true"/></div>
	</section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import type { HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';
import { useStream } from '@/stream.js';
import { createRouter } from '@/router.js';
import { DI } from '@/di.js';
import { captureHatagoesPageTurn } from '@/utility/hatagoes-page-motion.js';

type Brand = 'hatask' | 'hatady' | 'hataFeed';
type Counts = Endpoints['hata/hatagoes/notifications/unread-count']['res'];
const props = withDefaults(defineProps<{ active?: boolean; pollingActive?: boolean; revision?: number }>(), { active: true, pollingActive: true, revision: 0 });
const emit = defineEmits<{ count: [value: number]; navigate: [path: string] }>();
// Notification links use the same legacy destinations as the old notification
// page. Route them through this shell without changing that page's behavior.
const notificationRouter = createRouter('/hatagoes?view=notifications');
notificationRouter.navHook = path => { emit('navigate', path); return true; };
provide(DI.router, notificationRouter);
const tabs = [
	{ id: 'all', label: 'すべて', icon: 'ti ti-bell' },
	{ id: 'hatask', label: 'Hatask', icon: 'ti ti-flower' },
	{ id: 'hatady', label: 'Hatady', icon: 'ti ti-book-2' },
	{ id: 'hataFeed', label: 'HataFeed', icon: 'ti ti-messages' },
] as const;
const selected = ref<'all' | Brand>('all');
const brands = computed<HataNotificationCategory[]>(() => selected.value === 'all' ? ['hatask', 'hatady', 'hataFeed'] : [selected.value]);
const counts = ref<Counts | null>(null);
const loading = ref(false);
const error = ref(false);
let timer: number | undefined;
let request = 0;
let disposeStream: (() => void) | undefined;
const timelineSurface = ref<HTMLElement>();
const timeline = ref<{ reload: () => Promise<unknown> }>();
let pageMotion: ReturnType<typeof captureHatagoesPageTurn> | undefined;
watch(selected, () => { pageMotion?.cancel(); pageMotion = captureHatagoesPageTurn(timelineSurface.value); pageMotion.play(); }, { flush: 'post' });

async function refresh(): Promise<void> {
	const current = ++request;
	loading.value = true;
	error.value = false;
	try {
		const result = await misskeyApi('hata/hatagoes/notifications/unread-count', {});
		if (current !== request) return;
		counts.value = result;
		emit('count', result.count);
	} catch {
		if (current === request) error.value = true;
	} finally {
		if (current === request) loading.value = false;
	}
}

function refreshAll(): void { void refresh(); void timeline.value?.reload(); }

watch(() => props.pollingActive, active => { if (active) void refresh(); });
watch(() => props.revision, () => { if (props.active) refreshAll(); });
onMounted(() => {
	void refresh();
	timer = window.setInterval(() => { if (props.pollingActive) void refresh(); }, 10_000);
	const connection = useStream().useChannel('main');
	connection.on('notification', refresh);
	connection.on('readNotification', refresh);
	connection.on('readAllNotifications', refresh);
	connection.on('notificationChanged', refresh);
	disposeStream = () => connection.dispose();
});
onUnmounted(() => { request++; pageMotion?.cancel(); window.clearInterval(timer); disposeStream?.(); });
</script>

<style scoped>
.hgn { --MI_THEME-fg: var(--fg, #252b31); --MI_THEME-panel: var(--surface, #fff); --MI_THEME-divider: var(--rule, #ccd0d2); --MI_THEME-accent: var(--accent, #496c9d); --MI_THEME-link: var(--accent-ink, var(--MI_THEME-accent)); --hk3-notifications-bg: transparent; --hk3-notifications-blur: none; min-width: 0; padding: 1rem; color: var(--MI_THEME-fg); }
.hgn-head, .hgn-tabs { display: flex; align-items: center; gap: .5rem; }
.hgn-head { justify-content: space-between; }
.hgn-head h2 { margin: 0; font-size: 1.25rem; }
.hgn-head h2 span { font-size: .85rem; }
.hgn-tabs { justify-content: center; width: fit-content; max-width: 100%; overflow-x: auto; margin: 1rem auto; padding: 4px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); }
.hgn .hgn-tabs button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease; }
.hgn button { border: 1px solid var(--MI_THEME-divider); border-radius: .65rem; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); padding: .5rem .75rem; white-space: nowrap; cursor: pointer; }
.hgn .hgn-tabs button[aria-pressed="true"] { background: var(--MI_THEME-accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent, #fff)); }
.hgn-refresh { display: grid; place-items: center; width: 38px; height: 38px; padding: 0 !important; font-size: 19px; }
.hgn-timeline { color: var(--MI_THEME-fg); background: transparent; border-radius: 16px; overflow: hidden; }
.hgn-timeline :deep([data-notification-brand]) { color: var(--MI_THEME-fg); }
.hgn-timeline :deep([data-notification-brand-label]) { color: var(--MI_THEME-fg); }
.hgn-timeline :deep([data-notification-body]) { opacity: 1; }
.hgn-timeline :deep([data-notification-body-link]) { color: var(--MI_THEME-link); text-decoration: none; }
.hgn-timeline :deep([data-notification-date-separator]) { width: fit-content; max-width: calc(100% - 20px); margin: 12px auto; padding: 6px 14px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--fill, color-mix(in srgb, var(--MI_THEME-accent) 6%, var(--MI_THEME-panel))); color: var(--fg-2, var(--MI_THEME-fg)); font-size: 12px; font-weight: 700; }
</style>
