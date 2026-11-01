<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!--
旗鯖fork: メンテナンスお知らせの進捗バー(4段階)。
icon === 'maintenance' のお知らせで progressSteps が設定されているときに表示する。
●━●━○━○ のステップインジケーター型: 完了済みは塗りつぶし円、未完了は枠線のみ、
現在進行中(最後の完了済みの次)は強調表示する。
-->
<div :class="$style.root">
	<div :class="$style.stepsRow">
		<template v-for="(label, idx) in steps" :key="idx">
			<div :class="[$style.step, isCompleted(idx) && $style.stepCompleted, isCurrent(idx) && $style.stepCurrent]">
				<div :class="$style.stepCircle">
					<i v-if="isCompleted(idx)" class="ti ti-check"></i>
					<span v-else>{{ idx + 1 }}</span>
				</div>
				<div :class="$style.stepLabel">{{ label }}</div>
			</div>
			<div v-if="idx < steps.length - 1" :class="[$style.connector, isCompleted(idx) && $style.connectorCompleted]"></div>
		</template>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
	steps: string[];
	completed: boolean[] | null;
}>();

const completedSafe = computed<boolean[]>(() => {
	if (Array.isArray(props.completed) && props.completed.length === props.steps.length) return props.completed;
	return props.steps.map(() => false);
});

function isCompleted(idx: number): boolean {
	return completedSafe.value[idx] === true;
}

// 「現在地点」= 最後の完了済みステップの次のステップ。全完了済みなら最後のステップ。
const currentIdx = computed<number>(() => {
	const lastCompleted = completedSafe.value.lastIndexOf(true);
	if (lastCompleted === -1) return 0; // 何も完了してないなら最初
	if (lastCompleted === props.steps.length - 1) return lastCompleted; // 全完了なら最後を強調
	return lastCompleted + 1;
});
function isCurrent(idx: number): boolean {
	return idx === currentIdx.value && !isCompleted(idx);
}
</script>

<style lang="scss" module>
.root {
	margin: 12px 0;
	padding: 14px 12px;
	border-radius: 10px;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
}
.stepsRow {
	display: flex;
	align-items: flex-start;
	gap: 4px;
}
.step {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	min-width: 0;
}
.stepCircle {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--MI_THEME-panel);
	border: 2px solid var(--MI_THEME-divider);
	color: var(--MI_THEME-fg);
	font-weight: 700;
	font-size: 0.85em;
	transition: background 0.2s, border-color 0.2s, color 0.2s;
	flex-shrink: 0;

	i {
		font-size: 0.9em;
	}
}
.stepLabel {
	font-size: 0.78em;
	text-align: center;
	color: var(--MI_THEME-fg);
	opacity: 0.75;
	overflow-wrap: anywhere;
	line-height: 1.3;
}
.stepCompleted {
	.stepCircle {
		background: var(--MI_THEME-accent);
		border-color: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}
	.stepLabel {
		opacity: 1;
	}
}
.stepCurrent {
	.stepCircle {
		border-color: var(--MI_THEME-accent);
		color: var(--MI_THEME-accent);
		animation: pulse 1.8s ease-in-out infinite;
	}
	.stepLabel {
		opacity: 1;
		color: var(--MI_THEME-accent);
		font-weight: 600;
	}
}
.connector {
	flex: 1;
	height: 3px;
	background: var(--MI_THEME-divider);
	margin-top: 14px; /* 円の中心に合わせる */
	border-radius: 2px;
	min-width: 8px;
	transition: background 0.2s;
}
.connectorCompleted {
	background: var(--MI_THEME-accent);
}

@keyframes pulse {
	0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--MI_THEME-accent) 40%, transparent); }
	50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--MI_THEME-accent) 0%, transparent); }
}
</style>
