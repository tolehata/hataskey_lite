<!-- SPDX-License-Identifier: AGPL-3.0-only -->

<template>
<nav :class="$style.root" :aria-label="copy.allCategories" :data-smartphone="smartphone" :data-motion-enabled="motionEnabled">
	<div v-if="activeCategory == null" :class="$style.groups">
		<section v-for="group in groups" :key="group.id" :class="$style.group" :data-settings-group-id="group.id" :aria-labelledby="`${instanceId}-${group.id}`">
			<h2 :id="`${instanceId}-${group.id}`" :class="$style.groupHeading">{{ group.label }}</h2>
			<div :class="$style.groupRows">
				<button v-for="category in group.categories" :key="category.id" type="button" :class="$style.categoryRow" :data-settings-category-id="category.id" :style="transitionStyle(category.id)" @click="select(category.id)">
					<i :class="[category.icon, $style.homeIcon]" aria-hidden="true"></i>
					<span :class="$style.rowText"><strong :class="$style.rowTitle">{{ category.label }}</strong><small v-if="!smartphone" :class="$style.rowDescription">{{ category.description }}</small></span>
					<i class="ti ti-chevron-right" :class="$style.rowChevron" aria-hidden="true"></i>
				</button>
			</div>
		</section>
	</div>
	<div v-else :class="$style.categoryGrid">
		<button
			v-for="category in navigationCategories"
			:key="category.id"
			type="button"
			:class="$style.categoryTile"
			:data-active="category.id === activeCategoryId"
			:data-fill-row="desktopRowFillIds.has(category.id)"
			:data-settings-category-id="category.id"
			:aria-current="category.id === activeCategoryId ? 'page' : undefined"
			:style="transitionStyle(category.id)"
			@click="select(category.id)"
		>
			<span :class="$style.tileHeading"><i :class="category.icon" aria-hidden="true"></i><span v-if="category.id === activeCategoryId && !smartphone" :class="$style.tileGroup">{{ category.groupLabel }}</span></span>
			<span :class="$style.categoryText">
				<strong>{{ category.label }}</strong>
				<small v-if="category.id === activeCategoryId">{{ category.description }}<template v-if="!smartphone && category.count != null"> ・ {{ i18n.tsx._hata._settingsBento.itemCount({ count: category.count }) }}</template></small>
			</span>
		</button>
		<button v-if="smartphone && navigationCategories.length < 5" type="button" :class="$style.categoryTile" data-overview-shortcut @click="emit('overview')"><i class="ti ti-layout-grid" aria-hidden="true"></i><strong>{{ copy.allCategories }}</strong></button>
	</div>
</nav>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { i18n } from '@/i18n.js';

interface NavigationCategory {
	id: string;
	label: string;
	description: string;
	icon: string;
	groupId: string;
	groupLabel: string;
	preview: readonly string[];
	count?: number;
	brand?: string;
}

const props = defineProps<{
	categories: readonly NavigationCategory[];
	activeCategoryId: string | null;
	smartphone: boolean;
	motionEnabled: boolean;
}>();
const emit = defineEmits<{
	select: [id: string];
	overview: [];
}>();
const copy = i18n.ts._hata._settingsBento;
const instanceId = `settings-bento-${useId().replace(/[^\w-]/gu, '-')}`;
const activeCategory = computed(() => props.categories.find(category => category.id === props.activeCategoryId));
const navigationCategories = computed(() => {
	if (!props.smartphone || activeCategory.value == null) return props.categories;
	return [activeCategory.value, ...props.categories.filter(category => category.groupId === activeCategory.value?.groupId && category.id !== props.activeCategoryId)];
});
// Keep visual and keyboard order together: fill each odd run around the large
// selected tile by widening its final card, rather than backfilling with dense.
const desktopRowFillIds = computed(() => {
	const result = new Set<string>();
	if (props.smartphone || activeCategory.value == null) return result;
	const index = props.categories.indexOf(activeCategory.value);
	if (index % 2 === 1) result.add(props.categories[index - 1].id);
	if ((props.categories.length - index - 1) % 2 === 1) result.add(props.categories[props.categories.length - 1].id);
	return result;
});
const groups = computed(() => {
	const result: { id: string; label: string; categories: NavigationCategory[] }[] = [];
	for (const category of props.categories) {
		let group = result.find(candidate => candidate.id === category.groupId);
		if (group == null) {
			group = { id: category.groupId, label: category.groupLabel, categories: [] };
			result.push(group);
		}
		group.categories.push(category);
	}
	return result;
});

function transitionStyle(id: string) {
	return { viewTransitionName: props.motionEnabled ? `${instanceId}-${id}` : 'none' };
}

function select(id: string): void {
	if (id !== props.activeCategoryId) emit('select', id);
}
</script>

<style lang="scss" module>
.root {
	min-width: 0;
	container: settings-bento / inline-size;
	color: var(--MI_THEME-fg);
}

.root button {
	appearance: none;
	box-sizing: border-box;
	margin: 0;
	font: inherit;
	color: inherit;
	text-align: left;
	cursor: pointer;
	min-width: 0;
	min-height: 44px;
	-webkit-tap-highlight-color: transparent;
}

