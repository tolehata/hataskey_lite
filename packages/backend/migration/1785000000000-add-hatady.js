/*
 * 旗鯖fork: Hatady(学習・読書記録)の本(hatady_book)と学習ログ(hatady_log)テーブルを追加。
 */
export class AddHatady1785000000000 {
	name = 'AddHatady1785000000000'

	async up(queryRunner) {
		// 本
		await queryRunner.query(`CREATE TABLE "hatady_book" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(512) NOT NULL, "author" character varying(256), "totalPages" integer, "currentPage" integer NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'reading', "coverColorIndex" integer, CONSTRAINT "PK_hatady_book" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_book_userId" ON "hatady_book" ("userId")`);
		await queryRunner.query(`ALTER TABLE "hatady_book" ADD CONSTRAINT "FK_hatady_book_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// 学習ログ
		await queryRunner.query(`CREATE TABLE "hatady_log" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "studiedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(512) NOT NULL, "subject" character varying(64) NOT NULL, "tag" character varying(16), "body" character varying(4096), "bookId" character varying(32), "pageFrom" integer, "pageTo" integer, "durationMinutes" integer NOT NULL DEFAULT 0, "isPublic" boolean NOT NULL DEFAULT false, "reactionsCount" integer NOT NULL DEFAULT 0, "commentsCount" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_hatady_log" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_createdAt" ON "hatady_log" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_studiedAt" ON "hatady_log" ("studiedAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_userId" ON "hatady_log" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_subject" ON "hatady_log" ("subject")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_isPublic" ON "hatady_log" ("isPublic")`);
		await queryRunner.query(`ALTER TABLE "hatady_log" ADD CONSTRAINT "FK_hatady_log_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_log" ADD CONSTRAINT "FK_hatady_log_bookId" FOREIGN KEY ("bookId") REFERENCES "hatady_book"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_log" DROP CONSTRAINT "FK_hatady_log_bookId"`);
		await queryRunner.query(`ALTER TABLE "hatady_log" DROP CONSTRAINT "FK_hatady_log_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_log"`);
		await queryRunner.query(`ALTER TABLE "hatady_book" DROP CONSTRAINT "FK_hatady_book_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_book"`);
	}
}
