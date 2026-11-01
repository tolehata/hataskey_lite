<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.editor" role="dialog" aria-label="＋メニューに表示する項目">
  <div :inert="showDiscardConfirm || undefined">
  <header :class="$style.header"><span aria-hidden="true"></span><h2>＋メニューに表示する項目 <small>{{ draft.length }}/{{ HATAGOES_APP_PIN_LIMIT }}</small></h2><button ref="closeButton" type="button" aria-label="閉じる" :disabled="saving" @click="requestClose"><i class="ti ti-x" aria-hidden="true"></i></button></header>
  <p v-if="!ready" role="status">設定を読み込んでいます。</p>
  <p v-if="error" role="alert">保存または読込に失敗しました。内容を確認してもう一度保存してください。</p>
  <div :class="$style.topActions"><button type="button" :disabled="!ready || saving || draft.length === 0" @click="resetDraft"><i class="ti ti-restore" aria-hidden="true"></i>初期に戻す</button><button type="button" :class="$style.saveButton" :disabled="!ready || saving || !changed" @click="emit('save', [...draft])"><i class="ti ti-device-floppy" aria-hidden="true"></i>{{ saving ? '保存中…' : '保存' }}</button></div>
  <nav aria-label="Appの分類" :class="$style.filters"><button v-for="option in filters" :key="option.id" type="button" :class="option.id !== 'all' ? $style.brand : undefined" :aria-pressed="filter === option.id" @click="filter = option.id">{{ option.label }}</button></nav>
  <section v-if="draft.length" aria-label="＋メニューに表示する項目" :class="$style.group"><h3>＋メニューに表示中 <small>並べ替え</small></h3>
    <TransitionGroup name="hg-app-pin" tag="ol" :class="$style.rows"><li v-for="(id, index) in draft" :key="id">
      <HataFeatureIcon v-if="hataFeatureForScreen(id)" :feature="hataFeatureForScreen(id)!" :size="24" :mode="monochrome ? 'mono-dark' : 'color'"/><i v-else :class="candidates.find(item => item.id === id)?.icon ?? 'ti ti-apps'" aria-hidden="true"></i><span>{{ candidates.find(item => item.id === id)?.label ?? '利用できないApp' }}</span>
      <button type="button" :disabled="!ready || saving || index === 0" :aria-label="`${pinName(id)}を上へ`" @click="move(index, -1)">↑</button>
      <button type="button" :disabled="!ready || saving || index === draft.length - 1" :aria-label="`${pinName(id)}を下へ`" @click="move(index, 1)">↓</button>
      <button type="button" :disabled="!ready || saving" :aria-label="`${pinName(id)}を＋メニューから外す`" @click="remove(id)">×</button>
    </li></TransitionGroup>
  </section>
  <p v-else :class="$style.note">＋メニューに表示する項目を選んでください。</p>
  <section v-for="group in visibleGroups" :key="group.id" :aria-label="group.label" :class="$style.group"><h3 :class="$style.brand">{{ group.label }}</h3>
    <ul :class="$style.rows"><li v-for="item in group.items" :key="item.id">
      <HataFeatureIcon v-if="hataFeatureForScreen(item.id)" :feature="hataFeatureForScreen(item.id)!" :size="24" :mode="monochrome ? 'mono-dark' : 'color'"/><i v-else :class="item.icon" aria-hidden="true"></i><span :class="group.id === 'hataskey' ? $style.brand : undefined">{{ item.label }}</span>
      <button type="button" :class="draft.includes(item.id) ? $style.active : undefined" :disabled="!ready || saving || (!draft.includes(item.id) && draft.length >= HATAGOES_APP_PIN_LIMIT)" :aria-pressed="draft.includes(item.id)" :aria-label="`${item.label}を＋メニュー${draft.includes(item.id) ? 'から外す' : 'に追加'}`" @click="toggle(item.id)">{{ draft.includes(item.id) ? '表示中' : '追加' }}</button>
    </li></ul>
  </section>
  <p :class="$style.note">記録の作成やアプリを開く項目を8つまで選べます。上の一覧で順番を変えられます。</p>
  </div>
  <div v-if="showDiscardConfirm" :class="$style.confirmBackdrop"><section :class="$style.confirm" role="alertdialog" aria-modal="true" aria-labelledby="app-pins-discard-title" aria-describedby="app-pins-discard-description" @keydown="onConfirmKeydown"><h3 id="app-pins-discard-title">未保存の変更があります</h3><p id="app-pins-discard-description">保存せずに閉じると、変更した内容は失われます。</p><div><button ref="continueButton" type="button" @click="showDiscardConfirm = false">編集を続ける</button><button ref="discardButton" type="button" :class="$style.discardButton" @click="discardAndClose">保存せず閉じる</button></div></section></div>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { hataFeatureForScreen } from '@/utility/hata-feature-icon.js';
