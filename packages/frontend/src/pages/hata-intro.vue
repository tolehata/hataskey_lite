<!--
SPDX-FileCopyrightText: tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader hideHeader>
	<HataIntro :darkMode="store.r.darkMode.value" :animation="prefer.r.animation.value" @exit="exitIntro"/>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
import HataIntro from '@/components/hata-intro/HataIntro.vue';
import { DI } from '@/di.js';
import { mainRouter, useRouter } from '@/router.js';
import { definePage } from '@/page.js';
import { store } from '@/store.js';
import { prefer } from '@/preferences.js';

const router = useRouter();
const closePageWindow = inject(DI.pageWindowClose, null);

function exitIntro() {
	if (closePageWindow) {
		closePageWindow();
	} else if (router === mainRouter && window.history.length > 1) {
		window.history.back();
	} else {
		router.push('/');
	}
}

definePage({ title: 'HataIntro', icon: 'ti ti-book', needWideArea: true });
</script>
