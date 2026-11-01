<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- 旗鯖fork: 設定画面の右ペインへ埋め込むときは、窓そのものを枠なしへ差し替える。
     ⚠️窓は position: fixed の重ね表示なので、CSSでペインの中へは収められない。
     ⚠️受け口(#header / 本体 / close())は同じ形なので、中身には手を触れない。 -->
<component :is="embedded ? SettingsEmbeddedWindow : MkWindow"
	ref="transferWindow"
	:initialWidth="560"
	:initialHeight="680"
	:canResize="true"
	:closeButton="true"
	:front="true"
	@closed="emit('closed')"
>
	<template #header>
		<span id="hata-settings-transfer-title" :class="$style.windowHeader"><i class="ti ti-arrows-exchange"></i><span>{{ copy.title }}</span><em>{{ mode === 'export' ? copy.exportMode : copy.importMode }}</em></span>
	</template>
	<section
		data-hata-settings-transfer-window
		:data-embedded="embedded ? 'true' : undefined"
		:class="$style.window"
		role="dialog"
		aria-modal="false"
		aria-labelledby="hata-settings-transfer-title"
		:aria-busy="busy || dedicatedExportBusy != null"
	>
		<div data-hata-settings-transfer-scroll :class="$style.scrollArea">
			<div :class="$style.body">
				<div :class="$style.modeTabs">
					<button type="button" :class="[$style.modeTab, mode === 'export' && $style.modeTabActive]" @click="mode = 'export'"><i class="ti ti-file-export"></i> {{ copy.exportTab }}</button>
					<button type="button" :class="[$style.modeTab, mode === 'import' && $style.modeTabActive]" @click="mode = 'import'"><i class="ti ti-file-import"></i> {{ copy.importTab }}</button>
				</div>

				<div :class="$style.notice">
					<i class="ti ti-shield-lock"></i>
					<div><b>{{ copy.privacyTitle }}</b><br>{{ copy.privacyDescription }}</div>
				</div>

				<template v-if="mode === 'export'">
					<div :class="$style.lead">{{ copy.exportLead }}</div>
					<div :class="$style.categoryList">
						<label v-for="category in categories" :key="category.id" :class="$style.categoryItem">
							<input v-model="selectedExport" type="checkbox" :value="category.id">
							<span :class="$style.checkVisual"><i class="ti ti-check"></i></span>
							<span :class="$style.categoryCopy"><b>{{ category.label }}</b><small>{{ category.description }}</small></span>
						</label>
					</div>
					<div :class="$style.privacyWarning" role="note">
						<i class="ti ti-eye-exclamation"></i>
						<div><b>{{ copy.urlWarningTitle }}</b><br>{{ copy.urlWarningDescription }}</div>
					</div>
					<section :class="$style.dedicatedExports" aria-labelledby="hata-dedicated-export-title">
						<div :class="$style.dedicatedHeading">
							<i class="ti ti-database-export"></i>
							<div>
								<b id="hata-dedicated-export-title">{{ copy.dedicatedExportTitle }}</b>
								<small>{{ copy.dedicatedExportDescription }}</small>
							</div>
						</div>
						<div :class="$style.dedicatedGrid">
							<button type="button" :class="$style.dedicatedButton" :disabled="busy || dedicatedExportBusy != null" @click="openHatadyExport">
								<span :class="$style.dedicatedIcon"><i v-if="dedicatedExportBusy === 'hatady'" class="ti ti-loader-2"></i><HataAppLogo v-else app="hatady" :size="32" :monochrome="store.r.darkMode.value"/></span>
								<span :class="$style.dedicatedCopy"><b><HataAppWordmark app="hatady" inheritColor/></b><small>{{ copy.hatadyExportDescription }}</small></span>
								<i class="ti ti-chevron-right" :class="$style.dedicatedArrow"></i>
							</button>
							<button type="button" :class="$style.dedicatedButton" :disabled="busy || dedicatedExportBusy != null" @click="openHataFeedExport">
								<span :class="$style.dedicatedIcon"><i v-if="dedicatedExportBusy === 'hatafeed'" class="ti ti-loader-2"></i><HataAppLogo v-else app="hatafeed" :size="32" :monochrome="store.r.darkMode.value"/></span>
								<span :class="$style.dedicatedCopy"><b><HataAppWordmark app="hatafeed" inheritColor/></b><small>{{ copy.hatafeedExportDescription }}</small></span>
								<i class="ti ti-chevron-right" :class="$style.dedicatedArrow"></i>
							</button>
						</div>
					</section>
				</template>

				<template v-else>
					<div :class="$style.lead">{{ copy.importLead }}</div>
					<button type="button" :class="$style.fileButton" :disabled="busy" @click="chooseFile"><i class="ti ti-file-search"></i> {{ copy.chooseFile }}</button>

					<div v-if="importFile" :class="$style.fileSummary">
						<div :class="$style.fileTitle"><i class="ti ti-file-check"></i><span><b>{{ importFileName }}</b><small>{{ copyx.fileSource({ serverVersion: importFile.serverVersion, formatVersion: importFile.formatVersion.toString() }) }}</small></span></div>
						<div v-if="compatibilityNotice" :class="$style.warning"><i class="ti ti-alert-triangle"></i>{{ compatibilityNotice }}</div>
						<div v-if="unknownCategoryCount > 0" :class="$style.skipNote">{{ copyx.unknownCategoriesSkipped({ count: unknownCategoryCount.toString() }) }}</div>
					</div>

					<div v-if="importFile" :class="$style.categoryList">
						<label v-for="category in importableCategories" :key="category.id" :class="$style.categoryItem">
							<input v-model="selectedImport" type="checkbox" :value="category.id">
							<span :class="$style.checkVisual"><i class="ti ti-check"></i></span>
							<span :class="$style.categoryCopy"><b>{{ category.label }}</b><small>{{ category.description }}</small></span>
						</label>
					</div>
				</template>
			</div>
		</div>

		<footer :class="$style.actionBar">
			<div :class="$style.selectionSummary" aria-live="polite">
				<span v-if="mode === 'export'">{{ copyx.categorySelection({ selected: selectedExport.length.toString(), total: categories.length.toString() }) }}</span>
				<span v-else-if="importFile">{{ copyx.categorySelection({ selected: selectedImport.length.toString(), total: importableCategories.length.toString() }) }}</span>
				<span v-else>{{ copy.chooseFilePrompt }}</span>
			</div>
			<div :class="$style.footerButtons">
				<button type="button" :class="$style.secondaryButton" @click="closeWindow">{{ copy.close }}</button>
				<button v-if="mode === 'export'" type="button" :class="$style.primaryButton" :disabled="busy || selectedExport.length === 0" @click="doExport"><i class="ti ti-download"></i> {{ copy.exportSelected }}</button>
				<button v-else type="button" :class="$style.primaryButton" :disabled="busy || !importFile || selectedImport.length === 0" @click="doImport"><i class="ti ti-device-floppy"></i> {{ copy.importSelected }}</button>
			</div>
		</footer>
	</section>
</component>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import type { HataSettingsCategoryId, HataSettingsTransferFile } from '@/utility/hata-settings-transfer.js';
import MkWindow from '@/components/MkWindow.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import {
	applyHataSettingsTransfer,
	createHataSettingsTransfer,
	downloadHataSettingsTransfer,
	getVersionMismatchMessage,
	HATA_SETTINGS_CATEGORIES,
	HATA_SETTINGS_TRANSFER_MAX_BYTES,
	HATA_SETTINGS_TRANSFER_VERSION,
	parseHataSettingsTransfer,
} from '@/utility/hata-settings-transfer.js';

