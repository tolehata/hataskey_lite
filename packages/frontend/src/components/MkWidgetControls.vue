<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.toolbar" :data-collapsed="collapsible && collapsed" :data-collapsible="collapsible" :data-motion="prefer.r.animation.value">
	<div :class="$style.capsule" role="group" :aria-label="i18n.ts.widgets">
		<button
			v-tooltip="editing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets"
			type="button" :class="[$style.button, $style.editButton]" data-cy-widget-edit
			:disabled="collapsible && collapsed" :inert="collapsible && collapsed" :aria-hidden="collapsible && collapsed"
			:aria-label="editing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets" :aria-pressed="editing"
			@click="emit('edit')"
		>
			<i :class="editing ? 'ti ti-check' : 'ti ti-pencil'" aria-hidden="true"></i>
		</button>
		<button
			v-if="collapsible"
			v-tooltip="toggleLabel" type="button" :class="$style.button"
			:aria-label="toggleLabel" :aria-expanded="!collapsed" :aria-controls="controls"
			@click="emit('toggle')"
		>
			<i :class="collapsed ? 'ti ti-chevron-left' : 'ti ti-chevron-right'" aria-hidden="true"></i>
		</button>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	editing: boolean;
	collapsible?: boolean;
	collapsed?: boolean;
	controls?: string;
}>();
const emit = defineEmits<{ edit: []; toggle: [] }>();
const toggleLabel = computed(() => `${i18n.ts.widgets}: ${props.collapsed ? i18n.ts.show : i18n.ts.hide}`);
</script>

<style lang="scss" module>
.toolbar {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 12px;
	transition: margin-bottom .28s cubic-bezier(.22,1,.36,1);
}
.toolbar[data-collapsed='true'] { margin-bottom: 0; }
.capsule {
	display: inline-flex;
	align-items: center;
	padding: 1px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	box-sizing: border-box;
}
.button {
	display: grid;
	place-items: center;
	flex: 0 0 44px;
	width: 44px;
	height: 44px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: transparent;
	color: inherit;
	font-size: 18px;
	cursor: pointer;
	transition: background .15s ease, color .15s ease;
}
.button:hover { background: var(--MI_THEME-buttonHoverBg); }
.button[aria-pressed='true'] { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }
.button:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.button > i, .button > i::before { line-height: 1; }
.editButton {
	overflow: hidden;
	transition: width .28s cubic-bezier(.22,1,.36,1), flex-basis .28s cubic-bezier(.22,1,.36,1), margin-right .28s cubic-bezier(.22,1,.36,1), opacity .14s ease, visibility 0s, background .15s ease, color .15s ease;
}
.toolbar[data-collapsible='true'] .editButton { margin-right: 2px; }
.toolbar[data-collapsed='true'] .editButton {
	width: 0;
	flex-basis: 0;
	margin-right: 0;
	opacity: 0;
	visibility: hidden;
	transition-delay: 0s, 0s, 0s, 0s, .14s, 0s, 0s;
}
.toolbar[data-motion='false'], .toolbar[data-motion='false'] .button { transition: none; }
@media (prefers-reduced-motion: reduce) { .toolbar, .button { transition: none; } }
</style>
