<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section ref="journalRoot" :class="$style.root" :data-kind="kind" :data-motion="goesMotion || motion" :data-hatagoes="goesMotion" :data-hatask-theme="theme" :aria-label="kind === 'mood' ? main.tabMood : main.tabMeal">
	<div :class="$style.captureArea" data-journal-capture>
		<header :class="$style.heading">
			<div><h2>{{ kind === 'mood' ? main.tabMood : main.tabMeal }}</h2><p>{{ kind === 'mood' ? copy.moodIntro : copy.mealIntro }}</p></div>
			<img v-if="illustration" :src="illustration" width="72" height="72" alt="" draggable="false">
			<button type="button" :class="$style.iconButton" :aria-label="kind === 'mood' ? main.aboutMoodRecords : main.aboutMealRecords" :title="kind === 'mood' ? main.aboutMoodRecords : main.aboutMealRecords" @click="emit('info')"><i class="ti ti-info-circle" aria-hidden="true"></i></button>
		</header>

		<div ref="composerEl" :class="$style.composer">
			<div v-if="editingId" :class="$style.editing"><span><i class="ti ti-pencil" aria-hidden="true"></i>{{ main.editRecord }}</span><button type="button" :disabled="busy" @click="cancelEdit">{{ main.cancel }}</button></div>
			<HataskQuickCapture
				ref="capture"
				v-model="draft.note"
				:mode="kind"
				:theme="theme"
				:leadingIcon="kind === 'mood' ? 'ti ti-mood-smile' : 'ti ti-bowl'"
				:label="main.optionalNote"
				:placeholder="kind === 'mood' ? main.moodNotePlaceholder : main.mealNotePlaceholder"
				:submitLabel="editingId ? main.update : main.record"
				:chipLabel="planner.captureChips"
				:toolLabel="planner.captureTools"
				:templateLabel="kind === 'meal' ? planner.templateLibrary : undefined"
				:templateDisabled="!templatesWritable"
				:hint="showCaptureHint ? copy.submitHint : undefined"
				:chips="captureChips"
				:tools="captureTools"
				:disabled="!writable || busy"
				:detailOpen="detail !== null || editingId !== null"
				:state="state"
				multiline
				allowEmpty
				persistentChips
				@submit="submit"
				@chip="toggleDetail"
				@tool="onTool"
				@template="openCaptureTemplates"
				@collapse="detail = null"
			>
				<template #primary>
					<div :class="$style.choices" :data-kind="kind" role="group" :aria-label="kind === 'mood' ? main.recordMood : main.howWasMeal">
						<button v-for="option in levelOptions" :key="option.value" type="button" :aria-pressed="draft.level === option.value" :data-selected="draft.level === option.value" :disabled="!writable || busy" @click="draft.level = option.value">
							<i :class="option.icon" aria-hidden="true"></i><span>{{ option.label }}</span>
						</button>
					</div>
				</template>
			</HataskQuickCapture>
			<Transition name="journal-detail">
				<div v-if="detail" ref="detailEl" :class="$style.detail">
					<div :class="$style.detailHeader"><strong>{{ detailLabel }}</strong><button type="button" :class="$style.iconButton" :aria-label="main.close" @click="detail = null"><i class="ti ti-x" aria-hidden="true"></i></button></div>
					<div v-if="detail === 'date' || detail === 'time'" :class="$style.dateFields">
						<label v-if="detail === 'date'"><span>{{ copy.recordDate }}</span><input type="date" :value="entryDate" :disabled="busy" @change="setDate(($event.target as HTMLInputElement).value)"></label>
						<label v-else><span>{{ copy.recordTime }}</span><input type="time" :value="entryTime" :disabled="busy" @change="setTime(($event.target as HTMLInputElement).value)"></label>
						<button type="button" :class="$style.textButton" :disabled="busy" @click="useNow">{{ copy.useNow }}</button>
					</div>
					<div v-else-if="detail === 'slot'" :class="$style.optionPills" role="group" :aria-label="main.whichMeal">
						<button v-for="slot in slots" :key="slot.value" type="button" :data-selected="draft.slot === slot.value" :aria-pressed="draft.slot === slot.value" :disabled="busy" @click="draft.slot = slot.value"><i :class="slot.icon" aria-hidden="true"></i>{{ slot.label }}</button>
					</div>
					<div v-else-if="detail === 'emoji'" :class="$style.optionPills" role="group" :aria-label="main.emoji">
						<button v-for="emoji in emojis" :key="emoji" type="button" :data-selected="draft.emoji === emoji" :aria-pressed="draft.emoji === emoji" :aria-label="emoji" :disabled="busy" @click="draft.emoji = draft.emoji === emoji ? '' : emoji"><HataskEmoji :emoji="emoji"/></button>
					</div>
					<template v-else-if="detail === 'reasons'">
						<p :class="$style.helper">{{ copy.reasonsHint }}</p>
						<div :class="$style.optionPills" role="group" :aria-label="main.optionalMealReasons"><button v-for="reason in reasons" :key="reason.value" type="button" :data-selected="draft.reasons.includes(reason.value)" :aria-pressed="draft.reasons.includes(reason.value)" :disabled="busy" @click="toggleReason(reason.value)">{{ reason.label }}</button></div>
					</template>
				</div>
			</Transition>
			<p v-if="!writable" :class="$style.status" role="status">{{ loading ? planner.loading : copy.readFailure }}</p>
			<p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
			<p v-if="notice" :class="$style.status" role="status">{{ notice }}</p>
		</div>
	</div>

	<section v-if="!captureOnly" :class="$style.board">
		<div :class="$style.toolbar">
			<div :class="$style.tabs" role="tablist" :aria-label="copy.views" @keydown="onTabKeydown">
				<button v-for="tab in tabs" :id="`${uid}-${tab.id}`" :key="tab.id" type="button" role="tab" :aria-label="tab.label" :title="tab.label" :aria-selected="view === tab.id" :aria-controls="`${uid}-panel`" :tabindex="view === tab.id ? 0 : -1" :data-selected="view === tab.id" @click="selectView(tab.id)"><i :class="tab.icon" aria-hidden="true"></i><span>{{ tab.label }}</span></button>
			</div>
			<div v-if="view === 'today' || view === 'history'" :class="$style.toolbarActions">
				<button type="button" :class="$style.iconButton" :data-selected="searchOpen" :aria-label="main.search" :title="main.search" :aria-expanded="searchOpen" @click="toggleSearch"><i class="ti ti-search" aria-hidden="true"></i></button>
				<button type="button" :class="$style.iconButton" :aria-label="oldestFirst ? copy.oldestFirst : copy.newestFirst" :title="oldestFirst ? copy.oldestFirst : copy.newestFirst" @click="oldestFirst = !oldestFirst"><i :class="oldestFirst ? 'ti ti-sort-ascending' : 'ti ti-sort-descending'" aria-hidden="true"></i></button>
			</div>
		</div>

		<div v-if="searchOpen && (view === 'today' || view === 'history')" :class="$style.searchRow">
			<label :class="$style.searchField"><i class="ti ti-search" aria-hidden="true"></i><input ref="searchEl" v-model="query" type="search" :aria-label="copy.searchRecords" :placeholder="copy.searchRecords"></label>
			<label :class="$style.filterDate"><span>{{ copy.filterDate }}</span><input v-model="filterDate" type="date" @change="view = 'history'"></label>
			<button v-if="query || filterDate" type="button" :class="$style.iconButton" :aria-label="copy.clearFilters" :title="copy.clearFilters" @click="clearFilters"><i class="ti ti-filter-off" aria-hidden="true"></i></button>
		</div>

		<div :class="$style.panelFrame">
			<Transition name="journal-view">
				<div :id="`${uid}-panel`" :key="view" role="tabpanel" :aria-labelledby="`${uid}-${view}`" :data-journal-view="view" :class="$style.panel" tabindex="0">
					<template v-if="view === 'today' || view === 'history'">
						<div :class="$style.weekHeading"><button type="button" :class="$style.iconButton" :aria-label="copy.previousWeek" @click="weekOffset--"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><span>{{ weekLabel }}</span><button type="button" :class="$style.iconButton" :aria-label="copy.nextWeek" @click="weekOffset++"><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div>
						<div :class="$style.week" :aria-label="copy.weekOverview">
							<button v-for="day in weekDays" :key="day.date" type="button" :data-selected="(view === 'today' ? today : filterDate) === day.date" :data-today="day.date === today" :aria-pressed="(view === 'today' ? today : filterDate) === day.date" :aria-label="`${day.label} · ${day.entries.length ? copyx.recordCount({ count: String(day.entries.length) }) : main.noRecordsYet}`" @click="chooseDay(day.date)"><span>{{ day.weekday }}</span><strong>{{ day.day }}</strong><i :class="day.icon" aria-hidden="true"></i></button>
						</div>
						<p v-if="kind === 'meal' && showSummary && view === 'today'" :class="$style.gentleNote"><i class="ti ti-leaf" aria-hidden="true"></i>{{ summary }}</p>
						<div v-if="undoEntry" :class="$style.undo" role="status"><span>{{ copy.recordDeleted }}</span><button type="button" :disabled="busy || !writable" @click="undoDelete"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>{{ copy.undo }}</button><button type="button" :class="$style.iconButton" :aria-label="main.close" @click="undoEntry = null"><i class="ti ti-x" aria-hidden="true"></i></button></div>
						<p v-if="unreadableCount" :class="$style.status" role="status">{{ copy.unreadableRecords }}</p>
						<div v-if="!writable" :class="$style.empty"><i class="ti ti-cloud-off" aria-hidden="true"></i><strong>{{ loading ? planner.loading : copy.readFailure }}</strong></div>
						<div v-else-if="!filteredEntries.length" :class="$style.empty"><i :class="query || filterDate ? 'ti ti-search' : kind === 'mood' ? 'ti ti-mood-smile' : 'ti ti-bowl'" aria-hidden="true"></i><strong>{{ query || filterDate ? copy.noMatches : main.noRecordsYet }}</strong><p>{{ copy.emptyHint }}</p><button v-if="query || filterDate" type="button" :class="$style.textButton" @click="clearFilters">{{ copy.clearFilters }}</button></div>
						<template v-else>
							<div v-for="group in entryGroups" :key="group.date" :class="$style.dayGroup">
								<h3>{{ dateLabel(group.date) }}<span>{{ copyx.recordCount({ count: String(group.entries.length) }) }}</span></h3>
								<TransitionGroup name="journal-record" tag="div" :class="$style.records">
									<article v-for="entry in group.entries" :key="entry.id" :class="$style.record" :data-journal-record="entry.id" :data-editing="editingId === entry.id">
										<div :class="$style.recordIcon" aria-hidden="true"><i :class="entryIcon(entry)"></i></div>
										<div :class="$style.recordBody"><div :class="$style.recordTitle"><strong>{{ entryLabel(entry) }}</strong><time :datetime="`${entry.date}T${entry.time}`">{{ entry.time }}</time></div><p v-if="entry.note && entry.note !== '（ひとことなし）'">{{ entry.note }}</p><div v-if="entry.emoji && kind === 'mood'" :class="$style.recordEmoji"><HataskEmoji :emoji="entry.emoji"/></div><div v-if="kind === 'meal' && Array.isArray(entry.reasons) && entry.reasons.length" :class="$style.reasonTags"><span v-for="reason in entry.reasons" :key="reason">{{ reasonLabel(reason) }}</span></div></div>
										<button type="button" :class="$style.iconButton" :disabled="busy" :aria-label="`${copy.recordActions}: ${dateLabel(entry.date)} ${entry.time}`" :title="copy.recordActions" @click="openRecordMenu(entry, $event)"><i class="ti ti-dots" aria-hidden="true"></i></button>
									</article>
								</TransitionGroup>
							</div>
							<nav v-if="totalPages > 1" :class="$style.pager" :aria-label="copy.recordPages"><button type="button" :class="$style.iconButton" :disabled="page === 1" :aria-label="planner.previous" @click="page--"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><span>{{ page }} / {{ totalPages }}</span><button type="button" :class="$style.iconButton" :disabled="page === totalPages" :aria-label="planner.next" @click="page++"><i class="ti ti-chevron-right" aria-hidden="true"></i></button></nav>
						</template>
					</template>
					<template v-else-if="view === 'review'">
						<template v-if="kind === 'mood'">
							<div :class="$style.reviewHeading"><h3>{{ main.recentTrend }}</h3><p>{{ copy.reviewHint }}</p></div>
							<div v-if="recentMoods.length" :class="$style.insights">
								<div :class="$style.insight"><span>{{ main.averageScore7Days }}</span><strong>{{ averageMood.toFixed(1) }}<small> / 5</small></strong><p>{{ trendLabel }}</p></div>
								<div :class="$style.timeSlots"><h4>{{ main.trendByTime }}</h4><div v-for="slot in moodTimeSlots" :key="slot.label"><span>{{ slot.label }}</span><meter min="1" max="5" :value="slot.average" :aria-label="slot.label"></meter><strong>{{ slot.average.toFixed(1) }}</strong></div><p>{{ copy.reviewPeriod }}</p></div>
							</div>
							<p v-if="recentMoods.length && moodInsight" :class="$style.gentleNote"><i class="ti ti-bulb" aria-hidden="true"></i>{{ moodInsight }}</p>
							<div v-if="!recentMoods.length" :class="$style.empty"><i class="ti ti-chart-line" aria-hidden="true"></i><strong>{{ copy.noRecentRecords }}</strong><p>{{ copy.reviewHint }}</p></div>
							<p :class="$style.gentleNote">{{ main.moodShortDisclaimer }}</p>
						</template>
						<template v-else>
							<div :class="$style.reviewHeading"><h3>{{ copy.mealReview }}</h3><p>{{ copy.mealReviewHint }}</p></div>
							<div :class="$style.mealReview"><section v-for="slot in slots" :key="slot.value"><h4><i :class="slot.icon" aria-hidden="true"></i>{{ slot.label }}</h4><template v-if="latestMealForSlot(slot.value)"><p>{{ latestMealForSlot(slot.value)?.note || entryLabel(latestMealForSlot(slot.value)!) }}</p><small>{{ dateLabel(latestMealForSlot(slot.value)!.date) }} · {{ latestMealForSlot(slot.value)?.time }}</small><button type="button" :class="$style.textButton" :disabled="!writable || busy" @click="reuseMeal(latestMealForSlot(slot.value)!)"><i class="ti ti-arrow-up" aria-hidden="true"></i>{{ copy.reuseRecord }}</button></template><p v-else>{{ main.noRecordsYet }}</p></section></div>
							<p :class="$style.gentleNote">{{ main.mealShortDisclaimer }}</p>
						</template>
					</template>
					<template v-else-if="view === 'templates' && kind === 'meal'">
						<div :class="$style.reviewHeading"><h3>{{ copy.mealTemplates }}</h3><p>{{ copy.templateHint }}</p></div>
						<p v-if="!templatesWritable" :class="$style.status" role="status">{{ planner.templateReadFailure }}</p>
						<div v-else-if="!mealTemplates.length" :class="$style.empty"><i class="ti ti-template" aria-hidden="true"></i><strong>{{ planner.noTemplates }}</strong><p>{{ copy.templateHint }}</p></div>
						<TransitionGroup name="journal-record" tag="div" :class="$style.templateGrid">
							<article v-for="template in mealTemplates" :key="template.id" :class="$style.templateCard"><div :class="$style.templateTitle"><i class="ti ti-bookmark" aria-hidden="true"></i><h4>{{ template.name }}</h4><button type="button" :class="$style.iconButton" :disabled="busy || !templatesWritable" :aria-label="`${copy.recordActions}: ${template.name}`" @click="openTemplateMenu(template, $event)"><i class="ti ti-dots" aria-hidden="true"></i></button></div><span>{{ slotLabel(template.slot) }} · {{ levelLabel(template.level) }}</span><p>{{ template.note }}</p><button type="button" :class="$style.templateUse" :disabled="busy || !writable" @click="useTemplate(template)"><i class="ti ti-arrow-up" aria-hidden="true"></i>{{ planner.useTemplateAction }}</button></article>
						</TransitionGroup>
					</template>
				</div>
			</Transition>
		</div>
	</section>