const copy = i18n.ts._hata._settingsTransfer._window;
const copyx = i18n.tsx._hata._settingsTransfer._window;

const emit = defineEmits<{ (ev: 'closed'): void }>();
/**
 * 旗鯖fork: 窓と埋め込みのどちらでも通る参照の型。
 * ⚠️片方の窓の型に固定すると、埋め込みへ差し替えたときに型が合わなくなる。
 *   実際に使うのは close() だけなので、そこだけを約束する。
 */
type SettingsWindowHandle = { close: () => void };
const transferWindow = useTemplateRef<SettingsWindowHandle>('transferWindow');
const categories = HATA_SETTINGS_CATEGORIES;
const mode = ref<'export' | 'import'>('export');
const busy = ref(false);
const selectedExport = ref<HataSettingsCategoryId[]>(categories.map(category => category.id));
const selectedImport = ref<HataSettingsCategoryId[]>([]);
const importFile = ref<HataSettingsTransferFile | null>(null);
const importFileName = ref('');
const unknownCategoryCount = ref(0);
const dedicatedExportBusy = ref<'hatady' | 'hatafeed' | null>(null);

function closeWindow() {
	transferWindow.value?.close();
}

type HataFeedProject = {
	id: string;
	name: string;
	isOfficial?: boolean;
};

