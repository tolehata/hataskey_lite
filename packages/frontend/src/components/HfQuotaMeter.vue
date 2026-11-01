<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed デザイン改修 §3): 週次の絵文字申請枠メーター。
  数値を囲む外枠で残数割合 remaining/limit を示す。
  既存 API(hata/feedback/emoji-quota)の { remaining, limit } 形をそのまま受ける。
  ウィザード・一覧サイドバー・承認画面で共用。
-->
<template>
<div :class="$style.root" role="meter" :aria-label="prefix || '新規追加申請の残り'" :aria-valuemin="0" :aria-valuemax="Math.max(1, limit)" :aria-valuenow="remaining" :aria-valuetext="`上限${limit}件のうち残り${remaining}件`">
	<svg :class="$style.outline" aria-hidden="true">
		<defs><linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--hy-accent, var(--MI_THEME-accent))" stop-opacity=".5"/><stop offset="100%" stop-color="var(--hy-accent, var(--MI_THEME-accent))"/></linearGradient></defs>
		<rect :class="$style.track" x="2" y="2" rx="18"/>
		<rect v-if="ratio > 0" x="2" y="2" rx="18" pathLength="100" :stroke="`url(#${gradientId})`" :stroke-dasharray="`${ratio * 100} 100`" stroke-linecap="round"/>
	</svg>
	<span :class="$style.label">{{ prefix || '新規追加申請の残り' }}</span><strong>{{ remaining }}<small>/ {{ limit }}件</small></strong>
</div>
</template>

<script lang="ts" setup>
import { computed, useId } from 'vue';

const props = defineProps<{
	remaining: number;
	limit: number;
	prefix?: string;
}>();
const gradientId = `quota-${useId()}`;

const ratio = computed(() => {
	if (props.limit <= 0) return 0;
	return Math.max(0, Math.min(1, props.remaining / props.limit));
});
</script>

<style module>
.root { position: relative; box-sizing: border-box; display: grid; justify-items: center; align-content: center; gap: 2px; width: 100%; max-width: 280px; min-height: 84px; margin: 0 auto; padding: 12px 18px; border-radius: 20px; background: linear-gradient(135deg, var(--hy-surface, var(--MI_THEME-panel)), var(--hy-soft, var(--MI_THEME-accentedBg))); text-align: center; }
.label { color: var(--hy-muted, var(--MI_THEME-fg)); font-size: 11px; }
.root strong { display: flex; align-items: baseline; gap: 7px; color: var(--hy-accent, var(--MI_THEME-accent)); font-size: 27px; font-variant-numeric: tabular-nums; line-height: 1.3; }
.root small { font-size: 11px; font-weight: 400; color: var(--hy-muted, var(--MI_THEME-fg)); }
.outline { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; overflow: visible; pointer-events: none; }
.outline rect { width: calc(100% - 4px); height: calc(100% - 4px); stroke-width: 2; }
.track { stroke: var(--hy-border, var(--MI_THEME-divider)); }
</style>
