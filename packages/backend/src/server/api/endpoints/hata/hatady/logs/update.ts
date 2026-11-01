/*
 * 旗鯖fork: Hatady の学習ログを編集する(本人のみ)。
 */
import { Injectable } from '@nestjs/common';
import { parseHatadyMediaDateTime } from '@/core/HatadyMediaService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { LOG_INPUT_PROPERTIES, HATADY_ATTACHMENT_API_ERROR } from '../_record.js';
import { HATADY_MEDIA_DATE_TIME_PATTERN } from '../media/_shared.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		invalidAttachments: HATADY_ATTACHMENT_API_ERROR,
		noSuchLog: {
			message: 'No such log or access denied.',
			code: 'NO_SUCH_LOG',
			id: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		...LOG_INPUT_PROPERTIES,
		logId: { type: 'string', format: 'misskey:id' },
		bookId: { type: 'string', format: 'misskey:id', nullable: true },
		pageFrom: { type: 'integer', minimum: 0, maximum: 100000, nullable: true },
		pageTo: { type: 'integer', minimum: 0, maximum: 100000, nullable: true },
		studiedAt: { type: 'string', pattern: HATADY_MEDIA_DATE_TIME_PATTERN },
		title: { type: 'string', minLength: 1, maxLength: 512 },
		subject: { type: 'string', minLength: 1, maxLength: 128 },
		tag: { type: 'string', enum: ['strength', 'weak', 'interest', 'movie', 'game', null], nullable: true },
		body: { type: 'string', maxLength: 4096, nullable: true },
		durationMinutes: { type: 'integer', minimum: 0, maximum: 100000 },
		isPublic: { type: 'boolean' },
		visibility: { type: 'string', enum: ['public', 'followers', 'private'] },
	},
	required: ['logId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const log = await this.hatadyService.updateLog(me, ps.logId, {
					fileIds: ps.fileIds,
					kind: ps.kind,
					tags: ps.tags,
					durationSeconds: ps.durationSeconds,
					startedAt: ps.startedAt,
					details: ps.details,
					mediaWorkId: ps.mediaWorkId,
					bookId: ps.bookId,
					pageFrom: ps.pageFrom,
					pageTo: ps.pageTo,
					studiedAt: ps.studiedAt === undefined ? undefined : parseHatadyMediaDateTime(ps.studiedAt, 'studiedAt'),
					title: ps.title,
					subject: ps.subject,
					tag: ps.tag,
					body: ps.body,
					durationMinutes: ps.durationMinutes,
					isPublic: ps.isPublic,
					visibility: ps.visibility,
				});
				return await this.hatadyEntityService.packLog(log, me);
			} catch (error) {
				if (error instanceof Error && error.message === HATADY_ATTACHMENT_API_ERROR.code) throw new ApiError(meta.errors.invalidAttachments);
				throw new ApiError(meta.errors.noSuchLog);
			}
		});
	}
}
