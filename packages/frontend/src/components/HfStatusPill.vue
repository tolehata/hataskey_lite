<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed デザイン改修 §3): イシューのステータス表示。
  statusで共通ラベル・アイコンと色を切替える。
  3 variant:
    - 'pill'  : 淡色背景の丸ピル(一覧行のバッジ・ロードマップ)。既定。
    - 'text'  : アイコン+色付き文字のみ(背景なし。2a メタ行の先頭アイコン用)。
    - 'filled': 塗りピル+白文字(詳細ヘッダーの強調表示)。
  意味色は現行コードの値を踏襲。CSS Module は動的キー/リテラル名参照の制約があるため、
  色は data-status / data-variant を使ったリテラルクラスの scoped スタイルで当てる
  (現行 hatafeed.vue の .hfStatusPill と同じ流儀)。
-->
<template>
<span class="root" :data-status="status" :data-variant="variant">
	<i v-if="showIcon" class="icon" :class="['ti', icon]"></i>
	<span v-if="!iconOnly" class="label">{{ label }}</span>
</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { statusLabel, statusIcon } from '@/utility/hatafeed.js';

const props = withDefaults(defineProps<{
	status: string;
	variant?: 'pill' | 'text' | 'filled';
	showIcon?: boolean;
	iconOnly?: boolean;
}>(), {
	variant: 'pill',
	showIcon: true,
	iconOnly: false,
});

const label = computed(() => statusLabel[props.status] ?? props.status);
const icon = computed(() => statusIcon[props.status] ?? 'ti-circle-dot');
</script>

<style lang="scss" scoped>
.root {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-weight: 700;
	white-space: nowrap;
	line-height: 1.2;
}
.icon { font-size: 1.05em; }

/* --- 形状(variant 別) --- */
.root[data-variant="pill"] { font-size: .72em; padding: 3px 10px; border-radius: 999px; }
.root[data-variant="text"] { font-size: .82em; }
.root[data-variant="filled"] { font-size: .78em; padding: 4px 12px; border-radius: 999px; color: #fff; }

/* --- pill / text の文字色(意味色) --- */
.root[data-variant="pill"][data-status="open"],
.root[data-variant="text"][data-status="open"] { color: #2b6fc0; }
.root[data-variant="pill"][data-status="planned"],
.root[data-variant="text"][data-status="planned"] { color: #9a7b1f; }
.root[data-variant="pill"][data-status="inProgress"],
.root[data-variant="text"][data-status="inProgress"] { color: #b6791f; }
.root[data-variant="pill"][data-status="resolved"],
.root[data-variant="text"][data-status="resolved"] { color: #1f8a5b; }
.root[data-variant="pill"][data-status="wontfix"],
.root[data-variant="text"][data-status="wontfix"] { color: #777; }
.root[data-variant="pill"][data-status="unknown"],
.root[data-variant="text"][data-status="unknown"] { color: #999; }
.root[data-variant="pill"][data-status="closed"],
.root[data-variant="text"][data-status="closed"] { color: #6a5a86; }

/* --- pill の淡色背景 --- */
.root[data-variant="pill"][data-status="open"] { background: #e1efff; }
.root[data-variant="pill"][data-status="planned"] { background: #fff6d6; }
.root[data-variant="pill"][data-status="inProgress"] { background: #fff0d6; }
.root[data-variant="pill"][data-status="resolved"] { background: #e1fff0; }
.root[data-variant="pill"][data-status="wontfix"] { background: #efefef; }
.root[data-variant="pill"][data-status="unknown"] { background: #efefef; }
.root[data-variant="pill"][data-status="closed"] { background: #e9e4ef; }

/* --- filled の塗り背景(文字は白) --- */
.root[data-variant="filled"][data-status="open"] { background: #2b6fc0; }
.root[data-variant="filled"][data-status="planned"] { background: #b89a2b; }
.root[data-variant="filled"][data-status="inProgress"] { background: #d18a1f; }
.root[data-variant="filled"][data-status="resolved"] { background: #1f8a5b; }
.root[data-variant="filled"][data-status="wontfix"] { background: #888; }
.root[data-variant="filled"][data-status="unknown"] { background: #aaa; }
.root[data-variant="filled"][data-status="closed"] { background: #8a7aa6; }

/* 追加ステータスはテーマの文字色と背景色を使い、アイコンでも区別する。 */
.root[data-status="nextFixConfirmed"] { --hf-status-color: var(--MI_THEME-accent); }
.root[data-status="nextFixPlanned"] { --hf-status-color: var(--MI_THEME-fgMuted); }
.root[data-status="monitoring"] { --hf-status-color: var(--MI_THEME-link); }

.root:is([data-status="nextFixConfirmed"], [data-status="nextFixPlanned"], [data-status="monitoring"]) {
	color: var(--MI_THEME-fg);

	&[data-variant="pill"] { background: color-mix(in srgb, var(--hf-status-color) 12%, var(--MI_THEME-panel)); }
	&[data-variant="filled"] { background: color-mix(in srgb, var(--hf-status-color) 24%, var(--MI_THEME-panel)); }
}
</style>
