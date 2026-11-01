<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady): 「1行に1項目」の textarea を置き換える、チップ形式のリスト入力。
入力欄で Enter か + を押すと1項目として確定し、追加済みの項目は個別に消せる。
ordered を付けると順番を番号で示す(武器・装備の順序のように並びが意味を持つ項目用)。
-->
<template>
<div :class="$style.root">
	<div v-if="items.length > 0" :class="$style.chips">
		<span v-for="(item, index) in items" :key="`${index}:${item}`" :class="$style.chip">
			<span v-if="ordered" :class="$style.chipIndex">{{ index + 1 }}</span>
			<span :class="$style.chipText">{{ item }}</span>
			<button type="button" :class="$style.chipRemove" :title="removeLabel" :aria-label="`${removeLabel}: ${item}`" @click="removeAt(index)"><i class="ti ti-x"></i></button>
		</span>
	</div>
	<div :class="$style.entry">
		<input
			:id="inputId"
			v-model="draft"
			:aria-label="inputLabel"
			:name="inputName"
			type="text"
			:class="$style.input"
			:placeholder="placeholder"
			:maxlength="maxLength"
			:list="unusedSuggestions.length > 0 ? listId : undefined"
			@keydown.enter.prevent="commitDraft"
			@blur="commitDraft"
		>
		<datalist v-if="unusedSuggestions.length > 0" :id="listId">
			<option v-for="value in unusedSuggestions" :key="value" :value="value"></option>
		</datalist>
		<button type="button" :class="$style.add" :disabled="draft.trim().length === 0" :title="addLabel" :aria-label="addLabel" @click="commitDraft"><i class="ti ti-plus"></i></button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const items = defineModel<string[]>({ required: true });

const props = withDefaults(defineProps<{
	placeholder?: string;
	inputId?: string;
	inputLabel?: string;
	inputName?: string;
	addLabel: string;
	removeLabel: string;
	ordered?: boolean;
	maxLength?: number;
	/** 過去の記録から集めた入力候補。同じ語を打ち直さずに選べるようにする。 */
	suggestions?: string[];
}>(), {
	placeholder: '',
	ordered: false,
	maxLength: 512,
	suggestions: () => [],
});

// datalist は id で結びつけるため、同じ画面に複数置いても衝突しない名前を実体ごとに作る。
// ⚠️<script setup> は実体ごとに評価されるので、モジュール変数の連番ではなく毎回別の値を引く。
const listId = `hy-tag-input-${Math.random().toString(36).slice(2, 10)}`;

const draft = defineModel<string>('pending', { default: '' });

// すでに追加した項目は候補から外す(重複は commitDraft 側で弾くので、出しても選べない)。
const unusedSuggestions = computed(() => props.suggestions.filter(value => !items.value.includes(value)));

// 入力途中のまま保存されて消える事故を避けるため、Enter/+ だけでなく blur でも確定する。
// (保存ボタンを押すと先に blur が走るので、打ちっぱなしの1件も取りこぼさない)
function commitDraft() {
	const value = draft.value.trim();
	draft.value = '';
	if (value.length === 0) return;
	if (items.value.includes(value)) return;
	items.value = [...items.value, value];
}

function removeAt(index: number) {
	items.value = items.value.filter((_, i) => i !== index);
}
</script>

<style lang="scss" module>
.root { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 4px 4px 9px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface-2); color: var(--hy-ink); font-size: 11.5px; }
.chipIndex { display: inline-grid; flex: 0 0 auto; place-items: center; width: 16px; height: 16px; border-radius: 999px; background: color-mix(in srgb, var(--hy-accent) 18%, transparent); color: var(--hy-accent-ink); font-size: 9.5px; font-weight: 800; }
.chipText { overflow-wrap: anywhere; min-width: 0; }
.chipRemove { display: inline-grid; flex: 0 0 auto; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--hy-muted); font-size: 12px; cursor: pointer; }
.chipRemove:hover { background: color-mix(in srgb, var(--hy-ink) 10%, transparent); color: var(--hy-ink); }
.entry { display: flex; gap: 6px; min-width: 0; }
.input { flex: 1; min-width: 0; box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--hy-border); border-radius: 9px; outline: none; background: var(--hy-surface); color: var(--hy-ink); font: inherit; }
.input:focus { border-color: var(--hy-accent); }
.add { display: grid; flex: 0 0 auto; place-items: center; width: 44px; min-height: 44px; border: 1px solid var(--hy-border); border-radius: 9px; background: var(--hy-surface); color: var(--hy-ink); font-size: 15px; cursor: pointer; }
.add:hover:not(:disabled) { border-color: var(--hy-accent); color: var(--hy-accent-ink); }
.add:disabled { opacity: .42; cursor: default; }
</style>
