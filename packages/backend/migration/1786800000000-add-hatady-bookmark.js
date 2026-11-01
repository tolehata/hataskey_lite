/*
 * 旗鯖fork(Hatady): 本のしおり(hatady_bookmark)テーブルを追加。ページ・名前・色で本ごとに管理。
 */
export class AddHatadyBookmark1786800000000 {
	name = 'AddHatadyBookmark1786800000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_bookmark" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "bookId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "page" integer NOT NULL DEFAULT 0, "name" character varying(128), "color" character varying(16), CONSTRAINT "PK_hatady_bookmark" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_bookmark_bookId" ON "hatady_bookmark" ("bookId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_bookmark_userId" ON "hatady_bookmark" ("userId")`);
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" ADD CONSTRAINT "FK_hatady_bookmark_bookId" FOREIGN KEY ("bookId") REFERENCES "hatady_book"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" ADD CONSTRAINT "FK_hatady_bookmark_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" DROP CONSTRAINT "FK_hatady_bookmark_userId"`);
		await queryRunner.query(`ALTER TABLE "hatady_bookmark" DROP CONSTRAINT "FK_hatady_bookmark_bookId"`);
		await queryRunner.query(`DROP TABLE "hatady_bookmark"`);
	}
}
