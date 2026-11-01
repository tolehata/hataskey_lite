export class AddStackingGameRecord1768000000000 {
	name = 'AddStackingGameRecord1768000000000';

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "stacking_game_record" (
				"id" varchar(32) NOT NULL,
				"userId" varchar(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"gameMode" varchar(128) NOT NULL,
				"score" integer NOT NULL DEFAULT 0,
				"blockCount" integer NOT NULL DEFAULT 0,
				CONSTRAINT "PK_stacking_game_record" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_record_userId" ON "stacking_game_record" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_record_score" ON "stacking_game_record" ("score")`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_record_createdAt" ON "stacking_game_record" ("createdAt")`);
		await queryRunner.query(`ALTER TABLE "stacking_game_record" ADD CONSTRAINT "FK_stacking_game_record_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "stacking_game_record"`);
	}
}
