<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section ref="rootEl" :class="$style.root" :data-deck="deck" :aria-label="i18n.ts.favorites">
	<div v-if="loadError" :class="$style.notice" role="status">
		<span>{{ copy.folderLoadFailed }}</span><button class="_button" @click="loadFolders">{{ copy.retry }}</button>
	</div>
	<div :class="$style.workspace">
		<aside :class="$style.sidebar" :aria-label="copy.tabs">
			<button v-for="tab in baseTabs" :key="tab.id" class="_button" :class="$style.sidebarTab" :data-active="selected === tab.id" :aria-current="selected === tab.id ? 'page' : undefined" @click="select(tab.id)">
				<i :class="tab.icon" aria-hidden="true"></i><span>{{ tab.label }}</span><small>{{ tab.count }}</small>
			</button>
			<div :class="$style.folderHeading"><span>{{ copy.folders }} {{ state.folders.length }} / {{ state.folderLimit }}</span><button v-if="canCreateFavoriteFolder()" class="_button" :class="$style.iconButton" :aria-label="copy.newFolder" :title="copy.newFolder" @click="createFolder()"><i class="ti ti-folder-plus" aria-hidden="true"></i></button></div>
			<TransitionGroup tag="div" :name="prefer.s.animation ? 'favorite-folder-order' : undefined">
				<div v-for="entry in visibleTree" :key="entry.id" :class="$style.folderRow" :data-folder-id="entry.id" :data-child="!!entry.parentId" :data-active="selected === entry.id" :data-dragging="draggedFolder === entry.id" :data-drop="dropMarker(entry.id)" :draggable="!folderBusy" @dragstart="startFolderDrag(entry.id, $event)" @dragover.prevent="overFolder(entry.id, $event)" @drop.prevent.stop="dropFolder" @dragend="cancelFolderDrag" @contextmenu.prevent="manageFolder($event.currentTarget, entry.id)">
					<button class="_button" :class="$style.folderSelect" :aria-current="selected === entry.id ? 'page' : undefined" :title="favoriteFolderPath(entry.id)" @click="select(entry.id)"><i class="ti ti-folder-filled" :style="favoriteFolderColorStyle(entry.color)" aria-hidden="true"></i><span>{{ entry.name }}</span><small>{{ entry.count }}</small></button>
					<button v-if="children(entry.id).length" class="_button" :class="$style.expandButton" :aria-label="favoriteFolderPath(entry.id)" :aria-expanded="!collapsed.includes(entry.id)" @click="toggleExpanded(entry.id)"><i :class="collapsed.includes(entry.id) ? 'ti ti-chevron-right' : 'ti ti-chevron-down'" aria-hidden="true"></i></button>
				</div>
			</TransitionGroup>
			<template v-if="draggedFolder">
				<div :class="$style.rootDrop" :data-drop="dropTarget?.placement === 'root'" @dragover.prevent="overRoot" @drop.prevent.stop="dropFolder">{{ copy.extractToRoot }}</div>
				<p :class="$style.dragHint" role="status">{{ dragError || copy.dragHint }}</p>
			</template>
		</aside>
		<div :class="$style.content">
			<div :class="$style.controls">
				<div :class="$style.capsuleBar" :data-editing="reordering">
					<TransitionGroup tag="div" :class="$style.capsule" :name="prefer.s.animation ? 'favorite-folder-order' : undefined" role="tablist" :aria-label="copy.tabs">
						<button v-for="tab in capsuleTabs" :key="tab.id" class="_button" :class="$style.capsuleTab" :data-capsule="tab.id" :data-active="selected === tab.id" :data-edit-selected="reordering && reorderSelected === tab.id" :data-editing="reordering" role="tab" :aria-selected="selected === tab.id" :aria-label="`${tab.label} (${tab.count})`" :title="tab.label" :tabindex="reordering || selected === tab.id ? 0 : -1" @click="activateTab(tab.id)" @keydown.left.prevent="moveTabKey(tab.id, -1)" @keydown.right.prevent="moveTabKey(tab.id, 1)" @pointerdown="startCapsuleDrag(tab.id, $event)" @pointermove="moveCapsuleDrag" @pointerup="endCapsuleDrag" @pointercancel="cancelCapsuleDrag">
							<i :class="tab.icon" :style="selected === tab.id ? undefined : tab.color" aria-hidden="true"></i><span v-if="reordering || selected === tab.id" :class="$style.tabLabel">{{ tab.label }}</span><small v-if="selected === tab.id">{{ tab.count }}</small>
						</button>
					</TransitionGroup>
					<button v-if="canCreateFavoriteFolder()" class="_button" :class="$style.iconButton" :aria-label="copy.newFolder" :title="copy.newFolder" @click="createFolder()"><i class="ti ti-folder-plus" aria-hidden="true"></i></button>
					<button class="_button" :class="$style.iconButton" :aria-label="reordering ? copy.finishReorder : copy.reorderTabs" :title="reordering ? copy.finishReorder : copy.reorderTabs" :aria-pressed="reordering" :disabled="favoriteCapsules.saving" @click="toggleReorder"><i :class="reordering ? 'ti ti-check' : 'ti ti-arrows-move-horizontal'" aria-hidden="true"></i></button>
				</div>
				<div v-if="reordering" :class="$style.reorderTools">
					<button class="_button" :class="$style.iconButton" :aria-label="copy.moveLeft" :disabled="favoriteCapsules.saving || draftOrder.indexOf(reorderSelected) <= 0" @click="shiftCapsule(reorderSelected, -1)"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
					<span>{{ labelFor(reorderSelected) }}</span>
					<button class="_button" :class="$style.iconButton" :aria-label="copy.moveRight" :disabled="favoriteCapsules.saving || draftOrder.indexOf(reorderSelected) >= draftOrder.length - 1" @click="shiftCapsule(reorderSelected, 1)"><i class="ti ti-arrow-right" aria-hidden="true"></i></button>
				</div>
				<p v-if="orderError" :class="$style.notice" role="status">{{ orderError }}</p>
				<div v-if="!deck" :class="$style.context">
					<h2 :class="$style.listHeading">{{ labelFor(selected) }} <small>{{ countFor(selected) }}</small></h2>
					<div v-if="currentFolder" :class="$style.listActions">
						<button v-if="canCreateFavoriteFolder(currentFolder.id)" class="_button" :class="$style.iconButton" :aria-label="copy.newSubfolder" :title="copy.newSubfolder" @click="createFolder(currentFolder.id)"><i class="ti ti-folder-plus" aria-hidden="true"></i></button>
						<button class="_button" :class="$style.iconButton" :aria-label="`${currentFolder.name}: ${copy.manageFolder}`" :title="copy.manageFolder" @click="manageFolder($event.currentTarget)"><i class="ti ti-dots" aria-hidden="true"></i></button>
					</div>
				</div>
				<div v-if="!deck && currentFolder && children(currentFolder.id).length" :class="$style.children">
					<button v-for="child in children(currentFolder.id)" :key="child.id" class="_button" @click="select(child.id)"><i class="ti ti-folder" :style="favoriteFolderColorStyle(child.color)" aria-hidden="true"></i><span>{{ child.name }}</span><small>{{ child.count }}</small></button>
				</div>
			</div>
			<div ref="notesEl" :class="$style.notes" :data-deck-ui="deck ? 'on' : undefined">
				<MkPagination :key="paginatorKey" :paginator="paginator" :autoLoad="false" :onRefresh="reload">
					<template #empty><MkResult type="empty" :text="currentFolder ? copy.emptyFolder : i18n.ts.noNotes"/></template>
					<template #default="{ items }">
						<div v-for="item in items" :key="item.id" :class="$style.favorite">
							<MkNote :note="item.note"/>
							<div :class="$style.noteActions">
								<button class="_button" :class="$style.destination" :title="copy.changeDestination" @click="openFavoriteFolderPicker(item.note.id, { mode: 'move', folderId: item.folderId ?? null })"><i :class="item.folderId ? 'ti ti-folder' : 'ti ti-inbox'" :style="folderStyle(item.folderId)" aria-hidden="true"></i><span>{{ item.folderId ? favoriteFolderPath(item.folderId) : copy.unfiled }}</span><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
								<button class="_button" :class="$style.iconButton" :aria-label="copy.removeFavorite" :title="copy.removeFavorite" @click="removeFavoriteNote(item.note.id)"><i class="ti ti-star-off" aria-hidden="true"></i></button>
							</div>
						</div>
					</template>
				</MkPagination>
			</div>
		</div>
	</div>
