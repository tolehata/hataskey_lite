<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkWindow ref="dialog" class="hatady-scope hatafeed-scope" data-hatafeed-window :data-hatady-theme="hataFeedTheme" :initialWidth="820" :initialHeight="null" autoHeight canResize centerTitle :beforeClose="beforeClose" @closed="emit('closed')">
	<template #header>{{ completed ? copy.accepted : kind === 'cancel' ? copy.cancelHeader : step === 2 ? copy.confirmHeader : i18n.tsx._hata._hatafeed._emojiChangeWizard.applyHeader({ kind: kindLabel }) }}</template>
	<div :class="$style.body">
		<template v-if="completed"><i class="ti ti-circle-check" :class="$style.success" aria-hidden="true"></i><h3>{{ kind === 'cancel' ? copy.cancelled : i18n.tsx._hata._hatafeed._emojiChangeWizard.submitted({ kind: kindLabel }) }}</h3><p>{{ copy.historyHint }}</p><p :class="$style.notice">{{ copy.quotaUnchanged }}<template v-if="kind !== 'cancel'"><br>{{ copy.currentEmojiContinues }}</template></p></template>
		<template v-else>
			<div v-if="kind !== 'cancel'" :class="$style.steps"><span :aria-current="step === 1 ? 'step' : undefined">{{ copy.stepsApply }}</span><span aria-hidden="true">—</span><span :aria-current="step === 2 ? 'step' : undefined">{{ copy.stepsConfirm }}</span></div>
			<div :class="$style.target"><img v-if="currentImage" :src="currentImage" :alt="name"><strong>:{{ name }}:</strong></div>
			<div v-if="kind === 'cancel'" :class="[$style.notice, $style.warning]"><strong>{{ copy.cancelNoticeTitle }}</strong>{{ copy.cancelNotice }}<br>{{ copy.cancelQuota }}</div>
			<div v-else-if="kind === 'withdraw'" :class="[$style.notice, $style.warning]"><strong>{{ copy.withdrawNoticeTitle }}</strong>{{ copy.withdrawNotice }}<br>{{ copy.withdrawQuota }}</div>
			<div v-else :class="$style.notice">{{ copy.updateNotice }}<br>{{ copy.updateQuota }}</div>
			<div v-if="kind === 'updateImage'" :class="$style.grid">
				<div :class="$style.preview"><span>{{ copy.currentImage }}</span><HfEmojiPreviewPair :url="currentImage" :alt="i18n.tsx._hata._hatafeed._emojiChangeWizard.currentImageAlt({ name })"/></div>
				<div :class="$style.preview"><span>{{ copy.newImage }}</span><HfEmojiPreviewPair :url="file?.url" :alt="i18n.tsx._hata._hatafeed._emojiChangeWizard.newImageAlt({ name })"/><button v-if="step === 1" type="button" class="hy-secondary" :disabled="busy" @click="pickImage">{{ copy.pickImage }}</button><small v-if="step === 1" :class="$style.muted">{{ copy.imageLimit }}</small></div>
			</div>
			<template v-if="step === 1">
				<label :class="$style.field"><span>{{ kind === 'cancel' ? copy.cancelReason : i18n.tsx._hata._hatafeed._emojiChangeWizard.reasonRequired({ kind: kindLabel }) }}</span><textarea v-model="reason" maxlength="1024" :disabled="busy"></textarea></label>
				<label v-if="kind === 'updateImage'" :class="$style.field"><span>{{ copy.licenseRequired }}</span><input v-model="license" maxlength="1024" :disabled="busy"></label>
				<label v-if="kind !== 'cancel'" :class="$style.check"><input v-model="acknowledged" type="checkbox" :disabled="busy"><span>{{ kind === 'updateImage' ? copy.ackUpdate : copy.ackWithdraw }}</span></label>
			</template>
			<dl v-else :class="$style.details"><div><dt>{{ copy.summaryKind }}</dt><dd>{{ kindLabel }}</dd></div><div><dt>{{ copy.summaryReason }}</dt><dd>{{ reason }}</dd></div><div v-if="kind === 'updateImage'"><dt>{{ copy.summaryLicense }}</dt><dd>{{ license }}</dd></div><div><dt>{{ copy.effectiveTiming }}</dt><dd>{{ copy.afterStaffApproval }}</dd></div></dl>
			<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>
		</template>
	</div>
	<div :class="$style.actions">
		<button v-if="completed" type="button" class="hy-primary" @click="dialog?.close()">{{ copy.goToHistory }}</button>
		<template v-else><button type="button" class="hy-secondary" :disabled="busy" @click="step === 2 ? step = 1 : dialog?.close()">{{ step === 2 ? copy.edit : copy.leave }}</button><button v-if="kind !== 'cancel' && step === 1" type="button" class="hy-primary" :disabled="!valid || busy" @click="step = 2">{{ copy.reviewApplication }}</button><button v-else type="button" class="hy-primary" :disabled="!valid || busy" @click="submit">{{ busy ? copy.sending : kind === 'cancel' ? copy.cancelApplication : i18n.tsx._hata._hatafeed._emojiChangeWizard.submitKind({ kind: kindLabel }) }}</button></template>
	</div>
