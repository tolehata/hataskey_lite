<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div
	ref="host"
	:class="$style.root"
	:data-rows="rowCount"
	:data-activity="activity"
	:data-motion="motionRunning"
	data-hatask-flower-stream
	role="group"
	:aria-label="label"
	@mouseenter="onMouseEnter"
	@mouseleave="onMouseLeave"
	@focusin="stop"
	@focusout="onFocusOut"
>
	<div
		v-for="row in renderedRows"
		:key="row.index"
		:class="$style.lane"
		:data-row="row.index"
		@scroll.passive="onScroll(row.index)"
		@wheel.passive="pauseBriefly"
		@pointerdown.passive="onPointerDown(row.index, $event)"
		@pointermove="onPointerMove(row.index, $event)"
		@mousedown="onMouseDown"
		@dragstart.prevent
	>
		<div :class="$style.track">
			<button
				v-for="tile in row.tiles"
				:key="`${tile.copy}:${tile.flower.id}`"
				type="button"
				:class="$style.thumb"
				:data-flower-id="tile.flower.id"
				:data-copy="tile.copy"
				:data-rare="tile.flower.rare"
				:data-activity="activity"
				:aria-hidden="tile.copy !== 0 ? true : undefined"
				:tabindex="tile.copy === 0 ? 0 : -1"
				:aria-label="flowerLabel(tile.flower)"
				aria-haspopup="dialog"
				@click="selectFlower(row.index, tile.flower, $event)"
			>
				<template v-if="activity">
					<MkAvatar v-if="tile.flower.user" :user="tile.flower.user" :class="$style.activityAvatar" :forceShowDecoration="true" :link="false" :preview="false"/>
					<span v-else :class="$style.activityAvatar" aria-hidden="true"><i class="ti ti-user"></i></span>
					<span :class="$style.activityBody">
						<MkUserName v-if="showOwnerName && tile.flower.user" :user="tile.flower.user" :class="$style.activityOwner" :enableEmojiMenu="false"/>
						<span :class="$style.activityName">{{ tile.flower.name }}</span>
						<span :class="$style.date"><span>{{ harvestedLabel }} · </span><time :datetime="tile.flower.harvestedAt">{{ tile.flower.dateLabel }}</time></span>
					</span>
					<span :class="$style.activityFlower"><HataskEmoji :emoji="tile.flower.emoji"/><i v-if="tile.flower.rare" :class="$style.rare" class="ti ti-sparkles" aria-hidden="true"></i></span>
				</template>
				<template v-else>
					<span :class="$style.art"><HataskEmoji :emoji="tile.flower.emoji"/><i v-if="tile.flower.rare" :class="$style.rare" class="ti ti-sparkles" aria-hidden="true"></i></span>
					<span :class="$style.name">{{ tile.flower.name }}</span>
					<span v-if="tile.flower.user" :class="$style.owner">
						<MkAvatar :user="tile.flower.user" :class="$style.avatar" :forceShowDecoration="true" :link="false" :preview="false"/>
						<MkUserName v-if="showOwnerName" :user="tile.flower.user" :class="$style.ownerName" :enableEmojiMenu="false"/>
					</span>
				</template>
			</button>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import type { HataskFlowerSelection, HataskFlowerView } from './hatask-flower-view.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';

const props = withDefaults(defineProps<{
	items: readonly HataskFlowerView[];
	activity?: boolean;
	showOwnerName?: boolean;
	animations: boolean;
	paused: boolean;
	label: string;
	rareLabel: string;
	harvestedLabel: string;
}>(), { activity: false, showOwnerName: true });
const emit = defineEmits<{ select: [payload: HataskFlowerSelection] }>();

type Position = { id: string; fraction: number };
type Lane = {
	index: number;
	element: HTMLElement;
	track: HTMLElement;
	items: readonly HataskFlowerView[];
	cycle: number;
	offsets: number[];
	position: number;
	expectedScroll: number;
	drag: { id: number; x: number; startScroll: number; moved: boolean } | null;
	suppressClickUntil: number;
};

