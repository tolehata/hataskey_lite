<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section
	ref="rootEl"
	:class="$style.root"
	data-hatask-component="calendar"
	:data-embedded="embedded"
	:data-hatask-theme="theme"
	:data-compact="compactLayout"
	:data-view="view"
	:data-layout="wideLayout ? 'split' : 'single'"
	:data-state="componentState"
	:aria-label="labels.calendar"
	:aria-busy="loading"
>
	<header :class="$style.header">
		<div :class="$style.periodBar">
			<button type="button" :class="$style.iconButton" :aria-label="labels.previousPeriod" :title="labels.previousPeriod" @click="emit('navigate', 'previous')">
				<i class="ti ti-chevron-left" aria-hidden="true"></i>
			</button>
			<h2 :class="$style.title" aria-live="polite">{{ title }}</h2>
			<button type="button" :class="$style.iconButton" :aria-label="labels.nextPeriod" :title="labels.nextPeriod" @click="emit('navigate', 'next')">
				<i class="ti ti-chevron-right" aria-hidden="true"></i>
			</button>
			<button type="button" :class="$style.todayButton" @click="emit('navigate', 'today')">
				<i class="ti ti-calendar-dot" aria-hidden="true"></i>
				<span>{{ labels.today }}</span>
			</button>
		</div>

		<div :class="$style.toolbar">
			<div :class="$style.viewSwitch" role="group" :aria-label="labels.viewSelector">
				<button
					v-for="option in viewOptions"
					:key="option"
					type="button"
					:data-active="view === option"
					:aria-pressed="view === option"
					:aria-label="labels.views[option]"
					:title="labels.views[option]"
					@click="emit('update:view', option)"
				>
					<i :class="viewIcon(option)" aria-hidden="true"></i>
					<span :class="$style.viewText">{{ labels.views[option] }}</span>
				</button>
			</div>
		</div>

		<div v-if="filters.length > 0" :class="$style.filters" role="group" :aria-label="labels.filters">
			<span :class="$style.filterLabel"><i class="ti ti-filter" aria-hidden="true"></i>{{ labels.filters }}</span>
			<button
				v-for="filter in filters"
				:key="filter.id"
				type="button"
				:data-active="filter.active"
				:aria-pressed="filter.active"
				:aria-label="filter.label"
				:title="filter.label"
				:disabled="filter.disabled"
				:style="filter.color ? { '--hatask-filter-color': filter.color } : undefined"
				@click="emit('toggle-filter', filter.id)"
			>
				<i :class="filter.icon ?? 'ti ti-calendar'" aria-hidden="true"></i>
				<span v-if="filter.color" :class="$style.filterDot" aria-hidden="true"></span>
				<span :class="$style.filterText">{{ filter.label }}</span>
				<span v-if="filter.count != null" :class="$style.filterCount">{{ filter.count }}</span>
			</button>
		</div>
	</header>
	<div v-if="embedded" ref="inlineCaptureTarget" data-hatagoes-inline-capture="calendar"></div>

	<p v-if="readOnly" :class="$style.notice">
		<i class="ti ti-lock" aria-hidden="true"></i>
		<span>{{ labels.readOnly }}</span>
	</p>

	<div v-if="loading" :class="$style.state">
		<i class="ti ti-loader-2" :class="$style.loadingIcon" aria-hidden="true"></i>
		<span>{{ labels.loading }}</span>
	</div>

	<div v-else-if="days.length > 0" :class="$style.workspace" :data-layout="wideLayout ? 'split' : 'single'" :data-view="view">
		<div v-if="view === 'month'" :class="$style.month" role="grid" :aria-label="title">
			<div :class="$style.weekdays" role="row">
				<div
					v-for="weekday in weekdays"
					:key="weekday.id"
					:class="$style.weekday"
					:data-weekend="weekday.isWeekend"
					role="columnheader"
				>
					{{ weekday.label }}
				</div>
			</div>
			<div :class="$style.monthGrid" role="rowgroup">
				<div
					v-for="(week, weekIndex) in calendarWeeks"
					:key="week[0]?.key ?? weekIndex"
					:class="$style.monthWeek"
					data-calendar-week
					role="row"
				>
					<div
						v-for="(day, dayIndex) in week"
						:key="day.key"
						:class="$style.monthDay"
						:data-date="day.date"
						:data-outside-range="day.isOutsideRange"
						:data-today="day.isToday"
						:data-selected="day.isSelected"
						:data-drop-active="dragOverDate === day.date"
						:data-calendar-drop-date="day.date"
						:data-blank-action="canOpenBlank(day)"
						role="gridcell"
						:aria-selected="day.isSelected"
						@dragover.prevent="dragOverDate = day.date"
						@dragleave="clearDragOver(day.date)"
						@drop="dropOnDay(day, $event)"
						@click="activateBlankSurface(day, $event)"
					>
						<button
							type="button"
							:class="$style.dayButton"
							data-calendar-day-button
							:tabindex="dayTabindex(day)"
							:aria-label="dayActionLabel(day)"
							:aria-haspopup="opensDayActions(day) ? 'dialog' : undefined"
							:aria-current="day.isToday ? 'date' : undefined"
							:aria-pressed="day.isSelected"
							:disabled="day.isDisabled"
							@click="activateDayButton(day, $event)"
							@focus="setFocusedDay(day)"
							@keydown="onDayKeydown($event, weekIndex * 7 + dayIndex)"
						>
							<span>{{ day.dayNumber }}</span>
						</button>
						<div v-if="day.events.length > 0" :class="$style.monthEvents">
							<button
								v-for="calendarEvent in day.events.slice(0, monthEventLimit)"
								:key="calendarEvent.id"
								type="button"
								:class="$style.monthEvent"
								:data-calendar-event="calendarEvent.id"
								:data-shared="calendarEvent.isShared"
								:draggable="canDrag(calendarEvent)"
								:style="eventStyle(calendarEvent)"
								:aria-label="labels.openEvent(calendarEvent.title)"
								:title="calendarEvent.title"
								@click="activateEvent(calendarEvent, day, $event)"
								@dragstart="startNativeDrag(calendarEvent, $event)"
								@dragend="finishDrag"
								@pointerdown="startPointerDrag(calendarEvent, $event)"
							>
								<HataskEmoji v-if="calendarEvent.emoji" :emoji="calendarEvent.emoji"/>
								<span v-if="!calendarEvent.isAllDay && calendarEvent.timeLabel" :class="$style.monthEventTime">{{ calendarEvent.timeLabel }}</span>
								<span :class="$style.monthEventTitle">{{ calendarEvent.title }}</span>
							</button>
							<button
								v-if="remainingEventCount(day) > 0"
								type="button"
								:class="$style.moreButton"
								@click="emit('show-more', day)"
							>
								{{ labels.showMore(remainingEventCount(day)) }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-if="view === 'week' || view === 'day'" :class="$style.timeline" :data-columns="view === 'day' ? 1 : days.length">
			<article v-for="day in days" :key="day.key" :class="$style.timelineDay" :data-date="day.date" :data-today="day.isToday" :data-selected="day.isSelected" :data-drop-active="dragOverDate === day.date" :data-calendar-drop-date="day.date" :data-blank-action="canOpenBlank(day)" @dragover.prevent="dragOverDate = day.date" @dragleave="clearDragOver(day.date)" @drop="dropOnDay(day, $event)" @click="activateBlankSurface(day, $event)">
				<header :class="$style.timelineHeading">
					<button
						type="button"
						:aria-label="dayActionLabel(day)"
						:aria-haspopup="opensDayActions(day) ? 'dialog' : undefined"
						:aria-current="day.isToday ? 'date' : undefined"
						:aria-pressed="day.isSelected"
						:disabled="day.isDisabled"
						@click="activateDayButton(day, $event)"
					>
						<span v-if="day.weekdayLabel" :class="$style.timelineWeekday">{{ day.weekdayLabel }}</span>
						<span :class="$style.timelineNumber">{{ day.dayNumber }}</span>
					</button>
				</header>
				<div v-if="allDayEvents(day).length" :class="$style.allDayLane">
					<span>{{ labels.allDay }}</span>
					<div v-for="calendarEvent in allDayEvents(day)" :key="calendarEvent.id" :class="$style.allDayEvent" :style="eventStyle(calendarEvent)" :draggable="canDrag(calendarEvent)" @dragstart="startNativeDrag(calendarEvent, $event)" @dragend="finishDrag" @pointerdown="startPointerDrag(calendarEvent, $event)">
						<button type="button" @click="activateEvent(calendarEvent, day, $event)"><HataskEmoji v-if="calendarEvent.emoji" :emoji="calendarEvent.emoji"/><span>{{ calendarEvent.title }}</span></button>
						<button type="button" data-calendar-no-drag :disabled="!canDrag(calendarEvent)" :aria-label="labels.moveEvent(calendarEvent.title)" :title="labels.moveEvent(calendarEvent.title)" @click="emit('move-request', calendarEvent, day)"><i class="ti ti-arrows-move" aria-hidden="true"></i></button>
						<button type="button" data-calendar-no-drag :disabled="readOnly||calendarEvent.readOnly" :aria-label="labels.editEvent(calendarEvent.title)" :title="labels.editEvent(calendarEvent.title)" @click="emit('edit-event', calendarEvent, day)"><i class="ti ti-pencil" aria-hidden="true"></i></button>
					</div>
				</div>
				<div :class="$style.timeCanvas" data-calendar-time-canvas>
					<div v-for="hour in timelineHours" :key="hour" :class="$style.hourLine" :style="hourLineStyle(hour)"><span>{{ String(hour).padStart(2, '0') }}:00</span></div>
					<div
						v-for="layout in timedEventLayout(day)"
						:key="layout.event.id"
						:class="$style.timelineEvent"
						:data-calendar-event="layout.event.id"
						:data-shared="layout.event.isShared"
						:style="layoutEventStyle(layout)"
						:draggable="canDrag(layout.event)"
						@dragstart="startNativeDrag(layout.event, $event)"
						@dragend="finishDrag"
						@pointerdown="startPointerDrag(layout.event, $event)"
					>
						<button type="button" :aria-label="labels.openEvent(layout.event.title)" @click="activateEvent(layout.event, day, $event)"><strong>{{ layout.event.title }}</strong><span>{{ layout.event.timeLabel }}</span></button>
						<button type="button" data-calendar-no-drag :disabled="!canDrag(layout.event)" :aria-label="labels.moveEvent(layout.event.title)" :title="labels.moveEvent(layout.event.title)" @click.stop="emit('move-request', layout.event, day)"><i class="ti ti-arrows-move" aria-hidden="true"></i></button>
						<button type="button" data-calendar-no-drag :disabled="readOnly||layout.event.readOnly" :aria-label="labels.editEvent(layout.event.title)" :title="labels.editEvent(layout.event.title)" @click.stop="emit('edit-event', layout.event, day)"><i class="ti ti-pencil" aria-hidden="true"></i></button>
					</div>
				</div>
			</article>
		</div>

		<div v-if="view === 'agenda'" :class="$style.agenda">
			<section v-for="day in days" :key="day.key" :class="$style.agendaDay" :data-date="day.date" :data-today="day.isToday" :data-selected="day.isSelected" :data-drop-active="dragOverDate === day.date" :data-calendar-drop-date="day.date" :data-blank-action="canOpenBlank(day)" @dragover.prevent="dragOverDate = day.date" @dragleave="clearDragOver(day.date)" @drop="dropOnDay(day, $event)" @click="activateBlankSurface(day, $event)">
				<header :class="$style.agendaHeading">
					<button
						type="button"
						:aria-label="dayActionLabel(day)"
						:aria-haspopup="opensDayActions(day) ? 'dialog' : undefined"
						:aria-current="day.isToday ? 'date' : undefined"
						:aria-pressed="day.isSelected"
						:disabled="day.isDisabled"
						@click="activateDayButton(day, $event)"
					>
						<span>{{ day.label }}</span>
						<span :class="$style.agendaCount">{{ day.events.length }}</span>
					</button>
				</header>
				<div v-if="day.events.length > 0" :class="$style.eventList">
					<div v-for="calendarEvent in day.events" :key="calendarEvent.id" :class="$style.draggableRow" :draggable="canDrag(calendarEvent)" @dragstart="startNativeDrag(calendarEvent, $event)" @dragend="finishDrag" @pointerdown="startPointerDrag(calendarEvent, $event)">
						<CalendarEventRow :event="calendarEvent" :labels="labels" :readOnly="readOnly" @activate="activateEvent(calendarEvent, day, $event)" @edit="emit('edit-event', calendarEvent, day)" @move="emit('move-request', calendarEvent, day)"/>
					</div>
				</div>
			</section>
		</div>

		<section
			v-if="(view === 'month' || wideLayout) && agendaDay"
			:class="$style.selectedAgenda"
			data-calendar-day-pane
			:data-date="agendaDay.date"
			:data-desktop-pane="wideLayout"
			:data-blank-action="canOpenBlank(agendaDay)"
			:aria-label="`${labels.selectedDay}: ${agendaDay.label}`"
			@click="activateBlankSurface(agendaDay, $event)"
		>
			<header><div><span>{{ labels.selectedDay }}</span><strong>{{ agendaDay.label }}</strong></div><b>{{ agendaDay.events.length }}</b></header>
			<div v-if="wideLayout" :class="$style.dayPaneNavigation">
				<button
					type="button"
					:class="$style.iconButton"
					data-calendar-pane-previous
					:disabled="!previousAgendaDay"
					:aria-label="previousAgendaDay ? labels.selectDate(previousAgendaDay.label) : labels.previousPeriod"
					:title="previousAgendaDay ? labels.selectDate(previousAgendaDay.label) : labels.previousPeriod"
					@click="previousAgendaDay && selectDay(previousAgendaDay)"
				>
					<i class="ti ti-chevron-left" aria-hidden="true"></i>
				</button>
				<button type="button" :class="$style.dayPaneView" data-calendar-pane-open-day :disabled="view === 'day'" @click="emit('show-more', agendaDay)">
					<i class="ti ti-calendar-event" aria-hidden="true"></i><span>{{ labels.views.day }}</span>
				</button>
				<button
					type="button"
					:class="$style.iconButton"
					data-calendar-pane-next
					:disabled="!nextAgendaDay"
					:aria-label="nextAgendaDay ? labels.selectDate(nextAgendaDay.label) : labels.nextPeriod"
					:title="nextAgendaDay ? labels.selectDate(nextAgendaDay.label) : labels.nextPeriod"
					@click="nextAgendaDay && selectDay(nextAgendaDay)"
				>
					<i class="ti ti-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
			<div v-if="agendaDay.events.length" :class="$style.eventList">
				<div
					v-for="calendarEvent in agendaDay.events"
					:key="calendarEvent.id"
					:class="$style.draggableRow"
					:draggable="canDrag(calendarEvent)"
					@dragstart="startNativeDrag(calendarEvent, $event)"
					@dragend="finishDrag"
					@pointerdown="startPointerDrag(calendarEvent, $event)"
				>
					<CalendarEventRow :event="calendarEvent" :labels="labels" :readOnly="readOnly" @activate="activateEvent(calendarEvent, agendaDay, $event)" @edit="emit('edit-event', calendarEvent, agendaDay)" @move="emit('move-request', calendarEvent, agendaDay)"/>
				</div>
			</div>
			<button v-else-if="canOpenBlank(agendaDay)" type="button" :class="[$style.dayEmpty, $style.blankButton]" :aria-label="dayActionLabel(agendaDay)" aria-haspopup="dialog" @click="activateDayButton(agendaDay, $event)">{{ labels.empty }}</button>
			<div v-else :class="$style.dayEmpty">{{ labels.empty }}</div>
		</section>
	</div>

	<div v-else :class="$style.state" role="status">
		<i class="ti ti-calendar-off" aria-hidden="true"></i>
		<span>{{ labels.empty }}</span>
	</div>

	<Teleport to="body">
		<Transition name="calendar-trash">
			<div v-if="draggingEvent" :class="$style.dragDock" :data-hatask-theme="theme" :data-hatask-mode="colorMode" :data-compact="compactLayout" :data-trash-active="trashActive" role="status" aria-live="polite">
				<div :class="$style.dragHint"><i class="ti ti-arrows-move" aria-hidden="true"></i><span>{{ labels.dragHint }}</span></div>
				<div :class="$style.trashTarget" data-calendar-trash @dragover.prevent="trashActive = true" @dragleave="trashActive = false" @drop="dropOnTrash">
					<i class="ti ti-trash" aria-hidden="true"></i><span>{{ labels.trashHint }}</span>
				</div>
			</div>
		</Transition>
	</Teleport>
</section>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, useCssModule, watch } from 'vue';
import type { HataskCalendarBlankTarget, HataskCalendarDay, HataskCalendarEvent, HataskCalendarLabels, HataskCalendarNavigation, HataskCalendarView, HataskCalendarWeekday, HataskPlannerFilter, HataskPlannerTheme } from './hatask-planner-types.js';
import HataskEmoji from '@/components/HataskEmoji.vue';

