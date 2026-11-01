/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets, In, IsNull } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type {
	BlockingsRepository,
	DriveFilesRepository,
	FollowingsRepository,
	HataskCookingRecordsRepository,
	HataskRecipesRepository,
	MiDriveFile,
	MiUser,
	UsersRepository,
} from '@/models/_.js';
import {
	HATASK_RECIPE_CATEGORIES,
	HATASK_RECIPE_VISIBILITIES,
	type HataskRecipeCategory,
	type HataskRecipeIngredient,
	type HataskRecipeReferenceLink,
	type HataskRecipeStep,
	type HataskRecipeVisibility,
	type MiHataskRecipe,
} from '@/models/HataskRecipe.js';
import { HATASK_COOKING_MEAL_SLOTS, HATASK_COOKING_VISIBILITIES, type HataskCookingMealSlot, type HataskCookingVisibility, type MiHataskCookingRecord } from '@/models/HataskCookingRecord.js';
import { ApiError } from '@/server/api/error.js';
import { IdService } from '@/core/IdService.js';
import { HatadyService } from '@/core/HatadyService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { bindThis } from '@/decorators.js';

export const HATASK_RECIPE_ERRORS = {
	noSuchRecipe: { message: 'No such recipe.', code: 'NO_SUCH_RECIPE', id: 'b8a7ec88-9176-4e16-a908-2144e9035b30' },
	noSuchRecord: { message: 'No such cooking record.', code: 'NO_SUCH_COOKING_RECORD', id: '9db03d0b-1ce9-4ea4-98fc-8eebf6205661' },
	invalidAudience: { message: 'Select between 1 and 100 local members.', code: 'INVALID_RECIPE_AUDIENCE', id: '07b819e6-5efc-469a-8bc2-b56fb10a02da' },
	invalidFile: { message: 'The photo must be an image in your drive.', code: 'INVALID_RECIPE_PHOTO', id: '3755e51b-c035-4376-8285-6c10470d7e63' },
	invalidRecipe: { message: 'The recipe content is invalid.', code: 'INVALID_RECIPE', id: '6f776518-74c1-4c9a-b131-62fc0af48f3f' },
	hatadyFailed: { message: 'Could not save the Hatady cooking log.', code: 'HATADY_COOKING_LOG_FAILED', id: '49b082f5-92cf-4c34-bc26-70602885dab2' },
} as const;

export const HATASK_RECIPE_LIMITS = {
	title: 128,
	summary: 512,
	ingredients: 60,
	ingredientName: 64,
	ingredientAmount: 32,
	steps: 40,
	stepText: 1000,
	timerLabel: 32,
	referenceLinks: 10,
	referenceLinkTitle: 120,
	referenceLinkUrl: 2048,
	tags: 10,
	tag: 32,
	memo: 2000,
} as const;

/** Hatady groups logs by subject, so a cooking log is filed under the recipe's category. */
const CATEGORY_SUBJECTS: Record<HataskRecipeCategory, string> = {
	main: '主菜',
	side: '副菜',
	soup: '汁物',
	staple: '主食',
	dessert: 'デザート',
};

export type HataskRecipeScope = 'mine' | 'shared';
export type HataskRecipeSort = 'cooked' | 'recent' | 'title';

export type HataskRecipeInput = {
	title: string;
	summary: string;
	category: HataskRecipeCategory;
	servings: number;
	minutes: number | null;
	scalable: boolean;
	ingredients: HataskRecipeIngredient[];
	steps: HataskRecipeStep[];
	referenceLinks?: { title?: string; url: string }[];
	tags: string[];
	fileId: string | null;
	visibility: HataskRecipeVisibility;
	visibleUserIds: string[];
	isDraft: boolean;
};

