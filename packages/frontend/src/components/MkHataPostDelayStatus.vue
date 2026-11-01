<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root" :data-compact="compact ? 'true' : undefined" role="status" aria-live="polite">
	<div :class="$style.copy"><span :class="$style.kicker">{{ copy.waiting }}</span><strong :class="$style.phrase"><span>{{ phrasePrefix }}</span><span :class="$style.digitSlot" data-send-status-count><Transition :name="motionEnabled ? 'hata-delay-digit' : ''"><span :key="seconds" :class="$style.digit">{{ seconds }}</span></Transition></span><span>{{ phraseSuffix }}</span></strong><div :class="$style.rail" aria-hidden="true"><span :style="{ transform: `scaleX(${progress})` }"></span></div></div>
	<div :class="$style.actions"><button type="button" class="_button" :class="$style.cancel" @click="$emit('cancel')">{{ cancelLabel }}</button><button type="button" class="_button" :class="$style.sendNow" @click="$emit('sendNow')">{{ sendNowLabel }}</button></div>
</div>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
const props = withDefaults(defineProps<{ pattern: string; seconds: number; progress: number; cancelLabel: string; sendNowLabel: string; compact?: boolean }>(), {
	compact: false,
});
defineEmits<{ (ev: 'cancel'): void; (ev: 'sendNow'): void }>();
const copy = i18n.ts._hata._postFormMotion;
const motionEnabled = computed(() => prefer.s.animation);
const phraseParts = computed(() => props.pattern.split('{seconds}'));
const phrasePrefix = computed(() => phraseParts.value[0] ?? '');
const phraseSuffix = computed(() => phraseParts.value.slice(1).join('{seconds}'));
</script>
<style lang="scss" module>
.root{display:flex;min-width:0;max-width:100%;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box}.copy{min-width:0;overflow:hidden;flex:1}.kicker{display:block;margin-bottom:2px;overflow:hidden;font-size:.68em;font-weight:800;letter-spacing:.08em;text-overflow:ellipsis;opacity:.68}.phrase{display:flex;min-width:0;align-items:center;overflow:hidden;font-variant-numeric:tabular-nums;line-height:1.35;text-overflow:ellipsis}.digitSlot{display:inline-grid;position:relative;width:2.1ch;height:1.35em;flex:0 0 2.1ch;place-items:center;overflow:hidden;contain:layout paint}.digit{display:grid;grid-area:1/1;width:100%;height:100%;place-items:center;line-height:1}.rail{height:2px;margin-top:6px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,currentColor 14%,transparent)}.rail>span{display:block;width:100%;height:100%;border-radius:inherit;background:currentColor;transform-origin:left center;transition:transform 120ms linear}.actions{display:flex;min-width:0;flex:0 0 auto;align-items:center;justify-content:flex-end;gap:4px}.cancel,.sendNow{width:auto;min-width:0;min-height:28px;padding:4px 8px;border-radius:999px;font-size:.76em;font-weight:750;white-space:nowrap}.sendNow{background:var(--MI_THEME-accent);color:var(--MI_THEME-fgOnAccent)}
.root[data-compact='true']{display:grid;min-width:0;max-width:100%;grid-template-columns:minmax(0,1fr) auto;gap:8px}.root[data-compact='true'] .cancel{padding-inline:6px}.root[data-compact='true'] .sendNow{padding-inline:7px}
:global(.hata-delay-digit-enter-active),:global(.hata-delay-digit-leave-active){transition:opacity 180ms ease,transform 220ms cubic-bezier(.16,1,.3,1)}:global(.hata-delay-digit-enter-from){opacity:0;transform:translateY(72%)}:global(.hata-delay-digit-leave-to){opacity:0;transform:translateY(-72%)}
:global(.hata-delay-status-complete-enter-active).root,:global(.hata-delay-status-cancel-enter-active).root{transition:opacity .18s ease,transform .22s cubic-bezier(.16,1,.3,1)}:global(.hata-delay-status-complete-leave-active).root{pointer-events:none;transition:opacity .22s ease,transform .26s cubic-bezier(.4,0,.2,1)}:global(.hata-delay-status-cancel-leave-active).root{pointer-events:none;transition:opacity .16s ease-out,transform .16s ease-out}:global(.hata-delay-status-complete-enter-from).root,:global(.hata-delay-status-cancel-enter-from).root{opacity:0;transform:var(--hata-delay-base-transform,translate(0)) translateY(6px) scale(.98)}:global(.hata-delay-status-complete-leave-to).root{opacity:0;transform:var(--hata-delay-base-transform,translate(0)) translateY(-14px) scale(.98)}:global(.hata-delay-status-cancel-leave-to).root{opacity:0;transform:var(--hata-delay-base-transform,translate(0)) scale(.985)}
@media(max-width:520px){.root:not([data-compact='true']){align-items:stretch;flex-direction:column;gap:7px}.actions{justify-content:flex-end}}@media(prefers-reduced-motion:reduce){.rail>span,:global(.hata-delay-digit-enter-active),:global(.hata-delay-digit-leave-active),:global(.hata-delay-status-complete-enter-active),:global(.hata-delay-status-complete-leave-active),:global(.hata-delay-status-cancel-enter-active),:global(.hata-delay-status-cancel-leave-active){transition:none}}
</style>
