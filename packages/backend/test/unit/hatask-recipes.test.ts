/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { HataskRecipeService } from '@/core/HataskRecipeService.js';
import type { HataskCookingRecordInput, HataskRecipeInput } from '@/core/HataskRecipeService.js';
import type { MiHataskRecipe } from '@/models/HataskRecipe.js';

function recipe(overrides: Partial<MiHataskRecipe> = {}): MiHataskRecipe {
	return {
		id: 'recipe', createdAt: new Date('2026-09-20'), updatedAt: new Date('2026-09-20'), userId: 'owner', user: null,
		title: '鶏むねのねぎ塩だれ', summary: '', category: 'main', servings: 2, minutes: 25, scalable: true,
		ingredients: [], steps: [], referenceLinks: [], tags: [], fileId: null, file: null,
		visibility: 'followers', visibleUserIds: [], isDraft: false,
		...overrides,
	};
}

function input(overrides: Partial<HataskRecipeInput> = {}): HataskRecipeInput {
	return {
		title: '鶏むねのねぎ塩だれ', summary: '', category: 'main', servings: 2, minutes: null, scalable: true,
		ingredients: [], steps: [], tags: [], fileId: null, visibility: 'private', visibleUserIds: [], isDraft: false,
		...overrides,
	};
}

function cooking(overrides: Partial<HataskCookingRecordInput> = {}): HataskCookingRecordInput {
	return {
		recipeId: 'recipe', cookedAt: new Date('2026-09-22T19:42:00Z'), durationSeconds: 28 * 60, servings: 2, mealSlot: 'dinner', cost: 620,
		memo: '塩は控えめ', fileId: null, visibility: 'private', visibleUserIds: [], recordToHatady: true,
		...overrides,
	};
}

const me = (id: string) => ({ id }) as never;

function setup(options: { stored?: MiHataskRecipe | null; following?: boolean; blocked?: boolean; users?: number; activeOwner?: boolean } = {}) {
	const recipes = {
		findOneBy: vi.fn().mockResolvedValue(options.stored === undefined ? recipe() : options.stored),
		insertOne: vi.fn(async (row: MiHataskRecipe) => row),
		update: vi.fn(),
		delete: vi.fn().mockResolvedValue({ affected: 1 }),
	};
	const records = {
		insertOne: vi.fn(async (row: unknown) => row),
		findOneBy: vi.fn(),
		delete: vi.fn(),
		createQueryBuilder: vi.fn(() => {
			const qb = { select: () => qb, addSelect: () => qb, where: () => qb, andWhere: () => qb, groupBy: () => qb, getRawMany: async () => [] };
			return qb;
		}),
	};
	const users = { countBy: vi.fn().mockResolvedValue(options.users ?? 0), existsBy: vi.fn().mockResolvedValue(options.activeOwner ?? true) };
	const followings = { exists: vi.fn().mockResolvedValue(options.following ?? false) };
	const blockings = { exists: vi.fn().mockResolvedValue(options.blocked ?? false) };
	const driveFiles = { findOneBy: vi.fn().mockResolvedValue(null) };
	const hatady = { createLog: vi.fn().mockResolvedValue({ id: 'log' }), deleteLog: vi.fn().mockResolvedValue(undefined) };
	const userEntity = { packMany: vi.fn(async (ids: string[]) => ids.map(id => ({ id, username: id }))) };
	const service = new HataskRecipeService(
		recipes as never, records as never, users as never, followings as never, blockings as never, driveFiles as never,
		{ gen: () => 'generated' } as never, hatady as never, {} as never, userEntity as never,
	);
	return { service, recipes, records, users, followings, blockings, hatady };
}