</section>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { getScrollContainer } from '@@/js/scroll.js';
import type { MenuItem } from '@/types/menu.js';
import type { FavoriteFolderDropPlacement } from '@/utility/favorite-folder-layout.js';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { Paginator } from '@/utility/paginator.js';
import { favoriteFoldersState as state, refreshFavoriteFolders, favoriteFolderPath, favoriteFolderColorStyle, canCreateFavoriteFolder, openFavoriteFolderPicker, openFavoriteFolderEditor, moveFavoriteFolder, reorderFavoriteFolder, removeFavoriteNote } from '@/utility/favorite-folders.js';
import { favoriteFolderDrop, moveFavoriteCapsule, normalizeFavoriteCapsuleOrder, orderedFavoriteFolders } from '@/utility/favorite-folder-layout.js';
import { favoriteCapsules, loadFavoriteCapsules, saveFavoriteCapsules } from '@/utility/favorite-folder-capsules.js';

withDefaults(defineProps<{ deck?: boolean }>(), { deck: false });
const copy = i18n.ts._hata._favoriteFolders;
const rootEl = ref<HTMLElement>();
const notesEl = ref<HTMLElement>();
const selected = ref('all');
const loadError = ref(false);
const folderBusy = ref(false);
const collapsed = ref<string[]>([]);
const reordering = ref(false);
const reorderSelected = ref('all');
const draftOrder = ref<string[]>([]);
const orderError = ref('');
const draggedFolder = ref<string | null>(null);
const dropTarget = ref<{ id: string | null; placement: FavoriteFolderDropPlacement } | null>(null);
const dragError = ref('');
let collapsedBeforeDrag: string[] = [];
let hoverTimer: number | undefined;
let hoverId: string | null = null;
let capsuleDrag: { id: string; pointerId: number; startX: number; moved: boolean; initial: string[] } | null = null;
let skipCapsuleClick = false;
let mounted = true;
// Successful local mutations also apply to a page requested before the mutation.
const noteChanges = new Map<string, string | null | false>();
const deletedFolderIds = new Set<string>();
const currentFolder = computed(() => state.folders.find(folder => folder.id === selected.value));
const children = (id: string | null) => orderedFavoriteFolders(state.folders, id);
const visibleTree = computed(() => children(null).flatMap(folder => [folder, ...(collapsed.value.includes(folder.id) ? [] : children(folder.id))]));
const baseTabs = computed(() => [{ id: 'all', icon: 'ti ti-star', label: copy.all, count: state.totalCount }, { id: 'unfiled', icon: 'ti ti-inbox', label: copy.unfiled, count: state.unfiledCount }]);
const capsuleOrder = computed(() => normalizeFavoriteCapsuleOrder(favoriteCapsules.order, state.folders.map(folder => folder.id)));
const capsuleTabs = computed(() => (reordering.value ? draftOrder.value : capsuleOrder.value).map(id => ({ id, label: labelFor(id), count: countFor(id), icon: id === 'all' ? 'ti ti-star' : id === 'unfiled' ? 'ti ti-inbox' : 'ti ti-folder', color: folderStyle(id) })));

