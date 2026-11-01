/* SPDX-License-Identifier: AGPL-3.0-only */
export const feedbackEmojiErrors = {
	accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'd1b11200-6d44-49a7-8959-132e3cdb0001' },
	noSuchRequest: { message: 'No such emoji request.', code: 'NO_SUCH_EMOJI_REQUEST', id: 'd1b11200-6d44-49a7-8959-132e3cdb0002' },
	invalidState: { message: 'The request has already changed. Reload it before continuing.', code: 'HATAFEED_EMOJI_REQUEST_CONFLICT', id: 'd1b11200-6d44-49a7-8959-132e3cdb0003' },
	targetChanged: { message: 'The registered emoji was changed or removed. Submit a new request.', code: 'HATAFEED_EMOJI_TARGET_CHANGED', id: 'd1b11200-6d44-49a7-8959-132e3cdb0004' },
	activeRequest: { message: 'This emoji already has a pending or held change request.', code: 'HATAFEED_EMOJI_CHANGE_PENDING', id: 'd1b11200-6d44-49a7-8959-132e3cdb0005' },
	invalidImage: { message: 'Select your own locally stored PNG, JPEG, GIF or WebP image (up to 5 MiB).', code: 'HATAFEED_EMOJI_INVALID_IMAGE', id: 'd1b11200-6d44-49a7-8959-132e3cdb0006' },
	reasonRequired: { message: 'A reason is required.', code: 'HATAFEED_EMOJI_REASON_REQUIRED', id: 'd1b11200-6d44-49a7-8959-132e3cdb0007' },
} as const;
