<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- 旗鯖fork: pill=true の時だけ Hataskey UI ピルケースデザイン(channels.vue の htkPillTabs 相当)を
     適用する。デフォルト(false)は本家のタブデザインのままなので、他の使用箇所には影響しない。 -->
<div :class="[$style.tabsRoot, { [$style.pill]: pill }]">
	<button
		v-for="option in tabs"
		:key="option.key"
		:class="['_button', $style.tabButton, { [$style.active]: modelValue === option.key }]"
		:disabled="modelValue === option.key"
		@click="update(option.key)"
	>
		<i v-if="option.icon" :class="[option.icon, $style.icon]"></i>
		{{ option.label }}
	</button>
</div>
</template>

<script lang="ts">
export type Tab<T = string> = {
	key: T;
	icon?: string;
	label?: string;
};
</script>

<script setup lang="ts" generic="const T extends Tab">
import { defineProps, defineEmits } from 'vue';

defineProps<{
	tabs: T[];
	// 旗鯖fork: Hataskey UI ピルケースデザインを適用するか(デフォルト false)。
	pill?: boolean;
}>();

const model = defineModel<T['key']>();

function update(key: T['key']) {
	model.value = key;
}
</script>

<style module lang="scss">
.tabsRoot {
	display: flex;
	font-size: 90%;
}

.tabButton {
	flex: 1;
	padding: 10px 8px;
	border-radius: 999px;

	&:disabled {
		opacity: 1 !important;
		cursor: default;
	}

	&.active {
		color: var(--MI_THEME-accent);
		background: var(--MI_THEME-accentedBg);
	}

	&:not(.active):hover {
		color: var(--MI_THEME-fgHighlighted);
		background: var(--MI_THEME-panelHighlight);
	}

	&:not(:first-child) {
		margin-left: 8px;
	}

	> .icon {
		margin-right: 6px;
	}
}

@container (max-width: 500px) {
	.tabsRoot {
		font-size: 80%;
	}

	.tabButton {
		padding: 11px 8px;
	}
}

/* =======================================================================
   旗鯖fork: pill=true 時の Hataskey UI ピルケースデザイン。
   channels.vue の htkPillTabs と同じミニマルな見た目に揃える:
   - トラックは panel + divider 枠線、丸トラック(999px)、中央寄せ
   - 選択タブは accent 塗りピル + #fff 文字(テーマ次第の潰れ回避)
   - はみ出し時は横スクロール
   pill が付かない限りこのブロックは効かないので、他の MkTab 使用箇所には影響しない。
   ======================================================================= */
.tabsRoot.pill {
	display: flex;
	align-items: center;
	gap: 4px;
	width: fit-content;
	max-width: 100%;
	margin: 4px auto;
	padding: 4px;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar { display: none; }

	.tabButton {
		flex: 0 0 auto;
		padding: 6px 14px;
		border-radius: 999px;
		white-space: nowrap;
		color: color-mix(in srgb, var(--MI_THEME-panel), var(--MI_THEME-fg) 55%);

		&:not(:first-child) { margin-left: 0; }

		&:not(.active):hover {
			color: var(--MI_THEME-accent);
			background: transparent;
		}

		&.active {
			/* #fff ハードコード: テーマで fgOnAccent が未定義/アクセント色に近く潰れるのを回避 */
			color: #fff;
			background: var(--MI_THEME-accent);
			font-weight: 700;
		}
	}
}
</style>
