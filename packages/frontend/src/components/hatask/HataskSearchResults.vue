<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root" data-hatask-search-results>
	<section v-for="group in visibleGroups" :key="group.id" :aria-labelledby="`${headingId}-${group.id}`" :data-search-group="group.id">
		<h3 :id="`${headingId}-${group.id}`" :class="$style.groupTitle">{{ group.label }}</h3>
		<template v-for="item in group.items" :key="item.id">
			<button
				v-if="item.selectable === true"
				type="button"
				:class="$style.item"
				:data-search-id="item.id"
				data-selectable="true"
				@click="emit('select', group.id, item.id)"
			>
				<span v-if="item.icon" :class="$style.icon" aria-hidden="true"><i :class="item.icon"></i></span>
				<span v-else :class="$style.dot" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
				<span :class="$style.body"><span :class="$style.title">{{ item.title }}</span><span :class="$style.description">{{ item.description }}</span></span>
			</button>
			<div v-else :class="$style.item" :data-search-id="item.id" data-selectable="false">
				<span v-if="item.icon" :class="$style.icon" aria-hidden="true"><i :class="item.icon"></i></span>
				<span v-else :class="$style.dot" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
				<span :class="$style.body"><span :class="$style.title">{{ item.title }}</span><span :class="$style.description">{{ item.description }}</span></span>
			</div>
		</template>
	</section>
	<p v-if="!visibleGroups.length && emptyLabel" :class="$style.empty" role="status"><i class="ti ti-circle-off" aria-hidden="true"></i> {{ emptyLabel }}</p>
</div>
</template>

<script lang="ts" setup>
import { computed, useId } from 'vue';

export type HataskSearchGroup = {
	id: 'events' | 'moods' | 'todos';
	label: string;
	items: {
		id: string;
		title: string;
		description: string;
		icon?: string;
		color?: string;
		selectable?: boolean;
	}[];
};

const props = defineProps<{
	groups: HataskSearchGroup[];
	emptyLabel: string;
}>();

const emit = defineEmits<{
	select: [kind: HataskSearchGroup['id'], id: string];
}>();

const headingId = useId();
const visibleGroups = computed(() => props.groups.filter(group => group.items.length > 0));
</script>

<style lang="scss" module>
.root {
	min-width: 0;
	color: var(--fg);
	font: inherit;
}

.root .groupTitle {
	display: block;
	margin: 14px 0 6px;
	padding: 0 0 4px;
	border-bottom: 1px solid var(--rule);
	color: var(--fg-2);
	font: inherit;
	font-size: .73rem;
	font-weight: 600;
	line-height: 1.5;
	overflow-wrap: anywhere;
}

// Keep native buttons independent of the surrounding layout's button reset.
.root .item {
	box-sizing: border-box;
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	min-width: 0;
	min-height: 44px;
	margin: 0 0 2px;
	padding: 10px 12px;
	border: 0;
	border-radius: var(--radius-xs, 10px);
	background: transparent;
	color: var(--fg);
	font: inherit;
	text-align: start;
	white-space: normal;
	cursor: default;
}

.root .item[data-selectable='true'] {
	cursor: pointer;
	touch-action: manipulation;

	&:hover, &:active {
		background: var(--hover-bg, color-mix(in srgb, var(--fg) 7%, transparent));
		color: var(--fg);
	}

	&:focus-visible {
		outline: 2px solid var(--accent-ink, var(--primary));
		outline-offset: -2px;
	}
}

.root .dot {
	flex: 0 0 8px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: var(--primary);
}

.root .icon {
	flex-shrink: 0;
	color: currentColor;
	font-size: 1.3rem;
	text-shadow: none;
}

.root .body {
	flex: 1;
	min-width: 0;
}

.root .title, .root .description {
	display: block;
	min-width: 0;
	color: var(--fg);
	font-size: .88rem;
	font-weight: 600;
	line-height: 1.5;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.root .description {
	margin-top: 1px;
	color: var(--fg-2);
	font-size: .72rem;
	font-weight: 400;
}

.root .empty {
	margin: 0;
	padding: 28px 12px;
	color: var(--fg-2);
	font-size: .85rem;
	line-height: 1.5;
	text-align: center;
	overflow-wrap: anywhere;
}

// Preserve the existing search-result treatments in the legacy modal themes.
:global(.htk-modal-ov[data-theme='kisetsu']) .root .groupTitle {
	display: flex;
	align-items: center;
	gap: 8px;
	border-bottom: none;
	color: var(--accent);
	font-family: 'Bebas Neue', sans-serif;
	font-size: .7rem;
	font-weight: 400;
	letter-spacing: .24em;
}

:global(.htk-modal-ov[data-theme='kisetsu']) .root .groupTitle::after,
:global(.htk-modal-ov[data-theme='kashin']) .root .groupTitle::after {
	content: '';
	flex: 1;
	height: 1px;
	background: var(--rule);
}

:global(.htk-modal-ov[data-theme='kisetsu']) .root .item {
	border-bottom: 1px solid var(--rule);
	border-radius: 0;
}

:global(.htk-modal-ov[data-theme='kisetsu']) .root .icon,
:global(.htk-modal-ov[data-theme='kashin']) .root .icon {
	color: var(--accent);
}

:global(.htk-modal-ov[data-theme='kashin']) .root .groupTitle {
	display: flex;
	align-items: center;
	gap: 8px;
	border-bottom: none;
	color: var(--fg);
	font-size: .7rem;
	font-weight: 900;
}

:global(.htk-modal-ov[data-theme='kashin']) .root .item {
	margin-bottom: 8px;
	border: 2px solid var(--rule);
	border-radius: 14px;
	background: var(--surface);
}

:global(.htk-modal-ov[data-theme='suri']) .root .groupTitle {
	display: flex;
	align-items: center;
	gap: 8px;
	border-bottom: none;
	color: var(--blue);
	font-family: 'Bebas Neue', sans-serif;
	font-size: .72rem;
	font-weight: 400;
	letter-spacing: .14em;
}

:global(.htk-modal-ov[data-theme='suri']) .root .groupTitle::after {
	content: '';
	flex: 1;
	height: 0;
	border-top: 2px dotted var(--blue);
}

:global(.htk-modal-ov[data-theme='suri']) .root .item {
	border-bottom: 2px dotted var(--fg-3);
	border-radius: 0;
}

:global(.htk-modal-ov[data-theme='suri']) .root .icon {
	color: var(--blue);
}
</style>
