<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 地震・津波ウィジェット。直近の地震(＋発表中の津波)をコンパクト表示。
  設定で都道府県フィルター・表示件数を選べる。WSでリアルタイム更新。
-->
<template>
<MkContainer :naked="widgetProps.transparent" :showHeader="widgetProps.showHeader" :class="$style.container">
	<template #icon><i class="ti ti-activity"></i></template>
	<template #header>地震・津波<span v-if="widgetProps.filterPref" :class="$style.hPref">{{ widgetProps.filterPref }}</span></template>
	<template #func="{ buttonStyleClass }"><button class="_button" :class="buttonStyleClass" @click="goPage"><i class="ti ti-external-link"></i></button></template>

	<div :class="$style.root">
		<!-- 共通電光掲示板(コンパクト) -->
		<MkEarthquakeTicker v-if="rawQuakes.length" :quakes="rawQuakes" :tsunami="tsunami" mode="compact" :class="$style.tickerWrap"/>
		<!-- 津波(発表中のみ) -->
		<div v-if="activeTsunami.length" :class="$style.tsunami" :style="{ background: tsunamiGradeColor(tsunamiMaxGrade) }">
			<i class="ti ti-wave-sine"></i> {{ tsunamiGradeLabel(tsunamiMaxGrade) }}発表中
		</div>

		<div v-if="loading && shownQuakes.length === 0" :class="$style.empty">読み込み中…</div>
		<div v-else-if="shownQuakes.length === 0" :class="$style.empty">
			{{ widgetProps.filterPref ? `${widgetProps.filterPref}で最近の地震はありません。` : '最近の地震情報はありません。' }}
		</div>
		<div v-for="q in shownQuakes" v-else :key="q._key" :class="$style.row" @click="goPage">
			<span :class="$style.badge" :style="{ background: scaleToColor(badgeScale(q)), color: scaleTextColor(badgeScale(q)) }">{{ scaleToLabel(badgeScale(q)) }}</span>
			<span :class="$style.info">
				<span :class="$style.hypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}</span>
				<span :class="$style.time">{{ q.earthquake?.time || q.time }}</span>
			</span>
		</div>
		<div :class="$style.source">出典: 気象庁 / P2P地震情報</div>
		<div :class="$style.disclaimer">※ リアルタイム性・到達は保証されません。EEWは扱いません。</div>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import MkEarthquakeTicker from '@/components/MkEarthquakeTicker.vue';
import { useRouter } from '@/router.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import {
	scaleToLabel, scaleToColor, scaleTextColor, tsunamiGradeLabel, tsunamiGradeColor,
	dedupeQuakes, quakeAffectsPref, maxScaleInPref, pruneOld, PREFECTURES,
} from '@/utility/earthquake.js';

const name = 'earthquake';

const widgetPropsDef = {
	transparent: { type: 'boolean', default: false },
	showHeader: { type: 'boolean', default: true },
	filterPref: {
		type: 'enum',
		default: '',
		label: '都道府県フィルター',
		enum: [{ label: 'すべて', value: '' }, ...PREFECTURES.map(p => ({ label: p, value: p }))],
	},
	maxItems: {
		type: 'enum',
		default: '5',
		label: '表示件数',
		enum: [{ label: '3件', value: '3' }, { label: '5件', value: '5' }, { label: '10件', value: '10' }],
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const { widgetProps, configure } = useWidgetPropsManager(name, widgetPropsDef, props, emit);

const router = useRouter();
const stream = useStream();

const rawQuakes = ref<any[]>([]);
const tsunami = ref<any[]>([]);
const loading = ref(true);
let pollTimer = 0;

const quakes = computed(() => dedupeQuakes(rawQuakes.value));
// 都道府県フィルター適用。
const shownQuakes = computed(() => {
	const pref = widgetProps.filterPref;
	const list = pref ? quakes.value.filter(q => quakeAffectsPref(q, pref)) : quakes.value;
	return list.slice(0, Number(widgetProps.maxItems));
});
function badgeScale(q: any): number {
	return widgetProps.filterPref ? maxScaleInPref(q, widgetProps.filterPref) : (q.earthquake?.maxScale ?? -1);
}

// 津波(最新スナップショットが発表中なら表示)。
const activeTsunami = computed(() => {
	const list = tsunami.value.filter(t => t && Array.isArray(t.areas));
	if (list.length === 0) return [];
	const latest = [...list].sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? '')))[0];
	return (latest && latest.cancelled !== true && (latest.areas?.length ?? 0) > 0) ? [latest] : [];
});
const GRADE_ORDER: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1, Unknown: 0 };
const tsunamiMaxGrade = computed(() => {
	let best = 'Watch'; let bn = -1;
	for (const t of activeTsunami.value) for (const a of (t.areas ?? [])) {
		const n = GRADE_ORDER[a.grade] ?? 0;
		if (n > bn) { bn = n; best = a.grade; }
	}
	return best;
});

async function load() {
	try {
		const [eq, ts] = await Promise.all([
			misskeyApi('hata/earthquake/history', { limit: 40 }),
			misskeyApi('hata/earthquake/tsunami', { limit: 10 }),
		]);
		rawQuakes.value = pruneOld((eq as any[]) ?? []);
		tsunami.value = pruneOld((ts as any[]) ?? []);
	} catch { /* keep */ } finally { loading.value = false; }
}
function onEqEvent(ev: { code: number; item: any }) {
	if (ev.code === 551) rawQuakes.value = pruneOld([ev.item, ...rawQuakes.value]).slice(0, 60);
	else if (ev.code === 552) tsunami.value = pruneOld([ev.item, ...tsunami.value]).slice(0, 20);
}

function goPage() { router.push('/earthquake'); }

onMounted(() => {
	load();
	pollTimer = window.setInterval(load, 60 * 1000);
	stream.on('earthquakeEvent', onEqEvent);
});
onUnmounted(() => {
	if (pollTimer) window.clearInterval(pollTimer);
	stream.off('earthquakeEvent', onEqEvent);
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.hPref { margin-left: 6px; font-size: .82em; opacity: .7; }
.tickerWrap { margin-bottom: 8px; }
.root { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.tsunami { color: #fff; font-weight: 800; padding: 5px 10px; border-radius: 8px; font-size: .88em; text-shadow: 0 1px 2px rgba(0,0,0,.25); display: flex; align-items: center; gap: 5px; }
.empty { opacity: .55; font-size: .85em; padding: 8px 0; text-align: center; }
.row { display: flex; gap: 9px; align-items: center; padding: 4px 2px; border-radius: 7px; cursor: pointer; }
.row:hover { background: var(--MI_THEME-buttonHoverBg); }
.badge { flex-shrink: 0; width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: .92em; }
.info { display: flex; flex-direction: column; min-width: 0; }
.hypo { font-weight: 700; font-size: .88em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.time { font-size: .74em; opacity: .6; }
.source { text-align: center; font-size: .7em; opacity: .45; margin-top: 2px; }
.disclaimer { text-align: center; font-size: .66em; opacity: .42; line-height: 1.4; padding: 0 6px; }
</style>