export type HataskCookingRecordInput = {
	recipeId: string | null;
	title?: string;
	cookedAt: Date;
	durationSeconds: number | null;
	servings: number;
	mealSlot: HataskCookingMealSlot | null;
	cost: number | null;
	memo: string;
	fileId: string | null;
	visibility: HataskCookingVisibility;
	visibleUserIds: string[];
	recordToHatady: boolean;
};

type CookedStats = { count: number; lastCookedAt: Date | null };

@Injectable()
export class HataskRecipeService {
	constructor(
		@Inject(DI.hataskRecipesRepository) private recipes: HataskRecipesRepository,
		@Inject(DI.hataskCookingRecordsRepository) private records: HataskCookingRecordsRepository,
		@Inject(DI.usersRepository) private users: UsersRepository,
		@Inject(DI.followingsRepository) private followings: FollowingsRepository,
		@Inject(DI.blockingsRepository) private blockings: BlockingsRepository,
		@Inject(DI.driveFilesRepository) private driveFiles: DriveFilesRepository,
		private idService: IdService,
		private hatadyService: HatadyService,
		private driveFileEntityService: DriveFileEntityService,
		private userEntityService: UserEntityService,
	) {}

	@bindThis
	public async canView(recipe: MiHataskRecipe, viewerId: MiUser['id']): Promise<boolean> {
		if (recipe.userId === viewerId) return true;
		if (recipe.isDraft) return false;
		if (!await this.users.existsBy({ id: recipe.userId, isDeleted: false, isSuspended: false })) return false;
		if (await this.blockings.exists({ where: [{ blockerId: viewerId, blockeeId: recipe.userId }, { blockerId: recipe.userId, blockeeId: viewerId }] })) return false;
		if (recipe.visibility === 'specified') return recipe.visibleUserIds.includes(viewerId);
		if (recipe.visibility === 'followers') return await this.followings.exists({ where: { followerId: viewerId, followeeId: recipe.userId } });
		return false;
	}

	private applyScope(qb: SelectQueryBuilder<MiHataskRecipe>, me: MiUser, scope: HataskRecipeScope): void {
		if (scope === 'mine') {
			qb.where('recipe.userId = :me', { me: me.id });
			return;
		}
		qb.where('recipe.userId <> :me', { me: me.id })
			.andWhere('recipe.isDraft = FALSE')
			.andWhere(new Brackets(audience => {
				audience.where(`recipe.visibility = 'followers' AND EXISTS (
					SELECT 1 FROM "following" "recipe_follow"
					WHERE "recipe_follow"."followerId" = :me AND "recipe_follow"."followeeId" = recipe."userId"
				)`).orWhere('recipe.visibility = \'specified\' AND :me = ANY(recipe."visibleUserIds")');
			}))
			.andWhere(`NOT EXISTS (
				SELECT 1 FROM "blocking" "recipe_block"
				WHERE ("recipe_block"."blockerId" = :me AND "recipe_block"."blockeeId" = recipe."userId")
				OR ("recipe_block"."blockerId" = recipe."userId" AND "recipe_block"."blockeeId" = :me)
			)`)
			.andWhere(`EXISTS (
				SELECT 1 FROM "user" "recipe_owner"
				WHERE "recipe_owner"."id" = recipe."userId" AND "recipe_owner"."isSuspended" = FALSE AND "recipe_owner"."isDeleted" = FALSE
			)`);
	}

