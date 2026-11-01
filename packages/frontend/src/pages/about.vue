<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :actions="headerActions" :tabs="[]" :swipable="true">
	<!-- 旗鯖fork: 画面中央上部のピル型タブ (Hataskey UI 統一デザイン) -->
	<div :class="$style.htkPillTabs">
		<div :class="$style.htkPillTabsInner">
			<button v-for="t in headerTabs" :key="t.key" :class="[$style.htkPillTab, { [$style.htkPillTabActive]: tab === t.key }]" @click="tab = t.key">
				<i v-if="t.icon" :class="t.icon"></i>
				<span>{{ t.title }}</span>
			</button>
		</div>
	</div>
	<div v-if="tab === 'overview'" class="_spacer" style="--MI_SPACER-w: 600px; --MI_SPACER-min: 20px;">
		<XOverview/>
	</div>
	<div v-else-if="tab === 'emojis'" class="_spacer" style="--MI_SPACER-w: 1000px; --MI_SPACER-min: 20px;">
		<XEmojis/>
	</div>
	<div v-else-if="instance.federation !== 'none' && tab === 'federation'" class="_spacer" style="--MI_SPACER-w: 1000px; --MI_SPACER-min: 20px;">
		<XFederation/>
	</div>
	<div v-else-if="tab === 'charts'" class="_spacer" style="--MI_SPACER-w: 1000px; --MI_SPACER-min: 20px;">
		<MkInstanceStats/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { claimAchievement } from '@/utility/achievements.js';
import { definePage } from '@/page.js';

const XOverview = defineAsyncComponent(() => import('@/pages/about.overview.vue'));
const XEmojis = defineAsyncComponent(() => import('@/pages/about.emojis.vue'));
const XFederation = defineAsyncComponent(() => import('@/pages/about.federation.vue'));
const MkInstanceStats = defineAsyncComponent(() => import('@/components/MkInstanceStats.vue'));

const props = withDefaults(defineProps<{
	initialTab?: string;
}>(), {
	initialTab: 'overview',
});

const tab = ref(props.initialTab);

watch(tab, () => {
	if (tab.value === 'charts') {
		claimAchievement('viewInstanceChart');
	}
});

const headerActions = computed(() => []);

const headerTabs = computed(() => [{
	key: 'overview',
	title: i18n.ts.overview,
}, {
	key: 'emojis',
	title: i18n.ts.customEmojis,
	icon: 'ti ti-icons',
}, ...(instance.federation !== 'none' ? [{
	key: 'federation',
	title: i18n.ts.federation,
	icon: 'ti ti-world',
}] : []), {
	key: 'charts',
	title: i18n.ts.charts,
	icon: 'ti ti-chart-line',
}]);

definePage(() => ({
	title: i18n.ts.instanceInfo,
	icon: 'ti ti-info-circle',
}));
</script>

<style lang="scss" module>
/* 旗鯖fork: ピル型タブ (中央上部配置、Hataskey UI 統一デザイン) */
.htkPillTabs {
	position: sticky;
	top: 0;
	z-index: 50;
	display: flex;
	justify-content: center;
	padding: 12px 16px;
	background: var(--MI-page-controls-background, color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent));
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	margin-bottom: 8px;
}

.htkPillTabsInner {
	display: inline-flex;
	gap: 4px;
	padding: 4px;
	background: var(--MI-page-tabs-background, var(--MI_THEME-panel));
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	max-width: 100%;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: none;

	&::-webkit-scrollbar {
		display: none;
	}
}

.htkPillTab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	background: transparent;
	color: var(--MI_THEME-fg);
	font-size: 0.9em;
	font-weight: 500;
	border-radius: 999px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}

	&.htkPillTabActive {
		background: var(--MI_THEME-accent);
		color: var(--MI_THEME-fgOnAccent);
	}

	i {
		font-size: 1em;
		line-height: 1;
	}
}
</style>
