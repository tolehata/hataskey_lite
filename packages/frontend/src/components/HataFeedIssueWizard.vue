<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: HataFeed の Issue 作成ウィザード。
  イシューの書き方がわからない利用者向けに、カテゴリ選択→内容入力→確認の3ステップで案内する。
-->
<template>
<!-- 旗鯖fork: モーダル(旧 MkModalWindow)から非モーダルウィンドウ(MkWindow)に変更。
     再現手順を確認するために裏のページを触りながらイシューを書きたい、
     項目数が多く全て覚えるのが困難というユーザー要望(特にデッキUI使用者)に対応。
     MkWindow は移動・リサイズ可能で裏のページがそのまま操作できる。 -->
<MkWindow
	ref="dialog" class="hatady-scope hatafeed-scope"
	data-hatafeed-window
	:data-hatady-theme="hataFeedTheme"
	centerTitle
	:initialWidth="650"
	:initialHeight="690"
	:canResize="true"
	:beforeClose="beforeClose"
	:buttonsLeft="backButtons"
	:inert="prompt"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts._hata._hatafeed._home.newIssue }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div v-if="hasDraft" class="hf-draft-offer"><span>{{ copy.draftAvailable }}</span><button type="button" @click="resumeDraft"><i class="ti ti-pencil-plus" aria-hidden="true"></i>{{ copy.resumeDraft }}</button></div>
		<!-- Step1: カテゴリ -->
		<ol class="hf-stepper"><li v-for="(label, index) in [copy.stepType, copy.stepDetails, copy.stepConfirm]" :key="label" :aria-current="step === index + 1 ? 'step' : undefined"><b>{{ index + 1 }}</b>{{ label }}</li></ol>
		<div v-if="step === 1" :class="$style.categories">
			<button
				v-for="c in availableCategoryKeys"
				:key="c"
				:class="[$style.catCard, category === c && $style.catActive]"
				@click="category = c; step = 2"
			>
				<i :class="[categoryIcon[c], $style.catIcon]"></i>
				<div :class="$style.catText">
					<div :class="$style.catName">{{ categoryLabel[c] }}</div>
					<div :class="$style.catDesc">{{ categoryDesc[c] }}</div>
				</div>
				<i class="ti ti-chevron-right" :class="$style.catArrow"></i>
			</button>
		</div>

		<!-- Step2: 内容 -->
		<div v-else-if="step === 2" :class="$style.gaps">
			<div :class="$style.lead"><span :class="$style.tag">{{ categoryLabel[category] }}</span> {{ copy.detailsLeadSuffix }}</div>
			<MkInput v-model="title" :placeholder="titleHint">
				<template #label>{{ copy.title }} <span :class="$style.req">{{ copy.required }}</span></template>
			</MkInput>
			<MkTextarea v-model="description" :placeholder="descHint">
				<template #label>{{ copy.description }}</template>
				<template #caption>{{ descCaption }}</template>
			</MkTextarea>
			<fieldset :class="$style.environment">
				<legend>{{ copy.environment }} <small>{{ copy.optional }}</small></legend>
				<MkInput v-model="device" :placeholder="copy.deviceExample">
					<template #label>{{ copy.device }}</template>
				</MkInput>
				<MkInput v-model="osVersion" :placeholder="copy.osVersionExample">
					<template #label>{{ copy.osVersion }}</template>
				</MkInput>
				<MkInput v-model="browser" :placeholder="copy.browserExample">
					<template #label>{{ copy.browser }}</template>
				</MkInput>
			</fieldset>
			<p v-if="descriptionTooLong" class="hy-error" role="alert">{{ copy.environmentDescriptionLimit }}</p>
			<div>
				<div :class="$style.fieldLabel">{{ copy.attachments }}</div>
				<div :class="$style.fileGrid">
					<div v-for="f in files" :key="f.id" :class="$style.fileThumb">
						<img :src="f.thumbnailUrl ?? f.url" :alt="f.name"/>
						<button :class="$style.fileDel" @click="files = files.filter(x => x.id !== f.id)"><i class="ti ti-x"></i></button>
					</div>
					<button :class="$style.fileAdd" @click="addFiles"><i class="ti ti-plus"></i></button>
				</div>
			</div>

			<!-- 旗鯖fork: コード提出（任意） -->
			<div>
				<MkSwitch v-model="codeEnabled">
					<template #label><i class="ti ti-code"></i> {{ copy.submitCode }}</template>
					<template #caption>{{ copy.submitCodeHint }}</template>
				</MkSwitch>
				<MkTextarea v-if="codeEnabled" v-model="code" :class="$style.codeArea" :placeholder="copy.codePlaceholder">
					<template #label>{{ copy.code }}</template>
				</MkTextarea>
			</div>

			<div :class="$style.navRow">
				<MkButton rounded primary :disabled="!title.trim() || descriptionTooLong" @click="step = 3">{{ copy.next }} <i class="ti ti-arrow-right"></i></MkButton>
			</div>
		</div>

		<!-- Step3: 確認 -->
		<div v-else :class="$style.gaps">
			<div :class="$style.lead">{{ copy.choosePriority }}</div>
			<MkSelect v-model="priority" :items="priorityItems">
				<template #label>{{ copy.priority }}</template>
			</MkSelect>

			<div :class="$style.summary">
				<div><b>{{ copy.categorySummary }}</b> {{ categoryLabel[category] }}</div>
				<div><b>{{ copy.titleSummary }}</b> {{ title }}</div>
				<div v-if="projectName"><b>{{ copy.projectSummary }}</b> {{ projectName }}</div>
				<div v-for="field in environmentFields" :key="field.label"><b>{{ field.displayLabel }}:</b> {{ field.value }}</div>
			</div>
			<p v-if="descriptionTooLong" class="hy-error" role="alert">{{ copy.environmentDescriptionLimit }}</p>

			<div :class="$style.navRow">
				<MkButton rounded primary gradate :disabled="submitting || descriptionTooLong" @click="submit"><i class="ti ti-send"></i> {{ copy.send }}</MkButton>
			</div>
		</div>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import MkWindow from '@/components/MkWindow.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import '@/components/hatafeed-ui.css';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { iAmModerator } from '@/i.js';
