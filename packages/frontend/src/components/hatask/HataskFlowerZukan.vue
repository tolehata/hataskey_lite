<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.card" :aria-label="copy.title" :data-motion="animations ? 'on' : 'off'">
	<header :class="$style.header">
		<div><h3>{{ copy.title }}</h3><p>{{ copy.overall }} {{ totalFound }}/48 · {{ seasonNames[selectedSeason] }} {{ foundCount(selectedSeason) }}/12</p></div>
		<i class="ti ti-layout-grid" aria-hidden="true"></i>
	</header>
	<div role="tablist" :aria-label="copy.season" :class="$style.tabs" @keydown="onTabKeydown">
		<button v-for="(item, index) in seasons" :key="item" :ref="el => setTab(el, index)" type="button" role="tab" :id="`${panelId}-${item}`" :aria-controls="panelId" :aria-selected="selectedSeason === item" :tabindex="selectedSeason === item ? 0 : -1" :class="[$style.tab, selectedSeason === item && $style.active]" @click="selectSeason(item)"><i :class="seasonIcons[item]" aria-hidden="true"></i>{{ seasonNames[item] }} <span>{{ foundCount(item) }}/12</span></button>
	</div>
	<div :class="$style.reward">
		<span :class="$style.rewardIcon"><i :class="reward.icon" aria-hidden="true"></i></span>
		<div :class="$style.rewardContent"><strong>{{ reward.title }}</strong><small>{{ reward.subtitle }}</small><div :class="$style.rewardTrack"><span :style="{ width: `${reward.percent}%` }"></span></div></div>
		<button v-if="reward.claimSeason" type="button" :disabled="busy" :class="$style.claim" @click="emit('claim', reward.claimSeason)"><i class="ti ti-gift" aria-hidden="true"></i>{{ copy.claimSeed }}</button>
	</div>
	<div :id="panelId" role="tabpanel" :aria-labelledby="`${panelId}-${selectedSeason}`" :aria-label="i18n.tsx._hata._hatask._flowerZukan.seasonCatalog({ season: seasonNames[selectedSeason] })" :class="$style.grid">
		<button v-for="item in slots" :key="item.id" type="button" :disabled="locked" :class="[$style.slot, !item.entry && $style.unknown, item.entry?.rare && $style.rare]" :aria-label="slotLabel(item)" aria-haspopup="dialog" @click="openDetail(item, $event)">
			<span v-if="item.entry?.id === newestEntryId" :class="$style.new">NEW</span><i v-if="item.entry?.rare" class="ti ti-sparkles" :class="$style.sparkle" :aria-label="copy.rare"></i>
			<span :class="$style.art"><i v-if="locked" class="ti ti-lock" aria-hidden="true"></i><HataskEmoji v-else :emoji="item.emoji" :class="!item.entry && $style.silhouette"/></span>
			<span :class="$style.name">{{ locked ? copy.waitingForSeed : item.entry ? (item.entry.nickname || localizeFloraName(item.entry.name)) : '？？？' }}</span>
			<small v-if="!locked">{{ item.entry ? dateLabel(item.entry.harvestedAt) : i18n.tsx._hata._hatask._flowerZukan.undiscoveredMeaning({ meaning: localizeHanakotoba(item.hanakotoba) }) }}</small>
			<span v-if="item.entry?.first || item.entry?.rank" :class="$style.first">{{ item.entry.first ? copy.first : i18n.tsx._hata._hatask._flowerZukan.rank({ rank: String(item.entry.rank) }) }}</span>
		</button>
	</div>
	<MkModal v-if="detail" ref="detailModal" preferType="popup" :anchorElement="detailSource" :returnFocusTo="detailSource" @click="closeDetail" @esc="closeDetail" @closed="detail = null">
		<section ref="detailPanel" role="dialog" aria-modal="true" :aria-labelledby="detailId" :class="$style.detail" :style="detailTheme" @keydown.esc.stop.prevent="closeDetail">
			<button type="button" :class="$style.close" :aria-label="i18n.ts.close" @click="closeDetail"><i class="ti ti-x" aria-hidden="true"></i></button>
			<div :class="$style.detailArt"><HataskEmoji :emoji="detail.emoji" :class="undiscovered ? $style.silhouette : undefined"/></div>
			<h4 :id="detailId">{{ undiscovered ? '？？？' : detail.nickname || localizeFloraName(detail.name) }}</h4>
			<p v-if="detail.nickname && detail.nickname !== detail.name" :class="$style.originalName">{{ localizeFloraName(detail.name) }}</p>
			<p v-if="undiscovered" :class="$style.originalName">{{ i18n.tsx._hata._hatask._flowerZukan.findInSeason({ season: seasonNames[detail.season] }) }}</p>
			<dl><div><dt>{{ copy.flowerMeaning }}</dt><dd>{{ localizeHanakotoba(detail.hanakotoba) }}</dd></div><div><dt>{{ copy.season }}</dt><dd>{{ seasonNames[detail.season] }}</dd></div><div v-if="!undiscovered"><dt>{{ copy.rarity }}</dt><dd>{{ detail.rare ? copy.rareMarked : copy.common }}</dd></div><div v-if="!undiscovered"><dt>{{ copy.onHataskey }}</dt><dd>{{ detail.rank ? i18n.tsx._hata._hatask._flowerZukan.rank({ rank: String(detail.rank) }) : '—' }}</dd></div><div v-if="!undiscovered"><dt>{{ copy.firstGrower }}</dt><dd>{{ detail.firstUser ? (detail.firstUser.name || `@${detail.firstUser.username}`) : '—' }}</dd></div><div v-if="!undiscovered"><dt>{{ copy.harvestDate }}</dt><dd>{{ dateLabel(detail.harvestedAt) }}</dd></div></dl>
			<div v-if="detail.memory?.length" :class="$style.memory"><strong>{{ copy.memories }}</strong><ul><li v-for="(text, index) in detail.memory.slice(0, 6)" :key="index">{{ text }}</li></ul></div>
			<template v-if="!undiscovered">
				<form v-if="editingName" :class="$style.renameForm" @submit.prevent="saveName">
					<label>{{ copy.rename }}<input ref="renameInput" v-model="draftName" maxlength="80" :disabled="renaming" autocomplete="off"/></label>
					<button type="submit" :class="$style.rename" :disabled="renaming || busy || !draftName.trim()">{{ copy.save }}</button>
					<button type="button" :class="$style.cancelRename" :disabled="renaming" @click="editingName = false">{{ i18n.ts.cancel }}</button>
				</form>
				<button v-else type="button" :class="$style.rename" :disabled="busy" @click="startRename"><i class="ti ti-pencil" aria-hidden="true"></i>{{ copy.rename }}</button>
				<p v-if="renameError" role="alert">{{ copy.renameFailed }}</p>
			</template>
		</section>
	</MkModal>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onDeactivated, ref, useId, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import MkModal from '@/components/MkModal.vue';
