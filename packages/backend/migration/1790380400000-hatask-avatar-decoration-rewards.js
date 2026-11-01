/* SPDX-License-Identifier: AGPL-3.0-only */
export class HataskAvatarDecorationRewards1790380400000 {
	name = 'HataskAvatarDecorationRewards1790380400000';

	async up(queryRunner) {
		await queryRunner.query('ALTER TABLE "avatar_decoration" ADD "requiresHataskFlowerCompletion" boolean NOT NULL DEFAULT false');
		await queryRunner.query('ALTER TABLE "avatar_decoration" ADD "availableFrom" timestamp with time zone');
		await queryRunner.query('ALTER TABLE "avatar_decoration" ADD "availableUntil" timestamp with time zone');
		await queryRunner.query('ALTER TABLE "avatar_decoration" ADD CONSTRAINT "CHK_avatar_decoration_available_period" CHECK ("availableFrom" IS NULL OR "availableUntil" IS NULL OR "availableFrom" < "availableUntil")');
		await queryRunner.query('ALTER TABLE "hatask_drop_wallet" ADD "flowerCollectionCompletedAt" timestamp with time zone');
		await queryRunner.query('CREATE INDEX "IDX_hatask_flower_harvest_user_season_species" ON "hatask_flower_harvest" ("userId", "season", "speciesId")');
		// Freeze the catalog at this migration: future catalog edits must not undo earned rewards.
		await queryRunner.query(`WITH current_season AS (
			SELECT CASE
				WHEN EXTRACT(MONTH FROM now() AT TIME ZONE 'Asia/Tokyo') BETWEEN 3 AND 5 THEN 'spring'
				WHEN EXTRACT(MONTH FROM now() AT TIME ZONE 'Asia/Tokyo') BETWEEN 6 AND 8 THEN 'summer'
				WHEN EXTRACT(MONTH FROM now() AT TIME ZONE 'Asia/Tokyo') BETWEEN 9 AND 11 THEN 'autumn'
				ELSE 'winter' END AS season
		), catalog AS (
			SELECT season, unnest(CASE season
				WHEN 'spring' THEN ARRAY['sp1','sp2','sp3','sp4','sp5','sp6','sp7','sp8','sp9','sp10','sp11','sp12']
				WHEN 'summer' THEN ARRAY['su1','su2','su3','su4','su5','su6','su7','su8','su9','su10','su11','su12']
				WHEN 'autumn' THEN ARRAY['au1','au2','au3','au4','au5','au6','au7','au8','au9','au10','au11','au12']
				ELSE ARRAY['wi1','wi2','wi3','wi4','wi5','wi6','wi7','wi8','wi9','wi10','wi11','wi12'] END) AS species_id
			FROM current_season
		)
		UPDATE hatask_drop_wallet wallet SET "flowerCollectionCompletedAt" = now()
		WHERE NOT EXISTS (
			SELECT 1 FROM catalog WHERE NOT EXISTS (
				SELECT 1 FROM hatask_flower_harvest harvest WHERE harvest."userId" = wallet."userId"
				AND harvest.season = catalog.season AND harvest."speciesId" = catalog.species_id
			)
		)`);
	}

	async down(queryRunner) {
		await queryRunner.query('DROP INDEX "IDX_hatask_flower_harvest_user_season_species"');
		await queryRunner.query('ALTER TABLE "hatask_drop_wallet" DROP "flowerCollectionCompletedAt"');
		await queryRunner.query('ALTER TABLE "avatar_decoration" DROP CONSTRAINT "CHK_avatar_decoration_available_period"');
		await queryRunner.query('ALTER TABLE "avatar_decoration" DROP "availableUntil"');
		await queryRunner.query('ALTER TABLE "avatar_decoration" DROP "availableFrom"');
		await queryRunner.query('ALTER TABLE "avatar_decoration" DROP "requiresHataskFlowerCompletion"');
	}
}
