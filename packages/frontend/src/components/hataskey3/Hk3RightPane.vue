<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: 右ペイン。「ウィジェット」(Hataskey UI と共通)と「Hatask」(今日の概況)をタブで切り替える。
-->
<template>
<aside :class="$style.root" :data-glass="prefer.r.hataskeyUi3RightPaneBackground.value ? 'true' : undefined" :data-mobile="mobile ? 'true' : undefined">
	<button v-if="collapsible && !mobile" type="button" :class="[$style.editButton, $style.collapseButton]" :title="collapseLabel" :aria-label="collapseLabel" :aria-expanded="!isCollapsed" :aria-controls="bodyId" @click="emit('toggleCollapse')">
		<ChevronLeft v-if="isCollapsed" :size="20" aria-hidden="true"/><ChevronRight v-else :size="20" aria-hidden="true"/>
	</button>
	<header v-if="mobile" :class="$style.mobileHead">
		<div :class="$style.mobileTitle">
			<strong v-if="tab === 'widgets'">{{ copy.paneWidgets }}</strong><strong v-else :class="$style.mobileBrand"><HataAppLogo app="hatask" :size="23" :monochrome="store.r.darkMode.value"/><HataAppWordmark app="hatask" inheritColor/></strong>
			<button
				v-if="tab === 'widgets'" type="button" :class="$style.editButton" data-cy-widget-edit
				:disabled="!widgetControls"
				:aria-label="widgetEditing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets"
				:title="widgetEditing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets"
				:aria-pressed="widgetEditing" @click="widgetControls?.toggleWidgetEditMode()"
			>
				<Check v-if="widgetEditing" :size="18" aria-hidden="true"/><Pencil v-else :size="18" aria-hidden="true"/>
			</button>
		</div>
		<slot name="close"/>
	</header>
	<div v-else v-show="!isCollapsed" :class="$style.head" :data-active="tab">
		<span :class="$style.indicator" aria-hidden="true"></span>
		<div :class="$style.tabs" role="tablist">
			<button type="button" role="tab" :class="$style.tab" :aria-selected="tab === 'widgets'" @click="setTab('widgets')"><LayoutGrid :size="18"/>{{ copy.paneWidgets }}</button>
			<button type="button" role="tab" :class="$style.tab" :aria-selected="tab === 'hatask'" @click="setTab('hatask')">
				<HataAppLogo app="hatask" :size="20" :monochrome="store.r.darkMode.value"/><span :class="$style.brand"><HataAppWordmark app="hatask" inheritColor/></span>
				<span v-if="pendingTodos.length > 0" :class="$style.badge">{{ pendingTodos.length > 99 ? '99+' : pendingTodos.length }}</span>
			</button>
		</div>
		<div :class="$style.editSlot">
			<button
				v-if="tab === 'widgets'" type="button" :class="$style.editButton" data-cy-widget-edit
				:disabled="!widgetControls"
				:aria-label="widgetEditing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets"
				:title="widgetEditing ? i18n.ts.editWidgetsExit : i18n.ts.editWidgets"
				:aria-pressed="widgetEditing" @click="widgetControls?.toggleWidgetEditMode()"
			>
				<Check v-if="widgetEditing" :size="18" aria-hidden="true"/><Pencil v-else :size="18" aria-hidden="true"/>
			</button>
		</div>
	</div>

	<div v-show="!isCollapsed" :id="bodyId" :class="$style.body" :data-active="tab" :inert="isCollapsed" :aria-hidden="isCollapsed">
		<div :class="$style.track">
			<!-- ===== ウィジェット ===== -->
			<section :class="$style.view" :data-on="tab === 'widgets' ? 'true' : undefined" :inert="tab !== 'widgets'">
				<div :class="$style.widgets"><XWidgets ref="widgetControls" :deckEmbedded="true"/></div>
			</section>

			<!-- ===== Hatask ===== -->
			<section :class="$style.view" :data-on="tab === 'hatask' ? 'true' : undefined" :inert="tab !== 'hatask'">
				<div :class="$style.day">
					<b>{{ dayLabel }}</b><span>{{ weekdayLabel }}</span>
					<MkA to="/hatask" :class="$style.open" :title="copy.openInHatask"><HataAppLogo app="hatask" :size="20" :monochrome="store.r.darkMode.value"/><span :class="$style.brandSm"><HataAppWordmark app="hatask" inheritColor/></span><ChevronRight :size="16" :class="$style.openArrow"/></MkA>
				</div>

				<div :class="$style.stats">
					<MkA to="/hatask?tab=todo" :class="$style.stat"><small><ListChecks :size="13"/>{{ copy.todoLabel }}</small><b>{{ todoDoneCount }}<em>/{{ todoTotalCount }}</em></b></MkA>
					<MkA to="/hatask?tab=cal" :class="$style.stat"><small><Calendar :size="13"/>{{ copy.statEvents }}</small><b>{{ todayEvents.length }}</b></MkA>
					<MkA to="/hatask?tab=meal" :class="$style.stat"><small><Soup :size="13"/>{{ copy.statMeals }}</small><b>{{ mealsRecorded }}<em>/3</em></b></MkA>
				</div>

				<div v-if="!loaded" :class="$style.loading"><MkLoading :em="true"/></div>
				<template v-else>
					<section :class="$style.sec">
						<div :class="$style.secHead"><Calendar :size="18"/>{{ copy.todayEvents }}<span :class="$style.cnt">{{ todayEvents.length }}</span></div>
						<MkA v-for="ev in todayEvents" :key="`${ev.sourceEventId}:${ev.occurrenceDate}`" to="/hatask?tab=cal" :class="$style.event" :data-next="ev.isNext ? 'true' : undefined">
							<time>{{ ev.timeText }}</time>
							<span :class="$style.eventBody">
								<b><HataskEmoji v-if="ev.emoji" :emoji="ev.emoji" :class="$style.eventEmoji"/>{{ ev.title }}</b>
								<small v-if="ev.hint">{{ ev.hint }}</small>
							</span>
						</MkA>
						<p v-if="todayEvents.length === 0" :class="$style.empty">{{ copy.noEventsToday }}</p>
					</section>

					<section :class="$style.sec">
						<div :class="$style.secHead"><ListChecks :size="18"/>{{ copy.todoLabel }}<span :class="$style.cnt">{{ todoDoneCount }}/{{ todoTotalCount }}</span></div>
						<div :class="$style.bar"><i :style="{ width: `${todoPct}%` }"></i></div>
						<div v-for="todo in shownTodos" :key="todo.id" :class="$style.todo" :data-leaving="leavingIds.has(todo.id) ? 'true' : undefined">
							<button type="button" :class="$style.todoRow" :disabled="leavingIds.has(todo.id)" :title="writable ? copy.completeTodo : copy.openInHatask" @click="onTodoClick(todo)">
								<span :class="$style.box"><Check :size="13"/></span>
								<span :class="$style.todoText">{{ todo.text }}</span>
								<span :class="$style.todoTime" :data-overdue="todo.overdue ? 'true' : undefined">{{ todo.timeText }}</span>
							</button>
						</div>
						<p v-if="todoTotalCount > 0 && pendingTodos.length === 0" :class="[$style.empty, $style.allDone]">{{ copy.allTodosDone }}</p>
						<p v-else-if="todoTotalCount === 0" :class="$style.empty">{{ copy.noTodosToday }}</p>
					</section>

					<section :class="$style.sec">
						<div :class="$style.secHead"><Soup :size="18"/>{{ copy.mealRecords }}<span :class="$style.cnt">{{ mealsRecorded }}/3</span></div>
						<div :class="$style.meals">
							<MkA v-for="meal in mealRows" :key="meal.slot" :to="`/hatask?tab=meal&meal=${meal.slot}`" :class="$style.meal" :data-empty="meal.text ? undefined : 'true'">
								<small>{{ meal.label }}</small><b>{{ meal.text || copy.notRecorded }}</b>
							</MkA>
						</div>
					</section>

					<section :class="$style.sec">
						<div :class="$style.secHead"><Smile :size="18"/>{{ copy.todayMood }}<span :class="[$style.cnt, $style.cntMuted]">{{ todayMoodLevel ? moodLabels[todayMoodLevel - 1] : copy.notRecorded }}</span></div>
						<div :class="$style.mood">
							<MkA v-for="(emoji, i) in MOOD_EMOJIS" :key="emoji" :to="`/hatask?tab=mood&mood=${i + 1}`" :class="$style.moodBtn" :data-on="todayMoodLevel === i + 1 ? 'true' : undefined" :title="moodLabels[i]">
								<HataskEmoji :emoji="emoji" :class="$style.moodEmoji"/>
							</MkA>
						</div>
					</section>

					<MkA v-if="flower" :to="hatagoesUrl('/hatask?tab=garden')" :class="[$style.sec, $style.flowerSec]">
						<span :class="$style.secHead"><Flower2 :size="18"/>{{ copy.growingFlower }}<span :class="$style.cnt">{{ flower.progress }}%</span></span>
						<span :class="$style.flower">
							<span :class="$style.flowerEm"><HataskEmoji :emoji="flower.emoji" :class="$style.flowerEmoji"/></span>
							<span :class="$style.flowerBody">
								<b>{{ localizeFloraName(flower.name) }}</b>
								<span :class="$style.stages"><i v-for="i in 4" :key="i" :data-level="stageLevel(i)"></i></span>
								<small>{{ flowerHint }}</small>
							</span>
						</span>
					</MkA>
				</template>
			</section>
		</div>
	</div>
