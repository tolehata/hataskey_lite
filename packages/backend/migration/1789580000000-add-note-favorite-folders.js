/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddNoteFavoriteFolders1789580000000 {
	name = 'AddNoteFavoriteFolders1789580000000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "note_favorite_folder" (
			"id" varchar(32) NOT NULL PRIMARY KEY,
			"userId" varchar(32) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
			"parentId" varchar(32) REFERENCES "note_favorite_folder"("id") ON DELETE CASCADE,
			"name" varchar(100) NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 100 AND "name" = btrim("name")),
			"color" varchar(10) NOT NULL DEFAULT 'rose' CHECK ("color" IN ('rose','amber','green','blue','violet','slate')),
			"position" integer NOT NULL DEFAULT 0 CHECK ("position" >= 0)
		)`);
		await queryRunner.query('CREATE INDEX "IDX_favorite_folder_owner" ON "note_favorite_folder" ("userId")');
		await queryRunner.query('CREATE INDEX "IDX_favorite_folder_parent" ON "note_favorite_folder" ("parentId")');
		await queryRunner.query('CREATE UNIQUE INDEX "IDX_favorite_folder_root_name" ON "note_favorite_folder" ("userId", "name") WHERE "parentId" IS NULL');
		await queryRunner.query('CREATE UNIQUE INDEX "IDX_favorite_folder_child_name" ON "note_favorite_folder" ("userId", "parentId", "name") WHERE "parentId" IS NOT NULL');
		// Existing rows remain the same favorites. NULL means unfiled; no data rewrite.
		await queryRunner.query('ALTER TABLE "note_favorite" ADD "folderId" varchar(32) NULL');
		await queryRunner.query('CREATE INDEX "IDX_note_favorite_folder" ON "note_favorite" ("folderId")');
		await queryRunner.query('ALTER TABLE "note_favorite" ADD CONSTRAINT "FK_note_favorite_folder" FOREIGN KEY ("folderId") REFERENCES "note_favorite_folder"("id") ON DELETE SET NULL');
	}

	async down() {
		throw new Error('Favorite folder rollback requires an explicit folder assignment backup; no favorites were removed.');
	}
}
