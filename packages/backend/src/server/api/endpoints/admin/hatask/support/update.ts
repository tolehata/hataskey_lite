/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskSupportService, HATASK_SUPPORT_ERRORS } from '@/core/HataskSupportService.js';
import { supportUpdateSettingsSchema } from '@/server/api/endpoints/hatask/support/_schema.js';

export const meta = {
	tags: ['admin', 'hatask'],
	requireCredential: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:meta',
	limit: { duration: 60 * 1000, max: 30 },
	errors: HATASK_SUPPORT_ERRORS,
	res: { type: 'object', properties: { saved: { type: 'boolean' } }, required: ['saved'] },
} as const;

export const paramDef = { type: 'object', properties: { settings: supportUpdateSettingsSchema }, required: ['settings'], additionalProperties: false } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskSupportService) {
		super(meta, paramDef, async (ps, me) => service.update(ps.settings));
	}
}
