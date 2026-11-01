<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed 2a): ロードマップ(近々の修正・改善予定)専用の作成画面。
  ロードマップ項目は「improvement カテゴリ + 状態(対応予定/対応中)」の公式イシューなので、
  通常のイシュー作成ウィザードとは別に、その2点に絞ったシンプルな1画面フォームを用意する。
  スタッフ専用。HataGoes 内のみ既存項目を3段階で表示し、通常ルートは従来の1画面。
  作成後は選んだ状態(planned/inProgress)へ更新して掲示する。
-->
<template>
<MkWindow
	ref="dialog" class="hatady-scope hatafeed-scope"
	data-hatafeed-window
	:data-hatady-theme="hataFeedTheme"
	centerTitle
	:initialWidth="520"
	:initialHeight="560"
	:canResize="true"
	:beforeClose="beforeClose"
	:inert="prompt"
	@closed="emit('closed')"
>
	<template #header><i class="ti ti-route"></i> {{ copy.header }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div v-if="hasDraft && !createdIssue" class="hf-draft-offer"><span>端末に保存した下書きがあります</span><button type="button" @click="resumeDraft"><i class="ti ti-pencil-plus" aria-hidden="true"></i>続きから編集</button></div>
		<p v-if="submitError" role="alert">{{ submitError }}</p>
		<p v-if="createdIssue && submitError && hataGoesHost" role="status">公開済みの内容は保持されています。状態の保存だけを再試行します。</p>
		<div :class="$style.gaps" :data-host="!!hataGoesHost" :data-step="step">
			<ol v-if="hataGoesHost" :class="$style.steps" aria-label="作成手順"><li v-for="(label, index) in stepLabels" :key="label" :aria-current="step === index ? 'step' : undefined">{{ label }}</li></ol>
			<div v-if="!hataGoesHost || step === 0" :class="$style.lead">{{ copy.lead }}</div>

			<MkInput v-if="!hataGoesHost || step === 0" v-model="title" :placeholder="copy.titlePlaceholder">
				<template #label>{{ copy.content }} <span :class="$style.req">{{ copy.required }}</span></template>
			</MkInput>

			<MkTextarea v-if="!hataGoesHost || step === 0" v-model="description" :placeholder="copy.descriptionPlaceholder">
				<template #label>{{ copy.description }}</template>
			</MkTextarea>

			<div v-if="!hataGoesHost || step === 1">
				<div :class="$style.fieldLabel">{{ copy.status }}</div>
				<div :class="$style.statusRow">
					<button
						v-for="s in statusOptions"
						:key="s.value"
						:class="[$style.statusChip, status === s.value && $style.statusChipOn]"
						:data-status="s.value"
						@click="status = s.value"
					>
						<i :class="['ti', s.icon]"></i> {{ s.label }}
					</button>
				</div>
			</div>

			<div v-if="!hataGoesHost || step === 0">
				<div :class="$style.fieldLabel">{{ copy.images }}</div>
				<div :class="$style.fileGrid">
					<div v-for="f in files" :key="f.id" :class="$style.fileThumb">
						<img :src="f.thumbnailUrl ?? f.url" :alt="f.name"/>
						<button :class="$style.fileDel" @click="files = files.filter(x => x.id !== f.id)"><i class="ti ti-x"></i></button>
					</div>
					<button :class="$style.fileAdd" @click="addFiles"><i class="ti ti-plus"></i></button>
				</div>
			</div>

			<Transition name="hf-roadmap-step"><div v-if="hataGoesHost && step === 2" :class="$style.confirm" aria-label="確認"><strong>{{ title.trim() }}</strong><p>{{ description }}</p><span>{{ statusOptions.find(option => option.value === status)?.label }}</span><span>{{ copy.images }}: {{ files.length }}</span></div></Transition>
			<div :class="$style.navRow">
				<MkButton v-if="!hataGoesHost || step === 0" rounded :disabled="submitting" @click="dialog?.close()">{{ copy.cancel }}</MkButton>
				<MkButton v-if="hataGoesHost && step > 0 && !createdIssue" rounded :disabled="submitting" @click="step = step === 2 ? 1 : 0">戻る</MkButton>
				<MkButton v-if="hataGoesHost && step < 2" rounded primary :disabled="submitting || (step === 0 && !title.trim())" @click="step = step === 0 ? 1 : 2">次へ</MkButton>
				<MkButton v-if="!hataGoesHost || step === 2" rounded primary gradate :disabled="!title.trim() || submitting" @click="submit"><i class="ti ti-send"></i> {{ copy.publish }}</MkButton>
			</div>
		</div>
	</div>
</MkWindow>
</template>

<script lang="ts" setup>
import { inject, ref, shallowRef, useTemplateRef } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import MkWindow from '@/components/MkWindow.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { hataFeedNotify } from '@/utility/hatafeed-ui.js';
import '@/components/hatafeed-ui.css';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import type { HataFeedEditableStatus } from '@/utility/hatafeed.js';
import { useHataFeedDraft } from '@/utility/hatafeed-draft.js';

const emit = defineEmits<{ (ev: 'done', v: any): void; (ev: 'closed'): void }>();
const hataGoesHost = inject(HATA_GOES_HOST, null);

const dialog = useTemplateRef('dialog');
const { selectDriveFiles } = useHataGoesPickers();
const copy = i18n.ts._hata._hatafeed._roadmapWizard;

