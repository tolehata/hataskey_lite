<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<HataskEventDetailsDialog
	v-bind="$attrs"
	:isOpen="isOpen"
	:active="active"
	:event="null"
	:labels="frameLabels"
	:readOnly="readOnly"
	:busy="busy"
	:returnFocusTo="returnFocusTo"
	:getAnchor="getAnchor"
	:getAnchorRect="getAnchorRect"
	:animations="animations"
	@close="emit('close')"
	@focusFallback="emit('focus-fallback')"
>
	<template #body>
		<div ref="content" :class="$style.content" :data-motion="goesMotion || animations !== false" :data-hatagoes="goesMotion" :data-hatask-calendar-blank-step="step">
			<div :class="$style.destination" data-hatask-calendar-blank="destination"><i class="ti ti-calendar-plus" aria-hidden="true"></i><div><span>{{ labels.target }}</span><strong>{{ targetLabel }}</strong></div></div>
			<p :id="scopeId" :class="$style.hint">{{ labels.scopeHint }}</p>
			<p v-if="error" :id="errorId" :class="$style.error" role="alert" data-hatask-calendar-blank="error"><i class="ti ti-alert-circle" aria-hidden="true"></i><span>{{ error }}</span></p>
			<p v-if="readOnly" :class="$style.hint" data-hatask-calendar-blank="read-only"><i class="ti ti-lock" aria-hidden="true"></i> {{ detailLabels.readOnly }}</p>

			<template v-if="step === 'choices'">
				<p :class="$style.question">{{ labels.question }}</p>
				<div :class="$style.choices">
					<button ref="createEl" type="button" :class="$style.choice" :disabled="blocked" data-hatask-calendar-blank-action="create" @click="createEvent"><i class="ti ti-plus" aria-hidden="true"></i><span><strong>{{ labels.create }}</strong><small>{{ labels.createHint }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					<button ref="copyEl" type="button" :class="$style.choice" :disabled="blocked" data-hatask-calendar-blank-action="copy" @click="chooseMode('copy')"><i class="ti ti-copy-plus" aria-hidden="true"></i><span><strong>{{ labels.copy }}</strong><small>{{ labels.copyHint }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					<button ref="moveEl" type="button" :class="$style.choice" :disabled="blocked" data-hatask-calendar-blank-action="move" @click="chooseMode('move')"><i class="ti ti-arrow-move-right" aria-hidden="true"></i><span><strong>{{ labels.move }}</strong><small>{{ labels.moveHint }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
				</div>
			</template>

			<template v-else-if="step === 'picker'">
				<div :class="$style.search">
					<label :for="searchId">{{ labels.search }}</label>
					<div><i class="ti ti-search" aria-hidden="true"></i><input :id="searchId" ref="searchEl" v-model="query" type="search" :placeholder="labels.searchPlaceholder" :aria-describedby="error ? `${scopeId} ${errorId}` : scopeId" :disabled="blocked" autocomplete="off" data-hatask-calendar-blank="search"></div>
				</div>
				<ul v-if="visibleEvents.length" ref="eventsEl" :class="$style.events" data-hatask-calendar-blank="events">
					<li v-for="event in visibleEvents" :key="event.id"><button type="button" :class="$style.event" :disabled="blocked" :data-hatask-calendar-blank-event="event.id" @click="selectEvent(event.id)"><HataskEmoji v-if="event.emoji" :emoji="event.emoji" :class="$style.emoji"/><i v-else class="ti ti-calendar-event" aria-hidden="true"></i><span><strong>{{ event.title }}</strong><small>{{ event.dateLabel }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></li>
				</ul>
				<p v-else :class="$style.empty" role="status" data-hatask-calendar-blank="empty">{{ eligibleEvents.length ? labels.noMatches : labels.noEvents }}</p>
				<button v-if="filteredEvents.length > visibleCount" type="button" :class="$style.more" :disabled="blocked" data-hatask-calendar-blank-action="more" @click="showMore"><i class="ti ti-chevron-down" aria-hidden="true"></i>{{ labels.more }}</button>
			</template>

			<template v-else-if="selectedEvent">
				<div :class="$style.selected" data-hatask-calendar-blank="selected"><HataskEmoji v-if="selectedEvent.emoji" :emoji="selectedEvent.emoji" :class="$style.emoji"/><i v-else class="ti ti-calendar-event" aria-hidden="true"></i><h3>{{ selectedEvent.title }}</h3></div>
				<div :class="$style.route">
					<dl data-hatask-calendar-blank="source"><dt><i class="ti ti-calendar" aria-hidden="true"></i>{{ labels.source }}</dt><dd>{{ selectedEvent.dateLabel }}</dd></dl>
					<div :class="$style.routeArrow" aria-hidden="true"><i :class="mode === 'copy' ? 'ti ti-copy-plus' : 'ti ti-arrow-down'"></i></div>
					<dl data-hatask-calendar-blank="target"><dt><i class="ti ti-calendar-check" aria-hidden="true"></i>{{ labels.target }}</dt><dd>{{ selectedEvent.targetLabel }}</dd></dl>
				</div>
				<p :class="$style.hint">{{ mode === 'copy' ? labels.copyHint : labels.moveHint }}</p>
			</template>
		</div>
	</template>
	<template #footer>
		<button v-if="step !== 'choices'" type="button" :class="$style.footerAction" :disabled="blocked" data-hatask-calendar-blank-action="back" @click="goBack"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ labels.back }}</button>
		<button v-if="step === 'confirm'" ref="confirmEl" type="button" :class="$style.footerAction" data-primary="true" :disabled="blocked || !selectedEvent" data-hatask-calendar-blank-action="confirm" @click="confirmSelection"><i :class="mode === 'copy' ? 'ti ti-copy-plus' : 'ti ti-arrow-move-right'" aria-hidden="true"></i>{{ mode === 'copy' ? labels.confirmCopy : labels.confirmMove }}</button>
		<button type="button" :class="$style.cancel" data-hatask-calendar-blank-action="cancel" @click="emit('close')">{{ labels.cancel }}</button>
	</template>
</HataskEventDetailsDialog>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import HataskEventDetailsDialog from './HataskEventDetailsDialog.vue';
import type { HataskEventDetailsLabels } from './hatask-event-details-types.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { captureHatagoesPageTurn } from '@/utility/hatagoes-page-motion.js';
const goesMotion = !!inject(HATA_GOES_HOST, null);
const content = ref<HTMLElement>();
let stepMotion: ReturnType<typeof captureHatagoesPageTurn> | undefined;

export type HataskCalendarBlankEvent = {
	id: string;
	title: string;
	emoji?: string;
	dateLabel: string;
	targetLabel: string;
	canCopy: boolean;
	canMove: boolean;
};

export type HataskCalendarBlankLabels = {
	title: string;
	question: string;
	create: string;
	createHint: string;
	copy: string;
	copyHint: string;
	move: string;
	moveHint: string;
	chooseCopy: string;
	chooseMove: string;
	search: string;
	searchPlaceholder: string;
	noEvents: string;
	noMatches: string;
	source: string;
	target: string;
	confirmCopy: string;
	confirmMove: string;
	back: string;
	more: string;
	cancel: string;
	scopeHint: string;
};

type Mode = 'copy' | 'move';
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
	isOpen: boolean;
	active?: boolean;
	targetLabel: string;
	events: HataskCalendarBlankEvent[];
	labels: HataskCalendarBlankLabels;
	detailLabels: HataskEventDetailsLabels;
	readOnly: boolean;
	busy: boolean;
	error: string;
	returnFocusTo?: HTMLElement | null;
	getAnchor?: () => HTMLElement | null;
	getAnchorRect?: (anchor: HTMLElement) => { left: number; right: number; top: number; bottom: number };
	animations?: boolean;
}>(), { active: true, returnFocusTo: null, getAnchor: () => null, getAnchorRect: undefined, animations: true });
const emit = defineEmits<{
	create: [];
	confirm: [eventId: string, mode: Mode];
	'close': [];
	'focus-fallback': [];
}>();
const mode = ref<Mode | null>(null);
const query = ref('');
const selectedId = ref<string | null>(null);
const visibleCount = ref(30);
const createEl = ref<HTMLButtonElement | null>(null);
const copyEl = ref<HTMLButtonElement | null>(null);
const moveEl = ref<HTMLButtonElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);
const confirmEl = ref<HTMLButtonElement | null>(null);
const eventsEl = ref<HTMLUListElement | null>(null);
const searchId = `hatask-calendar-blank-search-${useId()}`;
const scopeId = `${searchId}-scope`;
const errorId = `${searchId}-error`;
const blocked = computed(() => !props.isOpen || props.readOnly || props.busy);
const eligibleEvents = computed(() => props.events.filter(event => mode.value === 'copy' ? event.canCopy : mode.value === 'move' && event.canMove));
const selectedEvent = computed(() => eligibleEvents.value.find(event => event.id === selectedId.value) ?? null);
const step = computed(() => mode.value == null ? 'choices' : selectedEvent.value ? 'confirm' : 'picker');
const frameLabels = computed(() => ({
	...props.detailLabels,
	details: step.value === 'choices' ? props.labels.title : step.value === 'confirm'
		? mode.value === 'copy' ? props.labels.confirmCopy : props.labels.confirmMove
		: mode.value === 'copy' ? props.labels.chooseCopy : props.labels.chooseMove,
}));

