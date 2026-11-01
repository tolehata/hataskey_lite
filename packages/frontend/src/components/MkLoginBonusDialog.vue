<!--
SPDX-FileCopyrightText: syuilo and misskey-project & Hata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" preferType="dialog" @click="close" @esc="close" @closed="emit('closed')">
	<section :class="$style.root" role="dialog" aria-modal="true" :aria-labelledby="titleId" @click.stop>
		<header :class="$style.header">
			<i class="ti ti-calendar-check" aria-hidden="true"></i>
			<h2 :id="titleId">{{ copy.title }}</h2>
		</header>
		<div :class="$style.body">
			<p :class="$style.eyebrow">{{ copy.totalLogins }}</p>
			<div :class="$style.count">
				<strong :class="$style.days">{{ loginDays.toLocaleString() }}</strong>
				<span :class="$style.dayUnit">{{ copy.dayUnit }}</span>
			</div>
			<p :class="$style.message">{{ getMessage() }}</p>
			<p v-if="ranking > 0" :class="$style.ranking">
				<i class="ti ti-crown" aria-hidden="true"></i>
				<span>{{ copy.serverRankPrefix }} <strong>{{ i18n.tsx._hata._loginBonus.rank({ rank: ranking }) }}</strong></span>
			</p>
			<section v-if="newAchievement" :class="$style.achievement">
				<i class="ti ti-trophy" aria-hidden="true"></i>
				<div><p>{{ copy.newAchievement }}</p><strong>{{ newAchievement }}</strong></div>
			</section>
			<section :class="$style.nextReward" :aria-label="copy.untilNextAchievement">
				<template v-if="nextMilestone != null">
					<div :class="$style.nextLine">
						<span>{{ copy.untilNextAchievement }}</span>
						<I18n :src="copy.remainingDays" tag="strong"><template #days><b :class="$style.remainingDays">{{ nextRewardDays }}</b></template></I18n>
					</div>
					<div :class="$style.track" aria-hidden="true"><div :class="$style.fill" :style="{ width: `${progress}%` }"></div></div>
					<div :class="$style.milestones">
						<span>{{ i18n.tsx._hata._loginBonus.days({ days: previousMilestone }) }}</span>
						<span>{{ i18n.tsx._hata._loginBonus.loginAchievement({ days: nextMilestone }) }}</span>
					</div>
				</template>
				<p v-else :class="$style.allDone">{{ copy.allAchievementsEarned }}</p>
			</section>
			<MkButton :class="$style.closeButton" primary rounded full autofocus @click="close">{{ i18n.ts.ok }}</MkButton>
		</div>
	</section>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, useId } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import I18n from '@/components/global/I18n.vue';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const copy = i18n.ts._hata._loginBonus;

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const modal = ref<InstanceType<typeof MkModal>>();
const ranking = ref(0);
const titleId = useId();

const loginDays = computed(() => $i?.loggedInDays ?? 0);

const milestones = [3, 7, 15, 30, 60, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const newAchievement = computed(() => {
	const days = loginDays.value;
	return milestones.includes(days) ? i18n.tsx._hata._loginBonus.loginAchievement({ days }) : null;
});

const nextMilestone = computed(() => milestones.find(days => days > loginDays.value));
const previousMilestone = computed(() => [...milestones].reverse().find(days => days <= loginDays.value) ?? 0);
const nextRewardDays = computed(() => (nextMilestone.value ?? loginDays.value) - loginDays.value);
const progress = computed(() => {
	if (nextMilestone.value == null) return 100;
	return (loginDays.value - previousMilestone.value) / (nextMilestone.value - previousMilestone.value) * 100;
});

function getMessage() {
	const days = loginDays.value;
	if (days === 1) return copy.messageFirst;
	if (days < 7) return copy.messageGettingStarted;
	if (days < 30) return copy.messageRegular;
	if (days < 100) return copy.messageThanks;
	if (days < 365) return copy.messageAmazing;
	return copy.messageLegend;
}

function close() {
	modal.value?.close();
}

onMounted(async () => {
	// ランキングを取得
	try {
		const res = await misskeyApi('hata/login-ranking', {});
		if (res && typeof res.rank === 'number') {
			ranking.value = res.rank;
		}
	} catch (err) {
		console.warn('Login ranking API not available:', err);
		ranking.value = 0;
	}
});
</script>

<style lang="scss" module>
.root {
	--login-accent-ink: color-mix(in srgb, var(--MI_THEME-accent) 30%, var(--MI_THEME-fg));
	--login-muted: color-mix(in srgb, var(--MI_THEME-fg) 85%, var(--MI_THEME-panel));
	margin: auto;
	box-sizing: border-box;
	flex-shrink: 0;
	width: 400px;
	max-width: 100%;
	max-height: calc(100dvh - 64px);
	overflow: auto;
	container: login-panel / inline-size;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-fg) 10%, transparent);
	border-radius: 28px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	box-shadow: 0 24px 72px var(--MI_THEME-shadow);
	font-size: 14px;
	line-height: 1.6;
	line-break: strict;
	overflow-wrap: anywhere;
}

.header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 9px;
	padding: 20px 24px 0;
	text-align: center;

	i { flex: none; font-size: 20px; color: var(--login-accent-ink); }
	h2 { margin: 0; font-size: 15px; line-height: 1.5; font-weight: 700; }
}

.body { padding: 27px 28px 24px; text-align: center; }
.eyebrow { margin: 0 0 5px; color: var(--login-muted); font-size: 13px; }
.count { display: flex; align-items: baseline; justify-content: center; gap: 9px; line-height: 1.1; }
.days { font-size: 80px; font-weight: 750; letter-spacing: -0.055em; font-variant-numeric: tabular-nums; }
.dayUnit { font-size: 19px; font-weight: 600; }
.message { margin: 16px 0 22px; color: var(--login-muted); text-wrap: pretty; }
.ranking {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	margin: 0 0 23px;
	font-size: 13px;

	i { flex: none; font-size: 18px; color: var(--login-accent-ink); }
	strong { font-size: 16px; }
}
.achievement {
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 0 0 16px;
	padding: 15px 16px;
	border-radius: 18px;
	background: var(--MI_THEME-accentedBg);
	text-align: left;

	i { flex: none; font-size: 30px; color: var(--login-accent-ink); }
	p { margin: 0; font-size: 12px; color: var(--login-accent-ink); }
	strong { display: block; margin-top: 2px; font-size: 15px; }
}
.nextReward { padding: 16px; border: 1px solid var(--MI_THEME-divider); border-radius: 18px; text-align: left; }
.nextLine {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 8px;
	font-size: 13px;

	> span { color: var(--login-muted); }
	> strong { white-space: nowrap; }
}
.remainingDays { margin: 0 3px; font-size: 18px; color: var(--login-accent-ink); }
.track { height: 5px; margin-top: 13px; overflow: hidden; border-radius: 99px; background: var(--MI_THEME-divider); }
.fill { height: 100%; border-radius: inherit; background: var(--MI_THEME-accent); }
.milestones { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; color: var(--login-muted); font-size: 12px; }
.allDone { margin: 0; color: var(--login-accent-ink); font-size: 13px; font-weight: 600; text-align: center; }
.closeButton { min-height: 46px; margin-top: 23px; padding: 11px 24px; font-weight: 700; }

@container login-panel (max-width: 340px) {
	.body { padding: 24px 20px 20px; }
	.header { padding: 20px 20px 0; }
	.days { font-size: 68px; }
	.nextReward { padding: 14px; }
	.ranking { margin-bottom: 20px; }
}
</style>
