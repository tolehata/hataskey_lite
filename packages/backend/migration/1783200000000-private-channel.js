/*
 * 旗鯖fork: プライベートチャンネル機能。
 *   channel に isPrivate / password(あいことば) / moderatorUserIds(副管理者) を追加し、
 *   メンバーシップ用の channel_member テーブルを作成する。
 */
export class PrivateChannel1783200000000 {
	name = 'PrivateChannel1783200000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "channel" ADD "isPrivate" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_isPrivate" ON "channel" ("isPrivate")`);
		await queryRunner.query(`ALTER TABLE "channel" ADD "password" character varying(128)`);
		await queryRunner.query(`ALTER TABLE "channel" ADD "moderatorUserIds" character varying(32) array NOT NULL DEFAULT '{}'`);

		await queryRunner.query(`CREATE TABLE "channel_member" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "channelId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, CONSTRAINT "PK_channel_member" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_member_channelId" ON "channel_member" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_member_userId" ON "channel_member" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_member_channelId_userId" ON "channel_member" ("channelId", "userId")`);
		await queryRunner.query(`ALTER TABLE "channel_member" ADD CONSTRAINT "FK_channel_member_channelId" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_member" ADD CONSTRAINT "FK_channel_member_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "channel_member"`);
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "moderatorUserIds"`);
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "password"`);
		await queryRunner.query(`DROP INDEX "IDX_channel_isPrivate"`);
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "isPrivate"`);
	}
}
