<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.redesigned]: isSettingsRedesign }]">
	<label :id="labelId" :for="inputId" :class="$style.label"><slot name="label"></slot></label>
	<button
		:id="inputId"
		ref="container"
		type="button"
		tabindex="0"
		aria-haspopup="menu"
		:aria-expanded="opening"
		:aria-disabled="disabled || readonly || undefined"
		:aria-readonly="readonly || undefined"
		:aria-required="required || undefined"
		:aria-labelledby="labelId"
		:aria-describedby="captionId"
		:disabled="disabled"
		:class="[$style.input, { [$style.inline]: inline, [$style.disabled]: disabled, [$style.focused]: focused || opening }]"
		@focus="focused = true"
		@blur="focused = false"
		@click="show"
		@keydown="onKeydown"
	>
		<span ref="prefixEl" :class="$style.prefix"><slot name="prefix"></slot></span>
		<span
			ref="inputEl"
			v-adaptive-border
			:class="$style.inputCore"
		>
			{{ currentValueText ?? placeholder ?? '' }}
		</span>
		<span ref="suffixEl" :class="$style.suffix"><i class="ti ti-chevron-down" :class="[$style.chevron, { [$style.chevronOpening]: opening }]"></i></span>
	</button>
	<div style="display: none;"><slot></slot></div>
	<div :id="captionId" :class="$style.caption"><slot name="caption"></slot></div>
	<SettingsControlRelated v-if="isSettingsRedesign" :data-settings-search-id="$attrs['data-settings-search-id']"/>
</div>
</template>

<script lang="ts">
export type OptionValue = string | number | null;

export type ItemOption<T extends OptionValue = OptionValue> = {
	type?: 'option';
	value: T;
	label: string;
};

export type ItemGroup<T extends OptionValue = OptionValue> = {
	type: 'group';
	label?: string;
	items: ItemOption<T>[];
};

export type MkSelectItem<T extends OptionValue = OptionValue> = ItemOption<T> | ItemGroup<T>;

export type GetMkSelectValueType<T extends MkSelectItem> = T extends ItemGroup
	? T['items'][number]['value']
	: T extends ItemOption
		? T['value']
		: never;

export type GetMkSelectValueTypesFromDef<T extends MkSelectItem[]> = T[number] extends MkSelectItem
	? GetMkSelectValueType<T[number]>
	: never;
</script>

<script lang="ts" setup generic="const ITEMS extends MkSelectItem[], MODELT extends OptionValue">
import { inject, onMounted, onUnmounted, nextTick, ref, watch, computed, toRefs, useTemplateRef } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { genId } from '@/utility/id.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';

const props = defineProps<{
	items: ITEMS;
	required?: boolean;
	readonly?: boolean;
	disabled?: boolean;
	placeholder?: string;
	autofocus?: boolean;
	inline?: boolean;
	small?: boolean;
	large?: boolean;
}>();

type ModelTChecked = MODELT & (
	MODELT extends GetMkSelectValueTypesFromDef<ITEMS>
		? unknown
		: 'Error: The type of model does not match the type of items.'
);

const model = defineModel<ModelTChecked>({ required: true });

const { autofocus } = toRefs(props);
const focused = ref(false);
const opening = ref(false);
const currentValueText = ref<string | null>(null);
const inputEl = useTemplateRef('inputEl');
const prefixEl = useTemplateRef('prefixEl');
const suffixEl = useTemplateRef('suffixEl');
const container = useTemplateRef('container');
const height =
	props.small ? 33 :
	props.large ? 39 :
	36;
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
const inputId = `mk-select-${genId()}`;
const labelId = `${inputId}-label`;
const captionId = `${inputId}-caption`;

const focus = () => container.value?.focus();

// このコンポーネントが作成された時、非表示状態である場合がある
// 非表示状態だと要素の幅などは0になってしまうので、ResizeObserverでサイズの変化を監視して計算する
const updatePadding = (entries: ResizeObserverEntry[]) => {
	if (inputEl.value == null) return;

	for (const entry of entries) {
		const width = entry.borderBoxSize[0].inlineSize;
		if (width === 0) continue;
		if (entry.target === prefixEl.value) {
			inputEl.value.style.paddingLeft = width + 'px';
		} else if (entry.target === suffixEl.value) {
			inputEl.value.style.paddingRight = width + 'px';
		}
	}
};

