<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px;">
		<SearchMarker path="/admin/hatask" label="Hatask管理" :keywords="['お花', '図鑑', 'アイコンデコ', '実績', '期間限定']" icon="ti ti-flower">
			<div class="_gaps_l">
				<div class="_gaps_s">
					<h2 :class="$style.heading">お花の図鑑の達成特典</h2>
					<p :class="$style.description">今の季節のお花を全種類そろえると使えるアイコンデコを設定します。すでに達成している人も対象です。</p>
				</div>
				<MkLoading v-if="loading"/>
				<div v-else-if="loadError" class="_gaps_m">
					<p role="alert">アイコンデコを読み込めませんでした。</p>
					<MkButton data-retry @click="load">再試行</MkButton>
				</div>
				<div v-else-if="decorations.length === 0" class="_gaps_m">
					<p :class="$style.description">アイコンデコが登録されていません。</p>
					<MkButton link to="/admin/avatar-decorations">アイコンデコを登録する</MkButton>
				</div>
				<template v-else>
					<div class="_gaps_m">
						<div :class="$style.saveRow">
							<h3 :class="$style.subheading">アイコンデコを選ぶ</h3>
							<MkButton small link to="/admin/avatar-decorations">デコの登録・管理</MkButton>
						</div>
						<div :class="$style.choices" data-decoration-select>
							<button v-for="decoration in decorations" :key="decoration.id" type="button" class="_button" :class="$style.choice" :data-decoration-id="decoration.id" :data-selected="selectedId === decoration.id" :aria-pressed="selectedId === decoration.id" :disabled="saving || !!replacement" @click="selectDecoration(decoration.id)">
								<MkAvatar :user="$i" :decorations="[{ url: decoration.url }]" :class="$style.choiceAvatar" forceShowDecoration/>
								<strong :class="$style.choiceName">{{ decoration.name }}</strong>
								<span :class="$style.badges">
									<span :class="$style.badge" :data-reward="decoration.requiresHataskFlowerCompletion">{{ decoration.requiresHataskFlowerCompletion ? '達成特典' : '通常' }}</span>
									<span v-if="decoration.availableFrom || decoration.availableUntil" :class="$style.badge">期間限定</span>
								</span>
								<span v-if="selectedId === decoration.id" :class="$style.selectedLabel"><i class="ti ti-check" aria-hidden="true"></i> 選択中</span>
							</button>
						</div>
					</div>
					<div v-if="selectedDecoration && draft" class="_gaps_l">
						<div v-if="replacement" class="_gaps_m" data-replacement-picker>
							<div :class="$style.saveRow">
								<h3 :class="$style.subheading">「{{ replacementSource?.name }}」から変更</h3>
								<MkButton small :disabled="saving" data-cancel-replacement @click="cancelReplacement">変更をやめる</MkButton>
							</div>
							<p :class="$style.description">変更先を選び、下の設定を保存してください。変更前のデコは通常の一覧に残り、元の期間・ロール制限を維持します。</p>
							<div :class="$style.choices">
								<button v-for="decoration in replacementCandidates" :key="decoration.id" type="button" class="_button" :class="$style.choice" :data-replacement-id="decoration.id" :data-selected="replacement.toId === decoration.id" :aria-pressed="replacement.toId === decoration.id" :disabled="saving" @click="replacement.toId = decoration.id">
									<MkAvatar :user="$i" :decorations="[{ url: decoration.url }]" :class="$style.choiceAvatar" forceShowDecoration/>
									<strong :class="$style.choiceName">{{ decoration.name }}</strong>
									<span v-if="replacement.toId === decoration.id" :class="$style.selectedLabel"><i class="ti ti-check" aria-hidden="true"></i> 変更先</span>
								</button>
							</div>
						</div>
						<div :class="$style.preview">
							<MkAvatar :user="$i" :decorations="[{ url: selectedDecoration.url }]" :class="$style.avatar" forceShowDecoration/>
							<div :class="$style.previewText">
								<strong>{{ selectedDecoration.name }}</strong>
								<p v-if="selectedDecoration.description" :class="$style.description">{{ selectedDecoration.description }}</p>
							</div>
						</div>
						<div v-if="selectedDecoration.requiresHataskFlowerCompletion && !replacement" :class="$style.saveRow">
							<MkButton :disabled="saving || replacementCandidates.length === 0" data-replace @click="startReplacement"><i class="ti ti-switch-horizontal" aria-hidden="true"></i> 別のデコに変更</MkButton>
							<MkButton :disabled="saving" data-remove-reward @click="removeReward"><i class="ti ti-unlink" aria-hidden="true"></i> 特典から解除</MkButton>
						</div>
						<MkSwitch v-model="draft.requiresHataskFlowerCompletion" :disabled="saving || !!replacement" data-completion>
							<template #label>お花の図鑑の達成特典にする</template>
							<template #caption>未達成の人にも一覧に表示されますが、選択はできません。解禁後は季節が変わっても使えます。既存のロール制限も適用されます。</template>
						</MkSwitch>
						<div class="_gaps_m">
							<MkSwitch v-model="draft.limited" :disabled="saving" data-period>
								<template #label>着用できる期間を限定する</template>
								<template #caption>期間が終わると、装着中のデコも自動で外れます。</template>
							</MkSwitch>
							<div v-if="draft.limited" class="_gaps_m">
								<div :class="$style.dates">
									<MkInput v-model="draft.availableFrom" type="datetime-local" :disabled="saving" data-start>
										<template #label>開始日時（任意）</template>
										<template #caption>空欄の場合は、保存後から着用できます。</template>
									</MkInput>
									<MkInput v-model="draft.availableUntil" type="datetime-local" :disabled="saving" required data-end>
										<template #label>終了日時</template>
										<template #caption><span v-if="periodError" :class="$style.error" role="alert">{{ periodError }}</span></template>
									</MkInput>
								</div>
								<p :class="$style.description">日時はこの端末のタイムゾーン（{{ timeZone }}）で指定します。</p>
							</div>
						</div>
						<div class="_gaps_s">
							<p v-if="saveError" :class="$style.error" role="alert">{{ saveError }}</p>
							<p v-else-if="savedId === selectedId" role="status">{{ savedMessage }}</p>
							<div :class="$style.saveRow">
								<MkButton primary rounded :wait="saving" :disabled="!hasChanges || !!periodError" data-save @click="save"><i class="ti ti-check" aria-hidden="true"></i> {{ replacement ? 'デコを変更して保存' : '設定を保存' }}</MkButton>
								<span v-if="hasChanges" :class="$style.description">未保存の変更があります</span>
							</div>
						</div>
					</div>
				</template>
			</div>
		</SearchMarker>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import * as os from '@/os.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';

