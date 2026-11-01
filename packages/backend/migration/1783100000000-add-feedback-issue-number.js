/*
 * 旗鯖fork: feedback_issue にイシュー番号(連番)カラムを追加する。
 * 会話内で「#番号」として参照・リンクするために使う。既存行には作成順で連番を振る。
 */
export class AddFeedbackIssueNumber1783100000000 {
	name = 'AddFeedbackIssueNumber1783100000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_issue" ADD "number" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_issue_number" ON "feedback_issue" ("number")`);
		// 既存行に作成順で連番を振る。
		await queryRunner.query(`
			WITH numbered AS (
				SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn FROM "feedback_issue"
			)
			UPDATE "feedback_issue" f SET "number" = n.rn FROM numbered n WHERE f."id" = n."id"
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_feedback_issue_number"`);
		await queryRunner.query(`ALTER TABLE "feedback_issue" DROP COLUMN "number"`);
	}
}
