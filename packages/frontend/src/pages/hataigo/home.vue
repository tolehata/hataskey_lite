<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div class="home ig-stack">
	<h1 class="greeting">{{ greeting }}</h1>

	<div class="featureGrid">
		<section class="playSection ig-card">
			<div class="sectionHeading">
				<h2><i class="ti ti-swords" aria-hidden="true"></i>{{ hataigoText.play }}</h2>
			</div>
			<div class="modeGrid" role="group" :aria-label="hataigoText.play">
				<button type="button" class="modeCard solo" @click="emit('online', size)">
					<span class="modeIcon"><i class="ti ti-swords" aria-hidden="true"></i></span>
					<b>{{ hataigoText.online }}</b>
				</button>
				<button type="button" class="modeCard" @click="emit('invite', size)">
					<span class="modeIcon"><i class="ti ti-user-plus" aria-hidden="true"></i></span>
					<b>{{ hataigoText.invite }}</b>
				</button>
				<button type="button" class="modeCard" @click="emit('ai', size)">
					<span class="modeIcon"><i class="ti ti-robot" aria-hidden="true"></i></span>
					<b>{{ hataigoText.ai }}</b>
				</button>
				<button type="button" class="modeCard" @click="emit('play', size)">
					<span class="modeIcon"><i class="ti ti-grid-dots" aria-hidden="true"></i></span>
					<b>{{ hataigoText.solo }}</b>
				</button>
			</div>
		</section>
	</div>

	<section class="stats ig-card" aria-labelledby="hataigo-stats">
		<h2 id="hataigo-stats">{{ hataigoText.statistics }}</h2>
		<div class="statRows">
			<div v-for="kind in kinds" :key="kind" class="statGroup">
				<h3>{{ rewardText[kind] }}</h3>
				<div v-if="stats[kind]" class="statNumbers"><span v-for="key in statKeys" :key="key"><b>{{ stats[kind]?.[key] }}</b><small>{{ rewardText[key] }}</small></span></div>
				<p v-else class="ig-muted">{{ rewards.loading.value ? '読み込み中…' : '—' }}</p>
			</div>
		</div>
		<p v-if="rewards.error.value" role="alert">{{ rewards.error.value }} <button type="button" @click="rewards.refresh()">{{ rewardText.retry }}</button></p>
		<button v-if="nextTheme" type="button" class="nextTheme" @click="emit('navigate', 'collection')">
			<i class="ti ti-lock" aria-hidden="true"></i><span>次の盤 <b>{{ themeLabels[nextTheme].name }}</b> · {{ rewardText.conditions[nextTheme] }}</span><i class="ti ti-arrow-right" aria-hidden="true"></i>
		</button>
	</section>
	<Lobby summaryOnly :active="active" :initialSize="size" @open="emit('open', $event)"/>
</div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, watch } from 'vue';
import Lobby from './lobby.vue';
import type { BoardSize } from '@/utility/hataigo/rules/board.js';
import { $i } from '@/i.js';
import { hataigoText, themeLabels } from '@/utility/hataigo/i18n.js';

import { useHataigoRewards } from '@/utility/hataigo/rewards.js';
import { rewardText, THEMES } from '@/utility/hataigo/rewards-rules.js';

defineOptions({ name: 'HataigoHome' });
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });

const emit = defineEmits<{
	play: [size: BoardSize];
	ai: [size: BoardSize];
	online: [size: BoardSize];
	invite: [size: BoardSize];
	'open': [gameId: string];
	navigate: [tab: string];
}>();

const rewards = useHataigoRewards();
const kinds = ['human', 'ai'] as const;
const statKeys = ['wins', 'losses', 'draws', 'streak'] as const;
const stats = computed(() => ({ human: rewards.human.value, ai: rewards.ai.value }));
const nextTheme = computed(() => THEMES.find(theme => !rewards.owned.value.includes(theme)) ?? null);
const greeting = computed(() => {
	const hour = new Date().getHours();
	const name = $i?.name ?? $i?.username ?? '';
	const hello = hour < 4 || hour >= 18 ? 'こんばんは' : hour < 11 ? 'おはようございます' : 'こんにちは';
	return name ? `${hello}、${name}さん` : hello;
});