const props = withDefaults(defineProps<{
	theme?: HataskPlannerTheme;
	colorMode?: 'light' | 'dark';
	view: HataskCalendarView;
	title: string;
	weekdays: HataskCalendarWeekday[];
	days: HataskCalendarDay[];
	filters?: HataskPlannerFilter[];
	labels: HataskCalendarLabels;
	loading?: boolean;
	readOnly?: boolean;
	maxEventsPerDay?: number;
	embedded?: boolean;
}>(), {
	theme: undefined,
	colorMode: undefined,
	filters: () => [],
	loading: false,
	readOnly: false,
	maxEventsPerDay: 3,
	embedded: false,
});

const emit = defineEmits<{
	(ev: 'update:view', view: HataskCalendarView): void;
	(ev: 'navigate', direction: HataskCalendarNavigation): void;
	(ev: 'select-date', day: HataskCalendarDay): void;
	(ev: 'toggle-filter', filterId: string): void;
	(ev: 'activate-event', event: HataskCalendarEvent, day: HataskCalendarDay, anchor: HTMLElement | null): void;
	(ev: 'activate-blank', target: HataskCalendarBlankTarget): void;
	(ev: 'edit-event', event: HataskCalendarEvent, day: HataskCalendarDay): void;
	(ev: 'show-more', day: HataskCalendarDay): void;
	(ev: 'drop-event', event: HataskCalendarEvent, day: HataskCalendarDay, time?: string): void;
	(ev: 'trash-event', event: HataskCalendarEvent): void;
	(ev: 'move-request', event: HataskCalendarEvent, day: HataskCalendarDay): void;
	(ev: 'captureTarget', target: HTMLElement | undefined): void;
}>();

