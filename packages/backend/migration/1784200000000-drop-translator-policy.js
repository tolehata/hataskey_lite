/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class DropTranslatorPolicy1784200000000 {
	name = 'DropTranslatorPolicy1784200000000';

	async up(queryRunner) {
		// 旗鯖fork: 11.7.6 で Translation 機能を完全削除したが、meta.policies / role.policies
		// JSON カラムに canUseTranslator / canUseAutoTranslate キーが過去の version の値として
		// 残ったままだった (API /meta レスポンスで policies.canUseTranslator: true が返り続ける)。
		// 既存インストール向けにこれらキーを JSON から削除する。
		await queryRunner.query(`UPDATE "meta" SET "policies" = "policies" - 'canUseTranslator' - 'canUseAutoTranslate'`);
		await queryRunner.query(`UPDATE "role" SET "policies" = "policies" - 'canUseTranslator' - 'canUseAutoTranslate' WHERE "policies" ? 'canUseTranslator' OR "policies" ? 'canUseAutoTranslate'`);
	}

	async down(queryRunner) {
		// no-op: 一度削除した policy キーは復元しない (機能自体が削除されているため意味がない)
	}
}
