/*
 * 旗鯖fork: 既存のプライベートチャンネルもチャンネル外リノート不可で固定する。
 *   (作成/更新時は別途強制しているが、既存データを揃えるためのデータマイグレーション)
 */
export class PrivateChannelNoExternalRenote1783300000000 {
	name = 'PrivateChannelNoExternalRenote1783300000000';

	async up(queryRunner) {
		await queryRunner.query(`UPDATE "channel" SET "allowRenoteToExternal" = false WHERE "isPrivate" = true`);
	}

	async down(queryRunner) {
		// 元の値は復元できないため何もしない(意図的な制限のため)。
	}
}