describe('Hatask recipe audiences', () => {
	test.each([
		['owner sees private drafts', recipe({ visibility: 'private', isDraft: true }), 'owner', {}, true],
		['others never see drafts', recipe({ visibility: 'specified', visibleUserIds: ['member'], isDraft: true }), 'member', {}, false],
		['private stays private', recipe({ visibility: 'private' }), 'member', { following: true }, false],
		['followers need a follow', recipe(), 'member', { following: false }, false],
		['followers can view', recipe(), 'member', { following: true }, true],
		['specified member can view', recipe({ visibility: 'specified', visibleUserIds: ['member'] }), 'member', {}, true],
		['outsider cannot view a specified recipe', recipe({ visibility: 'specified', visibleUserIds: ['member'] }), 'outsider', { following: true }, false],
		['blocking hides even a specified recipe', recipe({ visibility: 'specified', visibleUserIds: ['member'] }), 'member', { blocked: true }, false],
	] as const)('%s', async (_, stored, viewer, options, expected) => {
		const { service } = setup(options);
		expect(await service.canView(stored, viewer)).toBe(expected);
	});

	test.each(['followers', 'specified'] as const)('direct %s reads hide inactive owners just like the shared list', async visibility => {
		const { service, users } = setup({ stored: recipe({ visibility, visibleUserIds: ['member'] }), following: true, activeOwner: false });
		await expect(service.show(me('member'), 'recipe')).rejects.toMatchObject({ code: 'NO_SUCH_RECIPE' });
		expect(users.existsBy).toHaveBeenCalledWith({ id: 'owner', isDeleted: false, isSuspended: false });
	});

	test('a specified recipe without local members is rejected before insert', async () => {
		const { service, recipes } = setup({ users: 0 });
		await expect(service.create(me('owner'), input({ visibility: 'specified', visibleUserIds: [] }))).rejects.toMatchObject({ code: 'INVALID_RECIPE_AUDIENCE' });
		await expect(service.create(me('owner'), input({ visibility: 'specified', visibleUserIds: ['remote'] }))).rejects.toMatchObject({ code: 'INVALID_RECIPE_AUDIENCE' });
		expect(recipes.insertOne).not.toHaveBeenCalled();
	});

	test('a recipe cannot be public even when the service is called directly', async () => {
		const { service, recipes } = setup();
		await expect(service.create(me('owner'), input({ visibility: 'public' as never }))).rejects.toMatchObject({ code: 'INVALID_RECIPE' });
		expect(recipes.insertOne).not.toHaveBeenCalled();
	});

	test('the owner is dropped from the audience and tags are normalized', async () => {
		const { service, recipes } = setup({ users: 1 });
		await service.create(me('owner'), input({ visibility: 'specified', visibleUserIds: ['owner', 'member'], tags: ['#作りおき', '作りおき', '  ', '鶏むね'] }));
		expect(recipes.insertOne).toHaveBeenCalledWith(expect.objectContaining({ visibleUserIds: ['member'], tags: ['作りおき', '鶏むね'] }));
	});

	test('only the owner can update a recipe', async () => {
		const { service, recipes } = setup({ stored: null });
		await expect(service.update(me('member'), 'recipe', input())).rejects.toMatchObject({ code: 'NO_SUCH_RECIPE' });
		expect(recipes.findOneBy).toHaveBeenCalledWith({ id: 'recipe', userId: 'member' });
		expect(recipes.update).not.toHaveBeenCalled();
	});
});

