/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { MiUser } from '@/models/User.js';
import { MiNote } from '@/models/Note.js';
import { MiNoteFavorite } from '@/models/NoteFavorite.js';
import { MiNoteFavoriteFolder, FAVORITE_FOLDER_COLORS } from '@/models/NoteFavoriteFolder.js';
import { IdService } from '@/core/IdService.js';
import { RoleService, normalizeFavoriteFolderLimit } from '@/core/RoleService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { FavoriteFolderColor } from '@/models/NoteFavoriteFolder.js';
import type { DataSource, EntityManager } from 'typeorm';

export type FavoriteFolderErrorCode = 'noSuchFolder' | 'folderLimitExceeded' | 'subfoldersNotAllowed' | 'invalidFolderHierarchy' | 'duplicateFolderName' | 'invalidFolderName' | 'invalidFolderColor' | 'noSuchNote' | 'alreadyFavorited' | 'notFavorited';
export class FavoriteFolderError extends Error {
	constructor(public readonly code: FavoriteFolderErrorCode) {
		super(code);
	}
}

type FolderInput = { name: string; color: FavoriteFolderColor; parentId?: string | null };
type FolderUpdate = { name?: string; color?: FavoriteFolderColor; parentId?: string | null; position?: number };

@Injectable()
export class NoteFavoriteFolderService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		private idService: IdService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
	) {}

	private async mutate<T>(userId: string, action: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.db.transaction(async manager => {
			// A persistent owner row exists even when the first folder is being created.
			// All writes (including favorite insert/move/delete) take this lock first.
			await manager.getRepository(MiUser).findOneOrFail({
				where: { id: userId }, select: { id: true }, lock: { mode: 'pessimistic_write' },
			});
			return action(manager);
		});
	}

	private async ownedFolders(manager: EntityManager, userId: string) {
		return manager.getRepository(MiNoteFavoriteFolder).find({ where: { userId }, order: { position: 'ASC', id: 'ASC' } });
	}

	private ownedFolder(folders: MiNoteFavoriteFolder[], id: string) {
		const folder = folders.find(item => item.id === id);
		if (!folder) throw new FavoriteFolderError('noSuchFolder');
		return folder;
	}

	private validateName(name: string, parentId: string | null, folders: MiNoteFavoriteFolder[], ignoreId?: string) {
		const trimmed = name.trim();
		if (trimmed.length < 1 || [...trimmed].length > 100) throw new FavoriteFolderError('invalidFolderName');
		if (folders.some(item => item.id !== ignoreId && item.parentId === parentId && item.name === trimmed)) {
			throw new FavoriteFolderError('duplicateFolderName');
		}
		return trimmed;
	}

	private validateColor(color: FavoriteFolderColor) {
		if (!FAVORITE_FOLDER_COLORS.includes(color)) throw new FavoriteFolderError('invalidFolderColor');
		return color;
	}

	private async pack(manager: EntityManager, folder: MiNoteFavoriteFolder) {
		return {
			id: folder.id, parentId: folder.parentId, name: folder.name, color: folder.color, position: folder.position,
			count: await manager.getRepository(MiNoteFavorite).countBy({ userId: folder.userId, folderId: folder.id }),
		};
	}

	public async list(userId: string) {
		// Read the folders and their counts from one snapshot during concurrent moves/deletes.
		return this.db.transaction('REPEATABLE READ', async manager => {
			const folders = await this.ownedFolders(manager, userId);
			const counts = await manager.getRepository(MiNoteFavorite).createQueryBuilder('favorite')
				.select('favorite.folderId', 'folderId').addSelect('COUNT(*)', 'count')
				.where('favorite.userId = :userId', { userId }).groupBy('favorite.folderId')
				.getRawMany<{ folderId: string | null; count: string }>();
			const policies = await this.roleService.getUserPolicies(userId);
			return {
				folders: folders.map(folder => ({
					id: folder.id, parentId: folder.parentId, name: folder.name, color: folder.color, position: folder.position,
					count: Number(counts.find(row => row.folderId === folder.id)?.count ?? 0),
				})),
				totalCount: counts.reduce((sum, row) => sum + Number(row.count), 0),
				unfiledCount: Number(counts.find(row => row.folderId === null)?.count ?? 0),
				folderLimit: normalizeFavoriteFolderLimit([policies.favoriteFolderLimit]),
				canCreateSubfolders: policies.canCreateFavoriteSubfolders === true,
			};
		});
	}

	public async create(userId: string, input: FolderInput) {
		return this.mutate(userId, async manager => {
			const folders = await this.ownedFolders(manager, userId);
			const policies = await this.roleService.getUserPolicies(userId);
			if (folders.length >= normalizeFavoriteFolderLimit([policies.favoriteFolderLimit])) throw new FavoriteFolderError('folderLimitExceeded');
			const parentId = input.parentId ?? null;
			if (parentId !== null) {
				const parent = this.ownedFolder(folders, parentId);
				if (parent.parentId !== null) throw new FavoriteFolderError('invalidFolderHierarchy');
				if (!policies.canCreateFavoriteSubfolders) throw new FavoriteFolderError('subfoldersNotAllowed');
			}
			const folder = manager.getRepository(MiNoteFavoriteFolder).create({
				id: this.idService.gen(), userId, parentId,
				name: this.validateName(input.name, parentId, folders), color: this.validateColor(input.color),
				position: folders.filter(item => item.parentId === parentId).length,
			});
			await manager.getRepository(MiNoteFavoriteFolder).insert(folder);
			return this.pack(manager, folder);
		});
	}

	public async update(userId: string, folderId: string, input: FolderUpdate) {
		return this.mutate(userId, async manager => {
			const folders = await this.ownedFolders(manager, userId);
			const current = this.ownedFolder(folders, folderId);
			const parentId = input.parentId === undefined ? current.parentId : input.parentId;
			if (parentId !== null) {
				const parent = this.ownedFolder(folders, parentId);
				if (parentId === current.id || parent.parentId !== null || folders.some(item => item.parentId === current.id)) {
					throw new FavoriteFolderError('invalidFolderHierarchy');
				}
				// Losing the role still allows existing children to move between roots.
				if (current.parentId === null && !(await this.roleService.getUserPolicies(userId)).canCreateFavoriteSubfolders) {
					throw new FavoriteFolderError('subfoldersNotAllowed');
				}
			}
			const name = this.validateName(input.name ?? current.name, parentId, folders, current.id);
			const color = this.validateColor(input.color ?? current.color);
			const target = folders.filter(item => item.parentId === parentId && item.id !== current.id);
			const desired = input.position ?? (parentId === current.parentId ? current.position : target.length);
			const position = Math.max(0, Math.min(target.length, desired));
			const updated = { ...current, name, color, parentId, position };
			// Only folder metadata changes. Favorite records and capsule order remain untouched.
			await manager.getRepository(MiNoteFavoriteFolder).update({ id: current.id, userId }, { name, color, parentId, position });
			target.splice(position, 0, updated);
			for (const [index, item] of target.entries()) {
				await manager.getRepository(MiNoteFavoriteFolder).update({ id: item.id, userId }, { position: index });
			}
			if (parentId !== current.parentId) {
				const former = folders.filter(item => item.parentId === current.parentId && item.id !== current.id);
				for (const [index, item] of former.entries()) {
					await manager.getRepository(MiNoteFavoriteFolder).update({ id: item.id, userId }, { position: index });
				}
			}
			return this.pack(manager, updated);
		});
	}

	public async delete(userId: string, folderId: string) {
		return this.mutate(userId, async manager => {
			const folders = await this.ownedFolders(manager, userId);
			const current = this.ownedFolder(folders, folderId);
			const ids = [current.id, ...folders.filter(item => item.parentId === current.id).map(item => item.id)];
			const result = await manager.getRepository(MiNoteFavorite).update({ userId, folderId: In(ids) }, { folderId: null });
			// Both steps are in this transaction; the FK is an additional SET NULL safeguard.
			await manager.getRepository(MiNoteFavoriteFolder).delete({ userId, id: In(ids) });
			const siblings = folders.filter(item => item.parentId === current.parentId && !ids.includes(item.id));
			for (const [position, item] of siblings.entries()) {
				await manager.getRepository(MiNoteFavoriteFolder).update({ userId, id: item.id }, { position });
			}
			return { movedCount: result.affected ?? 0 };
		});
	}

	public async assertFolderOwner(userId: string, folderId: string) {
		if (!await this.db.getRepository(MiNoteFavoriteFolder).existsBy({ id: folderId, userId })) {
			throw new FavoriteFolderError('noSuchFolder');
		}
	}

	private async visibleNote(manager: EntityManager, userId: string, noteId: string) {
		const notes = manager.getRepository(MiNote);
		const note = await notes.findOneBy({ id: noteId });
		// isVisibleForMe also allows replies to the viewer's own note.
		if (note?.replyId) note.reply = await notes.findOneBy({ id: note.replyId });
		if (!note || !await this.noteEntityService.isVisibleForMe(note, userId)) throw new FavoriteFolderError('noSuchNote');
		return note;
	}

	public async createFavorite(userId: string, noteId: string, folderId: string | null = null) {
		return this.mutate(userId, async manager => {
			const note = await this.visibleNote(manager, userId, noteId);
			const favorites = manager.getRepository(MiNoteFavorite);
			if (await favorites.existsBy({ userId, noteId })) throw new FavoriteFolderError('alreadyFavorited');
			if (folderId !== null) this.ownedFolder(await this.ownedFolders(manager, userId), folderId);
			await favorites.insert({ id: this.idService.gen(), userId, noteId, folderId });
			return note;
		});
	}

	public async moveFavorite(userId: string, noteId: string, folderId: string | null) {
		return this.mutate(userId, async manager => {
			await this.visibleNote(manager, userId, noteId);
			const favorites = manager.getRepository(MiNoteFavorite);
			const favorite = await favorites.findOneBy({ userId, noteId });
			if (!favorite) throw new FavoriteFolderError('notFavorited');
			if (folderId !== null) this.ownedFolder(await this.ownedFolders(manager, userId), folderId);
			await favorites.update({ id: favorite.id, userId }, { folderId });
		});
	}

	public async deleteFavorite(userId: string, noteId: string) {
		return this.mutate(userId, async manager => {
			if (!await manager.getRepository(MiNote).existsBy({ id: noteId })) throw new FavoriteFolderError('noSuchNote');
			const favorites = manager.getRepository(MiNoteFavorite);
			const favorite = await favorites.findOneBy({ userId, noteId });
			if (!favorite) throw new FavoriteFolderError('notFavorited');
			await favorites.delete({ id: favorite.id, userId });
		});
	}
}
