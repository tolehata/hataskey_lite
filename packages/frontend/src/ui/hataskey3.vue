<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<Hk3App :pageMetadata="pageMetadata"/>
	<XCommon/>
</div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { instanceName } from '@@/js/config.js';
import XCommon from './_common_/common.vue';
import type { PageMetadata } from '@/page.js';
import Hk3App from '@/components/hataskey3/Hk3App.vue';
import { provideMetadataReceiver, provideReactiveMetadata } from '@/page.js';
import { mainRouter } from '@/router.js';
import { DI } from '@/di.js';
import { attachIOSViewportRecovery } from '@/utility/ios-viewport-recovery.js';
import { hataskeyUiSDisplaySize } from '@/utility/hatasaba-device-prefs.js';

const pageMetadata = ref<PageMetadata | null>(null);

function restoreHomeMetadata() {
	pageMetadata.value = { title: instanceName, icon: 'ti ti-home' };
	window.document.title = instanceName;
}

watch(() => mainRouter.currentRoute.value.path, path => {
	if (path === '/') restoreHomeMetadata();
}, { immediate: true, flush: 'post' });

provide(DI.router, mainRouter);
provideMetadataReceiver((metadataGetter) => {
	if (mainRouter.currentRoute.value.path === '/') {
		restoreHomeMetadata();
		return;
	}
	pageMetadata.value = metadataGetter();
	if (pageMetadata.value) {
		window.document.title = `${pageMetadata.value.title} | ${instanceName}`;
	}
});
provideReactiveMetadata(pageMetadata);

// Hataskey UI 2 のグラス表示は <html> のクラスで全体のノート・パネルを差し替えるため、
// UI3 の表示中は外しておく(ほかの処理が付け直しても、UI3 の間はすぐ外す)。
const GLASS_CLASS = 'hataGlassUi';
let glassObserver: MutationObserver | null = null;
let stopViewportRecovery: (() => void) | undefined;
let stopDisplaySizeWatch: (() => void) | undefined;

function removeGlassClass() {
	if (window.document.documentElement.classList.contains(GLASS_CLASS)) window.document.documentElement.classList.remove(GLASS_CLASS);
}

onMounted(() => {
	stopViewportRecovery = attachIOSViewportRecovery(mainRouter);
	removeGlassClass();
	window.document.documentElement.dataset.hk3Ui = 'true';
	stopDisplaySizeWatch = watch(hataskeyUiSDisplaySize, size => {
		window.document.documentElement.dataset.hk3Size = size;
	}, { immediate: true, flush: 'sync' });
	glassObserver = new MutationObserver(removeGlassClass);
	glassObserver.observe(window.document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
onBeforeUnmount(() => {
	stopViewportRecovery?.();
	glassObserver?.disconnect();
	stopDisplaySizeWatch?.();
	delete window.document.documentElement.dataset.hk3Ui;
	delete window.document.documentElement.dataset.hk3Size;
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	width: 100%;
	height: var(--MI-viewport-height, 100dvh);
	min-width: 0;
	min-height: 0;
	overflow: hidden;
}
</style>

<style lang="scss">
html[data-hk3-ui] {
	--hk3-ui-scale: 1;
}

html[data-hk3-ui][data-hk3-size='small'] {
	--hk3-ui-scale: .9;
	font-size: calc(14px * .9);
}

@for $size from 1 through 19 {
	html.f-#{$size}[data-hk3-ui][data-hk3-size='small'] {
		font-size: calc(#{6 + $size}px * .9);
	}
}

@media (pointer: coarse) {
	html[data-hk3-ui][data-hk3-size='small'] :is(
		input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']):not([type='reset']):not([type='range']):not([type='color']):not([readonly]):not([disabled]),
		textarea:not([readonly]):not([disabled]),
		select:not([disabled])
	) {
		font-size: max(16px, 1em);
	}
}

/* 共通の読み込み表示(右上の回転アイコン)は UI3 の右上の操作と重なるため、UI3 では上端の細い帯(Hk3App)に置き換える。 */
html[data-hk3-ui] #wait {
	display: none;
}
</style>
