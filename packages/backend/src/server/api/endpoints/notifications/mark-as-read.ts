/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = { tags: ['notifications', 'account'], requireCredential: true, kind: 'write:notifications', limit: { duration: 30000, max: 30 } } as const;
export const paramDef = {
	type: 'object',
	properties: { notificationIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, minItems: 1, maxItems: 100, uniqueItems: true } },
	required: ['notificationIds'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef, async (ps, me) => {
			await this.notificationService.markNotificationsRead(me.id, ps.notificationIds);
		});
	}
}
