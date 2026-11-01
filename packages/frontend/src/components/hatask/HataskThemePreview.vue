<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="htk-theme-preview" :class="$style.preview" :data-theme="theme" :data-mode="mode" :style="theme === 'hatakyu' ? getHataskHatakyuStyle() : undefined" aria-hidden="true">
	<div :class="$style.rail"><i v-for="n in 4" :key="n"></i></div>
	<div :class="$style.header">Hatask<span></span></div>
	<div :class="$style.content"><div :class="$style.tabs"><i></i><i></i><i></i></div><div :class="$style.card"><b></b><span></span><span></span><i></i></div></div>
	<div :class="$style.side"><i></i><i></i><i></i></div>
</div>
</template>

<script setup lang="ts">
import type { HataskPlannerTheme } from './hatask-planner-types.js';
import { getHataskHatakyuStyle } from '@/utility/hatask-theme.js';
defineProps<{ theme: HataskPlannerTheme; mode: 'light' | 'dark' }>();
</script>

<style lang="scss" src="./hatask-themes.scss"></style>
<style module>
.preview { --bg: #fff3ec; --surface: #fff7f2; --fg: #2b1f2c; --rule: #e9d4d8; --accent: #b02e56; --rail-paper: #f6e5ef; --card-radius: 8px; --case-radius: 8px; --shadow: 0 2px 6px #50324618; display: grid; grid-template-columns: 16px minmax(0, 1fr) 30px; grid-template-rows: 19px 68px; gap: 7px; box-sizing: border-box; min-width: 0; padding: 9px; border-radius: 9px; background: var(--bg); color: var(--fg); overflow: hidden; }
.preview[data-theme='akatsuki'] { background: linear-gradient(135deg, #ffdac5, #f6e5ef, #eaf0ff); }
.preview[data-theme='koke'] { background: var(--bg-image), var(--bg); }
.preview[data-theme='akatsuki'][data-mode='dark'] { --surface: #302035; --fg: #f6ecf3; --rule: #654052; --accent: #ff7fa3; --rail-paper: #271b2e; background: linear-gradient(135deg, #4e2836, #1b1424, #291c33); }
.rail { grid-row: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-block: 5px; background: var(--rail-paper); border-radius: 3px; }
.rail i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.header { grid-column: 2 / -1; display: flex; align-items: center; gap: 8px; padding-inline: 5px; border: 1px solid var(--rule); border-radius: var(--case-radius); background: var(--surface); font: 11px/1 Righteous, sans-serif; }
.header span { flex: 1; height: 5px; border-radius: 5px; background: var(--rule); }
.content { min-width: 0; display: grid; grid-template-rows: 12px minmax(0, 1fr); gap: 5px; }
.tabs { display: flex; justify-content: center; gap: 5px; }
.tabs i { width: 12px; border-radius: var(--case-radius); background: var(--surface); border: 1px solid var(--rule); }
.tabs i:first-child { background: var(--accent); }
.card { display: flex; flex-direction: column; align-items: start; gap: 4px; min-width: 0; padding: 6px; border: 1px solid var(--rule); border-radius: min(8px, var(--card-radius)); background: var(--surface); box-shadow: var(--shadow); overflow: hidden; }
.card b { width: 65%; height: 5px; background: var(--fg); }
.card span { width: 90%; height: 2px; background: var(--rule); }
.card i { width: 25px; max-width: 100%; height: 7px; background: var(--accent); border-radius: var(--case-radius); }
.side { display: grid; gap: 5px; }
.side i { border: 1px solid var(--rule); border-radius: min(8px, var(--card-radius)); background: var(--surface); box-shadow: var(--shadow); }
.preview[data-theme='hatakyu'] .card { background: var(--hatakyu-welcome) right bottom / 24px 24px no-repeat, var(--surface); }
</style>
