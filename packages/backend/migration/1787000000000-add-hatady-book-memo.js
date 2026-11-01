/*
 * 旗鯖fork(Hatady): 本の内容メモ(hatady_book_memo)テーブルを追加。
 *   本ごとに複数持てる内容(要点・引用など)の記録。任意でページ番号を紐づけられる。
 */
export class AddHatadyBookMemo1787000000000 {
	name = 'AddHatadyBookMemo1787000000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_book_memo" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "bookId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "text" character varying(4096) NOT NULL, "page" integer, CONSTRAINT "PK_hatady_book_memo" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_book_memo_bookId" ON "hatady_book_memo" ("bookId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_book_memo_userId" ON "hatady_book_memo" ("userId")`);
		await queryRunner.query(`ALTER TABLE "hatady_book_memo" ADD CONSTRAINT "FK_hatady_book_memo_bookId" FOREIGN KEY ("bookId") REFERENCES "hatady_book"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_book_memo" ADD CONSTRAINT "FK_hatady_book_memo_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_book_memo" DROP CONSTRAINT "FK_hatady_book_memo_userId"`);
		await queryRunner.query(`ALTER TABLE "hatady_book_memo" DROP CONSTRAINT "FK_hatady_book_memo_bookId"`);
		await queryRunner.query(`DROP TABLE "hatady_book_memo"`);
	}
}
