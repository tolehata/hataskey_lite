<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
	<section class="sources" :aria-label="copy.title" @keydown.esc="openHelp = null">
		<header><strong>{{ copy.title }}</strong><span :title="resetDescription"><i class="ti ti-clock" aria-hidden="true"></i>00:00</span></header>
		<div v-for="row in rows" :key="row.key" class="rowGroup">
			<div class="row">
				<span class="icon"><i :class="row.icon" aria-hidden="true"></i></span>
				<span class="middle">
					<span class="label"><strong><span v-if="row.brand" class="brand">{{ row.brand }}</span>{{ row.rest }}</strong><span class="number" :class="{ full: row.got >= row.cap }">{{ row.got }}/{{ row.cap }}</span></span>
					<span class="bar"><span :class="{ full: row.got >= row.cap }" :style="{ width: `${Math.min(100, Math.max(0, row.got / row.cap * 100))}%` }"></span></span>
					<button v-if="row.key === 'hatady'" type="button" class="hatadyLink" @click="emit('hatady')">{{ copy.openHatady }} <i class="ti ti-arrow-right" aria-hidden="true"></i></button>
				</span>
				<button v-if="row.key !== 'login'" type="button" class="action" :aria-label="i18n.tsx._hata._hatask._dropSources.eligibility({ source: row.key === 'todo' ? 'Hatask ToDo' : 'Hatady' })" :aria-expanded="openHelp === row.key" :aria-controls="`${helpId}-${row.key}`" @click="openHelp = openHelp === row.key ? null : row.key"><i class="ti ti-info-circle" aria-hidden="true"></i></button>
				<span v-else class="status"><i v-if="row.got >= row.cap" class="ti ti-circle-check-filled" :aria-label="copy.dailyLimit"></i></span>
			</div>
			<div v-if="row.key !== 'login' && openHelp === row.key" :id="`${helpId}-${row.key}`" class="help">
				<template v-if="row.key === 'todo'">
					<p>{{ copy.todoIntro }}<span class="phrase">{{ copy.oneDrop }}</span></p>
					<ul>
						<li>{{ i18n.tsx._hata._hatask._dropSources.todoAge({ minutes: String(rules.todoMinAgeMinutes) }) }}</li>
						<li>{{ i18n.tsx._hata._hatask._dropSources.todoLength({ length: String(rules.todoMinLength) }) }}</li>
						<li>{{ copy.todoUnique }}</li>
						<li>{{ copy.todoOnce }}</li>
						<li>{{ i18n.tsx._hata._hatask._dropSources.dailyCap({ count: String(row.cap) }) }}</li>
					</ul>
				</template>
				<template v-else>
					<p>{{ copy.hatadyIntro }}<span class="phrase">{{ copy.oneDrop }}</span></p>
					<ul>
						<li>{{ i18n.tsx._hata._hatask._dropSources.hatadyGap({ duration: hatadyGap }) }}</li>
						<li>{{ copy.hatadyNewOnly }}</li>
						<li>{{ i18n.tsx._hata._hatask._dropSources.dailyCap({ count: String(row.cap) }) }}</li>
					</ul>
				</template>
				<p class="helpFooter">{{ i18n.tsx._hata._hatask._dropSources.footer({ capacity: String(store) }) }}</p>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