const SPEED = 14;
const QUIET_MS = 550;
const host = ref<HTMLElement | null>(null);
const width = ref(0);
const copies = ref<Record<number, number>>({});
const motionRunning = ref(false);
const rowCount = computed(() => props.activity || width.value < 520 ? 1 : 2);
const itemRows = computed(() => Array.from({ length: rowCount.value }, (_row, index) => ({
	index,
	items: props.items.filter((_flower, itemIndex) => itemIndex % rowCount.value === index),
})).filter(row => row.items.length > 0));
const renderedRows = computed(() => itemRows.value.map(row => ({
	index: row.index,
	tiles: (row.items.length === 1 ? [0] : Array.from({ length: copies.value[row.index] ?? 4 }, (_, index) => index - 1))
		.flatMap(copy => row.items.map(flower => ({ flower, copy }))),
})));
let lanes: Lane[] = [];
let active = false;
let layingOut = false;
let hovered = false;
let frame: number | null = null;
let lastTime: number | null = null;
let quietTimer: number | null = null;
let quietUntil = 0;
let revision = 0;
let resizeObserver: ResizeObserver | null = null;
let reduced: MediaQueryList | null = null;
const pointers = new Set<number>();

function modulo(value: number, size: number): number { return ((value % size) + size) % size; }

function getAnchor(id: string): HTMLElement | null {
	return [...(host.value?.querySelectorAll<HTMLElement>('[data-copy="0"]') ?? [])].find(button => button.dataset.flowerId === id) ?? null;
}

defineExpose({ getAnchor });

function flowerLabel(flower: HataskFlowerView): string {
	const ownerName = props.showOwnerName ? [flower.user?.name, flower.user?.username].find(name => name != null && name !== '') : undefined;
	return [flower.name, ownerName, `${props.harvestedLabel} ${flower.dateLabel}`, flower.rare ? props.rareLabel : null].filter(Boolean).join(' · ');
}

function cancelFrame(): void {
	if (frame !== null) window.cancelAnimationFrame(frame);
	frame = null;
	lastTime = null;
}

function stop(): void {
	cancelFrame();
	motionRunning.value = false;
}

function allowed(): boolean {
	return active && !layingOut && props.animations && !props.paused && !window.document.hidden && !reduced?.matches && !hovered && !pointers.size &&
		!host.value?.contains(window.document.activeElement) && window.performance.now() >= quietUntil;
}

function syncMotion(): void {
	if (!allowed()) { stop(); return; }
	motionRunning.value = props.items.length > 0;
	if (!lanes.some(lane => lane.cycle > 0)) { cancelFrame(); return; }
	frame ??= window.requestAnimationFrame(tick);
}

function assignScroll(lane: Lane, value: number): void {
	const next = lane.cycle > 0 ? lane.cycle + modulo(value - lane.cycle, lane.cycle) : 0;
	// Keep fractional progress even when the browser rounds the rendered position.
	lane.position = next;
	lane.element.scrollLeft = next;
	lane.expectedScroll = lane.element.scrollLeft;
	// Draw the fraction that native scrolling rounded away, without changing its hit targets.
	lane.track.style.transform = `translate3d(${lane.expectedScroll - next}px, 0, 0)`;
}

function readPosition(lane: Lane): number {
	return lane.position + (lane.element.scrollLeft - lane.expectedScroll);
}

function tick(time: number): void {
	frame = null;
	if (!allowed()) { stop(); return; }
	const delta = lastTime === null ? 0 : Math.min(64, Math.max(0, time - lastTime));
	lastTime = time;
	for (const lane of lanes) if (lane.cycle > 0) assignScroll(lane, lane.position + SPEED * delta / 1000);
	syncMotion();
}

function pauseBriefly(): void {
	if (!active) return;
	quietUntil = window.performance.now() + QUIET_MS;
	if (quietTimer !== null) window.clearTimeout(quietTimer);
	quietTimer = window.setTimeout(() => { quietTimer = null; syncMotion(); }, QUIET_MS + 1);
	stop();
}

