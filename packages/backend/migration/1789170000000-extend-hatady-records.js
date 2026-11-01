/* 旗鯖fork: 既存の本・記録・返信のIDを維持したままHatadyの記録項目を拡張する。 */
export class ExtendHatadyRecords1789170000000 {
	name = 'ExtendHatadyRecords1789170000000';

	async up(queryRunner) {
		for (const table of ['hatady_log', 'hatady_media_session']) {
			await queryRunner.query(`ALTER TABLE "${table}" ADD "durationSeconds" double precision, ADD "startedAt" varchar(12), ADD "tags" jsonb NOT NULL DEFAULT '[]'::jsonb`);
			// integerの上限値も掛け算前に変換する。旧列・旧null・旧0は変更しない。
			await queryRunner.query(`UPDATE "${table}" SET "durationSeconds" = "durationMinutes"::double precision * 60`);
		}
		await queryRunner.query(`UPDATE "hatady_log" SET "tags" = jsonb_build_array("tag") WHERE "tag" IS NOT NULL`);
		await queryRunner.query(`ALTER TABLE "hatady_log" ADD "kind" varchar(16) NOT NULL DEFAULT 'study', ADD "details" jsonb NOT NULL DEFAULT '{}'::jsonb, ADD "mediaWorkId" varchar(32)`);
		await queryRunner.query(`ALTER TABLE "hatady_log" ADD CONSTRAINT "FK_hatady_log_media_work" FOREIGN KEY ("mediaWorkId") REFERENCES "hatady_media_work"("id") ON DELETE SET NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_media_work" ON "hatady_log" ("mediaWorkId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_log_user_kind_date" ON "hatady_log" ("userId", "kind", "studiedAt", "id")`);
		await queryRunner.query(`ALTER TABLE "hatady_book" ADD "visibility" varchar(16) NOT NULL DEFAULT 'public', ADD "details" jsonb NOT NULL DEFAULT '{}'::jsonb`);
		await queryRunner.query(`ALTER TABLE "hatady_media_work" ADD "details" jsonb NOT NULL DEFAULT '{}'::jsonb`);
		await queryRunner.query(`ALTER TABLE "hatady_user_profile" ADD "design" jsonb NOT NULL DEFAULT '{}'::jsonb`);
		await queryRunner.query(`ALTER TABLE "hatady_comment" ADD "updatedAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "hatady_media_work" DROP CONSTRAINT "CHK_hatady_media_work_kind", DROP CONSTRAINT "CHK_hatady_media_work_game_recommendation", DROP CONSTRAINT "CHK_hatady_media_work_specific_fields"`);
		await queryRunner.query(`ALTER TABLE "hatady_media_work" ADD CONSTRAINT "CHK_hatady_media_work_kind" CHECK ("kind" IN ('movie', 'game', 'work')), ADD CONSTRAINT "CHK_hatady_media_work_specific_fields" CHECK (
			"kind" = 'work'
			OR ("kind" = 'movie' AND jsonb_array_length("platforms") = 0 AND "developer" IS NULL AND "publisher" IS NULL)
			OR ("kind" = 'game' AND "runtimeMinutes" IS NULL AND jsonb_array_length("genres") = 0 AND "origin" IS NULL AND "viewingMode" IS NULL AND "primaryLanguage" IS NULL AND jsonb_array_length("highlights") = 0 AND "highlightsSpoiler" = false)
		)`);
		await queryRunner.query(`ALTER TABLE "hatady_media_session" DROP CONSTRAINT "CHK_hatady_media_session_duration", DROP CONSTRAINT "CHK_hatady_media_session_kind"`);
		await queryRunner.query(`ALTER TABLE "hatady_media_session" ADD CONSTRAINT "CHK_hatady_media_session_kind" CHECK ("kind" IN ('movie_viewing', 'game_play', 'game_match', 'game_roguelike', 'game_pve'))`);
		await queryRunner.query(`ALTER TABLE "hatady_media_session" ADD "workSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb`);
		await queryRunner.query(`UPDATE "hatady_media_session" AS session SET "workSnapshot" = jsonb_build_object('title', work."title", 'kind', work."kind", 'creator', work."creator", 'genre', COALESCE(work."details"->>'genre', work."genres"->>0, '')) FROM "hatady_media_work" AS work WHERE work."id" = session."workId"`);
		await queryRunner.query(`ALTER TABLE "hatady_media_session" DROP CONSTRAINT "FK_hatady_media_session_work_owner", ALTER COLUMN "workId" DROP NOT NULL`);
		// PostgreSQL 15: 所有者一致を保証する複合FKを残し、削除時はworkIdだけを外す。
		await queryRunner.query(`ALTER TABLE "hatady_media_session" ADD CONSTRAINT "FK_hatady_media_session_work_owner" FOREIGN KEY ("workId", "userId") REFERENCES "hatady_media_work"("id", "userId") ON DELETE SET NULL ("workId")`);
		await queryRunner.query(`ALTER TABLE "hatady_media_comment" ALTER COLUMN "workId" DROP NOT NULL, ADD "sessionId" varchar(32)`);
		await queryRunner.query(`ALTER TABLE "hatady_media_comment" ADD CONSTRAINT "FK_hatady_media_comment_session" FOREIGN KEY ("sessionId") REFERENCES "hatady_media_session"("id") ON DELETE CASCADE, ADD CONSTRAINT "CHK_hatady_media_comment_target" CHECK (("workId" IS NOT NULL)::integer + ("sessionId" IS NOT NULL)::integer = 1)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_comment_session_id" ON "hatady_media_comment" ("sessionId", "id")`);
		await queryRunner.query(`ALTER TABLE "hatady_media_reaction" ADD "sessionId" varchar(32), DROP CONSTRAINT "CHK_hatady_media_reaction_target"`);
		await queryRunner.query(`ALTER TABLE "hatady_media_reaction" ADD CONSTRAINT "FK_hatady_media_reaction_session" FOREIGN KEY ("sessionId") REFERENCES "hatady_media_session"("id") ON DELETE CASCADE, ADD CONSTRAINT "CHK_hatady_media_reaction_target" CHECK (("workId" IS NOT NULL)::integer + ("commentId" IS NOT NULL)::integer + ("sessionId" IS NOT NULL)::integer = 1)`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_media_reaction_user_session" ON "hatady_media_reaction" ("userId", "sessionId") WHERE "sessionId" IS NOT NULL`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD "mediaSessionId" varchar(32), ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_media_session" FOREIGN KEY ("mediaSessionId") REFERENCES "hatady_media_session"("id") ON DELETE SET NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_visible" ON "hatady_notification" ("notifieeId", "id") WHERE "deletedAt" IS NULL`);
	}

	async down() {
		// 後退で正確な秒・作業・孤立履歴・記録への返信を失わないよう、無条件の列削除はしない。
		throw new Error('Hatady record rollback requires an explicit data-preserving conversion; no data was removed.');
	}
}
