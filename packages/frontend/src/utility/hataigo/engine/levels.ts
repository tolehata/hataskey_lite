/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BoardSize } from '../rules/board.js';
import type { SearchBudget } from './mcts.js';

export const AI_LEVELS = [
	{ id: 'quick', label: '短く考える', budget: { 9: { maxPlayouts: 1500, maxMs: 400 }, 13: { maxPlayouts: 1000, maxMs: 600 }, 19: { maxPlayouts: 800, maxMs: 1000 } } },
	{ id: 'balanced', label: 'じっくり考える', budget: { 9: { maxPlayouts: 6000, maxMs: 1000 }, 13: { maxPlayouts: 4000, maxMs: 1500 }, 19: { maxPlayouts: 3000, maxMs: 2500 } } },
	{ id: 'patient', label: '長く考える', budget: { 9: { maxPlayouts: 12000, maxMs: 1800 }, 13: { maxPlayouts: 8000, maxMs: 2800 }, 19: { maxPlayouts: 6000, maxMs: 4500 } } },
] as const;

export function getLevelBudget(id: string, size: BoardSize): SearchBudget {
	const level = AI_LEVELS.find(value => value.id === id) ?? AI_LEVELS[1];
	return { ...level.budget[size] };
}