defineOptions({ name: 'HataskManager' });

type Decoration = Misskey.entities.AdminAvatarDecorationsListResponse[number];
type Draft = {
	requiresHataskFlowerCompletion: boolean;
	limited: boolean;
	availableFrom: string;
	availableUntil: string;
};

const $i = ensureSignin();
const decorations = ref<Decoration[]>([]);
const selectedId = ref('');
const drafts = ref<Partial<Record<string, Draft>>>({});
const savedDrafts = ref<Record<string, string>>({});
const loading = ref(true);
const loadError = ref(false);
const saving = ref(false);
const saveError = ref('');
const savedId = ref<string | null>(null);
const savedMessage = ref('');
const replacement = ref<{ fromId: string; toId: string; draft: Draft } | null>(null);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const selectedDecoration = computed(() => {
	const id = replacement.value != null && replacement.value.toId.length > 0 ? replacement.value.toId : selectedId.value;
	return decorations.value.find(decoration => decoration.id === id);
});
const replacementSource = computed(() => decorations.value.find(decoration => decoration.id === replacement.value?.fromId));
const replacementCandidates = computed(() => decorations.value.filter(decoration => !decoration.requiresHataskFlowerCompletion && decoration.id !== selectedId.value));
const draft = computed(() => replacement.value?.draft ?? drafts.value[selectedId.value]);
const hasChanges = computed(() => replacement.value ? !!replacement.value.toId : draft.value != null && JSON.stringify(draft.value) !== savedDrafts.value[selectedId.value]);
const periodError = computed(() => {
	if (!draft.value?.limited) return '';
	const end = new Date(draft.value.availableUntil).getTime();
	if (!Number.isFinite(end)) return '終了日時を入力してください。';
	if (draft.value.availableFrom) {
		const start = new Date(draft.value.availableFrom).getTime();
		if (!Number.isFinite(start)) return '開始日時を正しく入力してください。';
		if (start >= end) return '終了日時は開始日時より後にしてください。';
	}
	return '';
});

