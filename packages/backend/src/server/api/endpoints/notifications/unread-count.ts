/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['notifications', 'account'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			unreadNotificationsCount: { type: 'integer', minimum: 0, optional: false, nullable: false },
			revision: { type: 'string', optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = { type: 'object', properties: {}, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef, async (_ps, me) => this.notificationService.getUnreadNotificationState(me.id));
	}
}
