<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.wrap">
	<div
		ref="root"
		:class="$style.board"
		:role="interactive ? 'grid' : 'img'"
		:aria-label="`${boardSize}路盤`"
		:aria-rowcount="interactive ? boardSize : undefined"
		:aria-colcount="interactive ? boardSize : undefined"
		:data-dark-board="palette.dark"
		:style="boardStyle"
	>
		<span v-for="(label, index) in coordinates" :key="index" :class="$style.coordinate" :style="label.style" aria-hidden="true">{{ label.text }}</span>
		<div
			ref="grid"
			:class="$style.grid"
			:style="{ inset: `${geometry.inset}%` }"
			@pointerdown="onPointerDown"
			@pointerup="onPointerUp"
			@pointermove="onPointerMove"
			@pointerleave="hover = null"
			@pointercancel="pressed = null"
		>
			<svg :class="$style.lines" :viewBox="`0 0 ${boardSize - 1} ${boardSize - 1}`" preserveAspectRatio="none" aria-hidden="true">
				<path :d="innerPath" :stroke-width="lineWidths.inner"></path>
				<rect x="0" y="0" :width="boardSize - 1" :height="boardSize - 1" fill="none" :stroke-width="lineWidths.edge"></rect>
			</svg>
			<div v-for="(star, index) in stars" :key="`s${index}`" :class="$style.star" :style="markerStyle(star, geometry.star)" aria-hidden="true"></div>
			<div v-for="mark in territoryMarks" :key="mark.key" :class="$style.territory" :style="mark.style" aria-hidden="true"></div>
			<div v-if="pending" :class="$style.crosshair" :style="crosshairStyle" aria-hidden="true"><span></span><span></span></div>
			<div v-for="stone in stoneModels" :key="stone.index" :class="$style.stone" :style="stone.style" aria-hidden="true">
				<img v-if="stone.avatar && !failedAvatars.has(stone.avatar)" :class="$style.avatar" :src="stone.avatar" alt="" decoding="async" @error="failAvatar(stone.avatar)">
				<span v-if="stone.text" :class="$style.stoneText" :data-avatar="stones === 'avatar'">{{ stone.text }}</span>
			</div>
			<div v-if="ghost" :class="$style.ghost" :data-pending="ghost.pending" :style="ghost.style" aria-hidden="true"></div>
			<div v-if="lastMarker" :class="$style.last" :style="lastMarker" aria-hidden="true"></div>
			<div v-for="(hint, index) in hintModels" :key="`hint${index}`" :class="$style.hint" :data-failure="hint.failure" :style="hint.style" aria-hidden="true">{{ hint.text }}</div>
			<template v-if="interactive">
				<div v-for="row in boardSize" :key="row" role="row" :aria-rowindex="row" :class="$style.hitRow">
					<button
						v-for="column in boardSize"
						:key="column"
						type="button"
						role="gridcell"
						:class="$style.hit"
						:data-index="(row - 1) * boardSize + column - 1"
						:aria-label="pointLabel(column - 1, row - 1)"
						:aria-colindex="column"
						:tabindex="focusIndex === (row - 1) * boardSize + column - 1 ? 0 : -1"
						:style="markerStyle({ x: column - 1, y: row - 1 }, geometry.hit)"
						@focus="focusIndex = (row - 1) * boardSize + column - 1"
						@click="onKeyActivate($event, { x: column - 1, y: row - 1 })"
						@keydown="onKeydown($event, { x: column - 1, y: row - 1 })"
					></button>
				</div>
			</template>
		</div>
	</div>
	<div v-if="pending" :class="$style.confirm" role="group" aria-label="着手の確認">
		<span :class="$style.confirmPoint">{{ pendingLabel }}</span>
		<button type="button" :class="$style.confirmCancel" @click="pending = null">やめる</button>
		<button type="button" :class="$style.confirmPlay" @click="commitPending">ここに打つ</button>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { BoardHint, BoardNumber, BoardTerritory, BoardTheme, StoneStyle } from '@/utility/hataigo/board-presentation.js';
