<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

旗鯖fork: マスコット.hmtk読み込み時、読み込み先ロールの上限を超える
表情/文言のうち「どれを残すか」をチェックボックスで選ばせるダイアログ。
- 表情/文言それぞれ、上限ちょうどまでしか選べない(超過選択はチェック不可)
- 完璧には維持できない旨を明記する
- OKで { expressionIds, phraseIds } を done で返す。キャンセルは canceled:true
-->
<template>
<MkModalWindow
	ref="dialog"
	:width="500"
	:height="600"
	:okButtonDisabled="false"
	@close="cancel"
	@closed="emit('closed')"
>
	<template #header>{{ copy.header }}</template>

	<div :class="$style.root">
		<div :class="$style.notice">
			<i class="ti ti-alert-triangle"></i>
			<div>
				{{ copy.limitNotice }}<br>
				{{ copy.chooseItems }}
			</div>
		</div>

		<div v-if="expressions.length > 0" :class="$style.section">
			<div :class="$style.secHead">
				<span :class="$style.secTitle">{{ copy.expressions }}</span>
				<span :class="[$style.secCount, exprOver && $style.secCountOver]">{{ selectedExpr.length }} / {{ maxExpressions }}</span>
			</div>
			<div :class="$style.list">
				<label v-for="e in expressions" :key="e.key" :class="[$style.item, isExprChecked(e.key) && $style.itemOn]">
					<input
						type="checkbox"
						:checked="isExprChecked(e.key)"
						:disabled="!isExprChecked(e.key) && selectedExpr.length >= maxExpressions"
						@change="toggleExpr(e.key)"
					/>
					<img v-if="e.url" :src="e.url" :class="$style.thumb" />
					<i v-else class="ti ti-photo" :class="$style.thumbIcon"></i>
					<span :class="$style.itemLabel">{{ e.label || copy.untitledExpression }}</span>
				</label>
			</div>
		</div>

		<div v-if="phrases.length > 0" :class="$style.section">
			<div :class="$style.secHead">
				<span :class="$style.secTitle">{{ copy.phrases }}</span>
				<span :class="[$style.secCount, phraseOver && $style.secCountOver]">{{ selectedPhrase.length }} / {{ maxPhrases }}</span>
			</div>
			<div :class="$style.list">
				<label v-for="p in phrases" :key="p.key" :class="[$style.item, isPhraseChecked(p.key) && $style.itemOn]">
					<input
						type="checkbox"
						:checked="isPhraseChecked(p.key)"
						:disabled="!isPhraseChecked(p.key) && selectedPhrase.length >= maxPhrases"
						@change="togglePhrase(p.key)"
					/>
					<span :class="$style.itemLabel">{{ p.text || copy.emptyPhrase }}</span>
				</label>
			</div>
		</div>

		<div :class="$style.actions">
			<MkButton rounded @click="cancel">{{ copy.cancel }}</MkButton>
			<MkButton primary rounded @click="ok">{{ copy.import }}</MkButton>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, computed, shallowRef } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._mascotImport;

// key は呼び出し側で割り振る一意な識別子(配列index等)。中身の表示用に label/text/url も受け取る。
const props = defineProps<{
	expressions: { key: string; label: string; url: string }[];
	phrases: { key: string; text: string }[];
	maxExpressions: number;
	maxPhrases: number;
}>();

const emit = defineEmits<{
	(ev: 'done', result: { canceled: true } | { canceled: false; expressionIds: string[]; phraseIds: string[] }): void;
	(ev: 'closed'): void;
}>();

const dialog = shallowRef<InstanceType<typeof MkModalWindow>>();

// 初期選択は先頭から上限ぶんだけ ON にしておく(ユーザーはここから調整する)。
const selectedExpr = ref<string[]>(props.expressions.slice(0, props.maxExpressions).map(e => e.key));
const selectedPhrase = ref<string[]>(props.phrases.slice(0, props.maxPhrases).map(p => p.key));

const exprOver = computed(() => props.expressions.length > props.maxExpressions);
const phraseOver = computed(() => props.phrases.length > props.maxPhrases);

function isExprChecked(key: string): boolean { return selectedExpr.value.includes(key); }
function isPhraseChecked(key: string): boolean { return selectedPhrase.value.includes(key); }

function toggleExpr(key: string) {
	if (selectedExpr.value.includes(key)) {
		selectedExpr.value = selectedExpr.value.filter(k => k !== key);
	} else if (selectedExpr.value.length < props.maxExpressions) {
		selectedExpr.value = [...selectedExpr.value, key];
	}
}
function togglePhrase(key: string) {
	if (selectedPhrase.value.includes(key)) {
		selectedPhrase.value = selectedPhrase.value.filter(k => k !== key);
	} else if (selectedPhrase.value.length < props.maxPhrases) {
		selectedPhrase.value = [...selectedPhrase.value, key];
	}
}

function ok() {
	emit('done', { canceled: false, expressionIds: selectedExpr.value, phraseIds: selectedPhrase.value });
	dialog.value?.close();
}
function cancel() {
	emit('done', { canceled: true });
	dialog.value?.close();
}
</script>

<style lang="scss" module>
.root { display:flex; flex-direction:column; gap:16px; padding:18px 20px 20px; }
.notice { display:flex; gap:10px; align-items:flex-start; background: var(--MI_THEME-infoWarnBg, rgba(226,150,0,.1)); border:1px solid var(--MI_THEME-divider); border-radius:10px; padding:12px 14px; font-size:.83rem; line-height:1.6; }
.notice > i { color: var(--MI_THEME-warn, #e29600); font-size:1.1rem; margin-top:2px; flex:none; }
.section { display:flex; flex-direction:column; gap:8px; }
.secHead { display:flex; align-items:center; justify-content:space-between; }
.secTitle { font-size:.95rem; font-weight:700; }
.secCount { font-size:.82rem; opacity:.6; font-variant-numeric:tabular-nums; }
.secCountOver { color: var(--MI_THEME-warn, #e29600); opacity:1; font-weight:700; }
.list { display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto; padding:2px; }
.item { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:9px; border:1px solid var(--MI_THEME-divider); cursor:pointer; font-size:.88rem; }
.itemOn { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg, rgba(134,179,0,.08)); }
.thumb { width:34px; height:34px; object-fit:contain; border-radius:6px; flex:none; }
.thumbIcon { width:34px; text-align:center; opacity:.4; flex:none; }
.itemLabel { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.actions { display:flex; justify-content:flex-end; gap:10px; margin-top:4px; }
</style>