</aside>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { Calendar, Check, ChevronLeft, ChevronRight, Flower2, LayoutGrid, ListChecks, Pencil, Smile, Soup } from '@lucide/vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { mainRouter } from '@/router.js';
// 旗鯖fork: 単独の Hatask 画面は廃止したので、おはなは HataGoes の中の Hatask で開く。
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';
import { miLocalStorage } from '@/local-storage.js';
import { versatileLang } from '@/utility/intl-const.js';
import { localizeFloraName } from '@/utility/hatask-flora.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { advanceHataskFlowerGrowth, HATASK_FLOWER_GROWTH_EVENT } from '@/utility/hatask-flower-growth.js';
import type { HataskGrowingFlower } from '@/utility/hatask-flower-growth.js';
import { createHataskPlannerApiStoragePort } from '@/utility/hatask-planner-api.js';
import { createHataskPlannerMigrationPlan, HATASK_PLANNER_SCOPE, readHataskPlannerStorage } from '@/utility/hatask-planner-storage.js';
import type { HataskPlannerEvent, HataskPlannerRevision, HataskPlannerTodo } from '@/utility/hatask-planner-storage.js';
import { expandHataskEventOccurrences } from '@/utility/hatask-planner-recurrence.js';
import { completeHataskTodos } from '@/utility/hatask-todo-completion.js';
import { isJournalEntry } from '@/utility/hatask-journal.js';
import type { HataskJournalEntry } from '@/utility/hatask-journal.js';

