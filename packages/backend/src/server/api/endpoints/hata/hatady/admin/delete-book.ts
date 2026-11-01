/*
 * 旗鯖fork(Hatady): モデレーター/管理者が任意ユーザーの本を削除する(全本タブ用)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { RecordModerationService } from '@/core/RecordModerationService.js';
import { recordModerationErrors } from '@/misc/record-moderation.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:user-note',
	errors: recordModerationErrors,
	limit: HATADY_RATE_LIMITS.adminDestructive,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookId: { type: 'string', format: 'misskey:id' },
		requestId: { type: 'string', minLength: 16, maxLength: 80, pattern: '^[a-zA-Z0-9-]+$' },
		version: { type: 'string', pattern: '^[a-f0-9]{64}$' },
		reason: { type: 'string', minLength: 1, maxLength: 1000 },
		warning: { type: 'string', minLength: 1, maxLength: 2000, nullable: true },
	},
	required: ['bookId', 'requestId', 'version', 'reason', 'warning'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private recordModerationService: RecordModerationService,
	) {
		super(meta, paramDef, async (ps, me, token, flashToken) => {
			await this.recordModerationService.execute(me, { product: 'hatady', targetType: 'book', targetId: ps.bookId, action: 'delete', requestId: ps.requestId, version: ps.version, reason: ps.reason, warning: ps.warning }, token ?? flashToken);
		});
	}
}
