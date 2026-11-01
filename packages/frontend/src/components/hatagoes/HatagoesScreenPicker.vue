<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.picker" role="dialog" aria-modal="true" aria-labelledby="hatagoes-screens-heading">
	<header><div :class="$style.heading"><small><HataAppWordmark app="hatagoes" :onDark="monochrome"/></small><h1 id="hatagoes-screens-heading">{{ title }}</h1></div><div :class="$style.headerActions"><button v-if="inlineReorder" type="button" :aria-expanded="editingOrder" aria-controls="hatagoes-pin-order" :aria-label="editingOrder ? 'ピンの編集を完了' : 'ピンを編集'" :title="editingOrder ? 'ピンの編集を完了' : 'ピンを編集'" @click="editingOrder = !editingOrder"><i :class="editingOrder ? 'ti ti-check' : 'ti ti-pencil'" aria-hidden="true"></i></button><button type="button" aria-label="一覧を閉じる" @click="emit('close')"><i class="ti ti-x" aria-hidden="true"></i></button></div></header>
	<label :class="$style.search"><i class="ti ti-search" aria-hidden="true"></i><input v-model="query" type="search" placeholder="アプリをさがす" aria-label="アプリをさがす"/></label>
	<section v-if="inlineReorder && editingOrder" id="hatagoes-pin-order" aria-label="ピン留め中" :class="$style.order"><h2>{{ pinLabel }} <small>{{ displayPins.length }}/{{ pinLimit }}</small></h2>
		<ol><li v-for="(id, index) in displayPins" :key="id"><span>{{ screens.find(screen => screen.id === id)?.label ?? '利用できない画面' }}<small v-if="fixedPinIds.includes(id)">固定</small></span>
			<button type="button" :disabled="!ready || saving || index === 0 || fixedPinIds.includes(id) || fixedPinIds.includes(displayPins[index - 1])" :aria-label="`${pinName(id)}を上へ`" @click="movePin(index, -1)"><i class="ti ti-chevron-up" aria-hidden="true"></i></button>
			<button type="button" :disabled="!ready || saving || index === displayPins.length - 1 || fixedPinIds.includes(id) || fixedPinIds.includes(displayPins[index + 1])" :aria-label="`${pinName(id)}を下へ`" @click="movePin(index, 1)"><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
		</li></ol>
	</section>
	<p v-if="showNavigationPins && (!inlineReorder || editingOrder)" :class="$style.hint">{{ inlineReorder ? 'Hatask のナビに表示する項目を選び、順番を変更できます。' : 'ピンを押すとナビに追加・解除できます。' }}</p>
	<p v-if="message" role="status">{{ message }}</p>
	<p v-if="!filtered.length" role="status">一致するアプリがありません</p>
	<section v-for="app in applications" :key="app.id" :aria-label="app.label">
		<h2 :class="app.id === 'hatask-app' || app.id === 'hataskey' ? $style.brandHeading : undefined"><HataAppLogo v-if="app.id === 'hatask' || app.id === 'hatady' || app.id === 'hatafeed'" :app="app.id" :size="18" :monochrome="monochrome"/><i v-else :class="app.icon" aria-hidden="true"></i><HataAppWordmark v-if="app.id === 'hatask' || app.id === 'hatady' || app.id === 'hatafeed'" :app="app.id" :onDark="monochrome"/><template v-else>{{ app.label }}</template></h2>
		<div :class="$style.grid">
			<div v-for="screen in filtered.filter(item => displayGroup(item) === app.id)" :key="screen.id" :class="$style.tile">
				<button type="button" :class="$style.destination" :aria-label="screen.label" @pointerdown="startPress($event, screen)" @pointermove="movePress" @pointerup="cancelTimer" @pointercancel="cancelPress" @pointerleave="cancelTimer" @contextmenu.prevent="choose(screen)" @keydown.shift.f10.prevent="choose(screen)" @click="open(screen)"><HataFeatureIcon v-if="hataFeatureForScreen(screen.id)" :feature="hataFeatureForScreen(screen.id)!" :size="60" :mode="monochrome ? 'mono-dark' : 'color'"/><i v-else :class="screen.icon" aria-hidden="true"></i><span>{{ screen.label }}</span></button>
				<button v-if="(!inlineReorder || editingOrder) && canPin(screen.id) && !fixedPinIds.includes(screen.id)" type="button" :class="$style.pin" :disabled="!ready || saving || (!displayPins.includes(screen.id) && displayPins.length >= pinLimit)" :aria-pressed="displayPins.includes(screen.id)" :aria-label="`${screen.label}を${pinLabel}${displayPins.includes(screen.id) ? 'から外す' : 'に追加'}`" :title="displayPins.includes(screen.id) ? `${pinLabel}から外す` : `${pinLabel}に追加`" @click="togglePin(screen.id)"><i :class="displayPins.includes(screen.id) ? 'ti ti-pinned-filled' : 'ti ti-pin'" aria-hidden="true"></i><span>{{ displayPins.includes(screen.id) ? '解除' : '追加' }}</span></button><span v-else-if="(!inlineReorder || editingOrder) && fixedPinIds.includes(screen.id)" :class="$style.fixedPin" aria-label="固定ピン" title="固定ピン"><i class="ti ti-pinned-filled" aria-hidden="true"></i><span>固定</span></span>
				<span v-if="displayAppPins.includes(screen.id)" :class="$style.appPin">＋に固定</span>
			</div>
		</div>
	</section>
	<footer v-if="showNavigationPins"><span>{{ pinLabel }} {{ displayPins.length }}/{{ pinLimit }}</span><button v-if="!inlineReorder" type="button" :class="$style.footerSettings" aria-label="ナビの並べ替えと設定" title="ナビの並べ替えと設定" @click="emit('editPins')"><i class="ti ti-arrows-sort" aria-hidden="true"></i></button></footer>
	<Transition :enterActiveClass="$style.choiceEnter" :leaveActiveClass="$style.choiceLeave" :enterFromClass="$style.choiceHidden" :leaveToClass="$style.choiceHidden">
	<div v-if="selected" :class="$style.choices" role="group" :aria-label="`${selected.label}の操作`" @keydown.esc.stop.prevent="selected = null">
		<strong>{{ selected.label }}</strong>
		<button v-if="(!inlineReorder || editingOrder) && canPin(selected.id)" type="button" :disabled="!ready || saving || fixedPinIds.includes(selected.id) || (!displayPins.includes(selected.id) && displayPins.length >= pinLimit)" @click="togglePin(selected.id); selected = null">{{ displayPins.includes(selected.id) ? `${pinLabel}から外す` : `${pinLabel}に追加` }}</button>
		<button v-if="isApp(selected.id)" type="button" :disabled="!ready || saving || (!displayAppPins.includes(selected.id) && displayAppPins.length >= 8)" @click="toggleAppPin(selected.id)">{{ displayAppPins.includes(selected.id) ? '＋の固定から外す' : '＋にピン留め' }}</button>
		<button type="button" @click="selected = null">閉じる</button>
	</div>
	</Transition>
