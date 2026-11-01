<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meaningfulItems.length > 0" :class="$style.root" data-settings-related :data-motion-enabled="isMotionEnabled ? 'true' : 'false'">
	<div :class="$style.heading"><i class="ti ti-bulb" aria-hidden="true"></i>{{ resolvedHeading }}</div>
	<TransitionGroup
		tag="div"
		:class="$style.links"
		:enterActiveClass="isMotionEnabled ? $style.replaceEnterActive : ''"
		:leaveActiveClass="isMotionEnabled ? $style.replaceLeaveActive : ''"
		:enterFromClass="isMotionEnabled ? $style.replaceEnterFrom : ''"
		:leaveToClass="isMotionEnabled ? $style.replaceLeaveTo : ''"
	>
		<button
			v-for="item in visibleItems"
			:key="item.stableId"
			type="button"
			:class="$style.link"
			@click="emit('select', item)"
		>
			<span :class="[$style.label, { settingsBrand: hasSettingsBrand(item.label) }]">{{ item.label }}</span>
			<span v-if="item.reason" :class="$style.reason">{{ item.reason }}</span>
		</button>
	</TransitionGroup>
	<button
		v-if="remainingCount > 0"
		type="button"
		:class="$style.more"
		:aria-expanded="expanded"
		@click="expanded = true"
	>
		{{ copyx.related.showMore({ count: remainingCount }) }}
	</button>
</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import type { SettingsSearchNavigationTargetV2 } from '@/utility/settings-search-v2-context.js';
import { i18n } from '@/i18n.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

export type SettingsRelatedLink = SettingsSearchNavigationTargetV2 & {
	stableId: string;
	label: string;
	reason?: string;
	destructive?: boolean;
};

const props = defineProps<{
	items: SettingsRelatedLink[];
	heading?: string;
}>();

const emit = defineEmits<{
	select: [item: SettingsRelatedLink];
}>();

const settingsContext = inject(settingsSearchV2ContextKey, null);
const copy = i18n.ts._hata._settingsRedesign;
const copyx = i18n.tsx._hata._settingsRedesign;
const expanded = ref(false);
const initialLimit = 3;
const resolvedHeading = computed(() => props.heading ?? copy.search.relatedHeading);
const hasSettingsBrand = (value: string): boolean => /Hataskey|Hatask|Hatady|HataFeed/u.test(value);
const meaningfulItems = computed(() => props.items.filter(item => item.destructive !== true && item.label.trim() !== ''));
const visibleItems = computed(() => expanded.value ? meaningfulItems.value : meaningfulItems.value.slice(0, initialLimit));
const remainingCount = computed(() => expanded.value ? 0 : Math.max(0, meaningfulItems.value.length - initialLimit));
const isMotionEnabled = computed(() => settingsContext?.motionEnabled?.value !== false);

watch(() => props.items.map(item => `${item.stableId}:${item.destructive === true ? '1' : '0'}`).join('|'), () => {
	expanded.value = false;
});
</script>

<style lang="scss" module>
.root {
	margin-top: 12px;
}

.heading {
	display: flex;
	align-items: center;
	gap: 6px;
	color: var(--MI_THEME-accent);
	font-size: 0.75rem;
	font-weight: 700;
	line-height: 1.5;
	line-break: strict;
	text-wrap: pretty;

	> i { font-size: 1rem; }
}

.links {
	display: flex;
	flex-wrap: wrap;
	min-width: 0;
	gap: 8px;
	margin-top: 8px;
}

.replaceEnterActive,
.replaceLeaveActive {
	transition: opacity 160ms ease, transform 160ms ease;
}

.replaceEnterFrom,
.replaceLeaveTo {
	opacity: 0;
	transform: translateY(-3px);
}

.link {
	display: flex;
	min-width: 0;
	min-height: 44px;
	max-width: 100%;
	flex: 0 1 auto;
	align-items: flex-start;
	flex-direction: column;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent);
	border-radius: 16px;
	padding: 8px 13px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	cursor: pointer;
	font: inherit;
	font-size: 0.8rem;
	line-height: 1.45;
	text-align: start;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: 2px; }
}

.label {
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reason {
	display: block;
	margin-top: 1px;
	color: color-mix(in srgb, var(--MI_THEME-fg) 58%, transparent);
	font-size: 0.7rem;
	min-width: 0;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.more {
	min-height: 44px;
	margin-top: 8px;
	border: 0;
	border-radius: 999px;
	padding: 7px 12px;
	background: transparent;
	color: var(--MI_THEME-accent);
	cursor: pointer;
	font: inherit;
	font-size: .78rem;
	font-weight: 700;
	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent); outline-offset: 2px; }
}

.root[data-motion-enabled='false'] :global(*) {
	animation: none !important;
	transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
	.root :global(*) {
		animation: none !important;
		transition: none !important;
	}
}
</style>
