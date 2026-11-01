<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): Hataskey UIデッキ用の地震・津波カラム(地図なし版)。
  津波情報(発表されていなければ非表示) → 付近の地震 → 直近の地震 の順で表示。
  設定(歯車)・リロードボタンを上部に持つ。
-->
<template>
<div :class="$style.col">
	<MkEarthquakeTicker v-if="rawQuakes.length" :quakes="rawQuakes" :tsunami="tsunami" mode="compact" :class="$style.tickerWrap"/>
	<div :class="$style.body">
		<!-- 津波(発表中のみ) -->
		<section v-if="activeTsunami.length" :class="$style.sec">
			<div :class="$style.secHead"><i class="ti ti-wave-sine"></i> 津波情報</div>
			<div :class="$style.tsunamiBox" :style="{ borderColor: tsunamiGradeColor(tsunamiMaxGrade) }">
				<div :class="$style.tsunamiHead" :style="{ background: tsunamiGradeColor(tsunamiMaxGrade) }">{{ tsunamiGradeLabel(tsunamiMaxGrade) }}</div>
				<div :class="$style.tsunamiBody">
					<div v-for="(a, i) in tsunamiRows.slice(0, 6)" :key="i" :class="$style.tsunamiArea">
						<span :style="{ color: tsunamiGradeColor(a.grade), fontWeight: 700 }">{{ tsunamiGradeLabel(a.grade) }}</span> {{ a.name }}
					</div>
					<div v-if="tsunamiRows.length > 6" :class="$style.more">ほか{{ tsunamiRows.length - 6 }}地域</div>
				</div>
			</div>
		</section>

		<!-- 付近の地震 -->
		<section :class="$style.sec">
			<div :class="$style.secHead"><i class="ti ti-map-pin"></i> 付近の地震<span v-if="myPref" :class="$style.prefTag">{{ myPref }}</span></div>
			<div v-if="!myPref" :class="$style.notice">
				<div>歯車から<b>お住いの都道府県</b>を設定すると表示します。</div>
				<div :class="$style.privacy">※ 端末にのみ保存・サーバー非送信</div>
			</div>
			<div v-else-if="nearbyQuakes.length === 0" :class="$style.empty">最近の地震はありません。</div>
			<div v-for="q in nearbyQuakes" v-else :key="q._key" :class="$style.row">
				<span :class="$style.badge" :style="{ background: scaleToColor(maxScaleInPref(q, myPref)), color: scaleTextColor(maxScaleInPref(q, myPref)) }">{{ scaleToLabel(maxScaleInPref(q, myPref)) }}</span>
				<span :class="$style.rowInfo"><span :class="$style.rowHypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}</span><span :class="$style.rowTime">{{ q.earthquake?.time || q.time }}</span></span>
			</div>
		</section>

		<!-- 直近の地震 -->
		<section :class="$style.sec">
			<div :class="$style.secHead"><i class="ti ti-list"></i> 直近の地震</div>
			<div v-if="loading && quakes.length === 0" :class="$style.empty">読み込み中…</div>
			<div v-else-if="quakes.length === 0" :class="$style.empty">最近の地震情報はありません。</div>
			<div v-for="q in quakes.slice(0, 20)" v-else :key="q._key" :class="$style.row">
				<span :class="$style.badge" :style="{ background: scaleToColor(q.earthquake?.maxScale ?? -1), color: scaleTextColor(q.earthquake?.maxScale ?? -1) }">{{ scaleToLabel(q.earthquake?.maxScale ?? -1) }}</span>
				<span :class="$style.rowInfo">
					<span :class="$style.rowHypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}<span v-if="q.earthquake?.hypocenter?.magnitude >= 0" :class="$style.rowMag">M{{ q.earthquake.hypocenter.magnitude }}</span></span>
					<span :class="$style.rowTime">{{ q.earthquake?.time || q.time }}</span>
				</span>
			</div>
		</section>
		<div :class="$style.source">出典: 気象庁 / P2P地震情報</div>
		<div :class="$style.disclaimer">※ リアルタイム性・到達は保証されません。EEWは扱いません。</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useStream } from '@/stream.js';
import * as os from '@/os.js';
import MkEarthquakeSettings from '@/components/MkEarthquakeSettings.vue';
import MkEarthquakeTicker from '@/components/MkEarthquakeTicker.vue';
import { earthquakePref, earthquakePollSec } from '@/utility/hatasaba-device-prefs.js';
import {
	scaleToLabel, scaleToColor, scaleTextColor,
	tsunamiGradeLabel, tsunamiGradeColor,
	dedupeQuakes, quakeAffectsPref, maxScaleInPref, pruneOld,
} from '@/utility/earthquake.js';

const stream = useStream();
const rawQuakes = ref<any[]>([]);
const tsunami = ref<any[]>([]);
const loading = ref(true);
let pollTimer = 0;

