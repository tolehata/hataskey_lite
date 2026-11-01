<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="copy.title" @close="dialog?.close()" @closed="emit('closed')">
	<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	<p v-if="loading" class="hy-empty">{{ copy.loading }}</p>
	<template v-else>
		<section :class="$style.hero">
			<div>
				<small>
					<i class="ti ti-flame"></i>
					{{ copy.currentStreak }}
				</small>
				<strong>
					{{ data.current }}
					<small>{{ data.current === 1 ? copy.daySingular : copy.dayUnit }}</small>
				</strong>
			</div>
			<div>
				<small>{{ copy.personalBest }}</small>
				<strong>
					{{ data.best }}
					<small>{{ data.best === 1 ? copy.daySingular : copy.dayUnit }}</small>
				</strong>
			</div>
			<div :class="$style.next">
				<span>{{ next ? i18n.tsx._hata._hatady._streaks.nextMilestone({ days: String(next) }) : copy.completed365 }}</span>
				<b>{{ next ? i18n.tsx._hata._hatady._streaks.daysRemaining({ days: String(next - data.current) }) : copy.achieved }}</b>
				<progress
					:max="next || 365"
					:value="Math.min(data.current, next || 365)"
					:aria-label="copy.milestoneProgress"
				></progress>
			</div>
		</section>
		<section v-if="inHataGoes" :class="$style.calendar" aria-label="記録カレンダー">
			<div :class="$style.calendarHead">
				<button type="button" aria-label="前の月" @click="moveMonth(-1)"><i class="ti ti-chevron-left"></i></button>
				<h3>{{ monthLabel(calendarMonth) }}</h3>
				<button type="button" aria-label="次の月" @click="moveMonth(1)"><i class="ti ti-chevron-right"></i></button>
			</div>
			<div :key="calendarMonth" :class="$style.calendarGrid">
				<span v-for="weekday in weekdays" :key="weekday" :class="$style.weekday">{{ weekday }}</span>
				<span v-for="n in calendarLeading" :key="`blank-${n}`" aria-hidden="true"></span>
				<button v-for="date in calendarDates" :key="date.key" type="button" :aria-label="`${date.key}・${date.recorded ? '記録あり' : '記録なし'}`" :data-date="date.key" :aria-pressed="selected?.start === date.key && selected?.end === date.key" :data-recorded="date.recorded" :class="$style.calendarDay" @click="openPeriod({ start: date.key, end: date.key, days: 1 })">{{ date.day }}</button>
			</div>
		</section>
		<section v-if="inHataGoes && selected" :key="`${selected.start}-${selected.end}`" :class="$style.selectedDay" :aria-label="`${range(selected)}の記録`">
			<h3>{{ selected.start === selected.end ? `この日の記録 · ${range(selected)}` : i18n.tsx._hata._hatady._streaks.periodRecords({ range: range(selected) }) }}</h3>
			<p v-if="periodLoading" class="hy-empty">{{ copy.loading }}</p>
			<p v-if="periodError" class="hy-error" role="alert">{{ periodError }} <button type="button" :class="$style.retry" @click="openPeriod(selected, true)">再試行</button></p>
			<p v-if="!periodLoading && !periodError && periodRows.length === 0" class="hy-empty">{{ copy.empty }}</p>
			<HatadyActivityCard
				v-for="a in periodRows" :key="a.id" :activity="a"
				@openLog="openLog" @openSession="openSession" @openBook="openBook" @openMedia="openMedia"
				@openProfile="openProfile" @edit="edit" @deleted="recordDeleted(a)"
			/>
		</section>
		<section :class="$style.milestones" :aria-label="copy.streakMilestones">
			<ol>
				<li
					v-for="m in nearby"
					:key="m"
					:data-reached="data.current >= m"
					:aria-current="m === next ? 'step' : undefined"
				>
					<i :class="data.current >= m ? 'ti ti-check' : m === next ? 'ti ti-flag' : 'ti ti-point'"></i>
					<strong>
						{{ m }}
						<small>{{ copy.dayUnit }}</small>
					</strong>
					<small>{{ data.current >= m ? copy.achieved : m === next ? copy.next : copy.upcoming }}</small>
				</li>
			</ol>
			<details>
				<summary>
					{{ copy.allMilestones }}
					<i class="ti ti-chevron-down"></i>
				</summary>
				<ol>
					<li v-for="m in milestones" :key="m" :data-reached="data.current >= m">
						<i :class="data.current >= m ? 'ti ti-check' : 'ti ti-point'"></i>
						<strong>
							{{ m }}
							<small>{{ copy.dayUnit }}</small>
						</strong>
					</li>
				</ol>
			</details>
		</section>
		<section :class="$style.history">
			<h3>{{ copy.monthlyProgress }}</h3>
			<details v-for="m in months" :key="m.key">
				<summary>
					<span :class="$style.monthHead">
						<strong>{{ m.label }}</strong>
						<span>
							<b>{{ m.recorded.length }}</b>
							{{ copy.recordedDaysUnit }}
							<small>{{ i18n.tsx._hata._hatady._streaks.longest({ days: String(m.longest) }) }}</small>
							<i class="ti ti-chevron-down"></i>
						</span>
					</span>
					<span
						:class="$style.timeline"
						:style="{ '--days': m.count }"
						role="img"
						:aria-label="i18n.tsx._hata._hatady._streaks.recordedDayList({ month: m.label, days: m.recorded.map((d) => Number(d.slice(8))).join(copy.dayListSeparator) })"
					>
						<i
							v-for="d in m.count"
							:key="d"
							:data-recorded="m.recorded.includes(m.key + '-' + String(d).padStart(2, '0'))"
						></i>
					</span>
					<span :class="$style.axis">
						<span>{{ i18n.tsx._hata._hatady._streaks.dayCount({ days: "1" }) }}</span>
						<span>{{ i18n.tsx._hata._hatady._streaks.dayCount({ days: "15" }) }}</span>
						<span>{{ i18n.tsx._hata._hatady._streaks.dayCount({ days: String(m.count) }) }}</span>
					</span>
				</summary>
				<button v-for="p in m.periods" :key="p.start" :class="$style.period" @click="openPeriod(p)">
					<span>
						{{ range(p) }}
						<small v-if="p === data.periods[0] && data.current">{{ copy.ongoing }}</small>
						<small v-else-if="p.days === data.best && p.days > 1">{{ copy.personalBest }}</small>
					</span>
					<span :class="$style.bar"><i :style="{ width: (p.days / Math.max(1, data.best)) * 100 + '%' }"></i></span>
					<b>
						{{ p.days }}
						<small>{{ p.days === 1 ? copy.daySingular : copy.dayUnit }}</small>
					</b>
					<i class="ti ti-arrow-right"></i>
				</button>
			</details>
			<p v-if="!months.length" class="hy-empty">{{ copy.empty }}</p>
		</section>
	</template>
