<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.root">
	<h3 :data-collapsed="!shown"><i class="ti ti-chart-line" aria-hidden="true"></i>{{ text.estimateTitle }}<HataigoHelp :label="text.estimateTitle" :text="text.estimateHelp"/><HataigoShowToggle :label="text.estimateTitle" :shown="shown" @toggle="toggle"/></h3>
	<template v-if="shown">
		<p :class="$style.margin">{{ margin === null ? text.estimateUnknown : `${margin >= 0 ? text.black : text.white} +${Math.abs(margin).toFixed(1)} ${text.points}` }}</p>
		<svg v-if="entries.length" viewBox="0 0 320 90" preserveAspectRatio="none" role="img" :aria-label="text.graphLabel" :class="$style.graph">
			<line x1="0" y1="45" x2="320" y2="45" :class="$style.zero"/>
			<path :d="path" :class="$style.line"/>
			<circle v-for="point in plotted" :key="point.move" :cx="point.x" :cy="point.y" r="2.5" :class="$style.dot"/>
			<line :x1="currentX" y1="0" :x2="currentX" y2="90" :class="$style.cursor"/>
		</svg>
		<div v-if="interactive && plotted.length" :class="$style.steps"><button v-for="point in plotted" :key="point.move" type="button" :aria-label="`${point.move}${text.graphMove}`" :aria-current="point.move === currentMove ? 'step' : undefined" @click="emit('jump', point.move)">{{ point.move }}</button></div>
		<small v-if="result">{{ result.playouts }} {{ text.playouts }}</small>
	</template>
</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SearchResult } from '@/utility/hataigo/engine/client.js';
import type { EstimatePoint } from '@/utility/hataigo/ai-game.js';
import HataigoHelp from '@/components/hataigo/HataigoHelp.vue';
import HataigoShowToggle from '@/components/hataigo/HataigoShowToggle.vue';
import { aiText as text } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';

const props = withDefaults(defineProps<{ result?: SearchResult | null; entries?: readonly EstimatePoint[]; currentMove?: number; interactive?: boolean }>(), { result: null, entries: () => [], currentMove: 0, interactive: false });
const emit = defineEmits<{ jump: [move: number] }>();

const { prefs, save } = useHataigoPrefs();
// 押したらすぐ畳む。保存は裏で（失敗しても今の画面の見え方は押したとおり）
const override = ref<boolean | null>(null);
const shown = computed(() => override.value ?? prefs.showEstimate !== false);

function toggle(): void {
	const next = !shown.value;
	override.value = next;
	void save({ showEstimate: next });
}

const margin = computed(() => props.result?.estimatedMargin ?? props.entries.find(entry => entry.move === props.currentMove)?.margin ?? null);
const maxMove = computed(() => Math.max(1, props.currentMove, ...props.entries.map(entry => entry.move)));
const scale = computed(() => Math.max(1, ...props.entries.map(entry => entry.margin === null ? 0 : Math.abs(entry.margin))));
const plotted = computed(() => props.entries.flatMap(entry => entry.margin === null ? [] : [{ move: entry.move, x: entry.move / maxMove.value * 320, y: 45 - entry.margin / scale.value * 36 }]));
const path = computed(() => {
	let separated = true;
	return props.entries.map(entry => {
		if (entry.margin === null) { separated = true; return ''; }
		const command = separated ? 'M' : 'L';
		separated = false;
		return `${command}${entry.move / maxMove.value * 320},${45 - entry.margin / scale.value * 36}`;
	}).join(' ');
});
const currentX = computed(() => props.currentMove / maxMove.value * 320);
</script>

<style module lang="scss">
.root { min-width: 0; padding: 14px 16px; border: 1px solid var(--hy-border); border-radius: 24px; background: var(--hy-surface); color: var(--hy-ink); box-shadow: var(--hy-shadow); }
.root h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 14px; }
.root h3[data-collapsed='true'] { margin-bottom: 0; }
.margin { margin: 0 0 8px; font-size: 18px; color: var(--hy-accent); font-variant-numeric: tabular-nums; }
.graph { display: block; width: 100%; height: 90px; background: var(--hy-bg); border-radius: 14px; }
.zero { stroke: var(--hy-border); stroke-dasharray: 3 3; }
.line { fill: none; stroke: var(--hy-accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
.dot { fill: var(--hy-accent); }
.cursor { stroke: var(--hy-ink); stroke-width: 1; opacity: .65; vector-effect: non-scaling-stroke; }
.root small { display: block; margin: 8px 0 0; color: var(--hy-muted); line-height: 1.7; font-size: 11px; }
.steps { display: flex; gap: 6px; overflow: auto; margin-top: 8px; padding-bottom: 2px; }
.steps button { flex: none; min-width: 44px; min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-bg); color: inherit; cursor: pointer; }
.steps button[aria-current="step"] { background: var(--hy-accent); color: #fff; }
.steps button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
</style>