const styles = useCssModule();
const viewOptions: HataskCalendarView[] = ['month', 'week', 'day', 'agenda'];
const selectedDay = computed(() => props.days.find(day => day.isSelected));
const calendarWeeks = computed(() => {
	const weeks: HataskCalendarDay[][] = [];
	for (let index = 0; index < props.days.length; index += 7) weeks.push(props.days.slice(index, index + 7));
	return weeks;
});
const focusedDayKey = ref<string | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const inlineCaptureTarget = ref<HTMLElement | null>(null);
watch(inlineCaptureTarget, target => emit('captureTarget', target ?? undefined), { flush: 'post' });
const compactLayout = ref(false);
const availableWidth = ref(0);
const monthEventLimit = computed(() => availableWidth.value >= 900 ? Math.min(props.maxEventsPerDay, 1) : props.maxEventsPerDay);
const wideLayout = computed(() => (props.view === 'month' && availableWidth.value >= 960)
	|| (props.view === 'week' && availableWidth.value >= 1120));
const agendaDay = computed(() => selectedDay.value ?? (wideLayout.value
	? props.days.find(day => day.isToday && !day.isDisabled)
		?? props.days.find(day => !day.isOutsideRange && !day.isDisabled)
		?? props.days.find(day => !day.isDisabled)
	: undefined));
const previousAgendaDay = computed(() => adjacentAgendaDay(-1));
const nextAgendaDay = computed(() => adjacentAgendaDay(1));
const draggingEvent = ref<HataskCalendarEvent | null>(null);
const dragOverDate = ref<string | null>(null);
const trashActive = ref(false);
const dragOverTime = ref<string | undefined>(undefined);
let pointerCandidate: HataskCalendarEvent | null = null;
let pointerLongPressTimer: number | null = null;
let pointerOrigin: { x: number; y: number } | null = null;
let pointerDragActive = false;
let suppressedClickEventId: string | null = null;
let suppressBlankClickUntil = 0;
let layoutObserver: ResizeObserver | null = null;
const componentState = computed(() => props.loading ? 'loading' : props.readOnly ? 'read-only' : props.days.length === 0 ? 'empty' : 'ready');
const timelineHours = Array.from({ length: 25 }, (_, hour) => hour);

type TimedEventLayout = { event: HataskCalendarEvent; start: number; end: number; lane: number; laneCount: number };

function viewIcon(view: HataskCalendarView): string {
	return view === 'month' ? 'ti ti-calendar-month' : view === 'week' ? 'ti ti-calendar-week' : view === 'day' ? 'ti ti-calendar-event' : 'ti ti-list-details';
}

function adjacentAgendaDay(direction: -1 | 1): HataskCalendarDay | undefined {
	const index = props.days.findIndex(day => day.key === agendaDay.value?.key);
	if (index < 0) return undefined;
	for (let candidate = index + direction; candidate >= 0 && candidate < props.days.length; candidate += direction) {
		if (!props.days[candidate].isDisabled) return props.days[candidate];
	}
	return undefined;
}

function canDrag(event: HataskCalendarEvent): boolean {
	return !props.readOnly && event.readOnly !== true && event.draggable !== false;
}

function eventForId(id: string): HataskCalendarEvent | undefined {
	return props.days.flatMap(day => day.events).find(event => event.id === id);
}

function startNativeDrag(event: HataskCalendarEvent, dragEvent: DragEvent): void {
	if (!canDrag(event)) { dragEvent.preventDefault(); return; }
	draggingEvent.value = event;
	dragEvent.dataTransfer?.setData('application/x-hatask-calendar-event', event.id);
	if (dragEvent.dataTransfer != null) dragEvent.dataTransfer.effectAllowed = 'copyMove';
}

function dragEventFromTransfer(dragEvent: DragEvent): HataskCalendarEvent | null {
	const id = dragEvent.dataTransfer?.getData('application/x-hatask-calendar-event') ?? '';
	return (id ? eventForId(id) : undefined) ?? draggingEvent.value;
}

function timeAtPoint(clientY: number, target: EventTarget | null): string | undefined {
	const element = target instanceof HTMLElement ? target : window.document.elementFromPoint(0, clientY) as HTMLElement | null;
	const canvas = element?.closest<HTMLElement>('[data-calendar-time-canvas]');
	if (canvas == null) return undefined;
	const rect = canvas.getBoundingClientRect();
	if (rect.height <= 0) return undefined;
	const raw = Math.max(0, Math.min(1439, (clientY - rect.top) / rect.height * 1440));
	const rounded = Math.min(1425, Math.round(raw / 15) * 15);
	return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function dropOnDay(day: HataskCalendarDay, dragEvent: DragEvent): void {
	dragEvent.preventDefault();
	const event = dragEventFromTransfer(dragEvent);
	const time = timeAtPoint(dragEvent.clientY, dragEvent.target);
	if (event != null && canDrag(event)) emit('drop-event', event, day, time);
	finishDrag();
}

function dropOnTrash(dragEvent: DragEvent): void {
	dragEvent.preventDefault();
	const event = dragEventFromTransfer(dragEvent);
	if (event != null && canDrag(event)) emit('trash-event', event);
	finishDrag();
}

function clearDragOver(date: string): void { if (dragOverDate.value === date) dragOverDate.value = null; }

function finishDrag(): void {
	if (draggingEvent.value != null || pointerDragActive) suppressBlankClickUntil = performance.now() + 360;
	draggingEvent.value = null; dragOverDate.value = null; dragOverTime.value = undefined; trashActive.value = false;
}

function cancelPointerCandidate(): void {
	if (pointerLongPressTimer != null) window.clearTimeout(pointerLongPressTimer);
	pointerLongPressTimer = null;
	pointerCandidate = null;
	pointerOrigin = null;
}

function startPointerDrag(event: HataskCalendarEvent, pointerEvent: PointerEvent): void {
	if (pointerEvent.pointerType === 'mouse' || !canDrag(event) || (pointerEvent.target as HTMLElement).closest('[data-calendar-no-drag]')) return;
	cancelPointerCandidate();
	pointerCandidate = event;
	pointerOrigin = { x: pointerEvent.clientX, y: pointerEvent.clientY };
	pointerLongPressTimer = window.setTimeout(() => {
		draggingEvent.value = event;
		pointerDragActive = true;
		pointerLongPressTimer = null;
		pointerOrigin = null;
		if ('vibrate' in window.navigator) window.navigator.vibrate(12);
	}, 380);
}

function onGlobalPointerMove(pointerEvent: PointerEvent): void {
	if (!pointerDragActive && pointerCandidate != null && pointerOrigin != null && Math.hypot(pointerEvent.clientX - pointerOrigin.x, pointerEvent.clientY - pointerOrigin.y) >= 8) {
		cancelPointerCandidate();
		return;
	}
	if (!pointerDragActive) return;
	pointerEvent.preventDefault();
	const target = window.document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY) as HTMLElement | null;
	trashActive.value = target?.closest('[data-calendar-trash]') != null;
	dragOverDate.value = target?.closest<HTMLElement>('[data-calendar-drop-date]')?.dataset.calendarDropDate ?? null;
	dragOverTime.value = timeAtPoint(pointerEvent.clientY, target);
}

