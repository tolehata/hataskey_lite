<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<span :class="$style.logo" :style="{ width: `${size}px`, height: `${size}px`, background: monochrome ? '#1d1b1f' : '#d6cbf3' }" aria-hidden="true">
	<svg viewBox="0 0 100 100" width="100%" height="100%">
		<rect x="20" y="18" width="7" height="66" rx="3.5" :fill="mark"/>
		<circle cx="52" cy="42" r="19" :fill="mark"/>
		<circle cx="46" cy="36" r="5" :fill="cut" opacity=".35"/>
		<circle cx="66" cy="62" r="14" :fill="cut" :stroke="mark" stroke-width="5"/>
	</svg>
</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ size?: number; monochrome?: boolean }>(), { size: 26, monochrome: false });
const mark = computed(() => props.monochrome ? '#ffffff' : '#2b1f2c');
const cut = computed(() => props.monochrome ? '#1d1b1f' : '#ffffff');
</script>

<style module>
.logo { display: inline-block; flex: none; overflow: hidden; border-radius: 25%; vertical-align: middle; }
.logo svg { display: block; }
</style>
