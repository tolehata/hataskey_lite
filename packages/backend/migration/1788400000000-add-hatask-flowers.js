/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddHataskFlowers1788400000000 {
	name = 'AddHataskFlowers1788400000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatask_flower" (
			"id" varchar(32) NOT NULL,
			"userId" varchar(32) NOT NULL,
			"clientFlowerId" varchar(64) NOT NULL,
			"emoji" varchar(32) NOT NULL,
			"name" varchar(80) NOT NULL,
			"hanakotoba" varchar(256) NOT NULL DEFAULT '',
			"harvestedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			CONSTRAINT "PK_hatask_flower" PRIMARY KEY ("id"),
			CONSTRAINT "FK_hatask_flower_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
		)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatask_flower_user_client" ON "hatask_flower" ("userId", "clientFlowerId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_flower_harvested" ON "hatask_flower" ("harvestedAt", "id")`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataskFlowerVisibility" varchar(16) NOT NULL DEFAULT 'public'`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD CONSTRAINT "CHK_user_profile_hatask_flower_visibility" CHECK ("hataskFlowerVisibility" IN ('public', 'followers', 'private'))`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" DROP CONSTRAINT "CHK_user_profile_hatask_flower_visibility"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataskFlowerVisibility"`);
		await queryRunner.query(`DROP INDEX "IDX_hatask_flower_harvested"`);
		await queryRunner.query(`DROP INDEX "IDX_hatask_flower_user_client"`);
		await queryRunner.query(`DROP TABLE "hatask_flower"`);
	}
}