import type { HataskFlowerSeason } from '@/utility/hatask-flora.js';
import { renameHataskFlower } from '@/utility/hatask-flower-v2.js';
import { localizeFloraName, localizeHanakotoba } from '@/utility/hatask-flora.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

type Season = HataskFlowerSeason;
type CatalogItem = { id: string; season: Season; emoji: string; name: string; hanakotoba: string; rare: boolean };
type Entry = { id: string; speciesId: string; season: Season; emoji: string; name: string; hanakotoba: string; nickname?: string; rare: boolean; harvestedAt: string; memory?: string[]; rank?: number | null; first?: boolean; firstUser?: { id: string; name: string | null; username: string } | null };
export type HataskZukanData = { catalog: CatalogItem[]; entries: Entry[]; unlockedSeasons: Season[]; seedAvailable: Season[]; seedClaimed: Season[]; rareSeeds: Season[] };
const props = withDefaults(defineProps<{ zukan: HataskZukanData; season: Season; busy?: boolean; animations?: boolean }>(), { busy: false, animations: true });
const emit = defineEmits<{ claim: [season: Season] }>();
const copy = i18n.ts._hata._hatask._flowerZukan;
const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const seasonNames: Record<Season, string> = { spring: copy.spring, summer: copy.summer, autumn: copy.autumn, winter: copy.winter };
const seasonIcons: Record<Season, string> = { spring: 'ti ti-flower', summer: 'ti ti-sun', autumn: 'ti ti-leaf', winter: 'ti ti-snowflake' };
const selectedSeason = ref<Season>(props.season);
const detail = ref<Entry | null>(null);
const undiscovered = ref(false);
const editingName = ref(false), renaming = ref(false), renameError = ref(false);
const draftName = ref('');
const renameInput = ref<HTMLInputElement | null>(null);
const detailModal = ref<InstanceType<typeof MkModal> | null>(null);
const detailPanel = ref<HTMLElement | null>(null);
const detailTheme = ref<Record<string, string>>({});
const tabs: Array<HTMLButtonElement | null> = [];
const panelId = `hatask-zukan-panel-${useId()}`;
const detailId = `hatask-zukan-detail-${useId()}`;
let detailSource: HTMLElement | null = null;
watch(() => props.season, value => { selectedSeason.value = value; });
const unlocked = computed(() => props.zukan.unlockedSeasons.includes(selectedSeason.value));
const locked = computed(() => !unlocked.value);
const entryBySpecies = computed(() => new Map([...props.zukan.entries].reverse().map(entry => [entry.speciesId, entry])));
const slots = computed(() => props.zukan.catalog.filter(item => item.season === selectedSeason.value).slice(0, 12).map(item => ({ ...item, entry: entryBySpecies.value.get(item.id) })));
const catalogIds = computed(() => new Set(props.zukan.catalog.map(item => item.id)));
const totalFound = computed(() => new Set(props.zukan.entries.filter(entry => catalogIds.value.has(entry.speciesId)).map(entry => entry.speciesId)).size);
const newestEntryId = computed(() => [...props.zukan.entries].sort((a, b) => Date.parse(b.harvestedAt) - Date.parse(a.harvestedAt))[0]?.id);
function foundCount(season: Season): number { return new Set(props.zukan.entries.filter(entry => entry.season === season && catalogIds.value.has(entry.speciesId)).map(entry => entry.speciesId)).size; }
const reward = computed(() => {
	const index = seasons.indexOf(selectedSeason.value);
	const next = seasons[(index + 1) % 4];
	const count = foundCount(selectedSeason.value);
	const claimSeason = props.zukan.seedAvailable.includes(next) ? next : null;
	if (locked.value) return { icon: 'ti ti-lock', title: i18n.tsx._hata._hatask._flowerZukan.waitingForSeasonSeed({ season: seasonNames[selectedSeason.value] }), subtitle: copy.collectPreviousSeason, percent: 0, claimSeason: null };
	if (claimSeason) return { icon: 'ti ti-gift', title: i18n.tsx._hata._hatask._flowerZukan.seasonSeedArrived({ season: seasonNames[next] }), subtitle: '8/8', percent: 100, claimSeason };
	if (props.zukan.seedClaimed.includes(next)) return { icon: 'ti ti-circle-check', title: i18n.tsx._hata._hatask._flowerZukan.seasonSeedReceived({ season: seasonNames[next] }), subtitle: `${count}/12`, percent: count / 12 * 100, claimSeason: null };
	return { icon: 'ti ti-seeding', title: i18n.tsx._hata._hatask._flowerZukan.moreForSeasonSeed({ count: String(Math.max(0, 8 - count)), season: seasonNames[next] }), subtitle: `${count}/8`, percent: Math.min(100, count / 8 * 100), claimSeason: null };
});
function setTab(el: Element | ComponentPublicInstance | null, index: number): void { tabs[index] = el instanceof HTMLButtonElement ? el : null; }
function selectSeason(season: Season): void { selectedSeason.value = season; detail.value = null; }
function onTabKeydown(event: KeyboardEvent): void {
	const current = seasons.indexOf(selectedSeason.value);
	const next = event.key === 'ArrowRight' ? (current + 1) % 4 : event.key === 'ArrowLeft' ? (current + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : -1;
	if (next < 0) return;
	event.preventDefault(); selectSeason(seasons[next]); nextTick(() => tabs[next]?.focus());
}
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(versatileLang); }
function slotLabel(item: CatalogItem & { entry?: Entry }): string { return locked.value ? copy.waitingForSeed : item.entry ? i18n.tsx._hata._hatask._flowerZukan.discoveredSlot({ name: item.entry.nickname || localizeFloraName(item.entry.name), rarity: item.entry.rare ? copy.rareSuffix : '' }) : i18n.tsx._hata._hatask._flowerZukan.undiscoveredSlot({ meaning: localizeHanakotoba(item.hanakotoba) }); }
function openDetail(item: CatalogItem & { entry?: Entry }, event: MouseEvent): void { if (locked.value) return; editingName.value = false; renameError.value = false; undiscovered.value = !item.entry; detailSource = event.currentTarget as HTMLElement; const style = window.getComputedStyle(detailSource); detailTheme.value = Object.fromEntries(['--fg', '--fg-2', '--rule', '--masthead', '--accent', '--accent-ink', '--on-accent', '--htk-font-body'].map(token => [token, style.getPropertyValue(token)])); detail.value = item.entry ?? { ...item, speciesId: item.id, harvestedAt: '', memory: [] }; nextTick(() => detailPanel.value?.querySelector<HTMLButtonElement>('button')?.focus()); }
function startRename(): void {
	if (!detail.value || undiscovered.value || props.busy) return;
	draftName.value = detail.value.nickname || detail.value.name;
	editingName.value = true; renameError.value = false;
	void nextTick(() => renameInput.value?.focus());
}
async function saveName(): Promise<void> {
	if (!detail.value || undiscovered.value || renaming.value || props.busy || !draftName.value.trim()) return;
	const id = detail.value.id;
	renaming.value = true; renameError.value = false;
	try {
		const next = await renameHataskFlower(id, draftName.value.trim());
		if (detail.value?.id === id) {
			detail.value = next.zukan.entries.find(entry => entry.id === id) ?? detail.value;
			editingName.value = false;
		}
	} catch { renameError.value = true; }
	finally { renaming.value = false; }
}
function closeDetail(): void { if (!renaming.value) detailModal.value?.close(); }
onDeactivated(() => { detail.value = null; editingName.value = false; });
</script>

