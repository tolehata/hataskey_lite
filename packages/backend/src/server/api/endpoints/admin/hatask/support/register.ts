/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskSupportService, HATASK_SUPPORT_ERRORS } from '@/core/HataskSupportService.js';
import { supportRegistrationSchema, supportUserParams } from '@/server/api/endpoints/hatask/support/_schema.js';

export const meta = {
	tags: ['admin', 'hatask'],
	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:meta',
	limit: { duration: 60 * 1000, max: 30 },
	errors: HATASK_SUPPORT_ERRORS,
	res: supportRegistrationSchema,
} as const;

export const paramDef = supportUserParams;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskSupportService) {
		super(meta, paramDef, async (ps, me) => service.setSupporter(ps.userId, true));
	}
}
