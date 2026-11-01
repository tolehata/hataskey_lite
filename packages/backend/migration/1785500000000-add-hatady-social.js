/*
 * 旗鯖fork: Hatady のコメント(hatady_comment)とリアクション(hatady_reaction)テーブルを追加。
 *   会話ページ(1g)のための返信 + hataskey 共通絵文字ピッカーによるリアクション。
 */
export class AddHatadySocial1785500000000 {
	name = 'AddHatadySocial1785500000000'

	async up(queryRunner) {
		// コメント(返信)。replyId で1段ネスト。
		await queryRunner.query(`CREATE TABLE "hatady_comment" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "logId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "replyId" character varying(32), "text" character varying(2048) NOT NULL, "reactionsCount" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_hatady_comment" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_comment_createdAt" ON "hatady_comment" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_comment_logId" ON "hatady_comment" ("logId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_comment_userId" ON "hatady_comment" ("userId")`);
		await queryRunner.query(`ALTER TABLE "hatady_comment" ADD CONSTRAINT "FK_hatady_comment_logId" FOREIGN KEY ("logId") REFERENCES "hatady_log"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_comment" ADD CONSTRAINT "FK_hatady_comment_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// リアクション。対象は logId か commentId のどちらか一方。1ユーザー1対象1リアクション。
		await queryRunner.query(`CREATE TABLE "hatady_reaction" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "logId" character varying(32), "commentId" character varying(32), "reaction" character varying(260) NOT NULL, CONSTRAINT "PK_hatady_reaction" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_reaction_userId" ON "hatady_reaction" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_reaction_logId" ON "hatady_reaction" ("logId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_reaction_commentId" ON "hatady_reaction" ("commentId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_reaction_user_log" ON "hatady_reaction" ("userId", "logId") WHERE "logId" IS NOT NULL`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_reaction_user_comment" ON "hatady_reaction" ("userId", "commentId") WHERE "commentId" IS NOT NULL`);
		await queryRunner.query(`ALTER TABLE "hatady_reaction" ADD CONSTRAINT "FK_hatady_reaction_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_reaction" ADD CONSTRAINT "FK_hatady_reaction_logId" FOREIGN KEY ("logId") REFERENCES "hatady_log"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_reaction" ADD CONSTRAINT "FK_hatady_reaction_commentId" FOREIGN KEY ("commentId") REFERENCES "hatady_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_reaction" DROP CONSTRAINT "FK_hatady_reaction_commentId"`);
		await queryRunner.query(`ALTER TABLE "hatady_reaction" DROP CONSTRAINT "FK_hatady_reaction_logId"`);
		await queryRunner.query(`ALTER TABLE "hatady_reaction" DROP CONSTRAINT "FK_hatady_reaction_userId"`);
		await queryRunner.query(`DROP TABLE "hatady_reaction"`);
		await queryRunner.query(`ALTER TABLE "hatady_comment" DROP CONSTRAINT "FK_hatady_comment_userId"`);
		await queryRunner.query(`ALTER TABLE "hatady_comment" DROP CONSTRAINT "FK_hatady_comment_logId"`);
		await queryRunner.query(`DROP TABLE "hatady_comment"`);
	}
}
