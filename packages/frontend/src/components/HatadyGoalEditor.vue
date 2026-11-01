<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog
	ref="dialog"
	:title="goal ? copy.editGoal : copy.nextGoal"
	:busy="busy"
	:inert="prompt"
	@close="requestClose"
	@closed="emit('closed')"
>
	<form class="hy-form" @submit.prevent="save">
		<label class="hy-field">
			<span>{{ copy.goal }}</span>
			<input v-model="form.title" class="hy-input" maxlength="256" :placeholder="copy.goalPlaceholder" required/>
		</label>
		<label class="hy-field">
			<span>
				{{ copy.note }}
				<small>{{ copy.optional }}</small>
			</span>
			<textarea v-model="form.description" class="hy-input" maxlength="2048" rows="3"></textarea>
		</label>
		<div class="hy-field">
			<span>{{ copy.period }}</span>
			<HyCapsule v-model="form.termType" :options="terms" :label="copy.goalPeriod"/>
		</div>
		<label class="hy-field">
			<span>
				{{ copy.deadline }}
				<small>{{ copy.optional }}</small>
			</span>
			<input v-model="form.targetDate" class="hy-input" type="date"/>
		</label>
		<div class="hy-field">
			<span>{{ copy.metric }}</span>
			<HyCapsule v-model="form.metricType" :options="metrics" :label="copy.metric"/>
		</div>
		<label v-if="form.metricType" class="hy-field">
			<span>{{ copy.target }} {{ unit }}</span>
			<input
				v-model.number="form.metricTarget"
				class="hy-input"
				type="number"
				inputmode="numeric"
				min="1"
				step="1"
				required
			/>
		</label>
		<p v-if="form.metricType" class="hy-muted">{{ copy.progressHint }}</p>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	</form>
	<template #actions>
		<button v-if="hataGoesHost && goal" class="hy-secondary" :disabled="busy" @click="removeGoal">{{ goalsCopy.delete }}</button>
		<button class="hy-secondary" :disabled="busy" @click="requestClose">{{ copy.close }}</button>
		<button class="hy-primary" :disabled="busy || !valid" @click="save">
			{{ goal ? copy.save : copy.createGoal }}
		</button>
	</template>
</HyDialog>
<HatadyDraftPrompt
	v-if="prompt"
	:title="copy.draftQuestion"
	:description="copy.draftDescription"
	:error="draftError"
	@save="leave(true)"
	@discard="leave(false)"
	@return="prompt = false"
/>
</template>
<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { localDateKey } from '@/utility/hatady-home.js';
import { i18n } from '@/i18n.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
const copy = i18n.ts._hata._hatady._goalEditor;
const goalsCopy = i18n.ts._hata._hatady._goals;
const props = defineProps<{ goal?: any }>();
const hataGoesHost = inject(HATA_GOES_HOST, null);
const dialogs = useHataGoesDialogs();
const emit = defineEmits<{ (e: 'closed'): void; (e: 'done'): void }>();
const dialog = ref<any>(),
	busy = ref(false),
	prompt = ref(false),
	error = ref(''),
	draftError = ref('');
const form = reactive({
	title: props.goal?.title || '',
	description: props.goal?.description || '',
	termType: props.goal?.termType || 'short',
	targetDate: props.goal?.targetDate ? localDateKey(new Date(props.goal.targetDate)) : '',
	metricType: props.goal?.metricType || '',
	metricTarget: props.goal?.metricTarget ?? null,
});
const terms = [
	{ value: 'short', label: copy.shortTerm, icon: 'ti ti-bolt' },
	{ value: 'long', label: copy.longTerm, icon: 'ti ti-mountain' },
];
const metrics = [
	{ value: '', label: copy.manual, icon: 'ti ti-check' },
	{ value: 'minutes', label: copy.time, icon: 'ti ti-clock' },
	{ value: 'logs', label: copy.logCount, icon: 'ti ti-notebook' },
	{ value: 'books', label: copy.bookCount, icon: 'ti ti-books' },
];
const unit = computed(() => (form.metricType === 'minutes' ? copy.minuteUnit : form.metricType === 'logs' ? copy.recordUnit : copy.bookUnit));
const valid = computed(
	() => form.title.trim() && (!form.metricType || (Number.isInteger(form.metricTarget) && form.metricTarget > 0)),
);
const draft = useHataFormDraft({
	id: `hatady-goal:${props.goal?.id || 'new'}`,
	autoSave: false,
	capture: () => ({ ...form }),
	restore: (d) => Object.assign(form, d),
	isMeaningful: () => true,
});

function requestClose() {
	if (busy.value) return;
	if (draft.hasChanges()) {
		prompt.value = true;
		draftError.value = '';
	} else dialog.value?.close();
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

async function save() {
	if (busy.value || !valid.value) return;
	busy.value = true;
	error.value = '';
	try {
		const payload = {
			title: form.title.trim(),
			description: form.description.trim() || null,
			termType: form.termType,
			targetDate: form.targetDate ? new Date(`${form.targetDate}T23:59:59.999`).getTime() : null,
			metricType: form.metricType || null,
			metricTarget: form.metricType ? form.metricTarget : null,
		};
		await (misskeyApi as any)(
			props.goal ? 'hata/hatady/goals/update' : 'hata/hatady/goals/create',
			props.goal ? { goalId: props.goal.id, ...payload } : payload,
		);
		if (!draft.clearDraft()) hatadyNotify(copy.savedDraftDeleteFailed);
		else hatadyNotify(copy.saved);
		emit('done');
		dialog.value?.close();
	} catch {
		error.value = copy.saveFailed;
	} finally {
		busy.value = false;
	}
}

async function removeGoal() {
	if (busy.value || !props.goal || !hataGoesHost) return;
	busy.value = true;
	error.value = '';
	try {
		const { canceled } = await dialogs.confirm({
			type: 'warning',
			text: i18n.tsx._hata._hatady._goals.confirmDelete({ title: props.goal.title }),
		});
		if (canceled) return;
		await misskeyApi('hata/hatady/goals/delete', { goalId: props.goal.id });
		if (!draft.clearDraft()) hatadyNotify(copy.savedDraftDeleteFailed);
		emit('done');
		dialog.value?.close();
	} catch {
		error.value = copy.saveFailed;
	} finally {
		busy.value = false;
	}
}
</script>
