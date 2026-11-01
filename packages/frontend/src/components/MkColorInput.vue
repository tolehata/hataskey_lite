<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.redesigned]: isSettingsRedesign }]">
	<label :id="labelId" :for="inputId" :class="$style.label"><slot name="label"></slot></label>
	<div :class="[$style.input, { disabled }]">
		<input
			:id="inputId"
			ref="inputEl"
			v-model="v"
			v-adaptive-border
			:class="$style.inputCore"
			type="color"
			:disabled="disabled"
			:required="required"
			:readonly="readonly"
			:aria-labelledby="labelId"
			:aria-describedby="captionId"
			@input="onInput"
		>
	</div>
	<div :id="captionId" :class="$style.caption"><slot name="caption"></slot></div>
	<SettingsControlRelated v-if="isSettingsRedesign" :data-settings-search-id="$attrs['data-settings-search-id']"/>
</div>
</template>

<script lang="ts" setup>
import { inject, ref, useTemplateRef, toRefs } from 'vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';
import { genId } from '@/utility/id.js';

const props = defineProps<{
	modelValue: string | null;
	required?: boolean;
	readonly?: boolean;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', value: string): void;
}>();

const { modelValue } = toRefs(props);
const v = ref(modelValue.value);
const inputEl = useTemplateRef('inputEl');
const inputId = `mk-color-input-${genId()}`;
const labelId = `${inputId}-label`;
const captionId = `${inputId}-caption`;
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;

const onInput = () => {
	emit('update:modelValue', v.value ?? '');
};
</script>

<style lang="scss" module>
.root.redesigned {
	> .label {
		padding-bottom: 7px;
	}

	> .input > .inputCore {
		height: 44px;
		border-color: var(--settings-input-border, color-mix(in srgb, var(--MI_THEME-fg) 30%, var(--MI_THEME-divider))) !important;
		border-radius: 999px;
		background: color-mix(in srgb, var(--MI_THEME-panel) 94%, var(--MI_THEME-bg));
	}

	> .input > .inputCore:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}

	> .caption {
		padding-top: 7px;
		line-height: 1.55;
	}
}

.label {
	display: block;
	font-size: 0.85em;
	padding: 0 0 8px 0;
	user-select: none;

	&:empty {
		display: none;
	}
}

.caption {
	font-size: 0.85em;
	padding: 8px 0 0 0;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);

	&:empty {
		display: none;
	}
}

.input {
	position: relative;

	&.focused {
		> .inputCore {
			border-color: var(--MI_THEME-accent) !important;
			//box-shadow: 0 0 0 4px var(--MI_THEME-focus);
		}
	}

	&.disabled {
		opacity: 0.7;

		&,
		> .inputCore {
			cursor: not-allowed !important;
		}
	}
}

.inputCore {
	appearance: none;
	-webkit-appearance: none;
	display: block;
	height: 42px;
	width: 100%;
	margin: 0;
	padding: 0;
	font: inherit;
	font-weight: normal;
	font-size: 1em;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-panel);
	border: solid 1px var(--MI_THEME-panel);
	border-radius: 6px;
	overflow: hidden;
	outline: none;
	box-shadow: none;
	box-sizing: border-box;
	transition: border-color 0.1s ease-out;

	&::-webkit-color-swatch-wrapper {
		padding: 0;
		border-radius: inherit;
	}

	&::-webkit-color-swatch {
		border: 0;
		border-radius: inherit;
	}

	&::-moz-color-swatch {
		border: 0;
		border-radius: inherit;
	}

	&:hover {
		border-color: var(--MI_THEME-inputBorderHover) !important;
	}
}
</style>
