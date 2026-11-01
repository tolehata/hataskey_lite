<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span ref="root" :class="$style.root">
	<button type="button" :class="$style.button" :aria-label="`${label}の説明`" :aria-expanded="expanded" :aria-controls="panelId" @click="expanded = !expanded">
		<i class="ti ti-info-circle" aria-hidden="true"></i>
	</button>
	<span v-if="expanded" :id="panelId" :class="$style.panel" role="note" lang="ja">
		<span v-for="(sentence, index) in sentences" :key="index" :class="$style.sentence"><template v-for="(phrase, part) in sentence" :key="part">{{ phrase }}<wbr></template></span>
	</span>
</span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue';

const props = defineProps<{ label: string; text: string }>();
const root = useTemplateRef('root');
const expanded = ref(false);
const panelId = useId();

/**
 * 「。」で文を分けて1文ずつ行を変え、「、」のあとだけを折り返してよい位置にする。
 * 日本語は既定だとどの字の間でも折り返すので、「多く読ん / だ」のような切れ方になる。
 */
const sentences = computed(() => (props.text.match(/[^。]+。?/gu) ?? []).map(sentence => sentence.match(/[^、]+、?/gu) ?? [sentence]));

function onPointer(event: PointerEvent): void { if (!root.value?.contains(event.target as Node)) expanded.value = false; }

function onKey(event: KeyboardEvent): void { if (event.key === 'Escape') expanded.value = false; }

watch(expanded, value => {
	if (value) { window.addEventListener('pointerdown', onPointer, true); window.addEventListener('keydown', onKey); } else { window.removeEventListener('pointerdown', onPointer, true); window.removeEventListener('keydown', onKey); }
});
onBeforeUnmount(() => { window.removeEventListener('pointerdown', onPointer, true); window.removeEventListener('keydown', onKey); });
</script>

<style module lang="scss">
.root { position: relative; display: inline-flex; margin-inline-start: auto; }
.root .button { all: unset; box-sizing: border-box; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: var(--hy-muted); font-size: 18px; cursor: pointer; }
.root .button:hover, .root .button[aria-expanded='true'] { background: var(--hy-bg); color: var(--hy-ink); }
.root .button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.panel { position: absolute; z-index: 2; top: calc(100% + 6px); right: 0; width: max-content; max-width: min(280px, 72vw); display: grid; gap: 4px; padding: 12px 14px; border-radius: 14px; background: var(--hy-surface); border: 1px solid var(--hy-border); box-shadow: 0 8px 28px rgb(0 0 0 / 22%); color: var(--hy-ink); font-size: 13px; font-weight: 400; line-height: 1.7; text-align: start; }
/* keep-all で字の間では折り返さず、<wbr>（「、」「。」のあと）だけで折る。入りきらない語だけは anywhere で逃がす */
.sentence { display: block; word-break: keep-all; overflow-wrap: anywhere; line-break: strict; }
</style>
