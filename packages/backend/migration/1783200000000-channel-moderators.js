/*
 * 旗鯖fork: チャンネルの副管理者。
 *   channel に moderatorUserIds(副管理者) を追加する。
 *   hataskey Lite ではプライベートチャンネルを撤去したため、非公開・あいことば・メンバーの列と表は作らない。
 *   ⚠️Hataskeyから移行したDBでは、PrivateChannel1783200000000 がこの列を作り済み。IF NOT EXISTS で二重作成を避ける。
 */
export class ChannelModerators1783200000000 {
	name = 'ChannelModerators1783200000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "moderatorUserIds" character varying(32) array NOT NULL DEFAULT '{}'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "moderatorUserIds"`);
	}
}
