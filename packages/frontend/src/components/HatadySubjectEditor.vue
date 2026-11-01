<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog
	ref="dialog"
	:title="subject ? copy.edit : copy.add"
	:busy="busy"
	:inert="prompt"
	@close="requestClose"
	@closed="emit('closed')"
>
	<form class="hy-form" @submit.prevent="save">
		<label class="hy-field">
			<span>{{ copy.name }}</span>
			<input v-model="name" class="hy-input" maxlength="128" :placeholder="copy.nameExample" required/>
		</label>
		<div class="hy-field">
			<span>{{ copy.color }}</span>
			<div :class="$style.colors">
				<button
					v-for="c in colors"
					:key="c"
					type="button"
					:style="{ background: c }"
					:aria-label="c"
					:aria-pressed="color === c"
					@click="color = c"
				>
					<i v-if="color === c" class="ti ti-check"></i>
				</button>
			</div>
			<input
				type="color"
				:value="color || '#517f4f'"
				:aria-label="copy.chooseColor"
				@input="color = ($event.target as HTMLInputElement).value"
			/>
			<button type="button" class="hy-secondary" @click="color = null">{{ copy.resetColor }}</button>
		</div>
		<p v-if="subject && name !== subject.name" class="hy-muted">{{ copy.renameTransfer }}</p>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	</form>
	<template #actions>
		<button class="hy-secondary" :disabled="busy" @click="requestClose">{{ i18n.ts.close }}</button>
		<button class="hy-primary" :disabled="busy || !name.trim()" @click="save">{{ copy.save }}</button>
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
import { ref } from 'vue';
import type { HySubjectRow } from '@/utility/hatady-subjects.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { loadHySubjects, hySubjects } from '@/utility/hatady-subjects.js';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._subjects;
const props = defineProps<{ subject?: HySubjectRow }>();
const emit = defineEmits<{ (e: 'closed'): void; (e: 'done'): void }>();
const dialog = ref<any>(),
	name = ref(props.subject?.name || ''),
	color = ref<string | null>(props.subject?.color ?? null),
	busy = ref(false),
	prompt = ref(false),
	error = ref(''),
	draftError = ref('');
const colors = [
	'#517f4f',
	'#bd6a3d',
	'#45688f',
	'#8a5a91',
	'#a97e2e',
	'#3f8a8a',
	'#c0563a',
	'#d9a441',
	'#6b8e5a',
	'#7a5ad0',
];
const draft = useHataFormDraft({
	id: `hatady-subject:${props.subject?.name || 'new'}`,
	autoSave: false,
	capture: () => ({ name: name.value, color: color.value }),
	restore: (d) => {
		name.value = d.name;
		color.value = d.color;
	},
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
		draftError.value = copy.draftFailed;
		return;
	}
	prompt.value = false;
	if (save) hatadyNotify(copy.draftSaved);
	dialog.value?.close();
}

async function save() {
	const n = name.value.trim();
	if (!n || busy.value) return;
	if (n !== props.subject?.name && hySubjects.value.some((s) => s.name === n)) {
		error.value = copy.duplicateName;
		return;
	}
	busy.value = true;
	error.value = '';
	try {
		await (misskeyApi as any)('hata/hatady/subjects/save', {
			name: n,
			color: color.value,
			originalName: props.subject?.name,
		});
		if (!draft.clearDraft()) hatadyNotify(copy.savedDraftCleanupFailed);
		else hatadyNotify(copy.saved);
		await loadHySubjects();
		emit('done');
		dialog.value?.close();
	} catch {
		error.value = copy.saveFailed;
	} finally {
		busy.value = false;
	}
}
</script>
<style module>
.colors {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}
.colors > button {
	display: grid;
	place-items: center;
	border: 3px solid transparent;
	border-radius: 50%;
	height: 44px;
	width: 44px;
	color: #fff;
	cursor: pointer;
}
.colors > button[aria-pressed='true'] {
	outline: 2px solid var(--hy-ink);
	outline-offset: 2px;
}
</style>