function normalizeSearch(value: string): string { return value.normalize('NFKC').toLocaleLowerCase(); }

const filteredEvents = computed(() => {
	const words = normalizeSearch(query.value).trim().split(/\s+/u).filter(Boolean);
	return eligibleEvents.value.filter(event => {
		const text = normalizeSearch(`${event.title} ${event.dateLabel} ${event.targetLabel}`);
		return words.every(word => text.includes(word));
	});
});
const visibleEvents = computed(() => filteredEvents.value.slice(0, visibleCount.value));
let focusCycle = 0;

function focusAfterUpdate(target: () => HTMLElement | null): void {
	const cycle = ++focusCycle;
	void nextTick(() => { if (cycle === focusCycle && !blocked.value) target()?.focus({ preventScroll: true }); });
}

function reset(): void {
	focusCycle++;
	mode.value = null;
	selectedId.value = null;
	query.value = '';
	visibleCount.value = 30;
}

function createEvent(): void { if (!blocked.value) emit('create'); }

function chooseMode(value: Mode): void {
	if (blocked.value) return;
	mode.value = value;
	selectedId.value = null;
	query.value = '';
	visibleCount.value = 30;
	focusAfterUpdate(() => searchEl.value);
}

function selectEvent(id: string): void {
	if (blocked.value || !eligibleEvents.value.some(event => event.id === id)) return;
	selectedId.value = id;
	focusAfterUpdate(() => confirmEl.value);
}

