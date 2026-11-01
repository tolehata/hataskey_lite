/*
 * 旗鯖fork: HataFeed プロジェクトにテーマカラー(color)カラムを追加。
 */
export class FeedbackProjectColor1783500000000 {
	name = 'FeedbackProjectColor1783500000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_project" ADD "color" character varying(16)`);
		await queryRunner.query(`COMMENT ON COLUMN "feedback_project"."color" IS 'Project theme color (e.g. #3b9eff). null = default.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_project" DROP COLUMN "color"`);
	}
}
