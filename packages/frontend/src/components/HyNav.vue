<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<nav
	ref="surface"
	:class="$style.surface"
	:data-notice="integrated && showing"
	:style="{ width: leaving && heldWidth ? `${heldWidth}px` : undefined }"
	:data-leaving="leaving"
	:data-motion="notificationSurface.animations.value"
	aria-label="Hatady"
	@pointerenter="hovered = $event.pointerType === 'mouse'"
	@pointerleave="hovered = false"
	@pointercancel="hovered = false"
	@focusin="onFocusIn"
	@focusout="onFocusOut"
>
	<div v-if="integrated && showing" :class="$style.bloom" aria-hidden="true">
		<svg :viewBox="viewBox">
			<path v-for="path in paths" :key="path" :d="path" pathLength="100" :style="{ strokeDashoffset: progress }"/>
		</svg>
	</div>
	<HyCapsule
		:modelValue="modelValue"
		:options="options"
		label="Hatady"
		:sliding="sliding"
		:class="$style.tabs"
		@update:modelValue="emit('update:modelValue', $event)"
	>
		<template v-if="$slots.icon" #icon="{ option }"><slot name="icon" :option="option"/></template>
	</HyCapsule>
	<div ref="host" :class="$style.host" :style="{ height: integrated && showing ? `${noticeHeight}px` : '0px' }"></div>
	<MkHataskeyNotificationToasts v-if="!preview && !inherited && active" :context="context" :receiveExternal="ownsSurface"/>
