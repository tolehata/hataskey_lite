<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="title" :variant="variant" :back="currentIndex > 0 || embedded" :busy="saving" :embedded="embedded" :inert="closePrompt" @close="requestClose" @back="back" @closed="emit('closed')">
	<div :class="$style.progress"><div><span><i :class="icon" aria-hidden="true"></i>{{ label }}</span><small>{{ currentIndex + 1 }} / {{ route.length }}</small></div><progress :value="currentIndex + 1" :max="route.length" :aria-label="copy.progress"></progress></div>
	<p v-if="error" role="alert" tabindex="-1" :class="$style.error">{{ error }}</p>
	<form ref="form" novalidate @submit.prevent="next">
		<fieldset :disabled="saving || hasSaved" :class="$style.formBody">
			<section v-for="page in pages" v-show="page.id === currentPage" :key="page.id" :inert="page.id !== currentPage" :data-page="page.id" :data-direction="direction" :data-hatagoes="goesMotion" :class="$style.page" :aria-labelledby="`${id}-${page.id}`">
				<h3 :id="`${id}-${page.id}`" tabindex="-1">{{ page.title }}</h3>
				<p v-if="page.description" :class="$style.description">{{ page.description }}</p>
				<div v-if="page.choices" :class="$style.extras">
					<label v-for="group in groups" :key="group.id" :class="$style.extra"><input v-model="selectedGroups" name="optional-pages" type="checkbox" :value="group.id"><span><i :class="group.icon" aria-hidden="true"></i><span><strong>{{ group.title }}</strong><small>{{ groupHasValue(group.id) ? copy.hasInput : copy.optional }}</small></span><i class="ti ti-check" aria-hidden="true"></i></span></label>
				</div>
				<template v-if="page.summary">
					<div :class="$style.summary"><i :class="icon" aria-hidden="true"></i><div><small>{{ label }}</small><strong>{{ values.title || summaryTitle || label }}</strong></div></div>
					<MkMediaList v-if="values.files?.length" :mediaList="values.files"/>
					<dl v-if="summaryFacts.length" :class="$style.facts"><template v-for="fact in summaryFacts" :key="fact.key"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></template></dl>
				</template>
				<HatadyFormFields v-model="values" :fields="page.fields"/>
			</section>
		</fieldset>
	</form>
	<template #actions>
		<button v-if="currentIndex > 0 || embedded" type="button" class="hy-secondary" :disabled="saving || hasSaved" @click="back"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.back }}</button>
		<button type="button" class="hy-primary" :disabled="saving" @click="next">{{ saving ? copy.saving : currentIndex === route.length - 1 ? saveLabel : copy.next }}<i :class="currentIndex === route.length - 1 ? 'ti ti-check' : 'ti ti-arrow-right'" aria-hidden="true"></i></button>
	</template>
</HyDialog>
<HatadyDraftPrompt v-if="closePrompt" :variant="variant" :busy="saving" :error="draftError" @save="closeWithDraft(true)" @discard="closeWithDraft(false)" @return="returnToEditing"/>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, useId, useTemplateRef } from 'vue';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyDraftPrompt from '@/components/HatadyDraftPrompt.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import HatadyFormFields from '@/components/HatadyFormFields.vue';
import { HatadyFormPartialError, commitFormLists, formServerError, formValidation, initialFormGroups, meaningfulField } from '@/utility/hatady-form.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { HATADY_RECORD_TAGS, hatadyDuration, hatadyNotify } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
const goesMotion = !!inject(HATA_GOES_HOST, null);
const copy = i18n.ts._hata._hatady._formWizard;

