<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="copy.title" @close="close" @closed="emit('closed')">
	<div :class="$style.controls">
		<HyCapsule v-model="kind" :options="kinds" :label="copy.activityFilter" @update:modelValue="load"/>
		<HyCapsule v-model="months" :options="ranges" :label="copy.period" @update:modelValue="load"/>
	</div>
	<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	<p v-if="loading" class="hy-empty">{{ i18n.ts._hata._hatady._statsDetail.loading }}</p>
	<template v-else>
		<section :class="$style.summary">
			<small>{{ startDate }} — {{ today }}</small>
			<div>
				<span>
					<small>{{ copy.records }}</small>
					<strong>
						{{ rows.length }}
						<small>{{ copy.itemsUnit }}</small>
					</strong>
				</span>
				<span>
					<small>{{ copy.recordedTime }}</small>
					<strong>{{ duration(totalSeconds) }}</strong>
					<small v-if="untimed">{{ i18n.tsx._hata._hatady._statsView.untimed({ count: untimed }) }}</small>
				</span>
				<span>
					<small>{{ copy.longestStreak }}</small>
					<strong>
						{{ longest }}
						<small>{{ i18n.ts._hata._hatady._statsDetail.dayUnit }}</small>
					</strong>
				</span>
			</div>
		</section>
		<section :class="$style.calendar">
			<header>
				<h3>{{ formatMonth(calendarMonth) }}</h3>
				<div>
					<button class="hy-icon-button" :disabled="monthIndex === 0" :aria-label="copy.previousMonth" @click="moveMonth(-1)">
						<i class="ti ti-chevron-left"></i>
					</button>
					<button
						class="hy-icon-button"
						:disabled="monthIndex === monthKeys.length - 1"
						:aria-label="copy.nextMonth"
						@click="moveMonth(1)"
					>
						<i class="ti ti-chevron-right"></i>
					</button>
				</div>
			</header>
			<div :class="$style.calendarGrid">
				<small v-for="d in weekdays" :key="d">{{ d }}</small>
				<template v-for="(cell, index) in cells" :key="index">
					<button
						v-if="cell"
						:ref="(el) => (dayButtons[cell.date] = el)"
						:class="$style.day"
						:disabled="cell.date > today"
						:aria-current="cell.date === today ? 'date' : undefined"
						:aria-pressed="selectedDay === cell.date"
						:aria-label="i18n.tsx._hata._hatady._statsView.dayCount({ date: cell.date, count: cell.count })"
						@click="selectDay(cell.date)"
					>
						<span>{{ cell.day }}</span>
						<i v-if="cell.count" :style="{ opacity: Math.min(1, 0.3 + cell.count * 0.15) }"></i>
					</button>
					<span v-else></span>
				</template>
			</div>
			<section v-if="selectedDay" :class="$style.dayPreview">
				<header>
					<h4 ref="dayTitle" tabindex="-1">{{ i18n.tsx._hata._hatady._statsView.dayRecords({ date: selectedDay }) }}</h4>
					<button class="hy-icon-button" :aria-label="copy.closeDay" @click="closeDay">
						<i class="ti ti-x"></i>
					</button>
				</header>
				<details v-for="a in dayRows" :key="a.id">
					<summary>
						<i :class="kindIcon(a)"></i>
						<span>
							{{ record(a).title || a.media?.work?.title || record(a).workSnapshot?.title }}
							<small>{{ duration(seconds(a)) }}</small>
						</span>
					</summary>
					<HatadyActivityCard
						:activity="a"
						:showActions="false"
						detailed
						@openLog="() => {}"
						@openBook="() => {}"
						@openMedia="() => {}"
						@openSession="() => {}"
					/>
				</details>
				<p v-if="!dayRows.length" class="hy-empty">{{ copy.emptyDay }}</p>
			</section>
		</section>
		<details :class="$style.detail">
			<summary>
				<i class="ti ti-clock"></i>
				{{ copy.timeTrend }}
			</summary>
			<HyCapsule v-model="timeView" :options="timeChoices" :label="copy.timeDisplay"/>
			<HyStatsChart
				:title="
					timeView === 'hour' ? copy.hourlyRecords : timeView === 'weekday' ? copy.weekdayTime : copy.monthlyTime
				"
				:rows="timeRows"
				:unit="timeView === 'hour' ? copy.itemsUnit : 'seconds'"
			/>
			<p v-if="timeView === 'hour'" class="hy-muted">{{ copy.startedOnly }}</p>
		</details>
		<details :class="$style.detail">
			<summary>
				<i class="ti ti-palette"></i>
				{{ copy.subjectTrend }}
			</summary>
			<HyCapsule v-model="subjectView" :options="subjectChoices" :label="copy.subjectDisplay"/>
			<select v-if="subjectView === 'month'" v-model="subject" class="hy-input" :aria-label="copy.subjectByMonth">
				<option value="">{{ copy.allSubjects }}</option>
				<option v-for="s in subjects" :key="s">{{ s }}</option>
			</select>
			<HyStatsChart :title="subjectView === 'month' ? copy.subjectMonthlyTime : copy.subjectTime" :rows="subjectRows"/>
		</details>
		<details :class="$style.detail">
			<summary>
				<i class="ti ti-flag"></i>
				{{ kind === 'all' || kind === 'study' ? copy.bestAndFinished : copy.personalBest }}
			</summary>
			<div :class="$style.bests">
				<span>
					<small>{{ copy.oneRecord }}</small>
					<strong>{{ duration(bestSession) }}</strong>
				</span>
				<span>
					<small>{{ copy.dayTotal }}</small>
					<strong>{{ duration(bestDay) }}</strong>
				</span>
			</div>
			<HyStatsChart v-if="kind === 'all' || kind === 'study'" :title="copy.monthlyFinished" :rows="finishedRows" :unit="copy.booksUnit"/>
			<p v-if="legacyPages && (kind === 'all' || kind === 'study')">{{ i18n.tsx._hata._hatady._statsView.pageCount({ count: legacyPages }) }}</p>
		</details>
	</template>
