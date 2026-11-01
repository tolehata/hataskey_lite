/*
 * 旗鯖fork: 自鯖限定のプロフィール実績バッジの表示設定と、
 * Hatask で育てた花の数を追加する。ActivityPub には送出しない。
 */
export class AddLocalProfileBadges1787800000000 {
	name = 'AddLocalProfileBadges1787800000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "showUtageSuccessCount" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "showUtageInterruptionCount" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "showHataskFlowerCount" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "hataskFlowerCount" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "utage_session" ADD "interruptedByUserId" character varying(32)`);
		await queryRunner.query(`CREATE INDEX "IDX_utage_session_interruptedByUserId" ON "utage_session" ("interruptedByUserId")`);
		await queryRunner.query(`ALTER TABLE "utage_session" ADD CONSTRAINT "FK_utage_session_interruptedByUserId" FOREIGN KEY ("interruptedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "utage_session" DROP CONSTRAINT "FK_utage_session_interruptedByUserId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_utage_session_interruptedByUserId"`);
		await queryRunner.query(`ALTER TABLE "utage_session" DROP COLUMN "interruptedByUserId"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "hataskFlowerCount"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "showHataskFlowerCount"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "showUtageInterruptionCount"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "showUtageSuccessCount"`);
	}
}
