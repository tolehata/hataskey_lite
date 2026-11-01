<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="root" :class="$style.modes" role="tablist" :aria-label="label">
	<span :class="$style.indicator" :data-animate="indicator.animate.value" :style="indicator.style.value" aria-hidden="true"></span>
	<button v-for="mode in modes" :key="mode.id" type="button" role="tab" :class="$style.mode" :aria-selected="modelValue === mode.id" @click="emit('update:modelValue', mode.id)">
		<span :class="$style.modeIcon"><i :class="mode.icon" aria-hidden="true"></i></span>
		<span :class="$style.modeText"><b>{{ mode.label }}</b><small>{{ mode.desc }}</small></span>
	</button>
</div>
</template>

<script setup lang="ts" generic="T extends string">
import { useTemplateRef } from 'vue';
import { useSlidingIndicator } from '@/utility/sliding-indicator.js';

const props = defineProps<{ modelValue: T; modes: readonly { id: T; label: string; desc: string; icon: string }[]; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const root = useTemplateRef('root');
const indicator = useSlidingIndicator(root, '[aria-selected="true"]', () => props.modelValue);
</script>

<style module lang="scss">
.modes { position: relative; container-type: inline-size; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 22px; background: var(--hy-surface); border: 1px solid var(--hy-border); box-shadow: var(--hy-shadow); }
/* 選んだタブの下に敷く1枚。タブを替えるとこれが滑って移る */
.indicator { position: absolute; top: 0; left: 0; z-index: 0; border-radius: 18px; background: var(--hy-accent); pointer-events: none; }
.indicator[data-animate='true'] { transition: transform .32s cubic-bezier(.22, 1, .36, 1), width .32s cubic-bezier(.22, 1, .36, 1), opacity .15s ease; }
@media (prefers-reduced-motion: reduce) { .indicator[data-animate='true'] { transition: none; } }
.modes .mode { all: unset; position: relative; z-index: 1; box-sizing: border-box; min-width: 0; min-height: 56px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 18px; color: var(--hy-ink); cursor: pointer; transition: color .2s ease; }
.modes .mode:not([aria-selected='true']):hover { background: var(--hy-bg); }
.modes .mode[aria-selected='true'] { color: var(--hy-on-accent); }
.modes .mode:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.modeIcon { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 12px; background: var(--hy-soft); color: var(--hy-accent); font-size: 20px; transition: background .2s ease, color .2s ease; }
.mode[aria-selected='true'] .modeIcon { background: rgb(255 255 255 / 18%); color: inherit; }
.modeText { min-width: 0; display: grid; gap: 2px; }
.modeText b { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.modeText small { font-size: 11px; color: var(--hy-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .2s ease; }
.mode[aria-selected='true'] .modeText small { color: rgb(255 255 255 / 82%); }
@container (max-width: 520px) {
	/* 狭い幅ではひとことを消し、アイコンと名前を縦に積む */
	.modes .mode { flex-direction: column; justify-content: center; gap: 4px; padding: 8px 4px; text-align: center; }
	.modeIcon { width: 30px; height: 30px; font-size: 18px; }
	.modeText small { display: none; }
	.modeText b { font-size: 12px; }
}
</style>
