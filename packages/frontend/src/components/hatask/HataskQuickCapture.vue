<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section
	:class="$style.root"
	:data-mode="mode"
	:data-hatask-theme="theme"
	:data-hatagoes="goesMotion"
	:data-open="isOpen"
	:data-state="state"
	:aria-label="label"
	@focusin="expand"
>
	<div :class="$style.pill">
		<div :class="$style.inputRow" :data-has-template="templateLabel != null">
			<span :class="$style.leading" aria-hidden="true"><i :class="leadingIcon ?? (mode === 'event' ? 'ti ti-calendar-plus' : 'ti ti-square-rounded-plus')"></i></span>
			<label :class="$style.srOnly" :for="inputId">{{ label }}</label>
			<component
				:is="multiline ? 'textarea' : 'input'"
				:id="inputId"
				ref="inputEl"
				:value="modelValue"
				:class="$style.input"
				:type="multiline ? undefined : 'text'"
				:rows="multiline ? 1 : undefined"
				:placeholder="placeholder"
				:disabled="disabled || state === 'saving'"
				:aria-describedby="hint ? `${inputId}-hint` : undefined"
				@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
				@keydown="onInputKeydown"
				@keydown.esc="collapse"
			/>
			<button
				v-if="templateLabel"
				type="button"
				:class="[$style.tool, $style.templateTrigger]"
				:disabled="disabled || templateDisabled || state === 'saving'"
				:aria-label="templateLabel"
				:title="templateLabel"
				aria-haspopup="menu"
				data-template-trigger
				@click="emit('template', $event)"
			>
				<i class="ti ti-template" aria-hidden="true"></i>
			</button>
			<button
				type="button"
				:class="$style.submit"
				:disabled="!canSubmit"
				:aria-label="submitLabel"
				:title="submitLabel"
				@click="emit('submit')"
			>
				<i :class="submitIcon" aria-hidden="true"></i>
			</button>
		</div>
		<slot name="primary"></slot>

		<Transition name="capture-tools">
			<div v-if="isOpen || persistentChips" :class="$style.expanded">
				<div v-if="chips.length" :class="$style.chips" :aria-label="chipLabel">
					<button
						v-for="chip in chips"
						:key="chip.id"
						type="button"
						:class="$style.chip"
						:disabled="disabled || state === 'saving'"
						:data-action="chip.actionLabel != null"
						:style="chip.color ? { '--capture-chip-color': chip.color } : undefined"
						:aria-label="chip.actionLabel ?? chipRemoveLabel(chip.label)"
						:title="chip.actionLabel ?? chipRemoveLabel(chip.label)"
						@click="activateChip(chip, $event)"
					>
						<i v-if="chip.icon" :class="chip.icon" aria-hidden="true"></i>
						<span>{{ chip.label }}</span>
						<i :class="chip.actionIcon ?? (chip.actionLabel != null ? 'ti ti-chevron-down' : 'ti ti-x')" aria-hidden="true"></i>
					</button>
				</div>

				<div v-if="isOpen" :class="$style.toolRow">
					<div :class="$style.tools" role="toolbar" :aria-label="toolLabel">
						<button
							v-for="tool in tools"
							:key="tool.id"
							type="button"
							:class="$style.tool"
							:data-active="tool.active"
							:data-labeled="tool.showLabel"
							:data-tone="tool.tone"
							:disabled="disabled || state === 'saving' || tool.disabled"
							:aria-label="tool.label"
							:title="tool.label"
							:aria-pressed="tool.active == null ? undefined : tool.active"
							@click="emit('tool', tool.id, $event.currentTarget as HTMLElement)"
						>
							<i :class="tool.icon" aria-hidden="true"></i>
							<span v-if="tool.showLabel">{{ tool.label }}</span>
						</button>
					</div>
					<p v-if="hint" :id="`${inputId}-hint`" :class="$style.hint">{{ hint }}</p>
				</div>
			</div>
		</Transition>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, ref, useId } from 'vue';
import type { HataskPlannerTheme } from './hatask-planner-types.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const goesMotion = inject(HATA_GOES_HOST, null) != null;

export type HataskCaptureChip = {
	id: string;
	label: string;
	icon?: string;
	color?: string;
	actionLabel?: string;
	actionIcon?: string;
};

export type HataskCaptureTool = {
	id: string;
	label: string;
	icon: string;
	active?: boolean;
	disabled?: boolean;
	showLabel?: boolean;
	tone?: 'accent' | 'neutral';
};

const props = withDefaults(defineProps<{
	theme?: HataskPlannerTheme;
	mode: 'todo' | 'event' | 'mood' | 'meal';
	leadingIcon?: string;
	multiline?: boolean;
	allowEmpty?: boolean;
	persistentChips?: boolean;
	modelValue: string;
	label: string;
	placeholder: string;
	submitLabel: string;
	chipLabel?: string;
	toolLabel?: string;
	templateLabel?: string;
	templateDisabled?: boolean;
	removeChipLabel?: (chipLabel: string) => string;
	hint?: string;
	chips?: HataskCaptureChip[];
	tools?: HataskCaptureTool[];
	disabled?: boolean;
	detailOpen?: boolean;
	state?: 'idle' | 'saving' | 'success' | 'error';
}>(), {
	theme: undefined,
	leadingIcon: undefined,
	multiline: false,
	allowEmpty: false,
	persistentChips: false,
	chipLabel: 'Selected options',
	toolLabel: 'Input options',
	templateLabel: undefined,
	templateDisabled: false,
	removeChipLabel: undefined,
	hint: '',
	chips: () => [],
	tools: () => [],
	disabled: false,
	detailOpen: false,
	state: 'idle',
});

