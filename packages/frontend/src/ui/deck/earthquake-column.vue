<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 標準デッキUI用 地震・津波カラム。MkEarthquakeColumn.vue を内包する。
-->
<template>
<XColumn :menu="menu" :naked="false" :column="column" :isStacked="isStacked">
	<template #header><i class="ti ti-activity" style="margin-right: 8px;"></i>{{ column.name || i18n.ts._deck._columns[column.type] }}</template>

	<div :class="$style.root">
		<MkEarthquakeColumn ref="bodyEl"/>
	</div>
</XColumn>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import MkEarthquakeColumn from '@/components/MkEarthquakeColumn.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const bodyEl = useTemplateRef('bodyEl');

const menu = [{
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	action: () => { bodyEl.value?.reload?.(); },
}, {
	icon: 'ti ti-settings',
	text: i18n.ts.settings,
	action: () => { bodyEl.value?.openSettings?.(); },
}];
</script>

<style lang="scss" module>
.root { height: 100%; min-height: 0; display: flex; flex-direction: column; }
</style>