	@bindThis
	public async list(me: MiUser, options: { scope: HataskRecipeScope; category?: HataskRecipeCategory | null; tag?: string | null; query?: string | null; sort: HataskRecipeSort; limit: number; offset: number }) {
		const base = this.recipes.createQueryBuilder('recipe');
		this.applyScope(base, me, options.scope);

		const filtered = base.clone();
		if (options.category) filtered.andWhere('recipe.category = :category', { category: options.category });
		if (options.tag) filtered.andWhere(':tag = ANY(recipe.tags)', { tag: options.tag });
		const query = options.query?.trim();
		if (query) {
			filtered.andWhere(new Brackets(search => {
				search.where('recipe.title ILIKE :q')
					.orWhere('recipe.summary ILIKE :q')
					.orWhere('recipe.ingredients::text ILIKE :q')
					.orWhere('array_to_string(recipe.tags, \' \') ILIKE :q');
			}), { q: `%${sqlLikeEscape(query)}%` });
		}

		const total = await filtered.getCount();
		if (options.sort === 'title') {
			filtered.orderBy('recipe.title', 'ASC');
		} else if (options.sort === 'cooked') {
			filtered.orderBy('(SELECT COUNT(*) FROM "hatask_cooking_record" "sort_record" WHERE "sort_record"."recipeId" = recipe.id AND "sort_record"."userId" = :me)', 'DESC');
		} else {
			filtered.orderBy('recipe.updatedAt', 'DESC');
		}
		const rows = await filtered.addOrderBy('recipe.updatedAt', 'DESC').addOrderBy('recipe.id', 'DESC')
			.offset(options.offset).limit(options.limit).getMany();

		const categoryRows = await base.clone().select('recipe.category', 'category').addSelect('COUNT(*)', 'count').groupBy('recipe.category').getRawMany<{ category: HataskRecipeCategory; count: string }>();
		const counts = Object.fromEntries(HATASK_RECIPE_CATEGORIES.map(category => [category, Number(categoryRows.find(row => row.category === category)?.count ?? 0)])) as Record<HataskRecipeCategory, number>;

		const tagSource = base.clone().select('unnest(recipe.tags)', 'tag');
		const tagRows = await this.recipes.manager.createQueryBuilder()
			.select('recipe_tag.tag', 'tag').addSelect('COUNT(*)', 'count')
			.from(`(${tagSource.getQuery()})`, 'recipe_tag')
			.setParameters(tagSource.getParameters())
			.groupBy('recipe_tag.tag').orderBy('count', 'DESC').addOrderBy('recipe_tag.tag', 'ASC').limit(12)
			.getRawMany<{ tag: string }>();

		return {
			items: await this.packMany(rows, me),
			total,
			counts: { all: Object.values(counts).reduce((sum, count) => sum + count, 0), ...counts },
			tags: tagRows.map(row => row.tag),
		};
	}

	@bindThis
	public async show(me: MiUser, recipeId: string) {
		const recipe = await this.findViewable(me, recipeId);
		return (await this.packMany([recipe], me))[0];
	}

	@bindThis
	public async create(me: MiUser, input: HataskRecipeInput) {
		const values = await this.normalizeRecipe(me, input);
		const now = new Date();
		const recipe = await this.recipes.insertOne({ id: this.idService.gen(now.getTime()), createdAt: now, updatedAt: now, userId: me.id, ...values });
		return (await this.packMany([recipe], me))[0];
	}

	@bindThis
	public async update(me: MiUser, recipeId: string, input: HataskRecipeInput) {
		const recipe = await this.recipes.findOneBy({ id: recipeId, userId: me.id });
		if (recipe == null) throw new ApiError(HATASK_RECIPE_ERRORS.noSuchRecipe);
		const values = await this.normalizeRecipe(me, input, recipe);
		await this.recipes.update(recipe.id, { ...values, updatedAt: new Date() });
		return (await this.packMany([await this.recipes.findOneByOrFail({ id: recipe.id })], me))[0];
	}

	@bindThis
	public async delete(me: MiUser, recipeId: string): Promise<void> {
		const result = await this.recipes.delete({ id: recipeId, userId: me.id });
		if (!result.affected) throw new ApiError(HATASK_RECIPE_ERRORS.noSuchRecipe);
	}