import type { Board, BoardSize, Color, Point } from '@/utility/hataigo/rules/board.js';
import { CONFIRM_BELOW_CELL_PX, boardGeometry, boardLineWidths, boardPalette, boardPointLabel, boardStars, moveBoardFocus, nearestPoint, stoneAppearance } from '@/utility/hataigo/board-presentation.js';
import { isOnBoard, toDisplayPoint } from '@/utility/hataigo/rules/board.js';
import { store } from '@/store.js';

const props = withDefaults(defineProps<{
	position: Board;
	size?: BoardSize;
	theme?: BoardTheme;
	stones?: StoneStyle;
	labels?: boolean;
	interactive?: boolean;
	/** Scoring: taps mark stones/points at once and never preview a stone. */
	marking?: boolean;
	/** Colour of the stone a tap would place; drives the preview. */
	turn?: Color | null;
	placement?: 'auto' | 'confirm' | 'direct';
	numbers?: readonly BoardNumber[];
	numberFrom?: number;
	lastMove?: Point | null;
	hints?: readonly BoardHint[];
	territory?: BoardTerritory;
	dead?: readonly Point[];
	blackAvatar?: string;
	whiteAvatar?: string;
	blackInitial?: string;
	whiteInitial?: string;
}>(), { size: undefined, territory: undefined, theme: 'fuji', stones: 'real', labels: false, interactive: false, marking: false, turn: null, placement: 'auto', numbers: () => [], numberFrom: 1, lastMove: null, hints: () => [], dead: () => [], blackAvatar: '', whiteAvatar: '', blackInitial: '黒', whiteInitial: '白' });
const emit = defineEmits<{ place: [x: number, y: number]; select: [point: Point] }>();
const root = useTemplateRef('root');
const grid = useTemplateRef('grid');
const focusIndex = ref(0);
const failedAvatars = ref(new Set<string>());
const hover = ref<Point | null>(null);
const pending = ref<Point | null>(null);
const pressed = ref<{ id: number; x: number; y: number; type: string } | null>(null);
const cellPx = ref(40);
const coarsePointer = ref(false);
// A position is authoritative if a caller changes size and board in separate updates.
const boardSize = computed(() => props.position.size);
const geometry = computed(() => boardGeometry(boardSize.value, props.labels));
const palette = computed(() => boardPalette(props.theme, store.r.darkMode.value));
const lineWidths = computed(() => boardLineWidths(cellPx.value));
const boardStyle = computed(() => ({ background: palette.value.background, '--hataigo-line': palette.value.line, '--hataigo-coordinate': palette.value.label, '--hataigo-label-font': `${geometry.value.labelFont}cqi` }));
const innerPath = computed(() => {
	const last = boardSize.value - 1;
	const parts: string[] = [];
	for (let i = 1; i < last; i++) parts.push(`M${i} 0V${last}`, `M0 ${i}H${last}`);
	return parts.join('');
});
const stars = computed(() => boardStars(boardSize.value));
const deadIndexes = computed(() => new Set(props.dead.filter(point => isOnBoard(boardSize.value, point)).map(point => point.y * boardSize.value + point.x)));
const numbered = computed(() => new Map(props.numbers.filter(item => isOnBoard(boardSize.value, item.point) && item.number >= props.numberFrom).map(item => [item.point.y * boardSize.value + item.point.x, item.number])));
const confirmFirst = computed(() => !props.marking && (props.placement === 'confirm' || (props.placement === 'auto' && coarsePointer.value && cellPx.value < CONFIRM_BELOW_CELL_PX)));

function markerStyle(point: Point, width: number): CSSProperties {
	return { left: `${point.x * geometry.value.cell}%`, top: `${point.y * geometry.value.cell}%`, width: `${width}%` };
}

