/* SPDX-License-Identifier: AGPL-3.0-only */
export class RegistrationRejectionNotification1790380000000 {
	name = 'RegistrationRejectionNotification1790380000000';
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "rejectionNotificationStatus" varchar(16), ADD "rejectionNotificationAttemptedAt" timestamptz`);
		await queryRunner.query(`ALTER TABLE "registration_application" ADD CONSTRAINT "CHK_registration_rejection_notification" CHECK ("rejectionNotificationStatus" IS NULL OR ("status" = 'rejected' AND "rejectionNotificationStatus" IN ('pending', 'sending', 'sent', 'failed')))`);
	}
	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" DROP CONSTRAINT "CHK_registration_rejection_notification", DROP COLUMN "rejectionNotificationAttemptedAt", DROP COLUMN "rejectionNotificationStatus"`);
	}
}
