/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { lockHataskFlowerWallet } from '@/core/hatask-flower-v2.js';
import { IdService } from '@/core/IdService.js';
import { hataskModeratedRecordError, rethrowHataskModerationError } from '@/misc/hatask-moderated-record.js';
import { MiHataskFlower, type HataskFlowersRepository } from '@/models/_.js';
import { HATASK_FLOWER_RATE_LIMITS } from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATASK_FLOWER_RATE_LIMITS.sync,
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			synced: { type: 'integer', optional: false, nullable: false, minimum: 0 },
		},
		required: ['synced'],
	},
	errors: {
		moderatedRecord: hataskModeratedRecordError,
		invalidHarvestedAt: {
			message: 'The flower harvestedAt must be a valid RFC 3339 date-time.',
			code: 'INVALID_HATASK_FLOWER_HARVESTED_AT',
			id: '50d7a144-2921-4fa2-99c3-597e97cb3ef2',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		flowers: {
			type: 'array', minItems: 1, maxItems: 100,
			items: {
				type: 'object',
				properties: {
					clientFlowerId: { type: 'string', minLength: 1, maxLength: 64 },
					emoji: { type: 'string', minLength: 1, maxLength: 32 },
					name: { type: 'string', minLength: 1, maxLength: 80 },
					hanakotoba: { type: 'string', maxLength: 256, default: '' },
					harvestedAt: { type: 'string', maxLength: 64 },
				},
				required: ['clientFlowerId', 'emoji', 'name', 'harvestedAt'],
				additionalProperties: false,
			},
		},
	},
	required: ['flowers'],
	additionalProperties: false,
} as const;

export function parseHataskFlowerHarvestedAt(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
	if (match == null) return null;

	const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const offsetHour = offsetHourText == null ? 0 : Number(offsetHourText);
	const offsetMinute = offsetMinuteText == null ? 0 : Number(offsetMinuteText);
	const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return null;

	const harvestedAt = new Date(value);
	return Number.isNaN(harvestedAt.getTime()) ? null : harvestedAt;
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hataskFlowersRepository)
		private hataskFlowersRepository: HataskFlowersRepository,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const parsedFlowers = ps.flowers.map(flower => {
				const harvestedAt = parseHataskFlowerHarvestedAt(flower.harvestedAt);
				if (harvestedAt == null) throw new ApiError(meta.errors.invalidHarvestedAt);
				return { ...flower, harvestedAt };
			});
			return this.hataskFlowersRepository.manager.transaction(async manager => {
				// Serialize the authority check and legacy write with V2 harvest/rename.
				await lockHataskFlowerWallet(manager, me.id);
				// 同じ clientFlowerId を一つの同期で重ねても、ON CONFLICT が同一行を二度更新しないようにする。
				const authoritative: { id: string }[] = await manager.query('SELECT id FROM hatask_flower_harvest WHERE "userId"=$1', [me.id]);
				const authoritativeIds = new Set(authoritative.map(flower => flower.id));
				const flowers = [...new Map(parsedFlowers.map(flower => [flower.clientFlowerId, flower])).values()].filter(flower => !authoritativeIds.has(flower.clientFlowerId));
				if (flowers.length === 0) return { synced: 0 };

				await manager.getRepository(MiHataskFlower).createQueryBuilder()
					.insert()
					.into(MiHataskFlower)
					.values(flowers.map(flower => ({
						id: this.idService.gen(),
						userId: me.id,
						clientFlowerId: flower.clientFlowerId,
						emoji: flower.emoji,
						name: flower.name,
						hanakotoba: flower.hanakotoba,
						harvestedAt: flower.harvestedAt,
					})))
					// id と userId/clientFlowerId は競合時に絶対更新しない。既存行の安定 ID を保持する。
					.orUpdate(['emoji', 'name', 'hanakotoba', 'harvestedAt'], ['userId', 'clientFlowerId'])
					.execute();

				return { synced: flowers.length };
			}).catch(rethrowHataskModerationError);
		});
	}
}
