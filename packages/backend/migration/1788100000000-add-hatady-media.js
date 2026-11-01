/*
 * 旗鯖fork: Hatady の映画・ゲーム作品、記録セッション、コメント、リアクション。
 */
export class AddHatadyMedia1788100000000 {
	name = 'AddHatadyMedia1788100000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_media_work" (
			"id" varchar(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"userId" varchar(32) NOT NULL,
			"kind" varchar(16) NOT NULL,
			"title" varchar(512) NOT NULL,
			"originalTitle" varchar(512),
			"creator" varchar(256),
			"releaseDate" date,
			"releaseYear" integer,
			"status" varchar(32) NOT NULL DEFAULT 'planned',
			"visibility" varchar(16) NOT NULL DEFAULT 'private',
			"isFavorite" boolean NOT NULL DEFAULT false,
			"isRecommended" boolean NOT NULL DEFAULT false,
			"recommendationRating" integer,
			"coverColorIndex" integer,
			"synopsis" varchar(8192),
			"synopsisSpoiler" boolean NOT NULL DEFAULT false,
			"review" varchar(8192),
			"reviewSpoiler" boolean NOT NULL DEFAULT false,
			"officialUrl" varchar(2048),
			"runtimeMinutes" integer,
			"genres" jsonb NOT NULL DEFAULT '[]'::jsonb,
			"origin" varchar(16),
			"viewingMode" varchar(16),
			"primaryLanguage" varchar(128),
			"highlights" jsonb NOT NULL DEFAULT '[]'::jsonb,
			"highlightsSpoiler" boolean NOT NULL DEFAULT false,
			"platforms" jsonb NOT NULL DEFAULT '[]'::jsonb,
			"developer" varchar(256),
			"publisher" varchar(256),
			CONSTRAINT "PK_hatady_media_work" PRIMARY KEY ("id"),
			CONSTRAINT "UQ_hatady_media_work_id_user" UNIQUE ("id", "userId"),
			CONSTRAINT "FK_hatady_media_work_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "CHK_hatady_media_work_kind" CHECK ("kind" IN ('movie', 'game')),
			CONSTRAINT "CHK_hatady_media_work_status" CHECK ("status" IN ('planned', 'in_progress', 'completed', 'mastered', 'on_hold', 'dropped')),
			CONSTRAINT "CHK_hatady_media_work_mastered" CHECK ("status" <> 'mastered' OR "kind" = 'game'),
			CONSTRAINT "CHK_hatady_media_work_visibility" CHECK ("visibility" IN ('private', 'followers', 'public')),
			CONSTRAINT "CHK_hatady_media_work_rating" CHECK ("recommendationRating" IS NULL OR "recommendationRating" BETWEEN 0 AND 10),
			CONSTRAINT "CHK_hatady_media_work_game_recommendation" CHECK ("kind" = 'movie' OR ("isRecommended" = false AND "recommendationRating" IS NULL)),
			CONSTRAINT "CHK_hatady_media_work_release_year" CHECK ("releaseYear" IS NULL OR "releaseYear" BETWEEN 1800 AND 3000),
			CONSTRAINT "CHK_hatady_media_work_runtime" CHECK ("runtimeMinutes" IS NULL OR "runtimeMinutes" BETWEEN 1 AND 100000),
			CONSTRAINT "CHK_hatady_media_work_origin" CHECK ("origin" IS NULL OR "origin" IN ('domestic', 'foreign', 'co_production', 'other')),
			CONSTRAINT "CHK_hatady_media_work_viewing_mode" CHECK ("viewingMode" IS NULL OR "viewingMode" IN ('dubbed', 'subtitled', 'original')),
			CONSTRAINT "CHK_hatady_media_work_genres_array" CHECK (jsonb_typeof("genres") = 'array'),
			CONSTRAINT "CHK_hatady_media_work_highlights_array" CHECK (jsonb_typeof("highlights") = 'array'),
			CONSTRAINT "CHK_hatady_media_work_platforms_array" CHECK (jsonb_typeof("platforms") = 'array'),
			CONSTRAINT "CHK_hatady_media_work_specific_fields" CHECK (
				("kind" = 'movie' AND jsonb_array_length("platforms") = 0 AND "developer" IS NULL AND "publisher" IS NULL)
				OR
				("kind" = 'game' AND "runtimeMinutes" IS NULL AND jsonb_array_length("genres") = 0 AND "origin" IS NULL AND "viewingMode" IS NULL AND "primaryLanguage" IS NULL AND jsonb_array_length("highlights") = 0 AND "highlightsSpoiler" = false)
			)
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_work_user" ON "hatady_media_work" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_work_created" ON "hatady_media_work" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_work_user_kind_id" ON "hatady_media_work" ("userId", "kind", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_work_user_status_id" ON "hatady_media_work" ("userId", "status", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_work_user_updated_id" ON "hatady_media_work" ("userId", "updatedAt", "id")`);

		await queryRunner.query(`CREATE TABLE "hatady_media_session" (
			"id" varchar(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"userId" varchar(32) NOT NULL,
			"workId" varchar(32) NOT NULL,
			"kind" varchar(32) NOT NULL,
			"occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"durationMinutes" integer,
			"note" varchar(8192),
			"noteSpoiler" boolean NOT NULL DEFAULT false,
			"visibility" varchar(16) NOT NULL DEFAULT 'private',
			"details" jsonb NOT NULL DEFAULT '{}'::jsonb,
			CONSTRAINT "PK_hatady_media_session" PRIMARY KEY ("id"),
			CONSTRAINT "FK_hatady_media_session_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatady_media_session_work_owner" FOREIGN KEY ("workId", "userId") REFERENCES "hatady_media_work"("id", "userId") ON DELETE CASCADE,
			CONSTRAINT "CHK_hatady_media_session_kind" CHECK ("kind" IN ('movie_viewing', 'game_play', 'game_match', 'game_roguelike')),
			CONSTRAINT "CHK_hatady_media_session_visibility" CHECK ("visibility" IN ('private', 'followers', 'public')),
			CONSTRAINT "CHK_hatady_media_session_duration" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 1 AND 100000),
			CONSTRAINT "CHK_hatady_media_session_details_object" CHECK (jsonb_typeof("details") = 'object')
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_session_user_id" ON "hatady_media_session" ("userId", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_session_work_id" ON "hatady_media_session" ("workId", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_session_created" ON "hatady_media_session" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_session_occurred" ON "hatady_media_session" ("occurredAt", "id")`);

		await queryRunner.query(`CREATE TABLE "hatady_media_comment" (
			"id" varchar(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"workId" varchar(32) NOT NULL,
			"userId" varchar(32) NOT NULL,
			"replyId" varchar(32),
			"text" varchar(2048) NOT NULL,
			"spoiler" boolean NOT NULL DEFAULT false,
			"reactionsCount" integer NOT NULL DEFAULT 0,
			CONSTRAINT "PK_hatady_media_comment" PRIMARY KEY ("id"),
			CONSTRAINT "FK_hatady_media_comment_work" FOREIGN KEY ("workId") REFERENCES "hatady_media_work"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatady_media_comment_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatady_media_comment_reply" FOREIGN KEY ("replyId") REFERENCES "hatady_media_comment"("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_comment_created" ON "hatady_media_comment" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_comment_work_id" ON "hatady_media_comment" ("workId", "id")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_comment_user" ON "hatady_media_comment" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_comment_reply" ON "hatady_media_comment" ("replyId")`);

		await queryRunner.query(`CREATE TABLE "hatady_media_reaction" (
			"id" varchar(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"userId" varchar(32) NOT NULL,
			"workId" varchar(32),
			"commentId" varchar(32),
			"reaction" varchar(260) NOT NULL,
			CONSTRAINT "PK_hatady_media_reaction" PRIMARY KEY ("id"),
			CONSTRAINT "FK_hatady_media_reaction_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatady_media_reaction_work" FOREIGN KEY ("workId") REFERENCES "hatady_media_work"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_hatady_media_reaction_comment" FOREIGN KEY ("commentId") REFERENCES "hatady_media_comment"("id") ON DELETE CASCADE,
			CONSTRAINT "CHK_hatady_media_reaction_target" CHECK (("workId" IS NOT NULL)::integer + ("commentId" IS NOT NULL)::integer = 1)
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_reaction_user" ON "hatady_media_reaction" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_reaction_work" ON "hatady_media_reaction" ("workId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_media_reaction_comment" ON "hatady_media_reaction" ("commentId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_media_reaction_user_work" ON "hatady_media_reaction" ("userId", "workId") WHERE "workId" IS NOT NULL`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hatady_media_reaction_user_comment" ON "hatady_media_reaction" ("userId", "commentId") WHERE "commentId" IS NOT NULL`);

		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD "mediaWorkId" varchar(32)`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD "mediaCommentId" varchar(32)`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_media_work" FOREIGN KEY ("mediaWorkId") REFERENCES "hatady_media_work"("id") ON DELETE SET NULL`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_media_comment" FOREIGN KEY ("mediaCommentId") REFERENCES "hatady_media_comment"("id") ON DELETE SET NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_media_work" ON "hatady_notification" ("mediaWorkId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_media_comment" ON "hatady_notification" ("mediaCommentId")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_hatady_notification_media_comment"`);
		await queryRunner.query(`DROP INDEX "IDX_hatady_notification_media_work"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_media_comment"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_media_work"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP COLUMN "mediaCommentId"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP COLUMN "mediaWorkId"`);
		await queryRunner.query(`DROP TABLE "hatady_media_reaction"`);
		await queryRunner.query(`DROP TABLE "hatady_media_comment"`);
		await queryRunner.query(`DROP TABLE "hatady_media_session"`);
		await queryRunner.query(`DROP TABLE "hatady_media_work"`);
	}
}