describe('Hatask recipe reference links', () => {
	const links = [{ title: '参考', url: 'https://example.com/recipe' }];

	test('creates and shows trimmed, normalized links with optional titles and empty rows removed', async () => {
		const { service, recipes } = setup();
		const created = await service.create(me('owner'), input({ referenceLinks: [
			{ title: '  参考  ', url: '  HTTPS://EXAMPLE.COM:443/recipe  ' },
			{ url: 'http://example.org' },
			{ title: '  ', url: '  ' },
		] }));
		const expected = [...links, { title: '', url: 'http://example.org/' }];
		expect(created.referenceLinks).toEqual(expected);
		expect(recipes.insertOne).toHaveBeenCalledWith(expect.objectContaining({ referenceLinks: expected }));
		recipes.findOneBy.mockResolvedValue(recipes.insertOne.mock.calls[0][0]);
		expect((await service.show(me('owner'), created.id)).referenceLinks).toEqual(expected);
	});

	test.each([
		['saved links', links],
		['legacy recipe without the field', undefined],
	] satisfies [string, MiHataskRecipe['referenceLinks'] | undefined][])('list packs %s', async (_, referenceLinks) => {
		const stored = recipe();
		if (referenceLinks === undefined) {
			Reflect.deleteProperty(stored, 'referenceLinks');
		} else {
			stored.referenceLinks = referenceLinks;
		}
		const { service, recipes } = setup({ stored });
		const qb = {
			clone: () => qb, where: () => qb, andWhere: () => qb,
			select: () => qb, addSelect: () => qb, groupBy: () => qb,
			orderBy: () => qb, addOrderBy: () => qb, offset: () => qb, limit: () => qb,
			from: () => qb, setParameters: () => qb,
			getQuery: () => 'SELECT unnest(recipe.tags) AS tag FROM hatask_recipe recipe',
			getParameters: () => ({}), getRawMany: async () => [],
			getCount: async () => 1, getMany: async () => [stored],
		};
		Object.assign(recipes, { createQueryBuilder: vi.fn(() => qb), manager: { createQueryBuilder: vi.fn(() => qb) } });
		const result = await service.list(me('owner'), { scope: 'mine', sort: 'recent', limit: 30, offset: 0 });
		expect(result.items).toHaveLength(1);
		expect(result.items[0].referenceLinks).toEqual(referenceLinks ?? []);
	});

	test('a specified member sees reference links while audience member IDs stay hidden', async () => {
		const { service } = setup({ stored: recipe({ referenceLinks: links, visibility: 'specified', visibleUserIds: ['member'] }) });
		expect(await service.show(me('member'), 'recipe')).toMatchObject({ referenceLinks: links, visibility: 'specified', visibleUserIds: [] });
		await expect(service.show(me('outsider'), 'recipe')).rejects.toMatchObject({ code: 'NO_SUCH_RECIPE' });
	});

	test('omission during update retains links and explicit [] removes all links', async () => {
		const stored = recipe({ referenceLinks: links, visibility: 'specified', visibleUserIds: ['member'] });
		const { service, recipes } = setup({ stored, users: 1 });
		Object.assign(recipes, { findOneByOrFail: vi.fn(async () => stored) });
		recipes.update.mockImplementation(async (_id: string, values: Partial<MiHataskRecipe>) => Object.assign(stored, values));
		const audience = { visibility: 'specified', visibleUserIds: ['member'] } as const;
		const retained = await service.update(me('owner'), stored.id, input({ ...audience, visibleUserIds: [...audience.visibleUserIds] }));
		expect(retained).toMatchObject({ referenceLinks: links, visibility: 'specified', visibleUserIds: ['member'] });
		const cleared = await service.update(me('owner'), stored.id, input({ ...audience, visibleUserIds: [...audience.visibleUserIds], referenceLinks: [] }));
		expect(cleared.referenceLinks).toEqual([]);
		expect((await service.show(me('owner'), stored.id)).referenceLinks).toEqual([]);
	});

	test('an explicit new link list replaces the saved links and normalizes the replacement', async () => {
		const stored = recipe({ referenceLinks: links });
		const { service, recipes } = setup({ stored });
		Object.assign(recipes, { findOneByOrFail: vi.fn(async () => stored) });
		recipes.update.mockImplementation(async (_id: string, values: Partial<MiHataskRecipe>) => Object.assign(stored, values));
		const updated = await service.update(me('owner'), stored.id, input({ referenceLinks: [{ url: ' HTTPS://EXAMPLE.ORG:443 ' }] }));
		expect(updated.referenceLinks).toEqual([{ title: '', url: 'https://example.org/' }]);
		expect((await service.show(me('owner'), stored.id)).referenceLinks).toEqual(updated.referenceLinks);
	});

	test('new recipes without links and pre-column recipes pack and update as []', async () => {
		const legacy = recipe();
		Reflect.deleteProperty(legacy, 'referenceLinks');
		const { service, recipes } = setup({ stored: legacy });
		expect((await service.create(me('owner'), input())).referenceLinks).toEqual([]);
		expect((await service.show(me('owner'), legacy.id)).referenceLinks).toEqual([]);
		Object.assign(recipes, { findOneByOrFail: vi.fn(async () => legacy) });
		recipes.update.mockImplementation(async (_id: string, values: Partial<MiHataskRecipe>) => Object.assign(legacy, values));
		expect((await service.update(me('owner'), legacy.id, input())).referenceLinks).toEqual([]);
		expect(recipes.update).toHaveBeenCalledWith(legacy.id, expect.objectContaining({ referenceLinks: [] }));
	});

	test('accepts exactly 10 links, a 120-character title and a 2048-character normalized URL', async () => {
		const { service } = setup();
		const url = `https://example.com/${'a'.repeat(2028)}`;
		const referenceLinks = Array.from({ length: 10 }, () => ({ title: 'a'.repeat(120), url }));
		expect((await service.create(me('owner'), input({ referenceLinks }))).referenceLinks).toEqual(referenceLinks);
	});

	test('accepts unicode URLs and stores their percent-encoded form', async () => {
		const { service } = setup();
		const created = await service.create(me('owner'), input({ referenceLinks: [{ url: 'https://example.com/あ' }] }));
		expect(created.referenceLinks).toEqual([{ title: '', url: 'https://example.com/%E3%81%82' }]);
	});

	test.each([
		['javascript scheme', [{ url: 'javascript:alert(1)' }]],
		['data scheme', [{ url: 'data:text/html,test' }]],
		['file scheme', [{ url: 'file:///tmp/recipe' }]],
		['ftp scheme', [{ url: 'ftp://example.com/recipe' }]],
		['relative URL', [{ url: '/recipe' }]],
		['protocol-relative URL', [{ url: '//example.com/recipe' }]],
		['missing slashes', [{ url: 'https:example.com' }]],
		['missing hostname', [{ url: 'https://' }]],
		['malformed URL', [{ url: 'https://[invalid]' }]],
		['username', [{ url: 'https://user@example.com/recipe' }]],
		['password', [{ url: 'https://:secret@example.com/recipe' }]],
		['encoded credentials', [{ url: 'https://%75ser:%70ass@example.com/recipe' }]],
		['title-only row', [{ title: '参考', url: '  ' }]],
		['11 links', Array.from({ length: 11 }, () => ({ url: 'https://example.com' }))],
		['121-character title', [{ title: 'a'.repeat(121), url: 'https://example.com' }]],
		['2049-character URL', [{ url: `https://example.com/${'a'.repeat(2029)}` }]],
		['URL exceeds limit after normalization', [{ url: `https://example.com/${'あ'.repeat(230)}` }]],
	] satisfies [string, NonNullable<HataskRecipeInput['referenceLinks']>][])('rejects %s before create or update writes', async (_, referenceLinks) => {
		const { service, recipes } = setup();
		await expect(service.create(me('owner'), input({ referenceLinks }))).rejects.toMatchObject({ code: 'INVALID_RECIPE' });
		await expect(service.update(me('owner'), 'recipe', input({ referenceLinks }))).rejects.toMatchObject({ code: 'INVALID_RECIPE' });
		expect(recipes.insertOne).not.toHaveBeenCalled();
		expect(recipes.update).not.toHaveBeenCalled();
	});
});