const importableCategories = computed(() => {
	const file = importFile.value;
	return file == null ? [] : categories.filter(category => Object.hasOwn(file.categories, category.id));
});
const compatibilityNotice = computed(() => {
	if (!importFile.value) return null;
	const messages: string[] = [];
	const server = getVersionMismatchMessage(importFile.value);
	if (server) messages.push(server);
	if (importFile.value.formatVersion !== HATA_SETTINGS_TRANSFER_VERSION) {
		messages.push(copyx.formatVersionMismatch({ version: HATA_SETTINGS_TRANSFER_VERSION.toString() }));
	}
	return messages.length > 0 ? messages.join('\n') : null;
});

async function doExport() {
	busy.value = true;
	try {
		const file = await createHataSettingsTransfer(selectedExport.value);
		downloadHataSettingsTransfer(file);
		os.toast(copy.exportComplete);
	} catch (error) {
		console.error(error);
		os.alert({ type: 'error', text: copy.exportFailed });
	} finally {
		busy.value = false;
	}
}

async function openHatadyExport() {
	if (dedicatedExportBusy.value != null) return;
	dedicatedExportBusy.value = 'hatady';
	try {
		const { dispose } = os.popup((await import('@/components/HatadyExportDialog.vue')).default, {}, {
			closed: () => dispose(),
		});
	} catch (error) {
		console.error(error);
		os.alert({ type: 'error', title: copy.hatadyExportOpenFailedTitle, text: copy.reloadAndRetry });
	} finally {
		dedicatedExportBusy.value = null;
	}
}

