/*
 * 旗鯖fork: Hatady 学習ログに公開範囲(visibility: public / followers / private)を追加。
 *   既存の isPublic から移行(true→public / false→private)。isPublic は public 判定用に併存維持。
 */
export class AddHatadyLogVisibility1786200000000 {
	name = 'AddHatadyLogVisibility1786200000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_log" ADD "visibility" character varying(16) NOT NULL DEFAULT 'public'`);
		await queryRunner.query(`UPDATE "hatady_log" SET "visibility" = CASE WHEN "isPublic" THEN 'public' ELSE 'private' END`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_visibility" ON "hatady_log" ("visibility")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_hatady_log_visibility"`);
		await queryRunner.query(`ALTER TABLE "hatady_log" DROP COLUMN "visibility"`);
	}
}