</section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';
import { getHatagoesScreen, isHatagoesVisibleScreen } from '@/utility/hatagoes-catalog.js';
import { getHatagoesAppPinCandidates } from '@/utility/hatagoes-app-pins.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { hataFeatureForScreen } from '@/utility/hata-feature-icon.js';
import HataAppWordmark from '@/components/HataAppWordmark.vue';

const props = withDefaults(defineProps<{ title?: string; screens: readonly HatagoesCatalogEntry[]; pins: readonly string[]; appPins?: readonly string[]; ready?: boolean; saving?: boolean; pinLimit?: number; pinLabel?: string; fixedPinIds?: readonly string[]; inlineReorder?: boolean; pinnableIds?: readonly string[]; showNavigationPins?: boolean; monochrome?: boolean }>(), { title: '全てのアプリ', appPins: () => [], ready: true, saving: false, pinLimit: 5, pinLabel: 'ナビ', fixedPinIds: () => [], inlineReorder: false, showNavigationPins: true, monochrome: false });
const emit = defineEmits<{ open: [screen: HatagoesCatalogEntry]; close: []; savePins: [pins: string[]]; saveAppPins: [pins: string[]]; editPins: [] }>();
const query = ref('');
const message = ref('');
const selected = ref<HatagoesCatalogEntry | null>(null);
const editingOrder = ref(false);
const filtered = computed(() => props.screens.filter(isHatagoesVisibleScreen).filter(screen => `${screen.app} ${screen.label}`.normalize('NFKC').toLowerCase().includes(query.value.trim().normalize('NFKC').toLowerCase())));
const candidates = computed(() => getHatagoesAppPinCandidates(props.screens));
const displayPins = computed(() => props.pins.filter(id => { const screen = getHatagoesScreen(id); return !screen || isHatagoesVisibleScreen(screen); }));
const displayAppPins = computed(() => props.appPins.filter(id => { const screen = getHatagoesScreen(id); return !screen || isHatagoesVisibleScreen(screen); }));

