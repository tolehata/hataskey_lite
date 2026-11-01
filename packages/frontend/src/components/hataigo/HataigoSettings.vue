<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<HyDialog ref="dialog" title="盤と石の設定" centerTitle :theme="dialogTheme" :busy="saving" @close="dialog?.close()" @closed="emit('closed')">
	<div :class="$style.root">
		<section :class="$style.group" aria-labelledby="hataigo-settings-board">
			<h3 id="hataigo-settings-board">盤</h3>
			<div :class="$style.themes" role="radiogroup" aria-label="盤">
				<button
					v-for="theme in THEMES"
					:key="theme"
					type="button"
					role="radio"
					:class="$style.theme"
					:aria-checked="prefs.theme === theme"
					:aria-disabled="!owned(theme)"
					:disabled="saving || !loaded"
					@click="owned(theme) && save({ theme })"
				>
					<span :class="$style.themePreview" :data-locked="!owned(theme)">
						<HataigoBoard :position="previewBoard" :theme="theme" :stones="prefs.stones"></HataigoBoard>
						<i v-if="!owned(theme)" class="ti ti-lock" :class="$style.lock" aria-hidden="true"></i>
					</span>
					<b>{{ themeLabels[theme].name }}</b>
					<small v-if="!owned(theme)">{{ rewardText.conditions[theme] }}</small>
				</button>
			</div>
		</section>

		<section :class="$style.group" aria-labelledby="hataigo-settings-stones">
			<h3 id="hataigo-settings-stones">石</h3>
			<div :class="$style.segment" role="radiogroup" aria-label="石">
				<button v-for="stone in STONES" :key="stone" type="button" role="radio" :class="$style.option" :aria-checked="prefs.stones === stone" :disabled="saving || !loaded" @click="save({ stones: stone })">
					<b>{{ stoneLabels[stone].name }}</b><small>{{ stoneLabels[stone].description }}</small>
				</button>
			</div>
		</section>

		<section :class="$style.group" aria-labelledby="hataigo-settings-placement">
			<h3 id="hataigo-settings-placement">着手</h3>
			<div :class="$style.segment" role="radiogroup" aria-label="着手">
				<button v-for="mode in PLACEMENTS" :key="mode.id" type="button" role="radio" :class="$style.option" :aria-checked="prefs.placement === mode.id" :disabled="saving || !loaded" @click="save({ placement: mode.id })">
					<b>{{ mode.name }}</b><small>{{ mode.note }}</small>
				</button>
			</div>
		</section>

		<section :class="$style.group">
			<label :class="$style.row">
				<span>座標を表示</span>
				<input type="checkbox" :checked="prefs.labels" :disabled="saving || !loaded" @change="save({ labels: ($event.currentTarget as HTMLInputElement).checked })">
			</label>
			<label :class="$style.row">
				<span>棋譜の自動再生</span>
				<select :value="prefs.autoplayInterval" :disabled="saving || !loaded" @change="save({ autoplayInterval: Number(($event.currentTarget as HTMLSelectElement).value) })">
					<option v-for="ms in INTERVALS" :key="ms" :value="ms">{{ ms / 1000 }}秒ごと</option>
				</select>
			</label>
		</section>
		<p v-if="error" :class="$style.error" role="alert">保存できませんでした。もう一度試してください。</p>
	</div>
</HyDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import type { HataigoPrefs } from '@/utility/hataigo/prefs.js';
import HyDialog from '@/components/HyDialog.vue';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import { stoneLabels, themeLabels } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { useHataigoRewards } from '@/utility/hataigo/rewards.js';
import { rewardText } from '@/utility/hataigo/rewards-rules.js';
import { createBoard } from '@/utility/hataigo/rules/board.js';
import { store } from '@/store.js';

const emit = defineEmits<{ closed: [] }>();
const dialog = useTemplateRef('dialog');
const dialogTheme = computed(() => store.r.darkMode.value ? 'dark' : 'light');
const { prefs, loaded, error, save: registrySave } = useHataigoPrefs();
const rewards = useHataigoRewards();
const saving = ref(false);

const THEMES = ['fuji', 'kaya', 'seiji', 'sakura', 'sumi', 'yoru'] as const;
const STONES = ['real', 'flat', 'avatar'] as const;
const PLACEMENTS = [
	{ id: 'auto', name: 'おまかせ', note: 'スマホで盤が小さいときだけ確認' },
	{ id: 'confirm', name: '確認してから', note: '置く場所を見てから打つ' },
	{ id: 'direct', name: 'すぐ打つ', note: '押したらその場で打つ' },
] as const;
const INTERVALS = [500, 1000, 1500, 2000, 3000, 5000];
const previewBoard = createBoard(9, { black: [{ x: 2, y: 2 }, { x: 4, y: 4 }, { x: 6, y: 6 }], white: [{ x: 3, y: 2 }, { x: 5, y: 4 }, { x: 2, y: 6 }] });

function owned(theme: (typeof THEMES)[number]): boolean {
	return theme === 'fuji' || rewards.owned.value.includes(theme);
}

async function save(patch: Partial<HataigoPrefs>): Promise<void> {
	if (saving.value || !loaded.value) return;
	if (patch.theme !== undefined && !owned(patch.theme)) return;
	saving.value = true;
	try { await registrySave(patch); } finally { saving.value = false; }
}

onMounted(() => { void rewards.refresh(); });
</script>

<style module>
.root { display: grid; gap: 22px; }
.group { display: grid; gap: 10px; }
.group h3 { margin: 0; font-size: 14px; }
.themes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.root .theme { all: unset; box-sizing: border-box; display: grid; gap: 4px; justify-items: center; padding: 8px; border-radius: 16px; cursor: pointer; text-align: center; }
.root .theme[aria-checked="true"] { box-shadow: inset 0 0 0 2px var(--hy-accent, #6b4fb8); }
.root .theme:disabled, .root .theme[aria-disabled="true"] { cursor: default; }
.root .theme:focus-visible { outline: 3px solid var(--hy-accent, #6b4fb8); outline-offset: 2px; }
.root .theme b { font-size: 13px; }
.root .theme small { font-size: 11px; opacity: .7; line-height: 1.4; }
.themePreview { position: relative; width: 100%; max-width: 110px; border-radius: 10px; overflow: hidden; }
.themePreview[data-locked="true"] > :first-child { opacity: .45; }
.lock { position: absolute; inset: 0; display: grid; place-items: center; font-size: 22px; }
.segment { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.root .option { all: unset; box-sizing: border-box; min-height: 56px; display: grid; gap: 2px; align-content: center; padding: 8px 10px; border-radius: 14px; background: var(--hy-soft, rgba(0, 0, 0, .05)); cursor: pointer; }
.root .option[aria-checked="true"] { box-shadow: inset 0 0 0 2px var(--hy-accent, #6b4fb8); }
.root .option:focus-visible { outline: 3px solid var(--hy-accent, #6b4fb8); outline-offset: 2px; }
.root .option b { font-size: 13px; }
.root .option small { font-size: 11px; opacity: .72; line-height: 1.4; }
.row { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--hy-border, rgba(0, 0, 0, .1)); font-size: 14px; }
.row input { width: 20px; height: 20px; accent-color: var(--hy-accent, #6b4fb8); }
.row select { min-height: 40px; padding: 0 10px; border-radius: 12px; border: 1px solid var(--hy-border, #ddd); background: var(--hy-surface, #fff); color: inherit; font: inherit; }
.error { margin: 0; color: #c0392b; font-size: 13px; }
@media (max-width: 420px) { .segment { grid-template-columns: minmax(0, 1fr); } }
</style>
