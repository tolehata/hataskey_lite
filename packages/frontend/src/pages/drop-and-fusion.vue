<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Transition
	:enterActiveClass="`${$style.transition_zoom_enterActive} ${inHataGoes ? $style.hostTransition : ''}`"
	:leaveActiveClass="`${$style.transition_zoom_leaveActive} ${inHataGoes ? $style.hostTransition : ''}`"
	:enterFromClass="$style.transition_zoom_enterFrom"
	:leaveToClass="$style.transition_zoom_leaveTo"
	:moveClass="`${$style.transition_zoom_move} ${inHataGoes ? $style.hostTransition : ''}`"
	mode="out-in"
>
	<div v-if="!gameStarted" class="_spacer" style="--MI_SPACER-w: 800px;">
		<div :class="[$style.root, inHataGoes && $style.hostRoot]">
			<div class="_gaps">
				<div class="_woodenFrame" style="text-align: center;">
					<div class="_woodenFrameInner">
						<div v-if="inHataGoes" :class="$style.hostKicker">Drop &amp; Fusion</div>
						<img src="/client-assets/drop-and-fusion/logo.png" style="display: block; max-width: 100%; max-height: 200px; margin: auto;"/>
					</div>
				</div>
				<div class="_woodenFrame" style="text-align: center;">
					<div class="_woodenFrameInner">
						<div class="_gaps" style="padding: 16px;">
							<MkSelect v-if="!inHataGoes" v-model="gameMode" :items="gameModeDef"></MkSelect>
							<div v-else :class="$style.hostModes" role="group" aria-label="ゲームモード">
								<button v-for="mode in hostModes" :key="mode.value" type="button" :aria-label="mode.label" :title="mode.label" :aria-pressed="gameMode === mode.value" @click="gameMode = mode.value"><i :class="mode.icon" aria-hidden="true"></i><span v-if="gameMode === mode.value">{{ mode.label }}</span></button>
							</div>
							<MkButton primary gradate large rounded inline @click="start"><i v-if="inHataGoes" class="ti ti-player-play" aria-hidden="true"></i> {{ i18n.ts.start }}</MkButton>
						</div>
					</div>
					<div class="_woodenFrameInner">
						<div class="_gaps" style="padding: 16px;">
							<div style="font-size: 90%;"><i class="ti ti-music"></i> {{ i18n.ts.soundWillBePlayed }}</div>
							<MkSwitch v-model="mute">
								<template #label>{{ i18n.ts.mute }}</template>
							</MkSwitch>
						</div>
					</div>
				</div>
				<div class="_woodenFrame">
					<div class="_woodenFrameInner">
						<div class="_gaps_s" style="padding: 16px;">
							<div><b>{{ i18n.tsx.lastNDays({ n: 7 }) }} {{ i18n.ts.ranking }}</b> ({{ gameMode.toUpperCase() }})</div>
							<div v-if="ranking" class="_gaps_s">
								<div v-for="r in ranking" :key="r.id" :class="$style.rankingRecord">
									<MkAvatar v-if="r.user" :link="true" style="width: 24px; height: 24px; margin-right: 4px;" :user="r.user"/>
									<MkUserName v-if="r.user" :user="r.user" :nowrap="true"/>
									<b style="margin-left: auto;">{{ r.score.toLocaleString() }} {{ getScoreUnit(gameMode) }}</b>
								</div>
							</div>
							<div v-else>{{ i18n.ts.loading }}</div>
						</div>
					</div>
				</div>
				<div class="_woodenFrame">
					<div class="_woodenFrameInner" style="padding: 16px;">
						<div style="font-weight: bold;">{{ i18n.ts._bubbleGame.howToPlay }}</div>
						<ol>
							<li>{{ i18n.ts._bubbleGame._howToPlay.section1 }}</li>
							<li>{{ i18n.ts._bubbleGame._howToPlay.section2 }}</li>
							<li>{{ i18n.ts._bubbleGame._howToPlay.section3 }}</li>
						</ol>
					</div>
				</div>
				<div class="_woodenFrame">
					<div class="_woodenFrameInner">
						<div class="_gaps_s" style="padding: 16px;">
							<div><b>Credit</b></div>
							<div>
								<div>Ai-chan illustration: @poteriri@misskey.io</div>
								<div>BGM: @ys@misskey.design</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<XGame v-else :gameMode="gameMode" :mute="mute" @end="onGameEnd"/>
