<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root">
	<div :id="contentId" ref="viewport" data-note-content-viewport :class="$style.viewport" :data-collapsed="collapsible && hasOverflow && !expanded ? 'true' : undefined" @focusin="onContentFocus" @transitionend="onTransitionEnd">
		<div ref="content" :class="$style.content"><slot/></div>
	</div>
	<button v-if="collapsible && hasOverflow" type="button" :class="$style.toggle" :aria-controls="contentId" :aria-expanded="expanded" @click.stop="toggle">
		{{ expanded ? i18n.ts.showLess : i18n.ts.showMore }}
	</button>
</div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{ collapsible: boolean; animationEnabled: boolean }>();
const viewport = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const expanded = ref(!props.collapsible);
const hasOverflow = ref(props.collapsible);
const contentId = useId();
let observer: ResizeObserver | undefined;
let motionQuery: MediaQueryList | undefined;
let animating = false;
let mounted = false;

function canAnimate(): boolean {
	return props.animationEnabled && !motionQuery?.matches;
}

function collapsedHeight(element: HTMLElement): number {
	const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
	return (Number.isFinite(fontSize) ? fontSize : 16) * 9;
}

function measureOverflow(): void {
	if (props.collapsible && viewport.value && content.value) {
		hasOverflow.value = content.value.scrollHeight > collapsedHeight(viewport.value) + 1;
	} else {
		hasOverflow.value = false;
	}
}

function settle(): void {
	animating = false;
	if (viewport.value) {
		viewport.value.style.maxHeight = 'none';
		viewport.value.style.height = expanded.value || !hasOverflow.value ? 'auto' : `${collapsedHeight(viewport.value)}px`;
	}
}

function setExpanded(value: boolean, animate = true): void {
	const element = viewport.value;
	const inner = content.value;
	if (expanded.value === value && !animating) {
		settle();
		return;
	}
	if (!element || !inner) {
		expanded.value = value;
		return;
	}
	const start = element.getBoundingClientRect().height;
	expanded.value = value;
	if (!animate || !canAnimate()) {
		settle();
		return;
	}
	const end = value ? inner.scrollHeight : Math.min(inner.scrollHeight, collapsedHeight(element));
	if (!Number.isFinite(end) || Math.abs(start - end) < 1) {
		settle();
		return;
	}
	// A measured pixel height lets CSS animate in both directions, including reversals.
	element.style.height = `${start}px`;
	void element.offsetHeight;
	animating = true;
	element.style.height = `${end}px`;
}

function toggle(): void {
	setExpanded(!expanded.value);
}

function onContentFocus(event: FocusEvent): void {
	if (!props.collapsible || !hasOverflow.value || expanded.value || !viewport.value) return;
	const target = event.target;
	if (!(target instanceof HTMLElement)) return;
	if (target.getBoundingClientRect().bottom > viewport.value.getBoundingClientRect().bottom) setExpanded(true);
}

function onTransitionEnd(event: TransitionEvent): void {
	if (event.target === viewport.value && event.propertyName === 'height') settle();
}

function onContentResize(): void {
	const hadOverflow = hasOverflow.value;
	measureOverflow();
	if (!hasOverflow.value && animating) {
		settle();
		return;
	}
	if (!animating && (!expanded.value || hadOverflow !== hasOverflow.value)) settle();
	if (animating && viewport.value && content.value) {
		const target = expanded.value ? content.value.scrollHeight : Math.min(content.value.scrollHeight, collapsedHeight(viewport.value));
		viewport.value.style.height = `${target}px`;
	}
}

function onMotionChange(): void {
	if (!canAnimate()) settle();
}

function observeCandidate(): void {
	observer?.disconnect();
	observer = undefined;
	if (props.collapsible && typeof ResizeObserver !== 'undefined' && content.value) {
		observer = new ResizeObserver(onContentResize);
		observer.observe(content.value);
	}
}

function observeMotionPreference(): void {
	motionQuery?.removeEventListener('change', onMotionChange);
	motionQuery = undefined;
	if (props.collapsible && typeof window.matchMedia === 'function') {
		motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		motionQuery.addEventListener('change', onMotionChange);
	}
}

watch(() => props.collapsible, enabled => {
	if (!mounted) return;
	observeCandidate();
	observeMotionPreference();
	measureOverflow();
	// A settings change re-applies the default; keep an already focused control visible.
	setExpanded(!enabled || !!content.value?.contains(window.document.activeElement), false);
});
watch(() => props.animationEnabled, onMotionChange);

onMounted(() => {
	mounted = true;
	observeCandidate();
	measureOverflow();
	settle();
	observeMotionPreference();
});

onBeforeUnmount(() => {
	mounted = false;
	observer?.disconnect();
	motionQuery?.removeEventListener('change', onMotionChange);
});
</script>

<style lang="scss" module>
.root { min-width: 0; }

.viewport {
	overflow: clip;
	transition: height 360ms cubic-bezier(0.22, 1, 0.36, 1);
	&[data-collapsed] {
		max-height: 9em;
		-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 36px), transparent 100%);
		mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 36px), transparent 100%);
	}
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--hk3-note-content-gap, calc(8px * var(--hk3-ui-scale, 1)));
}

.toggle {
	display: block;
	width: 100%;
	margin-top: 4px;
	padding: 8px 12px;
	border: 0;
	border-radius: 10px;
	background: color-mix(in srgb, var(--hk3-accent) 8%, transparent);
	color: var(--hk3-accent);
	cursor: pointer;
	text-align: center;
	font: inherit;
	&:hover { background: color-mix(in srgb, var(--hk3-accent) 14%, transparent); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

@media (prefers-reduced-motion: reduce) {
	.viewport { transition: none; }
}
</style>
