import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, mapMediaError } from '../_shared.js';
import { mediaWorkDetailSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'read:account', limit: HATADY_RATE_LIMITS.read, res: mediaWorkDetailSchema, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { workId: { type: 'string', format: 'misskey:id' } }, required: ['workId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me, token) => { try { return await this.service.showWork(ps.workId, me.id, token == null); } catch (e) { return mapMediaError(e); } }); }
}
