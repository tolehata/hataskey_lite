/* SPDX-License-Identifier: AGPL-3.0-only */
export class AddHatadyModerationReview1789250000000 {
	name = 'AddHatadyModerationReview1789250000000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_moderation_review" (
			"targetType" varchar(16) NOT NULL,
			"targetId" varchar(32) NOT NULL,
			"state" varchar(16) NOT NULL DEFAULT 'unreviewed',
			"note" varchar(1000) NOT NULL DEFAULT '',
			"revision" integer NOT NULL DEFAULT 1,
			"contentVersion" varchar(64) NOT NULL,
			"reviewerId" varchar(32),
			"reviewedAt" timestamptz NOT NULL,
			CONSTRAINT "PK_hatady_moderation_review" PRIMARY KEY ("targetType", "targetId"),
			CONSTRAINT "CHK_hatady_moderation_target" CHECK ("targetType" IN ('book','log','comment','reaction','mediaWork','mediaSession','mediaComment','mediaReaction')),
			CONSTRAINT "CHK_hatady_moderation_state" CHECK ("state" IN ('unreviewed','flagged','reviewed')),
			CONSTRAINT "CHK_hatady_moderation_revision" CHECK ("revision" > 0),
			CONSTRAINT "FK_hatady_moderation_reviewer" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL
		)`);
		await queryRunner.query('CREATE INDEX "IDX_hatady_moderation_review_state" ON "hatady_moderation_review" ("state")');
	}

	async down() {
		throw new Error('Hatady moderation review rollback requires an explicit annotation backup; no data was removed.');
	}
}
