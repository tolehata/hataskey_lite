/*
 * 旗鯖fork: HataFeed コメントに返信先(replyToId)とマーク(mark)を追加。
 */
export class FeedbackCommentThreadMark1783700000000 {
	name = 'FeedbackCommentThreadMark1783700000000';

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "feedback_comment" ADD "replyToId" character varying(32)`);
		await queryRunner.query(`ALTER TABLE "feedback_comment" ADD "mark" character varying(16)`);
		await queryRunner.query(`CREATE INDEX "IDX_feedback_comment_replyToId" ON "feedback_comment" ("replyToId")`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_feedback_comment_replyToId"`);
		await queryRunner.query(`ALTER TABLE "feedback_comment" DROP COLUMN "mark"`);
		await queryRunner.query(`ALTER TABLE "feedback_comment" DROP COLUMN "replyToId"`);
	}
}
