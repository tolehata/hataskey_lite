<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="instance">
	<XSetup v-if="instance.requireSetup"/>
	<XEntranceHataskey v-else/>
</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import * as Misskey from 'cherrypick-js';
import { instanceName } from '@@/js/config.js';
import XSetup from './welcome.setup.vue';
import XEntranceHataskey from './welcome.entrance.hataskey.vue';
import { definePage } from '@/page.js';
import { fetchInstance, instance as cachedInstance } from '@/instance.js';

// HTML に埋め込まれた meta が使えるなら初画面から表示し、
// ネットワークからの更新は後から反映する。
const instance = ref<Misskey.entities.MetaDetailed | null>(
	cachedInstance.clientOptions != null && cachedInstance.policies != null ? cachedInstance : null,
);

fetchInstance(true).then((res) => {
	instance.value = res;
	// 初回アクセスで meta がまだ応答できない場合も、
	// 未処理の Promise 拒否をページ全体のエラーにしない。
}).catch(() => {
	// 埋め込み済みの meta があればそれを使い続ける。
	instance.value = cachedInstance.clientOptions != null && cachedInstance.policies != null ? cachedInstance : null;
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: instanceName,
	icon: null,
}));
</script>