function showMore(): void {
	if (blocked.value) return;
	const firstNewIndex = visibleCount.value;
	visibleCount.value += 30;
	focusAfterUpdate(() => eventsEl.value?.querySelectorAll<HTMLButtonElement>('button').item(firstNewIndex) ?? null);
}

function goBack(): void {
	if (blocked.value) return;
	if (selectedId.value != null) {
		selectedId.value = null;
		focusAfterUpdate(() => searchEl.value);
		return;
	}
	const previousMode = mode.value;
	mode.value = null;
	focusAfterUpdate(() => previousMode === 'copy' ? copyEl.value : moveEl.value);
}

function confirmSelection(): void {
	if (blocked.value || !selectedEvent.value || !mode.value) return;
	emit('confirm', selectedEvent.value.id, mode.value);
}

watch(step, async () => {
	stepMotion?.cancel();
	if (!goesMotion || !props.isOpen) return;
	const motion = captureHatagoesPageTurn(content.value);
	stepMotion = motion;
	await nextTick();
	if (props.isOpen) motion.play();
});
onBeforeUnmount(() => stepMotion?.cancel());
watch(query, () => { visibleCount.value = 30; });
watch(selectedEvent, event => {
	if (selectedId.value != null && !event) {
		selectedId.value = null;
		focusAfterUpdate(() => searchEl.value);
	}
});
watch([() => props.isOpen, () => props.targetLabel], ([isOpen, targetLabel], previous) => {
	reset();
	if (isOpen && previous[0] && previous[1] !== targetLabel) focusAfterUpdate(() => createEl.value);
}, { immediate: true });
onBeforeUnmount(() => { focusCycle++; });
</script>