const values = defineModel<HatadyFormValues>({ required: true });
const props = withDefaults(defineProps<{ title: string; label: string; icon: string; pages: HatadyFormPage[]; draftId: string; embedded?: boolean; variant?: HatadySurfaceVariant; saveLabel?: string; summaryTitle?: string; restore?: (draft: HatadyFormValues) => HatadyFormValues; save: (values: HatadyFormValues) => Promise<any> }>(), { embedded: false, variant: 'hatady', saveLabel: i18n.ts._hata._hatady._formWizard.saveDefault, summaryTitle: '' });
const emit = defineEmits<{ (event: 'done', value: any): void; (event: 'closed'): void; (event: 'back'): void }>();
const dialog = useTemplateRef('dialog'), form = useTemplateRef('form'), id = useId();
const currentPage = ref(props.pages[0]?.id ?? ''), selectedGroups = ref(initialFormGroups(props.pages, values.value));
values.value.__listDrafts ??= {};
const hasSaved = ref(false);
const saving = ref(false), error = ref(''), closePrompt = ref(false), draftError = ref(''), direction = ref(1);
const scrolls: Record<string, number> = {};
let exitToBack = false, returnFocus: HTMLElement | null = null, savedResult: any;
const route = computed(() => props.pages.filter(page => (!page.when || page.when(values.value)) && (!page.group || selectedGroups.value.includes(page.group))));
const currentIndex = computed(() => Math.max(0, route.value.findIndex(page => page.id === currentPage.value)));
const groups = computed(() => {
	const used = new Set<string>();
	return props.pages.flatMap(page => {
		if (!page.group || used.has(page.group) || page.when && !page.when(values.value)) return [];
		used.add(page.group);
		return [{ id: page.group, title: page.title.replace(/（\d+\/\d+）$/, ''), icon: page.icon || 'ti ti-notes' }];
	});
});

function groupHasValue(group: string): boolean { return props.pages.some(page => page.group === group && page.fields.some(field => meaningfulField(values.value[field.key]))); }

const draft = useHataFormDraft<HatadyFormValues>({
	id: props.draftId, autoSave: false,
	preserveOnExit: () => !hasSaved.value,
	onPreserveFailure: () => hatadyNotify(copy.draftSaveFailed),
	capture: () => ({ ...values.value, __wizard: { page: currentPage.value, selected: [...selectedGroups.value] } }),
	restore: stored => {
		Object.assign(values.value, props.restore ? props.restore(stored) : stored);
		values.value.__listDrafts ??= {};
		const navigation = stored.__wizard;
		selectedGroups.value = Array.isArray(navigation?.selected) ? navigation.selected.filter((group: string) => props.pages.some(page => page.group === group)) : initialFormGroups(props.pages, values.value);
		currentPage.value = route.value.some(page => page.id === navigation?.page) ? navigation.page : props.pages[0].id;
	},
	isMeaningful: () => true,
});
const summaryFacts = computed(() => {
	const used = new Set<string>();
	return props.pages.flatMap(page => page.summary || page.when && !page.when(values.value) ? [] : page.fields.flatMap(field => {
		const value = values.value[field.key];
		if (used.has(field.key) || field.key === 'title' || !meaningfulField(value) || field.when && !field.when(values.value)) return [];
		used.add(field.key);
		if (field.type === 'images') return [{ key: field.key, label: field.label, value: i18n.tsx._hata._hatady._formWizard.imageCount({ count: value.length }) }];
		if (field.type === 'weaponStats' || field.type === 'bookmarks' || field.type === 'memos') return [{ key: field.key, label: field.label, value: i18n.tsx._hata._hatady._formWizard.itemCount({ count: Array.isArray(value) ? value.length : 0 }) }];
		const display = field.type === 'duration' ? hatadyDuration(Number(value)) : Array.isArray(value) ? value.map(item => field.options?.find(option => option.value === item)?.label ?? HATADY_RECORD_TAGS.find(tag => tag.value === item)?.label ?? String(item)).join('・') : field.options?.find(option => option.value === String(value))?.label ?? (field.type === 'visibility' ? ({ public: i18n.ts._hata._hatady._home.activityPublic, followers: i18n.ts._hata._hatady._home.activityFollowers, private: i18n.ts._hata._hatady._home.activityPrivate } as Record<string, string>)[value] ?? String(value) : typeof value === 'boolean' ? copy.yes : String(value));
		return [{ key: field.key, label: field.label, value: display }];
	}));
});

