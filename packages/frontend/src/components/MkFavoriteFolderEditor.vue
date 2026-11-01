<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow ref="dialog" :width="460" :height="480" :withCloseButton="!busy" @close="cancel" @click="cancel" @esc="cancel" @closed="emit('closed')">
	<template #header>{{ title }}</template>
	<div :class="$style.body">
		<MkLoading v-if="loading"/>
		<MkButton v-else-if="loadFailed" rounded @click="load">{{ i18n.ts.retry }}</MkButton>
		<template v-else-if="!missing">
			<p v-if="mode === 'delete'">{{ deletionDescription }}</p>
			<div v-else-if="mode === 'move'" :class="$style.destinations" role="radiogroup" :aria-label="copy.moveFolder">
				<button class="_button" :class="$style.destination" role="radio" :aria-checked="parentId === null" :data-selected="parentId === null" :disabled="busy || stale" @click="parentId = null"><i class="ti ti-folders"></i><span>{{ copy.topLevel }}</span><i v-if="parentId === null" class="ti ti-check"></i></button>
				<button v-for="destination in roots" :key="destination.id" class="_button" :class="$style.destination" :style="favoriteFolderColorStyle(destination.color)" :disabled="busy || stale || !!favoriteFolderMoveError(folderId!, destination.id)" role="radio" :aria-checked="parentId === destination.id" :data-selected="parentId === destination.id" @click="parentId = destination.id"><i class="ti ti-folder" :class="$style.folderIcon"></i><span>{{ destination.name }}</span><i v-if="parentId === destination.id" class="ti ti-check"></i></button>
			</div>
			<div v-else class="_gaps">
				<p v-if="mode === 'create' && parentId">{{ favoriteFolderPath(parentId) }}</p>
				<MkInput v-model="name" :disabled="busy || stale" autofocus @keydown.enter="save">
					<template #label>{{ copy.folderName }}</template>
				</MkInput>
				<fieldset :class="$style.colorField" :disabled="busy || stale">
					<legend>{{ copy.folderColor }}</legend>
					<div :class="$style.colors">
						<button v-for="item in favoriteFolderColors" :key="item" class="_button" :class="$style.color" :style="favoriteFolderColorStyle(item)" :aria-label="favoriteFolderColorName(item)" :aria-pressed="color === item" :data-selected="color === item" @click="color = item"><i :class="color === item ? 'ti ti-check' : 'ti ti-folder'"></i></button>
					</div>
				</fieldset>
			</div>
		</template>
		<p v-if="stale || missing || creationError || error" :class="$style.error" role="alert">{{ stale ? copy.accountChanged : missing ? copy.selectedFolderMissing : creationError || error }}</p>
	</div>
	<template #footer>
		<div :class="$style.actions">
			<MkButton rounded :disabled="busy" @click="cancel">{{ i18n.ts.cancel }}</MkButton>
			<MkButton v-if="!creationError" rounded primary :danger="mode === 'delete'" :disabled="busy || stale || missing || loading || loadFailed" @click="save">{{ mode === 'delete' ? i18n.ts.delete : mode === 'create' ? i18n.ts.create : i18n.ts.save }}</MkButton>
		</div>
	</template>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import type { FavoriteFolderColor, FavoriteFolderEditorOptions } from '@/utility/favorite-folders.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { toast } from '@/os.js';
import { createFavoriteFolder, deleteFavoriteFolder, favoriteFolderColorName, favoriteFolderColorStyle, favoriteFolderColors, favoriteFolderCreationError, favoriteFolderErrorMessage, favoriteFolderMoveError, favoriteFolderPath, favoriteFoldersState, isFavoriteAccountCurrent, moveFavoriteFolder, refreshFavoriteFolders, sortedFavoriteFolders, updateFavoriteFolder } from '@/utility/favorite-folders.js';