<style lang="scss" module>
.content { display: grid; gap: 18px; min-width: 0; color: var(--fg); }
.destination { display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--rule); border-radius: var(--card-radius, 16px); background: var(--surface); }
.destination > i { flex: 0 0 auto; margin-top: 3px; font-size: 24px; color: var(--accent-ink, var(--accent)); }
.destination > div { display: grid; gap: 6px; min-width: 0; }
.destination span { color: var(--fg-2); font-size: .8rem; font-weight: 700; }
.destination strong { font-size: 1.05rem; line-height: 1.65; overflow-wrap: anywhere; }
.hint { color: var(--fg-2); font-size: .85rem; line-height: 1.7; overflow-wrap: anywhere; }
.question { font-weight: 700; line-height: 1.6; overflow-wrap: anywhere; }
.choices { display: grid; gap: 10px; min-width: 0; }
.choices .choice, .events .event { display: flex; align-items: center; justify-content: flex-start; width: 100%; min-width: 0; min-height: 64px; gap: 12px; padding: 14px; text-align: start; transition: border-color .16s ease, background-color .16s ease; }
.choice > i:first-child, .event > i:first-child { flex: 0 0 auto; color: var(--accent-ink, var(--accent)); font-size: 24px; }
.choice > span, .event > span { display: grid; gap: 5px; min-width: 0; flex: 1 1 auto; }
.choice strong, .event strong { font-size: .95rem; line-height: 1.6; overflow-wrap: anywhere; }
.choice small, .event small { color: var(--fg-2); font-size: .8rem; font-weight: 500; line-height: 1.65; overflow-wrap: anywhere; }
.choice > i:last-child, .event > i:last-child { flex: 0 0 auto; color: var(--fg-2); }
.search { display: grid; gap: 8px; min-width: 0; }
.search label { font-size: .85rem; font-weight: 700; }
.search > div { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 12px; border: 1px solid var(--rule); border-radius: var(--card-radius, 14px); background: var(--surface); }
.search i { flex: 0 0 auto; color: var(--fg-2); }
.search input { width: 100%; min-width: 0; min-height: 44px; padding: 10px 0; border: 0; background: transparent; color: var(--fg); font: inherit; font-size: 16px; }
.search input::placeholder { color: var(--fg-2); opacity: 1; }
.search:focus-within > div { outline: 3px solid var(--accent-ink, var(--accent)); outline-offset: 2px; }
.events { display: grid; gap: 8px; min-width: 0; padding: 0; list-style: none; }
.events li { min-width: 0; }
.emoji { flex: 0 0 auto; font-size: 26px; }
.empty { padding: 20px 12px; color: var(--fg-2); text-align: center; line-height: 1.7; overflow-wrap: anywhere; }
.more { justify-self: center; }
.selected { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.selected > i { flex: 0 0 auto; font-size: 26px; color: var(--accent-ink, var(--accent)); }
.selected h3 { min-width: 0; font-size: 1.1rem; line-height: 1.65; overflow-wrap: anywhere; }
.route { display: grid; gap: 10px; min-width: 0; }
.route > dl { min-width: 0; padding: 14px; border: 1px solid var(--rule); border-radius: var(--card-radius, 14px); background: var(--surface); }
.route dt { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--fg-2); font-size: .8rem; font-weight: 700; }
.route dd { font-weight: 700; line-height: 1.7; overflow-wrap: anywhere; }
.routeArrow { justify-self: center; color: var(--accent-ink, var(--accent)); font-size: 22px; }
.footerAction[data-primary='true'] { background: var(--accent-ink, var(--accent)); color: var(--on-accent); border-color: var(--accent-ink, var(--accent)); }
.footerAction[data-primary='true']:hover:not(:disabled) { background: var(--accent-ink, var(--accent)); filter: brightness(.95); }
.cancel { margin-left: auto; }
.error { display: flex; align-items: flex-start; gap: 9px; padding: 12px; border: 1px solid var(--MI_THEME-error); border-radius: var(--card-radius, 12px); color: var(--fg); background: var(--surface); line-height: 1.65; overflow-wrap: anywhere; }
.error > i { margin-top: 3px; flex: 0 0 auto; color: var(--MI_THEME-error); }
.content[data-motion='false'] .choice, .content[data-motion='false'] .event { transition: none; }
@container hatask-event-details (max-width: 560px) {
	.cancel { grid-column: 1 / -1; margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
	.content:not([data-hatagoes='true']) .choice, .content:not([data-hatagoes='true']) .event { transition: none; }
}
</style>