async function openHataFeedExport() {
	if (dedicatedExportBusy.value != null) return;
	dedicatedExportBusy.value = 'hatafeed';
	try {
		const availability = await misskeyApi('hata/feedback/available', {}) as { available: boolean; isStaff: boolean };
		if (!availability.available) {
			await os.alert({ type: 'info', title: copy.hatafeedUnavailableTitle, text: copy.hatafeedUnavailableDescription });
			return;
		}

		const projects = await misskeyApi('hata/feedback/projects', {
			mine: !availability.isStaff,
			limit: 100,
		}) as unknown as HataFeedProject[];
		const exportableProjects = projects.filter(project => !project.isOfficial);
		const items = [
			...(availability.isStaff ? [{ value: '__official__', label: copy.hataskeyOfficial }] : []),
			...exportableProjects.map(project => ({ value: project.id, label: project.name })),
		];

		if (items.length === 0) {
			await os.alert({
				type: 'info',
				title: copy.noExportableHatafeedTitle,
				text: copy.noExportableHatafeedDescription,
			});
			return;
		}

		const selection = items.length === 1
			? { canceled: false as const, result: items[0].value }
			: await os.select<string>({
				title: copy.hatafeedExportTargetTitle,
				text: copy.hatafeedExportTargetDescription,
				items,
			});
		if (selection.canceled) return;

		const project = exportableProjects.find(candidate => candidate.id === selection.result) ?? null;
		if (selection.result !== '__official__' && project == null) {
			await os.alert({ type: 'error', title: copy.exportTargetMissingTitle, text: copy.reloadHatafeedAndRetry });
			return;
		}
		const projectId = selection.result === '__official__' ? null : (project?.id ?? null);
		const projectName = selection.result === '__official__' ? 'Hataskey' : project?.name;
		if (projectName == null || (selection.result !== '__official__' && projectId == null)) {
			await os.alert({ type: 'error', title: copy.exportTargetMissingTitle, text: copy.reloadHatafeedAndRetry });
			return;
		}
		const { dispose } = os.popup((await import('@/components/HataFeedExportWindow.vue')).default, {
			projectId,
			projectName,
		}, {
			closed: () => dispose(),
		});
	} catch (error) {
		console.error(error);
		os.alert({ type: 'error', title: copy.hatafeedExportOpenFailedTitle, text: copy.checkPermissionAndConnection });
	} finally {
		dedicatedExportBusy.value = null;
	}
}

function chooseFile() {
	const input = window.document.createElement('input');
	input.type = 'file';
	input.accept = '.json,application/json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		if (file.size > HATA_SETTINGS_TRANSFER_MAX_BYTES) {
			os.alert({ type: 'error', text: copy.fileTooLarge });
			return;
		}
		try {
			const parsed = parseHataSettingsTransfer(await file.text());
			const warnings: string[] = [];
			const serverWarning = getVersionMismatchMessage(parsed.file);
			if (serverWarning) warnings.push(serverWarning);
			if (parsed.file.formatVersion !== HATA_SETTINGS_TRANSFER_VERSION) warnings.push(copyx.formatVersionAlsoMismatch({ version: HATA_SETTINGS_TRANSFER_VERSION.toString() }));
			if (warnings.length > 0) {
				const { canceled } = await os.confirm({
					type: 'warning',
					title: copy.differentVersionTitle,
					text: copyx.continueCompatibleImport({ warnings: warnings.join('\n\n') }),
				});
				if (canceled) return;
			}
			importFile.value = parsed.file;
			importFileName.value = file.name;
			unknownCategoryCount.value = parsed.unknownCategories.length;
			selectedImport.value = importableCategories.value.map(category => category.id);
		} catch (error) {
			console.error(error);
			os.alert({ type: 'error', title: copy.cannotImportTitle, text: copy.cannotImportDescription });
		}
	};
	input.click();
}

async function doImport() {
	if (!importFile.value) return;
	const labels = categories.filter(category => selectedImport.value.includes(category.id)).map(category => category.label);
	const { canceled } = await os.confirm({
		type: 'warning',
		title: copy.confirmImportTitle,
		text: copyx.confirmImportDescription({ categories: labels.join(copy.categorySeparator) }),
	});
	if (canceled) return;
	busy.value = true;
	try {
		const result = await applyHataSettingsTransfer(importFile.value, selectedImport.value);
		const skippedDetails = result.skipped.slice(0, 8).map(item => copyx.skippedDetail({ category: item.category, key: item.key, reason: item.reason })).join('\n');
		const resultLines = [
			copyx.appliedCount({ count: result.applied.toString() }),
			copyx.skippedCount({ count: result.skipped.length.toString() }),
			...(skippedDetails ? ['', skippedDetails] : []),
			...(result.skipped.length > 8 ? [copy.moreItems] : []),
		];
		await os.alert({
			type: result.skipped.length > 0 ? 'warning' : 'success',
			title: copy.importCompleteTitle,
			text: resultLines.join('\n'),
		});
		const reload = await os.confirm({ type: 'info', title: copy.applyToScreenTitle, text: copy.reloadToApplyDescription });
		if (!reload.canceled) window.location.reload();
	} catch (error) {
		console.error(error);
		os.alert({ type: 'error', text: copy.importFailed });
	} finally {
		busy.value = false;
	}
}