.root button:focus-visible {
	outline: 2px solid var(--MI_THEME-focus);
	outline-offset: -3px;
}

.root[data-motion-enabled='true'] button {
	transition: background-color .18s, border-color .18s, box-shadow .18s;
}

.groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 14px; }
.group { min-width: 0; padding: 16px; border: 1px solid var(--MI_THEME-divider); border-radius: 24px; background: var(--MI_THEME-panel); }
.groupHeading { margin: 0 4px 6px; font-size: .875rem; font-weight: 700; line-height: 1.5; color: var(--MI_THEME-fgMuted); }
.groupRows { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; }
.group[data-settings-group-id='you'] { grid-column: 1 / -1; }
.group[data-settings-group-id='you'] .groupRows { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.categoryRow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 4px; border: 0; background: transparent; min-height: 72px !important; }
.categoryRow + .categoryRow { border-top: 1px solid var(--MI_THEME-divider); }
.group[data-settings-group-id='you'] .categoryRow + .categoryRow { border-top: 0; border-inline-start: 1px solid var(--MI_THEME-divider); padding-inline-start: 16px; }
.categoryRow:hover { background: var(--MI_THEME-accentedBg); }
.rowText { display: grid; flex: 1; min-width: 0; gap: 4px; overflow-wrap: anywhere; }
.rowTitle { min-width: 0; font-size: .9375rem; font-weight: 700; line-height: 1.4; }
.rowDescription { color: var(--MI_THEME-fgMuted); font-size: .75rem; line-height: 1.5; }
.rowChevron { flex: none; font-size: 14px; color: var(--MI_THEME-fgMuted); }
.homeIcon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 12px; background: color-mix(in srgb, var(--MI_THEME-accent) 10%, var(--MI_THEME-panel)); font-size: 19px; line-height: 1; color: var(--MI_THEME-accent); }
.root[data-smartphone='true'] .groups { grid-template-columns: minmax(0, 1fr); gap: 12px; }
.root[data-smartphone='true'] .group { padding: 12px; border-radius: 22px; }
.root[data-smartphone='true'] .groupHeading { margin-bottom: 4px; font-size: .75rem; }
.root[data-smartphone='true'] .groupRows { grid-template-columns: minmax(0, 1fr); gap: 0; }
.root[data-smartphone='true'] .categoryRow { min-height: 56px !important; padding: 8px 4px; }
.root[data-smartphone='true'] .categoryRow + .categoryRow { border-top: 1px solid var(--MI_THEME-divider); border-inline-start: 0; padding-inline-start: 4px; }
.root[data-smartphone='true'] .homeIcon { width: 32px; height: 32px; border-radius: 10px; font-size: 18px; }

.tileHeading { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; }
.tileGroup { margin-left: auto; font-size: .72em; font-weight: 800; letter-spacing: .06em; color: var(--MI_THEME-fgMuted); }

.categoryGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(66px, auto); align-content: start; gap: 8px; }
.categoryTile { display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 4px; padding: 10px 12px; border: 1px solid var(--MI_THEME-divider); border-radius: 18px; background: var(--MI_THEME-panel); }
.categoryTile:hover { border-color: var(--MI_THEME-accent); }
.categoryTile i { font-size: 18px; }
.categoryTile strong { font-size: .83em; font-weight: 800; line-height: 1.3; overflow-wrap: anywhere; }
.categoryText { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.categoryText small { font-size: .8em; line-height: 1.4; overflow-wrap: anywhere; }
.categoryTile[data-active='true'] { grid-column: span 2; grid-row: span 2; padding: 16px 18px; border-radius: 22px; border-color: color-mix(in srgb, var(--MI_THEME-accent) 35%, var(--MI_THEME-divider)); background: var(--MI_THEME-accentedBg); }
.categoryTile[data-fill-row='true'] { grid-column: span 2; }
.categoryTile[data-active='true'] i { font-size: 26px; color: var(--MI_THEME-accent); }
.categoryTile[data-active='true'] strong { font-size: 1.2em; }
.categoryTile[data-active='true'] .tileGroup { color: var(--MI_THEME-fg); }
.root[data-smartphone='true'] .categoryGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(78px, auto); gap: 6px; }
.root[data-smartphone='true'] .categoryTile { padding: 10px; }
.root[data-smartphone='true'] .categoryTile strong { font-size: .78em; }
.root[data-smartphone='true'] .categoryTile[data-active='true'] { padding: 14px 16px; gap: 6px; }
.root[data-smartphone='true'] .categoryTile[data-active='true'] strong { font-size: 1.13em; }
.root[data-smartphone='true'] .categoryTile[data-overview-shortcut] { grid-column: span 2; }

@container settings-bento (max-width: 720px) {
	.groups { grid-template-columns: minmax(0, 1fr); }
	.group[data-settings-group-id='you'] .groupRows { grid-template-columns: minmax(0, 1fr); gap: 0; }
	.group[data-settings-group-id='you'] .categoryRow + .categoryRow { border-top: 1px solid var(--MI_THEME-divider); border-inline-start: 0; padding-inline-start: 4px; }
}

@media (prefers-reduced-motion: reduce) {
	.root button { transition: none !important; view-transition-name: none !important; }
}
</style>