function isEmpty(point: Point): boolean {
	return props.position.cells[point.y * boardSize.value + point.x] === null;
}

const coordinates = computed(() => {
	if (!props.labels) return [];
	const { inset, cell, fraction } = geometry.value;
	return Array.from({ length: boardSize.value }, (_, index) => {
		const position = inset + index * cell * fraction;
		const column = toDisplayPoint({ x: index, y: 0 }, boardSize.value)[0];
		return [
			{ text: column, style: { left: `${position}%`, top: `${inset * 0.42}%` } },
			{ text: column, style: { left: `${position}%`, top: `${100 - inset * 0.42}%` } },
			{ text: String(boardSize.value - index), style: { left: `${inset * 0.42}%`, top: `${position}%` } },
			{ text: String(boardSize.value - index), style: { left: `${100 - inset * 0.42}%`, top: `${position}%` } },
		];
	}).flat();
});
const stoneModels = computed(() => props.position.cells.flatMap((color, index) => {
	if (color === null) return [];
	const point = { x: index % boardSize.value, y: Math.floor(index / boardSize.value) };
	const appearance = stoneAppearance(props.stones, color, palette.value.dark);
	const number = numbered.value.get(index);
	const avatar = props.stones === 'avatar' ? color === 'black' ? props.blackAvatar : props.whiteAvatar : '';
	const initial = color === 'black' ? props.blackInitial : props.whiteInitial;
	const text = number !== undefined ? String(number) : props.stones === 'avatar' && (!avatar || failedAvatars.value.has(avatar)) ? Array.from(initial)[0] ?? '' : '';
	const font = geometry.value.stone * geometry.value.fraction * (text.length > 2 ? 0.36 : 0.46);
	return [{ index, avatar, text, style: { ...markerStyle(point, geometry.value.stone), background: appearance.background, boxShadow: appearance.shadow, opacity: deadIndexes.value.has(index) ? 0.42 : 1, color: props.stones === 'avatar' ? '#fff' : color === 'black' ? '#faf7f4' : '#221d19', fontSize: `${font}cqi` } }];
}));
const territoryMarks = computed(() => (['black', 'white'] as const).flatMap(color => (props.territory?.[color] ?? []).filter(point => isOnBoard(boardSize.value, point)).map(point => ({ key: `${color}-${point.x}-${point.y}`, style: { ...markerStyle(point, geometry.value.territory), background: color === 'black' ? '#221d19' : '#faf7f4', boxShadow: color === 'black' ? '0 0 0 1px rgba(255, 255, 255, .5)' : 'inset 0 0 0 1px #221d19' } }))));
const lastMarker = computed(() => {
	const point = props.lastMove;
	if (!point || !isOnBoard(boardSize.value, point) || props.numbers.length > 0) return null;
	const color = props.position.cells[point.y * boardSize.value + point.x];
	if (color === null) return null;
	// A ring in the opposite colour of the stone reads on every theme and stone style.
	return { ...markerStyle(point, geometry.value.last), boxShadow: `inset 0 0 0 max(2px, 0.4cqi) ${color === 'black' ? '#faf7f4' : '#221d19'}` };
});
const hintModels = computed(() => props.hints.filter(hint => isOnBoard(boardSize.value, hint.point)).map(hint => ({ failure: hint.kind === 'failure', text: hint.kind === 'failure' ? '×' : hint.label ?? '', style: { ...markerStyle(hint.point, geometry.value.hint), fontSize: `${geometry.value.stone * geometry.value.fraction * 0.44}cqi` } })));
const ghost = computed(() => {
	if (!props.interactive || props.marking || !props.turn) return null;
	const point = pending.value ?? hover.value;
	if (!point || !isEmpty(point)) return null;
	const appearance = stoneAppearance(props.stones === 'avatar' ? 'flat' : props.stones, props.turn, palette.value.dark);
	return { pending: !!pending.value, style: { ...markerStyle(point, geometry.value.stone), background: appearance.background, boxShadow: appearance.shadow } };
});
const crosshairStyle = computed(() => pending.value ? { '--x': `${pending.value.x * geometry.value.cell}%`, '--y': `${pending.value.y * geometry.value.cell}%` } : {});
const pendingLabel = computed(() => pending.value ? toDisplayPoint(pending.value, boardSize.value) : '');

