/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const HATASK_FLOWER_RATE_LIMITS = {
	read: {
		duration: 60 * 1000,
		max: 120,
	},
	sync: {
		duration: 60 * 1000,
		max: 30,
	},
	visibility: {
		duration: 60 * 1000,
		max: 60,
	},
} as const;

export const hataskFlowerSchema = {
	type: 'object',
	optional: false,
	nullable: false,
	properties: {
		id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
		clientFlowerId: { type: 'string', minLength: 1, maxLength: 64, optional: false, nullable: false },
		emoji: { type: 'string', minLength: 1, maxLength: 32, optional: false, nullable: false },
		name: { type: 'string', minLength: 1, maxLength: 80, optional: false, nullable: false },
		hanakotoba: { type: 'string', maxLength: 256, optional: false, nullable: false },
		harvestedAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		isOwner: { type: 'boolean', optional: false, nullable: false },
		user: { type: 'object', optional: false, nullable: false, ref: 'UserLite' },
	},
	required: ['id', 'clientFlowerId', 'emoji', 'name', 'hanakotoba', 'harvestedAt', 'isOwner', 'user'],
} as const;
