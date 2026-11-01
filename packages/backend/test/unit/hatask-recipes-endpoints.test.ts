/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { HATASK_RECIPE_CATEGORIES } from '@/models/HataskRecipe.js';
import { HATASK_COOKING_MEAL_SLOTS } from '@/models/HataskCookingRecord.js';
import RecipeListEndpoint, { meta as listMeta } from '@/server/api/endpoints/hatask/recipes/list.js';
import RecipeCreateEndpoint, { meta as createMeta } from '@/server/api/endpoints/hatask/recipes/create.js';
import RecipeUpdateEndpoint, { meta as updateMeta } from '@/server/api/endpoints/hatask/recipes/update.js';
import { meta as showMeta } from '@/server/api/endpoints/hatask/recipes/show.js';
import { packedHataskRecipeSchema } from '@/server/api/endpoints/hatask/recipes/_schema.js';
import CookedCreateEndpoint from '@/server/api/endpoints/hatask/recipes/cooked/create.js';

const me = { id: 'owner' } as never;
const cookedAt = Date.parse('2026-09-22T19:42:00.000Z');

function recipeList() {
	const service = { list: vi.fn(async () => ({})) };
	return { endpoint: new RecipeListEndpoint(service as never), service };
}

function cookedCreate() {
	const service = { createCookingRecord: vi.fn(async () => ({})) };
	return { endpoint: new CookedCreateEndpoint(service as never), service };
}

