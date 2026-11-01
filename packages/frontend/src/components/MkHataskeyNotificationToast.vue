<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<article ref="root" :class="$style.card" :data-integrated="integrated" :data-toast-id="item.id" :data-navbar-notice="item.source === 'status' && !!item.navbarNotice" :data-blur="prefer.r.useBlurEffect.value" @pointerenter="onPointerEnter" @pointerleave="hovered = false" @pointercancel="hovered = false" @focusin="onFocusIn" @focusout="onFocusOut">
	<MkHataskeyNavbarNotice v-if="item.source === 'status' && item.navbarNotice" :notice="item.navbarNotice" :motion="motion"/>
	<div v-else-if="item.source === 'status'" :class="$style.status">
		<template v-if="item.favoriteSaved">
			<MkFavoriteSavedAnimation :motion="motion"/>
			<span :class="$style.favoriteMessage">{{ item.message }}</span>
		</template>
		<template v-else-if="item.welcomeUser">
			<MkAvatar :class="$style.welcomeAvatar" :user="item.welcomeUser" forceOpacity isToastAvatar/>
			<Mfm :class="$style.welcomeMessage" :text="item.message" :plain="true"/>
		</template>
		<template v-else><MkHataskeyNoticeIcon icon="ti ti-circle-check" :animations="motion"/>{{ item.message }}</template>
	</div>
	<MkExternalNotificationToast v-else-if="item.source === 'external'" :notification="item.notification" :sourceHost="item.host" embedded @close="emit('close')"/>
	<ConcrntNotificationToast v-else-if="item.source === 'concrnt'" :notification="item.notification" embedded @close="emit('close')"/>
	<MkNotification v-else :notification="item.notification" :contentVisibilityAuto="false" toast/>
	<button class="_button" :class="$style.close" :aria-label="i18n.ts.close" @click="emit('close')"><i class="ti ti-x" aria-hidden="true"></i></button>
	<MkNotificationToastRing v-if="!integrated" :target="root" :elapsed="item.elapsed" :duration="getToastDuration(item)" :integrated="false" :motion="motion"/>
</article>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { HataskeyToast } from '@/utility/hataskey-notification-toast.js';
import { getToastDuration } from '@/utility/hataskey-notification-toast.js';
import MkNotification from '@/components/MkNotification.vue';
import MkExternalNotificationToast from '@/components/MkExternalNotificationToast.vue';
import ConcrntNotificationToast from '@/components/concrnt/ConcrntNotificationToast.vue';
import MkNotificationToastRing from '@/components/MkNotificationToastRing.vue';
import MkFavoriteSavedAnimation from '@/components/MkFavoriteSavedAnimation.vue';
import MkHataskeyNavbarNotice from '@/components/MkHataskeyNavbarNotice.vue';
import MkHataskeyNoticeIcon from '@/components/MkHataskeyNoticeIcon.vue';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{ item: HataskeyToast; integrated: boolean; motion: boolean }>();
const emit = defineEmits<{ close: []; pause: [paused: boolean]; resize: [height: number] }>();
const root = ref<HTMLElement | null>(null);
const hovered = ref(false);
const focused = ref(false);
watch(() => hovered.value || focused.value, paused => emit('pause', paused));

function onPointerEnter(event: PointerEvent) {
	// Touch generates pointerenter too, but must never hold the countdown open.
	hovered.value = event.pointerType === 'mouse';
}

function onFocusIn(event: FocusEvent) {
	focused.value = event.target instanceof Element && event.target.matches(':focus-visible');
}

function onFocusOut(event: FocusEvent) {
	focused.value = event.relatedTarget instanceof Element && !!root.value?.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible');
}

function onVisibilityChange() {
	if (window.document.hidden) { hovered.value = false; focused.value = false; }
}

const observer = new ResizeObserver(() => {
	if (root.value) emit('resize', root.value.getBoundingClientRect().height);
});
onMounted(() => {
	if (root.value) observer.observe(root.value);
	window.document.addEventListener('visibilitychange', onVisibilityChange);
});
onUnmounted(() => {
	observer.disconnect();
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<style module lang="scss">
.status { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0; min-height: 44px; }
.welcomeAvatar { flex: none; width: 36px; height: 36px; }
.welcomeMessage { min-width: 0; }
.favoriteMessage { min-width: 0; }
.card {
	position: relative;
	box-sizing: border-box;
	width: 100%;
	min-width: 0;
	padding: 10px 48px 10px 12px;
	border-radius: 16px;
	color: var(--hata-toast-fg, var(--MI_THEME-fg));
	background: var(--MI_THEME-panel);
	box-shadow: 0 8px 28px #0002, inset 0 0 0 1px var(--MI_THEME-divider);
	word-break: keep-all;
	line-break: strict;
	overflow-wrap: anywhere;
	text-wrap: pretty;
	pointer-events: auto;
	&[data-blur='true'][data-integrated='false'] {
		background: color-mix(in srgb, var(--MI_THEME-panel) 88%, transparent);
		backdrop-filter: blur(24px) saturate(1.4);
	}
	&[data-integrated='true'] { background: transparent; box-shadow: none; border-radius: 0; }
	&[data-navbar-notice='true'] { container: hataskey-notice / inline-size; padding-inline: 48px; }
	&[data-navbar-notice='true']:has([data-navbar-notice-kind='noteAction']) { padding: 10px 48px 10px 12px; }
}
.close {
	position: absolute;
	top: 50%;
	right: 3px;
	transform: translateY(-50%);
	width: 44px;
	height: 44px;
	display: grid;
	place-items: center;
	border-radius: 50%;
	color: var(--hata-toast-muted, var(--MI_THEME-fgMuted));
	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -3px; }
}
@container hataskey-navbar (max-width: 360px) {
	.card[data-navbar-notice='true'] { padding-inline: 28px; }
	.card[data-navbar-notice='true'] .close { justify-items: end; }
}
</style>
