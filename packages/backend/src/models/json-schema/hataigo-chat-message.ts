/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedHataigoChatMessageSchema = {
	type: 'object', properties: {
		id: { type: 'string', format: 'id', optional: false, nullable: false },
		gameId: { type: 'string', format: 'id', optional: false, nullable: false },
		userId: { type: 'string', format: 'id', optional: false, nullable: true },
		user: { type: 'object', ref: 'UserLite', optional: false, nullable: true },
		text: { type: 'string', optional: false, nullable: true },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		expiresAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		deleted: { type: 'boolean', optional: false, nullable: false },
	},
} as const;