import { categoryLabel, creatableCategoryKeys, staffOnlyCategoryKeys, categoryDesc, categoryIcon } from '@/utility/hatafeed.js';
import type { HataFeedCategory, HataFeedPriority } from '@/utility/hatafeed.js';
import { useHataFeedDraft } from '@/utility/hatafeed-draft.js';

const props = defineProps<{ projectId: string | null; projects: any[] }>();
const emit = defineEmits<{ (ev: 'done', v: any): void; (ev: 'closed'): void }>();

const dialog = useTemplateRef('dialog');
const { selectDriveFiles } = useHataGoesPickers();
const copy = i18n.ts._hata._hatafeed._issueWizard;

const step = ref(1);
const backButtons = computed(() => step.value > 1 ? [{ title: copy.back, icon: 'ti ti-arrow-left', onClick: () => { step.value--; } }] : []);
const category = ref<HataFeedCategory>('bug');
const title = ref('');
const description = ref('');
const device = ref('');
const osVersion = ref('');
const browser = ref('');
const environmentFields = computed(() => [
	{ label: '使用端末', displayLabel: copy.device, value: device.value.trim() },
	{ label: 'OS・バージョン', displayLabel: copy.osVersion, value: osVersion.value.trim() },
	{ label: 'ブラウザ・開き方', displayLabel: copy.browser, value: browser.value.trim() },
].filter(field => field.value));
// Keep environment details in the existing issue body so detail views and exports retain them.
const submittedDescription = computed(() => environmentFields.value.length
	? [description.value.trimEnd(), `【使用環境】\n${environmentFields.value.map(field => `${field.label}: ${field.value}`).join('\n')}`].filter(Boolean).join('\n\n')
	: description.value);
const descriptionTooLong = computed(() => Array.from(submittedDescription.value).length > 8192);
const priority = ref<HataFeedPriority>('normal');
const priorityItems = [
	{ value: 'low', label: copy.priorityLow },
	{ value: 'normal', label: copy.priorityNormal },
	{ value: 'high', label: copy.priorityHigh },
];
const files = ref<any[]>([]);
const submitting = ref(false);
// 旗鯖fork: コード提出（任意）
const codeEnabled = ref(false);
const code = ref('');

type IssueDraft = {
	step: number;
	category: HataFeedCategory;
	title: string;
	description: string;
	device?: string;
	osVersion?: string;
	browser?: string;
	priority: HataFeedPriority;
	files: any[];
	codeEnabled: boolean;
	code: string;
};
const { finishSubmission, beforeClose, prompt, hasDraft, resumeDraft } = useHataFeedDraft<IssueDraft>({
	id: `hatafeed:issue:${props.projectId ?? 'general'}`,
	busy: () => submitting.value,
	capture: () => ({ step: step.value, category: category.value, title: title.value, description: description.value, device: device.value, osVersion: osVersion.value, browser: browser.value, priority: priority.value, files: files.value, codeEnabled: codeEnabled.value, code: code.value }),
	restore: draft => {
		step.value = Math.min(3, Math.max(1, Number(draft.step) || 1));
		if (creatableCategoryKeys.includes(draft.category as typeof creatableCategoryKeys[number])) category.value = draft.category;
		title.value = typeof draft.title === 'string' ? draft.title : '';
		description.value = typeof draft.description === 'string' ? draft.description : '';
		device.value = typeof draft.device === 'string' ? draft.device : '';
		osVersion.value = typeof draft.osVersion === 'string' ? draft.osVersion : '';
		browser.value = typeof draft.browser === 'string' ? draft.browser : '';
		if (draft.priority === 'low' || draft.priority === 'normal' || draft.priority === 'high') priority.value = draft.priority;
		files.value = Array.isArray(draft.files) ? draft.files : [];
		codeEnabled.value = draft.codeEnabled === true;
		code.value = typeof draft.code === 'string' ? draft.code : '';
	},
	isMeaningful: draft => draft.title.trim().length > 0 || draft.description.trim().length > 0 || draft.files.length > 0 || draft.code.trim().length > 0 || !!(draft.device?.trim() || draft.osVersion?.trim() || draft.browser?.trim()),
});