const XWidgets = defineAsyncComponent(() => import('@/ui/_common_/widgets.vue'));
const widgetControls = ref<InstanceType<typeof XWidgets> | null>(null);
const widgetEditing = computed(() => widgetControls.value?.getWidgetEditMode() ?? false);

type PaneTab = 'widgets' | 'hatask';
const props = defineProps<{ initialTab?: PaneTab; mobile?: boolean; collapsible?: boolean; collapsed?: boolean }>();
const emit = defineEmits<{ tabChange: [tab: PaneTab]; toggleCollapse: [] }>();
const bodyId = useId();
const isCollapsed = computed(() => !!props.collapsible && !props.mobile && !!props.collapsed);
const collapseLabel = computed(() => `${i18n.ts.widgets}: ${isCollapsed.value ? i18n.ts.show : i18n.ts.hide}`);

const copy = i18n.ts._hata._hataskeyUi3;
const MOOD_EMOJIS = ['😢', '🙁', '😐', '🙂', '🥰'] as const;
const hataskMain = i18n.ts._hata._hatask._main;
// 気分の段階名は Hatask の記録画面と同じものを使う。
const moodLabels = [hataskMain.moodLevelHard, hataskMain.moodLevelUneasy, hataskMain.moodLevelNeutral, hataskMain.moodLevelGood, hataskMain.moodLevelGreat];
const LEAVE_MS = 720;

const tab = ref<PaneTab>(miLocalStorage.getItem('hataskeyUi3PaneTab') === 'widgets' ? 'widgets' : 'hatask');
watch(() => props.initialTab, next => { if (next) tab.value = next; }, { immediate: true });

function setTab(next: PaneTab) {
	tab.value = next;
	miLocalStorage.setItem('hataskeyUi3PaneTab', next);
	emit('tabChange', next);
}

defineExpose({ setTab });

const now = ref(new Date());
const loaded = ref(false);
const writable = ref(false);
const todos = ref<HataskPlannerTodo[]>([]);
const todosRevision = ref<HataskPlannerRevision>(null);
const events = ref<HataskPlannerEvent[]>([]);
const meals = ref<HataskJournalEntry[]>([]);
const moods = ref<HataskJournalEntry[]>([]);
const flower = ref<HataskGrowingFlower | null>(null);
const leavingIds = ref(new Set<string>());