function capture(lane: Lane): Position | null {
	if (!(lane.cycle > 0)) return null;
	const offset = modulo(readPosition(lane) - lane.cycle, lane.cycle);
	let index = 0;
	for (let i = 1; i < lane.offsets.length; i++) if (lane.offsets[i] <= offset) index = i;
	const end = lane.offsets[index + 1] ?? lane.cycle;
	return { id: lane.items[index].id, fraction: Math.max(0, Math.min(1, (offset - lane.offsets[index]) / (end - lane.offsets[index]))) };
}

function requestLayout(): void {
	if (!active || !host.value) return;
	const saved = lanes.map(capture);
	const focusedId = host.value.contains(window.document.activeElement) ? (window.document.activeElement as HTMLElement).closest<HTMLElement>('[data-flower-id]')?.dataset.flowerId : undefined;
	width.value = host.value.clientWidth || host.value.getBoundingClientRect().width;
	void layout(saved, focusedId);
}

async function layout(saved: (Position | null)[], focusedId?: string): Promise<void> {
	const currentRevision = ++revision;
	layingOut = true;
	stop();
	releaseAllPointers();
	await nextTick();
	if (!active || currentRevision !== revision || !host.value) return;
	const nextLanes: Lane[] = [];
	const nextCopies: Record<number, number> = {};
	for (const row of itemRows.value) {
		const element = host.value.querySelector<HTMLElement>(`[data-row="${row.index}"]`);
		const track = element?.firstElementChild as HTMLElement | null;
		if (!element || !track) continue;
		const buttons = element.querySelectorAll<HTMLElement>('[data-flower-id]');
		// Layout coordinates stay stable while Hatask animates an ancestor's scale/rotation.
		const start = buttons[0].offsetLeft;
		const cycle = row.items.length > 1 ? buttons[row.items.length].offsetLeft - start : 0;
		const lane: Lane = { index: row.index, element, track, items: row.items, cycle: Math.max(0, cycle), offsets: [], position: 0, expectedScroll: 0, drag: null, suppressClickUntil: 0 };
		lane.offsets = row.items.map((_, index) => buttons[index].offsetLeft - start);
		nextCopies[row.index] = cycle > 0 ? Math.max(4, Math.ceil(element.clientWidth / cycle) + 3) : 4;
		nextLanes.push(lane);
	}
	copies.value = nextCopies;
	await nextTick();
	if (!isCurrentLayout(currentRevision)) return;
	lanes = nextLanes;
	for (const lane of lanes) {
		let anchor = saved.find(entry => entry && lane.items.some(flower => flower.id === entry.id));
		if (!anchor && saved[0]) {
			const globalIndex = props.items.findIndex(flower => flower.id === saved[0]?.id);
			const nearest = lane.items.find(flower => props.items.indexOf(flower) >= globalIndex) ?? lane.items[0];
			anchor = { id: nearest.id, fraction: saved[0].fraction };
		}
		const index = anchor ? lane.items.findIndex(flower => flower.id === anchor.id) : -1;
		const offset = index >= 0 && anchor ? lane.offsets[index] + anchor.fraction * ((lane.offsets[index + 1] ?? lane.cycle) - lane.offsets[index]) : 0;
		assignScroll(lane, lane.cycle + offset);
	}
	if (focusedId) getAnchor(focusedId)?.focus({ preventScroll: true });
	layingOut = false;
	syncMotion();
}

function isCurrentLayout(currentRevision: number): boolean { return active && currentRevision === revision; }

function onScroll(index: number): void {
	const lane = lanes.find(row => row.index === index);
	if (!active || layingOut || !lane || !(lane.cycle > 0)) return;
	const actual = lane.element.scrollLeft;
	// Programmatic scroll events must not erase the unrendered fractional remainder.
	if (Math.abs(actual - lane.expectedScroll) <= .75) return;
	lane.position += actual - lane.expectedScroll;
	lane.expectedScroll = actual;
	pauseBriefly();
	if (actual < lane.cycle || actual >= lane.cycle * 2) assignScroll(lane, lane.position);
}

function onPointerDown(index: number, event: PointerEvent): void {
	if (!active) return;
	pointers.add(event.pointerId);
	stop();
	const lane = lanes.find(row => row.index === index);
	if (!lane || event.pointerType !== 'mouse' || event.button !== 0) return;
	lane.drag = { id: event.pointerId, x: event.clientX, startScroll: readPosition(lane), moved: false };
}

