/*
 * 旗鯖fork: 地震・津波情報のサーバープッシュ通知設定テーブル。
 */
export class EarthquakeNotification1784000000000 {
	name = 'EarthquakeNotification1784000000000';

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "earthquake_notification" ("userId" character varying(32) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "mode" character varying(16) NOT NULL DEFAULT 'intensity', "threshold" integer NOT NULL DEFAULT 40, "pref" character varying(32), CONSTRAINT "PK_earthquake_notification" PRIMARY KEY ("userId"))`);
		await queryRunner.query(`ALTER TABLE "earthquake_notification" ADD CONSTRAINT "FK_earthquake_notification_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "earthquake_notification" DROP CONSTRAINT "FK_earthquake_notification_user"`);
		await queryRunner.query(`DROP TABLE "earthquake_notification"`);
	}
}