describe('Hatask cooking records', () => {
	test('direct detail lookup is owner scoped and reuses the complete record pack', async () => {
		const { service, records } = setup();
		records.findOneBy.mockResolvedValueOnce({
			id: 'record', userId: 'owner', createdAt: new Date('2026-09-22T19:42:00Z'), cookedAt: new Date('2026-09-22T20:00:00Z'),
			recipeId: 'recipe', title: '夕食', durationSeconds: 1200, servings: 2, mealSlot: 'dinner', cost: 620,
			memo: '記録', fileId: null, visibility: 'private', visibleUserIds: [], hatadyLogId: 'log',
		});
		await expect(service.showCookingRecord(me('owner'), 'record')).resolves.toMatchObject({ id: 'record', title: '夕食', memo: '記録', cookedAt: '2026-09-22T20:00:00.000Z' });
		expect(records.findOneBy).toHaveBeenCalledWith({ id: 'record', userId: 'owner' });
		records.findOneBy.mockResolvedValueOnce(null);
		await expect(service.showCookingRecord(me('outsider'), 'record')).resolves.toBeNull();
		expect(records.findOneBy).toHaveBeenLastCalledWith({ id: 'record', userId: 'outsider' });
	});

	test.each([
		['public', 'public'],
		['followers', 'followers'],
		['private', 'private'],
		['specified', 'private'],
	] as const)('%s cooking visibility is saved and mirrored as %s', async (visibility, hatadyVisibility) => {
		const { service, records, hatady } = setup({ users: 1 });
		const record = await service.createCookingRecord(me('owner'), cooking({
			visibility,
			visibleUserIds: visibility === 'specified' ? ['member'] : [],
		}));
		expect(records.insertOne).toHaveBeenCalledWith(expect.objectContaining({
			visibility,
			visibleUserIds: visibility === 'specified' ? ['member'] : [],
		}));
		expect(hatady.createLog).toHaveBeenCalledWith(me('owner'), expect.objectContaining({ visibility: hatadyVisibility }));
		expect(record.visibility).toBe(visibility);
	});

	test('invalid cooking visibility is rejected before either record is written', async () => {
		const { service, records, hatady } = setup();
		await expect(service.createCookingRecord(me('owner'), cooking({ visibility: 'invalid' as never }))).rejects.toMatchObject({ code: 'INVALID_RECIPE' });
		expect(records.insertOne).not.toHaveBeenCalled();
		expect(hatady.createLog).not.toHaveBeenCalled();
	});

	test('a record is mirrored to Hatady as a cooking log under the recipe category', async () => {
		const { service, records, hatady } = setup();
		const result = await service.createCookingRecord(me('owner'), cooking());
		expect(hatady.createLog).toHaveBeenCalledWith(me('owner'), expect.objectContaining({
			kind: 'cooking', title: '鶏むねのねぎ塩だれ', subject: '主菜', body: '塩は控えめ', durationSeconds: 28 * 60, visibility: 'private', fileIds: [],
		}));
		expect(records.insertOne).toHaveBeenCalledWith(expect.objectContaining({ recipeId: 'recipe', hatadyLogId: 'log', mealSlot: 'dinner', cost: 620 }));
		expect(result).toMatchObject({ hatadyLogId: 'log', title: '鶏むねのねぎ塩だれ' });
	});

	test('member-specific records stay private in Hatady', async () => {
		const { service, hatady } = setup({ users: 1 });
		await service.createCookingRecord(me('owner'), cooking({ visibility: 'specified', visibleUserIds: ['member'] }));
		expect(hatady.createLog).toHaveBeenCalledWith(me('owner'), expect.objectContaining({ visibility: 'private' }));
	});

	test('a recipe the cook cannot see is rejected before any Hatady write', async () => {
		const { service, hatady, records } = setup({ stored: recipe({ visibility: 'private' }) });
		await expect(service.createCookingRecord(me('outsider'), cooking())).rejects.toMatchObject({ code: 'NO_SUCH_RECIPE' });
		expect(hatady.createLog).not.toHaveBeenCalled();
		expect(records.insertOne).not.toHaveBeenCalled();
	});

	test('a failed Hatask insert removes the Hatady log it created', async () => {
		const { service, records, hatady } = setup();
		records.insertOne.mockRejectedValueOnce(new Error('insert failed'));
		await expect(service.createCookingRecord(me('owner'), cooking())).rejects.toThrow('insert failed');
		expect(hatady.deleteLog).toHaveBeenCalledWith(me('owner'), 'log');
	});

	test('deleting a record also deletes its Hatady log', async () => {
		const { service, records, hatady } = setup();
		records.findOneBy.mockResolvedValue({ id: 'record', userId: 'owner', hatadyLogId: 'log' });
		await service.deleteCookingRecord(me('owner'), 'record');
		expect(records.findOneBy).toHaveBeenCalledWith({ id: 'record', userId: 'owner' });
		expect(records.delete).toHaveBeenCalledWith('record');
		expect(hatady.deleteLog).toHaveBeenCalledWith(me('owner'), 'log');
	});
});
