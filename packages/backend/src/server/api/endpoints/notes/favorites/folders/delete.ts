/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';
import { favoriteFolderApi, favoriteFolderApiErrors } from '../folder-api.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'write:favorites',
	prohibitMoved: true,
	limit: { duration: 60000, max: 60 },
	errors: favoriteFolderApiErrors,
	res: { type: 'object', optional: false, nullable: false, properties: { movedCount: { type: 'integer', optional: false, nullable: false } } },
} as const;

export const paramDef = {
	type: 'object', properties: { folderId: { type: 'string', format: 'misskey:id' } }, required: ['folderId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private folders: NoteFavoriteFolderService) {
		super(meta, paramDef, async (ps, me) => {
			return favoriteFolderApi(() => this.folders.delete(me.id, ps.folderId));
		});
	}
}
