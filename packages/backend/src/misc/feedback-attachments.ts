/* SPDX-License-Identifier: AGPL-3.0-only */
import { In } from 'typeorm';
import type { DriveFilesRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { ApiError } from '@/server/api/error.js';

export const feedbackAttachmentErrors = {
	invalidAttachment: {
		message: 'The attachment is unavailable.',
		code: 'HATAFEED_INVALID_ATTACHMENT',
		id: '5c1a4f17-f773-4e3b-a693-0cccd588750a',
	},
} as const;

export async function loadOwnedFeedbackFiles(
	repository: DriveFilesRepository,
	ids: readonly string[],
	ownerId: string | null | undefined,
): Promise<Map<string, MiDriveFile>> {
	if (ids.length === 0 || ownerId == null) return new Map();
	const files = await repository.findBy({ id: In([...new Set(ids)]) });
	return new Map(files.filter(file => file.userId === ownerId).map(file => [file.id, file]));
}

export async function validateFeedbackFiles(
	repository: DriveFilesRepository,
	ids: readonly string[],
	ownerId: string | null | undefined,
): Promise<Map<string, MiDriveFile>> {
	const files = await loadOwnedFeedbackFiles(repository, ids, ownerId);
	if (ids.some(id => !files.has(id))) throw new ApiError(feedbackAttachmentErrors.invalidAttachment);
	return files;
}
