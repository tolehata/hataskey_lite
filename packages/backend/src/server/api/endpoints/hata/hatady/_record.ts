import { HATADY_ATTACHMENT_LIMIT, HATADY_ATTACHMENT_ERROR } from '@/core/HatadyAttachmentService.js';
import { HATADY_MAX_DURATION_SECONDS, HATADY_STARTED_AT_PATTERN } from '@/core/HatadyRecordData.js';

export const RECORD_INPUT_PROPERTIES = {
	fileIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, maxItems: HATADY_ATTACHMENT_LIMIT, uniqueItems: true },
	durationSeconds: { type: 'integer', minimum: 0, maximum: HATADY_MAX_DURATION_SECONDS, nullable: true },
	startedAt: { type: 'string', pattern: HATADY_STARTED_AT_PATTERN, maxLength: 12, nullable: true },
	tags: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 128 }, maxItems: 32, uniqueItems: true },
} as const;

export const LOG_INPUT_PROPERTIES = {
	...RECORD_INPUT_PROPERTIES,
	kind: { type: 'string', enum: ['study', 'exercise', 'work'] },
	mediaWorkId: { type: 'string', format: 'misskey:id', nullable: true },
	details: { type: 'object', additionalProperties: true },
} as const;

export const BOOK_INPUT_PROPERTIES = {
	visibility: { type: 'string', enum: ['public', 'followers', 'private'] },
	details: { type: 'object', additionalProperties: true },
	currentPage: { type: 'integer', minimum: 0, maximum: 100000 },
	isFavorite: { type: 'boolean' },
	isRecommended: { type: 'boolean' },
	finishedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$', nullable: true },
} as const;

export const RECORD_ATTACHMENT_PROPERTIES = {
	fileIds: { type: 'array', optional: false, nullable: false, items: { type: 'string', format: 'misskey:id' } },
	files: { type: 'array', optional: false, nullable: false, items: { type: 'object', ref: 'DriveFile' } },
} as const;

export const HATADY_ATTACHMENT_API_ERROR = {
	message: 'Attachments must be at most 16 images owned by the record author.',
	code: HATADY_ATTACHMENT_ERROR,
	id: 'd1b2ed48-e1c4-4684-b54f-788fb2c73c57',
} as const;
