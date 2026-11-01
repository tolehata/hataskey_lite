<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: Hataskey UI デッキの初回チュートリアル(3ステップ ウィザード)。
  1) ナビバーの位置(左サイドバー / 上部)
  2) ツールバーの位置(上 / 右 / 下)
  3) レイアウト(横並び / 田の字 / 3列 / 縦一列)
選択結果は各 pref に反映し、完了で simpleUi.deckTutorialDone を true にする。
-->
<template>
<MkModalWindow
	ref="dialog"
	:width="540"
	:height="600"
	:withOkButton="false"
	@close="skip"
	@closed="emit('closed')"
>
	<template #header>{{ copy.header }}</template>

	<div :class="$style.root">
		<!-- 進捗インジケータ -->
		<div :class="$style.steps">
			<div v-for="n in 3" :key="n" :class="[$style.stepDot, { [$style.stepDotOn]: step >= n }]"></div>
		</div>

		<!-- ステップ1: ナビバーの位置 -->
		<div v-if="step === 1" :class="$style.page">
			<div :class="$style.title">{{ copy.chooseMenuPosition }}</div>
			<div :class="$style.desc">{{ copy.menuPositionDescription }}</div>
			<div :class="$style.choices">
				<button :class="[$style.choice, { [$style.choiceOn]: navTop === false }]" @click="navTop = false">
					<div :class="$style.previewLeft"><span :class="$style.pvSidebar"></span><span :class="$style.pvBody"></span></div>
					<div :class="$style.choiceLabel">{{ copy.leftSidebar }}</div>
					<div :class="$style.choiceSub">{{ copy.leftSidebarDescription }}</div>
				</button>
				<button :class="[$style.choice, { [$style.choiceOn]: navTop === true }]" @click="navTop = true">
					<div :class="$style.previewTop"><span :class="$style.pvNav"></span><span :class="$style.pvBody"></span></div>
					<div :class="$style.choiceLabel">{{ copy.topNavigation }}</div>
					<div :class="$style.choiceSub">{{ copy.topNavigationDescription }}</div>
				</button>
			</div>
		</div>

		<!-- ステップ2: ツールバーの位置 -->
		<div v-else-if="step === 2" :class="$style.page">
			<div :class="$style.title">{{ copy.chooseToolbarPosition }}</div>
			<div :class="$style.desc">{{ copy.toolbarPositionDescription }}</div>
			<div :class="$style.choices">
				<button v-for="opt in toolbarOptions" :key="opt.value" :class="[$style.choice, { [$style.choiceOn]: toolbarPos === opt.value }]" @click="toolbarPos = opt.value">
					<i :class="[opt.icon, $style.choiceIcon]"></i>
					<div :class="$style.choiceLabel">{{ opt.label }}</div>
					<div :class="$style.choiceSub">{{ opt.sub }}</div>
				</button>
			</div>
		</div>

		<!-- ステップ3: レイアウト -->
		<div v-else-if="step === 3" :class="$style.page">
			<div :class="$style.title">{{ copy.chooseLayout }}</div>
			<div :class="$style.desc">{{ copy.layoutDescription }}</div>
			<div :class="$style.choices">
				<button v-for="opt in layoutOptions" :key="opt.value" :class="[$style.choice, { [$style.choiceOn]: layout === opt.value }]" @click="layout = opt.value">
					<i :class="[opt.icon, $style.choiceIcon]"></i>
					<div :class="$style.choiceLabel">{{ opt.label }}</div>
					<div :class="$style.choiceSub">{{ opt.sub }}</div>
				</button>
			</div>
		</div>

		<!-- フッター -->
		<div :class="$style.footer">
			<MkButton v-if="step > 1" rounded @click="step--"><i class="ti ti-arrow-left"></i> {{ copy.back }}</MkButton>
			<MkButton transparent @click="skip">{{ copy.skip }}</MkButton>
			<MkButton v-if="step < 3" primary rounded @click="step++">{{ copy.next }} <i class="ti ti-arrow-right"></i></MkButton>
			<MkButton v-else primary gradate rounded @click="finish"><i class="ti ti-check"></i> {{ copy.finish }}</MkButton>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, shallowRef } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { claimAchievement } from '@/utility/achievements.js';

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const dialog = shallowRef<InstanceType<typeof MkModalWindow>>();
const copy = i18n.ts._hata._hatasabaDeckTutorial;

const step = ref(1);

