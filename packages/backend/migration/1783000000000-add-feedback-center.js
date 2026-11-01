/*
 * 旗鯖fork: フィードバックセンター(Issue / 賛同 / コメント / コメントリアクション / Issue個別モデレーター権限)のテーブルを追加する。
 */
export class AddFeedbackCenter1783000000000 {
	name = 'AddFeedbackCenter1783000000000'

	async up(queryRunner) {
		// プロジェクト(ユーザーが自分のソフトのIssueを管理するための単位)。feedback_issue より先に作る。
		await queryRunner.query(`CREATE TABLE "feedback_project" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "ownerId" character varying(32) NOT NULL, "name" character varying(128) NOT NULL, "description" character varying(4096) NOT NULL DEFAULT '', "url" character varying(512), "iconFileId" character varying(32), "isOfficial" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_feedback_project" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_project_ownerId" ON "feedback_project" ("ownerId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_project_isOfficial" ON "feedback_project" ("isOfficial")`);
		await queryRunner.query(`ALTER TABLE "feedback_project" ADD CONSTRAINT "FK_feedback_project_ownerId" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_project" ADD CONSTRAINT "FK_feedback_project_iconFileId" FOREIGN KEY ("iconFileId") REFERENCES "drive_file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

		// Issue 本体
		await queryRunner.query(`CREATE TABLE "feedback_issue" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "title" character varying(256) NOT NULL, "description" character varying(8192) NOT NULL DEFAULT '', "category" character varying(32) NOT NULL DEFAULT 'bug', "status" character varying(32) NOT NULL DEFAULT 'open', "priority" character varying(16) NOT NULL DEFAULT 'normal', "pinned" boolean NOT NULL DEFAULT false, "closed" boolean NOT NULL DEFAULT false, "closedAt" TIMESTAMP WITH TIME ZONE, "closedById" character varying(32), "agreementsCount" integer NOT NULL DEFAULT 0, "fileIds" character varying(32) array NOT NULL DEFAULT '{}', "commentsCount" integer NOT NULL DEFAULT 0, "lastCommentedAt" TIMESTAMP WITH TIME ZONE, "resolutionNote" character varying(4096), "projectId" character varying(32), "createdById" character varying(32), CONSTRAINT "PK_feedback_issue" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_lastCommentedAt" ON "feedback_issue" ("lastCommentedAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_projectId" ON "feedback_issue" ("projectId")`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" ADD CONSTRAINT "FK_feedback_issue_projectId" FOREIGN KEY ("projectId") REFERENCES "feedback_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_category" ON "feedback_issue" ("category")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_status" ON "feedback_issue" ("status")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_pinned" ON "feedback_issue" ("pinned")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_closed" ON "feedback_issue" ("closed")`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" ADD CONSTRAINT "FK_feedback_issue_createdById" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" ADD CONSTRAINT "FK_feedback_issue_closedById" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

		// 賛同
		await queryRunner.query(`CREATE TABLE "feedback_agree" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "feedbackId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, CONSTRAINT "PK_feedback_agree" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_agree_feedbackId" ON "feedback_agree" ("feedbackId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_agree_userId" ON "feedback_agree" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feedback_agree_feedbackId_userId" ON "feedback_agree" ("feedbackId", "userId")`);
		await queryRunner.query(`ALTER TABLE "feedback_agree" ADD CONSTRAINT "FK_feedback_agree_feedbackId" FOREIGN KEY ("feedbackId") REFERENCES "feedback_issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_agree" ADD CONSTRAINT "FK_feedback_agree_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// コメント(会話)
		await queryRunner.query(`CREATE TABLE "feedback_comment" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "feedbackId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "text" character varying(8192) NOT NULL, "fileIds" character varying(32) array NOT NULL DEFAULT '{}', CONSTRAINT "PK_feedback_comment" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_createdAt" ON "feedback_comment" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_feedbackId" ON "feedback_comment" ("feedbackId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_userId" ON "feedback_comment" ("userId")`);
		await queryRunner.query(`ALTER TABLE "feedback_comment" ADD CONSTRAINT "FK_feedback_comment_feedbackId" FOREIGN KEY ("feedbackId") REFERENCES "feedback_issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_comment" ADD CONSTRAINT "FK_feedback_comment_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// コメントのリアクション
		await queryRunner.query(`CREATE TABLE "feedback_comment_reaction" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "commentId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "reaction" character varying(260) NOT NULL, CONSTRAINT "PK_feedback_comment_reaction" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_reaction_commentId" ON "feedback_comment_reaction" ("commentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_reaction_userId" ON "feedback_comment_reaction" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feedback_comment_reaction_commentId_userId" ON "feedback_comment_reaction" ("commentId", "userId")`);
		await queryRunner.query(`ALTER TABLE "feedback_comment_reaction" ADD CONSTRAINT "FK_feedback_comment_reaction_commentId" FOREIGN KEY ("commentId") REFERENCES "feedback_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_comment_reaction" ADD CONSTRAINT "FK_feedback_comment_reaction_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// Issue 個別のモデレーター権限付与
		await queryRunner.query(`CREATE TABLE "feedback_issue_moderator" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "feedbackId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "grantedById" character varying(32), CONSTRAINT "PK_feedback_issue_moderator" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_moderator_feedbackId" ON "feedback_issue_moderator" ("feedbackId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_moderator_userId" ON "feedback_issue_moderator" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feedback_issue_moderator_feedbackId_userId" ON "feedback_issue_moderator" ("feedbackId", "userId")`);
		await queryRunner.query(`ALTER TABLE "feedback_issue_moderator" ADD CONSTRAINT "FK_feedback_issue_moderator_feedbackId" FOREIGN KEY ("feedbackId") REFERENCES "feedback_issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_issue_moderator" ADD CONSTRAINT "FK_feedback_issue_moderator_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// カスタム絵文字 追加申請
		await queryRunner.query(`CREATE TABLE "feedback_emoji_request" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "requestedById" character varying(32) NOT NULL, "name" character varying(128) NOT NULL, "category" character varying(128), "aliases" character varying(128) array NOT NULL DEFAULT '{}', "license" character varying(1024), "localOnly" boolean NOT NULL DEFAULT false, "isSensitive" boolean NOT NULL DEFAULT false, "sourceType" character varying(16) NOT NULL DEFAULT 'image', "originalUrl" character varying(512), "remoteHost" character varying(512), "fileId" character varying(32), "status" character varying(16) NOT NULL DEFAULT 'pending', "resolvedComment" character varying(1024), "resolvedById" character varying(32), "resolvedAt" TIMESTAMP WITH TIME ZONE, "resolvedEmojiId" character varying(128), CONSTRAINT "PK_feedback_emoji_request" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_emoji_request_createdAt" ON "feedback_emoji_request" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_emoji_request_requestedById" ON "feedback_emoji_request" ("requestedById")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_emoji_request_status" ON "feedback_emoji_request" ("status")`);
		await queryRunner.query(`ALTER TABLE "feedback_emoji_request" ADD CONSTRAINT "FK_feedback_emoji_request_requestedById" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_emoji_request" ADD CONSTRAINT "FK_feedback_emoji_request_fileId" FOREIGN KEY ("fileId") REFERENCES "drive_file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

		// フィードバックセンター内の通知(per-user)
		await queryRunner.query(`CREATE TABLE "feedback_notification" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "type" character varying(32) NOT NULL, "message" character varying(1024) NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "actorId" character varying(32), "feedbackId" character varying(32), "emojiRequestId" character varying(32), "commentId" character varying(32), CONSTRAINT "PK_feedback_notification" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_notification_createdAt" ON "feedback_notification" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_notification_userId" ON "feedback_notification" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_notification_isRead" ON "feedback_notification" ("isRead")`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_notification_userId_isRead" ON "feedback_notification" ("userId", "isRead")`);
		await queryRunner.query(`ALTER TABLE "feedback_notification" ADD CONSTRAINT "FK_feedback_notification_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_notification" ADD CONSTRAINT "FK_feedback_notification_actorId" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_notification" ADD CONSTRAINT "FK_feedback_notification_feedbackId" FOREIGN KEY ("feedbackId") REFERENCES "feedback_issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "feedback_notification" ADD CONSTRAINT "FK_feedback_notification_emojiRequestId" FOREIGN KEY ("emojiRequestId") REFERENCES "feedback_emoji_request"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "feedback_notification"`);
		await queryRunner.query(`DROP TABLE "feedback_emoji_request"`);
		await queryRunner.query(`DROP TABLE "feedback_issue_moderator"`);
		await queryRunner.query(`DROP TABLE "feedback_comment_reaction"`);
		await queryRunner.query(`DROP TABLE "feedback_comment"`);
		await queryRunner.query(`DROP TABLE "feedback_agree"`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" DROP CONSTRAINT "FK_feedback_issue_closedById"`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" DROP CONSTRAINT "FK_feedback_issue_createdById"`);
		await queryRunner.query(`DROP TABLE "feedback_issue"`);
		await queryRunner.query(`DROP TABLE "feedback_project"`);
	}
}
