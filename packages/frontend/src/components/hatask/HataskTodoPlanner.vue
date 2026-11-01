<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section
	ref="rootEl"
	:class="$style.root"
	data-hatask-component="todo"
	:data-embedded="embedded"
	:data-hatask-theme="theme"
	:data-view="view"
	:data-state="componentState"
	:aria-label="labels.todo"
	:aria-busy="loading"
	@keydown.esc="closeTransientUi"
>
	<div :class="$style.mobileTabShell" :data-reordering="reorderMode">
		<TransitionGroup tag="div" name="mobile-tab-order" :class="$style.mobileTabs" role="tablist" :aria-label="labels.viewSelector">
			<button
				v-for="tab in mobileOrderDraft"
				:key="tab"
				type="button"
				role="tab"
				:class="$style.mobileTab"
				:data-mobile-tab="tab"
				:data-active="isMobileTabActive(tab)"
				:data-dragging="draggedMobileTab === tab"
				:aria-selected="isMobileTabActive(tab)"
				:aria-grabbed="reorderMode ? draggedMobileTab === tab : undefined"
				:aria-label="reorderMode ? labels.reorderView(mobileTabLabel(tab)) : mobileTabLabel(tab)"
				:title="reorderMode ? labels.reorderView(mobileTabLabel(tab)) : mobileTabLabel(tab)"
				@click="activateMobileTab(tab)"
				@pointerdown="startMobileTabDrag(tab, $event)"
				@pointermove="moveMobileTabDrag($event)"
				@pointerup="finishMobileTabDrag"
				@pointercancel="cancelMobileTabDrag"
				@keydown.left.prevent="moveMobileTabWithKeyboard(tab, -1)"
				@keydown.right.prevent="moveMobileTabWithKeyboard(tab, 1)"
			>
				<i :class="mobileTabIcon(tab)" aria-hidden="true"></i>
				<span v-if="reorderMode || isMobileTabActive(tab)">{{ mobileTabLabel(tab) }}</span>
			</button>
		</TransitionGroup>
		<div v-if="reorderMode" :class="$style.mobileTabEditor" data-mobile-tab-editor role="group" :aria-label="labels.customizeViews">
			<p :class="$style.mobileTabHint">{{ labels.customizeViewsHint }}</p>
			<div v-for="option in viewOptions" :key="option.id" :class="$style.mobileTabEditorRow">
				<button type="button" :class="$style.mobileTabChoice" :data-tab-choice="option.id" :aria-pressed="directMobileViews.has(option.id)" :aria-label="directMobileViews.has(option.id) ? labels.hideView(labels.views[option.id]) : labels.showView(labels.views[option.id])" :disabled="!directMobileViews.has(option.id) && mobileTabLimitReached" @click="toggleMobileView(option.id)">
					<i :class="option.icon" aria-hidden="true"></i><span>{{ labels.views[option.id] }}</span><i :class="directMobileViews.has(option.id) ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i>
				</button>
			</div>
		</div>
	</div>

	<header :class="$style.commandBar">
		<label :class="$style.search">
			<span :class="$style.srOnly">{{ labels.search }}</span>
			<i class="ti ti-search" aria-hidden="true"></i>
			<input type="search" :value="searchQuery" :placeholder="labels.searchPlaceholder" :aria-label="labels.search" @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)">
		</label>

		<button type="button" :class="$style.reorderTabsButton" :data-active="reorderMode" :aria-pressed="reorderMode" :aria-label="labels.reorderViews" :title="labels.reorderViews" @click="toggleReorderMode">
			<i :class="reorderMode ? 'ti ti-check' : 'ti ti-arrows-move-horizontal'" aria-hidden="true"></i>
		</button>
		<div :class="$style.sortControl">
			<button type="button" :class="$style.iconButton" :data-active="sortOpen" :aria-label="`${labels.sort}: ${labels.sortOptions[sort]}`" :title="`${labels.sort}: ${labels.sortOptions[sort]}`" :aria-expanded="sortOpen" aria-haspopup="menu" @click="openSortMenu">
				<i :class="sortIcon" aria-hidden="true"></i><span :class="$style.sortBadge"><i class="ti ti-chevron-down" aria-hidden="true"></i></span>
			</button>
		</div>
	</header>
	<div v-if="embedded" ref="inlineCaptureTarget" data-hatagoes-inline-capture="todo"></div>

	<p v-if="readOnly" :class="$style.notice"><i class="ti ti-lock" aria-hidden="true"></i><span>{{ labels.readOnly }}</span></p>

	<div :class="$style.workspace">
		<aside :class="$style.desktopRail" :aria-label="labels.viewSelector"><OrganizerContents/></aside>

		<main :class="$style.content">
			<Transition :name="viewTransitionName" mode="out-in">
				<div :key="view" :class="$style.viewPanel">
					<header :class="$style.contentHeader">
						<div><span :class="$style.eyebrow">{{ labels.todo }}</span><h2><i :class="currentViewOption.icon" aria-hidden="true"></i>{{ labels.views[view] }}</h2></div>
						<span :class="$style.totalCount">{{ items.length }}</span>
					</header>

					<div v-if="loading" :class="$style.state"><i class="ti ti-loader-2" :class="$style.loadingIcon" aria-hidden="true"></i><span>{{ labels.loading }}</span></div>

					<div v-else-if="view === 'templates'" :class="$style.templateLibrary">
						<slot name="templates"/>
					</div>

					<TransitionGroup v-else-if="items.length > 0" tag="ul" name="todo-row" :class="$style.list">
						<li
							v-for="(item, index) in items"
							:key="item.id"
							:class="$style.item"
							:data-todo-id="item.id"
							:data-done="item.done"
							:data-priority="item.priority"
							:data-archived="item.archivedAt != null"
							:data-selected="selectedIds.includes(item.id)"
							:data-completing="completionIds.includes(item.id)"
							:draggable="!readOnly"
							@click="onItemClick(item, index, $event)"
							@pointerdown="onItemPointerDown(item, index, $event)"
							@pointerup="cancelLongPress"
							@pointercancel="cancelLongPress"
							@pointermove="onPointerMove"
							@dragstart="onTodoDragStart(item, $event)"
							@dragend="draggingIds = []"
						>
							<div v-if="selectionMode" :class="$style.selectionCell" aria-hidden="true"><i :class="selectedIds.includes(item.id) ? 'ti ti-circle-check-filled' : 'ti ti-circle'"></i></div>
							<div :class="$style.completeCell">
								<label :class="$style.checkLabel">
									<input type="checkbox" :checked="item.done" :disabled="readOnly || selectionMode" :aria-label="item.done ? labels.reopenTask(item.text) : labels.completeTask(item.text)" @change="emit('complete', item, ($event.target as HTMLInputElement).checked)">
									<span :class="$style.checkVisual"><i class="ti ti-check" aria-hidden="true"></i></span>
								</label>
							</div>

							<div :class="$style.itemContent">
								<div :class="$style.titleRow">
									<span :class="$style.itemTitle">{{ item.text }}</span>
									<span v-if="item.priority !== 'none'" :class="$style.priority" :data-priority="item.priority" :title="labels.priorities[item.priority]"><i class="ti ti-flag-filled" aria-hidden="true"></i></span>
								</div>
								<div v-if="hasMeta(item)" :class="$style.meta">
									<span v-if="item.dueLabel" :class="$style.metaChip"><i class="ti ti-calendar-event" aria-hidden="true"></i><span>{{ item.dueLabel }}</span></span>
									<span v-if="item.folderLabel" :class="$style.metaChip"><i class="ti ti-folder" aria-hidden="true"></i><span>{{ item.folderLabel }}</span></span>
									<span v-if="item.recurrenceLabel" :class="$style.metaChip"><i class="ti ti-repeat" aria-hidden="true"></i><span>{{ item.recurrenceLabel }}</span></span>
									<span v-if="item.archivedLabel" :class="$style.metaChip"><i class="ti ti-archive" aria-hidden="true"></i><span>{{ item.archivedLabel }}</span></span>
								</div>
								<p v-if="item.commentPreview || item.comment" :class="$style.comment">{{ item.commentPreview ?? item.comment }}</p>
								<div v-if="item.subtasks?.length" :class="$style.subtasks"><span>{{ labels.subtaskProgress(completedSubtasks(item), item.subtasks.length) }}</span><progress :value="completedSubtasks(item)" :max="item.subtasks.length"></progress></div>
							</div>

							<div :class="$style.actions" role="group" :aria-label="item.text">
								<button type="button" :disabled="readOnly" :aria-label="labels.editTask(item.text)" :title="labels.editTask(item.text)" @click.stop="emit('edit', item)"><i class="ti ti-pencil" aria-hidden="true"></i></button>
								<button type="button" :disabled="readOnly" :aria-label="item.archivedAt ? labels.restoreTask(item.text) : labels.archiveTask(item.text)" :title="item.archivedAt ? labels.restoreTask(item.text) : labels.archiveTask(item.text)" @click.stop="item.archivedAt ? emit('restore', item) : emit('archive', item)"><i :class="item.archivedAt ? 'ti ti-archive-off' : 'ti ti-archive'" aria-hidden="true"></i></button>
								<button type="button" :class="$style.moreAction" :aria-label="labels.moreActions(item.text)" :title="labels.moreActions(item.text)" @click.stop="toggleItemMenu(item.id)"><i class="ti ti-dots" aria-hidden="true"></i></button>
								<div v-if="itemMenuId === item.id" :class="$style.itemMenu">
									<button type="button" :disabled="!canMoveUp(item, index)" :aria-label="labels.moveUp(item.text)" @click="emit('move-up', item, index); itemMenuId = null"><i class="ti ti-arrow-up" aria-hidden="true"></i>{{ labels.moveUp(item.text) }}</button>
									<button type="button" :disabled="!canMoveDown(item, index)" :aria-label="labels.moveDown(item.text)" @click="emit('move-down', item, index); itemMenuId = null"><i class="ti ti-arrow-down" aria-hidden="true"></i>{{ labels.moveDown(item.text) }}</button>
									<button type="button" :disabled="readOnly" :class="$style.danger" :aria-label="labels.deleteTask(item.text)" @click="emit('delete', item); itemMenuId = null"><i class="ti ti-trash" aria-hidden="true"></i>{{ labels.deleteTask(item.text) }}</button>
								</div>
							</div>
						</li>
					</TransitionGroup>

					<div v-else :class="$style.state"><i class="ti ti-circle-check" aria-hidden="true"></i><span>{{ labels.empty }}</span></div>
				</div>
			</Transition>
		</main>
	</div>

	<Transition name="selection-dock">
		<div v-if="selectionMode" :class="$style.selectionDock" role="toolbar" :aria-label="labels.selectedCount(selectedIds.length)">
			<strong>{{ labels.selectedCount(selectedIds.length) }}</strong>
			<button type="button" :disabled="selectedIds.length === 0" :aria-label="labels.bulkComplete" :title="labels.bulkComplete" @click="bulk('complete')"><i class="ti ti-checks" aria-hidden="true"></i><span>{{ labels.bulkComplete }}</span></button>
			<button type="button" :disabled="selectedIds.length === 0" :aria-label="labels.bulkMove" :title="labels.bulkMove" @click="bulk('move')"><i class="ti ti-folder-symlink" aria-hidden="true"></i><span>{{ labels.bulkMove }}</span></button>
			<button type="button" :disabled="selectedIds.length === 0" :aria-label="labels.bulkDue" :title="labels.bulkDue" @click="bulk('due')"><i class="ti ti-calendar-event" aria-hidden="true"></i><span>{{ labels.bulkDue }}</span></button>
			<button type="button" :disabled="selectedIds.length === 0" :aria-label="labels.bulkPriority" :title="labels.bulkPriority" @click="bulk('priority')"><i class="ti ti-flag" aria-hidden="true"></i><span>{{ labels.bulkPriority }}</span></button>
			<button type="button" :disabled="selectedIds.length === 0" :aria-label="labels.bulkArchive" :title="labels.bulkArchive" @click="bulk('archive')"><i class="ti ti-archive" aria-hidden="true"></i><span>{{ labels.bulkArchive }}</span></button>
			<button type="button" :aria-label="labels.clearSelection" :title="labels.clearSelection" @click="clearSelection"><i class="ti ti-x" aria-hidden="true"></i></button>
		</div>
	</Transition>

	<Teleport to="body">
		<Transition name="organizer-sheet">
			<div v-if="railOpen" :class="$style.mobileOrganizerOverlay" :data-compact="compactLayout" :data-hatask-theme="theme" :data-hatask-mode="colorMode" @click.self="railOpen = false" @keydown.esc.stop="railOpen = false">
				<aside id="hatask-todo-mobile-organizer" :class="$style.mobileOrganizer" role="dialog" aria-modal="true" :aria-label="labels.viewSelector">
					<div :class="$style.sheetHandle" aria-hidden="true"></div>
					<header><strong>{{ labels.viewSelector }}</strong><button type="button" :aria-label="labels.clearSelection" @click="railOpen = false"><i class="ti ti-x" aria-hidden="true"></i></button></header>
					<OrganizerContents compact/>
				</aside>
			</div>
		</Transition>
	</Teleport>