function onGlobalPointerUp(): void {
	if (!pointerDragActive) { cancelPointerCandidate(); return; }
	const event = draggingEvent.value;
	const targetDate = dragOverDate.value;
	if (event != null) {
		if (trashActive.value) emit('trash-event', event);
		else if (targetDate != null) {
			const day = props.days.find(candidate => candidate.date === targetDate);
			if (day != null) emit('drop-event', event, day, dragOverTime.value);
		}
		suppressedClickEventId = event.id;
		window.setTimeout(() => { if (suppressedClickEventId === event.id) suppressedClickEventId = null; }, 360);
	}
	pointerDragActive = false;
	cancelPointerCandidate();
	finishDrag();
}

function onGlobalPointerCancel(): void {
	// A browser gesture interruption is not a drop, even over a date or trash.
	pointerDragActive = false;
	cancelPointerCandidate();
	finishDrag();
}

function activateEvent(event: HataskCalendarEvent, day: HataskCalendarDay, clickEvent: MouseEvent): void {
	if (suppressedClickEventId === event.id) return;
	emit('activate-event', event, day, clickEvent.currentTarget instanceof HTMLElement ? clickEvent.currentTarget : null);
}

function canOpenBlank(day: HataskCalendarDay): boolean { return !props.readOnly && !props.loading && !day.isDisabled; }

function opensDayActions(day: HataskCalendarDay): boolean { return canOpenBlank(day) && day.events.length === 0; }

function dayActionLabel(day: HataskCalendarDay): string { return opensDayActions(day) ? (props.labels.openDayActions ?? props.labels.selectDate)(day.label) : props.labels.selectDate(day.label); }

function blankClickSuppressed(): boolean { return draggingEvent.value != null || pointerDragActive || performance.now() < suppressBlankClickUntil; }

function activateDayButton(day: HataskCalendarDay, clickEvent: MouseEvent): void {
	if (day.isDisabled || props.loading || clickEvent.defaultPrevented || blankClickSuppressed()) return;
	if (!opensDayActions(day)) { selectDay(day); return; }
	if (!(clickEvent.currentTarget instanceof HTMLElement)) return;
	setFocusedDay(day);
	emit('activate-blank', { day, anchor: clickEvent.currentTarget });
}

function activateBlankSurface(day: HataskCalendarDay, clickEvent: MouseEvent): void {
	if (!canOpenBlank(day) || clickEvent.defaultPrevented || blankClickSuppressed()) return;
	const holder = clickEvent.currentTarget;
	const target = clickEvent.target;
	if (!(holder instanceof HTMLElement) || !(target instanceof Element)) return;
	const control = target.closest('button, a, input, select, textarea, [contenteditable], [role="button"], [data-calendar-event], [data-calendar-no-drag], [draggable]');
	if (control && holder.contains(control)) return;
	const canvas = target.closest<HTMLElement>('[data-calendar-time-canvas]');
	const anchor = canvas && holder.contains(canvas) ? canvas : holder;
	if (canvas) {
		// Treat the rendered event box (including its padding) as occupied time.
		const occupied = [...canvas.querySelectorAll<HTMLElement>('[data-calendar-event]')].some(element => {
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && clickEvent.clientX >= rect.left && clickEvent.clientX < rect.right && clickEvent.clientY >= rect.top && clickEvent.clientY < rect.bottom;
		});
		if (occupied) return;
	}
	const rect = anchor.getBoundingClientRect();
	const ratio = (position: number, start: number, size: number): number => size > 0 ? Math.max(0, Math.min(1, (position - start) / size)) : .5;
	const point = { x: ratio(clickEvent.clientX, rect.left, rect.width), y: ratio(clickEvent.clientY, rect.top, rect.height) };
	const time = canvas ? timeAtPoint(clickEvent.clientY, target) : undefined;
	setFocusedDay(day);
	emit('activate-blank', { day, anchor, point, ...(time ? { time } : {}) });
}

function clockMinutes(value: string | undefined, fallback: number): number {
	const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
	if (match == null) return fallback;
	return Math.min(1440, Math.max(0, Number(match[1]) * 60 + Number(match[2])));
}

function allDayEvents(day: HataskCalendarDay): HataskCalendarEvent[] { return day.events.filter(event => event.isAllDay); }

function timedEventLayout(day: HataskCalendarDay): TimedEventLayout[] {
	const source = day.events.filter(event => !event.isAllDay).map(event => {
		const startsBefore = event.date != null && event.date < day.date;
		const endsAfter = event.dateEnd != null && event.dateEnd > day.date;
		const start = startsBefore ? 0 : clockMinutes(event.timeStart, 9 * 60);
		const rawEnd = endsAfter ? 1440 : clockMinutes(event.timeEnd, start + 60);
		return { event, start, end: Math.max(start + 15, rawEnd) };
	}).sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title));
	const output: TimedEventLayout[] = [];
	let group: typeof source = [];
	let groupEnd = -1;
	const flush = () => {
		if (group.length === 0) return;
		const laneEnds: number[] = [];
		const staged = group.map(item => {
			let lane = laneEnds.findIndex(end => end <= item.start);
			if (lane < 0) { lane = laneEnds.length; laneEnds.push(item.end); } else laneEnds[lane] = item.end;
			return { ...item, lane };
		});
		const laneCount = Math.max(1, laneEnds.length);
		output.push(...staged.map(item => ({ ...item, laneCount })));
		group = []; groupEnd = -1;
	};
	for (const item of source) {
		if (group.length > 0 && item.start >= groupEnd) flush();
		group.push(item); groupEnd = Math.max(groupEnd, item.end);
	}
	flush();
	return output;
}

function hourLineStyle(hour: number): Record<string, string> { return { top: `${hour / 24 * 100}%` }; }

function layoutEventStyle(layout: TimedEventLayout): Record<string, string> {
	return {
		...eventStyle(layout.event),
		top: `${layout.start / 1440 * 100}%`,
		height: `max(32px, ${(layout.end - layout.start) / 1440 * 100}%)`,
		left: `${layout.lane / layout.laneCount * 100}%`,
		width: `calc(${100 / layout.laneCount}% - 3px)`,
	};
}

onMounted(() => {
	const updateLayout = (width: number) => {
		availableWidth.value = width;
		compactLayout.value = width <= 720;
	};
	if (rootEl.value != null && typeof ResizeObserver !== 'undefined') {
		const element = rootEl.value;
		const initialWidth = element.getBoundingClientRect().width;
		updateLayout(initialWidth > 0 ? initialWidth : window.innerWidth);
		layoutObserver = new ResizeObserver(entries => updateLayout(entries[0].contentRect.width));
		layoutObserver.observe(element);
	} else {
		const initialWidth = rootEl.value?.getBoundingClientRect().width ?? 0;
		updateLayout(initialWidth > 0 ? initialWidth : window.innerWidth);
	}
	window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
	window.addEventListener('pointerup', onGlobalPointerUp);
	window.addEventListener('pointercancel', onGlobalPointerCancel);
});
onBeforeUnmount(() => {
	cancelPointerCandidate();
	layoutObserver?.disconnect();
	layoutObserver = null;
	window.removeEventListener('pointermove', onGlobalPointerMove);
	window.removeEventListener('pointerup', onGlobalPointerUp);
	window.removeEventListener('pointercancel', onGlobalPointerCancel);
});

