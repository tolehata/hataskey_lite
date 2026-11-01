/*
 * 旗鯖fork: HataFeed イシューに任意提出のコード(code)カラムを追加。
 */
export class FeedbackIssueCode1783400000000 {
	name = 'FeedbackIssueCode1783400000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_issue" ADD "code" character varying(16384)`);
		await queryRunner.query(`COMMENT ON COLUMN "feedback_issue"."code" IS 'Optional submitted code snippet attached to the issue.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_issue" DROP COLUMN "code"`);
	}
}