function onPointerMove(index: number, event: PointerEvent): void {
	const lane = lanes.find(row => row.index === index);
	const drag = lane?.drag;
	if (!lane || !drag || drag.id !== event.pointerId || event.pointerType !== 'mouse') return;
	const delta = event.clientX - drag.x;
	if (!drag.moved && Math.abs(delta) < 8) return;
	if (!drag.moved) {
		drag.moved = true;
		lane.element.dataset.dragging = 'true';
		try { lane.element.setPointerCapture(event.pointerId); } catch { /* The pointer may have already ended. */ }
	}
	event.preventDefault();
	assignScroll(lane, drag.startScroll - delta);
}

function releasePointer(event: PointerEvent): void {
	if (!pointers.delete(event.pointerId)) return;
	for (const lane of lanes) {
		if (lane.drag?.id !== event.pointerId) continue;
		if (lane.drag.moved) lane.suppressClickUntil = window.performance.now() + 400;
		clearDrag(lane);
	}
	pauseBriefly();
}

function clearDrag(lane: Lane): void {
	if (lane.drag) {
		try { if (lane.element.hasPointerCapture(lane.drag.id)) lane.element.releasePointerCapture(lane.drag.id); } catch { /* A detached element no longer owns the pointer. */ }
	}
	lane.drag = null;
	delete lane.element.dataset.dragging;
}

function releaseAllPointers(): void { pointers.clear(); for (const lane of lanes) clearDrag(lane); }

function onMouseDown(event: MouseEvent): void {
	const button = (event.target as Element).closest<HTMLElement>('[data-copy]');
	if (button && button.dataset.copy !== '0') event.preventDefault();
}

function selectFlower(index: number, flower: HataskFlowerView, event: MouseEvent): void {
	if (!active || !host.value?.contains(event.currentTarget as Node)) return;
	const lane = lanes.find(row => row.index === index);
	if (event.detail !== 0 && lane && window.performance.now() < lane.suppressClickUntil) {
		lane.suppressClickUntil = 0;
		event.preventDefault();
		event.stopPropagation();
		return;
	}
	const anchor = event.currentTarget as HTMLElement;
	const returnFocusTo = getAnchor(flower.id);
	if (anchor !== returnFocusTo) returnFocusTo?.focus({ preventScroll: true });
	emit('select', { flower, anchor, returnFocusTo });
}

function onMouseEnter(): void { hovered = true; stop(); }

function onMouseLeave(): void { hovered = false; syncMotion(); }

function onFocusOut(): void { void nextTick(syncMotion); }

function onVisibilityChange(): void { if (window.document.hidden) releaseAllPointers(); syncMotion(); }

function activate(): void {
	if (active) return;
	active = true;
	reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	reduced.addEventListener('change', syncMotion);
	window.document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pointerup', releasePointer, { passive: true });
	window.addEventListener('pointercancel', releasePointer, { passive: true });
	if (typeof ResizeObserver === 'function') {
		resizeObserver = new ResizeObserver(requestLayout);
		if (host.value) resizeObserver.observe(host.value);
	} else window.addEventListener('resize', requestLayout);
	requestLayout();
}

function deactivate(): void {
	active = false;
	layingOut = false;
	revision++;
	stop();
	releaseAllPointers();
	if (quietTimer !== null) window.clearTimeout(quietTimer);
	quietTimer = null;
	quietUntil = 0;
	hovered = false;
	resizeObserver?.disconnect();
	resizeObserver = null;
	reduced?.removeEventListener('change', syncMotion);
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
	window.removeEventListener('pointerup', releasePointer);
	window.removeEventListener('pointercancel', releasePointer);
	window.removeEventListener('resize', requestLayout);
}

watch(() => [props.items, props.activity], () => {
	if (quietTimer !== null) window.clearTimeout(quietTimer);
	quietTimer = null;
	quietUntil = 0;
	requestLayout();
});
watch(() => [props.animations, props.paused], syncMotion);
onMounted(activate);
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(deactivate);
</script>