import { getHatagoesScreen, isHatagoesVisibleScreen } from '@/utility/hatagoes-catalog.js';
import { getHatagoesAppPinCandidates, HATAGOES_APP_PIN_LIMIT, normalizeHatagoesAppPins } from '@/utility/hatagoes-app-pins.js';

const props = defineProps<{ monochrome?: boolean; pins: readonly string[]; screens: readonly HatagoesCatalogEntry[]; ready: boolean; saving: boolean; error: boolean }>();
const emit = defineEmits<{ save: [pins: string[]]; close: [] }>();
const visiblePins = (pins: readonly string[]) => normalizeHatagoesAppPins(pins).filter(id => {
	const screen = getHatagoesScreen(id);
	return screen && isHatagoesVisibleScreen(screen);
});
const draft = ref<string[]>(visiblePins(props.pins));
const savedPins = ref<string[]>(visiblePins(props.pins));
const showDiscardConfirm = ref(false);
const continueButton = ref<HTMLButtonElement>();
const discardButton = ref<HTMLButtonElement>();
const closeButton = ref<HTMLButtonElement>();
const filter = ref<'all' | 'hatask' | 'hataskey'>('all');
const filters = [
  { id: 'all', label: 'すべて' }, { id: 'hatask', label: 'Hatask App' }, { id: 'hataskey', label: 'Hataskey App' },
] as const;
const candidates = computed(() => getHatagoesAppPinCandidates(props.screens));
const visibleGroups = computed(() => filters.filter(option => option.id !== 'all' && (filter.value === 'all' || filter.value === option.id)).map(option => ({ id: option.id, label: option.label, items: candidates.value.filter(item => item.group === option.id) })).filter(group => group.items.length));
const changed = computed(() => JSON.stringify(draft.value) !== JSON.stringify(savedPins.value));

watch(() => props.pins, pins => {
	const wasChanged = changed.value;
	savedPins.value = visiblePins(pins);
	if (!wasChanged || JSON.stringify(draft.value) === JSON.stringify(savedPins.value)) draft.value = [...savedPins.value];
}, { deep: true });
watch(showDiscardConfirm, async shown => {
	await nextTick();
	if (shown) continueButton.value?.focus({ preventScroll: true });
	else if (window.document.contains(closeButton.value ?? null)) closeButton.value?.focus({ preventScroll: true });
});

defineExpose({ requestClose });

function requestClose() {
	if (showDiscardConfirm.value) { showDiscardConfirm.value = false; return; }
	if (props.saving) return;
	if (changed.value) { showDiscardConfirm.value = true; return; }
	emit('close');
}

function onConfirmKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); showDiscardConfirm.value = false; return; }
	if (event.key !== 'Tab') return;
	const first = continueButton.value;
	const last = discardButton.value;
	if (!first || !last) return;
	if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function discardAndClose() { showDiscardConfirm.value = false; emit('close'); }

function resetDraft() { draft.value = []; }

function pinName(id: string) { return candidates.value.find(item => item.id === id)?.label ?? getHatagoesScreen(id)?.label ?? '利用できないApp'; }

