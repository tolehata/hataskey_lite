<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="items.length > 0" :class="[$style.root, { [$style.fullWidth]: fullWidth }]">
	<SettingsRelatedLinks
		:items="items"
		@select="navigate"
	/>
</div>
</template>

<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue';
import type { SettingsRelatedLink } from '@/pages/settings-redesign/SettingsRelatedLinks.vue';
import SettingsRelatedLinks from '@/pages/settings-redesign/SettingsRelatedLinks.vue';
import { getRelatedSettingsV2 } from '@/utility/settings-search-v2.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

defineOptions({
	inheritAttrs: false,
});

defineProps<{
	fullWidth?: boolean;
}>();

const attrs = useAttrs();
const settingsContext = inject(settingsSearchV2ContextKey, null);
const controlId = computed(() => {
	const value = attrs['data-settings-search-id'];
	return typeof value === 'string' && value !== '' ? value : null;
});
const items = computed<SettingsRelatedLink[]>(() => {
	if (settingsContext == null || controlId.value == null) return [];
	if (settingsContext.inlineRelated === false) return [];
	const catalog = settingsContext.catalog.value;
	if (catalog == null) return [];
	const currentItem = catalog.byStableId.get(controlId.value);

	return getRelatedSettingsV2(catalog, controlId.value, Number.MAX_SAFE_INTEGER).map(item => ({
		stableId: item.stableId,
		route: item.route,
		anchor: item.anchor,
		controlId: item.controlId,
		...(item.activation ? { activation: item.activation } : {}),
		label: item.label,
		reason: currentItem?.related.find(related => related.stableId === item.stableId)?.reason,
		destructive: item.destructive === true,
	}));
});

function navigate(item: SettingsRelatedLink): void {
	settingsContext?.navigateToSetting({
		stableId: item.stableId,
		route: item.route,
		anchor: item.anchor,
		controlId: item.controlId,
		...(item.activation ? { activation: item.activation } : {}),
	});
}
</script>

<style lang="scss" module>
.root.fullWidth {
	order: 3;
	flex-basis: 100%;
	width: 100%;
	min-width: 0;
}
</style>
