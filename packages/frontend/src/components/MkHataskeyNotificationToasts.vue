<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<Teleport :to="integrated && target ? target : 'body'">
	<TransitionGroup
		tag="div" :class="$style.stack" :data-integrated="integrated" :data-mobile="context.mobile.value" :css="motion"
		:enterActiveClass="$style.enterActive" :leaveActiveClass="$style.leaveActive" :enterFromClass="$style.enterFrom" :leaveToClass="$style.leaveTo" :moveClass="$style.move"
		aria-live="polite" aria-relevant="additions" :aria-label="i18n.ts.notifications"
		@leave="onLeave" @afterLeave="clearLeaveTimer" @leaveCancelled="clearLeaveTimer"
	>
		<MkHataskeyNotificationToast
			v-for="item in context.items.value" :key="item.id" :item="item" :integrated="integrated" :motion="motion"
			@close="context.dismiss(item.id)" @pause="pause(item.id, $event)" @resize="resize(item.id, $event)"
		/>
	</TransitionGroup>
</Teleport>
<MkNotificationToastRing v-if="integrated && active" :target="context.surface.value?.outline.value ?? context.outline.value" :elapsed="active.elapsed" :duration="getToastDuration(active)" integrated :motion="motion"/>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { entities } from 'cherrypick-js';
import type { HataskeyNotificationToasts } from '@/utility/hataskey-notification-toast.js';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';
import { CONCRNT_NOTIFICATION_EVENT } from '@/utility/concrnt/events.js';
import { getNotificationPageContext, getToastDuration, hataskeyToastMotionEnabled } from '@/utility/hataskey-notification-toast.js';
import MkHataskeyNotificationToast from '@/components/MkHataskeyNotificationToast.vue';
import MkNotificationToastRing from '@/components/MkNotificationToastRing.vue';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{ context: HataskeyNotificationToasts; receiveExternal?: boolean }>(), { receiveExternal: true });
const context = props.context;
const target = computed(() => context.surface.value?.target.value ?? context.target.value);
// Keep an outgoing card in its original Teleport host until its leave animation ends.
// A new item selects the current host; a removed target cannot retain integration.
const integrated = computed<boolean>(previous => {
	if (!target.value) return false;
	return context.items.value.length === 0 ? (previous ?? false) : context.integrated.value;
});
const active = computed(() => context.items.value[0]);
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reducedMotionQuery.matches);
const motion = computed(() => hataskeyToastMotionEnabled(context.surface.value, prefer.r.animation.value, reducedMotion.value));
const paused = new Set<number>();
const heights = new Map<number, number>();
let frame = 0;
let clockTimer: number | undefined;
const leaveTimers = new Map<Element, number>();

function clearLeaveTimer(el: Element) {
	window.clearTimeout(leaveTimers.get(el));
	leaveTimers.delete(el);
}

function onLeave(el: Element, done: () => void) {
	clearLeaveTimer(el);
	// Vue's CSS leave completion starts after two rAF callbacks. Bound removal
	// independently so suspending a PWA cannot strand an outgoing notification.
	if (!motion.value) { done(); return; }
	leaveTimers.set(el, window.setTimeout(done, 350));
}

function stopClock() {
	cancelAnimationFrame(frame);
	window.clearTimeout(clockTimer);
	frame = 0;
	clockTimer = undefined;
}

function scheduleTick() {
	if (window.document.hidden || !context.items.value.length) { stopClock(); return; }
	if (!frame) frame = requestAnimationFrame(tick);
	// The timer keeps expiry independent of animation frames while visible.
	clockTimer ??= window.setTimeout(() => {
		clockTimer = undefined;
		if (!window.document.hidden) context.tick(performance.now(), paused);
		scheduleTick();
	}, 250);
}

function pause(id: number, value: boolean) {
	if (value) paused.add(id);
	else paused.delete(id);
}

function resize(id: number, height: number) {
	heights.set(id, height);
	if (id === active.value?.id) context.height.value = height;
}

function tick() {
	frame = 0;
	if (window.document.hidden) return;
	context.tick(performance.now(), paused);
	scheduleTick();
}

