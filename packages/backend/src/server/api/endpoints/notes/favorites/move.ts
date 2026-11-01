/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';
import { favoriteFolderApi, favoriteFolderApiErrors } from './folder-api.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:favorites',
	limit: { duration: 60000, max: 120 },
	errors: favoriteFolderApiErrors,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		folderId: { type: 'string', format: 'misskey:id', nullable: true },
	}, required: ['noteId', 'folderId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private folders: NoteFavoriteFolderService) {
		super(meta, paramDef, async (ps, me) => {
			await favoriteFolderApi(() => this.folders.moveFavorite(me.id, ps.noteId, ps.folderId));
		});
	}
}
