<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" v-slot="{ type }" :preferType="deviceKind === 'smartphone' ? 'drawer' : 'dialog'" @click="onBgClick" @closed="emit('closed')" @esc="emit('esc')">
	<div ref="rootEl" :data-mobile-fullscreen="fullScreenOnMobile" :data-hatask-theme="panelTheme" :data-hatask-mode="panelMode" :class="[$style.root, panelClass, type === 'drawer' ? $style.asDrawer : null]" :style="{ width: type === 'drawer' ? '' : `${width}px`, height: type === 'drawer' ? '' : `min(${height}px, 100%)` }">
		<div :class="$style.header">
			<button v-if="withCloseButton" :class="$style.headerButton" class="_button" data-testid="modal-window-close" :aria-label="i18n.ts.close" @click="emit('close')"><i class="ti ti-x" aria-hidden="true"></i></button>
			<span :class="$style.title">
				<slot name="header"></slot>
			</span>
			<div v-if="withOkButton" style="padding: 0 16px; place-content: center;">
				<MkButton primary gradate small rounded :disabled="okButtonDisabled" @click="emit('ok')">{{ i18n.ts.done }} <i class="ti ti-check"></i></MkButton>
			</div>
		</div>
		<div :class="$style.body">
			<slot></slot>
		</div>
		<div v-if="$slots.footer" :class="$style.footer">
			<slot name="footer"></slot>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, ref } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';
import { deviceKind } from '@/utility/device-kind.js';

const props = withDefaults(defineProps<{
	withOkButton?: boolean;
	withCloseButton?: boolean;
	fullScreenOnMobile?: boolean;
	okButtonDisabled?: boolean;
	panelClass?: string;
	panelTheme?: string;
	panelMode?: string;
	width?: number;
	height?: number;
}>(), {
	withOkButton: false,
	withCloseButton: true,
	fullScreenOnMobile: false,
	okButtonDisabled: false,
	panelClass: '',
	width: 400,
	height: 500,
});

const emit = defineEmits<{
	(event: 'click'): void;
	(event: 'close'): void;
	(event: 'closed'): void;
	(event: 'ok'): void;
	(event: 'esc'): void;
}>();

const modal = useTemplateRef('modal');

function close() {
	modal.value?.close();
}

function onBgClick() {
	emit('click');
}

defineExpose({
	close,
});
</script>

<style lang="scss" module>
.root {
	box-sizing: border-box;
	min-height: 0;
	margin: auto;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	contain: content;
	border-radius: var(--MI-radius);

	--root-margin: 24px;

	--MI_THEME-headerHeight: 46px;
	--MI_THEME-headerHeightNarrow: 42px;

	@media (max-width: 500px) {
		--root-margin: 16px;
	}

	&.asDrawer {
		height: calc(100dvh - 30px);
		border-radius: 0;

		.body {
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}

		.footer {
			padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
		}
	}
}

@media (max-width: 700px) {
	.root[data-mobile-fullscreen='true'] {
		position: fixed; inset: 0; margin: 0;
		width: 100dvw !important; height: 100dvh !important;
		max-width: none; max-height: none; border-radius: 0;
		padding-top: env(safe-area-inset-top);
		background: var(--MI_THEME-panel);
		.body { padding-bottom: env(safe-area-inset-bottom); }
	}
}

.header {
	display: flex;
	flex-shrink: 0;
	background: var(--MI_THEME-windowHeader);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}

.headerButton {
	height: var(--MI_THEME-headerHeight);
	width: var(--MI_THEME-headerHeight);

	@media (max-width: 500px) {
		height: var(--MI_THEME-headerHeightNarrow);
		width: var(--MI_THEME-headerHeightNarrow);
	}
}

.title {
	flex: 1;
	line-height: var(--MI_THEME-headerHeight);
	padding-left: 32px;
	font-weight: bold;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	pointer-events: none;

	@media (max-width: 500px) {
		line-height: var(--MI_THEME-headerHeightNarrow);
		padding-left: 16px;
	}
}

.headerButton + .title {
	padding-left: 0;
}

.body {
	flex: 1;
	min-height: 0;
	overflow: auto;
	background: var(--MI_THEME-bg);
	container-type: size;
}

.footer {
	padding: 12px 16px;
	overflow: auto;
	background: var(--MI_THEME-bg);
	border-top: 1px solid var(--MI_THEME-divider);
}
</style>