function pointLabel(x: number, y: number): string {
	const index = y * boardSize.value + x;
	return boardPointLabel(boardSize.value, { x, y }, props.position.cells[index], { dead: deadIndexes.value.has(index), last: props.lastMove?.x === x && props.lastMove.y === y, number: numbered.value.get(index) });
}

function failAvatar(url: string): void {
	failedAvatars.value = new Set([...failedAvatars.value, url]);
}

function commit(point: Point): void {
	pending.value = null;
	emit('select', { ...point });
	if (isEmpty(point)) emit('place', point.x, point.y);
}

function commitPending(): void {
	if (pending.value) commit(pending.value);
}

/** Pointer path: may stop at a preview when the board is small under a finger. */
function activateFromPointer(point: Point): void {
	if (!props.interactive) return;
	if (!confirmFirst.value || !isEmpty(point)) { commit(point); return; }
	if (pending.value && pending.value.x === point.x && pending.value.y === point.y) { commit(point); return; }
	pending.value = point;
}

function pointFromEvent(event: PointerEvent): Point | null {
	const element = grid.value;
	if (!element) return null;
	const rect = element.getBoundingClientRect();
	return nearestPoint(boardSize.value, event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
}

function onPointerDown(event: PointerEvent): void {
	if (!props.interactive || !event.isPrimary || event.button !== 0) return;
	pressed.value = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
}

function onPointerUp(event: PointerEvent): void {
	const press = pressed.value;
	pressed.value = null;
	if (!press || press.id !== event.pointerId) return;
	// A drag (scrolling the page) is not a move.
	if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > cellPx.value * 0.6) return;
	const point = pointFromEvent(event);
	if (point) activateFromPointer(point);
}

function onPointerMove(event: PointerEvent): void {
	if (event.pointerType !== 'mouse' || !props.interactive) return;
	hover.value = pointFromEvent(event);
}

/** Keyboard and assistive technology act directly: the focused point is already explicit. */
function onKeyActivate(event: MouseEvent, point: Point): void {
	// Real pointer clicks are handled on the grid; only keyboard-generated clicks have detail 0.
	if (event.detail !== 0) return;
	if (props.interactive) commit(point);
}

function onKeydown(event: KeyboardEvent, point: Point): void {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		if (props.interactive) commit(point);
		return;
	}
	if (event.key === 'Escape') { pending.value = null; return; }
	if (event.key.startsWith('Arrow')) {
		event.preventDefault();
		const target = moveBoardFocus(boardSize.value, point, event.key);
		focusIndex.value = target.y * boardSize.value + target.x;
		void nextTick(() => root.value?.querySelector<HTMLButtonElement>(`[data-index="${focusIndex.value}"]`)?.focus());
	}
}

let observer: ResizeObserver | null = null;
let coarseQuery: MediaQueryList | null = null;
const onCoarseChange = () => { coarsePointer.value = !!coarseQuery?.matches; };
onMounted(() => {
	coarseQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
	onCoarseChange();
	coarseQuery?.addEventListener('change', onCoarseChange);
	if (typeof ResizeObserver === 'function' && grid.value) {
		observer = new ResizeObserver(entries => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width > 0) cellPx.value = width / (boardSize.value - 1);
		});
		observer.observe(grid.value);
	}
});
onBeforeUnmount(() => {
	observer?.disconnect();
	coarseQuery?.removeEventListener('change', onCoarseChange);
});

