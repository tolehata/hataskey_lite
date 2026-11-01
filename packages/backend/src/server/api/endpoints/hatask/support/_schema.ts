/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { HATASK_SUPPORT_POLICY_KEYS } from '@/core/hatask-support.js';
import { packedUserLiteSchema } from '@/models/json-schema/user.js';

const text = { type: 'string', nullable: false } as const;
const bool = { type: 'boolean', nullable: false } as const;
const key = { ...text, enum: HATASK_SUPPORT_POLICY_KEYS } as const;
export const supportSnapshotSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		value: { anyOf: [{ type: 'number', nullable: true }, { type: 'boolean' }], optional: false, nullable: false },
		available: bool, unlimited: bool,
		condition: { ...text, enum: ['mascotUnavailable'], nullable: true },
		rateMultiplier: { type: 'number', optional: false, nullable: true },
	}, required: ['value', 'available', 'unlimited', 'condition', 'rateMultiplier'],
} as const;

export const publicSupportSettingsSchema = {
	type: 'object', nullable: false,
	properties: {
		platform: { ...text, maxLength: 100 }, url: { ...text, maxLength: 2048 }, manageUrl: { ...text, maxLength: 2048 },
		intro: { ...text, maxLength: 2000 }, bannerTitle: { ...text, maxLength: 100 },
		bannerMessage: { ...text, maxLength: 2000 }, bannerVisible: bool,
	}, required: ['platform', 'url', 'manageUrl', 'intro', 'bannerTitle', 'bannerMessage', 'bannerVisible'], additionalProperties: false,
} as const;

export const supportSettingsSchema = {
	...publicSupportSettingsSchema,
	properties: {
		...publicSupportSettingsSchema.properties,
		enabled: bool, navButtonVisible: bool,
		benefits: {
			type: 'array', nullable: false, maxItems: HATASK_SUPPORT_POLICY_KEYS.length,
			items: {
				type: 'object', properties: {
					key, title: { ...text, maxLength: 100 }, description: { ...text, maxLength: 2000 },
					roleId: { ...text, format: 'misskey:id', nullable: true }, visible: bool, showBaseline: bool,
				}, required: ['key', 'title', 'description', 'roleId', 'visible', 'showBaseline'], additionalProperties: false,
			},
		},
	}, required: [...publicSupportSettingsSchema.required, 'enabled', 'navButtonVisible', 'benefits'],
} as const;

/** Older admin clients may omit the new flag when saving other settings. */
export const supportUpdateSettingsSchema = {
	...supportSettingsSchema,
	properties: { ...supportSettingsSchema.properties, navButtonVisible: bool },
	required: [...publicSupportSettingsSchema.required, 'enabled', 'benefits'],
} as const;

export const supportShowSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		configured: bool, navButtonVisible: bool, settings: { ...publicSupportSettingsSchema, nullable: true }, isSupporter: bool,
		supporterCount: { type: 'integer', minimum: 0, optional: false, nullable: false },
		benefits: {
			type: 'array', optional: false, nullable: false,
			items: {
				type: 'object', properties: {
					key, title: text, description: text, showBaseline: bool,
					baseline: { ...supportSnapshotSchema, nullable: true }, offered: { ...supportSnapshotSchema, nullable: true },
					current: supportSnapshotSchema, reflected: bool,
				}, required: ['key', 'title', 'description', 'showBaseline', 'baseline', 'offered', 'current', 'reflected'],
			},
		},
	}, required: ['configured', 'navButtonVisible', 'settings', 'isSupporter', 'supporterCount', 'benefits'],
} as const;

export const supportAdminShowSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		settings: supportSettingsSchema,
		benefits: {
			type: 'array', items: {
				type: 'object', properties: { key, baseline: supportSnapshotSchema, offered: { ...supportSnapshotSchema, nullable: true } },
				required: ['key', 'baseline', 'offered'],
			},
		},
		roles: {
			type: 'array', items: { type: 'object', properties: { id: text, name: text }, required: ['id', 'name'] },
		},
		rolePreview: {
			type: 'object', nullable: true, properties: {
				id: text, name: text,
				benefits: { type: 'array', items: { type: 'object', properties: { key, snapshot: supportSnapshotSchema }, required: ['key', 'snapshot'] } },
			}, required: ['id', 'name', 'benefits'],
		},
	}, required: ['settings', 'benefits', 'roles', 'rolePreview'],
} as const;

export const supporterPageSchema = {
	type: 'object', optional: false, nullable: false, properties: {
		users: { type: 'array', items: { type: 'object', ref: 'UserLite' } },
		total: { type: 'integer', minimum: 0 }, hasMore: bool,
	}, required: ['users', 'total', 'hasMore'],
} as const;

export const adminSupporterPageSchema = {
	...supporterPageSchema,
	properties: {
		...supporterPageSchema.properties,
		users: {
			type: 'array', items: {
				...packedUserLiteSchema, properties: { ...packedUserLiteSchema.properties, isSupporter: bool },
				required: ['isSupporter'],
			},
		},
	},
} as const;

export const supportPageParams = {
	type: 'object', properties: {
		offset: { type: 'integer', minimum: 0, maximum: 2147483647, default: 0 },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
	}, required: [], additionalProperties: false,
} as const;

export const supportUserParams = {
	type: 'object', properties: { userId: { ...text, format: 'misskey:id' } }, required: ['userId'], additionalProperties: false,
} as const;

export const supportRegistrationSchema = { type: 'object', properties: { isSupporter: bool }, required: ['isSupporter'] } as const;