watch(
	() => [props.view, ...props.days.map(day => `${day.key}:${day.isSelected === true}:${day.isToday === true}:${day.isDisabled === true}`)],
	() => {
		if (props.view !== 'month') return;
		if (props.days.some(day => day.key === focusedDayKey.value && !day.isDisabled)) return;
		focusedDayKey.value = props.days.find(day => day.isSelected && !day.isDisabled)?.key
			?? props.days.find(day => day.isToday && !day.isDisabled)?.key
			?? props.days.find(day => !day.isDisabled)?.key
			?? null;
	},
	{ immediate: true },
);

function eventStyle(event: HataskCalendarEvent): Record<string, string> {
	return { '--hatask-event-color': event.color ?? 'var(--accent)' };
}

function remainingEventCount(day: HataskCalendarDay): number {
	return day.hiddenEventCount ?? Math.max(0, day.events.length - monthEventLimit.value);
}

function dayTabindex(day: HataskCalendarDay): 0 | -1 {
	return !day.isDisabled && day.key === focusedDayKey.value ? 0 : -1;
}

function setFocusedDay(day: HataskCalendarDay): void {
	if (!day.isDisabled) focusedDayKey.value = day.key;
}

function selectDay(day: HataskCalendarDay): void {
	setFocusedDay(day);
	emit('select-date', day);
}

function enabledDayIndex(startIndex: number, step: -1 | 1, minimum = 0, maximum = props.days.length - 1): number | null {
	for (let index = startIndex; index >= minimum && index <= maximum; index += step) {
		if (!props.days[index]?.isDisabled) return index;
	}
	return null;
}

function focusDayAt(keyEvent: KeyboardEvent, targetIndex: number | null): void {
	if (targetIndex == null) return;
	const day = props.days[targetIndex];
	keyEvent.preventDefault();
	focusedDayKey.value = day.key;
	const grid = (keyEvent.currentTarget as HTMLElement).closest('[role="grid"]');
	nextTick(() => {
		const buttons = grid?.querySelectorAll<HTMLButtonElement>('[data-calendar-day-button]');
		buttons?.[targetIndex]?.focus();
	});
}

function onDayKeydown(keyEvent: KeyboardEvent, index: number): void {
	const rowSize = 7;
	let targetIndex: number | null = null;
	if (keyEvent.key === 'ArrowLeft') targetIndex = enabledDayIndex(index - 1, -1);
	if (keyEvent.key === 'ArrowRight') targetIndex = enabledDayIndex(index + 1, 1);
	if (keyEvent.key === 'ArrowUp') targetIndex = enabledDayIndex(index - rowSize, -1);
	if (keyEvent.key === 'ArrowDown') targetIndex = enabledDayIndex(index + rowSize, 1);
	if (keyEvent.key === 'Home') {
		const rowStart = index - (index % rowSize);
		targetIndex = enabledDayIndex(rowStart, 1, rowStart, Math.min(props.days.length - 1, rowStart + rowSize - 1));
	}
	if (keyEvent.key === 'End') {
		const rowStart = index - (index % rowSize);
		const rowEnd = Math.min(props.days.length - 1, rowStart + rowSize - 1);
		targetIndex = enabledDayIndex(rowEnd, -1, rowStart, rowEnd);
	}
	focusDayAt(keyEvent, targetIndex);
}

const CalendarEventRow = defineComponent({
	name: 'CalendarEventRow',
	props: {
		event: { type: Object as () => HataskCalendarEvent, required: true },
		labels: { type: Object as () => HataskCalendarLabels, required: true },
		readOnly: { type: Boolean, required: true },
	},
	emits: ['activate', 'edit', 'move'],
	setup(rowProps, { emit: rowEmit }) {
		return () => h('div', {
			class: styles.eventRow,
			'data-calendar-event': rowProps.event.id,
			'data-shared': String(rowProps.event.isShared === true),
			style: eventStyle(rowProps.event),
		}, [
			h('button', {
				type: 'button',
				class: styles.eventMain,
				'aria-label': rowProps.labels.openEvent(rowProps.event.title),
				onClick: (clickEvent: MouseEvent) => rowEmit('activate', clickEvent),
			}, [
				rowProps.event.emoji ? h(HataskEmoji, { emoji: rowProps.event.emoji }) : h('span', { class: styles.eventMarker, 'aria-hidden': 'true' }),
				h('span', { class: styles.eventBody }, [
					h('span', { class: styles.eventTitle }, rowProps.event.title),
					h('span', { class: styles.eventMeta }, [
						rowProps.event.isAllDay ? h('span', rowProps.labels.allDay) : rowProps.event.timeLabel ? h('span', rowProps.event.timeLabel) : null,
						rowProps.event.metaLabel ? h('span', rowProps.event.metaLabel) : null,
						rowProps.event.ownerLabel ? h('span', { class: styles.owner }, [h('i', { class: 'ti ti-users', 'aria-hidden': 'true' }), rowProps.event.ownerLabel]) : null,
					]),
					rowProps.event.statusLabel ? h('span', { class: styles.eventStatus }, rowProps.event.statusLabel) : null,
				]),
			]),
			h('div', { class: styles.eventActions, 'data-calendar-no-drag': '' }, [
				h('button', {
					type: 'button', class: styles.eventAction,
					disabled: rowProps.readOnly || rowProps.event.readOnly,
					'aria-label': rowProps.labels.moveEvent(rowProps.event.title), title: rowProps.labels.moveEvent(rowProps.event.title),
					onClick: () => rowEmit('move'),
				}, [h('i', { class: 'ti ti-arrows-move', 'aria-hidden': 'true' })]),
				h('button', {
					type: 'button', class: styles.eventAction,
					disabled: rowProps.readOnly || rowProps.event.readOnly,
					'aria-label': rowProps.labels.editEvent(rowProps.event.title), title: rowProps.labels.editEvent(rowProps.event.title),
					onClick: () => rowEmit('edit'),
				}, [h('i', { class: 'ti ti-pencil', 'aria-hidden': 'true' })]),
			]),
		]);
	},
});
</script>

<style lang="scss" module>
.root {
	container-name: hatask-calendar;
	container-type: inline-size;
	color: var(--fg);
	font-family: var(--htk-font-body, inherit);
	line-break: strict;
	overflow-wrap: anywhere;
}

.header {
	display: grid;
	gap: 14px;
	padding: 18px;
	background: var(--surface);
	border: var(--card-border, 1px solid var(--rule));
	border-radius: var(--card-radius, 16px);
	box-shadow: var(--card-shadow, none);
}

.periodBar, .toolbar, .filters, .viewSwitch, .eventMeta {
	display: flex;
	align-items: center;
}

.periodBar {
	gap: 8px;
}

.title {
	min-width: 0;
	margin: 0;
	font-family: var(--htk-font-head, inherit);
	font-size: clamp(1.08rem, 4cqi, 1.45rem);
	font-weight: 800;
	line-height: 1.35;
	text-align: center;
	text-wrap: balance;
	flex: 1;
}

.todayButton, .viewSwitch button, .filterLabel, .filters button, .moreButton, .eventStatus {
	white-space: nowrap;
	word-break: keep-all;
}