watch(boardSize, () => { focusIndex.value = 0; pending.value = null; });
// A preview never survives a change of position (own move, opponent's move, undo).
watch(() => props.position, () => { pending.value = null; });
watch(() => [props.interactive, props.marking, props.turn], () => { pending.value = null; });
</script>

<style lang="scss" module>
.wrap { display: grid; gap: 8px; width: 100%; }
.board { position: relative; width: 100%; aspect-ratio: 1; container-type: inline-size; user-select: none; -webkit-user-select: none; isolation: isolate; border-radius: inherit; -webkit-tap-highlight-color: transparent; }
.grid { position: absolute; touch-action: manipulation; }
.lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.lines path, .lines rect { stroke: var(--hataigo-line); vector-effect: non-scaling-stroke; shape-rendering: crispEdges; fill: none; }
.coordinate { position: absolute; transform: translate(-50%, -50%); color: var(--hataigo-coordinate); font-size: var(--hataigo-label-font); font-weight: 700; font-variant-numeric: tabular-nums; pointer-events: none; }
.star, .territory, .stone, .last, .hint, .ghost { position: absolute; aspect-ratio: 1; transform: translate(-50%, -50%); pointer-events: none; }
.star { border-radius: 50%; background: var(--hataigo-line); }
.stone { display: grid; place-items: center; border-radius: 50%; overflow: hidden; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.04em; line-height: 1; }
.avatar { position: absolute; inset: 7%; width: 86%; height: 86%; border-radius: 50%; object-fit: cover; }
.stoneText { position: relative; }
.stoneText[data-avatar="true"] { text-shadow: 0 1px 2px #000, 0 0 3px #000; }
.last { border-radius: 50%; }
.ghost { border-radius: 50%; opacity: .45; }
.ghost[data-pending="true"] { opacity: .78; outline: max(2px, .45cqi) solid #e56b0a; outline-offset: 1px; }
.crosshair { position: absolute; inset: 0; pointer-events: none; }
.crosshair > span { position: absolute; background: color-mix(in srgb, #e56b0a 75%, transparent); }
.crosshair > span:first-child { left: var(--x); top: 0; bottom: 0; width: 2px; transform: translateX(-50%); }
.crosshair > span:last-child { top: var(--y); left: 0; right: 0; height: 2px; transform: translateY(-50%); }
.hint { display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, #e56b0a 26%, transparent); box-shadow: inset 0 0 0 2px #e56b0a; color: #763500; font-weight: 800; line-height: 1; }
.hint[data-failure="true"] { background: color-mix(in srgb, #221d19 10%, transparent); box-shadow: inset 0 0 0 2px #635e59; color: #46423e; }
.hitRow { position: absolute; inset: 0; pointer-events: none; }
/* Page styles such as `.root button` must never reach the intersections: reset everything here. */
.board .hit { all: unset; position: absolute; aspect-ratio: 1; transform: translate(-50%, -50%); box-sizing: border-box; border-radius: 50%; pointer-events: none; }
.board .hit:focus-visible { outline: 3px solid #e56b0a; outline-offset: 1px; box-shadow: 0 0 0 5px #fff; z-index: 1; }
.confirm { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 999px; background: var(--hy-surface, #fff); box-shadow: inset 0 0 0 1px var(--hy-border, #e4dfec); margin-inline: var(--hataigo-gutter, 0); }
.confirmPoint { flex: 1; font-weight: 700; font-variant-numeric: tabular-nums; }
.wrap .confirmCancel, .wrap .confirmPlay { all: unset; box-sizing: border-box; min-height: 44px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; cursor: pointer; font-weight: 700; font-size: 14px; }
.wrap .confirmCancel { color: var(--hy-ink, inherit); }
.wrap .confirmPlay { background: var(--hy-accent, #6b4fb8); color: var(--hy-on-accent, #fff); }
.wrap .confirmCancel:focus-visible, .wrap .confirmPlay:focus-visible { outline: 3px solid var(--hy-accent, #6b4fb8); outline-offset: 2px; }
</style>
