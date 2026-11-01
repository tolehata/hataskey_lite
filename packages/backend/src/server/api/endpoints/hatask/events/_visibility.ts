/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { In, IsNull } from 'typeorm';
import type { UsersRepository } from '@/models/_.js';
import { ApiError } from '@/server/api/error.js';

export const HATASK_EVENT_AUDIENCE_ERROR = {
	message: 'Select between 1 and 100 local members for this event.',
	code: 'INVALID_HATASK_EVENT_AUDIENCE',
	id: '1622f943-c39d-4afb-9db0-de8d979351c4',
} as const;

export const hataskEventAudienceProperties = {
	visibility: { type: 'string', enum: ['public', 'specified'] },
	visibleUserIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, maxItems: 100, uniqueItems: true },
} as const;

export type HataskEventAudience = { userId: string; visibility?: string; visibleUserIds?: readonly string[] };

export function canViewHataskEvent(event: HataskEventAudience, viewerId: string): boolean {
	return event.userId === viewerId || event.visibility == null || event.visibility === 'public' ||
		(event.visibility === 'specified' && event.visibleUserIds?.includes(viewerId) === true);
}

export async function validateHataskEventAudience(
	event: HataskEventAudience,
	users: UsersRepository,
): Promise<string[]> {
	if (event.visibility !== 'specified') return [];
	const ids = [...new Set(event.visibleUserIds ?? [])].filter(id => id !== event.userId);
	if (ids.length === 0 || ids.length > 100) throw new ApiError(HATASK_EVENT_AUDIENCE_ERROR);
	const count = await users.countBy({ id: In(ids), host: IsNull(), isDeleted: false, isSuspended: false });
	if (count !== ids.length) throw new ApiError(HATASK_EVENT_AUDIENCE_ERROR);
	return ids;
}
