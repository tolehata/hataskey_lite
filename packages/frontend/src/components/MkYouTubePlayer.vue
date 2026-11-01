<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkWindow :initialWidth="640" :initialHeight="402" :canResize="true" :closeButton="true">
	<template #header>
		<i class="icon ti ti-brand-youtube" style="margin-right: 0.5em;"></i>
		<span>{{ title ?? 'YouTube' }}</span>
	</template>

	<!-- 旗鯖fork: 本家 2026.6.0 から取り込み: プレイヤー読み込み中の "Invalid URL" 表示を抑制 (#17481) -->
	<div class="poamfof">
		<MkLoading v-if="fetching"/>
		<Transition v-else :name="prefer.s.animation ? 'fade' : ''" mode="out-in">
			<div v-if="player.url && (player.url.startsWith('http://') || player.url.startsWith('https://'))" class="player">
				<iframe :src="transformPlayerUrl(player.url)" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
			</div>
			<MkError v-else @retry="ytFetch()"/>
		</Transition>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { versatileLang } from '@@/js/intl-const.js';
import MkWindow from '@/components/MkWindow.vue';
import { transformPlayerUrl } from '@/utility/url-preview.js';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	url: string;
}>();

const requestUrl = new URL(props.url);
if (!['http:', 'https:'].includes(requestUrl.protocol)) throw new Error('invalid url');

const fetching = ref(true);
const title = ref<string | null>(null);
const player = ref({
	url: null as string | null,
	width: null,
	height: null,
});

const ytFetch = (): void => {
	fetching.value = true;
	window.fetch(`/url?url=${encodeURIComponent(requestUrl.href)}&lang=${versatileLang}`).then(res => {
		res.json().then(info => {
			if (info.url == null) return;
			title.value = info.title;
			fetching.value = false;
			player.value = info.player;
		});
	});
};

ytFetch();

</script>

<style lang="scss" scoped>
.poamfof {
	position: relative;
	overflow: hidden;
	height: 100%;

	.player {
		position: absolute;
		inset: 0;

		iframe {
			width: 100%;
			height: 100%;
		}
	}
}
</style>
