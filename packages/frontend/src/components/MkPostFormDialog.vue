<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	:preferType="'dialog'"
	@click="onBgClick()"
	@closed="onModalClosed()"
	@esc="onEsc"
>
	<div :class="$style.shell">
		<MkPostForm
			ref="form"
			:class="$style.form"
			v-bind="props"
			:postDelayStatusTarget="postDelayStatusTarget"
			autofocus
			freezeAfterPosted
			@posted="onPosted"
			@cancel="_close()"
			@esc="_close()"
		/>
		<div ref="postDelayStatusTarget" :class="$style.postDelayStatusTarget"></div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import type { PostFormProps } from '@/types/post-form.js';
import MkModal from '@/components/MkModal.vue';
import MkPostForm from '@/components/MkPostForm.vue';

const props = withDefaults(defineProps<PostFormProps & {
	instant?: boolean;
	fixed?: boolean;
	autofocus?: boolean;
	updateMode?: boolean;
}>(), {
	initialLocalOnly: undefined,
	restoreDraft: true,
});

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'posted'): void;
}>();

const modal = useTemplateRef('modal');
const form = useTemplateRef('form');
const postDelayStatusTarget = useTemplateRef<HTMLDivElement>('postDelayStatusTarget');

function onPosted() {
	emit('posted');
	modal.value?.close({
		useSendAnimation: true,
	});
}

async function _close() {
	const canClose = await form.value?.canClose();
	if (!canClose) return;
	form.value?.abortUploader();
	modal.value?.close();
}

function onEsc() {
	_close();
}

function onBgClick() {
	_close();
}

function onModalClosed() {
	emit('closed');
}
</script>

<style lang="scss" module>
.shell {
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 640px;
	max-height: calc(100% - env(safe-area-inset-bottom));
	min-height: 0;
	margin: 0 auto auto auto;
}

.form {
	flex: 1 1 auto;
	min-height: 0;
	margin: 0;
	overflow: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.postDelayStatusTarget:not(:empty) {
	display: flex;
	flex: none;
	justify-content: center;
	padding-top: 8px;
}
</style>
