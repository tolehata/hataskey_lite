/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddRegistrationAdditionalContacts1788500000000 {
	name = 'AddRegistrationAdditionalContacts1788500000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "additionalContacts" varchar(1024) NULL`);
		await queryRunner.query(`ALTER TABLE "registration_application" ADD CONSTRAINT "CHK_registration_application_pending_contacts" CHECK ("status" = 'pending' OR "additionalContacts" IS NULL)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "registration_application" DROP CONSTRAINT "CHK_registration_application_pending_contacts"`);
		await queryRunner.query(`ALTER TABLE "registration_application" DROP COLUMN "additionalContacts"`);
	}
}
