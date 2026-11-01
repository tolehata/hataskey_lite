import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, mapMediaError } from '../_shared.js';
export const meta = { tags: ['hata'], requireCredential: true, kind: 'read:account', limit: HATADY_RATE_LIMITS.read, res: { type: 'object', optional: false, nullable: false }, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { sessionId: { type: 'string', format: 'misskey:id' } }, required: ['sessionId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me, token) => { try { return await this.service.showSession(ps.sessionId, me.id, token == null); } catch (error) { return mapMediaError(error); } }); }
}