</Transition>
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import XGame from './drop-and-fusion.game.vue';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const inHataGoes = inject(HATA_GOES_HOST, null) != null;
const hostModes = [
	{ label: 'NORMAL', value: 'normal', icon: 'ti ti-circle' },
	{ label: 'SQUARE', value: 'square', icon: 'ti ti-square' },
	{ label: 'YEN', value: 'yen', icon: 'ti ti-currency-yen' },
	{ label: 'SWEETS', value: 'sweets', icon: 'ti ti-cake' },
] as const;

const {
	model: gameMode,
	def: gameModeDef,
} = useMkSelect({
	items: [
		{ label: 'NORMAL', value: 'normal' },
		{ label: 'SQUARE', value: 'square' },
		{ label: 'YEN', value: 'yen' },
		{ label: 'SWEETS', value: 'sweets' },
		//{ label: 'SPACE', value: 'space' },
	],
	initialValue: 'normal',
});
const gameStarted = ref(false);
const mute = ref(false);
const ranking = ref<Misskey.entities.BubbleGameRankingResponse | null>(null);

watch(gameMode, async () => {
	ranking.value = await misskeyApiGet('bubble-game/ranking', { gameMode: gameMode.value });
}, { immediate: true });

function getScoreUnit(gameMode: string) {
	return gameMode === 'normal' ? 'pt' :
		gameMode === 'square' ? 'pt' :
		gameMode === 'yen' ? '円' :
		gameMode === 'sweets' ? 'kcal' :
		gameMode === 'space' ? 'pt' :
		'' as never;
}

async function start() {
	gameStarted.value = true;
}

function onGameEnd() {
	gameStarted.value = false;
}

definePage(() => ({
	title: i18n.ts.bubbleGame,
	icon: 'ti ti-device-gamepad',
}));
</script>

<style lang="scss" module>
.transition_zoom_move,
.transition_zoom_enterActive,
.transition_zoom_leaveActive {
	transition: opacity 0.5s cubic-bezier(0,.5,.5,1), transform 0.5s cubic-bezier(0,.5,.5,1) !important;
}
.transition_zoom_enterFrom,
.transition_zoom_leaveTo {
	opacity: 0;
	transform: scale(0.8);
}
.transition_zoom_move.hostTransition,
.transition_zoom_enterActive.hostTransition,
.transition_zoom_leaveActive.hostTransition {
	transition-duration: .18s !important;
}
.transition_zoom_enterFrom.hostTransition,
.transition_zoom_leaveTo.hostTransition { transform: scale(.97); }

.root {
	margin: 0 auto;
	max-width: 600px;
	user-select: none;

	* {
		user-select: none;
	}
}

.hostRoot { max-width: 800px; container-type: inline-size; }
.hostRoot > :global(._gaps) { display: grid; grid-template-columns: 1fr; gap: 12px; }
.hostRoot > :global(._gaps) > :global(._woodenFrame) { min-width: 0; }
.hostRoot > :global(._gaps) > :global(._woodenFrame:first-child) { background: var(--MI_THEME-accentedBg); }
.hostRoot > :global(._gaps) > :global(._woodenFrame:first-child) img { max-height: 132px !important; }
.hostKicker { margin: 8px 0; font-size: 12px; font-weight: 700; letter-spacing: .08em; color: var(--MI_THEME-accent); }
.hostModes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.hostModes button {
	display: inline-flex; align-items: center; justify-content: center; gap: 6px;
	min-width: 40px; min-height: 40px; padding: 6px 11px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px;
	background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
	transition: background .16s, border-color .16s, transform .16s;
	&[aria-pressed='true'] { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); }
	&:hover { transform: translateY(-2px); border-color: var(--MI_THEME-accent); }
}
@container (min-width: 620px) {
	.hostRoot > :global(._gaps) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.rankingRecord {
	display: flex;
	line-height: 24px;
	padding-top: 4px;
	white-space: nowrap;
	overflow: visible;
	text-overflow: ellipsis;
}
</style>
