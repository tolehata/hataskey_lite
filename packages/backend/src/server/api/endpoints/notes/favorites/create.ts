/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { AchievementService } from '@/core/AchievementService.js';
import { NoteFavoriteFolderService } from '@/core/NoteFavoriteFolderService.js';
import { favoriteFolderApi, favoriteFolderApiErrors } from './folder-api.js';

export const meta = {
	tags: ['notes', 'favorites'],

	requireCredential: true,
	prohibitMoved: true,

	kind: 'write:favorites',

	limit: {
		duration: ms('1hour'),
		max: 20,
	},

	errors: {
		...favoriteFolderApiErrors,
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '6dd26674-e060-4816-909a-45ba3f4da458',
		},

		alreadyFavorited: {
			message: 'The note has already been marked as a favorite.',
			code: 'ALREADY_FAVORITED',
			id: 'a402c12b-34dd-41d2-97d8-4d2ffd96a1a6',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		folderId: { type: 'string', format: 'misskey:id', nullable: true },
	},
	required: ['noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private favoriteFolders: NoteFavoriteFolderService,
		private achievementService: AchievementService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await favoriteFolderApi(() => this.favoriteFolders.createFavorite(me.id, ps.noteId, ps.folderId ?? null), meta.errors);
			if (note.userHost == null && note.userId !== me.id) {
				this.achievementService.create(note.userId, 'myNoteFavorited1');
			}
		});
	}
}