const port = createHataskPlannerApiStoragePort((endpoint, params) => misskeyApi(endpoint as never, params as never));

function dateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = computed(() => dateKey(now.value));
const dayLabel = computed(() => versatileLang.startsWith('ja') ? `${now.value.getMonth() + 1}.${now.value.getDate()}` : shortDate.format(now.value));
const weekdayLabel = computed(() => new Intl.DateTimeFormat(versatileLang, { weekday: 'short' }).format(now.value));
const shortDate = new Intl.DateTimeFormat(versatileLang, { month: 'numeric', day: 'numeric' });

function isToday(value: unknown): boolean {
	if (typeof value !== 'string' && typeof value !== 'number') return false;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) && dateKey(date) === today.value;
}

// 今日のToDo: 期限が今日までのもの(期限切れを含む)と期限なしの未完了。今日完了した分も件数に含める。
const todayTodos = computed(() => todos.value.filter(todo => {
	if (todo.archivedAt != null) return false;
	const due = typeof todo.due === 'string' && todo.due ? todo.due : null;
	if (todo.done) return isToday(todo.doneAt) && (due == null || due <= today.value);
	return due == null || due <= today.value;
}));
const pendingTodos = computed(() => todayTodos.value
	.filter(todo => !todo.done)
	.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99') || (a.position ?? 0) - (b.position ?? 0)));
const todoTotalCount = computed(() => todayTodos.value.length);
const todoDoneCount = computed(() => todoTotalCount.value - pendingTodos.value.length);
const todoPct = computed(() => todoTotalCount.value ? Math.round(todoDoneCount.value / todoTotalCount.value * 100) : 0);
const shownTodos = computed(() => pendingTodos.value.slice(0, 8).map(todo => {
	const overdue = !!todo.due && todo.due < today.value;
	const timeText = overdue ? shortDate.format(new Date(`${todo.due}T00:00:00`)) : todo.time || (todo.due ? '' : copy.noDue);
	return { ...todo, overdue, timeText };
}));

function minutesUntil(date: string, time: string): number {
	return Math.round((new Date(`${date}T${time}`).getTime() - now.value.getTime()) / 60_000);
}

function durationText(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? i18n.tsx._hata._hataskeyUi3.hoursMinutes({ h: String(h), m: String(m) }) : i18n.tsx._hata._hataskeyUi3.minutesOnly({ m: String(m) });
}

const todayEvents = computed(() => {
	const list = expandHataskEventOccurrences(events.value.filter(ev => ev.archivedAt == null), today.value, today.value)
		.sort((a, b) => (a.allDay ? '' : a.timeStart || '').localeCompare(b.allDay ? '' : b.timeStart || ''));
	let nextMarked = false;
	return list.map(ev => {
		const start = !ev.allDay && ev.timeStart ? minutesUntil(ev.occurrenceDate, ev.timeStart) : null;
		const end = !ev.allDay && ev.timeEnd ? minutesUntil(ev.occurrenceDate, ev.timeEnd) : null;
		let hint = '';
		let isNext = false;
		if (start != null && start > 0) {
			hint = i18n.tsx._hata._hataskeyUi3.startsIn({ time: durationText(start) });
			if (!nextMarked) isNext = nextMarked = true;
		} else if (start != null && (end == null ? start > -60 : end > 0)) {
			hint = copy.ongoing;
			if (!nextMarked) isNext = nextMarked = true;
		}
		return { ...ev, timeText: ev.allDay || !ev.timeStart ? copy.allDay : ev.timeStart, hint, isNext };
	});
});

const MEAL_SLOTS = [
	{ slot: 'breakfast', label: copy.mealBreakfast },
	{ slot: 'lunch', label: copy.mealLunch },
	{ slot: 'dinner', label: copy.mealDinner },
] as const;
const MEAL_LEVEL_LABELS: Record<string, string> = { ate: copy.mealAte, little: copy.mealLittle, none: copy.mealNone };
const mealRows = computed(() => MEAL_SLOTS.map(({ slot, label }) => {
	const entry = meals.value.filter(m => m.date === today.value && m.slot === slot).pop();
	return { slot, label, text: entry ? (typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : MEAL_LEVEL_LABELS[String(entry.level)] ?? copy.recorded) : '' };
}));
const mealsRecorded = computed(() => mealRows.value.filter(row => row.text).length);

const todayMoodLevel = computed(() => {
	const entry = moods.value.filter(m => m.date === today.value).sort((a, b) => a.time.localeCompare(b.time)).pop();
	const level = Number(entry?.level);
	return Number.isInteger(level) && level >= 1 && level <= 5 ? level : null;
});

function stageLevel(index: number): 'full' | 'half' | 'none' {
	const reached = (flower.value?.progress ?? 0) / 25;
	if (reached >= index) return 'full';
	if (reached > index - 1) return 'half';
	return 'none';
}

const flowerHint = computed(() => {
	const f = flower.value;
	if (!f) return '';
	const left = f.targetMinutes - f.totalMinutes;
	if (left <= 0) return copy.bloomed;
	if (left < 60) return copy.bloomsSoon;
	return i18n.tsx._hata._hataskeyUi3.bloomsIn({ hours: String(Math.round(left / 60)) });
});

function record(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// ToDo・予定はHatask本体と同じ計画APIから読む。移行が済んでいない(本体が未確認の)データには書き込まない。
async function loadPlanner() {
	const reads = await readHataskPlannerStorage(port);
	const plan = createHataskPlannerMigrationPlan(reads);
	const todoRead = reads.collections.todos;
	writable.value = plan.status === 'noop' && todoRead.status === 'loaded';
	todosRevision.value = todoRead.status === 'loaded' ? todoRead.revision ?? null : null;
	todos.value = plan.data?.todos ?? [];
	events.value = plan.data?.events ?? [];
}

async function loadJournal() {
	const data = record(await misskeyApi('i/registry/get-all', { scope: [...HATASK_PLANNER_SCOPE] }));
	meals.value = (Array.isArray(data.meals) ? data.meals : []).filter((row): row is HataskJournalEntry => isJournalEntry(row, 'meal'));
	moods.value = (Array.isArray(data.moods) ? data.moods : []).filter((row): row is HataskJournalEntry => isJournalEntry(row, 'mood'));
	flower.value = advanceHataskFlowerGrowth(data.flower);
}

let loading = false;

async function load() {
	if (loading || leavingIds.value.size > 0) return;
	loading = true;
	try {
		await port.refresh();
		await Promise.allSettled([loadPlanner(), loadJournal()]);
	} finally {
		loading = false;
		loaded.value = true;
	}
}

async function commitCompletion(id: string, retry = true): Promise<void> {
	const { next, undo } = completeHataskTodos(todos.value, [id]);
	if (undo.length === 0) return;
	try {
		const result = await port.write({ scope: HATASK_PLANNER_SCOPE, key: 'todos', value: next, expectedRevision: todosRevision.value });
		todosRevision.value = result?.revision ?? todosRevision.value;
		todos.value = next;
	} catch (error) {
		// 他の画面で更新されていたら、最新を読み直して一度だけやり直す。
		if (retry && (error as { code?: string } | null)?.code === 'HATASK_PLANNER_CONFLICT') {
			await port.refresh();
			await loadPlanner();
			if (!writable.value) throw error;
			await commitCompletion(id, false);
			return;
		}
		throw error;
	}
}

function wait(ms: number) {
	return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

async function onTodoClick(todo: HataskPlannerTodo) {
	if (!writable.value) {
		mainRouter.pushByPath('/hatask?tab=todo' as never);
		return;
	}
	if (leavingIds.value.has(todo.id)) return;
	leavingIds.value = new Set([...leavingIds.value, todo.id]);
	const animate = prefer.s.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	try {
		// チェックを見せてから畳む演出と保存を並行し、両方が済んでから一覧を更新する。
		await Promise.all([commitCompletion(todo.id), animate ? wait(LEAVE_MS) : Promise.resolve()]);
	} catch (error) {
		console.error('Hataskey UI 3 todo completion failed', error);
		void os.alert({ type: 'error', text: copy.completeFailed });
	} finally {
		const nextLeaving = new Set(leavingIds.value);
		nextLeaving.delete(todo.id);
		leavingIds.value = nextLeaving;
	}
}

function onFlowerGrowth(ev: Event) {
	flower.value = (ev as CustomEvent<HataskGrowingFlower>).detail;
}

function onVisible() {
	if (window.document.visibilityState === 'visible') void load();
}

// Hatask本体で編集してから戻ってきたときは、右ペインも読み直す。
// 旗鯖fork: Hatask は HataGoes の中で開くので、/hatagoes から戻ったときも読み直す。
const isHataskPath = (path: string | undefined) => path != null && (path.startsWith('/hatask') || path === '/hatagoes');
watch(() => mainRouter.currentRoute.value.path, (path, prev) => {
	if (isHataskPath(prev) && !isHataskPath(path)) void load();
});

let clockTimer: number | null = null;
let refreshTimer: number | null = null;

onMounted(() => {
	void load();
	clockTimer = window.setInterval(() => { now.value = new Date(); }, 30_000);
	refreshTimer = window.setInterval(() => { void load(); }, 5 * 60_000);
	window.addEventListener(HATASK_FLOWER_GROWTH_EVENT, onFlowerGrowth);
	window.document.addEventListener('visibilitychange', onVisible);
});

onBeforeUnmount(() => {
	if (clockTimer != null) window.clearInterval(clockTimer);
	if (refreshTimer != null) window.clearInterval(refreshTimer);
	window.removeEventListener(HATASK_FLOWER_GROWTH_EVENT, onFlowerGrowth);
	window.document.removeEventListener('visibilitychange', onVisible);
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	min-height: 0;
	overflow: hidden;
	background: var(--hk3-bg);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
	color: var(--hk3-text);

	&[data-glass] {
		background: var(--hk3-glass-pane, var(--hk3-bg));
		-webkit-backdrop-filter: blur(16px);
		backdrop-filter: blur(16px);
	}
	&[data-mobile] {
		flex: 1;
		min-height: 0;
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	a { color: inherit; text-decoration: none; }
}

.mobileHead {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex: none;
	min-height: 52px;
	padding: env(safe-area-inset-top, 0px) calc(8px * var(--hk3-ui-scale, 1)) 0 calc(20px * var(--hk3-ui-scale, 1));
}

.mobileTitle { display: flex; align-items: center; gap: calc(8px * var(--hk3-ui-scale, 1)); min-width: 0; }
.mobileTitle strong { font-size: calc(15px * var(--hk3-ui-scale, 1)); }
.mobileTitle .mobileBrand { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; font-size: calc(18px * var(--hk3-ui-scale, 1)); }

.head {
	position: relative;
	height: 58px;
	flex: none;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
	border-bottom: 2px solid var(--hk3-divider);
}

// 選択中の背景と下線は1枚の板として、タブ間を滑らせる。
.indicator {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	width: calc((100% - 48px) / 2);
	background: var(--hk3-accent-100);
	box-shadow: inset 0 -3px 0 var(--hk3-accent);
	transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
	pointer-events: none;

	.head[data-active="hatask"] & { transform: translateX(calc(100% + 48px)); }
}

.tabs {
	display: contents;
}

.editSlot {
	grid-column: 2;
	grid-row: 1;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: center;
}

.editButton {
	display: grid;
	place-items: center;
	width: 40px;
	height: 40px;
	padding: 0;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: var(--hk3-neutral-700);
	cursor: pointer;

	&:hover, &[aria-pressed="true"] {
		background: var(--hk3-accent-100);
		color: var(--hk3-accent-800);
	}
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
	&:disabled { opacity: 0.5; cursor: default; }
}

.collapseButton {
	align-self: flex-end;
	flex: none;
	width: 44px;
	height: 44px;
	margin: 8px 10px 6px;
}

.tab {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	border: 0;
	background: transparent;
	color: var(--hk3-neutral-700);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	transition: color 300ms ease;

	grid-row: 1;
	min-width: 0;
	padding: 0;
	&:first-child { grid-column: 1; }
	&:last-child { grid-column: 3; }
	&[aria-selected="true"] { color: var(--hk3-accent-800); }
	&[aria-selected="true"] svg { color: var(--hk3-accent); }
	&:hover:not([aria-selected="true"]) { color: var(--hk3-accent-700); }
}

.brand, .brandSm {
	font-family: 'Righteous', system-ui, sans-serif;
	font-weight: 400;
	letter-spacing: 0.01em;
}

.brand { font-size: calc(17px * var(--hk3-ui-scale, 1)); }
.brandSm { font-size: calc(16px * var(--hk3-ui-scale, 1)); }

.badge {
	position: absolute;
	top: 11px;
	right: calc(50% - 50px);
	padding: 0 calc(5px * var(--hk3-ui-scale, 1));
	background: var(--hk3-accent);
	color: var(--hk3-bg);
	font-size: calc(10px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	line-height: 1.5;
}

.body {
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.track {
	display: flex;
	width: 200%;
	height: 100%;
	transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);

	.body[data-active="hatask"] & { transform: translateX(-50%); }
	.root[data-mobile] & { transition: none; }
}

.view {
	width: 50%;
	height: 100%;
	overflow: auto;
	overscroll-behavior: contain;
	opacity: 0.35;
	transition: opacity 360ms ease;

	&[data-on] { opacity: 1; }
	.root[data-mobile] & { opacity: 1; visibility: hidden; transition: none; }
	.root[data-mobile] &[data-on] { visibility: visible; }
}

// ===== ウィジェット: 中身は Hataskey UI と同じ。角を四角、区切りをUI3の線に揃える =====
.widgets {
	--MI-radius: 0px;
	--MI-margin: 0px;

	:global(._panel) {
		border-radius: 0 !important;
		border-bottom: 2px solid var(--hk3-divider);
	}
	:global(._panel:not(.mkw-post-form)) {
		box-shadow: none !important;
	}
}

// ガラス背景は外側の1枚だけにし、カードの背景と見出しの段差をなくす。
.root[data-glass] .widgets {
	:global(._panel), :global(._panel > header), :global(._panel > div) {
		background: transparent !important;
	}
}

// ===== Hatask =====
.day {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	padding: calc(14px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1));
	border-bottom: 3px solid var(--hk3-divider);

	> b { font-size: calc(30px * var(--hk3-ui-scale, 1)); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
	> span { font-size: calc(15px * var(--hk3-ui-scale, 1)); font-weight: 700; }
}

.open {
	margin-left: auto;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: calc(4px * var(--hk3-ui-scale, 1)) 2px calc(4px * var(--hk3-ui-scale, 1)) calc(8px * var(--hk3-ui-scale, 1));
	color: var(--hk3-accent-700) !important;
	box-shadow: inset 0 -2px 0 transparent;
	transition: box-shadow 200ms ease;

	&:hover { box-shadow: inset 0 -2px 0 var(--hk3-accent); }
	&:hover .openArrow { transform: translateX(3px); }
}

.openArrow { transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1); }

.stats {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	border-bottom: 3px solid var(--hk3-divider);
}

.stat {
	padding: calc(12px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1));
	display: flex;
	flex-direction: column;
	gap: calc(4px * var(--hk3-ui-scale, 1));

	& + & { border-left: 2px solid var(--hk3-divider); }
	&:hover { background: var(--hk3-accent-100); }

	small { display: flex; align-items: center; gap: calc(5px * var(--hk3-ui-scale, 1)); font-size: calc(11px * var(--hk3-ui-scale, 1)); font-weight: 800; color: var(--hk3-neutral-700); }
	small svg { color: var(--hk3-accent); }
	b { font-size: calc(22px * var(--hk3-ui-scale, 1)); font-weight: 800; font-variant-numeric: tabular-nums; }
	em { font-style: normal; font-size: calc(12px * var(--hk3-ui-scale, 1)); color: var(--hk3-neutral-600); margin-left: 2px; }
}

.loading { padding: calc(24px * var(--hk3-ui-scale, 1)); display: grid; place-items: center; }

.sec {
	display: block;
	border-bottom: 3px solid var(--hk3-divider);
}

.secHead {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	padding: calc(14px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1));
	font-size: calc(15px * var(--hk3-ui-scale, 1));
	font-weight: 800;

	> svg { color: var(--hk3-accent); flex: none; }
}

.cnt {
	margin-left: auto;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-variant-numeric: tabular-nums;
}

.cntMuted { font-weight: 700; color: var(--hk3-neutral-700); }

.empty {
	margin: 0;
	padding: 0 calc(20px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1));
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
}

.allDone { animation: hk3PaneFade 400ms ease; }

@keyframes hk3PaneFade { from { opacity: 0; } to { opacity: 1; } }

.event {
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	gap: calc(12px * var(--hk3-ui-scale, 1));
	align-items: center;
	padding: calc(10px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1));
	border-top: 2px solid var(--hk3-divider);

	&:hover { background: var(--hk3-accent-100); }
	&[data-next] { box-shadow: inset 3px 0 0 var(--hk3-accent); }

	time { font-size: calc(13px * var(--hk3-ui-scale, 1)); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--hk3-accent-700); }
}

