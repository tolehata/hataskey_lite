<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<MkContainer :naked="widgetProps.transparent" :showHeader="widgetProps.showHeader">
	<template #icon><i class="ti ti-flower"></i></template>
	<template #header>{{ copy.title }}</template>
	<template #func="{ buttonStyleClass }"><button class="_button" :class="buttonStyleClass" :aria-label="copy.openHatask" @click="goHatask"><i class="ti ti-external-link"></i></button></template>
	<div :class="$style.root">
		<div v-if="loading && !state" :class="$style.status" role="status">{{ copy.loading }}</div>
		<div v-else-if="error && !state" :class="$style.status" role="alert">{{ copy.loadFailed }}<button type="button" @click="loadFlowers">{{ i18n.ts._hata._hatask._planner.retry }}</button></div>
		<template v-else-if="state">
			<div :class="$style.growing">
				<button type="button" :class="$style.flowerLink" @click="goHatask">
					<span :class="$style.progressRing" :style="{ '--flower-progress': `${progress * 3.6}deg` }" role="progressbar" :aria-label="i18n.ts._hata._hatask._flowerCare.growth" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><span :class="$style.progressInner"><HataskEmoji :emoji="state.flower.emoji"/></span></span>
					<span :class="$style.growingText"><strong :class="$style.flowerName">{{ localizeFloraName(state.flower.name) }}</strong><span :class="$style.progressText"><b>{{ progress }}<small>%</small></b><span><i class="ti ti-hourglass" aria-hidden="true"></i>{{ remainingText }}</span></span></span>
				</button>
				<button type="button" :class="$style.pour" :disabled="busy || state.drops < 1 || progress >= 100" :aria-label="progress >= 100 ? copy.bloomed : i18n.tsx._hata._hatask._flowerWidget.waterDrops({ count: String(state.drops) })" @click="pour"><i class="ti ti-droplet-filled" aria-hidden="true"></i><span :class="$style.badge">{{ state.drops }}</span></button>
			</div>
			<div v-if="error" :class="$style.inlineError" role="alert">{{ copy.updateFailed }}<button type="button" @click="loadFlowers">{{ i18n.ts._hata._hatask._planner.retry }}</button></div>
			<div :class="$style.sources" :aria-label="i18n.ts._hata._hatask._dropSources.title">
				<span v-for="source in sources" :key="source.key" :class="$style.source" :title="source.label"><span><i :class="source.icon" aria-hidden="true"></i>{{ source.got }}/{{ source.cap }}</span><span :class="$style.sourceTrack"><span :style="{ width: `${source.cap ? Math.min(100, source.got / source.cap * 100) : 0}%` }"></span></span></span>
				<span :class="$style.reset" :title="copy.resetDaily"><i class="ti ti-clock" aria-hidden="true"></i>0:00</span>
			</div>
			<div :class="$style.divider"></div>
			<button type="button" :class="$style.zukanLink" :aria-label="i18n.tsx._hata._hatask._flowerWidget.openCatalog({ season: seasonName, count: String(foundCount) })" @click="goHatask">
				<i class="ti ti-leaf" aria-hidden="true"></i><span :class="$style.zukanTrack"><span :style="{ width: `${foundCount / 12 * 100}%` }"></span><span :class="$style.seed" :title="seedTitle"><i :class="seedIcon" aria-hidden="true"></i></span></span><strong>{{ foundCount }}<small>/12</small></strong>
			</button>
			<div :class="$style.flowerList" :aria-label="i18n.tsx._hata._hatask._flowerWidget.catalogTwelve({ season: seasonName })"><button v-for="item in slots" :key="item.id" type="button" :class="[$style.flowerChip, !item.entry && $style.unknown]" :title="item.entry ? item.entry.nickname || localizeFloraName(item.entry.name) : copy.undiscovered" :aria-label="item.entry ? i18n.tsx._hata._hatask._flowerZukan.discoveredSlot({ name: item.entry.nickname || localizeFloraName(item.entry.name), rarity: item.entry.rare ? i18n.ts._hata._hatask._flowerZukan.rareSuffix : '' }) : i18n.tsx._hata._hatask._flowerZukan.undiscoveredSlot({ meaning: localizeHanakotoba(item.hanakotoba) })" @click="goHatask"><HataskEmoji :emoji="item.emoji" :class="!item.entry && $style.silhouette"/><i v-if="item.entry?.rare" class="ti ti-sparkles" :class="$style.sparkle" :aria-label="i18n.ts._hata._hatask._flowerZukan.rare"></i><span v-if="item.entry?.id === newestEntryId" :class="$style.new" :aria-label="copy.newFlower"></span></button></div>
		</template>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import type { HataskFlowerSeason } from '@/utility/hatask-flora.js';
