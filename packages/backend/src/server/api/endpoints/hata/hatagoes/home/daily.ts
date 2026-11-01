/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';

export const meta = {
	tags: ['hata'], requireCredential: true, kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false, properties: {
		today: { type: 'string', optional: false, nullable: false },
		timezone: { type: 'string', optional: false, nullable: true },
		trackedSince: { type: 'string', optional: false, nullable: true },
		days: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, properties: {
			date: { type: 'string', optional: false, nullable: false }, known: { type: 'boolean', optional: false, nullable: false },
			completed: { type: 'array', optional: false, nullable: false, items: { type: 'string', enum: ['mood', 'meal', 'todo', 'water', 'reading'], optional: false, nullable: false } },
			count: { type: 'number', optional: false, nullable: false }, complete: { type: 'boolean', optional: false, nullable: false },
		} } },
		streakDays: { type: 'number', optional: false, nullable: false }, awardedToday: { type: 'number', optional: false, nullable: false },
	} },
} as const;
export const paramDef = { type: 'object', properties: { timezone: { type: 'string', maxLength: 80 } }, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: HataskFlowerV2Service) {
		super(meta, paramDef, async (ps, me) => service.daily(me.id, ps.timezone));
	}
}
