/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddHatadintConsent1788900000000 {
	name = 'AddHatadintConsent1788900000000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataConsentDrawing" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataConsentDrawingDate" TIMESTAMP WITH TIME ZONE');
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataConsentDrawingVersion" character varying(32)');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataConsentDrawingVersion"');
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataConsentDrawingDate"');
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataConsentDrawing"');
	}
}
