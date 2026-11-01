/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskFlower = {
	id: string;
	emoji: string;
	name: string;
	speciesId?: string;
	rare?: boolean;
	progress: number;
	totalMinutes: number;
	targetMinutes: number;
	date?: string;
	harvestedAt?: string;
	hanakotoba?: string;
};

const FALLBACK_FLOWER: HataskFlower = {
	id: 'growing',
	emoji: '🌱',
	name: 'わかば',
	progress: 0,
	totalMinutes: 0,
	targetMinutes: 1200,
};

function safeText(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeGrowingFlower(value: unknown): HataskFlower {
	if (value == null || typeof value !== 'object') return { ...FALLBACK_FLOWER };
	const flower = value as Record<string, unknown>;
	const targetMinutes = Math.max(480, Math.min(flower.rare === true ? 5760 : 1920, Math.floor(safeNumber(flower.targetMinutes, 1200))));
	const totalMinutes = Math.max(0, Math.min(targetMinutes, Math.floor(safeNumber(flower.totalMinutes))));
	return {
		id: 'growing',
		emoji: safeText(flower.emoji, FALLBACK_FLOWER.emoji),
		name: safeText(flower.name, FALLBACK_FLOWER.name),
		...(typeof flower.speciesId === 'string' && flower.speciesId.trim() ? { speciesId: safeText(flower.speciesId, '') } : {}),
		...(typeof flower.rare === 'boolean' ? { rare: flower.rare } : {}),
		progress: Math.max(0, Math.min(100, Math.floor((totalMinutes / targetMinutes) * 100))),
		totalMinutes,
		targetMinutes,
	};
}

export function normalizeFlowerGallery(value: unknown, limit: number, unnamedFlowerName = '名前のない花'): HataskFlower[] {
	if (!Array.isArray(value)) return [];
	const requestedLimit = Number.isFinite(limit) ? Math.round(limit) : 5;
	const safeLimit = Math.max(1, Math.min(12, requestedLimit));
	const safeUnnamedFlowerName = safeText(unnamedFlowerName, '名前のない花');
	return value
		.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
		.slice(0, safeLimit)
		.map((item, index) => ({
			id: safeText(item.id, `flower-${index}`),
			emoji: safeText(item.emoji, '🌼'),
			name: safeText(item.name, safeUnnamedFlowerName),
			...(typeof item.speciesId === 'string' && item.speciesId.trim() ? { speciesId: safeText(item.speciesId, '') } : {}),
			...(typeof item.rare === 'boolean' ? { rare: item.rare } : {}),
			progress: 100,
			totalMinutes: 0,
			targetMinutes: 1200,
			date: typeof item.date === 'string' ? item.date.slice(0, 40) : undefined,
			harvestedAt: typeof item.harvestedAt === 'string' ? item.harvestedAt.slice(0, 40) : undefined,
			hanakotoba: typeof item.hanakotoba === 'string' ? item.hanakotoba.slice(0, 80) : undefined,
		}));
}

export function countFlowerGallery(value: unknown): number {
	if (!Array.isArray(value)) return 0;
	return value.filter(item => item != null && typeof item === 'object').length;
}
