/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { lockHataskFlowerWallet } from '@/core/hatask-flower-v2.js';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import { IdService } from '@/core/IdService.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { hataskModeratedRecordError, rethrowHataskModerationError } from '@/misc/hatask-moderated-record.js';
import {
	HATASK_PLANNER_COLLECTIONS,
	HATASK_PLANNER_SCOPE,
	HATASK_PLANNER_VALUE_MAX_BYTES,
	appendPlannerBackup,
	assertPlannerValue,
	findPlannerRows,
	hashPlannerValue,
	latestPlannerRow,
	mergePlannerRows,
	plannerBackupKey,
	plannerRawRows,
	readBackupEnvelope,
	type HataskPlannerCollection,
} from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	secure: true,
	kind: 'write:account',
	// value 合計8MiBに、JSON envelope分の余白を加える。
	bodyLimit: HATASK_PLANNER_VALUE_MAX_BYTES + (64 * 1024),
	limit: { duration: 1000 * 60, max: 10 },
	res: { type: 'object' },
	errors: {
		moderated: hataskModeratedRecordError,
		conflict: {
			message: 'One or more Hatask planner collections changed on another client.',
			code: 'HATASK_PLANNER_CONFLICT',
			id: '5dfabfa0-a25a-4dfb-bd73-d05533973914',
		},
		invalidStoredData: {
			message: 'Stored Hatask planner data is not a supported array.',
			code: 'HATASK_PLANNER_INVALID_STORED_DATA',
			id: '8ea286f7-2e65-45fb-85cc-3a85063199e6',
		},
		payloadTooLarge: {
			message: 'Hatask planner batch data is too large.',
			code: 'HATASK_PLANNER_PAYLOAD_TOO_LARGE',
			id: '37cccb4f-21d0-45c9-9ddc-f0033fd1d539',
		},
		invalidPayload: {
			message: 'Hatask planner batch contains an invalid item, duplicate ID, or duplicate collection.',
			code: 'HATASK_PLANNER_INVALID_PAYLOAD',
			id: '08c6c9d6-40d2-4dd6-aec3-1bfc166ce632',
		},
	},
} as const;

const changeSchema = {
	type: 'object',
	properties: {
		collection: { type: 'string', enum: HATASK_PLANNER_COLLECTIONS },
		expectedRevision: { type: 'string', nullable: true },
		value: { type: 'array', maxItems: 50000, items: { type: 'object' } },
	},
	required: ['collection', 'expectedRevision', 'value'],
	additionalProperties: false,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		changes: { type: 'array', minItems: 1, maxItems: 4, items: changeSchema },
	},
	required: ['changes'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.db) private db: DataSource,
		private idService: IdService,
		private flowerService: HataskFlowerV2Service,
	) {
		super(meta, paramDef, async (ps, me) => {
			const changes = ps.changes.map(change => ({
				collection: change.collection as HataskPlannerCollection,
				expectedRevision: change.expectedRevision,
				value: change.value,
			}));
			if (new Set(changes.map(change => change.collection)).size !== changes.length) {
				throw new ApiError(meta.errors.invalidPayload);
			}
			try {
				for (const change of changes) assertPlannerValue(change.value, change.collection);
			} catch {
				throw new ApiError(meta.errors.invalidPayload);
			}
			if (Buffer.byteLength(JSON.stringify(changes.map(change => change.value)), 'utf8') > HATASK_PLANNER_VALUE_MAX_BYTES) {
				throw new ApiError(meta.errors.payloadTooLarge);
			}

			return await this.db.transaction(async manager => {
				const orderedCollections = [...changes.map(change => change.collection)].sort();
				for (const collection of orderedCollections) {
					await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-planner:${me.id}:${collection}`]);
				}
				if (orderedCollections.includes('todos')) await lockHataskFlowerWallet(manager, me.id);
				const keys = changes.flatMap(change => [change.collection, plannerBackupKey(change.collection)]);
				const rows = await findPlannerRows(manager, me.id, keys, true);
				const prepared = changes.map(change => {
					const collectionRows = rows.filter(row => row.key === change.collection);
					const latest = latestPlannerRow(collectionRows);
					let previous: Record<string, unknown>[];
					try {
						previous = mergePlannerRows(collectionRows);
					} catch {
						throw new ApiError(meta.errors.invalidStoredData);
					}
					const actualRevision = latest == null
						? null
						: `${latest.updatedAt.toISOString()}:${hashPlannerValue(previous)}`;
					if (actualRevision !== change.expectedRevision) throw new ApiError(meta.errors.conflict);
					return { ...change, collectionRows, latest, previous };
				});

				// 全collectionのrevisionを確認してから初めて書き始める。
				const now = new Date();
				const updatedAt = now.toISOString();
				const repo = manager.getRepository(MiRegistryItem);
				const result: Record<string, unknown> = {};
				for (const change of prepared) {
					const backupKey = plannerBackupKey(change.collection);
					if (change.latest != null) {
						const backupRows = rows.filter(row => row.key === backupKey);
						const latestBackup = latestPlannerRow(backupRows);
						const envelope = appendPlannerBackup(
							readBackupEnvelope(latestBackup?.value),
							change.previous,
							change.latest.updatedAt.toISOString(),
							updatedAt,
							plannerRawRows(change.collectionRows),
						);
						if (latestBackup == null) {
							await repo.insert({
								id: this.idService.gen(now.getTime()), updatedAt: now, userId: me.id, domain: null,
								scope: [...HATASK_PLANNER_SCOPE], key: backupKey, value: envelope as any,
							});
						} else {
							await repo.update(backupRows.map(row => row.id), { updatedAt: now, value: envelope as any });
						}
					}

					if (change.latest == null) {
						await repo.insert({
							id: this.idService.gen(now.getTime()), updatedAt: now, userId: me.id, domain: null,
							scope: [...HATASK_PLANNER_SCOPE], key: change.collection, value: change.value,
						});
					} else {
						await repo.update(change.collectionRows.map(row => row.id), { updatedAt: now, value: change.value });
					}
					const flowerRewards = change.collection === 'todos' ? await this.flowerService.onTodosCommitted(manager, me.id, change.previous, change.value) : {};
					const hash = hashPlannerValue(change.value);
					result[change.collection] = {
						flowerRewards,
						updatedAt,
						hash,
						revision: `${updatedAt}:${hash}`,
						count: change.value.length,
						backupCreated: change.latest != null,
					};
				}
				return { version: 1, collections: result };
			}).catch(rethrowHataskModerationError);
		});
	}
}
