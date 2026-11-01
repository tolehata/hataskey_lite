/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MiMeta, RegistrationApplicationsRepository } from '@/models/_.js';
import type { MiRegistrationApplication, RegistrationRejectionNotificationStatus } from '@/models/RegistrationApplication.js';
import { EmailService } from '@/core/EmailService.js';

export const rejectionNotificationSchema = { type: 'string', nullable: true, enum: ['pending', 'sending', 'sent', 'failed'] } as const;
export const rejectionDeliveryResponseSchema = {
	type: 'object', properties: { success: { type: 'boolean' }, emailSent: { type: 'boolean' }, notificationStatus: rejectionNotificationSchema },
} as const;
export const rejectionNotificationClaimTimeout = 15 * 60 * 1000;
export function rejectionNotificationRetryAvailable(app: Pick<MiRegistrationApplication, 'status' | 'rejectionNotificationStatus' | 'rejectionNotificationAttemptedAt'>, now = Date.now()): boolean {
	return app.status === 'rejected' && (app.rejectionNotificationStatus === 'pending' || app.rejectionNotificationStatus === 'failed' || (app.rejectionNotificationStatus === 'sending' && app.rejectionNotificationAttemptedAt != null && app.rejectionNotificationAttemptedAt.getTime() < now - rejectionNotificationClaimTimeout));
}

@Injectable()
export class RegistrationRejectionNotificationService {
	constructor(
		@Inject(DI.meta) private serverMeta: MiMeta,
		@Inject(DI.registrationApplicationsRepository) private applications: RegistrationApplicationsRepository,
		private emailService: EmailService,
	) {}

	/** Atomic lease; only an explicit administrator retry may recover an expired send. */
	async send(applicationId: string, explicitRetry = false): Promise<{ emailSent: boolean; notificationStatus: RegistrationRejectionNotificationStatus | null }> {
		const attemptedAt = new Date();
		const claim = await this.applications.createQueryBuilder().update().set({ rejectionNotificationStatus: 'sending', rejectionNotificationAttemptedAt: attemptedAt })
			.where('id = :id AND status = :status', { id: applicationId, status: 'rejected' })
			.andWhere(explicitRetry ? '("rejectionNotificationStatus" IN (:...states) OR ("rejectionNotificationStatus" = :sending AND "rejectionNotificationAttemptedAt" < :expired))' : '"rejectionNotificationStatus" IN (:...states)', {
				states: ['pending', 'failed'], sending: 'sending', expired: new Date(attemptedAt.getTime() - rejectionNotificationClaimTimeout),
			}).execute();
		if (claim.affected !== 1) {
			const current = await this.applications.findOneBy({ id: applicationId });
			return { emailSent: false, notificationStatus: current?.rejectionNotificationStatus ?? null };
		}
		let status: 'sent' | 'failed' = 'failed';
		try {
			const application = await this.applications.findOne({ where: { id: applicationId }, select: { id: true, email: true } });
			if (!this.serverMeta.enableEmail || !application?.email) throw new Error('Rejection notification is unavailable');
			await this.emailService.sendTemplateEmail(application.email, { kind: 'registration-rejected' });
			status = 'sent';
		} catch { /* Keep the committed rejection; never persist SMTP errors or personal data. */ }
		try {
			const result = await this.applications.update({ id: applicationId, rejectionNotificationStatus: 'sending', rejectionNotificationAttemptedAt: attemptedAt }, { rejectionNotificationStatus: status });
			if (result.affected === 1) return { emailSent: status === 'sent', notificationStatus: status };
		} catch { /* SMTP may have accepted the message; do not report a confirmed success. */ }
		return { emailSent: false, notificationStatus: 'sending' };
	}
}
