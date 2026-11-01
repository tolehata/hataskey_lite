<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34/#36): 地震・津波情報の電光掲示板(ticker)共通コンポーネント。
  - mode='full': 1行レイアウト(地震ページ用、h=64px)
  - mode='compact': 2行レイアウト(カラム/ウィジェット/Haskタイル用、h=110px前後)
  受身型: 親(rawQuakes/tsunami)を渡す形。WS購読/fetchは親側で。
-->
<template>
<div v-if="latestQuake" :class="[$style.ticker, { [$style.accessible]: accessible }, mode === 'compact' ? $style.compact : $style.full]">
	<Transition name="hfEqFade" mode="out-in">
		<div :key="latestQuake._key" :class="$style.tickerInner">
			<!-- 左: 最大震度バッジ -->
			<div :class="$style.tickerBadge" :style="{ background: scaleToColor(latestQuake.earthquake?.maxScale ?? -1) }">
				<span :class="$style.tBadgeLabel">最大震度</span>
				<span :class="$style.tBadgeNum">{{ scaleToLabel(latestQuake.earthquake?.maxScale ?? -1) }}</span>
			</div>
			<!-- 右: 上=震源/時刻、下=スクロール (compact時) / 横並び (full時) -->
			<div :class="$style.tickerRight">
				<div :class="$style.tickerHypo">
					<span :class="$style.tHypoName">{{ latestQuake.earthquake?.hypocenter?.name || '震源調査中' }}</span>
					<span :class="$style.tHypoTime">{{ latestQuake.earthquake?.time || latestQuake.time }}</span>
				</div>
				<div ref="scrollEl" :class="$style.tickerScroll">
					<div v-if="items.length" ref="trackEl" :class="[$style.tickerTrack, { [$style.tickerFixed]: !overflowing }]" :style="overflowing ? { animationDuration: tickerDuration } : {}">
						<template v-for="(it, i) in displayItems" :key="i">
							<span v-if="it.kind === 'header'" :class="$style.tHeader">▸ {{ it.text }}</span>
							<span v-else-if="it.kind === 'scale'" :class="$style.tItem"><span :class="$style.tItemScale" :style="{ background: scaleToColor(it.scale ?? -1) }">{{ scaleToLabel(it.scale ?? -1) }}</span>{{ it.text }}</span>
							<span v-else :class="$style.tItem">{{ it.text }}</span>
						</template>
					</div>
					<div v-else :class="$style.tickerNone">情報を受信中…</div>
				</div>
			</div>
		</div>
	</Transition>
</div>
<div v-else-if="showEmpty" :class="[$style.ticker, { [$style.accessible]: accessible }, mode === 'compact' ? $style.compact : $style.full, $style.empty]">
	<i class="ti ti-activity"></i> 最近の地震情報はありません
</div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch, useTemplateRef } from 'vue';
import { scaleToLabel, scaleToColor, generateTickerItems, dedupeQuakes } from '@/utility/earthquake.js';

const props = withDefaults(defineProps<{
	quakes: any[]; // 親から渡される地震情報(生レコード列。dedupe前)
	tsunami?: any[]; // 親から渡される津波情報(参考用)
	mode?: 'full' | 'compact';
	accessible?: boolean;
	showEmpty?: boolean; // 地震情報なしの時のプレースホルダーを出すか
}>(), {
	tsunami: () => [],
	mode: 'full',
	accessible: false,
	showEmpty: false,
});

// 集約済み(第○報マージ済み)。
const aggregated = computed(() => dedupeQuakes(props.quakes ?? []));
const latestQuake = computed(() => aggregated.value[0] ?? null);
const items = computed(() => generateTickerItems(latestQuake.value, props.quakes ?? []));
const tickerDuration = computed(() => Math.max(22, items.value.length * 1.6) + 's');

// 旗鯖fork: テキストがスクロール領域の幅に収まれば固定表示・収まらなければスクロール。
//   ResizeObserver で枠サイズの変更を監視し、ウィンドウサイズ変更にもリロードなしで追従する。
const scrollEl = useTemplateRef<HTMLElement>('scrollEl');
const trackEl = useTemplateRef<HTMLElement>('trackEl');
const overflowing = ref(true);
const itemsDoubled = computed(() => [...items.value, ...items.value]);
// 固定表示時は1セットだけ、スクロール表示時はシームレスループ用に2連結。
const displayItems = computed(() => overflowing.value ? itemsDoubled.value : items.value);

