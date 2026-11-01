/*
 * 旗鯖fork(Hatady): 分野レジストリ(hatady_subject)テーブルを追加。
 *   ユーザーごとに分野名+色(HEX)を保持し、分野の管理(色指定・削除・付け替え)を可能にする。
 *   (userId, name) は一意。分野そのものは学習ログ上は自由テキストのまま。
 */
export class AddHatadySubject1787400000000 {
	name = 'AddHatadySubject1787400000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_subject" ("id" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "name" character varying(128) NOT NULL, "color" character varying(16), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_hatady_subject" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_subject_userId" ON "hatady_subject" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_subject_userId_name" ON "hatady_subject" ("userId", "name")`);
		await queryRunner.query(`ALTER TABLE "hatady_subject" ADD CONSTRAINT "FK_hatady_subject_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_subject" DROP CONSTRAINT "FK_hatady_subject_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_subject"`);
	}
}
