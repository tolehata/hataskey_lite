<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady): 武器ごとの成績を行で記録する表。
記録する指標(キル/デス/スペシャル/救助/サポート)は作品によって有無が違うので、
チェックボックスで使うものだけ列を出す。合計は入力から自動で出すので手計算は要らない。
-->
<template>
<div :class="$style.root">
	<div :class="$style.fieldPicker" role="group" :aria-label="copy.statFieldsLabel">
		<span :class="$style.pickerLead">{{ copy.statFieldsLabel }}</span>
		<label v-for="field in allFields" :key="field" :class="$style.pickerChip" :data-active="activeFields.includes(field)">
			<input type="checkbox" :name="`stat-${field}`" :checked="activeFields.includes(field)" @change="toggleField(field)">
			{{ copy.fieldLabels[field] }}
		</label>
	</div>

	<p v-if="activeFields.length === 0" :class="$style.empty">{{ copy.pickAtLeastOne }}</p>

	<template v-else>
		<div v-if="rows.length > 0" :class="$style.rows">
			<div :class="$style.headRow" :style="gridStyle" aria-hidden="true">
				<span>{{ copy.weaponLabel }}</span>
				<span v-for="field in activeFields" :key="field" :class="$style.numHead">{{ copy.fieldLabels[field] }}</span>
				<span></span>
			</div>
			<div v-for="(row, index) in rows" :key="index" :class="$style.row" :style="gridStyle">
				<label :class="$style.cell">
					<span :class="$style.cellLabel">{{ copy.weaponLabel }}</span>
					<input :value="row.weapon" :name="`weapon-${index}`" type="text" :class="$style.input" maxlength="256" :placeholder="copy.weaponPlaceholder" :list="weaponSuggestions.length > 0 ? listId : undefined" @input="setWeapon(index, $event)">
				</label>
				<label v-for="field in activeFields" :key="field" :class="$style.cell">
					<span :class="$style.cellLabel">{{ copy.fieldLabels[field] }}</span>
					<input :value="row[field] ?? ''" :name="`weapon-${index}-${field}`" type="number" min="0" max="1000000" :class="$style.input" @input="setStat(index, field, $event)">
				</label>
				<button type="button" :class="$style.removeRow" :title="copy.removeRow" :aria-label="`${copy.removeRow}: ${row.weapon || index + 1}`" @click="removeRow(index)"><i class="ti ti-x"></i></button>
			</div>
		</div>

		<datalist v-if="weaponSuggestions.length > 0" :id="listId">
			<option v-for="value in weaponSuggestions" :key="value" :value="value"></option>
		</datalist>

		<div :class="$style.actions">
			<button type="button" :class="$style.addRow" @click="addRow"><i class="ti ti-plus"></i> {{ copy.addRow }}</button>
			<span v-if="totalsText" :class="$style.totals"><i class="ti ti-sum"></i> {{ copy.totalLabel }} {{ totalsText }}</span>
		</div>
	</template>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { HatadyStatField, HatadyWeaponStatRow } from '@/utility/hatady-media.js';
import { HATADY_STAT_FIELDS, mediaStatTotals } from '@/utility/hatady-media.js';

const rows = defineModel<HatadyWeaponStatRow[]>('rows', { required: true });
const activeFields = defineModel<HatadyStatField[]>('fields', { required: true });

const props = withDefaults(defineProps<{
	copy: {
		statFieldsLabel: string;
		fieldLabels: Record<HatadyStatField, string>;
		weaponLabel: string;
		weaponPlaceholder: string;
		addRow: string;
		removeRow: string;
		totalLabel: string;
		pickAtLeastOne: string;
	};
	/** 過去の記録から集めた武器名の候補。 */
	weaponSuggestions?: string[];
}>(), {
	weaponSuggestions: () => [],
});

const allFields = HATADY_STAT_FIELDS;
// datalist の id は画面内で一意にする必要がある(実体ごとに別の値を引く)。
const listId = `hy-weapon-stats-${Math.random().toString(36).slice(2, 10)}`;

// 武器の列＋指標の列＋削除ボタンの列。指標の数で横幅が変わる。
const gridStyle = computed(() => ({ gridTemplateColumns: `minmax(0, 1.6fr) repeat(${activeFields.value.length}, minmax(0, 1fr)) auto` }));