</section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import HataskQuickCapture from './HataskQuickCapture.vue';
import type { HataskCaptureChip, HataskCaptureTool } from './HataskQuickCapture.vue';
import type { HataskPlannerTheme } from './hatask-planner-types.js';
import type { HataskJournalEntry, HataskJournalKind, HataskMealTemplate } from '@/utility/hatask-journal.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import { isJournalDate, isJournalTime, isMealTemplate, journalLocalDateTime, mealTemplateFromEntry, selectJournalEntries } from '@/utility/hatask-journal.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const dialogs = useHataGoesDialogs();
const popupMenu = useHataGoesPopupMenu();
const goesMotion = inject(HATA_GOES_HOST, null) != null;

const props = withDefaults(defineProps<{
	theme?: HataskPlannerTheme;
	kind: HataskJournalKind;
	entries: unknown[];
	writable: boolean;
	loading?: boolean;
	active?: boolean;
	motion?: boolean;
	captureOnly?: boolean;
	showCaptureHint?: boolean;
	illustration?: string;
	templates?: unknown[];
	templatesWritable?: boolean;
	summary?: string;
	showSummary?: boolean;
	save: (entry: HataskJournalEntry, existingId?: string) => Promise<void>;
	remove: (id: string) => Promise<void>;
	storeTemplate?: (template: HataskMealTemplate, existingId?: string) => Promise<void>;
	removeTemplate?: (id: string) => Promise<void>;
}>(), { theme: undefined, loading: false, active: true, motion: true, captureOnly: false, showCaptureHint: true, illustration: undefined, templates: () => [], templatesWritable: false, summary: '', showSummary: true, storeTemplate: undefined, removeTemplate: undefined });
const emit = defineEmits<{ info: []; reminders: [] }>();
const main = i18n.ts._hata._hatask._main;
const planner = i18n.ts._hata._hatask._planner;
const copy = i18n.ts._hata._hatask._journal;
const copyx = i18n.tsx._hata._hatask._journal;
const uid = useId();
type View = 'today' | 'history' | 'review' | 'templates';
type Detail = 'date' | 'time' | 'slot' | 'emoji' | 'reasons';
type Draft = { note: string; level: number | string; emoji: string; slot: string; reasons: string[]; date: string | null; time: string | null };
const clock = ref(new Date());
const today = computed(() => journalLocalDateTime(clock.value).date);

