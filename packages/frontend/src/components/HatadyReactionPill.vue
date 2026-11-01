<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<button
	ref="buttonEl"
	type="button"
	:disabled="disabled"
	:aria-pressed="pressed"
	:aria-label="`${reaction} ${count} ${actionLabel}`"
	@click.stop="onClick"
	@touchstart.stop.passive="onTouchStart"
	@touchmove.passive="onTouchMove"
	@touchend.stop="gesture.end()"
	@touchcancel.stop="gesture.cancel()"
	@contextmenu="onContextMenu"
	@focus="onFocus"
	@blur="hideFocusDetails"
>
	<MkReactionIcon style="pointer-events: none;" :class="$style.icon" :reaction="reaction"/>
	<span :class="$style.count">{{ count }}</span>
</button>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import type { Ref } from 'vue';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import HatadyReactionDetails from '@/components/HatadyReactionDetails.vue';
import { useTooltip } from '@/composables/use-tooltip.js';
import { ReactionTouchGesture } from '@/utility/reaction-touch-gesture.js';
import { getHatadyReactionUsers } from '@/utility/hatady-reaction-details.js';
import type { HatadyReactionTarget } from '@/utility/hatady-reaction-details.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const popup = useHataGoesPopup();

const props = withDefaults(defineProps<{
	target: HatadyReactionTarget;
	reaction: string;
	count: number;
	pressed: boolean;
	actionLabel: string;
	disabled?: boolean;
	variant?: HatadySurfaceVariant;
}>(), { disabled: false, variant: 'hatady' });
const emit = defineEmits<{ (ev: 'activate'): void }>();
const buttonEl = useTemplateRef('buttonEl');
const popupShowing = ref(false);
let popupOpened = false;
const reasons = new Map<Ref<boolean>, () => void>();

function refreshPopupShowing() {
	if (!popupOpened) return;
	popupShowing.value = [...reasons.keys()].some(reason => reason.value);
	if (!popupShowing.value) popupOpened = false;
}

function registerReason(reason: Ref<boolean>) {
	if (reasons.has(reason)) return;
	const stop = watch(reason, value => {
		if (!value) {
			reasons.get(reason)?.();
			reasons.delete(reason);
			refreshPopupShowing();
		}
	}, { flush: 'sync' });
	reasons.set(reason, stop);
}

async function showDetails(showing: Ref<boolean>) {
	registerReason(showing);
	if (popupShowing.value) return;
	try {
		const target = JSON.stringify(props.target);
		const reaction = props.reaction;
		const users = await getHatadyReactionUsers(props.target, props.reaction);
		if (![...reasons.keys()].some(reason => reason.value) || buttonEl.value == null || !buttonEl.value.isConnected || target !== JSON.stringify(props.target) || reaction !== props.reaction || popupShowing.value) return;
		popupShowing.value = true;
		popupOpened = true;
		const { dispose } = popup(HatadyReactionDetails, {
			showing: popupShowing,
			anchorElement: buttonEl.value,
			reaction: props.reaction,
			users,
			count: props.count,
			variant: props.variant,
		}, { closed: () => { popupOpened = false; popupShowing.value = false; dispose(); } });
	} catch {
		// Details are optional; a failed read must not block the button action.
	}
}

let touchShowing: Ref<boolean> | null = null;
const gesture = new ReactionTouchGesture({
	showDetails: () => {
		touchShowing = ref(true);
		void showDetails(touchShowing);
	},
	hideDetails: () => {
		if (touchShowing != null) touchShowing.value = false;
		touchShowing = null;
	},
	showMenu: () => {},
});

function touchPoint(event: TouchEvent) {
	const touch = event.touches.item(0) ?? event.changedTouches.item(0);
	return touch == null ? null : { x: touch.clientX, y: touch.clientY };
}

function onTouchStart(event: TouchEvent) {
	const point = touchPoint(event);
	if (point == null || event.touches.length !== 1) gesture.cancel();
	else gesture.start(point);
}

function onTouchMove(event: TouchEvent) {
	const point = touchPoint(event);
	if (point != null) gesture.move(point);
}

function onClick(event: MouseEvent) {
	if (gesture.consumeSyntheticClick()) {
		event.preventDefault();
		return;
	}
	if (!props.disabled) emit('activate');
}

function onContextMenu(event: MouseEvent) {
	if (!gesture.shouldBlockContextMenu()) return;
	event.preventDefault();
	event.stopPropagation();
}

let focusShowing: Ref<boolean> | null = null;

function onFocus() {
	if (!buttonEl.value?.matches(':focus-visible')) return;
	hideFocusDetails();
	focusShowing = ref(true);
	void showDetails(focusShowing);
}

function hideFocusDetails() {
	if (focusShowing != null) focusShowing.value = false;
	focusShowing = null;
}

useTooltip(buttonEl, showing => { void showDetails(showing); }, 100);
onBeforeUnmount(() => {
	popupShowing.value = false;
	popupOpened = false;
	for (const stop of reasons.values()) stop();
	reasons.clear();
	hideFocusDetails();
	gesture.dispose();
});
</script>

<style lang="scss" module>
/* 旗鯖fork(Hatady): 大きさは置き場所の側が --hy-reaction-icon-size で決める（UI S の記録カード）。未指定の面は従来の 1.3em。 */
.icon { height: var(--hy-reaction-icon-size, 1.3em); }
.count { line-height: 1; }
</style>
