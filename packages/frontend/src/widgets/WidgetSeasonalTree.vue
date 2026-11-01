<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<MkContainer :naked="widgetProps.transparent === true" :showHeader="widgetProps.showHeader !== false">
	<template #icon><i class="ti ti-tree" aria-hidden="true"></i></template>
	<template #header>{{ copy.title }}</template>
	<div :class="$style.scene" :style="{ height: `${sceneHeight}px` }">
		<MkSeasonalTree
			:season="season"
			:timeOfDay="timeOfDay"
			:animated="widgetProps.animated === true"
			:windStrength="windStrength"
			fit="cover"
			:showCaption="false"
		/>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import type { SeasonalTreeSeason, SeasonalTreeTimeOfDay } from '@/utility/seasonal-tree.js';
import MkContainer from '@/components/MkContainer.vue';
import MkSeasonalTree from '@/components/MkSeasonalTree.vue';
import { i18n } from '@/i18n.js';

const name = 'seasonalTree';
const copy = i18n.ts._hata._seasonalTree;
const widgetPropsDef = {
	transparent: { type: 'boolean', default: false },
	showHeader: { type: 'boolean', default: true },
	season: {
		type: 'radio',
		label: copy.season,
		default: 'auto',
		options: [
			{ value: 'auto' as const, label: copy.automatic },
			{ value: 'spring' as const, label: copy._seasons.spring },
			{ value: 'summer' as const, label: copy._seasons.summer },
			{ value: 'autumn' as const, label: copy._seasons.autumn },
			{ value: 'winter' as const, label: copy._seasons.winter },
		],
	},
	timeOfDay: {
		type: 'radio',
		label: copy.timeOfDay,
		default: 'auto',
		options: [
			{ value: 'auto' as const, label: copy.automatic },
			{ value: 'dawn' as const, label: copy._times.dawn },
			{ value: 'day' as const, label: copy._times.day },
			{ value: 'dusk' as const, label: copy._times.dusk },
			{ value: 'night' as const, label: copy._times.night },
		],
	},
	animated: { type: 'boolean', label: copy.animation, default: true },
	windStrength: { type: 'range', label: copy.windStrength, default: 60, min: 0, max: 100, step: 1 },
	height: {
		type: 'radio',
		label: i18n.ts.height,
		default: 240,
		options: [
			{ value: 180 as const, label: i18n.ts.small },
			{ value: 240 as const, label: i18n.ts.medium },
			{ value: 320 as const, label: i18n.ts.large },
		],
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;
const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const { widgetProps, configure } = useWidgetPropsManager(name, widgetPropsDef, props, emit);

const season = computed<SeasonalTreeSeason | 'auto'>(() => {
	switch (widgetProps.season) {
		case 'spring': case 'summer': case 'autumn': case 'winter': return widgetProps.season;
		default: return 'auto';
	}
});
const timeOfDay = computed<SeasonalTreeTimeOfDay | 'auto'>(() => {
	switch (widgetProps.timeOfDay) {
		case 'dawn': case 'day': case 'dusk': case 'night': return widgetProps.timeOfDay;
		default: return 'auto';
	}
});
const sceneHeight = computed(() => [180, 240, 320].includes(widgetProps.height) ? widgetProps.height : 240);
const windStrength = computed(() => typeof widgetProps.windStrength === 'number' && Number.isFinite(widgetProps.windStrength)
	? Math.max(0, Math.min(100, widgetProps.windStrength)) : 60);

defineExpose<WidgetComponentExpose>({ name, configure, get id() { return props.widget?.id ?? null; } });
</script>

<style lang="scss" module>
.scene {
	display: grid;
	place-items: center;
	box-sizing: border-box;
	min-width: 0;
	min-height: 0;
}
.scene > * { width: 100%; height: 100%; min-height: 0; }
</style>
