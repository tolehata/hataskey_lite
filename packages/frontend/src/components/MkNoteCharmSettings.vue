<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.root">
	<header :class="$style.heading">
		<h3><slot name="label">{{ i18n.ts._noteCharm.title }}</slot></h3>
		<button ref="infoButton" type="button" class="_button" :class="$style.iconButton" :aria-label="i18n.ts._noteCharm.info" aria-haspopup="dialog" :aria-expanded="infoOpen" :aria-controls="infoId" @click="toggleInfo">
			<i class="ti ti-info-circle" aria-hidden="true"></i><span :class="$style.srOnly">{{ i18n.ts._noteCharm.info }}</span>
		</button>
	</header>
	<Teleport to="body">
		<MkModal v-if="infoOpen" ref="infoModal" preferType="dialog" zPriority="high" :returnFocusTo="infoButton" @click="closeInfo" @esc="closeInfo" @closed="infoOpen = false">
			<div :id="infoId" :class="$style.info" :style="infoTheme" role="dialog" aria-modal="true" :aria-labelledby="infoTitleId">
				<header :class="$style.infoHeader">
					<h3 :id="infoTitleId">{{ i18n.ts._noteCharm.info }}</h3>
					<button ref="infoClose" type="button" class="_button" :class="$style.iconButton" :aria-label="i18n.ts.close" @click="closeInfo"><i class="ti ti-x" aria-hidden="true"></i></button>
				</header>
				<div :class="$style.infoContent">
					<section>
						<h4>{{ i18n.ts._noteCharm.conditions }}</h4>
						<p>{{ i18n.ts._noteCharm.accountScope }}</p>
						<ul><li>{{ i18n.ts._noteCharm.roleCondition }}</li><li>{{ i18n.ts._noteCharm.uiCondition }}</li></ul>
					</section>
					<section :class="$style.saved">
						<div :class="$style.consentHeading">
							<h4>{{ i18n.ts._noteCharm.consentTerms }}</h4>
							<span v-if="consented && !consentLoading && !consentLoadFailed" role="status" :class="$style.consentStatus"><i class="ti ti-check" aria-hidden="true"></i>{{ i18n.ts._noteCharm.consentAgreed }}</span>
						</div>
						<ul><li v-for="term in consentTerms" :key="term">{{ term }}</li></ul>
					</section>
					<section :class="$style.saved">
						<h4>{{ i18n.ts._noteCharm.saved }}</h4>
						<template v-if="savedSettings">
							<dl :class="$style.savedValues">
								<div><dt>{{ i18n.ts._noteCharm.image }}</dt><dd>{{ savedFile?.name ?? savedSettings.fileId }}</dd></div>
								<div><dt>{{ i18n.ts._noteCharm.enabled }}</dt><dd><i :class="savedSettings.enabled ? 'ti ti-check' : 'ti ti-minus'" aria-hidden="true"></i><span :class="$style.srOnly">{{ savedSettings.enabled ? i18n.ts.enabled : i18n.ts.disabled }}</span></dd></div>
								<div><dt>{{ i18n.ts._noteCharm.width }}</dt><dd>{{ savedSettings.size }} px</dd></div>
								<div><dt>{{ i18n.ts._noteCharm.pattern }}</dt><dd>{{ i18n.ts._noteCharm.patterns[savedSettings.pattern] }}</dd></div>
								<div><dt>{{ i18n.ts._noteCharm.color }}</dt><dd>{{ savedSettings.color }}</dd></div>
							</dl>
							<MkNoteCharmPreview v-if="!mobileDisplay && savedCharm" :charm="savedCharm"/>
						</template>
						<p v-else>{{ i18n.ts._noteCharm.noSaved }}</p>
					</section>
				</div>
			</div>
		</MkModal>
	</Teleport>
	<p v-if="!canUse" role="status" :class="$style.unavailable">{{ unavailableReason }}</p>
	<p v-else-if="consentLoading" role="status">{{ i18n.ts.loading }}</p>
	<div v-else-if="consentLoadFailed" ref="consentRetryPanel" class="_gaps_m">
		<p role="alert" :class="$style.error">{{ i18n.ts._noteCharm.consentLoadFailed }}</p>
		<div class="_buttonsCenter"><MkButton @click="loadConsent">{{ i18n.ts.retry }}</MkButton></div>
	</div>
	<div v-else-if="!consented" ref="consentPanel" class="_gaps_m" :class="$style.consent" :aria-busy="consentSaving">
		<h4>{{ i18n.ts._noteCharm.consentTitle }}</h4>
		<p>{{ i18n.ts._noteCharm.consentBody }}</p>
		<ul><li v-for="term in consentTerms" :key="term">{{ term }}</li></ul>
		<p v-if="consentError" ref="consentErrorElement" role="alert" tabindex="-1" :class="$style.error">{{ consentError }}</p>
		<div class="_buttonsCenter"><MkButton primary :wait="consentSaving" @click="agree">{{ i18n.ts._noteCharm.consentAgree }}</MkButton></div>
	</div>
	<p v-if="imageLoadFailed" role="alert" :class="$style.error">{{ i18n.ts._noteCharm.imageLoadFailed }}</p>
	<div v-if="canEdit" ref="editor">
		<ol :class="$style.steps" role="list">
			<li class="_gaps_m">
				<h4 :class="$style.stepHeading"><span :class="$style.stepNumber" aria-hidden="true">1</span>{{ i18n.ts._noteCharm.stepImage }}</h4>
				<div :class="$style.imageRow">
					<div :class="$style.imageLabel"><span>{{ i18n.ts._noteCharm.image }}</span><span :class="$style.muted">{{ i18n.ts._noteCharm.slotCount }}</span></div>
					<div class="_buttons">
						<MkButton :disabled="saving" @click="chooseImage">{{ draft.fileId ? i18n.ts._noteCharm.replaceImage : i18n.ts._noteCharm.chooseImage }}</MkButton>
						<MkButton v-if="draft.fileId" :disabled="saving" @click="removeImage">{{ i18n.ts._noteCharm.removeImage }}</MkButton>
					</div>
					<div :class="$style.fileRequirements">{{ i18n.ts._noteCharm.fileRequirements }}</div>
				</div>
			</li>
			<li class="_gaps_m">
				<h4 :class="$style.stepHeading"><span :class="$style.stepNumber" aria-hidden="true">2</span>{{ i18n.ts._noteCharm.stepStyle }}</h4>
				<MkNoteCharmPreview :charm="draftCharm"/>
				<MkRange v-model="draft.size" :min="CHARM_MIN_SIZE" :max="CHARM_MAX_SIZE" :step="1" :continuousUpdate="true" :disabled="saving || !draft.fileId" :textConverter="value => `${value} px`">
					<template #label><span :class="$style.widthLabel">{{ i18n.ts._noteCharm.width }}<output>{{ draft.size }} px</output></span></template>
				</MkRange>
				<fieldset :disabled="saving || !draft.fileId" :class="$style.patternField">
					<legend>{{ i18n.ts._noteCharm.pattern }}</legend>
					<div :class="$style.patterns">
						<label v-for="pattern in patterns" :key="pattern" :class="$style.patternChoice" :data-selected="draft.pattern === pattern">
							<input v-model="draft.pattern" type="radio" :name="patternGroup" :value="pattern">
							<span :class="$style.swatch" :data-pattern="pattern" :style="{ '--charm-swatch-color': draft.color }" aria-hidden="true"></span>
							<span>{{ i18n.ts._noteCharm.patterns[pattern] }}</span>
						</label>
					</div>
				</fieldset>
				<MkColorInput :key="colorVersion" v-model="draft.color" :disabled="saving || !draft.fileId"><template #label>{{ i18n.ts._noteCharm.color }}</template></MkColorInput>
			</li>
			<li class="_gaps_m">
				<h4 :class="$style.stepHeading"><span :class="$style.stepNumber" aria-hidden="true">3</span>{{ i18n.ts._noteCharm.stepSave }}</h4>
				<MkSwitch v-model="draft.enabled" :disabled="saving || !draft.fileId"><template #label>{{ i18n.ts._noteCharm.enabled }}</template></MkSwitch>
				<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>
				<p v-if="savedSuccessfully" role="status">{{ i18n.ts._noteCharm.savedSuccessfully }}</p>
				<div class="_buttonsCenter"><MkButton primary :wait="saving" :disabled="!dirty" @click="save">{{ i18n.ts._noteCharm.save }}</MkButton></div>
			</li>
		</ol>
	</div>
	<div v-if="!mobileDisplay" class="_gaps_m" :class="$style.viewer">
		<MkSwitch :modelValue="noteCharmDisplay.show" @update:modelValue="value => setNoteCharmDisplay({ show: value })"><template #label>{{ i18n.ts._noteCharm.show }}</template></MkSwitch>
		<MkSwitch :modelValue="noteCharmDisplay.showOthers" :disabled="!noteCharmDisplay.show" @update:modelValue="value => setNoteCharmDisplay({ showOthers: value })"><template #label>{{ i18n.ts._noteCharm.showOthers }}</template></MkSwitch>
		<MkSwitch :modelValue="noteCharmDisplay.motion" :disabled="!noteCharmDisplay.show" @update:modelValue="value => setNoteCharmDisplay({ motion: value })"><template #label>{{ i18n.ts._noteCharm.motion }}</template></MkSwitch>
		<MkSwitch :modelValue="noteCharmDisplay.wind" :disabled="!noteCharmDisplay.show || !noteCharmDisplay.motion" @update:modelValue="value => setNoteCharmDisplay({ wind: value })"><template #label>{{ i18n.ts._noteCharm.wind }}</template></MkSwitch>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, useTemplateRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkButton from '@/components/MkButton.vue';
