<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 同じ地点に複数の地震がある場合に、どの地震かをカード一覧で選ぶダイアログ。
-->
<template>
<MkModalWindow
	ref="windowEl"
	:width="420"
	:height="480"
	:withOkButton="false"
	:withCloseButton="true"
	@close="windowEl?.close()"
	@closed="emit('closed')"
>
	<template #header><i class="ti ti-map-pin"></i> この地点の地震</template>
	<div class="_spacer" style="--MI_SPACER-min: 16px; --MI_SPACER-max: 22px;">
		<div :class="$style.note">この地点には複数の地震情報があります。表示したい地震を選んでください。</div>
		<div :class="$style.list">
			<button v-for="q in quakes" :key="q._key" :class="$style.card" @click="choose(q)">
				<span :class="$style.badge" :style="{ background: scaleToColor(q.earthquake?.maxScale ?? -1), color: scaleTextColor(q.earthquake?.maxScale ?? -1) }">
					<span :class="$style.bLabel">震度</span><span :class="$style.bNum">{{ scaleToLabel(q.earthquake?.maxScale ?? -1) }}</span>
				</span>
				<span :class="$style.info">
					<span :class="$style.hypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}</span>
					<span :class="$style.meta">
						<span v-if="q.earthquake?.hypocenter?.magnitude >= 0">M{{ q.earthquake.hypocenter.magnitude }}</span>
						<span>{{ q.earthquake?.time || q.time }}</span>
						<span v-if="q._reportCount > 1" :class="$style.rep">{{ q._reportCount }}報</span>
					</span>
				</span>
				<i class="ti ti-chevron-right" :class="$style.arrow"></i>
			</button>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import { scaleToLabel, scaleToColor, scaleTextColor } from '@/utility/earthquake.js';

defineProps<{ quakes: any[] }>();
const emit = defineEmits<{ (ev: 'pick', key: string): void; (ev: 'closed'): void }>();
const windowEl = useTemplateRef('windowEl');

function choose(q: any) {
	emit('pick', q._key);
	windowEl.value?.close();
}
</script>

<style lang="scss" module>
.note { font-size: .88em; opacity: .8; margin-bottom: 12px; line-height: 1.6; }
.list { display: flex; flex-direction: column; gap: 8px; }
.card {
	display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; color: inherit; cursor: pointer;
	background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 12px; padding: 10px 12px;
	transition: border-color .15s;
}
.card:hover { border-color: var(--MI_THEME-accent); }
.badge { flex-shrink: 0; width: 46px; height: 46px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
.bLabel { font-size: .58em; font-weight: 700; opacity: .9; }
.bNum { font-size: 1.35em; font-weight: 900; }
.info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.hypo { font-weight: 800; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: .8em; opacity: .8; margin-top: 2px; }
.rep { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); padding: 0 6px; border-radius: 6px; font-weight: 700; }
.arrow { opacity: .4; flex-shrink: 0; }
</style>
