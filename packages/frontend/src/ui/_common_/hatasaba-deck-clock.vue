<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<time :datetime="now.toISOString()" data-hatasaba-deck-clock>{{ clockText }}</time>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { versatileLang } from '@/utility/intl-const.js';

const clockFormatter = new Intl.DateTimeFormat(versatileLang, {
	month: 'numeric',
	day: 'numeric',
	weekday: 'short',
	hour: 'numeric',
	minute: '2-digit',
	second: '2-digit',
});

const now = ref(new Date());
const clockText = computed(() => clockFormatter.format(now.value));
let clockTimer: number | null = null;

onMounted(() => {
	clockTimer = window.setInterval(() => {
		now.value = new Date();
	}, 1000);
});

onUnmounted(() => {
	if (clockTimer != null) window.clearInterval(clockTimer);
});
</script>
