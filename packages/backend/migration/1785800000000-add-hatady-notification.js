/*
 * 旗鯖fork: Hatady 独自の通知テーブル(hatady_notification)を追加。
 *   リアクション/コメント等を受信者ごとに保持し、Hatady の通知ページ(1h)で表示する。
 */
export class AddHatadyNotification1785800000000 {
	name = 'AddHatadyNotification1785800000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "hatady_notification" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "notifieeId" character varying(32) NOT NULL, "notifierId" character varying(32), "type" character varying(32) NOT NULL, "logId" character varying(32), "commentId" character varying(32), "reaction" character varying(260), "value" integer, "isRead" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_hatady_notification" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_createdAt" ON "hatady_notification" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_notifieeId" ON "hatady_notification" ("notifieeId")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_isRead" ON "hatady_notification" ("isRead")`);
		await queryRunner.query(`CREATE INDEX "IDX_hatady_notification_notifiee_createdAt" ON "hatady_notification" ("notifieeId", "createdAt")`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_notifieeId" FOREIGN KEY ("notifieeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_notifierId" FOREIGN KEY ("notifierId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_logId" FOREIGN KEY ("logId") REFERENCES "hatady_log"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" ADD CONSTRAINT "FK_hatady_notification_commentId" FOREIGN KEY ("commentId") REFERENCES "hatady_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_commentId"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_logId"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_notifierId"`);
		await queryRunner.query(`ALTER TABLE "hatady_notification" DROP CONSTRAINT "FK_hatady_notification_notifieeId"`);
		await queryRunner.query(`DROP TABLE "hatady_notification"`);
	}
}
