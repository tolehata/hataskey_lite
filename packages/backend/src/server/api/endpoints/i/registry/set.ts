/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../../error.js';
import { assertHataskNativeRegistryAccess } from './_hatask-planner-access.js';
import { hataskModeratedRecordError, rethrowHataskModerationError } from '@/misc/hatask-moderated-record.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',
	errors: {
		hataskRecordModerated: hataskModeratedRecordError,
		hataskPlannerStaleClient: {
			message: 'Hatask planner data changed or migration is complete. Refresh the client.',
			code: 'HATASK_PLANNER_STALE_CLIENT',
			id: 'a21e311f-bf6c-4fa4-93cd-39fb28783fe7',
		},
		hataskPlannerInvalidData: {
			message: 'Hatask planner data could not be verified.',
			code: 'HATASK_PLANNER_INVALID_DATA',
			id: '8960de54-ea52-4ea4-b1f3-18477f35cc69',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		key: { type: 'string', minLength: 1 },
		value: {},
		scope: { type: 'array', default: [], items: {
			type: 'string', pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
		} },
		domain: { type: 'string', nullable: true },
	},
	required: ['key', 'value', 'scope'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private registryApiService: RegistryApiService,
	) {
		super(meta, paramDef, async (ps, me, accessToken, flashToken) => {
			assertHataskNativeRegistryAccess(ps.scope, flashToken);
			const domain = accessToken ? accessToken.id : (ps.domain ?? null);
			const isHataskPlannerTarget = domain == null && ps.scope.join('/') === 'client/hatask' && [
				'todos', 'folders', 'events', 'templates', 'plannerMigrationShadowV2',
				'__planner_backup_v1_todos', '__planner_backup_v1_folders', '__planner_backup_v1_events', '__planner_backup_v1_templates',
			].includes(ps.key);
			try {
				await this.registryApiService.set(me.id, domain, ps.scope, ps.key, ps.value);
			} catch (error) {
				if ((error as { driverError?: { constraint?: string } })?.driverError?.constraint === 'hatask_record_moderated') rethrowHataskModerationError(error);
				if (!isHataskPlannerTarget) throw error;
				if (error instanceof IdentifiableError) throw new ApiError(meta.errors.hataskPlannerStaleClient);
				throw new ApiError(meta.errors.hataskPlannerInvalidData);
			}
		});
	}
}
