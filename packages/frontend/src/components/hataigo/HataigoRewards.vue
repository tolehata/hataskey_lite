<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section v-if="active && reward" :class="$style.card" role="status" aria-live="polite">
	<div><small>{{ rewardText.newBoard }}</small><h2>{{ themeLabels[reward].name }}</h2><p>「{{ rewardText.conditions[reward] }}」を達成しました</p></div>
	<div :class="$style.actions"><button type="button" :disabled="busy" @click="apply">{{ rewardText.use }}</button><button type="button" :disabled="busy" @click="dismiss">{{ rewardText.later }}</button></div>
</section>
<p v-if="active && (rewards.error.value || preferenceError)" role="alert" :class="$style.error">{{ rewards.error.value || preferenceError }} <button type="button" :disabled="rewards.loading.value" @click="rewards.refresh()">{{ rewardText.retry }}</button></p>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import type { Theme } from '@/utility/hataigo/rewards-rules.js';
import { themeLabels } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { useHataigoRewards } from '@/utility/hataigo/rewards.js';
import { rewardText } from '@/utility/hataigo/rewards-rules.js';

defineOptions({ name: 'HataigoRewards' });
const props = withDefaults(defineProps<{ active?: boolean; refreshKey?: number }>(), { active: true, refreshKey: 0 });
const rewards = useHataigoRewards();
const { save, error: preferenceError } = useHataigoPrefs();
const reward = computed<Theme | null>(() => rewards.pending.value[0] ?? null);
const busy = ref(false);

function refresh(): void { if (props.active) void rewards.refresh(); }

onMounted(refresh);
onActivated(refresh);
watch(() => [props.active, props.refreshKey], refresh);

async function apply(): Promise<void> {
	const theme = reward.value;
	if (theme === null || busy.value) return;
	busy.value = true;
	try { if (await save({ theme })) await rewards.acknowledge(theme); } finally { busy.value = false; }
}

async function dismiss(): Promise<void> { const theme = reward.value; if (theme === null || busy.value) return; busy.value = true; try { await rewards.acknowledge(theme); } finally { busy.value = false; } }
</script>

<style module lang="scss">
.card { padding: 16px; border: 1px solid var(--hy-accent); border-radius: 24px; background: var(--hy-soft); color: var(--hy-ink); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.card small { color: var(--hy-accent); font-weight: 700; }
.card h2 { margin: 6px 0; font-size: 18px; }
.card p { margin: 0; font-size: 13px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.card button, .error button { min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 8px 14px; background: var(--hy-surface); color: var(--hy-ink); font: inherit; cursor: pointer; }
.card button:first-child { background: var(--hy-accent); color: var(--hy-on-accent); }
.card button:disabled { opacity: .6; cursor: default; }
.card button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 3px; }
.error { color: var(--MI_THEME-error, #b23c43); font-size: 13px; line-height: 1.8; }
</style>
