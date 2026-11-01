/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';

export const meta = {
	tags: ['notifications', 'account'], requireCredential: true, kind: 'read:notifications',
	limit: { duration: 30000, max: 30 },
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'Notification' } },
} as const;
export const paramDef = {
	type: 'object',
	properties: { notificationIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, minItems: 1, maxItems: 100, uniqueItems: true } },
	required: ['notificationIds'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private notificationService: NotificationService, private notificationEntityService: NotificationEntityService) {
		super(meta, paramDef, async (ps, me) => {
			const notifications = await this.notificationService.findNotificationsByIds(me.id, ps.notificationIds);
			return this.notificationEntityService.packMany(notifications, me.id);
		});
	}
}
