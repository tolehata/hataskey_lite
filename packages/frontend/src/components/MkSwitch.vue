<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.disabled]: disabled, [$style.redesigned]: isSettingsRedesign, [$style.compact]: compact, [$style.flat]: flat }]" :data-settings-flat-row="flat ? '' : undefined">
	<input
		:id="inputId"
		ref="input"
		type="checkbox"
		:checked="checked"
		:disabled="disabled"
		:class="$style.input"
		:aria-labelledby="inputAriaLabelledby"
		:aria-describedby="describedBy"
		:aria-label="inputAriaLabel"
		@change="onInputChange"
	>
	<label :for="inputId" :class="$style.toggle">
		<XButton decorative :checked="checked" :disabled="disabled"/>
	</label>
	<span v-if="!noBody" :class="$style.body">
		<!-- TODO: 無名slotの方は廃止 -->
		<span :class="$style.labelRow">
			<label :id="labelId" :for="inputId" :class="$style.label">
				<slot name="label"></slot><slot></slot>
			</label>
			<button v-if="helpText" v-tooltip:dialog="helpText" type="button" class="_button _help" :class="$style.help" :aria-label="helpText" @click.stop><i class="ti ti-help-circle" aria-hidden="true"></i></button>
			<span v-if="helpText" :id="helpId" :class="$style.srOnly">{{ helpText }}</span>
		</span>
		<p :id="captionId" :class="$style.caption"><slot name="caption"></slot></p>
	</span>
	<SettingsControlRelated v-if="isSettingsRedesign && !compact" fullWidth :data-settings-search-id="$attrs['data-settings-search-id']"/>
</div>
</template>

<script lang="ts" setup>
import { computed, inject, unref } from 'vue';
import type { Ref } from 'vue';
import XButton from '@/components/MkSwitch.button.vue';
import { haptic } from '@/utility/haptic.js';
import { genId } from '@/utility/id.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	modelValue: boolean | Ref<boolean>;
	disabled?: boolean;
	helpText?: string;
	noBody?: boolean;
	/** Explicitly name a compact or icon-adjacent switch. */
	ariaLabel?: string;
	/** Use an existing visible label outside this component when necessary. */
	ariaLabelledby?: string;
	/** Keep an inline control compact inside a composite setting row. */
	compact?: boolean;
	/** Render inside an owning settings card without adding a second card surface. */
	flat?: boolean;
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', v: boolean): void;
	(ev: 'change', v: boolean): void;
}>();

const checked = computed(() => unref(props.modelValue));
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
const inputId = `mk-switch-${genId()}`;
const labelId = `${inputId}-label`;
const captionId = `${inputId}-caption`;
const helpId = `${inputId}-help`;
const describedBy = computed(() => props.noBody ? undefined : [captionId, props.helpText ? helpId : null].filter((id): id is string => id != null).join(' '));
const inputAriaLabelledby = computed(() => props.ariaLabelledby ?? (props.ariaLabel == null && !props.noBody ? labelId : undefined));
const inputAriaLabel = computed(() => props.ariaLabel ?? (props.noBody ? i18n.ts.switch : undefined));
const onInputChange = (event: Event) => {
	if (props.disabled) return;
	const nextValue = (event.currentTarget as HTMLInputElement).checked;
	emit('update:modelValue', nextValue);
	emit('change', nextValue);
	haptic();
};
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: flex;
	transition: all 0.2s ease;
	user-select: none;

	&:hover {
		> .toggle {
			border-color: var(--MI_THEME-inputBorderHover) !important;
		}
	}

	&.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
}

.input {
	position: absolute;
	width: 1px;
	height: 1px;
	opacity: 0;
	margin: 0;
	pointer-events: none;

	&:focus-visible + .toggle {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: 2px;
	}
}

.toggle {
	display: inline-flex;
	flex-shrink: 0;
	cursor: pointer;
}

.body {
	margin-left: 12px;
	margin-top: 2px;
	display: block;
	transition: inherit;
	color: var(--MI_THEME-fg);
}

.label {
	display: block;
	line-height: 20px;
	cursor: pointer;
	transition: inherit;
}

.labelRow {
	display: flex;
	align-items: flex-start;
}

.caption {
	margin: 8px 0 0 0;
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
	font-size: 0.85em;

	&:empty {
		display: none;
	}
}

.help {
	margin-left: 0.5em;
	font-size: 85%;
	vertical-align: top;
}

.srOnly {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.redesigned {
	align-items: flex-start;
	flex-wrap: wrap;
	min-height: 56px;
	box-sizing: border-box;
	padding: 15px 18px;
	border: 0;
	border-radius: 22px;
	background: transparent;

	> .toggle {
		--mk-switch-height: 26px;
		--mk-switch-width: 46px;

		order: 2;
		width: 46px;
		height: 28px;
		margin: 0 0 0 16px;

		&::before {
			content: '';
			position: absolute;
			top: -8px;
			right: 0;
			bottom: -8px;
			left: 0;
		}
	}

	> .body {
		flex: 1;
		min-width: 0;
		margin: 1px 0 0;
	}

	> .body > .labelRow > .label {
		line-height: 1.5;
	}

	> .body > .caption {
		margin-top: 6px;
		line-height: 1.55;
	}

}

/*
 * Composite rows (for example, navigation reordering) already provide their
 * own visible row label.  Keep the switch's label in the accessibility tree,
 * but do not turn the inline affordance into a second settings card.
 */
.redesigned.compact {
	min-height: 28px;
	flex-wrap: nowrap;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;

	> .toggle {
		order: initial;
		--mk-switch-height: 28px;
		--mk-switch-width: 52px;
		width: 52px;
		height: 30px;
		margin: 0;
	}

	> .body {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		margin: 0;
		clip: rect(0, 0, 0, 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}
}

/*
 * A composite settings card can own the border and separators for a small
 * group of related switches. This remains opt-in so ordinary settings keep
 * the redesigned card treatment.
 */
.redesigned.flat {
	min-height: 56px;
	padding: 14px 0;
	border: 0;
	border-radius: 0;
	background: transparent;
	box-shadow: none;
}

@container (max-width: 680px) {
	.redesigned:not(.compact) > .toggle {
		--mk-switch-height: 28px;
		--mk-switch-width: 52px;
		width: 52px;
		height: 30px;
	}
}
</style>
