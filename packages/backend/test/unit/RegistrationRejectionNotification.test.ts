/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { RegistrationRejectionNotificationService, rejectionNotificationRetryAvailable, rejectionNotificationClaimTimeout } from '@/core/RegistrationRejectionNotificationService.js';
import { createHataskeyEmail } from '@/core/email/hataskey-email-content.js';
import ResendEndpoint from '@/server/api/endpoints/admin/resend-registration-rejection.js';

vi.mock('@/core/EmailService.js', () => ({ EmailService: class {} }));
vi.mock('@/core/RegistrationApplicationReviewService.js', () => ({ RegistrationApplicationReviewService: class {} }));

function fixture() {
	const application = { id: 'app', status: 'rejected', email: 'recipient@example.invalid', rejectionNotificationStatus: 'pending' as string | null, rejectionNotificationAttemptedAt: null as Date | null };
	const query = {
		update: vi.fn(), set: vi.fn(), where: vi.fn(), andWhere: vi.fn(),
		execute: vi.fn(async () => {
			const [condition, claim] = query.andWhere.mock.lastCall as [string, { states: string[]; sending: string; expired: Date }];
			const identity = query.where.mock.lastCall?.[1] as { id: string; status: string };
			const eligible = claim.states.includes(application.rejectionNotificationStatus ?? '') || (condition.includes('"rejectionNotificationAttemptedAt" < :expired') && application.rejectionNotificationStatus === claim.sending && application.rejectionNotificationAttemptedAt != null && application.rejectionNotificationAttemptedAt.getTime() < claim.expired.getTime());
			if (application.id !== identity.id || application.status !== identity.status || !eligible) return { affected: 0 };
			const values = query.set.mock.lastCall?.[0];
			Object.assign(application, values);
			return { affected: 1 };
		}),
	};
	for (const method of ['update', 'set', 'where', 'andWhere'] as const) query[method].mockReturnValue(query);
	const repository = {
		createQueryBuilder: vi.fn(() => query), findOneBy: vi.fn(async () => application), findOne: vi.fn(async () => application),
		update: vi.fn(async (criteria: { id: string; rejectionNotificationStatus: string; rejectionNotificationAttemptedAt: Date }, values: unknown) => {
			if (application.id !== criteria.id || application.rejectionNotificationStatus !== criteria.rejectionNotificationStatus || application.rejectionNotificationAttemptedAt?.getTime() !== criteria.rejectionNotificationAttemptedAt.getTime()) return { affected: 0 };
			Object.assign(application, values); return { affected: 1 };
		}),
	};
	const serverMeta = { enableEmail: true };
	const mail = { sendTemplateEmail: vi.fn().mockResolvedValue(undefined) };
	const service = new RegistrationRejectionNotificationService(serverMeta as never, repository as never, mail as never);
	return { application, query, repository, serverMeta, mail, service };
}

