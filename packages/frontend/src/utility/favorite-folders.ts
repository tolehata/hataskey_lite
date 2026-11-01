/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, watch } from 'vue';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { claimAchievement } from '@/utility/achievements.js';
import * as os from '@/os.js';

export const favoriteFolderColors = ['rose', 'amber', 'green', 'blue', 'violet', 'slate'] as const;
export type FavoriteFolderColor = typeof favoriteFolderColors[number];
export function favoriteFolderColorStyle(color: FavoriteFolderColor) {
	const palette: Record<FavoriteFolderColor, string> = {
		rose: 'color-mix(in srgb, #ba3568 75%, var(--MI_THEME-fg))', amber: 'color-mix(in srgb, #b77b16 75%, var(--MI_THEME-fg))',
		green: 'color-mix(in srgb, #35835d 75%, var(--MI_THEME-fg))', blue: 'color-mix(in srgb, #367dcc 75%, var(--MI_THEME-fg))',
		violet: 'color-mix(in srgb, #9470c7 75%, var(--MI_THEME-fg))', slate: 'color-mix(in srgb, #788392 75%, var(--MI_THEME-fg))',
	};
	return { '--favorite-folder-color': palette[color] ?? palette.rose };
}

export function favoriteFolderColorName(color: FavoriteFolderColor) {
	const copy = i18n.ts._hata._favoriteFolders;
	return { rose: copy.colorRose, amber: copy.colorAmber, green: copy.colorGreen, blue: copy.colorBlue, violet: copy.colorViolet, slate: copy.colorSlate }[color];
}
export type FavoriteFolder = {
	id: string;
	name: string;
	parentId: string | null;
	color: FavoriteFolderColor;
	position: number;
	count: number;
};
export type FavoriteFoldersChange =
	| { type: 'noteCreate' | 'noteMove'; noteId: string; folderId: string | null }
	| { type: 'noteDelete'; noteId: string }
	| { type: 'folderDelete'; folderIds: string[] }
	| { type: 'folderUpdate' };

export const favoriteFoldersState = reactive({
	accountId: $i?.id ?? null,
	folders: [] as FavoriteFolder[],
	totalCount: 0,
	unfiledCount: 0,
	folderLimit: 0,
	canCreateSubfolders: false,
	loaded: false,
	loading: false,
	revision: 0,
	lastChange: null as FavoriteFoldersChange | null,
});

let generation = 0;
let loadSerial = 0;
let mutationSerial = 0;
const pendingNotes = new Set<string>();
const account = () => ({ id: $i?.id ?? null, token: $i?.token, generation });
type AccountSnapshot = ReturnType<typeof account>;

export function isFavoriteAccountCurrent(snapshot: { id: string | null; token?: string }) {
	return snapshot.id != null && snapshot.id === $i?.id && snapshot.token === $i?.token;
}

function assertAccount(snapshot: AccountSnapshot) {
	if (!isFavoriteAccountCurrent(snapshot) || snapshot.generation !== generation) throw new Error(i18n.ts._hata._favoriteFolders.accountChanged);
}

watch(() => [$i?.id, $i?.token], () => {
	generation++;
	loadSerial++;
	pendingNotes.clear();
	Object.assign(favoriteFoldersState, {
		accountId: $i?.id ?? null, folders: [], totalCount: 0, unfiledCount: 0,
		folderLimit: 0, canCreateSubfolders: false, loaded: false, loading: false,
		lastChange: null, revision: favoriteFoldersState.revision + 1,
	});
}, { flush: 'sync' });

export async function refreshFavoriteFolders() {
	const snapshot = account();
	assertAccount(snapshot);
	const serial = ++loadSerial;
	const beforeMutation = mutationSerial;
	favoriteFoldersState.loading = true;
	try {
		const result = await misskeyApi('notes/favorites/folders/list', {}, snapshot.token);
		assertAccount(snapshot);
		if (serial !== loadSerial || beforeMutation !== mutationSerial) return;
		Object.assign(favoriteFoldersState, result, { loaded: true });
	} finally {
		if (snapshot.generation === generation && serial === loadSerial) favoriteFoldersState.loading = false;
	}
}