/** 旗鯖fork: true なら窓の枠を持たず、設定画面の右ペインの中身として描く。 */
defineProps<{ embedded?: boolean }>();
</script>

<style lang="scss" module>
.window {
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	min-height: 0;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	overflow: hidden;
	background: var(--MI_THEME-bg);
}

.windowHeader {
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 8px;
}

.windowHeader > i { flex: 0 0 auto; color: var(--MI_THEME-accent); }
.windowHeader > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.windowHeader > em { flex: 0 0 auto; padding: 2px 7px; border-radius: 9999px; color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); font-size: .72em; font-style: normal; font-weight: 800; }

.scrollArea {
	min-height: 0;
	overflow: auto;
	overscroll-behavior: contain;
	scrollbar-gutter: stable;
	background: var(--MI_THEME-bg);
}

// 埋め込み時は設定の右ペインがスクロールを受け持つ。
// 内容高まで広がる内側の器に contain を残すと、ホイールが右ペインへ渡らない。
.window[data-embedded='true'] {
	height: auto;
	overflow: visible;
}

.window[data-embedded='true'] .scrollArea {
	overflow: visible;
	overscroll-behavior: auto;
	scrollbar-gutter: auto;
}

.body { padding:clamp(14px,3%,20px); display:flex; flex-direction:column; gap:16px; color:var(--MI_THEME-fg); }
.modeTabs { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; border-radius:9999px; background:var(--MI_THEME-bg); }
.modeTab { min-height:40px; border:0; border-radius:9999px; color:inherit; background:transparent; cursor:pointer; font:inherit; font-weight:700; }
.modeTabActive { color:var(--MI_THEME-accent); background:var(--MI_THEME-panel); box-shadow:0 2px 12px rgba(0,0,0,.08); }
.notice { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid color-mix(in srgb,var(--MI_THEME-accent) 28%,var(--MI_THEME-divider)); border-radius:14px; background:var(--MI_THEME-accentedBg); font-size:.84em; line-height:1.6; }
.notice > i { color:var(--MI_THEME-accent); font-size:1.25em; margin-top:2px; }
.privacyWarning { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid color-mix(in srgb,var(--MI_THEME-warn) 38%,var(--MI_THEME-divider)); border-radius:14px; color:var(--MI_THEME-fg); background:color-mix(in srgb,var(--MI_THEME-warn) 9%,var(--MI_THEME-panel)); font-size:.82em; line-height:1.6; }
.privacyWarning > i { flex:0 0 auto; color:var(--MI_THEME-warn); font-size:1.25em; margin-top:2px; }
.lead { font-size:.86em; line-height:1.65; opacity:.8; }
.categoryList { display:flex; flex-direction:column; gap:8px; }
.categoryItem { display:flex; align-items:center; gap:11px; padding:11px 13px; border:1px solid var(--MI_THEME-divider); border-radius:13px; background:var(--MI_THEME-panel); cursor:pointer; }
.categoryItem > input { position:absolute; opacity:0; pointer-events:none; }
.checkVisual { width:22px; height:22px; flex:0 0 auto; display:grid; place-items:center; border:2px solid var(--MI_THEME-divider); border-radius:7px; color:transparent; transition:.15s ease; }
.categoryItem > input:checked + .checkVisual { color:var(--MI_THEME-accent); border-color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); }
.categoryItem > input:focus-visible + .checkVisual { outline:2px solid var(--MI_THEME-accent); outline-offset:2px; }
.categoryCopy { display:flex; flex-direction:column; gap:2px; min-width:0; }
.categoryCopy small { opacity:.67; line-height:1.4; }
.primaryButton, .secondaryButton, .fileButton { min-height:42px; padding:9px 15px; border:0; border-radius:12px; cursor:pointer; font:inherit; font-weight:800; }
.primaryButton { color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); box-shadow:0 0 0 1px color-mix(in srgb,var(--MI_THEME-accent) 30%,transparent) inset; }
.secondaryButton { color:var(--MI_THEME-fg); background:var(--MI_THEME-buttonBg); }
.fileButton { width:100%; color:var(--MI_THEME-fg); background:var(--MI_THEME-panel); border:1px dashed var(--MI_THEME-accent); }
.primaryButton:disabled, .secondaryButton:disabled, .fileButton:disabled { opacity:.45; cursor:not-allowed; }
.fileSummary { display:flex; flex-direction:column; gap:9px; padding:13px; border-radius:14px; background:var(--MI_THEME-bg); }
.fileTitle { display:flex; gap:10px; align-items:center; }
.fileTitle > i { color:var(--MI_THEME-accent); font-size:1.3em; }
.fileTitle > span { display:flex; flex-direction:column; min-width:0; }
.fileTitle b { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.fileTitle small { opacity:.65; }
.warning { display:flex; gap:8px; white-space:pre-line; padding:10px; border-radius:10px; color:var(--MI_THEME-warn); background:color-mix(in srgb,var(--MI_THEME-warn) 10%,transparent); font-size:.8em; line-height:1.55; }
.skipNote { font-size:.78em; opacity:.7; }
.dedicatedExports { display:flex; flex-direction:column; gap:11px; padding-top:2px; }
.dedicatedHeading { display:flex; align-items:flex-start; gap:10px; }
.dedicatedHeading > i { flex:0 0 auto; margin-top:2px; color:var(--MI_THEME-accent); font-size:1.25em; }
.dedicatedHeading > div { display:flex; flex-direction:column; gap:2px; min-width:0; }
.dedicatedHeading small { opacity:.67; line-height:1.45; }
.dedicatedGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr)); gap:9px; }
.dedicatedButton { min-width:0; min-height:68px; display:grid; grid-template-columns:34px minmax(0,1fr) 18px; align-items:center; gap:9px; padding:11px; border:1px solid var(--MI_THEME-divider); border-radius:14px; color:var(--MI_THEME-fg); background:var(--MI_THEME-panel); cursor:pointer; text-align:left; font:inherit; transition:border-color .15s ease,background .15s ease,transform .15s ease; }
.dedicatedButton:not(:disabled):hover { border-color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); transform:translateY(-1px); }
.dedicatedButton:focus-visible { outline:2px solid var(--MI_THEME-accent); outline-offset:2px; }
.dedicatedButton:disabled { opacity:.55; cursor:not-allowed; }
.dedicatedIcon { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; color:var(--MI_THEME-accent); font-size:1.15em; }
.dedicatedCopy { min-width:0; display:flex; flex-direction:column; gap:2px; }
.dedicatedCopy b { line-height:1.25; }
.dedicatedCopy small { min-width:0; opacity:.67; font-size:.75em; line-height:1.35; overflow-wrap:anywhere; }
.dedicatedArrow { opacity:.45; justify-self:end; }
.dedicatedButton .ti-loader-2 { animation:dedicated-spin .8s linear infinite; }
@keyframes dedicated-spin { to { transform:rotate(360deg); } }

.actionBar {
	min-width: 0;
	min-height: 66px;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 14px max(10px, env(safe-area-inset-bottom, 0px));
	border-top: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-windowHeader);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}

.selectionSummary { flex: 1 1 120px; min-width: 0; color: color-mix(in srgb, var(--MI_THEME-fg) 72%, transparent); font-size: .78em; line-height: 1.4; }
.footerButtons { flex: 1 1 300px; min-width: 0; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.footerButtons > button { flex: 1 1 auto; }
</style>
