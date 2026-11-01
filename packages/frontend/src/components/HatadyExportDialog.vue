<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="copy.dialogTitle" :busy="busy" @close="dialog?.close()" @closed="emit('closed')">
	<form class="hy-form" @submit.prevent="prepare">
		<div class="hy-field" :class="$style.choiceField">
			<span>{{ copy.activities }}</span>
			<HyCapsule v-model="kind" :options="kinds" :label="copy.activities" :class="$style.choices"/>
		</div>
		<div class="hy-field" :class="$style.choiceField">
			<span>{{ copy.format }}</span>
			<HyCapsule v-model="format" :options="formats" :label="copy.formatLabel" :class="$style.choices"/>
		</div>
		<div class="hy-field">
			<span>{{ copy.period }}</span>
			<div :class="$style.presets">
				<button
					v-for="p in presets"
					:key="p.value"
					type="button"
					class="hy-secondary"
					:aria-pressed="mode === p.value"
					@click="setMode(p.value)"
				>
					{{ p.label }}
				</button>
			</div>
		</div>
		<div :class="$style.dates">
			<label class="hy-field">
				<span>
					{{ copy.from }}
					<small>{{ i18n.ts.optional }}</small>
				</span>
				<input v-model="since" class="hy-input" type="date" @input="mode = 'custom'"/>
			</label>
			<label class="hy-field">
				<span>
					{{ copy.to }}
					<small>{{ i18n.ts.optional }}</small>
				</span>
				<input v-model="until" class="hy-input" type="date" @input="mode = 'custom'"/>
			</label>
		</div>
		<p class="hy-muted">{{ copy.privacy }}</p>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	</form>
	<section v-if="prepared" :class="$style.preview">
		<p>{{ i18n.tsx._hata._hatady._exportDialog.previewCount({ records: String(prepared.records), works: String(prepared.works) }) }}</p>
		<textarea class="hy-input" :value="prepared.contents" readonly rows="9" :aria-label="copy.exportTarget"></textarea>
	</section>
	<template #actions>
		<button class="hy-secondary" :disabled="busy" @click="dialog?.close()">{{ copy.cancel }}</button>
		<button v-if="!prepared" class="hy-primary" :disabled="busy || !valid" @click="prepare">
			<i v-if="busy" class="ti ti-loader-2"></i>
			{{ copy.review }}
		</button>
		<button v-else class="hy-primary" @click="download">
			<i class="ti ti-download"></i>
			{{ copy.exportContents }}
		</button>
	</template>
</HyDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HatadyPreparedExport } from '@/utility/hatady-export.js';
import type { HatadyLogKind } from '@/utility/hatady-media.js';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import { i18n } from '@/i18n.js';
import { readAllHatadyArchive, prepareHatadyExport, downloadPreparedHatadyExport } from '@/utility/hatady-export.js';
import { HATADY_ACTIVITY_CHOICES, hatadyNotify } from '@/utility/hatady-ui.js';
import { localDateKey } from '@/utility/hatady-home.js';
const emit = defineEmits<{ (e: 'closed'): void }>();
const dialog = ref<any>(),
	kind = ref('all'),
	format = ref('json'),
	mode = ref('all'),
	since = ref(''),
	until = ref(''),
	busy = ref(false),
	error = ref(''),
	prepared = ref<HatadyPreparedExport | null>(null);
const copy = i18n.ts._hata._hatady._exportDialog;
const kinds = [{ value: 'all', label: copy.mediaKindAll, icon: 'ti ti-notebook' }, ...HATADY_ACTIVITY_CHOICES];
const formats = [
	{ value: 'json', label: 'JSON', icon: 'ti ti-braces' },
	{ value: 'txt', label: copy.text, icon: 'ti ti-file-text' },
];
const presets = [
	{ value: 'all', label: copy.all },
	{ value: 'month', label: copy.thisMonth },
	{ value: 'last', label: copy.lastMonth },
	{ value: '30', label: copy.last30 },
	{ value: 'custom', label: copy.custom },
];
const valid = computed(() => !since.value || !until.value || since.value <= until.value);
let request = 0;

function setMode(value: string) {
	mode.value = value;
	const now = new Date();
	if (value === 'all') {
		since.value = '';
		until.value = '';
	} else if (value === 'month') {
		since.value = localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
		until.value = localDateKey(now);
	} else if (value === 'last') {
		since.value = localDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
		until.value = localDateKey(new Date(now.getFullYear(), now.getMonth(), 0));
	} else if (value === '30') {
		const start = new Date(now);
		start.setDate(start.getDate() - 29);
		since.value = localDateKey(start);
		until.value = localDateKey(now);
	}
}

watch([kind, format, since, until], () => {
	prepared.value = null;
	request++;
	error.value = valid.value ? '' : copy.dateOrderError;
});

async function prepare() {
	if (busy.value || !valid.value) return;
	busy.value = true;
	error.value = '';
	const seq = ++request;
	const selectedFormat = format.value as 'json' | 'txt';
	try {
		const archive = await readAllHatadyArchive({
			kinds: kind.value === 'all' ? [] : [kind.value as HatadyLogKind],
			since: since.value ? new Date(`${since.value}T00:00:00`).getTime() : null,
			until: until.value ? new Date(`${until.value}T00:00:00`).getTime() : null,
		});
		if (seq === request) prepared.value = prepareHatadyExport(archive, selectedFormat);
	} catch {
		error.value = copy.loadFailed;
	} finally {
		busy.value = false;
	}
}

function download() {
	if (!prepared.value) return;
	try {
		downloadPreparedHatadyExport(prepared.value);
		hatadyNotify(i18n.tsx._hata._hatady._exportDialog.success({ count: String(prepared.value.records) }));
	} catch {
		error.value = copy.failed;
	}
}
</script>
<style module>
.choiceField {
	min-width: 0;
}
.choiceField > .choices {
	box-sizing: border-box;
	flex-wrap: wrap;
	justify-content: center;
	width: max-content;
	min-width: 0;
	max-width: 100%;
	border-radius: 24px;
	overflow: clip;
}
.choices > button[data-active] {
	box-sizing: border-box;
	max-width: 100%;
}
.choices > button[data-active] > span {
	inline-size: auto;
	min-width: 0;
	white-space: normal;
	overflow-wrap: anywhere;
}
.presets {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}
.presets > button[aria-pressed='true'] {
	background: var(--hy-accent);
	color: var(--hy-on-accent, #fff);
}
.dates {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 14px;
}
.preview {
	margin-top: 24px;
}
.preview > p {
	text-align: center;
	font-size: 13px;
}
.preview textarea {
	font-family: monospace;
	white-space: pre;
	font-size: 12px;
	tab-size: 2;
	min-height: 240px;
}
@container hy-dialog (max-width: 400px) {
	.dates {
		grid-template-columns: 1fr;
	}
}
</style>
