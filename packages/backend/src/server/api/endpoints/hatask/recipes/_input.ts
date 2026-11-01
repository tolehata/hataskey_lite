/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskRecipeCategory, HataskRecipeVisibility } from '@/models/HataskRecipe.js';
import type { HataskRecipeInput } from '@/core/HataskRecipeService.js';

type RecipeParams = {
	title: string;
	summary?: string;
	category?: HataskRecipeCategory;
	servings?: number;
	minutes?: number | null;
	scalable?: boolean;
	ingredients?: { name: string; amount?: string }[];
	steps?: { text: string; timerSeconds?: number | null; timerLabel?: string }[];
	referenceLinks?: { title?: string; url: string }[];
	tags?: string[];
	fileId?: string | null;
	isDraft?: boolean;
	visibility?: HataskRecipeVisibility;
	visibleUserIds?: string[];
};

export function toRecipeInput(ps: RecipeParams): HataskRecipeInput {
	return {
		title: ps.title,
		summary: ps.summary ?? '',
		category: ps.category ?? 'main',
		servings: ps.servings ?? 2,
		minutes: ps.minutes ?? null,
		scalable: ps.scalable ?? true,
		ingredients: (ps.ingredients ?? []).map(item => ({ name: item.name, amount: item.amount ?? '' })),
		steps: (ps.steps ?? []).map(step => ({ text: step.text, timerSeconds: step.timerSeconds ?? null, timerLabel: step.timerLabel ?? '' })),
		referenceLinks: ps.referenceLinks?.map(link => ({ title: link.title ?? '', url: link.url })),
		tags: ps.tags ?? [],
		fileId: ps.fileId ?? null,
		isDraft: ps.isDraft ?? false,
		visibility: ps.visibility ?? 'private',
		visibleUserIds: ps.visibleUserIds ?? [],
	};
}
