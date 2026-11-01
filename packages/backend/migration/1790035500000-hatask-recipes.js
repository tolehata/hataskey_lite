/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class HataskRecipes1790035500000 {
	name = 'HataskRecipes1790035500000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatask_recipe" (
			"id" varchar(32) NOT NULL,
			"createdAt" timestamptz NOT NULL,
			"updatedAt" timestamptz NOT NULL,
			"userId" varchar(32) NOT NULL,
			"title" varchar(128) NOT NULL,
			"summary" varchar(512) NOT NULL DEFAULT '',
			"category" varchar(16) NOT NULL DEFAULT 'main',
			"servings" smallint NOT NULL DEFAULT 2,
			"minutes" smallint,
			"scalable" boolean NOT NULL DEFAULT true,
			"ingredients" jsonb NOT NULL DEFAULT '[]'::jsonb,
			"steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
			"tags" varchar(32)[] NOT NULL DEFAULT '{}',
			"fileId" varchar(32),
			"visibility" varchar(16) NOT NULL DEFAULT 'private',
			"visibleUserIds" varchar(32)[] NOT NULL DEFAULT '{}',
			"isDraft" boolean NOT NULL DEFAULT false,
			CONSTRAINT "PK_hatask_recipe" PRIMARY KEY ("id"),
			CONSTRAINT "CHK_hatask_recipe_category" CHECK ("category" IN ('main', 'side', 'soup', 'staple', 'dessert')),
			CONSTRAINT "CHK_hatask_recipe_visibility" CHECK ("visibility" IN ('private', 'followers', 'specified')),
			CONSTRAINT "CHK_hatask_recipe_servings" CHECK ("servings" BETWEEN 1 AND 50),
			CONSTRAINT "FK_hatask_recipe_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatask_recipe_file" FOREIGN KEY ("fileId") REFERENCES "drive_file"("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_recipe_userId" ON "hatask_recipe" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_recipe_userId_updatedAt" ON "hatask_recipe" ("userId", "updatedAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_recipe_visibleUserIds" ON "hatask_recipe" USING gin ("visibleUserIds")`);

		await queryRunner.query(`CREATE TABLE "hatask_cooking_record" (
			"id" varchar(32) NOT NULL,
			"createdAt" timestamptz NOT NULL,
			"cookedAt" timestamptz NOT NULL,
			"userId" varchar(32) NOT NULL,
			"recipeId" varchar(32),
			"title" varchar(128) NOT NULL,
			"durationSeconds" integer,
			"servings" smallint NOT NULL DEFAULT 2,
			"mealSlot" varchar(16),
			"cost" integer,
			"memo" varchar(2000) NOT NULL DEFAULT '',
			"fileId" varchar(32),
			"visibility" varchar(16) NOT NULL DEFAULT 'private',
			"visibleUserIds" varchar(32)[] NOT NULL DEFAULT '{}',
			"hatadyLogId" varchar(32),
			CONSTRAINT "PK_hatask_cooking_record" PRIMARY KEY ("id"),
			CONSTRAINT "CHK_hatask_cooking_record_meal_slot" CHECK ("mealSlot" IS NULL OR "mealSlot" IN ('breakfast', 'lunch', 'dinner', 'snack')),
			CONSTRAINT "CHK_hatask_cooking_record_visibility" CHECK ("visibility" IN ('private', 'followers', 'specified')),
			CONSTRAINT "FK_hatask_cooking_record_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatask_cooking_record_recipe" FOREIGN KEY ("recipeId") REFERENCES "hatask_recipe"("id") ON DELETE SET NULL,
			CONSTRAINT "FK_hatask_cooking_record_file" FOREIGN KEY ("fileId") REFERENCES "drive_file"("id") ON DELETE SET NULL,
			CONSTRAINT "FK_hatask_cooking_record_hatady_log" FOREIGN KEY ("hatadyLogId") REFERENCES "hatady_log"("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_cooking_record_userId" ON "hatask_cooking_record" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_cooking_record_recipeId" ON "hatask_cooking_record" ("recipeId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatask_cooking_record_userId_cookedAt" ON "hatask_cooking_record" ("userId", "cookedAt")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "hatask_cooking_record"`);
		await queryRunner.query(`DROP TABLE "hatask_recipe"`);
		// Cooking logs only exist for records created by this feature.
		await queryRunner.query(`DELETE FROM "hatady_log" WHERE "kind" = 'cooking'`);
	}
}
