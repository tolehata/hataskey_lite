/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskSupportService, HATASK_SUPPORT_ERRORS } from '@/core/HataskSupportService.js';
import { supportAdminShowSchema } from '@/server/api/endpoints/hatask/support/_schema.js';

export const meta = {
	tags: ['admin', 'hatask'],
	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'read:admin:meta',
	limit: { duration: 60 * 1000, max: 60 },
	errors: HATASK_SUPPORT_ERRORS,
	res: supportAdminShowSchema,
} as const;

export const paramDef = { type: 'object', properties: { previewRoleId: { type: 'string', format: 'misskey:id', nullable: true } }, required: [], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskSupportService) {
		super(meta, paramDef, async (ps, me) => service.adminShow(ps.previewRoleId));
	}
}
