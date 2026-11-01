/*
 * 旗鯖fork: HataFeed プロジェクトにジャンル(genre)カラムを追加。
 */
export class FeedbackProjectGenre1783800000000 {
	name = 'FeedbackProjectGenre1783800000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_project" ADD "genre" character varying(128)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_project" DROP COLUMN "genre"`);
	}
}