function displayGroup(screen: HatagoesCatalogEntry): string {
  if (screen.app !== 'hatask') return screen.app;
  if (screen.id === 'hatask.apps' || screen.id === 'hatask.tools') return 'hatask';
  return candidates.value.find(item => item.id === screen.id)?.group === 'hatask' ? 'hatask-app' : (candidates.value.find(item => item.id === screen.id) ? 'hataskey' : 'hatask');
}

const applications = computed(() => [
  { id: 'hatask', label: 'Hatask', icon: 'ti ti-checklist' },
  { id: 'hatask-app', label: 'Hatask App', icon: 'ti ti-layout-grid' },
  { id: 'hataskey', label: 'Hataskey App', icon: 'ti ti-apps' },
  { id: 'hatady', label: 'Hatady', icon: 'ti ti-book-2' },
  { id: 'hatafeed', label: 'HataFeed', icon: 'ti ti-message-report' },
].filter(app => filtered.value.some(screen => displayGroup(screen) === app.id)));
const candidateIds = computed(() => new Set<string>(candidates.value.map(screen => screen.id)));
let timer: number | undefined;
let pressed = false;
let point = { x: 0, y: 0 };

function isApp(id: string) { return candidateIds.value.has(id); }

function canPin(id: string) { return props.showNavigationPins && (!props.pinnableIds || props.pinnableIds.includes(id)); }

function pinName(id: string) { return props.screens.find(screen => screen.id === id)?.label ?? getHatagoesScreen(id)?.label ?? '利用できない画面'; }

function cancelTimer() { window.clearTimeout(timer); }

function cancelPress() { cancelTimer(); pressed = false; }

function startPress(event: PointerEvent, screen: HatagoesCatalogEntry) {
	cancelPress();
	if (event.button !== 0) return;
	point = { x: event.clientX, y: event.clientY };
	timer = window.setTimeout(() => { pressed = true; selected.value = screen; }, 550);
}

function movePress(event: PointerEvent) {
	if (Math.hypot(event.clientX - point.x, event.clientY - point.y) > 10) cancelTimer();
}

function choose(screen: HatagoesCatalogEntry) { cancelTimer(); pressed = true; selected.value = screen; }

function open(screen: HatagoesCatalogEntry) {
	if (pressed) { pressed = false; return; }
	selected.value = null;
	emit('open', screen);
}

function togglePin(id: string) {
	if (!props.ready || props.saving || props.fixedPinIds.includes(id) || !canPin(id)) return;
	if (!displayPins.value.includes(id) && displayPins.value.length >= props.pinLimit) { message.value = `${props.pinLabel}は${props.pinLimit}画面までです`; return; }
	emit('savePins', displayPins.value.includes(id) ? displayPins.value.filter(value => value !== id) : [...displayPins.value, id]);
}

function movePin(index: number, delta: number) {
	if (!props.ready || props.saving) return;
	const next = [...displayPins.value];
	const other = index + delta;
	if (other < 0 || other >= next.length) return;
	if (props.fixedPinIds.includes(next[index]) || props.fixedPinIds.includes(next[other])) return;
	[next[index], next[other]] = [next[other], next[index]];
	emit('savePins', next);
}

function toggleAppPin(id: string) {
	if (!props.ready || props.saving || !isApp(id)) return;
	if (!displayAppPins.value.includes(id) && displayAppPins.value.length >= 8) { message.value = '＋に固定するAppは8つまでです'; return; }
	emit('saveAppPins', displayAppPins.value.includes(id) ? displayAppPins.value.filter(value => value !== id) : [...displayAppPins.value, id]);
	selected.value = null;
}

onBeforeUnmount(cancelTimer);
</script>

