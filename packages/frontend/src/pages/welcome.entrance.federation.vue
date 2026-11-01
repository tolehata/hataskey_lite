<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<section v-if="enabled && instances.length > 0" class="federation-belt" aria-labelledby="federation-title">
	<div class="federation-head">
		<span id="federation-title">FEDERATED SERVERS</span>
	</div>
	<div class="federation-window">
		<div v-for="(row, rowIndex) in rows" :key="rowIndex" class="federation-track" :class="{ 'is-reverse': rowIndex === 1 }">
			<div v-for="copy in 2" :key="copy" class="federation-group" role="list" :aria-hidden="copy === 2 ? true : undefined" :inert="copy === 2">
				<MkA v-for="server in row" :key="server.id" class="federation-server" role="listitem" :to="`/instance-info/${server.host}`" behavior="window">
					<img class="federation-server-icon" :src="getProxiedImageUrlNullable(server.iconUrl || server.faviconUrl, 'preview') ?? fallbackIcon" width="20" height="20" alt="" loading="lazy" decoding="async" @error="onIconError"/>
					<span class="federation-server-name">{{ server.name?.trim() || server.host }}</span><span v-if="server.name?.trim()" class="federation-server-host">({{ server.host }})</span>
				</MkA>
			</div>
		</div>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkA from '@/components/global/MkA.vue';
import { instance } from '@/instance.js';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import { getProxiedImageUrlNullable } from '@/utility/media-proxy.js';

const emit = defineEmits<{
	(ev: 'resize'): void;
}>();

const instances = ref<Misskey.entities.FederationInstance[]>([]);
const fallbackIcon = '/client-assets/dummy.png';

function onIconError(event: Event): void {
	const image = event.currentTarget;
	if (image instanceof HTMLImageElement && image.getAttribute('src') !== fallbackIcon) image.src = fallbackIcon;
}

const enabled = computed(() => instance.federation === 'all');
const rows = computed(() => {
	const midpoint = Math.ceil(instances.value.length / 2);
	const first = instances.value.slice(0, midpoint);
	const second = instances.value.slice(midpoint);
	return [first, second.length > 0 ? second : first];
});

watch(enabled, async (available, _previous, onCleanup) => {
	let active = true;
	onCleanup(() => {
		active = false;
	});
	instances.value = [];

	if (available) {
		try {
			const response = await misskeyApiGet('federation/instances', {
				sort: '+pubSub',
				limit: 20,
				blocked: false,
			});
			if (active) instances.value = response;
		} catch {
			// 連合帯は補助表示。取得できなくてもログイン画面を維持する。
			if (active) instances.value = [];
		}
	}

	await nextTick();
	if (active) emit('resize');
}, { immediate: true });
</script>