</HyDialog>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import HyStatsChart from '@/components/HyStatsChart.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyTzOffset } from '@/utility/hatady-prefs.js';
import { requireHatadyActivityPage } from '@/utility/hatady-media.js';
import { collectActivityPages, localDateKey, activityKind } from '@/utility/hatady-home.js';
import { HATADY_ACTIVITY_CHOICES, hatadyDuration as duration, hatadySeconds } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
const copy = i18n.ts._hata._hatady._statsView;
const formatMonth = (month: string) => month ? versatileLang.startsWith('ja') ? `${month.slice(0, 4)}年${month.slice(5, 7)}月` : new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'long' }).format(new Date(`${month}-01T12:00:00`)) : '';
const shortMonth = (month: string) => new Intl.DateTimeFormat(versatileLang, { month: 'short' }).format(new Date(`${month}-01T12:00:00`));
const props = defineProps<{ initialKind?: string }>();
const emit = defineEmits<{ (e: 'closed'): void }>();
const dialog = ref<any>(),
	dayTitle = ref<HTMLElement>(),
	rows = ref<any[]>([]),
	legacy = ref<any>(null),
	kind = ref(props.initialKind || 'all'),
	months = ref('3'),
	loading = ref(false),
	error = ref(''),
	calendarMonth = ref(''),
	selectedDay = ref<string | null>(null),
	timeView = ref('month'),
	subjectView = ref('total'),
	subject = ref('');
const dayButtons: Record<string, any> = {};
let previousScroll = 0,
	request = 0;
const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(versatileLang, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)));
const kinds = [{ value: 'all', label: i18n.ts._hata._hatady._media.all, icon: 'ti ti-chart-bar' }, ...HATADY_ACTIVITY_CHOICES];
const ranges = [3, 6, 12].map((n) => ({ value: String(n), label: i18n.tsx._hata._hatady._statsView.monthRange({ count: n }), icon: 'ti ti-calendar' }));
const timeChoices = [
	{ value: 'month', label: copy.byMonth, icon: 'ti ti-calendar' },
	{ value: 'weekday', label: copy.byWeekday, icon: 'ti ti-calendar-week' },
	{ value: 'hour', label: copy.byHour, icon: 'ti ti-clock' },
];
const subjectChoices = [
	{ value: 'total', label: copy.breakdown, icon: 'ti ti-chart-pie' },
	{ value: 'month', label: copy.byMonth, icon: 'ti ti-chart-bar' },
];
const today = localDateKey(new Date()),
	monthKeys = computed(() =>
		Array.from({ length: Number(months.value) }, (_, i) => {
			const now = new Date();
			return localDateKey(new Date(now.getFullYear(), now.getMonth() - Number(months.value) + 1 + i, 1)).slice(0, 7);
		}),
	),
	startDate = computed(() => `${monthKeys.value[0]}-01`),
	monthIndex = computed(() => monthKeys.value.indexOf(calendarMonth.value));

