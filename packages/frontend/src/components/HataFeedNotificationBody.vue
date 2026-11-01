<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: HataFeed 通知本文を安全なプレーンテキストとカスタム絵文字へ分割して表示する。
通知には note.emojis のような URL 対応表が無いため、承認直後などローカル絵文字キャッシュが
更新される前でも /emoji/:name.webp を直接使い、ショートコードへ退行しないようにする。
-->
<template>
<span :class="$style.root" :data-punctuation-wrap="punctuationWrap">
	<template v-for="(segment, index) in segments" :key="index">
		<MkCustomEmoji
			v-if="segment.type === 'emoji'"
			:name="segment.name"
			:host="segment.host"
			:url="segment.url"
			:normal="true"
			:fallbackToImage="false"
		/>
		<MkNotificationText v-else :text="segment.text" :wrap="punctuationWrap"/>
	</template>
</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkCustomEmoji from '@/components/global/MkCustomEmoji.vue';
import { splitHataFeedNotificationBody } from '@/utility/hatafeed-notification-emoji.js';
import MkNotificationText from '@/components/MkNotificationText.js';

const props = defineProps<{ text: string; punctuationWrap?: boolean }>();

const segments = computed(() => splitHataFeedNotificationBody(props.text));
</script>

<style lang="scss" module>
.root {
	white-space: pre-wrap;
	word-break: break-word;
	&[data-punctuation-wrap='true'] { word-break: keep-all; overflow-wrap: anywhere; line-break: strict; }
}
</style>
