import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, SESSION_INPUT_PROPERTIES, mapMediaError } from '../_shared.js';
import { mediaSessionSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'write:account', limit: HATADY_RATE_LIMITS.write, res: mediaSessionSchema, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { sessionId: { type: 'string', format: 'misskey:id' }, ...SESSION_INPUT_PROPERTIES }, required: ['sessionId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me) => { try { const { sessionId, ...input } = ps; return await this.service.packSession(await this.service.updateSession(me.id, sessionId, input)); } catch (e) { return mapMediaError(e); } }); }
}