import type { HataskFlowerState } from '@/utility/hatask-flower-v2.js';
import MkContainer from '@/components/MkContainer.vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import { useRouter } from '@/router.js';
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';
import { getHataskFlowerState, pourHataskFlower, HATASK_FLOWER_STATE_EVENT } from '@/utility/hatask-flower-v2.js';
import { getHataskFlowerSeason, localizeFloraName, localizeHanakotoba } from '@/utility/hatask-flora.js';
import { i18n } from '@/i18n.js';

const name = 'hataskFlowers';
const copy = i18n.ts._hata._hatask._flowerWidget;
const widgetPropsDef = { transparent: { type: 'boolean', default: false }, showHeader: { type: 'boolean', default: true } } satisfies FormWithDefault;
type WidgetProps = GetFormResultType<typeof widgetPropsDef>;
const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const { widgetProps, configure } = useWidgetPropsManager(name, widgetPropsDef, props, emit);
const router = useRouter();
const state = ref<HataskFlowerState | null>(null);
const loading = ref(true);
const busy = ref(false);
const error = ref(false);
let refreshTimer: number | null = null;
const season = computed<HataskFlowerSeason>(() => state.value?.festival.season ?? getHataskFlowerSeason());
const seasonName = computed(() => i18n.ts._hata._hatask._flowerZukan[season.value]);
const progress = computed(() => state.value?.flower.progress ?? 0);
const remainingText = computed(() => { if (!state.value || progress.value >= 100) return copy.bloomedShort; const minutes = Math.max(0, state.value.flower.targetMinutes - state.value.flower.totalMinutes); return minutes < 60 ? copy.soon : i18n.tsx._hata._hatask._flowerWidget.hoursShort({ hours: String(Math.ceil(minutes / 60)) }); });
const sources = computed(() => ([
	{ key: 'todo' as const, label: 'Hatask ToDo', icon: 'ti ti-checkbox', got: state.value?.today.todo ?? 0, cap: state.value?.caps.todo ?? 5 },
	{ key: 'hatady' as const, label: 'Hatady', icon: 'ti ti-notebook', got: state.value?.today.hatady ?? 0, cap: state.value?.caps.hatady ?? 10 },
	{ key: 'login' as const, label: i18n.ts._hata._hatask._dropSources.login, icon: 'ti ti-login', got: state.value?.today.login ?? 0, cap: state.value?.caps.login ?? 1 },
]));
const entries = computed(() => state.value?.zukan.entries ?? []);
const foundCount = computed(() => new Set(entries.value.filter(item => item.season === season.value && state.value?.zukan.catalog.some(species => species.id === item.speciesId)).map(item => item.speciesId)).size);
const entryBySpecies = computed(() => new Map([...entries.value].reverse().map(item => [item.speciesId, item])));
const slots = computed(() => (state.value?.zukan.catalog ?? []).filter(item => item.season === season.value).slice(0, 12).map(item => ({ ...item, entry: entryBySpecies.value.get(item.id) })));
const newestEntryId = computed(() => [...entries.value].sort((a, b) => Date.parse(b.harvestedAt) - Date.parse(a.harvestedAt))[0]?.id);
const nextSeason = computed<HataskFlowerSeason>(() => ({ spring: 'summer', summer: 'autumn', autumn: 'winter', winter: 'spring' })[season.value] as HataskFlowerSeason);
const seedIcon = computed(() => state.value?.zukan.seedClaimed.includes(nextSeason.value) ? 'ti ti-check' : state.value?.zukan.seedAvailable.includes(nextSeason.value) ? 'ti ti-gift' : 'ti ti-seeding');
const seedTitle = computed(() => foundCount.value >= 8 ? copy.nextSeasonSeed : copy.seedAfterEight);
async function loadFlowers(): Promise<void> { try { state.value = await getHataskFlowerState(); error.value = false; } catch { error.value = true; } finally { loading.value = false; } }
async function pour(): Promise<void> { if (busy.value || !state.value || state.value.drops < 1 || progress.value >= 100) return; busy.value = true; try { state.value = await pourHataskFlower('self'); error.value = false; } catch { error.value = true; } finally { busy.value = false; } }
// 旗鯖fork: 単独の Hatask 画面は廃止したので、HataGoes の中の Hatask のおはなを開く。
function goHatask(): void { router.pushByPath(hatagoesUrl('/hatask?tab=garden')); }
function onVisibilityChange(): void { if (!window.document.hidden) void loadFlowers(); }
function onState(event: Event): void { const next = (event as CustomEvent<HataskFlowerState>).detail; if (next) { state.value = next; error.value = false; loading.value = false; } else void loadFlowers(); }
onMounted(() => { void loadFlowers(); refreshTimer = window.setInterval(() => void loadFlowers(), 60_000); window.document.addEventListener('visibilitychange', onVisibilityChange); window.addEventListener(HATASK_FLOWER_STATE_EVENT, onState); });
onUnmounted(() => { if (refreshTimer != null) window.clearInterval(refreshTimer); window.document.removeEventListener('visibilitychange', onVisibilityChange); window.removeEventListener(HATASK_FLOWER_STATE_EVENT, onState); });
defineExpose<WidgetComponentExpose>({ name, configure, get id() { return props.widget?.id ?? null; } });
</script>