let paddingObserver: ResizeObserver | null = null;

onMounted(() => {
	paddingObserver = new ResizeObserver(updatePadding);
	if (prefixEl.value) paddingObserver.observe(prefixEl.value);
	if (suffixEl.value) paddingObserver.observe(suffixEl.value);

	nextTick(() => {
		if (autofocus.value) {
			focus();
		}
	});
});

onUnmounted(() => {
	paddingObserver?.disconnect();
	paddingObserver = null;
});

watch([model, () => props.items], () => {
	let found: ItemOption | null = null;
	for (const item of props.items) {
		if (item.type === 'group') {
			for (const option of item.items) {
				if (option.value === model.value) {
					found = option;
					break;
				}
			}
		} else {
			if (item.value === model.value) {
				found = item;
				break;
			}
		}
	}
	if (found) {
		currentValueText.value = found.label;
	}
}, { immediate: true, deep: true });

function show() {
	if (opening.value || props.disabled || props.readonly) return;
	focus();

	opening.value = true;

	const menu: MenuItem[] = [];

	for (const item of props.items) {
		if (item.type === 'group') {
			if (item.label != null) {
				menu.push({
					type: 'label',
					text: item.label,
				});
			}
			for (const option of item.items) {
				menu.push({
					text: option.label,
					active: computed(() => model.value === option.value),
					action: () => {
						model.value = option.value as ModelTChecked;
					},
				});
			}
		} else {
			menu.push({
				text: item.label,
				active: computed(() => model.value === item.value),
				action: () => {
					model.value = item.value as ModelTChecked;
				},
			});
		}
	}

	os.popupMenu(menu, container.value, {
		width: container.value?.offsetWidth,
		onClosing: () => {
			opening.value = false;
		},
	});
}

function onKeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	event.preventDefault();
	show();
}
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

	> .input:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}

	> .input > .prefix,
	> .input > .suffix {
		height: 44px;
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
	appearance: none;
	-webkit-appearance: none;
	-moz-appearance: none;
	display: block;
	box-sizing: border-box;
	min-inline-size: 0;
	min-block-size: 0;
	width: 100%;
	margin: 0;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	line-height: inherit;
	letter-spacing: inherit;
	text-align: inherit;
	text-transform: none;
	text-decoration: none;
	vertical-align: middle;
	box-shadow: none;
	position: relative;
	cursor: pointer;

	&.inline {
		display: inline-block;
		width: auto;
		margin: 0;
	}

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

	&:focus {
		outline: none;
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}

	&:hover {
		> .inputCore {
			border-color: var(--MI_THEME-inputBorderHover) !important;
		}
	}
}

.inputCore {
	appearance: none;
	-webkit-appearance: none;
	display: flex;
	align-items: center;
	height: v-bind("height + 'px'");
	width: 100%;
	margin: 0;
	padding: 0 12px;
	font: inherit;
	font-weight: normal;
	font-size: 1em;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-panel);
	border: solid 1px var(--MI_THEME-panel);
	border-radius: 6px;
	outline: none;
	box-shadow: none;
	box-sizing: border-box;
	transition: border-color 0.1s ease-out;
	cursor: pointer;
	pointer-events: none;
	user-select: none;
}

.prefix,
.suffix {
	display: flex;
	align-items: center;
	position: absolute;
	z-index: 1;
	top: 0;
	padding: 0 12px;
	font-size: 1em;
	height: v-bind("height + 'px'");
	min-width: 16px;
	max-width: 150px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	box-sizing: border-box;
	pointer-events: none;

	&:empty {
		display: none;
	}
}

.prefix {
	left: 0;
	padding-right: 6px;
}

.suffix {
	right: 0;
	padding-left: 6px;
}

.save {
	margin: 8px 0 0 0;
}

.chevron {
	transition: transform 0.1s ease-out;
}

.chevronOpening {
	transform: rotateX(180deg);
}
</style>
