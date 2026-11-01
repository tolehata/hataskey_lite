/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedNoteFavoriteSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		note: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
		folderId: {
			type: 'string',
			optional: false, nullable: true,
			format: 'id',
		},
		noteId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
	},
} as const;