</section>
</template>

<script lang="ts" setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HataskPlannerFilter, HataskPlannerTheme, HataskTodoItem, HataskTodoLabels, HataskTodoMobileTab, HataskTodoSort, HataskTodoView } from './hatask-planner-types.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { HATASK_TODO_DEFAULT_MOBILE_TABS, HATASK_TODO_MAX_MOBILE_TABS, normalizeHataskTodoMobileTabs } from '@/utility/hatask-todo-tabs.js';

const props = withDefaults(defineProps<{
	theme?: HataskPlannerTheme;
	colorMode?: 'light' | 'dark';
	view: HataskTodoView;
	items: HataskTodoItem[];
	labels: HataskTodoLabels;
	filters?: HataskPlannerFilter[];
	searchQuery?: string;
	viewCounts?: Partial<Record<HataskTodoView, number>>;
	mobileTabOrder?: HataskTodoMobileTab[];
	sort?: HataskTodoSort;
	completionIds?: string[];
	loading?: boolean;
	readOnly?: boolean;
	embedded?: boolean;
}>(), { theme: undefined, colorMode: undefined, filters: () => [], searchQuery: '', viewCounts: undefined, mobileTabOrder: () => [...HATASK_TODO_DEFAULT_MOBILE_TABS], sort: 'manual', completionIds: () => [], loading: false, readOnly: false, embedded: false });

