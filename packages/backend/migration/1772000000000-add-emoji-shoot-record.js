export class AddEmojiShootRecord1772000000000 {
	name = 'AddEmojiShootRecord1772000000000';
	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "emoji_shoot_record" (
				"id" varchar(32) NOT NULL,
				"userId" varchar(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"score" integer NOT NULL DEFAULT 0,
				"wave" integer NOT NULL DEFAULT 0,
				"kills" integer NOT NULL DEFAULT 0,
				CONSTRAINT "PK_emoji_shoot_record" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_emoji_shoot_record_userId" ON "emoji_shoot_record" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_emoji_shoot_record_score" ON "emoji_shoot_record" ("score")`);
		await queryRunner.query(`CREATE INDEX "IDX_emoji_shoot_record_createdAt" ON "emoji_shoot_record" ("createdAt")`);
		await queryRunner.query(`ALTER TABLE "emoji_shoot_record" ADD CONSTRAINT "FK_emoji_shoot_record_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`);
	}
	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "emoji_shoot_record"`);
	}
}
