<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: 外部通知トーストのグローバル表示コンテナ。
window の 'external-notification' イベントを listen して、右下にトーストをスタック表示する。

配置: position: fixed で右下固定 (bottom: 80px, right: 16px) - Hataskey UI のモバイル下部ナビバー、
投稿FAB等にかぶらないよう底部に余白あり。
モバイルではより小さめサイズで表示。
-->

<template>
	<Teleport to="body">
		<div v-if="!notificationToastsSuppressed" :class="$style.root">
			<MkExternalNotificationToast
				v-for="t in toasts"
				:key="t.id"
				:notification="t.notification"
				@close="removeToast(t.id)"
			/>
		</div>
	</Teleport>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MkExternalNotificationToast from '@/components/MkExternalNotificationToast.vue';
import { getNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed, shouldSuppressNotificationToasts } from '@/utility/notification-toast-suppression.js';

interface ToastItem { id: string; notification: any; }
const toasts = ref<ToastItem[]>([]);
const MAX_TOASTS = 3;
let nextId = 0;

watch(notificationToastsSuppressed, (suppressed) => {
	if (suppressed) toasts.value = [];
});

function onExternalNotification(ev: Event) {
	if (shouldSuppressNotificationToasts()) return;
	// The active page's shared renderer receives this event directly.
	if (getNotificationPageContext()) return;
	const notification = (ev as CustomEvent).detail;
	if (!notification) return;
	const id = `ext-toast-${++nextId}`;
	toasts.value.push({ id, notification });
	// 上限超えたら古いものから削除
	while (toasts.value.length > MAX_TOASTS) {
		toasts.value.shift();
	}
}

function removeToast(id: string) {
	const idx = toasts.value.findIndex(t => t.id === id);
	if (idx >= 0) toasts.value.splice(idx, 1);
}

onMounted(() => {
	window.addEventListener('external-notification', onExternalNotification);
});

onUnmounted(() => {
	window.removeEventListener('external-notification', onExternalNotification);
});
</script>

<style lang="scss" module>
.root {
	position: fixed;
	bottom: 80px; /* Hataskey UI モバイル下部ナビバー / 投稿FAB を避ける */
	right: 16px;
	z-index: 10000;
	display: flex;
	flex-direction: column;
	gap: 8px;
	pointer-events: none; /* コンテナ自体はクリック透過、子のトーストだけ反応 */
}
.root > * {
	pointer-events: auto;
}
@media (max-width: 500px) {
	.root {
		bottom: 90px;
		right: 10px;
		left: 10px;
		max-width: calc(100vw - 20px);
	}
}
</style>