	@bindThis
	public async createCookingRecord(me: MiUser, input: HataskCookingRecordInput) {
		const recipe = input.recipeId ? await this.findViewable(me, input.recipeId) : null;
		const title = (recipe?.title ?? input.title ?? '').trim();
		if (title.length === 0 || title.length > HATASK_RECIPE_LIMITS.title) throw new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		if (Number.isNaN(input.cookedAt.getTime())) throw new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		if (input.mealSlot != null && !HATASK_COOKING_MEAL_SLOTS.includes(input.mealSlot)) throw new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		if (!HATASK_COOKING_VISIBILITIES.includes(input.visibility)) throw new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		const file = await this.validatePhoto(me, input.fileId);
		const visibleUserIds = await this.validateAudience(me, input.visibility, input.visibleUserIds);
		const memo = input.memo.trim().slice(0, HATASK_RECIPE_LIMITS.memo);

		let hatadyLogId: string | null = null;
		if (input.recordToHatady) {
			try {
				const log = await this.hatadyService.createLog(me, {
					kind: 'cooking',
					title,
					subject: recipe ? CATEGORY_SUBJECTS[recipe.category] : '料理',
					body: memo || null,
					durationSeconds: input.durationSeconds,
					studiedAt: input.cookedAt,
					// Hatady has no member-specific audience, so specified records stay private there.
					visibility: input.visibility === 'specified' ? 'private' : input.visibility,
					fileIds: file ? [file.id] : [],
				});
				hatadyLogId = log.id;
			} catch {
				throw new ApiError(HATASK_RECIPE_ERRORS.hatadyFailed);
			}
		}

		const now = new Date();
		try {
			const record = await this.records.insertOne({
				id: this.idService.gen(now.getTime()),
				createdAt: now,
				cookedAt: input.cookedAt,
				userId: me.id,
				recipeId: recipe?.id ?? null,
				title,
				durationSeconds: input.durationSeconds,
				servings: input.servings,
				mealSlot: input.mealSlot,
				cost: input.cost,
				memo,
				fileId: file?.id ?? null,
				visibility: input.visibility,
				visibleUserIds,
				hatadyLogId,
			});
			return await this.packRecord(record);
		} catch (error) {
			// Do not leave an orphaned Hatady log when the Hatask side could not be saved.
			if (hatadyLogId) await this.hatadyService.deleteLog(me, hatadyLogId).catch(() => {});
			throw error;
		}
	}

	@bindThis
	public async listCookingRecords(me: MiUser, options: { recipeId?: string | null; query?: string | null; limit: number; offset: number }) {
		const qb = this.records.createQueryBuilder('record').where('record.userId = :me', { me: me.id });
		if (options.recipeId) qb.andWhere('record.recipeId = :recipeId', { recipeId: options.recipeId });
		const query = options.query?.trim();
		if (query) qb.andWhere('(record.title ILIKE :q OR record.memo ILIKE :q)', { q: `%${sqlLikeEscape(query)}%` });
		const rows = await qb.orderBy('record.cookedAt', 'DESC').addOrderBy('record.id', 'DESC').offset(options.offset).limit(options.limit).getMany();
		return await Promise.all(rows.map(row => this.packRecord(row)));
	}

	@bindThis
	public async showCookingRecord(me: MiUser, recordId: string) {
		const record = await this.records.findOneBy({ id: recordId, userId: me.id });
		return record == null ? null : await this.packRecord(record);
	}

	@bindThis
	public async deleteCookingRecord(me: MiUser, recordId: string): Promise<void> {
		const record = await this.records.findOneBy({ id: recordId, userId: me.id });
		if (record == null) throw new ApiError(HATASK_RECIPE_ERRORS.noSuchRecord);
		await this.records.delete(record.id);
		if (record.hatadyLogId) await this.hatadyService.deleteLog(me, record.hatadyLogId).catch(() => {});
	}

	private async findViewable(me: MiUser, recipeId: string): Promise<MiHataskRecipe> {
		const recipe = await this.recipes.findOneBy({ id: recipeId });
		if (recipe == null || !(await this.canView(recipe, me.id))) throw new ApiError(HATASK_RECIPE_ERRORS.noSuchRecipe);
		return recipe;
	}