function emptyDraft(): Draft {
	const hour = new Date().getHours();
	return { note: '', level: props.kind === 'mood' ? 4 : 'ate', emoji: '', slot: hour < 11 ? 'breakfast' : hour < 17 ? 'lunch' : 'dinner', reasons: [], date: null, time: null };
}

const draft = ref<Draft>(emptyDraft());
const suspendedDraft = ref<Draft | null>(null);
const editingId = ref<string | null>(null);
const capture = ref<InstanceType<typeof HataskQuickCapture> | null>(null);
const composerEl = ref<HTMLElement | null>(null);
const detailEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const detail = ref<Detail | null>(null);
const state = ref<'idle' | 'saving' | 'success' | 'error'>('idle');
const busy = computed(() => state.value === 'saving');
const SUCCESS_FEEDBACK_MS = 900;
let successTimer: number | undefined;
const error = ref('');
const notice = ref('');
const undoEntry = ref<HataskJournalEntry | null>(null);
const view = ref<View>('today');
const searchOpen = ref(false);
const query = ref('');
const filterDate = ref('');
const oldestFirst = ref(false);
const weekOffset = ref(0);
const page = ref(1);
const entryDate = computed(() => draft.value.date ?? today.value);
const entryTime = computed(() => draft.value.time ?? journalLocalDateTime(clock.value).time);
const dateFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'short', day: 'numeric', weekday: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
const weekdayFormatter = new Intl.DateTimeFormat(versatileLang, { weekday: 'short' });

function dateLabel(date: string): string { return isJournalDate(date) ? (date.slice(0, 4) === today.value.slice(0, 4) ? dateFormatter : fullDateFormatter).format(new Date(`${date}T12:00:00`)) : date; }

const slots = computed(() => [
	{ value: 'breakfast', icon: 'ti ti-sunrise', label: main.mealSlotBreakfast },
	{ value: 'lunch', icon: 'ti ti-sun', label: main.mealSlotLunch },
	{ value: 'dinner', icon: 'ti ti-moon', label: main.mealSlotDinner },
	{ value: 'snack', icon: 'ti ti-cookie', label: main.mealSlotSnack },
]);
const levelOptions = computed(() => props.kind === 'mood' ? [
	{ value: 1, icon: 'ti ti-mood-cry', label: main.moodLevelHard },
	{ value: 2, icon: 'ti ti-mood-sad', label: main.moodLevelUneasy },
	{ value: 3, icon: 'ti ti-mood-neutral', label: main.moodLevelNeutral },
	{ value: 4, icon: 'ti ti-mood-smile', label: main.moodLevelGood },
	{ value: 5, icon: 'ti ti-mood-heart', label: main.moodLevelGreat },
] : [
	{ value: 'ate', icon: 'ti ti-bowl-chopsticks', label: main.mealLevelAte },
	{ value: 'little', icon: 'ti ti-bowl-spoon', label: main.mealLevelLittle },
	{ value: 'none', icon: 'ti ti-cup', label: main.mealLevelNone },
]);
const emojis = ['☀️', '🌧️', '⚡', '🌈', '🍵', '🎵', '💪', '😴'];
// Keep the existing stored reason strings, independently of the display language.
const reasons = computed(() => [
	{ value: '食欲がなかった', label: main.mealReasonNoAppetite },
	{ value: '体調がよくなかった', label: main.mealReasonUnwell },
	{ value: '忙しくて時間がなかった', label: main.mealReasonBusy },
	{ value: '気分がのらなかった', label: main.mealReasonNotInMood },
	{ value: '用意できなかった', label: main.mealReasonCouldNotPrepare },
	{ value: 'なんとなく', label: main.mealReasonJustBecause },
]);

