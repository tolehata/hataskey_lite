<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :data-motion-enabled="motionEnabled ? 'true' : 'false'" data-settings-surface="hatafeed" aria-label="HataFeed の設定">
	<HataFeedDisplaySettings embedded/>
</section>
</template>
<script setup lang="ts">
import HataFeedDisplaySettings from '@/components/HataFeedDisplaySettings.vue';
withDefaults(defineProps<{ motionEnabled?: boolean }>(), { motionEnabled: true });
</script>
