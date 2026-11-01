<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: Hataskey UI 以外（標準UI・クラシックデッキ）でのコンカレント通知トースト。
Hataskey UI では MkHataskeyNotificationToasts が同じイベントを受けて標準トーストに統合する。
-->

<template>
<Teleport to="body">
	<div v-if="!notificationToastsSuppressed && toasts.length" :class="$style.root" aria-live="polite" aria-label="コンカレントの通知">
		<div v-for="toast in toasts" :key="toast.id" :class="$style.item">
			<ConcrntNotificationToast :notification="toast.notification" :embedded="false" @close="remove(toast.id)"/>
			<button class="_button" :class="$style.close" aria-label="通知を閉じる" @click="remove(toast.id)"><i class="ti ti-x"></i></button>
		</div>
	</div>
</Teleport>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';
import ConcrntNotificationToast from '@/components/concrnt/ConcrntNotificationToast.vue';
import { CONCRNT_NOTIFICATION_EVENT } from '@/utility/concrnt/events.js';
import { getNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed, shouldSuppressNotificationToasts } from '@/utility/notification-toast-suppression.js';

const toasts = ref<{ id: number; notification: ConcrntNotification }[]>([]);
const timers = new Map<number, number>();
let sequence = 0;

function remove(id: number): void {
	window.clearTimeout(timers.get(id));
	timers.delete(id);
	toasts.value = toasts.value.filter(toast => toast.id !== id);
}

function onNotification(event: Event): void {
	// A page with the shared Hataskey renderer receives the event itself.
	if (shouldSuppressNotificationToasts() || getNotificationPageContext() || window.document.hidden) return;
	const notification = (event as CustomEvent<ConcrntNotification>).detail;
	if (!notification) return;
	const id = ++sequence;
	toasts.value = [{ id, notification }, ...toasts.value.filter(toast => toast.notification.uri !== notification.uri)].slice(0, 3);
	timers.set(id, window.setTimeout(() => remove(id), 6000));
}

watch(notificationToastsSuppressed, suppressed => { if (suppressed) for (const toast of toasts.value) remove(toast.id); });
onMounted(() => window.addEventListener(CONCRNT_NOTIFICATION_EVENT, onNotification));
onUnmounted(() => {
	window.removeEventListener(CONCRNT_NOTIFICATION_EVENT, onNotification);
	for (const timer of timers.values()) window.clearTimeout(timer);
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	right: max(16px, env(safe-area-inset-right));
	bottom: calc(80px + env(safe-area-inset-bottom));
	z-index: 10000;
	display: flex;
	flex-direction: column;
	gap: 8px;
	pointer-events: none;
}

.item {
	position: relative;
	pointer-events: auto;
}

.close {
	position: absolute;
	top: 4px;
	right: 4px;
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	opacity: .55;

	&:hover { opacity: 1; background: var(--MI_THEME-buttonHoverBg); }
}

@media (max-width: 500px) {
	.root {
		right: 10px;
		bottom: calc(90px + env(safe-area-inset-bottom));
		left: 10px;
	}
}
</style>