.iconButton, .todayButton, .eventAction {
	min-width: 44px;
	min-height: 44px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 7px;
	border: 1px solid var(--btn-border, var(--rule));
	border-radius: max(8px, calc(var(--card-radius, 16px) * .55));
	background: var(--btn-bg, var(--surface));
	color: var(--fg);
	font: inherit;
	font-weight: 700;
	cursor: pointer;
	transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.iconButton:hover, .todayButton:hover, .eventAction:hover:not(:disabled) {
	background: var(--btn-hover, color-mix(in srgb, var(--fg) 9%, var(--surface)));
}

.toolbar {
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.viewSwitch {
	min-width: min(100%, 360px);
	padding: 3px;
	gap: 3px;
	background: var(--fill, color-mix(in srgb, var(--fg) 5%, transparent));
	border: 1px solid var(--rule);
	border-radius: max(8px, calc(var(--card-radius, 16px) * .7));
}

.viewSwitch button {
	min-height: 44px;
	padding: 7px 13px;
	border: 0;
	border-radius: max(6px, calc(var(--card-radius, 16px) * .52));
	background: transparent;
	color: var(--fg-2);
	font: inherit;
	font-size: .78rem;
	font-weight: 700;
	cursor: pointer;
	flex: 1;
}

.viewSwitch button[data-active="true"] {
	background: var(--surface);
	color: var(--accent);
	box-shadow: 0 1px 4px color-mix(in srgb, var(--fg) 10%, transparent);
}

.filters {
	gap: 7px;
	flex-wrap: wrap;
}

.filterLabel {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	margin-inline-end: 3px;
	color: var(--fg-2);
	font-size: .75rem;
	font-weight: 700;
}

.filters button {
	max-width: 100%;
	min-height: 44px;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	border: 1px solid var(--rule);
	border-radius: 999px;
	background: transparent;
	color: var(--fg-2);
	font: inherit;
	font-size: .74rem;
	cursor: pointer;
}

.filterText {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.filters button[data-active="true"] {
	border-color: var(--hatask-filter-color, var(--accent));
	background: color-mix(in srgb, var(--hatask-filter-color, var(--accent)) 12%, transparent);
	color: var(--fg);
}

.filterDot, .eventMarker {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--hatask-filter-color, var(--hatask-event-color, var(--accent)));
	flex: none;
}

.filterCount {
	min-width: 20px;
	padding: 1px 5px;
	border-radius: 999px;
	background: var(--fill-2, color-mix(in srgb, var(--fg) 8%, transparent));
	font-variant-numeric: tabular-nums;
	text-align: center;
}

@container (max-width: 720px) {
	.filters {
		width: fit-content;
		max-width: 100%;
		box-sizing: border-box;
		margin-inline: auto;
		justify-content: center;
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: var(--fill-2);
	}

	.filterLabel, .filterCount, .filterDot, .filters button[data-active="false"] .filterText { display: none; }

	.filters button { justify-content: center; min-width: 44px; border-color: transparent; }
	.filters button i { font-size: 1rem; }
	.filters button[data-active="true"] {
		background: var(--surface);
		border-color: var(--rule);
		box-shadow: 0 2px 6px var(--hair);
	}
}

.notice, .state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: var(--fg-2);
}

.notice {
	margin: 12px 0 0;
	padding: 10px 14px;
	border: 1px solid var(--rule);
	border-radius: max(8px, calc(var(--card-radius, 16px) * .55));
	background: var(--fill);
	font-size: .78rem;
}

.state {
	min-height: 220px;
	margin-top: 14px;
	padding: 28px;
	border: 1px dashed var(--rule);
	border-radius: var(--card-radius, 16px);
	background: var(--surface);
	font-weight: 700;
}

.loadingIcon {
	animation: spin 900ms linear infinite;
}

@keyframes spin {
	to { transform: rotate(1turn); }
}

.month, .timeline, .agenda {
	margin-top: 14px;
}

.workspace {
	min-width: 0;
}

.month {
	padding: 12px;
	background: var(--surface);
	border: var(--card-border, 1px solid var(--rule));
	border-radius: var(--card-radius, 16px);
	box-shadow: var(--card-shadow, none);
}

.weekdays, .monthWeek {
	display: grid;
	grid-template-columns: repeat(7, minmax(0, 1fr));
}

.monthGrid {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
}

.weekday {
	padding: 8px 4px;
	color: var(--fg-3);
	font-size: .72rem;
	font-weight: 800;
	text-align: center;
}

.weekday[data-weekend="true"] {
	color: var(--accent);
}

.monthDay {
	min-width: 0;
	min-height: 116px;
	padding: 7px;
	border-top: 1px solid var(--rule);
	border-inline-start: 1px solid var(--rule);
	background: var(--surface);
}

.monthDay:last-child {
	border-inline-end: 1px solid var(--rule);
}

.monthWeek:last-child .monthDay {
	border-bottom: 1px solid var(--rule);
}

.monthDay[data-outside-range="true"] {
	opacity: .42;
}

.monthDay[data-today="true"] {
	background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}

.monthDay[data-selected="true"] {
	box-shadow: inset 0 0 0 2px var(--accent);
}

.dayButton {
	width: 44px;
	height: 44px;
	display: grid;
	place-items: center;
	margin: 0 0 4px;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: var(--fg);
	font: inherit;
	font-size: .78rem;
	font-weight: 800;
	cursor: pointer;
}

.monthDay[data-today="true"] .dayButton {
	background: var(--accent);
	color: var(--on-accent, var(--surface));
}

.monthEvents {
	display: grid;
	gap: 3px;
}

.monthEvent, .moreButton {
	width: 100%;
	min-width: 0;
	min-height: 24px;
	border: 0;
	background: transparent;
	color: var(--fg);
	font: inherit;
	font-size: .68rem;
	cursor: pointer;
	text-align: start;
}

.monthEvent {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 3px 5px;
	border-inline-start: 3px solid var(--hatask-event-color);
	border-radius: 4px;
	background: color-mix(in srgb, var(--hatask-event-color) 10%, transparent);
}

.monthEventTitle {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.monthEventTime {
	flex: none;
	color: var(--fg-3);
	font-size: .61rem;
	font-variant-numeric: tabular-nums;
}

.moreButton {
	padding: 2px 5px;
	color: var(--fg-2);
	font-weight: 700;
}

.timeline {
	display: grid;
	grid-template-columns: repeat(var(--timeline-columns, 1), minmax(0, 1fr));
	gap: 10px;
}

.timeline[data-columns="1"] {
	--timeline-columns: 1;
}

.timeline:not([data-columns="1"]) {
	--timeline-columns: 7;
}

@container (max-width: 1120px) {
	.timeline:not([data-columns="1"]) {
		--timeline-columns: 4;
	}
}

.timelineDay, .agendaDay {
	min-width: 0;
	background: var(--surface);
	border: var(--card-border, 1px solid var(--rule));
	border-radius: var(--card-radius, 16px);
	box-shadow: var(--card-shadow, none);
}

.timelineDay {
	min-height: 260px;
	padding: 10px;
	scroll-snap-align: start;
}

.timelineHeading button, .agendaHeading button {
	width: 100%;
	min-height: 44px;
	border: 0;
	background: transparent;
	color: var(--fg);
	font: inherit;
	cursor: pointer;
}

.timelineHeading button {
	display: grid;
	place-items: center;
	gap: 2px;
}

.timelineDay[data-today="true"] .timelineHeading button, .agendaDay[data-today="true"] .agendaHeading button {
	color: var(--accent);
}

.timelineWeekday {
	font-size: .68rem;
	font-weight: 700;
}

.timelineNumber {
	font-family: var(--htk-font-head, inherit);
	font-size: 1.3rem;
	font-weight: 900;
}

.eventList {
	display: grid;
	gap: 8px;
}

.eventRow {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 44px;
	gap: 4px;
	border: 1px solid var(--rule);
	border-inline-start: 4px solid var(--hatask-event-color);
	border-radius: max(7px, calc(var(--card-radius, 16px) * .55));
	background: color-mix(in srgb, var(--hatask-event-color) 5%, var(--surface));
	overflow: visible;
}

.eventMain {
	min-width: 0;
	min-height: 54px;
	display: flex;
	align-items: flex-start;
	gap: 9px;
	padding: 10px;
	border: 0;
	background: transparent;
	color: var(--fg);
	font: inherit;
	cursor: pointer;
	text-align: start;
}

.eventMain > img, .eventMain > i {
	margin-top: 3px;
	flex: none;
}

.eventBody {
	min-width: 0;
	display: grid;
	gap: 3px;
}

.eventTitle {
	font-size: .8rem;
	font-weight: 800;
}

.eventMeta {
	gap: 6px;
	flex-wrap: wrap;
	color: var(--fg-3);
	font-size: .68rem;
}

.owner {
	display: inline-flex;
	align-items: center;
	gap: 3px;
}

.eventStatus {
	width: fit-content;
	padding: 2px 6px;
	border-radius: 999px;
	background: var(--fill-2);
	color: var(--fg-2);
	font-size: .65rem;
	font-weight: 700;
}

.eventAction {
	align-self: stretch;
	min-height: 100%;
	border-width: 0 0 0 1px;
	border-radius: 0;
}

.dayEmpty {
	padding: 24px 8px;
	color: var(--fg-3);
	font-size: .74rem;
	text-align: center;
}

.monthDay[data-blank-action='true'], .timelineDay[data-blank-action='true'], .agendaDay[data-blank-action='true'], .selectedAgenda[data-blank-action='true'] { cursor: pointer; }

.blankButton { width: 100%; min-height: 44px; border: 1px dashed var(--rule); border-radius: var(--card-radius, 12px); background: transparent; font-family: inherit; cursor: pointer; }
.blankButton:hover { background: var(--fill); }
.blankButton:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.agenda {
	display: grid;
	gap: 12px;
}

.agendaDay {
	display: grid;
	grid-template-columns: minmax(126px, .28fr) minmax(0, 1fr);
	gap: 14px;
	padding: 12px;
}

.agendaHeading button {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 6px 9px;
	font-family: var(--htk-font-head, inherit);
	font-weight: 800;
	text-align: start;
}

.agendaCount {
	min-width: 26px;
	padding: 2px 7px;
	border-radius: 999px;
	background: var(--fill-2);
	font-family: var(--htk-font-body, inherit);
	font-size: .7rem;
	font-variant-numeric: tabular-nums;
	text-align: center;
}

.viewSwitch { width: 100%; }
.viewSwitch button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.viewText { display: inline; }
.monthDay, .timelineDay, .agendaDay { transition: box-shadow .2s ease, background-color .2s ease, transform .2s var(--ease-smooth, ease); }
.monthDay[data-drop-active="true"], .timelineDay[data-drop-active="true"], .agendaDay[data-drop-active="true"] { box-shadow: inset 0 0 0 3px var(--accent), 0 12px 30px -24px var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--surface)); }
.monthEvent, .draggableRow, .allDayEvent, .timelineEvent { cursor: grab; }
.monthEvent:active, .draggableRow:active, .allDayEvent:active, .timelineEvent:active { cursor: grabbing; }
.selectedAgenda { display: none; }
.dayPaneNavigation { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dayPaneView { min-width: 0; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex: 1; padding: 8px; border: 1px solid var(--rule); border-radius: max(8px, calc(var(--card-radius, 16px) * .55)); background: var(--fill); color: var(--fg); font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer; transition: background-color 160ms ease; }
.dayPaneView:hover:not(:disabled) { background: var(--btn-hover, var(--fill-2)); }
.eventRow { grid-template-columns: minmax(0, 1fr) 88px; }
.eventActions { display: grid; grid-template-columns: repeat(2, 44px); min-width: 88px; }
.eventActions .eventAction { width: 44px; }
.draggableRow { min-width: 0; border-radius: max(7px, calc(var(--card-radius, 16px) * .55)); }
.draggableRow:focus-within { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 2px; }

.allDayLane { display: grid; gap: 5px; padding: 7px; border-block: 1px solid var(--rule); background: var(--fill); }
.allDayLane > span { color: var(--fg-3); font-size: .6rem; font-weight: 800; }
.allDayEvent { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 36px 36px; align-items: stretch; border-inline-start: 3px solid var(--hatask-event-color); border-radius: 9px; background: color-mix(in srgb, var(--hatask-event-color) 11%, var(--surface)); overflow: hidden; }
.allDayEvent button { min-width: 0; min-height: 38px; display: flex; align-items: center; gap: 5px; padding: 5px 7px; border: 0; background: transparent; color: var(--fg); font: 750 .68rem/1.25 var(--htk-font-body, inherit); cursor: pointer; }
.allDayEvent button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.allDayEvent button:not(:first-child) { justify-content: center; padding: 0; border-inline-start: 1px solid var(--rule); color: var(--fg-3); }

.timeCanvas { position: relative; height: 816px; margin: 8px 5px 12px 40px; border-inline-start: 1px solid var(--rule); background: repeating-linear-gradient(to bottom, transparent 0, transparent 33px, color-mix(in srgb, var(--rule) 62%, transparent) 34px); }
.hourLine { position: absolute; inset-inline: -40px 0; height: 1px; border-top: 1px solid color-mix(in srgb, var(--rule) 72%, transparent); pointer-events: none; }
.hourLine span { position: absolute; inset-inline-start: 1px; top: -8px; width: 34px; color: var(--fg-3); font-size: .52rem; font-variant-numeric: tabular-nums; text-align: end; }
.timelineEvent { position: absolute; z-index: 2; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) 30px 30px; align-items: stretch; border: 1px solid color-mix(in srgb, var(--hatask-event-color) 45%, var(--rule)); border-inline-start: 4px solid var(--hatask-event-color); border-radius: 9px; background: color-mix(in srgb, var(--hatask-event-color) 13%, var(--surface)); box-shadow: 0 8px 18px -15px rgba(0, 0, 0, .65); overflow: hidden; transition: transform .18s var(--ease-smooth, ease), box-shadow .18s ease; }
.timelineEvent:hover { z-index: 3; transform: translateY(-1px); box-shadow: 0 12px 24px -16px rgba(0, 0, 0, .75); }
.timelineEvent > button { min-width: 0; display: grid; align-content: start; gap: 2px; padding: 6px; border: 0; background: transparent; color: var(--fg); font: inherit; text-align: start; cursor: pointer; }
.timelineEvent > button strong { overflow: hidden; font-size: .67rem; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.timelineEvent > button span { color: var(--fg-3); font-size: .55rem; font-variant-numeric: tabular-nums; }
.timelineEvent > button:not(:first-child) { display: grid; place-items: center; padding: 0; border-inline-start: 1px solid color-mix(in srgb, var(--hatask-event-color) 24%, var(--rule)); color: var(--fg-3); }

.dragDock { --dock-surface: var(--MI_THEME-panel); --dock-fg: var(--MI_THEME-fg); --dock-accent: var(--MI_THEME-accent); position: fixed; z-index: 1000002; inset-inline: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(620px, calc(100% - 28px)); display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, .42fr); gap: 8px; padding: 7px; border: 1px solid color-mix(in srgb, var(--dock-fg) 17%, transparent); border-radius: 24px; background: color-mix(in srgb, var(--dock-surface) 92%, transparent); color: var(--dock-fg); box-shadow: 0 24px 70px -28px rgba(0, 0, 0, .8); backdrop-filter: blur(18px) saturate(1.15); }
.dragHint, .trashTarget { min-height: 54px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 18px; font-size: .72rem; font-weight: 800; }
.dragHint { color: color-mix(in srgb, var(--dock-fg) 65%, transparent); }
.trashTarget { border: 1px dashed color-mix(in srgb, #e25567 58%, transparent); background: color-mix(in srgb, #e25567 8%, transparent); color: #d94359; transition: transform .2s var(--ease-spring, ease), background-color .18s ease; }
.dragDock[data-trash-active="true"] .trashTarget { transform: scale(1.035); background: #d94359; color: #fff; }
:global(.calendar-trash-enter-active), :global(.calendar-trash-leave-active) { transition: opacity .2s ease, transform .26s var(--ease-smooth, ease); }
:global(.calendar-trash-enter-from), :global(.calendar-trash-leave-to) { opacity: 0; transform: translateX(-50%) translateY(18px) scale(.97); }

button:focus-visible {
	outline: 3px solid var(--accent);
	outline-offset: 2px;
	z-index: 2;
}

button:disabled {
	opacity: .48;
	cursor: not-allowed;
}

button:active:not(:disabled) {
	transform: translateY(1px);
}

@container hatask-calendar (min-width: 900px) {
	.header {
		gap: 10px 14px;
		padding: 12px;
	}

	.month, .timeline, .agenda {
		margin-top: 10px;
	}

	.month {
		padding: 8px;
	}

	.monthDay {
		min-height: 96px;
		padding: 4px;
	}

	.dayButton {
		margin-bottom: 0;
	}

	.monthEvents {
		gap: 2px;
	}

	.monthEvent, .moreButton {
		min-height: 22px;
	}

	.timeCanvas {
		height: 600px;
	}
}

@container hatask-calendar (min-width: 960px) {
	.header {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px 18px;
	}

	.filters { grid-column: 1 / -1; }
	.viewSwitch { width: auto; min-width: 0; }

	.workspace[data-layout="split"] {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, .43fr);
		align-items: start;
		gap: 16px;
		margin-top: 14px;
	}

	.workspace[data-layout="split"] > .month, .workspace[data-layout="split"] > .timeline, .workspace[data-layout="split"] > .agenda {
		min-width: 0;
		margin-top: 0;
	}

	.workspace[data-layout="split"] .timelineDay[data-selected="true"], .workspace[data-layout="split"] .agendaDay[data-selected="true"] {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.selectedAgenda[data-desktop-pane="true"] {
		min-width: 0;
		display: grid;
		gap: 14px;
		padding: 16px;
		border: var(--card-border, 1px solid var(--rule));
		border-radius: var(--card-radius, 16px);
		background: var(--surface);
		box-shadow: var(--card-shadow, none);
	}

	.selectedAgenda > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.selectedAgenda > header div { min-width: 0; display: grid; gap: 5px; }
	.selectedAgenda > header span { color: var(--fg-2); font-size: .72rem; font-weight: 700; }
	.selectedAgenda > header strong { font-family: var(--htk-font-head, inherit); font-size: 1rem; line-height: 1.5; }
	.selectedAgenda > header b { min-width: 30px; flex: none; padding: 4px 8px; border-radius: 999px; background: var(--fill-2); color: var(--fg-2); font-size: .74rem; font-variant-numeric: tabular-nums; text-align: center; }
	.selectedAgenda .eventMain { min-height: 76px; }
	.selectedAgenda .eventTitle { font-size: .86rem; }
	.selectedAgenda .eventMeta { color: var(--fg-2); font-size: .72rem; }
	.selectedAgenda .eventStatus { white-space: normal; }

	.workspace[data-layout="split"] .agendaDay { grid-template-columns: minmax(100px, .25fr) minmax(0, 1fr); }
}

@container hatask-calendar (min-width: 1120px) {
	.header {
		grid-template-columns: minmax(240px, 1fr) auto minmax(320px, auto);
	}
	.filters {
		grid-column: auto;
		justify-self: end;
		flex-wrap: nowrap;
	}
	.filterLabel {
		display: none;
	}

	.workspace[data-layout="split"][data-view="week"] { grid-template-columns: minmax(0, 1fr) 280px; }
	.workspace[data-layout="split"] .timeline { gap: 6px; }
	.workspace[data-layout="split"] .timeline:not([data-columns="1"]) { grid-template-columns: minmax(0, 1.35fr) repeat(6, minmax(0, 1fr)); }
	.workspace[data-layout="split"] .timelineDay { padding: 8px 6px; }
	.workspace[data-layout="split"] .timelineDay:not(:first-child) .timeCanvas { margin-inline-start: 4px; }
	.workspace[data-layout="split"] .timelineDay:not(:first-child) .hourLine { inset-inline-start: 0; }
	.workspace[data-layout="split"] .timelineDay:not(:first-child) .hourLine span { display: none; }
	.workspace[data-layout="split"] .timeline:not([data-columns="1"]) .timelineEvent, .workspace[data-layout="split"] .timeline:not([data-columns="1"]) .allDayEvent { grid-template-columns: minmax(0, 1fr); }
	.workspace[data-layout="split"] .timeline:not([data-columns="1"]) .timelineEvent > button:not(:first-child), .workspace[data-layout="split"] .timeline:not([data-columns="1"]) .allDayEvent > button:not(:first-child) { display: none; }
}

@container (max-width: 720px) {
	.header, .month {
		padding: 12px;
	}

	.periodBar {
		flex-wrap: wrap;
	}

	.title {
		order: -1;
		flex-basis: 100%;
	}

	.todayButton {
		margin-inline-start: auto;
	}

	.viewSwitch, .toolbar {
		width: 100%;
	}

	.viewText { display: none; }
	.viewSwitch button { min-width: 44px; padding-inline: 8px; font-size: 1rem; }

	.timeline:not([data-columns="1"]) {
		grid-template-columns: 1fr;
	}

	.monthDay {
		min-height: 78px;
		padding: 3px;
	}

	.monthEvent {
		justify-content: center;
		min-height: 28px;
		padding: 2px;
		border-inline-start: 0;
		border-radius: 999px;
		background: var(--hatask-event-color);
	}

	.monthEvent > img, .monthEventTime, .monthEventTitle {
		display: none;
	}

	.selectedAgenda { display: grid; gap: 9px; margin-top: 10px; padding: 12px; border: var(--card-border, 1px solid var(--rule)); border-radius: var(--card-radius, 16px); background: var(--surface); box-shadow: var(--card-shadow, none); }
	.selectedAgenda > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.selectedAgenda > header div { min-width: 0; display: grid; gap: 2px; }
	.selectedAgenda > header span { color: var(--fg-3); font-size: .61rem; font-weight: 800; }
	.selectedAgenda > header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .82rem; }
	.selectedAgenda > header b { min-width: 28px; padding: 3px 7px; border-radius: 999px; background: var(--fill-2); color: var(--fg-2); font-size: .68rem; text-align: center; }

	.moreButton {
		font-size: .62rem;
		text-align: center;
	}

	.agendaDay {
		grid-template-columns: 1fr;
		gap: 8px;
	}
}

@media (max-width: 560px) {
	.dragDock { grid-template-columns: 1fr; bottom: max(10px, env(safe-area-inset-bottom)); border-radius: 20px; }
	.dragHint { display: none; }
	.trashTarget { min-height: 58px; }
}

.dragDock[data-compact="true"] { grid-template-columns: 1fr; bottom: max(10px, env(safe-area-inset-bottom)); border-radius: 20px; }
.dragDock[data-compact="true"] .dragHint { display: none; }
.dragDock[data-compact="true"] .trashTarget { min-height: 58px; }

@container (max-width: 420px) {
	.viewSwitch {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.dayButton {
		width: 44px;
		height: 44px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.root:not([data-embedded="true"]) *, .root:not([data-embedded="true"]) *::before, .root:not([data-embedded="true"]) *::after {
		animation: none !important;
		transition-duration: .01ms !important;
	}
}
/* 暁では親の明暗トークンを継承し、操作色には可読性を確保した ink を使う。 */
.root[data-hatask-theme] {
	--accent: var(--accent-ink);
	--fg-3: var(--fg-2);
	--card-radius: 24px;
	--card-border: 1px solid var(--rule);
	--card-shadow: var(--shadow, none);
}
.root[data-hatask-theme] .header { padding: 20px; }
.root[data-hatask-theme] .monthDay { background: color-mix(in srgb, var(--surface) 92%, transparent); }
.root[data-hatask-theme] .monthDay[data-selected='true'] { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.root[data-hatask-theme] .monthEvent, .root[data-hatask-theme] .moreButton, .root[data-hatask-theme] .allDayLane > span, .root[data-hatask-theme] .hourLine span, .root[data-hatask-theme] .timelineEvent > button strong, .root[data-hatask-theme] .timelineEvent > button span, .root[data-hatask-theme] .selectedAgenda > header span { font-size: max(11px, .7rem); }
/* Teleport 先は親の CSS 変数を継承できないため、選択中の明暗を明示する。 */
.dragDock[data-hatask-theme='akatsuki'] {
	--dock-surface: #fff7f2;
	--dock-fg: #2b1f2c;
	--dock-accent: #b02e56;
	color-scheme: light;
	border-radius: 24px;
	background: var(--dock-surface);
	font-family: 'Zen Kaku Gothic New', sans-serif;
}
.dragDock[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] {
	--dock-surface: #1b1424;
	--dock-fg: #f6ecf3;
	--dock-accent: #ff7fa3;
	color-scheme: dark;
}
.dragDock[data-hatask-theme] .dragHint { color: color-mix(in srgb, var(--dock-fg) 85%, var(--dock-surface)); font-size: max(11px, .72rem); }

:global(.htk-root:not([data-theme='akatsuki'])) :is(.month, .viewSwitch) { border-radius: var(--card-radius); border-color: var(--rule); box-shadow: var(--shadow); }
.root:not([data-hatask-theme='akatsuki']) { --card-radius: inherit; --card-border: inherit; --card-shadow: inherit; --on-accent: var(--htk-on-ink); }
.dragDock[data-hatask-theme]:not([data-hatask-theme='akatsuki']) { --dock-surface: var(--surface); --dock-fg: var(--fg); --dock-accent: var(--accent-ink); border-radius: var(--case-radius); border-color: var(--rule); background: var(--surface); box-shadow: var(--shadow); font-family: var(--htk-font-body); }
</style>
