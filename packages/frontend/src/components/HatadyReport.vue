<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<HyDialog ref="dialog" :title="copy.title" :variant="variant" back :busy="busy" :inert="prompt" @back="requestClose" @close="requestClose" @closed="emit('closed')">
	<div :class="$style.person"><i class="ti ti-flag" aria-hidden="true"></i><strong>{{ i18n.tsx._hata._hatady._report.personContent({ name: user.name || user.username }) }}</strong></div>
	<blockquote v-if="excerpt" :class="$style.excerpt">{{ excerpt }}</blockquote>
	<form :id="formId" class="hy-form" @submit.prevent="send">
		<fieldset v-if="hataGoesHost" :class="$style.reasonChoices" :disabled="busy || sent">
			<legend>{{ copy.reason }}</legend>
			<label v-for="option in reasonOptions" :key="option.value">
				<input v-model="category" type="radio" name="hatady-report-category" :value="option.value"/>
				<span>{{ option.label }}</span>
			</label>
		</fieldset>
		<label class="hy-field">
			<span>{{ hataGoesHost ? '詳しい内容（任意）' : copy.reason }}</span>
			<span :class="$style.inputBox">
				<textarea v-model="reason" class="hy-input" rows="5" :maxlength="maxReasonLength" :disabled="busy || sent" :required="!hataGoesHost" :placeholder="copy.reasonExample"></textarea>
				<small :class="$style.counter">{{ reason.length }} / {{ maxReasonLength }}</small>
			</span>
		</label>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	</form>
	<template #actions>
		<button v-if="!sent" type="button" class="hy-secondary" :disabled="busy" @click="requestClose">{{ i18n.ts._hata._hatady._controls.back }}</button>
		<button v-if="sent" type="button" class="hy-primary" :disabled="busy" @click="closeSentReport">{{ copy.closeSent }}</button>
		<button v-else type="submit" :form="formId" class="hy-primary" :disabled="!canSubmit"><i class="ti ti-flag" aria-hidden="true"></i>{{ copy.submit }}</button>
	</template>
</HyDialog>
<HatadyDraftPrompt v-if="prompt" :title="copy.draftQuestion" :description="copy.draftDescription" :error="draftError" @save="leave(true)" @discard="leave(false)" @return="prompt = false"/>
</template>

<script setup lang="ts">
import { computed, inject, ref, useId, useTemplateRef } from 'vue';
import type * as Misskey from 'cherrypick-js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const copy = i18n.ts._hata._hatady._report;

const props = withDefaults(defineProps<{ user: Misskey.entities.UserLite; initialComment?: string; variant?: 'hatady' | 'ui' | 'uis' }>(), { variant: 'hatady' });
const emit = defineEmits<{ (event: 'closed'): void }>();
const dialog = useTemplateRef('dialog');
const formId = useId();
const reason = ref('');
const category = ref('');
const hataGoesHost = inject(HATA_GOES_HOST, null);
const reasonOptions = [
	{ value: 'spam', label: 'スパム' },
	{ value: 'unpleasant', label: '不快な内容' },
	{ value: 'spoiler', label: 'ネタバレの指定がない' },
	{ value: 'other', label: 'その他' },
];
const busy = ref(false);
const sent = ref(false);
const prompt = ref(false);
const error = ref('');
const draftError = ref('');
const reference = computed(() => props.initialComment?.split('\n')[0] ?? '');
const hasReference = computed(() => reference.value.startsWith('hatady:'));
// 対象 ID は本文の先頭に維持し、長い引用だけを抑えて理由の入力枠を確保する。
const excerpt = computed(() => (hasReference.value ? props.initialComment?.slice(reference.value.length + 1) : props.initialComment)?.slice(0, 512) ?? '');
const context = computed(() => [hasReference.value ? reference.value : '', excerpt.value].filter(Boolean).join('\n'));
const selectedReason = computed(() => reasonOptions.find(option => option.value === category.value)?.label ?? '');
const maxReasonLength = computed(() => Math.max(0, 2048 - context.value.length - (context.value ? 2 : 0) - (hataGoesHost && selectedReason.value ? selectedReason.value.length + 1 : 0)));
const comment = computed(() => {
	const body = hataGoesHost ? [selectedReason.value, reason.value.trim()].filter(Boolean).join('\n') : reason.value;
	return context.value ? `${context.value}\n\n${body}` : body;
});
const canSubmit = computed(() => !busy.value && !sent.value && (hataGoesHost ? !!selectedReason.value : !!reason.value.trim()) && reason.value.length <= maxReasonLength.value && comment.value.length <= 2048);
const draft = useHataFormDraft({
	id: `hatady-report:${props.user.id}:${reference.value || 'user'}`,
	autoSave: false,
	capture: () => ({ reason: reason.value, category: category.value }),
	restore: (value) => {
		if (typeof value?.reason !== 'string') throw new Error('Invalid report draft');
		reason.value = value.reason;
		category.value = typeof value.category === 'string' && reasonOptions.some(option => option.value === value.category) ? value.category : '';
	},
	isMeaningful: () => true,
});

function requestClose() {
	if (busy.value) return;
	if (sent.value) {
		closeSentReport();
	} else if (draft.hasChanges() || draft.restored.value) {
		draftError.value = '';
		prompt.value = true;
	} else dialog.value?.close();
}

function closeSentReport(): boolean {
	if (!draft.clearDraft()) {
		error.value = copy.sentDraftCleanupFailed;
		return false;
	}
	error.value = '';
	dialog.value?.close();
	return true;
}

function leave(save: boolean) {
	if (!(save ? draft.saveDraft() : draft.clearDraft())) {
		draftError.value = copy.draftUpdateFailed;
		return;
	}
	prompt.value = false;
	if (save) hatadyNotify(copy.draftSaved);
	dialog.value?.close();
}

async function send() {
	if (!canSubmit.value) return;
	busy.value = true;
	error.value = '';
	try {
		await misskeyApi('users/report-abuse', {
			userId: props.user.id,
			comment: comment.value,
		});
		sent.value = true;
		if (closeSentReport()) hatadyNotify(copy.sent);
		else hatadyNotify(copy.sentDraftCleanupFailed);
	} catch {
		error.value = copy.sendFailed;
	} finally {
		busy.value = false;
	}
}
</script>

<style module>
.person { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.excerpt { margin: 0 0 22px; padding: 16px; border-radius: 16px; background: var(--hy-surface); color: var(--hy-muted); white-space: pre-wrap; overflow-wrap: anywhere; }
.inputBox { position: relative; display: block; }
.inputBox textarea { display: block; width: 100%; padding-bottom: 38px; }
.counter { position: absolute; right: 14px; bottom: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; pointer-events: none; }
.reasonChoices { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
.reasonChoices legend { margin-bottom: 8px; }
.reasonChoices label { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; }
</style>
