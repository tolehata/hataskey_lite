<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hatady の映画・ゲーム・作業用の自動表紙。既存の引数と色指定を共通表紙へ渡す。
-->
<template>
<HyBookCover
	:kind="kind"
	:title="title"
	:author="subtitle"
	:width="width"
	:showTitle="showTitle"
	:colorIndex="colorIndex"
/>
</template>

<script lang="ts" setup>
import type { HatadyMediaKind } from '@/utility/hatady-media.js';
import HyBookCover from '@/components/HyBookCover.vue';

withDefaults(defineProps<{
	kind: HatadyMediaKind;
	title: string;
	subtitle?: string | null;
	width?: number;
	showTitle?: boolean;
	colorIndex?: number | null;
}>(), {
	subtitle: null,
	width: 92,
	showTitle: true,
	colorIndex: null,
});
</script>
