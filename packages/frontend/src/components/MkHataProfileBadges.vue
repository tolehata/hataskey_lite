<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="badges.length > 0" :class="[$style.root, { [$style.compact]: compact }]" role="list" :aria-label="i18n.ts._hata._profileBadges.ariaLabel">
	<div
		v-for="badge in badges"
		:key="badge.key"
		:class="$style.badge"
		:data-kind="badge.key"
		:title="badge.description"
		role="listitem"
	>
		<i :class="[badge.icon, $style.icon]" aria-hidden="true"></i>
		<span :class="$style.label">{{ badge.label }}</span>
		<strong :class="$style.count">{{ badge.count }}</strong>
		<span :class="$style.unit">{{ badge.unit }}</span>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { getHataProfileBadges } from '@/utility/hata-profile-badges.js';

const props = withDefaults(defineProps<{
	user: Misskey.entities.UserDetailed;
	compact?: boolean;
}>(), {
	compact: false,
});

const badges = computed(() => getHataProfileBadges(props.user, $i?.id ?? null));
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	gap: 8px;
	width: 100%;
}

.badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	min-width: 118px;
	padding: 6px 10px;
	box-sizing: border-box;
	color: var(--MI_THEME-fg);
	background: linear-gradient(135deg, color-mix(in srgb, var(--badgeColor) 18%, var(--MI_THEME-panel)), color-mix(in srgb, var(--badgeColor) 7%, var(--MI_THEME-panel)));
	border: 1px solid color-mix(in srgb, var(--badgeColor) 48%, transparent);
	border-radius: 999px;
	box-shadow: 0 2px 8px color-mix(in srgb, var(--badgeColor) 12%, transparent);
	font-size: 0.78em;
	font-weight: 650;
}

.badge[data-kind="utageSuccess"] { --badgeColor: var(--MI_THEME-accent); }
.badge[data-kind="utageInterruption"] { --badgeColor: var(--MI_THEME-warn); }
.badge[data-kind="hataskFlower"] { --badgeColor: #e573a5; }

.icon,
.count {
	color: var(--badgeColor);
}

.icon { font-size: 1.05em; }
.label { opacity: 0.88; }
.count {
	font-size: 1.05em;
	font-variant-numeric: tabular-nums;
}
.unit {
	font-size: 0.85em;
	opacity: 0.68;
}

.compact {
	gap: 5px;

	.badge {
		min-width: 0;
		padding: 5px 8px;
		font-size: 0.7em;
	}
}
</style>
