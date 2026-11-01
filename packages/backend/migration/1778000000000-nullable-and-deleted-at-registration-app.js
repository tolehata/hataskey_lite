/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork:
 * - registration_application.username / hashedPassword / email を nullable 化
 *   (申請拒否時に個人情報を即時削除できるようにするため)
 * - personalDataDeletedAt カラムを追加
 *   (削除実行日時を記録)
 */

export class NullableAndDeletedAtRegistrationApp1778000000000 {
	name = 'NullableAndDeletedAtRegistrationApp1778000000000'

	async up(queryRunner) {
		// username: NOT NULL → nullable
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "username" DROP NOT NULL`);
		// hashedPassword: NOT NULL → nullable
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "hashedPassword" DROP NOT NULL`);
		// email: NOT NULL → nullable
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "email" DROP NOT NULL`);
		// personalDataDeletedAt: 新規カラム追加 (nullable)
		await queryRunner.query(`ALTER TABLE "registration_application" ADD "personalDataDeletedAt" TIMESTAMP WITH TIME ZONE`);
	}

	async down(queryRunner) {
		// 巻き戻し: NULL のレコードがあれば空文字列に上書き (型変更前提)
		await queryRunner.query(`UPDATE "registration_application" SET "username" = '' WHERE "username" IS NULL`);
		await queryRunner.query(`UPDATE "registration_application" SET "hashedPassword" = '' WHERE "hashedPassword" IS NULL`);
		await queryRunner.query(`UPDATE "registration_application" SET "email" = '' WHERE "email" IS NULL`);
		await queryRunner.query(`ALTER TABLE "registration_application" DROP COLUMN "personalDataDeletedAt"`);
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "email" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "hashedPassword" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "registration_application" ALTER COLUMN "username" SET NOT NULL`);
	}
}