const emit = defineEmits<{
	(ev: 'update:view', view: HataskTodoView): void;
	(ev: 'update:searchQuery', value: string): void;
	(ev: 'update:sort', value: HataskTodoSort): void;
	(ev: 'update:mobileTabOrder', value: HataskTodoMobileTab[]): void;
	(ev: 'toggle-filter', filterId: string): void;
	(ev: 'complete', item: HataskTodoItem, done: boolean): void;
	(ev: 'move-up', item: HataskTodoItem, index: number): void;
	(ev: 'move-down', item: HataskTodoItem, index: number): void;
	(ev: 'edit', item: HataskTodoItem): void;
	(ev: 'archive', item: HataskTodoItem): void;
	(ev: 'restore', item: HataskTodoItem): void;
	(ev: 'delete', item: HataskTodoItem): void;
	(ev: 'add-folder'): void;
	(ev: 'manage-folder', filterId: string): void;
	(ev: 'drop-target', itemIds: string[], targetId: string): void;
	(ev: 'bulk-action', action: 'complete' | 'move' | 'due' | 'priority' | 'archive', itemIds: string[]): void;
	(ev: 'captureTarget', target: HTMLElement | undefined): void;
}>();

const popupMenu = useHataGoesPopupMenu();
const inlineCaptureTarget = ref<HTMLElement | null>(null);
watch(inlineCaptureTarget, target => emit('captureTarget', target ?? undefined), { flush: 'post' });

const viewOptions: Array<{ id: HataskTodoView; icon: string; acceptsDrop: boolean }> = [
	{ id: 'today', icon: 'ti ti-calendar-event', acceptsDrop: true }, { id: 'upcoming', icon: 'ti ti-calendar-time', acceptsDrop: true },
	{ id: 'overdue', icon: 'ti ti-clock-exclamation', acceptsDrop: false },
	{ id: 'priority', icon: 'ti ti-flag', acceptsDrop: true }, { id: 'all', icon: 'ti ti-list-check', acceptsDrop: false },
	{ id: 'completed', icon: 'ti ti-circle-check', acceptsDrop: true }, { id: 'templates', icon: 'ti ti-template', acceptsDrop: true },
];
const sortOptions: Array<{ id: HataskTodoSort; icon: string }> = [
	{ id: 'manual', icon: 'ti ti-grip-vertical' }, { id: 'dueAsc', icon: 'ti ti-calendar-event' },
	{ id: 'priority', icon: 'ti ti-flag' }, { id: 'createdDesc', icon: 'ti ti-clock' },
];

const componentState = computed(() => props.loading ? 'loading' : props.readOnly ? 'read-only' : props.items.length === 0 ? 'empty' : 'ready');
const currentViewOption = computed(() => viewOptions.find(option => option.id === props.view) ?? viewOptions[0]);
const sortIcon = computed(() => sortOptions.find(option => option.id === props.sort)?.icon ?? 'ti ti-arrows-sort');
const folderFilters = computed(() => props.filters.filter(filter => filter.kind === 'folder' || filter.id.startsWith('folder:')));
const railOpen = ref(false); const sortOpen = ref(false); const itemMenuId = ref<string | null>(null);
const mobileOrderDraft = ref<HataskTodoMobileTab[]>([...HATASK_TODO_DEFAULT_MOBILE_TABS]);
const directMobileViews = computed(() => new Set<HataskTodoView>(mobileOrderDraft.value.filter((tab): tab is HataskTodoView => tab !== 'more')));
const mobileTabLimitReached = computed(() => mobileOrderDraft.value.length >= HATASK_TODO_MAX_MOBILE_TABS);
const reorderMode = ref(false); const draggedMobileTab = ref<HataskTodoMobileTab | null>(null);
const viewDirection = ref<'forward' | 'back'>('forward');
const viewTransitionName = computed(() => viewDirection.value === 'forward' ? 'todo-view-forward' : 'todo-view-back');
const selectedIds = ref<string[]>([]); const draggingIds = ref<string[]>([]); const selectionMode = computed(() => selectedIds.value.length > 0);
const rootEl = ref<HTMLElement | null>(null); const compactLayout = ref(false);
let layoutObserver: ResizeObserver | null = null;
let longPressTimer: number | null = null; let suppressClickTimer: number | null = null; let suppressClickId: string | null = null; let pointerOrigin: { x: number; y: number } | null = null; let selectionAnchor = -1;
let mobileTabDragMoved = false; let suppressMobileTabActivation = false;
let mobileTabDragStartOrder: HataskTodoMobileTab[] | null = null;

watch(() => props.mobileTabOrder, order => {
	cancelMobileTabDrag();
	mobileOrderDraft.value = normalizeHataskTodoMobileTabs(order);
}, { deep: true, immediate: true });