function toLocalDateTime(value: string | null): string {
	if (!value) return '';
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return '';
	const pad = (part: number) => String(part).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialDraft(decoration: Decoration): Draft {
	return {
		requiresHataskFlowerCompletion: decoration.requiresHataskFlowerCompletion,
		limited: Boolean(decoration.availableFrom) || Boolean(decoration.availableUntil),
		availableFrom: toLocalDateTime(decoration.availableFrom),
		availableUntil: toLocalDateTime(decoration.availableUntil),
	};
}

function selectDecoration(id: string) {
	if (saving.value || replacement.value) return;
	selectedId.value = id;
}

function startReplacement() {
	if (saving.value || !selectedDecoration.value?.requiresHataskFlowerCompletion || !draft.value) return;
	replacement.value = { fromId: selectedId.value, toId: '', draft: { ...draft.value, requiresHataskFlowerCompletion: true } };
	saveError.value = '';
	savedId.value = null;
}

function cancelReplacement() {
	if (saving.value) return;
	replacement.value = null;
	saveError.value = '';
}

async function load() {
	loading.value = true;
	loadError.value = false;
	try {
		const response = await misskeyApi('admin/avatar-decorations/list');
		decorations.value = response;
		for (const decoration of response) {
			const initial = initialDraft(decoration);
			drafts.value[decoration.id] = initial;
			savedDrafts.value[decoration.id] = JSON.stringify(initial);
		}
		selectedId.value = response.find(decoration => decoration.requiresHataskFlowerCompletion)?.id ?? response.at(0)?.id ?? '';
	} catch {
		loadError.value = true;
	} finally {
		loading.value = false;
	}
}

async function save() {
	const currentDraft = draft.value;
	const currentDecoration = selectedDecoration.value;
	if (saving.value || !currentDecoration || !currentDraft || !hasChanges.value || periodError.value) return;
	const id = currentDecoration.id;
	const replaceFromId = replacement.value?.fromId;
	const periodSource = replacementSource.value ?? currentDecoration;
	const snapshot = JSON.stringify(currentDraft);
	const dateForSave = (value: string, savedValue: string | null): string | null => {
		if (!currentDraft.limited || !value) return null;
		return value === toLocalDateTime(savedValue) ? savedValue : new Date(value).toISOString();
	};
	const params = {
		id,
		requiresHataskFlowerCompletion: currentDraft.requiresHataskFlowerCompletion,
		availableFrom: dateForSave(currentDraft.availableFrom, periodSource.availableFrom),
		availableUntil: dateForSave(currentDraft.availableUntil, periodSource.availableUntil),
	};
	saving.value = true;
	saveError.value = '';
	savedId.value = null;
	try {
		// The server removes the decoration from wearers who no longer qualify as soon as this
		// is saved. Ask first whenever the change can take it away from someone wearing it now.
		const now = Date.now();
		const becomesReward = params.requiresHataskFlowerCompletion && (replaceFromId != null || !currentDecoration.requiresHataskFlowerCompletion);
		const outsidePeriod = (params.availableFrom != null && Date.parse(params.availableFrom) > now)
			|| (params.availableUntil != null && Date.parse(params.availableUntil) <= now);
		if (becomesReward || outsidePeriod) {
			const { canceled } = await os.confirm({
				type: 'warning',
				title: '着用中の人からデコが外れます',
				text: `保存すると、「${currentDecoration.name}」を着用している人のうち${becomesReward ? 'お花図鑑を達成していない人' : ''}${becomesReward && outsidePeriod ? '、および' : ''}${outsidePeriod ? '期間外になる全員' : ''}から、すぐにデコが外れます。外れたデコは自動では戻りません。`,
				okText: '保存する',
			});
			if (canceled) return;
		}
		await misskeyApi('admin/hatask/update-decoration', { ...params, ...(replaceFromId ? { replaceFromId } : {}) });
		const decoration = decorations.value.find(item => item.id === id);
		if (decoration) Object.assign(decoration, params);
		if (replaceFromId) {
			const previous = decorations.value.find(item => item.id === replaceFromId);
			if (previous) {
				previous.requiresHataskFlowerCompletion = false;
				drafts.value[replaceFromId] = initialDraft(previous);
				savedDrafts.value[replaceFromId] = JSON.stringify(drafts.value[replaceFromId]);
			}
			drafts.value[id] = { ...currentDraft };
			replacement.value = null;
			selectedId.value = id;
		}
		savedDrafts.value[id] = snapshot;
		savedId.value = id;
		savedMessage.value = replaceFromId ? '特典のアイコンデコを変更しました。' : '設定を保存しました。';
	} catch (error) {
		const code = error != null && typeof error === 'object' && 'code' in error ? error.code : null;
		saveError.value = code === 'AVATAR_DECORATION_REPLACEMENT_CONFLICT'
			? '別の操作で特典の指定が変わっています。入力内容を控えてからページを再読み込みしてください。'
			: '保存できませんでした。入力内容は保持しています。もう一度お試しください。';
	} finally {
		saving.value = false;
	}
}

async function removeReward() {
	const decoration = selectedDecoration.value;
	if (saving.value || replacement.value || !decoration?.requiresHataskFlowerCompletion) return;
	saving.value = true;
	saveError.value = '';
	try {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: '特典から解除しますか？',
			text: `「${decoration.name}」を通常のアイコンデコに戻します。デコ自体は削除されず、期間・ロール制限はそのまま残ります。`,
			okText: '特典から解除',
		});
		if (canceled) return;
		await misskeyApi('admin/hatask/update-decoration', {
			id: decoration.id,
			requiresHataskFlowerCompletion: false,
			availableFrom: decoration.availableFrom,
			availableUntil: decoration.availableUntil,
		});
		decoration.requiresHataskFlowerCompletion = false;
		const currentDraft = drafts.value[decoration.id];
		if (currentDraft) currentDraft.requiresHataskFlowerCompletion = false;
		savedDrafts.value[decoration.id] = JSON.stringify(initialDraft(decoration));
		savedId.value = decoration.id;
		savedMessage.value = '特典から解除しました。アイコンデコは通常の一覧に残っています。';
	} catch {
		saveError.value = '解除を確認できませんでした。入力内容は保持しています。もう一度お試しください。';
	} finally {
		saving.value = false;
	}
}

