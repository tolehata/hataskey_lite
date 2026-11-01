/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { HATASK_RECIPE_CATEGORIES, HATASK_RECIPE_VISIBILITIES } from '@/models/HataskRecipe.js';
import { HATASK_COOKING_MEAL_SLOTS, HATASK_COOKING_VISIBILITIES } from '@/models/HataskCookingRecord.js';
import { HATASK_RECIPE_LIMITS } from '@/core/HataskRecipeService.js';

const text = { type: 'string', optional: false, nullable: false } as const;
const int = { type: 'integer', optional: false, nullable: false } as const;
const bool = { type: 'boolean', optional: false, nullable: false } as const;
const id = { ...text, format: 'id' } as const;

const photoSchema = {
	type: 'object', optional: false, nullable: true,
	properties: { id, url: text, thumbnailUrl: { ...text, nullable: true } },
	required: ['id', 'url', 'thumbnailUrl'],
} as const;

const ingredientSchema = {
	type: 'object', optional: false, nullable: false,
	properties: { name: text, amount: text },
	required: ['name', 'amount'],
} as const;

const stepSchema = {
	type: 'object', optional: false, nullable: false,
	properties: { text, timerSeconds: { ...int, nullable: true }, timerLabel: text },
	required: ['text', 'timerSeconds', 'timerLabel'],
} as const;

const referenceLinkSchema = {
	type: 'object', optional: false, nullable: false,
	properties: { title: text, url: text },
	required: ['title', 'url'],
} as const;

export const packedHataskRecipeSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id,
		createdAt: { ...text, format: 'date-time' },
		updatedAt: { ...text, format: 'date-time' },
		userId: id,
		user: { type: 'object', optional: false, nullable: false, ref: 'UserLite' },
		isMine: bool,
		title: text,
		summary: text,
		category: { ...text, enum: HATASK_RECIPE_CATEGORIES },
		servings: int,
		minutes: { ...int, nullable: true },
		scalable: bool,
		ingredients: { type: 'array', optional: false, nullable: false, items: ingredientSchema },
		steps: { type: 'array', optional: false, nullable: false, items: stepSchema },
		referenceLinks: { type: 'array', optional: false, nullable: false, items: referenceLinkSchema },
		tags: { type: 'array', optional: false, nullable: false, items: text },
		photo: photoSchema,
		visibility: { ...text, enum: HATASK_RECIPE_VISIBILITIES },
		visibleUserIds: { type: 'array', optional: false, nullable: false, items: id },
		isDraft: bool,
		cookedCount: int,
		lastCookedAt: { ...text, format: 'date-time', nullable: true },
	},
	required: ['id', 'createdAt', 'updatedAt', 'userId', 'user', 'isMine', 'title', 'summary', 'category', 'servings', 'minutes', 'scalable', 'ingredients', 'steps', 'referenceLinks', 'tags', 'photo', 'visibility', 'visibleUserIds', 'isDraft', 'cookedCount', 'lastCookedAt'],
} as const;

export const packedHataskCookingRecordSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id,
		createdAt: { ...text, format: 'date-time' },
		cookedAt: { ...text, format: 'date-time' },
		recipeId: { ...id, nullable: true },
		title: text,
		durationSeconds: { ...int, nullable: true },
		servings: int,
		mealSlot: { ...text, nullable: true, enum: [...HATASK_COOKING_MEAL_SLOTS, null] },
		cost: { ...int, nullable: true },
		memo: text,
		photo: photoSchema,
		visibility: { ...text, enum: HATASK_COOKING_VISIBILITIES },
		visibleUserIds: { type: 'array', optional: false, nullable: false, items: id },
		hatadyLogId: { ...id, nullable: true },
	},
	required: ['id', 'createdAt', 'cookedAt', 'recipeId', 'title', 'durationSeconds', 'servings', 'mealSlot', 'cost', 'memo', 'photo', 'visibility', 'visibleUserIds', 'hatadyLogId'],
} as const;

export const audienceProperties = {
	visibility: { type: 'string', enum: HATASK_RECIPE_VISIBILITIES, default: 'private' },
	visibleUserIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, maxItems: 100, uniqueItems: true, default: [] },
} as const;

export const cookingAudienceProperties = {
	...audienceProperties,
	visibility: { type: 'string', enum: HATASK_COOKING_VISIBILITIES, default: 'private' },
} as const;

export const recipeInputProperties = {
	title: { type: 'string', minLength: 1, maxLength: HATASK_RECIPE_LIMITS.title },
	summary: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.summary, default: '' },
	category: { type: 'string', enum: HATASK_RECIPE_CATEGORIES, default: 'main' },
	servings: { type: 'integer', minimum: 1, maximum: 50, default: 2 },
	minutes: { type: 'integer', minimum: 0, maximum: 1440, nullable: true, default: null },
	scalable: { type: 'boolean', default: true },
	ingredients: {
		type: 'array', maxItems: HATASK_RECIPE_LIMITS.ingredients, default: [],
		items: {
			type: 'object',
			properties: {
				name: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.ingredientName },
				amount: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.ingredientAmount, default: '' },
			},
			required: ['name'],
		},
	},
	steps: {
		type: 'array', maxItems: HATASK_RECIPE_LIMITS.steps, default: [],
		items: {
			type: 'object',
			properties: {
				text: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.stepText },
				timerSeconds: { type: 'integer', minimum: 1, maximum: 86400, nullable: true, default: null },
				timerLabel: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.timerLabel, default: '' },
			},
			required: ['text'],
		},
	},
	referenceLinks: {
		type: 'array', maxItems: HATASK_RECIPE_LIMITS.referenceLinks,
		items: {
			type: 'object',
			properties: {
				title: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.referenceLinkTitle, default: '' },
				url: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.referenceLinkUrl },
			},
			required: ['url'],
		},
	},
	tags: { type: 'array', maxItems: HATASK_RECIPE_LIMITS.tags, items: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.tag + 2 }, default: [] },
	fileId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
	isDraft: { type: 'boolean', default: false },
	...audienceProperties,
} as const;