const OrganizerContents = defineComponent({
	name: 'OrganizerContents',
	props: { compact: { type: Boolean, default: false } },
	setup(componentProps) {
		return () => h('div', { class: 'hatask-organizer-contents' }, [
			h('nav', { class: 'hatask-smart-views', 'aria-label': props.labels.viewSelector }, viewOptions.filter(option => !componentProps.compact || !directMobileViews.value.has(option.id)).map(option => h('button', {
				type: 'button', class: 'hatask-organizer-row', 'data-active': props.view === option.id,
				'data-drop-active': option.acceptsDrop && draggingIds.value.length > 0, 'aria-current': props.view === option.id ? 'page' : undefined,
				'aria-label': props.labels.views[option.id],
				onClick: () => selectView(option.id), onDragover: (event: DragEvent) => { if (option.acceptsDrop) event.preventDefault(); },
				onDrop: (event: DragEvent) => dropOnTarget(option.id, event),
			}, [h('i', { class: option.icon, 'aria-hidden': 'true' }), h('span', props.labels.views[option.id]), h('b', { class: 'hatask-organizer-count' }, String(props.viewCounts?.[option.id] ?? 0))]))),
			h('div', { class: 'hatask-folder-heading' }, [h('span', props.labels.folders), h('i', { class: 'ti ti-folders', 'aria-hidden': 'true' })]),
			h('div', { class: 'hatask-folder-list' }, folderFilters.value.map(filter => h('div', {
				class: 'hatask-folder-row-wrap', style: { '--hatask-folder-color': filter.color ?? 'var(--accent)' },
				onDragover: (event: DragEvent) => event.preventDefault(), onDrop: (event: DragEvent) => dropOnTarget(filter.id, event),
			}, [
				h('button', { type: 'button', class: 'hatask-organizer-row hatask-folder-row', 'data-active': filter.active, 'data-fullness': folderFullness(filter.count ?? 0), 'aria-label': filter.label, 'aria-pressed': filter.active, onClick: () => { emit('toggle-filter', filter.id); railOpen.value = false; } }, [
					h('span', { class: 'hatask-folder-glyph', 'aria-hidden': 'true' }, [h('i', { class: 'ti ti-folder-filled' }), h('span', { class: 'hatask-folder-paper p1' }), h('span', { class: 'hatask-folder-paper p2' }), h('span', { class: 'hatask-folder-paper p3' })]),
					h('span', filter.label), h('b', { class: 'hatask-organizer-count' }, String(filter.count ?? 0)),
				]),
				h('button', { type: 'button', class: 'hatask-folder-more', 'aria-label': props.labels.manageFolder(filter.label), onClick: () => { railOpen.value = false; emit('manage-folder', filter.id); } }, [h('i', { class: 'ti ti-dots', 'aria-hidden': 'true' })]),
			]))),
			h('button', { type: 'button', class: 'hatask-add-folder', disabled: props.readOnly, 'aria-label': props.labels.addFolder, onClick: () => { railOpen.value = false; emit('add-folder'); } }, [h('i', { class: 'ti ti-folder-plus', 'aria-hidden': 'true' }), h('span', props.labels.addFolder)]),
		]);
	},
});

function folderFullness(count: number): 'empty' | 'light' | 'busy' | 'full' { return count === 0 ? 'empty' : count < 5 ? 'light' : count < 15 ? 'busy' : 'full'; }

function viewPosition(view: HataskTodoView): number {
	const mobilePosition = mobileOrderDraft.value.indexOf(view as HataskTodoMobileTab);
	return mobilePosition >= 0 ? mobilePosition : mobileOrderDraft.value.indexOf('more') + viewOptions.findIndex(option => option.id === view) / 10;
}

function selectView(next: HataskTodoView): void {
	viewDirection.value = viewPosition(next) >= viewPosition(props.view) ? 'forward' : 'back';
	emit('update:view', next);
	railOpen.value = false;
}

function selectSort(next: HataskTodoSort): void { emit('update:sort', next); sortOpen.value = false; }

async function openSortMenu(event: MouseEvent): Promise<void> {
	if (sortOpen.value) return;
	sortOpen.value = true;
	try {
		await popupMenu(sortOptions.map(option => ({
			type: 'radioOption' as const,
			text: props.labels.sortOptions[option.id],
			active: props.sort === option.id,
			action: () => selectSort(option.id),
		})), event.currentTarget, { motionPreset: 'postform', onClosing: () => { sortOpen.value = false; } });
	} finally {
		sortOpen.value = false;
	}
}

function mobileTabLabel(tab: HataskTodoMobileTab): string { return tab === 'more' ? props.labels.moreViews : props.labels.views[tab]; }

function mobileTabIcon(tab: HataskTodoMobileTab): string { return tab === 'more' ? 'ti ti-dots' : viewOptions.find(option => option.id === tab)?.icon ?? 'ti ti-circle'; }

function isMobileTabActive(tab: HataskTodoMobileTab): boolean { return tab === 'more' ? !directMobileViews.value.has(props.view) : props.view === tab; }

function activateMobileTab(tab: HataskTodoMobileTab): void {
	if (suppressMobileTabActivation) { suppressMobileTabActivation = false; return; }
	if (reorderMode.value) return;
	if (tab === 'more') { railOpen.value = true; return; }
	selectView(tab);
}

function toggleReorderMode(): void {
	reorderMode.value = !reorderMode.value;
	if (!reorderMode.value) cancelMobileTabDrag();
}

function toggleMobileView(view: HataskTodoView): void {
	if (!reorderMode.value) return;
	cancelMobileTabDrag();
	const next = [...mobileOrderDraft.value];
	const index = next.indexOf(view);
	if (index >= 0) next.splice(index, 1);
	else {
		if (mobileTabLimitReached.value) return;
		next.splice(next.indexOf('more'), 0, view);
	}
	mobileOrderDraft.value = normalizeHataskTodoMobileTabs(next);
	// Hiding a selected shortcut does not change the open view or task data;
	// the More tab becomes active and still gives access to that view.
	emit('update:mobileTabOrder', [...mobileOrderDraft.value]);
}

function moveMobileTab(tab: HataskTodoMobileTab, target: HataskTodoMobileTab): boolean {
	if (tab === target) return false;
	const next = [...mobileOrderDraft.value];
	const from = next.indexOf(tab); const to = next.indexOf(target);
	if (from < 0 || to < 0) return false;
	next.splice(from, 1); next.splice(to, 0, tab); mobileOrderDraft.value = next;
	return true;
}

function startMobileTabDrag(tab: HataskTodoMobileTab, event: PointerEvent): void {
	if (!reorderMode.value) return;
	event.preventDefault();
	mobileTabDragStartOrder = [...mobileOrderDraft.value];
	draggedMobileTab.value = tab; mobileTabDragMoved = false;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveMobileTabDrag(event: PointerEvent): void {
	if (!reorderMode.value || draggedMobileTab.value == null) return;
	event.preventDefault();
	const targetElement = window.document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-mobile-tab]');
	if (!targetElement || !rootEl.value?.contains(targetElement)) return;
	const target = targetElement.dataset.mobileTab as HataskTodoMobileTab | undefined;
	if (target != null && moveMobileTab(draggedMobileTab.value, target)) mobileTabDragMoved = true;
}

function finishMobileTabDrag(): void {
	if (draggedMobileTab.value == null) return;
	if (mobileTabDragMoved) { emit('update:mobileTabOrder', [...mobileOrderDraft.value]); suppressMobileTabActivation = true; }
	draggedMobileTab.value = null; mobileTabDragMoved = false; mobileTabDragStartOrder = null;
}

function cancelMobileTabDrag(): void {
	if (mobileTabDragStartOrder) mobileOrderDraft.value = mobileTabDragStartOrder;
	draggedMobileTab.value = null; mobileTabDragMoved = false; mobileTabDragStartOrder = null;
}

function moveMobileTabWithKeyboard(tab: HataskTodoMobileTab, direction: -1 | 1): void {
	if (!reorderMode.value) return;
	const current = mobileOrderDraft.value.indexOf(tab); const targetIndex = current + direction;
	if (targetIndex < 0 || targetIndex >= mobileOrderDraft.value.length) return;
	const target = mobileOrderDraft.value[targetIndex];
	if (!moveMobileTab(tab, target)) return;
	emit('update:mobileTabOrder', [...mobileOrderDraft.value]);
}