	private async normalizeRecipe(me: MiUser, input: HataskRecipeInput, previous?: MiHataskRecipe) {
		const invalid = () => new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		const title = input.title.trim();
		if (title.length === 0 || title.length > HATASK_RECIPE_LIMITS.title) throw invalid();
		if (!HATASK_RECIPE_CATEGORIES.includes(input.category) || !HATASK_RECIPE_VISIBILITIES.includes(input.visibility)) throw invalid();
		const ingredients = input.ingredients
			.map(item => ({ name: item.name.trim(), amount: item.amount.trim() }))
			.filter(item => item.name.length > 0);
		if (ingredients.length > HATASK_RECIPE_LIMITS.ingredients) throw invalid();
		const steps = input.steps
			.map(step => ({ text: step.text.trim(), timerSeconds: step.timerSeconds && step.timerSeconds > 0 ? Math.floor(step.timerSeconds) : null, timerLabel: step.timerLabel.trim() }))
			.filter(step => step.text.length > 0);
		if (steps.length > HATASK_RECIPE_LIMITS.steps) throw invalid();
		const referenceLinks = input.referenceLinks === undefined
			? previous?.referenceLinks ?? []
			: this.normalizeReferenceLinks(input.referenceLinks);
		const tags = [...new Set(input.tags.map(tag => tag.trim().replace(/^#+/, '').trim()).filter(tag => tag.length > 0))];
		if (tags.length > HATASK_RECIPE_LIMITS.tags || tags.some(tag => tag.length > HATASK_RECIPE_LIMITS.tag)) throw invalid();
		const file = input.fileId === previous?.fileId && input.fileId != null ? { id: input.fileId } : await this.validatePhoto(me, input.fileId);
		return {
			title,
			summary: input.summary.trim(),
			category: input.category,
			servings: input.servings,
			minutes: input.minutes,
			scalable: input.scalable,
			ingredients,
			steps,
			referenceLinks,
			tags,
			fileId: file?.id ?? null,
			visibility: input.visibility,
			visibleUserIds: await this.validateAudience(me, input.visibility, input.visibleUserIds),
			isDraft: input.isDraft,
		};
	}

	private normalizeReferenceLinks(links: NonNullable<HataskRecipeInput['referenceLinks']>): HataskRecipeReferenceLink[] {
		const invalid = () => new ApiError(HATASK_RECIPE_ERRORS.invalidRecipe);
		if (!Array.isArray(links) || links.length > HATASK_RECIPE_LIMITS.referenceLinks) throw invalid();
		const normalized: HataskRecipeReferenceLink[] = [];
		for (const link of links) {
			if (link == null || typeof link.url !== 'string' || (link.title !== undefined && typeof link.title !== 'string')) throw invalid();
			const title = (link.title ?? '').trim();
			const url = link.url.trim();
			if (title === '' && url === '') continue;
			if (title.length > HATASK_RECIPE_LIMITS.referenceLinkTitle || url.length > HATASK_RECIPE_LIMITS.referenceLinkUrl || !/^https?:\/\//i.test(url)) throw invalid();
			let parsed: URL;
			try {
				parsed = new URL(url);
			} catch {
				throw invalid();
			}
			if (!parsed.hostname || parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol) || parsed.href.length > HATASK_RECIPE_LIMITS.referenceLinkUrl) throw invalid();
			normalized.push({ title, url: parsed.href });
		}
		return normalized;
	}

	private async validatePhoto(me: MiUser, fileId: string | null): Promise<MiDriveFile | null> {
		if (fileId == null) return null;
		const file = await this.driveFiles.findOneBy({ id: fileId, userId: me.id });
		if (file == null || !file.type.startsWith('image/')) throw new ApiError(HATASK_RECIPE_ERRORS.invalidFile);
		return file;
	}

	private async validateAudience(me: MiUser, visibility: HataskCookingVisibility, visibleUserIds: string[]): Promise<string[]> {
		if (visibility !== 'specified') return [];
		const ids = [...new Set(visibleUserIds)].filter(id => id !== me.id);
		if (ids.length === 0 || ids.length > 100) throw new ApiError(HATASK_RECIPE_ERRORS.invalidAudience);
		const count = await this.users.countBy({ id: In(ids), host: IsNull(), isDeleted: false, isSuspended: false });
		if (count !== ids.length) throw new ApiError(HATASK_RECIPE_ERRORS.invalidAudience);
		return ids;
	}

	private async cookedStats(me: MiUser, recipeIds: string[]): Promise<Map<string, CookedStats>> {
		if (recipeIds.length === 0) return new Map();
		const rows = await this.records.createQueryBuilder('record')
			.select('record.recipeId', 'recipeId').addSelect('COUNT(*)', 'count').addSelect('MAX(record.cookedAt)', 'lastCookedAt')
			.where('record.userId = :me', { me: me.id }).andWhere('record.recipeId IN (:...recipeIds)', { recipeIds })
			.groupBy('record.recipeId')
			.getRawMany<{ recipeId: string; count: string; lastCookedAt: Date | string | null }>();
		return new Map(rows.map(row => [row.recipeId, { count: Number(row.count), lastCookedAt: row.lastCookedAt == null ? null : new Date(row.lastCookedAt) }]));
	}

	private async packPhoto(fileId: string | null) {
		if (fileId == null) return null;
		const file = await this.driveFiles.findOneBy({ id: fileId });
		if (file == null) return null;
		return { id: file.id, url: this.driveFileEntityService.getPublicUrl(file), thumbnailUrl: this.driveFileEntityService.getThumbnailUrl(file) };
	}

	private async packMany(recipes: MiHataskRecipe[], me: MiUser) {
		const [stats, users] = await Promise.all([
			this.cookedStats(me, recipes.map(recipe => recipe.id)),
			this.userEntityService.packMany([...new Set(recipes.map(recipe => recipe.userId))], me),
		]);
		const usersById = new Map(users.map(user => [user.id, user]));
		return await Promise.all(recipes.map(async recipe => {
			const mine = recipe.userId === me.id;
			const cooked = stats.get(recipe.id);
			return {
				id: recipe.id,
				createdAt: recipe.createdAt.toISOString(),
				updatedAt: recipe.updatedAt.toISOString(),
				userId: recipe.userId,
				user: usersById.get(recipe.userId)!,
				isMine: mine,
				title: recipe.title,
				summary: recipe.summary,
				category: recipe.category,
				servings: recipe.servings,
				minutes: recipe.minutes,
				scalable: recipe.scalable,
				ingredients: recipe.ingredients,
				steps: recipe.steps,
				referenceLinks: recipe.referenceLinks ?? [],
				tags: recipe.tags,
				photo: await this.packPhoto(recipe.fileId),
				visibility: recipe.visibility,
				// Only the owner needs to know who else can see the recipe.
				visibleUserIds: mine ? recipe.visibleUserIds : [],
				isDraft: recipe.isDraft,
				cookedCount: cooked?.count ?? 0,
				lastCookedAt: cooked?.lastCookedAt?.toISOString() ?? null,
			};
		}));
	}

	private async packRecord(record: MiHataskCookingRecord) {
		return {
			id: record.id,
			createdAt: record.createdAt.toISOString(),
			cookedAt: record.cookedAt.toISOString(),
			recipeId: record.recipeId,
			title: record.title,
			durationSeconds: record.durationSeconds,
			servings: record.servings,
			mealSlot: record.mealSlot,
			cost: record.cost,
			memo: record.memo,
			photo: await this.packPhoto(record.fileId),
			visibility: record.visibility,
			visibleUserIds: record.visibleUserIds,
			hatadyLogId: record.hatadyLogId,
		};
	}
}
