import { Inject, Injectable } from '@nestjs/common';
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
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	// domain=null のHatask本体データを上書きできるため、ネイティブセッション限定。
	secure: true,
	kind: 'write:account',
	// value本体8MiBに、collection/revisionを含むJSON envelope分の余白を加える。
	bodyLimit: HATASK_PLANNER_VALUE_MAX_BYTES + (64 * 1024),
	limit: { duration: 1000 * 60, max: 30 },
	res: { type: 'object' },
	errors: {
		moderated: hataskModeratedRecordError,
		conflict: {
			message: 'Hatask planner data changed on another client.',
			code: 'HATASK_PLANNER_CONFLICT',
			id: '2e50cb19-dad7-4db9-90a0-b4b36d9595d9',
		},
		invalidStoredData: {
			message: 'Stored Hatask planner data is not a supported array.',
			code: 'HATASK_PLANNER_INVALID_STORED_DATA',
			id: '8336763e-e35f-4616-8c39-1ac7f27fb244',
		},
		payloadTooLarge: {
			message: 'Hatask planner data is too large.',
			code: 'HATASK_PLANNER_PAYLOAD_TOO_LARGE',
			id: '290ca780-5285-44ad-9f6d-94c9f53fcd04',
		},
		invalidPayload: {
			message: 'Hatask planner data contains an invalid item or duplicate ID.',
			code: 'HATASK_PLANNER_INVALID_PAYLOAD',
			id: '9b46b7cb-4535-45a1-9c25-777ff7aac94a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		collection: { type: 'string', enum: HATASK_PLANNER_COLLECTIONS },
		expectedRevision: { type: 'string', nullable: true },
		value: { type: 'array', maxItems: 50000, items: { type: 'object' } },
	},
	required: ['collection', 'expectedRevision', 'value'],
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
			const collection = ps.collection as HataskPlannerCollection;
			try {
				assertPlannerValue(ps.value, collection);
			} catch {
				throw new ApiError(meta.errors.invalidPayload);
			}
			const serialized = JSON.stringify(ps.value);
			if (Buffer.byteLength(serialized, 'utf8') > HATASK_PLANNER_VALUE_MAX_BYTES) {
				throw new ApiError(meta.errors.payloadTooLarge);
			}

			const backupKey = plannerBackupKey(collection);
			const result = await this.db.transaction(async manager => {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hatask-planner:${me.id}:${collection}`]);
				if (collection === 'todos') await lockHataskFlowerWallet(manager, me.id);
				const rows = await findPlannerRows(manager, me.id, [collection, backupKey], true);
				const collectionRows = rows.filter(row => row.key === collection);
				const latest = latestPlannerRow(collectionRows);
				const actualUpdatedAt = latest?.updatedAt.toISOString() ?? null;
				let previous: Record<string, unknown>[];
				try {
					previous = mergePlannerRows(collectionRows);
				} catch {
					throw new ApiError(meta.errors.invalidStoredData);
				}
				const actualHash = hashPlannerValue(previous);
				const actualRevision = latest == null ? null : `${actualUpdatedAt}:${actualHash}`;

				if (actualRevision !== ps.expectedRevision) {
					throw new ApiError(meta.errors.conflict, {
						actualUpdatedAt,
						actualHash,
						actualRevision,
					});
				}

				const now = new Date();
				const updatedAt = now.toISOString();
				const repo = manager.getRepository(MiRegistryItem);

				if (latest != null) {
					const backupRows = rows.filter(row => row.key === backupKey);
					const latestBackup = latestPlannerRow(backupRows);
					const envelope = appendPlannerBackup(
						readBackupEnvelope(latestBackup?.value),
						previous,
						latest.updatedAt.toISOString(),
						updatedAt,
						plannerRawRows(collectionRows),
					);

					if (latestBackup == null) {
						await repo.insert({
							id: this.idService.gen(now.getTime()),
							updatedAt: now,
							userId: me.id,
							domain: null,
							scope: [...HATASK_PLANNER_SCOPE],
							key: backupKey,
							value: envelope as any,
						});
					} else {
						await repo.update(backupRows.map(row => row.id), { updatedAt: now, value: envelope as any });
					}
				}

				if (latest == null) {
					await repo.insert({
						id: this.idService.gen(now.getTime()),
						updatedAt: now,
						userId: me.id,
						domain: null,
						scope: [...HATASK_PLANNER_SCOPE],
						key: collection,
						value: ps.value,
					});
				} else {
					// Do not delete duplicate legacy rows. Updating every row makes old
					// Registry readers deterministic while retaining all row identities.
					await repo.update(collectionRows.map(row => row.id), { updatedAt: now, value: ps.value });
				}

				const flowerRewards = collection === 'todos' ? await this.flowerService.onTodosCommitted(manager, me.id, previous, ps.value) : {};
				return {
					flowerRewards,
					version: 1,
					collection,
					updatedAt,
					hash: hashPlannerValue(ps.value),
					revision: `${updatedAt}:${hashPlannerValue(ps.value)}`,
					count: ps.value.length,
					backupCreated: latest != null,
				};
			}).catch(rethrowHataskModerationError);

			return result;
		});
	}
}