function completedSubtasks(item: HataskTodoItem): number { return item.subtasks?.reduce((count, subtask) => count + Number(subtask.done), 0) ?? 0; }

function hasMeta(item: HataskTodoItem): boolean { return [item.dueLabel, item.folderLabel, item.recurrenceLabel, item.archivedLabel].some(Boolean); }

function canMoveUp(item: HataskTodoItem, index: number): boolean { return !props.readOnly && props.sort === 'manual' && (item.canMoveUp ?? index > 0); }

function canMoveDown(item: HataskTodoItem, index: number): boolean { return !props.readOnly && props.sort === 'manual' && (item.canMoveDown ?? index < props.items.length - 1); }

function toggleItemMenu(id: string): void { itemMenuId.value = itemMenuId.value === id ? null : id; }

function onItemClick(item: HataskTodoItem, index: number, event: MouseEvent): void {
	if (suppressClickId === item.id) {
		suppressClickId = null;
		if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
		suppressClickTimer = null;
		return;
	}
	if ((event.target as HTMLElement).closest('button,input,label,a')) return;
	if (!selectionMode.value && !event.shiftKey && !event.metaKey && !event.ctrlKey) return;
	if (event.shiftKey && selectionAnchor >= 0) { const [start, end] = [selectionAnchor, index].sort((a, b) => a - b); selectedIds.value = [...new Set([...selectedIds.value, ...props.items.slice(start, end + 1).map(candidate => candidate.id)])]; } else toggleSelected(item.id);
	selectionAnchor = index;
}

function toggleSelected(id: string): void { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(candidate => candidate !== id) : [...selectedIds.value, id]; }

function onItemPointerDown(item: HataskTodoItem, index: number, event: PointerEvent): void {
	if (event.pointerType === 'mouse' || props.readOnly || (event.target as HTMLElement).closest('button,input,label,a')) return;
	cancelLongPress();
	pointerOrigin = { x: event.clientX, y: event.clientY };
	longPressTimer = window.setTimeout(() => {
		toggleSelected(item.id);
		selectionAnchor = index;
		longPressTimer = null;
		suppressClickId = item.id;
		if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
		suppressClickTimer = window.setTimeout(() => { suppressClickId = null; suppressClickTimer = null; }, 700);
	}, 360);
}

function onPointerMove(event: PointerEvent): void { if (pointerOrigin != null && Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) >= 8) cancelLongPress(); }

function cancelLongPress(): void { if (longPressTimer != null) window.clearTimeout(longPressTimer); longPressTimer = null; pointerOrigin = null; }

function clearSelection(): void { selectedIds.value = []; selectionAnchor = -1; }

function bulk(action: 'complete' | 'move' | 'due' | 'priority' | 'archive'): void { emit('bulk-action', action, [...selectedIds.value]); if (action !== 'move' && action !== 'due' && action !== 'priority') clearSelection(); }

function onTodoDragStart(item: HataskTodoItem, event: DragEvent): void { const ids = selectedIds.value.includes(item.id) ? [...selectedIds.value] : [item.id]; draggingIds.value = ids; event.dataTransfer?.setData('application/x-hatask-todo-ids', JSON.stringify(ids)); if (event.dataTransfer != null) event.dataTransfer.effectAllowed = 'move'; }

function dropOnTarget(targetId: string, event: DragEvent): void {
	event.preventDefault();
	let ids = draggingIds.value;
	try {
		const parsed = JSON.parse(event.dataTransfer?.getData('application/x-hatask-todo-ids') ?? '[]');
		if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === 'string');
	} catch {
		// Keep the IDs from the active drag when another app supplies malformed data.
	}
	if (ids.length > 0) emit('drop-target', ids, targetId);
	draggingIds.value = [];
}

function closeTransientUi(): void { railOpen.value = false; sortOpen.value = false; itemMenuId.value = null; reorderMode.value = false; cancelMobileTabDrag(); if (selectionMode.value) clearSelection(); }

onMounted(() => {
	const updateLayout = (width: number) => {
		compactLayout.value = width <= 760;
		if (!compactLayout.value && reorderMode.value) { reorderMode.value = false; cancelMobileTabDrag(); }
	};
	if (rootEl.value != null && typeof ResizeObserver !== 'undefined') {
		layoutObserver = new ResizeObserver(entries => updateLayout(entries[0].contentRect.width));
		layoutObserver.observe(rootEl.value);
		updateLayout(rootEl.value.clientWidth);
	} else {
		updateLayout(window.innerWidth);
	}
});
onBeforeUnmount(() => {
	cancelLongPress();
	layoutObserver?.disconnect();
	if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
});
</script>

