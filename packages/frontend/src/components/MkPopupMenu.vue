<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" v-slot="{ type, maxHeight }" :manualShowing="manualShowing" :zPriority="'high'" :anchorElement="anchorElement" :transparentBg="true" :returnFocusTo="returnFocusTo" :motionPreset="appearance && reducedMotion && !goesMotion ? 'none' : motionPreset" :forceMotion="goesMotion" @click="click" @close="onModalClose" @closed="onModalClosed">
	<MkMenu :items="items" :align="align" :width="width" :max-height="maxHeight" :asDrawer="type === 'drawer'" :returnFocusTo="returnFocusTo" :appearance="appearance" :forceMotion="goesMotion" :style="appearanceStyle" :class="{ [$style.drawer]: type === 'drawer' }" @close="onMenuClose" @hide="hide"/>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, inject, ref, useTemplateRef } from 'vue';
import type { CSSProperties } from 'vue';
import MkModal from './MkModal.vue';
import MkMenu from './MkMenu.vue';
import type { MenuItem } from '@/types/menu.js';
import { useHk3ComposerMenuReducedMotion } from '@/components/hataskey3/hk3-composer-menu.js';
import type { Hk3ComposerMenuAppearance } from '@/components/hataskey3/hk3-composer-menu.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const props = defineProps<{
	items: MenuItem[];
	align?: 'center' | string;
	width?: number;
	anchorElement?: HTMLElement | null;
	returnFocusTo?: HTMLElement | null;
	motionPreset?: 'postform';
	appearance?: Hk3ComposerMenuAppearance;
	appearanceStyle?: CSSProperties;
	forceMotion?: boolean;
}>();

const reducedMotion = useHk3ComposerMenuReducedMotion();
const hataGoesHost = inject(HATA_GOES_HOST, null);
const goesMotion = computed(() => props.forceMotion === true || hataGoesHost != null);

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'closing'): void;
}>();

const modal = useTemplateRef('modal');
const manualShowing = ref(true);
const hiding = ref(false);

function click() {
	close();
}

function onModalClose() {
	emit('closing');
}

function onMenuClose() {
	close();
	if (hiding.value) {
		// hidingであればclosedを発火
		emit('closed');
	}
}

function onModalClosed() {
	if (!hiding.value) {
		// hidingでなければclosedを発火
		emit('closed');
	}
}

function hide() {
	manualShowing.value = false;
	hiding.value = true;

	// closeは呼ぶ必要がある
	modal.value?.close();
}

function close() {
	manualShowing.value = false;

	// closeは呼ぶ必要がある
	modal.value?.close();
}
</script>

<style lang="scss" module>
.drawer {
	border-radius: 24px;
	border-bottom-right-radius: 0;
	border-bottom-left-radius: 0;
}
</style>