</nav>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import HyCapsule from '@/components/HyCapsule.vue';
import { hatadyDialogSurfaces, hatadyNotice } from '@/utility/hatady-ui.js';
import { prefer } from '@/preferences.js';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import { createHataskeyNotificationToasts, hataskeyNotificationToastsKey, NOTIFICATION_TOAST_DURATION, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';

const props = defineProps<{ modelValue: string; options: ReadonlyArray<{ value: string; label: string; icon: string }>; preview?: boolean; sliding?: boolean }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const surface = useTemplateRef('surface'),
	host = useTemplateRef('host');
const noticeHeight = ref(64);
const leaving = ref(false),
	hovered = ref(false),
	focused = ref(false),
	showing = ref(false),
	heldWidth = ref(0);
const active = ref(true), visible = ref(true);
const size = ref({ width: 300, height: 56 });
const reduced = ref(false);
// Preview mode is fixed for this mounted instance; receiver ownership must not switch.
const preview = props.preview === true;
const inherited = preview ? null : inject(hataskeyNotificationToastsKey, null);
const context = inherited ?? createHataskeyNotificationToasts(computed(() => false), computed(() => false));
const dialogTarget = computed(() => active.value
	? hatadyDialogSurfaces.value.findLast(element => element.isConnected && !element.closest('[inert]')) ?? null
	: null);
const target = computed(() => dialogTarget.value ?? host.value);
const notificationSurface = {
	active: computed(() => active.value && (visible.value || !!dialogTarget.value)),
	target,
	outline: surface,
	animations: computed(() => prefer.r.animation.value && !reduced.value),
	paused: computed(() => hovered.value || focused.value),
};
const ownsSurface = computed(() => context.surface.value === notificationSurface);
const integrated = computed(() => ownsSurface.value && !dialogTarget.value);
const notice = computed(() => ownsSurface.value ? context.items.value[0] : undefined);
const unregisterSurface = preview ? () => {} : context.registerSurface(notificationSurface);
const unregisterReceiver = preview ? () => {} : registerNotificationPageContext(context, () => ownsSurface.value);
const lastProgress = ref(100);
const progress = computed(() => reduced.value || !prefer.r.animation.value ? 0 : notice.value
	? 100 * (1 - notice.value.elapsed / NOTIFICATION_TOAST_DURATION)
	: lastProgress.value);
const viewBox = computed(() => `0 0 ${size.value.width} ${size.value.height}`);
const paths = computed(() => {
	const { width: w, height: h } = size.value,
		right = w - 1,
		bottom = h - 1,
		r = Math.min(23, (w - 2) / 2, (h - 2) / 2);
	return [
		`M ${w / 2} 1 H ${right - r} A ${r} ${r} 0 0 1 ${right} ${1 + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${w / 2}`,
		`M ${w / 2} 1 H ${1 + r} A ${r} ${r} 0 0 0 1 ${1 + r} V ${bottom - r} A ${r} ${r} 0 0 0 ${1 + r} ${bottom} H ${w / 2}`,
	];
});
let finish: number | undefined;
let resize: ResizeObserver | undefined,
	intersection: IntersectionObserver | undefined,
	motion: MediaQueryList | undefined;
let widthAnimation: Animation | undefined;
let widthRevision = 0;

function cancelWidthAnimation(): void {
	widthRevision++;
	widthAnimation?.cancel();
	widthAnimation = undefined;
}

function animateWidthChange(): void {
	const element = surface.value;
	const from = element?.getBoundingClientRect().width;
	cancelWidthAnimation();
	const revision = widthRevision;
	nextTick(() => {
		if (!element?.isConnected || revision !== widthRevision || !from || reduced.value || !prefer.r.animation.value) return;
		const to = element.getBoundingClientRect().width;
		if (from <= to + 0.5 || !element.animate) return;
		// Both widths are measured around Vue's content removal. The underlying
		// max-content layout is already final; no fixed inline width survives.
		const animation = element.animate([{ width: `${from}px` }, { width: `${to}px` }], {
			duration: 350,
			easing: 'cubic-bezier(.22,1,.36,1)',
		});
		widthAnimation = animation;
		animation.onfinish = () => {
			if (widthAnimation === animation) widthAnimation = undefined;
		};
	});
}

function measure(): void {
	const rect = surface.value?.getBoundingClientRect();
	if (rect) size.value = { width: Math.max(2, rect.width), height: Math.max(2, rect.height) };
}

function onFocusIn(event: FocusEvent): void {
	focused.value = event.target instanceof Element && event.target.matches(':focus-visible');
}

function onFocusOut(event: FocusEvent): void {
	focused.value = event.relatedTarget instanceof Element && !!surface.value?.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible');
}

function onVisibility(): void {
	if (window.document.hidden) { hovered.value = false; focused.value = false; }
}

function onMotion(): void {
	reduced.value = motion?.matches ?? false;
}

// Hatady's existing status callers share the same queue and host as received
// notifications. Consume once; an inactive kept-alive page must not replay it.
watch(hatadyNotice, value => {
	if (props.preview || !value || !active.value) return;
	context.enqueueStatus(value.message);
	hatadyNotice.value = null;
}, { immediate: true });
watch(() => notice.value?.id, (id, oldId) => {
	window.clearTimeout(finish);
	if (id != null) {
		cancelWidthAnimation();
		leaving.value = false;
		heldWidth.value = 0;
		showing.value = true;
	} else if (oldId != null && showing.value) {
		// Hold the measured outline through the shared card's exit, then release
		// its intrinsic width with the same soft shrink used by the capsule.
		heldWidth.value = surface.value?.getBoundingClientRect().width ?? 0;
		leaving.value = true;
		if (surface.value?.contains(window.document.activeElement)) surface.value.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
		finish = window.setTimeout(() => {
			showing.value = false;
			leaving.value = false;
			heldWidth.value = 0;
			// Queue Vue's update first; the DOM still supplies the held width now,
			// and nextTick must measure the released width after that update.
			animateWidthChange();
		}, reduced.value || !prefer.r.animation.value ? 0 : 550);
	}
	nextTick(measure);
}, { immediate: true });
watch(() => notice.value?.elapsed, elapsed => {
	if (elapsed != null) lastProgress.value = 100 * (1 - elapsed / NOTIFICATION_TOAST_DURATION);
});
watch(context.height, height => {
	if (height > 0) noticeHeight.value = height;
	nextTick(measure);
}, { immediate: true });
watch(target, () => {
	hovered.value = false;
	focused.value = false;
	nextTick(measure);
});
watch(() => reduced.value || !prefer.r.animation.value, disabled => {
	if (disabled) cancelWidthAnimation();
});

function onResize(): void {
	cancelWidthAnimation();
	heldWidth.value = 0;
	measure();
}

onMounted(() => {
	motion = matchMedia('(prefers-reduced-motion: reduce)');
	onMotion();
	motion.addEventListener('change', onMotion);
	window.addEventListener('resize', onResize);
	window.document.addEventListener('visibilitychange', onVisibility);
	resize = new ResizeObserver(measure);
	if (surface.value) resize.observe(surface.value);
	intersection = new IntersectionObserver(entries => {
		visible.value = entries.some(entry => entry.isIntersecting);
	});
	if (surface.value) intersection.observe(surface.value);
});
onActivated(() => { active.value = true; });
onDeactivated(() => {
	active.value = false;
	if (!props.preview) hatadyNotice.value = null;
	hovered.value = false;
	focused.value = false;
});
onUnmounted(() => {
	unregisterReceiver();
	unregisterSurface();
	cancelWidthAnimation();
	window.clearTimeout(finish);
	resize?.disconnect();
	intersection?.disconnect();
	window.removeEventListener('resize', onResize);
	window.document.removeEventListener('visibilitychange', onVisibility);
	motion?.removeEventListener('change', onMotion);
});
</script>

<style lang="scss" module>
.surface {
	position: relative;
	isolation: isolate;
	box-sizing: border-box;
	width: max-content;
	max-width: 100%;
	border: 1px solid var(--hy-border);
	border-radius: 28px;
	background: var(--hy-surface);
	box-shadow: var(--hy-shadow);
}
.tabs {
	width: auto;
	border: 0;
	box-shadow: none;
	background: transparent;
}
/* Keep the capsule geometry fixed while giving transparent marks more room. */
.tabs > button > [data-hata-feature] { transform: scale(1.2); }
.tabs > button[data-active='false'] > [data-hata-feature] { transform: scale(1.4); }
.tabs > button[data-active='false'] > i { transform: scale(1.2); }
@container hatady (max-width: 600px) {
	.surface {
		width: 100%;
		min-width: 0;
	}
	.tabs {
		box-sizing: border-box;
		width: 100%;
		padding: 4px;
	}
	.tabs > button[data-active] {
		box-sizing: border-box;
		flex: 0 0 44px;
		flex-direction: row;
		gap: 4px;
		padding-inline: 4px;
		font-size: 14px;
	}
	.tabs > button[data-active='true'] {
		flex: 1 1 0;
		min-width: 0;
	}
	.tabs > button > span:not([data-hata-feature]) {
		min-width: 0;
		max-width: calc(100% - 24px);
	}
}
@container hatady (max-width: 380px) {
	.tabs {
		gap: 2px;
	}
	.tabs > button[data-active] {
		padding-inline: 2px;
		font-size: 12px;
	}
}
.host {
	height: 0;
	overflow: hidden;
	transition: height 0.35s ease;
}
/* HyNav supplies its own outline so the glow survives the card's exit. */
.surface > svg[data-integrated='true'] {
	display: none;
}
.bloom {
	position: absolute;
	inset: 0;
	border-radius: inherit;
	z-index: -1;
	pointer-events: none;
	opacity: 1;
	transition: opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}
.bloom::after {
	content: '';
	position: absolute;
	inset: 0;
	border-radius: inherit;
	background: var(--hy-surface);
}
.bloom svg {
	position: absolute;
	width: 100%;
	height: 100%;
	overflow: visible;
	fill: none;
	stroke: var(--hy-accent);
	stroke-width: 40;
	stroke-linecap: round;
	filter: blur(14px);
	opacity: 0.55;
	transition: filter 0.55s ease;
}
.bloom path {
	stroke-dasharray: 100;
	transition: stroke-dashoffset 0.1s linear;
}
.surface[data-leaving='true'] .bloom {
	opacity: 0;
}
.surface[data-leaving='true'] .bloom svg {
	filter: blur(20px);
}
.surface[data-motion='false'] {
	.host,
	.bloom,
	.bloom svg,
	.bloom path {
		transition: none;
	}
}
@media (prefers-reduced-motion: reduce) {
	.host,
	.bloom,
	.bloom svg,
	.bloom path {
		transition: none;
	}
}
</style>
