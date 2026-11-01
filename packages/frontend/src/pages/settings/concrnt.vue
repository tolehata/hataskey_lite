<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<SearchMarker path="/settings/concrnt" label="コンカレント連携(BETA)" :keywords="['concrnt', 'concurrent', 'コンカレント', '外部連携']" icon="concrnt-icon">
	<ConcrntSettings/>
</SearchMarker>
</template>

<script setup lang="ts">
import ConcrntSettings from '@/components/concrnt/ConcrntSettings.vue';
import { definePage } from '@/page.js';

definePage({ title: 'コンカレント連携(BETA)', icon: 'concrnt-icon' });
</script>
