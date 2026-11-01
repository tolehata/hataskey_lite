<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: 押した要素を起点に出す、小さな確認の吹き出し(はい/いいえ)。
body 直下へ出して他の要素に隠れないようにし、画面端では内側へ寄せる・上に入らなければ下へ回す。
-->
<template>
<Teleport to="body">
	<div
		ref="bubbleEl"
		:class="$style.bubble"
		:data-side="side"
		:style="{ ...palette, zIndex, left: `${pos.left}px`, top: `${pos.top}px`, '--hk3-tail-x': `${pos.tailX}px`, visibility: pos.ready ? 'visible' : 'hidden' }"
		role="alertdialog"
		:aria-label="text"
	>
		<p :class="$style.text">{{ text }}</p>
		<div :class="$style.actions">
			<button type="button" :class="$style.cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
			<button ref="okEl" type="button" :class="$style.ok" @click="emit('ok')">{{ okLabel }}</button>
		</div>
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
	cancelLabel: string;
}>();

const emit = defineEmits<{
	(ev: 'ok'): void;
	(ev: 'cancel'): void;
}>();

const MARGIN = 10;
const GAP = 8;
const bubbleEl = shallowRef<HTMLElement | null>(null);
const okEl = shallowRef<HTMLElement | null>(null);
const side = ref<'top' | 'bottom'>('top');
const pos = reactive({ left: 0, top: 0, tailX: 0, ready: false });
const zIndex = os.claimZIndex('high');

// 吹き出しは UI3 のルート外に出るため、起点の色トークンを引き継ぐ。
const anchorStyle = window.getComputedStyle(props.anchor);
const palette = Object.fromEntries(['--hk3-bg', '--hk3-text', '--hk3-accent', '--hk3-divider', '--hk3-shadow-lg']
	.map(name => [name, anchorStyle.getPropertyValue(name).trim()])
	.filter(([, value]) => value !== ''));

function place() {
	const bubble = bubbleEl.value;
	if (!bubble || !props.anchor.isConnected) {
		emit('cancel');
		return;
	}
	const rect = props.anchor.getBoundingClientRect();
	const width = bubble.offsetWidth;
	const height = bubble.offsetHeight;
	const center = rect.left + rect.width / 2;
	const left = Math.max(MARGIN, Math.min(window.innerWidth - width - MARGIN, center - width / 2));
	const fitsAbove = rect.top - GAP - height >= MARGIN;
	side.value = fitsAbove || rect.bottom + GAP + height > window.innerHeight - MARGIN ? 'top' : 'bottom';
	pos.left = left;
	pos.top = side.value === 'top' ? Math.max(MARGIN, rect.top - GAP - height) : rect.bottom + GAP;
	pos.tailX = Math.max(12, Math.min(width - 12, center - left));
	pos.ready = true;
}

function onPointerDown(ev: PointerEvent) {
	const target = ev.target as Node | null;
	if (target && (bubbleEl.value?.contains(target) || props.anchor.contains(target))) return;
	emit('cancel');
}

function onKeydown(ev: KeyboardEvent) {
	if (ev.key === 'Escape') emit('cancel');
}

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
	await nextTick();
	place();
	okEl.value?.focus({ preventScroll: true });
	window.addEventListener('resize', place, { passive: true });
	window.addEventListener('scroll', place, { passive: true, capture: true });
	window.document.addEventListener('pointerdown', onPointerDown, true);
	window.document.addEventListener('keydown', onKeydown);
	resizeObserver = new ResizeObserver(place);
	resizeObserver.observe(props.anchor);
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
	max-width: min(260px, calc(100vw - 20px));
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	background: var(--hk3-bg, #f7f4f1);
	color: var(--hk3-text, #221d19);
	border: 2px solid var(--hk3-text, #221d19);
	box-shadow: var(--hk3-shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.2));
	font-size: 13px;
	line-height: 1.5;
	animation: hk3ConfirmIn 220ms cubic-bezier(0.22, 1, 0.36, 1);

	&::after {
		content: '';
		position: absolute;
		left: calc(var(--hk3-tail-x) - 7px);
		width: 14px;
		height: 7px;
		background: var(--hk3-text, #221d19);
	}

	&[data-side="top"]::after { top: 100%; clip-path: polygon(0 0, 100% 0, 50% 100%); }
	&[data-side="bottom"]::after { bottom: 100%; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
}

@keyframes hk3ConfirmIn {
	from { opacity: 0; transform: translateY(4px) scale(0.97); }
	to { opacity: 1; transform: none; }
}

.text {
	margin: 0;
	font-weight: 700;
	overflow-wrap: anywhere;
}

.actions {
	display: flex;
	justify-content: flex-end;
	gap: 6px;
}

.cancel, .ok {
	height: 28px;
	padding: 0 12px;
	border: 1px solid var(--hk3-divider, #d8d0c8);
	background: transparent;
	color: inherit;
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	font-weight: 800;
}

.ok {
	border-color: var(--hk3-accent, #e56b0a);
	background: var(--hk3-accent, #e56b0a);
	color: var(--hk3-bg, #f7f4f1);
}

@media (prefers-reduced-motion: reduce) {
	.bubble { animation: none; }
}
</style>
