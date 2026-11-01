<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<PageWithHeader><ConcrntTimeline ref="concrntTimeline" :active="pageActive" hataskeyUi/></PageWithHeader>
</template>
<script lang="ts" setup>
import { inject, onActivated, onDeactivated, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import ConcrntTimeline from '@/components/concrnt/ConcrntTimeline.vue';
import { definePage } from '@/page.js';
import { mainRouter, useRouter } from '@/router.js';
import * as os from '@/os.js';
import { concrntPagePostContextKey, interceptConcrntPostRequest } from '@/utility/concrnt/post-interceptor.js';
const props = defineProps<{ initialTab?: string }>();
const concrntTimeline = useTemplateRef('concrntTimeline');
const pageActive = ref(true);
const pagePostContext = inject(concrntPagePostContextKey, () => false);
const pageRouter = useRouter();

function interceptConcrntPostForm(request: Parameters<typeof os.post>[0]): boolean {
	if (!pagePostContext() || pageRouter !== mainRouter || pageRouter.currentRoute.value.name !== 'concrnt'
		|| !pageActive.value || !concrntTimeline.value) return false;
	return interceptConcrntPostRequest(request ?? {}, () => concrntTimeline.value?.focusComposer());
}

let releaseConcrntPostInterceptor: (() => void) | undefined;
onMounted(() => {
	// 旗鯖fork: 通知は旗鯖の通知ページ（コンカレントのタブ）へ移した。古いリンクもそちらへ送る。
	if (props.initialTab === 'notifications') { pageRouter.replaceByPath('/my/notifications?tab=concrnt'); return; }
	releaseConcrntPostInterceptor = os.registerPostFormInterceptor(interceptConcrntPostForm);
});
onUnmounted(() => { releaseConcrntPostInterceptor?.(); });
onActivated(() => { pageActive.value = true; });
onDeactivated(() => { pageActive.value = false; });
definePage(() => ({ title: 'CTL', icon: 'concrnt-icon' }));
</script>
