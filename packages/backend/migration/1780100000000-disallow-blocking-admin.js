/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: サーバー管理者 (isAdministrator ロールを持つユーザー) に対する
 * 既存のブロック / ミュート / リノートミュートを全削除する。
 *
 * hata-11.5 から管理者をブロック/ミュートする操作は API レベルで拒否されるが、
 * リリース前にユーザーが行った既存のブロック/ミュートはそのままだと残るため、
 * 整合性のため一括削除する。
 *
 * 削除されたレコードは復元不可。down() は no-op。
 */
export class DisallowBlockingAdmin1780100000000 {
	name = 'DisallowBlockingAdmin1780100000000';

	async up(queryRunner) {
		// 管理者ユーザーIDの集合 (ロール経由で動的判定: role.isAdministrator = true)
		const adminUserIdsSubquery = `
			SELECT DISTINCT ra."userId"
			FROM "role_assignment" ra
			JOIN "role" r ON ra."roleId" = r."id"
			WHERE r."isAdministrator" = true
		`;
		await queryRunner.query(`DELETE FROM "blocking" WHERE "blockeeId" IN (${adminUserIdsSubquery})`);
		await queryRunner.query(`DELETE FROM "muting" WHERE "muteeId" IN (${adminUserIdsSubquery})`);
		await queryRunner.query(`DELETE FROM "renote_muting" WHERE "muteeId" IN (${adminUserIdsSubquery})`);
	}

	async down(queryRunner) {
		// 削除されたレコードは復元不可
	}
}
