/* SPDX-License-Identifier: AGPL-3.0-only */
export class FeedbackEmojiChanges1790035200000 {
	name = 'FeedbackEmojiChanges1790035200000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "feedback_emoji_change_request" (
			"id" varchar(32) CONSTRAINT "PK_feedback_emoji_change" PRIMARY KEY,
			"createdAt" timestamptz NOT NULL,
			"updatedAt" timestamptz NOT NULL,
			"requestedById" varchar(32) NOT NULL CONSTRAINT "FK_feedback_emoji_change_owner" REFERENCES "user"("id") ON DELETE CASCADE,
			"originalRequestId" varchar(32) NOT NULL CONSTRAINT "FK_feedback_emoji_change_original" REFERENCES "feedback_emoji_request"("id") ON DELETE CASCADE,
			"targetEmojiId" varchar(128) NOT NULL,
			"kind" varchar(16) NOT NULL CONSTRAINT "CHK_feedback_emoji_change_kind" CHECK ("kind" IN ('updateImage', 'withdraw')),
			"status" varchar(16) NOT NULL DEFAULT 'pending' CONSTRAINT "CHK_feedback_emoji_change_status" CHECK ("status" IN ('pending', 'held', 'approved', 'rejected')),
			"reason" varchar(1024) NOT NULL,
			"fileId" varchar(32) CONSTRAINT "FK_feedback_emoji_change_file" REFERENCES "drive_file"("id") ON DELETE SET NULL,
			"license" varchar(1024),
			"targetSnapshot" jsonb NOT NULL,
			"replacementImageUrl" varchar(512),
			"resolvedById" varchar(32),
			"resolvedAt" timestamptz,
			"resolvedComment" varchar(1024),
			"events" jsonb NOT NULL DEFAULT '[]'
		)`);
		await queryRunner.query('CREATE INDEX "IDX_feedback_emoji_change_owner" ON "feedback_emoji_change_request" ("requestedById")');
		await queryRunner.query('CREATE INDEX "IDX_feedback_emoji_change_original" ON "feedback_emoji_change_request" ("originalRequestId")');
		await queryRunner.query('CREATE INDEX "IDX_feedback_emoji_change_status" ON "feedback_emoji_change_request" ("status")');
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feedback_emoji_change_active" ON "feedback_emoji_change_request" ("targetEmojiId") WHERE "status" IN ('pending', 'held')`);
		await queryRunner.query('ALTER TABLE "feedback_emoji_request" ADD "cancelledAt" timestamptz, ADD "cancellationReason" varchar(1024)');
		await queryRunner.query(`COMMENT ON COLUMN "feedback_emoji_request"."status" IS 'pending / held / approved / rejected / cancelled'`);
		await queryRunner.query('ALTER TABLE "feedback_notification" ADD "emojiChangeRequestId" varchar(32) CONSTRAINT "FK_feedback_notification_emoji_change" REFERENCES "feedback_emoji_change_request"("id") ON DELETE SET NULL');
	}

	async down() {
		throw new Error('Emoji change history and cancellations must be backed up before a manual rollback.');
	}
}
