export class AddWhackEmojiRecord1769000000000 {
	name = 'AddWhackEmojiRecord1769000000000';

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "whack_emoji_record" (
				"id" varchar(32) NOT NULL,
				"userId" varchar(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"difficulty" integer NOT NULL,
				"score" integer NOT NULL DEFAULT 0,
				"hits" integer NOT NULL DEFAULT 0,
				"misses" integer NOT NULL DEFAULT 0,
				CONSTRAINT "PK_whack_emoji_record" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_record_userId" ON "whack_emoji_record" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_record_score" ON "whack_emoji_record" ("score")`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_record_createdAt" ON "whack_emoji_record" ("createdAt")`);
		await queryRunner.query(`ALTER TABLE "whack_emoji_record" ADD CONSTRAINT "FK_whack_emoji_record_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "whack_emoji_record"`);
	}
}
