/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RegistrationClosureAndRepositoryDefault1789340000000 {
	name = 'RegistrationClosureAndRepositoryDefault1789340000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "registrationClosed" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "repositoryUrl" SET DEFAULT 'https://github.com/tolehata/hataskey'`);
		await queryRunner.query(`UPDATE "meta" SET "repositoryUrl" = 'https://github.com/tolehata/hataskey' WHERE "repositoryUrl" = 'https://github.com/kokonect-link/cherrypick'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "registrationClosed"`);
		await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "repositoryUrl" SET DEFAULT 'https://github.com/kokonect-link/cherrypick'`);
		// Preserve repository URLs already selected by the administrator or corrected above.
	}
}