const props = defineProps<FavoriteFolderEditorOptions>();
const emit = defineEmits<{ (ev: 'done', saved: boolean): void; (ev: 'closed'): void }>();
const copy = i18n.ts._hata._favoriteFolders;
const dialog = useTemplateRef('dialog');
const snapshot = { id: $i?.id ?? null, token: $i?.token };
const stale = computed(() => !isFavoriteAccountCurrent(snapshot));
const target = computed(() => favoriteFoldersState.folders.find(f => f.id === props.folderId));
const title = computed(() => ({ create: props.parentId ? copy.createChild : copy.newFolder, edit: copy.editFolder, move: copy.moveFolder, delete: copy.deleteFolder })[props.mode]);
const name = ref('');
const color = ref<FavoriteFolderColor>('rose');
const parentId = ref<string | null>(props.parentId ?? null);
const busy = ref(false);
const loading = ref(true);
const loadFailed = ref(false);
const error = ref('');
let initialized = false;
const missing = computed(() => !loading.value && !loadFailed.value && props.mode !== 'create' && !target.value);
const creationError = computed(() => props.mode === 'create' && !loading.value && !loadFailed.value ? favoriteFolderCreationError(parentId.value) : null);
const roots = computed(() => sortedFavoriteFolders().filter(f => f.parentId === null && f.id !== props.folderId));
const deletionDescription = computed(() => {
	const children = favoriteFoldersState.folders.filter(f => f.parentId === props.folderId);
	return i18n.tsx._hata._favoriteFolders.deleteFolderDescription({ name: target.value?.name ?? '', children: children.length, notes: (target.value?.count ?? 0) + children.reduce((sum, f) => sum + f.count, 0) });
});

async function load() {
	if (stale.value) return;
	loading.value = true;
	loadFailed.value = false;
	error.value = '';
	try {
		await refreshFavoriteFolders();
		if (!initialized && target.value && !stale.value) {
			name.value = target.value.name;
			color.value = target.value.color;
			parentId.value = target.value.parentId;
		}
		initialized = true;
	} catch {
		loadFailed.value = true;
		error.value = copy.loadingFailed;
	} finally {
		loading.value = false;
	}
}

function validate() {
	if (props.mode === 'create' && creationError.value) return creationError.value;
	if (props.mode === 'move') return favoriteFolderMoveError(props.folderId!, parentId.value);
	if (props.mode === 'delete') return null;
	const trimmed = name.value.trim();
	if (trimmed.length < 1 || Array.from(trimmed).length > 100) return copy.invalidName;
	if (favoriteFoldersState.folders.some(f => f.id !== props.folderId && f.parentId === parentId.value && f.name === trimmed)) return copy.duplicateName;
	return null;
}

function cancel() {
	if (busy.value) return;
	emit('done', false);
	dialog.value?.close();
}

async function save() {
	if (busy.value || stale.value || missing.value || loading.value || loadFailed.value) return;
	error.value = validate() ?? '';
	if (error.value) return;
	busy.value = true;
	try {
		if (props.mode === 'create') await createFavoriteFolder({ name: name.value.trim(), color: color.value, parentId: parentId.value });
		else if (props.mode === 'delete') {
			const result = await deleteFavoriteFolder(props.folderId!);
			toast(i18n.tsx._hata._favoriteFolders.notesMovedToUnfiled({ count: result.movedCount }));
		} else if (props.mode === 'move') await moveFavoriteFolder(props.folderId!, parentId.value);
		else await updateFavoriteFolder(props.folderId!, { name: name.value.trim(), color: color.value });
		emit('done', true);
		dialog.value?.close();
	} catch (err) {
		error.value = favoriteFolderErrorMessage(err);
		// Preserve the staged name, color and destination for retry.
		if (!stale.value) await refreshFavoriteFolders().catch(() => {});
	} finally {
		busy.value = false;
	}
}

onMounted(() => { void load(); });
</script>

<style lang="scss" module>
.body { padding: 24px; overflow-wrap: anywhere; }
.destinations { display: flex; flex-direction: column; gap: 6px; }
.destination {
	display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 10px 14px;
	box-sizing: border-box; border-radius: 14px; text-align: start;
	> span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
	&[data-selected="true"] { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }
	&:disabled { opacity: 0.45; }
}
.folderIcon { color: var(--favorite-folder-color); }
.colorField { border: 0; padding: 0; margin: 0; min-width: 0; > legend { margin-bottom: 12px; } }
.colors { display: flex; gap: 10px; flex-wrap: wrap; }
.color {
	width: 44px; height: 44px; border-radius: 50%; background: color-mix(in srgb, var(--favorite-folder-color) 16%, var(--MI_THEME-panel));
	color: var(--favorite-folder-color);
	&[data-selected="true"], &:focus-visible { outline: 2px solid var(--favorite-folder-color); outline-offset: 2px; }
}
.actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }
.error { color: var(--MI_THEME-error); }
</style>
