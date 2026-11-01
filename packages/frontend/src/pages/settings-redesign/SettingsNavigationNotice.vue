<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	:class="$style.root"
	role="status"
	aria-live="polite"
	aria-atomic="true"
	:data-motion-enabled="motionEnabled ? 'true' : 'false'"
>
	<i class="ti ti-info-circle" aria-hidden="true"></i>
	<p :class="$style.message">{{ message }}</p>
	<button
		v-if="dismissible"
		type="button"
		:class="$style.dismiss"
		:aria-label="dismissLabel"
		@click="dismiss"
	>
		<i class="ti ti-x" aria-hidden="true"></i>
	</button>
</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	message: string;
	dismissLabel: string;
	dismissible?: boolean;
	motionEnabled?: boolean;
}>(), {
	dismissible: false,
	motionEnabled: true,
});

const emit = defineEmits<{
	dismiss: [];
}>();

const motionEnabled = computed(() => props.motionEnabled);

function dismiss(): void {
	emit('dismiss');
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	min-block-size: 56px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 34%, var(--MI_THEME-divider));
	border-radius: 18px;
	padding: 12px 12px 12px 14px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel));
	color: var(--MI_THEME-fg);
	line-height: 1.55;
}

.root > i {
	flex: 0 0 auto;
	margin-block-start: 2px;
	color: var(--MI_THEME-accent);
	font-size: 1.1rem;
}

.message {
	flex: 1 1 auto;
	min-inline-size: 0;
	margin: 0;
	line-break: strict;
	word-break: normal;
	text-wrap: pretty;
}

.dismiss {
	display: inline-grid;
	flex: 0 0 auto;
	place-items: center;
	min-width: 44px;
	min-height: 44px;
	margin: -6px -5px -6px 0;
	border: 0;
	border-radius: 12px;
	background: transparent;
	color: var(--MI_THEME-fg);
	cursor: pointer;
	font: inherit;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);
		outline-offset: 2px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.root {
		animation: none !important;
		transition: none !important;
	}
}
</style>
