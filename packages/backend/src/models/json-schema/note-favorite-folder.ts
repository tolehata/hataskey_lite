/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { FAVORITE_FOLDER_COLORS } from '@/models/NoteFavoriteFolder.js';

export const packedNoteFavoriteFolderSchema = {
	type: 'object',
	properties: {
		id: { type: 'string', optional: false, nullable: false, format: 'id' },
		parentId: { type: 'string', optional: false, nullable: true, format: 'id' },
		name: { type: 'string', optional: false, nullable: false },
		color: { type: 'string', optional: false, nullable: false, enum: FAVORITE_FOLDER_COLORS },
		position: { type: 'integer', optional: false, nullable: false },
		count: { type: 'integer', optional: false, nullable: false },
	},
} as const;
