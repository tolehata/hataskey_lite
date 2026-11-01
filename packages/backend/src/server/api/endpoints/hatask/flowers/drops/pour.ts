import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
export const meta = { tags: ['hatask'], requireCredential: true, kind: 'write:account', limit: { duration: 60000, max: 120 }, res: { type: 'object', optional: false, nullable: false }, errors: { invalidAction: { message: 'The flower action is not available.', code: 'HATASK_FLOWER_ACTION_UNAVAILABLE', id: 'f15d11ea-5098-4df0-b5ac-53a5782a06ba' } } } as const;
export const paramDef = { type: 'object', properties: { target: { type: 'string', enum: ['self', 'festival'] }, requestId: { type: 'string', minLength: 1, maxLength: 128 }, timezone: { type: 'string', maxLength: 80 } }, required: ['target', 'requestId'], additionalProperties: false } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
 constructor(service: HataskFlowerV2Service) {
  super(meta, paramDef, async (ps, me) => {
   try { return await service.pour(me.id, ps.target, ps.requestId, ps.timezone); } catch (error) {
    if (error instanceof Error && error.message.startsWith('HATASK_FLOWER_')) throw new ApiError(meta.errors.invalidAction, { reason: error.message });
    throw error;
   }
  });
 }
}