const emit = defineEmits<{
	(ev: 'update:modelValue', value: string): void;
	(ev: 'submit'): void;
	(ev: 'tool', toolId: string, anchor: HTMLElement): void;
	(ev: 'template', event: MouseEvent): void;
	(ev: 'chip', chipId: string, anchor: HTMLElement): void;
	(ev: 'remove-chip', chipId: string): void;
	(ev: 'collapse'): void;
}>();

const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const expanded = ref(false);
const captureId = useId();
const inputId = computed(() => `hatask-${props.mode}-capture-${captureId}`);
const isOpen = computed(() => expanded.value || props.detailOpen || props.modelValue.trim().length > 0);
const canSubmit = computed(() => !props.disabled && props.state !== 'saving' && (props.allowEmpty || props.modelValue.trim().length > 0));
const submitIcon = computed(() => props.state === 'saving'
	? 'ti ti-loader-2'
	: props.state === 'success'
		? 'ti ti-check'
		: props.state === 'error'
			? 'ti ti-refresh'
			: 'ti ti-plus');

function chipRemoveLabel(label: string): string { return props.removeChipLabel?.(label) ?? `Remove ${label}`; }

function onInputKeydown(event: KeyboardEvent): void {
	if (event.isComposing || event.key !== 'Enter' || event.shiftKey || event.altKey) return;
	if (props.multiline && !event.ctrlKey && !event.metaKey) return;
	event.preventDefault();
	if (canSubmit.value) emit('submit');
}

function activateChip(chip: HataskCaptureChip, event: MouseEvent): void {
	if (chip.actionLabel != null) emit('chip', chip.id, event.currentTarget as HTMLElement);
	else emit('remove-chip', chip.id);
}

function expand(): void { expanded.value = true; }

function collapse(): void {
	expanded.value = false;
	inputEl.value?.blur();
	emit('collapse');
}

function focus(options?: FocusOptions): void {
	expand();
	nextTick(() => inputEl.value?.focus(options));
}

defineExpose({ focus });
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
	width: 100%;
	max-width: 760px;
	margin-inline: auto;
	position: relative;
	z-index: 4;
	font-family: var(--htk-font-body, inherit);
}

.pill {
	padding: 6px;
	border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--rule));
	border-radius: 30px;
	background: color-mix(in srgb, var(--surface) 88%, transparent);
	box-shadow: 0 14px 38px -28px color-mix(in srgb, var(--accent) 55%, #000), 0 2px 10px rgba(0, 0, 0, .07);
	backdrop-filter: blur(18px) saturate(1.15);
	transition: border-radius .24s var(--ease-smooth, ease), border-color .2s ease, box-shadow .24s ease;
}

.pill:has(.input:focus-visible) { outline: 2px solid var(--accent); outline-offset: -2px; }