function checkOverflow() {
	if (!scrollEl.value || !trackEl.value) return;
	const contentW = trackEl.value.scrollWidth; // 描画中のtrack(items 1セット or 2連結)の幅
	const containerW = scrollEl.value.clientWidth; // スクロール領域の見えてる幅
	// overflowing=true(現在2連結) のとき: contentW は items の2倍。中身1セット分(contentW/2)が枠より大きいか
	// overflowing=false(現在1セット) のとき: contentW が items 1セット分。それが枠より大きいか
	const unitW = overflowing.value ? contentW / 2 : contentW;
	overflowing.value = unitW > containerW - 8; // 8pxの余白を許容
}

let ro: ResizeObserver | null = null;
onMounted(() => {
	ro = new ResizeObserver(() => checkOverflow());
	if (scrollEl.value) ro.observe(scrollEl.value);
	if (trackEl.value) ro.observe(trackEl.value);
	nextTick(checkOverflow);
});
onUnmounted(() => { ro?.disconnect(); });
// items が変わったら再判定(新しい地震・新着報など)。
watch(items, () => nextTick(checkOverflow));
</script>

<style lang="scss" module>
.ticker {
	background: #0b0e13; color: #fff;
	border-radius: 12px; overflow: hidden;
	border: 1px solid var(--MI_THEME-divider);
}
.full { height: 64px; display: flex; align-items: stretch; }
.compact { height: 110px; display: flex; align-items: stretch; }
.empty { background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); height: 56px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: .85em; opacity: .65; }

.tickerInner { display: flex; align-items: stretch; width: 100%; height: 100%; }

.tickerBadge { flex-shrink: 0; width: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.tBadgeLabel { font-size: .6em; font-weight: 700; opacity: .95; }
.tBadgeNum { font-size: 1.7em; font-weight: 900; }

.tickerRight { flex: 1; min-width: 0; display: flex; }
.full .tickerRight { flex-direction: row; align-items: stretch; }
.compact .tickerRight { flex-direction: column; }

.tickerHypo { flex-shrink: 0; padding: 0 12px; display: flex; flex-direction: column; justify-content: center; }
.full .tickerHypo { max-width: 38%; border-right: 1px solid rgba(255,255,255,.12); }
.compact .tickerHypo { width: 100%; padding: 6px 12px 4px; border-bottom: 1px solid rgba(255,255,255,.12); }
.tHypoName { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tHypoTime { font-size: .72em; opacity: .65; }

.tickerScroll { flex: 1; min-width: 0; overflow: hidden; position: relative; display: flex; align-items: center; }
.tickerTrack { display: inline-flex; align-items: center; gap: 22px; white-space: nowrap; padding-left: 22px; animation: hataEqMarquee linear infinite; will-change: transform; }
/* 旗鯖fork: 内容が枠に収まる場合はスクロールせず固定表示 */
.tickerFixed { animation: none !important; padding-left: 16px; will-change: auto; }
.tItem { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: .95em; }
.tItemScale { min-width: 22px; height: 22px; padding: 0 5px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: .82em; font-weight: 900; color: #fff; }
.tHeader { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-size: .92em; color: var(--MI_THEME-accent); margin-right: 8px; padding-left: 12px; border-left: 2px solid var(--MI_THEME-accent); }
.tickerNone { padding-left: 16px; opacity: .5; font-size: .9em; }
@keyframes hataEqMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .tickerTrack { animation: none; padding-left: 16px; } }

@container (max-width: 850px) {
	.full { height: 56px; }
	.full .tickerBadge, .compact .tickerBadge { width: 66px; }
	.tBadgeNum { font-size: 1.4em; }
}
.accessible {
	background: #fff; color: #111; border: 2px solid #111; height: auto; min-height: 90px;
	font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
	.tBadgeLabel, .tHypoTime, .tItem, .tItemScale, .tHeader, .tickerNone { font-size: 15px; opacity: 1; }
	.tBadgeNum { font-size: 30px; }
	.tHypoName { font-size: 18px; white-space: normal; }
	.tickerBadge { min-width: 80px; color: #fff; }
	.tickerHypo { max-width: none; padding: 8px 12px; border: 0; }
	.tickerRight { flex-direction: column; }
	.tickerScroll { min-height: 34px; }
	.tItemScale { min-width: 32px; height: 32px; font-size: 30px; }
	.tHeader { color: #111; border-color: #111; }
}

</style>

<style lang="scss">
.hfEqFade-enter-active, .hfEqFade-leave-active { transition: opacity .35s ease; }
.hfEqFade-enter-from, .hfEqFade-leave-to { opacity: 0; }
</style>
