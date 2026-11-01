/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface FavoriteFolderLayoutItem {
	id: string;
	name: string;
	parentId: string | null;
	position: number;
}

export type FavoriteFolderSelection = 'all' | 'unfiled' | string;
export type FavoriteFolderDropPlacement = 'before' | 'after' | 'inside' | 'root';
export type FavoriteFolderDropError = 'folderUnavailable' | 'dropInvalid' | 'maxDepth' | 'nestedUnavailable' | 'duplicateName';

export function orderedFavoriteFolders<T extends FavoriteFolderLayoutItem>(folders: readonly T[], parentId: string | null): T[] {
	return folders.filter(folder => folder.parentId === parentId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function normalizeFavoriteCapsuleOrder(saved: unknown, folderIds: readonly string[]): string[] {
	const available = new Set(['all', 'unfiled', ...folderIds]);
	const order = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && available.has(id)) : [];
	return [...new Set([...order, ...available])];
}

/** Insertion indices refer to the destination siblings after removing the source. */
export function favoriteFolderDrop(
	folders: readonly FavoriteFolderLayoutItem[],
	sourceId: string,
	targetId: string | null,
	placement: FavoriteFolderDropPlacement,
	canCreateSubfolders: boolean,
): { parentId: string | null; position: number } | { error: FavoriteFolderDropError } {
	const source = folders.find(folder => folder.id === sourceId);
	const target = targetId ? folders.find(folder => folder.id === targetId) : null;
	if (!source || (placement !== 'root' && !target)) return { error: 'folderUnavailable' };
	if (sourceId === targetId) return { error: 'dropInvalid' };
	const parentId = placement === 'root' ? null : placement === 'inside' ? target!.id : target!.parentId;
	const parent = parentId ? folders.find(folder => folder.id === parentId) : null;
	if (parentId === sourceId || (parent && parent.parentId === sourceId)) return { error: 'dropInvalid' };
	if (parent && (parent.parentId !== null || folders.some(folder => folder.parentId === sourceId))) return { error: 'maxDepth' };
	if (parentId !== null && source.parentId === null && !canCreateSubfolders) return { error: 'nestedUnavailable' };
	if (folders.some(folder => folder.id !== sourceId && folder.parentId === parentId && folder.name.trim() === source.name.trim())) return { error: 'duplicateName' };
	const siblings = orderedFavoriteFolders(folders, parentId).filter(folder => folder.id !== sourceId);
	const targetIndex = siblings.findIndex(folder => folder.id === targetId);
	const position = placement === 'inside' || placement === 'root' ? siblings.length : targetIndex + (placement === 'after' ? 1 : 0);
	return { parentId, position };
}

export function moveFavoriteCapsule(order: readonly string[], id: string, offset: number): string[] {
	const index = order.indexOf(id);
	const next = [...order];
	if (index < 0 || index + offset < 0 || index + offset >= order.length) return next;
	next.splice(index, 1);
	next.splice(index + offset, 0, id);
	return next;
}