function reasonLabel(reason: string): string { return reasons.value.find(option => option.value === reason)?.label ?? reason; }

function slotLabel(slot: string): string { return slots.value.find(option => option.value === slot)?.label ?? slot; }

function levelLabel(level: number | string): string { return levelOptions.value.find(option => option.value === level)?.label ?? String(level); }

function entryLabel(entry: HataskJournalEntry): string { return props.kind === 'mood' ? levelLabel(entry.level) : `${slotLabel(entry.slot ?? '')} · ${levelLabel(entry.level)}`; }

function entryIcon(entry: HataskJournalEntry): string { return levelOptions.value.find(option => option.value === entry.level)?.icon ?? 'ti ti-circle'; }

const captureChips = computed<HataskCaptureChip[]>(() => [
	...(props.kind === 'meal' ? [{ id: 'slot', label: slotLabel(draft.value.slot), icon: slots.value.find(slot => slot.value === draft.value.slot)?.icon, actionLabel: main.whichMeal }] : []),
	{ id: 'date', label: entryDate.value === today.value ? planner.today : dateLabel(entryDate.value), icon: 'ti ti-calendar', actionLabel: copy.recordDate },
	{ id: 'time', label: entryTime.value, icon: 'ti ti-clock', actionLabel: copy.recordTime },
	...(props.kind === 'mood' && draft.value.emoji ? [{ id: 'emoji', label: draft.value.emoji, icon: 'ti ti-mood-smile', actionLabel: main.emoji }] : []),
	...(props.kind === 'meal' && draft.value.level !== 'ate' ? [{ id: 'reasons', label: main.optionalMealReasons, icon: 'ti ti-message-circle', actionLabel: main.optionalMealReasons }] : []),
]);
const captureTools = computed<HataskCaptureTool[]>(() => props.kind === 'mood' ? [
	{ id: 'emoji', label: main.emoji, icon: 'ti ti-mood-smile', active: detail.value === 'emoji' },
	// リマインドの設定は Hatask 設定の「きもち記録」に一本化している。
	{ id: 'reminders', label: main.reminderNotification, icon: 'ti ti-bell', active: false },
] : []);
const detailLabel = computed(() => ({ date: copy.recordDate, time: copy.recordTime, slot: main.whichMeal, emoji: main.emoji, reasons: main.optionalMealReasons })[detail.value ?? 'date']);

async function toggleDetail(id: string): Promise<void> {
	if (!props.writable || busy.value || !['date', 'time', 'slot', 'emoji', 'reasons'].includes(id)) return;
	detail.value = detail.value === id ? null : id as Detail;
	await nextTick();
	detailEl.value?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
}

function onTool(id: string): void {
	if (id === 'reminders') {
		detail.value = null;
		emit('reminders');
		return;
	}
	void toggleDetail(id);
}

function openCaptureTemplates(event: MouseEvent): void {
	if (props.kind !== 'meal' || busy.value || !props.writable || !props.templatesWritable) return;
	popupMenu([
		{ text: planner.useTemplates, icon: 'ti ti-template', action: () => { detail.value = null; selectView('templates'); } },
		{ text: planner.saveTemplate, icon: 'ti ti-bookmark-plus', action: () => saveTemplate() },
	], event.currentTarget as HTMLElement, { motionPreset: 'postform' });
}

function setDate(date: string): void { draft.value.date = date; }

function setTime(time: string): void { draft.value.time = time; }

function useNow(): void { clock.value = new Date(); if (detail.value === 'date') draft.value.date = null; else draft.value.time = null; }

function toggleReason(reason: string): void { draft.value.reasons = draft.value.reasons.includes(reason) ? draft.value.reasons.filter(value => value !== reason) : [...draft.value.reasons, reason]; }

const tabs = computed<Array<{ id: View; label: string; icon: string }>>(() => [
	{ id: 'today', label: planner.today, icon: 'ti ti-calendar-event' },
	{ id: 'history', label: copy.history, icon: 'ti ti-history' },
	{ id: 'review', label: copy.review, icon: props.kind === 'mood' ? 'ti ti-chart-line' : 'ti ti-notebook' },
	...(props.kind === 'meal' ? [{ id: 'templates' as const, label: planner.templateLibrary, icon: 'ti ti-template' }] : []),
]);

function selectView(id: View): void {
	view.value = id;
	page.value = 1;
	if (id === 'today' || id === 'history') { filterDate.value = ''; weekOffset.value = 0; }
}

