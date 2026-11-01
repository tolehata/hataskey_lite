/* SPDX-License-Identifier: AGPL-3.0-only */
export class FeedbackIssueIntegrity1790380300000 {
	name = 'FeedbackIssueIntegrity1790380300000';

	async up(queryRunner) {
		// Run inside the migration transaction. Never renumber existing # links.
		await queryRunner.query('LOCK TABLE "feedback_issue", "feedback_agree", "feedback_comment" IN ACCESS EXCLUSIVE MODE');
		await queryRunner.query(`DO $$ BEGIN
			IF EXISTS (SELECT 1 FROM "feedback_issue" GROUP BY "number" HAVING COUNT(*) > 1) THEN
				RAISE EXCEPTION 'Duplicate feedback issue numbers: resolve existing references before applying this migration';
			END IF;
		END $$`);
		await queryRunner.query('CREATE UNIQUE INDEX "IDX_feedback_issue_number_unique" ON "feedback_issue" ("number")');
		await queryRunner.query('DROP INDEX "IDX_feedback_issue_number"');
		await queryRunner.query('CREATE SEQUENCE "feedback_issue_number_seq" AS integer OWNED BY "feedback_issue"."number"');
		await queryRunner.query(`SELECT setval('feedback_issue_number_seq', GREATEST(COALESCE(MAX("number"), 0), 0) + 1, false) FROM "feedback_issue"`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" ALTER COLUMN "number" SET DEFAULT nextval('feedback_issue_number_seq'::regclass)`);
		// Repair counters from their source rows, including historical double deletes.
		await queryRunner.query(`UPDATE "feedback_issue" AS issue SET
			"agreementsCount" = (SELECT COUNT(*) FROM "feedback_agree" WHERE "feedbackId" = issue."id"),
			"commentsCount" = (SELECT COUNT(*) FROM "feedback_comment" WHERE "feedbackId" = issue."id")`);
	}

	async down(queryRunner) {
		await queryRunner.query('ALTER TABLE "feedback_issue" ALTER COLUMN "number" SET DEFAULT 0');
		await queryRunner.query('DROP SEQUENCE "feedback_issue_number_seq"');
		await queryRunner.query('DROP INDEX "IDX_feedback_issue_number_unique"');
		await queryRunner.query('CREATE INDEX "IDX_feedback_issue_number" ON "feedback_issue" ("number")');
	}
}
