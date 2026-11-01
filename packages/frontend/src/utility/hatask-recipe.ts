/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatask._recipe;

export type HataskRecipe = Misskey.Endpoints['hatask/recipes/show']['res'];
export type HataskRecipeList = Misskey.Endpoints['hatask/recipes/list']['res'];
export type HataskCookingRecord = Misskey.Endpoints['hatask/recipes/cooked/create']['res'];
export type HataskRecipeCategory = HataskRecipe['category'];
export type HataskRecipeVisibility = HataskRecipe['visibility'];
export type HataskCookingVisibility = HataskCookingRecord['visibility'];
export type HataskCookingMealSlot = NonNullable<HataskCookingRecord['mealSlot']>;

/** Validate and normalize a reference URL without accessing the external site. */
export function normalizeRecipeReferenceUrl(value: string): string | null {
	const text = value.trim();
	if (text.length > 2048 || !/^https?:\/\//i.test(text)) return null;
	try {
		const url = new URL(text);
		if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
		return url.href.length <= 2048 ? url.href : null;
	} catch {
		return null;
	}
}

export const HATASK_RECIPE_CATEGORIES: { id: HataskRecipeCategory; label: string }[] = [
	{ id: 'main', label: copy.categoryMain },
	{ id: 'side', label: copy.categorySide },
	{ id: 'soup', label: copy.categorySoup },
	{ id: 'staple', label: copy.categoryStaple },
	{ id: 'dessert', label: copy.categoryDessert },
];

export const HATASK_RECIPE_VISIBILITIES: { id: HataskRecipeVisibility; label: string; icon: string }[] = [
	{ id: 'private', label: copy.visibilityPrivate, icon: 'ti ti-lock' },
	{ id: 'followers', label: copy.visibilityFollowers, icon: 'ti ti-user-check' },
	{ id: 'specified', label: copy.visibilitySpecified, icon: 'ti ti-users' },
];

export const HATASK_COOKING_VISIBILITIES: { id: HataskCookingVisibility; label: string; icon: string }[] = [
	{ id: 'public', label: copy.visibilityPublic, icon: 'ti ti-world' },
	...HATASK_RECIPE_VISIBILITIES,
];

export const HATASK_COOKING_MEAL_SLOTS: { id: HataskCookingMealSlot; label: string; icon: string }[] = [
	{ id: 'breakfast', label: copy.mealBreakfast, icon: 'ti ti-sunrise' },
	{ id: 'lunch', label: copy.mealLunch, icon: 'ti ti-sun' },
	{ id: 'dinner', label: copy.mealDinner, icon: 'ti ti-moon' },
	{ id: 'snack', label: copy.mealSnack, icon: 'ti ti-cookie' },
];

export function recipeCategoryLabel(category: HataskRecipeCategory): string {
	return HATASK_RECIPE_CATEGORIES.find(item => item.id === category)?.label ?? category;
}

export function recipeVisibility(visibility: HataskRecipeVisibility) {
	return HATASK_RECIPE_VISIBILITIES.find(item => item.id === visibility) ?? HATASK_RECIPE_VISIBILITIES[0];
}

const FRACTIONS: [number, string][] = [[0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4']];
// Historical 「1と1/2」 and localized 「1 1/2」「1又1/2」 all remain editable.
const QUANTITY = /(\d+(?:\.\d+)?)(?:\s*と\s*|\s*又\s*|\s+)(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)/;

function formatQuantity(value: number): string {
	// グラムなどの大きい数は分数にせず整数に丸める。
	if (value >= 10) return String(Math.round(value));
	const whole = Math.floor(value + 1e-9);
	const rest = value - whole;
	if (rest < 0.02) return String(whole);
	const fraction = FRACTIONS.find(([number]) => Math.abs(number - rest) < 0.02);
	if (fraction) return whole > 0 ? `${whole}${i18n.ts._hata._hatask._recipe.mixedFractionSeparator}${fraction[1]}` : fraction[1];
	return String(Math.round(value * 10) / 10);
}

/**
 * Scales the first quantity in a free-text amount such as "大さじ2" or "1/4個".
 * Amounts without a number ("少々", "適量") are returned unchanged.
 */
export function scaleRecipeAmount(amount: string, ratio: number): string {
	if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 1e-9) return amount;
	const match = QUANTITY.exec(amount);
	if (match == null) return amount;
	let value: number;
	if (match[1] != null) value = Number(match[1]) + Number(match[2]) / Number(match[3]);
	else if (match[4] != null) value = Number(match[4]) / Number(match[5]);
	else value = Number(match[6]);
	if (!Number.isFinite(value) || value <= 0) return amount;
	return amount.slice(0, match.index) + formatQuantity(value * ratio) + amount.slice(match.index + match[0].length);
}

/** "10:00" style label used on step timers. */
export function formatRecipeTimer(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	const mmss = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
	return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** Parses "10", "10:00" or "1:05:00" typed by the author into seconds. */
export function parseRecipeTimer(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return null;
	if (/^\d+$/.test(trimmed)) return Number(trimmed) > 0 ? Number(trimmed) * 60 : null;
	const parts = trimmed.split(':');
	if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) return null;
	const [h, m, s] = parts.length === 3 ? parts.map(Number) : [0, ...parts.map(Number)];
	const seconds = h * 3600 + m * 60 + s;
	return seconds > 0 && seconds <= 86400 ? seconds : null;
}

export function formatCookingDuration(seconds: number | null): string {
	if (seconds == null) return '';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return i18n.tsx._hata._hatask._recipe.minutes({ minutes: String(minutes) });
	return minutes % 60 ? i18n.tsx._hata._hatask._recipe.hoursMinutes({ hours: String(Math.floor(minutes / 60)), minutes: String(minutes % 60) }) : i18n.tsx._hata._hatask._recipe.hours({ hours: String(Math.floor(minutes / 60)) });
}