function toggle(id: string) {
	if (draft.value.includes(id)) remove(id);
	else if (draft.value.length < HATAGOES_APP_PIN_LIMIT) draft.value = [...draft.value, id];
}

function remove(id: string) { draft.value = draft.value.filter(item => item !== id); }

function move(index: number, delta: number) {
	const result = [...draft.value];
	[result[index], result[index + delta]] = [result[index + delta], result[index]];
	draft.value = result;
}
</script>

<style module>
.editor { position: relative; width: min(620px, calc(100vw - 32px)); max-height: 86dvh; overflow: auto; padding: 20px; border-radius: 20px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); box-sizing: border-box; }
.header, .filters, .rows li { display: flex; align-items: center; gap: 10px; }
.header { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; }
.header h2 { margin: 0; font-size: 18px; text-align: center; overflow-wrap: anywhere; }
.header button { display: grid; place-items: center; padding: 0; }
.header small, .group h3 small { color: var(--MI_THEME-fgTransparent); font-size: 13px; font-weight: 500; }
.topActions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
.topActions button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.editor .topActions .saveButton { min-width: 94px; border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent, white); }
.filters { width: max-content; max-width: 100%; margin: 18px auto; overflow-x: auto; padding: 4px; border: 1px solid var(--MI_THEME-divider); border-radius: 26px; background: var(--MI_THEME-bg, var(--MI_THEME-panel)); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.editor .filters button { border: 0; border-radius: 22px; }
.editor button { min-height: 40px; padding: 6px 12px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: transparent; color: inherit; cursor: pointer; white-space: nowrap; }
.editor button:disabled { opacity: .5; cursor: default; }
.filters button[aria-pressed="true"], .active { border-color: var(--MI_THEME-accent) !important; background: var(--MI_THEME-accent) !important; color: var(--MI_THEME-fgOnAccent, white) !important; }
.group { margin-top: 20px; }
.group h3 { margin: 0 0 8px; font-size: 15px; }
.rows { margin: 0; padding: 0; list-style: none; border: 1px solid var(--MI_THEME-divider); border-radius: 14px; overflow: hidden; }
.rows li { min-height: 54px; padding: 6px 12px; box-sizing: border-box; }
.rows li + li { border-top: 1px solid var(--MI_THEME-divider); }
.rows li > i { width: 24px; color: var(--MI_THEME-accent); font-size: 21px; text-align: center; }
.rows li > span:not([data-hata-feature]) { flex: 1; min-width: 0; }
.brand { font-family: Righteous, var(--htk-font-head, sans-serif); font-weight: 400; font-synthesis: none; }
.note { margin-top: 20px; color: var(--MI_THEME-fgTransparent); font-size: 12px; line-height: 1.7; }
.confirmBackdrop { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; padding: 20px; background: #0008; }
.confirm { width: min(100%, 400px); padding: 20px; border: 1px solid var(--MI_THEME-divider); border-radius: 18px; background: var(--MI_THEME-panel); box-shadow: 0 12px 32px #0003; }
.confirm h3 { margin: 0 0 8px; font-size: 17px; }
.confirm p { margin: 0 0 18px; line-height: 1.6; }
.confirm div { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.editor .confirm .discardButton { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent, white); }
:global(.hg-app-pin-move), :global(.hg-app-pin-enter-active), :global(.hg-app-pin-leave-active) { transition: opacity 180ms ease, transform 180ms ease; }
:global(.hg-app-pin-enter-from), :global(.hg-app-pin-leave-to) { opacity: 0; transform: translateY(6px); }
@media (max-width: 600px) {
  .editor { width: 100%; max-height: 88dvh; padding-bottom: calc(24px + env(safe-area-inset-bottom)); border-radius: 28px 28px 0 0; }
  .editor::before { content: ''; display: block; width: 40px; height: 5px; margin: -8px auto 14px; border-radius: 999px; background: var(--MI_THEME-divider); }
}
</style>
