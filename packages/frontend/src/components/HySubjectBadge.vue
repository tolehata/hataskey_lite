<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady): 分野(subject)の丸ピルバッジ。既知分野は固定色、未知はハッシュで安定割当。
-->
<template>
<span :class="$style.root" :style="{ background: pal.bg, color: pal.fg }">{{ subject }}</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { hySubjectPalette } from '@/utility/hatady.js';

const props = defineProps<{ subject: string }>();
const pal = computed(() => hySubjectPalette(props.subject));
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	align-items: center;
	font-size: 11px;
	font-weight: 700;
	padding: 2px 10px;
	border-radius: 999px;
	white-space: nowrap;
	line-height: 1.3;
}
</style>
