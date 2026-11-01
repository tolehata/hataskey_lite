<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<label
	v-adaptive-border
	:class="[$style.root, { [$style.disabled]: disabled, [$style.checked]: checked, [$style.redesigned]: isSettingsRedesign }]"
>
	<input
		ref="inputEl"
		type="radio"
		:name="resolvedName"
		:checked="checked"
		:disabled="disabled"
		:tabindex="disabled ? -1 : tabindex"
		:class="$style.input"
		@change="onChange"
	>
	<span :class="$style.button">
		<span></span>
	</span>
	<span :class="$style.label"><slot></slot></span>
</label>
</template>

<script lang="ts">
const standaloneGroupNames = new WeakMap<HTMLElement, string>();
</script>

<script lang="ts" setup generic="T extends unknown">
import { computed, inject, onMounted, ref, useTemplateRef, watch } from 'vue';
import { haptic } from '@/utility/haptic.js';
import { genId } from '@/utility/id.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

const props = defineProps<{
	modelValue: T;
	value: T;
	disabled?: boolean;
	tabindex?: number;
	name?: string;
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', value: T): void;
}>();

const checked = computed(() => props.modelValue === props.value);
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
const inputEl = useTemplateRef<HTMLInputElement>('inputEl');
const resolvedName = ref(props.name);

onMounted(() => {
	if (props.name != null) return;

	const groupHost = inputEl.value?.parentElement?.parentElement;
	if (groupHost == null) return;

	// Direct MkRadio siblings (MkPreviewなど) still need native radio grouping.
	// Only infer a name for a real sibling set so isolated radios keep their
	// existing standalone behavior.
	const siblingRadios = groupHost.querySelectorAll(':scope > label > input[type="radio"]');
	if (siblingRadios.length < 2) return;

	let groupName = standaloneGroupNames.get(groupHost);
	if (groupName == null) {
		groupName = `mk-radio-standalone-${genId()}`;
		standaloneGroupNames.set(groupHost, groupName);
	}
	resolvedName.value = groupName;
});

watch(() => props.name, name => {
	resolvedName.value = name;
});

function onChange(event: Event): void {
	if (props.disabled || !(event.currentTarget instanceof HTMLInputElement) || !event.currentTarget.checked) return;
	haptic();
	emit('update:modelValue', props.value);
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: inline-flex;
	align-items: center;
	text-align: left;
	cursor: pointer;
	padding: 7px 10px;
	min-width: 60px;
	background-color: var(--MI_THEME-panel);
	background-clip: padding-box !important;
	border: solid 1px var(--MI_THEME-panel);
	border-radius: 6px;
	font-size: 90%;
	transition: all 0.2s;
	user-select: none;

	&.disabled {
		opacity: 0.6;
		cursor: not-allowed !important;
	}

	&:hover {
		border-color: var(--MI_THEME-inputBorderHover) !important;
	}

	&:focus-within {
		outline: none;
		box-shadow: 0 0 0 2px var(--MI_THEME-focus);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}

	&.checked {
		background-color: var(--MI_THEME-accentedBg) !important;
		border-color: var(--MI_THEME-accentedBg) !important;
		color: var(--MI_THEME-accent);
		cursor: default !important;

		> .button {
			border-color: var(--MI_THEME-accent);

			&::after {
				background-color: var(--MI_THEME-accent);
				transform: scale(1);
				opacity: 1;
			}
		}
	}
}

.input {
	position: absolute;
	inline-size: 1px;
	block-size: 1px;
	margin: 0;
	opacity: 0;
	pointer-events: none;

	&:focus-visible + .button {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 3px;
	}
}

.button {
	position: relative;
	display: inline-block;
	width: 14px;
	height: 14px;
	background: none;
	border: solid 2px var(--MI_THEME-inputBorder);
	border-radius: 100%;
	transition: inherit;

	&::after {
		content: '';
		display: block;
		position: absolute;
		top: 3px;
		right: 3px;
		bottom: 3px;
		left: 3px;
		border-radius: 100%;
		opacity: 0;
		transform: scale(0);
		transition: 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
	}
}

.label {
	margin-left: 8px;
	display: block;
	line-height: 20px;
	cursor: pointer;
}

.redesigned {
	min-height: 44px;
	box-sizing: border-box;
	padding: 10px 14px;
	border-color: transparent;
	border-radius: 999px;
	background: color-mix(in srgb, var(--MI_THEME-panel) 94%, var(--MI_THEME-bg));

	&:hover {
		border-color: transparent !important;
	}
}
</style>
