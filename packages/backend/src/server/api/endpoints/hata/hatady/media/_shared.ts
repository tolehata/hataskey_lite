import { ApiError } from '@/server/api/error.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { RECORD_INPUT_PROPERTIES, HATADY_ATTACHMENT_API_ERROR } from '../_record.js';

export const MEDIA_ERRORS = {
	invalidAttachments: HATADY_ATTACHMENT_API_ERROR,
	noSuchMedia: {
		message: 'No such Hatady media resource or access denied.',
		code: 'NO_SUCH_HATADY_MEDIA',
		id: 'b16f75db-21f4-43ef-9c29-e47e8d880e31',
	},
	invalidMedia: {
		message: 'The Hatady media input is invalid.',
		code: 'INVALID_HATADY_MEDIA',
		id: 'd827b67d-2339-48bc-8356-d2658b87f400',
	},
	gameTitleLimitExceeded: {
		message: 'The game title limit for this role has been reached.',
		code: 'HATADY_GAME_TITLE_LIMIT_EXCEEDED',
		id: '2de54404-fcea-4db6-9ddd-b8ebebf11f40',
	},
} as const;

export function mapMediaError(error: unknown): never {
	if (error instanceof Error && error.message === HATADY_ATTACHMENT_API_ERROR.code) throw new ApiError(MEDIA_ERRORS.invalidAttachments);
	if (error instanceof Error && error.message === HatadyMediaService.ERR_NOT_FOUND) throw new ApiError(MEDIA_ERRORS.noSuchMedia);
	if (error instanceof Error && error.message === HatadyMediaService.ERR_GAME_TITLE_LIMIT) throw new ApiError(MEDIA_ERRORS.gameTitleLimitExceeded);
	if (error instanceof Error && (
		error.message.startsWith('invalid ') ||
		error.message.endsWith(' is too long') ||
		error.message.includes('-only fields are not allowed') ||
		error.message.startsWith('field ') ||
		error.message === 'session details are too large' ||
		error.message === 'session kind does not match work kind' ||
		error.message === 'session visibility cannot exceed work visibility'
	)) throw new ApiError(MEDIA_ERRORS.invalidMedia);
	throw error;
}

export const HATADY_MEDIA_DATE_PATTERN = '^(?:18\\d{2}|19\\d{2}|2\\d{3}|3000)-\\d{2}-\\d{2}$';
export const HATADY_MEDIA_DATE_TIME_PATTERN = '^(?:18\\d{2}|19\\d{2}|2\\d{3}|3000)-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$';

export const WORK_INPUT_PROPERTIES = {
	details: { type: 'object', additionalProperties: true },
	title: { type: 'string', minLength: 1, maxLength: 512 },
	originalTitle: { type: 'string', maxLength: 512, nullable: true },
	creator: { type: 'string', maxLength: 256, nullable: true },
	releaseDate: { type: 'string', pattern: HATADY_MEDIA_DATE_PATTERN, nullable: true },
	releaseYear: { type: 'integer', minimum: 1800, maximum: 3000, nullable: true },
	status: { type: 'string', enum: ['planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped'] },
	visibility: { type: 'string', enum: ['private', 'followers', 'public'] },
	isFavorite: { type: 'boolean' },
	isRecommended: { type: 'boolean' },
	// 0..10 の整数。半星単位で、表示値は recommendationRating / 2。
	recommendationRating: { type: 'integer', minimum: 0, maximum: 10, nullable: true },
	coverColorIndex: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
	synopsis: { type: 'string', maxLength: 8192, nullable: true },
	synopsisSpoiler: { type: 'boolean' },
	review: { type: 'string', maxLength: 8192, nullable: true },
	reviewSpoiler: { type: 'boolean' },
	officialUrl: { type: 'string', maxLength: 2048, nullable: true },
	runtimeMinutes: { type: 'integer', minimum: 1, maximum: 100000, nullable: true },
	genres: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 1, maxLength: 128 } },
	origin: { type: 'string', enum: ['domestic', 'foreign', 'co_production', 'other', null], nullable: true },
	viewingMode: { type: 'string', enum: ['dubbed', 'subtitled', 'original', null], nullable: true },
	primaryLanguage: { type: 'string', maxLength: 128, nullable: true },
	highlights: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 512 } },
	highlightsSpoiler: { type: 'boolean' },
	platforms: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 1, maxLength: 128 } },
	developer: { type: 'string', maxLength: 256, nullable: true },
	publisher: { type: 'string', maxLength: 256, nullable: true },
} as const;

export const SESSION_INPUT_PROPERTIES = {
	...RECORD_INPUT_PROPERTIES,
	// Endpoint の Ajv は `date-time` format を登録していないため、ISO 8601をpatternで検証する。
	occurredAt: { type: 'string', minLength: 20, maxLength: 35, pattern: HATADY_MEDIA_DATE_TIME_PATTERN },
	durationMinutes: { type: 'integer', minimum: 1, maximum: 100000, nullable: true },
	note: { type: 'string', maxLength: 8192, nullable: true },
	noteSpoiler: { type: 'boolean' },
	visibility: { type: 'string', enum: ['private', 'followers', 'public'] },
	details: { type: 'object', additionalProperties: true },
} as const;
