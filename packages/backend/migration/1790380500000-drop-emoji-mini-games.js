/* SPDX-License-Identifier: AGPL-3.0-only */

/**
 * 旗鯖fork: つみつみタワー・絵文字叩きゲーム・カスタムエモジシュートの廃止に伴い、
 * スコア記録と対戦ルームのテーブルを削除する。
 *
 * 注意: up を適用すると、全ユーザーのスコア記録・ランキング・対戦ルームが失われる。
 * down はテーブルを最終形（1773 で mode 追加、1779 で gameMode 削除済み）の空の状態で
 * 作り直すだけで、削除した行は復元できない。
 */
export class DropEmojiMiniGames1790380500000 {
	name = 'DropEmojiMiniGames1790380500000';

	async up(queryRunner) {
		await queryRunner.query('DROP TABLE "emoji_shoot_record"');
		await queryRunner.query('DROP TABLE "whack_emoji_room"');
		await queryRunner.query('DROP TABLE "stacking_game_room"');
		await queryRunner.query('DROP TABLE "whack_emoji_record"');
		await queryRunner.query('DROP TABLE "stacking_game_record"');
	}

	async down(queryRunner) {
		await queryRunner.query('CREATE TABLE "stacking_game_record" ("id" varchar(32) NOT NULL, "userId" varchar(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "score" integer NOT NULL DEFAULT 0, "blockCount" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_stacking_game_record" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_record_userId" ON "stacking_game_record" ("userId")');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_record_score" ON "stacking_game_record" ("score")');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_record_createdAt" ON "stacking_game_record" ("createdAt")');
		await queryRunner.query('ALTER TABLE "stacking_game_record" ADD CONSTRAINT "FK_stacking_game_record_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE');

		await queryRunner.query('CREATE TABLE "whack_emoji_record" ("id" varchar(32) NOT NULL, "userId" varchar(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "difficulty" integer NOT NULL, "score" integer NOT NULL DEFAULT 0, "hits" integer NOT NULL DEFAULT 0, "misses" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_whack_emoji_record" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_record_userId" ON "whack_emoji_record" ("userId")');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_record_score" ON "whack_emoji_record" ("score")');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_record_createdAt" ON "whack_emoji_record" ("createdAt")');
		await queryRunner.query('ALTER TABLE "whack_emoji_record" ADD CONSTRAINT "FK_whack_emoji_record_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE');

		await queryRunner.query('CREATE TABLE "stacking_game_room" ("id" varchar(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "host1Id" varchar(32) NOT NULL, "host2Id" varchar(32), "state" varchar(32) NOT NULL DEFAULT \'waiting\', "score1" integer NOT NULL DEFAULT 0, "score2" integer NOT NULL DEFAULT 0, "blocks1" integer NOT NULL DEFAULT 0, "blocks2" integer NOT NULL DEFAULT 0, "winner" smallint, CONSTRAINT "PK_stacking_game_room" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_room_createdAt" ON "stacking_game_room" ("createdAt")');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_room_host1Id" ON "stacking_game_room" ("host1Id")');
		await queryRunner.query('CREATE INDEX "IDX_stacking_game_room_state" ON "stacking_game_room" ("state")');
		await queryRunner.query('ALTER TABLE "stacking_game_room" ADD CONSTRAINT "FK_stacking_game_room_host1" FOREIGN KEY ("host1Id") REFERENCES "user"("id") ON DELETE CASCADE');
		await queryRunner.query('ALTER TABLE "stacking_game_room" ADD CONSTRAINT "FK_stacking_game_room_host2" FOREIGN KEY ("host2Id") REFERENCES "user"("id") ON DELETE CASCADE');

		await queryRunner.query('CREATE TABLE "whack_emoji_room" ("id" varchar(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "host1Id" varchar(32) NOT NULL, "host2Id" varchar(32), "difficulty" integer NOT NULL DEFAULT 5, "state" varchar(32) NOT NULL DEFAULT \'waiting\', "score1" integer NOT NULL DEFAULT 0, "score2" integer NOT NULL DEFAULT 0, "hits1" integer NOT NULL DEFAULT 0, "hits2" integer NOT NULL DEFAULT 0, "winner" smallint, CONSTRAINT "PK_whack_emoji_room" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_room_createdAt" ON "whack_emoji_room" ("createdAt")');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_room_host1Id" ON "whack_emoji_room" ("host1Id")');
		await queryRunner.query('CREATE INDEX "IDX_whack_emoji_room_state" ON "whack_emoji_room" ("state")');
		await queryRunner.query('ALTER TABLE "whack_emoji_room" ADD CONSTRAINT "FK_whack_emoji_room_host1" FOREIGN KEY ("host1Id") REFERENCES "user"("id") ON DELETE CASCADE');
		await queryRunner.query('ALTER TABLE "whack_emoji_room" ADD CONSTRAINT "FK_whack_emoji_room_host2" FOREIGN KEY ("host2Id") REFERENCES "user"("id") ON DELETE CASCADE');

		await queryRunner.query('CREATE TABLE "emoji_shoot_record" ("id" varchar(32) NOT NULL, "userId" varchar(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "score" integer NOT NULL DEFAULT 0, "wave" integer NOT NULL DEFAULT 0, "kills" integer NOT NULL DEFAULT 0, "mode" varchar(32) NOT NULL DEFAULT \'normal\', CONSTRAINT "PK_emoji_shoot_record" PRIMARY KEY ("id"))');
		await queryRunner.query('CREATE INDEX "IDX_emoji_shoot_record_userId" ON "emoji_shoot_record" ("userId")');
		await queryRunner.query('CREATE INDEX "IDX_emoji_shoot_record_score" ON "emoji_shoot_record" ("score")');
		await queryRunner.query('CREATE INDEX "IDX_emoji_shoot_record_createdAt" ON "emoji_shoot_record" ("createdAt")');
		await queryRunner.query('CREATE INDEX "IDX_emoji_shoot_record_mode" ON "emoji_shoot_record" ("mode")');
		await queryRunner.query('ALTER TABLE "emoji_shoot_record" ADD CONSTRAINT "FK_emoji_shoot_record_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE');
	}
}