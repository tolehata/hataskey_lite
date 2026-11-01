<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow ref="dialog" :width="460" :height="520" :withCloseButton="!busy" @close="cancel" @click="cancel" @esc="cancel" @closed="onClosed">
	<template #header>{{ mode === 'remove' ? i18n.ts.unfavorite : mode === 'move' ? copy.moveNote : copy.chooseDestination }}</template>
	<div :class="$style.body">
		<p v-if="mode === 'remove'">{{ copy.unfavoriteDescription }}</p>
		<template v-else>
			<MkLoading v-if="loading"/>
			<MkButton v-else-if="loadFailed" rounded @click="load">{{ i18n.ts.retry }}</MkButton>
			<div v-else :class="$style.destinations" role="radiogroup" :aria-label="copy.chooseDestination">
				<button class="_button" :class="$style.destination" role="radio" :aria-checked="selected === null" :data-selected="selected === null" :disabled="busy || stale" @click="selected = null">
					<i class="ti ti-inbox"></i><span>{{ copy.unfiled }}</span><i v-if="selected === null" class="ti ti-check"></i>
				</button>
				<button v-for="folder in folders" :key="folder.id" class="_button" :class="$style.destination" :style="favoriteFolderColorStyle(folder.color)" :data-child="folder.parentId !== null" :data-selected="selected === folder.id" role="radio" :aria-checked="selected === folder.id" :disabled="busy || stale" @click="selected = folder.id">
					<i class="ti ti-folder" :class="$style.folderIcon"></i><span>{{ favoriteFolderPath(folder.id) }}</span><i v-if="selected === folder.id" class="ti ti-check"></i>
				</button>
			</div>
			<div v-if="!loading && !loadFailed && canCreateFavoriteFolder()" :class="$style.create">
				<MkButton rounded :disabled="busy || stale" @click="createFolder"><i class="ti ti-folder-plus"></i> {{ copy.newFolder }}</MkButton>
			</div>
		</template>
		<p v-if="stale || missing || error" :class="$style.error" role="alert">{{ stale ? copy.accountChanged : missing ? copy.selectedFolderMissing : error }}</p>
	</div>
	<template #footer>
		<div :class="$style.actions">
			<MkButton rounded :disabled="busy" @click="cancel">{{ i18n.ts.cancel }}</MkButton>
			<MkButton rounded primary :danger="mode === 'remove'" :disabled="busy || stale || loading || loadFailed || missing" @click="save">{{ mode === 'remove' ? i18n.ts.unfavorite : i18n.ts.save }}</MkButton>
		</div>
	</template>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, useTemplateRef } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { canCreateFavoriteFolder, favoriteFolderColorStyle, favoriteFolderErrorMessage, favoriteFolderPath, favoriteFoldersState, isFavoriteAccountCurrent, openFavoriteFolderEditor, refreshFavoriteFolders, saveFavoriteNote, sortedFavoriteFolders } from '@/utility/favorite-folders.js';
import { getNotificationPageContext, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';
import { notificationToastsSuppressed } from '@/utility/notification-toast-suppression.js';

const props = withDefaults(defineProps<{ noteId: string; mode: 'create' | 'move' | 'remove'; folderId?: string | null }>(), { folderId: undefined });
const emit = defineEmits<{ (ev: 'done', saved: boolean): void; (ev: 'closed'): void }>();
const copy = i18n.ts._hata._favoriteFolders;
const dialog = useTemplateRef('dialog');
const notificationToasts = inject(hataskeyNotificationToastsKey, null);
let savedTarget: string | undefined;
const snapshot = { id: $i?.id ?? null, token: $i?.token };
const stale = computed(() => !isFavoriteAccountCurrent(snapshot));
const selected = ref<string | null>(props.folderId ?? null);
const busy = ref(false);
const loading = ref(props.mode !== 'remove');
const loadFailed = ref(false);
const error = ref('');
const folders = computed(sortedFavoriteFolders);
const missing = computed(() => !loading.value && !loadFailed.value && selected.value !== null && !favoriteFoldersState.folders.some(f => f.id === selected.value));

async function load() {
	if (stale.value) return;
	loading.value = true;
	loadFailed.value = false;
	error.value = '';
	try {
		await refreshFavoriteFolders();
		if (props.mode === 'move' && props.folderId === undefined) {
			const state = await misskeyApi('notes/state', { noteId: props.noteId }, snapshot.token);
			if (!stale.value) selected.value = state.favoriteFolderId ?? null;
		}
	} catch {
		loadFailed.value = true;
		error.value = copy.loadingFailed;
	} finally {
		loading.value = false;
	}
}

async function createFolder() {
	await openFavoriteFolderEditor({ mode: 'create' });
}

function cancel() {
	if (busy.value) return;
	emit('done', false);
	dialog.value?.close();
}

function onClosed() {
	const target = savedTarget;
	savedTarget = undefined;
	// Start the shared navbar feedback after the destination dialog has left.
	if (target && !stale.value && !notificationToastsSuppressed.value && !window.document.hidden) {
		(notificationToasts ?? getNotificationPageContext())?.enqueueNavbarNotice({ kind: 'noteAction', action: 'favorite', message: i18n.ts._hata._navbarNotice.favoriteAdded, target });
	}
	emit('closed');
}

async function save() {
	if (busy.value || stale.value || loading.value || loadFailed.value || missing.value) return;
	busy.value = true;
	error.value = '';
	const destination = selected.value === null ? copy.unfiled : favoriteFolderPath(selected.value);
	try {
		if (!await saveFavoriteNote(props.noteId, selected.value, props.mode)) return;
		if (props.mode === 'create') savedTarget = destination;
		emit('done', true);
		dialog.value?.close();
	} catch (err) {
		error.value = favoriteFolderErrorMessage(err);
		// Refresh availability while keeping the selected ID, including a removed destination.
		if (props.mode !== 'remove' && !stale.value) await refreshFavoriteFolders().catch(() => {});
	} finally {
		busy.value = false;
	}
}

onMounted(() => { if (props.mode !== 'remove') void load(); });
</script>

<style lang="scss" module>
.body { padding: 24px; }
.destinations { display: flex; flex-direction: column; gap: 6px; }
.destination {
	display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 10px 14px;
	box-sizing: border-box; border-radius: 14px; text-align: start;
	> span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
	&[data-child="true"] { padding-inline-start: 30px; }
	&[data-selected="true"] { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 2px; }
}
.folderIcon { color: var(--favorite-folder-color); }
.create { margin-top: 16px; display: flex; justify-content: center; }
.actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }
.error { color: var(--MI_THEME-error); overflow-wrap: anywhere; }
</style>
