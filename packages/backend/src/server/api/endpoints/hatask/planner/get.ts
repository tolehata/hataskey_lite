import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import {
	HATASK_PLANNER_COLLECTIONS,
	findPlannerRows,
	hashPlannerValue,
	latestPlannerRow,
	mergePlannerRows,
	plannerBackupKey,
	readBackupEnvelope,
} from './_shared.js';
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	// Hatask本体のdomain=null Registryだけを扱う。3rd-party token用domainと混ぜない。
	secure: true,
	kind: 'read:account',
	limit: { duration: 1000 * 60, max: 60 },
	res: { type: 'object' },
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.db) private db: DataSource,
	) {
		super(meta, paramDef, async (_ps, me) => {
			const keys = [
				...HATASK_PLANNER_COLLECTIONS,
				...HATASK_PLANNER_COLLECTIONS.map(plannerBackupKey),
			];
			const rows = await findPlannerRows(this.db.manager, me.id, keys);
			const collections: Record<string, unknown> = {};

			for (const collection of HATASK_PLANNER_COLLECTIONS) {
				const collectionRows = rows.filter(row => row.key === collection);
				const latest = latestPlannerRow(collectionRows);
				const value = mergePlannerRows(collectionRows);
				const hash = hashPlannerValue(value);
				const updatedAt = latest?.updatedAt.toISOString() ?? null;
				const backup = readBackupEnvelope(latestPlannerRow(rows.filter(row => row.key === plannerBackupKey(collection)))?.value);

				collections[collection] = {
					exists: latest != null,
					updatedAt,
					revision: latest == null ? null : `${updatedAt}:${hash}`,
					value,
					hash,
					rowCount: collectionRows.length,
					backupCount: backup.snapshots.length,
					latestBackupAt: backup.snapshots[0]?.savedAt ?? null,
				};
			}

			return { version: 1, collections };
		});
	}
}
