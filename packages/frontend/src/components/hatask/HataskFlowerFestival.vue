<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.festival" :data-motion="animations ? 'on' : 'off'">
	<div :class="$style.heading"><strong>{{ i18n.tsx._hata._hatask._flowerFestival.title({ season: seasonName }) }}</strong><span :class="$style.count">{{ festival.total.toLocaleString(versatileLang) }}<small> {{ i18n.tsx._hata._hatask._flowerFestival.goalDrops({ goal: festival.goal.toLocaleString(versatileLang) }) }}</small></span></div>
	<div :class="$style.bar" role="progressbar" :aria-label="copy.label" :aria-valuenow="festival.total" :aria-valuemin="0" :aria-valuemax="festival.goal"><span :style="{ width: `${Math.min(100, festival.total / Math.max(1, festival.goal) * 100)}%` }"></span></div>
	<small :class="$style.summary"><template v-if="festival.bloomedAt">{{ copy.fullBloom }}<template v-if="festival.seedReceived">{{ copy.seedReceived }}</template></template><template v-else>{{ i18n.tsx._hata._hatask._flowerFestival.endSummary({ date: endDate }) }}</template></small>
	<div v-if="festival.recentParticipants.length" :class="$style.people">
		<span v-for="(person, index) in festival.recentParticipants.slice(0, 5)" :key="person.id" :class="$style.person">
			<span :class="$style.avatar" :style="{ background: colors[index] }" aria-hidden="true">{{ (person.name || person.username).slice(0, 1) }}</span>
			<I18n :src="copy.participantPoured" tag="span" textTag="span" :class="$style.personText">
				<template #name><Mfm :text="person.name || person.username" :plain="true" :nowrap="false" :enableEmojiMenu="false"/></template>
			</I18n>
		</span>
	</div>
</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import I18n from '@/components/global/I18n.vue';
import Mfm from '@/components/global/MkMfm.js';
import type { HataskFlowerFestival } from '@/utility/hatask-flower-v2.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
const props = defineProps<{ festival: HataskFlowerFestival; animations: boolean }>();
const copy = i18n.ts._hata._hatask._flowerFestival;
const colors = ['#e0567a', '#6b8fd6', '#55864f', '#c7803a', '#8a6bd1'];
const seasonName = computed(() => copy[props.festival.season]);
const endDate = computed(() => new Date(props.festival.endsAt).toLocaleDateString(versatileLang, { month: 'numeric', day: 'numeric' }));
</script>
<style lang="scss" module>
.festival {display:grid;gap:8px;margin-bottom:12px;padding:12px 14px;border-radius:16px;background:var(--fill);border:1px solid var(--rule);min-width:0;line-break:strict;overflow-wrap:anywhere;}
.heading {display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;min-width:0;} .heading strong {font:700 15px var(--htk-font-head);}
.count {margin-left:auto;font:800 18px Archivo,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;} .count small {font-size:12px;color:var(--fg-2);}
.bar {height:10px;border-radius:999px;background:var(--fill-2);overflow:hidden;} .bar span {display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#f2a04b,var(--accent));transition:width .6s cubic-bezier(.2,0,0,1);}
.summary {color:var(--fg-2);font-size:12px;line-height:1.6;}
.people {display:flex;gap:6px;flex-wrap:wrap;min-width:0;}.person {display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 10px 4px 4px;border-radius:999px;background:var(--masthead);font-size:12px;} .person>span:last-child {min-width:0;} .avatar {flex:none;width:22px;height:22px;display:grid;place-items:center;border-radius:999px;color:#fff;font-size:11px;font-weight:700;}
.personText > span {display:inline-block;max-width:100%;}
.festival[data-motion='off'] .bar span {transition:none;} @media(prefers-reduced-motion:reduce){.bar span{transition:none;}}
</style>
