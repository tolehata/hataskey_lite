/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const emoji = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id: { type: 'string', optional: false, nullable: false },
		name: { type: 'string', optional: false, nullable: false },
		url: { type: 'string', optional: false, nullable: false },
		isSensitive: { type: 'boolean', optional: false, nullable: false },
	},
} as const;

export const emojiVoteResponse = {
	type: 'object', optional: false, nullable: false,
	properties: {
		serverNow: { type: 'number', optional: false, nullable: false },
		round: {
			type: 'object', optional: false, nullable: true,
			properties: {
				id: { type: 'string', optional: false, nullable: false },
				noteId: { type: 'string', optional: false, nullable: false },
				startedAt: { type: 'number', optional: false, nullable: false },
				closesAt: { type: 'number', optional: false, nullable: false },
				resolvedAt: { type: 'number', optional: false, nullable: false },
				expiresAt: { type: 'number', optional: false, nullable: false },
				phase: { type: 'string', enum: ['voting', 'tallying', 'result'], optional: false, nullable: false },
				candidates: { type: 'array', items: emoji, optional: false, nullable: false },
				choice: {
					type: 'object', optional: false, nullable: true,
					properties: {
						emojiId: { type: 'string', optional: false, nullable: false },
						votedAt: { type: 'number', optional: false, nullable: false },
					},
				},
				rankings: {
					type: 'array', optional: false, nullable: false,
					items: {
						type: 'object', optional: false, nullable: false,
						properties: {
							emoji,
							count: { type: 'number', optional: false, nullable: false },
							rank: { type: 'number', optional: false, nullable: true },
							tied: { type: 'boolean', optional: false, nullable: false },
						},
					},
				},
				total: { type: 'number', optional: false, nullable: false },
			},
		},
	},
} as const;
