import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, mapMediaError } from '../_shared.js';
import { mediaCommentSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'write:account', limit: HATADY_RATE_LIMITS.write, res: mediaCommentSchema, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { commentId: { type: 'string', format: 'misskey:id' }, text: { type: 'string', minLength: 1, maxLength: 2048 }, spoiler: { type: 'boolean', default: false } }, required: ['commentId', 'text'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me) => { try { return await this.service.updateComment(me.id, ps.commentId, ps.text, ps.spoiler); } catch (e) { return mapMediaError(e); } }); }
}