// 旗鯖fork: スタッフ専用カテゴリ(security等)は一般ユーザーに見せない。
const availableCategoryKeys = computed(() => creatableCategoryKeys.filter(c => iAmModerator || !staffOnlyCategoryKeys.includes(c as 'security')));

const projectName = computed(() => props.projects.find(p => p.id === props.projectId)?.name ?? null);

// カテゴリ別の入力ガイド(書き方がわからない人向け)。
const titleHint = computed(() => {
	switch (category.value) {
		case 'bug': return copy.titleHintBug;
		case 'featureRequest': return copy.titleHintFeatureRequest;
		case 'adoptionRequest': return copy.titleHintAdoptionRequest;
		case 'security': return copy.titleHintSecurity;
		default: return copy.titleHintDefault;
	}
});
const descHint = computed(() => {
	switch (category.value) {
		case 'bug': return copy.descriptionHintBug;
		case 'featureRequest': return copy.descriptionHintFeatureRequest;
		default: return copy.descriptionHintDefault;
	}
});
const descCaption = computed(() => category.value === 'security' ? copy.securityDescriptionCaption : '');

async function addFiles() {
	const chosen = await selectDriveFiles({ multiple: true }).catch(() => []);
	for (const f of chosen) {
		if (!files.value.some(x => x.id === f.id)) files.value.push(f);
	}
}

async function submit() {
	if (submitting.value || !title.value.trim() || descriptionTooLong.value) return;
	submitting.value = true;
	try {
		const issue = await misskeyApi('hata/feedback/issues/create', {
			title: title.value.trim(),
			description: submittedDescription.value,
			category: category.value,
			priority: priority.value,
			projectId: props.projectId,
			fileIds: files.value.map(f => f.id),
			code: (codeEnabled.value && code.value.trim().length > 0) ? code.value : null,
		});
		hataFeedNotify(copy.created);
		finishSubmission();
		emit('done', issue);
		dialog.value?.close();
	} finally {
		submitting.value = false;
	}
}
</script>

<style lang="scss" module>
.categories { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@container (max-width: 420px) { .categories { grid-template-columns: minmax(0, 1fr); } }
.gaps { display: flex; flex-direction: column; gap: 18px; text-align: center; }
.environment { display: grid; gap: 14px; min-width: 0; margin: 0; padding: 16px; border: 1px solid var(--MI_THEME-divider); border-radius: 16px; }
.environment legend { padding-inline: 6px; font-weight: 700; }
.environment legend small { margin-inline-start: 4px; font-weight: 400; color: var(--MI_THEME-fgMuted); }
.lead { opacity: .8; font-size: .92em; }
.tag { background: var(--MI_THEME-accent); color: var(--hy-on-accent); border-radius: 999px; padding: 2px 10px; font-size: .82em; }
.req { color: var(--MI_THEME-error); font-size: .72em; margin-left: 4px; }

.catCard {
	display: flex; align-items: center; gap: 12px;
	background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider);
	border-radius: 20px; padding: 20px 16px; min-height: 100px; cursor: pointer; text-align: center; color: inherit;
	transition: all .15s;
}
.catCard:hover { border-color: var(--MI_THEME-accent); transform: translateY(-1px); }
.catActive { border-color: var(--MI_THEME-accent); }
.catIcon { font-size: 1.5rem; color: var(--MI_THEME-accent); width: 28px; text-align: center; }
.catText { flex: 1; min-width: 0; }
.catName { font-weight: 700; }
.catDesc { font-size: .8em; opacity: .65; margin-top: 2px; }
.catArrow { opacity: .4; }

.navRow { display: flex; justify-content: center; margin-top: 6px; }
.fieldLabel { font-size: .85em; opacity: .8; margin-bottom: 6px; }
.fileGrid { display: flex; gap: 8px; flex-wrap: wrap; }
.fileThumb { position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 1px solid var(--MI_THEME-divider); }
.fileThumb img { width: 100%; height: 100%; object-fit: cover; }
.fileDel { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.5); color: var(--hy-on-accent); border: none; border-radius: 999px; width: 20px; height: 20px; cursor: pointer; }
.fileAdd { width: 72px; height: 72px; border-radius: 10px; border: 1px dashed var(--MI_THEME-divider); background: var(--MI_THEME-bg); cursor: pointer; color: inherit; font-size: 1.2rem; }
.summary { background: var(--MI_THEME-bg); border-radius: 12px; padding: 12px 14px; font-size: .88em; display: flex; flex-direction: column; gap: 4px; }
.codeArea { margin-top: 8px; }
.codeArea :global(textarea) { font-family: Consolas, Menlo, monospace; font-size: .85em; }
</style>
