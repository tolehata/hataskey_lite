<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="520"
	:height="460"
	:withCloseButton="!busy"
	@close="cancel"
	@esc="cancel"
	@click="cancel"
	@closed="emit('closed')"
>
	<template #header>{{ choice === 'oppose' ? copy.opposeTitle : copy.agreeTitle }}</template>
	<div :class="$style.body" class="_gaps_m">
		<p :class="$style.applicant">@{{ username }}</p>
		<p v-if="choice === 'oppose'" :class="$style.description">{{ copy.opposeDescription }}</p>
		<p v-else :class="$style.description">{{ copy.agreeDescription }}</p>
		<MkTextarea v-model="reason" :required="choice === 'oppose'" :disabled="busy" :placeholder="choice === 'oppose' ? copy.reasonPlaceholder : copy.notePlaceholder" autocomplete="off">
			<template #label>{{ choice === 'oppose' ? copy.reasonLabel : copy.noteLabel }}</template>
			<template #caption>
				<span>{{ copyx.countLabel({ count: reason.length.toString() }) }}</span>
				<span v-if="validationError" :class="$style.error" role="alert">{{ validationError }}</span>
			</template>
		</MkTextarea>
		<p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
	</div>
	<template #footer>
		<div :class="$style.actions">
			<MkButton :disabled="busy" rounded @click="cancel">{{ i18n.ts.goBack }}</MkButton>
			<MkButton v-if="choice === 'oppose'" danger rounded :disabled="busy" @click="submit"><i class="ti ti-x" aria-hidden="true"></i> {{ copy.saveOppose }}</MkButton>
			<MkButton v-else primary rounded :disabled="busy" @click="submit"><i class="ti ti-check" aria-hidden="true"></i> {{ copy.saveAgree }}</MkButton>
		</div>
	</template>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	choice: 'agree' | 'oppose';
	username: string;
	busy: boolean;
	error: string | null;
}>();
const emit = defineEmits<{
	(event: 'closed'): void;
	(event: 'submit', reason: string): void;
}>();
const copy = i18n.ts._hata._registrationApplications._review;
const copyx = i18n.tsx._hata._registrationApplications._review;
const dialog = useTemplateRef('dialog');
const reason = ref('');
const validationError = ref<string | null>(null);

function cancel() {
	if (props.busy) return;
	reason.value = '';
	dialog.value?.close();
}

function submit() {
	if (props.busy) return;
	const value = reason.value.trim();
	if (props.choice === 'oppose' && value.replace(/[\s\u2800\p{C}\p{M}\p{Default_Ignorable_Code_Point}]/gu, '').length === 0) {
		validationError.value = copy.reasonRequired;
		return;
	}
	if (value.length > 300) {
		validationError.value = copy.reasonTooLong;
		return;
	}
	validationError.value = null;
	emit('submit', value);
}

watch(reason, () => { validationError.value = null; });
onBeforeUnmount(() => { reason.value = ''; });
</script>

<style lang="scss" module>
.body {
	padding: 20px;
}

.applicant,
.description {
	margin: 0;
	overflow-wrap: anywhere;
	line-height: 1.7;
}

.applicant {
	font-weight: bold;
}

.error {
	display: block;
	margin: 8px 0 0;
	color: var(--MI_THEME-fg);
	font-weight: bold;
	overflow-wrap: anywhere;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
}
</style>