async function go(page: string, forward: boolean): Promise<void> {
	if (dialog.value?.bodyEl) scrolls[currentPage.value] = dialog.value.bodyEl.scrollTop;
	direction.value = forward ? 1 : -1; currentPage.value = page; error.value = '';
	await nextTick();
	const section = form.value?.querySelector<HTMLElement>(`[data-page="${CSS.escape(page)}"]`);
	section?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
	if (dialog.value?.bodyEl) dialog.value.bodyEl.scrollTop = forward ? 0 : scrolls[page] ?? 0;
}

async function validate(all = false): Promise<boolean> {
	const pages = props.pages.filter(page => (!page.when || page.when(values.value)) && (all || page.id === currentPage.value));
	for (const page of pages) {
		const section = form.value?.querySelector<HTMLElement>(`[data-page="${CSS.escape(page.id)}"]`);
		const badInput = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select') ?? []).find(input => { const field = page.fields.find(item => item.key === input.closest<HTMLElement>('[data-field]')?.dataset.field); return !input.disabled && (!field?.when || field.when(values.value)) && !input.checkValidity(); });
		const invalid = page.fields.map(field => ({ field, message: formValidation(field, values.value) })).find(item => item.message);
		if (!badInput && !invalid) continue;
		const badField = page.fields.find(item => item.key === badInput?.closest<HTMLElement>('[data-field]')?.dataset.field);
		const message = invalid?.message || (badField ? badInput!.validity.valueMissing ? i18n.tsx._hata._hatady._formWizard.enterField({ field: badField.label }) : i18n.tsx._hata._hatady._formWizard.checkField({ field: badField.label }) : copy.checkInput);
		await showInvalid(page, invalid?.field.key ?? null, message);
		if (badInput) { badInput.focus(); badInput.reportValidity(); }
		return false;
	}
	return true;
}

async function showInvalid(page: HatadyFormPage, key: string | null, message: string): Promise<void> {
	if (page.group && !selectedGroups.value.includes(page.group)) selectedGroups.value.push(page.group);
	await go(page.id, false);
	error.value = message;
	await nextTick();
	if (key) form.value?.querySelector<HTMLElement>(`[data-page="${CSS.escape(page.id)}"] :is([data-field="${CSS.escape(key)}"] input,[data-field="${CSS.escape(key)}"] textarea,[data-field="${CSS.escape(key)}"] select)`)?.focus();
}

async function next(): Promise<void> {
	if (saving.value) return;
	if (window.document.activeElement instanceof HTMLElement) window.document.activeElement.blur();
	commitFormLists(props.pages, values.value);
	if (currentIndex.value < route.value.length - 1) { if (await validate()) await go(route.value[currentIndex.value + 1].id, true); return; }
	if (!hasSaved.value && !await validate(true)) return;
	saving.value = true; error.value = '';
	try {
		if (!hasSaved.value) { savedResult = await props.save(values.value); hasSaved.value = true; }
		if (!draft.clearDraft()) { error.value = copy.savedDraftCleanupFailed; return; }
		hatadyNotify(copy.saved); emit('done', savedResult); dialog.value?.close();
	} catch (reason) {
		const invalid = formServerError(reason, props.pages, values.value);
		if (invalid) { saving.value = false; await showInvalid(invalid.page, invalid.field.key, invalid.message); return; }
		error.value = (reason as { code?: string } | null)?.code === 'INVALID_HATADY_ATTACHMENTS'
			? copy.checkAttachments
			: reason instanceof HatadyFormPartialError ? reason.message : copy.saveFailed;
	} finally { saving.value = false; }
}

async function back(): Promise<void> {
	if (saving.value) return;
	if (currentIndex.value) await go(route.value[currentIndex.value - 1].id, false);
	else requestClose(true);
}

function requestClose(toBack = false): void {
	if (saving.value || closePrompt.value) return;
	if (hasSaved.value) { next(); return; }
	returnFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	if (window.document.activeElement instanceof HTMLElement) window.document.activeElement.blur();
	exitToBack = toBack;
	if (!draft.hasChanges()) { finishClose(); return; }
	draftError.value = ''; closePrompt.value = true;
}

function finishClose(): void { if (exitToBack) emit('back'); else dialog.value?.close(); }