<style lang="scss" module>
.card { min-width:0; padding:14px 18px 16px; border:1px solid var(--rule,var(--MI_THEME-divider)); border-radius:var(--card-radius,24px); background:var(--surface,var(--MI_THEME-panel)); color:var(--fg,var(--MI_THEME-fg)); box-shadow:var(--shadow,none); container-type:inline-size; overflow-wrap:anywhere; }
.card button { font-family:inherit; cursor:pointer; }
.card button:focus-visible { outline:2px solid var(--accent,var(--MI_THEME-accent)); outline-offset:2px; }
.header { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:44px; margin-bottom:8px; }
.header h3 { margin:0; font:700 16px/1.5 var(--htk-font-head,inherit); }.header p { margin:2px 0 0; color:var(--fg-2,var(--MI_THEME-fg)); font-size:12px; }.header i { padding:10px; color:var(--fg-2,var(--MI_THEME-fg)); font-size:20px; }
.tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }.tab { display:inline-flex; align-items:center; gap:6px; min-height:38px; padding:0 14px; border:1px solid var(--rule,var(--MI_THEME-divider)); border-radius:999px; background:transparent; color:inherit; font-size:13px; font-weight:800; }.tab span { font-family:Archivo,sans-serif; opacity:.8; font-variant-numeric:tabular-nums; }.active { border-color:var(--accent,var(--MI_THEME-accent)); background:var(--accent,var(--MI_THEME-accent)); color:var(--on-accent,#fff); }
.reward { display:flex; align-items:center; flex-wrap:wrap; gap:12px 14px; padding:12px 14px; margin-bottom:14px; border:1px solid var(--rule,var(--MI_THEME-divider)); border-radius:16px; background:var(--masthead,var(--MI_THEME-panel)); }.rewardIcon { display:grid; place-items:center; flex:none; width:42px; height:42px; border-radius:50%; color:var(--accent-ink,var(--MI_THEME-accent)); background:var(--surface,var(--MI_THEME-panel)); font-size:22px; }.rewardContent { flex:1 1 160px; min-width:0; }.rewardContent strong,.rewardContent small { display:block; }.rewardContent strong { font-size:14px; }.rewardContent small { color:var(--fg-2,var(--MI_THEME-fg)); font-size:12px; }.rewardTrack { height:8px; margin-top:8px; overflow:hidden; border-radius:999px; background:color-mix(in srgb,var(--accent,var(--MI_THEME-accent)) 15%,transparent); }.rewardTrack span { display:block; height:100%; border-radius:inherit; background:var(--accent,var(--MI_THEME-accent)); transition:width .6s; }.claim { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:46px; padding:8px 18px; border:0; border-radius:999px; background:var(--accent,var(--MI_THEME-accent)); color:var(--on-accent,#fff); font-weight:800; }.claim:disabled { opacity:.6; cursor:wait; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:10px; }.slot { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; min-height:132px; padding:10px 6px 9px; border:1px solid var(--rule,var(--MI_THEME-divider)); border-radius:14px; background:color-mix(in srgb,var(--accent,var(--MI_THEME-accent)) 7%,var(--surface,var(--MI_THEME-panel))); color:inherit; text-align:center; }.slot:hover:not(:disabled) { border-color:var(--accent,var(--MI_THEME-accent)); }.slot:disabled { cursor:default; }.unknown { border-style:dashed; background:transparent; }.rare { border-color:var(--accent,var(--MI_THEME-accent)); box-shadow:0 0 14px color-mix(in srgb,var(--accent,var(--MI_THEME-accent)) 18%,transparent); }.art { display:grid; place-items:center; height:52px; font-size:40px; }.art i { font-size:26px; color:var(--fg-2,var(--MI_THEME-fg)); }.silhouette { filter:brightness(0); opacity:.14; }.name { font-size:12px; font-weight:700; line-height:1.4; }.slot small { text-wrap:balance; line-break:strict; color:var(--fg-2,var(--MI_THEME-fg)); font-size:11px; line-height:1.4; }.new { position:absolute; top:6px; left:6px; padding:0 6px; border-radius:999px; background:var(--accent,var(--MI_THEME-accent)); color:var(--on-accent,#fff); font-size:10px; font-weight:800; }.sparkle { position:absolute; top:6px; right:6px; color:var(--accent,var(--MI_THEME-accent)); }.first { margin-top:auto; padding:1px 7px; border-radius:999px; background:color-mix(in srgb,var(--accent,var(--MI_THEME-accent)) 15%,transparent); color:var(--accent-ink,var(--MI_THEME-accent)); font-size:10px; font-weight:800; }
.detail { box-sizing:border-box; position:relative; width:min(340px,calc(100dvw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; padding:20px; border:1px solid var(--rule,var(--MI_THEME-divider)); border-radius:20px; background:var(--masthead,var(--MI_THEME-panel)); color:var(--fg,var(--MI_THEME-fg)); box-shadow:0 20px 50px #0004; font-family:var(--htk-font-body,inherit); overflow-wrap:anywhere; }.close { position:absolute; top:8px; right:8px; width:44px; height:44px; border:0; border-radius:50%; background:transparent; color:inherit; text-align:center; }.detailArt { font-size:54px; text-align:center; }.detail h4 { margin:4px 44px 0; font-size:20px; text-align:center; }.originalName { margin:0 0 14px; color:var(--fg-2,var(--MI_THEME-fg)); text-align:center; }.detail dl { display:grid; gap:0; margin:16px 0; }.detail dl div { display:grid; grid-template-columns:minmax(70px, .8fr) minmax(0,1fr); gap:8px; padding:8px 0; border-top:1px solid var(--rule,var(--MI_THEME-divider)); }.detail dt { color:var(--fg-2,var(--MI_THEME-fg)); }.detail dd { margin:0; font-weight:700; }.memory { border-top:1px solid var(--rule,var(--MI_THEME-divider)); padding-top:12px; }.memory ul { margin:8px 0 0; padding-left:20px; }.memory li { margin:4px 0; }
.rename { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; margin-top:12px; padding:8px 18px; border:0; border-radius:999px; background:var(--accent); color:var(--on-accent); font:700 14px var(--htk-font-body,inherit); cursor:pointer; }.rename:disabled,.cancelRename:disabled { opacity:.55; cursor:default; }.renameForm { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }.renameForm label { display:grid; gap:6px; width:100%; font-size:12px; font-weight:700; }.renameForm input { box-sizing:border-box; width:100%; min-height:44px; padding:8px 14px; border:1px solid var(--rule); border-radius:999px; background:var(--masthead); color:var(--fg); font:inherit; font-size:14px; }.renameForm .rename { margin-top:0; }.cancelRename { min-height:44px; padding:8px 14px; border:1px solid var(--rule); border-radius:999px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
@container (max-width:420px) { .grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }.slot { min-height:116px; }.reward { gap:8px; }.claim { width:100%; } }
@media (prefers-reduced-motion:reduce) { .rewardTrack span { transition:none; } }
.card[data-motion='off'] .rewardTrack span { transition:none; }
</style>
