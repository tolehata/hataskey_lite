/*
 * 旗鯖fork(1c): Hatady のユーザー個別設定(hatady_user_profile: バナー色など)を追加。
 */
export class AddHatadyUserProfile1786400000000 {
	name = 'AddHatadyUserProfile1786400000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_user_profile" ("userId" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "bannerColor" character varying(32), CONSTRAINT "PK_hatady_user_profile" PRIMARY KEY ("userId"))`);
		await queryRunner.query(`ALTER TABLE "hatady_user_profile" ADD CONSTRAINT "FK_hatady_user_profile_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_user_profile" DROP CONSTRAINT "FK_hatady_user_profile_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_user_profile"`);
	}
}
