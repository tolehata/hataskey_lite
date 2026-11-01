/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class HataskRecipeReferenceLinks1790380100000 {
	name = 'HataskRecipeReferenceLinks1790380100000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatask_recipe" ADD "referenceLinks" jsonb NOT NULL DEFAULT '[]'::jsonb`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatask_recipe" DROP COLUMN "referenceLinks"`);
	}
}
