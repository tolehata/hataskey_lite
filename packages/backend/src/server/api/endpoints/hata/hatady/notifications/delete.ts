import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'write:account', limit: HATADY_RATE_LIMITS.write } as const;
export const paramDef = {
	type: 'object', properties: { notificationIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, minItems: 1, maxItems: 100, uniqueItems: true } }, required: ['notificationIds'],
} as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyService) {
		super(meta, paramDef, async (ps, me) => { await this.service.setNotificationsDeleted(me.id, ps.notificationIds, true); });
	}
}
