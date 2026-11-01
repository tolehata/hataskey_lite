/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { registrationReviewErrors } from '@/core/registration-review-policy.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { MiMeta } from '@/models/_.js';
import type { Config } from '@/config.js';
import { SignupService } from '@/core/SignupService.js';
import { EmailService } from '@/core/EmailService.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationApprovalErrors, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:approve-registration',
	limit: { duration: 60 * 1000, max: 10 },
	res: { type: 'object', properties: { success: { type: 'boolean' }, emailSent: { type: 'boolean' } } },

	errors: {
		...registrationReviewErrors,
		registrationApplicationsDisabled: registrationApplicationsDisabledError,
		...registrationApplicationApprovalErrors,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		applicationId: { type: 'string', minLength: 1, maxLength: 32 },
		revision: { type: 'string', minLength: 64, maxLength: 64 },
	},
	required: ['applicationId', 'revision'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private serverMeta: MiMeta,

		private signupService: SignupService,
		private emailService: EmailService,
	) {
		super(meta, paramDef, async (ps, me) => {
			assertRegistrationApplicationsEnabled(this.serverMeta);
			// Account, verified email and decision/contact deletion commit together.
			const { account, applicationEmail } = await this.signupService.signup({ registrationApplicationId: ps.applicationId, reviewerId: me.id, revision: ps.revision });
			if (applicationEmail == null) throw new Error('Missing approved application email');
			const username = account.username;
			const email = applicationEmail;

			// ★ 承認時のみメール送信
			const emailSent = await this.emailService.sendTemplateEmail(
				email,
				{ kind: 'registration-approved', username },
			).then(() => true, () => false);

			return { success: true, emailSent };
		});
	}
}
