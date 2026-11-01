<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 旗鯖fork: コンカレントの通知1件を、旗鯖の通知トーストに「外部 · コンカレント」として載せる中身。 -->

<template>
<div :class="$style.root" :data-embedded="embedded" role="link" tabindex="0" @click="open" @keydown.enter.prevent="open">
	<div :class="$style.iconWrap">
		<img v-if="notification.authorAvatarUrl" :src="notification.authorAvatarUrl" :class="$style.avatar" alt="" referrerpolicy="no-referrer"/>
		<span v-else :class="[$style.avatar, $style.icon]" aria-hidden="true"><i :class="typeIcon"></i></span>
	</div>
	<div :class="$style.body">
		<div :class="$style.source"><i class="ti ti-world" aria-hidden="true"></i> {{ i18n.ts._hata._notificationToast.external }}<wbr/><span> · コンカレント</span></div>
		<div :class="$style.title"><b>{{ concrntDisplayName(notification.authorName) }}</b><wbr/><span :class="$style.action">が{{ concrntNotificationLabels[notification.type] }}</span></div>
		<div v-if="notification.emoji || notification.preview" :class="$style.content">
			<span v-if="notification.emoji" :class="$style.reaction"><img :src="notification.emoji.imageUrl" :alt="notification.emoji.shortcode" referrerpolicy="no-referrer"/></span>
			<span v-if="notification.preview" :class="$style.preview">{{ notification.preview }}</span>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';
import { i18n } from '@/i18n.js';
import { mainRouter } from '@/router.js';
import { concrntDisplayName, concrntNotificationLabels } from '@/utility/concrnt/content.js';

const props = withDefaults(defineProps<{ notification: ConcrntNotification; embedded?: boolean }>(), { embedded: true });
const emit = defineEmits<{ close: [] }>();

const typeIcon = computed(() => ({
	reaction: 'ti ti-mood-smile', like: 'ti ti-heart', reply: 'ti ti-arrow-back-up', reroute: 'ti ti-repeat',
	mention: 'ti ti-at', follow: 'ti ti-user-plus', other: 'ti ti-bell',
})[props.notification.type]);

async function open(): Promise<void> {
	emit('close');
	const uri = props.notification.type === 'reply' || props.notification.type === 'mention' ? props.notification.messageUri ?? props.notification.targetUri : props.notification.targetUri ?? props.notification.messageUri;
	if (!uri) { mainRouter.pushByPath('/my/notifications?tab=concrnt'); return; }
	// The connection runtime loads only when a post is actually opened.
	const { openConcrntMessage } = await import('@/utility/concrnt/composer.js');
	await openConcrntMessage(uri);
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	gap: 9px;
	min-width: 0;
	cursor: pointer;
	font-size: 12px;
	line-height: 1.5;

	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; border-radius: 4px; }
}

.root[data-embedded='false'] {
	width: min(340px, calc(100vw - 20px));
	box-sizing: border-box;
	padding: 12px 14px;
	border: 1px solid var(--MI_THEME-divider);
	border-left: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 70%, #4a9eff);
	border-radius: 10px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 6px 20px rgba(0, 0, 0, .15);
	font-size: 13px;
}

.iconWrap {
	position: relative;
	flex-shrink: 0;
	margin: 6px 8px 6px 4px;
}

.avatar {
	display: block;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	object-fit: cover;
}

.icon {
	display: grid;
	place-items: center;
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	color: var(--MI_THEME-accent);
}

.body {
	flex: 1;
	min-width: 0;
}

.source {
	color: var(--MI_THEME-accent);
	font-size: 10px;
	line-height: 1.5;
	word-break: keep-all;
	overflow-wrap: anywhere;
}

.title {
	display: -webkit-box;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	word-break: keep-all;
	overflow-wrap: anywhere;
}

.action {
	font-weight: 400;
	opacity: .85;
}

.content {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 8px;
	min-width: 0;
	margin-top: 5px;
}

.reaction {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	min-width: 36px;
	min-height: 32px;
	padding: 4px 6px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 22%, transparent);
	border-radius: 8px;
	background: var(--MI_THEME-accentedBg);

	img {
		display: block;
		width: auto;
		max-width: 96px;
		height: 24px;
		object-fit: contain;
	}
}

.preview {
	display: -webkit-box;
	flex: 1 1 120px;
	min-width: 0;
	overflow: hidden;
	padding-left: 8px;
	border-left: 2px solid var(--MI_THEME-divider);
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	opacity: .85;
	overflow-wrap: anywhere;
}
</style>
