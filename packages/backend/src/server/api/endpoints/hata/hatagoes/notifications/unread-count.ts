/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';

export const meta = {
	tags: ['hata', 'notifications'],
	requireCredential: true,
	kind: 'read:notifications',
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			count: { type: 'integer', minimum: 0, optional: false, nullable: false },
			hatask: { type: 'integer', minimum: 0, optional: false, nullable: false },
			hatady: { type: 'integer', minimum: 0, optional: false, nullable: false },
			hataFeed: { type: 'integer', minimum: 0, optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = { type: 'object', properties: {}, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private notificationService: NotificationService) {
		super(meta, paramDef, async (_ps, me) => {
			const { hatask, hatady, hataFeed } = await this.notificationService.getUnreadNotificationCountsByBrand(me.id);
			return { count: hatask + hatady + hataFeed, hatask, hatady, hataFeed };
		});
	}
}