function changed(change: FavoriteFoldersChange) {
	mutationSerial++;
	favoriteFoldersState.lastChange = change;
	favoriteFoldersState.revision++;
	// Mutation success must not become a failed-save message if recounting fails.
	void refreshFavoriteFolders().catch(() => {});
}

export function favoriteFolderPath(id: string) {
	const folder = favoriteFoldersState.folders.find(f => f.id === id);
	if (!folder) return '';
	const parent = favoriteFoldersState.folders.find(f => f.id === folder.parentId);
	return parent ? `${parent.name} / ${folder.name}` : folder.name;
}

export function sortedFavoriteFolders() {
	const siblings = (parentId: string | null) => favoriteFoldersState.folders.filter(f => f.parentId === parentId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
	return siblings(null).flatMap(f => [f, ...siblings(f.id)]);
}

export function favoriteFolderCreationError(parentId: string | null = null): string | null {
	const copy = i18n.ts._hata._favoriteFolders;
	if (!favoriteFoldersState.loaded || favoriteFoldersState.folders.length >= favoriteFoldersState.folderLimit) return copy.limitReached;
	if (parentId !== null) {
		const parent = favoriteFoldersState.folders.find(f => f.id === parentId);
		if (!parent) return copy.selectedFolderMissing;
		if (parent.parentId !== null) return copy.maxDepth;
		if (!favoriteFoldersState.canCreateSubfolders) return copy.childrenNotAllowed;
	}
	return null;
}

export const canCreateFavoriteFolder = (parentId: string | null = null) => favoriteFolderCreationError(parentId) === null;

export function favoriteFolderMoveError(folderId: string, parentId: string | null): string | null {
	const copy = i18n.ts._hata._favoriteFolders;
	const source = favoriteFoldersState.folders.find(f => f.id === folderId);
	if (!source) return copy.selectedFolderMissing;
	if (parentId === null) return null;
	const parent = favoriteFoldersState.folders.find(f => f.id === parentId);
	if (!parent || parent.id === folderId || parent.parentId !== null || favoriteFoldersState.folders.some(f => f.parentId === folderId)) return copy.invalidMove;
	if (source.parentId === null && !favoriteFoldersState.canCreateSubfolders) return copy.childrenNotAllowed;
	return null;
}

export async function createFavoriteFolder(input: { name: string; color: FavoriteFolderColor; parentId: string | null }) {
	const snapshot = account();
	assertAccount(snapshot);
	const result = await misskeyApi('notes/favorites/folders/create', input, snapshot.token);
	assertAccount(snapshot);
	favoriteFoldersState.folders.push(result);
	changed({ type: 'folderUpdate' });
	return result;
}

export async function updateFavoriteFolder(folderId: string, patch: { name?: string; color?: FavoriteFolderColor; parentId?: string | null; position?: number }) {
	const snapshot = account();
	assertAccount(snapshot);
	const result = await misskeyApi('notes/favorites/folders/update', { folderId, ...patch }, snapshot.token);
	assertAccount(snapshot);
	const index = favoriteFoldersState.folders.findIndex(f => f.id === folderId);
	if (index >= 0) {
		const originalParentId = favoriteFoldersState.folders[index].parentId;
		favoriteFoldersState.folders.splice(index, 1, result);
		if (patch.parentId !== undefined || patch.position !== undefined) {
			const siblings = favoriteFoldersState.folders.filter(f => f.id !== folderId && f.parentId === result.parentId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
			siblings.splice(result.position, 0, favoriteFoldersState.folders[index]);
			siblings.forEach((f, position) => { f.position = position; });
			if (originalParentId !== result.parentId) favoriteFoldersState.folders.filter(f => f.parentId === originalParentId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).forEach((f, position) => { f.position = position; });
		}
	}
	changed({ type: 'folderUpdate' });
	return result;
}

export const moveFavoriteFolder = (folderId: string, parentId: string | null, position?: number) => updateFavoriteFolder(folderId, { parentId, ...(position === undefined ? {} : { position }) });
export const reorderFavoriteFolder = (folderId: string, position: number) => updateFavoriteFolder(folderId, { position });

export async function deleteFavoriteFolder(folderId: string) {
	const snapshot = account();
	assertAccount(snapshot);
	const folderIds = favoriteFoldersState.folders.filter(f => f.id === folderId || f.parentId === folderId).map(f => f.id);
	const result = await misskeyApi('notes/favorites/folders/delete', { folderId }, snapshot.token);
	assertAccount(snapshot);
	favoriteFoldersState.folders = favoriteFoldersState.folders.filter(f => !folderIds.includes(f.id));
	favoriteFoldersState.unfiledCount += result.movedCount;
	changed({ type: 'folderDelete', folderIds });
	return result;
}

/** Saving and moving are separate requests: a move never deletes/recreates a favorite. */
export async function saveFavoriteNote(noteId: string, folderId: string | null, mode: 'create' | 'move' | 'remove') {
	const snapshot = account();
	assertAccount(snapshot);
	const key = `${snapshot.id}:${noteId}`;
	if (pendingNotes.has(key)) return false;
	pendingNotes.add(key);
	try {
		if (mode === 'remove') await misskeyApi('notes/favorites/delete', { noteId }, snapshot.token);
		else if (mode === 'move') await misskeyApi('notes/favorites/move', { noteId, folderId }, snapshot.token);
		else await misskeyApi('notes/favorites/create', { noteId, folderId }, snapshot.token);
		assertAccount(snapshot);
		if (mode === 'create') claimAchievement('noteFavorited1');
		changed(mode === 'remove' ? { type: 'noteDelete', noteId } : { type: mode === 'create' ? 'noteCreate' : 'noteMove', noteId, folderId });
		return true;
	} finally {
		if (snapshot.generation === generation) pendingNotes.delete(key);
	}
}

export function favoriteFolderErrorMessage(error: unknown) {
	const copy = i18n.ts._hata._favoriteFolders;
	const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
	if (code === 'ALREADY_FAVORITED') return copy.alreadyFavorited;
	if (code === 'NO_SUCH_FAVORITE_FOLDER') return copy.selectedFolderMissing;
	if (code === 'FAVORITE_FOLDER_LIMIT_EXCEEDED') return copy.limitReached;
	if (code === 'FAVORITE_SUBFOLDERS_NOT_ALLOWED') return copy.childrenNotAllowed;
	if (code === 'DUPLICATE_FAVORITE_FOLDER_NAME') return copy.duplicateName;
	if (code === 'INVALID_FAVORITE_FOLDER_HIERARCHY') return copy.invalidMove;
	return copy.saveFailed;
}

export type FavoriteFolderEditorOptions = { mode: 'create' | 'edit' | 'delete' | 'move'; folderId?: string; parentId?: string | null };

export async function openFavoriteFolderEditor(options: FavoriteFolderEditorOptions): Promise<boolean> {
	const snapshot = account();
	const component = (await import('@/components/MkFavoriteFolderEditor.vue')).default;
	assertAccount(snapshot);
	return new Promise(resolve => {
		let result = false;
		const { dispose } = os.popup(component, options, {
			done: (saved: boolean) => { result = saved; },
			closed: () => { dispose(); resolve(result); },
		});
	});
}

export async function openFavoriteFolderPicker(noteId: string, options: { mode: 'create' | 'move' | 'remove'; folderId?: string | null } = { mode: 'create' }): Promise<boolean> {
	const snapshot = account();
	const component = (await import('@/components/MkFavoriteFolderPicker.vue')).default;
	assertAccount(snapshot);
	return new Promise(resolve => {
		let result = false;
		const { dispose } = os.popup(component, { noteId, ...options }, {
			done: (saved: boolean) => { result = saved; },
			closed: () => { dispose(); resolve(result); },
		});
	});
}

export const removeFavoriteNote = (noteId: string) => openFavoriteFolderPicker(noteId, { mode: 'remove' });
