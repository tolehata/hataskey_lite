<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<span :class="[$style.root, iconOnly && $style.iconOnly]" :data-state="state" role="status" aria-live="polite">
	<Transition :name="motionEnabled ? 'hata-submit-state' : ''" mode="out-in">
		<span :key="state" :class="$style.state">
			<template v-if="state === 'sending'"><span :class="$style.arc" aria-hidden="true"></span><span :class="iconOnly ? $style.srOnly : $style.label">{{ copy.sending }}</span></template>
			<template v-else-if="state === 'success'"><i class="ti ti-check" aria-hidden="true"></i><span :class="iconOnly ? $style.srOnly : $style.label">{{ copy.success }}</span></template>
			<template v-else-if="state === 'failure'"><i class="ti ti-x" aria-hidden="true"></i><span :class="iconOnly ? $style.srOnly : $style.label">{{ copy.failure }}</span></template>
			<template v-else-if="state === 'countdown'"><span :class="$style.countdown" data-send-count aria-hidden="true"><Transition :name="motionEnabled ? 'hata-submit-digit' : ''"><span :key="countdownSeconds" :class="$style.countdownDigit">{{ countdownSeconds }}</span></Transition></span><span :class="iconOnly ? $style.srOnly : $style.label">{{ copy.waiting }}</span></template>
			<template v-else><span v-if="!iconOnly" :class="$style.label">{{ idleText }}</span><i :class="idleIcon" aria-hidden="true"></i><span v-if="iconOnly" :class="$style.srOnly">{{ idleText }}</span></template>
		</span>
	</Transition>
</span>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
export type HataPostSubmitState = 'idle' | 'countdown' | 'sending' | 'success' | 'failure';
withDefaults(defineProps<{ state: HataPostSubmitState; idleText: string; idleIcon: string; countdownSeconds?: number; iconOnly?: boolean }>(), { countdownSeconds: 0, iconOnly: false });
const copy = i18n.ts._hata._postFormMotion;
const motionEnabled = computed(() => prefer.s.animation);
</script>
<style lang="scss" module>
.root,.state{display:inline-flex;min-width:0;height:100%;align-items:center;justify-content:center;gap:6px;box-sizing:border-box}.root:not(.iconOnly){width:100%;min-width:0;max-width:100%}.state{width:100%;min-width:0;white-space:nowrap}.label{min-width:0;overflow:hidden;text-overflow:ellipsis}.root[data-state='countdown'] .state{gap:4px}.root[data-state='countdown'] .label{flex:0 1 auto;overflow:visible;font-size:.78em;line-height:1;text-overflow:clip}.arc{width:14px;height:14px;flex:0 0 14px;border:2px solid color-mix(in srgb,currentColor 28%,transparent);border-top-color:currentColor;border-radius:50%;box-sizing:border-box;animation:hataSubmitArc .72s linear infinite}.countdown{display:inline-grid;position:relative;width:1.6em;min-width:1.6em;height:1.6em;flex:0 0 1.6em;place-items:center;overflow:hidden;border:1px solid color-mix(in srgb,currentColor 36%,transparent);border-radius:999px;box-sizing:border-box;font-variant-numeric:tabular-nums;contain:layout paint}.countdownDigit{grid-area:1/1;font-size:.86em;line-height:1}.srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@keyframes hataSubmitArc{to{transform:rotate(360deg)}}
:global(.hata-submit-state-enter-active),:global(.hata-submit-state-leave-active){transition:opacity 180ms ease,transform 220ms cubic-bezier(.16,1,.3,1)}:global(.hata-submit-state-enter-from){opacity:0;transform:scale(.78)}:global(.hata-submit-state-leave-to){opacity:0;transform:scale(.9)}
:global(.hata-submit-digit-enter-active),:global(.hata-submit-digit-leave-active){transition:opacity 160ms ease,transform 210ms cubic-bezier(.16,1,.3,1)}:global(.hata-submit-digit-enter-from){opacity:0;transform:translateY(70%)}:global(.hata-submit-digit-leave-to){opacity:0;transform:translateY(-70%)}
@media(prefers-reduced-motion:reduce){.arc{animation:none}:global(.hata-submit-state-enter-active),:global(.hata-submit-state-leave-active),:global(.hata-submit-digit-enter-active),:global(.hata-submit-digit-leave-active){transition:none}}
</style>
