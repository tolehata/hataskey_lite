<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkWindow ref="dialog" class="hatady-scope hatafeed-scope" data-hatafeed-window :data-hatady-theme="hataFeedTheme" :initialWidth="820" :initialHeight="null" autoHeight canResize centerTitle :beforeClose="() => !busy" @closed="emit('closed')">
	<template #header>{{ i18n.tsx._hata._hatafeed._emojiChangeReview.header({ kind: emojiChangeLabel[request.kind] }) }}</template>
	<div :class="$style.body">
		<div :class="$style.target"><img :src="request.previousImageUrl" :alt="request.name"><strong>:{{ request.name }}:</strong></div>
		<p>{{ i18n.tsx._hata._hatafeed._emojiChangeReview.requestedBy({ name: request.requestedBy?.name ?? request.requestedBy?.username ?? "", kind: emojiChangeLabel[request.kind], status: emojiStatusLabel[request.status] }) }}</p>
		<div v-if="request.kind === 'withdraw'" :class="[$style.notice, $style.warning]"><strong>{{ copy.withdrawNoticeTitle }}</strong>{{ copy.withdrawNotice }}</div>
		<template v-else><div :class="$style.notice">{{ copy.updateNotice }}</div><div :class="$style.grid"><div :class="$style.preview"><span>{{ copy.beforeImage }}</span><HfEmojiPreviewPair :url="request.previousImageUrl" :alt="copy.beforeImageAlt"/></div><div :class="$style.preview"><span>{{ copy.afterImage }}</span><HfEmojiPreviewPair :url="request.imageUrl" :alt="copy.afterImageAlt"/></div></div></template>
		<dl :class="$style.details"><div><dt>{{ copy.reason }}</dt><dd>{{ request.reason }}</dd></div><div v-if="request.kind === 'updateImage'"><dt>{{ copy.license }}</dt><dd>{{ request.license }}</dd></div></dl>
		<template v-if="canResolve"><label :class="$style.field"><span>{{ copy.commentLabel }}</span><textarea v-model="comment" maxlength="1024" :disabled="busy"></textarea></label><label :class="$style.check"><input v-model="acknowledged" type="checkbox" :disabled="busy"><span>{{ request.kind === 'withdraw' ? copy.ackWithdraw : copy.ackUpdate }}</span></label></template>
		<div v-if="request.events.length"><h3>{{ copy.history }}</h3><div v-for="(event, index) in request.events" :key="index" :class="$style.event"><span>{{ emojiStatusLabel[event.status] }} · <MkTime :time="event.at" mode="detail"/></span><p v-if="event.comment">{{ event.comment }}</p></div></div>
		<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>
		<button v-if="error" type="button" class="hy-secondary" :disabled="busy" @click="reloadRequest">{{ copy.reloadLatest }}</button>
	</div>
	<div :class="$style.actions"><template v-if="canResolve"><button type="button" class="hy-secondary" :disabled="busy" @click="resolve('held')">{{ copy.hold }}</button><button type="button" class="hy-secondary" :disabled="busy" @click="resolve('rejected')">{{ copy.reject }}</button><button type="button" class="hy-primary" :disabled="busy || !acknowledged" @click="resolve('approved')">{{ request.kind === 'withdraw' ? copy.approveWithdraw : copy.approveUpdate }}</button></template><button v-else type="button" class="hy-secondary" @click="dialog?.close()">{{ copy.close }}</button></div>
</MkWindow>
</template>
<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import type { HataFeedEmojiChangeRequest } from '@/utility/hatafeed.js';
import { emojiChangeError, emojiChangeLabel, emojiStatusLabel } from '@/utility/hatafeed.js';
import MkWindow from '@/components/MkWindow.vue';
import HfEmojiPreviewPair from '@/components/HfEmojiPreviewPair.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import '@/components/hatafeed-ui.css';
const copy = i18n.ts._hata._hatafeed._emojiChangeReview;
const props = defineProps<{ request: HataFeedEmojiChangeRequest; isStaff?: boolean }>();
const emit = defineEmits<{ done: []; closed: [] }>();
const dialog = useTemplateRef('dialog');
const request = ref(props.request);
const comment = ref('');
const acknowledged = ref(false);
const busy = ref(false);
const error = ref('');
const canResolve = computed(() => props.isStaff && ['pending', 'held'].includes(request.value.status));

async function reloadRequest() {
	if (busy.value) return;
	busy.value = true;
	try {
		const latest = await misskeyApi('hata/feedback/emoji-change-requests', { id: request.value.id, limit: 1 }) as unknown as HataFeedEmojiChangeRequest[];
		if (!latest[0]) { error.value = copy.notFound; return; }
		request.value = latest[0]; acknowledged.value = false; error.value = '';
		emit('done');
	} catch (err) { error.value = emojiChangeError(err); } finally { busy.value = false; }
}

async function resolve(status: 'approved' | 'held' | 'rejected') {
	if (busy.value || !canResolve.value || (status === 'approved' && !acknowledged.value)) return;
	if (status !== 'approved' && !comment.value.trim()) { error.value = copy.commentRequired; return; }
	busy.value = true; error.value = '';
	try {
		const params = { requestId: request.value.id, expectedUpdatedAt: request.value.updatedAt, comment: comment.value.trim() };
		if (status === 'approved') await misskeyApi('hata/feedback/emoji-change-requests/approve', params);
		else if (status === 'held') await misskeyApi('hata/feedback/emoji-change-requests/hold', params);
		else await misskeyApi('hata/feedback/emoji-change-requests/reject', params);
		// A self-review receives the server event in this same host; do not add a second toast.
		if (request.value.requestedBy?.id !== $i?.id) hataFeedNotify(i18n.tsx._hata._hatafeed._emojiChangeReview.resolveSuccess({ name: `:${request.value.name}:`, kind: emojiChangeLabel[request.value.kind], status: status === 'approved' ? copy.approved : status === 'held' ? copy.held : copy.rejected }));
		emit('done'); busy.value = false; dialog.value?.close();
	} catch (err) { error.value = emojiChangeError(err); } finally { busy.value = false; }
}
</script>
<style module src="./hatafeed-emoji-management.module.css"></style>
