<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader backPath="/">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div class="_gaps">
			<div class="_panel" :class="$style.link">
				<MkA to="/hataigo" :class="$style.hataigo">
					<HataigoLogo :size="64"/><HataAppWordmark app="hataigo"/>
				</MkA>
			</div>
			<div v-if="!inHataGoes" class="_panel" :class="$style.link">
				<MkA to="/bubble-game">
					<img src="/client-assets/drop-and-fusion/logo.png" style="display: block; max-width: 100%; max-height: 200px; margin: auto;"/>
				</MkA>
			</div>
			<div v-if="!inHataGoes" class="_panel" :class="$style.link">
				<MkA to="/reversi">
					<img src="/client-assets/reversi/logo.png" style="display: block; max-width: 100%; max-height: 200px; margin: auto;"/>
				</MkA>
			</div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
import HataigoLogo from '@/components/hataigo/HataigoLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const copy = i18n.ts._hata._games;
const inHataGoes = inject(HATA_GOES_HOST, null) != null;

definePage(() => ({
	title: copy._index.pageTitle,
	icon: 'ti ti-device-gamepad',
}));
</script>

<style module>
.hataigo { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 32px; font-size: 34px; }
/* ロゴは Righteous（HataAppWordmark）。前半はテーマの文字色に合わせ、ダークでも読めるようにする */
.hataigo [data-app='hataigo'] { color: var(--MI_THEME-fg); }
.link:focus-within {
	outline: 2px solid var(--MI_THEME-focus);
	outline-offset: -2px;
}
</style>
