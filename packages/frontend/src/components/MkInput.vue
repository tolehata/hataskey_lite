<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_selectable" :class="[$style.root, { [$style.redesigned]: isSettingsRedesign }]">
	<div :id="labelId" :class="$style.label" @click="onLabelClick"><slot name="label"></slot></div>
	<div :class="[$style.input, { [$style.inline]: inline, [$style.disabled]: disabled, [$style.focused]: focused }]">
		<div ref="prefixEl" :class="$style.prefix"><slot name="prefix"></slot></div>
		<input
			:id="inputId"
			ref="inputEl"
			v-model="v"
			v-adaptive-border
			:class="$style.inputCore"
			:type="type"
			:disabled="disabled"
			:required="required"
			:readonly="readonly"
			:placeholder="placeholder"
			:pattern="pattern"
			:autocomplete="autocomplete"
			:autocapitalize="autocapitalize"
			:spellcheck="spellcheck"
			:inputmode="inputmode"
			:aria-labelledby="labelId"
			:step="step"
			:list="listId"
			:aria-describedby="captionId"
			:min="min"
			:max="max"
			@focus="onFocus"
			@blur="focused = false"
			@keydown="onKeydown($event)"
			@input="onInput"
		>
		<datalist v-if="datalist" :id="listId">
			<option v-for="data in datalist" :key="data" :value="data"/>
		</datalist>
		<div ref="suffixEl" :class="$style.suffix"><slot name="suffix"></slot></div>
	</div>
	<div :id="captionId" :class="$style.caption"><slot name="caption"></slot></div>
	<MkButton v-if="manualSave && changed" primary :class="$style.save" @click="updated"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
	<SettingsControlRelated v-if="isSettingsRedesign" :data-settings-search-id="$attrs['data-settings-search-id']"/>
</div>
</template>

<script lang="ts">
type SupportedTypes = 'text' | 'password' | 'email' | 'url' | 'tel' | 'number' | 'search' | 'date' | 'time' | 'datetime-local' | 'color';
type ModelValueType<T extends SupportedTypes> =
	T extends 'number' ? number :
	T extends 'text' | 'password' | 'email' | 'url' | 'tel' | 'search' | 'date' | 'time' | 'datetime-local' | 'color' ? string :
	never;
</script>

<script lang="ts" setup generic="T extends SupportedTypes = 'text'">
import { inject, onMounted, onUnmounted, nextTick, ref, useTemplateRef, watch, computed, toRefs } from 'vue';
import { throttle, debounce } from 'throttle-debounce';
import type { InputHTMLAttributes } from 'vue';
import type { SuggestionType } from '@/utility/autocomplete.js';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { Autocomplete } from '@/utility/autocomplete.js';
import { genId } from '@/utility/id.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';

const props = defineProps<{
	modelValue: ModelValueType<T> | null;
	type?: T;
	required?: boolean;
	readonly?: boolean;
	disabled?: boolean;
	pattern?: string;
	placeholder?: string;
	autofocus?: boolean;
	autocomplete?: string;
	mfmAutocomplete?: boolean | SuggestionType[],
	autocapitalize?: string;
	spellcheck?: boolean;
	inputmode?: InputHTMLAttributes['inputmode'];
	step?: InputHTMLAttributes['step'];
	datalist?: string[];
	min?: number;
	max?: number;
	inline?: boolean;
	debounce?: boolean | number;
	throttle?: boolean | number;
	manualSave?: boolean;
	small?: boolean;
	large?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'change', _ev: KeyboardEvent): void;
	(ev: 'keydown', _ev: KeyboardEvent): void;
	(ev: 'enter', _ev: KeyboardEvent): void;
	(ev: 'update:modelValue', value: ModelValueType<T>): void;
}>();

const { modelValue } = toRefs(props);
const v = ref<ModelValueType<T> | null>(modelValue.value);
const inputId = `mk-input-${genId()}`;
const labelId = `${inputId}-label`;
const listId = `${inputId}-list`;
const captionId = `${inputId}-caption`;
const focused = ref(false);
const changed = ref(false);
const invalid = ref(false);
const filled = computed(() => v.value !== '' && v.value != null);
const inputEl = useTemplateRef('inputEl');
const prefixEl = useTemplateRef('prefixEl');
const suffixEl = useTemplateRef('suffixEl');
const height =
	props.small ? 33 :
	props.large ? 39 :
	36;
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
let autocompleteWorker: Autocomplete | null = null;

const focus = () => inputEl.value?.focus();
const onLabelClick = (event: MouseEvent) => {
	const target = event.target as Element | null;
	if (target?.closest('button, a, input, select, textarea, [role="button"], [role="link"], ._button')) return;
	focus();
};
const onInput = (event: Event) => {
	const ev = event as KeyboardEvent;
	changed.value = true;
	emit('change', ev);
};
const onKeydown = (ev: KeyboardEvent) => {
	if (ev.isComposing || ev.key === 'Process' || ev.keyCode === 229) return;

	emit('keydown', ev);

	if (ev.code === 'Enter') {
		focused.value = false;
		inputEl.value?.blur();
		emit('enter', ev);
	}
};

const onFocus = () => {
	if (!(props.readonly || props.disabled)) {
		focused.value = true;
	}
};

const updated = () => {
	changed.value = false;
	if (props.type === 'number') {
		emit('update:modelValue', typeof v.value === 'number' ? v.value as ModelValueType<T> : parseFloat(v.value ?? '0') as ModelValueType<T>);
	} else {
		emit('update:modelValue', v.value ?? '');
	}
};

const throttledUpdated = throttle(typeof props.throttle === 'number' ? props.throttle : 1000, updated);
const debouncedUpdated = debounce(typeof props.debounce === 'number' ? props.debounce : 1000, updated);

watch(modelValue, newValue => {
	v.value = newValue;
});

watch(v, () => {
	if (!props.manualSave) {
		if (props.throttle === true || typeof props.throttle === 'number') {
			throttledUpdated();
		} else if (props.debounce === true || typeof props.debounce === 'number') {
			debouncedUpdated();
		} else {
			updated();
		}
	}

	invalid.value = inputEl.value?.validity.badInput ?? true;
});

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
		if (props.autofocus) {
			focus();
		}
	});

	if (props.mfmAutocomplete && inputEl.value) {
		autocompleteWorker = new Autocomplete(inputEl.value, v, props.mfmAutocomplete === true ? undefined : props.mfmAutocomplete);
	}
});

onUnmounted(() => {
	paddingObserver?.disconnect();
	paddingObserver = null;

	if (autocompleteWorker) {
		autocompleteWorker.detach();
	}
});

defineExpose({
	focus,
});
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
	position: relative;

	&.inline {
		display: inline-block;
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
}

.inputCore {
	appearance: none;
	-webkit-appearance: none;
	display: block;
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

	&:hover {
		border-color: var(--MI_THEME-inputBorderHover) !important;
	}
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
	// pointer-events: none;

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
</style>
