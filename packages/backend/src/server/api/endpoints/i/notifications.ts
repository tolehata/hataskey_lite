/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { In } from 'typeorm';
import * as Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import { FilterUnionByProperty, hatadyNotificationSubtypes, notificationFilterTypes, obsoleteNotificationTypes } from '@/types.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import { MiNotification } from '@/models/Notification.js';

export const meta = {
	tags: ['account', 'notifications'],

	requireCredential: true,

	limit: {
		duration: 30000,
		max: 30,
	},

	kind: 'read:notifications',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Notification',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
		markAsRead: { type: 'boolean', default: true },
		excludeBots: { type: 'boolean', default: false },
		brand: { type: 'string', enum: ['all', 'standard', 'hatady', 'hatask', 'hataFeed'], default: 'all' },
		includeBrands: { type: 'array', items: { type: 'string', enum: ['standard', 'hatady', 'hatask', 'hataFeed'] } },
		includeHataskApp: { type: 'boolean' },
		includeHatadySubtypes: { type: 'array', items: { type: 'string', enum: hatadyNotificationSubtypes } },
		excludeHatadySubtypes: { type: 'array', items: { type: 'string', enum: hatadyNotificationSubtypes } },
		// 後方互換のため、廃止された通知タイプも受け付ける
		includeTypes: { type: 'array', items: {
			type: 'string', enum: [...notificationFilterTypes, ...obsoleteNotificationTypes],
		} },
		excludeTypes: { type: 'array', items: {
			type: 'string', enum: [...notificationFilterTypes, ...obsoleteNotificationTypes],
		} },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private idService: IdService,
		private notificationEntityService: NotificationEntityService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const untilId = ps.untilId ?? (ps.untilDate ? this.idService.gen(ps.untilDate!) : undefined);
			const sinceId = ps.sinceId ?? (ps.sinceDate ? this.idService.gen(ps.sinceDate!) : undefined);

			// 種類の全解除・全除外でも、選択ブランド内の必須アイコンデコ獲得通知を取得する。
			const includeTypes = ps.includeTypes && ps.includeTypes.filter(type => !(obsoleteNotificationTypes).includes(type as any)) as typeof notificationFilterTypes[number][];
			const excludeTypes = ps.excludeTypes && ps.excludeTypes.filter(type => !(obsoleteNotificationTypes).includes(type as any)) as typeof notificationFilterTypes[number][];

			const notifications = await this.notificationService.getNotifications(me.id, {
				sinceId: sinceId,
				untilId: untilId,
				limit: ps.limit,
				includeTypes,
				excludeTypes,
				brand: ps.brand,
				includeBrands: ps.includeBrands,
				includeHataskApp: ps.includeHataskApp,
				includeHatadySubtypes: ps.includeHatadySubtypes,
				excludeHatadySubtypes: ps.excludeHatadySubtypes,
				excludeBots: ps.excludeBots,
			});
			const packed = await this.notificationEntityService.packMany(notifications, me.id);
			if (ps.markAsRead) await this.notificationService.markNotificationsRead(me.id, packed.map(notification => notification.id));
			return packed;
		});
	}
}