</HyDialog>
<HyDialog
	v-if="selected && !inHataGoes"
	ref="periodDialog"
	:title="i18n.tsx._hata._hatady._streaks.periodRecords({ range: range(selected) })"
	@close="periodDialog?.close()"
	@closed="closePeriod"
>
	<p v-if="periodLoading" class="hy-empty">{{ copy.loading }}</p>
	<p v-if="periodError" class="hy-error" role="alert">{{ periodError }}</p>
	<HatadyActivityCard
		v-for="a in periodRows"
		:key="a.id"
		:activity="a"
		@openLog="openLog"
		@openSession="openSession"
		@openBook="openBook"
		@openMedia="openMedia"
		@openProfile="openProfile"
		@edit="edit"
		@deleted="recordDeleted(a)"
	/>
</HyDialog>
</template>
<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import HyDialog from '@/components/HyDialog.vue';
import HatadyActivityCard from '@/components/HatadyActivityCard.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyTzOffset } from '@/utility/hatady-prefs.js';
import { requireHatadyActivityPage } from '@/utility/hatady-media.js';
import { collectActivityPages, localDateKey } from '@/utility/hatady-home.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const contextualPopup = useHataGoesPopup();
const inHataGoes = inject(HATA_GOES_HOST, null) != null;
const copy = i18n.ts._hata._hatady._streaks;
const emit = defineEmits<{ (e: 'closed'): void }>();
const dialog = ref<any>(),
	periodDialog = ref<any>(),
	loading = ref(true),
	error = ref(''),
	periodLoading = ref(false),
	periodError = ref(''),
	periodRows = ref<HatadyActivity[]>([]);
