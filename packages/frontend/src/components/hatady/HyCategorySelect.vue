<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="[$style.root, { [$style.card]: card }]" role="group" data-hy-page-controls :aria-label="label">
	<button
		ref="trigger"
		type="button"
		:class="[$style.trigger, { [$style.cardTrigger]: card }]"
		:aria-label="`${label}: ${selected?.label ?? label}`"
		aria-haspopup="dialog"
		:aria-expanded="shown && !closing"
		:aria-controls="shown ? listId : undefined"
		:disabled="!options.length"
		@click="open"
		@keydown.down.prevent="open"
		@keydown.up.prevent="open"
	>
		<i :class="selected?.icon ?? 'ti ti-filter'" aria-hidden="true"></i>
		<span v-if="card" :class="$style.cardCopy"><span>{{ label }}</span><small>{{ selected?.label ?? label }}</small></span>
		<span v-else :class="$style.selectedLabel">{{ selected?.label ?? label }}</span>
		<i class="ti ti-chevron-down" :class="$style.chevron" aria-hidden="true"></i>
	</button>
	<Teleport to="body">
		<HyDialog
			v-if="shown"
			ref="dialog"
			:class="$style.dialog"
			:title="label"
			:anchorElement="trigger"
			floating
			centerTitle
			@close="close"
			@closed="onClosed"
		>
			<div :id="listId" ref="list" :class="$style.list" role="listbox" :aria-label="label" @keydown="onKeydown">
				<button
					v-for="(option, index) in options"
					:key="option.value"
					type="button"
					role="option"
					:class="$style.option"
					:data-selected="option.value === modelValue"
					:aria-selected="option.value === modelValue"
					:tabindex="index === focusedIndex ? 0 : -1"
					@focus="focusedIndex = index"
					@click="choose(option.value)"
				>
					<i :class="option.icon" aria-hidden="true"></i>
					<span>{{ option.label }}</span>
					<i v-if="option.value === modelValue" class="ti ti-check" aria-hidden="true"></i>
				</button>
			</div>
		</HyDialog>
	</Teleport>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue';
import HyDialog from '@/components/HyDialog.vue';

const props = defineProps<{
	modelValue: string;
	options: ReadonlyArray<{ value: string; label: string; icon: string }>;
	label: string;
	card?: boolean;
}>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const selected = computed(() => props.options.find(option => option.value === props.modelValue));
const trigger = useTemplateRef('trigger');
const dialog = useTemplateRef('dialog');
const list = useTemplateRef('list');
const listId = useId();
const shown = ref(false);
const closing = ref(false);
const focusedIndex = ref(0);

async function focusOption(index: number): Promise<void> {
	focusedIndex.value = index;
	await nextTick();
	if (!shown.value || closing.value) return;
	const button = list.value?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index];
	button?.focus({ preventScroll: true });
	button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

async function open(): Promise<void> {
	if (shown.value || !props.options.length) return;
	focusedIndex.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue));
	shown.value = true;
	await nextTick();
	await focusOption(focusedIndex.value);
}

function close(): void {
	if (closing.value) return;
	closing.value = true;
	dialog.value?.close();
}

function onClosed(): void {
	shown.value = false;
	closing.value = false;
}

function choose(value: string): void {
	if (closing.value) return;
	close();
	if (value !== props.modelValue) emit('update:modelValue', value);
}

function onKeydown(event: KeyboardEvent): void {
	const count = props.options.length;
	if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		close();
	} else if (count && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
		event.preventDefault();
		const index = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
			: (focusedIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
		void focusOption(index);
	} else if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		const option = props.options[focusedIndex.value];
		if (option) choose(option.value);
	}
}
</script>

<style lang="scss" module>
.root {
	min-width: 0;
	max-width: 100%;
}
.card { width: 100%; }
.trigger {
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	min-width: 44px;
	min-height: 44px;
	max-width: 100%;
	padding: 9px 14px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-surface);
	color: var(--hy-ink);
	font: inherit;
	font-size: 14px;
	line-height: 1.5;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
}
.trigger > i {
	flex: none;
	font-size: 18px;
}
.trigger > .chevron {
	font-size: 14px;
	color: var(--hy-muted);
}
.selectedLabel {
	min-width: 0;
	overflow-wrap: anywhere;
}
.cardTrigger { justify-content: flex-start; width: 100%; min-height: 68px; padding: 8px 10px; border-radius: 12px; text-align: left; }
.cardCopy { display: grid; flex: 1; min-width: 0; line-height: 1.35; }
.cardCopy > span { font-size: 13px; }
.cardCopy > small { overflow: hidden; color: var(--hy-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.trigger[aria-expanded='true'] {
	background: var(--hy-soft);
	color: var(--hy-accent);
}
.trigger:disabled {
	opacity: 0.5;
	cursor: default;
}
.dialog :deep(.hatady-scope[data-floating='true']) {
	width: min(360px, calc(100dvw - 24px));
	max-width: 100%;
}
.list {
	display: grid;
	gap: 6px;
	min-width: 0;
}
.option {
	box-sizing: border-box;
	display: grid;
	grid-template-columns: 22px minmax(0, 1fr) 20px;
	align-items: center;
	gap: 10px;
	width: 100%;
	min-width: 0;
	min-height: 44px;
	padding: 10px 12px;
	border: 1px solid transparent;
	border-radius: 16px;
	background: transparent;
	color: var(--hy-ink);
	font: inherit;
	font-size: 14px;
	line-height: 1.5;
	text-align: left;
	cursor: pointer;
}
.option > i {
	font-size: 20px;
	text-align: center;
}
.option > span {
	min-width: 0;
	overflow-wrap: anywhere;
}
.option[data-selected='true'] {
	border-color: var(--hy-border);
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-weight: 700;
}
.option:hover {
	background: var(--hy-soft);
}
.trigger:focus-visible,
.option:focus-visible {
	outline: 3px solid var(--hy-accent);
	outline-offset: -2px;
}
</style>
