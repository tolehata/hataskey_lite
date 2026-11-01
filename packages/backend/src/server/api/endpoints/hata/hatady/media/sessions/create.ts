import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import { MEDIA_ERRORS, SESSION_INPUT_PROPERTIES, mapMediaError } from '../_shared.js';
import { mediaSessionSchema } from '../_schemas.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'write:account', limit: HATADY_RATE_LIMITS.write, res: { ...mediaSessionSchema, properties: { ...mediaSessionSchema.properties, flowerReward: { type: 'object', optional: false, nullable: false } } }, errors: MEDIA_ERRORS } as const;
export const paramDef = { type: 'object', properties: { workId: { type: 'string', format: 'misskey:id' }, kind: { type: 'string', enum: ['movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'] }, ...SESSION_INPUT_PROPERTIES }, required: ['workId', 'kind', 'occurredAt'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyMediaService) { super(meta, paramDef, async (ps, me) => { try { const { workId, kind, ...input } = ps; const session = await this.service.createSession(me.id, workId, kind, input); return { ...await this.service.packSession(session), flowerReward: session.flowerReward }; } catch (e) { return mapMediaError(e); } }); }
}