</MkWindow>
</template>
<script setup lang="ts">
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { computed, ref, useTemplateRef } from 'vue';
import type { entities } from 'cherrypick-js';
import type { HataFeedEmojiRequest } from '@/utility/hatafeed.js';
import MkWindow from '@/components/MkWindow.vue';
import HfEmojiPreviewPair from '@/components/HfEmojiPreviewPair.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { emojiChangeError } from '@/utility/hatafeed.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { i18n } from '@/i18n.js';
import '@/components/hatafeed-ui.css';
const pickers = useHataGoesPickers();
const dialogs = useHataGoesDialogs();
const copy = i18n.ts._hata._hatafeed._emojiChangeWizard;
const props = defineProps<{ request: HataFeedEmojiRequest; kind: 'updateImage' | 'withdraw' | 'cancel' }>();
const emit = defineEmits<{ done: []; closed: [] }>();
const dialog = useTemplateRef('dialog');
const step = ref(1);
const reason = ref('');
const license = ref(props.request.currentEmoji?.license ?? props.request.license ?? '');
const file = ref<entities.DriveFile | null>(null);
const acknowledged = ref(false);
const completed = ref(false);
const busy = ref(false);
const error = ref('');
const name = computed(() => props.request.currentEmoji?.name ?? props.request.name);
const currentImage = computed(() => props.request.currentEmoji?.imageUrl ?? props.request.imageUrl);
const kindLabel = computed(() => props.kind === 'updateImage' ? i18n.ts._hata._hatafeed._emojiChangeCommon.imageUpdate : i18n.ts._hata._hatafeed._emojiChangeCommon.withdraw);
const valid = computed(() => props.kind === 'cancel' || (!!reason.value.trim() && acknowledged.value && (props.kind !== 'updateImage' || (!!file.value && !!license.value.trim()))));

async function beforeClose() {
	if (busy.value) return false;
	if (completed.value || (!reason.value && !file.value && !acknowledged.value)) return true;
	return !(await dialogs.confirm({ type: 'warning', text: copy.discardConfirm })).canceled;
}

async function pickImage() {
	const chosen = (await pickers.selectDriveFiles({ multiple: false }).catch(() => []))[0];
	if (!chosen) return;
	if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(chosen.type) || chosen.size > 5 * 1024 * 1024) { error.value = copy.invalidImage; return; }
	file.value = chosen; acknowledged.value = false; error.value = '';
}

async function submit() {
	if (!valid.value || busy.value) return;
	busy.value = true; error.value = '';
	try {
		if (props.kind === 'cancel') await misskeyApi('hata/feedback/emoji-requests/cancel', { requestId: props.request.id, reason: reason.value.trim() || null });
		else await misskeyApi('hata/feedback/emoji-change-requests/create', { originalRequestId: props.request.id, kind: props.kind, reason: reason.value.trim(), ...(props.kind === 'updateImage' ? { fileId: file.value!.id, license: license.value.trim() } : {}) });
		completed.value = true; emit('done');
	} catch (err) { error.value = emojiChangeError(err); } finally { busy.value = false; }
}
</script>
<style module src="./hatafeed-emoji-management.module.css"></style>