function refresh(): void { if (props.active) void rewards.refresh(); }

onMounted(refresh);
onActivated(refresh);
watch(() => props.active, refresh);

// 路数は各画面（ひとりで並べる・AIと打つ・人と打つ）の条件で選ぶので、ホームでは選ばせない。初期値だけ渡す
const size: BoardSize = 19;

</script>

<style lang="scss" scoped>
.stats { padding: 16px; border-radius: 24px; display: grid; gap: 12px; }
.stats h2 { margin: 0; font-size: 15px; }
/* 人との対局・AIとの対局を2つの枠に分け、横幅いっぱいに。数字は4等分の真ん中に揃える */
.statRows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.statGroup { min-width: 0; padding: 12px 14px; border-radius: 16px; background: var(--hy-bg); }
.statGroup h3 { margin: 0 0 8px; font-size: 12px; color: var(--hy-muted); font-weight: 700; }
.statGroup p { margin: 0; }
.statNumbers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.statNumbers span { display: grid; justify-items: center; gap: 2px; }
.statNumbers b { font-size: 24px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--hy-accent); line-height: 1.2; }
.statNumbers small { color: var(--hy-muted); font-size: 11px; white-space: nowrap; }
@container (max-width: 520px) { .statRows { grid-template-columns: minmax(0, 1fr); } }
.nextTheme { display: flex; gap: 10px; align-items: center; min-height: 48px; padding: 8px 14px; border: 0; border-radius: 16px; background: var(--hy-bg); color: var(--hy-ink); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.nextTheme > span { flex: 1; }
.nextTheme > i { color: var(--hy-muted); }
.nextTheme:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.stats [role="alert"] button { min-height: 40px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 6px 14px; background: var(--hy-surface); color: var(--hy-ink); font: inherit; cursor: pointer; }
.home { container-type: inline-size; display: grid; gap: 14px; }
.greeting { margin: 0; padding: 0 4px; font-size: 22px; line-height: 1.45; }
.featureGrid { display: grid; gap: 14px; }
.playSection { min-width: 0; padding: 16px; border-radius: 24px; }
.sectionHeading { min-height: 44px; display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sectionHeading h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 15px; }
.sectionHeading h2 i { color: var(--hy-accent); font-size: 20px; }
.modeGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.modeCard { width: 100%; min-width: 0; min-height: 104px; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; border: 0; border-radius: 18px; background: var(--hy-bg); color: var(--hy-ink); text-align: left; font: inherit; }
.modeCard:not(:disabled) { cursor: pointer; }
.modeCard:not(:disabled):hover { background: var(--hy-soft); }
.modeCard.solo:not(:disabled):hover { background: color-mix(in srgb, var(--hy-accent) 88%, #000); }
.modeCard:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.modeCard:disabled { opacity: .72; cursor: default; }
.solo { background: var(--hy-accent); color: var(--hy-on-accent); border-color: var(--hy-accent); }
.modeIcon { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: var(--hy-soft); color: var(--hy-accent); font-size: 22px; }
.solo .modeIcon { background: rgb(255 255 255 / 18%); color: inherit; }
.modeCard b { font-size: 15px; font-weight: 700; }
.emptyCard { min-width: 0; padding: 16px; border-radius: 24px; }
.emptyCard .sectionHeading { justify-content: space-between; margin: 0; }
.emptyCard .sectionHeading h2 { margin: 0; font-size: 15px; }
.emptyCard .sectionHeading > i { color: var(--hy-accent); font-size: 20px; }
.emptyMessage { margin: 16px 0 2px; font-size: 13px; }

@container (max-width: 560px) { .welcome { align-items: flex-start; flex-direction: column; } .modeGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .modeCard { min-height: 92px; padding: 12px; } }
</style>
