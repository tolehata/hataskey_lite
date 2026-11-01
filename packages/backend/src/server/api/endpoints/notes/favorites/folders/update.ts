/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';
import { FAVORITE_FOLDER_COLORS } from '@/models/NoteFavoriteFolder.js';
import { favoriteFolderApi, favoriteFolderApiErrors } from '../folder-api.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'write:favorites',
	prohibitMoved: true,
	limit: { duration: 60000, max: 60 },
	errors: favoriteFolderApiErrors,
	res: { type: 'object', optional: false, nullable: false, ref: 'NoteFavoriteFolder' },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		folderId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 100 },
		color: { type: 'string', enum: FAVORITE_FOLDER_COLORS },
		parentId: { type: 'string', format: 'misskey:id', nullable: true },
		position: { type: 'integer', minimum: 0, maximum: 5 },
	}, required: ['folderId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private folders: NoteFavoriteFolderService) {
		super(meta, paramDef, async (ps, me) => {
			return favoriteFolderApi(() => this.folders.update(me.id, ps.folderId, ps));
		});
	}
}
