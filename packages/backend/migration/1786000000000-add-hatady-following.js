/*
 * 旗鯖fork: Hatady 内のフォロー関係テーブル(hatady_following)を追加(要件①: hataskey 本体と非連動)。
 */
export class AddHatadyFollowing1786000000000 {
	name = 'AddHatadyFollowing1786000000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_following" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "followerId" character varying(32) NOT NULL, "followeeId" character varying(32) NOT NULL, CONSTRAINT "PK_hatady_following" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_following_followerId" ON "hatady_following" ("followerId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_following_followeeId" ON "hatady_following" ("followeeId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_following_pair" ON "hatady_following" ("followerId", "followeeId")`);
		await queryRunner.query(`ALTER TABLE "hatady_following" ADD CONSTRAINT "FK_hatady_following_followerId" FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_following" ADD CONSTRAINT "FK_hatady_following_followeeId" FOREIGN KEY ("followeeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_following" DROP CONSTRAINT "FK_hatady_following_followeeId"`);
		await queryRunner.query(`ALTER TABLE "hatady_following" DROP CONSTRAINT "FK_hatady_following_followerId"`);
		await queryRunner.query(`DROP TABLE "hatady_following"`);
	}
}