// 旗鯖fork(#34): サーバーWS→ストリーミングで新着を即時反映。
function onEqEvent(ev: { code: number; item: any }) {
	if (ev.code === 551) rawQuakes.value = pruneOld([ev.item, ...rawQuakes.value]).slice(0, 60);
	else if (ev.code === 552) tsunami.value = pruneOld([ev.item, ...tsunami.value]).slice(0, 20);
}

const myPref = computed(() => earthquakePref.value);
const quakes = computed(() => dedupeQuakes(rawQuakes.value));
const nearbyQuakes = computed(() => myPref.value ? quakes.value.filter(q => quakeAffectsPref(q, myPref.value)).slice(0, 5) : []);

// 津波予報(552)は毎回その時点の全状態スナップショット。最新レコードだけ見て、
//   解除済み(cancelled)・エリア無しなら何も表示しない。
const activeTsunami = computed(() => {
	const list = tsunami.value.filter(t => t && Array.isArray(t.areas));
	if (list.length === 0) return [];
	const latest = [...list].sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? '')))[0];
	return (latest && latest.cancelled !== true && (latest.areas?.length ?? 0) > 0) ? [latest] : [];
});
const GRADE_ORDER: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1, Unknown: 0 };
const tsunamiRows = computed<{ grade: string; name: string }[]>(() => {
	const rows: { grade: string; name: string }[] = [];
	for (const t of activeTsunami.value) for (const a of (t.areas ?? [])) rows.push({ grade: a.grade, name: a.name });
	rows.sort((a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0));
	return rows;
});
const tsunamiMaxGrade = computed(() => tsunamiRows.value[0]?.grade ?? 'Watch');

async function load() {
	try {
		const [eq, ts] = await Promise.all([
			misskeyApi('hata/earthquake/history', { limit: 40 }),
			misskeyApi('hata/earthquake/tsunami', { limit: 10 }),
		]);
		rawQuakes.value = (eq as any[]) ?? [];
		tsunami.value = (ts as any[]) ?? [];
	} catch { /* keep */ } finally { loading.value = false; }
}

function openSettings() {
	const { dispose } = os.popup(MkEarthquakeSettings, {}, { closed: () => dispose() });
}

function startPolling() {
	if (pollTimer) window.clearInterval(pollTimer);
	pollTimer = window.setInterval(load, Math.max(5, earthquakePollSec.value) * 1000);
}
watch(earthquakePollSec, startPolling);
onMounted(() => { load(); startPolling(); stream.on('earthquakeEvent', onEqEvent); });
onUnmounted(() => { if (pollTimer) window.clearInterval(pollTimer); stream.off('earthquakeEvent', onEqEvent); });

defineExpose({ reload: load, openSettings });
</script>

<style lang="scss" module>
.col { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.tickerWrap { flex-shrink: 0; margin: 8px 8px 0; }
.toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--MI_THEME-divider); flex-shrink: 0; }
.title { font-weight: 800; font-size: .9em; flex: 1; display: flex; align-items: center; gap: 5px; }
.tbBtn { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; color: var(--MI_THEME-fg); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.tbBtn:hover { background: var(--MI_THEME-buttonHoverBg); }
.body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 14px; }

.sec { display: flex; flex-direction: column; gap: 6px; }
.secHead { font-weight: 700; font-size: .85em; opacity: .85; display: flex; align-items: center; gap: 5px; }
.prefTag { margin-left: auto; font-size: .82em; font-weight: 700; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); padding: 0 7px; border-radius: 7px; }
.empty { opacity: .5; font-size: .82em; padding: 4px 0; }
.notice { font-size: .82em; opacity: .8; line-height: 1.6; }
.privacy { opacity: .6; font-size: .92em; }

.tsunamiBox { border: 2px solid; border-radius: 9px; overflow: hidden; }
.tsunamiHead { color: #fff; font-weight: 800; padding: 4px 10px; font-size: .9em; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.tsunamiBody { padding: 6px 10px; display: flex; flex-direction: column; gap: 3px; }
.tsunamiArea { font-size: .82em; }
.more { font-size: .78em; opacity: .6; }

.row { display: flex; gap: 8px; align-items: center; padding: 4px 2px; }
.badge { flex-shrink: 0; width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: .9em; }
.rowInfo { display: flex; flex-direction: column; min-width: 0; }
.rowHypo { font-weight: 700; font-size: .86em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rowMag { margin-left: 6px; font-size: .85em; opacity: .7; font-weight: 600; }
.rowTime { font-size: .74em; opacity: .6; }
.source { text-align: center; font-size: .72em; opacity: .5; margin-top: 4px; }
.disclaimer { text-align: center; font-size: .68em; opacity: .45; line-height: 1.4; padding: 0 6px; }
</style>
