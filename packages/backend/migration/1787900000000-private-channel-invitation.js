/*
 * 旗鯖fork: プライベートチャンネルを即時追加から本人承認式の参加招待へ変更する。
 */
export class PrivateChannelInvitation1787900000000 {
	name = 'PrivateChannelInvitation1787900000000'

	async up(queryRunner) {
		await queryRunner.query(`CREATE TABLE "channel_invitation" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "respondedAt" TIMESTAMP WITH TIME ZONE, "channelId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "invitedById" character varying(32), "status" character varying(16) NOT NULL DEFAULT 'pending', CONSTRAINT "CHK_channel_invitation_status" CHECK ("status" IN ('pending', 'rejected')), CONSTRAINT "PK_channel_invitation" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_channelId" ON "channel_invitation" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_userId" ON "channel_invitation" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_invitedById" ON "channel_invitation" ("invitedById")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_invitation_status" ON "channel_invitation" ("status")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_invitation_channelId_userId" ON "channel_invitation" ("channelId", "userId")`);
		await queryRunner.query(`ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_channelId" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_invitation" ADD CONSTRAINT "FK_channel_invitation_invitedById" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "channel_invitation"`);
	}
}