import MkModal from '@/components/MkModal.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRange from '@/components/MkRange.vue';
import MkColorInput from '@/components/MkColorInput.vue';
import MkNoteCharmPreview from '@/components/MkNoteCharmPreview.vue';
import { useNoteCharmAvailability } from '@/composables/use-note-charm-context.js';
import { useNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';
import { noteCharmDisplay, setNoteCharmDisplay } from '@/utility/hatasaba-device-prefs.js';
import { CHARM_DEFAULT_SIZE, CHARM_MAX_SIZE, CHARM_MIN_SIZE, clampCharm } from '@/utility/note-charm-physics.js';
import { chooseDriveFile } from '@/utility/drive.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { updateCurrentAccount } from '@/accounts.js';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';

type Pattern = 'cutout' | 'clear' | 'dots' | 'stripes' | 'check';
type Settings = { fileId: string; enabled: boolean; size: number; pattern: Pattern; color: string };
const $i = ensureSignin();
const mobileDisplay = useNoteCharmMobileDisplay();
const supportedUi = useNoteCharmAvailability();
const canUse = computed(() => $i.policies.canUseNoteCharm && supportedUi.value);
const consented = ref(false);
const consentLoading = ref(true);
const consentLoadFailed = ref(false);
const consentSaving = ref(false);
const consentError = ref('');
const consentRetryPanel = useTemplateRef('consentRetryPanel');
const consentPanel = useTemplateRef('consentPanel');
const consentErrorElement = useTemplateRef('consentErrorElement');
const editor = useTemplateRef('editor');
const canEdit = computed(() => canUse.value && consented.value && !consentLoading.value);
const consentTerms = [
	i18n.ts._noteCharm.consentImageRights,
	i18n.ts._noteCharm.consentProhibitedImages,
	i18n.ts._noteCharm.consentDisplay,
	i18n.ts._noteCharm.consentRecord,
];
// Old account caches can contain a larger size; normalize the view without saving it.
const savedSettings = computed<Settings | null>(() => {
	const settings = $i.noteCharmSettings;
	return settings ? { ...settings, size: clampCharm(Number.isFinite(settings.size) ? settings.size : CHARM_DEFAULT_SIZE, CHARM_MIN_SIZE, CHARM_MAX_SIZE) } : null;
});
const patterns: Pattern[] = ['cutout', 'clear', 'dots', 'stripes', 'check'];
const draft = reactive<{ fileId: string | null; enabled: boolean; size: number; pattern: Pattern; color: string }>({ fileId: null, enabled: true, size: CHARM_DEFAULT_SIZE, pattern: 'cutout', color: '#6ba5e3', ...savedSettings.value });
const files = reactive(new Map<string, Misskey.entities.DriveFile>());
const savedFile = computed(() => savedSettings.value ? files.get(savedSettings.value.fileId) : undefined);
const imageLoadFailed = ref(false);
const saving = ref(false);
const error = ref('');
const savedSuccessfully = ref(false);
const colorVersion = ref(0);
let generation = 0;
let pickerGeneration = 0;
let consentRequest = 0;
let disposed = false;

async function loadConsent() {
	if (disposed || consentSaving.value || (consentLoading.value && consentRequest > 0)) return;
	const focused = window.document.activeElement;
	const restoreFocus = consentRetryPanel.value?.contains(focused) ?? false;
	const current = ++consentRequest;
	consentLoading.value = true;
	consentLoadFailed.value = false;
	try {
		const result = await misskeyApi('hata/consent/get', { type: 'noteCharm' });
		if (disposed || current !== consentRequest) return;
		consented.value = result.agreed === true;
	} catch {
		if (!disposed && current === consentRequest) {
			consented.value = false;
			consentLoadFailed.value = true;
		}
	} finally {
		if (!disposed && current === consentRequest) {
			consentLoading.value = false;
			await nextTick();
			if (!disposed && current === consentRequest && restoreFocus && (window.document.activeElement === focused || window.document.activeElement === window.document.body)) {
				(editor.value ?? consentPanel.value ?? consentRetryPanel.value)?.querySelector('button')?.focus({ preventScroll: true });
			}
		}
	}
}

async function agree() {
	if (!canUse.value || disposed || consented.value || consentLoading.value || consentLoadFailed.value || consentSaving.value) return;
	const focused = window.document.activeElement;
	const restoreFocus = consentPanel.value?.contains(focused) ?? false;
	consentSaving.value = true;
	consentError.value = '';
	try {
		await misskeyApi('hata/consent/update', { type: 'noteCharm', agree: true });
		if (disposed) return;
		consented.value = true;
		await nextTick();
		if (!disposed && restoreFocus && (window.document.activeElement === focused || window.document.activeElement === window.document.body)) {
			editor.value?.querySelector('button')?.focus({ preventScroll: true });
		}
	} catch {
		if (!disposed) consentError.value = i18n.ts._noteCharm.consentRecordFailed;
	} finally {
		if (!disposed) consentSaving.value = false;
	}
}

function payload(): Settings | null {
	return draft.fileId ? { fileId: draft.fileId, enabled: draft.enabled, size: draft.size, pattern: draft.pattern, color: draft.color } : null;
}

function serialize(settings: Settings | null) {
	return settings ? JSON.stringify([settings.fileId, settings.enabled, settings.size, settings.pattern, settings.color]) : 'null';
}

const dirty = computed(() => serialize(payload()) !== serialize(savedSettings.value));
const draftCharm = computed(() => {
	const url = draft.fileId ? files.get(draft.fileId)?.url : undefined;
	return url ? { url, size: draft.size, pattern: draft.pattern, color: draft.color } : null;
});
const savedCharm = computed(() => savedSettings.value && savedFile.value ? { url: savedFile.value.url, size: savedSettings.value.size, pattern: savedSettings.value.pattern, color: savedSettings.value.color } : null);
const unavailableReason = computed(() => mobileDisplay.value ? i18n.ts._noteCharm.smartphoneUnavailable : !$i.policies.canUseNoteCharm && !supportedUi.value ? i18n.ts._noteCharm.bothUnavailable : !$i.policies.canUseNoteCharm ? i18n.ts._noteCharm.roleUnavailable : i18n.ts._noteCharm.uiUnavailable);

watch(() => serialize(savedSettings.value), (_value, previous) => {
	// Account updates must not discard an unsaved local edit.
	if (serialize(payload()) === previous) {
		if (savedSettings.value && draft.color !== savedSettings.value.color) colorVersion.value++;
		Object.assign(draft, savedSettings.value ?? { fileId: null });
	}
});
watch(() => savedSettings.value?.fileId, async fileId => {
	const current = ++generation;
	imageLoadFailed.value = false;
	if (!fileId || files.has(fileId)) return;
	try {
		const file = await misskeyApi('drive/files/show', { fileId });
		if (disposed || current !== generation) return;
		files.set(fileId, file);
	} catch {
		if (!disposed && current === generation) imageLoadFailed.value = true;
	}
}, { immediate: true });

async function chooseImage() {
	if (!canEdit.value || saving.value) return;
	const current = ++pickerGeneration;
	error.value = '';
	try {
		const [file] = await chooseDriveFile({ multiple: false, excludeSensitive: true });
		if (!file || disposed || current !== pickerGeneration || !canEdit.value || saving.value) return;
		if (file.userId !== $i.id || file.isSensitive || !['image/png', 'image/webp', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
			error.value = i18n.ts._noteCharm.invalidFile;
			return;
		}
		files.set(file.id, file);
		draft.fileId = file.id;
		savedSuccessfully.value = false;
	} catch {
		if (!disposed && current === pickerGeneration) error.value = i18n.ts._noteCharm.invalidFile;
	}
}

function removeImage() {
	if (!canEdit.value || saving.value) return;
	pickerGeneration++;
	draft.fileId = null;
	error.value = '';
	savedSuccessfully.value = false;
}

async function save() {
	if (!canEdit.value || saving.value || !dirty.value) return;
	const focused = window.document.activeElement;
	const restoreFocus = editor.value?.contains(focused) ?? false;
	saving.value = true;
	error.value = '';
	savedSuccessfully.value = false;
	try {
		const result = await misskeyApi('i/update', { noteCharm: payload() });
		updateCurrentAccount(result);
		if (!disposed) savedSuccessfully.value = true;
	} catch (err) {
		if (disposed) return;
		if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'NOTE_CHARM_NOT_CONSENTED') {
			consented.value = false;
			pickerGeneration++;
			consentError.value = i18n.ts._noteCharm.consentRequired;
			await nextTick();
			if (!disposed && restoreFocus && (window.document.activeElement === focused || window.document.activeElement === window.document.body)) {
				consentErrorElement.value?.focus({ preventScroll: true });
			}
		} else {
			error.value = i18n.ts._noteCharm.saveFailed;
		}
	} finally {
		if (!disposed) saving.value = false;
	}
}

const infoId = useId();
const infoTitleId = useId();
const patternGroup = useId();
const infoOpen = ref(false);
const infoButton = useTemplateRef('infoButton');
const infoModal = useTemplateRef('infoModal');
const infoClose = useTemplateRef('infoClose');
const infoTheme = ref<CSSProperties>({});

async function toggleInfo() {
	if (infoOpen.value) return closeInfo();
	// The dialog leaves the settings subtree; retain its locally applied theme.
	const theme = window.getComputedStyle(infoButton.value!);
	infoTheme.value = Object.fromEntries(Array.from(theme).filter(name => name.startsWith('--MI_THEME-') || name === '--MI-radius').map(name => [name, theme.getPropertyValue(name)]));
	infoOpen.value = true;
	await nextTick();
	if (infoOpen.value && !disposed) infoClose.value?.focus({ preventScroll: true });
}

function closeInfo() {
	infoModal.value?.close();
}

onMounted(() => {
	void loadConsent();
});
onBeforeUnmount(() => {
	disposed = true;
	generation++;
	pickerGeneration++;
	consentRequest++;
});
</script>

<style lang="scss" module>
.root { container-type: inline-size; min-width: 0; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.heading h3 { margin: 0; font-size: 1em; }
.consent { line-height: 1.6; }
.consentHeading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px; }
.consentStatus { display: inline-flex; align-items: center; gap: 4px; color: var(--MI_THEME-accent); font-size: 0.9em; white-space: nowrap; }
.steps { box-sizing: border-box; min-width: 0; display: grid; gap: 4px; list-style: none; margin: 0; padding: 8px; border: 1px solid var(--MI_THEME-divider); border-radius: var(--MI-radius); background: var(--MI_THEME-panel); }
.steps > li { min-width: 0; gap: 10px; padding: 14px 12px; }
.steps > li + li { border-top: 1px solid var(--MI_THEME-divider); }
.stepHeading { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1em; }
.stepNumber { display: grid; place-items: center; flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: 11px; font-variant-numeric: tabular-nums; }
.consent h4, .consent p, .consent ul { margin-block: 0; }
.consent ul { padding-inline-start: 20px; }
.iconButton { display: grid; place-items: center; min-width: 44px; min-height: 44px; border-radius: 50%; color: var(--MI_THEME-accent); font-size: 20px; }
.iconButton:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
.iconButton[aria-expanded="true"] { background: var(--MI_THEME-accentedBg); }
.info { box-sizing: border-box; width: 520px; max-width: 100%; max-height: 100%; min-height: 0; margin: auto; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--MI_THEME-divider); border-radius: var(--MI-radius); background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); overflow-wrap: anywhere; font-size: 0.9em; box-shadow: 0 8px 24px #0003; }
.infoHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; padding: 8px 12px 8px 20px; background: var(--MI_THEME-windowHeader); border-bottom: 1px solid var(--MI_THEME-divider); }
.infoHeader h3 { margin: 0; font-size: 1em; }
.infoContent { position: relative; min-height: 0; padding: 20px; overflow-y: auto; overscroll-behavior: contain; }
.info h4 { margin: 0; font-size: 1em; }
.info p { margin: 8px 0; line-height: 1.6; }
.info ul { padding-left: 20px; line-height: 1.6; }
.saved { padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--MI_THEME-divider); }
.savedValues { margin: 0 0 16px; }
.savedValues > div { display: flex; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; padding: 7px 0; }
.savedValues dt { color: var(--MI_THEME-fgTransparentWeak); }
.savedValues dd { margin: 0; }
.unavailable { margin: 0; padding: 20px 0; line-height: 1.6; }
.imageRow { display: grid; gap: 10px; }
.imageLabel { display: flex; justify-content: space-between; gap: 12px; }
.muted, .fileRequirements { color: var(--MI_THEME-fgTransparentWeak); font-size: 0.85em; }
.widthLabel { display: flex; justify-content: space-between; gap: 12px; }
.widthLabel output { font-variant-numeric: tabular-nums; }
.patternField { border: 0; padding: 0; margin: 0; min-width: 0; }
.patternField legend { padding: 0 0 10px; font-size: 0.85em; }
.patterns { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.patternChoice { display: grid; justify-items: center; gap: 7px; min-width: 0; padding: 9px 4px; border: 1px solid var(--MI_THEME-divider); border-radius: 10px; cursor: pointer; font-size: 0.8em; }
.patternChoice[data-selected="true"] { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.patternChoice:focus-within { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
.patternChoice input { accent-color: var(--MI_THEME-accent); margin: 0; }
.patternField:disabled { opacity: 0.6; }
.swatch { width: 32px; height: 36px; border: 2px solid var(--charm-swatch-color); border-radius: 10px; background-color: color-mix(in srgb, var(--charm-swatch-color) 12%, var(--MI_THEME-panel)); }
.swatch[data-pattern="cutout"] { border-style: dashed; background: transparent; }
.swatch[data-pattern="dots"] { background-image: radial-gradient(var(--charm-swatch-color) 1px, transparent 1px); background-size: 7px 7px; }
.swatch[data-pattern="stripes"] { background-image: repeating-linear-gradient(135deg, transparent 0 5px, var(--charm-swatch-color) 5px 7px); }
.swatch[data-pattern="check"] { background-image: conic-gradient(var(--charm-swatch-color) 25%, transparent 0 50%, var(--charm-swatch-color) 0 75%, transparent 0); background-size: 12px 12px; }
.viewer { padding-top: 20px; margin-top: 20px; border-top: 1px solid var(--MI_THEME-divider); }
.error { color: var(--MI_THEME-error); margin: 0; line-height: 1.6; }
.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@container (max-width: 400px) { .patterns { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
