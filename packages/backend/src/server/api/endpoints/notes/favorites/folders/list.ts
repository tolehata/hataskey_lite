/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';

export const meta = {
	tags: ['notes', 'favorites'],
	requireCredential: true,
	kind: 'read:favorites',
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			folders: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'NoteFavoriteFolder' } },
			totalCount: { type: 'integer', optional: false, nullable: false },
			unfiledCount: { type: 'integer', optional: false, nullable: false },
			folderLimit: { type: 'integer', optional: false, nullable: false },
			canCreateSubfolders: { type: 'boolean', optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object', properties: {}, required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private folders: NoteFavoriteFolderService) {
		super(meta, paramDef, async (ps, me) => {
			return this.folders.list(me.id);
		});
	}
}