describe('hatask/recipes/list Endpoint.exec', () => {
	for (const scope of ['mine', 'shared'] as const) {
		test(`accepts null category for ${scope} and normalizes the service input`, async () => {
			const { endpoint, service } = recipeList();
			await endpoint.exec({ scope, category: null }, me, null, null);
			expect(service.list).toHaveBeenCalledExactlyOnceWith(me, {
				scope, category: null, tag: null, query: null, sort: 'cooked', limit: 30, offset: 0,
			});
		});

		test(`defaults omitted category for ${scope} to null`, async () => {
			const { endpoint, service } = recipeList();
			await endpoint.exec({ scope }, me, null, null);
			expect(service.list).toHaveBeenCalledExactlyOnceWith(me, {
				scope, category: null, tag: null, query: null, sort: 'cooked', limit: 30, offset: 0,
			});
		});

		for (const category of HATASK_RECIPE_CATEGORIES) {
			test(`accepts ${category} category for ${scope}`, async () => {
				const { endpoint, service } = recipeList();
				await endpoint.exec({ scope, category }, me, null, null);
				expect(service.list).toHaveBeenCalledExactlyOnceWith(me, expect.objectContaining({ scope, category }));
			});
		}

		test(`rejects an invalid category for ${scope} before calling the service`, async () => {
			const { endpoint, service } = recipeList();
			await expect(endpoint.exec({ scope, category: 'invalid' }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
			expect(service.list).not.toHaveBeenCalled();
		});
	}

	test('defaults omitted scope to mine', async () => {
		const { endpoint, service } = recipeList();
		await endpoint.exec({}, me, null, null);
		expect(service.list).toHaveBeenCalledExactlyOnceWith(me, expect.objectContaining({ scope: 'mine', category: null }));
	});
});

describe('hatask/recipes reference links API contract', () => {
	for (const operation of ['create', 'update'] as const) {
		function setupRecipeEndpoint() {
			const service = { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
			const endpoint = operation === 'create' ? new RecipeCreateEndpoint(service as never) : new RecipeUpdateEndpoint(service as never);
			const params = operation === 'create' ? { title: '料理' } : { title: '料理', recipeId: 'recipe' };
			return { endpoint, params, call: service[operation] };
		}

		test(`${operation} preserves omission as undefined and accepts explicit []`, async () => {
			const { endpoint, params, call } = setupRecipeEndpoint();
			await endpoint.exec(params, me, null, null);
			expect(call.mock.calls[0].at(-1)).toHaveProperty('referenceLinks', undefined);
			await endpoint.exec({ ...params, referenceLinks: [] }, me, null, null);
			expect(call.mock.calls[1].at(-1)).toHaveProperty('referenceLinks', []);
		});

		test(`${operation} defaults only a link's omitted title`, async () => {
			const { endpoint, params, call } = setupRecipeEndpoint();
			await endpoint.exec({ ...params, referenceLinks: [{ url: 'https://example.com' }] }, me, null, null);
			expect(call.mock.calls[0].at(-1)).toHaveProperty('referenceLinks', [{ title: '', url: 'https://example.com' }]);
		});

		test.each([
			['missing URL', [{ title: '参考' }]],
			['null links', null],
			['non-array links', {}],
			['null title', [{ title: null, url: 'https://example.com' }]],
			['non-string URL', [{ url: 123 }]],
			['11 links', Array.from({ length: 11 }, () => ({ url: 'https://example.com' }))],
			['121-character title', [{ title: 'a'.repeat(121), url: 'https://example.com' }]],
			['2049-character URL', [{ url: `https://example.com/${'a'.repeat(2029)}` }]],
		] satisfies [string, unknown][])(`${operation} rejects %s before calling the service`, async (_, referenceLinks) => {
			const { endpoint, params, call } = setupRecipeEndpoint();
			await expect(endpoint.exec({ ...params, referenceLinks }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
			expect(call).not.toHaveBeenCalled();
		});
	}

	test('create, update, show and list all declare required reference links and title/url', () => {
		for (const schema of [createMeta.res, updateMeta.res, showMeta.res, listMeta.res.properties.items.items]) {
			expect(schema).toBe(packedHataskRecipeSchema);
			expect(schema.required).toContain('referenceLinks');
			expect(schema.properties.referenceLinks).toMatchObject({
				type: 'array', optional: false, nullable: false,
				items: { required: ['title', 'url'] },
			});
		}
	});
});

describe('hatask/recipes/cooked/create Endpoint.exec', () => {
	test('accepts public visibility only for a cooking record', async () => {
		const { endpoint, service } = cookedCreate();
		await endpoint.exec({ cookedAt, visibility: 'public' }, me, null, null);
		expect(service.createCookingRecord).toHaveBeenCalledExactlyOnceWith(me, expect.objectContaining({ visibility: 'public' }));

		const recipeService = { create: vi.fn(async () => ({})) };
		const recipeEndpoint = new RecipeCreateEndpoint(recipeService as never);
		await expect(recipeEndpoint.exec({ title: '料理', visibility: 'public' }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(recipeService.create).not.toHaveBeenCalled();
	});

	test('accepts null mealSlot and normalizes the service input', async () => {
		const { endpoint, service } = cookedCreate();
		await endpoint.exec({ cookedAt, mealSlot: null }, me, null, null);
		expect(service.createCookingRecord).toHaveBeenCalledExactlyOnceWith(me, {
			recipeId: null, title: undefined, cookedAt: new Date(cookedAt), durationSeconds: null,
			servings: 2, mealSlot: null, cost: null, memo: '', fileId: null,
			visibility: 'private', visibleUserIds: [], recordToHatady: true,
		});
	});

	test('defaults omitted mealSlot to null', async () => {
		const { endpoint, service } = cookedCreate();
		await endpoint.exec({ cookedAt }, me, null, null);
		expect(service.createCookingRecord).toHaveBeenCalledExactlyOnceWith(me, expect.objectContaining({
			cookedAt: new Date(cookedAt), mealSlot: null,
		}));
	});

	for (const mealSlot of HATASK_COOKING_MEAL_SLOTS) {
		test(`accepts ${mealSlot} mealSlot`, async () => {
			const { endpoint, service } = cookedCreate();
			await endpoint.exec({ cookedAt, mealSlot }, me, null, null);
			expect(service.createCookingRecord).toHaveBeenCalledExactlyOnceWith(me, expect.objectContaining({
				cookedAt: new Date(cookedAt), mealSlot,
			}));
		});
	}

	test('rejects an invalid mealSlot before calling the service', async () => {
		const { endpoint, service } = cookedCreate();
		await expect(endpoint.exec({ cookedAt, mealSlot: 'invalid' }, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(service.createCookingRecord).not.toHaveBeenCalled();
	});
});