<style lang="scss" module>
.root{container-type:inline-size;color:var(--fg);font-family:var(--htk-font-body,inherit);line-break:strict;overflow-wrap:anywhere}.commandBar{position:relative;z-index:5;display:flex;align-items:center;gap:10px;margin-bottom:14px}.search{min-width:0;flex:1;min-height:46px;display:flex;align-items:center;gap:8px;padding:0 14px;border:1px solid var(--rule);border-radius:999px;background:color-mix(in srgb,var(--surface) 88%,transparent);color:var(--fg-3)}.search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--fg);font:inherit;font-size:max(16px,.8rem)}.iconButton, .mobileViewButton{min-height:44px;border:1px solid var(--rule);background:var(--surface);color:var(--fg);cursor:pointer}.iconButton{position:relative;width:44px;border-radius:50%;font-size:1rem}.iconButton[data-active=true]{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,var(--rule))}.sortBadge{position:absolute;right:-1px;bottom:-1px;width:17px;height:17px;display:grid;place-items:center;border:2px solid var(--surface);border-radius:50%;background:var(--accent);color:var(--on-accent,#fff);font-size:.48rem}.sortControl{position:relative;flex:none}.itemMenu{position:absolute;z-index:20;padding:6px;border:1px solid var(--rule);border-radius:16px;background:var(--surface);box-shadow:0 18px 48px -22px rgba(0,0,0,.5)}.itemMenu button{width:100%;min-height:42px;display:grid;grid-template-columns:24px minmax(0,1fr) 20px;align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:10px;background:transparent;color:var(--fg);font:inherit;font-size:.76rem;text-align:start;cursor:pointer}.workspace{display:grid;grid-template-columns:minmax(190px,230px) minmax(0,1fr);gap:16px;align-items:start}.desktopRail, .content{border:var(--card-border,1px solid var(--rule));background:var(--surface);box-shadow:var(--card-shadow,none)}.desktopRail{position:sticky;top:12px;padding:10px;border-radius:var(--card-radius,20px)}.content{min-width:0;padding:16px;border-radius:var(--card-radius,20px)}.contentHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 3px 12px;border-bottom:1px solid var(--rule)}.contentHeader h2{display:flex;align-items:center;gap:8px;margin:2px 0 0;font-family:var(--htk-font-head,inherit);font-size:1.05rem}.contentHeader h2 i{color:var(--accent)}.eyebrow{color:var(--fg-3);font-size:.62rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.totalCount, .commandCount{display:grid;place-items:center;min-width:28px;min-height:24px;padding:2px 7px;border-radius:999px;background:var(--fill-2);color:var(--fg-2);font-size:.7rem;font-weight:850}.mobileViewButton{display:none;align-items:center;gap:8px;padding:0 12px;border-radius:999px;font:inherit;font-weight:800;white-space:nowrap}.list{display:grid;gap:8px;margin:12px 0 0;padding:0;list-style:none}.item{position:relative;min-width:0;display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 8px 8px 5px;border:1px solid var(--rule);border-radius:15px;background:color-mix(in srgb,var(--surface) 96%,var(--fill));box-shadow:0 5px 18px -18px rgba(0,0,0,.7);transition:transform .24s var(--ease-smooth,ease),opacity .2s ease,border-color .18s ease,box-shadow .2s ease}.item:hover{border-color:color-mix(in srgb,var(--accent) 24%,var(--rule));box-shadow:0 10px 22px -20px color-mix(in srgb,var(--accent) 55%,#000)}.item[data-selected=true]{grid-template-columns:36px 46px minmax(0,1fr) auto;border-color:color-mix(in srgb,var(--accent) 48%,var(--rule));background:color-mix(in srgb,var(--accent) 7%,var(--surface))}.selectionCell{display:grid;place-items:center;color:var(--accent);font-size:1.15rem}.completeCell, .checkLabel{width:44px;height:44px;display:grid;place-items:center}.checkLabel{position:relative;cursor:pointer}.checkLabel input{position:absolute;opacity:0;pointer-events:none}.checkVisual{width:25px;height:25px;display:grid;place-items:center;border:2px solid color-mix(in srgb,var(--fg-3) 65%,transparent);border-radius:50%;color:transparent;transition:transform .2s var(--ease-spring,ease),background .2s ease,border-color .2s ease,color .18s ease}.checkLabel:active .checkVisual{transform:scale(.82)}.checkLabel input:checked+.checkVisual, .item[data-completing=true] .checkVisual{border-color:var(--accent);background:var(--accent);color:var(--on-accent,#fff)}.checkLabel input:focus-visible+.checkVisual{outline:2px solid var(--accent);outline-offset:3px}.itemContent{min-width:0;display:grid;gap:6px;padding:4px 0}.titleRow, .meta, .subtasks, .actions{display:flex;align-items:center}.titleRow{min-width:0;gap:7px}.itemTitle{min-width:0;font-size:.83rem;font-weight:780;transition:color .18s ease}.item[data-done=true] .itemTitle, .item[data-completing=true] .itemTitle{color:var(--fg-3);text-decoration:line-through;text-decoration-thickness:2px}.priority{flex:none;color:var(--accent)}.priority[data-priority=high]{color:var(--error,#d9485f)}.priority[data-priority=medium]{color:#d28a22}.meta{min-width:0;gap:5px;flex-wrap:wrap}.metaChip{max-width:100%;display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:var(--fill-2);color:var(--fg-3);font-size:.66rem;font-weight:700}.metaChip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.comment{margin:0;color:var(--fg-3);font-size:.7rem;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.subtasks{gap:8px;color:var(--fg-3);font-size:.64rem;font-weight:700}.subtasks progress{width:min(160px,38%);height:5px;accent-color:var(--accent)}.actions{position:relative;gap:2px}.actions>button, .mobileOrganizer header button, .selectionDock button{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--fg-2);cursor:pointer}.actions>button:hover, .actions>button:focus-visible{background:var(--fill-2);color:var(--accent)}.itemMenu{inset-inline-end:0;top:calc(100% + 4px);min-width:220px}.itemMenu .danger{color:var(--error,#d9485f)}.state, .notice{display:flex;align-items:center;justify-content:center;gap:8px}.state{min-height:180px;flex-direction:column;color:var(--fg-3);font-size:.76rem}.state>i{font-size:1.8rem;color:var(--accent)}.notice{margin:0 0 10px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--warn,#d28a22) 10%,transparent);color:var(--fg-2);font-size:.72rem}.loadingIcon{animation:plannerSpin .9s linear infinite}.templateLibrary{padding-top:12px}.selectionDock{position:sticky;z-index:15;bottom:calc(12px + env(safe-area-inset-bottom));width:fit-content;max-width:calc(100% - 24px);display:flex;align-items:center;gap:4px;margin:14px auto 0;padding:6px 8px 6px 14px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--rule));border-radius:999px;background:color-mix(in srgb,var(--surface) 92%,transparent);box-shadow:0 18px 45px -20px rgba(0,0,0,.6);backdrop-filter:blur(18px)}.selectionDock strong{margin-inline-end:4px;font-size:.72rem;white-space:nowrap}.selectionDock button{width:auto;min-width:44px;padding:0 10px;gap:5px;display:inline-flex}.selectionDock button span{font-size:.67rem;font-weight:750}.mobileOrganizerOverlay{display:none}.srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@keyframes plannerSpin{to{transform:rotate(1turn)}}
:global(.hatask-organizer-contents){display:grid;gap:8px}:global(.hatask-smart-views), :global(.hatask-folder-list){display:grid;gap:3px}:global(.hatask-organizer-row), :global(.hatask-add-folder){width:100%;min-height:44px;display:grid;grid-template-columns:25px minmax(0,1fr) auto;align-items:center;gap:9px;padding:6px 9px;border:0;border-radius:12px;background:transparent;color:var(--fg-2);font:inherit;font-size:.75rem;font-weight:740;text-align:start;cursor:pointer}:global(.hatask-organizer-row[data-active=true]){background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);box-shadow:inset 3px 0 0 var(--accent)}:global(.hatask-organizer-row[data-drop-active=true]){outline:1px dashed color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:-3px}:global(.hatask-organizer-count){min-width:23px;padding:2px 5px;border-radius:999px;background:var(--fill-2);color:var(--fg-3);font-size:.62rem;text-align:center}:global(.hatask-folder-heading){display:flex;align-items:center;justify-content:space-between;margin:7px 9px 1px;color:var(--fg-3);font-size:.64rem;font-weight:850;letter-spacing:.04em}:global(.hatask-folder-row-wrap){display:grid;grid-template-columns:minmax(0,1fr) 38px;align-items:center;border-radius:12px;transition:background .18s ease}:global(.hatask-folder-row-wrap:has(.hatask-folder-row[data-active=true])){background:color-mix(in srgb,var(--hatask-folder-color) 8%,transparent)}:global(.hatask-folder-glyph){position:relative;width:24px;height:24px;display:grid;place-items:center;color:var(--hatask-folder-color);font-size:1.25rem}:global(.hatask-folder-paper){position:absolute;left:6px;bottom:7px;width:12px;height:8px;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--hatask-folder-color) 25%,var(--surface));border:1px solid color-mix(in srgb,var(--hatask-folder-color) 60%,var(--rule));transition:transform .22s var(--ease-spring,ease),opacity .18s ease}:global(.hatask-folder-paper.p2){transform:translateY(-3px) scale(.92)}:global(.hatask-folder-paper.p3){transform:translateY(-6px) scale(.84)}:global(.hatask-folder-row[data-fullness=empty] .hatask-folder-paper), :global(.hatask-folder-row[data-fullness=light] .p2), :global(.hatask-folder-row[data-fullness=light] .p3), :global(.hatask-folder-row[data-fullness=busy] .p3){opacity:0}:global(.hatask-folder-more){width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:var(--fg-3);cursor:pointer}:global(.hatask-add-folder){margin-top:2px;color:var(--accent)}
.mobileOrganizerOverlay{position:fixed;inset:0;z-index:1000000;display:none;align-items:flex-end;justify-content:center;padding:14px 14px max(14px,env(safe-area-inset-bottom));background:rgba(0,0,0,.38);backdrop-filter:blur(5px)}.mobileOrganizerOverlay[data-compact=true]{display:flex}.mobileOrganizer{--surface:var(--MI_THEME-panel);--fg:var(--MI_THEME-fg);--fg-2:color-mix(in srgb,var(--MI_THEME-fg) 82%,transparent);--fg-3:color-mix(in srgb,var(--MI_THEME-fg) 62%,transparent);--rule:color-mix(in srgb,var(--MI_THEME-fg) 15%,transparent);--fill-2:color-mix(in srgb,var(--MI_THEME-fg) 8%,transparent);--accent:var(--MI_THEME-accent);width:min(100%,540px);max-height:min(82dvh,700px);overflow:auto;padding:8px 12px 16px;border:1px solid var(--rule);border-radius:24px;background:var(--surface);color:var(--fg);box-shadow:0 28px 70px -25px rgba(0,0,0,.75);font-family:var(--htk-font-body,inherit)}.mobileOrganizer header{display:flex;align-items:center;justify-content:space-between;min-height:46px;padding:0 4px 4px}.sheetHandle{width:42px;height:4px;margin:2px auto 4px;border-radius:99px;background:var(--rule)}
.mobileTabShell{display:none;min-width:0;align-items:center;gap:7px;margin-bottom:10px}.mobileTabs{box-sizing:border-box;min-width:0;width:100%;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:4px;border:1px solid var(--rule);border-radius:999px;background:var(--fill-2)}.mobileTab, .reorderTabsButton{min-height:44px;border:1px solid var(--rule);background:var(--surface);color:var(--fg-2);font:inherit;cursor:pointer}.mobileTab{flex:1 0 44px;box-sizing:border-box;min-width:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:999px;font-size:.72rem;font-weight:780;white-space:nowrap;scroll-snap-align:start;transition:color .18s ease,background .18s ease,border-color .18s ease,box-shadow .2s ease,transform .22s var(--ease-smooth,ease)}.mobileTab[data-active=false]{border-color:transparent;background:transparent}.mobileTab[data-active=true]{flex-grow:2;border-color:var(--accent);background:var(--accent);color:var(--on-accent,#fff);box-shadow:0 8px 18px -12px var(--accent)}.mobileTab[data-dragging=true]{z-index:2;border-color:var(--accent);box-shadow:0 12px 24px -14px rgba(0,0,0,.75);transform:scale(1.04);touch-action:none}.reorderTabsButton{flex:0 0 44px;width:44px;display:none;place-items:center;border-radius:50%;font-size:1rem}.reorderTabsButton[data-active=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent)}.mobileTabShell[data-reordering=true] .mobileTab{border-style:dashed;cursor:grab}.viewPanel{min-width:0}
.mobileTabShell[data-reordering=true] .mobileTab{touch-action:none}
.mobileTabShell[data-reordering=true]{flex-direction:column;align-items:stretch}.mobileTabEditor{display:grid;gap:5px;min-width:0;padding:10px;border:1px solid var(--rule);border-radius:var(--card-radius,20px);background:var(--surface)}.mobileTabHint{margin:0 4px 5px;color:var(--fg-3);font-size:.72rem;line-height:1.65}.mobileTabEditorRow{min-width:0}.mobileTabChoice{box-sizing:border-box;width:100%;min-height:44px;border:1px solid var(--rule);border-radius:12px;background:transparent;color:var(--fg-2);font:inherit;font-size:.74rem;cursor:pointer;touch-action:manipulation;transition:background .18s ease,color .18s ease,border-color .18s ease;min-width:0;display:grid;grid-template-columns:24px minmax(0,1fr) 20px;align-items:center;gap:7px;padding:6px 10px;text-align:start;font-weight:750}.mobileTabChoice[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 40%,var(--rule));background:color-mix(in srgb,var(--accent) 8%,var(--surface));color:var(--accent)}.mobileTabChoice:disabled{opacity:.45;cursor:not-allowed}.mobileTabChoice:not(:disabled):hover{background:var(--fill-2)}.mobileTabChoice:focus-visible, .mobileTab:focus-visible, .reorderTabsButton:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@container (max-width:760px){.mobileTabShell{display:flex}.reorderTabsButton{display:grid}.workspace{grid-template-columns:1fr}.desktopRail{display:none}.content{padding:12px}.mobileOrganizerOverlay{position:fixed;inset:0;z-index:1000000;display:flex;align-items:flex-end;justify-content:center;padding:14px 14px max(14px,env(safe-area-inset-bottom));background:rgba(0,0,0,.38);backdrop-filter:blur(5px)}.mobileOrganizer{width:min(100%,540px);max-height:min(82dvh,700px);overflow:auto;padding:8px 12px 16px;border:1px solid var(--rule);border-radius:24px;background:var(--surface);color:var(--fg);box-shadow:0 28px 70px -25px rgba(0,0,0,.75);font-family:var(--htk-font-body,inherit)}.mobileOrganizer header{display:flex;align-items:center;justify-content:space-between;min-height:46px;padding:0 4px 4px}.sheetHandle{width:42px;height:4px;margin:2px auto 4px;border-radius:99px;background:var(--rule)}}
@container (max-width:520px){.commandBar{gap:6px}.item{grid-template-columns:44px minmax(0,1fr) 44px;padding-inline:3px}.item[data-selected=true]{grid-template-columns:32px 44px minmax(0,1fr) 44px}.actions>button:not(.moreAction){display:none}.selectionDock{overflow-x:auto;justify-content:flex-start;width:calc(100% - 24px);border-radius:20px}.selectionDock button span{display:none}}
@media (max-width:760px){.mobileOrganizerOverlay{position:fixed;inset:0;z-index:1000000;display:flex;align-items:flex-end;justify-content:center;padding:14px 14px max(14px,env(safe-area-inset-bottom));background:rgba(0,0,0,.38);backdrop-filter:blur(5px)}.mobileOrganizer{--surface:var(--MI_THEME-panel);--fg:var(--MI_THEME-fg);--fg-2:color-mix(in srgb,var(--MI_THEME-fg) 82%,transparent);--fg-3:color-mix(in srgb,var(--MI_THEME-fg) 62%,transparent);--rule:color-mix(in srgb,var(--MI_THEME-fg) 15%,transparent);--fill-2:color-mix(in srgb,var(--MI_THEME-fg) 8%,transparent);--accent:var(--MI_THEME-accent);width:min(100%,540px);max-height:min(82dvh,700px);overflow:auto;padding:8px 12px 16px;border:1px solid var(--rule);border-radius:24px;background:var(--surface);color:var(--fg);box-shadow:0 28px 70px -25px rgba(0,0,0,.75);font-family:var(--htk-font-body,inherit)}.mobileOrganizer header{display:flex;align-items:center;justify-content:space-between;min-height:46px;padding:0 4px 4px}.sheetHandle{width:42px;height:4px;margin:2px auto 4px;border-radius:99px;background:var(--rule)}}
:global(.mobile-tab-order-move), :global(.mobile-tab-order-enter-active), :global(.mobile-tab-order-leave-active){transition:transform .3s var(--ease-spring,ease),opacity .18s ease}:global(.mobile-tab-order-enter-from), :global(.mobile-tab-order-leave-to){opacity:0;transform:scale(.88)}
:global(.todo-view-forward-enter-active), :global(.todo-view-forward-leave-active), :global(.todo-view-back-enter-active), :global(.todo-view-back-leave-active){transition:opacity .18s ease,transform .28s var(--ease-smooth,ease)}:global(.todo-view-forward-enter-from){opacity:0;transform:translateX(18px)}:global(.todo-view-forward-leave-to){opacity:0;transform:translateX(-12px)}:global(.todo-view-back-enter-from){opacity:0;transform:translateX(-18px)}:global(.todo-view-back-leave-to){opacity:0;transform:translateX(12px)}
:global(.todo-row-move), :global(.todo-row-enter-active), :global(.todo-row-leave-active){transition:transform .3s var(--ease-smooth,ease),opacity .22s ease}:global(.todo-row-enter-from){opacity:0;transform:translateY(-8px) scale(.985)}:global(.todo-row-leave-to){opacity:0;transform:translateX(18px) scale(.96)}:global(.todo-row-leave-active){position:absolute;width:calc(100% - 24px)}:global(.selection-dock-enter-active), :global(.selection-dock-leave-active), :global(.organizer-sheet-enter-active), :global(.organizer-sheet-leave-active), :global(.planner-popover-enter-active), :global(.planner-popover-leave-active){transition:opacity .2s ease,transform .25s var(--ease-smooth,ease)}:global(.selection-dock-enter-from), :global(.selection-dock-leave-to){opacity:0;transform:translateY(12px) scale(.97)}:global(.organizer-sheet-enter-from), :global(.organizer-sheet-leave-to){opacity:0}:global(.organizer-sheet-enter-from) .mobileOrganizer, :global(.organizer-sheet-leave-to) .mobileOrganizer{transform:translateY(24px) scale(.985)}:global(.planner-popover-enter-from), :global(.planner-popover-leave-to){opacity:0;transform:translateY(-5px) scale(.98)}
@media (prefers-reduced-motion:reduce){.root:not([data-embedded='true']){.item, .checkVisual, .mobileTab, :global(.mobile-tab-order-move), :global(.mobile-tab-order-enter-active), :global(.mobile-tab-order-leave-active), :global(.todo-view-forward-enter-active), :global(.todo-view-forward-leave-active), :global(.todo-view-back-enter-active), :global(.todo-view-back-leave-active), :global(.todo-row-move), :global(.todo-row-enter-active), :global(.todo-row-leave-active), :global(.selection-dock-enter-active), :global(.selection-dock-leave-active), :global(.organizer-sheet-enter-active), :global(.organizer-sheet-leave-active), :global(.planner-popover-enter-active), :global(.planner-popover-leave-active){transition:none!important;animation:none!important}}}
@media (prefers-reduced-motion:reduce){.root:not([data-embedded='true']){.mobileTabChoice{transition:none!important}}}
.root[data-hatask-theme] {
	--accent: var(--accent-ink);
	--fg-3: var(--fg-2);
	--card-radius: 24px;
	--card-border: 1px solid var(--rule);
	--card-shadow: var(--shadow, none);
}
.root[data-hatask-theme] .item { border-radius: 18px; box-shadow: none; }
.root[data-hatask-theme] .content { padding: 18px; }
.root[data-hatask-theme] .eyebrow, .root[data-hatask-theme] .metaChip, .root[data-hatask-theme] .subtasks, .root[data-hatask-theme] .selectionDock button span { font-size: max(11px, .7rem); }
.root[data-hatask-theme] .comment { font-size: max(12px, .75rem); }
/* 整理シートは body へ移すため、Hatask 自身の明暗を受け取る。 */
.mobileOrganizerOverlay[data-hatask-theme='akatsuki'] .mobileOrganizer {
	--surface: #fff7f2;
	--fg: #2b1f2c;
	--fg-2: #6a5566;
	--fg-3: #6a5566;
	--rule: rgba(80, 50, 70, .18);
	--fill-2: rgba(224, 86, 122, .08);
	--accent: #b02e56;
	color-scheme: light;
	border-radius: 24px;
	font-family: 'Zen Kaku Gothic New', sans-serif;
}
.mobileOrganizerOverlay[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] .mobileOrganizer {
	--surface: #1b1424;
	--fg: #f6ecf3;
	--fg-2: #c8b5c6;
	--fg-3: #c8b5c6;
	--rule: rgba(255, 255, 255, .18);
	--fill-2: rgba(255, 127, 163, .1);
	--accent: #ff7fa3;
	color-scheme: dark;
}
@container (max-width:760px) {
	.root[data-hatask-theme] .content { padding: 12px; }
}

:global(.htk-root:not([data-theme='akatsuki'])) :is(.content, .desktopRail) { border-radius: var(--card-radius); border-color: var(--rule); box-shadow: var(--shadow); }
:global(.htk-root:not([data-theme='akatsuki'])) .item { border-radius: var(--control-radius); }
.root:not([data-hatask-theme='akatsuki']) { --card-radius: inherit; --card-border: inherit; --card-shadow: inherit; --on-accent: var(--htk-on-ink); }
.mobileOrganizerOverlay[data-hatask-theme]:not([data-hatask-theme='akatsuki']) .mobileOrganizer { --surface: inherit; --fg: inherit; --fg-2: inherit; --fg-3: inherit; --rule: inherit; --fill-2: inherit; --accent: var(--accent-ink); --on-accent: var(--htk-on-ink); border-radius: var(--case-radius); box-shadow: var(--shadow); font-family: var(--htk-font-body); }
</style>
