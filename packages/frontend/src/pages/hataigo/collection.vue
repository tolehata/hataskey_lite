<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div class="collection ig-stack">
	<section class="heading">
		<h1>{{ hataigoText.collection }}</h1>
		<span class="ownedCount">{{ rewards.owned.value.length }} / {{ themes.length }}</span>
	</section>

	<p v-if="rewards.error.value" class="ig-alert" role="alert">{{ rewards.error.value }} <button type="button" @click="rewards.refresh()">{{ rewardText.retry }}</button></p>
	<section class="themeGrid" :aria-label="hataigoText.boardTheme">
		<article v-for="theme in themes" :key="theme.id" class="themeCard ig-card" :data-locked="!rewards.owned.value.includes(theme.id)">
			<div class="preview">
				<HataigoBoard :position="previewBoard" :size="9" :theme="theme.id" :stones="prefs.stones" :labels="false" :blackAvatar="avatarUrl" :whiteAvatar="avatarUrl" :blackInitial="avatarInitial" :whiteInitial="avatarInitial"/>
				<i v-if="!rewards.owned.value.includes(theme.id)" class="ti ti-lock lock" aria-hidden="true"></i>
			</div>
			<div class="themeDetails">
				<h2>{{ themeLabels[theme.id].name }}</h2>
				<p class="ig-muted">{{ rewardText.conditions[theme.id] }}</p>
				<button v-if="rewards.owned.value.includes(theme.id)" type="button" class="selectTheme" :aria-pressed="prefs.theme === theme.id" :disabled="saving || !loaded" @click="save(theme.id)">
					{{ prefs.theme === theme.id ? hataigoText.selected : rewardText.use }}
				</button>
			</div>
		</article>
	</section>
	<p class="ig-muted note">{{ rewardText.conditionNote }}</p>
	<p v-if="error" class="ig-alert" role="alert">保存できませんでした。もう一度試してください。</p>
</div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue';
import type { HataigoPrefs } from '@/utility/hataigo/prefs.js';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import { $i } from '@/i.js';
import { hataigoText, themeLabels } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { createBoard } from '@/utility/hataigo/rules/board.js';
import { useHataigoRewards } from '@/utility/hataigo/rewards.js';
import { rewardText } from '@/utility/hataigo/rewards-rules.js';

defineOptions({ name: 'HataigoCollection' });
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const rewards = useHataigoRewards();

function refresh(): void { if (props.active) void rewards.refresh(); }

onMounted(refresh);
onActivated(refresh);
watch(() => props.active, refresh);

const { prefs, loaded, error, save: registrySave } = useHataigoPrefs();
const saving = ref(false);
const themes = (['fuji', 'kaya', 'seiji', 'sakura', 'sumi', 'yoru'] as const).map(id => ({ id }));
const previewBoard = createBoard(9, {
	black: [{ x: 2, y: 2 }, { x: 4, y: 3 }, { x: 6, y: 5 }],
	white: [{ x: 3, y: 2 }, { x: 5, y: 4 }, { x: 2, y: 6 }],
});
const avatarUrl = $i?.avatarUrl ?? '';
const avatarInitial = Array.from($i?.name ?? $i?.username ?? '黒')[0] ?? '黒';

async function save(theme: HataigoPrefs['theme']): Promise<void> {
	if (saving.value || !loaded.value || !rewards.owned.value.includes(theme)) return;
	saving.value = true;
	try {
		await registrySave({ theme });
	} finally {
		saving.value = false;
	}
}
</script>

<style lang="scss" scoped>
.collection { container-type: inline-size; }
.heading { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.heading h1 { margin: 0; font-size: 22px; }
.ownedCount { flex: none; padding: 4px 12px; border-radius: 999px; background: var(--hy-soft); color: var(--hy-accent); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.themeGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.themeCard { min-width: 0; display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 14px; padding: 14px; border-radius: 22px; }
.preview { position: relative; width: 112px; aspect-ratio: 1; overflow: hidden; border-radius: 14px; }
.themeCard[data-locked='true'] .preview > :first-child { opacity: .4; }
.lock { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; color: var(--hy-ink); }
.themeDetails { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.themeDetails h2 { margin: 0; font-size: 16px; }
.themeDetails > p { margin: 0; font-size: 13px; }
.selectTheme { align-self: flex-start; min-height: 40px; margin-top: 4px; padding: 6px 14px; border: 0; border-radius: 999px; background: var(--hy-soft); color: var(--hy-accent); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.selectTheme[aria-pressed='true'] { background: var(--hy-accent); color: var(--hy-on-accent); }
.selectTheme:disabled { opacity: .6; cursor: default; }
.note { margin: 0; padding: 0 4px; font-size: 12px; }
.ig-alert { margin: 0; }
@container (max-width: 1000px) { .themeGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (max-width: 620px) { .themeGrid { grid-template-columns: minmax(0, 1fr); } }
</style>
