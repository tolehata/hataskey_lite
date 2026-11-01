/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiMeta, RegistrationApplicationsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import { RegistrationRejectionNotificationService, rejectionNotificationRetryAvailable, rejectionDeliveryResponseSchema } from '@/core/RegistrationRejectionNotificationService.js';
import { registrationReviewErrors } from '@/core/registration-review-policy.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireModerator: true, requireAdmin: true, secure: true,
	kind: 'write:admin:reject-registration', limit: { duration: 60 * 1000, max: 30 }, res: rejectionDeliveryResponseSchema,
	errors: {
		...registrationReviewErrors, registrationApplicationsDisabled: registrationApplicationsDisabledError,
		notRetryable: { message: 'This rejection notification cannot be retried.', code: 'REJECTION_NOTIFICATION_NOT_RETRYABLE', id: 'c0000001-0001-0001-0001-000000000003' },
	},
} as const;
export const paramDef = { type: 'object', properties: { applicationId: { type: 'string', minLength: 1, maxLength: 32 } }, required: ['applicationId'] } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.meta) private serverMeta: MiMeta,
		@Inject(DI.registrationApplicationsRepository) private applications: RegistrationApplicationsRepository,
		private reviewService: RegistrationApplicationReviewService,
		private notifications: RegistrationRejectionNotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			assertRegistrationApplicationsEnabled(this.serverMeta);
			await this.reviewService.assertRoot(me.id);
			const application = await this.applications.findOneBy({ id: ps.applicationId });
			if (!application || !rejectionNotificationRetryAvailable(application)) throw new ApiError(meta.errors.notRetryable);
			assertRegistrationApplicationsEnabled(this.serverMeta);
			return { success: true, ...await this.notifications.send(ps.applicationId, true) };
		});
	}
}
