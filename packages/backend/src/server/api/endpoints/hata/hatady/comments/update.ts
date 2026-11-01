import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
export const meta = { tags: ['hata'], requireCredential: true, kind: 'write:account', limit: HATADY_RATE_LIMITS.write, res: { type: 'object', optional: false, nullable: false } } as const;
export const paramDef = { type: 'object', properties: { commentId: { type: 'string', format: 'misskey:id' }, text: { type: 'string', minLength: 1, maxLength: 2048 } }, required: ['commentId', 'text'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyService, private entity: HatadyEntityService) {
		super(meta, paramDef, async (ps, me) => { const comment = await this.service.updateComment(me, ps.commentId, ps.text); return (await this.entity.packComments([comment], me))[0]; });
	}
}