function record(a: any): any {
	return a.study || a.media?.session || {};
}

function seconds(a: any) {
	return hatadySeconds(record(a));
}

function sum(list: any[]): number | null {
	return list.some((a) => seconds(a) != null) ? list.reduce((n, a) => n + (seconds(a) || 0), 0) : null;
}

function date(a: any) {
	return localDateKey(new Date(a.occurredAt));
}

function genre(a: any) {
	return record(a).subject || a.media?.work?.genres?.[0] || record(a).details?.genre || i18n.ts._hata._hatady._workWizard.unset;
}

const totalSeconds = computed(() => sum(rows.value)),
	untimed = computed(() => rows.value.filter((a) => seconds(a) == null).length),
	days = computed(() => [...new Set(rows.value.map(date))].sort()),
	longest = computed(() => {
		let n = 0,
			best = 0,
			last = '';
		for (const d of days.value) {
			n = last && Date.parse(`${d}T12:00:00Z`) - Date.parse(`${last}T12:00:00Z`) === 86400000 ? n + 1 : 1;
			best = Math.max(best, n);
			last = d;
		}
		return best;
	}),
	bestSession = computed(() =>
		rows.value.some((a) => seconds(a) != null) ? Math.max(...rows.value.map((a) => seconds(a) || 0)) : null,
	),
	bestDay = computed(() =>
		rows.value.some((a) => seconds(a) != null)
			? Math.max(...days.value.map((d) => sum(rows.value.filter((a) => date(a) === d)) || 0))
			: null,
	);
const cells = computed(() => {
	const [y, m] = calendarMonth.value.split('-').map(Number);
	if (!y || !m) return [];
	const first = new Date(y, m - 1, 1).getDay(),
		count = new Date(y, m, 0).getDate();
	return Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, i) => {
		const day = i - first + 1;
		if (day < 1 || day > count) return null;
		const key = `${calendarMonth.value}-${String(day).padStart(2, '0')}`;
		return { date: key, day, count: rows.value.filter((a) => date(a) === key).length };
	});
});
const dayRows = computed(() => rows.value.filter((a) => date(a) === selectedDay.value));
const timeRows = computed(() =>
	timeView.value === 'month'
		? monthKeys.value.map((m) => ({
			label: m,
			short: shortMonth(m),
			value: sum(rows.value.filter((a) => date(a).startsWith(m))),
		}))
		: timeView.value === 'weekday'
			? weekdays.map((d, i) => ({
				label: i18n.tsx._hata._hatady._statsView.weekdayLabel({ day: d }),
				short: d,
				value: sum(rows.value.filter((a) => new Date(a.occurredAt).getDay() === i)),
			}))
			: Array.from({ length: 24 }, (_, h) => ({
				label: i18n.tsx._hata._hatady._statsView.hourLabel({ hour: h }),
				short: String(h),
				value: rows.value.filter((a) => {
					const start = record(a).startedAt || record(a).details?.startedAt;
					return typeof start === 'string' && /^\d{2}:\d{2}/.test(start) && Number(start.slice(0, 2)) === h;
				}).length,
			})),
);
const subjects = computed(() => [...new Set(rows.value.map(genre))] as string[]),
	subjectRows = computed(() =>
		subjectView.value === 'month'
			? monthKeys.value.map((m) => ({
				label: m,
				short: shortMonth(m),
				value: sum(rows.value.filter((a) => date(a).startsWith(m) && (!subject.value || genre(a) === subject.value))),
			}))
			: subjects.value.map((s) => ({ label: s, value: sum(rows.value.filter((a) => genre(a) === s)) })),
	),
	finishedRows = computed(() =>
		monthKeys.value.map((m) => ({
			label: m,
			short: shortMonth(m),
			value: legacy.value?.monthlyFinished?.find((r: any) => r.month === m)?.books || 0,
		})),
	),
	legacyPages = computed(
		() => legacy.value?.monthlyFinished?.reduce((n: number, r: any) => n + (r.pages || 0), 0) || 0,
	);

