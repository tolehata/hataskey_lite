<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
HataSideStudio のサイドメニュー専用。履歴一覧を持たず、最新状況だけを表示する。
-->
<template>
<button type="button" :class="$style.root" :data-size="props.size" @click="router.push('/earthquake')">
	<div v-if="activeTsunami.length" :class="$style.tsunami" :style="{ background: tsunamiGradeColor(tsunamiMaxGrade) }"><i class="ti ti-wave-sine"></i>{{ tsunamiGradeLabel(tsunamiMaxGrade) }}発表中</div>
	<MkEarthquakeTicker v-if="rawQuakes.length" :quakes="rawQuakes" :tsunami="tsunami" mode="compact" :class="$style.ticker"/>
	<div v-else :class="$style.empty"><i class="ti ti-activity-heartbeat"></i><span><b>地震・津波情報</b><small>{{ loading ? '最新情報を確認中…' : '現在表示する情報はありません' }}</small></span></div>
</button>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MkEarthquakeTicker from '@/components/MkEarthquakeTicker.vue';
import { useRouter } from '@/router.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { pruneOld, tsunamiGradeColor, tsunamiGradeLabel } from '@/utility/earthquake.js';

const props = defineProps<{ size: 'small' | 'normal' | 'large' }>();
const router = useRouter();
const stream = useStream();
const rawQuakes = ref<any[]>([]);
const tsunami = ref<any[]>([]);
const loading = ref(true);
let pollTimer: number | null = null;
const activeTsunami = computed(() => {
	const latest = [...tsunami.value].filter(item => Array.isArray(item?.areas)).sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? '')))[0];
	return latest && latest.cancelled !== true && latest.areas.length > 0 ? [latest] : [];
});
const gradeOrder: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1, Unknown: 0 };
const tsunamiMaxGrade = computed(() => activeTsunami.value.flatMap(item => item.areas ?? []).reduce((best: string, area: any) => (gradeOrder[area.grade] ?? 0) > (gradeOrder[best] ?? 0) ? area.grade : best, 'Unknown'));

async function load() {
	try {
		const [quakes, waves] = await Promise.all([
			misskeyApi('hata/earthquake/history', { limit: 20 }),
			misskeyApi('hata/earthquake/tsunami', { limit: 10 }),
		]);
		rawQuakes.value = pruneOld((quakes as any[]) ?? []);
		tsunami.value = pruneOld((waves as any[]) ?? []);
	} catch {
		// 前回値を保つ。
	} finally {
		loading.value = false;
	}
}

function onEvent(event: { code: number; item: any }) {
	if (event.code === 551) rawQuakes.value = pruneOld([event.item, ...rawQuakes.value]).slice(0, 40);
	if (event.code === 552) tsunami.value = pruneOld([event.item, ...tsunami.value]).slice(0, 20);
}

onMounted(() => {
	void load();
	pollTimer = window.setInterval(() => void load(), 60_000);
	stream.on('earthquakeEvent', onEvent);
});

onUnmounted(() => {
	if (pollTimer != null) window.clearInterval(pollTimer);
	stream.off('earthquakeEvent', onEvent);
});
</script>

<style lang="scss" module>
.root { display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:5px;width:100%;height:auto;min-height:var(--hss-widget-height,var(--hss-widget-min-height,82px));padding:0;box-sizing:border-box;color:inherit;border:0;background:transparent;text-align:left;cursor:pointer;overflow:hidden; }
.ticker { flex:1 1 auto;width:100%!important;min-width:0;min-height:110px;transform:none; }
.tsunami { display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 8px;color:#fff;border-radius:8px;font-size:.75rem;font-weight:800; }
.empty { display:flex;flex:1 1 auto;align-items:center;justify-content:center;gap:9px;width:100%;min-height:68px;text-align:left; }.empty > i { font-size:24px;color:var(--MI_THEME-accent); }.empty > span { display:grid; }.empty b { font-size:.8rem; }.empty small { font-size:.68rem;opacity:.64; }
.root[data-size="small"] .empty { min-height:58px; }
</style>
