/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { FavoriteFolderError } from '@/core/NoteFavoriteFolderService.js';
import { ApiError } from '@/server/api/error.js';

export const favoriteFolderApiErrors = {
	noSuchFolder: { message: 'No such favorite folder.', code: 'NO_SUCH_FAVORITE_FOLDER', id: '747f0e4b-d319-4fad-ad11-080bd71412b5' },
	folderLimitExceeded: { message: 'Favorite folder limit exceeded.', code: 'FAVORITE_FOLDER_LIMIT_EXCEEDED', id: '4035b3d3-0dd0-4ffc-b54c-4af36de7db54' },
	subfoldersNotAllowed: { message: 'Favorite subfolders are not allowed.', code: 'FAVORITE_SUBFOLDERS_NOT_ALLOWED', id: '6448d153-fe42-4201-a3eb-3ea75829c1c8' },
	invalidFolderHierarchy: { message: 'Favorite folders may have at most two levels.', code: 'INVALID_FAVORITE_FOLDER_HIERARCHY', id: '8b462404-68da-4e00-848c-51c507b45462' },
	duplicateFolderName: { message: 'A favorite folder with this name already exists under the same parent.', code: 'DUPLICATE_FAVORITE_FOLDER_NAME', id: 'c2572f21-1fd4-4f02-8484-0d3e710dd816' },
	invalidFolderName: { message: 'Favorite folder name must contain 1 to 100 characters.', code: 'INVALID_FAVORITE_FOLDER_NAME', id: 'cd0340c6-013a-4a83-8a6d-9799cdeb242a' },
	invalidFolderColor: { message: 'Invalid favorite folder color.', code: 'INVALID_FAVORITE_FOLDER_COLOR', id: 'a8fbd7a7-533b-4416-b0bd-26b53b9e9e08' },
	noSuchNote: { message: 'No such note.', code: 'NO_SUCH_NOTE', id: 'e856123d-92a8-4b92-a929-e405fa42ae05' },
	alreadyFavorited: { message: 'The note has already been marked as a favorite.', code: 'ALREADY_FAVORITED', id: '1c126b22-4a1c-4557-a4f6-21f349f37f2a' },
	notFavorited: { message: 'You have not marked that note a favorite.', code: 'NOT_FAVORITED', id: '7a302a2b-549f-4e9d-9bfa-8a9bd72211f6' },
} as const;

export async function favoriteFolderApi<T>(operation: () => Promise<T>, errors: Record<keyof typeof favoriteFolderApiErrors, { message: string; code: string; id: string }> = favoriteFolderApiErrors): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof FavoriteFolderError) throw new ApiError(errors[error.code]);
		throw error;
	}
}
