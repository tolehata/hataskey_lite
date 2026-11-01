<!-- SPDX-License-Identifier: AGPL-3.0-only -->

<template>
<nav
	v-if="items.length > 0"
	ref="navigation"
	:class="$style.capsule"
	:data-motion-enabled="motionEnabled"
	data-settings-section-navigation
	:aria-label="i18n.ts._hata._settingsBento.details"
>
	<button
		v-for="item in items"
		:key="item.id"
		type="button"
		:class="$style.item"
		:data-settings-section-id="item.id"
		:data-active="activeId === item.id ? 'true' : undefined"
		:aria-current="activeId === item.id ? 'location' : undefined"
		:aria-label="item.label"
		:title="item.label"
		@click="emit('select', item.id)"
	>
		<i :class="item.icon" aria-hidden="true"></i>
		<span v-if="activeId === item.id" :class="$style.label">{{ item.label }}</span>
	</button>
</nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from 'vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	items: readonly { id: string; label: string; icon: string }[];
	activeId: string | null;
	motionEnabled: boolean;
}>();

const emit = defineEmits<{
	select: [id: string];
}>();

const navigation = useTemplateRef<HTMLElement>('navigation');
let resizeObserver: ResizeObserver | undefined;

function revealActiveItem() {
	const element = navigation.value;
	if (element == null || props.activeId == null) return;
	const selected = [...element.querySelectorAll<HTMLElement>('[data-settings-section-id]')]
		.find(button => button.dataset.settingsSectionId === props.activeId);
	if (selected == null) return;

	const viewport = element.getBoundingClientRect();
	const button = selected.getBoundingClientRect();
	if (viewport.width === 0 || button.width === 0) return;
	if (button.left >= viewport.left + 4 && button.right <= viewport.right - 4) return;

	// Move only this capsule; scrollIntoView would also move the settings form.
	element.scrollTo({
		left: element.scrollLeft + button.left - viewport.left - (viewport.width - button.width) / 2,
		behavior: 'auto',
	});
}

watch([
	() => props.activeId,
	() => props.items.map(item => [item.id, item.label]),
], revealActiveItem, { flush: 'post' });

watch(navigation, element => {
	resizeObserver?.disconnect();
	resizeObserver = undefined;
	if (element != null && typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(revealActiveItem);
		resizeObserver.observe(element);
	}
	revealActiveItem();
}, { flush: 'post' });

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style lang="scss" module>
.capsule {
	position: sticky;
	inset-block-start: 8px;
	z-index: 4;
	display: flex;
	flex: none;
	flex-wrap: nowrap;
	gap: 4px;
	box-sizing: border-box;
	width: fit-content;
	min-width: 0;
	max-width: 100%;
	margin: 0 auto;
	padding: 4px;
	overflow-x: auto;
	overflow-y: hidden;
	scroll-behavior: auto;
	scrollbar-width: none;
	border-radius: 9999px;
	background: color-mix(in srgb, var(--MI_THEME-bg) 74%, var(--MI_THEME-panel));
	backdrop-filter: blur(24px) saturate(1.4);
	box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--MI_THEME-divider) 60%, transparent);

	&::-webkit-scrollbar {
		display: none;
	}
}

.item {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	gap: 6px;
	box-sizing: border-box;
	min-width: 44px;
	min-height: 44px;
	max-width: min(100%, 16rem);
	padding: 8px 12px;
	border: 0;
	border-radius: 9999px;
	background: transparent;
	color: var(--MI_THEME-fgMuted);
	font: inherit;
	font-size: 0.8rem;
	white-space: nowrap;
	cursor: pointer;

	> i {
		flex: none;
		font-size: 18px;
	}

	&[data-active='true'] {
		background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
		color: var(--MI_THEME-accent);
		font-weight: 750;
	}

	&:not([data-active='true']):hover {
		background: color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);
		color: var(--MI_THEME-fg);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-focus);
		outline-offset: -3px;
	}
}

.label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.capsule[data-motion-enabled='true'] .item {
	transition: background-color 160ms ease, color 160ms ease;
}

@media (prefers-reduced-motion: reduce) {
	.capsule[data-motion-enabled='true'] .item {
		transition: none;
	}
}
</style>