const totalsText = computed(() => {
	const totals = mediaStatTotals({ weaponStats: rows.value });
	return activeFields.value
		.filter(field => typeof totals[field] === 'number')
		.map(field => `${props.copy.fieldLabels[field]} ${totals[field]}`)
		.join(' · ');
});

function toggleField(field: HatadyStatField) {
	const next = activeFields.value.includes(field)
		? activeFields.value.filter(item => item !== field)
		: [...activeFields.value, field];
	// 定義順に揃えることで、チェックした順番で列が入れ替わらないようにする。
	activeFields.value = HATADY_STAT_FIELDS.filter(item => next.includes(item));
}

function addRow() {
	rows.value = [...rows.value, { weapon: '' }];
}

function removeRow(index: number) {
	rows.value = rows.value.filter((_, i) => i !== index);
}

function setWeapon(index: number, event: Event) {
	const value = (event.target as HTMLInputElement).value;
	rows.value = rows.value.map((row, i) => i === index ? { ...row, weapon: value } : row);
}

function setStat(index: number, field: HatadyStatField, event: Event) {
	const raw = (event.target as HTMLInputElement).value;
	rows.value = rows.value.map((row, i) => {
		if (i !== index) return row;
		const next: HatadyWeaponStatRow = { ...row };
		const parsed = Number(raw);
		// 空欄は「未記録」。0 と区別したいのでキーごと落とす。
		if (raw.trim() === '' || !Number.isFinite(parsed) || parsed < 0) delete next[field];
		else next[field] = Math.floor(parsed);
		return next;
	});
}
</script>

<style lang="scss" module>
.root { display: flex; flex-direction: column; gap: 11px; min-width: 0; }
.fieldPicker { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.pickerLead { margin-right: 3px; color: var(--hy-muted); font-family: var(--hy-heading); font-size: 10.5px; font-weight: 700; }
.pickerChip { min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: var(--hy-body); font-size: 11px; font-weight: 700; cursor: pointer; }
.pickerChip input { accent-color: var(--hy-accent); }
.pickerChip[data-active="true"] { border-color: var(--hy-accent); background: color-mix(in srgb, var(--hy-accent) 14%, var(--hy-surface)); color: var(--hy-accent-ink); }
.empty { margin: 0; color: var(--hy-muted); font-size: 11px; }
.rows { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.headRow, .row { display: grid; gap: 8px; align-items: end; min-width: 0; }
.headRow { color: var(--hy-muted); font-family: var(--hy-heading); font-size: 10px; font-weight: 700; }
.numHead { text-align: center; }
.cell { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
/* 広い幅では見出し行があるので、各セルの見出しは折り返し時だけ出す。 */
.cellLabel { display: none; color: var(--hy-muted); font-size: 10px; font-weight: 700; }
.input { min-height: 44px; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--hy-border); border-radius: 9px; outline: none; background: var(--hy-surface); color: var(--hy-ink); font: inherit; }
.input:focus { border-color: var(--hy-accent); }
.removeRow { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--hy-border); border-radius: 9px; background: var(--hy-surface); color: var(--hy-muted); cursor: pointer; }
.removeRow:hover { border-color: var(--hy-accent); color: var(--hy-ink); }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
.addRow { min-height: 44px; display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; border: 1px dashed var(--hy-border); border-radius: 999px; background: transparent; color: var(--hy-body); font-family: var(--hy-heading); font-size: 11.5px; font-weight: 700; cursor: pointer; }
.addRow:hover { border-color: var(--hy-accent); color: var(--hy-accent-ink); }
.totals { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; color: var(--hy-muted); font-size: 11px; font-weight: 700; }

/* 狭いときは1行=1カードに畳み、各入力に見出しを付ける(横並びのままだと数字の意味が分からなくなる)。 */
@container (max-width: 560px) {
	.headRow { display: none; }
	.row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; padding: 10px; border: 1px solid var(--hy-border); border-radius: 10px; background: var(--hy-surface); }
	.cellLabel { display: block; }
	.removeRow { grid-column: 1 / -1; justify-self: end; }
	.totals { margin-left: 0; }
}
</style>