<style lang="scss" module>
.root {
	container: hatask-flower-stream / inline-size;
	width: 100%;
	min-width: 0;
	color: var(--fg, var(--MI_THEME-fg));
}
.lane {
	box-sizing: border-box;
	width: 100%;
	padding: 12px;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
	scroll-behavior: auto;
	overscroll-behavior-x: contain;
	mask-image: linear-gradient(to right, transparent, #000 18px, #000 calc(100% - 18px), transparent);
}
.lane::-webkit-scrollbar { display: none; }
.lane[data-dragging="true"] { cursor: grabbing; }
.track { position: relative; display: flex; flex-wrap: nowrap; align-items: stretch; gap: 12px; width: max-content; min-width: 100%; }
.thumb {
	position: relative;
	isolation: isolate;
	box-sizing: border-box;
	display: flex;
	flex: 0 0 118px;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	width: 118px;
	min-width: 0;
	min-height: 128px;
	padding: 8px 8px 10px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm, 12px);
	color: inherit;
	background: transparent;
	font: inherit;
	text-align: center;
	user-select: none;
	-webkit-user-select: none;
	cursor: pointer;
}
.thumb:hover { border-color: var(--rule, var(--MI_THEME-divider)); background: var(--surface, var(--MI_THEME-panel)); }
.thumb:focus-visible { outline: 2px solid var(--accent, var(--MI_THEME-accent)); outline-offset: 3px; }
.art { position: relative; display: grid; place-items: center; width: 100%; height: 57px; flex: 0 0 57px; font-size: 54px; }
.name, .activityName { display: -webkit-box; min-width: 0; min-height: 3em; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; overflow-wrap: anywhere; line-break: strict; font-size: 12px; font-weight: 600; line-height: 1.5; }
.name { width: 100%; }
.owner { display: flex; align-items: center; justify-content: center; gap: 6px; max-width: 100%; min-height: 33px; padding-top: 2px; }
.avatar { width: 28px; height: 28px; flex: 0 0 28px; }
.ownerName { max-width: 58px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 12px; }
.rare { position: absolute; top: 0; right: 0; font-size: 13px; color: var(--accent, var(--MI_THEME-accent)); }
.thumb[data-rare="true"] { border-color: var(--accent, var(--MI_THEME-accent)); box-shadow: 0 0 12px color-mix(in srgb, var(--accent, var(--MI_THEME-accent)) 24%, transparent); }
.thumb[data-rare="true"]::before { content: ""; position: absolute; inset: -1px; border: 1px solid transparent; border-top-color: var(--accent, var(--MI_THEME-accent)); border-left-color: var(--accent, var(--MI_THEME-accent)); border-radius: inherit; opacity: .7; pointer-events: none; }
.root[data-motion="true"] .thumb[data-rare="true"]::before { animation: rareLight 5.6s ease-in-out infinite; }
.thumb[data-activity="true"] { display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px; align-items: center; flex-basis: 248px; gap: 12px; width: 248px; min-height: 86px; padding: 10px 12px; border-color: var(--rule, var(--MI_THEME-divider)); background: var(--surface, var(--MI_THEME-panel)); text-align: left; }
.thumb[data-activity="true"][data-rare="true"] { border-color: var(--accent, var(--MI_THEME-accent)); }
.activityAvatar { display: grid; place-items: center; width: 32px; height: 32px; }
.activityBody { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.activityOwner { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.date { color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
.activityFlower { position: relative; font-size: 34px; }
@keyframes rareLight { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@container hatask-flower-stream (width < 520px) {
	.thumb[data-activity="false"] { flex-basis: 102px; width: 102px; min-height: 122px; padding: 6px 6px 8px; gap: 3px; }
	.art { height: 50px; flex-basis: 50px; font-size: 50px; }
	.owner { min-height: 31px; gap: 5px; }
	.ownerName { max-width: 50px; }
}
@media (prefers-reduced-motion: reduce) { .root[data-motion="true"] .thumb[data-rare="true"]::before { animation: none; } }
@media (forced-colors: active) { .lane { mask-image: none; } .thumb[data-rare="true"] { border: 2px solid Highlight; box-shadow: none; } }
</style>
