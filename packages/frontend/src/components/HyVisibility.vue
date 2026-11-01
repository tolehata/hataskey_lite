<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<fieldset :class="$style.field">
	<legend>{{ label }}</legend>
	<div :class="$style.case">
		<label v-for="choice in choices" :key="choice.value" :class="$style.choice" :title="choice.label">
			<input
				type="radio"
				:name="id"
				:value="choice.value"
				:checked="modelValue === choice.value"
				@change="emit('update:modelValue', choice.value)"
			/>
			<span :class="$style.option">
				<i :class="choice.icon" aria-hidden="true"></i>
				<span :class="$style.label">{{ choice.label }}</span>
			</span>
		</label>
	</div>
</fieldset>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { i18n } from '@/i18n.js';
defineProps<{ modelValue: 'public' | 'followers' | 'private'; label?: string }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: 'public' | 'followers' | 'private'): void }>();
const id = useId();
const choices = [
	{ value: 'public', label: i18n.ts._hata._hatady._controls.visibilityPublic, icon: 'ti ti-world' },
	{ value: 'followers', label: i18n.ts._hata._hatady._controls.visibilityFollowers, icon: 'ti ti-users' },
	{ value: 'private', label: i18n.ts._hata._hatady._controls.visibilityPrivate, icon: 'ti ti-lock' },
] as const;
</script>

<style lang="scss" module>
.field {
	border: 0;
	min-width: 0;
	padding: 0;
	margin: 0;
}
.field > legend {
	font-size: 14px;
	font-weight: 700;
	padding: 0;
	margin-bottom: 10px;
}
.case {
	display: flex;
	width: 100%;
	max-width: 420px;
	box-sizing: border-box;
	padding: 5px;
	gap: 4px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-surface);
}
.choice {
	position: relative;
	min-width: 0;
	flex: 0 0 44px;
	cursor: pointer;
}
.choice:has(input:checked) {
	flex: 1;
}
.choice input {
	position: absolute;
	opacity: 0;
	width: 1px;
	height: 1px;
}
.option {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: center;
	min-height: 44px;
	padding: 6px;
	border-radius: 999px;
	box-sizing: border-box;
}
.option > i {
	font-size: 20px;
}
.label {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
}
.choice input:checked + .option {
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-weight: 700;
}
.choice input:checked + .option .label {
	position: static;
	width: auto;
	height: auto;
	overflow: visible;
	clip-path: none;
	font-size: 14px;
}
.choice input:focus-visible + .option {
	outline: 3px solid var(--hy-accent);
	outline-offset: -2px;
}
</style>
