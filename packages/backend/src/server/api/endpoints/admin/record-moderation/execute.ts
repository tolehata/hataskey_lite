/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RecordModerationService } from '@/core/RecordModerationService.js';
import { baseMeta, resultSchema, targetProperties, targetRequired } from './_schema.js';
export const meta = { ...baseMeta, kind: 'write:admin:user-note', res: resultSchema } as const;
export const paramDef = { type: 'object', properties: {
	...targetProperties, requestId: { type: 'string', minLength: 16, maxLength: 80, pattern: '^[a-zA-Z0-9-]+$' },
	version: { type: 'string', pattern: '^[a-f0-9]{64}$' }, action: { type: 'string', enum: ['delete', 'warn'] },
	reason: { type: 'string', minLength: 1, maxLength: 1000 }, warning: { type: 'string', nullable: true, minLength: 1, maxLength: 2000 },
}, required: [...targetRequired, 'requestId', 'version', 'action', 'reason', 'warning'], additionalProperties: false } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: RecordModerationService) { super(meta, paramDef, (ps, me, token, flashToken) => service.execute(me, ps, token ?? flashToken)); }
}
