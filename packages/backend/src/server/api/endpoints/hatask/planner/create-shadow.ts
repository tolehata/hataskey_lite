/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import {
	HATASK_PLANNER_CORE_COLLECTIONS,
	HATASK_PLANNER_TARGET_SCHEMA_VERSION,
	type HataskPlannerCoreCollection,
	type PlannerMigrationTargetIntegrity,
} from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	secure: true,
	kind: 'write:account',
	limit: { duration: ms('1min'), max: 10 },
	res: { type: 'object' },
	errors: {
		conflict: {
			message: 'Hatask planner data changed before the migration shadow was created.',
			code: 'HATASK_PLANNER_CONFLICT',
			id: '9c0232ca-d0e9-44b1-8233-c2d135a45c37',
		},
		invalidStoredData: {
			message: 'Stored Hatask planner data cannot be backed up safely.',
			code: 'HATASK_PLANNER_INVALID_STORED_DATA',
			id: '4c0406b7-612d-440f-a038-4e92b3ce8b06',
		},
		invalidTarget: {
			message: 'Hatask planner migration evidence does not match the stored item counts.',
			code: 'HATASK_PLANNER_INVALID_TARGET',
			id: '545253cb-1742-470e-8d88-e60b6f1c2eca',
		},
		payloadTooLarge: {
			message: 'Hatask planner data is too large for an atomic migration commit.',
			code: 'HATASK_PLANNER_PAYLOAD_TOO_LARGE',
			id: '89d872f1-c46e-4971-96cd-ddaf9e70c5ea',
		},
	},
} as const;

const revisionSchema = { type: 'string', nullable: true } as const;
const collectionIntegritySchema = {
	type: 'object',
	properties: {
		count: { type: 'integer', minimum: 0, maximum: 50000 },
		normalizedHash: { type: 'string', pattern: '^fnv1a64:[0-9a-f]{16}$' },
	},
	required: ['count', 'normalizedHash'],
	additionalProperties: false,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		expectedRevisions: {
			type: 'object',
			properties: {
				todos: revisionSchema,
				folders: revisionSchema,
				events: revisionSchema,
			},
			required: HATASK_PLANNER_CORE_COLLECTIONS,
			additionalProperties: false,
		},
		targetIntegrity: {
			type: 'object',
			properties: {
				schemaVersion: {
					type: 'integer',
					minimum: HATASK_PLANNER_TARGET_SCHEMA_VERSION,
					maximum: HATASK_PLANNER_TARGET_SCHEMA_VERSION,
				},
				collections: {
					type: 'object',
					properties: {
						todos: collectionIntegritySchema,
						folders: collectionIntegritySchema,
						events: collectionIntegritySchema,
					},
					required: HATASK_PLANNER_CORE_COLLECTIONS,
					additionalProperties: false,
				},
				fullNormalizedHash: { type: 'string', pattern: '^fnv1a64:[0-9a-f]{16}$' },
			},
			required: ['schemaVersion', 'collections', 'fullNormalizedHash'],
			additionalProperties: false,
		},
	},
	required: ['expectedRevisions', 'targetIntegrity'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private registryApiService: RegistryApiService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				return await this.registryApiService.createHataskPlannerMigrationShadow(
					me.id,
					ps.expectedRevisions as Record<HataskPlannerCoreCollection, string | null>,
					ps.targetIntegrity as PlannerMigrationTargetIntegrity,
				);
			} catch (error) {
				if (error instanceof IdentifiableError) {
					if (error.id === 'e3444ce7-0d3f-4471-bd0c-6e09e67daa47') throw new ApiError(meta.errors.invalidTarget);
					if (error.id === '97ea3e66-8a62-4919-a7da-0b16b25677e0') throw new ApiError(meta.errors.payloadTooLarge);
					if (error.id === 'fbc74e90-140f-4288-93aa-6d88eb4765ea' || error.id === '3cb60500-7526-42d1-b102-2805984ee177') {
						throw new ApiError(meta.errors.conflict);
					}
				}
				if (error instanceof TypeError) throw new ApiError(meta.errors.invalidStoredData);
				throw error;
			}
		});
	}
}
