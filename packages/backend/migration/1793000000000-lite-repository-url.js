/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// hataskey Lite: the unmodified source of this software is tolehata/hataskey_lite.
// Only the previous default is rewritten; a repository URL chosen by the administrator is kept.
export class LiteRepositoryUrl1793000000000 {
	name = 'LiteRepositoryUrl1793000000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "repositoryUrl" SET DEFAULT 'https://github.com/tolehata/hataskey_lite'`);
		await queryRunner.query(`UPDATE "meta" SET "repositoryUrl" = 'https://github.com/tolehata/hataskey_lite' WHERE "repositoryUrl" = 'https://github.com/tolehata/hataskey'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "repositoryUrl" SET DEFAULT 'https://github.com/tolehata/hataskey'`);
		await queryRunner.query(`UPDATE "meta" SET "repositoryUrl" = 'https://github.com/tolehata/hataskey' WHERE "repositoryUrl" = 'https://github.com/tolehata/hataskey_lite'`);
	}
}
