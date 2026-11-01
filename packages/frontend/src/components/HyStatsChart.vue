<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<figure :class="$style.root">
	<figcaption>{{ title }}</figcaption>
	<svg viewBox="0 0 380 210" role="img" :aria-label="title">
		<desc>{{ describeRows() }}</desc>
		<g v-for="i in 3" :key="i">
			<line x1="42" :y1="170 - (i - 1) * 70" x2="370" :y2="170 - (i - 1) * 70"/>
			<text x="35" :y="174 - (i - 1) * 70" text-anchor="end">{{ Math.round((ceiling * (i - 1)) / 2) }}</text>
		</g>
		<g v-for="(r, index) in rows" :key="r.label">
			<rect
				v-if="r.value != null && r.value > 0"
				:x="42 + step * (index + 0.2)"
				:y="170 - (r.value / factor / ceiling) * 140"
				:width="Math.max(2, step * 0.6)"
				:height="(r.value / factor / ceiling) * 140"
				rx="3"
			>
				<title>{{ r.label }} {{ format(r.value) }}</title>
			</rect>
			<text v-if="index % every === 0" :x="42 + step * (index + 0.5)" y="194" text-anchor="middle">
				{{ r.short || r.label }}
			</text>
			<text v-if="r.value == null" :x="42 + step * (index + 0.5)" y="165" text-anchor="middle">—</text>
		</g>
	</svg>
	<small>{{ unit === 'seconds' ? (factor === 3600 ? copy.hoursUnit : factor === 60 ? copy.minutesUnit : copy.secondsUnit) : unit }}</small>
	<details>
		<summary>{{ copy.viewNumbers }}</summary>
		<table>
			<caption>{{ title }}</caption>
			<tbody>
				<tr v-for="r in rows" :key="r.label">
					<th scope="row">{{ r.label }}</th>
					<td>{{ format(r.value) }}</td>
				</tr>
			</tbody>
		</table>
	</details>
</figure>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { hatadyDuration } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
const copy = i18n.ts._hata._hatady._controls;
const props = withDefaults(
	defineProps<{ title: string; rows: { label: string; short?: string; value: number | null }[]; unit?: string }>(),
	{ unit: 'seconds' },
);
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value || 0))),
	factor = computed(() => (props.unit === 'seconds' ? (max.value >= 3600 ? 3600 : max.value >= 60 ? 60 : 1) : 1)),
	ceiling = computed(() => {
		const n = max.value / factor.value,
			p = 10 ** Math.floor(Math.log10(n));
		return ([1, 2, 5, 10].find((v) => v * p >= n) || 10) * p;
	}),
	step = computed(() => 328 / Math.max(1, props.rows.length)),
	every = computed(() => (props.rows.length > 12 ? 6 : props.rows.length > 7 ? 2 : 1));

function format(value: number | null) {
	return value == null ? copy.durationMissing : props.unit === 'seconds' ? hatadyDuration(value) : `${value}${props.unit}`;
}

function describeRows(): string {
	const descriptions = props.rows.map((row) => `${row.label} ${format(row.value)}`);
	return versatileLang.startsWith('ja') ? descriptions.join('、') : new Intl.ListFormat(versatileLang, { style: 'short', type: 'conjunction' }).format(descriptions);
}
</script>
<style module>
.root {
	margin: 20px 0;
	position: relative;
}
.root figcaption {
	font-size: 14px;
	font-weight: 700;
}
.root svg {
	width: 100%;
	height: auto;
	overflow: visible;
}
.root svg line {
	stroke: var(--hy-border);
}
.root svg text {
	font-size: 11px;
	fill: var(--hy-muted);
}
.root svg rect {
	fill: var(--hy-accent);
}
.root > small {
	position: absolute;
	top: 4px;
	right: 0;
	color: var(--hy-muted);
}
.root summary {
	min-height: 44px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--hy-muted);
}
.root table {
	width: 100%;
	font-size: 12px;
	border-collapse: collapse;
}
.root th,
.root td {
	padding: 8px;
	border-bottom: 1px solid var(--hy-border);
}
.root th {
	text-align: left;
}
.root td {
	text-align: right;
}
</style>