// 現在の設定を初期値に
const navTop = ref<boolean>((prefer.r['simpleUi.topNavMode']?.value as boolean) ?? false);
const toolbarPos = ref<'top' | 'right' | 'bottom'>((prefer.r['simpleUi.deckToolbarPos']?.value as 'top' | 'right' | 'bottom') ?? 'top');
const layout = ref<'row' | 'grid2' | 'grid3' | 'stack'>((prefer.r['simpleUi.deckLayout']?.value as 'row' | 'grid2' | 'grid3' | 'stack') ?? 'row');

const toolbarOptions: { value: 'top' | 'right' | 'bottom'; icon: string; label: string; sub: string }[] = [
	{ value: 'top', icon: 'ti ti-layout-navbar', label: copy.top, sub: copy.toolbarTopDescription },
	{ value: 'right', icon: 'ti ti-layout-sidebar-right', label: copy.right, sub: copy.toolbarRightDescription },
	{ value: 'bottom', icon: 'ti ti-layout-bottombar', label: copy.bottom, sub: copy.toolbarBottomDescription },
];
const layoutOptions: { value: 'row' | 'grid2' | 'grid3' | 'stack'; icon: string; label: string; sub: string }[] = [
	{ value: 'row', icon: 'ti ti-layout-columns', label: copy.row, sub: copy.rowDescription },
	{ value: 'grid2', icon: 'ti ti-layout-grid', label: copy.grid2, sub: copy.grid2Description },
	{ value: 'grid3', icon: 'ti ti-layout-board-split', label: copy.grid3, sub: copy.grid3Description },
	{ value: 'stack', icon: 'ti ti-layout-list', label: copy.stack, sub: copy.stackDescription },
];

function applyAll() {
	prefer.commit('simpleUi.topNavMode', navTop.value);
	prefer.commit('simpleUi.deckToolbarPos', toolbarPos.value);
	prefer.commit('simpleUi.deckLayout', layout.value);
}

function finish() {
	applyAll();
	prefer.commit('simpleUi.deckTutorialDone', true);
	// 旗鯖fork: チュートリアル完了で実績解除(冪等)
	claimAchievement('hatasabaDeckTutorial');
	dialog.value?.close();
}

function skip() {
	// スキップでも完了フラグは立てる(毎回出ないように)。設定は変更しない。
	prefer.commit('simpleUi.deckTutorialDone', true);
	// 旗鯖fork: スキップも「完了」とみなして実績解除(完了フラグと挙動を揃える)
	claimAchievement('hatasabaDeckTutorial');
	dialog.value?.close();
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px 22px 18px;
	min-height: 100%;
	box-sizing: border-box;
}
.steps {
	display: flex;
	justify-content: center;
	gap: 8px;
}
.stepDot {
	width: 28px;
	height: 5px;
	border-radius: 999px;
	background: var(--MI_THEME-divider);
	transition: background .2s;
}
.stepDotOn { background: var(--MI_THEME-accent); }
.page {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.title {
	font-size: 1.2em;
	font-weight: 700;
}
.desc {
	font-size: .85em;
	opacity: .7;
	line-height: 1.6;
	margin-bottom: 4px;
}
.choices {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.choice {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	padding: 14px 16px;
	border-radius: 14px;
	border: 2px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-panel);
	cursor: pointer;
	text-align: left;
	transition: border-color .15s, background .15s;
	&:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 50%, var(--MI_THEME-divider)); }
}
.choiceOn {
	border-color: var(--MI_THEME-accent);
	background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel));
}
.choiceIcon {
	font-size: 1.6em;
	color: var(--MI_THEME-accent);
}
.choiceLabel {
	font-weight: 700;
	font-size: 1.02em;
}
.choiceSub {
	font-size: .8em;
	opacity: .65;
	line-height: 1.5;
}
.footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	padding-top: 6px;
}
/* ナビ位置のミニプレビュー */
.previewLeft, .previewTop {
	width: 100%;
	height: 56px;
	border-radius: 8px;
	overflow: hidden;
	display: flex;
	background: var(--MI_THEME-bg);
	margin-bottom: 6px;
}
.previewTop { flex-direction: column; }
.pvSidebar { width: 26%; background: var(--MI_THEME-accent); opacity: .55; }
.pvNav { height: 26%; background: var(--MI_THEME-accent); opacity: .55; }
.pvBody { flex: 1; background: color-mix(in srgb, var(--MI_THEME-fg) 8%, transparent); }
</style>