async function load() {
	const seq = ++request;
	loading.value = true;
	error.value = '';
	selectedDay.value = null;
	const from = new Date(`${startDate.value}T00:00:00`).getTime(),
		to = Date.now();
	try {
		const [activities, stats] = await Promise.all([
			collectActivityPages(async (cursor) =>
				requireHatadyActivityPage(
					await (misskeyApi as any)('hata/hatady/activities', {
						scope: 'mine',
						limit: 100,
						sinceDate: from,
						untilDate: to,
						...(kind.value === 'all' ? {} : { kinds: [kind.value] }),
						...(cursor ? { cursor } : {}),
					}),
				),
			),
			misskeyApi('hata/hatady/stats-detail', { months: Number(months.value), tzOffset: hatadyTzOffset() }),
		]);
		if (seq !== request) return;
		rows.value = activities;
		legacy.value = stats;
		if (!monthKeys.value.includes(calendarMonth.value)) calendarMonth.value = monthKeys.value.at(-1)!;
	} catch {
		if (seq === request) error.value = copy.loadFailed;
	} finally {
		if (seq === request) loading.value = false;
	}
}

function moveMonth(delta: number) {
	calendarMonth.value = monthKeys.value[monthIndex.value + delta];
	selectedDay.value = null;
}

async function selectDay(key: string) {
	if (!selectedDay.value) previousScroll = dialog.value?.bodyEl?.scrollTop || 0;
	selectedDay.value = key;
	await nextTick();
	dayTitle.value?.focus({ preventScroll: true });
	dayTitle.value?.scrollIntoView({ block: 'nearest' });
}

async function closeDay() {
	const day = selectedDay.value;
	selectedDay.value = null;
	await nextTick();
	if (day) dayButtons[day]?.focus({ preventScroll: true });
	if (dialog.value?.bodyEl) dialog.value.bodyEl.scrollTop = previousScroll;
}

function close() {
	if (selectedDay.value) void closeDay();
	else dialog.value?.close();
}

function kindIcon(a: any) {
	return HATADY_ACTIVITY_CHOICES.find((k) => k.value === activityKind(a))?.icon || 'ti ti-notebook';
}

onMounted(load);
</script>
<style module lang="scss">
.controls {
	display: flex;
	gap: 12px;
	flex-direction: column;
	align-items: center;
	margin-bottom: 24px;
}
.summary > small {
	display: block;
	color: var(--hy-muted);
	font-size: 12px;
	margin-bottom: 12px;
}
.summary > div {
	display: grid;
	grid-template-columns: 1fr 1.6fr 1fr;
	gap: 12px;
	align-items: center;
}
.summary span,
.bests span {
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 8px;
}
.summary strong {
	font-size: 26px;
	font-weight: 400;
}
.summary strong small {
	font-size: 13px;
	margin-left: 4px;
}
.summary small,
.bests small {
	font-size: 12px;
	color: var(--hy-muted);
}
.calendar {
	border: 1px solid var(--hy-border);
	border-radius: 22px;
	padding: 18px;
	margin: 24px 0;
}
.calendar header,
.dayPreview header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.calendar h3 {
	font-size: 18px;
}
.calendarGrid {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
	gap: 6px;
}
.calendarGrid > small {
	text-align: center;
	color: var(--hy-muted);
	padding: 10px 0;
}
.day {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	gap: 5px;
	border: 1px solid transparent;
	border-radius: 12px;
	background: none;
	color: var(--hy-body);
	min-height: 48px;
	cursor: pointer;
}
.day[aria-pressed='true'] {
	background: var(--hy-surface-2);
	border-color: var(--hy-accent);
}
.day[aria-current='date'] {
	color: var(--hy-accent-ink);
	font-weight: 700;
}
.day i {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--hy-accent);
}
.dayPreview {
	border-top: 1px solid var(--hy-border);
	margin-top: 16px;
	padding-top: 12px;
}
.dayPreview details > summary {
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 60px;
	cursor: pointer;
}
.dayPreview summary > span {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 5px;
	font-size: 14px;
}
.dayPreview summary small {
	font-size: 12px;
	color: var(--hy-muted);
}
.dayPreview dl {
	display: grid;
	grid-template-columns: 1fr 2fr;
	gap: 8px;
	font-size: 12px;
	overflow-wrap: anywhere;
}
.dayPreview dd {
	margin: 0;
}
.detail {
	border-top: 1px solid var(--hy-border);
	padding: 6px 0;
}
.detail > summary {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 60px;
	cursor: pointer;
	font-weight: 700;
}
.detail > nav {
	justify-content: center;
}
.bests {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
	padding: 20px;
}
.bests strong {
	font-size: 24px;
	color: var(--hy-accent-ink);
}
</style>
