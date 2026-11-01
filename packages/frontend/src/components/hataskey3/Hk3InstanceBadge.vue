<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.root" :title="label" role="img" :aria-label="label">
	<img v-if="faviconUrl && !iconFailed" :key="faviconUrl" ref="iconEl" :class="$style.icon" :src="faviconUrl" alt="" @error="onIconError"/>
	<Server v-else :class="$style.icon" :size="14" aria-hidden="true"/>
	<span :class="$style.name" aria-hidden="true">{{ instanceName }}</span>
</span>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Server } from '@lucide/vue';
import { getProxiedImageUrlNullable } from '@/utility/media-proxy.js';

const props = defineProps<{
	host: string;
	instance?: {
		name?: string | null;
		faviconUrl?: string | null;
		themeColor?: string | null;
	};
}>();

const instanceName = computed(() => props.instance?.name?.trim() ? props.instance.name : props.host);
const label = computed(() => `${instanceName.value} (${props.host})`);
const faviconUrl = computed(() => getProxiedImageUrlNullable(props.instance?.faviconUrl ?? null));
const iconFailed = ref(false);
const iconEl = ref<HTMLImageElement | null>(null);

watch(faviconUrl, () => { iconFailed.value = false; }, { flush: 'sync' });

function onIconError(event: Event): void {
	// A keyed image and identity/source checks isolate late errors from an old URL.
	const image = event.target as HTMLImageElement | null;
	if (image === iconEl.value && image?.getAttribute('src') === faviconUrl.value) {
		iconFailed.value = true;
	}
}
</script>

<style module>
.root {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-width: 0;
	max-width: 100%;
	box-sizing: border-box;
	padding: 2px 5px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 0;
	background: var(--hk3-surface, var(--MI_THEME-panel));
	color: var(--hk3-text, var(--MI_THEME-fg));
	font-size: 11px;
	line-height: 1.3;
	vertical-align: middle;
}

.icon {
	width: 14px;
	height: 14px;
	flex: 0 0 14px;
	object-fit: contain;
}

.name {
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
</style>
