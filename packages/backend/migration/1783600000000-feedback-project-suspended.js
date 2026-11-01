/*
 * 旗鯖fork: HataFeed プロジェクトにサスペンド(一時停止)フラグを追加。
 */
export class FeedbackProjectSuspended1783600000000 {
	name = 'FeedbackProjectSuspended1783600000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_project" ADD "suspended" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_project_suspended" ON "feedback_project" ("suspended")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_feedback_project_suspended"`);
		await queryRunner.query(`ALTER TABLE "feedback_project" DROP COLUMN "suspended"`);
	}
}