let periodSeq = 0;
let streakSeq = 0;
let disposed = false;
let calendarInitialized = false;
type Period = { start: string; end: string; days: number };
const data = ref<{ current: number; best: number; periods: Period[] }>({ current: 0, best: 0, periods: [] }),
	selected = ref<Period | null>(null);
const milestones = [3, 7, 14, 30, 50, 100, 200, 365];
const next = computed(() => milestones.find((n) => n > data.value.current)),
	nearby = computed(() => {
		const i = next.value ? milestones.indexOf(next.value) : milestones.length - 1;
		const start = Math.max(0, Math.min(i - 1, milestones.length - 3));
		return milestones.slice(start, start + 3);
	});
const days = computed(() => {
	const out = new Set<string>();
	for (const p of data.value.periods) {
		const d = new Date(`${p.start}T12:00:00`);
		while (localDateKey(d) <= p.end) {
			out.add(localDateKey(d));
			d.setDate(d.getDate() + 1);
		}
	}
	return [...out].sort();
});
const calendarMonth = ref(localDateKey(new Date()).slice(0, 7));
const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
const calendarLeading = computed(() => {
	const [year, month] = calendarMonth.value.split('-').map(Number);
	return (new Date(year, month - 1, 1).getDay() + 6) % 7;
});
const calendarDates = computed(() => {
	const [year, month] = calendarMonth.value.split('-').map(Number);
	const count = new Date(year, month, 0).getDate();
	const recorded = new Set(days.value);
	return Array.from({ length: count }, (_, index) => {
		const day = index + 1;
		const key = `${calendarMonth.value}-${String(day).padStart(2, '0')}`;
		return { day, key, recorded: recorded.has(key) };
	});
});

function moveMonth(delta: number) {
	const [year, month] = calendarMonth.value.split('-').map(Number);
	const date = new Date(year, month - 1 + delta, 1);
	calendarMonth.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	periodSeq++;
	selected.value = null;
	periodRows.value = [];
	periodLoading.value = false;
	periodError.value = '';
}

const months = computed(() =>
	[...new Set(days.value.map((d) => d.slice(0, 7)))].reverse().map((key) => {
		const count = new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 0).getDate(),
			since = key + '-01',
			until = key + '-' + count,
			periods = data.value.periods.filter((p) => p.end >= since && p.start <= until);
		return {
			key,
			count,
			label: monthLabel(key),
			recorded: days.value.filter((d) => d.startsWith(key)),
			periods,
			longest: Math.max(
				0,
				...periods.map(
					(p) =>
						(Date.parse(p.end > until ? until : p.end) - Date.parse(p.start < since ? since : p.start)) / 86400000 + 1,
				),
			),
		};
	}),
);

function monthLabel(key: string): string {
	return versatileLang.startsWith('ja') ? key.replace('-', '年') + '月' : new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'long' }).format(new Date(`${key}-01T12:00:00`));
}

function range(p: Period) {
	const short = (d: string) => versatileLang.startsWith('ja') ? `${Number(d.slice(5, 7))}/${Number(d.slice(8))}` : new Intl.DateTimeFormat(versatileLang, { month: 'short', day: 'numeric' }).format(new Date(`${d}T12:00:00`));
	return p.start === p.end ? short(p.start) : `${short(p.start)} — ${short(p.end)}`;
}

function closePeriod() {
	periodSeq++;
	selected.value = null;
}