type Counts = { todo: number; hatady: number; login: number };
type Rules = { todoMinAgeMinutes: number; todoMinLength: number; hatadyGapSeconds: number };
const props = withDefaults(defineProps<{ today: Counts; caps?: Counts; resetAt?: string; rules?: Rules; store?: number }>(), {
	caps: () => ({ todo: 5, hatady: 10, login: 1 }),
	resetAt: '00:00',
	rules: () => ({ todoMinAgeMinutes: 30, todoMinLength: 3, hatadyGapSeconds: 60 }),
	store: 20,
});
const copy = i18n.ts._hata._hatask._dropSources;
const helpId = `hatask-drop-help-${useId()}`;
const openHelp = ref<'todo' | 'hatady' | null>(null);
const hatadyGap = computed(() => {
	const seconds = props.rules.hatadyGapSeconds;
	if (seconds < 60) return i18n.tsx._hata._hatask._dropSources.seconds({ seconds: String(seconds) });
	const minutes = Math.floor(seconds / 60);
	const remaining = seconds % 60;
	return remaining ? i18n.tsx._hata._hatask._dropSources.minutesSeconds({ minutes: String(minutes), seconds: String(remaining) }) : i18n.tsx._hata._hatask._dropSources.minutes({ minutes: String(minutes) });
});
const resetDescription = computed(() => { const date = new Date(props.resetAt); return i18n.tsx._hata._hatask._dropSources.resetsAt({ time: Number.isNaN(date.getTime()) ? '00:00' : date.toLocaleString(versatileLang) }); });
const emit = defineEmits<{ hatady: [] }>();
const rows = computed(() => [
	{ key: 'todo' as const, brand: 'Hatask', rest: ` ${copy.todo}`, icon: 'ti ti-checkbox', got: props.today.todo, cap: props.caps.todo },
	{ key: 'hatady' as const, brand: 'Hatady', rest: '', icon: 'ti ti-notebook', got: props.today.hatady, cap: props.caps.hatady },
	{ key: 'login' as const, brand: '', rest: copy.login, icon: 'ti ti-login-2', got: props.today.login, cap: props.caps.login },
]);
</script>
<style scoped>
.sources{min-width:0;padding:4px 14px 6px;border:1px solid var(--rule);border-radius:16px;background:color-mix(in srgb,var(--surface) 50%,transparent);color:var(--fg);font-family:var(--htk-font-body,inherit)}header{display:flex;align-items:center;gap:8px;padding:8px 0 4px}header strong{font:800 12px var(--htk-font-head,inherit);letter-spacing:.08em}header span{display:flex;align-items:center;gap:3px;margin-left:auto;color:var(--fg-2);font:700 11px 'Archivo',sans-serif}header i{font-size:13px}.rowGroup{min-width:0;border-top:1px solid var(--rule)}.row{display:grid;grid-template-columns:32px minmax(0,1fr) 32px;align-items:center;gap:10px;padding:9px 0}.icon{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--fill);color:var(--accent-ink)}.icon i{font-size:17px}.middle{min-width:0;display:grid;gap:4px}.label{display:flex;align-items:baseline;gap:8px;min-width:0}.label strong{min-width:0;font-size:13px;overflow-wrap:anywhere}.brand{font-family:'Righteous',sans-serif;font-weight:400;letter-spacing:.01em}.number{margin-left:auto;color:var(--fg);font:800 13px 'Archivo',sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}.number.full{color:var(--accent-ink)}.bar{height:6px;border-radius:999px;background:var(--fill-2);overflow:hidden}.bar span{display:block;height:100%;border-radius:inherit;background:var(--accent);transition:width .4s cubic-bezier(.2,0,0,1)}.bar span.full{background:var(--accent-ink)}.action{box-sizing:border-box;padding:0;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--rule);border-radius:50%;background:transparent;color:var(--fg);cursor:pointer}.action i{font-size:17px}.action:hover,.action[aria-expanded="true"]{border-color:var(--accent);color:var(--accent-ink)}.hatadyLink{justify-self:start;display:inline-flex;align-items:center;gap:3px;min-height:36px;padding:6px 10px;border:1px solid var(--rule);border-radius:999px;background:var(--surface);color:var(--accent-ink);font:700 12px/1.4 var(--htk-font-body,inherit);cursor:pointer}.hatadyLink i{font-size:12px}.status{width:32px;display:grid;place-items:center;color:var(--accent-ink)}.status i{font-size:18px}.help{min-width:0;margin:0 0 10px;padding:10px 12px;border-radius:10px;background:var(--fill);color:var(--fg);font-size:12px;line-height:1.6;overflow-wrap:anywhere}.help p{margin:0}.help ul{margin:5px 0 0;padding-left:1.35em}.help li+li{margin-top:2px}.helpFooter{margin-top:8px!important;padding-top:7px;border-top:1px solid var(--rule);color:var(--fg-2)}@media(prefers-reduced-motion:reduce){.bar span{transition:none}}
.phrase{display:inline-block}
</style>
