<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
HataSideStudio のサイドメニュー専用。元の Hatask お花ウィジェットには影響させない。
-->
<template>
<button type="button" :class="$style.root" :data-size="props.size" @click="router.pushByPath(hatagoesUrl('/hatask?tab=garden'))">
	<span :class="$style.ring" :style="{ '--progress': `${flower.progress * 3.6}deg` }" role="progressbar" :aria-valuenow="flower.progress" aria-valuemin="0" aria-valuemax="100">
		<span><HataskEmoji :emoji="flower.emoji"/></span>
	</span>
	<span :class="$style.copy">
		<small>{{ copy.growing }}</small>
		<strong>{{ growingFlowerName }}</strong>
		<span :class="$style.progress">{{ flower.progress }}%</span>
		<span :class="$style.remaining">{{ remainingText }}</span>
	</span>
</button>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { HataskFlower } from '@/utility/hatask-flower-widget.js';
import type { HataskGrowingFlower } from '@/utility/hatask-flower-growth.js';
import { normalizeGrowingFlower } from '@/utility/hatask-flower-widget.js';
import { HATASK_FLOWER_GROWTH_EVENT } from '@/utility/hatask-flower-growth.js';
import { localizeFloraName } from '@/utility/hatask-flora.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';
// 旗鯖fork: 単独の Hatask 画面は廃止したので、HataGoes の中の Hatask のおはなを開く。
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';
import { i18n } from '@/i18n.js';
import HataskEmoji from '@/components/HataskEmoji.vue';

const props = defineProps<{ size: 'small' | 'normal' | 'large' }>();
const router = useRouter();
const copy = i18n.ts._hata._hataSideStudio._flowers;
const flower = ref<HataskFlower>(normalizeGrowingFlower(null));
const growingFlowerName = computed(() => localizeFloraName(flower.value.name));
let refreshTimer: number | null = null;

const remainingText = computed(() => {
	if (flower.value.progress >= 100) return copy.bloomed;
	const minutes = Math.max(0, flower.value.targetMinutes - flower.value.totalMinutes);
	if (minutes < 60) return copy.soon;
	return copy.hoursRemaining.replace('{hours}', Math.ceil(minutes / 60).toString());
});

async function loadFlower() {
	try {
		flower.value = normalizeGrowingFlower(await misskeyApi('i/registry/get', { key: 'flower', scope: ['client', 'hatask'] }));
	} catch {
		// Registry がまだ無い利用者には既定の芽を表示する。
	}
}

function onFlowerGrowth(event: Event): void {
	flower.value = normalizeGrowingFlower((event as CustomEvent<HataskGrowingFlower>).detail);
}

onMounted(() => {
	void loadFlower();
	refreshTimer = window.setInterval(() => void loadFlower(), 60_000);
	window.addEventListener(HATASK_FLOWER_GROWTH_EVENT, onFlowerGrowth);
});
onUnmounted(() => {
	if (refreshTimer != null) window.clearInterval(refreshTimer);
	window.removeEventListener(HATASK_FLOWER_GROWTH_EVENT, onFlowerGrowth);
});
</script>

<style lang="scss" module>
.root {
	display:grid;
	grid-template-columns:auto minmax(0,1fr);
	align-items:center;
	gap:10px;
	width:100%;
	height:100%;
	min-height:72px;
	padding:8px 10px;
	box-sizing:border-box;
	color:inherit;
	border:0;
	background:transparent;
	text-align:left;
	cursor:pointer;
}
.ring { display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:conic-gradient(var(--MI_THEME-accent) var(--progress),color-mix(in srgb,var(--MI_THEME-accent) 13%,var(--MI_THEME-panel)) 0); }
.ring > span { display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--MI_THEME-panel);font-size:21px; }
.copy { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;column-gap:6px;min-width:0; }
.copy small { grid-column:1/-1;color:var(--MI_THEME-accent);font-size:.62rem;font-weight:750; }
.copy strong { overflow:hidden;font-size:.82rem;text-overflow:ellipsis;white-space:nowrap; }
.progress { font-size:.9rem;font-weight:800;font-variant-numeric:tabular-nums; }
.remaining { grid-column:1/-1;margin-top:1px;font-size:.69rem;opacity:.68;white-space:nowrap; }
.root[data-size="small"] .ring { width:42px;height:42px; }.root[data-size="small"] .ring > span { width:33px;height:33px;font-size:18px; }
</style>