describe('registration rejection delivery', () => {
	test('resend requires root before reading or sending', async () => {
		const f = fixture();
		const review = { assertRoot: vi.fn().mockRejectedValue(new Error('forbidden')) };
		const endpoint = new ResendEndpoint({ disableRegistration: true, registrationClosed: false } as never, f.repository as never, review as never, f.service);
		await expect(endpoint.exec({ applicationId: 'app' }, { id: 'staff' } as never, null, null)).rejects.toThrow('forbidden');
		expect(f.repository.findOneBy).not.toHaveBeenCalled();
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});
	test.each(['sent', null, 'sending'])('resend endpoint rejects %s applications', async status => {
		const f = fixture(); f.application.rejectionNotificationStatus = status;
		const endpoint = new ResendEndpoint({ disableRegistration: true, registrationClosed: false } as never, f.repository as never, { assertRoot: vi.fn().mockResolvedValue(undefined) } as never, f.service);
		await expect(endpoint.exec({ applicationId: 'app' }, { id: 'root' } as never, null, null)).rejects.toMatchObject({ code: 'REJECTION_NOTIFICATION_NOT_RETRYABLE' });
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});
	test('explicit resend accepts a failed application and returns the delivery result', async () => {
		const f = fixture(); f.application.rejectionNotificationStatus = 'failed';
		const endpoint = new ResendEndpoint({ disableRegistration: true, registrationClosed: false } as never, f.repository as never, { assertRoot: vi.fn().mockResolvedValue(undefined) } as never, f.service);
		expect(await endpoint.exec({ applicationId: 'app' }, { id: 'root' } as never, null, null)).toEqual({ success: true, emailSent: true, notificationStatus: 'sent' });
	});
	test('persists success and passes only the fixed privacy-safe template', async () => {
		const f = fixture();
		expect(await f.service.send('app')).toEqual({ emailSent: true, notificationStatus: 'sent' });
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledWith('recipient@example.invalid', { kind: 'registration-rejected' });
		expect(f.repository.update.mock.calls[0][0]).toMatchObject({ id: 'app', rejectionNotificationStatus: 'sending' });
	});
	test.each(['disabled', 'smtp', 'missing-email'])('%s leaves the decision intact and records failure', async reason => {
		const f = fixture();
		if (reason === 'disabled') f.serverMeta.enableEmail = false;
		if (reason === 'smtp') f.mail.sendTemplateEmail.mockRejectedValue(new Error('sensitive smtp error'));
		if (reason === 'missing-email') f.application.email = '';
		expect(await f.service.send('app')).toEqual({ emailSent: false, notificationStatus: 'failed' });
		expect(f.application.status).toBe('rejected');
		if (reason !== 'smtp') expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});
	test('concurrent claims deliver only once', async () => {
		const f = fixture();
		await Promise.all([f.service.send('app'), f.service.send('app', true)]);
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledTimes(1);
	});
	test.each(['sent', null, 'sending'])('blocks %s without a successful claim', async status => {
		const f = fixture(); f.application.rejectionNotificationStatus = status;
		expect((await f.service.send('app', true)).emailSent).toBe(false);
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});
	test('an accepted SMTP message with a failed DB result remains ambiguous', async () => {
		const f = fixture(); f.repository.update.mockRejectedValue(new Error('database unavailable'));
		expect(await f.service.send('app')).toEqual({ emailSent: false, notificationStatus: 'sending' });
		expect(f.application.rejectionNotificationStatus).toBe('sending');
	});
	test('expired sending can be reclaimed only through explicit retry', async () => {
		const f = fixture();
		f.application.rejectionNotificationStatus = 'sending';
		f.application.rejectionNotificationAttemptedAt = new Date(Date.now() - rejectionNotificationClaimTimeout - 1000);
		expect(await f.service.send('app')).toEqual({ emailSent: false, notificationStatus: 'sending' });
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
		expect(await f.service.send('app', true)).toEqual({ emailSent: true, notificationStatus: 'sent' });
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledTimes(1);
	});
	test('completion of an expired attempt cannot overwrite a newer claim', async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-09-26T00:00:00Z'));
			const f = fixture();
			let failOldSend: ((error: Error) => void) | undefined;
			let markOldSendStarted: (() => void) | undefined;
			const oldSendStarted = new Promise<void>(resolve => { markOldSendStarted = resolve; });
			f.mail.sendTemplateEmail.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { failOldSend = reject; markOldSendStarted?.(); }));
			const oldAttempt = f.service.send('app');
			await oldSendStarted;
			const oldTimestamp = f.application.rejectionNotificationAttemptedAt;
			vi.setSystemTime(new Date(Date.now() + rejectionNotificationClaimTimeout + 1));
			expect(await f.service.send('app', true)).toEqual({ emailSent: true, notificationStatus: 'sent' });
			const newTimestamp = f.application.rejectionNotificationAttemptedAt;
			expect(newTimestamp?.getTime()).toBeGreaterThan(oldTimestamp?.getTime() ?? 0);
			failOldSend?.(new Error('old delivery failed'));
			expect(await oldAttempt).toEqual({ emailSent: false, notificationStatus: 'sending' });
			expect(f.application.rejectionNotificationStatus).toBe('sent');
			expect(f.application.rejectionNotificationAttemptedAt).toEqual(newTimestamp);
			expect(f.repository.update.mock.lastCall?.[0].rejectionNotificationAttemptedAt).toEqual(oldTimestamp);
		} finally { vi.useRealTimers(); }
	});
	test('retry only recovers sending after the lease expires, never legacy null', () => {
		const f = fixture(); const now = Date.now();
		f.application.rejectionNotificationStatus = 'sending';
		f.application.rejectionNotificationAttemptedAt = new Date(now - rejectionNotificationClaimTimeout - 1);
		expect(rejectionNotificationRetryAvailable(f.application as never, now)).toBe(true);
		f.application.rejectionNotificationAttemptedAt = new Date(now);
		expect(rejectionNotificationRetryAvailable(f.application as never, now)).toBe(false);
		f.application.rejectionNotificationStatus = null;
		expect(rejectionNotificationRetryAvailable(f.application as never, now)).toBe(false);
	});
	test.each(['ja', 'en'] as const)('%s template has no credentials, reviewer details or settings links', lang => {
		const document = createHataskeyEmail({ kind: 'registration-rejected' }, { name: 'Test', url: 'https://example.invalid', iconUrl: 'https://example.invalid/icon' }, lang);
		expect(document.showSettings).toBe(false);
		expect(document.details).toBeUndefined();
		expect(document.action).toBeUndefined();
		expect(document.quote).toBeUndefined();
		expect(document.subject).toContain('Test');
	});
});
