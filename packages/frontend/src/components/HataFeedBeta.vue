<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section>
	<header :class="$style.head"><div><h1>ベータ機能</h1><p>試験中の機能です。気づいたことはイシューへ</p></div><button type="button" class="hy-secondary" @click="emit('createIssue')"><i class="ti ti-pencil-plus" aria-hidden="true"></i>イシューを作成</button></header>
	<div :class="$style.grid">
		<section v-for="feature in hataBetaFeatures" :key="feature.id" class="hf-panel" :class="$style.card"><i class="ti ti-code" :class="$style.icon" aria-hidden="true"></i><h2>{{ feature.title }}</h2><p>{{ feature.desc }}</p><button type="button" class="hy-secondary" @click="router.push(feature.route as never)"><i class="ti ti-arrow-right" aria-hidden="true"></i>開く</button></section>
		<section class="hf-panel" :class="$style.card"><i class="ti ti-clock" :class="$style.icon" aria-hidden="true"></i><h2>投稿前カウントダウン</h2><p>投稿を待っている間に、取り消したりすぐ投稿したりできます</p><MkSwitch v-model="postDelayEnabledModel">{{ copy.enableCountdown }}</MkSwitch><div v-if="postDelayEnabledModel" :class="$style.presets" role="group" :aria-label="copy.waitTimePresets"><span>{{ copy.waitTime }}</span><button v-for="seconds in POST_SEND_DELAY_PRESETS" :key="seconds" type="button" class="hy-secondary" :aria-pressed="postDelaySecondsModel === seconds" @click="postDelaySecondsModel = seconds">{{ tx.seconds({ count: seconds }) }}</button></div></section>
	</div>
</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { useRouter } from '@/router.js';
import { hataBetaFeatures } from '@/utility/hatafeed.js';
import { i18n } from '@/i18n.js';
import { POST_SEND_DELAY_PRESETS, postSendDelayEnabled, postSendDelaySeconds, setPostSendDelayEnabled, setPostSendDelaySeconds } from '@/utility/post-send-delay.js';
const emit = defineEmits<{ createIssue: [] }>();
const router = useRouter();
const copy = i18n.ts._hata._hatafeed._beta;
const tx = i18n.tsx._hata._hatafeed._beta;
const postDelayEnabledModel = computed({ get: () => postSendDelayEnabled.value, set: setPostSendDelayEnabled });
const postDelaySecondsModel = computed({ get: () => postSendDelaySeconds.value, set: setPostSendDelaySeconds });
</script>
<style module>
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 0 24px; }
.head h1 { font-size: 24px; margin: 0; }
.head p, .card p { color: var(--hy-muted); font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.card { padding: 24px; }
.card h2 { font-size: 20px; }
.card p { margin-bottom: 22px; }
.icon { color: var(--hy-accent); font-size: 28px; }
.presets { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 20px; font-size: 12px; }
.presets [aria-pressed='true'] { outline: 2px solid var(--hy-accent); outline-offset: -2px; }
@container hatafeed (max-width: 640px) { .grid { grid-template-columns: minmax(0, 1fr); } .card { padding: 20px; } }
</style>
