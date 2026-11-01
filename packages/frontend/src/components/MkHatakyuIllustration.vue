<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey fork: ハタキュアセットの共通表示。
  ⚠️画面ごとに raw な URL を書かず、必ずレジストリの key を渡して使う。
  ⚠️既定は装飾画像の扱い(alt="" / aria-hidden / draggable=false)。
    情報として意味を持たせる場合だけ label を渡して読み上げ対象にする。
-->
<template>
<img
	:class="$style.root"
	:src="src"
	:width="size"
	:height="size"
	:alt="label ?? ''"
	:aria-hidden="label == null ? 'true' : undefined"
	:role="label == null ? 'presentation' : 'img'"
	draggable="false"
	loading="lazy"
	decoding="async"
>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { HatakyuAssetKey } from '@/utility/hatakyu-assets.js';
import { hatakyuAssetUrl } from '@/utility/hatakyu-assets.js';

const props = withDefaults(defineProps<{
	asset: HatakyuAssetKey;
	/** 表示サイズ(px)。原寸は 500x500 の正方形。 */
	size?: number;
	/** 読み上げさせたい場合だけ渡す。未指定なら装飾画像として扱う。 */
	label?: string | null;
}>(), {
	size: 96,
	label: null,
});

const src = computed(() => hatakyuAssetUrl(props.asset));
</script>

<style lang="scss" module>
.root {
	display: block;
	max-width: 100%;
	height: auto;
	object-fit: contain;
	/* 画像自体に余白があるため、置き換え先のレイアウトへ素直に従わせる。 */
	flex: 0 0 auto;
	user-select: none;
	-webkit-user-drag: none;
}
</style>
