<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: 選んだショートカットを起点に出す、一度きりの案内の吹き出し。
body 直下へ出して他の要素に隠れないようにし、画面端では内側へ寄せる・上に入らなければ下へ回す。
-->
<template>
<Teleport to="body">
	<div
		ref="bubbleEl"
		:class="$style.bubble"
		:data-side="side"
		:style="{ ...palette, zIndex, left: `${pos.left}px`, top: `${pos.top}px`, '--hk3-tail-x': `${pos.tailX}px`, visibility: pos.ready ? 'visible' : 'hidden' }"
		role="dialog"
		aria-live="polite"
	>
		<p :class="$style.text">{{ text }}</p>
		<button type="button" :class="$style.ok" @click="emit('close')">{{ okLabel }}</button>
	</div>
</Teleport>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import * as os from '@/os.js';

const props = defineProps<{
	anchor: HTMLElement;
	text: string;
	okLabel: string;
}>();

const emit = defineEmits<{
	(ev: 'close'): void;
}>();

const MARGIN = 12;
const GAP = 10;
const bubbleEl = shallowRef<HTMLElement | null>(null);
const side = ref<'top' | 'bottom'>('top');
const pos = reactive({ left: 0, top: 0, tailX: 0, ready: false });
const zIndex = os.claimZIndex('high');

// 吹き出しは UI3 のルート外に出るため、起点の色トークンを引き継ぐ。
const anchorStyle = window.getComputedStyle(props.anchor);
const palette = Object.fromEntries(['--hk3-bg', '--hk3-text', '--hk3-accent', '--hk3-shadow-lg']
	.map(name => [name, anchorStyle.getPropertyValue(name).trim()])
	.filter(([, value]) => value !== ''));

function place() {
	const bubble = bubbleEl.value;
	if (!bubble || !props.anchor.isConnected) return;
	const rect = props.anchor.getBoundingClientRect();
	const width = bubble.offsetWidth;
	const height = bubble.offsetHeight;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const center = rect.left + rect.width / 2;
	const left = Math.max(MARGIN, Math.min(vw - width - MARGIN, center - width / 2));
	const fitsAbove = rect.top - GAP - height >= MARGIN;
	side.value = fitsAbove || rect.bottom + GAP + height > vh - MARGIN ? 'top' : 'bottom';
	const top = side.value === 'top' ? Math.max(MARGIN, rect.top - GAP - height) : rect.bottom + GAP;
	pos.left = left;
	pos.top = top;
	pos.tailX = Math.max(14, Math.min(width - 14, center - left));
	pos.ready = true;
}

function onPointerDown(ev: PointerEvent) {
	const target = ev.target as Node | null;
	if (target && (bubbleEl.value?.contains(target) || props.anchor.contains(target))) return;
	emit('close');
}

function onKeydown(ev: KeyboardEvent) {
	if (ev.key === 'Escape') emit('close');
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
	await nextTick();
	place();
	window.addEventListener('resize', place, { passive: true });
	window.addEventListener('scroll', place, { passive: true, capture: true });
	window.document.addEventListener('pointerdown', onPointerDown, true);
	window.document.addEventListener('keydown', onKeydown);
	resizeObserver = new ResizeObserver(place);
	resizeObserver.observe(props.anchor);
	if (bubbleEl.value) resizeObserver.observe(bubbleEl.value);
});

onBeforeUnmount(() => {
	window.removeEventListener('resize', place);
	window.removeEventListener('scroll', place, { capture: true });
	window.document.removeEventListener('pointerdown', onPointerDown, true);
	window.document.removeEventListener('keydown', onKeydown);
	resizeObserver?.disconnect();
});
</script>

<style lang="scss" module>
.bubble {
	position: fixed;
	box-sizing: border-box;
	width: max-content;
	max-width: min(300px, calc(100vw - 24px));
	padding: 12px 14px;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;
	background: var(--hk3-text, #221d19);
	color: var(--hk3-bg, #f7f4f1);
	box-shadow: var(--hk3-shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.2));
	font-size: 13px;
	line-height: 1.6;
	animation: hk3GuideIn 360ms cubic-bezier(0.22, 1, 0.36, 1);

	&::after {
		content: '';
		position: absolute;
		left: calc(var(--hk3-tail-x) - 7px);
		width: 14px;
		height: 7px;
		background: inherit;
	}

	&[data-side="top"]::after { top: 100%; clip-path: polygon(0 0, 100% 0, 50% 100%); }
	&[data-side="bottom"]::after { bottom: 100%; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
}

@keyframes hk3GuideIn {
	from { opacity: 0; transform: translateY(6px); }
	to { opacity: 1; transform: none; }
}

.text {
	margin: 0;
	font-weight: 700;
	overflow-wrap: anywhere;
}

.ok {
	align-self: flex-end;
	height: 28px;
	padding: 0 12px;
	border: 0;
	background: var(--hk3-accent, #e56b0a);
	color: var(--hk3-bg, #f7f4f1);
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	font-weight: 800;
}

@media (prefers-reduced-motion: reduce) {
	.bubble { animation: none; }
}
</style>
