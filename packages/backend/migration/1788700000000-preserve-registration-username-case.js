/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class PreserveRegistrationUsernameCase1788700000000 {
	name = 'PreserveRegistrationUsernameCase1788700000000'

	async up(queryRunner) {
		// Keep concurrent applications from reserving case variants of the same ID.
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_reg_app_username_lower_pending" ON "registration_application" (LOWER("username")) WHERE "status" = 'pending'`);
		await queryRunner.query(`DROP INDEX "IDX_reg_app_username_pending"`);
	}

	async down(queryRunner) {
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_reg_app_username_pending" ON "registration_application" ("username") WHERE "status" = 'pending'`);
		await queryRunner.query(`DROP INDEX "IDX_reg_app_username_lower_pending"`);
	}
}
