/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RecordModerationService } from '@/core/RecordModerationService.js';
import { baseMeta, infoSchema, targetParams } from './_schema.js';
export const meta = { ...baseMeta, kind: 'read:admin:show-user', res: { type: 'array', items: infoSchema } } as const;
export const paramDef = targetParams;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: RecordModerationService) { super(meta, paramDef, (ps, me, token, flashToken) => service.history(me, ps, token ?? flashToken)); }
}
