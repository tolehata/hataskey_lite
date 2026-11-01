<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="el" :class="$style.root">
	<MkMenu :items="items" :align="align" :width="width" :maxWidth="maxWidth" :maxHeight="maxHeight" :asDrawer="false" @close="onChildClosed"/>
</div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, provide, ref, useTemplateRef, watch } from 'vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';
import { getMenuChildPosition } from '@/utility/menu-child-position.js';

const props = defineProps<{
	items: MenuItem[];
	anchorElement: HTMLElement;
	rootElement: HTMLElement;
	width?: number;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'actioned'): void;
}>();

provide('isNestingMenu', true);

const el = useTemplateRef('el');
const align = 'left';

const maxWidth = ref<number>();
const maxHeight = ref<number>();
const visualViewport = window.visualViewport;

function getViewport() {
	return visualViewport ? {
		left: visualViewport.offsetLeft,
		top: visualViewport.offsetTop,
		width: visualViewport.width,
		height: visualViewport.height,
	} : {
		left: 0,
		top: 0,
		width: window.document.documentElement.clientWidth || window.innerWidth,
		height: window.innerHeight,
	};
}

function setPosition() {
	if (el.value == null) return;
	const rootRect = props.rootElement.getBoundingClientRect();
	const parentRect = props.anchorElement.getBoundingClientRect();
	const myRect = el.value.getBoundingClientRect();
	const parent = el.value.offsetParent;
	const positionedParent = parent instanceof HTMLElement && (parent !== window.document.body || window.getComputedStyle(parent).position !== 'static') ? parent : null;
	const origin = positionedParent?.getBoundingClientRect();
	// Convert viewport measurements back into the actual containing block, including
	// fixed popups, scrolled parents and the popup's existing scale animation.
	const scaleX = origin && positionedParent && positionedParent.offsetWidth > 0 ? origin.width / positionedParent.offsetWidth || 1 : 1;
	const scaleY = origin && positionedParent && positionedParent.offsetHeight > 0 ? origin.height / positionedParent.offsetHeight || 1 : 1;
	const position = getMenuChildPosition({ root: rootRect, anchor: parentRect, menu: myRect, viewport: getViewport() });
	const nextMaxWidth = position.maxWidth / scaleX;
	const nextMaxHeight = position.maxHeight / scaleY;
	if (maxWidth.value !== nextMaxWidth || maxHeight.value !== nextMaxHeight) {
		maxWidth.value = nextMaxWidth;
		maxHeight.value = nextMaxHeight;
		// Wrapping changes the measured height, so position only after the size cap applies.
		void nextTick(setPosition);
		return;
	}
	el.value.style.left = `${(position.left - (origin?.left ?? -window.scrollX)) / scaleX + (positionedParent?.scrollLeft ?? 0) - (positionedParent?.clientLeft ?? 0)}px`;
	el.value.style.top = `${(position.top - (origin?.top ?? -window.scrollY)) / scaleY + (positionedParent?.scrollTop ?? 0) - (positionedParent?.clientTop ?? 0)}px`;
}

function onChildClosed(actioned?: boolean) {
	if (actioned) {
		emit('actioned');
	} else {
		emit('closed');
	}
}

const ro = new ResizeObserver(setPosition);
const parentStyleObserver = new MutationObserver(setPosition);
let motionParent: HTMLElement | null = null;

function onParentTransitionEnd(event: Event) {
	if (event.target === motionParent) setPosition();
}

function unobserveParentMotion() {
	parentStyleObserver.disconnect();
	motionParent?.removeEventListener('transitionend', onParentTransitionEnd);
	motionParent?.removeEventListener('transitioncancel', onParentTransitionEnd);
	motionParent = null;
}

function observeElements() {
	ro.disconnect();
	if (el.value) ro.observe(el.value);
	ro.observe(props.rootElement);
	ro.observe(props.anchorElement);
	unobserveParentMotion();
	const parent = el.value?.offsetParent;
	motionParent = parent instanceof HTMLElement ? parent : null;
	// An outer submenu can move without changing size (for example after async items load).
	if (motionParent) parentStyleObserver.observe(motionParent, { attributes: true, attributeFilter: ['style'] });
	// ResizeObserver does not fire when a popup's scale transition finishes.
	motionParent?.addEventListener('transitionend', onParentTransitionEnd, { passive: true });
	motionParent?.addEventListener('transitioncancel', onParentTransitionEnd, { passive: true });
}

watch([() => props.anchorElement, () => props.rootElement], () => {
	observeElements();
	setPosition();
}, { flush: 'post' });

onMounted(() => {
	observeElements();
	window.addEventListener('resize', setPosition, { passive: true });
	window.document.addEventListener('scroll', setPosition, { passive: true, capture: true });
	visualViewport?.addEventListener('resize', setPosition, { passive: true });
	visualViewport?.addEventListener('scroll', setPosition, { passive: true });
	setPosition();
});

onUnmounted(() => {
	ro.disconnect();
	unobserveParentMotion();
	window.removeEventListener('resize', setPosition);
	window.document.removeEventListener('scroll', setPosition, true);
	visualViewport?.removeEventListener('resize', setPosition);
	visualViewport?.removeEventListener('scroll', setPosition);
});

defineExpose({
	checkHit: (ev: MouseEvent) => {
		return (ev.target === el.value || el.value?.contains(ev.target as Node));
	},
});
</script>

<style lang="scss" module>
.root {
	position: absolute;
	width: max-content;
}
</style>
