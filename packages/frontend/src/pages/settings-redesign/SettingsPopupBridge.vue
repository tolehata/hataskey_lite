<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- `display: contents` deliberately keeps MkWindow/MkModalWindow's layout unchanged. -->
<div :class="$style.scope" :data-motion-enabled="isMotionEnabled ? 'true' : 'false'">
	<MkHatasabaUi2EditWindow v-if="popup === 'hatasaba-ui2'" :embedded="embedded === true" @closed="emit('closed')"/>
	<MkEarthquakeSettings v-else-if="popup === 'earthquake'" :embedded="embedded === true" @closed="emit('closed')"/>
	<MkUISetup v-else-if="popup === 'ui-setup'" :embedded="embedded === true" @closed="emit('closed')"/>
	<MkHataSettingsTransfer v-else-if="popup === 'settings-transfer'" :embedded="embedded === true" @closed="emit('closed')"/>
	<HataskSettings v-else-if="popup === 'hatask'" :embedded="embedded === true" @closed="emit('closed')"/>
	<HatadyDisplaySettings v-else-if="popup === 'hatady'" :embedded="embedded === true" @closed="emit('closed')"/>
	<MkMascotSettings v-else :embedded="embedded === true" @closed="emit('closed')"/>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref } from 'vue';
import type { SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import MkEarthquakeSettings from '@/components/MkEarthquakeSettings.vue';
import HatadyDisplaySettings from '@/components/HatadyDisplaySettings.vue';
import MkHataSettingsTransfer from '@/components/MkHataSettingsTransfer.vue';
import MkHatasabaUi2EditWindow from '@/components/MkHatasabaUi2EditWindow.vue';
import MkUISetup from '@/components/MkUISetup.vue';
import HataskSettings from '@/pages/HataskSettings.vue';
import MkMascotSettings from '@/pages/MkMascotSettings.vue';
import {
	settingsSearchV2ContextKey,
} from '@/utility/settings-search-v2-context.js';

const props = defineProps<{
	popup: 'hatasaba-ui2' | 'earthquake' | 'ui-setup' | 'settings-transfer' | 'hatask' | 'hatady' | 'mascot';
	/** 旗鯖fork: true なら窓を出さず、設定画面の右ペインの中身として描く。 */
	embedded?: boolean;
	settingsContext: SettingsSearchV2Context;
	/** Lets the opener freeze motion immediately while the context stays reactive. */
	motionEnabled?: boolean;
}>();

const emit = defineEmits<{
	closed: [];
}>();

// `os.popup` mounts outside the settings shell. Re-provide the same context so
// the existing form controls retain their related-settings skin in the popup.
provide(settingsSearchV2ContextKey, props.settingsContext);

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = ref(reducedMotionQuery.matches);
const isMotionEnabled = computed(() => (
	props.motionEnabled !== false
	&& props.settingsContext.motionEnabled?.value !== false
	&& !prefersReducedMotion.value
));

function syncReducedMotion(event: MediaQueryListEvent) {
	prefersReducedMotion.value = event.matches;
}

reducedMotionQuery.addEventListener('change', syncReducedMotion);
onBeforeUnmount(() => reducedMotionQuery.removeEventListener('change', syncReducedMotion));
</script>

<style lang="scss" module>
.scope {
	display: contents;
}

.scope[data-motion-enabled='false'] {
	:deep(*) {
		animation: none !important;
		scroll-behavior: auto !important;
		transition: none !important;
	}
}

@media (prefers-reduced-motion: reduce) {
	.scope :deep(*) {
		animation: none !important;
		scroll-behavior: auto !important;
		transition: none !important;
	}
}
</style>
