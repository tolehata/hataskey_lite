<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<button type="button" :class="$style.button" :aria-label="shown ? `${label}を隠す` : `${label}を出す`" :title="shown ? `${label}を隠す` : `${label}を出す`" :aria-expanded="shown" @click="emit('toggle')">
	<i :class="shown ? 'ti ti-eye-off' : 'ti ti-eye'" aria-hidden="true"></i>
</button>
</template>

<script setup lang="ts">
defineProps<{ label: string; shown: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<style module lang="scss">
.button { all: unset; box-sizing: border-box; flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: var(--hy-muted); font-size: 18px; cursor: pointer; }
.button:hover { background: var(--hy-bg); color: var(--hy-ink); }
.button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
</style>
