/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 既存サーバーで Meta.iconUrl が旧CherryPick由来のデフォルトアイコン
 * (ピンク髪のキャラクターアイコン)に設定されている場合に、
 * NULLにリセットして Hataskey版の動的アイコン(プレーン単色SVG)に
 * 切り替える。
 *
 * 対象: iconUrl に以下の文字列を含むレコード
 *   - 'about-icon.png'(CherryPick 旧 about ページのキャラクターアイコン)
 *   - 'cherrypick-icon'(クライアントアセット由来の汎用CherryPickアイコン)
 *
 * 上記に該当しないカスタムアイコン(管理者が独自に設定したもの)には
 * 影響を与えないようにする。
 */

export class MigrateLegacyCherryPickIconUrlToNull1777000000000 {
	name = 'MigrateLegacyCherryPickIconUrlToNull1777000000000';

	async up(queryRunner) {
		// 旧CherryPick由来の典型的なアイコンURLを NULL にリセット
		// (LIKE で部分一致させて、URLのオリジン部分が変わっていても確実にヒットさせる)
		await queryRunner.query(`
			UPDATE "meta"
			SET "iconUrl" = NULL
			WHERE "iconUrl" LIKE '%about-icon.png%'
			   OR "iconUrl" LIKE '%cherrypick-icon%'
		`);
	}

	async down(queryRunner) {
		// down は何もしない:
		// このマイグレは「不要なデータの除去」が目的で、元の値の復元は意味がない
		// (動的アイコンの方が望ましいため)
	}
}
