<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<section v-if="isLegacyMode" ref="legacyRegion" :class="$style.settingsRegion" role="region" :aria-label="copy.gateway.legacyRegion" tabindex="-1">
	<!-- 旗鯖fork: 旧設定にいる間の帯。
	     ⚠️body へ逃がした position: fixed の全幅帯にしないこと。
	     デッキUIでは設定が列や窓の中に入るため、画面いっぱいの帯は器の外へ
	     はみ出し、⚠️上部のウィンドウに負けて埋もれるうえ、場所も合わない。
	     ⚠️器の中に置いて上端へ貼り付ける。これならどの表示でも収まる。 -->
	<div :class="$style.legacyReturn" data-settings-legacy-banner>
		<p :class="$style.legacyNotice"><i class="ti ti-alert-triangle" aria-hidden="true"></i>{{ copy.gateway.legacyNotice }}</p>
		<!-- 旗鯖fork: ⚠️狭い器（デッキの窓など）では、旧設定は子ページだけを出し、
		     ⚠️一覧へ戻る導線を**1つも持たない**（実測: ヘッダーも戻るボタンも無い）。
		     ⚠️帯から戻れるようにしておくこと。ここが唯一の出口になる。
		     ⚠️forcePage を付けること。付けないとデッキでは新しい窓が開いてしまう。 -->
		<button type="button" :class="$style.legacyReturnButton" :aria-label="copy.gateway.legacyBackToList" @click="openLegacyList">
			<i class="ti ti-chevron-left" aria-hidden="true"></i>{{ copy.gateway.legacyBackToList }}
		</button>
		<button type="button" :class="$style.legacyReturnButton" :aria-label="copy.gateway.returnToRedesigned" @click="openRedesignedSettings">
			{{ copy.gateway.returnToRedesignedButton }}
		</button>
	</div>
	<LegacySettings/>
</section>
<section v-else ref="redesignedRegion" :class="$style.settingsRegion" role="region" :aria-label="copy.gateway.redesignedRegion" tabindex="-1">
	<SettingsRedesign @openLegacy="openLegacy"/>
</section>

</template>

<script lang="ts" setup>
import { defineAsyncComponent, nextTick, onDeactivated, ref, useTemplateRef } from 'vue';
import { i18n } from '@/i18n.js';

const LegacySettings = defineAsyncComponent(() => import('@/pages/settings/index.vue'));
const SettingsRedesign = defineAsyncComponent(() => import('./index.vue'));

// この状態は設定の親ルートが有効な間だけ保持する。設定内の子ルート遷移では維持し、
// KeepAlive により親がキャッシュされる場合も、設定から離れた時点で保存せず初期化する。
const isLegacyMode = ref(false);
const copy = i18n.ts._hata._settingsRedesign;
const legacyRegion = useTemplateRef<HTMLElement>('legacyRegion');
const redesignedRegion = useTemplateRef<HTMLElement>('redesignedRegion');

function focusSettingsContext(mode: 'legacy' | 'redesigned') {
	void nextTick(() => window.requestAnimationFrame(() => {
		const region = mode === 'legacy' ? legacyRegion.value : redesignedRegion.value;
		region?.focus({ preventScroll: true });
	}));
}

/**
 * 旗鯖fork: 旧設定の一覧へ戻す。
 *
 * ⚠️`@/router.js` をこのファイルの先頭で取り込まないこと。
 *   ルータ定義が画面と部品を芋づるで引き込み、その中に読み込み時点で
 *   端末設定を読む処理があるため、⚠️この画面の単体検査が丸ごと起動しなくなる
 *   （実測: use-note-capture.ts で Cannot read properties of undefined）。
 *   ⚠️押された瞬間にだけ読み込む。
 * ⚠️`forcePage` を付けること。デッキUIでは navHook が働き、付けないと
 *   同じ画面で戻る代わりに**新しい窓が開く**。
 */
async function openLegacyList() {
	const { mainRouter } = await import('@/router.js');
	mainRouter.pushByPath('/settings', 'forcePage');
	focusSettingsContext('legacy');
}

function openLegacy() {
	isLegacyMode.value = true;
	focusSettingsContext('legacy');
}

function openRedesignedSettings() {
	isLegacyMode.value = false;
	focusSettingsContext('redesigned');
}

onDeactivated(() => {
	isLegacyMode.value = false;
});
</script>

<style lang="scss" module>
.legacyReturn {
	/* ⚠️fixed にしないこと。器(列・窓・ページ)の外へ出て場所が合わなくなる。
	   ⚠️sticky なら、旧設定がどこに入っていてもその上端へ貼り付く。 */
	position: sticky;
	inset-block-start: 0;
	z-index: 2;
	display: flex;
	box-sizing: border-box;
	align-items: center;
	justify-content: center;
	gap: 12px;
	flex-wrap: wrap;
	padding: 10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
	border-block-end: 1px solid color-mix(in srgb, var(--MI_THEME-warn) 40%, var(--MI_THEME-divider));
	background: color-mix(in srgb, var(--MI_THEME-warn) 12%, var(--MI_THEME-panel));
	backdrop-filter: blur(12px);
}

.legacyNotice {
	display: flex;
	align-items: center;
	gap: 7px;
	margin: 0;
	color: var(--MI_THEME-fg);
	font-size: .82rem;
	font-weight: 600;
	line-height: 1.5;
	text-wrap: pretty;
}

.legacyNotice > i { flex: none; color: var(--MI_THEME-warn); }

.settingsRegion {
	outline: 0;
}

/* 旗鯖fork: ⚠️旧設定の中でホイールを堰き止めないこと。
   ⚠️狭い器（デッキの窓など）では `._pageScrollable` の高さが器を超え、
   **自分では1pxも動けないスクロール器**になる。そこに
   `overscroll-behavior: contain` が付いているため、ホイールが外側へ渡らず
   **画面のほぼ全域で無反応**になる（実測: 490x1309 / 中身は溢れていない）。
   ⚠️スクロールバーの近くだけ効いていたのは、そこがこの要素の外だったから。
   ⚠️外へ渡せるようにするだけ。自分が動けるときの挙動は変えない。 */
.settingsRegion :global(._pageScrollable) {
	overscroll-behavior-y: auto;
}

.legacyReturnButton {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-block-size: 44px;
	padding: 8px 14px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 42%, var(--MI_THEME-divider));
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 4px 14px color-mix(in srgb, var(--MI_THEME-shadow) 16%, transparent);
	color: var(--MI_THEME-accent);
	font: inherit;
	font-size: 0.9rem;
	font-weight: 700;
	line-break: strict;
	text-wrap: pretty;
	word-break: normal;
	cursor: pointer;
}

.legacyReturnButton:hover {
	background: color-mix(in srgb, var(--MI_THEME-accent) 10%, var(--MI_THEME-panel));
}

.legacyReturnButton:focus-visible {
	outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 58%, transparent);
	outline-offset: 3px;
}

.legacyReturnButton:active {
	transform: translateY(1px);
}

@media (prefers-reduced-motion: reduce) {
	.legacyReturnButton:active {
		transform: none;
	}
}
</style>
