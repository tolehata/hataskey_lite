<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 旗鯖fork: CTL 投稿フォームのダイアログ（MkPostFormDialog と同じ枠）。閉じても下書きは残る。 -->

<template>
<MkModal ref="modal" :preferType="'dialog'" @click="close()" @closed="emit('closed')" @esc="close()">
	<div :class="$style.shell">
		<ConcrntPostForm :class="$style.form" modal @posted="onPosted" @cancel="close()"/>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import ConcrntPostForm from '@/components/concrnt/ConcrntPostForm.vue';

const emit = defineEmits<{ closed: []; posted: [] }>();
const modal = useTemplateRef('modal');

function onPosted(): void {
	emit('posted');
	modal.value?.close({ useSendAnimation: true });
}

function close(): void { modal.value?.close(); }
</script>

<style lang="scss" module>
.shell {
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 640px;
	max-height: calc(100% - env(safe-area-inset-bottom));
	min-height: 0;
	margin: 0 auto auto;
}

.form {
	flex: 1 1 auto;
	min-height: 0;
	margin: 0;
	overflow: auto;

	&::-webkit-scrollbar { display: none; }
}
</style>