.eventBody {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;

	b { display: flex; align-items: center; gap: calc(6px * var(--hk3-ui-scale, 1)); font-size: calc(14px * var(--hk3-ui-scale, 1)); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	small { font-size: calc(12px * var(--hk3-ui-scale, 1)); color: var(--hk3-neutral-700); }
}

.eventEmoji { width: 18px; height: 18px; flex: none; }

.bar {
	height: 4px;
	margin: 0 20px 8px;
	background: var(--hk3-neutral-300);

	i { display: block; height: 4px; background: var(--hk3-accent); transition: width 400ms ease; }
}

// 完了したToDoは、チェックを見せてから高さを畳んで一覧から外す。
.todo {
	display: grid;
	grid-template-rows: 1fr;
	transition: grid-template-rows 420ms cubic-bezier(0.65, 0, 0.35, 1) 280ms, opacity 300ms ease 280ms;

	&[data-leaving] { grid-template-rows: 0fr; opacity: 0; }
}

.todoRow {
	display: flex;
	align-items: center;
	gap: calc(12px * var(--hk3-ui-scale, 1));
	min-height: 46px;
	min-width: 0;
	overflow: hidden;
	padding: 0 calc(20px * var(--hk3-ui-scale, 1));
	border: 0;
	border-top: 2px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	text-align: left;

	&:hover { background: var(--hk3-accent-100); }
	&:disabled { cursor: default; }
	.todo[data-leaving] & { min-height: 0; border-top-color: transparent; }
}

.box {
	width: 20px;
	height: 20px;
	flex: none;
	display: grid;
	place-items: center;
	border: 2px solid var(--hk3-neutral-500);
	color: transparent;
	box-sizing: border-box;
	transition: background 200ms ease, border-color 200ms ease, color 200ms ease;

	.todo[data-leaving] & { border-color: var(--hk3-accent); background: var(--hk3-accent); color: var(--hk3-bg); }
}

.todoText {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	transition: color 200ms ease;

	.todo[data-leaving] & { color: var(--hk3-neutral-600); }
}

.todoTime {
	flex: none;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	color: var(--hk3-neutral-700);
	font-variant-numeric: tabular-nums;

	&[data-overdue] { color: var(--hk3-accent-700); font-weight: 800; }
}

.meals {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	border-top: 2px solid var(--hk3-divider);
}

.meal {
	padding: calc(10px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	display: flex;
	flex-direction: column;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	min-width: 0;
	font-size: calc(12px * var(--hk3-ui-scale, 1));

	& + & { border-left: 2px solid var(--hk3-divider); }
	&:hover { background: var(--hk3-accent-100); }

	small { color: var(--hk3-neutral-700); }
	b { font-size: calc(13px * var(--hk3-ui-scale, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	&[data-empty] b { color: var(--hk3-neutral-600); font-weight: 700; }
}

.mood {
	display: flex;
	border-top: 2px solid var(--hk3-divider);
}

.moodBtn {
	flex: 1;
	height: 48px;
	display: grid;
	place-items: center;

	& + & { border-left: 2px solid var(--hk3-divider); }
	&:hover { background: var(--hk3-accent-100); }
	&[data-on] { background: var(--hk3-accent-100); box-shadow: inset 0 -3px 0 var(--hk3-accent); }
}

.moodEmoji { width: 24px; height: 24px; }

.flowerSec:hover { background: var(--hk3-accent-100); }

.flower {
	display: grid;
	grid-template-columns: 56px minmax(0, 1fr);
	gap: calc(12px * var(--hk3-ui-scale, 1));
	align-items: center;
	padding: calc(4px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1)) calc(16px * var(--hk3-ui-scale, 1));
}

.flowerEm {
	width: 56px;
	height: 56px;
	display: grid;
	place-items: center;
	background: var(--hk3-accent-100);
	border: 1px solid var(--hk3-accent-300);
	box-sizing: border-box;
}

.flowerEmoji { width: 34px; height: 34px; }

.flowerBody {
	display: flex;
	flex-direction: column;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	min-width: 0;

	b { font-size: calc(14px * var(--hk3-ui-scale, 1)); }
	small { font-size: calc(12px * var(--hk3-ui-scale, 1)); color: var(--hk3-neutral-700); }
}

.stages {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: calc(4px * var(--hk3-ui-scale, 1));

	i { height: 8px; background: var(--hk3-neutral-300); }
	i[data-level="full"] { background: var(--hk3-accent); }
	i[data-level="half"] { background: var(--hk3-accent-300); }
}
</style>