function labelFor(id: string) { return id === 'all' ? copy.all : id === 'unfiled' ? copy.unfiled : favoriteFolderPath(id); }

function countFor(id: string) { return id === 'all' ? state.totalCount : id === 'unfiled' ? state.unfiledCount : state.folders.find(folder => folder.id === id)?.count ?? 0; }

function folderStyle(id: string | null | undefined) { return favoriteFolderColorStyle(state.folders.find(folder => folder.id === id)?.color ?? 'rose'); }

function makePaginator() {
	const folderId = selected.value === 'all' ? undefined : selected.value === 'unfiled' ? null : selected.value;
	const accountId = $i?.id;
	const token = $i?.token;
	const page = markRaw(new Paginator('i/favorites', { limit: 20, params: folderId === undefined ? {} : { folderId } }));
	const pushItems = page.pushItems.bind(page);
	page.pushItems = items => {
		if (!mounted || accountId !== $i?.id || token !== $i?.token) return;
		pushItems(items.flatMap(item => {
			const override = noteChanges.get(item.note.id);
			if (override === false) return [];
			const savedFolderId = noteChanges.has(item.note.id) ? override as string | null : item.folderId ?? null;
			const membership = savedFolderId && deletedFolderIds.has(savedFolderId) ? null : savedFolderId;
			if (folderId !== undefined && membership !== folderId) return [];
			return [{ ...item, folderId: membership }];
		}));
	};
	// MkPagination also invokes reload directly from its context menu.
	page.reload = () => page === paginator.value ? reload() : Promise.resolve();
	return page;
}

