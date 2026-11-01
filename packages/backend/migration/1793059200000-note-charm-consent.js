/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteCharmConsent1793059200000 {
	name = 'NoteCharmConsent1793059200000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataConsentNoteCharm" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "user_profile" ADD "hataConsentNoteCharmDate" TIMESTAMP WITH TIME ZONE');
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataConsentNoteCharmDate"');
		await queryRunner.query('ALTER TABLE "user_profile" DROP COLUMN "hataConsentNoteCharm"');
	}
}