watch(selectedId, () => { saveError.value = ''; });
onMounted(load);

definePage(() => ({ title: 'Hatask管理', icon: 'ti ti-flower' }));
</script>

<style lang="scss" module>
.heading {
	margin: 0;
	font-size: 1.15em;
}

.subheading {
	margin: 0;
	font-size: 1em;
}

.choices {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
	gap: 12px;
}

.choice {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 28px 16px 16px;
	border: 2px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
	text-align: center;
	min-width: 0;

	&[data-selected='true'] {
		border-color: var(--MI_THEME-accent);
	}

	&:focus-visible {
		outline: 2px solid var(--MI_THEME-accent);
		outline-offset: 2px;
	}

	&:disabled {
		cursor: default;
		opacity: 0.6;
	}
}

.choiceAvatar {
	width: 56px;
	height: 56px;
	margin: 12px 0 20px;
}

.choiceName {
	max-width: 100%;
	overflow-wrap: anywhere;
}

.badges {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 6px;
}

.badge {
	padding: 3px 8px;
	border-radius: 6px;
	background: var(--MI_THEME-bg);
	font-size: 0.85em;

	&[data-reward='true'] {
		background: var(--MI_THEME-accentedBg);
		color: var(--MI_THEME-accent);
	}
}

.selectedLabel {
	font-size: 0.85em;
	color: var(--MI_THEME-accent);
}

.description {
	margin: 0;
	line-height: 1.6;
	color: var(--MI_THEME-fg);
	overflow-wrap: anywhere;
}

.preview {
	display: flex;
	align-items: center;
	gap: 32px;
	padding: 24px;
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
}

.avatar {
	flex-shrink: 0;
	width: 64px;
	height: 64px;
}

.previewText {
	display: grid;
	gap: 8px;
	min-width: 0;
	overflow-wrap: anywhere;
}

.dates {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
	gap: 16px;
}

.saveRow {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
}

.error {
	margin: 0;
	color: var(--MI_THEME-error);
}
</style>