.root[data-open="true"] .pill {
	border-radius: 24px;
	border-color: color-mix(in srgb, var(--accent) 42%, var(--rule));
	box-shadow: 0 20px 48px -28px color-mix(in srgb, var(--accent) 65%, #000), 0 4px 16px rgba(0, 0, 0, .09);
}

.inputRow {
	display: grid;
	grid-template-columns: 42px minmax(0, 1fr) 44px;
	align-items: center;
	gap: 5px;
}

.inputRow[data-has-template="true"] { grid-template-columns: 42px minmax(0, 1fr) 44px 44px; }
.templateTrigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.leading {
	width: 42px;
	height: 42px;
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: color-mix(in srgb, var(--accent) 12%, transparent);
	color: var(--accent);
	font-size: 1.05rem;
}

.input {
	min-width: 0;
	height: 44px;
	padding: 0 8px;
	border: 0;
	outline: 0;
	background: transparent;
	color: var(--fg);
	font: inherit;
	font-size: max(16px, .92rem);
	font-weight: 650;
	line-break: strict;
}

.input::placeholder { color: var(--fg-3); font-weight: 560; }
textarea.input { box-sizing: border-box; height: auto; min-height: 44px; max-height: 180px; field-sizing: content; padding-block: 12px; resize: vertical; line-height: 1.5; }
// The pill draws the input focus ring; override the layout's scoped input rule.
.root .inputRow .input:focus-visible { outline: none; }
.chip:disabled { cursor: default; opacity: .42; }

.submit, .tool {
	width: 44px;
	height: 44px;
	border: 0;
	border-radius: 50%;
	cursor: pointer;
	font: inherit;
}

.submit {
	display: grid;
	place-items: center;
	background: var(--accent);
	color: var(--on-accent, #fff);
	font-size: 1.1rem;
	box-shadow: 0 7px 18px -10px var(--accent);
	transition: transform .18s var(--ease-spring, ease), opacity .18s ease;
}

.submit:active:not(:disabled) { transform: scale(.91); }
.submit:disabled { cursor: default; opacity: .4; box-shadow: none; }
.root[data-state="saving"] .submit i { animation: captureSpin .8s linear infinite; }
.root[data-state="success"] .submit { background: var(--success, #2f9e66); }
.root[data-state="error"] .submit { background: var(--error, #d9485f); }

.expanded {
	display: grid;
	gap: 6px;
	padding: 2px 4px 3px;
}

.chips, .tools, .toolRow {
	display: flex;
	align-items: center;
}

.chips {
	gap: 6px;
	flex-wrap: wrap;
	padding: 2px 4px;
}

.chip {
	min-height: 44px;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	max-width: 100%;
	padding: 5px 9px;
	border: 1px solid color-mix(in srgb, var(--capture-chip-color, var(--accent)) 25%, var(--rule));
	border-radius: 999px;
	background: color-mix(in srgb, var(--capture-chip-color, var(--accent)) 9%, transparent);
	color: var(--fg-2);
	font: inherit;
	font-size: .72rem;
	font-weight: 760;
	cursor: pointer;
	white-space: nowrap;
	transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease;
}

.chip span { overflow: hidden; text-overflow: ellipsis; }
.chip:hover, .chip:focus-visible {
	border-color: color-mix(in srgb, var(--capture-chip-color, var(--accent)) 48%, var(--rule));
	background: color-mix(in srgb, var(--capture-chip-color, var(--accent)) 15%, transparent);
	color: var(--fg);
}
.chip:active { transform: scale(.97); }
.chip[data-action="true"] > i:last-child { color: currentColor; opacity: .72; }

.toolRow {
	min-width: 0;
	gap: 8px;
	justify-content: space-between;
}

.tools { gap: 6px; flex-wrap: wrap; }

.tool {
	display: grid;
	place-items: center;
	background: transparent;
	color: var(--fg-2);
	font-size: 1rem;
	transition: transform .16s ease, color .16s ease, background .16s ease;
}

.tool[data-labeled="true"] {
	width: auto;
	max-width: 100%;
	grid-auto-flow: column;
	grid-template-columns: auto minmax(0, 1fr);
	gap: 7px;
	padding: 0 13px;
	border-radius: 999px;
	font-size: .72rem;
	font-weight: 820;
	white-space: nowrap;
}

.tool[data-labeled="true"] span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tool[data-tone="accent"] {
	border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--rule));
	background: color-mix(in srgb, var(--accent) 12%, var(--surface));
	color: var(--accent);
}

.tool[data-tone="neutral"] {
	border: 1px solid var(--rule);
	background: var(--fill-2);
	color: var(--fg-2);
}

.tool:hover, .tool:focus-visible, .tool[data-active="true"] {
	background: color-mix(in srgb, var(--accent) 12%, transparent);
	color: var(--accent);
}

.tool:active:not(:disabled) { transform: scale(.9); }
.tool:disabled { cursor: default; opacity: .42; }

.hint {
	min-width: 0;
	margin: 0 6px 0 auto;
	color: var(--fg-3);
	font-size: .66rem;
	line-height: 1.35;
	text-align: end;
	text-wrap: balance;
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

@container (max-width: 520px) {
	.pill { padding: 5px; }
	.inputRow { grid-template-columns: 38px minmax(0, 1fr) 44px; }
	.inputRow[data-has-template="true"] { grid-template-columns: 38px minmax(0, 1fr) 44px 44px; }
	.leading { width: 38px; height: 38px; }
	.toolRow { align-items: flex-start; flex-direction: column; }
	.tools { width: 100%; }
	.hint { margin: 0 6px 4px; text-align: start; }
}

@keyframes captureSpin { to { transform: rotate(1turn); } }

:global(.capture-tools-enter-active), :global(.capture-tools-leave-active) {
	transition: opacity .16s ease;
}
:global(.capture-tools-enter-from), :global(.capture-tools-leave-to) { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
	.root:not([data-hatagoes='true']) {
		.pill, .submit, .tool, :global(.capture-tools-enter-active), :global(.capture-tools-leave-active) { transition: none !important; animation: none !important; }
	}
}
.root[data-hatask-theme] { --accent: var(--accent-ink); --fg-3: var(--fg-2); }
.root[data-hatask-theme] .pill {
	border: 1px solid var(--rule);
	border-radius: 24px;
	background: var(--surface);
	box-shadow: var(--shadow, none);
	backdrop-filter: none;
}
.root[data-hatask-theme] .pill:focus-within { border-color: var(--accent); }
.root[data-hatask-theme] .hint { font-size: max(11px, .7rem); }

:global(.htk-root:not([data-theme='akatsuki'])) .pill { border-radius: var(--card-radius); border-color: var(--rule); box-shadow: var(--shadow); }
.root:not([data-hatask-theme='akatsuki']) { --card-radius: inherit; --card-border: inherit; --card-shadow: inherit; --on-accent: var(--htk-on-ink); }
</style>