function onTabKeydown(event: KeyboardEvent): void {
	const current = tabs.value.findIndex(tab => tab.id === view.value);
	const next = event.key === 'ArrowRight' ? (current + 1) % tabs.value.length : event.key === 'ArrowLeft' ? (current + tabs.value.length - 1) % tabs.value.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.value.length - 1 : null;
	if (next == null) return;
	event.preventDefault();
	selectView(tabs.value[next].id);
	(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

async function toggleSearch(): Promise<void> { searchOpen.value = !searchOpen.value; if (searchOpen.value) { await nextTick(); searchEl.value?.focus(); } }

function clearFilters(): void { query.value = ''; filterDate.value = ''; view.value = 'history'; }

function chooseDay(date: string): void { filterDate.value = date; view.value = date === today.value ? 'today' : 'history'; page.value = 1; }

const allEntries = computed(() => selectJournalEntries(props.entries, props.kind));
const unreadableCount = computed(() => props.entries.length - allEntries.value.length);
const filteredEntries = computed(() => selectJournalEntries(props.entries, props.kind, {
	date: view.value === 'today' ? today.value : filterDate.value,
	query: query.value,
	oldestFirst: oldestFirst.value,
	text: entry => [entryLabel(entry), ...(Array.isArray(entry.reasons) ? entry.reasons.map(reasonLabel) : [])].join(' '),
}));
const totalPages = computed(() => Math.max(1, Math.ceil(filteredEntries.value.length / 20)));
const entryGroups = computed(() => {
	const groups: Array<{ date: string; entries: HataskJournalEntry[] }> = [];
	for (const entry of filteredEntries.value.slice((page.value - 1) * 20, page.value * 20)) {
		let group = groups[groups.length - 1];
		if (!group || group.date !== entry.date) { group = { date: entry.date, entries: [] }; groups.push(group); }
		group.entries.push(entry);
	}
	return groups;
});
watch([query, filterDate, oldestFirst], () => { page.value = 1; });
watch(totalPages, count => { page.value = Math.min(page.value, count); });

const weekDays = computed(() => {
	const start = new Date(`${today.value}T12:00:00`);
	start.setDate(start.getDate() - (start.getDay() + 6) % 7 + weekOffset.value * 7);
	return Array.from({ length: 7 }, (_, index) => {
		const day = new Date(start); day.setDate(day.getDate() + index);
		const date = journalLocalDateTime(day).date;
		const entries = allEntries.value.filter(entry => entry.date === date);
		return { date, day: day.getDate(), weekday: weekdayFormatter.format(day), label: dateLabel(date), entries, icon: entries.length ? entryIcon(entries[0]) : 'ti ti-minus' };
	});
});
const weekLabel = computed(() => `${dateLabel(weekDays.value[0].date)} – ${dateLabel(weekDays.value[6].date)}`);
const recentMoods = computed(() => {
	const start = new Date(`${today.value}T12:00:00`); start.setDate(start.getDate() - 6);
	const from = journalLocalDateTime(start).date;
	return props.kind === 'mood' ? allEntries.value.filter(entry => entry.date >= from && entry.date <= today.value) : [];
});
const averageMood = computed(() => recentMoods.value.reduce((sum, entry) => sum + Number(entry.level), 0) / Math.max(1, recentMoods.value.length));
const trendLabel = computed(() => averageMood.value >= 4.2 ? main.moodTrendVeryPositive : averageMood.value >= 3.5 ? main.moodTrendPositive : averageMood.value >= 2.8 ? main.moodTrendNeutral : averageMood.value >= 2 ? main.moodTrendNegative : main.moodTrendHard);
const moodTimeSlots = computed(() => [
	{ label: main.moodTimeMorning, from: 6, to: 11 }, { label: main.moodTimeDay, from: 11, to: 17 },
	{ label: main.moodTimeEvening, from: 17, to: 22 }, { label: main.moodTimeLateNight, from: 22, to: 30 },
].flatMap(slot => {
	const entries = recentMoods.value.filter(entry => { const hour = Number(entry.time.split(':')[0]); const normalized = hour < 6 ? hour + 24 : hour; return normalized >= slot.from && normalized < slot.to; });
	return entries.length ? [{ label: slot.label, average: entries.reduce((sum, entry) => sum + Number(entry.level), 0) / entries.length }] : [];
}));
const moodInsight = computed(() => {
	const ordered = [...moodTimeSlots.value].sort((a, b) => b.average - a.average);
	if (ordered.length > 1) return i18n.tsx._hata._hatask._main.moodInsightComparison({ best: ordered[0].label, bestScore: ordered[0].average.toFixed(1), worst: ordered[ordered.length - 1].label, worstScore: ordered[ordered.length - 1].average.toFixed(1) });
	return averageMood.value >= 4 ? main.moodInsightPositive : averageMood.value <= 2.5 ? main.moodInsightGentle : '';
});

function latestMealForSlot(slot: string): HataskJournalEntry | undefined { return allEntries.value.find(entry => entry.slot === slot); }

const mealTemplates = computed(() => props.kind === 'meal' ? props.templates.filter(isMealTemplate) : []);

function makeEntry(id: string = crypto.randomUUID()): HataskJournalEntry {
	const base = { id, date: entryDate.value, time: entryTime.value, note: draft.value.note.trim() };
	return props.kind === 'mood' ? { ...base, level: Number(draft.value.level), emoji: draft.value.emoji, note: base.note || '（ひとことなし）' }
		: { ...base, level: String(draft.value.level), slot: draft.value.slot, reasons: draft.value.level === 'ate' ? [] : [...draft.value.reasons] };
}

function showSuccess(message: string): void {
	if (successTimer !== undefined) window.clearTimeout(successTimer);
	state.value = 'success';
	notice.value = message;
	successTimer = window.setTimeout(() => {
		successTimer = undefined;
		if (state.value === 'success') state.value = 'idle';
	}, SUCCESS_FEEDBACK_MS);
}

async function submit(): Promise<void> {
	if (busy.value || !props.writable) return;
	clock.value = new Date();
	if (!isJournalDate(entryDate.value) || !isJournalTime(entryTime.value)) { error.value = copy.invalidDateTime; state.value = 'error'; return; }
	state.value = 'saving'; error.value = ''; notice.value = '';
	const id = editingId.value;
	try {
		await props.save(makeEntry(id ?? undefined), id ?? undefined);
		// Never clear the draft or announce success until persistence resolves.
		if (id) cancelEdit(); else draft.value = emptyDraft();
		showSuccess(id ? main.recordUpdated : props.kind === 'mood' ? main.moodSaved : main.mealRecorded);
		page.value = 1;
	} catch { state.value = 'error'; error.value = copy.saveFailure; }
}

function focusComposer(): void {
	void nextTick(() => {
		composerEl.value?.scrollIntoView({ block: 'nearest', behavior: props.motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
		capture.value?.focus({ preventScroll: true });
	});
}

function draftFromEntry(entry: HataskJournalEntry): Draft {
	return { note: entry.note === '（ひとことなし）' ? '' : entry.note ?? '', level: entry.level, emoji: entry.emoji ?? '', slot: entry.slot ?? 'breakfast', reasons: Array.isArray(entry.reasons) ? [...entry.reasons] : [], date: entry.date, time: entry.time };
}

async function editEntry(entry: HataskJournalEntry): Promise<void> {
	if (busy.value || !props.writable) return;
	if (editingId.value && (await dialogs.confirm({ type: 'question', text: copy.replaceDraft })).canceled) return;
	if (!editingId.value) suspendedDraft.value = { ...draft.value, reasons: [...draft.value.reasons] };
	editingId.value = entry.id; draft.value = draftFromEntry(entry); error.value = ''; notice.value = ''; detail.value = null; state.value = 'idle';
	focusComposer();
}

function cancelEdit(): void { editingId.value = null; draft.value = suspendedDraft.value ?? emptyDraft(); suspendedDraft.value = null; detail.value = null; error.value = ''; }

async function deleteEntry(entry: HataskJournalEntry): Promise<void> {
	if (busy.value || !props.writable || (await dialogs.confirm({ type: 'warning', text: main.confirmDeleteRecord })).canceled || busy.value) return;
	state.value = 'saving'; error.value = '';
	try { await props.remove(entry.id); undoEntry.value = entry; if (editingId.value === entry.id) cancelEdit(); state.value = 'idle'; } catch { state.value = 'error'; error.value = copy.saveFailure; }
}

async function undoDelete(): Promise<void> {
	if (busy.value || !props.writable || !undoEntry.value) return;
	state.value = 'saving'; error.value = '';
	try { await props.save(undoEntry.value); undoEntry.value = null; showSuccess(copy.recordRestored); } catch { state.value = 'error'; error.value = copy.saveFailure; }
}

function openRecordMenu(entry: HataskJournalEntry, event: MouseEvent): void {
	popupMenu([
		{ text: main.editRecord, icon: 'ti ti-pencil', action: () => editEntry(entry) },
		...(props.kind === 'meal' ? [{ text: copy.reuseRecord, icon: 'ti ti-arrow-up', action: () => reuseMeal(entry) }, { text: copy.saveMealTemplate, icon: 'ti ti-bookmark-plus', disabled: !props.templatesWritable, action: () => saveTemplate(entry) }] : []),
		{ type: 'divider' },
		{ text: main.delete, icon: 'ti ti-trash', danger: true, action: () => deleteEntry(entry) },
	], event.currentTarget as HTMLElement);
}

async function acceptReplacement(): Promise<boolean> {
	if (busy.value || !props.writable) return false;
	if ((draft.value.note.trim() || draft.value.reasons.length || draft.value.date || draft.value.time || draft.value.level !== 'ate' || editingId.value) && (await dialogs.confirm({ type: 'question', text: copy.replaceDraft })).canceled) return false;
	return !busy.value;
}

async function reuseMeal(entry: HataskJournalEntry): Promise<void> {
	if (props.kind !== 'meal' || !await acceptReplacement()) return;
	draft.value = { ...draftFromEntry(entry), date: null, time: null }; editingId.value = null; suspendedDraft.value = null;
	clock.value = new Date(); detail.value = null; error.value = ''; notice.value = copy.templateLoaded; state.value = 'idle'; focusComposer();
}

async function useTemplate(template: HataskMealTemplate): Promise<void> {
	if (props.kind !== 'meal' || !await acceptReplacement()) return;
	const date = editingId.value ? null : draft.value.date; const time = editingId.value ? null : draft.value.time;
	draft.value = { note: template.note, slot: template.slot, level: template.level, reasons: [...template.reasons], emoji: '', date, time };
	editingId.value = null; suspendedDraft.value = null; detail.value = null; clock.value = new Date(); error.value = ''; notice.value = copy.templateLoaded; state.value = 'idle'; focusComposer();
}

async function saveTemplate(entry?: HataskJournalEntry): Promise<void> {
	if (props.kind !== 'meal' || busy.value || !props.templatesWritable || !props.storeTemplate) return;
	const source = entry ?? makeEntry();
	const { canceled, result } = await dialogs.inputText({ title: copy.saveMealTemplate, text: planner.templateNamePrompt, default: source.note || slotLabel(source.slot ?? ''), maxLength: 80 });
	if (canceled || !result?.trim() || busy.value) return;
	state.value = 'saving'; error.value = '';
	try { await props.storeTemplate(mealTemplateFromEntry(source, crypto.randomUUID(), result)); showSuccess(planner.templateSaved); } catch { state.value = 'error'; error.value = copy.saveFailure; }
}

function openTemplateMenu(template: HataskMealTemplate, event: MouseEvent): void {
	popupMenu([
		{ text: copy.renameTemplate, icon: 'ti ti-pencil', action: async () => {
			const { canceled, result } = await dialogs.inputText({ title: copy.renameTemplate, default: template.name, maxLength: 80 });
			if (canceled || !result?.trim() || busy.value || !props.storeTemplate) return;
			state.value = 'saving'; error.value = '';
			try { await props.storeTemplate({ ...template, name: result.trim() }, template.id); state.value = 'idle'; } catch { state.value = 'error'; error.value = copy.saveFailure; }
		} },
		{ text: main.delete, icon: 'ti ti-trash', danger: true, action: async () => {
			if ((await dialogs.confirm({ type: 'warning', text: copy.deleteTemplate })).canceled || busy.value || !props.removeTemplate) return;
			state.value = 'saving'; error.value = '';
			try { await props.removeTemplate(template.id); state.value = 'idle'; } catch { state.value = 'error'; error.value = copy.saveFailure; }
		} },
	], event.currentTarget as HTMLElement);
}

function focusFromHome(slot?: string, moodLevel?: number): void {
	if (busy.value) return;
	// 外部(Hataskey UI 3 の右ペイン)で選んだ気分は、書きかけの記録が無いときだけ選択済みにする。
	if (props.kind === 'mood' && moodLevel != null && Number.isInteger(moodLevel) && moodLevel >= 1 && moodLevel <= 5
		&& !editingId.value && !draft.value.note && !draft.value.date && !draft.value.time && !draft.value.emoji && state.value === 'idle') {
		draft.value.level = moodLevel;
	}
	// Empty capture may follow the selected meal; an existing or failed draft is never replaced.
	if (props.kind === 'meal' && slot && ['breakfast', 'lunch', 'dinner', 'snack'].includes(slot)
		&& !editingId.value && !draft.value.note && !draft.value.reasons.length && !draft.value.date
		&& !draft.value.time && !draft.value.emoji && draft.value.level === 'ate' && state.value === 'idle') {
		draft.value.slot = slot;
	}
	focusComposer();
}

const journalRoot = ref<HTMLElement | null>(null);

async function openById(id: string): Promise<boolean> {
	const entry = allEntries.value.find(item => item.id === id);
	if (!entry) return false;
	query.value = '';
	chooseDay(entry.date);
	await nextTick();
	const index = filteredEntries.value.findIndex(item => item.id === id);
	if (index < 0) return false;
	page.value = Math.floor(index / 20) + 1;
	await nextTick();
	const row = [...(journalRoot.value?.querySelectorAll<HTMLElement>('[data-journal-record]') ?? [])].find(item => item.dataset.journalRecord === id);
	row?.scrollIntoView({ block: 'center' });
	row?.setAttribute('tabindex', '-1');
	row?.focus({ preventScroll: true });
	return !!row;
}

defineExpose({ focusFromHome, openById });

watch(() => props.active, active => { if (active) clock.value = new Date(); });
let clockTimer: number | undefined;
onMounted(() => { clockTimer = window.setInterval(() => { if (props.active) clock.value = new Date(); }, 30000); });
onUnmounted(() => {
	if (clockTimer) window.clearInterval(clockTimer);
	if (successTimer !== undefined) window.clearTimeout(successTimer);
});
</script>

<style lang="scss" module>
.root { container-type: inline-size; display: grid; gap: 20px; min-width: 0; color: var(--fg); font-family: var(--htk-font-body, inherit); }
.captureArea { display: grid; gap: 20px; min-width: 0; }
.heading { display: flex; align-items: center; gap: 12px; color: var(--fg); padding: 4px 4px 0; }
.heading > div { flex: 1; min-width: 0; }
.heading h2 { margin: 0; font: 800 1.3rem/1.4 var(--htk-font-head, inherit); }
.heading p, .reviewHeading p { margin: 4px 0 0; color: var(--fg-2); font-size: .85rem; line-height: 1.65; text-wrap: pretty; }
.heading img { flex: none; object-fit: contain; }
.composer { display: grid; gap: 10px; width: 100%; max-width: 760px; margin-inline: auto; min-width: 0; scroll-margin-block: 24px; }
.choices { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 8px 4px; }
.choices[data-kind='meal'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.choices button { min-height: 64px; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 8px 4px; border: 1px solid transparent; border-radius: 18px; background: var(--fill); color: var(--fg-2); font: 650 .75rem/1.5 var(--htk-font-body, inherit); cursor: pointer; }
.choices i { font-size: 1.5rem; color: currentColor; }
.choices button[data-selected='true'] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.choices button:not([data-selected='true']):hover { color: var(--fg); background: var(--fill-3); }
.root button { touch-action: manipulation; }
.root button:disabled { opacity: .45; cursor: default; }
.root button:focus-visible, .root input:focus-visible, .panel:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.root button { transition: background-color 160ms ease, color 160ms ease, opacity 140ms ease, transform 140ms ease; }
.root button:active:not(:disabled) { transform: scale(.97); }
.iconButton { display: inline-grid; place-items: center; flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--fg-2); font: inherit; font-size: 1.05rem; cursor: pointer; }
.iconButton:hover:not(:disabled), .iconButton[data-selected='true'] { background: var(--fill-2); color: var(--fg); }
.detail { display: grid; gap: 12px; box-sizing: border-box; min-width: 0; max-width: 100%; padding: 12px 16px 16px; border: 1px solid var(--rule); border-radius: 20px; background: var(--surface); }
.detailHeader, .editing { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.detailHeader strong { font-size: .9rem; }
.dateFields { display: flex; align-items: end; gap: 12px; flex-wrap: wrap; min-width: 0; }
.dateFields label { flex: 1 1 160px; min-width: 0; display: grid; gap: 8px; color: var(--fg-2); font-size: .8rem; }
.dateFields input, .filterDate input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; max-width: 100%; border: 1px solid var(--rule); border-radius: 12px; padding: 8px 12px; color: var(--fg); background: var(--input-bg, var(--surface)); font: inherit; font-size: 16px; }
.optionPills { display: flex; flex-wrap: wrap; gap: 8px; }
.optionPills button, .textButton { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--rule); border-radius: 999px; padding: 8px 14px; background: var(--fill); color: var(--fg-2); font: 650 .8rem/1.5 var(--htk-font-body, inherit); cursor: pointer; }
.optionPills button[data-selected='true'] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.optionPills button:not([data-selected='true']):hover, .textButton:hover:not(:disabled) { background: var(--fill-3); color: var(--fg); }
.helper, .status { margin: 0; padding-inline: 8px; color: var(--fg-2); font-size: .8rem; line-height: 1.6; }
.error { margin: 0; padding: 12px 16px; border: 1px solid var(--rule); border-inline-start: 3px solid var(--accent); border-radius: 12px; background: var(--surface); color: var(--fg); font-size: .85rem; line-height: 1.6; }
.editing { padding: 0 12px; color: var(--fg-2); font-size: .8rem; }
.editing span { display: inline-flex; gap: 8px; align-items: center; }
.editing button, .undo button:not(.iconButton) { min-height: 44px; border: 0; border-radius: 999px; padding-inline: 12px; background: var(--fill-2); color: var(--fg); font: inherit; cursor: pointer; }
.board { min-width: 0; padding: 16px; border: var(--card-border); border-radius: max(var(--card-radius), 20px); background: var(--surface); box-shadow: var(--card-shadow); }
.toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.tabs { display: flex; max-width: 100%; min-width: 0; padding: 4px; gap: 4px; border-radius: 999px; background: var(--fill-2); overflow-x: auto; scrollbar-width: none; }
.tabs button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 8px 16px; border: 0; border-radius: 999px; color: var(--fg-2); background: transparent; font: 700 .8rem/1.5 var(--htk-font-body, inherit); white-space: nowrap; cursor: pointer; }
.tabs button[data-selected='true'] { background: var(--surface); color: var(--fg); box-shadow: 0 2px 6px var(--hair); }
.tabs button:not([data-selected='true']):hover { background: var(--fill-2); color: var(--fg); }
.toolbarActions { display: flex; gap: 8px; margin-inline-start: auto; }
.searchRow { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; padding-block: 16px 4px; }
.searchField { display: flex; align-items: center; gap: 8px; flex: 1 1 180px; min-width: 0; min-height: 44px; padding-inline: 12px; border: 1px solid var(--rule); border-radius: 999px; color: var(--fg-2); background: var(--fill); }
.searchField input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; border: 0; outline: 0; padding: 8px 0; background: transparent; color: var(--fg); font: inherit; font-size: 16px; }
.searchField:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.filterDate { display: grid; flex: 0 1 180px; min-width: 0; gap: 4px; color: var(--fg-2); font-size: .75rem; }
.panelFrame { position: relative; min-width: 0; }
.panel { display: grid; gap: 16px; padding-top: 16px; min-width: 0; }
.weekHeading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: -12px; color: var(--fg-2); font-size: .8rem; }
.week { display: grid; grid-template-columns: repeat(7, minmax(44px, 1fr)); gap: 6px; overflow-x: auto; padding-block: 4px; scrollbar-width: thin; }
.week button { display: grid; justify-items: center; align-content: center; gap: 6px; min-height: 104px; min-width: 44px; border: 1px solid transparent; border-radius: 20px; padding: 10px 4px; color: var(--fg-2); background: var(--fill); font: inherit; cursor: pointer; }
.week button[data-today='true'] strong { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 5px; }
.week button[data-selected='true'] { color: var(--fg); background: var(--fill-2); border-color: var(--accent); }
.week span { font-size: .7rem; }
.week strong { font-size: 1.1rem; }
.week i { font-size: 1.25rem; }
.gentleNote { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 0; border-radius: 16px; padding: 14px; color: var(--fg-2); background: var(--fill); font-size: .8rem; line-height: 1.7; text-align: center; text-wrap: pretty; }
.undo { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; padding: 8px; border: 1px solid var(--rule); border-radius: 16px; color: var(--fg); background: var(--fill); font-size: .8rem; }
.dayGroup h3 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 8px 4px 12px; font-size: .85rem; }
.dayGroup h3 span { color: var(--fg-2); font-size: .7rem; font-weight: 500; }
.records { position: relative; display: grid; gap: 8px; }
.record { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 12px; align-items: start; padding: 12px; border: 1px solid var(--rule); border-radius: 18px; background: var(--surface); }
.record[data-editing='true'] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }
.recordIcon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 15px; background: var(--fill-2); color: var(--fg); font-size: 1.5rem; }
.recordBody { min-width: 0; padding-block: 4px; }
.recordTitle { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
.recordTitle strong { font-size: .86rem; line-height: 1.5; }
.recordTitle time { color: var(--fg-2); font-size: .75rem; font-variant-numeric: tabular-nums; }
.recordBody p { margin: 8px 0 0; font-size: .88rem; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; line-break: strict; }
.recordEmoji { margin-top: 8px; font-size: 1.2rem; }
.reasonTags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.reasonTags span { border-radius: 999px; padding: 4px 8px; background: var(--fill); color: var(--fg-2); font-size: .7rem; }
.empty { display: grid; place-items: center; align-content: center; gap: 12px; min-height: 180px; padding: 20px; color: var(--fg-2); text-align: center; }
.empty > i { font-size: 2rem; }
.empty strong { color: var(--fg); font-size: .95rem; }
.empty p { max-width: 36em; margin: 0; font-size: .85rem; line-height: 1.7; text-wrap: pretty; }
.pager { display: flex; justify-content: center; align-items: center; gap: 16px; font-size: .8rem; font-variant-numeric: tabular-nums; }
.reviewHeading { display: grid; gap: 8px; padding: 8px 4px; }
.reviewHeading h3 { margin: 0; font: 800 1.1rem/1.5 var(--htk-font-head, inherit); }
.reviewHeading .textButton { justify-self: center; }
.insights { display: grid; grid-template-columns: minmax(160px, .7fr) minmax(0, 1fr); gap: 16px; }
.insight { display: grid; align-content: center; gap: 12px; border: 1px solid var(--rule); border-radius: 20px; padding: 24px; color: var(--fg-2); }
.insight > span { font-size: .8rem; }
.insight > strong { font: 800 2.4rem/1.2 var(--htk-font-head, inherit); color: var(--fg); }
.insight small { font-size: .9rem; font-weight: 500; }
.insight p { margin: 0; font-size: .9rem; }
.timeSlots { padding: 16px; border-radius: 20px; background: var(--fill); }
.timeSlots h4 { margin: 0 0 16px; font-size: .9rem; }
.timeSlots > div { display: grid; grid-template-columns: 5em minmax(0, 1fr) 2em; align-items: center; gap: 12px; margin-block: 14px; font-size: .8rem; }
.timeSlots meter { width: 100%; height: 12px; accent-color: var(--accent); }
.timeSlots p { margin-bottom: 0; color: var(--fg-2); font-size: .75rem; line-height: 1.6; }
.mealReview, .templateGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mealReview section, .templateCard { display: grid; align-content: start; gap: 12px; min-width: 0; border: 1px solid var(--rule); border-radius: 20px; padding: 16px; }
.mealReview h4 { display: flex; gap: 8px; align-items: center; margin: 0; font-size: .95rem; }
.mealReview p, .templateCard p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--fg); font-size: .85rem; line-height: 1.7; }
.mealReview small, .templateCard > span { color: var(--fg-2); font-size: .75rem; }
.mealReview .textButton { justify-self: start; }
.templateTitle { display: flex; align-items: center; gap: 8px; }
.templateTitle h4 { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; font-size: .95rem; }
.templateUse { display: inline-flex; justify-content: center; align-items: center; gap: 8px; min-height: 44px; margin-top: 4px; padding: 8px 16px; border: 0; border-radius: 999px; color: var(--on-accent); background: var(--accent); font: 700 .82rem/1.5 var(--htk-font-body, inherit); cursor: pointer; }
:global(.journal-detail-enter-active), :global(.journal-detail-leave-active) { transition: opacity 140ms ease; }
:global(.journal-detail-enter-from), :global(.journal-detail-leave-to) { opacity: 0; }
:global(.journal-view-enter-active) { transition: opacity 180ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1); }
:global(.journal-view-leave-active) { position: absolute; inset: 0; pointer-events: none; transition: opacity 120ms ease; }
:global(.journal-view-enter-from) { opacity: 0; transform: translateX(6px); }
:global(.journal-view-leave-to) { opacity: 0; }
:global(.journal-record-move), :global(.journal-record-enter-active), :global(.journal-record-leave-active) { transition: opacity 160ms ease, transform 220ms cubic-bezier(.22, 1, .36, 1); }
:global(.journal-record-enter-from), :global(.journal-record-leave-to) { opacity: 0; transform: translateX(6px); }
:global(.journal-record-leave-active) { position: absolute; inset-inline: 0; pointer-events: none; }
.root[data-motion='false'] *, .root[data-motion='false'] *::before, .root[data-motion='false'] *::after { animation: none !important; transition: none !important; }
@container (min-width: 760px) {
	.captureArea { grid-template-columns: minmax(260px, .38fr) minmax(0, 1fr); align-items: start; gap: 12px; padding: 10px; border: var(--card-border); border-radius: max(var(--card-radius), 24px); background: var(--surface); box-shadow: var(--card-shadow); }
	.heading { align-self: center; min-width: 0; padding: 10px 8px 10px 12px; border: 0; border-radius: 0; background: var(--surface); box-shadow: none; }
	.heading h2 { font-size: 1.08rem; }
	.heading p { font-size: .76rem; line-height: 1.55; }
	.heading img { width: 52px; height: 52px; }
	.composer { max-width: none; margin-inline: 0; }
	.toolbar { display: grid; grid-template-columns: minmax(96px, 1fr) auto minmax(96px, 1fr); }
	.tabs { grid-column: 2; justify-self: center; flex-wrap: wrap; justify-content: center; box-sizing: border-box; overflow-x: visible; }
	.tabs button { min-width: 44px; padding: 8px 12px; }
	.toolbarActions { grid-column: 3; justify-self: end; margin-inline-start: 0; }
	.tabs button:not([data-selected='true']) span { display: none; }
}
@container (max-width: 560px) {
	.tabs { width: 100%; }
	.tabs button { flex: 1 0 auto; padding-inline: 12px; }
	.heading img { width: 56px; height: 56px; }
	.board { padding: 12px; }
	.choices { gap: 4px; }
	.choices button { min-height: 76px; border-radius: 16px; font-size: .7rem; }
	.choices span { overflow-wrap: anywhere; }
	.record { gap: 8px; padding: 10px 8px; }
	.insights, .mealReview, .templateGrid { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .root:not([data-hatagoes='true']) *, .root:not([data-hatagoes='true']) *::before, .root:not([data-hatagoes='true']) *::after { animation: none !important; transition: none !important; } }
.root[data-hatask-theme] {
	--accent: var(--accent-ink);
	--fg-3: var(--fg-2);
}
.root[data-hatask-theme] .captureArea {
	min-width: 0;
	padding: 20px;
	border: var(--card-border);
	border-radius: var(--card-radius);
	background: var(--surface);
	color: var(--fg);
	box-shadow: var(--card-shadow);
}
/* Keep the translucent surface on the outer card only, including the wide layout. */
.root[data-hatask-theme] .heading { padding: 0; background: transparent; }
.root[data-hatask-theme] .board { padding: 20px; }
.root[data-hatask-theme] .record { border-radius: 18px; background: var(--fill); }
.root[data-hatask-theme] .choices button { border-radius: 16px; }
@container (max-width:520px) {
	.root[data-hatask-theme] .captureArea, .root[data-hatask-theme] .board { padding: 12px; }
	.root[data-hatask-theme] .tabs { border-radius: 20px; flex-wrap: wrap; }
	.root[data-hatask-theme] .tabs button { padding-inline: 12px; }
	.root[data-hatask-theme] .tabs button:not([data-selected='true']) span { display: inline; }
}

:global(.htk-root:not([data-theme='akatsuki'])) .board { border-radius: var(--card-radius); border-color: var(--rule); box-shadow: var(--shadow); }
:global(.htk-root:not([data-theme='akatsuki'])) :is(.tabs, .tabs button) { border-radius: var(--control-radius); }
.root:not([data-hatask-theme='akatsuki']) { --card-radius: inherit; --card-border: inherit; --card-shadow: inherit; --on-accent: var(--htk-on-ink); }
:global(.htk-root[data-theme='hatakyu']) .root[data-kind='mood'] .heading h2 { --hatakyu-heading: var(--hatakyu-mood); }
:global(.htk-root[data-theme='hatakyu']) .root[data-kind='meal'] .heading h2 { --hatakyu-heading: var(--hatakyu-meal); }
:global(.htk-root[data-theme='hatakyu']) .heading h2 { background: var(--hatakyu-heading) right center / auto 100% no-repeat; }
</style>
