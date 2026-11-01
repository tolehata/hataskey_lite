import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, mapMediaError } from '../_shared.js';
import { mediaSessionListSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'read:account', limit: HATADY_RATE_LIMITS.read, res: mediaSessionListSchema, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { workId: { type: 'string', format: 'misskey:id' }, untilId: { type: 'string', format: 'misskey:id' }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 } } } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me, token) => { try { return await this.service.packSessions(await this.service.listSessions(me.id, { ...ps, staffAccess: token == null })); } catch (e) { return mapMediaError(e); } }); }
}