const paginator = shallowRef(makePaginator());
const paginatorKey = ref(0);

function resetPaginator() {
	noteChanges.clear();
	deletedFolderIds.clear();
	paginator.value = makePaginator();
	paginatorKey.value++;
	return paginator.value.init();
}

function select(id: string) {
	if (selected.value === id) return;
	selected.value = id;
	resetPaginator();
	if (notesEl.value) notesEl.value.scrollTop = 0;
	nextTick(() => rootEl.value?.querySelector<HTMLElement>('[data-capsule][data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}

async function loadFolders() {
	try {
		await refreshFavoriteFolders();
		if (!mounted) return;
		loadError.value = false;
		if (!['all', 'unfiled'].includes(selected.value) && !currentFolder.value) select('unfiled');
	} catch { if (mounted) loadError.value = true; }
}

async function reload() {
	await loadFolders();
	await resetPaginator();
}

async function createFolder(parentId: string | null = null) { await openFavoriteFolderEditor({ mode: 'create', parentId }); }

function toggleExpanded(id: string) { collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(value => value !== id) : [...collapsed.value, id]; }

function folderMenuItems(id: string): MenuItem[] {
	const item = state.folders.find(folder => folder.id === id);
	if (!item) return [];
	const siblings = children(item.parentId);
	const index = siblings.findIndex(folder => folder.id === id);
	return [
		{ type: 'label', text: favoriteFolderPath(id) },
		{ text: copy.editFolder, icon: 'ti ti-pencil', action: () => { void openFavoriteFolderEditor({ mode: 'edit', folderId: id }); } },
		...(canCreateFavoriteFolder(id) ? [{ text: copy.newSubfolder, icon: 'ti ti-folder-plus', action: () => { void createFolder(id); } }] : []),
		{ text: copy.moveFolder, icon: 'ti ti-folder-symlink', action: () => { void openFavoriteFolderEditor({ mode: 'move', folderId: id }); } },
		...(index > 0 ? [{ text: copy.moveUp, icon: 'ti ti-arrow-up', action: () => { void reorderFolder(id, index - 1); } }] : []),
		...(index < siblings.length - 1 ? [{ text: copy.moveDown, icon: 'ti ti-arrow-down', action: () => { void reorderFolder(id, index + 1); } }] : []),
		{ text: copy.deleteFolder, icon: 'ti ti-trash', danger: true, action: () => { void openFavoriteFolderEditor({ mode: 'delete', folderId: id }); } },
	];
}

function openFolderList(anchor?: EventTarget | null) {
	void os.popupMenu([
		...baseTabs.value.map(tab => ({ text: tab.label, icon: tab.icon, active: selected.value === tab.id, action: () => select(tab.id) })),
		{ type: 'divider' },
		...children(null).flatMap(folder => [folder, ...children(folder.id)]).map(folder => ({ type: 'parent' as const, text: favoriteFolderPath(folder.id), icon: 'ti ti-folder', children: [{ text: favoriteFolderPath(folder.id), icon: 'ti ti-folder-open', action: () => select(folder.id) }, { type: 'divider' as const }, ...folderMenuItems(folder.id)] })),
		...(canCreateFavoriteFolder() ? [{ type: 'divider' as const }, { text: copy.newFolder, icon: 'ti ti-folder-plus', action: () => { void createFolder(); } }] : []),
	], anchor);
}

function manageFolder(anchor?: EventTarget | null, id = currentFolder.value?.id) {
	if (!id) { openFolderList(anchor); return; }
	void os.popupMenu([{ text: copy.folderList, icon: 'ti ti-folders', action: () => openFolderList(anchor) }, { type: 'divider' }, ...folderMenuItems(id)], anchor);
}

async function reorderFolder(id: string, position: number) {
	if (folderBusy.value) return;
	folderBusy.value = true;
	try { await reorderFavoriteFolder(id, position); } catch { os.toast(copy.saveFailed); } finally { folderBusy.value = false; }
}

async function toggleReorder() {
	orderError.value = '';
	if (reordering.value) {
		try {
			if (await saveFavoriteCapsules(draftOrder.value, state.folders.map(folder => folder.id))) reordering.value = false;
		} catch { orderError.value = copy.orderSaveFailed; }
		return;
	}
	try { await loadFavoriteCapsules(); } catch { orderError.value = copy.orderSaveFailed; return; }
	draftOrder.value = [...capsuleOrder.value];
	reorderSelected.value = selected.value;
	reordering.value = true;
}

function activateTab(id: string) {
	if (skipCapsuleClick) { skipCapsuleClick = false; return; }
	if (reordering.value) reorderSelected.value = id;
	else select(id);
}

function shiftCapsule(id: string, offset: number) {
	if (!reordering.value || favoriteCapsules.saving) return;
	reorderSelected.value = id;
	draftOrder.value = moveFavoriteCapsule(draftOrder.value, id, offset);
	nextTick(() => focusCapsule(id));
}

function focusCapsule(id: string) { Array.from(rootEl.value?.querySelectorAll<HTMLElement>('[data-capsule]') ?? []).find(el => el.dataset.capsule === id)?.focus(); }

function moveTabKey(id: string, offset: number) {
	if (reordering.value) { shiftCapsule(id, offset); return; }
	const order = capsuleOrder.value;
	const next = order[(order.indexOf(id) + offset + order.length) % order.length];
	select(next); nextTick(() => focusCapsule(next));
}

function startCapsuleDrag(id: string, event: PointerEvent) {
	if (!reordering.value || favoriteCapsules.saving || event.button !== 0) return;
	capsuleDrag = { id, pointerId: event.pointerId, startX: event.clientX, moved: false, initial: [...draftOrder.value] };
	reorderSelected.value = id;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveCapsuleDrag(event: PointerEvent) {
	if (!capsuleDrag || event.pointerId !== capsuleDrag.pointerId) return;
	if (Math.abs(event.clientX - capsuleDrag.startX) < 6 && !capsuleDrag.moved) return;
	capsuleDrag.moved = true;
	const hit = window.document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-capsule]');
	if (!hit || !rootEl.value?.contains(hit)) return;
	const index = draftOrder.value.indexOf(hit.dataset.capsule!);
	const source = draftOrder.value.indexOf(capsuleDrag.id);
	if (index >= 0 && index !== source) draftOrder.value = moveFavoriteCapsule(draftOrder.value, capsuleDrag.id, index - source);
}

function endCapsuleDrag() { skipCapsuleClick = capsuleDrag?.moved ?? false; capsuleDrag = null; }

function cancelCapsuleDrag() { if (capsuleDrag) draftOrder.value = capsuleDrag.initial; capsuleDrag = null; }

function clearHover() { if (hoverTimer) window.clearTimeout(hoverTimer); hoverTimer = undefined; hoverId = null; }

function startFolderDrag(id: string, event: DragEvent) {
	if (folderBusy.value || !event.dataTransfer) { event.preventDefault(); return; }
	draggedFolder.value = id;
	collapsedBeforeDrag = [...collapsed.value];
	event.dataTransfer.effectAllowed = 'move';
	event.dataTransfer.setData('text/plain', id);
}

function markDrop(id: string | null, placement: FavoriteFolderDropPlacement) {
	if (!draggedFolder.value || folderBusy.value) return;
	dropTarget.value = { id, placement };
	const result = favoriteFolderDrop(state.folders, draggedFolder.value, id, placement, state.canCreateSubfolders);
	dragError.value = 'error' in result ? copy[result.error] : '';
}

function overFolder(id: string, event: DragEvent) {
	if (!draggedFolder.value) return;
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	const ratio = (event.clientY - rect.top) / rect.height;
	const placement = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
	markDrop(id, placement);
	if (event.dataTransfer) event.dataTransfer.dropEffect = dragError.value ? 'none' : 'move';
	if (placement !== 'inside' || dragError.value) { clearHover(); return; }
	if (hoverId !== id) {
		clearHover(); hoverId = id;
		hoverTimer = window.setTimeout(() => { collapsed.value = collapsed.value.filter(value => value !== id); }, 450);
	}
}

function overRoot() { clearHover(); markDrop(null, 'root'); }

function dropMarker(id: string) {
	if (!dropTarget.value || dragError.value) return undefined;
	const target = dropTarget.value;
	if (target.placement === 'after') {
		const descendants = visibleTree.value.filter(folder => folder.parentId === target.id);
		return (descendants.at(-1)?.id ?? target.id) === id ? 'after' : undefined;
	}
	return target.id === id ? target.placement : undefined;
}

function cancelFolderDrag() {
	clearHover();
	if (draggedFolder.value) collapsed.value = collapsedBeforeDrag;
	draggedFolder.value = null; dropTarget.value = null; dragError.value = '';
}

async function dropFolder() {
	if (!draggedFolder.value || !dropTarget.value || folderBusy.value) return;
	const id = draggedFolder.value;
	const result = favoriteFolderDrop(state.folders, id, dropTarget.value.id, dropTarget.value.placement, state.canCreateSubfolders);
	if ('error' in result) { dragError.value = copy[result.error]; return; }
	clearHover();
	draggedFolder.value = null; dropTarget.value = null; dragError.value = '';
	folderBusy.value = true;
	try { await moveFavoriteFolder(id, result.parentId, result.position); } catch { collapsed.value = collapsedBeforeDrag; os.toast(copy.saveFailed); } finally { folderBusy.value = false; }
}

watch(() => [$i?.id, $i?.token], () => {
	noteChanges.clear();
	deletedFolderIds.clear();
	selected.value = 'all';
	reordering.value = false;
	cancelFolderDrag();
	resetPaginator();
	void loadFolders();
	void loadFavoriteCapsules().catch(() => { orderError.value = copy.orderSaveFailed; });
});
watch(() => state.revision, async () => {
	const change = state.lastChange;
	if (!change) return;
	if (change.type === 'folderDelete') change.folderIds.forEach(id => deletedFolderIds.add(id));
	else if (change.type === 'noteDelete') noteChanges.set(change.noteId, false);
	else if (change.type === 'noteMove' || change.type === 'noteCreate') noteChanges.set(change.noteId, change.folderId);
	if (reordering.value) draftOrder.value = normalizeFavoriteCapsuleOrder(draftOrder.value, state.folders.map(folder => folder.id));
	if (change.type === 'folderDelete') {
		if (change.folderIds.includes(selected.value)) { select('unfiled'); return; }
		for (const item of paginator.value.items.value) {
			if (item.folderId && change.folderIds.includes(item.folderId)) paginator.value.updateItem(item.id, value => ({ ...value, folderId: null }));
		}
		if (selected.value === 'unfiled') await reloadNotesPreservingScroll();
	} else if (change.type === 'noteMove' || change.type === 'noteDelete') {
		const item = paginator.value.items.value.find(value => value.note.id === change.noteId);
		if (item && change.type === 'noteDelete') paginator.value.removeItem(item.id);
		if (change.type === 'noteMove') {
			const matches = selected.value === 'all' || selected.value === (change.folderId ?? 'unfiled');
			if (item && matches) paginator.value.updateItem(item.id, value => ({ ...value, folderId: change.folderId }));
			else if (item) paginator.value.removeItem(item.id);
			else if (matches) await reloadNotesPreservingScroll();
		}
	} else if (change.type === 'noteCreate' && (selected.value === 'all' || selected.value === (change.folderId ?? 'unfiled'))) await reloadNotesPreservingScroll();
}, { flush: 'sync' });

async function reloadNotesPreservingScroll() {
	const scrollContainer = notesEl.value ? getScrollContainer(notesEl.value) : null;
	const top = scrollContainer?.scrollTop;
	await paginator.value.init();
	await nextTick();
	if (mounted && scrollContainer && top !== undefined) scrollContainer.scrollTop = top;
}

onMounted(() => { void paginator.value.init(); void loadFolders(); void loadFavoriteCapsules().catch(() => { orderError.value = copy.orderSaveFailed; }); });
onBeforeUnmount(() => { mounted = false; clearHover(); });
defineExpose({ reload, manageFolder });
</script>

<style lang="scss" module>
.root { container-type: inline-size; min-width: 0; }
.workspace { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
.sidebar { background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: var(--MI-radius); padding: 10px; min-width: 0; }
.sidebarTab, .folderSelect { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 12px; min-width: 0; text-align: start; }
.sidebarTab { width: 100%; border-radius: 12px; }
.sidebarTab span, .folderSelect span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebarTab small, .folderSelect small { border-radius: 20px; padding: 2px 7px; background: var(--MI_THEME-bg); font-size: .75em; }
.sidebarTab[data-active="true"], .folderRow[data-active="true"] { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }
.folderHeading { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--MI_THEME-divider); margin: 10px 10px 4px; padding-top: 10px; min-height: 44px; font-size: .8em; color: var(--MI_THEME-fgTransparent); }
.folderRow { position: relative; display: flex; min-width: 0; border-radius: 10px; }
.folderRow[data-child="true"] { margin-left: 18px; }
.folderSelect { flex: 1; }
.expandButton { flex: none; width: 30px; }
.folderRow[data-dragging="true"] { opacity: .45; }
.folderRow[data-drop="inside"] { outline: 2px solid var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.folderRow[data-drop="before"]::before, .folderRow[data-drop="after"]::after { content: ''; position: absolute; left: 0; right: 0; height: 2px; background: var(--MI_THEME-accent); pointer-events: none; }
.folderRow[data-drop="before"]::before { top: -1px; }
.folderRow[data-drop="after"]::after { bottom: -1px; }
.rootDrop { margin-top: 8px; padding: 14px 6px; border: 1px dashed var(--MI_THEME-divider); border-radius: 10px; text-align: center; font-size: .8em; }
.rootDrop[data-drop="true"] { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.dragHint { font-size: .75em; line-height: 1.6; margin: 10px 5px 2px; }
.content { min-width: 0; }
.controls { min-width: 0; }
.context { display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px; min-height: 44px; }
.listHeading { font-size: 1em; margin: 0; min-width: 0; overflow-wrap: anywhere; }
.listHeading small { margin-left: 8px; font-weight: normal; color: var(--MI_THEME-fgTransparent); }
.listActions { display: flex; gap: 8px; flex-shrink: 0; margin-left: auto; }
.iconButton { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; border: 1px solid var(--MI_THEME-divider); border-radius: 50%; background: var(--MI_THEME-panel); }
.iconButton:disabled { opacity: .45; cursor: default; }
.capsuleBar { display: none; align-items: center; justify-content: center; gap: 8px; min-width: 0; margin-bottom: 16px; }
.capsule { display: flex; align-items: center; gap: 2px; min-width: 0; max-width: 100%; width: max-content; padding: 5px; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 999px; box-shadow: 0 4px 12px #0001; overflow-x: auto; scrollbar-width: none; }
.capsule::-webkit-scrollbar { display: none; }
.capsuleTab { display: flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; min-width: 44px; min-height: 44px; border-radius: 999px; padding: 8px 12px; white-space: nowrap; }
.capsuleTab[data-active="true"] { color: var(--MI_THEME-fgOnAccent); background: var(--MI_THEME-accent); }
.capsuleTab[data-edit-selected="true"] { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
.capsuleTab[data-editing="true"] { touch-action: none; }
.capsuleTab small { padding: 2px 7px; background: color-mix(in srgb, currentColor 14%, transparent); border-radius: 999px; }
.tabLabel { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.reorderTools { display: none; align-items: center; justify-content: center; gap: 10px; padding-bottom: 12px; }
.reorderTools span { max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8em; }
.children { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.children button { display: flex; gap: 8px; align-items: center; padding: 10px 14px; min-height: 44px; max-width: 100%; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; }
.children span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.children small { color: var(--MI_THEME-fgTransparent); }
.notes { container-type: inline-size; min-width: 0; }
.favorite { background: var(--MI_THEME-panel); border-radius: var(--MI-radius); border: 1px solid var(--MI_THEME-divider); overflow: clip; }
.noteActions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 16px; padding: 6px 0; border-top: 1px solid var(--MI_THEME-divider); }
.destination { display: flex; min-width: 0; min-height: 44px; align-items: center; gap: 8px; text-align: start; font-size: .8em; }
.destination span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.noteActions .iconButton { border: 0; background: transparent; }
.notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; padding: 10px; font-size: .85em; }
.notice button { color: var(--MI_THEME-accent); min-height: 44px; }
.root i[style] { color: var(--favorite-folder-color); }
.root :focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
.root[data-deck="true"] { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.root[data-deck="true"] .workspace { display: flex; flex: 1; min-height: 0; }
.root[data-deck="true"] .sidebar { display: none; }
.root[data-deck="true"] .content { display: flex; flex-direction: column; width: 100%; min-height: 0; }
.root[data-deck="true"] .controls { flex-shrink: 0; max-height: 50%; overflow: auto; padding: 10px 8px 0; background: var(--MI_THEME-panel); }
.root[data-deck="true"] .capsuleBar { display: flex; margin-bottom: 10px; }
.root[data-deck="true"] .reorderTools { display: flex; }
.root[data-deck="true"] .children { flex-wrap: nowrap; overflow: auto; margin-bottom: 10px; }
.root[data-deck="true"] .children button { flex-shrink: 0; }
.root[data-deck="true"] .notes { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; padding: 8px 8px max(8px, env(safe-area-inset-bottom)); }
.root[data-deck="true"] .favorite { border-radius: 14px; }
:global(html.hataGlassUi) .favorite { background: transparent; }
@container (max-width: 760px) {
	.workspace { grid-template-columns: minmax(0, 1fr); }
	.sidebar, .children { display: none; }
	.capsuleBar, .reorderTools { display: flex; }
	.listHeading { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; white-space: nowrap; }
	.context:has(.listActions) { margin-top: -6px; }
	.context:not(:has(.listActions)) { display: none; }
}
</style>

<style lang="scss">
.favorite-folder-order-move { transition: transform 220ms ease; }
@media (prefers-reduced-motion: reduce) { .favorite-folder-order-move { transition: none; } }
</style>