<style lang="scss" module>
.root { display:grid; gap:10px; padding:12px; min-width:0; container-type:inline-size; color:var(--MI_THEME-fg); }.root button { cursor:pointer; }.root button:focus-visible { outline:2px solid var(--MI_THEME-accent); outline-offset:2px; }.status { padding:12px; font-size:.85em; }.status button,.inlineError button { border:0; background:none; color:var(--MI_THEME-accent); text-decoration:underline; }.inlineError { font-size:.75em; }
.growing { display:grid; grid-template-columns:minmax(0,1fr) 52px; align-items:center; gap:12px; }.flowerLink { display:grid; grid-template-columns:76px minmax(0,1fr); align-items:center; gap:12px; min-width:0; padding:0; border:0; background:none; color:inherit; text-align:left; }.progressRing { display:grid; place-items:center; width:76px; height:76px; border-radius:50%; background:conic-gradient(var(--MI_THEME-accent) var(--flower-progress),color-mix(in srgb,var(--MI_THEME-accent) 13%,var(--MI_THEME-panel)) 0); }.progressInner { display:grid; place-items:center; width:62px; height:62px; border-radius:50%; background:var(--MI_THEME-panel); font-size:34px; }.growingText { display:grid; gap:4px; min-width:0; }.flowerName { overflow:hidden; font-size:15px; text-overflow:ellipsis; white-space:nowrap; }.progressText { display:flex; align-items:baseline; flex-wrap:wrap; gap:10px; font-variant-numeric:tabular-nums; }.progressText b { font-size:22px; line-height:1; }.progressText small { font-size:12px; }.progressText > span { display:inline-flex; align-items:center; gap:3px; font-size:13px; opacity:.7; }.pour { position:relative; display:grid; place-items:center; width:52px; height:52px; border:0; border-radius:50%; background:var(--MI_THEME-accent); color:var(--MI_THEME-fgOnAccent,#fff); font-size:24px; }.pour:disabled { opacity:.5; cursor:not-allowed; }.badge { position:absolute; right:-4px; bottom:-4px; display:grid; place-items:center; min-width:22px; height:22px; padding:0 4px; border-radius:999px; background:var(--MI_THEME-panel); color:var(--MI_THEME-fg); box-shadow:0 0 0 2px var(--MI_THEME-accent); font-size:12px; font-weight:800; }
.sources { display:flex; align-items:center; gap:6px; min-width:0; padding:6px; border-radius:12px; background:color-mix(in srgb,var(--MI_THEME-accent) 6%,var(--MI_THEME-panel)); }.source { display:grid; justify-items:center; gap:4px; flex:1; min-width:0; padding:4px 2px; font-size:12px; font-weight:800; font-variant-numeric:tabular-nums; }.source > span:first-child { display:flex; align-items:center; gap:3px; white-space:nowrap; }.source i { font-size:15px; opacity:.65; }.sourceTrack { width:100%; max-width:56px; height:4px; overflow:hidden; border-radius:999px; background:color-mix(in srgb,var(--MI_THEME-accent) 15%,transparent); }.sourceTrack span { display:block; height:100%; background:var(--MI_THEME-accent); }.reset { display:flex; align-items:center; gap:2px; flex:none; padding:0 2px; font-size:11px; opacity:.7; }.divider { height:1px; background:var(--MI_THEME-divider); }.zukanLink { display:flex; align-items:center; gap:8px; width:100%; min-height:32px; padding:0; border:0; background:none; color:inherit; text-align:left; }.zukanLink > i { color:var(--MI_THEME-accent); font-size:17px; }.zukanTrack { position:relative; flex:1; height:8px; border-radius:999px; background:color-mix(in srgb,var(--MI_THEME-accent) 13%,transparent); }.zukanTrack > span:first-child { display:block; height:100%; border-radius:inherit; background:var(--MI_THEME-accent); }.seed { position:absolute; top:50%; left:66.666%; display:grid; place-items:center; width:22px; height:22px; transform:translate(-50%,-50%); border-radius:50%; background:var(--MI_THEME-panel); color:var(--MI_THEME-accent); box-shadow:0 0 0 2px var(--MI_THEME-accent); font-size:13px; }.zukanLink strong { font-size:13px; font-variant-numeric:tabular-nums; }.zukanLink small { opacity:.6; }.flowerList { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:5px; }.flowerChip { position:relative; display:grid; place-items:center; min-width:0; aspect-ratio:1; padding:2px; border:1px solid color-mix(in srgb,var(--MI_THEME-accent) 16%,var(--MI_THEME-divider)); border-radius:10px; background:color-mix(in srgb,var(--MI_THEME-accent) 7%,var(--MI_THEME-panel)); color:inherit; font-size:clamp(14px,5cqw,28px); }.unknown { border-style:dashed; background:transparent; }.silhouette { filter:brightness(0); opacity:.14; }.sparkle { position:absolute; top:1px; right:1px; color:var(--MI_THEME-accent); font-size:10px; }.new { position:absolute; top:-3px; left:-3px; width:9px; height:9px; border-radius:50%; background:var(--MI_THEME-accent); box-shadow:0 0 0 2px var(--MI_THEME-panel); }
@container (max-width:250px) { .growing { grid-template-columns:minmax(0,1fr) 44px; gap:4px; }.flowerLink { grid-template-columns:56px minmax(0,1fr); gap:6px; }.progressRing { width:56px; height:56px; }.progressInner { width:46px; height:46px; font-size:25px; }.pour { width:44px; height:44px; }.reset { font-size:10px; }.source { font-size:10px; } }
</style>
