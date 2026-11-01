/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskPlannerTemplate } from './hatask-planner-storage.js';

export type HataskTemplateNormalizationResult = {
	templates: HataskPlannerTemplate[];
	invalidCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Fail closed on malformed rows without rewriting the server collection. */
export function normalizeHataskPlannerTemplates(value: unknown): HataskTemplateNormalizationResult {
	if (!Array.isArray(value)) return { templates: [], invalidCount: value == null ? 0 : 1 };
	const ids = new Set<string>();
	const templates: HataskPlannerTemplate[] = [];
	let invalidCount = 0;
	for (const candidate of value) {
		if (!isRecord(candidate) ||
			typeof candidate.id !== 'string' || candidate.id.trim().length === 0 || ids.has(candidate.id) ||
			(candidate.kind !== 'todo' && candidate.kind !== 'event' && candidate.kind !== 'members') ||
			typeof candidate.name !== 'string' || !isRecord(candidate.payload) ||
			(candidate.kind === 'members'
				? !Array.isArray(candidate.payload.visibleUserIds) || candidate.payload.visibleUserIds.length === 0 || candidate.payload.visibleUserIds.length > 100 || !candidate.payload.visibleUserIds.every(id => typeof id === 'string' && id.length > 0)
				: candidate.kind === 'todo' ? typeof candidate.payload.text !== 'string' : typeof candidate.payload.title !== 'string')) {
			invalidCount++;
			continue;
		}
		ids.add(candidate.id);
		templates.push({
			...candidate,
			id: candidate.id,
			kind: candidate.kind,
			name: candidate.name,
			position: typeof candidate.position === 'number' && Number.isFinite(candidate.position) ? candidate.position : templates.length,
			archivedAt: typeof candidate.archivedAt === 'string' ? candidate.archivedAt : null,
			payload: { ...candidate.payload },
		});
	}
	return { templates, invalidCount };
}
