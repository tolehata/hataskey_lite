<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span class="connection-server" :data-centered="centered">
	<img v-if="server.iconUrl && failedIcon !== server.iconUrl" :key="server.iconUrl" :src="server.iconUrl" class="connection-server-icon" width="32" height="32" alt="" referrerpolicy="no-referrer" @error="onIconError"/>
	<span v-else class="connection-server-icon" aria-hidden="true"><i :class="fallbackIcon"></i></span>
	<span class="connection-server-text">
		<strong class="connection-server-name">{{ server.name }}</strong>
		<span v-if="server.name !== server.domain" class="connection-server-domain">{{ server.domain }}</span>
	</span>
</span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ConcrntServerInfo } from '@/utility/concrnt/server-info.js';

// Also used by the external account settings, whose fallback is a generic server icon.
const props = withDefaults(defineProps<{ server: ConcrntServerInfo; centered?: boolean; fallbackIcon?: string }>(), { fallbackIcon: 'concrnt-icon' });
const failedIcon = ref<string | null>(null);
watch(() => [props.server.domain, props.server.iconUrl], () => { failedIcon.value = null; }, { flush: 'sync' });

function onIconError(event: Event) {
	failedIcon.value = (event.currentTarget as HTMLImageElement).getAttribute('src');
}
</script>