function closeWithDraft(save: boolean): void {
	if (!(save ? draft.saveDraft() : draft.clearDraft())) { draftError.value = save ? copy.draftSaveFailed : copy.draftDeleteFailed; return; }
	closePrompt.value = false;
	if (save) hatadyNotify(copy.draftSaved);
	finishClose();
}

async function returnToEditing(): Promise<void> { closePrompt.value = false; await nextTick(); returnFocus?.focus({ preventScroll: true }); }

onMounted(() => { if (!route.value.some(page => page.id === currentPage.value)) currentPage.value = route.value[0].id; });
defineExpose({ requestClose, hasChanges: draft.hasChanges, restored: draft.restored, resetBaseline: draft.resetBaseline });
</script>

<style lang="scss" module>
.progress { margin-bottom: 22px; color: var(--hy-muted); font-size: 13px; }
.progress > div { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
.progress span { display: flex; align-items: center; gap: 9px; }
.progress i { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 14px; background: var(--hy-soft); color: var(--hy-accent); font-size: 21px; }
.progress small { font-variant-numeric: tabular-nums; }
.progress progress { display: block; width: 100%; height: 5px; border: 0; border-radius: 99px; overflow: hidden; accent-color: var(--hy-accent); }
.progress progress::-webkit-progress-bar { background: var(--hy-soft); }
.progress progress::-webkit-progress-value { background: var(--hy-accent); border-radius: 99px; }
.formBody { min-width: 0; border: 0; padding: 0; margin: 0; }
.page { display: grid; gap: 22px; min-width: 0; animation: forward .2s ease-out; }
.page[data-direction="-1"] { animation-name: backward; }
.page h3 { margin: 0; font-size: 20px; line-height: 1.5; }
.description { margin: 0; font-size: 14px; line-height: 1.7; color: var(--hy-muted); }
.error { margin: 0 0 18px; padding: 14px; background: var(--hy-soft); border: 1px solid var(--hy-accent); border-radius: 14px; font-size: 14px; line-height: 1.7; }
.extras { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.extra { position: relative; cursor: pointer; min-width: 0; }
.extra input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.extra > span { display: flex; height: 100%; box-sizing: border-box; align-items: center; gap: 10px; min-height: 76px; padding: 14px; border: 1px solid var(--hy-border); border-radius: 18px; }
.extra > span > span { flex: 1; min-width: 0; display: grid; gap: 4px; }
.extra strong { font-size: 14px; }
.extra small { font-size: 12px; color: var(--hy-muted); }
.extra i { font-size: 21px; }
.extra i:last-child { visibility: hidden; }
.extra input:checked + span { background: var(--hy-soft); color: var(--hy-accent); border-color: var(--hy-accent); }
.extra input:checked + span > i:last-child { visibility: visible; }
.extra input:focus-visible + span { outline: 3px solid var(--hy-accent); outline-offset: 3px; }
.summary { display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 20px; background: var(--hy-soft); }
.summary > i { font-size: 30px; color: var(--hy-accent); }
.summary > div { min-width: 0; display: grid; gap: 5px; }
.summary strong { font-size: 20px; overflow-wrap: anywhere; }
.summary small { font-size: 13px; color: var(--hy-muted); }
.facts { display: grid; grid-template-columns: minmax(90px,1fr) minmax(0,2fr); gap: 10px 14px; margin: 0; font-size: 13px; line-height: 1.6; }
.facts dt { color: var(--hy-muted); }
.facts dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
@keyframes forward { from { opacity: .3; transform: translateX(12px); } to { opacity: 1; transform: none; } }
@keyframes backward { from { opacity: .3; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
.page[data-hatagoes='true'] { animation-name: goes-forward; animation-duration: 160ms; }
.page[data-hatagoes='true'][data-direction='-1'] { animation-name: goes-backward; }
@keyframes goes-forward { from { opacity: .35; transform: translateX(4px); } to { opacity: 1; transform: none; } }
@keyframes goes-backward { from { opacity: .35; transform: translateX(-4px); } to { opacity: 1; transform: none; } }
@container hy-dialog (max-width: 560px) { .extras { grid-template-columns: 1fr; } .page { gap: 20px; } }
@media (prefers-reduced-motion: reduce) { .page:not([data-hatagoes='true']) { animation: none; } }
</style>
