export class AddStackingGameRoom1770000000000 {
	name = 'AddStackingGameRoom1770000000000';

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "stacking_game_room" (
				"id" varchar(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"host1Id" varchar(32) NOT NULL,
				"host2Id" varchar(32),
				"gameMode" varchar(64) NOT NULL DEFAULT 'custom',
				"state" varchar(32) NOT NULL DEFAULT 'waiting',
				"score1" integer NOT NULL DEFAULT 0,
				"score2" integer NOT NULL DEFAULT 0,
				"blocks1" integer NOT NULL DEFAULT 0,
				"blocks2" integer NOT NULL DEFAULT 0,
				"winner" smallint,
				CONSTRAINT "PK_stacking_game_room" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_room_createdAt" ON "stacking_game_room" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_room_host1Id" ON "stacking_game_room" ("host1Id")`);
		await queryRunner.query(`CREATE INDEX "IDX_stacking_game_room_state" ON "stacking_game_room" ("state")`);
		await queryRunner.query(`ALTER TABLE "stacking_game_room" ADD CONSTRAINT "FK_stacking_game_room_host1" FOREIGN KEY ("host1Id") REFERENCES "user"("id") ON DELETE CASCADE`);
		await queryRunner.query(`ALTER TABLE "stacking_game_room" ADD CONSTRAINT "FK_stacking_game_room_host2" FOREIGN KEY ("host2Id") REFERENCES "user"("id") ON DELETE CASCADE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "stacking_game_room"`);
	}
}
