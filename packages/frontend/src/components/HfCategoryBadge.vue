<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed デザイン改修 §2.3 / §3): カテゴリの丸ピルバッジ。
  category をキーに §2.3 の色ペア(淡色bg / 濃色fg)を引く。意味色は現行コードの値を踏襲し、
  data-cat を使ったリテラルクラスの scoped スタイルで当てる(現行 .hfCatPill と同じ流儀)。
-->
<template>
<span class="root" :data-cat="category">{{ label }}</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { categoryLabel } from '@/utility/hatafeed.js';

const props = defineProps<{
	category: string;
}>();

const label = computed(() => categoryLabel[props.category] ?? props.category);
</script>

<style lang="scss" scoped>
.root {
	display: inline-flex;
	align-items: center;
	font-size: .72em;
	font-weight: 700;
	padding: 3px 11px;
	border-radius: 999px;
	white-space: nowrap;
	line-height: 1.2;
}
.root[data-cat="bug"] { background: #ffe1e1; color: #c0392b; }
.root[data-cat="improvement"] { background: #e1fff0; color: #1f8a5b; }
.root[data-cat="security"] { background: #ffe9d6; color: #c0612b; }
.root[data-cat="featureRequest"] { background: #e1efff; color: #2b6fc0; }
.root[data-cat="adoptionRequest"] { background: #e7e1ff; color: #5a2bc0; }
.root[data-cat="betaFeature"] { background: #d9f3f0; color: #1f7a86; }
.root[data-cat="unresolved"] { background: #efefef; color: #666; }
.root[data-cat="other"] { background: #efefef; color: #666; }
</style>
