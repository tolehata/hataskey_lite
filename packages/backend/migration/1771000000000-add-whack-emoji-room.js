export class AddWhackEmojiRoom1771000000000 {
	name = 'AddWhackEmojiRoom1771000000000';

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "whack_emoji_room" (
				"id" varchar(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"host1Id" varchar(32) NOT NULL,
				"host2Id" varchar(32),
				"difficulty" integer NOT NULL DEFAULT 5,
				"state" varchar(32) NOT NULL DEFAULT 'waiting',
				"score1" integer NOT NULL DEFAULT 0,
				"score2" integer NOT NULL DEFAULT 0,
				"hits1" integer NOT NULL DEFAULT 0,
				"hits2" integer NOT NULL DEFAULT 0,
				"winner" smallint,
				CONSTRAINT "PK_whack_emoji_room" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_room_createdAt" ON "whack_emoji_room" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_room_host1Id" ON "whack_emoji_room" ("host1Id")`);
		await queryRunner.query(`CREATE INDEX "IDX_whack_emoji_room_state" ON "whack_emoji_room" ("state")`);
		await queryRunner.query(`ALTER TABLE "whack_emoji_room" ADD CONSTRAINT "FK_whack_emoji_room_host1" FOREIGN KEY ("host1Id") REFERENCES "user"("id") ON DELETE CASCADE`);
		await queryRunner.query(`ALTER TABLE "whack_emoji_room" ADD CONSTRAINT "FK_whack_emoji_room_host2" FOREIGN KEY ("host2Id") REFERENCES "user"("id") ON DELETE CASCADE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "whack_emoji_room"`);
	}
}
