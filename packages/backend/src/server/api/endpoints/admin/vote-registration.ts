/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import { registrationReviewErrors } from '@/core/registration-review-policy.js';
import { registrationApplicationApprovalErrors, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireModerator: true, secure: true,
	kind: 'write:admin:vote-registration',
	limit: { duration: 60 * 1000, max: 30 },
	errors: { ...registrationReviewErrors, ...registrationApplicationApprovalErrors, registrationApplicationsDisabled: registrationApplicationsDisabledError },
	res: { type: 'object', properties: { success: { type: 'boolean' } } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		applicationId: { type: 'string', minLength: 1, maxLength: 32 },
		revision: { type: 'string', minLength: 64, maxLength: 64 },
		choice: { type: 'string', enum: ['agree', 'oppose'] },
		reason: { type: 'string', maxLength: 300, default: '' },
	},
	required: ['applicationId', 'revision', 'choice'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(private registrationReviewService: RegistrationApplicationReviewService) {
		super(meta, paramDef, async (ps, me) => {
			await this.registrationReviewService.vote(ps.applicationId, me.id, ps.revision, ps.choice, ps.reason);
			return { success: true };
		});
	}
}