watch(context.items, (items) => {
	for (const id of paused) if (!items.some(item => item.id === id)) paused.delete(id);
	for (const id of heights.keys()) if (!items.some(item => item.id === id)) heights.delete(id);
	context.height.value = items.length ? (heights.get(items[0].id) ?? context.height.value) : 0;
	scheduleTick();
}, { immediate: true });
watch(integrated, value => {
	if (value && context.items.value.length > 1) context.items.value = context.items.value.slice(0, 1);
});
watch(notificationToastsSuppressed, value => { if (value) context.clear(); });
watch(() => prefer.r['external.disableNotificationToast'].value, value => {
	if (value) context.items.value = context.items.value.filter(item => item.source !== 'external');
});

function onVisibilityChange() {
	// Discard background time and replace any frame request interrupted by suspension.
	stopClock();
	const now = performance.now();
	for (const item of context.items.value) item.updatedAt = now;
	scheduleTick();
}

function onReducedMotion(event: MediaQueryListEvent) { reducedMotion.value = event.matches; }

function onExternalNotification(event: Event) {
	if (!props.receiveExternal || notificationToastsSuppressed.value || prefer.s['external.disableNotificationToast'] || window.document.hidden) return;
	const pageContext = getNotificationPageContext();
	if (pageContext && pageContext !== context) return;
	const notification = (event as CustomEvent<entities.Notification>).detail;
	if (notification) context.enqueue(notification, 'external', performance.now(), prefer.s['external.host'] ?? undefined);
}

// 旗鯖fork: コンカレントの通知も外部連携と同じ受け口で「外部」として出す（受け取り条件も外部通知に揃える）。
function onConcrntNotification(event: Event) {
	if (!props.receiveExternal || notificationToastsSuppressed.value || window.document.hidden) return;
	const pageContext = getNotificationPageContext();
	if (pageContext && pageContext !== context) return;
	const notification = (event as CustomEvent<ConcrntNotification>).detail;
	if (notification) context.enqueueConcrnt(notification, performance.now());
}

onMounted(() => {
	window.addEventListener('external-notification', onExternalNotification);
	window.addEventListener(CONCRNT_NOTIFICATION_EVENT, onConcrntNotification);
	window.document.addEventListener('visibilitychange', onVisibilityChange);
	reducedMotionQuery.addEventListener('change', onReducedMotion);
});
onUnmounted(() => {
	stopClock();
	for (const el of leaveTimers.keys()) clearLeaveTimer(el);
	context.clear();
	context.height.value = 0;
	window.removeEventListener('external-notification', onExternalNotification);
	window.removeEventListener(CONCRNT_NOTIFICATION_EVENT, onConcrntNotification);
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
	reducedMotionQuery.removeEventListener('change', onReducedMotion);
});
</script>

<style module lang="scss">
.stack {
	position: fixed;
	bottom: max(20px, env(safe-area-inset-bottom, 0px));
	right: max(20px, env(safe-area-inset-right, 0px));
	width: min(300px, calc(100dvw - 32px));
	display: flex;
	flex-direction: column-reverse;
	gap: 8px;
	z-index: 3900000;
	pointer-events: none;
	&[data-integrated='true'] {
		position: relative;
		inset: auto;
		width: 100%;
		gap: 0;
		z-index: auto;
	}
}
.enterActive { transition: opacity .28s ease; }
.leaveActive { transition: opacity .26s ease; pointer-events: none; }
.enterFrom, .leaveTo { opacity: 0; }
.move { transition: transform .3s cubic-bezier(.22, 1, .36, 1); }
.stack[data-integrated='true'] {
	.enterActive, .leaveActive { transition: opacity .28s ease, transform .3s cubic-bezier(.22, 1, .36, 1); }
	.enterFrom { transform: translateY(-12px); }
	.leaveActive { position: absolute; top: 0; left: 0; width: 100%; }
	.leaveTo { transform: translateY(var(--hata-toast-leave-offset, calc(100% + 12px))); }
}
</style>
