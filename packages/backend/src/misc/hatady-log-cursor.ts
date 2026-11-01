/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiHatadyLog } from '@/models/HatadyLog.js';
import type { SelectQueryBuilder } from 'typeorm';

// Keep the legacy untilId API, but paginate by the same keys as its result order.
// Resolve the anchor within the caller's filters so a foreign/private ID cannot
// be used to probe a record outside the visible feed.
export async function applyHatadyLogCursor(query: SelectQueryBuilder<MiHatadyLog>, untilId: string, popular = false): Promise<boolean> {
	const cursor = await query.clone().andWhere('log.id = :hatadyCursorId', { hatadyCursorId: untilId }).getOne();
	if (cursor == null) return false;
	const chronological = '(log.studiedAt < :hatadyCursorTime OR (log.studiedAt = :hatadyCursorTime AND log.id < :hatadyCursorId))';
	query.andWhere(popular
		? `(log.reactionsCount < :hatadyCursorScore OR (log.reactionsCount = :hatadyCursorScore AND ${chronological}))`
		: chronological, {
		hatadyCursorId: cursor.id,
		hatadyCursorTime: cursor.studiedAt,
		...(popular ? { hatadyCursorScore: cursor.reactionsCount } : {}),
	});
	return true;
}