const title = ref('');
const description = ref('');
const status = ref<Extract<HataFeedEditableStatus, 'planned' | 'inProgress'>>('planned');
const files = ref<any[]>([]);
const submitting = ref(false);
const submitError = ref('');
const createdIssue = shallowRef<any>(null);
const step = ref<0 | 1 | 2>(0);
const stepLabels = ['内容', '状態', '確認'] as const;
type RoadmapDraft = { title: string; description: string; status: 'planned' | 'inProgress'; files: any[]; createdIssueId?: string };
const { saveDraft, finishSubmission, beforeClose, prompt, hasDraft, resumeDraft } = useHataFeedDraft<RoadmapDraft>({
	id: 'hatafeed:roadmap',
	busy: () => submitting.value,
	capture: () => ({ title: title.value, description: description.value, status: status.value, files: files.value, createdIssueId: createdIssue.value?.id }),
	restore: draft => {
		title.value = typeof draft.title === 'string' ? draft.title : '';
		description.value = typeof draft.description === 'string' ? draft.description : '';
		if (draft.status === 'planned' || draft.status === 'inProgress') status.value = draft.status;
		files.value = Array.isArray(draft.files) ? draft.files : [];
		if (typeof draft.createdIssueId === 'string' && draft.createdIssueId) {
			createdIssue.value = { id: draft.createdIssueId };
			step.value = 2;
		}
	},
	isMeaningful: draft => draft.title.trim().length > 0 || draft.description.trim().length > 0 || draft.files.length > 0,
});

// ロードマップは「対応予定 / 対応中」の2状態で掲示する。
const statusOptions = [
	{ value: 'planned', label: copy.planned, icon: 'ti-calendar-time' },
	{ value: 'inProgress', label: copy.inProgress, icon: 'ti-progress' },
] as const;

async function addFiles() {
	const chosen = await selectDriveFiles({ multiple: true }).catch(() => []);
	for (const f of chosen) {
		if (!files.value.some(x => x.id === f.id)) files.value.push(f);
	}
}

async function submit() {
	if (submitting.value || !title.value.trim()) return;
	submitting.value = true;
	submitError.value = '';
	try {
		// ロードマップ = 公式(projectId:null)の improvement カテゴリのイシュー。
		const wasCreated = createdIssue.value != null;
		const issue = createdIssue.value ?? await misskeyApi('hata/feedback/issues/create', {
			title: title.value.trim(),
			description: description.value,
			category: 'improvement',
			projectId: null,
			fileIds: files.value.map(f => f.id),
		});
		createdIssue.value = issue;
		// The create operation is already committed; keep its ID for a later status retry in HataGoes.
		if ((hataGoesHost || wasCreated) && !saveDraft()) hataFeedNotify('公開済みですが、端末の下書きを保存できませんでした');
		// 作成直後は open のため、選んだ掲示状態(planned/inProgress)へ更新する。
		if (hataGoesHost) await misskeyApi('hata/feedback/issues/update', { issueId: issue.id, status: status.value });
		else await misskeyApi('hata/feedback/issues/update', { issueId: issue.id, status: status.value }).catch(() => {});
		hataFeedNotify('保存しました');
		finishSubmission();
		emit('done', issue);
		dialog.value?.close();
	} catch {
		submitError.value = createdIssue.value ? '状態を保存できませんでした。もう一度お試しください。' : '公開できませんでした。もう一度お試しください。';
	} finally {
		submitting.value = false;
	}
}
</script>

<style lang="scss" module>
.gaps { display: flex; flex-direction: column; gap: 18px; text-align: center; }
.lead { opacity: .8; font-size: .92em; }
.req { color: var(--MI_THEME-error); font-size: .72em; margin-left: 4px; }
.fieldLabel { font-size: .85em; opacity: .8; margin-bottom: 6px; }

.statusRow { display: flex; gap: 8px; flex-wrap: wrap; }
.statusChip {
	display: inline-flex; align-items: center; gap: 6px;
	background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); color: inherit;
	border-radius: 999px; padding: 7px 16px; font-size: .88em; font-weight: 700; cursor: pointer;
	transition: all .12s;
}
.statusChip:hover { border-color: var(--MI_THEME-accent); }
.statusChipOn { background: var(--MI_THEME-accent); color: var(--hy-on-accent); border-color: var(--MI_THEME-accent); }

.fileGrid { display: flex; gap: 8px; flex-wrap: wrap; }
.fileThumb { position: relative; width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 1px solid var(--MI_THEME-divider); }
.fileThumb img { width: 100%; height: 100%; object-fit: cover; }
.fileDel { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.5); color: var(--hy-on-accent); border: none; border-radius: 999px; width: 20px; height: 20px; cursor: pointer; }
.fileAdd { width: 72px; height: 72px; border-radius: 10px; border: 1px dashed var(--MI_THEME-divider); background: var(--MI_THEME-bg); cursor: pointer; color: inherit; font-size: 1.2rem; }

.navRow { display: flex; justify-content: center; gap:10px; margin-top: 6px; }
.steps { display:flex; gap:6px; justify-content:center; margin:0; padding:0; list-style:none; }
.steps li { flex:1; max-width:140px; padding:8px; border-radius:999px; background:var(--MI_THEME-bg); opacity:.65; font-size:.8rem; }
.steps li[aria-current='step'] { background:var(--MI_THEME-accent); color:var(--MI_THEME-fgOnAccent); opacity:1; }
.confirm { display:flex; flex-direction:column; gap:10px; padding:18px; border:1px solid var(--MI_THEME-divider); border-radius:16px; text-align:start; overflow-wrap:anywhere; }
.confirm p { white-space:pre-wrap; margin:0; }
.gaps[data-host='true'] > :not(.steps):not(.navRow) { animation:roadmapStepIn 180ms ease both; }
@keyframes roadmapStepIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
:global(.hf-roadmap-step-leave-active) { display:none; }
</style>