async function openPeriod(p: Period, preserveRows = false) {
	if (disposed) return;
	selected.value = p;
	const request = ++periodSeq;
	periodLoading.value = true;
	if (!preserveRows) periodRows.value = [];
	periodError.value = '';
	try {
		const result = await collectActivityPages(async (cursor) =>
			requireHatadyActivityPage(
				await (misskeyApi as any)('hata/hatady/activities', {
					scope: 'mine',
					sinceDate: new Date(`${p.start}T00:00:00`).getTime(),
					untilDate: new Date(`${p.end}T23:59:59.999`).getTime(),
					limit: 100,
					...(cursor ? { cursor } : {}),
				}),
			),
		);
		if (request === periodSeq) periodRows.value = result;
	} catch {
		if (request === periodSeq) periodError.value = copy.recordsLoadFailed;
	} finally {
		if (request === periodSeq) periodLoading.value = false;
	}
}

function removeRecord(activity: HatadyActivity) {
	periodSeq++;
	periodRows.value = periodRows.value.filter((row) => activity.study
		? row.study?.id !== activity.study.id
		: row.media?.session.id !== activity.media?.session.id);
}

function refresh() {
	if (disposed) return;
	void loadStreaks();
	// Keep the opened date range, even if deleting a day splits its streak.
	if (selected.value) void openPeriod(selected.value, true);
}

function recordDeleted(activity: HatadyActivity) {
	removeRecord(activity);
	refresh();
}

async function popup(name: string, props: any) {
	const components = {
		conversation: () => import('@/components/HatadyConversation.vue'),
		book: () => import('@/components/HatadyBookDetail.vue'),
		media: () => import('@/components/HatadyMediaWorkDetail.vue'),
		profile: () => import('@/components/HatadyProfile.vue'),
		composer: () => import('@/components/HatadyComposer.vue'),
		session: () => import('@/components/HatadyMediaSessionForm.vue'),
	};
	const component = await components[name as keyof typeof components]();
	const { dispose } = contextualPopup(component.default as any, props, {
		closed: () => dispose(),
		done: refresh,
		changed: refresh,
		deleted: (activity?: HatadyActivity) => {
			if (name === 'conversation' && activity) removeRecord(activity);
		},
	});
}

function openLog(logId: string) {
	void popup('conversation', { logId });
}

function openSession(sessionId: string, workId?: string) {
	void popup('conversation', { sessionId, workId });
}

function openBook(bookId: string) {
	void popup('book', { bookId });
}

function openMedia(workId: string) {
	void popup('media', { workId });
}

function openProfile(userId: string) {
	void popup('profile', { userId });
}

function edit(a: any) {
	if (a.study) void popup('composer', { editLog: a.study });
	else if (a.media?.work) void popup('session', { work: a.media.work, editSession: a.media.session });
}

async function loadStreaks() {
	const request = ++streakSeq;
	error.value = '';
	try {
		const result = await misskeyApi<typeof data.value>('hata/hatady/streaks', { tzOffset: hatadyTzOffset() });
		if (request === streakSeq) {
			data.value = result;
			if (inHataGoes && !calendarInitialized && days.value.length) {
				calendarInitialized = true;
				const latest = days.value.at(-1)!;
				calendarMonth.value = latest.slice(0, 7);
				void openPeriod({ start: latest, end: latest, days: 1 });
			}
		}
	} catch {
		if (request === streakSeq) error.value = copy.loadFailed;
	} finally {
		if (request === streakSeq) loading.value = false;
	}
}

