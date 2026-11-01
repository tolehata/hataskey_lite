/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddRegistrationApplication1762000000000 {
    name = 'AddRegistrationApplication1762000000000'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "registration_application" ("id" character varying(32) NOT NULL, "reason" character varying(1024) NOT NULL, "username" character varying(128) NOT NULL, "hashedPassword" character varying(256) NOT NULL, "email" character varying(256) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'pending', "approvedAt" TIMESTAMP WITH TIME ZONE, "rejectedAt" TIMESTAMP WITH TIME ZONE, "userId" character varying(32), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_registration_application" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_reg_app_username_pending" ON "registration_application" ("username") WHERE "status" = 'pending'`);
        await queryRunner.query(`CREATE INDEX "IDX_reg_app_status" ON "registration_application" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_reg_app_createdAt" ON "registration_application" ("createdAt")`);
        await queryRunner.query(`ALTER TABLE "registration_application" ADD CONSTRAINT "FK_reg_app_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "registration_application" DROP CONSTRAINT "FK_reg_app_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_reg_app_createdAt"`);
        await queryRunner.query(`DROP INDEX "IDX_reg_app_status"`);
        await queryRunner.query(`DROP INDEX "IDX_reg_app_username_pending"`);
        await queryRunner.query(`DROP TABLE "registration_application"`);
    }
}