<style module>
.picker { position: relative; width: min(780px, calc(100dvw - 24px)); max-height: min(86dvh, 900px); overflow-y: auto; padding: 22px; box-sizing: border-box; background: var(--surface, var(--MI_THEME-panel)); color: var(--fg, var(--MI_THEME-fg)); border-radius: var(--card-radius, 24px); }
.picker header { display: grid; grid-template-columns: minmax(88px, 1fr) minmax(0, 2fr) minmax(88px, 1fr); align-items: center; }
.heading { grid-column: 2; min-width: 0; text-align: center; }
.headerActions { grid-column: 3; display: flex; align-items: center; justify-self: end; gap: 6px; }
.headerActions button:first-child:not(:last-child) { width: 40px; min-height: 40px; padding: 0; border: 2px solid var(--rule, var(--MI_THEME-divider)); border-radius: 50%; font-size: 19px; }
.picker h1 { margin: 3px 0 14px; font: 800 22px var(--htk-font-head, sans-serif); overflow-wrap: anywhere; }
.picker h2 { display: flex; gap: 8px; align-items: center; margin: 24px 0 12px; font-size: 15px; }
.brandHeading { font-family: Righteous, var(--htk-font-head, sans-serif); font-weight: 400; font-synthesis: none; }
.picker button { border: 0; border-radius: var(--control-radius, 12px); background: transparent; color: inherit; font: inherit; cursor: pointer; min-height: 44px; }
.picker button:focus-visible, .picker input:focus-visible { outline: 2px solid var(--accent, var(--MI_THEME-accent)); outline-offset: 2px; }
.picker button:disabled { opacity: .45; cursor: default; }
.picker header button { width: 44px; font-size: 20px; }
.search { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--rule, var(--MI_THEME-divider)); border-radius: var(--control-radius, 14px); }
.picker .search:focus-within { outline: 2px solid var(--accent, var(--MI_THEME-accent)); outline-offset: 2px; }
.search input { width: 100%; min-width: 0; border: 0; background: transparent; color: inherit; font: inherit; }
.picker .search input:focus-visible { outline: none; }
.hint, .picker small { color: var(--fg-2, var(--MI_THEME-fgTransparent)); font-size: 12px; }
.order ol { margin: 0; padding: 0; list-style: none; border: 1px solid var(--rule, var(--MI_THEME-divider)); border-radius: 12px; overflow: hidden; }
.order li { display: flex; align-items: center; gap: 6px; min-height: 48px; padding: 4px 10px; }
.order li + li { border-top: 1px solid var(--rule, var(--MI_THEME-divider)); }
.order li span { flex: 1; }
.order li button { width: 40px; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 8px; }
.tile { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.destination { display: flex; flex: 1; width: 100%; flex-direction: column; align-items: center; gap: 6px; padding: 0; font-size: 11px !important; font-weight: 800 !important; text-align: center; }
.destination i { display: grid; place-items: center; width: 60px; height: 60px; border-radius: min(var(--card-radius, 20px), 20px); background: var(--MI_THEME-buttonBg); font-size: 26px; color: var(--accent-ink, var(--MI_THEME-accent)); }
.destination span { max-width: 100%; line-height: 1.35; overflow-wrap: anywhere; }
.pin, .fixedPin { position: absolute; top: -8px; right: max(0px, calc((100% - 66px)/2 - 7px)); display: flex; align-items: center; justify-content: center; gap: 3px; min-width: 42px; min-height: 28px !important; padding: 2px 5px; border: 1px solid var(--rule, var(--MI_THEME-divider)) !important; border-radius: 999px; background: var(--surface, var(--MI_THEME-panel)) !important; color: var(--accent-ink, var(--MI_THEME-accent)); font-size: 13px !important; box-shadow: 0 2px 6px rgb(0 0 0 / 8%); }
.fixedPin { opacity: .7; }
.pin span, .fixedPin span { font-size: 10px; font-weight: 700; white-space: nowrap; }
.pin[aria-pressed=true], .appPin { color: var(--accent-ink, var(--MI_THEME-accent)); }
.appPin { text-align: center; font-size: 10px; }
.picker footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 20px; border-top: 1px solid var(--rule, var(--MI_THEME-divider)); font-size: 12px; }
.picker footer .footerSettings { display: grid; place-items: center; width: 38px; min-height: 38px; border-radius: 50%; font-size: 19px; }
.choices { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; border: 1px solid var(--rule, var(--MI_THEME-divider)); border-radius: var(--card-radius, 16px); background: var(--surface, var(--MI_THEME-panel)); box-shadow: var(--shadow); }
.choices strong { flex-basis: 100%; }
.choices button { padding: 6px 12px; background: var(--MI_THEME-buttonBg); }
.choiceEnter { transition: opacity 160ms ease, transform 160ms ease; }
.choiceLeave { transition: opacity 120ms ease, transform 120ms ease; pointer-events: none; }
.choiceHidden { opacity: 0; transform: translateY(4px); }
@media (max-width: 600px) {
  .picker { width: 100dvw; max-height: 88dvh; margin-top: auto; padding: 12px 18px calc(24px + env(safe-area-inset-bottom)); border-radius: 28px 28px 0 0; box-shadow: 0 -20px 50px -20px rgba(0,0,0,.4); }
  .picker::before { content: ''; display: block; width: 40px; height: 5px; margin: 0 auto 14px; border-radius: 999px; background: var(--rule, var(--MI_THEME-divider)); }
  .picker h1 { margin-bottom: 6px; font-size: 19px; }
  .picker h2 { margin-top: 18px; }
}
</style>