onMounted(loadStreaks);
onUnmounted(() => {
	disposed = true;
	periodSeq++;
	streakSeq++;
});
</script>
<style module lang="scss">
.hero {
	display: grid;
	grid-template-columns: 1.4fr 1fr;
	gap: 24px;
	padding: 12px;
}
.calendar, .selectedDay {
	margin: 16px 0;
	padding: 14px;
	border: 1px solid var(--hy-border);
	border-radius: 16px;
	background: var(--hy-surface);
}
.calendarHead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}
.calendarHead h3, .selectedDay h3 {
	margin: 0;
	font-size: 15px;
}
.calendarHead button {
	width: 34px;
	height: 34px;
	border: 0;
	border-radius: 50%;
	background: var(--hy-surface-2);
	color: var(--hy-ink);
	cursor: pointer;
}
.calendarGrid {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
	gap: 3px;
	margin-top: 12px;
	text-align: center;
	animation: calendarIn 140ms ease-out;
}
.weekday {
	padding: 5px 0;
	font-size: 11px;
	color: var(--hy-muted);
}
.calendarDay {
	position: relative;
	min-width: 0;
	min-height: 38px;
	border: 0;
	border-radius: 9px;
	background: transparent;
	color: var(--hy-ink);
	cursor: pointer;
}
.calendarDay[data-recorded='true']::after {
	content: '';
	position: absolute;
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: var(--hy-accent);
	bottom: 3px;
	left: calc(50% - 2.5px);
}
.calendarDay[aria-pressed='true'] {
	background: var(--hy-accent);
	color: #fff;
}
.calendarDay[aria-pressed='true']::after { background: #fff; }
.calendarDay:not([aria-pressed='true']):hover { background: var(--hy-surface-2); }
.selectedDay > h3 { margin-bottom: 12px; }
.selectedDay { animation: calendarIn 140ms ease-out; }
.retry {
	border: 0;
	background: transparent;
	color: var(--hy-accent-ink);
	cursor: pointer;
}
@keyframes calendarIn {
	from { opacity: 0; transform: translateY(3px); }
	to { opacity: 1; transform: translateY(0); }
}
.hero > div {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.hero small {
	font-size: 12px;
	color: var(--hy-muted);
}
.hero > div > strong {
	font-size: 52px;
	font-weight: 400;
	color: var(--hy-accent-ink);
}
.hero strong small {
	font-size: 16px;
	margin-left: 8px;
}
.hero .next {
	grid-column: 1/-1;
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 12px;
	font-size: 13px;
}
.next progress {
	grid-column: 1/-1;
	width: 100%;
	height: 7px;
	accent-color: var(--hy-accent);
}
.milestones {
	margin: 28px 0;
}
.milestones ol {
	padding: 0;
	display: flex;
	list-style: none;
	gap: 12px;
	justify-content: space-around;
	flex-wrap: wrap;
}
.milestones li {
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 8px;
	color: var(--hy-muted);
}
.milestones li > i {
	display: grid;
	place-items: center;
	background: var(--hy-surface-2);
	border-radius: 50%;
	width: 36px;
	height: 36px;
}
.milestones li[data-reached='true'] {
	color: var(--hy-accent-ink);
}
.milestones strong {
	font-size: 22px;
}
.milestones small {
	font-size: 11px;
	margin-left: 2px;
}
.milestones summary {
	text-align: center;
	cursor: pointer;
	font-size: 12px;
	padding: 20px;
}
.history h3 {
	font-size: 15px;
}
.history > details {
	border-top: 1px solid var(--hy-border);
	padding: 18px 0;
}
.history summary {
	list-style: none;
	cursor: pointer;
}
.monthHead {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 14px;
}
.monthHead > span {
	font-size: 12px;
	color: var(--hy-muted);
	display: flex;
	gap: 10px;
	align-items: center;
}
.timeline {
	display: grid;
	grid-template-columns: repeat(var(--days), minmax(0, 1fr));
	gap: 3px;
	margin-top: 20px;
}
.timeline > i {
	height: 24px;
	border-radius: 3px;
	background: var(--hy-surface-2);
}
.timeline > i[data-recorded='true'] {
	background: var(--hy-accent);
}
.axis {
	display: flex;
	justify-content: space-between;
	color: var(--hy-muted);
	font-size: 10px;
	margin-top: 6px;
}
.period {
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	min-height: 64px;
	background: none;
	border: 0;
	color: var(--hy-ink);
	cursor: pointer;
	text-align: left;
}
.period > span:first-child {
	width: 110px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 13px;
}
.period small {
	font-size: 11px;
	color: var(--hy-muted);
}
.bar {
	flex: 1;
	height: 5px;
	background: var(--hy-surface-2);
	border-radius: 9px;
	overflow: hidden;
}
.bar i {
	display: block;
	height: 100%;
	background: var(--hy-accent);
}
.period > b {
	font-size: 18px;
}
</style>
