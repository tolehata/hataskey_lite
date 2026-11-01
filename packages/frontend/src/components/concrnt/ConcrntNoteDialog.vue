<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 旗鯖fork: CTL の投稿詳細。返信先があればその上に並べる（別タブには開かない）。 -->

<template>
<MkModal ref="modal" :preferType="'dialog'" @click="close()" @closed="emit('closed')" @esc="close()">
	<div :class="['_popup', $style.root]" role="dialog" aria-label="コンカレントの投稿" @click.stop>
		<header :class="$style.header">
			<i class="concrnt-icon" aria-hidden="true"></i><span>投稿</span>
			<button class="_button" :class="$style.close" aria-label="閉じる" @click="close()"><i class="ti ti-x"></i></button>
		</header>
		<div :class="$style.body">
			<MkLoading v-if="loading"/>
			<p v-else-if="failed" :class="$style.state" role="alert">投稿を取得できませんでした。削除されたか、閲覧できない投稿です。</p>
			<template v-else-if="message">
				<div v-if="parent" :class="$style.parent">
					<ConcrntNote :message="parent" :visualMode="'hataskey-deck'" @update="parent = $event"/>
				</div>
				<ConcrntNote :message="message" :visualMode="'hataskey-deck'" @update="message = $event"/>
			</template>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef } from 'vue';
import type { ConcrntMessage } from '@/utility/concrnt/types.js';
import MkModal from '@/components/MkModal.vue';
import ConcrntNote from '@/components/concrnt/ConcrntNote.vue';
import { fetchConcrntMessage } from '@/utility/concrnt/message-cache.js';

const props = defineProps<{ uri: string }>();
const emit = defineEmits<{ closed: [] }>();
const modal = useTemplateRef('modal');
const message = ref<ConcrntMessage | null>(null);
const parent = ref<ConcrntMessage | null>(null);
const loading = ref(true);
const failed = ref(false);

function close(): void { modal.value?.close(); }

onMounted(async () => {
	try {
		message.value = await fetchConcrntMessage(props.uri, true);
		if (message.value.kind === 'reply' && message.value.targetUri) parent.value = await fetchConcrntMessage(message.value.targetUri).catch(() => null);
	} catch {
		failed.value = true;
	} finally {
		loading.value = false;
	}
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	width: min(640px, calc(100vw - 24px));
	max-height: calc(100dvh - 48px);
	margin: auto;
	overflow: hidden;
	border-radius: 16px;
}

.header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 10px 10px 18px;
	border-bottom: 1px solid var(--MI_THEME-divider);
	font-weight: bold;
}

.close {
	margin-left: auto;
	width: 40px;
	height: 40px;
	border-radius: 50%;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
}

.body {
	overflow-y: auto;
	overscroll-behavior: contain;
	container-type: inline-size;
}

.parent {
	border-bottom: 1px dashed var(--MI_THEME-divider);
	opacity: .9;
}

.state {
	padding: 32px 20px;
	text-align: center;
	opacity: .7;
}
</style>
